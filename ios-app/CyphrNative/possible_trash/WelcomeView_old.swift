import SwiftUI

struct WelcomeView: View {
    @StateObject private var viewModel = WelcomeViewModel()
    @EnvironmentObject var authManager: AuthenticationManager
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
                
                // Subtle gradient overlay without rotation
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
                    // REAL Cyphr Logo with neon pulse
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
                
                // Main Content
                if viewModel.isCheckingCredentials {
                    // Loading state with style
                    VStack(spacing: 20) {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .purple))
                            .scaleEffect(1.5)
                        
                        Text("Checking for stored identity...")
                            .font(.subheadline)
                            .foregroundColor(.white.opacity(0.6))
                    }
                    .padding()
                    .background(.ultraThinMaterial)
                    .cornerRadius(20)
                    .padding(.horizontal, 40)
                    
                } else if viewModel.hasStoredIdentity {
                    // Auto-login card with glassmorphism
                    VStack(spacing: 25) {
                        Text("Welcome back")
                            .font(.title2.weight(.semibold))
                            .foregroundColor(.white)
                        
                        // Cyphr ID display
                        HStack {
                            Image(systemName: "at")
                                .foregroundColor(.purple)
                            Text(viewModel.storedCyphrId)
                                .font(.title3.weight(.bold))
                                .foregroundColor(.white)
                        }
                        .padding(.horizontal, 20)
                        .padding(.vertical, 10)
                        .background(.ultraThinMaterial)
                        .cornerRadius(30)
                        
                        // Face ID button
                        Button(action: {
                            Task {
                                do {
                                    guard let id = viewModel.storedCyphrId.nonEmpty else { return }
                                    let result = try await AuthenticationService.shared.loginWithCyphrId(cyphrId: id)
                                    print("✅ Login success: \(result.message)")
                                } catch {
                                    viewModel.errorMessage = error.localizedDescription
                                    viewModel.showError = true
                                }
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
                        
                        Button(action: {
                            viewModel.clearStoredIdentity()
                        }) {
                            Text("Use different identity")
                                .font(.subheadline)
                                .foregroundColor(.white.opacity(0.6))
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
                    
                } else {
                    // Create new identity card
                    VStack(spacing: 30) {
                        VStack(spacing: 15) {
                            Text("True Privacy. Zero Knowledge.")
                                .font(.title2.weight(.bold))
                                .foregroundColor(.white)
                                .multilineTextAlignment(.center)
                            
                            Text("One device. One identity.\nComplete sovereignty.")
                                .font(.subheadline)
                                .foregroundColor(.white.opacity(0.7))
                                .multilineTextAlignment(.center)
                                .lineSpacing(4)
                        }
                        
                        // Create Identity button with glow effect
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
                        
                        Text("No email. No phone. No passwords.")
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.5))
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
                
                Spacer()
                
                // Footer with icons (no emoji)
                HStack(spacing: 30) {
                    FeatureItem(icon: "lock.shield", text: "Post-Quantum")
                    FeatureItem(icon: "cpu", text: "Secure Enclave")
                    FeatureItem(icon: "key.fill", text: "Self-Sovereign")
                }
                .padding(.bottom, 40)
            }
        }
        .sheet(isPresented: $showSignUp) {
            CyphrIdSignUpView()
        }
        .alert("Error", isPresented: $viewModel.showError) {
            Button("OK") {
                viewModel.showError = false
            }
        } message: {
            Text(viewModel.errorMessage)
        }
        .onAppear {
            Task {
                await viewModel.checkStoredCredentials()
            }
        }
        .alert("Identity Cleared", isPresented: $viewModel.identityCleared) {
            Button("OK") { 
                viewModel.identityCleared = false
                // Refresh the view
                Task {
                    await viewModel.checkStoredCredentials()
                }
            }
        } message: {
            Text("Identity has been cleared. You can now create a new one.")
        }
    }
}

// Feature item component
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
    @Published var isCheckingCredentials = true
    @Published var hasStoredIdentity = false
    @Published var storedCyphrId = ""
    @Published var showError = false
    @Published var errorMessage = ""
    @Published var identityCleared = false
    
    private let cyphrIdentity = CyphrIdentity.shared
    
    @MainActor
    func checkStoredCredentials() async {
        isCheckingCredentials = true
        
        // Check for stored cyphr_id WITHOUT triggering Face ID
        if let cyphrId = await cyphrIdentity.checkStoredIdentity() {
            hasStoredIdentity = true
            storedCyphrId = cyphrId
            print("✅ Found stored identity: @\(cyphrId)")
        } else {
            // Fallback: check UserDefaults session (post-login persistence)
            if let udId = UserDefaults.standard.string(forKey: "cyphr_id"), !udId.isEmpty {
                hasStoredIdentity = true
                storedCyphrId = udId
                print("✅ Found stored identity in UserDefaults: @\(udId)")
            } else {
                hasStoredIdentity = false
                print("ℹ️ No stored identity found")
            }
        }
        
        isCheckingCredentials = false
    }
    
    func clearStoredIdentity() {
        hasStoredIdentity = false
        storedCyphrId = ""
    }
}

struct WelcomeView_Previews: PreviewProvider {
    static var previews: some View {
        WelcomeView()
    }
}

private extension String {
    var nonEmpty: String? { isEmpty ? nil : self }
}