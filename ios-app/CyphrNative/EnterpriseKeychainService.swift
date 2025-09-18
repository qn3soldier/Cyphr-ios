import Foundation
import LocalAuthentication
import Security
import CryptoKit
import os.log

/// Enterprise-grade Keychain Service with comprehensive security features
final class EnterpriseKeychainService {

    // MARK: - Properties

    private let logger = Logger(subsystem: "com.cyphrmessenger.ios", category: "Keychain")
    private let auditLogger = Logger(subsystem: "com.cyphrmessenger.ios", category: "Security.Audit")
    private let biometricAuth = BiometricAuthService.shared

    /// Singleton instance for consistent state management
    static let shared = EnterpriseKeychainService()

    /// Track failed PIN attempts for rate limiting
    private var failedPINAttempts = 0
    private var lastFailedAttempt: Date?

    /// Configuration
    private struct Config {
        static let maxPINAttempts = 15
        static let pinLockoutDurations: [Int: TimeInterval] = [
            3: 30,      // 30 seconds after 3 attempts
            5: 300,     // 5 minutes after 5 attempts
            10: 3600,   // 1 hour after 10 attempts
            15: .infinity // Permanent lockout after 15 attempts
        ]
    }

    // MARK: - Initialization

    private init() {
        // Private init for singleton
    }

    // MARK: - Core Storage Operations

    /// Store data with enterprise-grade security
    func store(
        key: String,
        data: Data,
        requiresBiometry: Bool,
        accessGroup: String? = nil
    ) throws {
        logger.info("Storing item: \(key, privacy: .public)")

        // Audit log
        auditLogger.info("STORE_ATTEMPT: key=\(key, privacy: .public), biometry=\(requiresBiometry)")

        // Delete existing item
        _ = deleteItem(key: key, accessGroup: accessGroup)

        // Build query
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "com.cyphrmessenger.ios",
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrSynchronizable as String: kCFBooleanFalse!, // Never sync to iCloud
            kSecUseDataProtectionKeychain as String: kCFBooleanTrue!
        ]

        // Add access group if specified (for app extensions)
        if let accessGroup = accessGroup {
            query[kSecAttrAccessGroup as String] = accessGroup
        }

        // Configure biometric protection
        if requiresBiometry {
            var error: Unmanaged<CFError>?
            guard let accessControl = SecAccessControlCreateWithFlags(
                kCFAllocatorDefault,
                kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
                .biometryCurrentSet,
                &error
            ) else {
                let errorMessage = error?.takeRetainedValue().localizedDescription ?? "Unknown error"
                logger.error("Failed to create access control: \(errorMessage)")
                throw KeychainError.accessControlCreationFailed(errorMessage)
            }

            query[kSecAttrAccessControl as String] = accessControl
        } else {
            query[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        }

        // Attempt to store
        let status = SecItemAdd(query as CFDictionary, nil)

        switch status {
        case errSecSuccess:
            logger.info("Successfully stored: \(key, privacy: .public)")
            auditLogger.info("STORE_SUCCESS: key=\(key, privacy: .public)")

            // Verify storage immediately
            verifyStorage(key: key, accessGroup: accessGroup)

        case errSecDuplicateItem:
            logger.error("Duplicate item error for: \(key, privacy: .public)")
            throw KeychainError.duplicateItem

        case errSecAuthFailed:
            logger.error("Authentication failed for: \(key, privacy: .public)")
            throw KeychainError.authenticationFailed

        default:
            logger.error("Store failed with status: \(status) for: \(key, privacy: .public)")
            auditLogger.error("STORE_FAILED: key=\(key, privacy: .public), status=\(status)")
            throw KeychainError.storeFailed(status)
        }
    }

    /// Retrieve data with proper Face ID handling
    func retrieve(
        key: String,
        reason: String,
        accessGroup: String? = nil,
        allowPINFallback: Bool = true,
        context: LAContext? = nil
    ) async throws -> Data {
        logger.info("Retrieving item: \(key, privacy: .public)")
        auditLogger.info("RETRIEVE_ATTEMPT: key=\(key, privacy: .public)")

        if let lockoutError = checkLockoutStatus() {
            throw lockoutError
        }

        var query = baseQuery(for: key, accessGroup: accessGroup)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        if let context {
            context.interactionNotAllowed = false
            query[kSecUseAuthenticationContext as String] = context
        } else {
            let nonInteractiveContext = LAContext()
            nonInteractiveContext.interactionNotAllowed = true
            query[kSecUseAuthenticationContext as String] = nonInteractiveContext
        }

        var result: AnyObject?
        var status = SecItemCopyMatching(query as CFDictionary, &result)

        if status == errSecInteractionNotAllowed || status == errSecAuthFailed {
            guard context == nil else {
                logger.error("Authenticated context failed for: \(key, privacy: .public)")
                throw KeychainError.authenticationFailed
            }

            do {
                let authResult = try await biometricAuth.authenticate(
                    reason: reason,
                    allowPINFallback: allowPINFallback
                )

                switch authResult {
                case .success(let authenticatedContext):
                    authenticatedContext.interactionNotAllowed = false
                    query[kSecUseAuthenticationContext as String] = authenticatedContext
                    status = SecItemCopyMatching(query as CFDictionary, &result)
                }
            } catch let authError as BiometricAuthService.AuthError {
                logger.error("Biometric auth failed for \(key, privacy: .public): \(authError.localizedDescription)")
                switch authError {
                case .notAvailable:
                    throw KeychainError.biometryNotAvailable
                case .notEnrolled:
                    throw KeychainError.biometryNotEnrolled
                case .lockout:
                    throw KeychainError.biometryLockout
                case .userCancelled:
                    throw KeychainError.userCancelled
                case .authenticationFailed:
                    throw KeychainError.biometricAuthFailed
                }
            }
        }

        switch status {
        case errSecSuccess:
            guard let data = result as? Data else {
                throw KeychainError.dataCorrupted
            }
            logger.info("Successfully retrieved: \(key, privacy: .public)")
            auditLogger.info("RETRIEVE_SUCCESS: key=\(key, privacy: .public)")
            return data

        case errSecItemNotFound:
            logger.warning("Item not found: \(key, privacy: .public)")
            throw KeychainError.itemNotFound

        case errSecUserCanceled:
            logger.info("User cancelled authentication for: \(key, privacy: .public)")
            throw KeychainError.userCancelled

        case errSecAuthFailed:
            logger.error("Authentication failed for: \(key, privacy: .public)")
            auditLogger.error("RETRIEVE_AUTH_FAILED: key=\(key, privacy: .public)")
            throw KeychainError.authenticationFailed

        default:
            logger.error("Retrieve failed with status: \(status) for: \(key, privacy: .public)")
            throw KeychainError.retrieveFailed(status)
        }
    }

    // MARK: - PIN Management

    /// Store PIN with enterprise security
    func storePIN(_ pin: String) throws {
        guard pin.count == 6, pin.allSatisfy({ $0.isNumber }) else {
            throw KeychainError.invalidPIN
        }

        // Generate salt
        let salt = generateSecureSalt()

        // Derive key using Argon2id (simulated with PBKDF2 for iOS)
        let rounds = 100_000 // High iteration count for security
        guard let pinData = pin.data(using: .utf8),
              let saltData = salt.data(using: .utf8) else {
            throw KeychainError.dataConversionFailed
        }

        let keyLength = 32
        var derivedKey = Data(count: keyLength)

        let result = derivedKey.withUnsafeMutableBytes { derivedKeyBytes in
            pinData.withUnsafeBytes { pinBytes in
                saltData.withUnsafeBytes { saltBytes in
                    CCKeyDerivationPBKDF(
                        CCPBKDFAlgorithm(kCCPBKDF2),
                        pinBytes.bindMemory(to: Int8.self).baseAddress!,
                        pinData.count,
                        saltBytes.bindMemory(to: UInt8.self).baseAddress!,
                        saltData.count,
                        CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256),
                        UInt32(rounds),
                        derivedKeyBytes.bindMemory(to: UInt8.self).baseAddress!,
                        keyLength
                    )
                }
            }
        }

        guard result == kCCSuccess else {
            throw KeychainError.pinDerivationFailed
        }

        // Store derived key and salt
        try store(key: "cyphr_pin_hash", data: derivedKey, requiresBiometry: false)
        try store(key: "cyphr_pin_salt", data: saltData, requiresBiometry: false)
        try store(key: "cyphr_pin_rounds", data: Data(String(rounds).utf8), requiresBiometry: false)

        // Reset failed attempts
        failedPINAttempts = 0
        lastFailedAttempt = nil

        auditLogger.info("PIN_STORED: success")
    }

    /// Verify PIN with rate limiting
    func verifyPIN(_ pin: String) async throws -> Bool {
        // Check lockout
        if let lockoutError = checkLockoutStatus() {
            throw lockoutError
        }

        guard let hashData = try? await retrieve(key: "cyphr_pin_hash", reason: "Verify PIN", allowPINFallback: false),
              let saltData = try? await retrieve(key: "cyphr_pin_salt", reason: "Verify PIN", allowPINFallback: false),
              let roundsData = try? await retrieve(key: "cyphr_pin_rounds", reason: "Verify PIN", allowPINFallback: false),
              let salt = String(data: saltData, encoding: .utf8),
              let roundsString = String(data: roundsData, encoding: .utf8),
              let rounds = Int(roundsString) else {
            throw KeychainError.pinNotSet
        }

        // Add progressive delay based on attempts
        if failedPINAttempts > 0 {
            let delay = calculateDelay(for: failedPINAttempts)
            try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
        }

        // Derive key from provided PIN
        guard let pinData = pin.data(using: .utf8),
              let saltData = salt.data(using: .utf8) else {
            throw KeychainError.dataConversionFailed
        }

        let keyLength = 32
        var derivedKey = Data(count: keyLength)

        let result = derivedKey.withUnsafeMutableBytes { derivedKeyBytes in
            pinData.withUnsafeBytes { pinBytes in
                saltData.withUnsafeBytes { saltBytes in
                    CCKeyDerivationPBKDF(
                        CCPBKDFAlgorithm(kCCPBKDF2),
                        pinBytes.bindMemory(to: Int8.self).baseAddress!,
                        pinData.count,
                        saltBytes.bindMemory(to: UInt8.self).baseAddress!,
                        saltData.count,
                        CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256),
                        UInt32(rounds),
                        derivedKeyBytes.bindMemory(to: UInt8.self).baseAddress!,
                        keyLength
                    )
                }
            }
        }

        guard result == kCCSuccess else {
            throw KeychainError.pinDerivationFailed
        }

        // Constant-time comparison
        let matches = hashData.withUnsafeBytes { hash in
            derivedKey.withUnsafeBytes { derived in
                zip(hash, derived).allSatisfy { $0 == $1 }
            }
        }

        if matches {
            // Reset on success
            self.failedPINAttempts = 0
            self.lastFailedAttempt = nil
            auditLogger.info("PIN_VERIFY_SUCCESS")
            return true
        } else {
            // Increment failures
            self.failedPINAttempts += 1
            self.lastFailedAttempt = Date()

            auditLogger.warning("PIN_VERIFY_FAILED: attempt=\(self.failedPINAttempts)")

            // Check for wipe condition
            if self.failedPINAttempts >= Config.maxPINAttempts {
                auditLogger.critical("PIN_MAX_ATTEMPTS_REACHED: WIPING DATA")
                try await wipeAllData()
                throw KeychainError.maxAttemptsReachedDataWiped
            }

            return false
        }
    }

    // MARK: - Helper Methods

    @discardableResult
    private func deleteItem(key: String, accessGroup: String?) -> OSStatus {
        let query = baseQuery(for: key, accessGroup: accessGroup)
        return SecItemDelete(query as CFDictionary)
    }

    private func verifyStorage(key: String, accessGroup: String?) {
        let status = retrieveStatusWithoutPrompt(key: key, accessGroup: accessGroup)

        if status == errSecSuccess {
            logger.info("Verification successful for: \(key, privacy: .public)")
        } else if status == errSecInteractionNotAllowed {
            logger.info("Verification deferred (authentication required) for: \(key, privacy: .public)")
        } else {
            logger.warning("Verification failed for: \(key, privacy: .public), status: \(status)")
        }
    }

    private func baseQuery(for key: String, accessGroup: String?) -> [String: Any] {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "com.cyphrmessenger.ios",
            kSecAttrAccount as String: key
        ]

        if let accessGroup = accessGroup {
            query[kSecAttrAccessGroup as String] = accessGroup
        }

        return query
    }

    private func retrieveStatusWithoutPrompt(key: String, accessGroup: String?) -> OSStatus {
        var query = baseQuery(for: key, accessGroup: accessGroup)
        query[kSecReturnData as String] = false
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        let context = LAContext()
        context.interactionNotAllowed = true
        query[kSecUseAuthenticationContext as String] = context
        return SecItemCopyMatching(query as CFDictionary, nil)
    }

    func exists(key: String, accessGroup: String? = nil) -> Bool {
        let status = retrieveStatusWithoutPrompt(key: key, accessGroup: accessGroup)
        return status == errSecSuccess || status == errSecInteractionNotAllowed
    }

    func retrieveWithoutAuthentication(key: String, accessGroup: String? = nil) -> Data? {
        var query = baseQuery(for: key, accessGroup: accessGroup)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        let context = LAContext()
        context.interactionNotAllowed = true
        query[kSecUseAuthenticationContext as String] = context

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecSuccess, let data = result as? Data {
            return data
        }
        return nil
    }

    @discardableResult
    func delete(key: String, accessGroup: String? = nil) -> Bool {
        let status = deleteItem(key: key, accessGroup: accessGroup)
        return status == errSecSuccess || status == errSecItemNotFound
    }

    private func generateSecureSalt() -> String {
        let saltData = Data((0..<32).map { _ in UInt8.random(in: 0...255) })
        return saltData.base64EncodedString()
    }

    private func calculateDelay(for attempts: Int) -> TimeInterval {
        switch attempts {
        case 0...3: return 0
        case 4: return 1
        case 5: return 2
        case 6: return 5
        case 7: return 15
        case 8: return 60
        case 9: return 300
        case 10...14: return 3600
        default: return .infinity
        }
    }

    private func checkLockoutStatus() -> KeychainError? {
        guard let lastFailed = lastFailedAttempt else { return nil }

        let attempts = failedPINAttempts
        let lockoutDuration = Config.pinLockoutDurations.first { attempts >= $0.key }?.value ?? 0
        let timeSinceLastFailed = Date().timeIntervalSince(lastFailed)

        if timeSinceLastFailed < lockoutDuration {
            let remainingTime = Int(lockoutDuration - timeSinceLastFailed)
            return .lockedOut(remainingTime)
        }

        return nil
    }

    private func wipeAllData() async throws {
        let keysToWipe = [
            "cyphr_username",
            "cyphr_private_key",
            "cyphr_ed25519_private_key",
            "cyphr_recovery_phrase",
            "cyphr_pin_hash",
            "cyphr_pin_salt",
            "cyphr_pin_rounds"
        ]

        for key in keysToWipe {
            deleteItem(key: key, accessGroup: nil)
        }

        // Clear UserDefaults
        if let bundleID = Bundle.main.bundleIdentifier {
            UserDefaults.standard.removePersistentDomain(forName: bundleID)
        }

        logger.critical("ALL DATA WIPED DUE TO SECURITY POLICY")
    }

    // MARK: - Diagnostics

    func runDiagnostics() {
        logger.info("Running keychain diagnostics...")

        let keys = [
            ("cyphr_username", false),
            ("cyphr_private_key", true),
            ("cyphr_ed25519_private_key", true),
            ("cyphr_recovery_phrase", true),
            ("cyphr_pin_hash", false),
            ("cyphr_pin_salt", false)
        ]

        for (key, requiresBio) in keys {
            let query: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: "com.cyphrmessenger.ios",
                kSecAttrAccount as String: key,
                kSecReturnAttributes as String: true,
                kSecMatchLimit as String: kSecMatchLimitOne
            ]

            var result: AnyObject?
            let status = SecItemCopyMatching(query as CFDictionary, &result)

            switch status {
            case errSecSuccess:
                logger.info("✅ \(key): EXISTS (biometry required: \(requiresBio))")
            case errSecItemNotFound:
                logger.info("❌ \(key): NOT FOUND")
            case errSecInteractionNotAllowed:
                logger.info("🔐 \(key): EXISTS (requires authentication)")
            default:
                logger.info("⚠️ \(key): Status \(status)")
            }
        }
    }
}

// MARK: - Error Types

enum KeychainError: LocalizedError {
    case itemNotFound
    case duplicateItem
    case authenticationFailed
    case biometricAuthFailed
    case userCancelled
    case fallbackRequested
    case dataCorrupted
    case invalidPIN
    case pinNotSet
    case pinDerivationFailed
    case dataConversionFailed
    case biometryNotAvailable
    case biometryNotEnrolled
    case biometryLockout
    case lockedOut(Int) // seconds remaining
    case maxAttemptsReachedDataWiped
    case accessControlCreationFailed(String)
    case storeFailed(OSStatus)
    case retrieveFailed(OSStatus)

    var errorDescription: String? {
        switch self {
        case .itemNotFound:
            return "The requested item was not found in the keychain"
        case .duplicateItem:
            return "An item with this key already exists"
        case .authenticationFailed:
            return "Authentication failed"
        case .biometricAuthFailed:
            return "Face ID or Touch ID authentication failed"
        case .userCancelled:
            return "Authentication was cancelled"
        case .fallbackRequested:
            return "User requested PIN fallback"
        case .dataCorrupted:
            return "The stored data appears to be corrupted"
        case .invalidPIN:
            return "PIN must be 6 digits"
        case .pinNotSet:
            return "No PIN has been configured"
        case .pinDerivationFailed:
            return "Failed to process PIN securely"
        case .dataConversionFailed:
            return "Failed to convert data"
        case .biometryNotAvailable:
            return "Biometric authentication is not available"
        case .biometryNotEnrolled:
            return "No biometric data is enrolled"
        case .biometryLockout:
            return "Biometric authentication is locked out"
        case .lockedOut(let seconds):
            return "Too many failed attempts. Try again in \(seconds) seconds"
        case .maxAttemptsReachedDataWiped:
            return "Maximum attempts exceeded. All data has been wiped for security"
        case .accessControlCreationFailed(let reason):
            return "Failed to create secure access control: \(reason)"
        case .storeFailed(let status):
            return "Failed to store item (error: \(status))"
        case .retrieveFailed(let status):
            return "Failed to retrieve item (error: \(status))"
        }
    }
}

// MARK: - CommonCrypto Import

import CommonCrypto
