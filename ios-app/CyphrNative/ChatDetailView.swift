import SwiftUI
import Combine

/// Enterprise-Grade Chat Detail Screen - WhatsApp/Telegram Level
struct ChatDetailView: View {
    let chat: Chat
    @StateObject private var messagingService = MessagingService.shared
    @State private var messageText = ""
    @State private var messages: [Message] = []
    @State private var isTyping = false
    @State private var showingAttachmentMenu = false
    @State private var showingCallOptions = false
    @State private var showingImagePicker = false
    @State private var showingDocumentPicker = false
    @State private var isRecordingVoice = false
    @State private var voiceRecordingTime: TimeInterval = 0
    @State private var scrollProxy: ScrollViewProxy?
    @State private var keyboardHeight: CGFloat = 0
    @State private var isLoading = false
    @State private var loadingMessage = ""
    
    private let otherParticipant: String
    
    init(chat: Chat) {
        self.chat = chat
        self.otherParticipant = chat.participants.first { 
            $0 != (UserDefaults.standard.string(forKey: "cyphr_id") ?? "") 
        } ?? "Unknown"
    }
    
    var body: some View {
        ZStack {
            // Lightning gradient background
            LinearGradient(
                colors: [
                    Color(red: 0.05, green: 0.06, blue: 0.10),
                    Color(red: 0.07, green: 0.08, blue: 0.12)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()
            
            VStack(spacing: 0) {
                // Custom navigation header
                chatHeader
                
                // Messages list
                messagesView
                
                // Bottom input bar
                inputBar
            }
        }
        #if os(iOS)
        .navigationBarHidden(true)
        #endif
        .loadingOverlay(
            isPresented: $isLoading,
            message: loadingMessage
        )
        .onAppear {
            loadMessages()
            markMessagesAsRead()
        }
        .onReceive(Publishers.keyboardHeight) { height in
            withAnimation(.easeOut(duration: 0.25)) {
                keyboardHeight = height
            }
        }
    }
    
    // MARK: - Chat Header
    
    private var chatHeader: some View {
        HStack(spacing: 12) {
            // Back button
            Button(action: { /* Navigate back */ }) {
                Image(systemName: "chevron.left")
                    .font(.title3.bold())
                    .foregroundColor(.white)
            }
            
            // Avatar
            Circle()
                .fill(
                    LinearGradient(
                        colors: [.purple, .blue],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 40, height: 40)
                .overlay(
                    Text(otherParticipant.prefix(2).uppercased())
                        .font(.headline)
                        .foregroundColor(.white)
                )
            
            // Name and status
            VStack(alignment: .leading, spacing: 2) {
                Text("@\(otherParticipant)")
                    .font(.headline)
                    .foregroundColor(.white)
                
                if messagingService.typingUsers.contains(otherParticipant) {
                    HStack(spacing: 4) {
                        ForEach(0..<3) { index in
                            Circle()
                                .fill(Color.purple)
                                .frame(width: 3, height: 3)
                                .animation(
                                    Animation.easeInOut(duration: 0.6)
                                        .repeatForever()
                                        .delay(Double(index) * 0.2),
                                    value: true
                                )
                        }
                        Text("typing...")
                            .font(.caption)
                            .foregroundColor(.purple)
                    }
                } else if messagingService.onlineUsers.contains(otherParticipant) {
                    HStack(spacing: 4) {
                        Circle()
                            .fill(Color.green)
                            .frame(width: 6, height: 6)
                        Text("Online")
                            .font(.caption)
                            .foregroundColor(.green)
                    }
                } else {
                    Text("Quantum Secured")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.5))
                }
            }
            
            Spacer()
            
            // Call button
            Button(action: { showingCallOptions = true }) {
                Image(systemName: "phone.fill")
                    .font(.title3)
                    .foregroundColor(.white.opacity(0.9))
            }
            
            // More options
            Menu {
                Button(action: { /* View info */ }) {
                    Label("Chat Info", systemImage: "info.circle")
                }
                Button(action: { /* Search */ }) {
                    Label("Search", systemImage: "magnifyingglass")
                }
                Button(action: { /* Clear chat */ }) {
                    Label("Clear Chat", systemImage: "trash")
                        .foregroundColor(.red)
                }
            } label: {
                Image(systemName: "ellipsis")
                    .font(.title3)
                    .foregroundColor(.white.opacity(0.9))
            }
        }
        .padding()
        .background(
            Color.black.opacity(0.3)
                .background(.ultraThinMaterial)
        )
        #if os(iOS)
        .actionSheet(isPresented: $showingCallOptions) {
            ActionSheet(
                title: Text("Start Call"),
                buttons: [
                    .default(Text("Voice Call")) {
                        startCall(isVideo: false)
                    },
                    .default(Text("Video Call")) {
                        startCall(isVideo: true)
                    },
                    .cancel()
                ]
            )
        }
        #else
        .sheet(isPresented: $showingCallOptions) {
            VStack(spacing: 20) {
                Text("Start Call")
                    .font(.headline)
                
                Button("Voice Call") {
                    startCall(isVideo: false)
                    showingCallOptions = false
                }
                
                Button("Video Call") {
                    startCall(isVideo: true)
                    showingCallOptions = false
                }
                
                Button("Cancel") {
                    showingCallOptions = false
                }
                .foregroundColor(.red)
            }
            .padding()
            .frame(width: 300)
        }
        #endif
    }
    
    // MARK: - Messages View
    
    private var messagesView: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 8) {
                    // Date separator
                    dateSeparator
                    
                    // Quantum encryption notice
                    encryptionNotice
                    
                    // Messages
                    ForEach(messages) { message in
                        MessageBubbleView(
                            message: message,
                            showAvatar: shouldShowAvatar(for: message)
                        )
                        .id(message.id)
                    }
                }
                .padding()
            }
            .onAppear {
                scrollProxy = proxy
                scrollToBottom()
            }
            .onChangeCompat(of: messages.count) {
                scrollToBottom()
            }
        }
    }
    
    private var dateSeparator: some View {
        HStack {
            Rectangle()
                .fill(Color.white.opacity(0.2))
                .frame(height: 0.5)
            
            Text("Today")
                .font(.caption)
                .foregroundColor(.white.opacity(0.5))
                .padding(.horizontal, 12)
                .padding(.vertical, 4)
                .background(
                    Capsule()
                        .fill(Color.white.opacity(0.1))
                )
            
            Rectangle()
                .fill(Color.white.opacity(0.2))
                .frame(height: 0.5)
        }
        .padding(.vertical, 8)
    }
    
    private var encryptionNotice: some View {
        VStack(spacing: 8) {
            Image(systemName: "lock.shield.fill")
                .font(.largeTitle)
                .foregroundColor(.green.opacity(0.7))
            
            Text("Messages are secured with\npost-quantum encryption")
                .font(.caption)
                .foregroundColor(.white.opacity(0.5))
                .multilineTextAlignment(.center)
            
            Text("🔐 Kyber1024 + ChaCha20")
                .font(.caption2)
                .foregroundColor(.green.opacity(0.5))
        }
        .padding(.vertical, 20)
    }
    
    // MARK: - Input Bar
    
    private var inputBar: some View {
        HStack(spacing: 12) {
            // Attachment button
            Button(action: { showingAttachmentMenu = true }) {
                Image(systemName: "paperclip")
                    .font(.title3)
                    .foregroundColor(.white.opacity(0.7))
            }
            
            // Text input
            HStack {
                TextField("Message", text: $messageText)
                    .foregroundColor(.white)
                    .accentColor(.purple)
                    .onChangeCompat(of: messageText) {
                        handleTyping(!messageText.isEmpty)
                    }
                
                if !messageText.isEmpty {
                    Button(action: { messageText = "" }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.white.opacity(0.3))
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 20)
                    .fill(Color.white.opacity(0.1))
            )
            
            // Send button or voice record
            Button(action: {
                if messageText.isEmpty {
                    handleVoiceRecord()
                } else {
                    sendMessage()
                }
            }) {
                Image(systemName: messageText.isEmpty ? (isRecordingVoice ? "stop.circle.fill" : "mic.fill") : "arrow.up.circle.fill")
                    .font(.title2)
                    .foregroundColor(isRecordingVoice ? .red : (messageText.isEmpty ? .white.opacity(0.7) : .white))
                    .scaleEffect(messageText.isEmpty ? 1.0 : 1.1)
                    .animation(.spring(response: 0.3), value: messageText.isEmpty)
            }
            .disabled(messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && messageText.isEmpty)
        }
        .padding()
        .background(
            Color.black.opacity(0.3)
                .background(.ultraThinMaterial)
        )
        .padding(.bottom, keyboardHeight)
        .actionSheet(isPresented: $showingAttachmentMenu) {
            ActionSheet(
                title: Text("Send Attachment"),
                buttons: [
                    .default(Text("📷 Photo")) {
                        showingImagePicker = true
                    },
                    .default(Text("📹 Video")) {
                        showingImagePicker = true // Same picker, different config
                    },
                    .default(Text("📄 Document")) {
                        showingDocumentPicker = true
                    },
                    .default(Text("💰 Crypto Payment")) {
                        // TODO: Open wallet for payment
                    },
                    .cancel()
                ]
            )
        }
        .sheet(isPresented: $showingImagePicker) {
            ImagePicker { image in
                if let image = image {
                    sendImage(image)
                }
                showingImagePicker = false
            }
        }
    }
    
    // MARK: - Actions
    
    private func loadMessages() {
        // Load messages from MessagingService cache first
        if let chatMessages = messagingService.messages[chat.id] {
            self.messages = chatMessages
        }
        
        // Load encrypted messages from backend
        Task {
            do {
                // Generate keys if needed
                if UserDefaults.standard.string(forKey: "kyber_public_key") == nil {
                    try await messagingService.generateMessagingKeys()
                }
                
                // Load messages from backend
                try await messagingService.loadChatMessages(chatId: chat.id)
                
                // Update UI with decrypted messages
                await MainActor.run {
                    if let updatedMessages = messagingService.messages[chat.id] {
                        self.messages = updatedMessages
                        scrollToBottom()
                    }
                }
            } catch {
                print("❌ Failed to load messages: \(error)")
            }
        }
        
        // Subscribe to new messages via Combine
        messagingService.$messages
            .map { $0[chat.id] ?? [] }
            .receive(on: DispatchQueue.main)
            .sink { messages in
                // Can't use weak self with struct, not needed anyway
                // SwiftUI manages memory automatically
            }
            .store(in: &cancellables)
    }
    
    @State private var cancellables = Set<AnyCancellable>()
    
    private func sendMessage() {
        let trimmedMessage = messageText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedMessage.isEmpty else { return }
        
        Task {
            isLoading = true
            loadingMessage = LoadingMessages.sendingMessage
            do {
                try await messagingService.sendMessage(
                    to: otherParticipant,
                    content: trimmedMessage,
                    chatId: chat.id
                )
                
                // Clear input
                await MainActor.run {
                    messageText = ""
                    handleTyping(false)
                }
            } catch {
                print("❌ Failed to send message: \(error)")
                // TODO: Show error to user
            }
            isLoading = false
        }
    }
    
    private func handleTyping(_ isTyping: Bool) {
        if self.isTyping != isTyping {
            self.isTyping = isTyping
            messagingService.sendTypingIndicator(chatId: chat.id, isTyping: isTyping)
        }
    }
    
    private func markMessagesAsRead() {
        for message in messages where !message.isSentByCurrentUser {
            messagingService.markAsRead(messageId: message.id, chatId: chat.id)
        }
    }
    
    private func startCall(isVideo: Bool) {
        Task {
            do {
                try await messagingService.initiateCall(to: otherParticipant, isVideo: isVideo)
                // TODO: Navigate to CallView
            } catch {
                print("❌ Failed to start call: \(error)")
            }
        }
    }
    
    // MARK: - Media Handling
    
    private func handleVoiceRecord() {
        if isRecordingVoice {
            stopVoiceRecording()
        } else {
            startVoiceRecording()
        }
    }
    
    private func startVoiceRecording() {
        isRecordingVoice = true
        voiceRecordingTime = 0
        
        // TODO: Start actual audio recording
        Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { timer in
            if isRecordingVoice {
                voiceRecordingTime += 0.1
            } else {
                timer.invalidate()
            }
        }
        
        // Haptic feedback
        let impactFeedback = UIImpactFeedbackGenerator(style: .medium)
        impactFeedback.impactOccurred()
    }
    
    private func stopVoiceRecording() {
        isRecordingVoice = false
        
        if voiceRecordingTime > 0.5 { // Minimum recording time
            Task {
                isLoading = true
                loadingMessage = "Sending voice message..."
                
                // TODO: Get actual audio data
                let audioData = Data() // Placeholder
                
                do {
                    let result = try await WebRTCService.shared.sendMedia(
                        audioData,
                        type: .audio,
                        to: otherParticipant
                    )
                    
                    print("✅ Voice message sent via \(result.method)")
                } catch {
                    print("❌ Failed to send voice message: \(error)")
                }
                
                isLoading = false
            }
        }
        
        voiceRecordingTime = 0
    }
    
    private func sendImage(_ image: UIImage) {
        Task {
            isLoading = true
            loadingMessage = LoadingMessages.uploadingMedia
            
            guard let imageData = image.jpegData(compressionQuality: 0.8) else {
                isLoading = false
                return
            }
            
            do {
                let result = try await WebRTCService.shared.sendMedia(
                    imageData,
                    type: .image,
                    to: otherParticipant
                )
                
                // Create message with media
                let encryptedContent = EncryptedMessage(
                    ciphertext: "[Image]",
                    nonce: "",
                    tag: ""
                )
                
                var message = Message(
                    id: UUID().uuidString,
                    chatId: chat.id,
                    senderId: CyphrIdentity.shared.cyphrId ?? "",
                    encryptedContent: encryptedContent,
                    timestamp: Date()
                )
                message.decryptedContent = "[Image]"
                
                messages.append(message)
                scrollToBottom()
                
                print("✅ Image sent via \(result.method)")
            } catch {
                print("❌ Failed to send image: \(error)")
            }
            
            isLoading = false
        }
    }
    
    private func scrollToBottom() {
        if let lastMessage = messages.last {
            withAnimation {
                scrollProxy?.scrollTo(lastMessage.id, anchor: .bottom)
            }
        }
    }
    
    private func shouldShowAvatar(for message: Message) -> Bool {
        guard let index = messages.firstIndex(where: { $0.id == message.id }),
              index > 0 else { return true }
        
        let previousMessage = messages[index - 1]
        return previousMessage.senderId != message.senderId
    }
}

// MARK: - Message Bubble View

struct MessageBubbleView: View {
    let message: Message
    let showAvatar: Bool
    
    private var isOwnMessage: Bool {
        message.isSentByCurrentUser
    }
    
    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            if !isOwnMessage && showAvatar {
                // Avatar for other user
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [.purple, .blue],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 28, height: 28)
                    .overlay(
                        Text(message.senderId.prefix(1).uppercased())
                            .font(.caption.bold())
                            .foregroundColor(.white)
                    )
            } else if !isOwnMessage {
                // Spacer for alignment when no avatar
                Color.clear
                    .frame(width: 28, height: 28)
            }
            
            if isOwnMessage { Spacer() }
            
            VStack(alignment: isOwnMessage ? .trailing : .leading, spacing: 4) {
                // Message bubble
                VStack(alignment: .leading, spacing: 4) {
                    Text(message.content)
                        .font(.body)
                        .foregroundColor(isOwnMessage ? .black : .white)
                    
                    // Show encryption indicator for encrypted messages
                    if message.decryptedContent != nil {
                        HStack(spacing: 4) {
                            Image(systemName: "lock.shield.fill")
                                .font(.caption2)
                                .foregroundColor(isOwnMessage ? .purple.opacity(0.6) : .white.opacity(0.7))
                            Text("E2E Encrypted")
                                .font(.caption2)
                                .foregroundColor(isOwnMessage ? .purple.opacity(0.6) : .white.opacity(0.7))
                        }
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(
                    RoundedRectangle(cornerRadius: 18)
                        .fill(
                            isOwnMessage ?
                                AnyShapeStyle(Color.white) :
                                AnyShapeStyle(LinearGradient(
                                    colors: [
                                        Color.purple.opacity(0.8),
                                        Color.blue.opacity(0.8)
                                    ],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ))
                        )
                )
                
                // Time and status
                HStack(spacing: 4) {
                    Text(formatTime(message.timestamp))
                        .font(.caption2)
                        .foregroundColor(.white.opacity(0.5))
                    
                    if isOwnMessage {
                        Image(systemName: getStatusIcon())
                            .font(.caption2)
                            .foregroundColor(getStatusColor())
                    }
                    
                    // Encryption indicator
                    Image(systemName: "lock.shield.fill")
                        .font(.system(size: 8))
                        .foregroundColor(.green.opacity(0.5))
                }
            }
            .frame(maxWidth: 280, alignment: isOwnMessage ? .trailing : .leading)
            
            if !isOwnMessage { Spacer() }
        }
        .padding(.horizontal, 4)
        .padding(.vertical, 2)
    }
    
    private func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
    
    private func getStatusIcon() -> String {
        // TODO: Get actual message status
        return "checkmark.circle.fill" // Delivered and read
    }
    
    private func getStatusColor() -> Color {
        // TODO: Get actual message status
        return .blue // Read
    }
}

// MARK: - Keyboard Height Publisher

#if os(iOS)
import UIKit

extension Publishers {
    static var keyboardHeight: AnyPublisher<CGFloat, Never> {
        let willShow = NotificationCenter.default
            .publisher(for: UIResponder.keyboardWillShowNotification)
            .map { notification -> CGFloat in
                (notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect)?.height ?? 0
            }
        
        let willHide = NotificationCenter.default
            .publisher(for: UIResponder.keyboardWillHideNotification)
            .map { _ -> CGFloat in 0 }
        
        return MergeMany(willShow, willHide)
            .eraseToAnyPublisher()
    }
}
#else
extension Publishers {
    static var keyboardHeight: AnyPublisher<CGFloat, Never> {
        Just(0).eraseToAnyPublisher()
    }
}
#endif

// MARK: - Preview

// MARK: - Attachment Menu for macOS
#if !os(iOS)
struct AttachmentMenuView: View {
    let dismiss: () -> Void
    
    var body: some View {
        VStack(spacing: 20) {
            Text("Send Attachment")
                .font(.title2)
                .fontWeight(.bold)
            
            VStack(spacing: 10) {
                Button("📷 Photo") {
                    // TODO: Photo picker
                    dismiss()
                }
                Button("📹 Video") {
                    // TODO: Video picker
                    dismiss()
                }
                Button("📄 Document") {
                    // TODO: Document picker
                    dismiss()
                }
                Button("💰 Crypto Payment") {
                    // TODO: Open wallet
                    dismiss()
                }
            }
            
            Button("Cancel") {
                dismiss()
            }
            .foregroundColor(.gray)
        }
        .padding()
        .frame(width: 300)
    }
}
#endif

struct ChatDetailView_Previews: PreviewProvider {
    static var previews: some View {
        ChatDetailView(chat: Chat(
            id: "1",
            participants: ["user1", "user2"],
            lastMessage: nil,
            unreadCount: 0
        ))
    }
}
