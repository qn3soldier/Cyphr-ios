import SwiftUI
import Combine

/// Main Chats Screen - Enterprise Grade UI like WhatsApp/Signal
struct ChatsView: View {
    @StateObject private var messagingService = MessagingService.shared
    @State private var searchText = ""
    @State private var showingNewChat = false
    @State private var showingProfile = false
    @State private var selectedChat: Chat?
    
    var body: some View {
        NavigationView {
            ZStack {
                // Lightning gradient background
                LinearGradient(
                    colors: [
                        Color(red: 0.07, green: 0.08, blue: 0.12),
                        Color(red: 0.05, green: 0.06, blue: 0.10)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()
                
                VStack(spacing: 0) {
                    // Custom navigation header
                    customHeader
                    
                    // Search bar
                    searchBar
                    
                    // Chats list
                    if messagingService.activeChats.isEmpty {
                        emptyStateView
                    } else {
                        chatsList
                    }
                }
            }
            #if os(iOS)
            .navigationBarHidden(true)
            #endif
            .sheet(isPresented: $showingNewChat) {
                NewChatView()
            }
            .sheet(isPresented: $showingProfile) {
                ProfileView()
            }
            .sheet(item: $selectedChat) { chat in
                ChatDetailView(chat: chat)
            }
        }
        .onAppear {
            messagingService.connect()
        }
    }
    
    // MARK: - Custom Header
    
    private var customHeader: some View {
        HStack {
            // Profile button
            Button(action: { showingProfile = true }) {
                Image(systemName: "person.circle.fill")
                    .font(.title2)
                    .foregroundColor(.white.opacity(0.9))
            }
            
            Spacer()
            
            // Title
            VStack(spacing: 2) {
                Text("Chats")
                    .font(.headline)
                    .foregroundColor(.white)
                
                if messagingService.isConnected {
                    HStack(spacing: 4) {
                        Circle()
                            .fill(Color.green)
                            .frame(width: 6, height: 6)
                        Text("Quantum Secured")
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.7))
                    }
                } else {
                    Text("Connecting...")
                        .font(.caption)
                        .foregroundColor(.yellow.opacity(0.7))
                }
            }
            
            Spacer()
            
            // New chat button
            Button(action: { showingNewChat = true }) {
                Image(systemName: "square.and.pencil")
                    .font(.title2)
                    .foregroundColor(.white.opacity(0.9))
            }
        }
        .padding()
        .background(
            // Glassmorphism effect
            Color.white.opacity(0.1)
                .background(.ultraThinMaterial)
        )
    }
    
    // MARK: - Search Bar
    
    private var searchBar: some View {
        HStack {
            Image(systemName: "magnifyingglass")
                .foregroundColor(.white.opacity(0.5))
            
            TextField("Search chats...", text: $searchText)
                .foregroundColor(.white)
                .accentColor(.purple)
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.white.opacity(0.1))
        )
        .padding(.horizontal)
        .padding(.vertical, 8)
    }
    
    // MARK: - Chats List
    
    private var chatsList: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(filteredChats) { chat in
                    ChatRowView(chat: chat)
                        .onTapGesture {
                            selectedChat = chat
                        }
                    
                    Divider()
                        .background(Color.white.opacity(0.1))
                        .padding(.leading, 76)
                }
            }
        }
    }
    
    // MARK: - Empty State
    
    private var emptyStateView: some View {
        VStack(spacing: 24) {
            Spacer()
            
            // Quantum lock icon
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [.purple, .blue],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 120, height: 120)
                    .blur(radius: 20)
                
                Image(systemName: "lock.shield.fill")
                    .font(.system(size: 60))
                    .foregroundColor(.white)
                    .shadow(radius: 10)
            }
            
            VStack(spacing: 8) {
                Text("No Chats Yet")
                    .font(.title2.bold())
                    .foregroundColor(.white)
                
                Text("Start a quantum-secured conversation")
                    .font(.subheadline)
                    .foregroundColor(.white.opacity(0.7))
                    .multilineTextAlignment(.center)
            }
            
            Button(action: { showingNewChat = true }) {
                Label("Start New Chat", systemImage: "plus.message.fill")
                    .font(.headline)
                    .foregroundColor(.black)
                    .padding()
                    .background(
                        LinearGradient(
                            colors: [.white, .white.opacity(0.9)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .cornerRadius(16)
                    .shadow(color: .white.opacity(0.3), radius: 10)
            }
            
            Spacer()
        }
        .padding()
    }
    
    // MARK: - Helpers
    
    private var filteredChats: [Chat] {
        if searchText.isEmpty {
            return messagingService.activeChats
        } else {
            return messagingService.activeChats.filter { chat in
                // Search by participant names or last message
                chat.participants.joined().localizedCaseInsensitiveContains(searchText) ||
                (chat.lastMessage?.content ?? "").localizedCaseInsensitiveContains(searchText)
            }
        }
    }
}

// MARK: - Chat Row View

struct ChatRowView: View {
    let chat: Chat
    @StateObject private var messagingService = MessagingService.shared
    
    private var otherParticipant: String {
        chat.participants.first { $0 != getCurrentCyphrId() } ?? "Unknown"
    }
    
    private var isOnline: Bool {
        messagingService.onlineUsers.contains(otherParticipant)
    }
    
    private var isTyping: Bool {
        messagingService.typingUsers.contains(otherParticipant)
    }
    
    var body: some View {
        HStack(spacing: 12) {
            // Avatar with online indicator
            ZStack(alignment: .bottomTrailing) {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [.purple, .blue],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 56, height: 56)
                    .overlay(
                        Text(otherParticipant.prefix(2).uppercased())
                            .font(.headline)
                            .foregroundColor(.white)
                    )
                
                if isOnline {
                    Circle()
                        .fill(Color.green)
                        .frame(width: 14, height: 14)
                        .overlay(
                            Circle()
                                .stroke(Color.black, lineWidth: 2)
                        )
                }
            }
            
            VStack(alignment: .leading, spacing: 4) {
                // Name and time
                HStack {
                    Text("@\(otherParticipant)")
                        .font(.headline)
                        .foregroundColor(.white)
                    
                    Spacer()
                    
                    if let lastMessage = chat.lastMessage {
                        Text(formatTime(lastMessage.timestamp))
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.5))
                    }
                }
                
                // Last message or typing indicator
                HStack {
                    if isTyping {
                        HStack(spacing: 2) {
                            ForEach(0..<3) { index in
                                Circle()
                                    .fill(Color.purple)
                                    .frame(width: 4, height: 4)
                                    .animation(
                                        Animation.easeInOut(duration: 0.6)
                                            .repeatForever()
                                            .delay(Double(index) * 0.2),
                                        value: isTyping
                                    )
                            }
                            Text("typing...")
                                .font(.subheadline)
                                .foregroundColor(.purple)
                                .italic()
                        }
                    } else if let lastMessage = chat.lastMessage {
                        Text(lastMessage.content)
                            .font(.subheadline)
                            .foregroundColor(.white.opacity(0.7))
                            .lineLimit(1)
                    } else {
                        Text("Tap to start chatting")
                            .font(.subheadline)
                            .foregroundColor(.white.opacity(0.5))
                            .italic()
                    }
                    
                    Spacer()
                    
                    // Unread badge
                    if chat.unreadCount > 0 {
                        Text("\(chat.unreadCount)")
                            .font(.caption.bold())
                            .foregroundColor(.black)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 2)
                            .background(
                                Capsule()
                                    .fill(Color.white)
                            )
                    }
                    
                    // Encryption indicator
                    Image(systemName: "lock.shield.fill")
                        .font(.caption)
                        .foregroundColor(.green.opacity(0.7))
                }
            }
        }
        .padding()
        .contentShape(Rectangle())
    }
    
    private func formatTime(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
    
    private func getCurrentCyphrId() -> String {
        UserDefaults.standard.string(forKey: "cyphr_id") ?? ""
    }
}

// MARK: - Placeholder Views removed - will be in separate files


// MARK: - Preview

struct ChatsView_Previews: PreviewProvider {
    static var previews: some View {
        ChatsView()
    }
}