import Foundation

// MARK: - Chat Model

struct Chat: Identifiable, Codable {
    let id: String
    let participants: [String]
    var lastMessage: Message?
    var unreadCount: Int
    
    var displayName: String {
        // Get the other participant's name for 1-on-1 chats
        let currentUserId = UserDefaults.standard.string(forKey: "cyphr_id") ?? ""
        return participants.first { $0 != currentUserId } ?? "Unknown"
    }
}

// MARK: - Message Model

struct Message: Identifiable, Codable {
    let id: String
    let chatId: String
    let senderId: String
    let encryptedContent: EncryptedMessage
    let timestamp: Date
    
    // Decrypted content stored after decryption
    var decryptedContent: String?
    
    // Display content (shows decrypted or placeholder)
    var content: String {
        return decryptedContent ?? "🔒 Encrypted message"
    }
    
    var isSentByCurrentUser: Bool {
        return senderId == (UserDefaults.standard.string(forKey: "user_id") ?? "")
    }
}

// MARK: - Encryption Models

// Using EncryptedMessage from PostQuantumCrypto.swift

// Removed duplicate - HybridEncryptedMessage is defined in PostQuantumCrypto.swift

// MARK: - User Model

public struct User: Identifiable, Codable {
    public let id: String
    public let cyphrId: String
    public let publicKey: String
    public let displayName: String?
    public let avatarUrl: String?
    public let isOnline: Bool
    public let lastSeen: Date?
}

// MARK: - Wallet Models

struct WalletData: Codable {
    let mnemonic: String
    let stellarKeys: StellarKeys
    let ethereumKeys: EthereumKeys?
    let bitcoinKeys: BitcoinKeys?
}

struct StellarKeys: Codable {
    let publicKey: String
    let secretKey: String
}

struct EthereumKeys: Codable {
    let address: String
    let privateKey: String
}

struct BitcoinKeys: Codable {
    let address: String
    let privateKey: String
    let wif: String
}

// MARK: - Crypto Identity Models

struct CyphrIdentityData: Codable {
    let cyphrId: String
    let publicKey: String
    let deviceId: String
    let createdAt: Date
    let recoveryPhrase: [String]
}

// MARK: - Post-Quantum Encryption Models

struct HybridEncryptedPayload: Codable {
    let kyberCiphertext: String
    let ciphertext: String
    let nonce: String
    let tag: String
}

// MARK: - Call Models

struct Call: Identifiable {
    let id: String
    let callerId: String
    let recipientId: String
    let isVideo: Bool
    let status: CallStatus
    let startedAt: Date
    var endedAt: Date?
    
    enum CallStatus {
        case ringing
        case connecting
        case connected
        case ended
        case failed
    }
}

// MARK: - Messaging Models

struct OutgoingMessage: Codable {
    let id: String
    let chatId: String
    let recipientId: String
    let encryptedContent: HybridEncryptedMessage
    let timestamp: Date
}

enum MessagingError: LocalizedError {
    case notConnected
    case sendFailed(String)
    case keyGenerationFailed(String)
    case noPrivateKey
    case decryptionFailed(String)
    case userNotFound(String)
    case chatCreationFailed(String)
    case encryptionFailed
    case invalidRecipient
    case messageQueueFull
    case invalidPayload
    
    var errorDescription: String? {
        switch self {
        case .notConnected:
            return "Not connected to messaging server"
        case .sendFailed(let reason):
            return "Failed to send message: \(reason)"
        case .keyGenerationFailed(let reason):
            return "Failed to generate encryption keys: \(reason)"
        case .noPrivateKey:
            return "No private key found for decryption"
        case .decryptionFailed(let reason):
            return "Failed to decrypt message: \(reason)"
        case .userNotFound(let cyphrId):
            return "User @\(cyphrId) not found"
        case .chatCreationFailed(let reason):
            return "Failed to create chat: \(reason)"
        case .encryptionFailed:
            return "Failed to encrypt message"
        case .invalidRecipient:
            return "Invalid recipient"
        case .messageQueueFull:
            return "Message queue is full"
        case .invalidPayload:
            return "Invalid message payload"
        }
    }
}

// MARK: - Network Response Models

struct AuthResponse: Codable {
    let success: Bool
    let token: String?
    let user: User?
    let error: String?
    let message: String?
}

struct MessageResponse: Codable {
    let success: Bool
    let messageId: String?
    let timestamp: Date?
    let error: String?
}

struct DiscoveryResponse: Codable {
    let users: [User]
    let hasMore: Bool
    let nextCursor: String?
}