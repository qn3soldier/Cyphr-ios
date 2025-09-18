import SwiftUI
import CryptoKit
#if os(iOS)
import UIKit
#endif

struct RecoveryPhraseView: View {
    // Progress tracking
    let currentStep: Int
    let totalSteps: Int
    let recoveryPhrase: [String]
    let onCompletion: () -> Void
    
    // View states
    @State private var viewMode: ViewMode = .display
    @State private var isRevealed: Bool = false
    @State private var hasWrittenDown: Bool = false
    @State private var testWordIndices: [Int] = []
    @State private var testAnswers: [String] = ["", "", ""]
    @State private var showError: Bool = false
    @State private var errorMessage: String = ""
    @State private var hasCopied: Bool = false
    @State private var screenshotDetected: Bool = false
    @FocusState private var focusedField: Int?
    
    enum ViewMode {
        case display
        case verify
        case complete
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
                        Image(systemName: viewMode == .complete ? "checkmark.shield.fill" : "key.fill")
                            .font(.system(size: 60))
                            .foregroundColor(viewMode == .complete ? .green : .white)
                            .scaleEffect(viewMode == .complete ? 1.1 : 1.0)
                            .animation(.spring(response: 0.3, dampingFraction: 0.6), value: viewMode)
                        
                        Text(getHeaderTitle())
                            .font(.largeTitle)
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                        
                        Text(getHeaderSubtitle())
                            .font(.body)
                            .foregroundColor(.white.opacity(0.8))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 40)
                    }
                    .padding(.top, 20)
                    
                    // Content based on mode
                    if viewMode == .display {
                        displayModeContent
                    } else if viewMode == .verify {
                        verifyModeContent
                    } else {
                        completeModeContent
                    }
                    
                    Spacer(minLength: 50)
                    
                    // Action Button
                    Button(action: handlePrimaryAction) {
                        Text(getButtonText())
                            .fontWeight(.semibold)
                            .frame(maxWidth: .infinity)
                            .frame(height: 50)
                            .background(
                                RoundedRectangle(cornerRadius: 12)
                                    .fill(canProceed() ? Color.purple : Color.gray.opacity(0.3))
                            )
                            .foregroundColor(.white)
                    }
                    .disabled(!canProceed())
                    .padding(.horizontal, 40)
                    .padding(.bottom, 30)
                }
            }
        }
        .alert("Recovery Phrase", isPresented: $showError) {
            Button("OK") { }
        } message: {
            Text(errorMessage)
        }
        .onAppear {
            setupTestIndices()
            detectScreenshotAttempts()
        }
    }
    
    // MARK: - Display Mode Content
    
    private var displayModeContent: some View {
        VStack(spacing: 30) {
            // Critical Warning
            VStack(spacing: 16) {
                HStack {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(.orange)
                        .font(.title2)
                    
                    Text("CRITICAL SECURITY WARNING")
                        .font(.headline)
                        .foregroundColor(.orange)
                    
                    Spacer()
                }
                
                VStack(alignment: .leading, spacing: 12) {
                    SecurityWarningRow(
                        icon: "doc.on.doc.fill",
                        text: "This is the ONLY way to recover your account",
                        color: .red
                    )
                    SecurityWarningRow(
                        icon: "iphone.slash",
                        text: "Lost phrase = Lost account forever",
                        color: .red
                    )
                    SecurityWarningRow(
                        icon: "eye.slash.fill",
                        text: "Never share with anyone",
                        color: .orange
                    )
                    SecurityWarningRow(
                        icon: "photo.fill.on.rectangle.fill",
                        text: "No screenshots - Write on paper",
                        color: .orange
                    )
                }
            }
            .padding(20)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.red.opacity(0.1))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color.red.opacity(0.3), lineWidth: 1)
                    )
            )
            .padding(.horizontal, 20)
            
            // Recovery Phrase Display
            VStack(spacing: 20) {
                HStack {
                    Text("Your Recovery Phrase")
                        .font(.headline)
                        .foregroundColor(.white)
                    
                    Spacer()
                    
                    if !isRevealed {
                        Button(action: { withAnimation { isRevealed = true } }) {
                            Label("Reveal", systemImage: "eye")
                                .font(.caption)
                                .foregroundColor(.purple)
                        }
                    }
                }
                .padding(.horizontal)
                
                // Words Grid
                ZStack {
                    if isRevealed {
                        LazyVGrid(columns: [
                            GridItem(.flexible()),
                            GridItem(.flexible()),
                            GridItem(.flexible())
                        ], spacing: 12) {
                            ForEach(Array(recoveryPhrase.enumerated()), id: \.offset) { index, word in
                                WordCell(
                                    number: index + 1,
                                    word: word,
                                    isRevealed: true
                                )
                            }
                        }
                    } else {
                        // Blurred placeholder
                        LazyVGrid(columns: [
                            GridItem(.flexible()),
                            GridItem(.flexible()),
                            GridItem(.flexible())
                        ], spacing: 12) {
                            ForEach(1...12, id: \.self) { index in
                                WordCell(
                                    number: index,
                                    word: "••••••",
                                    isRevealed: false
                                )
                            }
                        }
                        .blur(radius: 10)
                    }
                }
                .padding(.horizontal)
                
                // Copy Button (only if revealed)
                if isRevealed {
                    Button(action: copyToClipboard) {
                        HStack {
                            Image(systemName: hasCopied ? "checkmark" : "doc.on.doc")
                            Text(hasCopied ? "Copied!" : "Copy All")
                        }
                        .font(.caption)
                        .foregroundColor(.purple)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(
                            Capsule()
                                .fill(Color.purple.opacity(0.2))
                        )
                    }
                }
            }
            .padding(.vertical, 20)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.white.opacity(0.05))
            )
            .padding(.horizontal, 20)
            
            // Confirmation Checkbox
            if isRevealed {
                Button(action: { hasWrittenDown.toggle() }) {
                    HStack {
                        Image(systemName: hasWrittenDown ? "checkmark.square.fill" : "square")
                            .foregroundColor(hasWrittenDown ? .green : .white.opacity(0.5))
                        
                        Text("I have written down my recovery phrase in a safe place")
                            .font(.callout)
                            .foregroundColor(.white)
                            .multilineTextAlignment(.leading)
                        
                        Spacer()
                    }
                }
                .padding(.horizontal, 40)
            }
        }
    }
    
    // MARK: - Verify Mode Content
    
    private var verifyModeContent: some View {
        VStack(spacing: 30) {
            // Instructions
            VStack(spacing: 12) {
                Image(systemName: "checkmark.shield")
                    .font(.title)
                    .foregroundColor(.purple)
                
                Text("Let's verify you saved it correctly")
                    .font(.headline)
                    .foregroundColor(.white)
                
                Text("Please enter the following words from your recovery phrase")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.7))
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, 40)
            
            // Test Words Input
            VStack(spacing: 20) {
                ForEach(Array(testWordIndices.enumerated()), id: \.offset) { index, wordPosition in
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Word #\(wordPosition + 1)")
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.7))
                        
                        TextField("Enter word \(wordPosition + 1)", text: $testAnswers[index])
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .autocapitalization(.none)
                            .autocorrectionDisabled(true)
                            .focused($focusedField, equals: index)
                            .background(
                                RoundedRectangle(cornerRadius: 8)
                                    .fill(Color.white.opacity(0.1))
                            )
                    }
                }
            }
            .padding(.horizontal, 40)
            .padding(.vertical, 20)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.white.opacity(0.05))
            )
            .padding(.horizontal, 20)
            
            // Help Text
            Text("Can't remember? Go back and check again")
                .font(.caption)
                .foregroundColor(.white.opacity(0.5))
            
            Button(action: goBackToDisplay) {
                Text("Show phrase again")
                    .font(.caption)
                    .foregroundColor(.purple)
            }
        }
    }
    
    // MARK: - Complete Mode Content
    
    private var completeModeContent: some View {
        VStack(spacing: 30) {
            // Success Message
            VStack(spacing: 16) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 80))
                    .foregroundColor(.green)
                    .scaleEffect(1.1)
                    .animation(.spring(response: 0.3, dampingFraction: 0.6), value: true)
                
                Text("Perfect!")
                    .font(.title)
                    .fontWeight(.bold)
                    .foregroundColor(.white)
                
                Text("Your recovery phrase is securely saved")
                    .font(.body)
                    .foregroundColor(.white.opacity(0.8))
            }
            
            // Final Reminders
            VStack(alignment: .leading, spacing: 12) {
                ReminderRow(
                    icon: "lock.doc.fill",
                    text: "Keep your phrase in a secure location"
                )
                ReminderRow(
                    icon: "person.2.slash",
                    text: "Never share it with anyone"
                )
                ReminderRow(
                    icon: "arrow.triangle.2.circlepath",
                    text: "You'll need it to recover your account"
                )
            }
            .padding(20)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.green.opacity(0.1))
            )
            .padding(.horizontal, 20)
        }
    }
    
    // MARK: - Helper Methods
    
    private func getHeaderTitle() -> String {
        switch viewMode {
        case .display:
            return "Save Recovery Phrase"
        case .verify:
            return "Verify Your Phrase"
        case .complete:
            return "All Set!"
        }
    }
    
    private func getHeaderSubtitle() -> String {
        switch viewMode {
        case .display:
            return "Write down these 12 words in order. This is the ONLY way to recover your account."
        case .verify:
            return "Let's make sure you saved it correctly"
        case .complete:
            return "Your account is now fully secured"
        }
    }
    
    private func getButtonText() -> String {
        switch viewMode {
        case .display:
            return "I've Written It Down"
        case .verify:
            return "Verify"
        case .complete:
            return "Continue to App"
        }
    }
    
    private func canProceed() -> Bool {
        switch viewMode {
        case .display:
            return isRevealed && hasWrittenDown
        case .verify:
            return testAnswers.allSatisfy { !$0.isEmpty }
        case .complete:
            return true
        }
    }
    
    private func handlePrimaryAction() {
        switch viewMode {
        case .display:
            // Move to verification
            withAnimation {
                viewMode = .verify
                focusedField = 0
            }
            
        case .verify:
            // Check answers
            var allCorrect = true
            for (index, wordIndex) in testWordIndices.enumerated() {
                let correctWord = recoveryPhrase[wordIndex]
                let userAnswer = testAnswers[index].lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
                
                if correctWord.lowercased() != userAnswer {
                    allCorrect = false
                    break
                }
            }
            
            if allCorrect {
                withAnimation {
                    viewMode = .complete
                }
            } else {
                errorMessage = "Some words don't match. Please try again."
                showError = true
                // Clear answers for retry
                testAnswers = ["", "", ""]
                focusedField = 0
            }
            
        case .complete:
            // Complete setup
            onCompletion()
        }
    }
    
    private func setupTestIndices() {
        // Select 3 random word positions for testing
        let indices = Array(0..<12).shuffled().prefix(3).sorted()
        testWordIndices = Array(indices)
    }
    
    private func copyToClipboard() {
        #if os(iOS)
        UIPasteboard.general.string = recoveryPhrase.joined(separator: " ")
        
        withAnimation {
            hasCopied = true
        }
        
        // Reset after 2 seconds
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            withAnimation {
                hasCopied = false
            }
        }
        
        // Clear clipboard after 30 seconds for security
        DispatchQueue.main.asyncAfter(deadline: .now() + 30) {
            if UIPasteboard.general.string == recoveryPhrase.joined(separator: " ") {
                UIPasteboard.general.string = ""
            }
        }
        #endif
    }
    
    private func goBackToDisplay() {
        withAnimation {
            viewMode = .display
            testAnswers = ["", "", ""]
        }
    }
    
    private func detectScreenshotAttempts() {
        #if os(iOS)
        // Listen for screenshot notifications
        NotificationCenter.default.addObserver(
            forName: UIApplication.userDidTakeScreenshotNotification,
            object: nil,
            queue: .main
        ) { _ in
            screenshotDetected = true
            errorMessage = "⚠️ Screenshot detected! For security, please write your recovery phrase on paper instead of taking screenshots."
            showError = true
            
            // Blur the phrase if screenshot was taken
            if isRevealed {
                withAnimation {
                    isRevealed = false
                }
            }
        }

        NotificationCenter.default.addObserver(
            forName: UIScreen.capturedDidChangeNotification,
            object: nil,
            queue: .main
        ) { _ in
            guard UIScreen.main.isCaptured else { return }
            screenshotDetected = true
            errorMessage = "⚠️ Screen capture detected! For security, the recovery phrase is hidden until recording stops."
            showError = true

            if isRevealed {
                withAnimation {
                    isRevealed = false
                }
            }
        }
        #endif
    }
}

// MARK: - Supporting Views

struct WordCell: View {
    let number: Int
    let word: String
    let isRevealed: Bool
    
    var body: some View {
        HStack(spacing: 8) {
            Text("\(number).")
                .font(.caption)
                .foregroundColor(.white.opacity(0.5))
                .frame(width: 20, alignment: .trailing)
            
            Text(word)
                .font(.system(.callout, design: .monospaced))
                .fontWeight(.medium)
                .foregroundColor(.white)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.white.opacity(isRevealed ? 0.1 : 0.05))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.white.opacity(0.2), lineWidth: 1)
                )
        )
    }
}

struct SecurityWarningRow: View {
    let icon: String
    let text: String
    let color: Color
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundColor(color)
                .font(.system(size: 16))
                .frame(width: 20)
            
            Text(text)
                .font(.caption)
                .foregroundColor(.white)
                .multilineTextAlignment(.leading)
            
            Spacer()
        }
    }
}

struct ReminderRow: View {
    let icon: String
    let text: String
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundColor(.green)
                .font(.system(size: 18))
                .frame(width: 24)
            
            Text(text)
                .font(.callout)
                .foregroundColor(.white)
            
            Spacer()
        }
    }
}

// MARK: - Preview

struct RecoveryPhraseView_Previews: PreviewProvider {
    static let samplePhrase = [
        "absorb", "brother", "castle", "decade",
        "effort", "fabric", "gadget", "harbor",
        "impact", "jacket", "kernel", "lumber"
    ]
    
    static var previews: some View {
        RecoveryPhraseView(
            currentStep: 3,
            totalSteps: 4,
            recoveryPhrase: samplePhrase,
            onCompletion: { print("Recovery phrase saved") }
        )
    }
}
