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
    enum DeliveryState: String, Codable {
        case sending
        case sent
        case delivered
        case read
    }

    let id: String
    let chatId: String
    let senderId: String
    let kyberCiphertext: String?
    let encryptedContent: EncryptedMessage
    let timestamp: Date

    // Mutable metadata for UI state
    var decryptedContent: String? = nil
    var deliveryState: DeliveryState = .sent
    var body: MessageBody? = nil

    // Display content (shows decrypted text or media placeholder)
    var content: String {
        switch resolvedBody?.kind {
        case .text:
            return resolvedBody?.text ?? decryptedContent ?? ""
        case .audio:
            return "🎙 Voice message"
        case .image:
            return "🖼 Photo"
        case .video:
            return "🎬 Video"
        case .document:
            return "📄 Document"
        case .none:
            return decryptedContent ?? "🔒 Encrypted message"
        }
    }

    var mediaAttachment: MessageMediaMetadata? {
        resolvedBody?.media
    }

    var isSentByCurrentUser: Bool {
        let current = UserDefaults.standard.string(forKey: "cyphr_id") ?? ""
        return senderId == current
    }

    private var resolvedBody: MessageBody? {
        if let body { return body }
        guard let decryptedContent,
              let data = decryptedContent.data(using: .utf8) else {
            return nil
        }

        return try? JSONDecoder().decode(MessageBody.self, from: data)
    }
}

enum MessageBodyKind: String, Codable {
    case text
    case audio
    case image
    case video
    case document
}

struct MessageMediaMetadata: Codable {
    let kind: MessageBodyKind
    let remoteURL: String?
    let fileName: String?
    let fileSize: Int?
    let duration: Double?
    let waveform: [Float]?
    let mimeType: String?
    let thumbnailURL: String?
}

struct MessageBody: Codable {
    let kind: MessageBodyKind
    let text: String?
    let media: MessageMediaMetadata?

    init(kind: MessageBodyKind, text: String? = nil, media: MessageMediaMetadata? = nil) {
        self.kind = kind
        self.text = text
        self.media = media
    }
}

// MARK: - Encryption Models

// Using EncryptedMessage from PostQuantumCrypto.swift

// Removed duplicate - HybridEncryptedMessage is defined in PostQuantumCrypto.swift

// MARK: - User Model

public struct User: Identifiable, Codable {
    public let id: String
    public let cyphrId: String
    public let publicKey: String?
    public let displayName: String?
    public let avatarUrl: String?
    public let isOnline: Bool
    public let lastSeen: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case cyphrId
        case cyphr_id
        case publicKey
        case public_key
        case displayName
        case display_name
        case avatarUrl
        case avatar_url
        case isOnline
        case is_online
        case lastSeen
        case last_seen
    }

    public init(id: String, cyphrId: String, publicKey: String?, displayName: String?, avatarUrl: String?, isOnline: Bool, lastSeen: Date?) {
        self.id = id
        self.cyphrId = cyphrId
        self.publicKey = publicKey
        self.displayName = displayName
        self.avatarUrl = avatarUrl
        self.isOnline = isOnline
        self.lastSeen = lastSeen
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        // id can be string or int
        let idString: String
        if let s = try? container.decode(String.self, forKey: .id) {
            idString = s
        } else if let i = try? container.decode(Int.self, forKey: .id) {
            idString = String(i)
        } else {
            idString = UUID().uuidString
        }

        let cyphrId = (try? container.decode(String.self, forKey: .cyphrId)) ??
                      (try? container.decode(String.self, forKey: .cyphr_id)) ?? ""

        let publicKey = (try? container.decode(String.self, forKey: .publicKey)) ??
                        (try? container.decode(String.self, forKey: .public_key))

        let displayName = (try? container.decode(String.self, forKey: .displayName)) ??
                          (try? container.decode(String.self, forKey: .display_name))

        let avatarUrl = (try? container.decode(String.self, forKey: .avatarUrl)) ??
                        (try? container.decode(String.self, forKey: .avatar_url))

        let isOnline = (try? container.decode(Bool.self, forKey: .isOnline)) ??
                       (try? container.decode(Bool.self, forKey: .is_online)) ?? false

        let lastSeen = (try? container.decode(Date.self, forKey: .lastSeen)) ??
                       (try? container.decode(Date.self, forKey: .last_seen))

        self.init(id: idString, cyphrId: cyphrId, publicKey: publicKey, displayName: displayName, avatarUrl: avatarUrl, isOnline: isOnline, lastSeen: lastSeen)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(cyphrId, forKey: .cyphrId)
        if let publicKey { try container.encode(publicKey, forKey: .publicKey) }
        if let displayName { try container.encode(displayName, forKey: .displayName) }
        if let avatarUrl { try container.encode(avatarUrl, forKey: .avatarUrl) }
        try container.encode(isOnline, forKey: .isOnline)
        if let lastSeen { try container.encode(lastSeen, forKey: .lastSeen) }
    }
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

// MARK: - Call Models

enum CallDirection: String, Codable {
    case incoming
    case outgoing
}

enum CallState: String, Codable {
    case dialing
    case ringing
    case connecting
    case active
    case ended
    case failed
}

struct CallSession: Identifiable, Equatable, Codable {
    let id: String
    let peerId: String
    var peerName: String?
    let isVideo: Bool
    let direction: CallDirection
    var state: CallState
    let startedAt: Date
    var endedAt: Date?
    var failureReason: String?
    var encryptedOffer: HybridEncryptedMessage?
    var encryptedAnswer: HybridEncryptedMessage?

    static func == (lhs: CallSession, rhs: CallSession) -> Bool {
        lhs.id == rhs.id && lhs.state == rhs.state && lhs.failureReason == rhs.failureReason
    }

    init(
        id: String,
        peerId: String,
        peerName: String? = nil,
        isVideo: Bool,
        direction: CallDirection,
        state: CallState,
        startedAt: Date,
        endedAt: Date? = nil,
        failureReason: String? = nil,
        encryptedOffer: HybridEncryptedMessage? = nil,
        encryptedAnswer: HybridEncryptedMessage? = nil
    ) {
        self.id = id
        self.peerId = peerId
        self.peerName = peerName
        self.isVideo = isVideo
        self.direction = direction
        self.state = state
        self.startedAt = startedAt
        self.endedAt = endedAt
        self.failureReason = failureReason
        self.encryptedOffer = encryptedOffer
        self.encryptedAnswer = encryptedAnswer
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
