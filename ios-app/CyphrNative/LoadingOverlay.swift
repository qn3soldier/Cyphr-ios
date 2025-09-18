import SwiftUI

struct LoadingOverlay: View {
    let message: String
    var progress: Double? = nil
    var showCancelButton: Bool = false
    var onCancel: (() -> Void)? = nil
    
    @State private var rotationAngle: Double = 0
    @State private var scaleEffect: CGFloat = 1.0
    
    var body: some View {
        ZStack {
            // Semi-transparent background
            Color.black.opacity(0.4)
                .ignoresSafeArea()
                .allowsHitTesting(true)
            
            // Loading content
            VStack(spacing: 20) {
                // Loading indicator
                if progress == nil {
                    // Indeterminate progress
                    CustomLoadingIndicator()
                        .frame(width: 60, height: 60)
                } else {
                    // Determinate progress
                    CircularProgressView(progress: progress!)
                        .frame(width: 60, height: 60)
                }
                
                // Message
                Text(message)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(.white)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                
                // Progress percentage if available
                if let progress = progress {
                    Text("\(Int(progress * 100))%")
                        .font(.system(size: 14, weight: .regular))
                        .foregroundColor(.white.opacity(0.8))
                }
                
                // Cancel button if needed
                if showCancelButton, let onCancel = onCancel {
                    Button(action: onCancel) {
                        Text("Cancel")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(.white)
                            .padding(.horizontal, 20)
                            .padding(.vertical, 8)
                            .background(
                                Capsule()
                                    .fill(Color.red.opacity(0.8))
                            )
                    }
                    .padding(.top, 10)
                }
            }
            .padding(30)
            .background(
                BlurView(style: .dark)
                    .cornerRadius(20)
                    .shadow(color: .black.opacity(0.3), radius: 10, x: 0, y: 5)
            )
            .scaleEffect(scaleEffect)
            .onAppear {
                withAnimation(.easeOut(duration: 0.3)) {
                    scaleEffect = 1.0
                }
            }
        }
    }
}

// MARK: - Custom Loading Indicator

struct CustomLoadingIndicator: View {
    @State private var isAnimating = false
    
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Outer ring
                Circle()
                    .stroke(
                        LinearGradient(
                            gradient: Gradient(colors: [
                                Color.purple.opacity(0.3),
                                Color.purple.opacity(0.1)
                            ]),
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 4
                    )
                
                // Animated arc
                Circle()
                    .trim(from: 0, to: 0.7)
                    .stroke(
                        LinearGradient(
                            gradient: Gradient(colors: [
                                Color.purple,
                                Color.blue
                            ]),
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        style: StrokeStyle(
                            lineWidth: 4,
                            lineCap: .round
                        )
                    )
                    .rotationEffect(Angle(degrees: isAnimating ? 360 : 0))
                    .animation(
                        Animation.linear(duration: 1.5)
                            .repeatForever(autoreverses: false),
                        value: isAnimating
                    )
                
                // Center pulse effect
                Circle()
                    .fill(
                        RadialGradient(
                            gradient: Gradient(colors: [
                                Color.purple.opacity(0.5),
                                Color.purple.opacity(0)
                            ]),
                            center: .center,
                            startRadius: 5,
                            endRadius: 20
                        )
                    )
                    .scaleEffect(isAnimating ? 1.2 : 0.8)
                    .opacity(isAnimating ? 0.5 : 1.0)
                    .animation(
                        Animation.easeInOut(duration: 1.0)
                            .repeatForever(autoreverses: true),
                        value: isAnimating
                    )
            }
            .frame(width: geometry.size.width, height: geometry.size.height)
            .onAppear {
                isAnimating = true
            }
        }
    }
}

// MARK: - Circular Progress View

struct CircularProgressView: View {
    let progress: Double
    
    var body: some View {
        ZStack {
            // Background circle
            Circle()
                .stroke(
                    Color.white.opacity(0.2),
                    lineWidth: 6
                )
            
            // Progress circle
            Circle()
                .trim(from: 0, to: CGFloat(min(progress, 1.0)))
                .stroke(
                    LinearGradient(
                        gradient: Gradient(colors: [
                            Color.purple,
                            Color.blue
                        ]),
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    style: StrokeStyle(
                        lineWidth: 6,
                        lineCap: .round
                    )
                )
                .rotationEffect(Angle(degrees: -90))
                .animation(.easeInOut(duration: 0.3), value: progress)
        }
    }
}

// MARK: - Blur View (UIKit Integration)

struct BlurView: UIViewRepresentable {
    let style: UIBlurEffect.Style
    
    func makeUIView(context: Context) -> UIVisualEffectView {
        let view = UIVisualEffectView(effect: UIBlurEffect(style: style))
        return view
    }
    
    func updateUIView(_ uiView: UIVisualEffectView, context: Context) {
        uiView.effect = UIBlurEffect(style: style)
    }
}

// MARK: - Convenience Extensions

extension View {
    /// Adds a loading overlay to any view
    func loadingOverlay(
        isPresented: Binding<Bool>,
        message: String = "Loading...",
        progress: Double? = nil,
        showCancelButton: Bool = false,
        onCancel: (() -> Void)? = nil
    ) -> some View {
        ZStack {
            self
            
            if isPresented.wrappedValue {
                LoadingOverlay(
                    message: message,
                    progress: progress,
                    showCancelButton: showCancelButton,
                    onCancel: onCancel
                )
            }
        }
    }
}

// MARK: - Common Loading Messages

struct LoadingMessages {
    static let authenticating = "Authenticating..."
    static let generatingKeys = "Generating secure keys..."
    static let encryptingMessage = "Encrypting message..."
    static let decryptingMessage = "Decrypting message..."
    static let sendingMessage = "Sending message..."
    static let loadingChats = "Loading conversations..."
    static let connectingToServer = "Connecting to server..."
    static let syncingData = "Syncing data..."
    static let uploadingMedia = "Uploading media..."
    static let downloadingMedia = "Downloading media..."
    static let processingImage = "Processing image..."
    static let initializingCall = "Initializing secure call..."
    static let creatingIdentity = "Creating your Cyphr identity..."
    static let registeringDevice = "Registering device..."
    static let verifyingIdentity = "Verifying identity..."
    static let resettingIdentity = "Resetting identity..."
    static let backingUpData = "Backing up data..."
    static let restoringData = "Restoring from backup..."
}

// MARK: - Preview

struct LoadingOverlay_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            // Indeterminate loading
            LoadingOverlay(
                message: "Loading conversations..."
            )
            .previewDisplayName("Indeterminate")
            
            // Progress loading
            LoadingOverlay(
                message: "Uploading file...",
                progress: 0.65
            )
            .previewDisplayName("With Progress")
            
            // With cancel button
            LoadingOverlay(
                message: "Processing large file...",
                progress: 0.35,
                showCancelButton: true,
                onCancel: { print("Cancelled") }
            )
            .previewDisplayName("With Cancel")
            
            // Usage example
            ContentViewExample()
                .previewDisplayName("Usage Example")
        }
    }
}

// Example content view for preview
private struct ContentViewExample: View {
    @State private var isLoading = false
    @State private var progress: Double = 0
    
    var body: some View {
        ZStack {
            LinearGradient(
                gradient: Gradient(colors: [.blue, .purple]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()
            
            VStack(spacing: 20) {
                Text("Content View")
                    .font(.largeTitle)
                    .foregroundColor(.white)
                
                Button("Show Loading") {
                    isLoading = true
                    simulateProgress()
                }
                .padding()
                .background(Color.white)
                .cornerRadius(10)
            }
        }
        .loadingOverlay(
            isPresented: $isLoading,
            message: "Uploading file...",
            progress: progress > 0 ? progress : nil,
            showCancelButton: true,
            onCancel: {
                isLoading = false
                progress = 0
            }
        )
    }
    
    private func simulateProgress() {
        Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { timer in
            progress += 0.05
            if progress >= 1.0 {
                timer.invalidate()
                isLoading = false
                progress = 0
            }
        }
    }
}