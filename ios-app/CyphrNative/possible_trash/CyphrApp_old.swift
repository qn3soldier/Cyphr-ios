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
        UITabBar.appearance().barTintColor = UIColor(red: 0.1, green: 0.1, blue: 0.2, alpha: 1)
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
                // Real Cyphr Logo with neon glow effect
                Image("CyphrLogo")
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 120, height: 120)
                    .shadow(color: .cyan, radius: glowAmount * 30)
                    .shadow(color: .purple.opacity(0.8), radius: glowAmount * 40)
                    .shadow(color: .blue.opacity(0.6), radius: glowAmount * 50)
                    .scaleEffect(scale)
                    .opacity(opacity)
                
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
    }
}

// MARK: - Authentication Manager

class AuthenticationManager: ObservableObject {
    @Published var isAuthenticated = false
    @Published var isCheckingAuth = true
    @Published var currentUser: User?
    @Published var currentUserId: String?
    
    private let cyphrIdentity = CyphrIdentity.shared
    private let networkService = NetworkService.shared
    private let authService = AuthenticationService.shared
    private var cancellables = Set<AnyCancellable>()
    
    init() {
        // Listen for login notifications
        NotificationCenter.default.publisher(for: Notification.Name("UserLoggedIn"))
            .sink { [weak self] notification in
                Task { @MainActor in
                    self?.isAuthenticated = true
                    if let cyphrId = notification.userInfo?["cyphrId"] as? String {
                        self?.currentUserId = cyphrId
                    } else if let stored = UserDefaults.standard.string(forKey: "cyphr_id") {
                        self?.currentUserId = stored
                    }
                }
            }
            .store(in: &cancellables)
        
        // Listen for logout notifications
        NotificationCenter.default.publisher(for: Notification.Name("UserLoggedOut"))
            .sink { [weak self] _ in
                Task { @MainActor in
                    self?.isAuthenticated = false
                    self?.currentUser = nil
                    self?.currentUserId = nil
                }
            }
            .store(in: &cancellables)
    }
    
    @MainActor
    func checkAuthentication() async {
        isCheckingAuth = true
        
        // 1) Если уже есть валидный токен, считаем аутентифицированным
        if let token = AuthTokenStore.load(), !token.isEmpty,
           let storedId = UserDefaults.standard.string(forKey: "cyphr_id"), !storedId.isEmpty {
            self.isAuthenticated = true
            self.currentUserId = storedId
            self.isCheckingAuth = false
            return
        }
        
        // 2) Попробовать авто-логин, если локальная identity есть (Face ID один раз)
        let autoLoggedIn = await authService.autoLoginIfPossible()
        if autoLoggedIn {
            self.isAuthenticated = true
            self.currentUserId = UserDefaults.standard.string(forKey: "cyphr_id")
            self.isCheckingAuth = false
            return
        }
        
        // 3) Нет локальной identity или авто-логин не удался — показать Welcome
        if let username = await cyphrIdentity.checkStoredIdentity() {
            // Локальный ID есть, но токена нет или логин не прошел — оставим пользователя на Welcome для явного входа
            self.currentUserId = username
        } else if let udId = UserDefaults.standard.string(forKey: "cyphr_id"), !udId.isEmpty {
            self.currentUserId = udId
        } else {
            self.currentUserId = nil
        }
        
        isAuthenticated = false
        isCheckingAuth = false
    }
    
    func logout() {
        isAuthenticated = false
        currentUser = nil
        AuthTokenStore.clear()
        UserDefaults.standard.removeObject(forKey: "cyphr_id")
        MessagingService.shared.disconnect()
    }
}
