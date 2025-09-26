import SwiftUI
import LocalAuthentication

/// Welcome screen - handles "One Device = One Cyphr ID" principle
/// Shows different options based on device state
struct WelcomeView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    @State private var showingSignUp = false
    @State private var showingSignIn = false
    @State private var isUnlockingIdentity = false
    @State private var errorMessage: String?
    @State private var showError = false
    @State private var attemptedAutoUnlock = false
    @State private var showPinUnlock = false
    @State private var pendingLoginCyphrId: String?
    
    var body: some View {
        ZStack {
            // Gradient background
            LinearGradient(
                colors: [
                    Color(red: 0.05, green: 0.06, blue: 0.10),
                    Color(red: 0.07, green: 0.08, blue: 0.12)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()
            
            VStack(spacing: 40) {
                // Header
                header
                
                // Network status banner
                NetworkBannerView()
                
                // Device identity status
                deviceStatusSection
                
                // Action buttons based on device state
                actionButtons
                
                // Footer
                footer
            }
            .padding(.horizontal, 30)
            .padding(.vertical, 40)
        }
        .sheet(isPresented: $showingSignUp) {
            CyphrIdSignUpView()
        }
        .sheet(isPresented: $showingSignIn) {
            CyphrIdLoginView()
        }
        .sheet(isPresented: $showPinUnlock) {
            PinUnlockView {
                guard let cyphrId = pendingLoginCyphrId else { return }
                Task {
                    do {
                        let result = try await AuthenticationService.shared.loginWithCyphrId(cyphrId: cyphrId)
                        if !result.success {
                            errorMessage = result.message
                            showError = true
                        }
                    } catch {
                        errorMessage = error.localizedDescription
                        showError = true
                    }
                }
            }
        }
        .alert("Authentication Error", isPresented: $showError) {
            Button("OK") { 
                showError = false
                errorMessage = nil
            }
        } message: {
            if let errorMessage = errorMessage {
                Text(errorMessage)
            }
        }
        .onAppear {
            // No auto-unlock needed - Face ID is now checked at app launch
            // If we reach WelcomeView, user either:
            // 1. Has no identity (new device)
            // 2. Face ID already failed/cancelled at launch
            // 3. Has identity but no valid session (needs manual unlock)
        }
    }
    
    // MARK: - Header
    
    private var header: some View {
        VStack(spacing: 20) {
            // Cyphr logo - using text + icon for now until asset is added
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [.purple, .blue, .cyan],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 100, height: 100)
                    .shadow(color: .purple.opacity(0.5), radius: 20)
                    .shadow(color: .blue.opacity(0.3), radius: 30)

                Text("C")
                    .font(.system(size: 60, weight: .bold, design: .rounded))
                    .foregroundColor(.white)
            }

            VStack(spacing: 8) {
                Text("Cyphr Messenger")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.white, .white.opacity(0.9)],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )

                Text("Post-Quantum Secure Messaging")
                    .font(.subheadline)
                    .foregroundColor(.white.opacity(0.7))
            }
        }
    }
    
    // MARK: - Device Status Section
    
    private var deviceStatusSection: some View {
        VStack(spacing: 15) {
            if authManager.hasDeviceIdentity {
                // Device has identity
                VStack(spacing: 12) {
                    Label("Device Identity Found", systemImage: "checkmark.shield.fill")
                        .font(.headline)
                        .foregroundColor(.green)
                    
                    if let cyphrId = authManager.deviceCyphrId {
                        Text("@\(cyphrId)")
                            .font(.title2)
                            .fontWeight(.semibold)
                            .foregroundColor(.purple)
                    }
                    
                    Text("This device is bound to your Cyphr identity")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.7))
                        .multilineTextAlignment(.center)
                }
                .padding()
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.green.opacity(0.1))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.green.opacity(0.3), lineWidth: 1)
                        )
                )
            } else {
                // New device
                VStack(spacing: 12) {
                    Label("New Device", systemImage: "iphone.badge.plus")
                        .font(.headline)
                        .foregroundColor(.blue)
                    
                    Text("This device doesn't have a Cyphr identity yet")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.7))
                        .multilineTextAlignment(.center)
                }
                .padding()
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.blue.opacity(0.1))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.blue.opacity(0.3), lineWidth: 1)
                        )
                )
            }
        }
    }
    
    // MARK: - Action Buttons
    
    private var actionButtons: some View {
        VStack(spacing: 20) {
            if authManager.hasDeviceIdentity {
                // Device has identity - show unlock button
                Button(action: {
                    Task {
                        await unlockDeviceIdentity()
                    }
                }) {
                    HStack(spacing: 12) {
                        if isUnlockingIdentity {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                .scaleEffect(0.9)
                        } else {
                            Image(systemName: "faceid")
                                .font(.title2)
                        }
                        
                        Text(isUnlockingIdentity ? "Unlocking..." : "Unlock with Face ID")
                            .font(.headline)
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(
                        LinearGradient(
                            colors: [.purple, .blue],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .cornerRadius(15)
                }
                .disabled(isUnlockingIdentity)
                
                // Alternative: Sign in with recovery phrase
                Button(action: {
                    showingSignIn = true
                }) {
                    HStack(spacing: 8) {
                        Image(systemName: "key.horizontal")
                        Text("Use Recovery Phrase")
                    }
                    .font(.callout)
                    .foregroundColor(.purple)
                    .padding(.vertical, 12)
                }
                
            } else {
                // New device - show options
                VStack(spacing: 15) {
                    // Create new identity
                    Button(action: {
                        showingSignUp = true
                    }) {
                        HStack(spacing: 12) {
                            Image(systemName: "person.crop.circle.badge.plus")
                                .font(.title2)
                            Text("Create Cyphr Identity")
                                .font(.headline)
                        }
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(
                            LinearGradient(
                                colors: [.purple, .blue],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .cornerRadius(15)
                    }
                    
                    // Restore existing identity
                    Button(action: {
                        showingSignIn = true
                    }) {
                        HStack(spacing: 8) {
                            Image(systemName: "key.horizontal")
                            Text("I Have Recovery Phrase")
                        }
                        .font(.callout)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(
                            RoundedRectangle(cornerRadius: 15)
                                .stroke(Color.white.opacity(0.3), lineWidth: 1)
                                .background(
                                    RoundedRectangle(cornerRadius: 15)
                                        .fill(Color.white.opacity(0.05))
                                )
                        )
                    }
                }
            }
        }
    }
    
    // MARK: - Footer
    
    private var footer: some View {
        VStack(spacing: 15) {
            // Features
            VStack(spacing: 8) {
                Label("Post-Quantum Encryption", systemImage: "shield.fill")
                Label("Zero-Knowledge Architecture", systemImage: "eye.slash.fill")
                Label("Hardware Security", systemImage: "cpu.fill")
            }
            .font(.caption)
            .foregroundColor(.white.opacity(0.6))
            
            Text("One Device = One Identity")
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundColor(.purple.opacity(0.8))
                .padding(.top, 10)
        }
    }
    
    // MARK: - Actions
    
    @MainActor
    private func unlockDeviceIdentity() async {
        guard let cyphrId = authManager.deviceCyphrId else {
            errorMessage = "No identity found on this device."
            showError = true
            return
        }

        isUnlockingIdentity = true
        defer { isUnlockingIdentity = false }

        do {
            // Since Face ID was already checked at app launch,
            // we just need to authenticate with the server
            let result = try await AuthenticationService.shared.loginWithCyphrId(cyphrId: cyphrId)
            if !result.success {
                errorMessage = result.message
                showError = true
            }
        } catch let authError as WelcomeAuthError {
            errorMessage = authError.localizedDescription
            showError = true
        } catch let authError as AuthenticationServiceError {
            // login handles auto-rebind for fingerprint mismatch internally.
            if case .userNotFound = authError {
                pendingLoginCyphrId = cyphrId
                showingSignIn = true
                return
            }
            errorMessage = authError.localizedDescription
            showError = true
        } catch let laError as LAError {
            switch laError.code {
            case .biometryNotAvailable:
                errorMessage = "Face ID/Touch ID is not available. Please use your recovery phrase."
            case .biometryNotEnrolled:
                errorMessage = "No biometric data enrolled. Please use your recovery phrase."
            case .userCancel:
                errorMessage = nil
            default:
                errorMessage = "Biometric authentication failed. Please use your recovery phrase."
            }
            if errorMessage != nil { showError = true }
        } catch {
            // Surface actual error for easier diagnostics
            errorMessage = error.localizedDescription
            showError = true
        }
    }
}

// MARK: - Auth Error Types

enum WelcomeAuthError: LocalizedError {
    case biometricAuthenticationFailed
    case noStoredIdentity
    case loginFailed(String)
    
    var errorDescription: String? {
        switch self {
        case .biometricAuthenticationFailed:
            return "Biometric authentication failed"
        case .noStoredIdentity:
            return "No identity found on this device"
        case .loginFailed(let message):
            return "Login failed: \(message)"
        }
    }
}

// MARK: - Preview

struct WelcomeView_Previews: PreviewProvider {
    static var previews: some View {
        WelcomeView()
            .environmentObject(AuthenticationManager())
    }
}
