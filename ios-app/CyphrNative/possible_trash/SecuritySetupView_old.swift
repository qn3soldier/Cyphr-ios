import SwiftUI
import Combine
import LocalAuthentication
import CryptoKit

struct SecuritySetupView: View {
    // Progress tracking
    let currentStep: Int
    let totalSteps: Int
    let onCompletion: () -> Void
    
    // PIN State
    @State private var pin: String = ""
    @State private var confirmPin: String = ""
    @State private var pinDigits: [String] = Array(repeating: "", count: 6)
    @State private var confirmPinDigits: [String] = Array(repeating: "", count: 6)
    @State private var pinStep: PINStep = .create
    @FocusState private var focusedField: Int?
    
    // Biometric State
    @State private var biometricEnabled: Bool = true
    @State private var biometricType: BiometricType = .none
    @State private var biometricAvailable: Bool = false
    
    // UI State
    @State private var showError: Bool = false
    @State private var errorMessage: String = ""
    @State private var isProcessing: Bool = false
    
    enum PINStep {
        case create
        case confirm
    }
    
    enum BiometricType {
        case none
        case faceID
        case touchID
        
        var displayName: String {
            switch self {
            case .faceID: return "Face ID"
            case .touchID: return "Touch ID"
            case .none: return "Biometric"
            }
        }
        
        var iconName: String {
            switch self {
            case .faceID: return "faceid"
            case .touchID: return "touchid"
            case .none: return "lock.shield"
            }
        }
    }
    
    var body: some View {
        ZStack {
            // Background gradient
            LinearGradient(
                gradient: Gradient(colors: [
                    Color(red: 0.1, green: 0.1, blue: 0.3),
                    Color(red: 0.2, green: 0.1, blue: 0.4)
                ]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()
            
            ScrollView {
                VStack(spacing: 30) {
                    // Progress Indicator
                    ProgressHeader(currentStep: currentStep, totalSteps: totalSteps)
                        .padding(.top, 20)
                    
                    // Header
                    VStack(spacing: 12) {
                        Image(systemName: "lock.shield.fill")
                            .font(.system(size: 60))
                            .foregroundColor(.white)
                        
                        Text("Secure Your Account")
                            .font(.largeTitle)
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                        
                        Text("Set up your security methods")
                            .font(.body)
                            .foregroundColor(.white.opacity(0.8))
                    }
                    .padding(.top, 20)
                    
                    // PIN Section
                    VStack(spacing: 20) {
                        // Section Header
                        HStack {
                            Image(systemName: "lock.circle.fill")
                                .foregroundColor(.purple)
                            Text("Create PIN")
                                .font(.headline)
                                .foregroundColor(.white)
                            Text("(Required)")
                                .font(.caption)
                                .foregroundColor(.orange)
                            Spacer()
                        }
                        .padding(.horizontal, 40)
                        
                        // PIN Description
                        Text(pinStep == .create 
                             ? "Create a 6-digit PIN as your primary security"
                             : "Confirm your PIN")
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.7))
                            .padding(.horizontal, 40)
                        
                        // PIN Input Fields
                        HStack(spacing: 12) {
                            ForEach(0..<6, id: \.self) { index in
                                PINDigitField(
                                    digit: pinStep == .create
                                        ? $pinDigits[index]
                                        : $confirmPinDigits[index],
                                    index: index,
                                    focusedField: $focusedField,
                                    onTextChange: { newValue in
                                        handleDigitInput(newValue, at: index)
                                    }
                                )
                            }
                        }
                        .padding(.horizontal, 40)
                        
                        // PIN Validation (only show for create step)
                        if pinStep == .create && pinDigits.contains(where: { !$0.isEmpty }) {
                            VStack(alignment: .leading, spacing: 6) {
                                ValidationRow(
                                    text: "6 digits required",
                                    isValid: pinDigits.allSatisfy { !$0.isEmpty }
                                )
                                ValidationRow(
                                    text: "Not sequential",
                                    isValid: !isSequential(pinDigits.joined())
                                )
                                ValidationRow(
                                    text: "Not repeated",
                                    isValid: !isRepeated(pinDigits.joined())
                                )
                                ValidationRow(
                                    text: "Not common",
                                    isValid: !isCommonPattern(pinDigits.joined())
                                )
                            }
                            .padding(.horizontal, 40)
                            .transition(.opacity)
                        }
                    }
                    .padding(.vertical, 20)
                    .background(
                        RoundedRectangle(cornerRadius: 16)
                            .fill(Color.white.opacity(0.05))
                    )
                    .padding(.horizontal, 20)
                    
                    // Biometric Section (only if available)
                    if biometricAvailable {
                        VStack(spacing: 20) {
                            // Section Header
                            HStack {
                                Image(systemName: biometricType.iconName)
                                    .foregroundColor(.purple)
                                Text("Enable \(biometricType.displayName)")
                                    .font(.headline)
                                    .foregroundColor(.white)
                                Text("(Recommended)")
                                    .font(.caption)
                                    .foregroundColor(.green)
                                Spacer()
                            }
                            .padding(.horizontal, 40)
                            
                            // Biometric Benefits
                            VStack(alignment: .leading, spacing: 8) {
                                BenefitRow(icon: "bolt.fill", text: "Faster login")
                                BenefitRow(icon: "lock.shield.fill", text: "Hardware security")
                                BenefitRow(icon: "hand.raised.fill", text: "More convenient")
                            }
                            .padding(.horizontal, 40)
                            
                            // Toggle Switch
                            Toggle(isOn: $biometricEnabled) {
                                Text("Use \(biometricType.displayName)")
                                    .foregroundColor(.white)
                            }
                            .toggleStyle(SwitchToggleStyle(tint: .purple))
                            .padding(.horizontal, 40)
                        }
                        .padding(.vertical, 20)
                        .background(
                            RoundedRectangle(cornerRadius: 16)
                                .fill(Color.white.opacity(0.05))
                        )
                        .padding(.horizontal, 20)
                    }
                    
                    Spacer(minLength: 50)
                    
                    // Continue Button
                    Button(action: handleContinue) {
                        HStack {
                            if isProcessing {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                    .scaleEffect(0.8)
                            } else {
                                Text(getButtonText())
                                    .fontWeight(.semibold)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .background(
                            RoundedRectangle(cornerRadius: 12)
                                .fill(canProceed() ? Color.purple : Color.gray.opacity(0.3))
                        )
                        .foregroundColor(.white)
                    }
                    .disabled(!canProceed() || isProcessing)
                    .padding(.horizontal, 40)
                    .padding(.bottom, 30)
                }
            }
            
            // Loading overlay
            if isProcessing {
                Color.black.opacity(0.4)
                    .ignoresSafeArea()
                    .allowsHitTesting(true)
            }
        }
        .alert("Security Setup Error", isPresented: $showError) {
            Button("OK") {
                if pinStep == .confirm {
                    // Reset confirmation digits on error
                    confirmPinDigits = Array(repeating: "", count: 6)
                    focusedField = 0
                }
            }
        } message: {
            Text(errorMessage)
        }
        .onAppear {
            checkBiometricAvailability()
            focusedField = 0
        }
    }
    
    // MARK: - Helper Methods
    
    private func getButtonText() -> String {
        if pinStep == .create {
            return "Next"
        } else {
            return "Complete Setup"
        }
    }
    
    private func canProceed() -> Bool {
        if pinStep == .create {
            let pin = pinDigits.joined()
            return pin.count == 6 &&
                   !isSequential(pin) &&
                   !isRepeated(pin) &&
                   !isCommonPattern(pin)
        } else {
            return confirmPinDigits.allSatisfy { !$0.isEmpty }
        }
    }
    
    private func handleDigitInput(_ newValue: String, at index: Int) {
        if pinStep == .create {
            if newValue.count <= 1 {
                pinDigits[index] = newValue
                if !newValue.isEmpty && index < 5 {
                    focusedField = index + 1
                }
            }
        } else {
            if newValue.count <= 1 {
                confirmPinDigits[index] = newValue
                if !newValue.isEmpty && index < 5 {
                    focusedField = index + 1
                }
            }
        }
    }
    
    private func handleContinue() {
        if pinStep == .create {
            // Validate PIN and move to confirmation
            let pin = pinDigits.joined()
            
            if isSequential(pin) {
                errorMessage = "PIN cannot be sequential numbers"
                showError = true
                return
            }
            
            if isRepeated(pin) {
                errorMessage = "PIN cannot be repeated digits"
                showError = true
                return
            }
            
            if isCommonPattern(pin) {
                errorMessage = "This PIN is too common. Please choose a more secure PIN"
                showError = true
                return
            }
            
            // Move to confirmation step
            withAnimation {
                pinStep = .confirm
                focusedField = 0
            }
            
        } else {
            // Confirm PIN matches and save
            let originalPin = pinDigits.joined()
            let confirmedPin = confirmPinDigits.joined()
            
            if originalPin != confirmedPin {
                errorMessage = "PINs don't match. Please try again"
                showError = true
                return
            }
            
            // Save both PIN and biometric settings
            Task {
                await saveSecuritySettings(pin: originalPin)
            }
        }
    }
    
    private func saveSecuritySettings(pin: String) async {
        isProcessing = true
        
        do {
            // 1. Store device-bound PIN
            try await storePINSecurely(pin)
            
            // 2. If biometric enabled, request permission and store preference
            if biometricEnabled && biometricAvailable {
                await setupBiometric()
            }
            
            // 3. Success - navigate to next screen
            await MainActor.run {
                isProcessing = false
                onCompletion()
            }
            
        } catch {
            await MainActor.run {
                isProcessing = false
                errorMessage = "Failed to save security settings. Please try again."
                showError = true
            }
        }
    }
    
    private func storePINSecurely(_ pin: String) async throws {
        // Generate salt and device fingerprint
        let salt = generateSalt()
        let deviceFingerprint = CyphrIdentity.shared.generateDeviceFingerprint()
        
        // Create device-bound PIN hash
        let hashedPIN = hashDeviceBoundPIN(
            pin: pin,
            salt: salt,
            deviceFingerprint: deviceFingerprint
        )
        
        // Create PIN metadata
        let pinMetadata = PINMetadata(
            hash: hashedPIN,
            salt: salt,
            deviceBound: true,
            deviceFingerprint: deviceFingerprint,
            createdAt: Date()
        )
        
        // Store in Keychain
        let encoder = JSONEncoder()
        let pinData = try encoder.encode(pinMetadata)
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: "cyphr_pin_data",
            kSecValueData as String: pinData,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        
        SecItemDelete(query as CFDictionary)
        let status = SecItemAdd(query as CFDictionary, nil)
        
        guard status == errSecSuccess else {
            throw SecurityError.storageFailed
        }
        
        print("✅ PIN stored with device binding")
    }
    
    private func setupBiometric() async {
        let context = LAContext()
        context.localizedReason = "Enable \(biometricType.displayName) for quick access"
        
        do {
            let success = try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: context.localizedReason
            )
            
            if success {
                // Store biometric preference
                let query: [String: Any] = [
                    kSecClass as String: kSecClassGenericPassword,
                    kSecAttrAccount as String: "cyphr_biometric_enabled",
                    kSecValueData as String: "1".data(using: .utf8)!,
                    kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
                ]
                
                SecItemDelete(query as CFDictionary)
                SecItemAdd(query as CFDictionary, nil)
                
                print("✅ Biometric authentication enabled")
            }
        } catch {
            // User cancelled or error - continue without biometric
            print("⚠️ Biometric setup skipped or failed")
        }
    }
    
    private func checkBiometricAvailability() {
        let context = LAContext()
        var error: NSError?
        
        if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) {
            biometricAvailable = true
            
            switch context.biometryType {
            case .faceID:
                biometricType = .faceID
            case .touchID:
                biometricType = .touchID
            default:
                biometricType = .none
            }
        } else {
            biometricAvailable = false
            biometricEnabled = false
        }
    }
    
    // MARK: - Validation Methods
    
    private func isSequential(_ pin: String) -> Bool {
        guard pin.count == 6 else { return false }
        
        let digits = pin.compactMap { Int(String($0)) }
        guard digits.count == 6 else { return false }
        
        var isAscending = true
        var isDescending = true
        
        for i in 1..<digits.count {
            if digits[i] != digits[i-1] + 1 {
                isAscending = false
            }
            if digits[i] != digits[i-1] - 1 {
                isDescending = false
            }
        }
        
        return isAscending || isDescending
    }
    
    private func isRepeated(_ pin: String) -> Bool {
        guard pin.count == 6 else { return false }
        return Set(pin).count == 1
    }
    
    private func isCommonPattern(_ pin: String) -> Bool {
        let commonPins = [
            "000000", "111111", "222222", "333333", "444444",
            "555555", "666666", "777777", "888888", "999999",
            "123123", "121212", "111222", "123321", "112233",
            "000001", "000002", "123456", "654321", "696969"
        ]
        return commonPins.contains(pin)
    }
    
    private func generateSalt() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return Data(bytes).base64EncodedString()
    }
    
    private func hashDeviceBoundPIN(pin: String, salt: String, deviceFingerprint: String) -> String {
        let combined = "\(salt).\(pin).\(deviceFingerprint).CYPHR_PIN_2025"
        let data = combined.data(using: .utf8)!
        let hash = SHA256.hash(data: data)
        return hash.compactMap { String(format: "%02x", $0) }.joined()
    }
    
    // MARK: - Supporting Types
    
    struct PINMetadata: Codable {
        let hash: String
        let salt: String
        let deviceBound: Bool
        let deviceFingerprint: String
        let createdAt: Date
    }
    
    enum SecurityError: Error {
        case storageFailed
    }
}

// MARK: - Supporting Views

struct ProgressHeader: View {
    let currentStep: Int
    let totalSteps: Int
    
    var body: some View {
        VStack(spacing: 8) {
            // Progress bar
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    // Background
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.white.opacity(0.2))
                        .frame(height: 8)
                    
                    // Progress
                    RoundedRectangle(cornerRadius: 4)
                        .fill(
                            LinearGradient(
                                gradient: Gradient(colors: [.purple, .blue]),
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: geometry.size.width * CGFloat(currentStep) / CGFloat(totalSteps), height: 8)
                        .animation(.easeInOut(duration: 0.3), value: currentStep)
                }
            }
            .frame(height: 8)
            
            // Step text
            Text("Step \(currentStep) of \(totalSteps)")
                .font(.caption)
                .foregroundColor(.white.opacity(0.8))
        }
        .padding(.horizontal, 40)
    }
}

struct BenefitRow: View {
    let icon: String
    let text: String
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundColor(.purple)
                .font(.system(size: 16))
                .frame(width: 20)
            
            Text(text)
                .font(.caption)
                .foregroundColor(.white.opacity(0.8))
            
            Spacer()
        }
    }
}

// Reuse PINDigitField from PINSetupView
struct PINDigitField: View {
    @Binding var digit: String
    let index: Int
    @FocusState.Binding var focusedField: Int?
    let onTextChange: (String) -> Void
    
    var body: some View {
        TextField("", text: $digit)
            .keyboardType(.numberPad)
            .multilineTextAlignment(.center)
            .frame(width: 45, height: 55)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.white.opacity(0.1))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(
                                focusedField == index ? Color.purple : Color.white.opacity(0.3),
                                lineWidth: 2
                            )
                    )
            )
            .foregroundColor(.white)
            .font(.title)
            .focused($focusedField, equals: index)
            .onReceive(Just(digit).dropFirst()) { newValue in
                onTextChange(newValue)
            }
            .onTapGesture {
                focusedField = index
            }
    }
}

struct ValidationRow: View {
    let text: String
    let isValid: Bool
    
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: isValid ? "checkmark.circle.fill" : "circle")
                .foregroundColor(isValid ? .green : .white.opacity(0.5))
                .font(.system(size: 14))
            
            Text(text)
                .font(.caption)
                .foregroundColor(isValid ? .white : .white.opacity(0.5))
        }
    }
}

// MARK: - Preview

struct SecuritySetupView_Previews: PreviewProvider {
    static var previews: some View {
        SecuritySetupView(
            currentStep: 2,
            totalSteps: 4,
            onCompletion: { print("Security setup completed") }
        )
    }
}
