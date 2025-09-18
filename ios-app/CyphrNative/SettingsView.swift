import SwiftUI

/// Enterprise-Grade Settings Screen - WhatsApp/Signal Level
struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var authService = AuthenticationService.shared
    
    // Notification Settings
    @AppStorage("notifications_enabled") private var notificationsEnabled = true
    @AppStorage("show_message_preview") private var showMessagePreview = true
    @AppStorage("notification_sound") private var notificationSound = "default"
    
    // Privacy Settings
    @AppStorage("read_receipts") private var readReceipts = true
    @AppStorage("online_status") private var onlineStatus = true
    @AppStorage("typing_indicators") private var typingIndicators = true
    @AppStorage("profile_photo_visibility") private var profilePhotoVisibility = "everyone"
    
    // Chat Settings
    @AppStorage("auto_download_media") private var autoDownloadMedia = "wifi"
    @AppStorage("save_to_camera_roll") private var saveToCameraRoll = false
    @AppStorage("chat_backup") private var chatBackupEnabled = false
    @AppStorage("message_retention") private var messageRetention = "forever"
    
    // Security Settings
    @AppStorage("app_lock") private var appLockEnabled = true
    @AppStorage("biometric_unlock") private var biometricUnlock = true
    @AppStorage("screenshot_protection") private var screenshotProtection = false
    @AppStorage("incognito_keyboard") private var incognitoKeyboard = false
    
    // Advanced Settings
    @AppStorage("p2p_mode") private var p2pModeEnabled = false
    @AppStorage("tor_routing") private var torRoutingEnabled = false
    @AppStorage("decoy_pin") private var decoyPinEnabled = false
    
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
                        // Header
                        header
                        
                        // Notifications
                        notificationSettings
                        
                        // Privacy
                        privacySettings
                        
                        // Chats
                        chatSettings
                        
                        // Security
                        securitySettings
                        
                        // Advanced
                        advancedSettings
                        
                        // Data and Storage
                        dataStorageSettings
                        
                        // Help
                        helpSection
                    }
                    .padding()
                }
            }
            #if os(iOS)
            .navigationBarHidden(true)
            #endif
        }
    }
    
    // MARK: - Header
    
    private var header: some View {
        HStack {
            Button(action: { dismiss() }) {
                Image(systemName: "chevron.left")
                    .font(.title2)
                    .foregroundColor(.white)
            }
            
            Spacer()
            
            Text("Settings")
                .font(.title2.bold())
                .foregroundColor(.white)
            
            Spacer()
            
            // Placeholder for balance
            Color.clear
                .frame(width: 28, height: 28)
        }
    }
    
    // MARK: - Notification Settings
    
    private var notificationSettings: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Notifications", systemImage: "bell.fill")
                .font(.headline)
                .foregroundColor(.white)
            
            VStack(spacing: 0) {
                // Enable Notifications
                Toggle(isOn: $notificationsEnabled) {
                    HStack {
                        Image(systemName: "bell")
                            .foregroundColor(.white.opacity(0.7))
                        Text("Enable Notifications")
                            .foregroundColor(.white)
                    }
                }
                .tint(.purple)
                .padding()
                
                Divider()
                    .background(Color.white.opacity(0.1))
                
                // Show Preview
                Toggle(isOn: $showMessagePreview) {
                    HStack {
                        Image(systemName: "text.bubble")
                            .foregroundColor(.white.opacity(0.7))
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Show Message Preview")
                                .foregroundColor(.white)
                            Text("Display message content in notifications")
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.5))
                        }
                    }
                }
                .tint(.purple)
                .padding()
                .disabled(!notificationsEnabled)
                .opacity(notificationsEnabled ? 1 : 0.5)
                
                Divider()
                    .background(Color.white.opacity(0.1))
                
                // Notification Sound
                HStack {
                    Image(systemName: "speaker.wave.2")
                        .foregroundColor(.white.opacity(0.7))
                    Text("Notification Sound")
                        .foregroundColor(.white)
                    Spacer()
                    Text("Default")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.5))
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.3))
                }
                .padding()
            }
            .background(Color.white.opacity(0.05))
            .cornerRadius(12)
        }
    }
    
    // MARK: - Privacy Settings
    
    private var privacySettings: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Privacy", systemImage: "lock.fill")
                .font(.headline)
                .foregroundColor(.white)
            
            VStack(spacing: 0) {
                // Read Receipts
                Toggle(isOn: $readReceipts) {
                    HStack {
                        Image(systemName: "checkmark.message")
                            .foregroundColor(.white.opacity(0.7))
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Read Receipts")
                                .foregroundColor(.white)
                            Text("Let others know when you've read messages")
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.5))
                        }
                    }
                }
                .tint(.purple)
                .padding()
                
                Divider()
                    .background(Color.white.opacity(0.1))
                
                // Online Status
                Toggle(isOn: $onlineStatus) {
                    HStack {
                        Image(systemName: "circle.fill")
                            .font(.caption)
                            .foregroundColor(.green)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Online Status")
                                .foregroundColor(.white)
                            Text("Show when you're online")
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.5))
                        }
                    }
                }
                .tint(.purple)
                .padding()
                
                Divider()
                    .background(Color.white.opacity(0.1))
                
                // Typing Indicators
                Toggle(isOn: $typingIndicators) {
                    HStack {
                        Image(systemName: "ellipsis.bubble")
                            .foregroundColor(.white.opacity(0.7))
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Typing Indicators")
                                .foregroundColor(.white)
                            Text("Show when you're typing")
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.5))
                        }
                    }
                }
                .tint(.purple)
                .padding()
                
                Divider()
                    .background(Color.white.opacity(0.1))
                
                // Profile Photo
                HStack {
                    Image(systemName: "person.crop.circle")
                        .foregroundColor(.white.opacity(0.7))
                    Text("Profile Photo")
                        .foregroundColor(.white)
                    Spacer()
                    Menu {
                        Button("Everyone") { profilePhotoVisibility = "everyone" }
                        Button("Contacts") { profilePhotoVisibility = "contacts" }
                        Button("Nobody") { profilePhotoVisibility = "nobody" }
                    } label: {
                        HStack(spacing: 4) {
                            Text(profilePhotoVisibility.capitalized)
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.5))
                            Image(systemName: "chevron.up.chevron.down")
                                .font(.caption2)
                                .foregroundColor(.white.opacity(0.3))
                        }
                    }
                }
                .padding()
            }
            .background(Color.white.opacity(0.05))
            .cornerRadius(12)
        }
    }
    
    // MARK: - Chat Settings
    
    private var chatSettings: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Chats", systemImage: "bubble.left.and.bubble.right.fill")
                .font(.headline)
                .foregroundColor(.white)
            
            VStack(spacing: 0) {
                // Auto-Download Media
                HStack {
                    Image(systemName: "arrow.down.circle")
                        .foregroundColor(.white.opacity(0.7))
                    Text("Auto-Download Media")
                        .foregroundColor(.white)
                    Spacer()
                    Menu {
                        Button("Always") { autoDownloadMedia = "always" }
                        Button("WiFi Only") { autoDownloadMedia = "wifi" }
                        Button("Never") { autoDownloadMedia = "never" }
                    } label: {
                        HStack(spacing: 4) {
                            Text(autoDownloadMedia == "wifi" ? "WiFi Only" : autoDownloadMedia.capitalized)
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.5))
                            Image(systemName: "chevron.up.chevron.down")
                                .font(.caption2)
                                .foregroundColor(.white.opacity(0.3))
                        }
                    }
                }
                .padding()
                
                Divider()
                    .background(Color.white.opacity(0.1))
                
                // Save to Camera Roll
                Toggle(isOn: $saveToCameraRoll) {
                    HStack {
                        Image(systemName: "photo")
                            .foregroundColor(.white.opacity(0.7))
                        Text("Save to Camera Roll")
                            .foregroundColor(.white)
                    }
                }
                .tint(.purple)
                .padding()
                
                Divider()
                    .background(Color.white.opacity(0.1))
                
                // Chat Backup
                Toggle(isOn: $chatBackupEnabled) {
                    HStack {
                        Image(systemName: "icloud.and.arrow.up")
                            .foregroundColor(.white.opacity(0.7))
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Chat Backup")
                                .foregroundColor(.white)
                            Text("Encrypted backup to iCloud")
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.5))
                        }
                    }
                }
                .tint(.purple)
                .padding()
                
                Divider()
                    .background(Color.white.opacity(0.1))
                
                // Message Retention
                HStack {
                    Image(systemName: "clock.arrow.circlepath")
                        .foregroundColor(.white.opacity(0.7))
                    Text("Message Retention")
                        .foregroundColor(.white)
                    Spacer()
                    Menu {
                        Button("Forever") { messageRetention = "forever" }
                        Button("1 Year") { messageRetention = "1year" }
                        Button("6 Months") { messageRetention = "6months" }
                        Button("30 Days") { messageRetention = "30days" }
                    } label: {
                        HStack(spacing: 4) {
                            Text(messageRetention == "forever" ? "Forever" : messageRetention)
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.5))
                            Image(systemName: "chevron.up.chevron.down")
                                .font(.caption2)
                                .foregroundColor(.white.opacity(0.3))
                        }
                    }
                }
                .padding()
            }
            .background(Color.white.opacity(0.05))
            .cornerRadius(12)
        }
    }
    
    // MARK: - Security Settings
    
    private var securitySettings: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Security", systemImage: "lock.shield.fill")
                .font(.headline)
                .foregroundColor(.white)
            
            VStack(spacing: 0) {
                // App Lock
                Toggle(isOn: $appLockEnabled) {
                    HStack {
                        Image(systemName: "lock.fill")
                            .foregroundColor(.white.opacity(0.7))
                        VStack(alignment: .leading, spacing: 2) {
                            Text("App Lock")
                                .foregroundColor(.white)
                            Text("Require authentication to open")
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.5))
                        }
                    }
                }
                .tint(.purple)
                .padding()
                
                Divider()
                    .background(Color.white.opacity(0.1))
                
                // Biometric Unlock
                Toggle(isOn: $biometricUnlock) {
                    HStack {
                        Image(systemName: "faceid")
                            .foregroundColor(.white.opacity(0.7))
                        Text("Face ID / Touch ID")
                            .foregroundColor(.white)
                    }
                }
                .tint(.purple)
                .padding()
                .disabled(!appLockEnabled)
                .opacity(appLockEnabled ? 1 : 0.5)
                
                Divider()
                    .background(Color.white.opacity(0.1))
                
                // Screenshot Protection
                Toggle(isOn: $screenshotProtection) {
                    HStack {
                        Image(systemName: "camera.viewfinder")
                            .foregroundColor(.white.opacity(0.7))
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Screenshot Protection")
                                .foregroundColor(.white)
                            Text("Blur app in app switcher")
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.5))
                        }
                    }
                }
                .tint(.purple)
                .padding()
                
                Divider()
                    .background(Color.white.opacity(0.1))
                
                // Incognito Keyboard
                Toggle(isOn: $incognitoKeyboard) {
                    HStack {
                        Image(systemName: "keyboard")
                            .foregroundColor(.white.opacity(0.7))
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Incognito Keyboard")
                                .foregroundColor(.white)
                            Text("Disable keyboard learning")
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.5))
                        }
                    }
                }
                .tint(.purple)
                .padding()
            }
            .background(Color.white.opacity(0.05))
            .cornerRadius(12)
        }
    }
    
    // MARK: - Advanced Settings
    
    private var advancedSettings: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Advanced", systemImage: "gearshape.2.fill")
                .font(.headline)
                .foregroundColor(.white)
            
            VStack(spacing: 0) {
                // P2P Mode
                Toggle(isOn: $p2pModeEnabled) {
                    HStack {
                        Image(systemName: "point.3.connected.trianglepath.dotted")
                            .foregroundColor(.white.opacity(0.7))
                        VStack(alignment: .leading, spacing: 2) {
                            Text("P2P Mode")
                                .foregroundColor(.white)
                            Text("Direct peer connections when possible")
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.5))
                        }
                    }
                }
                .tint(.purple)
                .padding()
                
                Divider()
                    .background(Color.white.opacity(0.1))
                
                // Tor Routing
                Toggle(isOn: $torRoutingEnabled) {
                    HStack {
                        Image(systemName: "network.badge.shield.half.filled")
                            .foregroundColor(.white.opacity(0.7))
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Tor Routing")
                                .foregroundColor(.white)
                            Text("Route traffic through Tor network")
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.5))
                        }
                    }
                }
                .tint(.purple)
                .padding()
                
                Divider()
                    .background(Color.white.opacity(0.1))
                
                // Decoy PIN
                Toggle(isOn: $decoyPinEnabled) {
                    HStack {
                        Image(systemName: "lock.rotation")
                            .foregroundColor(.white.opacity(0.7))
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Decoy PIN")
                                .foregroundColor(.white)
                            Text("Alternative PIN for hidden account")
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.5))
                        }
                    }
                }
                .tint(.purple)
                .padding()
            }
            .background(Color.white.opacity(0.05))
            .cornerRadius(12)
        }
    }
    
    // MARK: - Data & Storage
    
    private var dataStorageSettings: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Data & Storage", systemImage: "externaldrive.fill")
                .font(.headline)
                .foregroundColor(.white)
            
            VStack(spacing: 0) {
                // Storage Usage
                HStack {
                    Image(systemName: "chart.pie")
                        .foregroundColor(.white.opacity(0.7))
                    Text("Storage Usage")
                        .foregroundColor(.white)
                    Spacer()
                    Text("156 MB")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.5))
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.3))
                }
                .padding()
                
                Divider()
                    .background(Color.white.opacity(0.1))
                
                // Clear Cache
                Button(action: { clearCache() }) {
                    HStack {
                        Image(systemName: "trash")
                            .foregroundColor(.white.opacity(0.7))
                        Text("Clear Cache")
                            .foregroundColor(.white)
                        Spacer()
                        Text("12 MB")
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.5))
                    }
                    .padding()
                }
                
                Divider()
                    .background(Color.white.opacity(0.1))
                
                // Export Data
                Button(action: { exportData() }) {
                    HStack {
                        Image(systemName: "square.and.arrow.up")
                            .foregroundColor(.white.opacity(0.7))
                        Text("Export My Data")
                            .foregroundColor(.white)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.3))
                    }
                    .padding()
                }
            }
            .background(Color.white.opacity(0.05))
            .cornerRadius(12)
        }
    }
    
    // MARK: - Help Section
    
    private var helpSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Help", systemImage: "questionmark.circle.fill")
                .font(.headline)
                .foregroundColor(.white)
            
            VStack(spacing: 0) {
                // FAQ
                Button(action: {}) {
                    HStack {
                        Image(systemName: "book")
                            .foregroundColor(.white.opacity(0.7))
                        Text("FAQ")
                            .foregroundColor(.white)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.3))
                    }
                    .padding()
                }
                
                Divider()
                    .background(Color.white.opacity(0.1))
                
                // Contact Support
                Button(action: {}) {
                    HStack {
                        Image(systemName: "envelope")
                            .foregroundColor(.white.opacity(0.7))
                        Text("Contact Support")
                            .foregroundColor(.white)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.3))
                    }
                    .padding()
                }
                
                Divider()
                    .background(Color.white.opacity(0.1))
                
                // Terms & Privacy
                Button(action: {}) {
                    HStack {
                        Image(systemName: "doc.text")
                            .foregroundColor(.white.opacity(0.7))
                        Text("Terms & Privacy")
                            .foregroundColor(.white)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.3))
                    }
                    .padding()
                }
            }
            .background(Color.white.opacity(0.05))
            .cornerRadius(12)
        }
    }
    
    // MARK: - Actions
    
    private func clearCache() {
        // Clear cache implementation
        print("Clearing cache...")
    }
    
    private func exportData() {
        // Export user data
        print("Exporting data...")
    }
}

// MARK: - Preview

struct SettingsView_Previews: PreviewProvider {
    static var previews: some View {
        SettingsView()
    }
}