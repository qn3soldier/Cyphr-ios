import SwiftUI
import Combine
#if os(iOS)
import UIKit
#endif

/// Pure Cyphr ID Sign Up - ZERO KNOWLEDGE, ZERO STORAGE
/// No email, no phone, no passwords - only cryptographic identity
struct CyphrIdSignUpView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = CyphrIdSignUpViewModel()
    @State private var selectedCyphrId = ""
    @State private var showingRecoveryPhrase = false
    @State private var hasBackedUpPhrase = false
    @State private var textFieldInput = ""
    @State private var isLoading = false
    @State private var loadingMessage = ""
    @FocusState private var isCyphrIdFocused: Bool
    
    var body: some View {
        ZStack {
            // Gradient background
            LinearGradient(
                colors: [
                    Color(red: 0.07, green: 0.08, blue: 0.12),
                    Color(red: 0.05, green: 0.06, blue: 0.10)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()
            
            ScrollView {
                VStack(spacing: 30) {
                    // Header
                    header
                    
                    // Step indicator
                    stepIndicator
                    
                    // Main content
                    Group {
                        if viewModel.currentStep == .chooseCyphrId {
                            cyphrIdSelectionView
                        } else if viewModel.currentStep == .securitySetup {
                            SecuritySetupView(
                                currentStep: 2,
                                totalSteps: 4,
                                onCompletion: {
                                    withAnimation {
                                        viewModel.currentStep = .backupPhrase
                                    }
                                }
                            )
                        } else if viewModel.currentStep == .backupPhrase {
                            recoveryPhraseView
                        } else if viewModel.currentStep == .complete {
                            completionView
                        }
                    }
                    .transition(.asymmetric(
                        insertion: .move(edge: .trailing).combined(with: .opacity),
                        removal: .move(edge: .leading).combined(with: .opacity)
                    ))
                }
                .padding()
            }
        }
        .loadingOverlay(
            isPresented: $isLoading,
            message: loadingMessage
        )
        .alert("Error", isPresented: $viewModel.showError) {
            Button("OK") { viewModel.showError = false }
        } message: {
            Text(viewModel.errorMessage)
        }
        .onAppear {
            // Test backend connectivity explicitly
            Task {
                print("🔍 Testing backend connectivity on view appear...")
                let isConnected = await NetworkService.shared.testConnectivity()
                if isConnected {
                    print("✅ Backend is reachable!")
                } else {
                    print("❌ Backend is NOT reachable!")
                    if let error = NetworkService.shared.connectionError {
                        print("   Error: \(error)")
                    }
                }
            }
            
            // Focus on Cyphr ID field
            isCyphrIdFocused = true
        }
    }
    
    // MARK: - Header
    
    private var header: some View {
        VStack(spacing: 15) {
            Image(systemName: "person.crop.circle.badge.plus")
                .font(.system(size: 60))
                .foregroundStyle(
                    LinearGradient(
                        colors: [.purple, .blue],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
            
            Text("Create Your Cyphr Identity")
                .font(.title)
                .fontWeight(.bold)
                .foregroundColor(.white)
            
            Text("One device. One identity. Complete sovereignty.")
                .font(.subheadline)
                .foregroundColor(.white.opacity(0.7))
                .multilineTextAlignment(.center)
        }
        .padding(.top, 20)
    }
    
    // MARK: - Step Indicator
    
    private var stepIndicator: some View {
        HStack(spacing: 20) {
            ForEach(SignUpStep.allCases, id: \.self) { step in
                VStack(spacing: 8) {
                    Circle()
                        .fill(viewModel.currentStep.rawValue >= step.rawValue ? 
                              Color.purple : Color.white.opacity(0.3))
                        .frame(width: 10, height: 10)
                    
                    Text(step.title)
                        .font(.caption)
                        .foregroundColor(viewModel.currentStep.rawValue >= step.rawValue ?
                                       .white : .white.opacity(0.5))
                }
            }
        }
        .padding(.vertical)
    }
    
    // MARK: - Cyphr ID Selection
    
    private var cyphrIdSelectionView: some View {
        VStack(spacing: 25) {
            VStack(spacing: 15) {
                Text("Choose Your Unique Cyphr ID")
                    .font(.headline)
                    .foregroundColor(.white)
                
                Text("This will be your permanent identity on Cyphr")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.7))
                
                // DEBUG: Direct API test button
                Button(action: {
                    print("🚨 DEBUG: Testing API directly!")
                    Task {
                        do {
                            print("🚨 Calling checkCyphrIdAvailability...")
                            let response = try await NetworkService.shared.checkCyphrIdAvailability("testuser123")
                            print("✅ API Response: available=\(response.available)")
                            viewModel.validationMessage = "✅ API WORKS! available=\(response.available)"
                        } catch {
                            print("❌ API Error: \(error)")
                            print("   Error type: \(type(of: error))")
                            print("   Description: \(error.localizedDescription)")
                            viewModel.validationMessage = "❌ API ERROR: \(error.localizedDescription)"
                        }
                    }
                }) {
                    Text("🚨 TEST API CONNECTION")
                        .foregroundColor(.white)
                        .padding(10)
                        .background(Color.red)
                        .cornerRadius(8)
                }
            }
            
            // Cyphr ID input
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("@")
                        .font(.title2)
                        .foregroundColor(.purple)
                    
                    TextField("yourname", text: $textFieldInput)
                        .textFieldStyle(PlainTextFieldStyle())
                        .font(.title2)
                        .foregroundColor(.white)
                        #if os(iOS)
                        .autocapitalization(.none)
                        #endif
                        .disableAutocorrection(true)
                        .focused($isCyphrIdFocused)
                        .onChange(of: textFieldInput) { newValue in
                            print("🟢 TextField changed to '\(newValue)'")
                            viewModel.validateCyphrId(newValue)
                        }
                        .onSubmit {
                            print("🟢 TextField submitted with: \(textFieldInput)")
                            viewModel.validateCyphrId(textFieldInput)
                        }
                    
                    // Availability indicator
                    if viewModel.isCheckingAvailability {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            .scaleEffect(0.8)
                    } else if !viewModel.cyphrIdInput.isEmpty {
                        Image(systemName: viewModel.isCyphrIdAvailable ? 
                              "checkmark.circle.fill" : "xmark.circle.fill")
                            .foregroundColor(viewModel.isCyphrIdAvailable ? .green : .red)
                    }
                }
                .padding()
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.white.opacity(0.1))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(isCyphrIdFocused ? Color.purple : 
                                       Color.white.opacity(0.2), lineWidth: 1)
                        )
                )
                
                // Validation message
                if let validation = viewModel.validationMessage {
                    Text(validation)
                        .font(.caption)
                        .foregroundColor(viewModel.isCyphrIdAvailable ? .green : .yellow)
                }
                
                // Debug button for manual check
                Button(action: {
                    print("🔴 Manual check button pressed for: \(textFieldInput)")
                    viewModel.validateCyphrId(textFieldInput)
                }) {
                    Text("Check Availability")
                        .font(.caption)
                        .foregroundColor(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Color.purple.opacity(0.7))
                        .cornerRadius(8)
                }
                .padding(.top, 5)
            }
            
            // Suggestions
            if !viewModel.suggestions.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Suggestions:")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.7))
                    
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 10) {
                            ForEach(viewModel.suggestions, id: \.self) { suggestion in
                                Button(action: {
                                    viewModel.cyphrIdInput = suggestion
                                    viewModel.validateCyphrId(suggestion)
                                }) {
                                    Text("@\(suggestion)")
                                        .font(.callout)
                                        .foregroundColor(.white)
                                        .padding(.horizontal, 15)
                                        .padding(.vertical, 8)
                                        .background(
                                            Capsule()
                                                .fill(Color.purple.opacity(0.3))
                                                .overlay(
                                                    Capsule()
                                                        .stroke(Color.purple, lineWidth: 1)
                                                )
                                        )
                                }
                            }
                        }
                    }
                }
            }
            
            // Continue button
            Button(action: {
                Task {
                    isLoading = true
                    loadingMessage = LoadingMessages.creatingIdentity
                    await viewModel.generateIdentity()
                    isLoading = false
                }
            }) {
                HStack {
                    if viewModel.isCheckingAvailability {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            .scaleEffect(0.8)
                        Text("Generating...")
                    } else {
                        Text("Generate Identity")
                        Image(systemName: "arrow.right")
                    }
                }
                .font(.headline)
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding()
                .background(
                    LinearGradient(
                        colors: viewModel.canProceed ? [.purple, .blue] : 
                               [Color.gray.opacity(0.5), Color.gray.opacity(0.3)],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .cornerRadius(15)
            }
            .disabled(!viewModel.canProceed || viewModel.isCheckingAvailability)
            
            // Zero-knowledge info
            VStack(spacing: 8) {
                Label("No email required", systemImage: "envelope.slash")
                Label("No phone required", systemImage: "phone.slash")
                Label("No password required", systemImage: "lock.slash")
            }
            .font(.caption)
            .foregroundColor(.white.opacity(0.5))
        }
        .onAppear {
            isCyphrIdFocused = true
        }
    }
    
    // MARK: - Recovery Phrase View
    
    private var recoveryPhraseView: some View {
        VStack(spacing: 25) {
            VStack(spacing: 15) {
                Image(systemName: "key.fill")
                    .font(.system(size: 50))
                    .foregroundColor(.yellow)
                
                Text("Your Recovery Phrase")
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundColor(.white)
                
                Text("Write down these 12 words in order. This is the ONLY way to recover your identity if you lose your device.")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.7))
                    .multilineTextAlignment(.center)
            }
            
            // Recovery phrase grid
            if let phrase = viewModel.recoveryPhrase {
                LazyVGrid(columns: [
                    GridItem(.flexible()),
                    GridItem(.flexible()),
                    GridItem(.flexible())
                ], spacing: 15) {
                    ForEach(Array(phrase.enumerated()), id: \.offset) { index, word in
                        HStack(spacing: 8) {
                            Text("\(index + 1).")
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.5))
                            
                            Text(word)
                                .font(.system(.callout, design: .monospaced))
                                .fontWeight(.semibold)
                                .foregroundColor(.white)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color.white.opacity(0.1))
                        )
                    }
                }
                .padding()
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.red.opacity(0.1))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.red.opacity(0.3), lineWidth: 1)
                        )
                )
            }
            
            // Copy button
            Button(action: {
                #if os(iOS)
                UIPasteboard.general.string = viewModel.recoveryPhrase?.joined(separator: " ")
                #else
                // macOS clipboard
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(viewModel.recoveryPhrase?.joined(separator: " ") ?? "", forType: .string)
                #endif
                viewModel.showCopiedConfirmation()
            }) {
                Label("Copy to Clipboard", systemImage: "doc.on.doc")
                    .font(.callout)
                    .foregroundColor(.white.opacity(0.7))
            }
            
            // Confirmation toggle
            Toggle(isOn: $hasBackedUpPhrase) {
                Text("I have written down my recovery phrase")
                    .font(.callout)
                    .foregroundColor(.white)
            }
            .toggleStyle(SwitchToggleStyle(tint: .purple))
            
            // Continue button
            Button(action: {
                Task {
                    await viewModel.completeSignUp()
                }
            }) {
                HStack {
                    Text("Complete Setup")
                    Image(systemName: "checkmark.circle")
                }
                .font(.headline)
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding()
                .background(
                    LinearGradient(
                        colors: hasBackedUpPhrase ? [.purple, .blue] : 
                               [Color.gray.opacity(0.5), Color.gray.opacity(0.3)],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .cornerRadius(15)
            }
            .disabled(!hasBackedUpPhrase)
        }
    }
    
    // MARK: - Completion View
    
    private var completionView: some View {
        VStack(spacing: 30) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 80))
                .foregroundColor(.green)
            
            Text("Welcome to Cyphr!")
                .font(.largeTitle)
                .fontWeight(.bold)
                .foregroundColor(.white)
            
            Text("@\(viewModel.finalCyphrId)")
                .font(.title)
                .fontWeight(.semibold)
                .foregroundColor(.purple)
            
            VStack(spacing: 15) {
                Label("Your identity is stored in iOS Secure Enclave", 
                      systemImage: "lock.shield.fill")
                Label("Only you control your private keys", 
                      systemImage: "key.fill")
                Label("Zero server knowledge of your data", 
                      systemImage: "eye.slash.fill")
            }
            .font(.callout)
            .foregroundColor(.white.opacity(0.8))
            
            Button(action: {
                // Navigate to main app
                dismiss()
            }) {
                Text("Start Messaging")
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
            .padding(.top)
        }
    }
}

// MARK: - View Model

class CyphrIdSignUpViewModel: ObservableObject {
    @Published var currentStep: SignUpStep = .chooseCyphrId
    @Published var cyphrIdInput = ""
    @Published var isCyphrIdAvailable = false
    @Published var isCheckingAvailability = false
    @Published var validationMessage: String?
    @Published var suggestions: [String] = []
    @Published var recoveryPhrase: [String]?
    @Published var finalCyphrId = ""
    @Published var showError = false
    @Published var errorMessage = ""
    
    private let cyphrIdentity = CyphrIdentity.shared
    private let networkService = NetworkService.shared
    private var checkTask: Task<Void, Never>?
    
    var canProceed: Bool {
        !cyphrIdInput.isEmpty && 
        cyphrIdInput.count >= 3 && 
        isCyphrIdAvailable
    }
    
    @MainActor
    func validateCyphrId(_ input: String) {
        print("🔵 validateCyphrId called with: \(input)")
        
        // Cancel previous check
        checkTask?.cancel()
        
        // Validate format
        let cleaned = input.lowercased().replacingOccurrences(of: "@", with: "")
        cyphrIdInput = cleaned
        print("🔵 Cleaned input: \(cleaned)")
        
        guard cleaned.count >= 3 else {
            validationMessage = "Minimum 3 characters"
            isCyphrIdAvailable = false
            return
        }
        
        guard cleaned.count <= 20 else {
            validationMessage = "Maximum 20 characters"
            isCyphrIdAvailable = false
            return
        }
        
        guard cleaned.range(of: "^[a-z0-9_]+$", options: .regularExpression) != nil else {
            validationMessage = "Only letters, numbers, and underscore"
            isCyphrIdAvailable = false
            return
        }
        
        // Check availability with debounce
        checkTask = Task {
            // Add 500ms delay to avoid too many requests
            try? await Task.sleep(nanoseconds: 500_000_000)
            
            // Check if task was cancelled during sleep
            if !Task.isCancelled {
                await checkAvailability(cleaned)
            }
        }
    }
    
    @MainActor
    private func checkAvailability(_ cyphrId: String) async {
        isCheckingAvailability = true
        
        do {
            let response = try await networkService.checkCyphrIdAvailability(cyphrId)
            
            if !Task.isCancelled {
                isCyphrIdAvailable = response.available
                
                if response.available {
                    validationMessage = "Available!"
                    suggestions = []
                } else {
                    validationMessage = "Already taken"
                    // Generate suggestions
                    suggestions = generateSuggestions(for: cyphrId)
                }
            }
        } catch {
            if !Task.isCancelled {
                print("❌ Error checking Cyphr ID availability: \(error)")
                print("   Error type: \(type(of: error))")
                print("   Error description: \(error.localizedDescription)")
                
                // Show user-friendly error message
                validationMessage = "Error checking availability"
                isCyphrIdAvailable = false
                
                // Log the detailed error for debugging
                if let networkError = error as? NetworkError {
                    print("   Network error details: \(networkError.errorDescription ?? "Unknown")")
                    validationMessage = networkError.errorDescription ?? "Network error"
                } else if let urlError = error as? URLError {
                    print("   URL error code: \(urlError.code)")
                    print("   URL error description: \(urlError.localizedDescription)")
                    validationMessage = "Connection failed"
                }
            }
        }
        
        isCheckingAvailability = false
    }
    
    private func generateSuggestions(for base: String) -> [String] {
        var suggestions: [String] = []
        
        // Add random numbers
        for _ in 0..<3 {
            let random = Int.random(in: 100...999)
            suggestions.append("\(base)\(random)")
        }
        
        // Add underscore variations
        suggestions.append("\(base)_\(Int.random(in: 10...99))")
        suggestions.append("_\(base)")
        
        return suggestions
    }
    
    @MainActor
    func generateIdentity() async {
        // Show loading state
        isCheckingAvailability = true
        
        do {
            // Generate cryptographic identity WITH chosen username
            let identity = try await cyphrIdentity.generateIdentity(cyphrId: cyphrIdInput)
            
            // Set the final Cyphr ID to what user chose
            finalCyphrId = cyphrIdInput
            
            // Store recovery phrase
            recoveryPhrase = identity.recoveryPhrase
            
            // Register with backend (only public key + Cyphr ID)
            // Get device info for registration
            #if os(iOS)
            let deviceId = UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString
            let deviceModel = UIDevice.current.model
            let osVersion = UIDevice.current.systemVersion
            #else
            let deviceId = UUID().uuidString
            let deviceModel = "macOS"
            let osVersion = ProcessInfo.processInfo.operatingSystemVersionString
            #endif
            let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"

            let deviceInfo = DeviceInfo(
                deviceId: deviceId,
                deviceModel: deviceModel,
                osVersion: osVersion,
                appVersion: appVersion
            )
            
            // Wrap backend registration in separate do-catch for better error handling
            do {
                let registered = try await networkService.registerCyphrIdentity(
                    cyphrId: cyphrIdInput,
                    publicKey: identity.publicKey,
                    deviceInfo: deviceInfo
                )
                
                if registered.success {
                    // Store JWT securely for auto-login
                    if let token = registered.token {
                        AuthTokenStore.save(token)
                    }

                    await MainActor.run {
                        AuthenticationService.shared.isAuthenticated = true
                        AuthenticationService.shared.currentCyphrId = cyphrIdInput
                    }

                    // Move to security setup step
                    withAnimation {
                        currentStep = .securitySetup
                    }

                    // Persist username for device binding
                    UserDefaults.standard.set(cyphrIdInput, forKey: "cyphr_id")
                    print("✅ Backend registration successful - proceeding to security setup")
                } else {
                    // Registration failed; show server message if provided
                    let serverMessage = registered.error ?? registered.message ?? "Registration failed. Please try another ID."
                    errorMessage = serverMessage
                    showError = true
                    print("❌ Registration returned success: false")
                }
            } catch let networkError as NetworkError {
                // Handle specific network errors
                errorMessage = networkError.errorDescription ?? "Network error occurred. Please check your connection."
                showError = true
                print("❌ Network error during registration: \(networkError)")
            } catch {
                // Handle general network/registration errors
                errorMessage = "Failed to register with server. Please try again."
                showError = true
                print("❌ Registration error: \(error)")
            }
        } catch {
            // Handle identity generation errors
            errorMessage = "Failed to generate secure identity. Please try again."
            showError = true
            print("❌ Identity generation error: \(error)")
        }
        
        // Hide loading state
        isCheckingAvailability = false
    }
    
    @MainActor
    func completeSignUp() async {
        // Identity is already stored in Secure Enclave and registered on server
        withAnimation {
            currentStep = .complete
        }
        
        // 🚀 КРИТИЧЕСКОЕ: Отправить notification для автологина
        // Это запустит автоматический переход в основное приложение
        let userInfo: [String: Any] = [
            "cyphrId": finalCyphrId,
            "token": AuthTokenStore.load() ?? ""
        ]

        NotificationCenter.default.post(
            name: Notification.Name("UserRegistered"),
            object: nil,
            userInfo: userInfo
        )

        NotificationCenter.default.post(
            name: Notification.Name("UserLoggedIn"),
            object: nil,
            userInfo: userInfo
        )

        print("🎉 Sign up completed for @\(finalCyphrId) - auto-login triggered")
    }
    
    func showCopiedConfirmation() {
        validationMessage = "Copied to clipboard!"
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            self.validationMessage = nil
        }
    }
}

// MARK: - Supporting Types

enum SignUpStep: Int, CaseIterable {
    case chooseCyphrId = 0
    case securitySetup = 1
    case backupPhrase = 2
    case complete = 3
    
    var title: String {
        switch self {
        case .chooseCyphrId: return "Identity"
        case .securitySetup: return "Security"
        case .backupPhrase: return "Backup"
        case .complete: return "Complete"
        }
    }
}

// MARK: - Preview

struct CyphrIdSignUpView_Previews: PreviewProvider {
    static var previews: some View {
        CyphrIdSignUpView()
    }
}
