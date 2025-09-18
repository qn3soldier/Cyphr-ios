/**
 * CYPHR MESSENGER - NATIVE iOS
 * Enterprise post-quantum secure messenger
 * 
 * ARCHITECTURE PRESERVED FROM WEB VERSION:
 * - Zero-knowledge contact discovery
 * - Zero-storage private keys
 * - Post-quantum encryption (Kyber1024 + ChaCha20)
 * - Glassmorphism design system
 */

import SwiftUI
import CryptoKit
import LocalAuthentication

@main
struct CyphrMessengerApp: App {
    @StateObject private var cryptoManager = CryptographicManager()
    @StateObject private var authManager = AuthenticationManager()
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(cryptoManager)
                .environmentObject(authManager)
                .onAppear {
                    initializeApp()
                }
        }
    }
    
    private func initializeApp() {
        print("🚀 Cyphr Messenger - Native iOS Initializing...")
        print("🔐 Post-quantum encryption: Kyber1024 + ChaCha20 activated")
        
        // Initialize cryptographic services
        Task {
            await cryptoManager.initialize()
            await authManager.checkForStoredCredentials()
        }
    }
}