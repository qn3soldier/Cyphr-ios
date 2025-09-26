import SwiftUI
import Combine

/// Sign Up View - Enforces "One Device = One Cyphr ID" principle
struct CyphrIdSignUpView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject var authManager: AuthenticationManager
    @StateObject private var viewModel = SignUpViewModel()
    @State private var cyphrIdInput = ""
    @State private var currentStep: SignUpStep = .chooseCyphrId
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
                    // Network banner
                    NetworkBannerView()

                    // Header with device binding warning
                    header
                    
                    // Device check section
                    deviceCheckSection
                    
                    // Step indicator
                    stepIndicator
                    
                    // Main content
                    Group {
                        switch currentStep {
                        case .chooseCyphrId:
                            cyphrIdSelectionView
                        case .securitySetup:
                            SecuritySetupView(
                                currentStep: 2,
                                totalSteps: 4,
                                onCompletion: {
                                    withAnimation {
                                        currentStep = .backupPhrase
                                    }
                                }
                            )
                        case .backupPhrase:
                            recoveryPhraseView
                        case .complete:
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
        .task {
            // Check device identity on appear
            await viewModel.checkDeviceIdentity()
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
            
            Text("🎯 One Device = One Identity")
                .font(.headline)
                .fontWeight(.semibold)
                .foregroundColor(.purple)
            
            Text("This device will be permanently bound to your new identity")
                .font(.subheadline)
                .foregroundColor(.white.opacity(0.7))
                .multilineTextAlignment(.center)
        }
        .padding(.top, 20)
    }
    
    // MARK: - Device Check Section
    
    private var deviceCheckSection: some View {
        VStack(spacing: 15) {
            if viewModel.deviceHasIdentity {
                // Device already has identity
                VStack(spacing: 12) {
                    Label("Device Identity Violation", systemImage: "exclamationmark.triangle.fill")
                        .font(.headline)
                        .foregroundColor(.red)
                    
                    if let existingId = viewModel.existingCyphrId {
                        Text("@\(existingId)")
                            .font(.title2)
                            .fontWeight(.semibold)
                            .foregroundColor(.red)
                    }
                    
                    Text("This device already has a Cyphr identity. One device can only have one identity.")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.7))
                        .multilineTextAlignment(.center)
                    
                    Button("Use Existing Identity") {
                        // Navigate to unlock existing identity
                        dismiss()
                    }
                    .font(.callout)
                    .foregroundColor(.white)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 8)
                    .background(Color.red.opacity(0.8))
                    .cornerRadius(20)
                }
                .padding()
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.red.opacity(0.1))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.red.opacity(0.5), lineWidth: 2)
                        )
                )
            } else {
                // Device is clean - can create new identity
                VStack(spacing: 12) {
                    Label("Device Ready", systemImage: "checkmark.shield.fill")
                        .font(.headline)
                        .foregroundColor(.green)
                    
                    Text("This device can create a new Cyphr identity")
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
            }
        }
    }
    
    // MARK: - Step Indicator
    
    private var stepIndicator: some View {
        HStack(spacing: 20) {
            ForEach(SignUpStep.allCases, id: \.self) { step in
                VStack(spacing: 8) {
                    Circle()
                        .fill(currentStep.rawValue >= step.rawValue ? 
                              Color.purple : Color.white.opacity(0.3))
                        .frame(width: 10, height: 10)
                    
                    Text(step.title)
                        .font(.caption)
                        .foregroundColor(currentStep.rawValue >= step.rawValue ?
                                       .white : .white.opacity(0.5))
                }
            }
        }
        .padding(.vertical)
    }
    
    // MARK: - Cyphr ID Selection
    
    private var cyphrIdSelectionView: some View {
        VStack(spacing: 25) {
            if viewModel.deviceHasIdentity {
                // Block creation if device has identity
                VStack(spacing: 15) {
                    Text("Cannot Create New Identity")
                        .font(.headline)
                        .foregroundColor(.red)
                    
                    Text("This device is already bound to an identity. Please use the existing identity or reset your device.")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.7))
                        .multilineTextAlignment(.center)
                }
            } else {
                // Allow creation
                VStack(spacing: 15) {
                    Text("Choose Your Unique Cyphr ID")
                        .font(.headline)
                        .foregroundColor(.white)
                    
                    Text("This will be your permanent identity on Cyphr")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.7))
                }
                
                // Cyphr ID input
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Text("@")
                            .font(.title2)
                            .foregroundColor(.purple)
                        
                        TextField("yourname", text: $cyphrIdInput)
                            .textFieldStyle(PlainTextFieldStyle())
                            .font(.title2)
                            .foregroundColor(.white)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                            .focused($isCyphrIdFocused)
                            .onChange(of: cyphrIdInput) { _, newValue in
                                viewModel.validateCyphrId(newValue)
                            }
                        
                        // Availability indicator
                        if viewModel.isCheckingAvailability {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                .scaleEffect(0.8)
                        } else if !cyphrIdInput.isEmpty {
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
                }
                
                // Continue button
                Button(action: {
                    Task {
                        isLoading = true
                        loadingMessage = SignUpLoadingMessages.creatingIdentity
                        await viewModel.createIdentity(cyphrId: cyphrIdInput)
                        isLoading = false
                        
                        if viewModel.identityCreated {
                            withAnimation {
                                currentStep = .securitySetup
                            }
                        }
                    }
                }) {
                    HStack {
                        Text("Create Identity")
                        Image(systemName: "arrow.right")
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
                .disabled(!viewModel.canProceed || viewModel.isCheckingAvailability || isLoading)
            }
        }
        .onAppear {
            if !viewModel.deviceHasIdentity {
                isCyphrIdFocused = true
            }
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
                
                Text("Write down these 12 words in order. This is the ONLY way to recover your identity.")
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
            
            // Continue button
            Button(action: {
                Task {
                    await viewModel.completeRegistration()
                    withAnimation {
                        currentStep = .complete
                    }
                }
            }) {
                Text("I've Saved My Recovery Phrase")
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
            
            if let cyphrId = viewModel.finalCyphrId {
                Text("@\(cyphrId)")
                    .font(.title)
                    .fontWeight(.semibold)
                    .foregroundColor(.purple)
            }
            
            VStack(spacing: 15) {
                Label("Identity bound to this device", 
                      systemImage: "lock.shield.fill")
                Label("Keys secured in Secure Enclave", 
                      systemImage: "key.fill")
                Label("Zero server knowledge achieved", 
                      systemImage: "eye.slash.fill")
            }
            .font(.callout)
            .foregroundColor(.white.opacity(0.8))
            
            Button(action: {
                // Complete registration and auto-login
                completeRegistration()
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
    
    // MARK: - Actions
    
    private func completeRegistration() {
        // Send notification for auto-login
        if let cyphrId = viewModel.finalCyphrId {
            NotificationCenter.default.post(
                name: Notification.Name("UserRegistered"),
                object: nil,
                userInfo: [
                    "cyphrId": cyphrId,
                    "token": AuthTokenStore.load() ?? ""
                ]
            )
        }
        
        dismiss()
    }
}

// MARK: - View Model

class SignUpViewModel: ObservableObject {
    @Published var deviceHasIdentity = false
    @Published var existingCyphrId: String?
    @Published var isCyphrIdAvailable = false
    @Published var isCheckingAvailability = false
    @Published var validationMessage: String?
    @Published var identityCreated = false
    @Published var recoveryPhrase: [String]?
    @Published var finalCyphrId: String?
    @Published var showError = false
    @Published var errorMessage = ""
    
    private let cyphrIdentity = CyphrIdentity.shared
    private let networkService = NetworkService.shared
    private var checkTask: Task<Void, Never>?
    
    var canProceed: Bool {
        !deviceHasIdentity && isCyphrIdAvailable
    }
    
    @MainActor
    func checkDeviceIdentity() async {
        print("🔍 Checking device identity status...")
        
        do {
            existingCyphrId = try await cyphrIdentity.checkStoredIdentity()
            deviceHasIdentity = existingCyphrId != nil
            
            if let existing = existingCyphrId {
                print("⚠️ Device already has identity: @\(existing)")
            } else {
                print("✅ Device is clean - can create new identity")
            }
        } catch {
            print("❌ Error checking device identity: \(error)")
            deviceHasIdentity = false
        }
    }
    
    @MainActor
    func validateCyphrId(_ input: String) {
        print("🔵 Validating Cyphr ID: \(input)")
        
        // Cancel previous check
        checkTask?.cancel()
        
        let cleaned = input.lowercased().replacingOccurrences(of: "@", with: "")
        
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
            try? await Task.sleep(nanoseconds: 500_000_000)
            
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
                validationMessage = response.available ? "Available!" : "Already taken"
            }
        } catch {
            if !Task.isCancelled {
                print("❌ Error checking availability: \(error)")
                validationMessage = "Error checking availability"
                isCyphrIdAvailable = false
            }
        }
        
        isCheckingAvailability = false
    }
    
    @MainActor
    func createIdentity(cyphrId: String) async {
        print("🚀 Creating identity for @\(cyphrId) (Device bound)")
        
        do {
            // Double-check device doesn't have identity
            if let existing = try await cyphrIdentity.checkStoredIdentity() {
                errorMessage = "Device already has identity: @\(existing)"
                showError = true
                return
            }
            
            let result = try await AuthenticationService.shared.registerCyphrId(cyphrId: cyphrId)

            finalCyphrId = result.cyphrId
            recoveryPhrase = result.recoveryPhrase
            identityCreated = result.success
            print("✅ Identity created and registered: @\(result.cyphrId)")
        } catch {
            errorMessage = "Failed to create identity: \(error.localizedDescription)"
            showError = true
            identityCreated = false
            finalCyphrId = nil
            recoveryPhrase = nil
        }
    }
    
    @MainActor 
    func completeRegistration() async {
        print("🎉 Registration completed for @\(finalCyphrId ?? "unknown")")
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

struct SignUpLoadingMessages {
    static let creatingIdentity = "Creating your secure identity..."
    static let registeringWithServer = "Registering with server..."
    static let generatingKeys = "Generating cryptographic keys..."
}
