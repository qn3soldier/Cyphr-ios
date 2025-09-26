import Foundation
import SwiftUI

/// SecuritySetupView - Unified PIN and Biometric setup
/// Used during Sign Up and Recovery flows
struct SecuritySetupView: View {
    let currentStep: Int
    let totalSteps: Int
    let onCompletion: () -> Void
    
    @State private var pinText = ""
    @State private var confirmPinText = ""
    @State private var enableBiometric = true
    @State private var currentPhase: SecurityPhase = .biometricChoice
    @State private var showError = false
    @State private var errorMessage = ""
    @State private var isSettingUp = false
    
    @FocusState private var isPinFocused: Bool
    @FocusState private var isConfirmPinFocused: Bool
    
    var body: some View {
        VStack(spacing: 30) {
            // Header
            VStack(spacing: 15) {
                Image(systemName: "lock.shield.fill")
                    .font(.system(size: 60))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.green, .blue],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                
                Text("Secure Your Identity")
                    .font(.title)
                    .fontWeight(.bold)
                    .foregroundColor(.white)
                
                Text("Set up protection for your Cyphr identity")
                    .font(.subheadline)
                    .foregroundColor(.white.opacity(0.7))
                    .multilineTextAlignment(.center)
            }
            
            // Progress
            VStack(spacing: 8) {
                Text("Step \(currentStep) of \(totalSteps)")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.7))
                
                ProgressView(value: Double(currentStep), total: Double(totalSteps))
                    .progressViewStyle(LinearProgressViewStyle(tint: .purple))
                    .frame(height: 4)
            }
            
            // Main content based on phase
            Group {
                switch currentPhase {
                case .biometricChoice:
                    biometricChoiceSection
                case .pinSetup:
                    pinSetupSection
                case .pinConfirm:
                    pinConfirmSection
                case .complete:
                    completeSection
                }
            }
            .transition(.asymmetric(
                insertion: .move(edge: .trailing).combined(with: .opacity),
                removal: .move(edge: .leading).combined(with: .opacity)
            ))
        }
        .padding()
        .loadingOverlay(
            isPresented: $isSettingUp,
            message: "Setting up security..."
        )
        .alert("Security Setup Error", isPresented: $showError) {
            Button("OK") { 
                showError = false
                errorMessage = ""
            }
        } message: {
            Text(errorMessage)
        }
    }
    
    // MARK: - Biometric Choice
    
    private var biometricChoiceSection: some View {
        VStack(spacing: 25) {
            VStack(spacing: 15) {
                Text("Enable Face ID / Touch ID?")
                    .font(.headline)
                    .foregroundColor(.white)
                
                Text("Recommended for maximum security and convenience")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.7))
                    .multilineTextAlignment(.center)
            }
            
            // Biometric toggle
            VStack(spacing: 15) {
                HStack {
                    Image(systemName: enableBiometric ? "faceid" : "faceid.slash")
                        .font(.title2)
                        .foregroundColor(enableBiometric ? .green : .gray)
                    
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Face ID / Touch ID")
                            .font(.callout)
                            .fontWeight(.semibold)
                            .foregroundColor(.white)
                        
                        Text("Hardware-backed authentication")
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.7))
                    }
                    
                    Spacer()
                    
                    Toggle("", isOn: $enableBiometric)
                        .toggleStyle(SwitchToggleStyle(tint: .purple))
                }
                .padding()
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.white.opacity(0.1))
                )
                
                if !enableBiometric {
                    Text("⚠️ PIN-only authentication is less secure")
                        .font(.caption)
                        .foregroundColor(.yellow)
                }
            }
            
            // Continue button
            Button(action: {
                withAnimation {
                    currentPhase = .pinSetup
                }
            }) {
                Text("Continue")
                    .font(.headline)
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
        }
    }
    
    // MARK: - PIN Setup
    
    private var pinSetupSection: some View {
        VStack(spacing: 25) {
            VStack(spacing: 15) {
                Text("Create 6-Digit PIN")
                    .font(.headline)
                    .foregroundColor(.white)
                
                Text(enableBiometric ? "Backup authentication when biometry fails" : "Primary authentication method")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.7))
                    .multilineTextAlignment(.center)
            }
            
            // PIN input
            VStack(spacing: 15) {
                HStack(spacing: 12) {
                    ForEach(0..<6, id: \.self) { index in
                        Circle()
                            .fill(index < pinText.count ? Color.purple : Color.white.opacity(0.3))
                            .frame(width: 20, height: 20)
                    }
                }
                
                SecureField("Enter PIN", text: $pinText)
                    .textFieldStyle(PlainTextFieldStyle())
                    .keyboardType(.numberPad)
                    .focused($isPinFocused)
                    .opacity(0) // Hide actual text field
                    .onChange(of: pinText) { _, newValue in
                        // Limit to 6 digits
                        if newValue.count > 6 {
                            pinText = String(newValue.prefix(6))
                        }
                        
                        // Auto-advance when 6 digits entered
                        if pinText.count == 6 {
                            withAnimation {
                                currentPhase = .pinConfirm
                            }
                        }
                    }
            }
            
            // PIN requirements
            VStack(spacing: 8) {
                Label("6 digits required", systemImage: "checkmark.circle")
                    .font(.caption)
                    .foregroundColor(pinText.count == 6 ? .green : .white.opacity(0.7))
                
                Label("No sequential numbers (123456)", systemImage: "checkmark.circle")
                    .font(.caption)
                    .foregroundColor(isValidPIN(pinText) ? .green : .white.opacity(0.7))
            }
        }
        .onAppear {
            isPinFocused = true
        }
    }
    
    // MARK: - PIN Confirm
    
    private var pinConfirmSection: some View {
        VStack(spacing: 25) {
            VStack(spacing: 15) {
                Text("Confirm Your PIN")
                    .font(.headline)
                    .foregroundColor(.white)
                
                Text("Enter the same 6-digit PIN again")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.7))
            }
            
            // PIN confirmation
            VStack(spacing: 15) {
                HStack(spacing: 12) {
                    ForEach(0..<6, id: \.self) { index in
                        Circle()
                            .fill(index < confirmPinText.count ? Color.purple : Color.white.opacity(0.3))
                            .frame(width: 20, height: 20)
                    }
                }
                
                SecureField("Confirm PIN", text: $confirmPinText)
                    .textFieldStyle(PlainTextFieldStyle())
                    .keyboardType(.numberPad)
                    .focused($isConfirmPinFocused)
                    .opacity(0)
                    .onChange(of: confirmPinText) { _, newValue in
                        if newValue.count > 6 {
                            confirmPinText = String(newValue.prefix(6))
                        }
                        
                        if confirmPinText.count == 6 {
                            Task {
                                await setupSecurity()
                            }
                        }
                    }
            }
            
            // Match status
            if confirmPinText.count > 0 {
                HStack(spacing: 8) {
                    Image(systemName: pinsMatch ? "checkmark.circle.fill" : "xmark.circle.fill")
                        .foregroundColor(pinsMatch ? .green : .red)
                    
                    Text(pinsMatch ? "PINs match" : "PINs don't match")
                        .font(.caption)
                        .foregroundColor(pinsMatch ? .green : .red)
                }
            }
            
            // Back button
            Button("Change PIN") {
                pinText = ""
                confirmPinText = ""
                withAnimation {
                    currentPhase = .pinSetup
                }
            }
            .font(.callout)
            .foregroundColor(.purple)
        }
        .onAppear {
            isConfirmPinFocused = true
        }
    }
    
    // MARK: - Complete
    
    private var completeSection: some View {
        VStack(spacing: 25) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 60))
                .foregroundColor(.green)
            
            Text("Security Configured")
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(.white)
            
            VStack(spacing: 12) {
                if enableBiometric {
                    Label("Face ID / Touch ID enabled", systemImage: "faceid")
                        .font(.callout)
                        .foregroundColor(.green)
                }
                
                Label("6-digit PIN configured", systemImage: "lock.fill")
                    .font(.callout)
                    .foregroundColor(.green)
            }
            
            Button(action: {
                onCompletion()
            }) {
                Text("Continue")
                    .font(.headline)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(
                        LinearGradient(
                            colors: [.green, .blue],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .cornerRadius(15)
            }
        }
    }
    
    // MARK: - Helper Properties
    
    private var pinsMatch: Bool {
        !confirmPinText.isEmpty && pinText == confirmPinText
    }
    
    // MARK: - Actions
    
    private func isValidPIN(_ pin: String) -> Bool {
        guard pin.count == 6 else { return false }
        
        // Check for sequential numbers
        let sequential = ["123456", "654321", "012345", "543210"]
        if sequential.contains(pin) {
            return false
        }
        
        // Check for repeated digits
        let repeated = ["111111", "222222", "333333", "444444", "555555", "666666", "777777", "888888", "999999", "000000"]
        if repeated.contains(pin) {
            return false
        }
        
        return true
    }
    
    @MainActor
    private func setupSecurity() async {
        guard pinsMatch else {
            errorMessage = "PINs don't match. Please try again."
            showError = true
            confirmPinText = ""
            return
        }
        
        guard isValidPIN(pinText) else {
            errorMessage = "PIN is not secure enough. Please choose a different PIN."
            showError = true
            pinText = ""
            confirmPinText = ""
            withAnimation {
                currentPhase = .pinSetup
            }
            return
        }
        
        isSettingUp = true
        
        do {
            // Store security settings
            try await SecurityManager.shared.setupSecurity(
                pin: pinText,
                enableBiometric: enableBiometric
            )
            
            print("✅ Security setup completed - PIN: ✓, Biometric: \(enableBiometric)")
            
            withAnimation {
                currentPhase = .complete
            }
            
        } catch {
            print("❌ Security setup failed: \(error)")
            errorMessage = "Failed to setup security. Please try again."
            showError = true
        }
        
        isSettingUp = false
    }
}

// MARK: - Security Manager

class SecurityManager {
    static let shared = SecurityManager()
    private let keychain = EnterpriseKeychainService.shared
    
    private init() {}
    
    func setupSecurity(pin: String, enableBiometric: Bool) async throws {
        // Generate PIN hash with salt
        let salt = UUID().uuidString
        let pinHash = pin + salt + "CYPHR_PIN_SALT_2025"
        let hashedPIN = pinHash.data(using: .utf8)!
        
        // Store PIN hash (no biometry required for PIN verification)
        try keychain.store(key: "cyphr_pin_hash", data: hashedPIN, requiresBiometry: false)
        try keychain.store(key: "cyphr_pin_salt", data: salt.data(using: .utf8)!, requiresBiometry: false)
        
        // Store biometric preference
        UserDefaults.standard.set(enableBiometric, forKey: "biometric_enabled")
        
        print("🔐 Security setup: PIN stored, Biometric: \(enableBiometric)")
    }
    
    func verifyPIN(_ pin: String) async throws -> Bool {
        let storedHashData = keychain.retrieveWithoutAuthentication(key: "cyphr_pin_hash") ?? Data()
        let storedSaltData = keychain.retrieveWithoutAuthentication(key: "cyphr_pin_salt") ?? Data()
        guard let storedSalt = String(data: storedSaltData, encoding: .utf8) else { return false }
        
        let inputHash = (pin + storedSalt + "CYPHR_PIN_SALT_2025").data(using: .utf8)!
        
        return storedHashData == inputHash
    }
}

// MARK: - Supporting Types

enum SecurityPhase: Int, CaseIterable {
    case biometricChoice = 0
    case pinSetup = 1
    case pinConfirm = 2
    case complete = 3
}
