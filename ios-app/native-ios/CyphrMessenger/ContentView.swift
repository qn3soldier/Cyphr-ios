/**
 * MAIN CONTENT VIEW - PRESERVING WEB FLOW
 * Welcome → CryptoSignUp → ProfileSetup → PinSetup → Chats
 * EXACT same navigation flow as web version
 */

import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    @State private var isAuthenticated = false
    
    var body: some View {
        NavigationStack {
            Group {
                if !isAuthenticated {
                    // CYPHR ID ONLY Authentication Flow (same as web)
                    WelcomeView()
                } else {
                    // Main App Flow with Tabs (same as web)
                    MainTabView()
                }
            }
        }
        .preferredColorScheme(.dark)
        .background(
            // Lightning theme background (from web version)
            LinearGradient(
                colors: [
                    Color(red: 0.1, green: 0.1, blue: 0.18), // #1a1a2e
                    Color(red: 0.09, green: 0.13, blue: 0.24)  // #16213e
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
        )
        .onReceive(authManager.$isAuthenticated) { authenticated in
            isAuthenticated = authenticated
        }
    }
}