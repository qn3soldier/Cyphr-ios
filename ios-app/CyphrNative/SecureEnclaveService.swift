import Foundation
import Security
import CryptoKit

/// Secure Enclave Service - Hardware-backed key storage
/// Stores private keys in iOS Secure Enclave when available
public class SecureEnclaveService {

    // MARK: - Singleton
    public static let shared = SecureEnclaveService()

    // MARK: - Properties
    private let tag = "com.cyphr.messenger.key"
    private let deviceBindingTag = "com.cyphr.device.binding.v2" // v5.0 spec compliant
    private var cachedKeys: [String: SecKey] = [:]
    private var cachedDeviceFingerprintHash: String?

    private init() {
        print("🔐 Secure Enclave Service initialized")
        print("   Secure Enclave Available: \(isSecureEnclaveAvailable)")
    }

    // MARK: - Availability Check

    /// Check if Secure Enclave is available on this device
    public var isSecureEnclaveAvailable: Bool {
        #if targetEnvironment(simulator)
        return false  // Simulator doesn't have Secure Enclave
        #else
        // iPhone 5s and later, all iPads with Touch ID or Face ID
        return true
        #endif
    }

    // MARK: - Key Generation

    /// Generate a new private key in Secure Enclave
    public func generateKey(with identifier: String) throws -> SecKey {
        let keyTag = "\(tag).\(identifier)".data(using: .utf8)!

        // Delete any existing key with the same tag
        deleteKey(with: identifier)

        var error: Unmanaged<CFError>?

        // Access control flags for Secure Enclave
        let access: SecAccessControlCreateFlags
        if isSecureEnclaveAvailable {
            access = [.privateKeyUsage, .biometryCurrentSet]
        } else {
            // Fallback for devices without Secure Enclave
            access = [.privateKeyUsage]
        }

        guard let accessControl = SecAccessControlCreateWithFlags(
            nil,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            access,
            &error
        ) else {
            throw SecureEnclaveError.accessControlCreationFailed(error?.takeRetainedValue())
        }

        // Key generation attributes
        var attributes: [String: Any] = [
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecAttrKeySizeInBits as String: 256,
            kSecPrivateKeyAttrs as String: [
                kSecAttrIsPermanent as String: true,
                kSecAttrApplicationTag as String: keyTag,
                kSecAttrAccessControl as String: accessControl
            ]
        ]

        // Use Secure Enclave if available
        if isSecureEnclaveAvailable {
            attributes[kSecAttrTokenID as String] = kSecAttrTokenIDSecureEnclave
        }

        // Generate key pair
        guard let privateKey = SecKeyCreateRandomKey(attributes as CFDictionary, &error) else {
            throw SecureEnclaveError.keyGenerationFailed(error?.takeRetainedValue())
        }

        // Cache the key
        cachedKeys[identifier] = privateKey

        print("✅ Generated key in \(isSecureEnclaveAvailable ? "Secure Enclave" : "Keychain"): \(identifier)")
        return privateKey
    }

    // MARK: - Key Retrieval

    /// Retrieve a private key from Secure Enclave/Keychain
    public func retrieveKey(with identifier: String) throws -> SecKey {
        // Check cache first
        if let cachedKey = cachedKeys[identifier] {
            return cachedKey
        }

        let keyTag = "\(tag).\(identifier)".data(using: .utf8)!

        let query: [String: Any] = [
            kSecClass as String: kSecClassKey,
            kSecAttrApplicationTag as String: keyTag,
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecReturnRef as String: true
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)

        guard status == errSecSuccess, let key = item else {
            throw SecureEnclaveError.keyNotFound(identifier)
        }

        let privateKey = key as! SecKey
        cachedKeys[identifier] = privateKey

        print("✅ Retrieved key from storage: \(identifier)")
        return privateKey
    }

    // MARK: - Key Deletion

    /// Delete a private key from Secure Enclave/Keychain
    public func deleteKey(with identifier: String) {
        let keyTag = "\(tag).\(identifier)".data(using: .utf8)!

        let query: [String: Any] = [
            kSecClass as String: kSecClassKey,
            kSecAttrApplicationTag as String: keyTag
        ]

        let status = SecItemDelete(query as CFDictionary)
        if status == errSecSuccess {
            cachedKeys.removeValue(forKey: identifier)
            print("🗑️ Deleted key: \(identifier)")
        }
    }

    // MARK: - Signing

    /// Sign data using a key from Secure Enclave
    public func signData(_ data: Data, with identifier: String) throws -> Data {
        let privateKey = try retrieveKey(with: identifier)

        var error: Unmanaged<CFError>?
        guard let signature = SecKeyCreateSignature(
            privateKey,
            .ecdsaSignatureMessageX962SHA256,
            data as CFData,
            &error
        ) else {
            throw SecureEnclaveError.signingFailed(error?.takeRetainedValue())
        }

        return signature as Data
    }

    // MARK: - Public Key Export

    /// Get the public key for a private key stored in Secure Enclave
    public func getPublicKey(for identifier: String) throws -> SecKey {
        let privateKey = try retrieveKey(with: identifier)

        guard let publicKey = SecKeyCopyPublicKey(privateKey) else {
            throw SecureEnclaveError.publicKeyExtractionFailed
        }

        return publicKey
    }

    /// Export public key as Data
    public func exportPublicKey(for identifier: String) throws -> Data {
        let publicKey = try getPublicKey(for: identifier)

        var error: Unmanaged<CFError>?
        guard let publicKeyData = SecKeyCopyExternalRepresentation(publicKey, &error) else {
            throw SecureEnclaveError.publicKeyExportFailed(error?.takeRetainedValue())
        }

        return publicKeyData as Data
    }

    // MARK: - Cleanup

    /// Clear all cached keys (for security)
    public func clearCache() {
        cachedKeys.removeAll()
        print("🔄 Secure Enclave cache cleared")
    }

    /// Delete all keys associated with this app
    public func deleteAllKeys() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassKey,
            kSecAttrApplicationTag as String: tag
        ]

        SecItemDelete(query as CFDictionary)
        cachedKeys.removeAll()
        print("🗑️ All Secure Enclave keys deleted")
    }

    // MARK: - Device Binding (v5.0 spec compliant)

    /// Generate P-256 device binding key WITHOUT biometry (survives Face ID resets)
    public func generateDeviceBindingKey() throws -> SecKey {
        deleteKey(with: "device_binding")

        var error: Unmanaged<CFError>?

        // NO biometry flag - key accessible when device unlocked (v5.0 spec)
        guard let accessControl = SecAccessControlCreateWithFlags(
            nil,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            [], // Empty flags - no biometry
            &error
        ) else {
            throw SecureEnclaveError.accessControlCreationFailed(error?.takeRetainedValue())
        }

        var attributes: [String: Any] = [
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecAttrKeySizeInBits as String: 256,
            kSecPrivateKeyAttrs as String: [
                kSecAttrIsPermanent as String: true,
                kSecAttrApplicationTag as String: deviceBindingTag.data(using: .utf8)!,
                kSecAttrAccessControl as String: accessControl
            ]
        ]

        #if !targetEnvironment(simulator)
        attributes[kSecAttrTokenID as String] = kSecAttrTokenIDSecureEnclave
        #endif

        guard let privateKey = SecKeyCreateRandomKey(attributes as CFDictionary, &error) else {
            throw SecureEnclaveError.keyGenerationFailed(error?.takeRetainedValue())
        }

        cachedKeys["device_binding"] = privateKey
        cachedDeviceFingerprintHash = nil
        print("✅ Device binding P-256 key generated (v5.0 compliant)")
        return privateKey
    }

    private func ecP256SPKIPrefix() -> Data {
        // ASN.1 DER for: SEQUENCE { SEQUENCE { 1.2.840.10045.2.1, 1.2.840.10045.3.1.7 } BIT STRING 0x00 || pubkey }
        // Hex: 3059301306072A8648CE3D020106082A8648CE3D030107034200
        return Data([0x30,0x59,0x30,0x13,0x06,0x07,0x2A,0x86,0x48,0xCE,0x3D,0x02,0x01,0x06,0x08,0x2A,0x86,0x48,0xCE,0x3D,0x03,0x01,0x07,0x03,0x42,0x00])
    }

    /// Get device fingerprint hash = SHA256(DER(publicKey))
    public func getDeviceFingerprintHash() throws -> String {
        if let cached = cachedDeviceFingerprintHash {
            return cached
        }

        let privateKey = try getDeviceBindingKey()
        guard let publicKey = SecKeyCopyPublicKey(privateKey) else {
            throw SecureEnclaveError.publicKeyExtractionFailed
        }

        var error: Unmanaged<CFError>?
        guard let rawKey = SecKeyCopyExternalRepresentation(publicKey, &error) else {
            throw SecureEnclaveError.publicKeyExportFailed(error?.takeRetainedValue())
        }
        // Wrap raw ANSI X9.63 (65 bytes) into DER SPKI
        let der = ecP256SPKIPrefix() + (rawKey as Data)
        let hash = SHA256.hash(data: der)
        let fingerprintHash = hash.compactMap { String(format: "%02x", $0) }.joined()

        cachedDeviceFingerprintHash = fingerprintHash
        print("Device fingerprint hash (v5.0): \(fingerprintHash.prefix(16))...")
        return fingerprintHash
    }

    /// Get device binding private key
    public func getDeviceBindingKey() throws -> SecKey {
        if let cached = cachedKeys["device_binding"] {
            return cached
        }

        let query: [String: Any] = [
            kSecClass as String: kSecClassKey,
            kSecAttrApplicationTag as String: deviceBindingTag.data(using: .utf8)!,
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecReturnRef as String: true
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)

        guard status == errSecSuccess, let key = item else {
            throw SecureEnclaveError.keyNotFound("device_binding")
        }

        let privateKey = key as! SecKey
        cachedKeys["device_binding"] = privateKey
        return privateKey
    }

    /// Get device binding public key DER SPKI data
    public func getDeviceBindingPublicKeyDER() throws -> Data {
        let privateKey = try getDeviceBindingKey()
        guard let publicKey = SecKeyCopyPublicKey(privateKey) else {
            throw SecureEnclaveError.publicKeyExtractionFailed
        }

        var error: Unmanaged<CFError>?
        guard let rawKey = SecKeyCopyExternalRepresentation(publicKey, &error) else {
            throw SecureEnclaveError.publicKeyExportFailed(error?.takeRetainedValue())
        }
        return ecP256SPKIPrefix() + (rawKey as Data)
    }

    /// Sign challenge with device binding key
    public func signChallengeWithDeviceKey(_ challenge: String) throws -> Data {
        let privateKey = try getDeviceBindingKey()
        let challengeData = Data(challenge.utf8)

        var error: Unmanaged<CFError>?
        guard let signature = SecKeyCreateSignature(
            privateKey,
            .ecdsaSignatureMessageX962SHA256,
            challengeData as CFData,
            &error
        ) else {
            throw SecureEnclaveError.signingFailed(error?.takeRetainedValue())
        }

        return signature as Data
    }

    /// Convenience: DER SPKI public key as Base64
    public func getDeviceBindingPublicKeyDERBase64() throws -> String {
        try getDeviceBindingPublicKeyDER().base64EncodedString()
    }

    /// Check if device binding key exists
    public func hasDeviceBindingKey() -> Bool {
        do {
            _ = try getDeviceBindingKey()
            return true
        } catch {
            return false
        }
    }
}

// MARK: - Errors

public enum SecureEnclaveError: LocalizedError {
    case accessControlCreationFailed(CFError?)
    case keyGenerationFailed(CFError?)
    case keyNotFound(String)
    case signingFailed(CFError?)
    case publicKeyExtractionFailed
    case publicKeyExportFailed(CFError?)
    case notAvailable

    public var errorDescription: String? {
        switch self {
        case .accessControlCreationFailed(let error):
            return "Failed to create access control: \(error?.localizedDescription ?? "Unknown error")"
        case .keyGenerationFailed(let error):
            return "Failed to generate key: \(error?.localizedDescription ?? "Unknown error")"
        case .keyNotFound(let identifier):
            return "Key not found: \(identifier)"
        case .signingFailed(let error):
            return "Failed to sign data: \(error?.localizedDescription ?? "Unknown error")"
        case .publicKeyExtractionFailed:
            return "Failed to extract public key"
        case .publicKeyExportFailed(let error):
            return "Failed to export public key: \(error?.localizedDescription ?? "Unknown error")"
        case .notAvailable:
            return "Secure Enclave is not available on this device"
        }
    }
}
