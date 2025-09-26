import SwiftUI
import Combine

struct CallView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var messagingService = MessagingService.shared

    @State private var session: CallSession
    @State private var callState: CallState
    @State private var callDuration: TimeInterval = 0
    @State private var isMuted = false
    @State private var isSpeakerOn = false
    @State private var isVideoOn = true
    @State private var showEndConfirmation = false

    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    init(session: CallSession) {
        _session = State(initialValue: session)
        _callState = State(initialValue: session.state)
    }

    private var displayName: String { session.peerName ?? session.peerId }
    private var isIncoming: Bool { session.direction == .incoming }
    private var isVideo: Bool { session.isVideo }

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(red: 0.05, green: 0.05, blue: 0.08),
                    Color.black
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 36) {
                callHeader
                Spacer()
                avatarStack
                Spacer()
                callControls
            }
            .padding()
        }
        #if os(iOS)
        .navigationBarHidden(true)
        #endif
        .onReceive(timer) { _ in
            if callState == .active {
                callDuration += 1
            }
        }
        .onReceive(messagingService.$activeCall) { updated in
            guard let updated, updated.id == session.id else { return }
            withAnimation(.easeInOut(duration: 0.2)) {
                session = updated
                callState = updated.state
            }
            if updated.state == .ended || updated.state == .failed {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
                    dismiss()
                }
            }
        }
        .onDisappear {
            if callState != .ended {
                messagingService.endCall(callId: session.id)
            }
        }
        .alert("End Call?", isPresented: $showEndConfirmation) {
            Button("End", role: .destructive) {
                messagingService.endCall(callId: session.id)
                dismiss()
            }
            Button("Cancel", role: .cancel) {}
        }
    }

    private var callHeader: some View {
        VStack(spacing: 10) {
            Text(displayName)
                .font(.system(size: 34, weight: .semibold))
                .foregroundColor(.white)

            Text(session.peerId)
                .font(.callout)
                .foregroundColor(.white.opacity(0.65))

            HStack(spacing: 6) {
                Image(systemName: "lock.shield.fill")
                    .foregroundColor(.green)
                    .font(.caption)
                Text("End-to-end encrypted")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.6))

                if callState == .active {
                    Text("•")
                        .foregroundColor(.white.opacity(0.4))
                    Text(formatDuration(callDuration))
                        .font(.caption.monospacedDigit())
                        .foregroundColor(.white.opacity(0.7))
                }
            }

            Text(statusLabel(for: callState))
                .font(.headline)
                .foregroundColor(.white.opacity(0.8))
        }
        .padding(.top, 40)
    }

    private var avatarStack: some View {
        ZStack {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [
                            Color.purple.opacity(0.35),
                            Color.blue.opacity(0.35)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: isVideo ? 220 : 180, height: isVideo ? 220 : 180)

            Image(systemName: isVideo ? "video.fill" : "phone.fill")
                .font(.system(size: isVideo ? 70 : 60))
                .foregroundColor(.white.opacity(0.7))
        }
        .shadow(color: .purple.opacity(0.4), radius: 20, x: 0, y: 12)
    }

    private var callControls: some View {
        VStack(spacing: 24) {
            if isVideo {
                ToggleButton(title: "Camera", systemImage: isVideoOn ? "video.fill" : "video.slash.fill", isActive: $isVideoOn)
            }

            HStack(spacing: 24) {
                ToggleButton(title: "Mute", systemImage: isMuted ? "mic.slash.fill" : "mic.fill", isActive: $isMuted)

                ToggleButton(title: "Speaker", systemImage: isSpeakerOn ? "speaker.wave.3.fill" : "speaker.wave.2.fill", isActive: $isSpeakerOn)
            }

            HStack(spacing: 24) {
                if isIncoming && callState == .ringing {
                    Button(action: acceptCall) {
                        Label("Accept", systemImage: "phone.fill.arrow.up.right")
                            .font(.headline)
                            .foregroundColor(.black)
                            .frame(width: 140, height: 50)
                            .background(Color.green)
                            .cornerRadius(25)
                    }
                }

                Button(action: endTapped) {
                    Label(callState == .active ? "End" : "Decline", systemImage: "phone.down.fill")
                        .font(.headline)
                        .foregroundColor(.white)
                        .frame(width: 140, height: 50)
                        .background(Color.red)
                        .cornerRadius(25)
                }
            }
        }
        .padding(.bottom, 40)
    }

    private func acceptCall() {
        messagingService.answerCall(callId: session.id, accept: true)
    }

    private func endTapped() {
        if callState == .active {
            showEndConfirmation = true
        } else {
            messagingService.endCall(callId: session.id)
            dismiss()
        }
    }

    private func statusLabel(for state: CallState) -> String {
        switch state {
        case .dialing:
            return "Dialing…"
        case .ringing:
            return isIncoming ? "Incoming call" : "Ringing…"
        case .connecting:
            return "Connecting…"
        case .active:
            return "Connected"
        case .ended:
            return "Call ended"
        case .failed:
            return "Call failed"
        }
    }

    private func formatDuration(_ duration: TimeInterval) -> String {
        let minutes = Int(duration) / 60
        let seconds = Int(duration) % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }
}

private struct ToggleButton: View {
    let title: String
    let systemImage: String
    @Binding var isActive: Bool

    var body: some View {
        Button(action: { isActive.toggle() }) {
            VStack(spacing: 8) {
                Image(systemName: systemImage)
                    .font(.title2)
                Text(title)
                    .font(.caption.bold())
            }
            .foregroundColor(.white)
            .padding()
            .frame(width: 96, height: 96)
            .background(Color.white.opacity(isActive ? 0.25 : 0.12))
            .clipShape(Circle())
        }
    }
}

struct CallView_Previews: PreviewProvider {
    static var previews: some View {
        CallView(
            session: CallSession(
                id: UUID().uuidString,
                peerId: "@alice",
                peerName: "Alice",
                isVideo: false,
                direction: .incoming,
                state: .ringing,
                startedAt: Date()
            )
        )
    }
}
