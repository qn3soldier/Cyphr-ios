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
    
    /// Login with Cyphr ID - v5.0 with challenge-response
    public func loginWithCyphrId(cyphrId: String) async throws -> AuthResult {
        // Normalize once and use everywhere
        let normalized = cyphrId.lowercased().replacingOccurrences(of: "@", with: "")
        print("🆔 Logging in with Cyphr ID: @\(normalized)")

        // Verify existence (best-effort). Some deployments may not expose this route.
        do {
            let userInfo = try await network.lookupCyphrId(cyphrId: normalized)
            if !userInfo.exists {
                throw AuthenticationServiceError.userNotFound
            }
        } catch let netErr as NetworkError {
            // If the lookup route is missing or returns 404, continue to challenge flow
            if case .notFound = netErr {
                // Map to user-not-found only if challenge also fails
                print("ℹ️ lookupCyphrId 404 for @\(normalized) — proceeding to challenge")
            } else {
                print("ℹ️ lookupCyphrId error (ignored): \(netErr.localizedDescription)")
            }
        } catch {
            print("ℹ️ lookupCyphrId unexpected error (ignored): \(error.localizedDescription)")
        }

        // v5.0: Get challenge from server
        // Get server challenge; 404 here means user truly does not exist
        let challengeResponse: ChallengeResponse
        do {
            challengeResponse = try await network.getChallenge(for: normalized)
        } catch let netErr as NetworkError {
            if case .notFound = netErr {
                throw AuthenticationServiceError.userNotFound
            }
            throw netErr
        }
        let challenge = challengeResponse.challenge
        let challengeId = challengeResponse.challengeId

        #if os(iOS)
        // Reuse existing authenticated context to avoid double Face ID prompts
        let authContext: LAContext
        if let cached = BiometricAuthService.shared.currentAuthenticatedContext() {
            authContext = cached
        } else {
            do {
                authContext = try await cyphrIdentity.obtainAuthenticatedContext(
                    reason: "Authenticate to access your Cyphr identity"
                )
            } catch let error as BiometricAuthService.AuthError {
                switch error {
                case .notAvailable:
                    throw AuthenticationServiceError.biometricNotAvailable
                case .userCancelled:
                    throw AuthenticationServiceError.biometricAuthFailed
                case .notEnrolled, .lockout, .authenticationFailed:
                    throw AuthenticationServiceError.biometricAuthFailed
                }
            }
        }

        // v5.0: Sign challenge with Ed25519
        let authSignature = try await cyphrIdentity.signChallenge(
            challenge,
            context: authContext
        )

        // v5.0: Sign challenge with device key if available
        var deviceSignature: String?
        var deviceBindingPublicKey: String?
        if SecureEnclaveService.shared.hasDeviceBindingKey() {
            let deviceSigData = try SecureEnclaveService.shared.signChallengeWithDeviceKey(challenge)
            deviceSignature = deviceSigData.base64EncodedString()
            deviceBindingPublicKey = try SecureEnclaveService.shared.getDeviceBindingPublicKeyDERBase64()
        }
        #else
        let authSignature = try await cyphrIdentity.signChallenge(
            challenge,
            context: nil
        )
        var deviceSignature: String?
        var deviceBindingPublicKey: String?
        #endif

        // Pre‑check: if local device fingerprint drifted from what we stored at signup, re‑bind proactively
        if let storedFpData = EnterpriseKeychainService.shared.retrieveWithoutAuthentication(key: "cyphr_device_fingerprint"),
           let storedFp = String(data: storedFpData, encoding: .utf8) {
            if let currentFp = try? SecureEnclaveService.shared.getDeviceFingerprintHash(), currentFp != storedFp {
                // Local SE key changed (or different tag); re‑bind current device to this @id using recovery flow
                let newDeviceBindingPublicKey = try SecureEnclaveService.shared.getDeviceBindingPublicKeyDERBase64()
                let newDeviceFingerprintHash = currentFp

                let initResp = try await network.initiateRecovery(
                    cyphrId: normalized,
                    newDeviceBindingPublicKey: newDeviceBindingPublicKey,
                    newDeviceFingerprintHash: newDeviceFingerprintHash
                )
                if initResp.success, let recChal = initResp.recoveryChallenge, let recId = initResp.challengeId {
                    let recSig = try await cyphrIdentity.signChallenge(recChal, context: authContext)
                    let confirm = try await network.confirmRecovery(cyphrId: normalized, challengeId: recId, recoverySignature: recSig)
                    if confirm.success {
                        let token = confirm.token ?? ""
                        await MainActor.run {
                            self.isAuthenticated = true
                            self.currentCyphrId = normalized
                            self.currentUser = confirm.user
                            CyphrIdentity.shared.setCurrentCyphrId(normalized)
                            UserDefaults.standard.set(normalized, forKey: "cyphr_id")
                            UserDefaults.standard.set(true, forKey: "device_has_identity")
                            UserDefaults.standard.set(Date(), forKey: "auth_token_date")
                            AuthTokenStore.save(token)
                            NotificationCenter.default.post(name: Notification.Name("UserLoggedIn"), object: nil, userInfo: ["cyphrId": normalized, "token": token])
                        }
                        return AuthResult(success: true, message: "Re‑bound (local drift)", cyphrId: normalized, token: token)
                    }
                }
            }
        }

        // v5.0: Login with dual signatures
        var response: AuthResponse
        do {
            response = try await network.loginCyphrIdentity(
                cyphrId: normalized,
                authSignature: authSignature,
                challengeId: challengeId,
                deviceSignature: deviceSignature,
                deviceBindingPublicKey: deviceBindingPublicKey,
                challengePlain: challenge
            )
        } catch let netErr as NetworkError {
            // Fallback: some servers may expect signature over UTF-8 of the base64 string
            if case .unauthorized = netErr {
                #if os(iOS)
                // Sign raw UTF-8 of base64 string (fallback)
                let fallbackAuthSig = try await cyphrIdentity.signMessage(challenge, context: authContext)
                let fallbackDeviceSig: String?
                if SecureEnclaveService.shared.hasDeviceBindingKey() {
                    let sig = try SecureEnclaveService.shared.signChallengeWithDeviceKey(challenge)
                    fallbackDeviceSig = sig.base64EncodedString()
                } else {
                    fallbackDeviceSig = nil
                }
                response = try await network.loginCyphrIdentity(
                    cyphrId: normalized,
                    authSignature: fallbackAuthSig,
                    challengeId: challengeId,
                    deviceSignature: fallbackDeviceSig,
                    deviceBindingPublicKey: deviceBindingPublicKey,
                    challengePlain: challenge
                )
                #else
                throw netErr
                #endif
            } else if case .networkError(let message) = netErr, message.uppercased().contains("FINGERPRINT_MISMATCH") {
                // Auto re-bind using recovery flow
                let newDeviceBindingPublicKey = try SecureEnclaveService.shared.getDeviceBindingPublicKeyDERBase64()
                let newDeviceFingerprintHash = try SecureEnclaveService.shared.getDeviceFingerprintHash()

                let initResp = try await network.initiateRecovery(
                    cyphrId: normalized,
                    newDeviceBindingPublicKey: newDeviceBindingPublicKey,
                    newDeviceFingerprintHash: newDeviceFingerprintHash
                )
                guard initResp.success, let recChallenge = initResp.recoveryChallenge, let recId = initResp.challengeId else {
                    throw AuthenticationServiceError.recoveryFailed
                }
                #if os(iOS)
                let recSig = try await cyphrIdentity.signChallenge(recChallenge, context: authContext)
                #else
                let recSig = try await cyphrIdentity.signChallenge(recChallenge, context: nil)
                #endif
                let confirm = try await network.confirmRecovery(
                    cyphrId: normalized,
                    challengeId: recId,
                    recoverySignature: recSig
                )
                guard confirm.success else { throw AuthenticationServiceError.recoveryFailed }
                let token = confirm.token ?? ""
                await MainActor.run {
                    self.isAuthenticated = true
                    self.currentCyphrId = normalized
                    self.currentUser = confirm.user
                    CyphrIdentity.shared.setCurrentCyphrId(normalized)
                    UserDefaults.standard.set(normalized, forKey: "cyphr_id")
                    UserDefaults.standard.set(true, forKey: "device_has_identity")
                    UserDefaults.standard.set(Date(), forKey: "auth_token_date")
                    AuthTokenStore.save(token)
                    NotificationCenter.default.post(name: Notification.Name("UserLoggedIn"), object: nil, userInfo: ["cyphrId": normalized, "token": token])
                }
                return AuthResult(success: true, message: "Recovered and re‑bound", cyphrId: normalized, token: token)
            } else {
                throw netErr
            }
        }

        // Auto-rebind if server reports device fingerprint mismatch
        if !response.success {
            let msg = (response.error ?? response.message ?? "").uppercased()
            if msg.contains("FINGERPRINT_MISMATCH") {
                // Prepare new binding material
                let newDeviceBindingPublicKey = try SecureEnclaveService.shared.getDeviceBindingPublicKeyDERBase64()
                let newDeviceFingerprintHash = try SecureEnclaveService.shared.getDeviceFingerprintHash()

                // Initiate recovery to re-bind current device
                let initResp = try await network.initiateRecovery(
                    cyphrId: normalized,
                    newDeviceBindingPublicKey: newDeviceBindingPublicKey,
                    newDeviceFingerprintHash: newDeviceFingerprintHash
                )
                guard initResp.success, let recChallenge = initResp.recoveryChallenge, let recChallengeId = initResp.challengeId else {
                    throw AuthenticationServiceError.recoveryFailed
                }

                let recSignature: String
                #if os(iOS)
                recSignature = try await cyphrIdentity.signChallenge(recChallenge, context: authContext)
                #else
                recSignature = try await cyphrIdentity.signChallenge(recChallenge, context: nil)
                #endif

                let confirm = try await network.confirmRecovery(
                    cyphrId: normalized,
                    challengeId: recChallengeId,
                    recoverySignature: recSignature
                )

                if confirm.success {
                    let token = confirm.token ?? ""
                    await MainActor.run {
                        self.isAuthenticated = true
                        self.currentCyphrId = normalized
                        self.currentUser = confirm.user
                        CyphrIdentity.shared.setCurrentCyphrId(normalized)
                        UserDefaults.standard.set(normalized, forKey: "cyphr_id")
                        UserDefaults.standard.set(true, forKey: "device_has_identity")
                        UserDefaults.standard.set(Date(), forKey: "auth_token_date")
                        AuthTokenStore.save(token)
                        NotificationCenter.default.post(name: Notification.Name("UserLoggedIn"), object: nil, userInfo: ["cyphrId": normalized, "token": token])
                    }
                    return AuthResult(success: true, message: "Recovered and re-bound", cyphrId: normalized, token: token)
                } else {
                    throw AuthenticationServiceError.recoveryFailed
                }
            }
        }
        
        if response.success {
            let token = response.token ?? ""
            let responseUser = response.user
            await MainActor.run {
                self.isAuthenticated = true
                self.currentCyphrId = normalized
                self.currentUser = responseUser
                // Keep singleton identity in sync for UI bindings (ProfileView)
                CyphrIdentity.shared.setCurrentCyphrId(normalized)
                AuthTokenStore.save(token)
                UserDefaults.standard.set(normalized, forKey: "cyphr_id")
                UserDefaults.standard.set(true, forKey: "device_has_identity")
                UserDefaults.standard.set(Date(), forKey: "auth_token_date")
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
            throw AuthenticationServiceError.cyphrIdTaken
        }
        
        // Generate cryptographic identity WITH PROVIDED cyphrId
        let identity = try await cyphrIdentity.generateIdentity(cyphrId: normalized)

        // Ensure device-binding key exists (v5.0 requires SE P-256 binding)
        if !SecureEnclaveService.shared.hasDeviceBindingKey() {
            _ = try SecureEnclaveService.shared.generateDeviceBindingKey()
        }

        // Generate Kyber key material for messaging
        let kyberKeys = try cyphrIdentity.createNewKyberKeyPair()
        let deviceInfo = DeviceInfo.current
        // v5.0: use Secure Enclave binding public key (DER) and hash
        let deviceBindingPublicKey = try SecureEnclaveService.shared.getDeviceBindingPublicKeyDERBase64()
        let deviceFingerprintHash = try SecureEnclaveService.shared.getDeviceFingerprintHash()

        let signature: String
        #if os(iOS)
        let authContext = try await cyphrIdentity.obtainAuthenticatedContext(
            reason: "Confirm your Cyphr registration"
        )
        signature = try await cyphrIdentity.signRegistrationPayload(
            cyphrId: identity.cyphrId,
            publicKey: identity.publicKey,
            deviceFingerprint: deviceFingerprintHash,
            context: authContext
        )
        #else
        signature = try await cyphrIdentity.signRegistrationPayload(
            cyphrId: identity.cyphrId,
            publicKey: identity.publicKey,
            deviceFingerprint: deviceFingerprintHash,
            context: nil
        )
        #endif

        do {
            let response = try await network.registerCyphrIdentity(
                cyphrId: identity.cyphrId,
                publicKey: identity.publicKey,
                kyberPublicKey: kyberKeys.publicKey,
                deviceInfo: deviceInfo,
                deviceBindingPublicKey: deviceBindingPublicKey,
                deviceFingerprintHash: deviceFingerprintHash,
                securityLevel: "biometry",
                signature: signature
            )

            guard response.success else {
                cyphrIdentity.deleteIdentity()
                throw AuthenticationServiceError.registrationFailed
            }

            let token = response.token ?? ""

            await MainActor.run {
                self.isAuthenticated = true
                self.currentCyphrId = identity.cyphrId
                self.currentUser = response.user
                UserDefaults.standard.set(identity.cyphrId, forKey: "cyphr_id")
                UserDefaults.standard.set(true, forKey: "device_has_identity")
                UserDefaults.standard.set(Date(), forKey: "auth_token_date")
                AuthTokenStore.save(token)
                NotificationCenter.default.post(
                    name: Notification.Name("UserLoggedIn"),
                    object: nil,
                    userInfo: [
                        "cyphrId": identity.cyphrId,
                        "token": token
                    ]
                )
            }

            return AuthResult(
                success: true,
                message: "Welcome to Cyphr @\(identity.cyphrId)",
                cyphrId: identity.cyphrId,
                token: token,
                recoveryPhrase: identity.recoveryPhrase
            )
        } catch {
            cyphrIdentity.deleteIdentity()
            throw error
        }
    }
    
    /// v5.0: Recovery = re-binding (NOT creating new account)
    public func recoverIdentity(
        cyphrId: String,
        recoveryPhrase: [String]
    ) async throws -> AuthResult {
        print("🔄 Recovering identity: @\(cyphrId)")

        let normalized = cyphrId.lowercased().replacingOccurrences(of: "@", with: "")
        let cleanedWords = recoveryPhrase.map {
            $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        }

        // v5.0: Restore Ed25519 key from recovery phrase (Single-Key)
        _ = try await cyphrIdentity.recoverFromPhrase(cleanedWords)

        // v5.0: Prepare new device binding material
        let newDeviceBindingPublicKey = try SecureEnclaveService.shared.getDeviceBindingPublicKeyDERBase64()
        let newDeviceFingerprintHash = try SecureEnclaveService.shared.getDeviceFingerprintHash()

        // Initiate recovery (server returns recoveryChallenge + challengeId)
        let recoveryInit = try await network.initiateRecovery(
            cyphrId: normalized,
            newDeviceBindingPublicKey: newDeviceBindingPublicKey,
            newDeviceFingerprintHash: newDeviceFingerprintHash
        )

        guard recoveryInit.success,
              let recoveryChallenge = recoveryInit.recoveryChallenge,
              let challengeId = recoveryInit.challengeId else {
            throw AuthenticationServiceError.recoveryFailed
        }

        // Sign recovery challenge with Ed25519 (Single-Key Recovery)
        #if os(iOS)
        let authContext = try await cyphrIdentity.obtainAuthenticatedContext(reason: "Confirm identity recovery")
        let recoverySignature = try await cyphrIdentity.signChallenge(recoveryChallenge, context: authContext)
        #else
        let recoverySignature = try await cyphrIdentity.signChallenge(recoveryChallenge, context: nil)
        #endif

        // Confirm recovery (re-bind)
        let response = try await network.confirmRecovery(
            cyphrId: normalized,
            challengeId: challengeId,
            recoverySignature: recoverySignature
        )

        guard response.success else {
            throw AuthenticationServiceError.recoveryFailed
        }

        let token = response.token ?? ""

        await MainActor.run {
            self.isAuthenticated = true
            self.currentCyphrId = normalized
            self.currentUser = response.user
            // Sync shared identity for UI
            CyphrIdentity.shared.setCurrentCyphrId(normalized)
            UserDefaults.standard.set(normalized, forKey: "cyphr_id")
            UserDefaults.standard.set(true, forKey: "device_has_identity")
            UserDefaults.standard.set(Date(), forKey: "auth_token_date")
            AuthTokenStore.save(token)
            NotificationCenter.default.post(
                name: Notification.Name("UserLoggedIn"),
                object: nil,
                userInfo: [
                    "cyphrId": normalized,
                    "token": token
                ]
            )
        }

        return AuthResult(
            success: true,
            message: "Identity recovered: @\(normalized)",
            cyphrId: normalized,
            token: token,
            recoveryPhrase: cleanedWords
        )
    }
    
    /// Auto-login with stored identity: if local identity exists, perform server login to obtain token
    public func autoLoginIfPossible() async -> Bool {
        if let username = (try? await cyphrIdentity.checkStoredIdentity()) ?? nil {
            do {
                let result = try await loginWithCyphrId(cyphrId: username)
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
        AuthTokenStore.clear()
        // Keep cyphr_id for auto-login
    }
    
    /// Delete identity permanently (requires recovery phrase to restore)
    public func deleteIdentity() {
        cyphrIdentity.deleteIdentity()

        // Clear all stored data
        AuthTokenStore.clear()
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

public enum AuthenticationServiceError: LocalizedError {
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
