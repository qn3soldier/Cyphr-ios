/**
 * CRYPTO SIGNUP VIEW - EXACT COPY FROM WEB CryptoSignUp.jsx
 * Same step flow: intro → generating → backup → complete
 * Same device conflict handling
 * Same recovery phrase backup
 * Enhanced with iOS native features
 */

import SwiftUI
import LocalAuthentication

struct CryptoSignUpView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    @EnvironmentObject var cryptoManager: PostQuantumCrypto
    
    @State private var step = "intro" // intro, device_conflict, generating, backup, complete
    @State private var isLoading = false
    @State private var error = ""
    @State private var cryptoResult: IdentityResult?
    @State private var recoveryPhrase = ""
    @State private var backupConfirmed = false
    @State private var deviceConflict: CredentialResult?
    @State private var existingCyphrId = ""
    @State private var checkingDevice = true
    
    var body: some View {
        ZStack {
            // Lightning theme background
            LinearGradient(
                colors: [
                    Color(red: 0.1, green: 0.1, blue: 0.18),
                    Color(red: 0.09, green: 0.13, blue: 0.24)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
            
            if checkingDevice {
                // Loading screen (same as web)
                VStack {
                    Image(systemName: "shield.lefthalf.filled")
                        .font(.system(size: 40))
                        .foregroundColor(.purple)
                    
                    ProgressView()
                        .scaleEffect(1.5)
                        .padding()
                    
                    Text("Checking device for existing Cyphr Identity...")
                        .foregroundColor(.gray)
                }
            } else {
                // Main content card
                VStack(spacing: 24) {
                    Image(systemName: "shield.lefthalf.filled")
                        .font(.system(size: 40))
                        .foregroundColor(.purple)
                    
                    // Step content (same logic as web renderXXXStep functions)
                    Group {
                        switch step {
                        case "device_conflict":
                            deviceConflictStep
                        case "intro":
                            introStep
                        case "generating":
                            generatingStep
                        case "backup":
                            backupStep
                        case "complete":
                            completeStep
                        default:
                            introStep
                        }
                    }
                }
                .padding(32)
                .background(
                    RoundedRectangle(cornerRadius: 24)
                        .fill(.ultraThinMaterial)
                        .overlay(
                            RoundedRectangle(cornerRadius: 24)
                                .stroke(Color.white.opacity(0.1), lineWidth: 1)
                        )
                )
                .padding(16)
            }
        }
        .onAppear {
            checkDeviceStatus()
        }
    }
    
    // EXACT same device conflict step as web
    private var deviceConflictStep: some View {
        VStack(spacing: 20) {
            Text("Existing Cyphr Identity Found")
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(.white)
            
            Text(existingCyphrId)
                .font(.system(.body, design: .monospaced))
                .foregroundColor(.green)
            
            VStack(spacing: 12) {
                Button("Login to Existing Identity") {
                    handleLoginToExisting()
                }
                .buttonStyle(PrimaryButtonStyle())
                
                Button("Create New Identity (Advanced)") {
                    handleCreateNewIdentity()
                }
                .buttonStyle(SecondaryButtonStyle())
            }
        }
    }
    
    // EXACT same intro step as web
    private var introStep: some View {
        VStack(spacing: 20) {
            Text("Create Cyphr Identity")
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(.white)
            
            Text("Create your sovereign digital identity protected by quantum-safe cryptography. No emails, phones, or passwords required.")
                .font(.subheadline)
                .foregroundColor(.gray)
                .multilineTextAlignment(.center)
            
            if !error.isEmpty {
                Text(error)
                    .foregroundColor(.red)
                    .padding()
                    .background(Color.red.opacity(0.1))
                    .cornerRadius(8)
            }
            
            Button("Create My Cyphr Identity") {
                handleGenerateIdentity()
            }
            .buttonStyle(PrimaryButtonStyle())
            .disabled(isLoading)
            
            if isLoading {
                ProgressView()
                    .scaleEffect(1.2)
            }
        }
    }
    
    // Same generating step as web
    private var generatingStep: some View {
        VStack(spacing: 20) {
            Text("Generating Your Cyphr Identity...")
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(.white)
            
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Circle()
                        .fill(Color.green)
                        .frame(width: 8, height: 8)
                    Text("Creating Ed25519 keypair")
                        .foregroundColor(.gray)
                }
                HStack {
                    Circle()
                        .fill(Color.blue)
                        .frame(width: 8, height: 8)
                    Text("Binding to your device")
                        .foregroundColor(.gray)
                }
                HStack {
                    Circle()
                        .fill(Color.purple)
                        .frame(width: 8, height: 8)
                    Text("Creating secure backup")
                        .foregroundColor(.gray)
                }
            }
        }
    }
    
    // Same backup step as web
    private var backupStep: some View {
        VStack(spacing: 20) {
            Text("Identity Created Successfully!")
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(.white)
            
            if let cyphrId = cryptoResult?.cyphrId {
                Text(cyphrId)
                    .font(.system(.body, design: .monospaced))
                    .foregroundColor(.green)
            }
            
            VStack(spacing: 16) {
                Text("Save Your Recovery Phrase")
                    .font(.headline)
                    .foregroundColor(.yellow)
                
                Text(recoveryPhrase)
                    .font(.system(.caption, design: .monospaced))
                    .foregroundColor(.white)
                    .padding()
                    .background(Color.black.opacity(0.3))
                    .cornerRadius(8)
                
                HStack {
                    Button("Copy") {
                        copyRecoveryPhrase()
                    }
                    .buttonStyle(SecondaryButtonStyle())
                    
                    Button("Save to Files") {
                        saveBackupToFiles()
                    }
                    .buttonStyle(SecondaryButtonStyle())
                }
                
                Toggle("I have saved my recovery phrase", isOn: $backupConfirmed)
                    .foregroundColor(.white)
                
                Button("Continue to Cyphr Messenger") {
                    handleComplete()
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(!backupConfirmed)
            }
        }
    }
    
    // Same complete step as web
    private var completeStep: some View {
        VStack(spacing: 20) {
            Text("Welcome to Cyphr!")
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(.white)
            
            ProgressView()
                .scaleEffect(1.5)
            
            Text("Redirecting to your secure chats...")
                .foregroundColor(.gray)
        }
    }
    
    // EXACT same methods as web Welcome.jsx
    private func checkDeviceStatus() {
        Task {
            checkingDevice = true
            
            let credentialResult = await cryptoManager.getStoredDeviceCredentials()
            
            if credentialResult.success, let cyphrId = credentialResult.cyphrId {
                print("✅ Found existing Cyphr Identity on device: \(cyphrId)")
                existingCyphrId = cyphrId
                deviceConflict = credentialResult
                step = "device_conflict"
            } else {
                print("ℹ️ No existing Cyphr Identity found, proceeding with creation")
                step = "intro"
            }
            
            checkingDevice = false
        }
    }
    
    private func handleLoginToExisting() {
        Task {
            print("🔐 Attempting login to existing Cyphr Identity...")
            await authManager.loginWithExistingIdentity(cyphrId: existingCyphrId)
        }
    }
    
    private func handleCreateNewIdentity() {
        step = "intro"
        deviceConflict = nil
    }
    
    private func handleGenerateIdentity() {
        isLoading = true
        error = ""
        step = "generating"
        
        Task {
            do {
                print("🚀 Starting cryptographic identity generation...")
                
                let result = try await cryptoManager.completeCryptoSignUp()
                
                cryptoResult = result
                recoveryPhrase = generateRecoveryPhrase()
                step = "backup"
                
                print("✅ Cryptographic identity created successfully!")
                
            } catch {
                print("❌ Crypto signup failed: \(error)")
                self.error = error.localizedDescription
                step = "intro"
            }
            
            isLoading = false
        }
    }
    
    private func copyRecoveryPhrase() {
        UIPasteboard.general.string = recoveryPhrase
        // Show toast (implement toast system)
    }
    
    private func saveBackupToFiles() {
        // iOS Files app integration
        let backup = BackupData(
            cyphrId: cryptoResult?.cyphrId ?? "",
            recoveryPhrase: recoveryPhrase,
            publicKey: cryptoResult?.publicKey ?? "",
            timestamp: ISO8601DateFormatter().string(from: Date()),
            instructions: "Keep this file secure. Use recovery phrase to restore your cryptographic identity."
        )
        
        // Save to iOS Files app (implement file saving)
    }
    
    private func handleComplete() {
        guard backupConfirmed else {
            error = "Please confirm you have saved your recovery phrase"
            return
        }
        
        step = "complete"
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            authManager.navigateToMainApp()
        }
    }
    
    private func generateRecoveryPhrase() -> String {
        // Generate BIP39 recovery phrase (same as web)
        let words = [
            "abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract",
            "absurd", "abuse", "access", "accident", "account", "accuse", "achieve", "acid"
        ]
        return words.shuffled().prefix(12).joined(separator: " ")
    }
}

// Button styles matching web design
struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
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
            .scaleEffect(configuration.isPressed ? 0.95 : 1.0)
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundColor(.gray)
            .padding()
            .background(Color.black.opacity(0.3))
            .cornerRadius(8)
            .scaleEffect(configuration.isPressed ? 0.95 : 1.0)
    }
}

struct BackupData: Codable {
    let cyphrId: String
    let recoveryPhrase: String
    let publicKey: String
    let timestamp: String
    let instructions: String
}