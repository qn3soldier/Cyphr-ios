import SwiftUI

struct WelcomeView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    @StateObject private var viewModel = WelcomeViewModel()
    @State private var showSignUp = false
    @State private var glowAmount = 0.5
    
    var body: some View {
        ZStack {
            // Premium gradient background
            ZStack {
                LinearGradient(
                    colors: [
                        Color(red: 0.05, green: 0.05, blue: 0.15),
                        Color(red: 0.1, green: 0.05, blue: 0.2),
                        Color(red: 0.15, green: 0.1, blue: 0.25)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()
                
                // Subtle gradient overlay
                LinearGradient(
                    colors: [
                        Color.purple.opacity(0.15),
                        Color.blue.opacity(0.1),
                        Color.clear
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()
            }
            
            VStack(spacing: 0) {
                // Header Section
                VStack(spacing: 25) {
                    // Cyphr Logo with neon pulse
                    Image("CyphrLogo")
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(width: 110, height: 110)
                        .shadow(color: .cyan, radius: glowAmount * 25)
                        .shadow(color: .purple.opacity(0.8), radius: glowAmount * 35)
                        .shadow(color: .blue.opacity(0.6), radius: glowAmount * 45)
                        .onAppear {
                            withAnimation(.easeInOut(duration: 2).repeatForever(autoreverses: true)) {
                                glowAmount = 1.2
                            }
                        }
                    
                    // Title
                    VStack(spacing: 10) {
                        Text("Cyphr Messenger")
                            .font(.system(size: 34, weight: .bold, design: .rounded))
                            .foregroundStyle(
                                LinearGradient(
                                    colors: [.white, .white.opacity(0.9)],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                        
                        Text("Post-Quantum Secure Messaging")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundColor(.white.opacity(0.7))
                    }
                }
                .padding(.top, 80)
                
                Spacer()
                
                // Main Content - ONE DEVICE = ONE CYPHR ID LOGIC
                if authManager.hasDeviceIdentity {
                    // Device already has identity - show login options
                    existingIdentityView
                } else {
                    // New device - create first identity
                    newDeviceView
                }
                
                Spacer()
                
                // Footer with security features
                HStack(spacing: 30) {
                    FeatureItem(icon: "lock.shield", text: "Post-Quantum")
                    FeatureItem(icon: "cpu", text: "Secure Enclave")
                    FeatureItem(icon: "key.fill", text: "One Device")
                }
                .padding(.bottom, 40)
            }
        }
        .sheet(isPresented: $showSignUp) {
            CyphrIdSignUpView()
                .interactiveDismissDisabled() // Prevent accidental dismissal during setup
        }
        .alert("Error", isPresented: $viewModel.showError) {
            Button("OK") {
                viewModel.showError = false
            }
        } message: {
            Text(viewModel.errorMessage)
        }
        .onAppear {
            print("🏠 WelcomeView appeared")
            print("   Has device identity: \(authManager.hasDeviceIdentity)")
            print("   Device Cyphr ID: \(authManager.deviceCyphrId ?? "none")")
        }
    }
    
    // MARK: - Existing Identity View (Device already has Cyphr ID)
    
    private var existingIdentityView: some View {
        VStack(spacing: 25) {
            VStack(spacing: 15) {
                Text("Welcome back to Cyphr")
                    .font(.title2.weight(.semibold))
                    .foregroundColor(.white)
                
                // Show the device's Cyphr ID
                if let cyphrId = authManager.deviceCyphrId {
                    HStack(spacing: 8) {
                        Image(systemName: "at.circle.fill")
                            .foregroundColor(.purple)
                            .font(.title3)
                        Text(cyphrId)
                            .font(.title3.weight(.bold))
                            .foregroundColor(.white)
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 12)
                    .background(.ultraThinMaterial)
                    .cornerRadius(30)
                }
            }
            
            // Unlock with Face ID button
            Button(action: {
                Task {
                    await viewModel.unlockWithBiometric()
                }
            }) {
                HStack(spacing: 12) {
                    Image(systemName: "faceid")
                        .font(.title2)
                    Text("Unlock with Face ID")
                        .font(.headline)
                }
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(
                    LinearGradient(
                        colors: [
                            Color(red: 0.4, green: 0.0, blue: 1.0),
                            Color(red: 0.6, green: 0.2, blue: 1.0)
                        ],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .cornerRadius(15)
                .shadow(color: .purple.opacity(0.5), radius: 10, x: 0, y: 5)
            }
            .disabled(viewModel.isLoading)
            
            // Secondary actions
            VStack(spacing: 12) {
                Button(action: {
                    // TODO: Show recovery options
                    viewModel.showRecoveryOptions()
                }) {
                    Text("Can't unlock? Use recovery phrase")
                        .font(.callout)
                        .foregroundColor(.white.opacity(0.7))
                }
                
                Button(action: {
                    viewModel.showDeleteOptions = true
                }) {
                    Text("Remove identity from this device")
                        .font(.caption)
                        .foregroundColor(.red.opacity(0.8))
                }
            }
        }
        .padding(30)
        .background(.ultraThinMaterial)
        .cornerRadius(25)
        .overlay(
            RoundedRectangle(cornerRadius: 25)
                .strokeBorder(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.2),
                            Color.white.opacity(0.1)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1
                )
        )
        .padding(.horizontal, 30)
        .alert("Delete Identity", isPresented: $viewModel.showDeleteOptions) {
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                authManager.deleteDeviceIdentity()
            }
        } message: {
            Text("This will permanently remove your Cyphr identity from this device. You can only recover it with your 12-word recovery phrase.")
        }
        .loadingOverlay(isPresented: $viewModel.isLoading, message: "Authenticating...")
    }
    
    // MARK: - New Device View (No Cyphr ID on device)
    
    private var newDeviceView: some View {
        VStack(spacing: 30) {
            VStack(spacing: 15) {
                Text("One Device. One Identity.")
                    .font(.title2.weight(.bold))
                    .foregroundColor(.white)
                    .multilineTextAlignment(.center)
                
                Text("Create your unique Cyphr ID and bind it to this device forever.")
                    .font(.subheadline)
                    .foregroundColor(.white.opacity(0.7))
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)
            }
            
            // Create Identity button
            Button(action: {
                showSignUp = true
            }) {
                HStack(spacing: 12) {
                    Image(systemName: "person.badge.key.fill")
                        .font(.title3)
                    Text("Create Cyphr Identity")
                        .font(.headline)
                }
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 18)
                .background(
                    LinearGradient(
                        colors: [
                            Color(red: 0.4, green: 0.0, blue: 1.0),
                            Color(red: 0.6, green: 0.2, blue: 1.0)
                        ],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .cornerRadius(16)
                .shadow(color: .purple.opacity(0.6), radius: 15, x: 0, y: 8)
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .strokeBorder(
                            LinearGradient(
                                colors: [
                                    Color.white.opacity(0.3),
                                    Color.white.opacity(0.1)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 1
                        )
                )
            }
            
            // OR separator
            HStack {
                Rectangle()
                    .fill(Color.white.opacity(0.3))
                    .frame(height: 1)
                Text("OR")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.6))
                Rectangle()
                    .fill(Color.white.opacity(0.3))
                    .frame(height: 1)
            }
            
            // Recover identity button
            Button(action: {
                viewModel.showRecoveryOptions()
            }) {
                HStack(spacing: 12) {
                    Image(systemName: "key.horizontal")
                        .font(.title3)
                    Text("Recover with Phrase")
                        .font(.headline)
                }
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(Color.white.opacity(0.1))
                .cornerRadius(16)
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.white.opacity(0.3), lineWidth: 1)
                )
            }
            
            Text("No email. No phone. No servers can spy.")
                .font(.caption)
                .foregroundColor(.white.opacity(0.5))
                .multilineTextAlignment(.center)
        }
        .padding(35)
        .background(.ultraThinMaterial)
        .cornerRadius(25)
        .overlay(
            RoundedRectangle(cornerRadius: 25)
                .strokeBorder(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.2),
                            Color.white.opacity(0.1)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1
                )
        )
        .padding(.horizontal, 30)
    }
}

// MARK: - Feature Item Component
struct FeatureItem: View {
    let icon: String
    let text: String
    
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(
                    LinearGradient(
                        colors: [.purple, .blue],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
            Text(text)
                .font(.caption2)
                .foregroundColor(.white.opacity(0.6))
        }
    }
}

// MARK: - View Model
class WelcomeViewModel: ObservableObject {
    @Published var showError = false
    @Published var errorMessage = ""
    @Published var showDeleteOptions = false
    @Published var isLoading = false
    
    private let authService = AuthenticationService.shared
    
    @MainActor
    func unlockWithBiometric() async {
        isLoading = true
        defer { isLoading = false }
        
        guard let cyphrId = AuthenticationManager().deviceCyphrId else {
            errorMessage = "No identity found on this device"
            showError = true
            return
        }
        
        do {
            print("🔐 Attempting biometric unlock for @\(cyphrId)")
            let result = try await authService.loginWithCyphrId(cyphrId: cyphrId)
            if result.success {
                print("✅ Biometric unlock successful")
                // AuthenticationManager will handle the state update via notification
            } else {
                errorMessage = result.message
                showError = true
            }
        } catch {
            print("❌ Biometric unlock failed: \(error)")
            errorMessage = error.localizedDescription
            showError = true
        }
    }
    
    func showRecoveryOptions() {
        // TODO: Implement recovery phrase input modal
        errorMessage = "Recovery phrase option coming soon"
        showError = true
    }
}

struct WelcomeView_Previews: PreviewProvider {
    static var previews: some View {
        WelcomeView()
            .environmentObject(AuthenticationManager())
    }
}