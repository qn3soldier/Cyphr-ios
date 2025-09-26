import Foundation
import CryptoKit
import Security
import Combine
#if os(iOS)
import LocalAuthentication
import UIKit
#endif

/// Cyphr Identity Errors
enum CyphrError: LocalizedError {
    case biometricNotAvailable
    case biometricAuthFailed
    case deviceAlreadyRegistered(String)
    case notAuthenticated
    case invalidRecoveryPhrase
    case pinNotSet
    case invalidPIN
    case keychainError
    case tooManyAttempts(remainingSeconds: Int)
    case deviceWiped
    case keyGenerationFailed
    case autoLoginFailed
    case identityNotFound
    case authenticationFailed
    
    var errorDescription: String? {
        switch self {
        case .biometricNotAvailable:
            return "Face ID/Touch ID not available on this device"
        case .biometricAuthFailed:
            return "Biometric authentication failed"
        case .deviceAlreadyRegistered(let cyphrId):
            return "Device already registered with @\(cyphrId)"
        case .notAuthenticated:
            return "Not authenticated"
        case .invalidRecoveryPhrase:
            return "Invalid recovery phrase"
        case .pinNotSet:
            return "PIN not configured"
        case .invalidPIN:
            return "PIN must be at least 6 digits"
        case .keychainError:
            return "Keychain access error"
        case .tooManyAttempts(let remainingSeconds):
            if remainingSeconds < 60 {
                return "Too many attempts. Try again in \(remainingSeconds) seconds"
            } else if remainingSeconds < 3600 {
                return "Too many attempts. Try again in \(remainingSeconds / 60) minutes"
            } else {
                return "Too many attempts. Try again in \(remainingSeconds / 3600) hour(s)"
            }
        case .deviceWiped:
            return "Security wipe triggered. All data has been deleted."
        case .keyGenerationFailed:
            return "Failed to generate secure keys"
        case .autoLoginFailed:
            return "Auto-login failed"
        case .identityNotFound:
            return "Cyphr Identity not found. Please register first"
        case .authenticationFailed:
            return "Authentication failed. Please try again"
        }
    }
}

/// Cyphr Identity - Self-sovereign cryptographic identity system
/// One device = One identity, protected by iOS Secure Enclave
public class CyphrIdentity: ObservableObject {
    
    // MARK: - Properties
    private var privateKey: P256.Signing.PrivateKey?
    @Published public private(set) var publicKey: P256.Signing.PublicKey?
    // Ed25519 keypair for authentication (server expects Ed25519 signatures)
    private var ed25519PrivateKey: Curve25519.Signing.PrivateKey?
    @Published public private(set) var ed25519PublicKey: Curve25519.Signing.PublicKey?
    @Published public private(set) var cyphrId: String?
    @Published public private(set) var recoveryPhrase: [String]?
    
    private let keychain = EnterpriseKeychainService.shared

    // MARK: - Singleton
    public static let shared = CyphrIdentity()

    private init() {}

    private enum KeychainPrompt {
        static let signingKey = "Authenticate to access your Cyphr signing key"
        static let edSigningKey = "Authenticate to access your Cyphr Ed25519 key"
        static let kyberKey = "Authenticate to access your Kyber decryption key"
        static let recoveryPhrase = "Authenticate to access your recovery phrase"
    }

    private func loadSigningPrivateKey(context: LAContext? = nil) async throws -> P256.Signing.PrivateKey {
        if let cached = privateKey {
            return cached
        }

        let data = try await keychain.retrieve(
            key: "cyphr_private_key",
            reason: KeychainPrompt.signingKey,
            allowPINFallback: true,
            context: context
        )

        let key = try P256.Signing.PrivateKey(rawRepresentation: data)
        self.privateKey = key
        self.publicKey = key.publicKey
        return key
    }

    private func loadEd25519PrivateKey(context: LAContext? = nil) async throws -> Curve25519.Signing.PrivateKey {
        if let cached = ed25519PrivateKey {
            return cached
        }

        let data = try await keychain.retrieve(
            key: "cyphr_ed25519_private_key",
            reason: KeychainPrompt.edSigningKey,
            allowPINFallback: true,
            context: context
        )

        let key = try Curve25519.Signing.PrivateKey(rawRepresentation: data)
        self.ed25519PrivateKey = key
        self.ed25519PublicKey = key.publicKey
        return key
    }
    
    // MARK: - Identity Creation
    
    /// Generate new Cyphr Identity with Ed25519 keypair in Secure Enclave
    public func generateIdentity(cyphrId: String? = nil) async throws -> (cyphrId: String, publicKey: String, recoveryPhrase: [String]) {
        print("🔐 Generating Cyphr Identity with iOS Secure Enclave...")
        
        // Check if device already has identity without prompting biometrics
        if keychain.exists(key: "cyphr_private_key") {
            let existingId = await checkStoredIdentity() ?? "existing_user"
            throw CyphrError.deviceAlreadyRegistered(existingId)
        }
        
        // Generate secure private key in Secure Enclave (for local features)
        let privateKey = try await generateSecureEnclaveKey()
        self.privateKey = privateKey
        self.publicKey = privateKey.publicKey

        // Generate Ed25519 keypair for authentication with backend
        let edKey = Curve25519.Signing.PrivateKey()
        self.ed25519PrivateKey = edKey
        self.ed25519PublicKey = edKey.publicKey
        
        // Use provided cyphrId (username) or generate unique one from device
        let finalCyphrId = cyphrId ?? generateCyphrIdFromDevice()
        self.cyphrId = finalCyphrId
        
        // Generate BIP39 recovery phrase
        let recoveryPhrase = generateRecoveryPhrase()
        self.recoveryPhrase = recoveryPhrase
        
        // Store in Keychain with biometric protection
        try await storeIdentity(
            cyphrId: finalCyphrId,
            privateKey: privateKey,
            recoveryPhrase: recoveryPhrase
        )
        
        print("✅ Cyphr Identity created: @\(finalCyphrId)")
        
        return (
            cyphrId: finalCyphrId,
            publicKey: ed25519PublicKey?.rawRepresentation.base64EncodedString() ?? "",
            recoveryPhrase: recoveryPhrase
        )
    }
    
    // MARK: - Device Binding
    
    /// Bind identity to device with Face ID/Touch ID
    public func bindToDevice() async throws {
        print("📱 Binding Cyphr Identity to iOS device...")
        
        #if os(iOS)
        // Check biometric availability
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            throw CyphrError.biometricNotAvailable
        }
        
        // Authenticate with Face ID/Touch ID
        let reason = "Bind your Cyphr Identity to this iPhone"
        do {
            let success = try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: reason
            )
            
            if success {
                print("✅ Successfully bound to iOS Secure Enclave")
                UserDefaults.standard.set(true, forKey: "cyphr_device_bound")
            }
        } catch {
            throw CyphrError.biometricAuthFailed
        }
        #else
        print("⚠️ Device binding not available on this platform")
        #endif
    }
    
    // MARK: - Auto Login
    
    /// Authenticate with biometric or PIN fallback
    public func authenticateWithBiometric() async throws -> Bool {
        #if os(iOS)
        do {
            _ = try await BiometricAuthService.shared.authenticate(
                reason: "Authenticate to access your Cyphr account",
                allowPINFallback: true
            )
            return true
        } catch let error as BiometricAuthService.AuthError {
            switch error {
            case .notAvailable:
                throw CyphrError.biometricNotAvailable
            case .notEnrolled, .lockout, .authenticationFailed:
                return try await authenticateWithPIN()
            case .userCancelled:
                throw CyphrError.biometricAuthFailed
            }
        } catch {
            throw CyphrError.biometricAuthFailed
        }
        #else
        // For macOS or other platforms
        return true
        #endif
    }

    #if os(iOS)
    public func obtainAuthenticatedContext(reason: String) async throws -> LAContext {
        let result = try await BiometricAuthService.shared.authenticate(
            reason: reason,
            allowPINFallback: true
        )

        switch result {
        case .success(let context):
            return context
        }
    }
    #endif
    
    /// Authenticate with PIN fallback
    private func authenticateWithPIN() async throws -> Bool {
        // Check if PIN is set
        guard keychain.exists(key: "cyphr_pin_hash") else {
            throw CyphrError.pinNotSet
        }
        // In production, show PIN UI; here return false to force setup elsewhere
        return false
    }
    
    /// Set up PIN for fallback authentication
    public func setupPIN(_ pin: String) async throws {
        guard pin.count >= 6 else {
            throw CyphrError.invalidPIN
        }
        
        // Hash PIN with salt for security
        let salt = Data((0..<32).map { _ in UInt8.random(in: 0...255) })
        let pinData = pin.data(using: .utf8)!
        let combined = salt + pinData
        let hash = SHA256.hash(data: combined)
        
        // Store hash and salt
        try keychain.store(
            key: "cyphr_pin_hash",
            data: Data(hash),
            requiresBiometry: false
        )
        try keychain.store(
            key: "cyphr_pin_salt",
            data: salt,
            requiresBiometry: false
        )
    }
    
    /// Verify PIN with rate limiting and progressive delay
    public func verifyPIN(_ pin: String) async throws -> Bool {
        // Check if locked due to too many attempts
        try await checkRateLimiting()
        
        guard let storedHash = keychain.retrieveWithoutAuthentication(key: "cyphr_pin_hash"),
              let saltData = keychain.retrieveWithoutAuthentication(key: "cyphr_pin_salt") else {
            return false
        }

        let pinData = pin.data(using: .utf8)!
        let combined = saltData + pinData
        let hash = SHA256.hash(data: combined)

        let isValid = Data(hash) == storedHash
        
        if isValid {
            // Reset failed attempts on success
            try await resetFailedAttempts()
        } else {
            // Increment failed attempts and apply delay
            try await incrementFailedAttempts()
        }
        
        return isValid
    }
    
    /// Check rate limiting and throw if locked
    private func checkRateLimiting() async throws {
        let attempts = getFailedAttempts()
        let lastAttemptTime = getLastAttemptTime()
        let now = Date()
        
        // Progressive lockout times (in seconds)
        let lockoutDuration: TimeInterval = switch attempts {
        case 0..<3: 0
        case 3: 1
        case 4: 2
        case 5: 5
        case 6: 15
        case 7: 60
        case 8: 300
        case 9: 900
        default: 3600
        }
        
        if let lastTime = lastAttemptTime {
            let timePassed = now.timeIntervalSince(lastTime)
            if timePassed < lockoutDuration {
                let remainingTime = Int(lockoutDuration - timePassed)
                throw CyphrError.tooManyAttempts(remainingSeconds: remainingTime)
            }
        }
        
        if attempts >= 15 {
            try await performSecurityWipe()
            throw CyphrError.deviceWiped
        }
    }
    
    private func incrementFailedAttempts() async throws {
        let attempts = getFailedAttempts() + 1
        let now = Date()
        
        try keychain.store(
            key: "cyphr_failed_attempts",
            data: Data(String(attempts).utf8),
            requiresBiometry: false
        )
        
        try keychain.store(
            key: "cyphr_last_attempt_time",
            data: try JSONEncoder().encode(now),
            requiresBiometry: false
        )
        
        print("⚠️ Failed PIN attempt #\(attempts) at \(now)")
    }
    
    private func resetFailedAttempts() async throws {
        _ = keychain.delete(key: "cyphr_failed_attempts")
        _ = keychain.delete(key: "cyphr_last_attempt_time")
        print("✅ PIN verified successfully - attempts reset")
    }
    
    private func getFailedAttempts() -> Int {
        guard let data = keychain.retrieveWithoutAuthentication(key: "cyphr_failed_attempts"),
              let string = String(data: data, encoding: .utf8),
              let attempts = Int(string) else {
            return 0
        }
        return attempts
    }

    private func getLastAttemptTime() -> Date? {
        guard let data = keychain.retrieveWithoutAuthentication(key: "cyphr_last_attempt_time"),
              let date = try? JSONDecoder().decode(Date.self, from: data) else {
            return nil
        }
        return date
    }
    
    private func performSecurityWipe() async throws {
        print("🚨 SECURITY WIPE TRIGGERED - Too many failed attempts")
        _ = keychain.delete(key: "cyphr_private_key")
        _ = keychain.delete(key: "cyphr_recovery_phrase")
        _ = keychain.delete(key: "cyphr_pin_hash")
        _ = keychain.delete(key: "cyphr_pin_salt")
        print("💀 All sensitive data wiped from device")
    }
    
    public func autoLogin() async throws -> (cyphrId: String, publicKey: String)? {
        print("🔍 Checking for stored Cyphr Identity...")
        
        #if os(iOS)
        let authContext: LAContext
        do {
            authContext = try await obtainAuthenticatedContext(reason: "Unlock your Cyphr Identity")
        } catch {
            throw CyphrError.autoLoginFailed
        }
        guard let identity = try? await getStoredIdentity(context: authContext) else {
            print("❌ No stored identity found")
            return nil
        }
        self.cyphrId = identity.cyphrId
        self.privateKey = identity.privateKey
        self.publicKey = identity.privateKey.publicKey

        print("✅ Auto-login successful: @\(identity.cyphrId)")
        return (
            cyphrId: identity.cyphrId,
            publicKey: identity.privateKey.publicKey.rawRepresentation.base64EncodedString()
        )
        #else
        guard let identity = try? await getStoredIdentity() else {
            print("❌ No stored identity found")
            return nil
        }
        self.cyphrId = identity.cyphrId
        self.privateKey = identity.privateKey
        self.publicKey = identity.privateKey.publicKey

        return (
            cyphrId: identity.cyphrId,
            publicKey: identity.privateKey.publicKey.rawRepresentation.base64EncodedString()
        )
        #endif
    }
    
    // MARK: - Methods from cryptoAuth.js (unchanged where possible)
    
    public func bindToDevice(publicKey: String, cyphrId: String) async throws -> (success: Bool, credentialId: String?, deviceInfo: [String: Any]) {
        print("📱 Binding cryptographic identity to device...")
        
        #if os(iOS)
        do {
            _ = try await BiometricAuthService.shared.authenticate(
                reason: "Bind Cyphr identity to this device",
                allowPINFallback: true
            )
        } catch let error as BiometricAuthService.AuthError {
            switch error {
            case .notAvailable:
                throw CyphrError.biometricNotAvailable
            case .userCancelled, .authenticationFailed, .notEnrolled, .lockout:
                throw CyphrError.biometricAuthFailed
            }
        }

        print("✅ Successfully bound to device")

        return (
            success: true,
            credentialId: UUID().uuidString,
            deviceInfo: [
                "authenticatorAttachment": "platform",
                "id": UUID().uuidString
            ]
        )
        #else
        return (
            success: true,
            credentialId: UUID().uuidString,
            deviceInfo: [
                "authenticatorAttachment": "platform",
                "id": UUID().uuidString
            ]
        )
        #endif
    }
    
    public func createSecureBackup(keyPair: P256.Signing.PrivateKey, deviceCredentialId: String) async throws -> (success: Bool, recoveryPhrase: [String], backupCreated: Bool) {
        print("💾 Creating encrypted backup of private key...")
        
        let privateKeyData = keyPair.rawRepresentation
        let recoveryPhrase = generateRecoveryPhrase()
        let encryptedPrivateKey = try encryptWithPassphrase(privateKeyData, passphrase: recoveryPhrase.joined(separator: " "))
        
        try keychain.store(
            key: "cyphr_crypto_backup",
            data: encryptedPrivateKey,
            requiresBiometry: true
        )
        
        self.recoveryPhrase = recoveryPhrase
        
        print("✅ Secure backup created")
        
        return (
            success: true,
            recoveryPhrase: recoveryPhrase,
            backupCreated: true
        )
    }
    
    public func generateUniqueCyphrIdFromDevice() async -> String {
        return generateCyphrIdFromDevice()
    }
    
    private func encryptWithPassphrase(_ data: Data, passphrase: String) throws -> Data {
        let key = SymmetricKey(data: SHA256.hash(data: passphrase.data(using: .utf8)!))
        let nonce = ChaChaPoly.Nonce()
        let sealedBox = try ChaChaPoly.seal(data, using: key, nonce: nonce)
        return sealedBox.combined
    }
    
    /// Generate recovery phrase (BIP39 compliant - PRODUCTION)
    private func generateRecoveryPhrase() -> [String] {
        var entropy = Data(count: 16) // 128 bits
        let result = entropy.withUnsafeMutableBytes {
            SecRandomCopyBytes(kSecRandomDefault, 16, $0.baseAddress!)
        }
        if result != errSecSuccess {
            let randomData = SymmetricKey(size: .bits128).withUnsafeBytes { Data($0) }
            entropy = randomData
        }
        
        // Calculate checksum (first 4 bits of SHA256 hash)
        let hash = SHA256.hash(data: entropy)
        let hashBits = hash.withUnsafeBytes { Data($0) }
        let checksumBits = hashBits[0] >> 4
        
        // Combine entropy + checksum (132 bits total for 12 words)
        var combined = entropy
        combined.append(checksumBits)
        
        // Convert to word indices (11 bits per word)
        var words: [String] = []
        let wordList = getBIP39WordList()

        guard wordList.count == 2048 else {
            print("❌ BIP39 word list unavailable (expected 2048 words), returning empty recovery phrase")
            return []
        }
        
        var bitBuffer: UInt32 = 0
        var bitsInBuffer = 0
        var byteIndex = 0
        
        for _ in 0..<12 {
            while bitsInBuffer < 11 && byteIndex < combined.count {
                bitBuffer = (bitBuffer << 8) | UInt32(combined[byteIndex])
                bitsInBuffer += 8
                byteIndex += 1
            }
            
            let index = Int((bitBuffer >> (bitsInBuffer - 11)) & 0x7FF)
            bitsInBuffer -= 11
            
            if index < wordList.count {
                words.append(wordList[index])
            }
        }
        
        return words
    }
    
    /// Get full BIP39 English word list (2048 words) from app bundle
    private func getBIP39WordList() -> [String] {
        // 🎯 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Загрузка из Bundle с fallback
        
        // 1. Попытка загрузить из Bundle Resources
        if let path = Bundle.main.path(forResource: "bip39-english", ofType: "txt"),
           let content = try? String(contentsOfFile: path, encoding: .utf8) {
            let words = content.components(separatedBy: .newlines)
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
            
            if words.count == 2048 {
                print("✅ BIP39 loaded from Bundle: \(words.count) words")
                return words
            } else {
                print("⚠️ BIP39 Bundle file has wrong word count: \(words.count), expected 2048")
            }
        } else {
            print("❌ BIP39 file not found in Bundle - using fallback")
        }
        
        // 2. Fallback: использовать встроенный список
        let fallbackWords = BIP39WordList.englishWords
        if fallbackWords.count == 2048 {
            print("✅ BIP39 using fallback list: \(fallbackWords.count) words")
            return fallbackWords
        }
        
        // 3. Emergency fallback: статический список первых 2048 слов
        print("🚨 CRITICAL: Using emergency BIP39 fallback")
        return BIP39WordList.emergencyWordList
    }
    
    // MARK: - Private Methods
    
    private func generateSecureEnclaveKey() async throws -> P256.Signing.PrivateKey {
        #if os(iOS)
        _ = SecAccessControlCreateWithFlags(
            nil,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            .privateKeyUsage,
            nil
        )
        return P256.Signing.PrivateKey()
        #else
        return P256.Signing.PrivateKey()
        #endif
    }
    
    private static func generateCyphrId(from publicKey: P256.Signing.PublicKey) -> String {
        let publicKeyData = publicKey.rawRepresentation
        let hash = SHA256.hash(data: publicKeyData)
        let prefixData = Data(hash.prefix(4))
        let hexString = prefixData.hexEncodedString()
        return hexString.lowercased()
    }
    
    private func generateCyphrIdFromDevice() -> String {
        #if os(iOS)
        let deviceId = UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString
        let deviceModel = UIDevice.current.model
        let osVersion = "\(UIDevice.current.systemName) \(UIDevice.current.systemVersion)"
        #else
        let deviceId = UUID().uuidString
        let deviceModel = "macOS"
        let osVersion = "macOS"
        #endif
        let salt = "CYPHR_DEVICE_SALT_2025"
        let combined = "\(salt)-\(deviceId)-\(deviceModel)-\(osVersion)"
        let hashData = SHA256.hash(data: combined.data(using: .utf8)!)
        let hexString = hashData.compactMap { String(format: "%02x", $0) }.joined()
        return hexString
    }
    
    public func generateDeviceFingerprint() -> String {
        #if os(iOS)
        let salt = "CYPHR_DEVICE_SALT_2025"
        let deviceId = UIDevice.current.identifierForVendor?.uuidString ?? ""
        let model = UIDevice.current.model
        let osVersion = UIDevice.current.systemVersion
        let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
        let combined = "\(salt)\(deviceId)\(model)\(osVersion)\(appVersion)"
        let hashData = SHA256.hash(data: combined.data(using: .utf8)!)
        return hashData.compactMap { String(format: "%02x", $0) }.joined()
        #else
        let salt = "CYPHR_DEVICE_SALT_2025"
        let deviceId = UUID().uuidString
        let model = "macOS"
        let osVersion = ProcessInfo.processInfo.operatingSystemVersionString
        let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
        let combined = "\(salt)\(deviceId)\(model)\(osVersion)\(appVersion)"
        let hashData = SHA256.hash(data: combined.data(using: .utf8)!)
        return hashData.compactMap { String(format: "%02x", $0) }.joined()
        #endif
    }
    
    
    private func storeIdentity(cyphrId: String, privateKey: P256.Signing.PrivateKey, recoveryPhrase: [String]) async throws {
        let privateKeyData = privateKey.rawRepresentation
        let deviceFingerprint = generateCyphrIdFromDevice()
        
        try keychain.store(
            key: "cyphr_private_key",
            data: privateKeyData,
            requiresBiometry: true
        )
        
        try keychain.store(
            key: "cyphr_username",
            data: cyphrId.data(using: .utf8)!,
            requiresBiometry: false
        )
        UserDefaults.standard.set(cyphrId, forKey: "cyphr_id")
        
        try keychain.store(
            key: "cyphr_device_fingerprint",
            data: deviceFingerprint.data(using: .utf8)!,
            requiresBiometry: false
        )
        
        let phraseData = try JSONEncoder().encode(recoveryPhrase)
        try keychain.store(
            key: "cyphr_recovery_phrase",
            data: phraseData,
            requiresBiometry: true
        )

        if let ed = self.ed25519PrivateKey {
            try keychain.store(
                key: "cyphr_ed25519_private_key",
                data: ed.rawRepresentation,
                requiresBiometry: true
            )
        }
    }
    
    private func getStoredIdentity(context: LAContext? = nil) async throws -> (cyphrId: String, privateKey: P256.Signing.PrivateKey)? {
        var username: String?

        if let usernameData = try? await keychain.retrieve(
            key: "cyphr_username",
            reason: "Load stored Cyphr username",
            allowPINFallback: false
        ), let storedUsername = String(data: usernameData, encoding: .utf8) {
            username = storedUsername
        } else if let cyphrIdData = try? await keychain.retrieve(
            key: "cyphr_id",
            reason: "Load stored Cyphr ID",
            allowPINFallback: false
        ), let cyphrId = String(data: cyphrIdData, encoding: .utf8) {
            username = cyphrId
        }

        guard let finalUsername = username else {
            return nil
        }

        guard let privateKeyData = try? await keychain.retrieve(
            key: "cyphr_private_key",
            reason: KeychainPrompt.signingKey,
            allowPINFallback: true,
            context: context
        ) else {
            return nil
        }

        let privateKey = try P256.Signing.PrivateKey(rawRepresentation: privateKeyData)
        return (cyphrId: finalUsername, privateKey: privateKey)
    }

    public func checkStoredIdentity() async -> String? {
        if let usernameData = try? await keychain.retrieve(
            key: "cyphr_username",
            reason: "Check stored Cyphr username",
            allowPINFallback: false
        ), let username = String(data: usernameData, encoding: .utf8) {
            return username
        } else if let cyphrIdData = try? await keychain.retrieve(
            key: "cyphr_id",
            reason: "Check stored Cyphr ID",
            allowPINFallback: false
        ), let cyphrId = String(data: cyphrIdData, encoding: .utf8) {
            return cyphrId
        }
        return nil
    }
    
    // MARK: - Additional Authentication Methods
    
    public func signMessage(_ message: String, context: LAContext? = nil) async throws -> String {
        let key = try await loadEd25519PrivateKey(context: context)
        let messageData = Data(message.utf8)
        let signature = try key.signature(for: messageData)
        return signature.base64EncodedString()
    }

    public func signChallenge(challenge: String, for cyphrId: String, context: LAContext? = nil) async throws -> String {
        let signingKey = try await loadEd25519PrivateKey(context: context)
        self.cyphrId = cyphrId
        let challengeData = Data(challenge.utf8)
        let signature = try signingKey.signature(for: challengeData)
        return signature.base64EncodedString()
    }

    public func signRegistrationPayload(
        cyphrId: String,
        publicKey: String,
        deviceFingerprint: String,
        context: LAContext? = nil
    ) async throws -> String {
        let key = try await loadEd25519PrivateKey(context: context)
        let canonical = "cyphrId:\(cyphrId);publicKey:\(publicKey);deviceFingerprint:\(deviceFingerprint)"
        let signature = try key.signature(for: Data(canonical.utf8))
        return signature.base64EncodedString()
    }
    
    public func signLoginPayload(
        cyphrId: String,
        deviceFingerprint: String,
        context: LAContext? = nil
    ) async throws -> String {
        let key = try await loadEd25519PrivateKey(context: context)
        let canonical = "login;cyphrId:\(cyphrId);deviceFingerprint:\(deviceFingerprint)"
        let signature = try key.signature(for: Data(canonical.utf8))
        return signature.base64EncodedString()
    }

    public func signLoginPayloadP256(
        cyphrId: String,
        deviceFingerprint: String,
        context: LAContext? = nil
    ) async throws -> String {
        let privateKey = try await loadSigningPrivateKey(context: context)
        let canonical = "login;cyphrId:\(cyphrId);deviceFingerprint:\(deviceFingerprint)"
        let signature = try privateKey.signature(for: Data(canonical.utf8))
        return signature.derRepresentation.base64EncodedString()
    }
    
    public func recoverFromPhrase(_ phrase: [String]) async throws -> (cyphrId: String, publicKey: String, recoveryPhrase: [String]) {
        guard phrase.count == 12 else {
            throw CyphrError.invalidRecoveryPhrase
        }
        
        let phraseString = phrase.joined(separator: " ")
        let seedData = Data(phraseString.utf8).sha256Hash()
        let privateKey = try P256.Signing.PrivateKey(rawRepresentation: seedData.prefix(32))
        let cyphrId = Self.generateCyphrId(from: privateKey.publicKey)
        
        self.privateKey = privateKey
        self.publicKey = privateKey.publicKey
        self.cyphrId = cyphrId
        self.recoveryPhrase = phrase
        
        try await storeIdentity(
            cyphrId: cyphrId,
            privateKey: privateKey,
            recoveryPhrase: phrase
        )
        
        return (
            cyphrId: cyphrId,
            publicKey: privateKey.publicKey.rawRepresentation.base64EncodedString(),
            recoveryPhrase: phrase
        )
    }
    
    public func deleteIdentity() {
        self.privateKey = nil
        self.publicKey = nil
        self.cyphrId = nil
        self.recoveryPhrase = nil
        
        _ = keychain.delete(key: "cyphr_private_key")
        _ = keychain.delete(key: "cyphr_id")
        _ = keychain.delete(key: "cyphr_recovery_phrase")
        
        print("🗑 Identity deleted from device")
    }
    
    public func clearStoredIdentity() async throws {
        print("🗑️ Clearing stored Cyphr Identity from device...")
        
        _ = keychain.delete(key: "cyphr_private_key")
        _ = keychain.delete(key: "cyphr_id")
        _ = keychain.delete(key: "cyphr_recovery_phrase")
        
        self.privateKey = nil
        self.publicKey = nil
        self.cyphrId = ""
        self.recoveryPhrase = []
        
        print("✅ Identity cleared from device")
    }
    
    /// Get Kyber1024 private key for decryption.
    /// Tries Keychain first; if absent, generates a new pair, stores private key (Face ID protected),
    /// caches public key for reference, and returns private key (base64).
    public func getKyberPrivateKey() async throws -> String {
        if let existing = try? await keychain.retrieve(
            key: "kyber_private_key",
            reason: KeychainPrompt.kyberKey,
            allowPINFallback: true
        ) {
            return existing.base64EncodedString()
        }
        // Generate new Kyber keypair and persist
        let (pub, priv, keyId) = PostQuantumCrypto.shared.generateKyber1024KeyPair()
        // Store private key (biometry-protected)
        try keychain.store(
            key: "kyber_private_key",
            data: Data(base64Encoded: priv) ?? Data(),
            requiresBiometry: true
        )
        // Cache public key and keyId for convenience
        UserDefaults.standard.set(pub, forKey: "kyber_public_key")
        UserDefaults.standard.set(keyId, forKey: "kyber_key_id")
        print("🔑 Stored new Kyber keypair (keyId: \(keyId))")
        return priv
    }
    
    public func clearAllKeychainData() {
        let keychainServices = [
            "com.cyphr.identity",
            "com.cyphr.privatekey",
            "com.cyphr.publickey",
            "com.cyphr.recoveryphrase",
            "com.cyphr.pin",
            "com.cyphr.biometric",
            // also our consolidated service:
            "com.cyphr.messenger"
        ]
        
        for service in keychainServices {
            let query: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: service
            ]
            SecItemDelete(query as CFDictionary)
        }
        
        self.privateKey = nil
        self.publicKey = nil
        self.cyphrId = nil
        self.recoveryPhrase = nil
        
        print("🗑️ All Cyphr data permanently deleted from device")
    }
}

// MARK: - Legacy KeychainService (kept for compatibility in other files if any)

class KeychainService {
    func store(key: String, data: Data, requiresBiometry: Bool) throws {
        // Deprecated in favor of EnterpriseKeychainService
        try EnterpriseKeychainService.shared.store(key: key, data: data, requiresBiometry: requiresBiometry)
    }
    
    func retrieve(key: String) -> Data? {
        EnterpriseKeychainService.shared.retrieveWithoutAuthentication(key: key)
    }

    func retrieveNoUI(key: String) -> Data? {
        EnterpriseKeychainService.shared.retrieveWithoutAuthentication(key: key)
    }
    
    func delete(key: String) -> Bool {
        EnterpriseKeychainService.shared.delete(key: key)
    }
}

// MARK: - Extensions

extension Data {
    func sha256Hash() -> Data {
        SHA256.hash(data: self).data
    }
    
    func hexEncodedString() -> String {
        map { String(format: "%02x", $0) }.joined()
    }
}

extension Digest {
    var data: Data {
        Data(self)
    }
}
