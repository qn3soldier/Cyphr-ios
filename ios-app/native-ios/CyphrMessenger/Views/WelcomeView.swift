/**
 * WELCOME VIEW - EXACT COPY FROM WEB Welcome.jsx
 * Same Cyphr ID only authentication flow
 * Same auto-login logic
 * Same UI design with glassmorphism
 */

import SwiftUI
import LocalAuthentication

struct WelcomeView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    @EnvironmentObject var cryptoManager: PostQuantumCrypto
    
    @State private var error = ""
    @State private var isLoading = false
    @State private var isNewUser = true
    @State private var showCyphrPinModal = false
    @State private var showCyphrBiometryModal = false
    @State private var cyphrUserData: UserData?
    @State private var checkingCredentials = true
    
    var body: some View {
        ZStack {
            // Lightning theme background (exact from web)
            LinearGradient(
                colors: [
                    Color(red: 0.1, green: 0.1, blue: 0.18), // #1a1a2e
                    Color(red: 0.09, green: 0.13, blue: 0.24)  // #16213e
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
            
            // Glassmorphism card (exact from web)
            VStack(spacing: 24) {
                // Cyphr Logo
                Image(systemName: "shield.lefthalf.filled")
                    .font(.system(size: 60))
                    .foregroundColor(.purple)
                
                if checkingCredentials {
                    VStack {
                        ProgressView()
                            .scaleEffect(1.5)
                        Text("Checking for existing Cyphr Identity...")
                            .foregroundColor(.gray)
                            .padding(.top)
                    }
                } else {
                    VStack(spacing: 20) {
                        Text("Welcome to Cyphr")
                            .font(.largeTitle)
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                        
                        Text("Revolutionary post-quantum secure messenger")
                            .font(.subheadline)
                            .foregroundColor(.gray)
                            .multilineTextAlignment(.center)
                        
                        VStack(spacing: 16) {
                            // Create New Identity Button (same as web)
                            Button(action: {
                                isNewUser = true
                                createNewIdentity()
                            }) {
                                HStack {
                                    Image(systemName: "key.fill")
                                    Text("Create Cyphr Identity")
                                }
                                .foregroundColor(.white)
                                .padding()
                                .frame(maxWidth: .infinity)
                                .background(
                                    LinearGradient(
                                        colors: [.purple, .blue],
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                                .cornerRadius(12)
                            }
                            .disabled(isLoading)
                            
                            // Login to Existing Button (same as web)
                            Button(action: {
                                isNewUser = false
                                loginToExisting()
                            }) {
                                HStack {
                                    Image(systemName: "person.fill")
                                    Text("Login to Existing Identity")
                                }
                                .foregroundColor(.gray)
                                .padding()
                                .frame(maxWidth: .infinity)
                                .background(Color.black.opacity(0.3))
                                .cornerRadius(12)
                            }
                        }
                        
                        if !error.isEmpty {
                            Text(error)
                                .foregroundColor(.red)
                                .padding()
                                .background(Color.red.opacity(0.1))
                                .cornerRadius(8)
                        }
                    }
                }
            }
            .padding(32)
            .background(
                // Glassmorphism effect (exact from web)
                RoundedRectangle(cornerRadius: 24)
                    .fill(.ultraThinMaterial)
                    .overlay(
                        RoundedRectangle(cornerRadius: 24)
                            .stroke(Color.white.opacity(0.1), lineWidth: 1)
                    )
            )
            .padding(16)
        }
        .onAppear {
            checkForStoredCredentials()
        }
        .onChange(of: isNewUser) { _ in
            if !isNewUser {
                print("🔍 Auto-triggering Cyphr Identity login...")
                loginToExisting()
            }
        }
    }
    
    // EXACT same logic as web Welcome.jsx
    private func checkForStoredCredentials() {
        Task {
            checkingCredentials = true
            
            // Check for stored device credentials (same as web)
            let credentialResult = await cryptoManager.getStoredDeviceCredentials()
            
            if credentialResult.success, let cyphrId = credentialResult.cyphrId {
                print("✅ Found stored credentials for: \(cyphrId)")
                
                // Auto-login (same as web)
                await authManager.loginWithStoredCredentials(cyphrId: cyphrId)
            } else {
                print("ℹ️ No existing Cyphr Identity found")
            }
            
            checkingCredentials = false
        }
    }
    
    private func createNewIdentity() {
        // Navigate to CryptoSignUp (same flow as web)
        authManager.navigateToSignUp()
    }
    
    private func loginToExisting() {
        // Same logic as web
        Task {
            await authManager.attemptCyphrIdLogin()
        }
    }
}

struct UserData {
    let id: String
    let name: String
    let cyphrId: String
    let avatarUrl: String?
    let authMethod: String
}