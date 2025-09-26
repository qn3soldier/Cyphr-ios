import SwiftUI
import LocalAuthentication

/// Recovery/Login view for existing Cyphr identities
/// Handles recovery phrase input and device binding
struct CyphrIdLoginView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject var authManager: AuthenticationManager
    
    @State private var recoveryWords: [String] = Array(repeating: "", count: 12)
    @State private var newCyphrId = ""
    @State private var isValidating = false
    @State private var isRecovering = false
    @State private var currentStep: RecoveryStep = .enterPhrase
    @State private var showError = false
    @State private var errorMessage = ""
    @State private var showingSecuritySetup = false
    
    @FocusState private var focusedWordIndex: Int?
    
    private let cyphrIdentity = CyphrIdentity.shared
    private let networkService = NetworkService.shared
    
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
            
            ScrollView {
                VStack(spacing: 30) {
                    // Network banner
                    NetworkBannerView()

                    // Header
                    header
                    
                    // Step indicator
                    stepIndicator
                    
                    // Content based on current step
                    Group {
                        switch currentStep {
                        case .enterPhrase:
                            recoveryPhraseInput
                        case .chooseNewId:
                            newCyphrIdInput
                        case .securitySetup:
                            securitySetupSection
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
            isPresented: $isValidating,
            message: "Validating recovery phrase..."
        )
        .loadingOverlay(
            isPresented: $isRecovering,
            message: "Restoring your identity..."
        )
        .alert("Recovery Error", isPresented: $showError) {
            Button("OK") { 
                showError = false 
                errorMessage = ""
            }
        } message: {
            Text(errorMessage)
        }
        .sheet(isPresented: $showingSecuritySetup) {
            SecuritySetupView(
                currentStep: 1,
                totalSteps: 2,
                onCompletion: {
                    showingSecuritySetup = false
                    withAnimation {
                        currentStep = .complete
                    }
                }
            )
        }
        .onAppear {
            // Focus on first word field
            focusedWordIndex = 0
            if newCyphrId.isEmpty {
                let cached = CyphrIdentity.shared.cyphrId
                    ?? UserDefaults.standard.string(forKey: "cyphr_id")
                    ?? ""
                newCyphrId = cached
            }
        }
    }
    
    // MARK: - Header
    
    private var header: some View {
        VStack(spacing: 15) {
            Image(systemName: "key.horizontal.fill")
                .font(.system(size: 60))
                .foregroundStyle(
                    LinearGradient(
                        colors: [.blue, .purple],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
            
            VStack(spacing: 8) {
                Text("Restore Your Identity")
                    .font(.title)
                    .fontWeight(.bold)
                    .foregroundColor(.white)
                
                Text("Enter your 12-word recovery phrase to restore your Cyphr identity on this device")
                    .font(.subheadline)
                    .foregroundColor(.white.opacity(0.7))
                    .multilineTextAlignment(.center)
            }
        }
        .padding(.top, 20)
    }
    
    // MARK: - Step Indicator
    
    private var stepIndicator: some View {
        HStack(spacing: 20) {
            ForEach(Array(RecoveryStep.allCases.enumerated()), id: \.offset) { index, step in
                VStack(spacing: 8) {
                    Circle()
                        .fill(currentStep.rawValue >= step.rawValue ? 
                              Color.blue : Color.white.opacity(0.3))
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
    
    // MARK: - Recovery Phrase Input
    
    private var recoveryPhraseInput: some View {
        VStack(spacing: 25) {
            VStack(spacing: 15) {
                Text("Enter Recovery Phrase")
                    .font(.headline)
                    .foregroundColor(.white)
                
                Text("Type your 12-word recovery phrase in order")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.7))
            }
            
            // 12-word grid
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 15) {
                ForEach(0..<12, id: \.self) { index in
                    VStack(alignment: .leading, spacing: 4) {
                        Text("\(index + 1).")
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.5))
                        
                        TextField("word", text: $recoveryWords[index])
                            .textFieldStyle(PlainTextFieldStyle())
                            .font(.system(.callout, design: .monospaced))
                            .foregroundColor(.white)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 8)
                            .background(
                                RoundedRectangle(cornerRadius: 8)
                                    .fill(Color.white.opacity(0.1))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8)
                                            .stroke(focusedWordIndex == index ? Color.blue : 
                                                   Color.white.opacity(0.2), lineWidth: 1)
                                    )
                            )
                            .focused($focusedWordIndex, equals: index)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                            .onSubmit {
                                // Move to next field
                                if index < 11 {
                                    focusedWordIndex = index + 1
                                } else {
                                    // Last field - trigger validation
                                    focusedWordIndex = nil
                                    Task {
                                        await validateRecoveryPhrase()
                                    }
                                }
                            }
                            .onChange(of: recoveryWords[index]) { _, newValue in
                                // Auto-advance on space or valid word
                                let trimmed = newValue.trimmingCharacters(in: .whitespacesAndNewlines)
                                if trimmed.contains(" ") {
                                    // Split on space and distribute words
                                    let words = trimmed.components(separatedBy: .whitespaces)
                                        .filter { !$0.isEmpty }
                                    
                                    if words.count > 1 {
                                        distributeWords(words, startingAt: index)
                                    } else if words.count == 1 {
                                        recoveryWords[index] = words[0]
                                        if index < 11 {
                                            focusedWordIndex = index + 1
                                        }
                                    }
                                } else {
                                    recoveryWords[index] = trimmed.lowercased()
                                }
                            }
                    }
                }
            }
            
            // Paste from clipboard button
            Button(action: {
                pasteFromClipboard()
            }) {
                Label("Paste from Clipboard", systemImage: "doc.on.clipboard")
                    .font(.callout)
                    .foregroundColor(.blue)
            }
            
            // Validate button
            Button(action: {
                Task {
                    await validateRecoveryPhrase()
                }
            }) {
                HStack {
                    if isValidating {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            .scaleEffect(0.8)
                        Text("Validating...")
                    } else {
                        Text("Validate Recovery Phrase")
                        Image(systemName: "checkmark.shield")
                    }
                }
                .font(.headline)
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding()
                .background(
                    LinearGradient(
                        colors: canValidate ? [.blue, .purple] : 
                               [Color.gray.opacity(0.5), Color.gray.opacity(0.3)],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .cornerRadius(15)
            }
            .disabled(!canValidate || isValidating)
        }
    }
    
    // MARK: - New Cyphr ID Input
    
    private var newCyphrIdInput: some View {
        VStack(spacing: 25) {
            VStack(spacing: 15) {
                Text("Enter Your Cyphr ID")
                    .font(.headline)
                    .foregroundColor(.white)
                
                Text("Enter the Cyphr ID you are recovering. Recovery re-binds your existing @id to this device.")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.7))
                    .multilineTextAlignment(.center)
            }
            
            // New Cyphr ID input
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("@")
                        .font(.title2)
                        .foregroundColor(.blue)
                    
                    TextField("newusername", text: $newCyphrId)
                        .textFieldStyle(PlainTextFieldStyle())
                        .font(.title2)
                        .foregroundColor(.white)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                }
                .padding()
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.white.opacity(0.1))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.blue.opacity(0.5), lineWidth: 1)
                        )
                )
            }
            
            // Continue button
            Button(action: {
                Task {
                    await completeRecovery()
                }
            }) {
                HStack {
                    Text("Restore Identity")
                    Image(systemName: "person.crop.circle.badge.checkmark")
                }
                .font(.headline)
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding()
                .background(
                    LinearGradient(
                        colors: !newCyphrId.isEmpty ? [.blue, .purple] : 
                               [Color.gray.opacity(0.5), Color.gray.opacity(0.3)],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .cornerRadius(15)
            }
            .disabled(newCyphrId.isEmpty || isRecovering)
        }
    }
    
    // MARK: - Security Setup Section
    
    private var securitySetupSection: some View {
        VStack(spacing: 25) {
            VStack(spacing: 15) {
                Image(systemName: "lock.shield")
                    .font(.system(size: 50))
                    .foregroundColor(.green)
                
                Text("Identity Restored!")
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundColor(.white)
                
                Text("Now set up security for this device")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.7))
            }
            
            Button(action: {
                showingSecuritySetup = true
            }) {
                HStack {
                    Text("Set Up Security")
                    Image(systemName: "faceid")
                }
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
    
    // MARK: - Completion View
    
    private var completionView: some View {
        VStack(spacing: 30) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 80))
                .foregroundColor(.green)
            
            Text("Welcome Back!")
                .font(.largeTitle)
                .fontWeight(.bold)
                .foregroundColor(.white)
            
            Text("@\(newCyphrId)")
                .font(.title)
                .fontWeight(.semibold)
                .foregroundColor(.blue)
            
            VStack(spacing: 15) {
                Label("Identity restored on this device", 
                      systemImage: "checkmark.shield.fill")
                Label("Wallet addresses recovered", 
                      systemImage: "creditcard.fill")
                Label("Security settings configured", 
                      systemImage: "lock.fill")
            }
            .font(.callout)
            .foregroundColor(.white.opacity(0.8))
            
            Button(action: {
                // Complete recovery and navigate to main app
                completeRecoveryFlow()
            }) {
                Text("Start Messaging")
                    .font(.headline)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(
                        LinearGradient(
                            colors: [.blue, .purple],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .cornerRadius(15)
            }
            .padding(.top)
        }
    }
    
    // MARK: - Helper Properties
    
    private var canValidate: Bool {
        recoveryWords.allSatisfy { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    }
    
    // MARK: - Actions
    
    private func distributeWords(_ words: [String], startingAt index: Int) {
        for (offset, word) in words.enumerated() {
            let targetIndex = index + offset
            if targetIndex < 12 {
                recoveryWords[targetIndex] = word.lowercased()
            }
        }
        
        // Move focus to next empty field or last field
        let nextEmptyIndex = recoveryWords.firstIndex { $0.isEmpty }
        focusedWordIndex = nextEmptyIndex ?? 11
    }
    
    private func pasteFromClipboard() {
        #if os(iOS)
        if let clipboardString = UIPasteboard.general.string {
            let words = clipboardString.components(separatedBy: .whitespaces)
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }
                .filter { !$0.isEmpty }
            
            if words.count >= 12 {
                for i in 0..<min(12, words.count) {
                    recoveryWords[i] = words[i]
                }
            }
        }
        #endif
    }
    
    @MainActor
    private func validateRecoveryPhrase() async {
        isValidating = true
        
        do {
            // Clean and validate words
            let cleanedWords = recoveryWords.map { 
                $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            }
            
            // Validate phrase by attempting to reconstruct identity
            _ = try await cyphrIdentity.recoverFromPhrase(cleanedWords)
            
            print("✅ Recovery phrase validated successfully")
            
            // Move to next step
            withAnimation {
                currentStep = .chooseNewId
            }
            
        } catch {
            print("❌ Recovery phrase validation failed: \(error)")
            errorMessage = error.localizedDescription
            showError = true
        }
        
        isValidating = false
    }
    
    @MainActor
    private func completeRecovery() async {
        isRecovering = true
        
        do {
            // Store recovered identity with new Cyphr ID
            let cleanedWords = recoveryWords.map { 
                $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            }
            
            let result = try await AuthenticationService.shared.recoverIdentity(
                cyphrId: newCyphrId,
                recoveryPhrase: cleanedWords
            )

            print("✅ Recovery completed for @\(result.cyphrId)")
            newCyphrId = result.cyphrId

            // Move to security setup
            withAnimation {
                currentStep = .securitySetup
            }
            
        } catch {
            print("❌ Recovery completion failed: \(error)")
            errorMessage = error.localizedDescription
            showError = true
        }
        
        isRecovering = false
    }
    
    private func completeRecoveryFlow() {
        // Notify authentication manager of successful recovery
        NotificationCenter.default.post(
            name: Notification.Name("UserLoggedIn"),
            object: nil,
            userInfo: [
                "cyphrId": newCyphrId,
                "token": AuthTokenStore.load() ?? ""
            ]
        )
        
        // Dismiss view
        dismiss()
    }
}

// MARK: - Supporting Types

enum RecoveryStep: Int, CaseIterable {
    case enterPhrase = 0
    case chooseNewId = 1
    case securitySetup = 2
    case complete = 3
    
    var title: String {
        switch self {
        case .enterPhrase: return "Phrase"
        case .chooseNewId: return "Identity"
        case .securitySetup: return "Security"
        case .complete: return "Complete"
        }
    }
}

enum RecoveryError: LocalizedError {
    case registrationFailed(String)
    
    var errorDescription: String? {
        switch self {
        case .registrationFailed(let message):
            return "Registration failed: \(message)"
        }
    }
}

// MARK: - Preview

struct CyphrIdLoginView_Previews: PreviewProvider {
    static var previews: some View {
        CyphrIdLoginView()
            .environmentObject(AuthenticationManager())
    }
}
