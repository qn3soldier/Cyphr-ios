import Foundation
import CryptoKit
import SwiftKyber

/// Post-Quantum Cryptography Implementation
/// НАСТОЯЩИЙ Kyber1024 + ChaCha20-Poly1305 hybrid encryption
/// Использует SwiftKyber - официальную реализацию NIST FIPS 203
public class PostQuantumCrypto {
    
    // MARK: - Properties
    private var kyberKeyPairs: [String: (publicKey: PublicKey, secretKey: SecretKey)] = [:]
    private var chatSecrets: [String: SymmetricKey] = [:]
    private var keyCache: [String: ChatSecret] = [:] // Как в finalKyber1024.js
    private var recoveryPhrases: [String: [String]] = [:] // Для восстановления
    
    // MARK: - Singleton
    public static let shared = PostQuantumCrypto()
    
    private init() {
        print("🔐 Initializing REAL Post-Quantum Crypto System with SwiftKyber")
    }
    
    // MARK: - Kyber1024 Key Exchange (НАСТОЯЩИЙ!)
    
    /// Generate REAL Kyber1024 keypair using SwiftKyber
    public func generateKyber1024KeyPair() -> (publicKey: String, privateKey: String, keyId: String) {
        // Используем Kyber1024 из SwiftKyber
        let kyber = Kyber.K1024
        let (publicKey, secretKey) = kyber.GenerateKeyPair()
        
        // Генерируем уникальный ID для ключа
        let keyId = UUID().uuidString
        
        // Сохраняем ключи
        kyberKeyPairs[keyId] = (publicKey, secretKey)
        
        // Конвертируем в base64 для передачи
        let publicKeyBase64 = Data(publicKey.bytes).base64EncodedString()
        let privateKeyBase64 = Data(secretKey.bytes).base64EncodedString()
        
        print("🔑 Generated REAL Kyber1024 keypair with SwiftKyber")
        print("   Public key size: \(publicKey.bytes.count) bytes")
        print("   Secret key size: \(secretKey.bytes.count) bytes")
        
        return (publicKeyBase64, privateKeyBase64, keyId)
    }
    
    /// Encapsulate - generate shared secret and ciphertext using REAL Kyber
    public func encapsulate(recipientPublicKey: String) throws -> (ciphertext: String, sharedSecret: SymmetricKey) {
        guard let publicKeyData = Data(base64Encoded: recipientPublicKey) else {
            throw CryptoError.invalidPublicKey
        }
        
        // Создаем PublicKey из данных
        let publicKey = try PublicKey(bytes: publicKeyData.bytes)
        
        // Выполняем encapsulation (генерируем ciphertext и shared secret)
        let (ciphertext, sharedSecret) = publicKey.Encapsulate()
        
        // Конвертируем 32-байтный shared secret в SymmetricKey для ChaCha20
        let symmetricKey = SymmetricKey(data: Data(sharedSecret))
        
        print("✅ Encapsulated with REAL Kyber1024")
        print("   Ciphertext size: \(ciphertext.count) bytes")
        print("   Shared secret size: \(sharedSecret.count) bytes")
        
        return (Data(ciphertext).base64EncodedString(), symmetricKey)
    }
    
    /// Decapsulate - recover shared secret from ciphertext using REAL Kyber
    public func decapsulate(ciphertext: String, privateKey: String) throws -> SymmetricKey {
        guard let ciphertextData = Data(base64Encoded: ciphertext),
              let privateKeyData = Data(base64Encoded: privateKey) else {
            throw CryptoError.invalidCiphertext
        }
        
        // Создаем SecretKey из данных
        let secretKey = try SecretKey(bytes: privateKeyData.bytes)
        
        // Выполняем decapsulation (восстанавливаем shared secret)
        let sharedSecret = try secretKey.Decapsulate(ct: ciphertextData.bytes)
        
        // Конвертируем в SymmetricKey
        let symmetricKey = SymmetricKey(data: Data(sharedSecret))
        
        print("✅ Decapsulated with REAL Kyber1024")
        print("   Recovered shared secret size: \(sharedSecret.count) bytes")
        
        return symmetricKey
    }
    
    /// Decapsulate using stored key pair
    public func decapsulateWithStoredKey(ciphertext: String, keyId: String) throws -> SymmetricKey {
        guard let keyPair = kyberKeyPairs[keyId] else {
            throw CryptoError.keyNotFound
        }
        
        guard let ciphertextData = Data(base64Encoded: ciphertext) else {
            throw CryptoError.invalidCiphertext
        }
        
        // Используем сохраненный SecretKey
        let sharedSecret = try keyPair.secretKey.Decapsulate(ct: ciphertextData.bytes)
        let symmetricKey = SymmetricKey(data: Data(sharedSecret))
        
        print("✅ Decapsulated with stored Kyber1024 key")
        return symmetricKey
    }
    
    // MARK: - ChaCha20-Poly1305 Encryption (как в finalKyber1024.js)
    
    /// Encrypt message with ChaCha20-Poly1305
    public func encryptMessage(_ message: String, with key: SymmetricKey) throws -> EncryptedMessage {
        guard let messageData = message.data(using: .utf8) else {
            throw CryptoError.invalidMessage
        }
        
        // Generate nonce (как в chacha20.js)
        let nonce = ChaChaPoly.Nonce()
        
        // Encrypt with ChaCha20-Poly1305
        let sealedBox = try ChaChaPoly.seal(messageData, using: key, nonce: nonce)
        
        let encrypted = EncryptedMessage(
            ciphertext: sealedBox.ciphertext.base64EncodedString(),
            nonce: nonce.withUnsafeBytes { Data($0) }.base64EncodedString(),
            tag: sealedBox.tag.base64EncodedString()
        )
        
        print("🔒 Encrypted message with ChaCha20-Poly1305")
        return encrypted
    }
    
    /// Decrypt message with ChaCha20-Poly1305
    public func decryptMessage(_ encrypted: EncryptedMessage, with key: SymmetricKey) throws -> String {
        guard let ciphertextData = Data(base64Encoded: encrypted.ciphertext),
              let nonceData = Data(base64Encoded: encrypted.nonce),
              let tagData = Data(base64Encoded: encrypted.tag) else {
            throw CryptoError.invalidCiphertext
        }
        
        // Reconstruct nonce
        let nonce = try ChaChaPoly.Nonce(data: nonceData)
        
        // Create sealed box
        let sealedBox = try ChaChaPoly.SealedBox(
            nonce: nonce,
            ciphertext: ciphertextData,
            tag: tagData
        )
        
        // Decrypt
        let decryptedData = try ChaChaPoly.open(sealedBox, using: key)
        
        guard let message = String(data: decryptedData, encoding: .utf8) else {
            throw CryptoError.decryptionFailed
        }
        
        print("🔓 Decrypted message with ChaCha20-Poly1305")
        return message
    }
    
    // MARK: - Hybrid Encryption (Kyber1024 + ChaCha20)
    
    /// Encrypt message with hybrid post-quantum encryption (как в finalKyber1024.js)
    public func hybridEncrypt(message: String, recipientPublicKey: String) throws -> HybridEncryptedMessage {
        // Step 1: Encapsulate with REAL Kyber1024 to get shared secret
        let (kyberCiphertext, sharedSecret) = try encapsulate(recipientPublicKey: recipientPublicKey)
        
        // Step 2: Encrypt message with ChaCha20-Poly1305
        let encryptedMessage = try encryptMessage(message, with: sharedSecret)
        
        return HybridEncryptedMessage(
            kyberCiphertext: kyberCiphertext,
            encryptedMessage: encryptedMessage
        )
    }
    
    /// Decrypt message with hybrid post-quantum encryption
    public func hybridDecrypt(encrypted: HybridEncryptedMessage, privateKey: String) throws -> String {
        // Step 1: Decapsulate with REAL Kyber1024 to recover shared secret
        let sharedSecret = try decapsulate(ciphertext: encrypted.kyberCiphertext, privateKey: privateKey)
        
        // Step 2: Decrypt message with ChaCha20-Poly1305
        let message = try decryptMessage(encrypted.encryptedMessage, with: sharedSecret)
        
        return message
    }
    
    // MARK: - Chat Session Management (как в finalKyber1024.js)
    
    /// Initialize quantum-safe chat session with REAL Kyber1024
    public func initializeChatSession(chatId: String, recipientPublicKey: String) throws {
        let (_, sharedSecret) = try encapsulate(recipientPublicKey: recipientPublicKey)
        chatSecrets[chatId] = sharedSecret
        print("🔐 Initialized quantum-safe chat session with REAL Kyber1024: \(chatId)")
    }
    
    /// Encrypt message for chat
    public func encryptForChat(chatId: String, message: String) throws -> EncryptedMessage {
        guard let secret = chatSecrets[chatId] else {
            throw CryptoError.noChatSecret
        }
        return try encryptMessage(message, with: secret)
    }
    
    /// Decrypt message from chat
    public func decryptFromChat(chatId: String, encrypted: EncryptedMessage) throws -> String {
        guard let secret = chatSecrets[chatId] else {
            throw CryptoError.noChatSecret
        }
        return try decryptMessage(encrypted, with: secret)
    }
    
    // MARK: - Key Management
    
    /// Export public key for sharing
    public func exportPublicKey(keyId: String) -> String? {
        guard let keyPair = kyberKeyPairs[keyId] else { return nil }
        return Data(keyPair.publicKey.bytes).base64EncodedString()
    }
    
    /// Export private key for backup (HANDLE WITH CARE!)
    public func exportPrivateKey(keyId: String) -> String? {
        guard let keyPair = kyberKeyPairs[keyId] else { return nil }
        return Data(keyPair.secretKey.bytes).base64EncodedString()
    }
    
    // MARK: - Methods from finalKyber1024.js
    
    /// Generate chat secret как в finalKyber1024.js
    public func generateChatSecret(participantPublicKeys: [String: String]) async throws -> ChatSecret {
        let chatId = try await generateChatId(participantPublicKeys: participantPublicKeys)
        
        // Check cache first
        if let cached = keyCache[chatId] {
            return cached
        }
        
        // Generate a shared secret for the chat using REAL Kyber1024
        let (_, sharedSecret) = try encapsulate(recipientPublicKey: participantPublicKeys.values.first ?? "")
        
        let chatSecret = ChatSecret(
            chatId: chatId,
            sharedSecret: Data(sharedSecret.withUnsafeBytes { Data($0) }).base64EncodedString(),
            participants: Array(participantPublicKeys.keys),
            timestamp: Int64(Date().timeIntervalSince1970 * 1000)
        )
        
        keyCache[chatId] = chatSecret
        return chatSecret
    }
    
    /// Generate unique chat ID как в finalKyber1024.js
    public func generateChatId(participantPublicKeys: [String: String]) async throws -> String {
        let sortedKeys = participantPublicKeys.values.sorted()
        let combined = sortedKeys.joined(separator: "|")
        let hash = SHA256.hash(data: combined.data(using: .utf8)!)
        return Data(hash).base64EncodedString()
    }
    
    /// Encrypt chat message как в finalKyber1024.js
    public func encryptChatMessage(message: String, chatSecret: ChatSecret, senderId: String) throws -> EncryptedChatMessage {
        guard let sharedSecretData = Data(base64Encoded: chatSecret.sharedSecret) else {
            throw CryptoError.invalidCiphertext
        }
        
        let sharedSecret = SymmetricKey(data: sharedSecretData)
        let encrypted = try encryptMessage(message, with: sharedSecret)
        
        // Combine all parts into single base64 string
        let combinedData = "\(encrypted.ciphertext)|\(encrypted.nonce)|\(encrypted.tag)"
        
        return EncryptedChatMessage(
            encryptedMessage: combinedData,
            senderId: senderId,
            timestamp: Int64(Date().timeIntervalSince1970 * 1000)
        )
    }
    
    /// Decrypt chat message как в finalKyber1024.js
    public func decryptChatMessage(encryptedChatMessage: EncryptedChatMessage, chatSecret: ChatSecret) throws -> String {
        guard let sharedSecretData = Data(base64Encoded: chatSecret.sharedSecret) else {
            throw CryptoError.invalidCiphertext
        }
        
        let sharedSecret = SymmetricKey(data: sharedSecretData)
        
        // Split combined data
        let parts = encryptedChatMessage.encryptedMessage.split(separator: "|").map(String.init)
        guard parts.count == 3 else {
            throw CryptoError.invalidCiphertext
        }
        
        let encrypted = EncryptedMessage(
            ciphertext: parts[0],
            nonce: parts[1],
            tag: parts[2]
        )
        
        return try decryptMessage(encrypted, with: sharedSecret)
    }
    
    /// Get encryption info как в finalKyber1024.js
    public func getEncryptionInfo() -> EncryptionInfo {
        return EncryptionInfo()
    }
    
    /// Encapsulate method как в finalKyber1024.js
    public func encapsulateSimple(publicKey: String) async throws -> (encapsulatedKey: String, sharedSecret: String) {
        let (ciphertext, sharedSecret) = try encapsulate(recipientPublicKey: publicKey)
        return (ciphertext, Data(sharedSecret.withUnsafeBytes { Data($0) }).base64EncodedString())
    }
    
    /// Encrypt data for transmission
    public func encryptForTransmission(_ data: Data, for recipientPublicKey: String) async throws -> HybridEncryptedMessage {
        let (kyberCiphertext, sharedSecret) = try encapsulate(recipientPublicKey: recipientPublicKey)
        let encrypted = try encryptMessage(String(data: data, encoding: .utf8) ?? "", with: sharedSecret)
        return HybridEncryptedMessage(
            kyberCiphertext: kyberCiphertext,
            encryptedMessage: encrypted
        )
    }
}

// MARK: - Helper Extensions

extension Data {
    var bytes: [UInt8] {
        return [UInt8](self)
    }
}


// MARK: - Models (как в finalKyber1024.js)

public struct EncryptedMessage: Codable {
    let ciphertext: String
    let nonce: String
    let tag: String
}

public struct HybridEncryptedMessage: Codable {
    let kyberCiphertext: String
    let encryptedMessage: EncryptedMessage
}

extension HybridEncryptedMessage {
    /// Convert the hybrid payload into a dictionary suitable for Socket.IO emission.
    public func toDictionary() -> [String: String] {
        return [
            "kyberCiphertext": kyberCiphertext,
            "ciphertext": encryptedMessage.ciphertext,
            "nonce": encryptedMessage.nonce,
            "tag": encryptedMessage.tag
        ]
    }

    /// Decode a hybrid payload from a generic Socket.IO payload value.
    public static func fromAny(_ value: Any) -> HybridEncryptedMessage? {
        if let dictionary = value as? [String: Any] {
            return fromDictionary(dictionary)
        }

        if let stringValue = value as? String,
           let data = stringValue.data(using: .utf8),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            return fromDictionary(json)
        }

        return nil
    }

    /// Decode a hybrid payload from a dictionary.
    public static func fromDictionary(_ dictionary: [String: Any]) -> HybridEncryptedMessage? {
        let kyberCiphertext = dictionary["kyberCiphertext"] as? String

        let messageDictionary: [String: Any]
        if let nested = dictionary["encryptedMessage"] as? [String: Any] {
            messageDictionary = nested
        } else {
            messageDictionary = dictionary
        }

        guard
            let kyber = kyberCiphertext,
            let ciphertext = messageDictionary["ciphertext"] as? String,
            let nonce = messageDictionary["nonce"] as? String,
            let tag = messageDictionary["tag"] as? String
        else {
            return nil
        }

        let encrypted = EncryptedMessage(
            ciphertext: ciphertext,
            nonce: nonce,
            tag: tag
        )

        return HybridEncryptedMessage(
            kyberCiphertext: kyber,
            encryptedMessage: encrypted
        )
    }
}

// Из finalKyber1024.js
public struct EncryptedPackage: Codable {
    let encryptedMessage: String
    let symmetricKey: String
    var algorithm: String = "Kyber1024 + ChaCha20"
    let timestamp: Int64
    var security: String = "Post-Quantum Resistant"
}

public struct ChatSecret: Codable {
    let chatId: String
    let sharedSecret: String
    let participants: [String]
    let timestamp: Int64
}

public struct EncryptedChatMessage: Codable {
    let encryptedMessage: String
    let senderId: String
    let timestamp: Int64
}

public struct EncryptionInfo: Codable {
    var algorithm: String = "Kyber1024 + ChaCha20"
    var security: String = "Post-Quantum Resistant"
    var keySize: String = "1568 bits (Kyber1024) + 256 bits (ChaCha20)"
    var resistance: String = "Resistant to quantum attacks using Shor's algorithm"
}

// MARK: - Errors

enum CryptoError: LocalizedError {
    case invalidPublicKey
    case invalidCiphertext
    case invalidMessage
    case decryptionFailed
    case noChatSecret
    case keyNotFound
    
    var errorDescription: String? {
        switch self {
        case .invalidPublicKey:
            return "Invalid public key format"
        case .invalidCiphertext:
            return "Invalid ciphertext format"
        case .invalidMessage:
            return "Invalid message format"
        case .decryptionFailed:
            return "Failed to decrypt message"
        case .noChatSecret:
            return "No chat secret established"
        case .keyNotFound:
            return "Key not found in storage"
        }
    }
}
