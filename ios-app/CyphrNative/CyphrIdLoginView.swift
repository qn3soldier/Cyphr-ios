import SwiftUI
import LocalAuthentication

/// Pure Cyphr ID Login - ZERO KNOWLEDGE authentication
/// Login with Cyphr ID + biometrics OR recovery phrase
struct CyphrIdLoginView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = CyphrIdLoginViewModel()
    @State private var loginMethod: LoginMethod = .cyphrId
    @State private var isLoading = false
    @State private var loadingMessage = ""
    @FocusState private var isInputFocused: Bool
    
    enum LoginMethod {
        case cyphrId
        case recoveryPhrase
    }
    
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
                    
                    // Login method selector
                    loginMethodSelector
                    
                    // Login form
                    Group {
                        if loginMethod == .cyphrId {
                            cyphrIdLoginView
                        } else {
                            recoveryPhraseLoginView
                        }
                    }
                    .transition(.asymmetric(
                        insertion: .move(edge: .trailing).combined(with: .opacity),
                        removal: .move(edge: .leading).combined(with: .opacity)
                    ))
                    
                    // Zero-knowledge info
                    zeroKnowledgeInfo
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
        .sheet(isPresented: $viewModel.showBiometricSetup) {
            BiometricSetupView(cyphrId: viewModel.cyphrIdInput)
        }
    }
    
    // MARK: - Header
    
    private var header: some View {
        VStack(spacing: 15) {
            Image(systemName: "person.crop.circle.badge.checkmark")
                .font(.system(size: 60))
                .foregroundStyle(
                    LinearGradient(
                        colors: [.purple, .blue],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
            
            Text("Welcome Back")
                .font(.title)
                .fontWeight(.bold)
                .foregroundColor(.white)
            
            Text("Login with your Cyphr Identity")
                .font(.subheadline)
                .foregroundColor(.white.opacity(0.7))
        }
        .padding(.top, 20)
    }
    
    // MARK: - Login Method Selector
    
    private var loginMethodSelector: some View {
        HStack(spacing: 0) {
            Button(action: {
                withAnimation(.spring()) {
                    loginMethod = .cyphrId
                    viewModel.clearInputs()
                }
            }) {
                VStack(spacing: 8) {
                    Image(systemName: "at")
                        .font(.title2)
                    Text("Cyphr ID")
                        .font(.caption)
                }
                .foregroundColor(loginMethod == .cyphrId ? .white : .white.opacity(0.5))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(
                    loginMethod == .cyphrId ?
                    AnyView(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.purple.opacity(0.3))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Color.purple, lineWidth: 1)
                            )
                    ) : AnyView(Color.clear)
                )
            }
            
            Button(action: {
                withAnimation(.spring()) {
                    loginMethod = .recoveryPhrase
                    viewModel.clearInputs()
                }
            }) {
                VStack(spacing: 8) {
                    Image(systemName: "key.fill")
                        .font(.title2)
                    Text("Recovery")
                        .font(.caption)
                }
                .foregroundColor(loginMethod == .recoveryPhrase ? .white : .white.opacity(0.5))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(
                    loginMethod == .recoveryPhrase ?
                    AnyView(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.purple.opacity(0.3))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Color.purple, lineWidth: 1)
                            )
                    ) : AnyView(Color.clear)
                )
            }
        }
        .padding(4)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.white.opacity(0.05))
        )
    }
    
    // MARK: - Cyphr ID Login
    
    private var cyphrIdLoginView: some View {
        VStack(spacing: 25) {
            VStack(spacing: 15) {
                Text("Enter Your Cyphr ID")
                    .font(.headline)
                    .foregroundColor(.white)
                
                Text("Login with your unique identifier")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.7))
            }
            
            // Cyphr ID input
            HStack {
                Text("@")
                    .font(.title2)
                    .foregroundColor(.purple)
                
                TextField("yourname", text: $viewModel.cyphrIdInput)
                    .textFieldStyle(PlainTextFieldStyle())
                    .font(.title2)
                    .foregroundColor(.white)
                    #if os(iOS)
                    .autocapitalization(.none)
                    #endif
                    .disableAutocorrection(true)
                    .focused($isInputFocused)
                
                if viewModel.isVerifying {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        .scaleEffect(0.8)
                }
            }
            .padding()
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.white.opacity(0.1))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(isInputFocused ? Color.purple : 
                                   Color.white.opacity(0.2), lineWidth: 1)
                    )
            )
            
            // Login button
            Button(action: {
                Task {
                    isLoading = true
                    loadingMessage = LoadingMessages.authenticating
                    await viewModel.loginWithCyphrId()
                    isLoading = false
                }
            }) {
                HStack {
                    Image(systemName: "faceid")
                    Text("Login with Face ID")
                }
                .font(.headline)
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding()
                .background(
                    LinearGradient(
                        colors: !viewModel.cyphrIdInput.isEmpty ? 
                               [.purple, .blue] : 
                               [Color.gray.opacity(0.5), Color.gray.opacity(0.3)],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .cornerRadius(15)
            }
            .disabled(viewModel.cyphrIdInput.isEmpty || viewModel.isVerifying)
            
            // Alternative: Use Touch ID
            if viewModel.biometricType == .touchID {
                Text("or use Touch ID")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.5))
            }
        }
        .onAppear {
            isInputFocused = true
        }
    }
    
    // MARK: - Recovery Phrase Login
    
    private var recoveryPhraseLoginView: some View {
        VStack(spacing: 25) {
            VStack(spacing: 15) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 40))
                    .foregroundColor(.yellow)
                
                Text("Recover Your Identity")
                    .font(.headline)
                    .foregroundColor(.white)
                
                Text("Enter your 12-word recovery phrase to restore access")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.7))
                    .multilineTextAlignment(.center)
            }
            
            // Recovery phrase input
            VStack(alignment: .leading, spacing: 10) {
                Text("Recovery Phrase")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.7))
                
                TextEditor(text: $viewModel.recoveryPhraseInput)
                    .textFieldStyle(PlainTextFieldStyle())
                    .font(.system(.body, design: .monospaced))
                    .foregroundColor(.white)
                    #if os(iOS)
                    .autocapitalization(.none)
                    #endif
                    .disableAutocorrection(true)
                    .frame(minHeight: 100)
                    .padding(10)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.white.opacity(0.1))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Color.white.opacity(0.2), lineWidth: 1)
                            )
                    )
                
                Text("Enter all 12 words separated by spaces")
                    .font(.caption2)
                    .foregroundColor(.white.opacity(0.5))
            }
            
            // Recover button
            Button(action: {
                Task {
                    isLoading = true
                    loadingMessage = LoadingMessages.restoringData
                    await viewModel.recoverWithPhrase()
                    isLoading = false
                }
            }) {
                HStack {
                    Image(systemName: "arrow.clockwise")
                    Text("Recover Identity")
                }
                .font(.headline)
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding()
                .background(
                    LinearGradient(
                        colors: viewModel.isValidRecoveryPhrase ? 
                               [.purple, .blue] : 
                               [Color.gray.opacity(0.5), Color.gray.opacity(0.3)],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .cornerRadius(15)
            }
            .disabled(!viewModel.isValidRecoveryPhrase || viewModel.isVerifying)
            
            // Warning
            Label("This will replace any existing identity on this device", 
                  systemImage: "exclamationmark.triangle")
                .font(.caption)
                .foregroundColor(.orange.opacity(0.8))
        }
    }
    
    // MARK: - Zero Knowledge Info
    
    private var zeroKnowledgeInfo: some View {
        VStack(spacing: 15) {
            Divider()
                .background(Color.white.opacity(0.2))
            
            VStack(spacing: 10) {
                Label("Zero server knowledge", systemImage: "eye.slash")
                Label("End-to-end encrypted", systemImage: "lock.shield")
                Label("No passwords stored", systemImage: "key.slash")
            }
            .font(.caption)
            .foregroundColor(.white.opacity(0.5))
            
            Button(action: { dismiss() }) {
                Text("Cancel")
                    .font(.callout)
                    .foregroundColor(.white.opacity(0.7))
            }
            .padding(.top)
        }
    }
}

// MARK: - View Model

class CyphrIdLoginViewModel: ObservableObject {
    @Published var cyphrIdInput = ""
    @Published var recoveryPhraseInput = ""
    @Published var isVerifying = false
    @Published var showError = false
    @Published var errorMessage = ""
    @Published var showBiometricSetup = false
    @Published var biometricType: LABiometryType = .none
    
    private let cyphrIdentity = CyphrIdentity.shared
    private let networkService = NetworkService.shared
    private let authService = AuthenticationService.shared
    
    init() {
        checkBiometricType()
    }
    
    var isValidRecoveryPhrase: Bool {
        let words = recoveryPhraseInput
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .components(separatedBy: .whitespacesAndNewlines)
            .filter { !$0.isEmpty }
        return words.count == 12
    }
    
    private func checkBiometricType() {
        let context = LAContext()
        _ = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
        biometricType = context.biometryType
    }
    
    func clearInputs() {
        cyphrIdInput = ""
        recoveryPhraseInput = ""
    }
    
    @MainActor
    func loginWithCyphrId() async {
        isVerifying = true
        
        do {
            // Verify Cyphr ID exists
            let userInfo = try await networkService.lookupCyphrId(cyphrId: cyphrIdInput)
            
            guard userInfo.exists else {
                throw AuthError.userNotFound
            }
            
            let loginResult = try await authService.loginWithCyphrId(cyphrId: cyphrIdInput)

            if loginResult.success {
                UserDefaults.standard.set(cyphrIdInput, forKey: "cyphr_id")
                UserDefaults.standard.set(loginResult.token, forKey: "auth_token")

                await MainActor.run {
                    NotificationCenter.default.post(
                        name: Notification.Name("UserLoggedIn"),
                        object: nil,
                        userInfo: ["cyphrId": cyphrIdInput]
                    )
                }
            }
        } catch let authError as AuthError {
            errorMessage = authError.localizedDescription
            showError = true
        } catch {
            errorMessage = "Login failed: \(error.localizedDescription)"
            showError = true
        }
        
        isVerifying = false
    }
    
    @MainActor
    func recoverWithPhrase() async {
        isVerifying = true
        
        do {
            let words = recoveryPhraseInput
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .components(separatedBy: .whitespacesAndNewlines)
                .filter { !$0.isEmpty }
            
            guard words.count == 12 else {
                throw AuthError.invalidRecoveryPhrase
            }
            
            // Recover identity from phrase
            let identity = try await cyphrIdentity.recoverFromPhrase(words)
            
            // Register recovered identity with backend
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
            let registered = try await networkService.registerCyphrIdentity(
                cyphrId: identity.cyphrId,
                publicKey: identity.publicKey,
                deviceInfo: deviceInfo
            )
            
            if registered.success {
                // Store credentials
                UserDefaults.standard.set(identity.cyphrId, forKey: "cyphr_id")
                
                // Setup biometrics for future logins
                showBiometricSetup = true
            }
        } catch {
            errorMessage = "Recovery failed: \(error.localizedDescription)"
            showError = true
        }
        
        isVerifying = false
    }
}

// MARK: - Biometric Setup View

struct BiometricSetupView: View {
    let cyphrId: String
    @Environment(\.dismiss) private var dismiss
    @State private var setupComplete = false
    
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(red: 0.07, green: 0.08, blue: 0.12),
                    Color(red: 0.05, green: 0.06, blue: 0.10)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()
            
            VStack(spacing: 30) {
                Image(systemName: setupComplete ? "checkmark.circle.fill" : "faceid")
                    .font(.system(size: 80))
                    .foregroundColor(setupComplete ? .green : .purple)
                
                Text(setupComplete ? "Setup Complete!" : "Setup Biometric Login")
                    .font(.title)
                    .fontWeight(.bold)
                    .foregroundColor(.white)
                
                Text("Use Face ID for quick access to @\(cyphrId)")
                    .font(.subheadline)
                    .foregroundColor(.white.opacity(0.7))
                    .multilineTextAlignment(.center)
                
                if !setupComplete {
                    Button(action: {
                        Task {
                            await setupBiometrics()
                        }
                    }) {
                        Text("Enable Face ID")
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
                } else {
                    Button(action: {
                        dismiss()
                        // Navigate to main app
                        NotificationCenter.default.post(
                            name: Notification.Name("UserLoggedIn"),
                            object: nil
                        )
                    }) {
                        Text("Continue to App")
                            .font(.headline)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.green)
                            .cornerRadius(15)
                    }
                }
                
                Button(action: { dismiss() }) {
                    Text("Skip for now")
                        .foregroundColor(.white.opacity(0.7))
                }
            }
            .padding(40)
        }
    }
    
    @MainActor
    private func setupBiometrics() async {
        do {
            try await CyphrIdentity.shared.bindToDevice()
            withAnimation {
                setupComplete = true
            }
        } catch {
            // Handle error
            print("Failed to setup biometrics: \(error)")
        }
    }
}

// MARK: - Auth Errors
// Using AuthError from AuthenticationService.swift

// MARK: - Preview

struct CyphrIdLoginView_Previews: PreviewProvider {
    static var previews: some View {
        CyphrIdLoginView()
    }
}
