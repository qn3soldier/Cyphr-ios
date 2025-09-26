import Foundation
import LocalAuthentication
import Security

/// Improved Keychain Service with proper Face ID handling
class ImprovedKeychainService {

    /// Store data in keychain with optional biometric protection
    func store(key: String, data: Data, requiresBiometry: Bool) throws {
        // Delete any existing item first
        let deleteQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key
        ]
        SecItemDelete(deleteQuery as CFDictionary)

        // Build query for adding new item
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]

        if requiresBiometry {
            // Create access control with biometry
            var error: Unmanaged<CFError>?
            guard let access = SecAccessControlCreateWithFlags(
                nil,
                kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
                .biometryCurrentSet,
                &error
            ) else {
                throw CyphrError.keyGenerationFailed
            }
            query[kSecAttrAccessControl as String] = access
        }

        // Add to keychain
        let status = SecItemAdd(query as CFDictionary, nil)

        guard status == errSecSuccess else {
            print("❌ Keychain store failed with status: \(status)")
            throw CyphrError.keyGenerationFailed
        }

        print("✅ Successfully stored \(key) in keychain (biometry: \(requiresBiometry))")

        // Verify immediately after storing
        if let _ = try? retrieve(key: key, reason: "Verify keychain storage") {
            print("✅ Verified: \(key) can be retrieved")
        } else {
            print("⚠️ Warning: \(key) stored but cannot be retrieved immediately")
        }
    }

    /// Retrieve data from keychain with Face ID prompt if needed
    func retrieve(key: String, reason: String = "Access your secure data") throws -> Data? {
        // First try without authentication UI
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        var status = SecItemCopyMatching(query as CFDictionary, &result)

        // If interaction not allowed, we need Face ID
        if status == errSecInteractionNotAllowed {
            print("🔐 Biometric authentication required for \(key)")

            #if os(iOS)
            // Create LAContext for authentication
            let context = LAContext()
            context.localizedReason = reason

            // Important: Set the interaction prompt
            context.interactionNotAllowed = false

            // Add context to query
            query[kSecUseAuthenticationContext as String] = context
            query[kSecUseAuthenticationUI as String] = kSecUseAuthenticationUIAllow

            // Try again with authentication
            status = SecItemCopyMatching(query as CFDictionary, &result)
            #endif
        }

        switch status {
        case errSecSuccess:
            print("✅ Successfully retrieved \(key)")
            return result as? Data
        case errSecItemNotFound:
            print("❌ Item not found: \(key)")
            return nil
        case errSecUserCanceled:
            print("❌ User canceled Face ID")
            throw CyphrError.biometricAuthFailed
        case errSecAuthFailed:
            print("❌ Face ID authentication failed")
            throw CyphrError.biometricAuthFailed
        default:
            print("❌ Keychain retrieve failed with status: \(status)")
            return nil
        }
    }

    /// Delete item from keychain
    func delete(key: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key
        ]

        let status = SecItemDelete(query as CFDictionary)
        if status != errSecSuccess && status != errSecItemNotFound {
            print("⚠️ Failed to delete \(key): \(status)")
        } else {
            print("✅ Deleted \(key) from keychain")
        }
    }

    /// Check if item exists in keychain
    func exists(key: String) -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: false,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        let status = SecItemCopyMatching(query as CFDictionary, nil)
        return status == errSecSuccess || status == errSecInteractionNotAllowed
    }

    /// Store PIN with salt (no biometry required)
    func storePIN(_ pin: String, salt: String) throws {
        // Hash PIN with salt
        let combined = pin + salt
        guard let data = combined.data(using: .utf8) else {
            throw CyphrError.invalidPIN
        }

        let hash = SHA256.hash(data: data)
        let hashData = Data(hash)

        // Store hash without biometry
        try store(key: "cyphr_pin_hash", data: hashData, requiresBiometry: false)

        // Store salt
        if let saltData = salt.data(using: .utf8) {
            try store(key: "cyphr_pin_salt", data: saltData, requiresBiometry: false)
        }
    }

    /// Verify PIN
    func verifyPIN(_ pin: String) throws -> Bool {
        guard let hashData = try retrieve(key: "cyphr_pin_hash", reason: "Verify PIN"),
              let saltData = try retrieve(key: "cyphr_pin_salt", reason: "Verify PIN"),
              let salt = String(data: saltData, encoding: .utf8) else {
            return false
        }

        // Hash provided PIN with stored salt
        let combined = pin + salt
        guard let data = combined.data(using: .utf8) else {
            return false
        }

        let hash = SHA256.hash(data: data)
        let newHashData = Data(hash)

        return hashData == newHashData
    }
}

// MARK: - Diagnostic Extension
extension ImprovedKeychainService {
    /// Run diagnostics on keychain
    func runDiagnostics() {
        print("\n🔍 KEYCHAIN DIAGNOSTICS")
        print("=======================")

        let keysToCheck = [
            "cyphr_username",
            "cyphr_private_key",
            "cyphr_ed25519_private_key",
            "cyphr_recovery_phrase",
            "cyphr_pin_hash",
            "cyphr_pin_salt"
        ]

        for key in keysToCheck {
            let exists = exists(key: key)
            print("\(key): \(exists ? "✅ EXISTS" : "❌ NOT FOUND")")

            if exists {
                // Try to retrieve without biometry
                let query: [String: Any] = [
                    kSecClass as String: kSecClassGenericPassword,
                    kSecAttrAccount as String: key,
                    kSecReturnAttributes as String: true,
                    kSecMatchLimit as String: kSecMatchLimitOne
                ]

                var result: AnyObject?
                let status = SecItemCopyMatching(query as CFDictionary, &result)

                if let attributes = result as? [String: Any] {
                    if let accessible = attributes[kSecAttrAccessible as String] {
                        print("  → Accessible: \(accessible)")
                    }
                    if let _ = attributes[kSecAttrAccessControl as String] {
                        print("  → Requires biometry: YES")
                    } else {
                        print("  → Requires biometry: NO")
                    }
                }
            }
        }

        print("=======================\n")
    }
}