import SwiftUI

struct CallOverlayView: View {
    let session: CallSession
    let onAccept: (() -> Void)?
    let onDecline: () -> Void
    let onToggleMute: (() -> Void)?

    private var title: String {
        switch session.state {
        case .dialing:
            return "Calling…"
        case .ringing:
            return session.direction == .incoming ? "Incoming Call" : "Ringing…"
        case .connecting:
            return "Connecting…"
        case .active:
            return "Connected"
        case .ended:
            return "Call Ended"
        case .failed:
            return "Call Failed"
        }
    }

    private var subtitle: String {
        session.peerName ?? session.peerId
    }

    var body: some View {
        VStack(spacing: 16) {
            HStack(alignment: .center, spacing: 16) {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [Color.purple.opacity(0.7), Color.blue.opacity(0.7)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 52, height: 52)
                    .overlay(
                        Text(String(subtitle.prefix(1)).uppercased())
                            .font(.title3.bold())
                            .foregroundColor(.white)
                    )

                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.headline)
                        .foregroundColor(.white)
                    Text(subtitle)
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.7))
                    if let reason = session.failureReason, session.state == .failed {
                        Text(reason)
                            .font(.footnote)
                            .foregroundColor(.red.opacity(0.8))
                    }
                }

                Spacer()
            }

            HStack(spacing: 12) {
                if session.direction == .incoming && session.state == .ringing {
                    Button(action: { onAccept?() }) {
                        Label("Accept", systemImage: "phone.fill.arrow.up.right")
                            .font(.callout.bold())
                            .foregroundColor(.black)
                            .padding(.horizontal, 18)
                            .padding(.vertical, 10)
                            .background(Color.green)
                            .cornerRadius(20)
                    }
                }

                if let toggleMute = onToggleMute, session.state == .active {
                    Button(action: toggleMute) {
                        Label("Mute", systemImage: "mic.slash.fill")
                            .font(.callout.bold())
                            .foregroundColor(.white)
                            .padding(.horizontal, 18)
                            .padding(.vertical, 10)
                            .background(Color.white.opacity(0.15))
                            .cornerRadius(20)
                    }
                }

                Button(action: onDecline) {
                    Label(session.state == .active ? "End" : "Decline", systemImage: "phone.down.fill")
                        .font(.callout.bold())
                        .foregroundColor(.white)
                        .padding(.horizontal, 18)
                        .padding(.vertical, 10)
                        .background(Color.red)
                        .cornerRadius(20)
                }
            }
        }
        .padding(18)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(Color.black.opacity(0.65))
                .overlay(
                    RoundedRectangle(cornerRadius: 24, style: .continuous)
                        .stroke(Color.white.opacity(0.12), lineWidth: 1)
                )
                .shadow(color: .black.opacity(0.4), radius: 12, x: 0, y: 8)
        )
        .padding(.horizontal, 20)
    }
}

struct CallOverlayView_Previews: PreviewProvider {
    static var previews: some View {
        CallOverlayView(
            session: CallSession(
                id: UUID().uuidString,
                peerId: "@quantum",
                peerName: "Quantum User",
                isVideo: false,
                direction: .incoming,
                state: .ringing,
                startedAt: Date()
            ),
            onAccept: {},
            onDecline: {},
            onToggleMute: nil
        )
        .padding()
        .background(Color.black)
    }
}
