import Foundation
import CryptoKit
import Combine
#if os(iOS)
import LocalAuthentication
#endif

/// Pure Cyphr ID Authentication Service - ZERO KNOWLEDGE, ZERO STORAGE
/// No email, no phone, no passwords - only cryptographic identity
public class AuthenticationService: ObservableObject {
    
    // MARK: - Properties
    public static let shared = AuthenticationService()
    private let cyphrIdentity = CyphrIdentity.shared
    private let network = NetworkService.shared
    
    @Published public var isAuthenticated = false
    @Published public var currentUser: User?
    @Published public var currentCyphrId: String?
    
    private init() {
        print("🔐 Pure Cyphr ID Authentication Service initialized")
    }
    
    // MARK: - Cyphr ID Authentication ONLY
    
    /// Login with Cyphr ID - the ONLY way to authenticate
    public func loginWithCyphrId(cyphrId: String) async throws -> AuthResult {
        // Normalize once and use everywhere
        let normalized = cyphrId.lowercased().replacingOccurrences(of: "@", with: "")
        print("🆔 Logging in with Cyphr ID: @\(normalized)")
        
        // Verify existence
        let userInfo = try await network.lookupCyphrId(cyphrId: normalized)
        if !userInfo.exists {
            throw AuthError.userNotFound
        }
        
        // Use one consistent device fingerprint
        let deviceFingerprint = DeviceInfo.current.deviceId
        
        #if os(iOS)
        // Obtain ONE authenticated LAContext and reuse it
        let authContext: LAContext
        do {
            authContext = try await cyphrIdentity.obtainAuthenticatedContext(
                reason: "Authenticate to access your Cyphr identity"
            )
        } catch let error as BiometricAuthService.AuthError {
            switch error {
            case .notAvailable:
                throw AuthError.biometricNotAvailable
            case .userCancelled:
                throw AuthError.biometricAuthFailed
            case .notEnrolled, .lockout, .authenticationFailed:
                throw AuthError.biometricAuthFailed
            }
        }
        
        // Primary Ed25519 signature using the SAME context
        let signature = try await cyphrIdentity.signLoginPayload(
            cyphrId: normalized,
            deviceFingerprint: deviceFingerprint,
            context: authContext
        )
        #else
        let signature = try await cyphrIdentity.signLoginPayload(
            cyphrId: normalized,
            deviceFingerprint: deviceFingerprint,
            context: nil
        )
        #endif
        
        // Try Ed25519 login first
        var response: AuthResponse
        do {
            response = try await network.loginCyphrIdentity(
                cyphrId: normalized,
                signature: signature
            )
        } catch {
            // Fallback to P256 (reuse SAME auth context to avoid second prompt)
            #if os(iOS)
            let fallbackSig = try await cyphrIdentity.signLoginPayloadP256(
                cyphrId: normalized,
                deviceFingerprint: deviceFingerprint,
                context: authContext
            )
            #else
            let fallbackSig = try await cyphrIdentity.signLoginPayloadP256(
                cyphrId: normalized,
                deviceFingerprint: deviceFingerprint,
                context: nil
            )
            #endif
            response = try await network.loginCyphrIdentityP256(cyphrId: normalized, signatureDER: fallbackSig)
        }
        
        if response.success {
            let token = response.token ?? ""
            await MainActor.run {
                self.isAuthenticated = true
                self.currentCyphrId = normalized
                self.currentUser = response.user
                UserDefaults.standard.set(token, forKey: "auth_token")
                UserDefaults.standard.set(normalized, forKey: "cyphr_id")
                NotificationCenter.default.post(name: Notification.Name("UserLoggedIn"), object: nil, userInfo: ["cyphrId": normalized])
            }
            return AuthResult(
                success: true,
                message: "Welcome back @\(normalized)",
                cyphrId: normalized,
                token: token
            )
        } else {
            let msg = response.error ?? response.message ?? "Authentication failed"
            throw NSError(domain: "CyphrAuth", code: 401, userInfo: [NSLocalizedDescriptionKey: msg])
        }
    }
    
    /// Register new Cyphr ID - creates cryptographic identity
    public func registerCyphrId(cyphrId: String) async throws -> AuthResult {
        let normalized = cyphrId.lowercased().replacingOccurrences(of: "@", with: "")
        print("🆔 Registering new Cyphr ID: @\(normalized)")
        
        // Check availability
        let available = try await network.checkCyphrIdAvailability(normalized)
        if !available.available {
            throw AuthError.cyphrIdTaken
        }
        
        // Generate cryptographic identity WITH PROVIDED cyphrId
        let identity = try await cyphrIdentity.generateIdentity(cyphrId: normalized)
        
        // Use consistent device info for signature and registration
        let deviceInfo = DeviceInfo.current
        
        // Register with backend (only public key + Cyphr ID)
        let response = try await network.registerCyphrIdentity(
            cyphrId: identity.cyphrId, // must match local storage
            publicKey: identity.publicKey,
            deviceInfo: deviceInfo
        )
        
        if response.success {
            let token = response.token ?? ""
            await MainActor.run {
                self.isAuthenticated = true
                self.currentCyphrId = identity.cyphrId
                self.currentUser = response.user
                UserDefaults.standard.set(identity.cyphrId, forKey: "cyphr_id")
                UserDefaults.standard.set(token, forKey: "auth_token")
                NotificationCenter.default.post(name: Notification.Name("UserLoggedIn"), object: nil, userInfo: ["cyphrId": identity.cyphrId])
            }
            return AuthResult(
                success: true,
                message: "Welcome to Cyphr @\(identity.cyphrId)",
                cyphrId: identity.cyphrId,
                token: token,
                recoveryPhrase: identity.recoveryPhrase
            )
        } else {
            throw AuthError.registrationFailed
        }
    }
    
    /// Recover identity from BIP39 phrase
    public func recoverFromPhrase(_ phrase: [String]) async throws -> AuthResult {
        print("🔑 Recovering identity from phrase...")
        
        // Recover identity
        let identity = try await cyphrIdentity.recoverFromPhrase(phrase)
        
        // Register recovered identity with backend
        let deviceInfo = DeviceInfo.current
        let response = try await network.registerCyphrIdentity(
            cyphrId: identity.cyphrId,
            publicKey: identity.publicKey,
            deviceInfo: deviceInfo
        )
        
        if response.success {
            let token = response.token ?? ""
            await MainActor.run {
                self.isAuthenticated = true
                self.currentCyphrId = identity.cyphrId
                self.currentUser = response.user
                UserDefaults.standard.set(identity.cyphrId, forKey: "cyphr_id")
                UserDefaults.standard.set(token, forKey: "auth_token")
                NotificationCenter.default.post(name: Notification.Name("UserLoggedIn"), object: nil, userInfo: ["cyphrId": identity.cyphrId])
            }
            
            return AuthResult(
                success: true,
                message: "Identity recovered: @\(identity.cyphrId)",
                cyphrId: identity.cyphrId,
                token: token
            )
        } else {
            throw AuthError.recoveryFailed
        }
    }
    
    /// Auto-login with stored identity: if local identity exists, perform server login to obtain token
    public func autoLoginIfPossible() async -> Bool {
        if let storedUsername = await cyphrIdentity.checkStoredIdentity() {
            do {
                let result = try await loginWithCyphrId(cyphrId: storedUsername)
                return result.success
            } catch {
                print("❌ Auto-login failed: \(error.localizedDescription)")
                return false
            }
        }
        return false
    }
    
    /// Logout - clear session only (identity stays in Secure Enclave)
    public func logout() {
        isAuthenticated = false
        currentUser = nil
        currentCyphrId = nil
        
        // Clear session tokens
        UserDefaults.standard.removeObject(forKey: "auth_token")
        // Keep cyphr_id for auto-login
    }
    
    /// Delete identity permanently (requires recovery phrase to restore)
    public func deleteIdentity() {
        cyphrIdentity.deleteIdentity()

        // Clear all stored data
        UserDefaults.standard.removeObject(forKey: "auth_token")
        UserDefaults.standard.removeObject(forKey: "cyphr_id")

        isAuthenticated = false
        currentUser = nil
        currentCyphrId = nil
    }
}

// MARK: - Supporting Types

public struct AuthResult {
    let success: Bool
    let message: String
    let cyphrId: String
    let token: String
    let recoveryPhrase: [String]?
    
    init(success: Bool, message: String, cyphrId: String, token: String, recoveryPhrase: [String]? = nil) {
        self.success = success
        self.message = message
        self.cyphrId = cyphrId
        self.token = token
        self.recoveryPhrase = recoveryPhrase
    }
}

public struct AuthSession {
    let cyphrId: String
    let timestamp: Date
    let expires: Date
}

public enum AuthError: LocalizedError {
    case userNotFound
    case cyphrIdTaken
    case authenticationFailed
    case registrationFailed
    case recoveryFailed
    case biometricAuthFailed
    case biometricNotAvailable
    case invalidRecoveryPhrase
    case deviceAlreadyRegistered
    case sessionExpired
    
    public var errorDescription: String? {
        switch self {
        case .userNotFound:
            return "Cyphr ID not found"
        case .cyphrIdTaken:
            return "This Cyphr ID is already taken"
        case .authenticationFailed:
            return "Authentication failed"
        case .registrationFailed:
            return "Registration failed"
        case .recoveryFailed:
            return "Failed to recover identity"
        case .biometricAuthFailed:
            return "Biometric authentication failed"
        case .biometricNotAvailable:
            return "Biometric authentication not available"
        case .invalidRecoveryPhrase:
            return "Invalid recovery phrase"
        case .deviceAlreadyRegistered:
            return "This device already has an identity"
        case .sessionExpired:
            return "Session expired. Please login again"
        }
    }
}
