import Foundation
import Network
#if os(iOS)
import UIKit
#endif

/// NetworkService - Handles all API communication with Cyphr backend
/// Zero-knowledge protocol: only public keys and encrypted blobs
class NetworkService: ObservableObject {
    static let shared = NetworkService()
    
    // MARK: - Configuration
    
    private let baseURL = "https://app.cyphrmessenger.app"
    private let session: URLSession
    private let monitor = NWPathMonitor()
    
    @Published var isConnected = true
    @Published var connectionError: String?
    
    // MARK: - Initialization
    
    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30.0
        config.timeoutIntervalForResource = 60.0
        self.session = URLSession(configuration: config)
        
        startNetworkMonitoring()
        print("🌐 NetworkService initialized - Backend: \(baseURL)")
    }
    
    private func startNetworkMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                self?.isConnected = path.status == .satisfied
                if path.status != .satisfied {
                    self?.connectionError = "No internet connection"
                } else {
                    self?.connectionError = nil
                }
            }
        }
        
        let queue = DispatchQueue(label: "NetworkMonitor")
        monitor.start(queue: queue)
    }
    
    // MARK: - Test Connectivity
    
    func testConnectivity() async -> Bool {
        do {
            _ = try await makeRequest(endpoint: "/api/health", method: "GET")
            print("✅ Backend connectivity test successful")
            return true
        } catch {
            print("❌ Backend connectivity test failed: \(error)")
            return false
        }
    }
    
    // MARK: - Challenge-Response Authentication (v5.0 spec)

    func getChallenge(for cyphrId: String) async throws -> ChallengeResponse {
        print("🎲 Getting challenge for @\(cyphrId)")

        let endpoint = "/api/cyphr-id/challenge?cyphrId=\(cyphrId)"
        let response = try await makeRequest(endpoint: endpoint, method: "GET", includeAuth: false)

        return try JSONDecoder().decode(ChallengeResponse.self, from: response)
    }

    // MARK: - Recovery Flow (v5.0 spec)

    func initiateRecovery(
        cyphrId: String,
        newDeviceBindingPublicKey: String? = nil,
        newDeviceFingerprintHash: String? = nil
    ) async throws -> RecoveryInitResponse {
        print("🔄 Initiating recovery for @\(cyphrId)")

        var params: [String: Any] = [ "cyphrId": cyphrId ]
        if let newDeviceBindingPublicKey { params["newDeviceBindingPublicKey"] = newDeviceBindingPublicKey }
        if let newDeviceFingerprintHash { params["newDeviceFingerprintHash"] = newDeviceFingerprintHash }

        let response = try await makeRequest(endpoint: "/api/cyphr-id/recovery/init", method: "POST", body: params, includeAuth: false)
        return try JSONDecoder().decode(RecoveryInitResponse.self, from: response)
    }

    func confirmRecovery(
        cyphrId: String,
        challengeId: String,
        recoverySignature: String
    ) async throws -> AuthResponse {
        print("✅ Confirming recovery for @\(cyphrId)")

        let params: [String: Any] = [
            "cyphrId": cyphrId,
            "challengeId": challengeId,
            "recoverySignature": recoverySignature
        ]

        let response = try await makeRequest(endpoint: "/api/cyphr-id/recovery/confirm", method: "POST", body: params, includeAuth: false)
        return try JSONDecoder().decode(AuthResponse.self, from: response)
    }

    // MARK: - Cyphr ID Management

    func checkCyphrIdAvailability(_ cyphrId: String) async throws -> CyphrIdCheckResponse {
        print("🔍 Checking availability for @\(cyphrId)")
        
        let params = ["cyphrId": cyphrId]
        let response = try await makeRequest(endpoint: "/api/cyphr-id/check", method: "POST", body: params, includeAuth: false)
        
        return try JSONDecoder().decode(CyphrIdCheckResponse.self, from: response)
    }
    
    func registerCyphrIdentity(
        cyphrId: String,
        publicKey: String,
        kyberPublicKey: String,
        deviceInfo: DeviceInfo,
        deviceBindingPublicKey: String,
        deviceFingerprintHash: String,
        securityLevel: String = "biometry",
        signature: String
    ) async throws -> AuthResponse {
        print("📝 Registering @\(cyphrId) with backend")

        // v5.0 spec: send explicit fields for keys and device binding
        let params: [String: Any] = [
            "cyphrId": cyphrId,
            "ed25519AuthPublicKey": publicKey,
            "kyberPublicKey": kyberPublicKey,
            "deviceBindingPublicKey": deviceBindingPublicKey,
            "deviceFingerprintHash": deviceFingerprintHash,
            "securityLevel": securityLevel,
            // keep telemetry/device info if server logs/uses them
            "deviceId": deviceInfo.deviceId,
            "deviceModel": deviceInfo.deviceModel,
            "osVersion": deviceInfo.osVersion,
            "appVersion": deviceInfo.appVersion,
            // optional registration signature (server may ignore)
            "signature": signature
        ]

        let response = try await makeRequest(endpoint: "/api/cyphr-id/register", method: "POST", body: params, includeAuth: false)
        
        return try JSONDecoder().decode(AuthResponse.self, from: response)
    }
    
    func loginCyphrIdentity(
        cyphrId: String,
        authSignature: String,
        challengeId: String,
        deviceSignature: String? = nil,
        deviceBindingPublicKey: String? = nil,
        challengePlain: String? = nil
    ) async throws -> AuthResponse {
        print("🔓 Logging in @\(cyphrId)")

        var params: [String: Any] = [
            "cyphrId": cyphrId,
            "authSignature": authSignature,
            "challengeId": challengeId
        ]

        // v5.0: Add dual signature params if provided
        if let deviceSig = deviceSignature { params["deviceSignature"] = deviceSig }
        if let devicePub = deviceBindingPublicKey { params["deviceBindingPublicKey"] = devicePub }
        if let challengePlain = challengePlain { params["challenge"] = challengePlain }

        let response = try await makeRequest(endpoint: "/api/cyphr-id/login", method: "POST", body: params, includeAuth: false)

        return try JSONDecoder().decode(AuthResponse.self, from: response)
    }
    
    func loginCyphrIdentityP256(
        cyphrId: String,
        signatureDER: String,
        deviceFingerprint: String
    ) async throws -> AuthResponse {
        print("🔓 Logging in @\(cyphrId) with P256 fallback")
        
        let params: [String: Any] = [
            "cyphrId": cyphrId,
            "signatureDER": signatureDER,
            "keyType": "P256",
            "deviceFingerprint": deviceFingerprint
        ]
        
        let response = try await makeRequest(endpoint: "/api/cyphr-id/login", method: "POST", body: params, includeAuth: false)

        return try JSONDecoder().decode(AuthResponse.self, from: response)
    }
    
    func lookupCyphrId(cyphrId: String) async throws -> UserLookupResponse {
        print("🔍 Looking up @\(cyphrId)")

        // Server exposes GET /api/cyphr-id/user/:cyphrId returning { success, user: { id, cyphr_id, ... } }
        let endpoint = "/api/cyphr-id/user/\(cyphrId)"
        let data = try await makeRequest(endpoint: endpoint, method: "GET", includeAuth: false)

        struct Envelope: Decodable {
            struct UserRecord: Decodable {
                let id: StringOrInt
                let cyphr_id: String
                let public_key: String?
                let kyber_public_key: String?
            }
            let success: Bool
            let user: UserRecord?
        }

        let env = try JSONDecoder().decode(Envelope.self, from: data)
        if let user = env.user {
            let userIdString = user.id.stringValue
            return UserLookupResponse(exists: true, cyphrId: user.cyphr_id, userId: userIdString)
        } else {
            return UserLookupResponse(exists: false, cyphrId: cyphrId)
        }
    }
    
    // MARK: - Public Key Management
    
    func getPublicKey(for cyphrId: String) async throws -> PublicKeyResponse {
        print("🔑 Getting public key for @\(cyphrId)")

        // Reuse the user lookup endpoint and map fields
        let endpoint = "/api/cyphr-id/user/\(cyphrId)"
        let data = try await makeRequest(endpoint: endpoint, method: "GET", includeAuth: false)

        struct Envelope: Decodable {
            struct UserRecord: Decodable {
                let cyphr_id: String
                let public_key: String?
                let kyber_public_key: String?
            }
            let success: Bool
            let user: UserRecord?
        }

        let env = try JSONDecoder().decode(Envelope.self, from: data)
        guard let user = env.user,
              let pub = user.public_key ?? user.kyber_public_key else {
            throw NetworkError.notFound
        }
        return PublicKeyResponse(cyphrId: user.cyphr_id, publicKey: pub, kyberPublicKey: user.kyber_public_key)
    }
    
    // MARK: - Messaging
    
    func createEncryptedChat(participantIds: [String], chatName: String?, chatType: String) async throws -> CreateChatResponse {
        let params: [String: Any] = [
            "participantIds": participantIds,
            "chatName": chatName ?? "Encrypted Chat",
            "chatType": chatType
        ]

        let response = try await makeRequest(endpoint: "/api/messaging/create-chat", method: "POST", body: params)
        return try JSONDecoder().decode(CreateChatResponse.self, from: response)
    }

    func getEncryptedMessages(chatId: String) async throws -> MessagesResponse {
        let data = try await makeRequest(endpoint: "/api/messaging/chat/\(chatId)", method: "GET")
        return try JSONDecoder().decode(MessagesResponse.self, from: data)
    }

    func generateMessagingKeys() async throws -> MessagingKeysResponse {
        let response = try await makeRequest(endpoint: "/api/messaging/generate-keys", method: "POST", body: [:])
        return try JSONDecoder().decode(MessagingKeysResponse.self, from: response)
    }

    func sendMessage(_ message: HybridEncryptedPayload, to recipientId: String) async throws -> MessageResponse {
        print("💬 Sending message to @\(recipientId)")
        
        let params: [String: Any] = [
            "recipientId": recipientId,
            "encryptedPayload": [
                "kyberCiphertext": message.kyberCiphertext,
                "ciphertext": message.ciphertext,
                "nonce": message.nonce,
                "tag": message.tag
            ]
        ]
        
        let response = try await makeRequest(endpoint: "/api/messaging/send", method: "POST", body: params)
        
        return try JSONDecoder().decode(MessageResponse.self, from: response)
    }
    
    func sendEncryptedMessage(chatId: String, content: String, recipientId: String) async throws -> SendMessageResponse {
        let params: [String: Any] = [
            "chatId": chatId,
            "content": content,
            "recipientId": recipientId
        ]
        let response = try await makeRequest(endpoint: "/api/messaging/send", method: "POST", body: params)
        return try JSONDecoder().decode(SendMessageResponse.self, from: response)
    }

    func decryptMessage(messageId: String, secretKey: String) async throws -> DecryptedMessageResponse {
        let params: [String: Any] = [
            "messageId": messageId,
            "secretKey": secretKey
        ]
        let response = try await makeRequest(endpoint: "/api/messaging/decrypt", method: "POST", body: params)
        return try JSONDecoder().decode(DecryptedMessageResponse.self, from: response)
    }

    func getChatHistory(chatId: String) async throws -> ChatHistoryResponse {
        print("📜 Getting chat history for \(chatId)")
        
        let response = try await makeRequest(endpoint: "/api/messaging/chat/\(chatId)", method: "GET")
        
        return try JSONDecoder().decode(ChatHistoryResponse.self, from: response)
    }
    
    // MARK: - Core Request Method
    
    private func makeRequest(endpoint: String, method: String, body: [String: Any]? = nil, includeAuth: Bool = true) async throws -> Data {
        guard let url = URL(string: baseURL + endpoint) else {
            throw NetworkError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Add auth token if available and requested
        if includeAuth, let token = AuthTokenStore.load() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        if let body = body, method != "GET" {
            do {
                request.httpBody = try JSONSerialization.data(withJSONObject: body)
            } catch {
                throw NetworkError.invalidRequest
            }
        }
        
        print("🌐 \(method) \(endpoint)")
        
        do {
            let (data, response) = try await session.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                throw NetworkError.invalidResponse
            }
            
            print("📡 Response: \(httpResponse.statusCode)")
            
            switch httpResponse.statusCode {
            case 200...299:
                return data
            case 400:
                // Surface message but keep typed error
                if let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let msg = (obj["message"] as? String) ?? (obj["error"] as? String) {
                    throw NetworkError.networkError(msg)
                }
                throw NetworkError.badRequest
            case 401:
                if let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let msg = (obj["message"] as? String) ?? (obj["error"] as? String) {
                    // still unauthorized, but include message in description path
                    throw NetworkError.networkError(msg)
                }
                throw NetworkError.unauthorized
            case 403:
                if let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let msg = (obj["message"] as? String) ?? (obj["error"] as? String) {
                    throw NetworkError.networkError(msg)
                }
                throw NetworkError.forbidden
            case 404:
                // KEY: Always map to .notFound so app logic can react
                throw NetworkError.notFound
            case 500...599:
                if let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let msg = (obj["message"] as? String) ?? (obj["error"] as? String) {
                    throw NetworkError.networkError(msg)
                }
                throw NetworkError.serverError
            default:
                throw NetworkError.unknownError(httpResponse.statusCode)
            }
            
        } catch let error as URLError {
            switch error.code {
            case .notConnectedToInternet:
                throw NetworkError.noConnection
            case .timedOut:
                throw NetworkError.timeout
            default:
                throw NetworkError.networkError(error.localizedDescription)
            }
        } catch let error as NetworkError {
            throw error
        } catch {
            throw NetworkError.unknownError(0)
        }
    }
}

// MARK: - Zero-Knowledge Lookup (Placeholder APIs)

extension NetworkService {
    // These APIs provide compile-time integration for ZeroKnowledgeLookup.
    // They return safe defaults until server endpoints are finalized.

    func queryHashedUsers(cyphrIdHashes: [String]) async throws -> [DiscoveredUser] {
        print("🧪 queryHashedUsers placeholder: returning 0 users for \(cyphrIdHashes.count) hashes")
        return []
    }

    func searchUsername(_ username: String) async throws -> [DiscoveredUser] {
        print("🧪 searchUsername placeholder for @\(username)")
        return []
    }

    func updateDiscoverability(allowCyphrId: Bool, allowPublicKey: Bool) async throws -> Bool {
        print("🧪 updateDiscoverability placeholder: cyphrId=\(allowCyphrId), publicKey=\(allowPublicKey)")
        return true
    }

    func checkUserExists(cyphrIdHash: String) async throws -> Bool {
        print("🧪 checkUserExists placeholder for hash: \(cyphrIdHash.prefix(8))…")
        return false
    }

    func discoverGroups(query: String) async throws -> [GroupInfo] {
        print("🧪 discoverGroups placeholder for query: \(query)")
        return []
    }

    func joinGroup(inviteLink: String) async throws -> Bool {
        print("🧪 joinGroup placeholder for invite: \(inviteLink)")
        return false
    }

    // MARK: - WebRTC / Presence / Media (placeholders)

    func checkUserOnlineStatus(_ cyphrId: String) async throws -> Bool {
        print("🧪 checkUserOnlineStatus placeholder for @\(cyphrId)")
        return false
    }

    func notifyMediaAvailable(chatId: String, mediaId: String, type: String) async throws {
        print("🧪 notifyMediaAvailable placeholder: chatId=\(chatId), mediaId=\(mediaId), type=\(type)")
    }

    func exchangeWebRTCSignaling(with peerId: String, signaling: [String: Any]) async throws -> [String: Any] {
        print("🧪 exchangeWebRTCSignaling placeholder with peerId=\(peerId)")
        // Return an empty answer by default; server integration will replace this
        return ["answer": ""]
    }
}

// MARK: - Wallet APIs (placeholders)

extension NetworkService {
    struct WalletBalance: Codable {
        let xlm: String
        let usdc: String
    }

    func getWalletBalance(cyphrId: String) async throws -> WalletBalance {
        print("🧪 getWalletBalance placeholder for @\(cyphrId)")
        return WalletBalance(xlm: "0", usdc: "0")
    }

    func deleteCyphrIdentity(cyphrId: String) async throws -> Bool {
        // Best-effort server request; falls back gracefully if endpoint is absent
        print("🗑️ Requesting server-side delete for @\(cyphrId)")
        let payload: [String: Any] = [
            // Send both keys for compatibility with legacy handlers
            "cyphrId": cyphrId,
            "cyphr_id": cyphrId
        ]

        // Try a modern endpoint first, then legacy fallback
        do {
            _ = try await makeRequest(endpoint: "/api/cyphr-id/delete-account", method: "POST", body: payload, includeAuth: true)
            print("✅ Server delete-account succeeded for @\(cyphrId)")
            return true
        } catch NetworkError.notFound {
            // Try legacy route if new not present
            do {
                _ = try await makeRequest(endpoint: "/api/cyphr-id/delete", method: "POST", body: payload, includeAuth: true)
                print("✅ Legacy delete succeeded for @\(cyphrId)")
                return true
            } catch {
                print("⚠️ Server delete failed on legacy route: \(error)")
                return false
            }
        } catch {
            print("⚠️ Server delete failed: \(error)")
            return false
        }
    }
}

// MARK: - Response Models

struct CyphrIdCheckResponse: Codable {
    let available: Bool
    let suggestions: [String]?
}

struct ChallengeResponse: Decodable {
    let success: Bool
    let challengeId: String
    let challenge: String
    let ttl: Int // seconds
}

struct RecoveryInitResponse: Decodable {
    let success: Bool
    let challengeId: String?
    let recoveryChallenge: String?
    let ttl: Int?
    let message: String?
}

struct UserLookupResponse: Codable {
    let exists: Bool
    let cyphrId: String
    let userId: String?

    enum CodingKeys: String, CodingKey {
        case exists
        case cyphrId
        case userId
        case userIdentifier = "user_id"
    }

    init(exists: Bool, cyphrId: String, userId: String? = nil) {
        self.exists = exists
        self.cyphrId = cyphrId
        self.userId = userId
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        exists = try container.decode(Bool.self, forKey: .exists)
        cyphrId = try container.decode(String.self, forKey: .cyphrId)
        userId = try container.decodeIfPresent(String.self, forKey: .userId)
            ?? container.decodeIfPresent(String.self, forKey: .userIdentifier)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(exists, forKey: .exists)
        try container.encode(cyphrId, forKey: .cyphrId)
        if let userId {
            try container.encode(userId, forKey: .userId)
        }
    }
}

struct PublicKeyResponse: Codable {
    let cyphrId: String
    let publicKey: String
    let kyberPublicKey: String?
}

struct ChatHistoryResponse: Codable {
    let messages: [NetworkEncryptedMessage]
    let chatId: String
}

struct NetworkEncryptedMessage: Codable {
    let id: String
    let senderId: String
    let encryptedPayload: HybridEncryptedPayload
    let timestamp: String
    let messageType: String?
}

struct MessagesResponse: Codable {
    let success: Bool
    let messages: [EncryptedMessageData]
    let encrypted: Bool
    let algorithm: String
}

struct DecryptedMessageResponse: Codable {
    let success: Bool
    let content: String
    let senderId: String
    let algorithm: String
}

struct SendMessageResponse: Codable {
    let success: Bool
    let messageId: String
    let algorithm: String
    let message: String?
}

struct CreateChatResponse: Codable {
    let success: Bool
    let chatId: String
    let encrypted: Bool
    let algorithm: String
    let message: String
}

struct MessagingKeysResponse: Codable {
    let success: Bool
    let publicKey: String
    let keyId: String
    let algorithm: String
    let keySize: Int
    let message: String
}

// MARK: - Zero-Knowledge Lookup (Support Types)

struct GroupInfo: Codable {
    let id: String
    let name: String
    let description: String?
    let memberCount: Int
    let isPublic: Bool
}

// Helper to decode either numeric or string IDs
struct StringOrInt: Decodable {
    let stringValue: String

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let intValue = try? container.decode(Int.self) {
            self.stringValue = String(intValue)
        } else if let str = try? container.decode(String.self) {
            self.stringValue = str
        } else {
            throw DecodingError.typeMismatch(String.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Expected String or Int"))
        }
    }
}


// MARK: - Error Types

enum NetworkError: LocalizedError {
    case invalidURL
    case invalidRequest
    case invalidResponse
    case noConnection
    case timeout
    case badRequest
    case unauthorized
    case forbidden
    case notFound
    case serverError
    case networkError(String)
    case unknownError(Int)
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidRequest:
            return "Invalid request"
        case .invalidResponse:
            return "Invalid response"
        case .noConnection:
            return "No internet connection"
        case .timeout:
            return "Request timed out"
        case .badRequest:
            return "Bad request"
        case .unauthorized:
            return "Unauthorized access"
        case .forbidden:
            return "Access forbidden"
        case .notFound:
            return "Resource not found"
        case .serverError:
            return "Server error"
        case .networkError(let message):
            return message
        case .unknownError(let code):
            return "Unknown error (code: \(code))"
        }
    }
}
