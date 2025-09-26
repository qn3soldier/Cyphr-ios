import Foundation

/// Unified helper for persisting and retrieving the authentication token.
/// Stores the token inside the secure keychain while keeping a fallback copy in
/// `UserDefaults` for legacy flows that still rely on it. Accessors always
/// prefer the keychain value to preserve security in production builds.
enum AuthTokenStore {
    private static let tokenKey = "auth_token"

    static func save(_ token: String) {
        do {
            try EnterpriseKeychainService.shared.store(
                key: tokenKey,
                data: Data(token.utf8),
                requiresBiometry: false
            )
        } catch {
            print("⚠️ Failed to persist auth token in keychain: \(error)")
        }

        UserDefaults.standard.set(token, forKey: tokenKey)
    }

    static func load() -> String? {
        if let data = EnterpriseKeychainService.shared.retrieveWithoutAuthentication(key: tokenKey),
           let token = String(data: data, encoding: .utf8),
           !token.isEmpty {
            return token
        }

        if let token = UserDefaults.standard.string(forKey: tokenKey), !token.isEmpty {
            return token
        }

        return nil
    }

    static func clear() {
        _ = EnterpriseKeychainService.shared.delete(key: tokenKey)
        UserDefaults.standard.removeObject(forKey: tokenKey)
    }
}
