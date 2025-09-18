import SwiftUI

struct AuthMethodSelectionView: View {
    @State private var selectedMethod: AuthMethod? = nil
    @State private var phoneNumber = ""
    @State private var countryCode = "+1"
    @State private var showingCountryPicker = false
    @State private var isSignUp = true
    
    enum AuthMethod {
        case phone
        case email
        case cyphrId
    }
    
    var body: some View {
        ZStack {
            // Dark gradient background
            LinearGradient(
                colors: [
                    Color(red: 0.05, green: 0.05, blue: 0.1),
                    Color(red: 0.1, green: 0.05, blue: 0.15)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()
            
            VStack(spacing: 30) {
                // Header with logo
                VStack(spacing: 15) {
                    // Custom logo (atom + message icon)
                    ZStack {
                        Circle()
                            .strokeBorder(
                                LinearGradient(
                                    colors: [
                                        Color(red: 0.4, green: 0.0, blue: 1.0).opacity(0.8),
                                        Color(red: 0.6, green: 0.2, blue: 1.0).opacity(0.8)
                                    ],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ),
                                lineWidth: 2
                            )
                            .background(
                                Circle()
                                    .fill(Color.white.opacity(0.05))
                            )
                            .frame(width: 80, height: 80)
                        
                        Image(systemName: "atom")
                            .font(.system(size: 40))
                            .foregroundColor(.white)
                            .overlay(
                                Image(systemName: "message.fill")
                                    .font(.system(size: 16))
                                    .foregroundColor(.white)
                                    .offset(x: 12, y: 12)
                            )
                    }
                    
                    Text("Cyphr Messenger")
                        .font(.title)
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                    
                    Text("Secure messaging with post-quantum encryption")
                        .font(.subheadline)
                        .foregroundColor(Color.gray.opacity(0.8))
                        .multilineTextAlignment(.center)
                }
                .padding(.top, 40)
                
                // Tab switcher
                HStack(spacing: 0) {
                    Button(action: { isSignUp = true }) {
                        Text("Sign Up")
                            .font(.headline)
                            .foregroundColor(isSignUp ? .white : .gray)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(
                                isSignUp ? 
                                Color(red: 0.3, green: 0.3, blue: 0.4).opacity(0.5) :
                                Color.clear
                            )
                    }
                    
                    Button(action: { isSignUp = false }) {
                        Text("Login")
                            .font(.headline)
                            .foregroundColor(!isSignUp ? .white : .gray)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(
                                !isSignUp ? 
                                Color(red: 0.3, green: 0.3, blue: 0.4).opacity(0.5) :
                                Color.clear
                            )
                    }
                }
                .background(Color.white.opacity(0.05))
                .cornerRadius(10)
                .padding(.horizontal, 40)
                
                // Auth method selection
                VStack(spacing: 15) {
                    // Phone Number option
                    AuthMethodButton(
                        icon: "phone.fill",
                        title: "Phone Number",
                        subtitle: "Quick & familiar",
                        isSelected: selectedMethod == .phone,
                        isPremium: false,
                        action: {
                            selectedMethod = .phone
                        }
                    )
                    
                    // Email option
                    AuthMethodButton(
                        icon: "envelope.fill",
                        title: "Email Address",
                        subtitle: "Simple & secure",
                        isSelected: selectedMethod == .email,
                        isPremium: false,
                        action: {
                            selectedMethod = .email
                        }
                    )
                    
                    // Cyphr Identity option
                    AuthMethodButton(
                        icon: "key.fill",
                        title: "Cyphr Identity",
                        subtitle: "Next-generation quantum-safe security",
                        isSelected: selectedMethod == .cyphrId,
                        isPremium: true,
                        action: {
                            selectedMethod = .cyphrId
                        }
                    )
                }
                .padding(.horizontal, 40)
                
                // Input field (only for phone)
                if selectedMethod == .phone {
                    HStack(spacing: 10) {
                        // Country code selector
                        Button(action: { showingCountryPicker = true }) {
                            HStack(spacing: 5) {
                                Text("🇺🇸")  // TODO: Replace with actual flag
                                Text(countryCode)
                                Image(systemName: "chevron.down")
                                    .font(.caption)
                            }
                            .foregroundColor(.white)
                            .padding(.horizontal, 15)
                            .padding(.vertical, 12)
                            .background(Color.white.opacity(0.1))
                            .cornerRadius(10)
                        }
                        
                        // Phone input
                        TextField("", text: $phoneNumber)
                            .placeholder(when: phoneNumber.isEmpty) {
                                Text("Phone number")
                                    .foregroundColor(.gray)
                            }
                            .foregroundColor(.white)
                            .keyboardType(.phonePad)
                            .padding()
                            .background(Color.white.opacity(0.1))
                            .cornerRadius(10)
                    }
                    .padding(.horizontal, 40)
                }
                
                Spacer()
                
                // Continue button
                Button(action: {
                    // Handle continue action
                }) {
                    HStack {
                        Text("Continue")
                            .fontWeight(.semibold)
                        Image(systemName: "arrow.right")
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(
                        LinearGradient(
                            colors: selectedMethod != nil ? 
                                [Color(red: 0.4, green: 0.0, blue: 1.0),
                                 Color(red: 0.6, green: 0.2, blue: 1.0)] :
                                [Color.gray.opacity(0.3), Color.gray.opacity(0.3)],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .cornerRadius(15)
                }
                .disabled(selectedMethod == nil)
                .padding(.horizontal, 40)
                
                // Footer
                HStack(spacing: 5) {
                    Image(systemName: "lock.fill")
                        .font(.caption)
                    Text("End-to-end and post-quantum encrypted.")
                        .font(.caption)
                }
                .foregroundColor(.gray)
                .padding(.bottom, 30)
            }
        }
    }
}

// Auth Method Button Component
struct AuthMethodButton: View {
    let icon: String
    let title: String
    let subtitle: String
    let isSelected: Bool
    let isPremium: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 15) {
                // Icon
                ZStack {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(
                            isSelected ? 
                            LinearGradient(
                                colors: [
                                    Color(red: 0.4, green: 0.0, blue: 1.0),
                                    Color(red: 0.6, green: 0.2, blue: 1.0)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ) :
                            LinearGradient(
                                colors: [Color.gray.opacity(0.2), Color.gray.opacity(0.2)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 50, height: 50)
                    
                    Image(systemName: icon)
                        .font(.title2)
                        .foregroundColor(.white)
                }
                
                // Text
                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(.headline)
                        .foregroundColor(.white)
                    Text(subtitle)
                        .font(.caption)
                        .foregroundColor(.gray)
                }
                
                Spacer()
                
                // Premium badge
                if isPremium {
                    Text("PREMIUM")
                        .font(.caption2)
                        .fontWeight(.bold)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(
                            LinearGradient(
                                colors: [Color.yellow, Color.orange],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .cornerRadius(5)
                }
            }
            .padding()
            .background(
                RoundedRectangle(cornerRadius: 15)
                    .fill(Color.white.opacity(0.05))
                    .overlay(
                        RoundedRectangle(cornerRadius: 15)
                            .strokeBorder(
                                isSelected ? 
                                LinearGradient(
                                    colors: [
                                        Color(red: 0.4, green: 0.0, blue: 1.0).opacity(0.8),
                                        Color(red: 0.6, green: 0.2, blue: 1.0).opacity(0.8)
                                    ],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ) :
                                LinearGradient(
                                    colors: [Color.clear, Color.clear],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ),
                                lineWidth: isSelected ? 2 : 0
                            )
                    )
            )
        }
    }
}

// TextField placeholder extension
extension View {
    func placeholder<Content: View>(
        when shouldShow: Bool,
        alignment: Alignment = .leading,
        @ViewBuilder placeholder: () -> Content) -> some View {
        
        ZStack(alignment: alignment) {
            placeholder().opacity(shouldShow ? 1 : 0)
            self
        }
    }
}

struct AuthMethodSelectionView_Previews: PreviewProvider {
    static var previews: some View {
        AuthMethodSelectionView()
    }
}