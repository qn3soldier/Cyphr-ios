import SwiftUI

/// Enterprise-Grade Profile Screen - WhatsApp/Telegram Level
struct ProfileView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var authService = AuthenticationService.shared
    @StateObject private var cyphrIdentity = CyphrIdentity.shared
    @StateObject private var walletService = HDWalletService.shared
    
    @State private var isEditingName = false
    @State private var isEditingBio = false
    @State private var displayName = ""
    @State private var bio = ""
    @State private var showingRecoveryPhrase = false
    @State private var showingQRCode = false
    @State private var showingSettings = false
    @State private var showingDeleteConfirmation = false
    @State private var showingFinalDeleteWarning = false
    @State private var walletBalance: WalletBalance? = nil
    @State private var isLoading = false
    @State private var loadingMessage = ""
    @State private var showDeleteResultAlert = false
    @State private var deleteResultMessage = ""
    
    var body: some View {
        NavigationView {
            ZStack {
                // Lightning gradient background
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
                    VStack(spacing: 24) {
                        // Profile Header
                        profileHeader
                        
                        // Identity Section
                        identitySection
                        
                        // Security Section
                        securitySection
                        
                        // Wallet Section
                        walletSection
                        
                        // Privacy Section
                        privacySection
                        
                        // About Section
                        aboutSection
                        
                        // Danger Zone
                        dangerZone
                    }
                    .padding()
                }
            }
            #if os(iOS)
            .navigationBarHidden(true)
            #endif
            .loadingOverlay(
                isPresented: $isLoading,
                message: loadingMessage
            )
            .sheet(isPresented: $showingRecoveryPhrase) {
                RecoveryPhraseView(
                    currentStep: 1,
                    totalSteps: 1,
                    recoveryPhrase: cyphrIdentity.recoveryPhrase ?? [],
                    onCompletion: {
                        showingRecoveryPhrase = false
                    }
                )
            }
            .sheet(isPresented: $showingQRCode) {
                QRCodeView(cyphrId: cyphrIdentity.cyphrId ?? "")
            }
            .sheet(isPresented: $showingSettings) {
                SettingsView()
            }
            .confirmationDialog(
                "Delete Account?",
                isPresented: $showingDeleteConfirmation,
                titleVisibility: .visible
            ) {
                Button("Check Wallet & Continue", role: .destructive) {
                    Task {
                        // Check wallet balance
                        do {
                            walletBalance = try await HDWalletService.shared.getBalance()
                        } catch {
                            print("⚠️ Could not get wallet balance: \(error)")
                            walletBalance = nil
                        }
                        showingFinalDeleteWarning = true
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This will permanently delete your account and all data. This action cannot be undone.")
            }
            .alert(
                "⚠️ Final Warning",
                isPresented: $showingFinalDeleteWarning
            ) {
                Button("Cancel", role: .cancel) {}
                Button("DELETE EVERYTHING", role: .destructive) {
                    Task {
                        isLoading = true
                        loadingMessage = LoadingMessages.resettingIdentity
                        await resetIdentity()
                        isLoading = false
                    }
                }
            } message: {
                if let balance = walletBalance, let xlmAmount = Double(balance.xlm), xlmAmount > 0 {
                    Text("⚠️ WALLET CONTAINS FUNDS!\n\nBalance: \(xlmAmount, specifier: "%.4f") XLM\n\nIMPORTANT: Save your wallet seed phrase to access funds in any Stellar wallet (Lobstr, etc).\n\nWithout seed phrase, funds will be inaccessible!")
                } else {
                    Text("This will:\n• Delete all messages\n• Remove your identity\n• Clear all keys\n• Erase wallet\n\nYour @\(UserDefaults.standard.string(forKey: "cyphr_id") ?? "") will be available for others to claim.\n\nAre you absolutely sure?")
                }
            }
            .alert("Account Removal", isPresented: $showDeleteResultAlert) {
                Button("OK", role: .cancel) {
                    // Close profile after informing the user
                    dismiss()
                }
            } message: {
                Text(deleteResultMessage)
            }
        }
        .onAppear {
            loadProfile()
        }
    }
    
    // MARK: - Profile Header
    
    private var profileHeader: some View {
        VStack(spacing: 16) {
            // Close button
            HStack {
                Button(action: { dismiss() }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.title2)
                        .foregroundColor(.white.opacity(0.5))
                }
                Spacer()
                Button(action: { showingSettings = true }) {
                    Image(systemName: "gear")
                        .font(.title2)
                        .foregroundColor(.white.opacity(0.7))
                }
            }
            
            // Avatar
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [.purple, .blue],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 120, height: 120)
                
                Text((displayName.first?.uppercased() ?? "?") + (displayName.split(separator: " ").last?.first?.uppercased() ?? ""))
                    .font(.system(size: 48, weight: .bold))
                    .foregroundColor(.white)
                
                // Camera overlay for editing
                Circle()
                    .fill(Color.black.opacity(0.3))
                    .frame(width: 120, height: 120)
                    .overlay(
                        Image(systemName: "camera.fill")
                            .font(.title2)
                            .foregroundColor(.white)
                    )
                    .opacity(0) // Hidden for now
            }
            
            // Name
            HStack {
                if isEditingName {
                    TextField("Display Name", text: $displayName)
                        .font(.title2.bold())
                        .foregroundColor(.white)
                        .multilineTextAlignment(.center)
                        .textFieldStyle(PlainTextFieldStyle())
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.white.opacity(0.1))
                        .cornerRadius(8)
                } else {
                    Text(displayName)
                        .font(.title2.bold())
                        .foregroundColor(.white)
                    
                    Button(action: { isEditingName.toggle() }) {
                        Image(systemName: "pencil")
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.5))
                    }
                }
            }
            
            // Bio
            if isEditingBio || !bio.isEmpty {
                HStack {
                    if isEditingBio {
                        TextField("Bio", text: $bio)
                            .font(.subheadline)
                            .foregroundColor(.white.opacity(0.7))
                            .multilineTextAlignment(.center)
                            .textFieldStyle(PlainTextFieldStyle())
                    } else {
                        Text(bio)
                            .font(.subheadline)
                            .foregroundColor(.white.opacity(0.7))
                        
                        Button(action: { isEditingBio.toggle() }) {
                            Image(systemName: "pencil")
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.5))
                        }
                    }
                }
            } else {
                Button(action: { isEditingBio = true }) {
                    Text("Add Bio")
                        .font(.caption)
                        .foregroundColor(.purple)
                }
            }
        }
    }
    
    // MARK: - Identity Section
    
    private var identitySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Cyphr Identity", systemImage: "at.badge.plus")
                .font(.headline)
                .foregroundColor(.white)
            
            VStack(spacing: 8) {
                // Cyphr ID
                HStack {
                    Text("@\(cyphrIdentity.cyphrId ?? "loading...")")
                        .font(.system(.body, design: .monospaced))
                        .foregroundColor(.purple)
                    
                    Spacer()
                    
                    Button(action: { showingQRCode = true }) {
                        Image(systemName: "qrcode")
                            .foregroundColor(.white.opacity(0.7))
                    }
                }
                .padding()
                .background(Color.white.opacity(0.05))
                .cornerRadius(12)
                
                // Public Key (truncated)
                if let publicKey = cyphrIdentity.ed25519PublicKey {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Public Key")
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.5))
                            Text(publicKey.rawRepresentation.base64EncodedString().prefix(20) + "...")
                                .font(.caption.monospaced())
                                .foregroundColor(.white.opacity(0.7))
                        }
                        
                        Spacer()
                        
                        Button(action: { copyToClipboard(publicKey.rawRepresentation.base64EncodedString()) }) {
                            Image(systemName: "doc.on.doc")
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.5))
                        }
                    }
                    .padding()
                    .background(Color.white.opacity(0.05))
                    .cornerRadius(12)
                }
            }
        }
    }
    
    // MARK: - Security Section
    
    private var securitySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Security", systemImage: "lock.shield.fill")
                .font(.headline)
                .foregroundColor(.white)
            
            VStack(spacing: 0) {
                // Recovery Phrase
                Button(action: { showingRecoveryPhrase = true }) {
                    HStack {
                        Label("Recovery Phrase", systemImage: "key.fill")
                            .foregroundColor(.white)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .foregroundColor(.white.opacity(0.5))
                    }
                    .padding()
                }
                
                Divider()
                    .background(Color.white.opacity(0.1))
                
                // Biometric Lock
                HStack {
                    Label("Face ID Lock", systemImage: "faceid")
                        .foregroundColor(.white)
                    Spacer()
                    Toggle("", isOn: .constant(true))
                        .tint(.purple)
                }
                .padding()
                
                Divider()
                    .background(Color.white.opacity(0.1))
                
                // PIN Code
                Button(action: {}) {
                    HStack {
                        Label("Change PIN", systemImage: "lock.fill")
                            .foregroundColor(.white)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .foregroundColor(.white.opacity(0.5))
                    }
                    .padding()
                }
            }
            .background(Color.white.opacity(0.05))
            .cornerRadius(12)
        }
    }
    
    // MARK: - Wallet Section
    
    private var walletSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Wallet", systemImage: "creditcard.fill")
                .font(.headline)
                .foregroundColor(.white)
            
            VStack(spacing: 0) {
                // Wallet Balance
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Balance")
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.5))
                        HStack(spacing: 4) {
                            Image(systemName: "star.circle.fill")
                                .foregroundColor(.blue)
                                .font(.system(size: 20))
                            Text("\(Double(walletBalance?.xlm ?? "0") ?? 0, specifier: "%.4f") XLM")
                                .font(.title3.bold())
                                .foregroundColor(.white)
                        }
                    }
                    
                    Spacer()
                    
                    Button(action: { 
                        Task {
                            do {
                                walletBalance = try await HDWalletService.shared.getBalance()
                            } catch {
                                print("Failed to refresh balance: \(error)")
                            }
                        }
                    }) {
                        Image(systemName: "arrow.clockwise")
                            .foregroundColor(.white.opacity(0.5))
                    }
                }
                .padding()
                
                Divider()
                    .background(Color.white.opacity(0.1))
                
                // Stellar Address
                if let stellarAddress = walletService.stellarAddress {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Stellar Address")
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.5))
                            Text(stellarAddress.prefix(8) + "..." + stellarAddress.suffix(8))
                                .font(.caption.monospaced())
                                .foregroundColor(.white.opacity(0.7))
                        }
                        
                        Spacer()
                        
                        Button(action: { copyToClipboard(stellarAddress) }) {
                            Image(systemName: "doc.on.doc")
                                .foregroundColor(.white.opacity(0.5))
                        }
                    }
                    .padding()
                }
                
                Divider()
                    .background(Color.white.opacity(0.1))
                
                // Backup Wallet
                Button(action: {}) {
                    HStack {
                        Label("Backup Wallet", systemImage: "arrow.down.doc")
                            .foregroundColor(.white)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .foregroundColor(.white.opacity(0.5))
                    }
                    .padding()
                }
            }
            .background(Color.white.opacity(0.05))
            .cornerRadius(12)
        }
    }
    
    // MARK: - Privacy Section
    
    private var privacySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Privacy", systemImage: "eye.slash.fill")
                .font(.headline)
                .foregroundColor(.white)
            
            VStack(spacing: 0) {
                // Read Receipts
                HStack {
                    Label("Read Receipts", systemImage: "checkmark.circle.fill")
                        .foregroundColor(.white)
                    Spacer()
                    Toggle("", isOn: .constant(true))
                        .tint(.purple)
                }
                .padding()
                
                Divider()
                    .background(Color.white.opacity(0.1))
                
                // Online Status
                HStack {
                    Label("Show Online Status", systemImage: "circle.fill")
                        .foregroundColor(.white)
                    Spacer()
                    Toggle("", isOn: .constant(true))
                        .tint(.purple)
                }
                .padding()
                
                Divider()
                    .background(Color.white.opacity(0.1))
                
                // Profile Photo
                HStack {
                    Label("Profile Photo Visibility", systemImage: "person.crop.circle")
                        .foregroundColor(.white)
                    Spacer()
                    Text("Everyone")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.5))
                    Image(systemName: "chevron.right")
                        .foregroundColor(.white.opacity(0.5))
                }
                .padding()
            }
            .background(Color.white.opacity(0.05))
            .cornerRadius(12)
        }
    }
    
    // MARK: - About Section
    
    private var aboutSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("About", systemImage: "info.circle.fill")
                .font(.headline)
                .foregroundColor(.white)
            
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Version")
                        .foregroundColor(.white.opacity(0.5))
                    Spacer()
                    Text("1.0.0")
                        .foregroundColor(.white.opacity(0.7))
                }
                
                HStack {
                    Text("Build")
                        .foregroundColor(.white.opacity(0.5))
                    Spacer()
                    Text("100")
                        .foregroundColor(.white.opacity(0.7))
                }
                
                HStack {
                    Text("Encryption")
                        .foregroundColor(.white.opacity(0.5))
                    Spacer()
                    Text("Kyber1024 + ChaCha20")
                        .foregroundColor(.green)
                        .font(.caption)
                }
            }
            .padding()
            .background(Color.white.opacity(0.05))
            .cornerRadius(12)
        }
    }
    
    // MARK: - Danger Zone
    
    private var dangerZone: some View {
        VStack(spacing: 12) {
            Button(action: { logout() }) {
                Label("Logout", systemImage: "arrow.right.square")
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.orange.opacity(0.2))
                    .foregroundColor(.orange)
                    .cornerRadius(12)
            }
            
            Button(action: { deleteAccount() }) {
                Label("Delete Account", systemImage: "trash")
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.red.opacity(0.2))
                    .foregroundColor(.red)
                    .cornerRadius(12)
            }
        }
        .padding(.top, 20)
    }
    
    // MARK: - Actions
    
    private func loadProfile() {
        displayName = UserDefaults.standard.string(forKey: "display_name") ?? "Anonymous"
        bio = UserDefaults.standard.string(forKey: "bio") ?? ""
        
        // Load wallet balance
        Task {
            do {
                walletBalance = try await HDWalletService.shared.getBalance()
                if let balance = walletBalance {
                    print("💰 Wallet balance loaded: \(balance.xlm) XLM")
                }
            } catch {
                print("⚠️ Could not load wallet balance: \(error)")
                walletBalance = nil
            }
        }
    }
    
    private func saveProfile() {
        UserDefaults.standard.set(displayName, forKey: "display_name")
        UserDefaults.standard.set(bio, forKey: "bio")
        
        isEditingName = false
        isEditingBio = false
    }
    
    private func copyToClipboard(_ text: String) {
        #if os(iOS)
        UIPasteboard.general.string = text
        #endif
        // Show toast notification
    }
    
    private func logout() {
        // Use centralized AuthService logout to keep global state consistent
        AuthenticationService.shared.logout()

        // Notify app to transition out of authenticated UI
        NotificationCenter.default.post(
            name: Notification.Name("UserLoggedOut"),
            object: nil
        )

        // Close profile sheet
        dismiss()
    }
    
    private func deleteAccount() {
        // Show first confirmation
        showingDeleteConfirmation = true
    }
    
    @MainActor
    private func resetIdentity() async {
        // According to UX Architecture v2.0.0, this should:
        // 1. Check wallet balance
        // 2. Show warnings
        // 3. Invalidate on backend (NOT delete)
        // 4. Clear local data
        
        do {
            // Step 1: Get current identity
            guard let cyphrId = UserDefaults.standard.string(forKey: "cyphr_id") else {
                print("❌ No Cyphr ID found")
                return
            }
            
            // Step 2: Check wallet balance
            do {
                let currentBalance = try await HDWalletService.shared.getBalance()
                if let xlmAmount = Double(currentBalance.xlm), xlmAmount > 0 {
                    print("⚠️ WARNING: Wallet contains \(xlmAmount) XLM! User should transfer funds first!")
                }
            } catch {
                print("⚠️ Could not check wallet balance: \(error)")
            }
            
            // Step 3: Attempt server-side delete (best-effort)
            // If server deletion fails or endpoint missing, proceed with local wipe and inform user.
            let serverDeleted: Bool
            do {
                serverDeleted = try await NetworkService.shared.deleteCyphrIdentity(cyphrId: cyphrId)
            } catch {
                print("❌ Server delete threw error: \(error)")
                serverDeleted = false
            }

            // Step 4: Clear all local data regardless of server outcome
            clearLocalData()

            // Step 5: Notify app; navigation after alert confirmation
            NotificationCenter.default.post(
                name: Notification.Name("UserLoggedOut"),
                object: nil
            )

            // Step 6: Inform user about result
            deleteResultMessage = serverDeleted
                ? "Your account was deleted on the server and all local data was cleared."
                : "Server deletion could not be completed right now. All local data was cleared and you are logged out. You may still appear on the server temporarily. Try again later."
            showDeleteResultAlert = true
        } catch {
            print("❌ Error resetting identity: \(error)")
            // Even on unexpected errors, ensure local wipe to protect user data
            clearLocalData()
            NotificationCenter.default.post(
                name: Notification.Name("UserLoggedOut"),
                object: nil
            )
            deleteResultMessage = "An error occurred while contacting the server. All local data was cleared and you are logged out."
            showDeleteResultAlert = true
        }
    }
    
    private func clearLocalData() {
        // Clear Keychain items
        CyphrIdentity.shared.clearAllKeychainData()
        
        // Clear UserDefaults
        AuthTokenStore.clear()
        UserDefaults.standard.removeObject(forKey: "cyphr_id")
        UserDefaults.standard.removeObject(forKey: "display_name")
        UserDefaults.standard.removeObject(forKey: "bio")
        UserDefaults.standard.removeObject(forKey: "cyphr_signup_completed")
        
        // Generate new device salt for next identity
        UserDefaults.standard.set(UUID().uuidString, forKey: "device_salt")
        
        print("✅ Local data cleared")
    }
}

struct QRCodeView: View {
    @Environment(\.dismiss) private var dismiss
    let cyphrId: String
    
    var body: some View {
        NavigationView {
            ZStack {
                LinearGradient(
                    colors: [
                        Color(red: 0.05, green: 0.06, blue: 0.10),
                        Color(red: 0.07, green: 0.08, blue: 0.12)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()
                
                VStack(spacing: 24) {
                    Text("Your Cyphr ID")
                        .font(.largeTitle.bold())
                        .foregroundColor(.white)
                    
                    // QR Code placeholder
                    RoundedRectangle(cornerRadius: 20)
                        .fill(Color.white)
                        .frame(width: 250, height: 250)
                        .overlay(
                            Text("QR Code")
                                .foregroundColor(.black)
                        )
                    
                    Text("@\(cyphrId)")
                        .font(.title2.monospaced())
                        .foregroundColor(.purple)
                    
                    Text("Others can scan this code to add you")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.7))
                }
            }
            #if os(iOS)
            .navigationBarItems(
                trailing: Button("Done") {
                    dismiss()
                }
                .foregroundColor(.white)
            )
            #endif
        }
    }
}

// MARK: - Preview

struct ProfileView_Previews: PreviewProvider {
    static var previews: some View {
        ProfileView()
    }
}
