import Foundation
import CryptoKit
#if os(iOS)
import UIKit
#endif

/// Device Identity Service - Zero-Knowledge Device Fingerprinting
/// Создает уникальный отпечаток устройства без раскрытия PII
public class DeviceIdentityService {

    // MARK: - Singleton
    public static let shared = DeviceIdentityService()

    // MARK: - Properties
    private let salt = "CYPHR_DEVICE_SALT_2025"
    private var cachedFingerprint: String?

    private init() {
        print("🔐 Device Identity Service initialized")
    }

    // MARK: - Device Fingerprinting

    /// Generate unique device fingerprint
    /// Соответствует CYPHR_ID_ARCHITECTURE.md спецификации
    public func generateFingerprint() -> String {
        // Если уже есть кешированный fingerprint, возвращаем его
        if let cached = cachedFingerprint {
            return cached
        }

        #if os(iOS)
        // iOS устройство
        let deviceId = UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString
        let model = UIDevice.current.model
        let systemName = UIDevice.current.systemName
        let osVersion = UIDevice.current.systemVersion
        #else
        // macOS для разработки/тестирования
        let deviceId = UUID().uuidString
        let model = "Mac"
        let systemName = "macOS"
        let osVersion = ProcessInfo.processInfo.operatingSystemVersionString
        #endif

        let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
        let bundleId = Bundle.main.bundleIdentifier ?? "com.cyphr.messenger"

        // Создаем строку для хеширования
        let fingerprintData = "\(salt)|\(deviceId)|\(model)|\(systemName)|\(osVersion)|\(appVersion)|\(bundleId)"

        // SHA256 хеширование
        let hash = SHA256.hash(data: Data(fingerprintData.utf8))
        let fingerprint = hash.compactMap { String(format: "%02x", $0) }.joined()

        // Кешируем результат
        cachedFingerprint = fingerprint

        print("📱 Device Fingerprint generated:")
        print("   Device ID: \(deviceId.prefix(8))...")
        print("   Model: \(model)")
        print("   OS: \(systemName) \(osVersion)")
        print("   App Version: \(appVersion)")
        print("   Fingerprint: \(fingerprint.prefix(16))...")

        return fingerprint
    }

    /// Verify device fingerprint matches stored one
    public func verifyFingerprint(_ storedFingerprint: String) -> Bool {
        let currentFingerprint = generateFingerprint()
        let matches = currentFingerprint == storedFingerprint

        if !matches {
            print("⚠️ Device fingerprint mismatch!")
            print("   Stored: \(storedFingerprint.prefix(16))...")
            print("   Current: \(currentFingerprint.prefix(16))...")
        }

        return matches
    }

    /// Get device info for registration
    public func getDeviceInfo() -> DeviceInfo {
        #if os(iOS)
        return DeviceInfo(
            deviceId: UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString,
            deviceModel: UIDevice.current.model,
            osVersion: UIDevice.current.systemVersion,
            appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
        )
        #else
        return DeviceInfo(
            deviceId: UUID().uuidString,
            deviceModel: "Mac",
            osVersion: ProcessInfo.processInfo.operatingSystemVersionString,
            appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
        )
        #endif
    }

    /// Clear cached fingerprint (useful for testing or reset)
    public func clearCache() {
        cachedFingerprint = nil
        print("🔄 Device fingerprint cache cleared")
    }

    // MARK: - Device Trust

    /// Check if this is a trusted device
    public func isTrustedDevice() -> Bool {
        // Check if device fingerprint is stored in keychain
        if let storedFingerprint = KeychainHelper.load(key: "device_fingerprint") {
            return verifyFingerprint(String(data: storedFingerprint, encoding: .utf8) ?? "")
        }
        return false
    }

    /// Mark device as trusted
    public func trustDevice() {
        let fingerprint = generateFingerprint()
        KeychainHelper.save(key: "device_fingerprint", data: Data(fingerprint.utf8))
        print("✅ Device marked as trusted")
    }

    /// Remove device trust
    public func untrustDevice() {
        KeychainHelper.delete(key: "device_fingerprint")
        clearCache()
        print("🔓 Device trust removed")
    }
}

// MARK: - Helper for Keychain

private struct KeychainHelper {
    static func save(key: String, data: Data) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: data
        ]

        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }

    static func load(key: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)

        guard status == errSecSuccess else { return nil }
        return item as? Data
    }

    static func delete(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key
        ]

        SecItemDelete(query as CFDictionary)
    }
}