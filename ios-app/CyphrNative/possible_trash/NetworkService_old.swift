import Foundation
import Combine
#if os(iOS)
import UIKit
#endif

struct GroupInfo: Codable {
    let id: String
    let name: String
    let description: String?
    let memberCount: Int
    let isPublic: Bool
}

/// AWS Backend API Service
/// Connects to production backend at app.cyphrmessenger.app
class NetworkService: ObservableObject {
    
    // MARK: - Properties
    static let shared = NetworkService()
    
    let baseURL = "https://app.cyphrmessenger.app/api"
    private let session: URLSession
    private var cancellables = Set<AnyCancellable>()
    
    @Published var isAuthenticated = false
    @Published var currentUser: User?
    @Published var isConnected = false
    @Published var connectionError: String?
    
    // MARK: - Initialization
    private init() {
        // Configure session for production
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 30
        configuration.timeoutIntervalForResource = 60
        configuration.waitsForConnectivity = false
        configuration.allowsCellularAccess = true
        configuration.allowsConstrainedNetworkAccess = true
        configuration.allowsExpensiveNetworkAccess = true
        
        self.session = URLSession(configuration: configuration)
        
        print("🌐 Network Service initialized with: \(baseURL)")
        print("   Using custom URLSession configuration for better reliability")
        
        // DON'T test connectivity in init() - it won't execute reliably
        // Instead, call testConnectivity() explicitly when needed
    }
    
    // MARK: - Public Methods
    
    /// Test backend connectivity - MUST be called explicitly
    @MainActor
    func testConnectivity() async -> Bool {
        print("🔥 Testing backend connectivity...")
        connectionError = nil
        
        do {
            // Test 1: Simple health check
            let healthURL = URL(string: "\(baseURL)/health")!
            print("   Testing: \(healthURL)")
            
            var request = URLRequest(url: healthURL)
            request.httpMethod = "GET"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.timeoutInterval = 10
            
            let (data, response) = try await session.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse {
                print("✅ Backend health check: \(httpResponse.statusCode)")
                if let responseString = String(data: data, encoding: .utf8) {
                    print("   Response: \(responseString)")
                }
                
                if httpResponse.statusCode == 200 {
                    isConnected = true
                    
                    // Test 2: Cyphr ID check
                    print("🔥 Testing Cyphr ID endpoint...")
                    let testResponse = try await checkCyphrIdAvailability("test_connection_\(Int.random(in: 1000...9999))")
                    print("✅ Cyphr ID check works! Available: \(testResponse.available)")
                    return true
                }
            }
            
            isConnected = false
            connectionError = "Backend returned non-200 status"
            return false
            
        } catch {
            isConnected = false
            print("❌ Backend connection failed!")
            print("   Error: \(error)")
            print("   Type: \(type(of: error))")
            print("   Description: \(error.localizedDescription)")
            
            if let urlError = error as? URLError {
                print("   URL Error Code: \(urlError.code.rawValue)")
                switch urlError.code {
                case .notConnectedToInternet:
                    connectionError = "No internet connection"
                    print("   ⚠️ No internet connection!")
                case .cannotFindHost:
                    connectionError = "Cannot find server"
                    print("   ⚠️ Cannot find host: app.cyphrmessenger.app")
                case .cannotConnectToHost:
                    connectionError = "Cannot connect to server"
                    print("   ⚠️ Cannot connect to host!")
                case .timedOut:
                    connectionError = "Request timed out"
                    print("   ⚠️ Request timed out!")
                case .appTransportSecurityRequiresSecureConnection:
                    connectionError = "ATS security issue"
                    print("   ⚠️ ATS blocking non-secure connection!")
                default:
                    connectionError = "Network error: \(urlError.code)"
                    print("   ⚠️ Other URL error: \(urlError.code)")
                }
            } else {
                connectionError = error.localizedDescription
            }
            
            return false
        }
    }
    
    // MARK: - Authentication
    
    /// Register new Cyphr Identity
    func registerCyphrIdentity(cyphrId: String, publicKey: String, deviceInfo: DeviceInfo) async throws -> AuthResponse {
        let endpoint = "\(baseURL)/cyphr-id/register"
        
        // Canonical signature with device-bound payload
        let deviceFingerprint = deviceInfo.deviceId
        let signature = try await CyphrIdentity.shared.signRegistrationPayload(
            cyphrId: cyphrId,
            publicKey: publicKey,
            deviceFingerprint: deviceFingerprint
        )
        let body = [
            "cyphrId": cyphrId,
            "publicKey": publicKey,
            "deviceFingerprint": deviceFingerprint,
            "displayName": cyphrId,
            "signature": signature
        ]
        
        return try await post(endpoint: endpoint, body: body)
    }
    
    /// Login with existing Cyphr Identity
    func loginCyphrIdentity(cyphrId: String, signature: String) async throws -> AuthResponse {
        let endpoint = "\(baseURL)/cyphr-id/login"
        
        let body = [
            "cyphrId": cyphrId,
            "signature": signature,
            "deviceFingerprint": DeviceInfo.current.deviceId
        ]
        
        return try await post(endpoint: endpoint, body: body)
    }

    /// Legacy P256 login (temporary enterprise fallback)
    func loginCyphrIdentityP256(cyphrId: String, signatureDER: String) async throws -> AuthResponse {
        let endpoint = "\(baseURL)/cyphr-id/login"
        let body = [
            "cyphrId": cyphrId,
            "signatureDER": signatureDER,
            "deviceFingerprint": DeviceInfo.current.deviceId
        ]
        return try await post(endpoint: endpoint, body: body)
    }
    
    /// Check Cyphr ID availability
    func checkCyphrIdAvailability(_ cyphrId: String) async throws -> CyphrIdCheckResponse {
        let endpoint = "\(baseURL)/cyphr-id/check"
        let body = ["cyphrId": cyphrId]
        
        print("🔍 Checking Cyphr ID availability:")
        print("   Endpoint: \(endpoint)")
        print("   Cyphr ID: \(cyphrId)")
        
        do {
            let response: CyphrIdCheckResponse = try await post(endpoint: endpoint, body: body)
            print("✅ Check successful: available=\(response.available)")
            return response
        } catch {
            print("❌ Check failed: \(error)")
            throw error
        }
    }
    
    /// Check user status (PIN/Biometry)
    func checkUserStatus(cyphrId: String) async throws -> UserStatus {
        let endpoint = "\(baseURL)/auth/check-pin"
        let body = ["cyphrId": cyphrId]
        return try await post(endpoint: endpoint, body: body)
    }
    
    /// Delete Cyphr Identity from database
    func deleteCyphrIdentity(cyphrId: String) async throws -> Bool {
        let endpoint = "\(baseURL)/api/cyphr-id/delete"
        let body = ["cyphr_id": cyphrId]
        
        do {
            struct DeleteResponse: Codable {
                let success: Bool
            }
            let response: DeleteResponse = try await post(endpoint: endpoint, body: body)
            return response.success
        } catch {
            print("❌ Failed to delete identity: \(error)")
            return false
        }
    }
    
    // MARK: - Messaging (E2E Encrypted with Kyber1024 + ChaCha20)
    
    /// Get user's public key for encryption
    func getPublicKey(for cyphrId: String) async throws -> String {
        let endpoint = "\(baseURL)/api/messaging/get-public-key"
        let body = ["cyphr_id": cyphrId]
        
        struct PublicKeyResponse: Codable {
            let publicKey: String
            let kyberPublicKey: String
        }
        
        let response: PublicKeyResponse = try await post(endpoint: endpoint, body: body)
        return response.kyberPublicKey // Return Kyber1024 public key for post-quantum encryption
    }
    
    /// Generate Kyber1024 keys for user
    func generateMessagingKeys() async throws -> MessagingKeysResponse {
        let endpoint = "\(baseURL)/messaging/generate-keys"
        let body: [String: String] = [:]
        return try await post(endpoint: endpoint, body: body)
    }
    
    /// Send encrypted message with Kyber1024 + ChaCha20
    func sendEncryptedMessage(chatId: String, content: String, recipientId: String) async throws -> SendMessageResponse {
        let endpoint = "\(baseURL)/messaging/send"
        
        let body: [String: Any] = [
            "chatId": chatId,
            "content": content,
            "recipientId": recipientId
        ]
        
        return try await post(endpoint: endpoint, body: body)
    }
    
    /// Decrypt message using private key
    func decryptMessage(messageId: String, secretKey: String) async throws -> DecryptedMessageResponse {
        let endpoint = "\(baseURL)/messaging/decrypt"
        
        let body: [String: String] = [
            "messageId": messageId,
            "secretKey": secretKey
        ]
        
        return try await post(endpoint: endpoint, body: body)
    }
    
    /// Get encrypted chat messages
    func getEncryptedMessages(chatId: String) async throws -> MessagesResponse {
        let endpoint = "\(baseURL)/messaging/chat/\(chatId)"
        return try await get(endpoint: endpoint)
    }
    
    /// Create encrypted chat
    func createEncryptedChat(participantIds: [String], chatName: String?, chatType: String = "direct") async throws -> CreateChatResponse {
        let endpoint = "\(baseURL)/messaging/create-chat"
        
        let body: [String: Any] = [
            "participantIds": participantIds,
            "chatName": chatName ?? "Encrypted Chat",
            "chatType": chatType
        ]
        
        return try await post(endpoint: endpoint, body: body)
    }
    
    /// Get user chats (legacy - for backward compatibility)
    func getChats() async throws -> [Chat] {
        let endpoint = "\(baseURL)/chats"
        return try await get(endpoint: endpoint)
    }
    
    // MARK: - User Discovery
    
    /// Search users (zero-knowledge)
    func searchUsers(query: String) async throws -> [UserSearchResult] {
        let endpoint = "\(baseURL)/users/search"
        
        // Hash the query for zero-knowledge search
        let hashedQuery = query.data(using: .utf8)?.sha256Hash().hexEncodedString() ?? ""
        
        return try await get(endpoint: "\(endpoint)?q=\(hashedQuery)")
    }
    
    // MARK: - Wallet
    
    /// Get wallet balance
    func getWalletBalance(cyphrId: String) async throws -> WalletBalance {
        let endpoint = "\(baseURL)/wallet/balance/\(cyphrId)"
        return try await get(endpoint: endpoint)
    }
    
    /// Submit transaction
    func submitTransaction(_ transaction: Transaction) async throws -> TransactionResult {
        let endpoint = "\(baseURL)/wallet/transaction"
        return try await post(endpoint: endpoint, body: transaction)
    }
    
    // MARK: - WebRTC Signaling
    
    /// Get ICE servers for WebRTC
    func getIceServers() async throws -> IceServersResponse {
        let endpoint = "\(baseURL)/ice-servers"
        return try await get(endpoint: endpoint)
    }
    
    // MARK: - Pure Cyphr ID Authentication Methods
    
    /// Lookup Cyphr ID
    func lookupCyphrId(cyphrId: String) async throws -> (exists: Bool, userId: String?) {
        let normalized = cyphrId.lowercased().replacingOccurrences(of: "@", with: "")
        // Primary lookup endpoint
        let primary = "\(baseURL)/users/lookup?cyphrId=\(normalized)"
        do {
            let user: User = try await get(endpoint: primary)
            return (true, user.id)
        } catch {
            // Fallback: use /cyphr-id/check and invert available -> exists
            let checkEndpoint = "\(baseURL)/cyphr-id/check"
            struct CheckReq: Codable { let cyphrId: String }
            struct CheckResp: Codable { let available: Bool }
            do {
                let resp: CheckResp = try await post(endpoint: checkEndpoint, body: ["cyphrId": normalized])
                return (!resp.available, nil)
            } catch {
                return (false, nil)
            }
        }
    }
    
    /// Update discoverability settings
    func updateDiscoverability(allowCyphrId: Bool, allowPublicKey: Bool) async throws -> Bool {
        let endpoint = "\(baseURL)/users/discoverability"
        let body = [
            "allowCyphrId": allowCyphrId,
            "allowPublicKey": allowPublicKey
        ]
        let response: [String: Bool] = try await post(endpoint: endpoint, body: body)
        return response["success"] ?? false
    }
    
    /// Discover groups
    func discoverGroups(query: String) async throws -> [GroupInfo] {
        let endpoint = "\(baseURL)/groups/discover"
        let groups: [GroupInfo] = try await get(endpoint: "\(endpoint)?q=\(query)")
        return groups
    }
    
    /// Join group via invite link
    func joinGroup(inviteLink: String) async throws -> Bool {
        let endpoint = "\(baseURL)/groups/join"
        let body = ["inviteLink": inviteLink]
        let response: [String: Bool] = try await post(endpoint: endpoint, body: body)
        return response["success"] ?? false
    }
    
    // MARK: - Zero-Knowledge Discovery Methods
    
    /// Query users by hashed Cyphr IDs (zero-knowledge)
    func queryHashedUsers(cyphrIdHashes: [String]) async throws -> [DiscoveredUser] {
        let endpoint = "\(baseURL)/users/query-hashed"
        let body = ["hashes": cyphrIdHashes]
        let response: [DiscoveredUser] = try await post(endpoint: endpoint, body: body)
        return response
    }
    
    /// Search users by username
    func searchUsername(_ username: String) async throws -> [DiscoveredUser] {
        let endpoint = "\(baseURL)/users/search-username"
        let response: [DiscoveredUser] = try await get(
            endpoint: "\(endpoint)?username=\(username)"
        )
        return response
    }
    
    /// Check if user exists by Cyphr ID hash
    func checkUserExists(cyphrIdHash: String) async throws -> Bool {
        let endpoint = "\(baseURL)/users/check-exists"
        let response: [String: Bool] = try await get(
            endpoint: "\(endpoint)?hash=\(cyphrIdHash)"
        )
        return response["exists"] ?? false
    }
    
    // MARK: - Private Methods
    
    private func get<T: Decodable>(endpoint: String) async throws -> T {
        guard let url = URL(string: endpoint) else {
            throw NetworkError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Add auth token if available
        if let token = AuthTokenStore.load() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw NetworkError.invalidResponse
        }
        
        guard (200...299).contains(httpResponse.statusCode) else {
            throw NetworkError.httpError(httpResponse.statusCode)
        }
        
        return try JSONDecoder().decode(T.self, from: data)
    }
    
    private func post<T: Decodable>(endpoint: String, body: Any) async throws -> T {
        guard let url = URL(string: endpoint) else {
            print("❌ Invalid URL: \(endpoint)")
            throw NetworkError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 30 // Explicit timeout
        
        // Add auth token if available
        if let token = AuthTokenStore.load() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        print("📤 POST Request to: \(url)")
        print("   Headers: \(request.allHTTPHeaderFields ?? [:])")
        print("   Body: \(body)")
        print("   Using session: \(session)")
        
        do {
            print("   Sending request...")
            let (data, response) = try await session.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                print("❌ Invalid response type")
                throw NetworkError.invalidResponse
            }
            
            print("📥 Response Code: \(httpResponse.statusCode)")
            
            guard (200...299).contains(httpResponse.statusCode) else {
                let responseString = String(data: data, encoding: .utf8) ?? "No response body"
                print("❌ HTTP Error \(httpResponse.statusCode): \(responseString)")
                throw NetworkError.httpError(httpResponse.statusCode)
            }
            
            let decoded = try JSONDecoder().decode(T.self, from: data)
            print("✅ Successfully decoded response")
            return decoded
            
        } catch {
            print("❌ Network request failed: \(error)")
            throw error
        }
    }
    
    // MARK: - Additional Methods for WebRTC
    
    private func performRequest(endpoint: String, method: String = "GET", body: [String: Any]? = nil) async throws -> Any {
        let url = URL(string: "\(self.baseURL)\(endpoint)")!
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = AuthTokenStore.load() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        if let body = body {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        
        let (data, _) = try await URLSession.shared.data(for: request)
        return try JSONSerialization.jsonObject(with: data)
    }
    
    func checkUserOnlineStatus(_ userId: String) async throws -> Bool {
        let response = try await performRequest(
            endpoint: "/api/users/\(userId)/online",
            method: "GET"
        )
        
        guard let result = response as? [String: Any],
              let isOnline = result["isOnline"] as? Bool else {
            return false
        }
        
        return isOnline
    }
    
    func notifyMediaAvailable(chatId: String, mediaId: String, type: String) async throws {
        let body: [String: Any] = [
            "chatId": chatId,
            "mediaId": mediaId,
            "type": type
        ]
        
        _ = try await performRequest(
            endpoint: "/api/messaging/media-available",
            method: "POST",
            body: body
        )
    }
    
    func exchangeWebRTCSignaling(with peerId: String, signaling: [String: Any]) async throws -> [String: Any] {
        let body: [String: Any] = [
            "peerId": peerId,
            "signaling": signaling
        ]
        
        let response = try await performRequest(
            endpoint: "/api/webrtc/signaling",
            method: "POST",
            body: body
        )
        
        guard let result = response as? [String: Any] else {
            throw NetworkError.invalidResponse
        }
        
        return result
    }
    
    func request(url: URL, method: String = "GET", headers: [String: String] = [:], body: Data? = nil) async throws -> (Data, URLResponse) {
        var request = URLRequest(url: url)
        request.httpMethod = method
        
        for (key, value) in headers {
            request.setValue(value, forHTTPHeaderField: key)
        }
        
        if let body = body {
            request.httpBody = body
        }
        
        return try await URLSession.shared.data(for: request)
    }
}

// MARK: - Network-specific Models

// Using DiscoveredUser from ZeroKnowledgeLookup.swift

struct CyphrIdCheckResponse: Codable {
    let available: Bool
    let suggestions: [String]?
}

struct UserStatus: Codable {
    let hasPin: Bool
    let hasBiometry: Bool
    let userInfo: User?
}

struct UserSearchResult: Codable {
    let cyphrId: String
    let publicKey: String
    let fullName: String?
}

// MARK: - Messaging Response Models

struct MessagingKeysResponse: Codable {
    let success: Bool
    let publicKey: String
    let keyId: String
    let algorithm: String
    let keySize: Int
    let message: String
}

struct SendMessageResponse: Codable {
    let success: Bool
    let messageId: String
    let encrypted: Bool
    let algorithm: String
    let message: String
}

struct DecryptedMessageResponse: Codable {
    let success: Bool
    let content: String
    let senderId: String
    let algorithm: String
}

struct MessagesResponse: Codable {
    let success: Bool
    let messages: [EncryptedMessageData]
    let encrypted: Bool
    let algorithm: String
}

struct EncryptedMessageData: Codable {
    let id: String
    let senderId: String
    let encryptedContent: String?
    let kyberCiphertext: String?
    let nonce: String?
    let authTag: String?
    let encrypted: Bool
    let createdAt: String
    let senderCyphrId: String?
    let senderName: String?
    
    enum CodingKeys: String, CodingKey {
        case id
        case senderId = "sender_id"
        case encryptedContent = "encrypted_content"
        case kyberCiphertext = "kyber_ciphertext"
        case nonce
        case authTag = "auth_tag"
        case encrypted
        case createdAt = "created_at"
        case senderCyphrId = "sender_cyphr_id"
        case senderName = "sender_name"
    }
}

struct CreateChatResponse: Codable {
    let success: Bool
    let chatId: String
    let encrypted: Bool
    let algorithm: String
    let message: String
}

// MARK: - Wallet Models

struct WalletBalance: Codable {
    let xlm: String
    let usdc: String
    let assets: [String: String]
}

struct Transaction: Codable {
    let from: String
    let to: String
    let amount: String
    let asset: String
    let memo: String?
}

struct TransactionResult: Codable {
    let success: Bool
    let transactionId: String
    let hash: String
}

struct IceServersResponse: Codable {
    let iceServers: [IceServer]
}

struct IceServer: Codable {
    let urls: [String]
    let username: String?
    let credential: String?
}

struct DeviceInfo {
    let deviceId: String
    let deviceModel: String
    let osVersion: String
    let appVersion: String
    
    // Static singleton for current device
    static let current: DeviceInfo = {
        #if os(iOS)
        let device = UIDevice.current
        let deviceId = device.identifierForVendor?.uuidString ?? UUID().uuidString
        let deviceModel = device.model
        let osVersion = "\(device.systemName) \(device.systemVersion)"
        #else
        let deviceId = UUID().uuidString
        let deviceModel = "iOS Simulator"
        let osVersion = "iOS 17.0"
        #endif
        
        let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
        
        return DeviceInfo(
            deviceId: deviceId,
            deviceModel: deviceModel,
            osVersion: osVersion,
            appVersion: appVersion
        )
    }()
}

// MARK: - Errors

enum NetworkError: LocalizedError {
    case invalidURL
    case invalidResponse
    case httpError(Int)
    case decodingError
    case unauthorized
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid server response"
        case .httpError(let code):
            return "HTTP error: \(code)"
        case .decodingError:
            return "Failed to decode response"
        case .unauthorized:
            return "Unauthorized"
        }
    }
}
