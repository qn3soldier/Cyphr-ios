import Foundation

/// Utility to clean up stale Cyphr ID data from device
/// Run this once to clear qn3soldier888 and other stale data
class CleanupUtility {

    static func cleanStaleData() {
        print("🧹 Starting cleanup of stale Cyphr ID data...")

        // Clear all UserDefaults
        UserDefaults.standard.removeObject(forKey: "cyphr_id")
        UserDefaults.standard.removeObject(forKey: "device_has_identity")
        UserDefaults.standard.removeObject(forKey: "kyber_public_key")
        UserDefaults.standard.removeObject(forKey: "kyber_key_id")
        UserDefaults.standard.removeObject(forKey: "auth_token_date")
        UserDefaults.standard.synchronize()

        // Clear Keychain using CyphrIdentity
        CyphrIdentity.shared.deleteIdentity()

        // Clear auth token
        AuthTokenStore.clear()

        // Clear any cached network data
        URLCache.shared.removeAllCachedResponses()

        print("✅ Cleanup complete - device is now clean")
        print("🆕 User will be treated as new on next launch")
    }

    /// Check if device has any stale data
    static func hasStaleData() -> Bool {
        // Check for old Cyphr ID
        if let storedId = UserDefaults.standard.string(forKey: "cyphr_id"),
           storedId.contains("qn3soldier") {
            return true
        }

        // Check for orphaned device_has_identity flag
        if UserDefaults.standard.bool(forKey: "device_has_identity") {
            // If flag is true but no cyphr_id, it's stale
            if UserDefaults.standard.string(forKey: "cyphr_id") == nil {
                return true
            }
        }

        return false
    }
}