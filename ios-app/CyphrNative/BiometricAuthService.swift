import Foundation
#if os(iOS)
import LocalAuthentication
#endif

/// Centralised biometric authenticator to ensure consistent LAContext usage and
/// proper fallback handling throughout the app.
final class BiometricAuthService {

    static let shared = BiometricAuthService()

    #if os(iOS)
    private init() {}

    enum AuthResult {
        case success(context: LAContext)
    }

    enum AuthError: LocalizedError {
        case notAvailable
        case notEnrolled
        case lockout
        case userCancelled
        case authenticationFailed

        var errorDescription: String? {
            switch self {
            case .notAvailable:
                return "Biometric authentication is not available on this device"
            case .notEnrolled:
                return "No biometric identities are enrolled on this device"
            case .lockout:
                return "Biometric authentication is temporarily locked"
            case .userCancelled:
                return "Biometric authentication was cancelled"
            case .authenticationFailed:
                return "Failed to authenticate using biometrics"
            }
        }
    }

    /// Performs biometric authentication and returns an authenticated context that can
    /// be re-used for subsequent keychain operations. When `allowPINFallback` is true,
    /// the device owner authentication policy is used (Face ID/Touch ID → device PIN).
    @MainActor
    func authenticate(reason: String, allowPINFallback: Bool) async throws -> AuthResult {
        let context = LAContext()
        context.localizedFallbackTitle = allowPINFallback ? "Use Device Passcode" : ""
        context.touchIDAuthenticationAllowableReuseDuration = 0

        let policy: LAPolicy = allowPINFallback ? .deviceOwnerAuthentication : .deviceOwnerAuthenticationWithBiometrics

        var evaluationError: NSError?
        guard context.canEvaluatePolicy(policy, error: &evaluationError) else {
            if let error = evaluationError {
                let laError = LAError(_nsError: error)
                switch laError.code {
                case .biometryNotAvailable:
                    throw AuthError.notAvailable
                case .biometryNotEnrolled:
                    throw AuthError.notEnrolled
                case .biometryLockout:
                    throw AuthError.lockout
                default:
                    throw AuthError.authenticationFailed
                }
            }
            throw AuthError.notAvailable
        }

        do {
            let success = try await context.evaluatePolicy(policy, localizedReason: reason)
            guard success else { throw AuthError.authenticationFailed }
            return .success(context: context)
        } catch let error as LAError {
            switch error.code {
            case .userCancel, .appCancel, .systemCancel:
                throw AuthError.userCancelled
            case .biometryLockout:
                throw AuthError.lockout
            case .biometryNotAvailable:
                throw AuthError.notAvailable
            case .biometryNotEnrolled:
                throw AuthError.notEnrolled
            default:
                throw AuthError.authenticationFailed
            }
        } catch {
            throw AuthError.authenticationFailed
        }
    }
    #else
    private init() {}

    enum AuthResult {}

    enum AuthError: LocalizedError {
        case notSupported

        var errorDescription: String? { "Biometric authentication is not supported" }
    }

    @MainActor
    func authenticate(reason: String, allowPINFallback: Bool) async throws -> AuthResult {
        throw AuthError.notSupported
    }
    #endif
}
