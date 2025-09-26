import Foundation
#if os(iOS)
import LocalAuthentication
#endif

/// Centralised biometric authenticator to ensure consistent LAContext usage and
/// proper fallback handling throughout the app.
final class BiometricAuthService {

    static let shared = BiometricAuthService()

    #if os(iOS)
    private var sharedContext: LAContext?
    private var isAuthenticating = false
    private var pendingContinuations: [CheckedContinuation<AuthResult, Error>] = []

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
        if isAuthenticating {
            if let context = sharedContext {
                return .success(context: context)
            }

            return try await withCheckedThrowingContinuation { continuation in
                pendingContinuations.append(continuation)
            }
        }

        isAuthenticating = true
        defer { isAuthenticating = false }

        let context = LAContext()
        context.localizedFallbackTitle = allowPINFallback ? "Use Device Passcode" : ""
        context.touchIDAuthenticationAllowableReuseDuration = 0

        sharedContext = nil

        let policy: LAPolicy = allowPINFallback ? .deviceOwnerAuthentication : .deviceOwnerAuthenticationWithBiometrics

        var evaluationError: NSError?
        guard context.canEvaluatePolicy(policy, error: &evaluationError) else {
            if let error = evaluationError {
                let laError = LAError(_nsError: error)
                let mappedError: AuthError
                switch laError.code {
                case .biometryNotAvailable:
                    mappedError = .notAvailable
                case .biometryNotEnrolled:
                    mappedError = .notEnrolled
                case .biometryLockout:
                    mappedError = .lockout
                default:
                    mappedError = .authenticationFailed
                }
                context.invalidate()
                resumePending(with: .failure(mappedError))
                throw mappedError
            }
            context.invalidate()
            resumePending(with: .failure(AuthError.notAvailable))
            throw AuthError.notAvailable
        }

        do {
            let success = try await context.evaluatePolicy(policy, localizedReason: reason)
            guard success else {
                context.invalidate()
                resumePending(with: .failure(AuthError.authenticationFailed))
                throw AuthError.authenticationFailed
            }
            sharedContext = context
            let result: AuthResult = .success(context: context)
            resumePending(with: .success(result))
            return result
        } catch let error as LAError {
            context.invalidate()
            let mappedError: AuthError
            switch error.code {
            case .userCancel, .appCancel, .systemCancel:
                mappedError = .userCancelled
            case .biometryLockout:
                mappedError = .lockout
            case .biometryNotAvailable:
                mappedError = .notAvailable
            case .biometryNotEnrolled:
                mappedError = .notEnrolled
            default:
                mappedError = .authenticationFailed
            }
            resumePending(with: .failure(mappedError))
            throw mappedError
        } catch {
            context.invalidate()
            resumePending(with: .failure(AuthError.authenticationFailed))
            throw AuthError.authenticationFailed
        }
    }

    /// Provide the most recent authenticated context if available to avoid
    /// showing multiple Face ID prompts when several subsystems need access.
    func currentAuthenticatedContext() -> LAContext? {
        sharedContext
    }

    /// Invalidate and clear the cached context after sensitive flows finish.
    func invalidateCachedContext() {
        sharedContext?.invalidate()
        sharedContext = nil
    }

    private func resumePending(with result: Result<AuthResult, Error>) {
        guard !pendingContinuations.isEmpty else { return }
        let continuations = pendingContinuations
        pendingContinuations.removeAll()
        for continuation in continuations {
            switch result {
            case .success(let value):
                continuation.resume(returning: value)
            case .failure(let error):
                continuation.resume(throwing: error)
            }
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

    func currentAuthenticatedContext() -> LAContext? { nil }
    func invalidateCachedContext() {}
    #endif
}
