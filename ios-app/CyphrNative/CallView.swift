import SwiftUI
import Combine
#if os(iOS)
import UIKit
#else
import AppKit
#endif
import AVFoundation
#if os(iOS)
import CallKit
import PushKit
#endif

/// WebRTC Video/Audio Call View - Enterprise Grade like WhatsApp/Signal
struct CallView: View {
    let recipientName: String
    let recipientCyphrId: String
    let isIncoming: Bool
    let isVideo: Bool
    
    @Environment(\.dismiss) private var dismiss
    @StateObject private var callService = CallService.shared
    @State private var callDuration: TimeInterval = 0
    @State private var isMuted = false
    @State private var isSpeakerOn = false
    @State private var isVideoOn = true
    @State private var showingEndCallConfirmation = false
    @State private var callState: CallState = .connecting
    #if os(iOS)
    @State private var localVideoView: UIView?
    @State private var remoteVideoView: UIView?
    #else
    @State private var localVideoView: NSView?
    @State private var remoteVideoView: NSView?
    #endif
    
    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
    
    enum CallState {
        case connecting
        case ringing
        case active
        case ended
        case failed
    }
    
    var body: some View {
        ZStack {
            // Background gradient
            LinearGradient(
                colors: [
                    Color(red: 0.05, green: 0.05, blue: 0.08),
                    Color.black
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()
            
            // Video views (if video call)
            if isVideo && callState == .active {
                videoCallView
            } else {
                audioCallView
            }
            
            // Call controls overlay
            VStack {
                Spacer()
                
                if callState == .active {
                    callControls
                        .padding(.bottom, 50)
                } else if callState == .connecting || callState == .ringing {
                    connectingView
                        .padding(.bottom, 50)
                }
            }
            
            // Status overlay
            if callState == .failed {
                failedCallOverlay
            }
        }
        #if os(iOS)
        .navigationBarHidden(true)
        #endif
        .onAppear {
            startCall()
        }
        .onDisappear {
            endCall()
        }
        .onReceive(timer) { _ in
            if callState == .active {
                callDuration += 1
            }
        }
        .alert("End Call?", isPresented: $showingEndCallConfirmation) {
            Button("End Call", role: .destructive) {
                endCall()
                dismiss()
            }
            Button("Cancel", role: .cancel) {}
        }
    }
    
    // MARK: - Video Call View
    
    private var videoCallView: some View {
        ZStack {
            // Remote video (full screen)
            if let remoteView = remoteVideoView {
                VideoViewRepresentable(view: remoteView)
                    .ignoresSafeArea()
            } else {
                // Placeholder while video loads
                ZStack {
                    Color.black.opacity(0.9)
                    
                    VStack(spacing: 20) {
                        Image(systemName: "person.crop.circle.fill")
                            .font(.system(size: 120))
                            .foregroundColor(.white.opacity(0.3))
                        
                        Text(recipientName)
                            .font(.title2)
                            .foregroundColor(.white.opacity(0.7))
                    }
                }
                .ignoresSafeArea()
            }
            
            // Local video (picture-in-picture)
            VStack {
                HStack {
                    Spacer()
                    
                    if let localView = localVideoView {
                        VideoViewRepresentable(view: localView)
                            .frame(width: 120, height: 160)
                            .cornerRadius(12)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Color.white.opacity(0.3), lineWidth: 1)
                            )
                            .padding()
                            .shadow(color: .black.opacity(0.5), radius: 10)
                    }
                }
                
                Spacer()
            }
            
            // Top bar with call info
            VStack {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(recipientName)
                            .font(.headline)
                            .foregroundColor(.white)
                        
                        HStack(spacing: 6) {
                            Image(systemName: "lock.shield.fill")
                                .font(.caption)
                                .foregroundColor(.green)
                            
                            Text("End-to-end encrypted")
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.7))
                            
                            if callState == .active {
                                Text("•")
                                    .foregroundColor(.white.opacity(0.5))
                                
                                Text(formatDuration(callDuration))
                                    .font(.caption)
                                    .foregroundColor(.white.opacity(0.7))
                                    .monospacedDigit()
                            }
                        }
                    }
                    
                    Spacer()
                }
                .padding()
                .background(
                    LinearGradient(
                        colors: [
                            Color.black.opacity(0.8),
                            Color.black.opacity(0.0)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                
                Spacer()
            }
        }
    }
    
    // MARK: - Audio Call View
    
    private var audioCallView: some View {
        VStack(spacing: 40) {
            Spacer()
            
            // Avatar
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [
                                Color.purple.opacity(0.3),
                                Color.blue.opacity(0.3)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 180, height: 180)
                
                Image(systemName: "person.crop.circle.fill")
                    .font(.system(size: 160))
                    .foregroundColor(.white.opacity(0.9))
            }
            
            // Name and status
            VStack(spacing: 8) {
                Text(recipientName)
                    .font(.largeTitle)
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                
                Text(recipientCyphrId)
                    .font(.body)
                    .foregroundColor(.white.opacity(0.6))
                
                if callState == .active {
                    HStack(spacing: 8) {
                        Image(systemName: "lock.shield.fill")
                            .font(.caption)
                            .foregroundColor(.green)
                        
                        Text(formatDuration(callDuration))
                            .font(.title3)
                            .foregroundColor(.white.opacity(0.9))
                            .monospacedDigit()
                    }
                    .padding(.top, 8)
                } else if callState == .connecting {
                    Text("Connecting...")
                        .font(.body)
                        .foregroundColor(.white.opacity(0.6))
                        .padding(.top, 8)
                } else if callState == .ringing {
                    Text(isIncoming ? "Incoming call..." : "Calling...")
                        .font(.body)
                        .foregroundColor(.white.opacity(0.6))
                        .padding(.top, 8)
                }
            }
            
            Spacer()
        }
    }
    
    // MARK: - Call Controls
    
    private var callControls: some View {
        HStack(spacing: 40) {
            // Mute button
            Button(action: { toggleMute() }) {
                ZStack {
                    Circle()
                        .fill(isMuted ? Color.white : Color.white.opacity(0.2))
                        .frame(width: 64, height: 64)
                    
                    Image(systemName: isMuted ? "mic.slash.fill" : "mic.fill")
                        .font(.title2)
                        .foregroundColor(isMuted ? .black : .white)
                }
            }
            
            // Video toggle (for video calls)
            if isVideo {
                Button(action: { toggleVideo() }) {
                    ZStack {
                        Circle()
                            .fill(!isVideoOn ? Color.white : Color.white.opacity(0.2))
                            .frame(width: 64, height: 64)
                        
                        Image(systemName: isVideoOn ? "video.fill" : "video.slash.fill")
                            .font(.title2)
                            .foregroundColor(!isVideoOn ? .black : .white)
                    }
                }
            }
            
            // Speaker button
            Button(action: { toggleSpeaker() }) {
                ZStack {
                    Circle()
                        .fill(isSpeakerOn ? Color.white : Color.white.opacity(0.2))
                        .frame(width: 64, height: 64)
                    
                    Image(systemName: isSpeakerOn ? "speaker.wave.3.fill" : "speaker.fill")
                        .font(.title2)
                        .foregroundColor(isSpeakerOn ? .black : .white)
                }
            }
            
            // End call button
            Button(action: { showingEndCallConfirmation = true }) {
                ZStack {
                    Circle()
                        .fill(Color.red)
                        .frame(width: 72, height: 72)
                    
                    Image(systemName: "phone.down.fill")
                        .font(.title)
                        .foregroundColor(.white)
                }
            }
        }
        .padding(.horizontal)
    }
    
    // MARK: - Connecting View
    
    private var connectingView: some View {
        VStack(spacing: 30) {
            if isIncoming {
                HStack(spacing: 60) {
                    // Decline
                    Button(action: {
                        declineCall()
                        dismiss()
                    }) {
                        ZStack {
                            Circle()
                                .fill(Color.red)
                                .frame(width: 72, height: 72)
                            
                            Image(systemName: "phone.down.fill")
                                .font(.title)
                                .foregroundColor(.white)
                        }
                    }
                    
                    // Accept
                    Button(action: { acceptCall() }) {
                        ZStack {
                            Circle()
                                .fill(Color.green)
                                .frame(width: 72, height: 72)
                            
                            Image(systemName: "phone.fill")
                                .font(.title)
                                .foregroundColor(.white)
                        }
                    }
                }
            } else {
                // Cancel outgoing call
                Button(action: {
                    cancelCall()
                    dismiss()
                }) {
                    ZStack {
                        Circle()
                            .fill(Color.red)
                            .frame(width: 72, height: 72)
                        
                        Image(systemName: "phone.down.fill")
                            .font(.title)
                            .foregroundColor(.white)
                    }
                }
            }
        }
    }
    
    // MARK: - Failed Call Overlay
    
    private var failedCallOverlay: some View {
        VStack(spacing: 20) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 60))
                .foregroundColor(.yellow)
            
            Text("Call Failed")
                .font(.title)
                .fontWeight(.bold)
                .foregroundColor(.white)
            
            Text("Unable to connect. Please try again.")
                .font(.body)
                .foregroundColor(.white.opacity(0.7))
                .multilineTextAlignment(.center)
            
            Button(action: {
                dismiss()
            }) {
                Text("OK")
                    .font(.headline)
                    .foregroundColor(.white)
                    .padding(.horizontal, 40)
                    .padding(.vertical, 12)
                    .background(Color.blue)
                    .cornerRadius(25)
            }
            .padding(.top, 10)
        }
        .padding(40)
        .background(
            RoundedRectangle(cornerRadius: 20)
                .fill(Color.black.opacity(0.9))
        )
    }
    
    // MARK: - Actions
    
    private func startCall() {
        Task {
            do {
                if isIncoming {
                    callState = .ringing
                } else {
                    callState = .connecting
                    try await callService.initiateCall(
                        to: recipientCyphrId,
                        isVideo: isVideo
                    )
                    callState = .ringing
                }
                
                // Setup video views if needed
                if isVideo {
                    setupVideoViews()
                }
            } catch {
                print("❌ Failed to start call: \(error)")
                callState = .failed
            }
        }
    }
    
    private func acceptCall() {
        Task {
            do {
                try await callService.acceptCall()
                callState = .active
            } catch {
                print("❌ Failed to accept call: \(error)")
                callState = .failed
            }
        }
    }
    
    private func declineCall() {
        Task {
            try? await callService.declineCall()
        }
    }
    
    private func cancelCall() {
        Task {
            try? await callService.cancelCall()
        }
    }
    
    private func endCall() {
        Task {
            try? await callService.endCall()
        }
    }
    
    private func toggleMute() {
        isMuted.toggle()
        callService.setMuted(isMuted)
    }
    
    private func toggleSpeaker() {
        isSpeakerOn.toggle()
        callService.setSpeakerphone(isSpeakerOn)
    }
    
    private func toggleVideo() {
        isVideoOn.toggle()
        callService.setVideoEnabled(isVideoOn)
    }
    
    private func setupVideoViews() {
        // Setup WebRTC video views
        // This would be implemented with actual WebRTC framework
        #if os(iOS)
        localVideoView = UIView()
        remoteVideoView = UIView()
        #endif
    }
    
    private func formatDuration(_ duration: TimeInterval) -> String {
        let minutes = Int(duration) / 60
        let seconds = Int(duration) % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }
}

// MARK: - Call Service (Placeholder)

class CallService: ObservableObject {
    static let shared = CallService()
    
    func initiateCall(to cyphrId: String, isVideo: Bool) async throws {
        // WebRTC implementation
    }
    
    func acceptCall() async throws {
        // WebRTC implementation
    }
    
    func declineCall() async throws {
        // WebRTC implementation
    }
    
    func cancelCall() async throws {
        // WebRTC implementation
    }
    
    func endCall() async throws {
        // WebRTC implementation
    }
    
    func setMuted(_ muted: Bool) {
        // WebRTC implementation
    }
    
    func setSpeakerphone(_ enabled: Bool) {
        // WebRTC implementation
    }
    
    func setVideoEnabled(_ enabled: Bool) {
        // WebRTC implementation
    }
}

// MARK: - Video View Representable

#if os(iOS)
struct VideoViewRepresentable: UIViewRepresentable {
    let view: UIView?
    
    func makeUIView(context: Context) -> UIView {
        let containerView = UIView()
        containerView.backgroundColor = .black
        
        if let videoView = view {
            containerView.addSubview(videoView)
            videoView.translatesAutoresizingMaskIntoConstraints = false
            NSLayoutConstraint.activate([
                videoView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
                videoView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
                videoView.topAnchor.constraint(equalTo: containerView.topAnchor),
                videoView.bottomAnchor.constraint(equalTo: containerView.bottomAnchor)
            ])
        }
        
        return containerView
    }
    
    func updateUIView(_ uiView: UIView, context: Context) {
        // Update if needed
    }
}
#else
struct VideoViewRepresentable: NSViewRepresentable {
    let view: NSView?
    
    func makeNSView(context: Context) -> NSView {
        let containerView = NSView()
        
        if let videoView = view {
            containerView.addSubview(videoView)
            videoView.translatesAutoresizingMaskIntoConstraints = false
            NSLayoutConstraint.activate([
                videoView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
                videoView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
                videoView.topAnchor.constraint(equalTo: containerView.topAnchor),
                videoView.bottomAnchor.constraint(equalTo: containerView.bottomAnchor)
            ])
        }
        
        return containerView
    }
    
    func updateNSView(_ nsView: NSView, context: Context) {
        // Update if needed
    }
}
#endif

// MARK: - Preview

struct CallView_Previews: PreviewProvider {
    static var previews: some View {
        CallView(
            recipientName: "John Doe",
            recipientCyphrId: "@johndoe",
            isIncoming: false,
            isVideo: true
        )
    }
}