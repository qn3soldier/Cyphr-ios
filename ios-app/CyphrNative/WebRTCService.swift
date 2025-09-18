import Foundation
import WebRTC
import Combine

/// WebRTC Service for P2P media transfer
/// Implements hybrid approach: P2P when online, S3 fallback when offline
class WebRTCService: ObservableObject {
    static let shared = WebRTCService()
    
    // MARK: - Properties
    private var peerConnections: [String: RTCPeerConnection] = [:]
    private var dataChannels: [String: RTCDataChannel] = [:]
    private let networkService = NetworkService.shared
    private let postQuantumCrypto = PostQuantumCrypto.shared
    
    @Published var connectionStatus: [String: ConnectionStatus] = [:]
    
    enum ConnectionStatus {
        case connecting
        case connected
        case disconnected
        case failed
    }
    
    // WebRTC Configuration
    private lazy var rtcConfig: RTCConfiguration = {
        let config = RTCConfiguration()
        config.iceServers = [
            RTCIceServer(urlStrings: ["stun:stun.l.google.com:19302"]),
            RTCIceServer(urlStrings: ["stun:stun1.l.google.com:19302"])
        ]
        config.sdpSemantics = .unifiedPlan
        config.continualGatheringPolicy = .gatherContinually
        return config
    }()
    
    private static let factory: RTCPeerConnectionFactory = {
        RTCInitializeSSL()
        let videoEncoderFactory = RTCDefaultVideoEncoderFactory()
        let videoDecoderFactory = RTCDefaultVideoDecoderFactory()
        return RTCPeerConnectionFactory(
            encoderFactory: videoEncoderFactory,
            decoderFactory: videoDecoderFactory
        )
    }()
    
    // MARK: - Public Methods
    
    /// Check if user is online for P2P transfer
    func isUserOnline(_ cyphrId: String) async -> Bool {
        do {
            let isOnline = try await networkService.checkUserOnlineStatus(cyphrId)
            return isOnline
        } catch {
            print("❌ Failed to check online status: \(error)")
            return false
        }
    }
    
    /// Send media with hybrid approach (P2P first, S3 fallback)
    func sendMedia(
        _ data: Data,
        type: MediaType,
        to recipient: String
    ) async throws -> SendResult {
        
        // 1. Check if recipient is online
        let isOnline = await isUserOnline(recipient)
        
        if isOnline {
            // 2. Try P2P transfer first
            do {
                let result = try await sendViaP2P(data, to: recipient, type: type)
                print("✅ Media sent via P2P to \(recipient)")
                return result
            } catch {
                print("⚠️ P2P failed, falling back to S3: \(error)")
            }
        }
        
        // 3. Fallback to S3 for offline delivery
        return try await sendViaS3(data, to: recipient, type: type)
    }
    
    // MARK: - P2P Transfer
    
    private func getRecipientPublicKey(_ userId: String) async throws -> String {
        return try await networkService.getPublicKey(for: userId)
    }
    
    private func sendViaP2P(
        _ data: Data,
        to recipient: String,
        type: MediaType
    ) async throws -> SendResult {
        
        // 1. Establish peer connection
        let connection = try await establishConnection(with: recipient)
        
        // 2. Create data channel if needed
        let channel = try await getOrCreateDataChannel(for: recipient, connection: connection)
        
        // 3. Get recipient's public key first
        let recipientKey = try await getRecipientPublicKey(recipient)
        
        // 4. Encrypt data with Kyber1024
        let encryptedPackage = try await postQuantumCrypto.encryptForTransmission(
            data,
            for: recipientKey
        )
        let encryptedData = try JSONEncoder().encode(encryptedPackage)
        
        // 4. Split into chunks for transmission
        let chunks = splitIntoChunks(encryptedData, chunkSize: 16 * 1024) // 16KB chunks
        
        // 5. Send chunks through data channel
        for (index, chunk) in chunks.enumerated() {
            let packet = MediaPacket(
                id: UUID().uuidString,
                type: type,
                chunkIndex: index,
                totalChunks: chunks.count,
                data: chunk
            )
            
            let packetData = try JSONEncoder().encode(packet)
            
            if channel.readyState == .open {
                let buffer = RTCDataBuffer(
                    data: packetData,
                    isBinary: true
                )
                channel.sendData(buffer)
            } else {
                throw WebRTCError.channelNotReady
            }
            
            // Small delay between chunks to avoid overwhelming
            try await Task.sleep(nanoseconds: 10_000_000) // 10ms
        }
        
        return SendResult(
            method: .p2p,
            messageId: UUID().uuidString,
            timestamp: Date()
        )
    }
    
    // MARK: - S3 Fallback
    
    private func sendViaS3(
        _ data: Data,
        to recipient: String,
        type: MediaType
    ) async throws -> SendResult {
        
        // 1. Get recipient's public key and encrypt
        let recipientPublicKey = try await networkService.getPublicKey(for: recipient)
        
        let encryptedPackage = try await postQuantumCrypto.encryptForTransmission(
            data,
            for: recipientPublicKey
        )
        
        let encryptedData = try JSONEncoder().encode(encryptedPackage)
        
        // 2. Upload to S3 with TTL
        let s3Result = try await S3Service.shared.uploadMedia(
            encryptedData,
            type: type,
            for: recipient
        )
        
        // 3. Send notification to recipient about available media
        try await networkService.notifyMediaAvailable(
            chatId: recipient,
            mediaId: s3Result.key,
            type: type.rawValue
        )
        
        return SendResult(
            method: .s3,
            messageId: s3Result.key,
            s3Url: s3Result.cdnUrl,
            timestamp: Date()
        )
    }
    
    // MARK: - WebRTC Connection Management
    
    private func establishConnection(with peerId: String) async throws -> RTCPeerConnection {
        if let existing = peerConnections[peerId],
           existing.connectionState == .connected {
            return existing
        }
        
        let connection = WebRTCService.factory.peerConnection(
            with: rtcConfig,
            constraints: RTCMediaConstraints(
                mandatoryConstraints: nil,
                optionalConstraints: nil
            ),
            delegate: nil
        )
        
        guard let connection = connection else {
            throw WebRTCError.connectionFailed
        }
        
        peerConnections[peerId] = connection
        connectionStatus[peerId] = .connecting
        
        // Create offer
        let offer = try await connection.offer(for: RTCMediaConstraints(
            mandatoryConstraints: ["OfferToReceiveAudio": "false",
                                   "OfferToReceiveVideo": "false"],
            optionalConstraints: nil
        ))
        
        try await connection.setLocalDescription(offer)
        
        // Exchange SDP through signaling server
        let answer = try await exchangeSDP(offer: offer, with: peerId)
        try await connection.setRemoteDescription(answer)
        
        connectionStatus[peerId] = .connected
        return connection
    }
    
    private func getOrCreateDataChannel(
        for peerId: String,
        connection: RTCPeerConnection
    ) async throws -> RTCDataChannel {
        
        if let existing = dataChannels[peerId],
           existing.readyState == .open {
            return existing
        }
        
        let config = RTCDataChannelConfiguration()
        config.isOrdered = true
        config.isNegotiated = false
        
        guard let channel = connection.dataChannel(
            forLabel: "media-transfer",
            configuration: config
        ) else {
            throw WebRTCError.channelCreationFailed
        }
        
        dataChannels[peerId] = channel
        
        // Wait for channel to open
        var attempts = 0
        while channel.readyState != .open && attempts < 30 {
            try await Task.sleep(nanoseconds: 100_000_000) // 100ms
            attempts += 1
        }
        
        if channel.readyState != .open {
            throw WebRTCError.channelTimeout
        }
        
        return channel
    }
    
    private func exchangeSDP(offer: RTCSessionDescription, with peerId: String) async throws -> RTCSessionDescription {
        // Send offer through signaling server and get answer
        let signaling: [String: Any] = [
            "type": "offer",
            "sdp": offer.sdp
        ]
        
        let response = try await networkService.exchangeWebRTCSignaling(
            with: peerId,
            signaling: signaling
        )
        
        guard let answerSdp = response["answer"] as? String else {
            throw WebRTCError.signalingFailed
        }
        
        return RTCSessionDescription(type: .answer, sdp: answerSdp)
    }
    
    // MARK: - Helper Methods
    
    private func splitIntoChunks(_ data: Data, chunkSize: Int) -> [Data] {
        var chunks: [Data] = []
        var offset = 0
        
        while offset < data.count {
            let length = min(chunkSize, data.count - offset)
            let chunk = data.subdata(in: offset..<(offset + length))
            chunks.append(chunk)
            offset += length
        }
        
        return chunks
    }
    
    // MARK: - Cleanup
    
    func closeConnection(with peerId: String) {
        dataChannels[peerId]?.close()
        dataChannels.removeValue(forKey: peerId)
        
        peerConnections[peerId]?.close()
        peerConnections.removeValue(forKey: peerId)
        
        connectionStatus[peerId] = .disconnected
    }
    
    func closeAllConnections() {
        for peerId in peerConnections.keys {
            closeConnection(with: peerId)
        }
    }
}

// MARK: - Supporting Types

enum MediaType: String, Codable {
    case image = "image"
    case video = "video"
    case audio = "audio"
    case document = "document"
}

struct MediaPacket: Codable {
    let id: String
    let type: MediaType
    let chunkIndex: Int
    let totalChunks: Int
    let data: Data
}

struct SendResult {
    enum Method {
        case p2p
        case s3
    }
    
    let method: Method
    let messageId: String
    var s3Url: String? = nil
    let timestamp: Date
}

enum WebRTCError: LocalizedError {
    case connectionFailed
    case channelCreationFailed
    case channelNotReady
    case channelTimeout
    case signalingFailed
    case recipientKeyNotFound
    
    var errorDescription: String? {
        switch self {
        case .connectionFailed:
            return "Failed to establish P2P connection"
        case .recipientKeyNotFound:
            return "Recipient's encryption key not found"
        case .channelCreationFailed:
            return "Failed to create data channel"
        case .channelNotReady:
            return "Data channel is not ready"
        case .channelTimeout:
            return "Data channel connection timeout"
        case .signalingFailed:
            return "WebRTC signaling failed"
        }
    }
}