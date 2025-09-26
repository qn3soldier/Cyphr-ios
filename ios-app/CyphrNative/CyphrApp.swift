import SwiftUI
import Combine
#if os(iOS)
import UIKit
#endif

@main
struct CyphrApp: App {
    @StateObject private var authManager = AuthenticationManager()
    @StateObject private var networkService = NetworkService.shared
    @StateObject private var messagingService = MessagingService.shared
    
    init() {
        setupAppearance()
        print("🚀 Cyphr Messenger iOS - Starting...")
        print("🎯 PRINCIPLE: ONE DEVICE = ONE CYPHR ID")

        // CRITICAL: Clean up any stale data on launch
        // TODO: Add CleanupUtility.swift to Xcode project
        // if CleanupUtility.hasStaleData() {
        //     print("⚠️ Detected stale data - cleaning up...")
        //     CleanupUtility.cleanStaleData()
        // }

        // Removed stale inline cleanup to avoid unintended identity deletion.

        // Test network connectivity after a short delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            Task {
                print("🔍 Testing backend connectivity from App init...")
                let isConnected = await NetworkService.shared.testConnectivity()
                if isConnected {
                    print("✅ Backend connectivity confirmed!")
                } else {
                    print("❌ Backend connectivity FAILED!")
                    if let error = NetworkService.shared.connectionError {
                        print("   Error: \(error)")
                    }
                }
            }
        }
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authManager)
                .environmentObject(networkService)
                .environmentObject(messagingService)
                .onAppear {
                    Task {
                        await authManager.checkAuthentication()
                    }
                }
        }
    }
    
    private func setupAppearance() {
        // Dark theme by default
        #if os(iOS)
        UINavigationBar.appearance().largeTitleTextAttributes = [
            .foregroundColor: UIColor.white
        ]
        UINavigationBar.appearance().titleTextAttributes = [
            .foregroundColor: UIColor.white
        ]
        UINavigationBar.appearance().barTintColor = UIColor(red: 0.1, green: 0.1, blue: 0.2, alpha: 1)

        // Modern glassy TabBar appearance
        let tabAppearance = UITabBarAppearance()
        tabAppearance.configureWithTransparentBackground()
        tabAppearance.backgroundEffect = UIBlurEffect(style: .systemUltraThinMaterialDark)
        tabAppearance.backgroundColor = .clear
        // Selected state
        tabAppearance.stackedLayoutAppearance.selected.iconColor = UIColor.systemPurple
        tabAppearance.stackedLayoutAppearance.selected.titleTextAttributes = [.foregroundColor: UIColor.systemPurple]
        tabAppearance.inlineLayoutAppearance.selected.iconColor = UIColor.systemPurple
        tabAppearance.inlineLayoutAppearance.selected.titleTextAttributes = [.foregroundColor: UIColor.systemPurple]
        tabAppearance.compactInlineLayoutAppearance.selected.iconColor = UIColor.systemPurple
        tabAppearance.compactInlineLayoutAppearance.selected.titleTextAttributes = [.foregroundColor: UIColor.systemPurple]
        // Unselected state
        let unselectedColor = UIColor(white: 1.0, alpha: 0.6)
        tabAppearance.stackedLayoutAppearance.normal.iconColor = unselectedColor
        tabAppearance.stackedLayoutAppearance.normal.titleTextAttributes = [.foregroundColor: unselectedColor]
        tabAppearance.inlineLayoutAppearance.normal.iconColor = unselectedColor
        tabAppearance.inlineLayoutAppearance.normal.titleTextAttributes = [.foregroundColor: unselectedColor]
        tabAppearance.compactInlineLayoutAppearance.normal.iconColor = unselectedColor
        tabAppearance.compactInlineLayoutAppearance.normal.titleTextAttributes = [.foregroundColor: unselectedColor]

        let tabBar = UITabBar.appearance()
        tabBar.standardAppearance = tabAppearance
        tabBar.scrollEdgeAppearance = tabAppearance
        tabBar.isTranslucent = true
        tabBar.tintColor = UIColor.systemPurple
        #endif
    }
}

// MARK: - Content View
struct ContentView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    
    var body: some View {
        Group {
            if authManager.isCheckingAuth {
                SplashView()
            } else if authManager.isAuthenticated {
                MainTabView()
            } else {
                WelcomeView()
            }
        }
        .animation(.easeInOut(duration: 0.3), value: authManager.isAuthenticated)
        .animation(.easeInOut(duration: 0.3), value: authManager.isCheckingAuth)
    }
}

// MARK: - Splash View
struct SplashView: View {
    @State private var scale = 0.9
    @State private var opacity = 0.7
    @State private var glowAmount = 0.5
    
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(red: 0.1, green: 0.1, blue: 0.2),
                    Color(red: 0.05, green: 0.05, blue: 0.15)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()
            
            VStack(spacing: 25) {
                // Cyphr Logo with neon glow effect
                ZStack {
                    Group {
                        #if os(iOS)
                        if UIImage(named: "CyphrLogo") != nil {
                            Image("CyphrLogo")
                                .resizable()
                                .scaledToFit()
                                .frame(width: 120, height: 120)
                        } else {
                            Circle()
                                .fill(
                                    LinearGradient(
                                        colors: [.purple, .blue, .cyan],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                )
                                .overlay(
                                    Text("C")
                                        .font(.system(size: 72, weight: .bold, design: .rounded))
                                        .foregroundColor(.white)
                                )
                        }
                        #else
                        Circle()
                            .fill(
                                LinearGradient(
                                    colors: [.purple, .blue, .cyan],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .overlay(
                                Text("C")
                                    .font(.system(size: 72, weight: .bold, design: .rounded))
                                    .foregroundColor(.white)
                            )
                        #endif
                    }
                    .frame(width: 120, height: 120)
                    .shadow(color: .cyan, radius: glowAmount * 30)
                    .shadow(color: .purple.opacity(0.8), radius: glowAmount * 40)
                    .shadow(color: .blue.opacity(0.6), radius: glowAmount * 50)
                    .scaleEffect(scale)
                    .opacity(opacity)
                }
                
                Text("Cyphr Messenger")
                    .font(.system(size: 36, weight: .bold, design: .rounded))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.white, .white.opacity(0.9)],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .opacity(opacity)
                
                Text("Post-Quantum Secure Messaging")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(.white.opacity(0.7))
                    .opacity(opacity)
            }
        }
        .onAppear {
            // Initial fade in
            withAnimation(.easeOut(duration: 0.5)) {
                scale = 1.0
                opacity = 1.0
            }
            // Neon pulse animation
            withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
                glowAmount = 1.0
            }
        }
    }
}

// MARK: - Main Tab View
struct MainTabView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    @State private var selectedTab = 0
    
    var body: some View {
        TabView(selection: $selectedTab) {
            ChatsView()
                .tabItem {
                    Label("Chats", systemImage: "message.fill")
                }
                .tag(0)
            
            WalletView()
                .tabItem {
                    Label("Wallet", systemImage: "creditcard.fill")
                }
                .tag(1)
            
            ProfileView()
                .tabItem {
                    Label("Profile", systemImage: "person.circle.fill")
                }
                .tag(2)
            
            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gear")
                }
                .tag(3)
        }
        .accentColor(.purple)
        .onAppear {
            print("🎉 User entered main app: @\(authManager.currentUserId ?? "unknown")")
        }
    }
}

// MARK: - Authentication Manager
class AuthenticationManager: ObservableObject {
    @Published var isAuthenticated = false
    @Published var isCheckingAuth = true
    @Published var currentUser: User?
    @Published var currentUserId: String?
    
    // 🎯 КРИТИЧЕСКАЯ ФИЧА: ОДНО УСТРОЙСТВО = ОДИН CYPHR ID
    @Published var hasDeviceIdentity = false
    @Published var deviceCyphrId: String?
    
    private let cyphrIdentity = CyphrIdentity.shared
    private let networkService = NetworkService.shared
    private let authService = AuthenticationService.shared
    private var cancellables = Set<AnyCancellable>()
    
    init() {
        print("🔐 AuthenticationManager initialized")
        setupNotificationListeners()
    }
    
    private func setupNotificationListeners() {
        // Listen for successful registration (auto-login after sign up)
        NotificationCenter.default.publisher(for: Notification.Name("UserRegistered"))
            .sink { [weak self] notification in
                print("📢 Received UserRegistered notification")
                Task { @MainActor in
                    // После регистрации - мгновенный автологин
                    if let cyphrId = notification.userInfo?["cyphrId"] as? String,
                       let token = notification.userInfo?["token"] as? String {
                        print("🚀 Auto-login after registration: @\(cyphrId)")
                        self?.completeAuthentication(cyphrId: cyphrId, token: token)
                    }
                }
            }
            .store(in: &cancellables)
        
        // Listen for login notifications
        NotificationCenter.default.publisher(for: Notification.Name("UserLoggedIn"))
            .sink { [weak self] notification in
                print("📢 Received UserLoggedIn notification")
                Task { @MainActor in
                    if let cyphrId = notification.userInfo?["cyphrId"] as? String,
                       let token = notification.userInfo?["token"] as? String {
                        print("👤 Manual login: @\(cyphrId)")
                        self?.completeAuthentication(cyphrId: cyphrId, token: token)
                    }
                }
            }
            .store(in: &cancellables)
        
        // Listen for logout notifications
        NotificationCenter.default.publisher(for: Notification.Name("UserLoggedOut"))
            .sink { [weak self] _ in
                print("📢 Received UserLoggedOut notification")
                Task { @MainActor in
                    self?.logout()
                }
            }
            .store(in: &cancellables)
    }
    
    @MainActor
    private func completeAuthentication(cyphrId: String, token: String) {
        self.isAuthenticated = true
        self.currentUserId = cyphrId
        self.hasDeviceIdentity = true
        self.deviceCyphrId = cyphrId
        // Keep global identity in sync for UI bindings (e.g., ProfileView)
        CyphrIdentity.shared.setCurrentCyphrId(cyphrId)
        
        // Сохранить сессию
        AuthTokenStore.save(token)
        UserDefaults.standard.set(cyphrId, forKey: "cyphr_id")
        UserDefaults.standard.set(true, forKey: "device_has_identity")
        UserDefaults.standard.set(Date(), forKey: "auth_token_date")
        
        print("✅ Authentication completed: @\(cyphrId)")
        print("🎯 Device identity bound: \(cyphrId)")
    }
    
    @MainActor
    func checkAuthentication() async {
        print("🔍 Checking authentication...")
        isCheckingAuth = true

        // 🎯 ПРИНЦИП: ОДНО УСТРОЙСТВО = ОДИН CYPHR ID
        // CRITICAL: First check if we have ANY stored data that needs protection
        let hasStoredUsername = UserDefaults.standard.string(forKey: "cyphr_id") != nil

        if hasStoredUsername {
            // Device might have identity - require Face ID FIRST
            print("🔐 Device has stored data - requesting biometric authentication...")

            #if os(iOS)
            do {
                // Request Face ID/Touch ID immediately
                _ = try await BiometricAuthService.shared.authenticate(
                    reason: "Authenticate to access your Cyphr identity",
                    allowPINFallback: false  // Don't allow PIN here, just biometric check
                )
                print("✅ Biometric authentication successful")
            } catch {
                // Face ID failed/cancelled - treat as no identity
                print("❌ Biometric authentication failed - treating as new device")
                hasDeviceIdentity = false
                deviceCyphrId = nil
                isAuthenticated = false
                currentUserId = nil
                isCheckingAuth = false
                return
            }
            #endif
        }

        // Now check for stored identity AFTER biometric success
        do {
            if let storedCyphrId = try await cyphrIdentity.checkStoredIdentity() {
                // У устройства есть сохраненная identity
                print("📱 Device has stored identity: @\(storedCyphrId)")

                // Validate existence on server via recovery/init; if not found, wipe local identity
                do {
                    let initResp = try await networkService.initiateRecovery(cyphrId: storedCyphrId)
                    if initResp.success {
                        // User exists (server returned challenge/ttl)
                        hasDeviceIdentity = true
                        deviceCyphrId = storedCyphrId
                    } else {
                        hasDeviceIdentity = true // default safe
                        deviceCyphrId = storedCyphrId
                    }
                } catch let netErr as NetworkError {
                    switch netErr {
                    case .notFound:
                        print("🧹 Server reports @\\(storedCyphrId) NOT FOUND — clearing local identity")
                        cyphrIdentity.deleteIdentity()
                        AuthTokenStore.clear()
                        hasDeviceIdentity = false
                        deviceCyphrId = nil
                        isAuthenticated = false
                        currentUserId = nil
                        isCheckingAuth = false
                        return
                    case .noConnection:
                        print("⚠️ Offline during challenge check — keeping local identity state")
                        hasDeviceIdentity = true
                        deviceCyphrId = storedCyphrId
                    default:
                        print("ℹ️ Challenge check error (keeping local identity): \\((netErr as Error).localizedDescription)")
                        hasDeviceIdentity = true
                        deviceCyphrId = storedCyphrId
                    }
                } catch {
                    print("ℹ️ Challenge check unexpected error (keeping local identity): \\(error)")
                    hasDeviceIdentity = true
                    deviceCyphrId = storedCyphrId
                }
                
                // 2. Проверяем есть ли активная JWT сессия
                if let token = AuthTokenStore.load(),
                   !token.isEmpty,
                   isTokenValid(token) {
                    print("🎫 Valid active session found - auto-login")
                    
                    // Есть валидная сессия - сразу в приложение
                    self.isAuthenticated = true
                    self.currentUserId = storedCyphrId
                    // Sync shared identity for UI bindings
                    CyphrIdentity.shared.setCurrentCyphrId(storedCyphrId)
                    self.isCheckingAuth = false
                    return
                }
                
                print("❌ No valid session - user needs to unlock device identity")
                // 3. Нет валидной сессии - показать Welcome с кнопкой "Unlock"
                self.isAuthenticated = false
                self.currentUserId = nil // НЕ устанавливаем currentUserId пока не разлочен
                
            } else {
                print("🆕 Device has NO identity - completely new device")
                // У устройства нет identity - новый пользователь или новое устройство
                hasDeviceIdentity = false
                deviceCyphrId = nil
                isAuthenticated = false
                currentUserId = nil
            }
        } catch {
            print("❌ Error checking device identity: \(error)")
            // В случае ошибки - показываем как новое устройство
            hasDeviceIdentity = false
            deviceCyphrId = nil
            isAuthenticated = false
            currentUserId = nil
        }
        
        isCheckingAuth = false
        print("🔍 Authentication check completed. Has identity: \(hasDeviceIdentity), Authenticated: \(isAuthenticated)")
    }
    
    private func isTokenValid(_ token: String) -> Bool {
        // Простая проверка на истечение JWT
        // TODO: Implement proper JWT validation
        guard !token.isEmpty else { return false }
        
        // Проверяем возраст токена
        if let tokenDate = UserDefaults.standard.object(forKey: "auth_token_date") as? Date {
            let daysSinceToken = Calendar.current.dateComponents([.day], from: tokenDate, to: Date()).day ?? 0
            return daysSinceToken < 7 // Токен валиден 7 дней
        }
        
        return true // Если нет даты - считаем валидным (first time)
    }
    
    @MainActor
    func logout() {
        print("📤 Logging out user...")
        isAuthenticated = false
        currentUser = nil
        
        // Очистить только сессию, identity остается на устройстве
        AuthTokenStore.clear()
        
        // Отключить messaging
        MessagingService.shared.disconnect()
        
        print("📤 User logged out (identity preserved on device)")
    }
    
    @MainActor
    func deleteDeviceIdentity() {
        print("🗑️ Deleting device identity permanently...")
        
        // КРИТИЧЕСКАЯ ОПЕРАЦИЯ: Полное удаление identity с устройства
        cyphrIdentity.deleteIdentity()
        
        hasDeviceIdentity = false
        deviceCyphrId = nil
        isAuthenticated = false
        currentUser = nil
        currentUserId = nil
        
        // Очистить все данные
        AuthTokenStore.clear()
        UserDefaults.standard.removeObject(forKey: "cyphr_id")
        UserDefaults.standard.removeObject(forKey: "device_has_identity")
        
        print("🗑️ Device identity completely deleted - device is now clean")
    }
}
