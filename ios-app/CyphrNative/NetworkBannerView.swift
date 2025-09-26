import SwiftUI

struct NetworkBannerView: View {
    @ObservedObject private var network = NetworkService.shared

    var body: some View {
        Group {
            if !network.isConnected || network.connectionError != nil {
                HStack(spacing: 12) {
                    Image(systemName: "wifi.exclamationmark")
                        .foregroundColor(.white)
                    Text(network.connectionError ?? "No internet connection")
                        .foregroundColor(.white)
                        .font(.callout)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                    Spacer()
                    Button(action: {
                        Task { _ = await network.testConnectivity() }
                    }) {
                        Text("Retry")
                            .font(.caption)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(Color.white.opacity(0.2))
                            .foregroundColor(.white)
                            .cornerRadius(8)
                    }
                }
                .padding(12)
                .background(Color.orange.opacity(0.9))
                .cornerRadius(12)
                .padding(.horizontal)
            }
        }
        .transition(.move(edge: .top).combined(with: .opacity))
        .animation(.easeInOut(duration: 0.2), value: network.isConnected)
    }
}

