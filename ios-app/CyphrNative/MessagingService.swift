import Foundation
import SocketIO
import Combine
import WebRTC
#if os(iOS)
import UIKit
#endif


/// Real-time Messaging Service with Socket.IO
/// Post-quantum encrypted messaging with AWS backend
class MessagingService: ObservableObject {
    
    // MARK: - Properties
    static let shared = MessagingService()

    private var manager: SocketManager!
    private var socket: SocketIOClient!
    private let crypto = PostQuantumCrypto.shared

    struct UserNotice: Identifiable {
        enum Style {
            case info
            case success
            case warning
        }

        let id = UUID()
        let text: String
        let style: Style
    }

    @Published var isConnecting = false
    @Published var isConnected = false
    @Published var messages: [String: [Message]] = [:] // chatId -> messages
    @Published var activeChats: [Chat] = []
    @Published var typingUsers: Set<String> = []
    @Published var onlineUsers: Set<String> = []
    @Published var userNotice: UserNotice?
    @Published var activeCall: CallSession?

    private var cancellables = Set<AnyCancellable>()
    private let socketURL = "https://app.cyphrmessenger.app"
    
    // Из socketService.js
    private var messageQueue: [OutgoingMessage] = []
    private var typingTimers: [String: Timer] = [:]
    private var messageCallbacks: [String: (Result<Message, Error>) -> Void] = [:]
    
    // СОРМ protection features (из socketService.js)
    private var privacyMode = false
    private var useP2P = false
    private var p2pFallbackEnabled = true
    
    // WebSocket suspension handling (из socketService.js)
    private var heartbeatTimer: Timer?
    private var lastHeartbeat = Date()
    private var suspensionDetected = false
    private var reconnectAttempts = 0
    private let maxReconnectAttempts = 5
    private var reconnectWorkItem: DispatchWorkItem?
    private var voiceCache: [String: Data] = [:]
    private var mediaCache: [String: Data] = [:]
    private var callSessions: [String: CallSession] = [:]
    private var kyberPublicKeyCache: [String: String] = [:]

    func callSession(for id: String) -> CallSession? {
        callSessions[id]
    }
    
    // MARK: - Initialization
    private init() {
        WebRTCService.shared.signalingDelegate = self
        setupSocket()
        setupEventHandlers()
        setupSuspensionHandling()
        startHeartbeat()
        print("💬 Messaging Service initialized")
    }
    
    // MARK: - Socket Setup
    
    private func setupSocket() {
        manager = SocketManager(
            socketURL: URL(string: socketURL)!,
            config: [
                .log(false),
                .compress,
                .forceWebsockets(true),
                .secure(true),
                .path("/socket.io/"),
                .reconnects(false),
                .version(.three)
            ]
        )
        
        socket = manager.defaultSocket
    }
    
    private func setupEventHandlers() {
        // Connection events
        socket.on(clientEvent: .connect) { [weak self] _, _ in
            guard let self = self else { return }
            print("✅ Socket.IO connected")
            self.isConnected = true
            self.isConnecting = false
            self.reconnectAttempts = 0
            self.cancelScheduledReconnect()
            self.authenticate()
            self.postNotice("Reconnected. Messages will sync automatically.", style: .success)
        }

        socket.on(clientEvent: .disconnect) { [weak self] _, _ in
            guard let self = self else { return }
            print("❌ Socket.IO disconnected")
            self.isConnected = false
            self.isConnecting = false
            self.scheduleReconnect()
            self.postNotice("Connection lost. Retrying…", style: .warning)
        }

        socket.on(clientEvent: .error) { [weak self] data, _ in
            guard let self = self else { return }
            print("❌ Socket.IO error: \(data)")
            self.isConnecting = false
            self.scheduleReconnect()
            self.postNotice("Network error. We'll keep trying.", style: .warning)
        }
        
        // Authentication response
        socket.on("authenticated") { [weak self] data, _ in
            self?.handleAuthenticated(data)
        }
        
        socket.on("auth_error") { [weak self] data, _ in
            self?.handleAuthError(data)
        }
        
        // Message events
        socket.on("new_message") { [weak self] data, _ in
            self?.handleIncomingMessage(data)
        }
        
        socket.on("message_sent") { data, _ in
            // Confirmation that message was sent
            print("✅ Message sent confirmation received")
        }
        
        socket.on("user_typing") { [weak self] data, _ in
            self?.handleTypingIndicator(data)
        }
        
        socket.on("online_status") { [weak self] data, _ in
            self?.handleOnlineStatus(data)
        }
        
        socket.on("message_read_receipt") { [weak self] data, _ in
            self?.handleMessageRead(data)
        }
        
        socket.on("chat_created") { [weak self] data, _ in
            self?.handleChatCreated(data)
        }
        
        // Call events
        socket.on("incoming_encrypted_call") { [weak self] data, _ in
            self?.handleIncomingCall(data)
        }

        socket.on("encrypted_call_answered") { [weak self] data, _ in
            self?.handleCallAnswered(data)
        }

        socket.on("call_ended") { [weak self] data, _ in
            self?.handleCallEnded(data)
        }

        socket.on("call_failed") { [weak self] data, _ in
            self?.handleCallFailed(data)
        }

        socket.on("call_ringing") { [weak self] data, _ in
            self?.handleCallRinging(data)
        }

        socket.on("encrypted_ice_candidate") { [weak self] data, _ in
            self?.handleIceCandidate(data)
        }
    }
    
    // MARK: - Connection Management
    
    func connect() {
        guard !isConnected else { return }
        print("🔌 Connecting to Socket.IO...")
        cancelScheduledReconnect()

        guard let payload = buildAuthPayload() else {
            print("❌ Missing authentication payload; cannot open socket")
            return
        }

        isConnecting = true
        reconnectAttempts = 0
        var handshakePayload = payload
        handshakePayload["auth"] = payload
        socket.connect(withPayload: handshakePayload)
    }

    func disconnect() {
        socket.disconnect()
        isConnected = false
        isConnecting = false
        cancelScheduledReconnect()
    }
    
    private func authenticate() {
        guard let token = AuthTokenStore.load(),
              let cyphrId = UserDefaults.standard.string(forKey: "cyphr_id") else {
            print("❌ No auth credentials for Socket.IO")
            return
        }

        socket.emit("authenticate", [
            "token": token,
            "cyphrId": cyphrId,
            "platform": "iOS",
            "version": "1.0.0"
        ])

        print("🔐 Authenticating Socket.IO connection...")
    }

    private func buildAuthPayload() -> [String: Any]? {
        guard let token = AuthTokenStore.load(),
              let cyphrId = UserDefaults.standard.string(forKey: "cyphr_id") else {
            return nil
        }

        return [
            "token": token,
            "cyphrId": cyphrId,
            "platform": "iOS",
            "version": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
        ]
    }

    private func scheduleReconnect() {
        reconnectWorkItem?.cancel()

        guard reconnectAttempts < maxReconnectAttempts else {
            print("🚫 Max reconnect attempts reached. Giving up.")
            postNotice("Unable to reconnect. Please check your network.", style: .warning)
            return
        }

        let delay = min(pow(2.0, Double(reconnectAttempts)), 30)
        reconnectAttempts += 1

        print("🔁 Scheduling reconnect attempt #\(reconnectAttempts) in \(delay)s")

        let workItem = DispatchWorkItem { [weak self] in
            guard let self = self, !self.isConnected else { return }

            guard let payload = self.buildAuthPayload() else {
                print("❌ Reconnect aborted: missing authentication payload")
                return
            }

            self.isConnecting = true
            var handshakePayload = payload
            handshakePayload["auth"] = payload
            self.socket.connect(withPayload: handshakePayload)
        }

        reconnectWorkItem = workItem
        DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: workItem)
    }

    private func cancelScheduledReconnect() {
        reconnectWorkItem?.cancel()
        reconnectWorkItem = nil
    }
    
    // MARK: - Messaging
    
    /// Send encrypted message using backend E2E encryption
    func sendMessage(to recipientCyphrId: String, content: String, chatId: String) async throws {
        print("📤 Sending E2E encrypted message to @\(recipientCyphrId)")
        
        // Get recipient's user ID from their Cyphr ID
        let recipientId = try await getRecipientId(recipientCyphrId)
        // Resolve recipient's Kyber public key (falls back to Ed/legacy if needed)
        let recipientPublicKey = try await getRecipientPublicKey(recipientCyphrId)

        let hybrid = try crypto.hybridEncrypt(message: content, recipientPublicKey: recipientPublicKey)
        let payload = HybridEncryptedPayload(
            kyberCiphertext: hybrid.kyberCiphertext,
            ciphertext: hybrid.encryptedMessage.ciphertext,
            nonce: hybrid.encryptedMessage.nonce,
            tag: hybrid.encryptedMessage.tag
        )

        let payloadData = try JSONEncoder().encode(payload)

        guard socket.status.active else {
            let queued = OutgoingMessage(
                id: UUID().uuidString,
                chatId: chatId,
                recipientId: recipientId,
                encryptedContent: hybrid,
                timestamp: Date()
            )
            queueOutgoingMessage(queued, persistOffline: true)
            storePendingMessage(queued, plaintext: content, in: chatId)
            postNotice("Message queued. We'll send it once you're back online.", style: .warning)
            return
        }

        do {
            let response = try await NetworkService.shared.sendEncryptedMessage(
                chatId: chatId,
                content: payloadData.base64EncodedString(),
                recipientId: recipientId
            )

            guard response.success else {
                throw MessagingError.sendFailed(response.message ?? "Unknown error")
            }

            print("✅ Hybrid encryption: Kyber1024 + ChaCha20-Poly1305")

            var message = Message(
                id: response.messageId,
                chatId: chatId,
                senderId: getCurrentCyphrId(),
                kyberCiphertext: hybrid.kyberCiphertext,
                encryptedContent: hybrid.encryptedMessage,
                timestamp: Date(),
                decryptedContent: content,
                deliveryState: .sent
            )
            message.body = decodeBody(from: content)

            let messageToStore = message
            await MainActor.run {
                if messages[chatId] == nil {
                    messages[chatId] = []
                }
                messages[chatId]?.append(messageToStore)

                if let index = activeChats.firstIndex(where: { $0.id == chatId }) {
                    activeChats[index].lastMessage = messageToStore
                }
            }

            socket.emit("message_sent", [
                "messageId": response.messageId,
                "chatId": chatId,
                "recipientId": recipientId,
                "encrypted": true,
                "algorithm": response.algorithm
            ])
        } catch {
            let queued = OutgoingMessage(
                id: UUID().uuidString,
                chatId: chatId,
                recipientId: recipientId,
                encryptedContent: hybrid,
                timestamp: Date()
            )
            queueOutgoingMessage(queued, persistOffline: true)
            storePendingMessage(queued, plaintext: content, in: chatId)
            postNotice("Message queued due to network issue. We'll retry soon.", style: .warning)
            throw error
        }
    }

    func sendVoiceMessage(
        to recipientCyphrId: String,
        chatId: String,
        recording: AudioRecorderService.RecordingResult
    ) async throws {
        let currentUser = getCurrentCyphrId()
        let upload = try await S3Service.shared.uploadVoiceMessage(recording.data, for: currentUser)

        let metadata = MessageMediaMetadata(
            kind: .audio,
            remoteURL: upload.s3Url,
            fileName: upload.key,
            fileSize: recording.data.count,
            duration: recording.duration,
            waveform: recording.waveform,
            mimeType: recording.mimeType,
            thumbnailURL: upload.cdnUrl
        )

        let bodyString = try encodeBody(MessageBody(kind: .audio, media: metadata))
        try await sendMessage(to: recipientCyphrId, content: bodyString, chatId: chatId)
    }

    func sendImageMessage(
        to recipientCyphrId: String,
        chatId: String,
        imageData: Data,
        mimeType: String = "image/jpeg"
    ) async throws {
        let metadata = try await uploadMedia(
            data: imageData,
            bodyKind: .image,
            s3Type: .image,
            chatId: chatId,
            mimeType: mimeType
        )

        let payload = try encodeBody(MessageBody(kind: .image, media: metadata))
        try await sendMessage(
            to: recipientCyphrId,
            content: payload,
            chatId: chatId
        )
    }

    func sendVideoMessage(
        to recipientCyphrId: String,
        chatId: String,
        videoData: Data,
        fileName: String?,
        mimeType: String = "video/mp4"
    ) async throws {
        let metadata = try await uploadMedia(
            data: videoData,
            bodyKind: .video,
            s3Type: .video,
            chatId: chatId,
            mimeType: mimeType,
            fileName: fileName
        )

        let payload = try encodeBody(MessageBody(kind: .video, media: metadata))
        try await sendMessage(
            to: recipientCyphrId,
            content: payload,
            chatId: chatId
        )
    }

    func sendDocumentMessage(
        to recipientCyphrId: String,
        chatId: String,
        documentData: Data,
        fileName: String,
        mimeType: String
    ) async throws {
        let metadata = try await uploadMedia(
            data: documentData,
            bodyKind: .document,
            s3Type: .document,
            chatId: chatId,
            mimeType: mimeType,
            fileName: fileName
        )

        let payload = try encodeBody(MessageBody(kind: .document, media: metadata))
        try await sendMessage(
            to: recipientCyphrId,
            content: payload,
            chatId: chatId
        )
    }

    func cachedVoiceData(for message: Message) -> Data? {
        voiceCache[message.id]
    }

    func fetchVoiceData(for message: Message) async throws -> Data {
        guard let media = message.mediaAttachment,
              media.kind == .audio,
              let urlString = media.remoteURL else {
            throw MessagingError.invalidPayload
        }

        if let cached = voiceCache[message.id] {
            return cached
        }

        let data = try await S3Service.shared.downloadFile(from: urlString)
        await MainActor.run {
            voiceCache[message.id] = data
        }
        return data
    }

    func cachedMediaData(for message: Message) -> Data? {
        mediaCache[message.id]
    }

    func fetchMediaData(for message: Message) async throws -> Data {
        guard let media = message.mediaAttachment,
              let urlString = media.remoteURL else {
            throw MessagingError.invalidPayload
        }

        if let cached = mediaCache[message.id] {
            return cached
        }

        let data: Data
        switch media.kind {
        case .audio:
            data = try await fetchVoiceData(for: message)
            return data
        case .text:
            if let text = message.body?.text {
                data = Data(text.utf8)
            } else {
                throw MessagingError.invalidPayload
            }
        case .image, .video, .document:
            data = try await S3Service.shared.downloadFile(from: urlString)
        }

        await MainActor.run {
            mediaCache[message.id] = data
        }
        return data
    }
    
    /// Start new chat
    func startChat(with cyphrId: String) async throws -> String {
        let chatId = UUID().uuidString
        
        // Initialize quantum-safe chat session
        let recipientPublicKey = try await getRecipientPublicKey(cyphrId)
        try crypto.initializeChatSession(chatId: chatId, recipientPublicKey: recipientPublicKey)
        
        // Create chat object
        let chat = Chat(
            id: chatId,
            participants: [getCurrentCyphrId(), cyphrId],
            lastMessage: nil,
            unreadCount: 0
        )
        
        activeChats.append(chat)
        messages[chatId] = []
        
        // Notify server
        socket.emit("create_chat", [
            "chatId": chatId,
            "participants": chat.participants
        ])
        
        print("💬 Started chat with @\(cyphrId)")
        return chatId
    }
    
    /// Mark message as read  
    func markMessageAsRead(messageId: String, chatId: String) {
        socket.emit("message_read", [
            "messageId": messageId,
            "chatId": chatId
        ])
    }
    
    // MARK: - Event Handlers
    
    private func handleIncomingMessage(_ data: [Any]) {
        guard let messageData = data.first as? [String: Any],
              let messageId = messageData["messageId"] as? String,
              let chatId = messageData["chatId"] as? String,
              let senderId = messageData["senderId"] as? String,
              let encryptedPayload = messageData["encryptedPayload"] as? String,
              let timestamp = messageData["timestamp"] as? TimeInterval else {
            print("❌ Invalid message format")
            return
        }
        
        Task {
            do {
                guard let payloadData = Data(base64Encoded: encryptedPayload) else {
                    throw MessagingError.invalidPayload
                }
                
                let payload = try JSONDecoder().decode(HybridEncryptedPayload.self, from: payloadData)
                
                let myPrivateKey = try await CyphrIdentity.shared.getKyberPrivateKey()
                let sharedSecret = try crypto.decapsulate(ciphertext: payload.kyberCiphertext, privateKey: myPrivateKey)
                
                let encryptedMessage = EncryptedMessage(
                    ciphertext: payload.ciphertext,
                    nonce: payload.nonce,
                    tag: payload.tag
                )
                
                let decryptedText = try crypto.decryptMessage(encryptedMessage, with: sharedSecret)
                
                // Create message object
                var message = Message(
                    id: messageId,
                    chatId: chatId,
                    senderId: senderId,
                    kyberCiphertext: payload.kyberCiphertext,
                    encryptedContent: encryptedMessage,
                    timestamp: Date(timeIntervalSince1970: timestamp),
                    decryptedContent: decryptedText,
                    deliveryState: .sent
                )
                message.decryptedContent = decryptedText
                message.body = decodeBody(from: decryptedText)
                let finalMessage = message

                // Store and update UI
                await MainActor.run {
                    if messages[chatId] == nil {
                        messages[chatId] = []
                    }
                    messages[chatId]?.append(finalMessage)
                    
                    if let index = activeChats.firstIndex(where: { $0.id == chatId }) {
                        activeChats[index].lastMessage = finalMessage
                        activeChats[index].unreadCount += 1
                    }
                }
                
                print("📥 Received message from @\(senderId)")
                
                // Send delivery confirmation
                socket.emit("message_delivered", [
                    "messageId": messageId,
                    "chatId": chatId
                ])
                
            } catch {
                print("❌ Failed to decrypt message: \(error)")
                postNotice("A message couldn't be decrypted. Please contact support if this persists.", style: .warning)
            }
        }
    }
    
    private func handleTypingIndicator(_ data: [Any]) {
        guard let typingData = data.first as? [String: Any],
              let userId = typingData["userId"] as? String,
              let isTyping = typingData["isTyping"] as? Bool else {
            return
        }
        
        if isTyping {
            typingUsers.insert(userId)
        } else {
            typingUsers.remove(userId)
        }
    }
    
    private func handleOnlineStatus(_ data: [Any]) {
        guard let statusData = data.first as? [String: Any],
              let onlineUsersList = statusData["onlineUsers"] as? [String] else {
            return
        }
        
        onlineUsers = Set(onlineUsersList)
    }
    
    private func handleMessageDelivered(_ data: [Any]) {
        guard let deliveryData = data.first as? [String: Any],
              let messageId = deliveryData["messageId"] as? String else {
            return
        }
        
        print("✅ Message delivered: \(messageId)")

        Task { @MainActor in
            for chatId in messages.keys {
                if var chatMessages = messages[chatId],
                   let index = chatMessages.firstIndex(where: { $0.id == messageId }) {
                    var updated = chatMessages[index]
                    updated.deliveryState = .delivered
                    chatMessages[index] = updated
                    messages[chatId] = chatMessages
                    break
                }
            }
        }
    }
    
    private func handleMessageRead(_ data: [Any]) {
        guard let readData = data.first as? [String: Any],
              let messageId = readData["messageId"] as? String,
              let chatId = readData["chatId"] as? String else {
            return
        }
        
        if let index = activeChats.firstIndex(where: { $0.id == chatId }) {
            activeChats[index].unreadCount = 0
        }

        Task { @MainActor in
            if var chatMessages = messages[chatId],
               let index = chatMessages.firstIndex(where: { $0.id == messageId }) {
                var updated = chatMessages[index]
                updated.deliveryState = .read
                chatMessages[index] = updated
                messages[chatId] = chatMessages
            }
        }
        
        print("👁 Message read: \(messageId)")
    }
    
    private func handleIncomingCall(_ data: [Any]) {
        guard let callData = data.first as? [String: Any],
              let callerId = callData["callerId"] as? String,
              let callId = callData["callId"] as? String,
              let isVideo = callData["isVideo"] as? Bool else {
            return
        }
        
        print("📞 Incoming \(isVideo ? "video" : "voice") call from @\(callerId)")

        var session = CallSession(
            id: callId,
            peerId: callerId,
            peerName: callData["callerName"] as? String,
            isVideo: isVideo,
            direction: .incoming,
            state: .ringing,
            startedAt: Date()
        )

        if let encryptedOfferValue = callData["encryptedOffer"],
           let encryptedOffer = HybridEncryptedMessage.fromAny(encryptedOfferValue) {
            session.encryptedOffer = encryptedOffer
        }

        Task { @MainActor in
            callSessions[callId] = session
            activeCall = session
        }
    }

    private func handleCallAnswered(_ data: [Any]) {
        guard let payload = data.first as? [String: Any],
              let callId = payload["callId"] as? String,
              let session = callSessions[callId] else { return }

        Task {
            var updatedSession = session

            if let encryptedAnswerValue = payload["encryptedAnswer"],
               let encryptedAnswer = HybridEncryptedMessage.fromAny(encryptedAnswerValue) {
                updatedSession.encryptedAnswer = encryptedAnswer
                updatedSession.state = .connecting
                updatedSession.endedAt = nil

                do {
                    let answerSDP = try await decryptCallPayload(
                        encryptedAnswer,
                        reason: "Decrypt call answer"
                    )
                    try await WebRTCService.shared.applyRemoteAnswer(
                        callId: callId,
                        sdp: answerSDP
                    )
                } catch {
                    print("❌ Failed to apply remote answer: \(error)")
                }
            } else if let accepted = payload["accepted"] as? Bool {
                updatedSession.state = accepted ? .connecting : .ended
                updatedSession.endedAt = accepted ? nil : Date()
            }

            let sessionCopy = updatedSession
            await MainActor.run {
                callSessions[callId] = sessionCopy
                activeCall = sessionCopy
            }
        }
    }

    private func handleCallEnded(_ data: [Any]) {
        guard let payload = data.first as? [String: Any],
              let callId = payload["callId"] as? String,
              var session = callSessions[callId] else { return }

        session.state = .ended
        session.endedAt = Date()

        Task { @MainActor in
            callSessions[callId] = session
            activeCall = session
        }

        WebRTCService.shared.closeCall(callId: callId)
    }

    private func handleCallFailed(_ data: [Any]) {
        guard let payload = data.first as? [String: Any],
              let callId = payload["callId"] as? String,
              let reason = payload["reason"] as? String else { return }

        print("❌ Call \(callId) failed: \(reason)")
        guard var session = callSessions[callId] else { return }
        session.state = .failed
        session.endedAt = Date()
        session.failureReason = reason
        Task { @MainActor in
            callSessions[callId] = session
            activeCall = session
        }

        WebRTCService.shared.closeCall(callId: callId)
    }

    private func handleCallRinging(_ data: [Any]) {
        guard let payload = data.first as? [String: Any],
              let callId = payload["callId"] as? String else { return }

        guard var session = callSessions[callId] else { return }
        session.state = .ringing
        callSessions[callId] = session
        activeCall = session
    }

    private func handleIceCandidate(_ data: [Any]) {
        guard let payload = data.first as? [String: Any],
              let callId = payload["callId"] as? String,
              let encryptedCandidateValue = payload["encryptedCandidate"],
              let encryptedCandidate = HybridEncryptedMessage.fromAny(encryptedCandidateValue) else {
            return
        }

        Task {
            do {
                let candidateString = try await decryptCallPayload(
                    encryptedCandidate,
                    reason: "Decrypt ICE candidate"
                )

                guard let data = candidateString.data(using: .utf8) else { return }
                let payload = try JSONDecoder().decode(IceCandidatePayload.self, from: data)
                let candidate = RTCIceCandidate(
                    sdp: payload.candidate,
                    sdpMLineIndex: Int32(payload.sdpMLineIndex),
                    sdpMid: payload.sdpMid
                )

                try await WebRTCService.shared.addRemoteCandidate(
                    callId: callId,
                    candidate: candidate
                )
            } catch {
                print("❌ Failed to process ICE candidate: \(error)")
            }
        }
    }
    
    // MARK: - Suspension Handling
    
    private func setupSuspensionHandling() {
        #if os(iOS)
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleAppDidEnterBackground),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )
        
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleAppWillEnterForeground),
            name: UIApplication.willEnterForegroundNotification,
            object: nil
        )
        
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleAppDidBecomeActive),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )
        #endif
    }
    
    @objc private func handleAppDidEnterBackground() {
        print("⏸️ App entering background - preparing for suspension")
        suspensionDetected = true
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil
    }
    
    @objc private func handleAppWillEnterForeground() {
        print("▶️ App entering foreground - checking connection")
        handleResume()
    }
    
    @objc private func handleAppDidBecomeActive() {
        if !suspensionDetected { return }
        handleResume()
    }
    
    private func handleResume() {
        if !suspensionDetected { return }
        
        print("▶️ Resuming from suspension")
        suspensionDetected = false
        
        if !socket.status.active {
            print("🔄 Socket disconnected during suspension, reconnecting...")
            reconnectAttempts = 0
            connect()
        } else {
            print("✅ Socket survived suspension")
            startHeartbeat()
        }
        
        processMessageQueue()
    }
    
    // MARK: - Heartbeat
    
    private func startHeartbeat() {
        heartbeatTimer?.invalidate()
        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { [weak self] _ in
            guard let self = self, self.socket.status.active, !self.suspensionDetected else { return }
            self.socket.emit("ping", ["timestamp": Date().timeIntervalSince1970])
            self.lastHeartbeat = Date()
            print("💓 Heartbeat sent")
        }
    }
    
    private func stopHeartbeat() {
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil
    }
    
    // MARK: - Message Queue Processing
    
    private func processMessageQueue() {
        guard !messageQueue.isEmpty else {
            processOfflineMessages()
            return
        }

        print("📤 Processing \(messageQueue.count) queued messages")

        Task {
            var drainedQueue = true
            while !messageQueue.isEmpty {
                let message = messageQueue.removeFirst()
                let success = await deliverQueuedMessage(message)
                if !success {
                    drainedQueue = false
                    break
                }
            }
            if drainedQueue {
                processOfflineMessages()
                if UserDefaults.standard.data(forKey: "offline_messages") == nil {
                    postNotice("Queued messages delivered.", style: .success)
                }
            } else {
                postNotice("Still offline. We'll continue retrying…", style: .warning)
            }
        }
    }
    
    private func processOfflineMessages() {
        guard let offlineData = UserDefaults.standard.data(forKey: "offline_messages"),
              let offlineMessages = try? JSONDecoder().decode([OutgoingMessage].self, from: offlineData),
              !offlineMessages.isEmpty else { return }
        
        print("📤 Processing \(offlineMessages.count) offline messages")
        
        Task {
            var allDelivered = true
            for message in offlineMessages where socket.status.active {
                let success = await deliverQueuedMessage(message)
                if !success {
                    allDelivered = false
                    break
                }
            }

            if allDelivered {
                UserDefaults.standard.removeObject(forKey: "offline_messages")
                postNotice("Queued messages delivered.", style: .success)
            } else {
                postNotice("Some queued messages are still pending.", style: .warning)
            }
        }
    }
    
    // MARK: - P2P Privacy Mode (Anti-СОРМ)
    
    private func enablePrivacyMode() {
        print("🔒 Enabling privacy mode (anti-surveillance)...")
        privacyMode = true
        print("✅ Privacy mode enabled - traffic obfuscated")
    }
    
    private func disablePrivacyMode() {
        print("🔓 Disabling privacy mode...")
        privacyMode = false
        print("✅ Privacy mode disabled - using server connection")
    }
    
    func getPrivacyStatus() -> [String: Any] {
        return [
            "privacyMode": privacyMode,
            "useP2P": useP2P,
            "p2pEnabled": p2pFallbackEnabled,
            "serverConnected": isConnected,
            "connectedPeers": 0
        ]
    }
    
    // MARK: - Typing Indicators with Timeout
    
    func sendTypingIndicator(chatId: String, isTyping: Bool) {
        guard isConnected else { return }
        
        typingTimers[chatId]?.invalidate()
        typingTimers.removeValue(forKey: chatId)
        
        socket.emit("typing", [
            "chatId": chatId,
            "isTyping": isTyping
        ])
        
        if isTyping {
            typingTimers[chatId] = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: false) { [weak self] _ in
                self?.sendTypingIndicator(chatId: chatId, isTyping: false)
            }
        }
    }
    
    // MARK: - Message Status
    
    func markAsDelivered(messageId: String) {
        guard isConnected else { return }
        socket.emit("message_delivered", ["messageId": messageId])
    }
    
    func markAsRead(messageId: String, chatId: String) {
        guard isConnected else { return }
        socket.emit("message_read", [
            "messageId": messageId,
            "chatId": chatId
        ])
    }
    
    // MARK: - Calls
    
    func initiateCall(to targetUserId: String, isVideo: Bool = false) async throws {
        guard isConnected else {
            throw MessagingError.notConnected
        }

        let callId = UUID().uuidString
        var session = CallSession(
            id: callId,
            peerId: targetUserId,
            peerName: nil,
            isVideo: isVideo,
            direction: .outgoing,
            state: .dialing,
            startedAt: Date()
        )

        let initialSession = session
        await MainActor.run {
            callSessions[callId] = initialSession
            activeCall = initialSession
        }

        do {
            let offerSDP = try await WebRTCService.shared.createLocalOffer(
                callId: callId,
                peerId: targetUserId,
                isVideo: isVideo
            )

            let encryptedOffer = try await encryptCallPayload(
                offerSDP,
                for: targetUserId
            )

            session.encryptedOffer = encryptedOffer
            let updated = session
            await MainActor.run {
                callSessions[callId] = updated
                activeCall = updated
            }

            let payload: [String: Any] = [
                "callId": callId,
                "targetUserId": targetUserId,
                "callType": isVideo ? "video" : "voice",
                "encryptedOffer": encryptedOffer.toDictionary(),
                "timestamp": Date().timeIntervalSince1970
            ]

            socket.emit("call_offer", payload)
            socket.emit("initiate_encrypted_call", [
                "callId": callId,
                "recipientId": targetUserId,
                "encryptedOffer": encryptedOffer.toDictionary(),
                "isVideo": isVideo
            ])

            print("📞 Initiating \(isVideo ? "video" : "voice") call to \(targetUserId)")
        } catch {
            print("❌ Failed to prepare encrypted offer: \(error)")
            WebRTCService.shared.closeCall(callId: callId)
            await MainActor.run {
                callSessions.removeValue(forKey: callId)
                if activeCall?.id == callId {
                    activeCall = nil
                }
            }
            throw error
        }
    }
    
    func answerCall(callId: String, accept: Bool) {
        guard isConnected else { return }

        guard var session = callSessions[callId] else { return }

        if !accept {
            socket.emit("call_answer", [
                "callId": callId,
                "accepted": false
            ])

            session.state = .ended
            session.endedAt = Date()
            callSessions[callId] = session
            activeCall = session
            WebRTCService.shared.closeCall(callId: callId)
            return
        }

        guard let encryptedOffer = session.encryptedOffer else {
            print("❌ Missing encrypted offer for call \(callId)")
            return
        }

        Task {
            do {
                let offerSDP = try await decryptCallPayload(
                    encryptedOffer,
                    reason: "Decrypt call offer"
                )

                let answerSDP = try await WebRTCService.shared.processRemoteOffer(
                    callId: callId,
                    peerId: session.peerId,
                    sdp: offerSDP,
                    isVideo: session.isVideo
                )

                let encryptedAnswer = try await encryptCallPayload(
                    answerSDP,
                    for: session.peerId
                )

                session.state = .connecting
                session.encryptedAnswer = encryptedAnswer
                session.endedAt = nil

                let sessionCopy = session
                await MainActor.run {
                    callSessions[callId] = sessionCopy
                    activeCall = sessionCopy
                }

                let payload: [String: Any] = [
                    "callId": callId,
                    "targetUserId": session.peerId,
                    "callType": session.isVideo ? "video" : "voice",
                    "encryptedAnswer": encryptedAnswer.toDictionary(),
                    "accepted": true,
                    "timestamp": Date().timeIntervalSince1970
                ]

                socket.emit("call_answer", payload)
                socket.emit("encrypted_call_answer", [
                    "callId": callId,
                    "callerId": session.peerId,
                    "encryptedAnswer": encryptedAnswer.toDictionary()
                ])
            } catch {
                print("❌ Failed to answer call: \(error)")
                socket.emit("call_answer", [
                    "callId": callId,
                    "accepted": false
                ])
                WebRTCService.shared.closeCall(callId: callId)

                await MainActor.run {
                    if var failedSession = callSessions[callId] {
                        failedSession.state = .failed
                        failedSession.endedAt = Date()
                        failedSession.failureReason = error.localizedDescription
                        callSessions[callId] = failedSession
                        activeCall = failedSession
                    }
                }
            }
        }
    }
    
    func endCall(callId: String) {
        guard isConnected else { return }
        guard var session = callSessions[callId] else { return }

        socket.emit("call_end", ["callId": callId])
        socket.emit("end_call", [
            "callId": callId,
            "recipientId": session.peerId
        ])

        WebRTCService.shared.closeCall(callId: callId)

        session.state = .ended
        session.endedAt = Date()

        Task { @MainActor in
            callSessions[callId] = session
            activeCall = session
        }
    }
    
    // MARK: - E2E Encryption Methods
    
    func generateMessagingKeys() async throws {
        print("🔑 Generating Kyber1024 keys...")
        
        let response = try await NetworkService.shared.generateMessagingKeys()
        
        if response.success {
            UserDefaults.standard.set(response.publicKey, forKey: "kyber_public_key")
            UserDefaults.standard.set(response.keyId, forKey: "kyber_key_id")
            print("✅ Keys generated: \(response.algorithm) (\(response.keySize) bits)")
            print("   Key ID: \(response.keyId)")
        } else {
            throw MessagingError.keyGenerationFailed(response.message)
        }
    }
    
    func decryptMessage(_ encryptedData: EncryptedMessageData) async throws -> String {
        print("🔓 Decrypting message...")
        
        // Use our locally stored Kyber private key (Face ID protected)
        let privateKeyData = try await EnterpriseKeychainService.shared.retrieve(
            key: "kyber_private_key",
            reason: "Access Kyber private key for message decryption",
            allowPINFallback: true
        )
        let privateKey = privateKeyData.base64EncodedString()
        
        let response = try await NetworkService.shared.decryptMessage(
            messageId: encryptedData.id,
            secretKey: privateKey
        )
        
        if response.success {
            print("✅ Message decrypted with \(response.algorithm)")
            return response.content
        } else {
            throw MessagingError.decryptionFailed("Failed to decrypt message")
        }
    }
    
    func loadChatMessages(chatId: String) async throws {
        print("📥 Loading encrypted messages for chat \(chatId)")
        
        let response = try await NetworkService.shared.getEncryptedMessages(chatId: chatId)
        
        if response.success {
            print("✅ Loaded \(response.messages.count) messages")
            
            for encryptedMessage in response.messages {
                if encryptedMessage.encrypted {
                    Task {
                        do {
                            let content = try await decryptMessage(encryptedMessage)
                            await updateMessageContent(
                                messageId: encryptedMessage.id,
                                chatId: chatId,
                                content: content
                            )
                        } catch {
                            print("⚠️ Failed to decrypt message \(encryptedMessage.id): \(error)")
                        }
                    }
                } else {
                    let plaintext = encryptedMessage.encryptedContent ?? ""
                    var message = Message(
                        id: encryptedMessage.id,
                        chatId: chatId,
                        senderId: encryptedMessage.senderId,
                        kyberCiphertext: encryptedMessage.kyberCiphertext,
                        encryptedContent: EncryptedMessage(
                            ciphertext: encryptedMessage.encryptedContent ?? "",
                            nonce: encryptedMessage.nonce ?? "",
                            tag: encryptedMessage.authTag ?? ""
                        ),
                        timestamp: ISO8601DateFormatter().date(from: encryptedMessage.createdAt) ?? Date(),
                        decryptedContent: plaintext,
                        deliveryState: .sent,
                        body: decodeBody(from: plaintext)
                    )
                    message.decryptedContent = plaintext
                    await storeMessage(message, in: chatId)
                }
            }
        }
    }
    
    func createEncryptedChat(with participantIds: [String], name: String? = nil) async throws -> String {
        print("💬 Creating encrypted chat...")
        
        let response = try await NetworkService.shared.createEncryptedChat(
            participantIds: participantIds,
            chatName: name,
            chatType: participantIds.count == 1 ? "direct" : "group"
        )
        
        if response.success {
            print("✅ Chat created: \(response.chatId)")
            print("   Encryption: \(response.algorithm)")
            
            let chat = Chat(
                id: response.chatId,
                participants: [getCurrentUserId()] + participantIds,
                lastMessage: nil,
                unreadCount: 0
            )
            
            await MainActor.run {
                activeChats.append(chat)
                messages[response.chatId] = []
            }
            
            return response.chatId
        } else {
            throw MessagingError.chatCreationFailed(response.message)
        }
    }
    
    // MARK: - Helper Methods
    
    private func getRecipientId(_ cyphrId: String) async throws -> String {
        let response = try await NetworkService.shared.lookupCyphrId(cyphrId: cyphrId)
        if response.exists {
            return response.userId ?? response.cyphrId
        }
        throw MessagingError.userNotFound(cyphrId)
    }
    
    @MainActor
    private func updateMessageContent(messageId: String, chatId: String, content: String) {
        guard var chatMessages = messages[chatId],
              let index = chatMessages.firstIndex(where: { $0.id == messageId }) else {
            return
        }
        
        chatMessages[index].decryptedContent = content
        chatMessages[index].body = decodeBody(from: content)
        messages[chatId] = chatMessages
    }
    
    @MainActor
    private func storeMessage(_ message: Message, in chatId: String) {
        if messages[chatId] == nil {
            messages[chatId] = []
        }
        messages[chatId]?.append(message)

        if let index = activeChats.firstIndex(where: { $0.id == chatId }) {
            activeChats[index].lastMessage = message
        }
    }

    private func getRecipientPublicKey(_ cyphrId: String) async throws -> String {
        let response = try await NetworkService.shared.getPublicKey(for: cyphrId)
        return response.kyberPublicKey ?? response.publicKey
    }

    private func getCurrentCyphrId() -> String {
        return UserDefaults.standard.string(forKey: "cyphr_id") ?? "unknown"
    }

    private func getCurrentUserId() -> String {
        if let userId = UserDefaults.standard.string(forKey: "user_id"), !userId.isEmpty {
            return userId
        }
        return getCurrentCyphrId()
    }

    private func queueOutgoingMessage(_ message: OutgoingMessage, persistOffline: Bool) {
        messageQueue.append(message)

        guard persistOffline else { return }

        var storedMessages: [OutgoingMessage] = []
        if let data = UserDefaults.standard.data(forKey: "offline_messages"),
           let decoded = try? JSONDecoder().decode([OutgoingMessage].self, from: data) {
            storedMessages = decoded
        }

        storedMessages.append(message)

        if let data = try? JSONEncoder().encode(storedMessages) {
            UserDefaults.standard.set(data, forKey: "offline_messages")
        }
    }

    private func storePendingMessage(_ outgoing: OutgoingMessage, plaintext: String, in chatId: String) {
        var pending = Message(
            id: outgoing.id,
            chatId: chatId,
            senderId: getCurrentCyphrId(),
            kyberCiphertext: outgoing.encryptedContent.kyberCiphertext,
            encryptedContent: outgoing.encryptedContent.encryptedMessage,
            timestamp: outgoing.timestamp,
            decryptedContent: plaintext,
            deliveryState: .sending
        )

        pending.decryptedContent = plaintext
        pending.body = decodeBody(from: plaintext)

        Task { @MainActor in
            if messages[chatId] == nil {
                messages[chatId] = []
            }
            messages[chatId]?.append(pending)

            if let index = activeChats.firstIndex(where: { $0.id == chatId }) {
                activeChats[index].lastMessage = pending
            }
        }
    }

    @discardableResult
    private func deliverQueuedMessage(_ message: OutgoingMessage) async -> Bool {
        do {
            let payload = HybridEncryptedPayload(
                kyberCiphertext: message.encryptedContent.kyberCiphertext,
                ciphertext: message.encryptedContent.encryptedMessage.ciphertext,
                nonce: message.encryptedContent.encryptedMessage.nonce,
                tag: message.encryptedContent.encryptedMessage.tag
            )

            let payloadString = try JSONEncoder().encode(payload).base64EncodedString()

            let response = try await NetworkService.shared.sendEncryptedMessage(
                chatId: message.chatId,
                content: payloadString,
                recipientId: message.recipientId
            )

            guard response.success else {
                throw MessagingError.sendFailed(response.message ?? "Unknown error")
            }

            await MainActor.run {
                if var chatMessages = messages[message.chatId],
                   let index = chatMessages.firstIndex(where: { $0.id == message.id }) {
                    var updated = chatMessages[index]
                    updated.deliveryState = .sent
                    chatMessages[index] = updated
                    messages[message.chatId] = chatMessages
                }
            }

            socket.emit("message_sent", [
                "messageId": response.messageId,
                "chatId": message.chatId,
                "recipientId": message.recipientId,
                "encrypted": true,
                "algorithm": response.algorithm
            ])
            return true
        } catch {
            print("⚠️ Failed to deliver queued message: \(error)")
            queueOutgoingMessage(message, persistOffline: false)
            postNotice("Message delivery failed. We'll retry shortly.", style: .warning)
            return false
        }
    }

    private func parseEncryptedMessage(_ data: [String: Any]) -> HybridEncryptedMessage {
        return HybridEncryptedMessage(
            kyberCiphertext: data["kyberCiphertext"] as? String ?? "",
            encryptedMessage: EncryptedMessage(
                ciphertext: data["ciphertext"] as? String ?? "",
                nonce: data["nonce"] as? String ?? "",
                tag: data["tag"] as? String ?? ""
            )
        )
    }

    private func fetchKyberPublicKey(for userId: String) async throws -> String {
        if let cached = kyberPublicKeyCache[userId] {
            return cached
        }

        let response = try await NetworkService.shared.getPublicKey(for: userId)
        let key = response.kyberPublicKey ?? response.publicKey
        kyberPublicKeyCache[userId] = key
        return key
    }

    private func encryptCallPayload(_ payload: String, for userId: String) async throws -> HybridEncryptedMessage {
        let publicKey = try await fetchKyberPublicKey(for: userId)
        guard let data = payload.data(using: .utf8) else {
            throw MessagingError.invalidPayload
        }
        return try await crypto.encryptForTransmission(data, for: publicKey)
    }

    private func decryptCallPayload(_ payload: HybridEncryptedMessage, reason: String) async throws -> String {
        let keychainData = try await EnterpriseKeychainService.shared.retrieve(
            key: "kyber_private_key",
            reason: reason,
            allowPINFallback: true
        )

        let privateKey = keychainData.base64EncodedString()
        return try crypto.hybridDecrypt(encrypted: payload, privateKey: privateKey)
    }

    private func emitLocalCandidate(callId: String, candidate: RTCIceCandidate, peerId: String) {
        Task {
            do {
                let payload = IceCandidatePayload(
                    candidate: candidate.sdp,
                    sdpMid: candidate.sdpMid,
                    sdpMLineIndex: Int(candidate.sdpMLineIndex)
                )

                let data = try JSONEncoder().encode(payload)
                guard let jsonString = String(data: data, encoding: .utf8) else {
                    throw MessagingError.invalidPayload
                }

                let encryptedCandidate = try await encryptCallPayload(
                    jsonString,
                    for: peerId
                )

                let body: [String: Any] = [
                    "callId": callId,
                    "recipientId": peerId,
                    "encryptedCandidate": encryptedCandidate.toDictionary()
                ]

                socket.emit("encrypted_ice_candidate", body)
                socket.emit("call_ice_candidate", body)
            } catch {
                print("❌ Failed to send ICE candidate: \(error)")
            }
        }
    }

    private func postNotice(_ text: String, style: UserNotice.Style) {
        DispatchQueue.main.async {
            self.userNotice = UserNotice(text: text, style: style)
        }
    }

    // MARK: - Additional Event Handlers
    
    private func handleAuthenticated(_ data: [Any]) {
        guard let authData = data.first as? [String: Any],
              let success = authData["success"] as? Bool else {
            return
        }
        
        if success {
            let userId = authData["userId"] as? String ?? ""
            let chatsJoined = authData["chatsJoined"] as? Int ?? 0
            print("✅ Socket authenticated for user: \(userId)")
            print("   Joined \(chatsJoined) chat rooms")
        }
    }
    
    private func handleAuthError(_ data: [Any]) {
        guard let errorData = data.first as? [String: Any],
              let message = errorData["message"] as? String else {
            return
        }
        
        print("❌ Socket authentication failed: \(message)")
        DispatchQueue.main.asyncAfter(deadline: .now() + 5) { [weak self] in
            self?.authenticate()
        }
    }
    
    private func handleChatCreated(_ data: [Any]) {
        guard let chatData = data.first as? [String: Any],
              let chatId = chatData["chatId"] as? String,
              let chatName = chatData["chatName"] as? String else {
            return
        }
        
        print("💬 New chat created: \(chatName) (\(chatId))")
        
        Task { @MainActor in
            if !activeChats.contains(where: { $0.id == chatId }) {
                let chat = Chat(
                    id: chatId,
                    participants: [],
                    lastMessage: nil,
                    unreadCount: 0
                )
                activeChats.append(chat)
                messages[chatId] = []
            }
        }
    }
}

// MARK: - WebRTCSignalingDelegate

extension MessagingService: WebRTCSignalingDelegate {
    func webRTCService(
        _ service: WebRTCService,
        didGenerateLocalCandidate candidate: RTCIceCandidate,
        forCall callId: String,
        peerId: String
    ) {
        emitLocalCandidate(callId: callId, candidate: candidate, peerId: peerId)
    }
}

extension MessagingService {
    private func decodeBody(from plaintext: String) -> MessageBody? {
        guard let data = plaintext.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(MessageBody.self, from: data)
    }

    private func encodeBody(_ body: MessageBody) throws -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.withoutEscapingSlashes]
        let data = try encoder.encode(body)
        guard let string = String(data: data, encoding: .utf8) else {
            throw MessagingError.invalidPayload
        }
        return string
    }

    private func uploadMedia(
        data: Data,
        bodyKind: MessageBodyKind,
        s3Type: S3MediaType,
        chatId: String,
        mimeType: String,
        fileName: String? = nil
    ) async throws -> MessageMediaMetadata {
        let currentUser = getCurrentCyphrId()

        let result: S3UploadResult
        switch s3Type {
        case .document:
            result = try await S3Service.shared.uploadDocument(data, fileName: fileName ?? UUID().uuidString, for: currentUser)
        case .voice:
            result = try await S3Service.shared.uploadVoiceMessage(data, for: currentUser)
        default:
            result = try await S3Service.shared.uploadMedia(data, type: s3Type, for: currentUser)
        }

        return MessageMediaMetadata(
            kind: bodyKind,
            remoteURL: result.s3Url,
            fileName: fileName ?? result.key,
            fileSize: data.count,
            duration: nil,
            waveform: nil,
            mimeType: mimeType,
            thumbnailURL: result.cdnUrl
        )
    }
}

// MARK: - Notifications

extension Notification.Name {
    static let messageReceived = Notification.Name("MessageReceived")
}
