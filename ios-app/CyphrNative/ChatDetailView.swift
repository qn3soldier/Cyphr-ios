import SwiftUI
import Combine
import AVKit
import UniformTypeIdentifiers
import UIKit

/// Enterprise-Grade Chat Detail Screen - WhatsApp/Telegram Level
struct ChatDetailView: View {
    let chat: Chat
    @StateObject private var messagingService = MessagingService.shared
    @StateObject private var audioRecorder = AudioRecorderService.shared
    @State private var messageText = ""
    @State private var messages: [Message] = []
    @State private var isTyping = false
    @State private var showingAttachmentMenu = false
    @State private var showingCallOptions = false
    @State private var showingImagePicker = false
    @State private var showingVideoPicker = false
    @State private var showingDocumentPicker = false
    @State private var isRecordingVoice = false
    @State private var voiceRecordingTime: TimeInterval = 0
    @State private var recordingTimer: Timer? = nil
    @State private var recordingStartedAt: Date?
    @State private var alertMessage: String?
    @State private var alertTitle: String = "Error"
    @State private var scrollProxy: ScrollViewProxy?
    @State private var keyboardHeight: CGFloat = 0
    @State private var isLoading = false
    @State private var loadingMessage = ""
    @State private var activeNotice: MessagingService.UserNotice?
    @State private var noticeDismissTask: Task<Void, Never>? = nil
    
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
        .overlay(alignment: .top) {
            if let notice = activeNotice {
                NoticeBanner(notice: notice)
                    .padding(.top, 12)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .alert(alertTitle, isPresented: Binding(
            get: { alertMessage != nil },
            set: { if !$0 { alertMessage = nil } }
        )) {
            Button("OK", role: .cancel) { alertMessage = nil }
        } message: {
            Text(alertMessage ?? "Unknown error")
        }
        .onAppear {
            loadMessages()
            markMessagesAsRead()
        }
        .onReceive(Publishers.keyboardHeight) { height in
            withAnimation(.easeOut(duration: 0.25)) {
                keyboardHeight = height
            }
        }
        .onReceive(messagingService.$userNotice.compactMap { $0 }) { notice in
            activeNotice = notice
            noticeDismissTask?.cancel()
            noticeDismissTask = Task { @MainActor in
                try? await Task.sleep(nanoseconds: 3_000_000_000)
                withAnimation { activeNotice = nil }
            }
        }
        .onDisappear {
            if isRecordingVoice {
                audioRecorder.cancelRecording()
            }
            recordingTimer?.invalidate()
            recordingTimer = nil
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

            if isRecordingVoice {
                RecordingIndicator(duration: voiceRecordingTime)
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
                        showingVideoPicker = true
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
        .sheet(isPresented: $showingVideoPicker) {
            VideoPicker { url in
                if let url = url {
                    sendVideo(url)
                }
                showingVideoPicker = false
            }
        }
        .sheet(isPresented: $showingDocumentPicker) {
            DocumentPicker { url in
                if let url = url {
                    sendDocument(url)
                }
                showingDocumentPicker = false
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
            .sink { updated in
                self.messages = updated
                scrollToBottom()
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
            stopVoiceRecording(sendMessage: true)
        } else {
            startVoiceRecording()
        }
    }
    
    private func startVoiceRecording() {
        Task {
            do {
                try await audioRecorder.startRecording()
                await MainActor.run {
                    isRecordingVoice = true
                    recordingStartedAt = Date()
                    voiceRecordingTime = 0
                    startRecordingTimer()
                    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                }
            } catch {
                await MainActor.run {
                    alertTitle = "Voice Message Error"
                    alertMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
                    isRecordingVoice = false
                }
            }
        }
    }
    
    private func stopVoiceRecording(sendMessage: Bool) {
        recordingTimer?.invalidate()
        recordingTimer = nil

        Task {
            do {
                let result = try await audioRecorder.stopRecording()
                await MainActor.run {
                    isRecordingVoice = false
                    recordingStartedAt = nil
                    voiceRecordingTime = result.duration
                }

                guard sendMessage, result.duration > 0.4 else { return }

                await MainActor.run {
                    isLoading = true
                    loadingMessage = "Sending voice message..."
                }

                do {
                    try await messagingService.sendVoiceMessage(
                        to: otherParticipant,
                        chatId: chat.id,
                        recording: result
                    )
                } catch {
                    print("❌ Failed to send voice message: \(error)")
                    await MainActor.run {
                        alertTitle = "Voice Message Error"
                        alertMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
                    }
                }

                await MainActor.run {
                    isLoading = false
                    voiceRecordingTime = 0
                }
            } catch {
                audioRecorder.cancelRecording()
                await MainActor.run {
                    isRecordingVoice = false
                    recordingStartedAt = nil
                    alertTitle = "Voice Message Error"
                    alertMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
                    voiceRecordingTime = 0
                }
            }
        }
    }

    private func startRecordingTimer() {
        recordingTimer?.invalidate()
        recordingTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { timer in
            if let start = recordingStartedAt {
                voiceRecordingTime = Date().timeIntervalSince(start)
            } else {
                timer.invalidate()
            }
        }
    }

    private func mimeTypeForURL(_ url: URL) -> String? {
        if let values = try? url.resourceValues(forKeys: [.contentTypeKey]),
           let type = values.contentType,
           let mime = type.preferredMIMEType {
            return mime
        }

        guard let utType = UTType(filenameExtension: url.pathExtension.lowercased()) else {
            return nil
        }
        return utType.preferredMIMEType
    }
    
    private func sendImage(_ image: UIImage) {
        Task {
            isLoading = true
            loadingMessage = LoadingMessages.uploadingMedia
            
            guard let imageData = image.jpegData(compressionQuality: 0.85) else {
                isLoading = false
                alertTitle = "Image Error"
                alertMessage = "Failed to prepare image data."
                return
            }

            do {
                try await messagingService.sendImageMessage(
                    to: otherParticipant,
                    chatId: chat.id,
                    imageData: imageData
                )
            } catch {
                print("❌ Failed to send image: \(error)")
                alertTitle = "Image Upload Failed"
                alertMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            }
            
            isLoading = false
        }
    }

    private func sendVideo(_ url: URL) {
        Task {
            isLoading = true
            loadingMessage = "Uploading video..."

            let shouldStopAccess = url.startAccessingSecurityScopedResource()
            defer {
                if shouldStopAccess { url.stopAccessingSecurityScopedResource() }
            }

            do {
                let videoData = try Data(contentsOf: url)
                guard videoData.count <= 100 * 1024 * 1024 else {
                    alertTitle = "Video Too Large"
                    alertMessage = "Please choose a video under 100 MB."
                    isLoading = false
                    return
                }
                let mimeType = mimeTypeForURL(url) ?? "video/mp4"
                try await messagingService.sendVideoMessage(
                    to: otherParticipant,
                    chatId: chat.id,
                    videoData: videoData,
                    fileName: url.lastPathComponent,
                    mimeType: mimeType
                )
            } catch {
                print("❌ Failed to send video: \(error)")
                alertTitle = "Video Upload Failed"
                alertMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            }

            isLoading = false
        }
    }

    private func sendDocument(_ url: URL) {
        Task {
            isLoading = true
            loadingMessage = "Uploading document..."

            let shouldStopAccess = url.startAccessingSecurityScopedResource()
            defer {
                if shouldStopAccess { url.stopAccessingSecurityScopedResource() }
            }

            do {
                let documentData = try Data(contentsOf: url)
                guard documentData.count <= 50 * 1024 * 1024 else {
                    alertTitle = "Document Too Large"
                    alertMessage = "Please choose a document under 50 MB."
                    isLoading = false
                    return
                }
                let mimeType = mimeTypeForURL(url) ?? "application/octet-stream"
                try await messagingService.sendDocumentMessage(
                    to: otherParticipant,
                    chatId: chat.id,
                    documentData: documentData,
                    fileName: url.lastPathComponent,
                    mimeType: mimeType
                )
            } catch {
                print("❌ Failed to send document: \(error)")
                alertTitle = "Document Upload Failed"
                alertMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
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

    private var usesCustomBackground: Bool {
        guard let kind = message.mediaAttachment?.kind else { return false }
        return kind == .image || kind == .video
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
                    if let media = message.mediaAttachment {
                        switch media.kind {
                        case .audio:
                            VoiceMessageBubble(message: message, media: media, isOwnMessage: isOwnMessage)
                        case .image:
                            ImageMessageBubble(message: message, media: media, isOwnMessage: isOwnMessage)
                        case .video:
                            VideoMessageBubble(message: message, media: media, isOwnMessage: isOwnMessage)
                        case .document:
                            DocumentMessageBubble(message: message, media: media)
                        case .text:
                            Text(message.content)
                                .font(.body)
                                .foregroundColor(isOwnMessage ? .black : .white)
                        }
                    } else {
                        Text(message.content)
                            .font(.body)
                            .foregroundColor(isOwnMessage ? .black : .white)
                    }
                    
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
                .padding(.horizontal, usesCustomBackground ? 0 : 14)
                .padding(.vertical, usesCustomBackground ? 0 : 10)
                .background(
                    backgroundStyle(isOwn: isOwnMessage, clear: usesCustomBackground)
                )
                
                // Time and status
                HStack(spacing: 4) {
                    Text(formatTime(message.timestamp))
                        .font(.caption2)
                        .foregroundColor(.white.opacity(0.5))
                    
                    if isOwnMessage {
                        let (icon, color) = statusIconAndColor()
                        Image(systemName: icon)
                            .font(.caption2)
                            .foregroundColor(color)
                            .accessibilityLabel(statusAccessibilityLabel())
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
    
    private func statusIconAndColor() -> (String, Color) {
        switch message.deliveryState {
        case .sending:
            return ("clock", .yellow.opacity(0.8))
        case .sent:
            return ("checkmark", .white.opacity(0.6))
        case .delivered:
            return ("checkmark.circle", .blue)
        case .read:
            return ("checkmark.circle.fill", .purple)
        }
    }

    private func statusAccessibilityLabel() -> String {
        switch message.deliveryState {
        case .sending: return "Sending"
        case .sent: return "Sent"
        case .delivered: return "Delivered"
        case .read: return "Read"
        }
    }

    private func backgroundStyle(isOwn: Bool, clear: Bool) -> AnyShapeStyle {
        if clear {
            return AnyShapeStyle(Color.clear)
        }

        if isOwn {
            return AnyShapeStyle(Color.white)
        }

        return AnyShapeStyle(
            LinearGradient(
                colors: [
                    Color.purple.opacity(0.8),
                    Color.blue.opacity(0.8)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
    }
}

// MARK: - Notice Banner

struct NoticeBanner: View {
    let notice: MessagingService.UserNotice
    
    private var background: LinearGradient {
        switch notice.style {
        case .info:
            return LinearGradient(colors: [Color.blue.opacity(0.7), Color.blue.opacity(0.5)], startPoint: .leading, endPoint: .trailing)
        case .success:
            return LinearGradient(colors: [Color.green.opacity(0.7), Color.green.opacity(0.5)], startPoint: .leading, endPoint: .trailing)
        case .warning:
            return LinearGradient(colors: [Color.orange.opacity(0.8), Color.red.opacity(0.5)], startPoint: .leading, endPoint: .trailing)
        }
    }
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: iconName)
                .font(.headline)
            Text(notice.text)
                .font(.footnote)
                .multilineTextAlignment(.leading)
        }
        .foregroundColor(.white)
        .padding(.vertical, 8)
        .padding(.horizontal, 16)
        .background(
            background
                .cornerRadius(16)
                .shadow(color: .black.opacity(0.2), radius: 8, x: 0, y: 4)
        )
        .padding(.horizontal, 24)
    }
    
    private var iconName: String {
        switch notice.style {
        case .info: return "exclamationmark.bubble.fill"
        case .success: return "checkmark.circle.fill"
        case .warning: return "wifi.exclamationmark"
        }
    }
}

struct RecordingIndicator: View {
    let duration: TimeInterval

    private var formatted: String {
        let formatter = DateComponentsFormatter()
        formatter.allowedUnits = [.minute, .second]
        formatter.zeroFormattingBehavior = .pad
        return formatter.string(from: duration) ?? "0:00"
    }

    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(Color.red)
                .frame(width: 10, height: 10)
                .overlay(
                    Circle()
                        .stroke(Color.red.opacity(0.4), lineWidth: 4)
                        .scaleEffect(1.6)
                        .opacity(0.6)
                )
                .animation(.easeInOut(duration: 0.6).repeatForever(autoreverses: true), value: duration)

            VStack(alignment: .leading, spacing: 4) {
                Text("Recording")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.7))
                Text(formatted)
                    .font(.footnote.monospacedDigit())
                    .foregroundColor(.white)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(
            Capsule()
                .fill(Color.red.opacity(0.2))
        )
    }
}

struct VoiceMessageBubble: View {
    let message: Message
    let media: MessageMediaMetadata
    let isOwnMessage: Bool

    @State private var isLoading = false
    @State private var playbackError: String?
    @ObservedObject private var playbackService = AudioPlaybackService.shared
    @ObservedObject private var messagingService = MessagingService.shared

    private var isCurrentMessagePlaying: Bool {
        switch playbackService.state {
        case .playing(let id, _):
            return id == message.id
        case .paused(let id, _):
            return id == message.id
        default:
            return false
        }
    }

    private var isPaused: Bool {
        if case .paused(let id, _) = playbackService.state { return id == message.id }
        return false
    }

    private var progress: Double {
        switch playbackService.state {
        case .playing(let id, let value) where id == message.id:
            return value
        case .paused(let id, let value) where id == message.id:
            return value
        default:
            return 0
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 12) {
                Button(action: togglePlayback) {
                    ZStack {
                        Circle()
                            .fill(isOwnMessage ? Color.black.opacity(0.1) : Color.white.opacity(0.15))
                            .frame(width: 38, height: 38)

                        if isLoading {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: isOwnMessage ? .black : .white))
                        } else {
                            Image(systemName: controlIcon)
                                .font(.system(size: 18, weight: .bold))
                                .foregroundColor(isOwnMessage ? .black : .white)
                        }
                    }
                }
                .buttonStyle(.plain)
                .accessibilityLabel(isCurrentMessagePlaying ? "Pause" : "Play")
                .disabled(isLoading)

                VStack(alignment: .leading, spacing: 6) {
                    ProgressView(value: progress)
                        .progressViewStyle(LinearProgressViewStyle(tint: isOwnMessage ? .black : .white))
                        .opacity(progress > 0 ? 1 : 0.3)

                    HStack(spacing: 10) {
                        Text(formattedDuration(media.duration ?? 0))
                            .font(.caption.monospacedDigit())
                            .foregroundColor(isOwnMessage ? .black.opacity(0.7) : .white.opacity(0.7))

                        if let waveform = media.waveform, !waveform.isEmpty {
                            WaveformView(samples: waveform, tint: isOwnMessage ? .black.opacity(0.5) : .white.opacity(0.6))
                                .frame(height: 12)
                        }
                    }
                }
            }
        }
        .alert("Playback Error", isPresented: Binding(
            get: { playbackError != nil },
            set: { if !$0 { playbackError = nil } }
        )) {
            Button("OK", role: .cancel) { playbackError = nil }
        } message: {
            Text(playbackError ?? "Unknown error")
        }
    }

    private var controlIcon: String {
        if isLoading { return "" }
        if isCurrentMessagePlaying && !isPaused {
            return "pause.fill"
        } else if isPaused {
            return "play.fill"
        } else {
            return "play.fill"
        }
    }

    private func togglePlayback() {
        if isLoading { return }

        if isCurrentMessagePlaying {
            if isPaused {
                playbackService.resume()
            } else {
                playbackService.pause()
            }
            return
        }

        Task {
            do {
                isLoading = true
                let data = try await messagingService.fetchVoiceData(for: message)
                try playbackService.play(data: data, messageId: message.id)
            } catch {
                playbackError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            }
            isLoading = false
        }
    }

    private func formattedDuration(_ seconds: Double) -> String {
        guard seconds.isFinite else { return "0:00" }
        let formatter = DateComponentsFormatter()
        formatter.allowedUnits = [.minute, .second]
        formatter.zeroFormattingBehavior = .pad
        return formatter.string(from: seconds) ?? "0:00"
    }
}

struct WaveformView: View {
    let samples: [Float]
    let tint: Color

    var body: some View {
        GeometryReader { geometry in
            let width = geometry.size.width
            let barWidth = max(width / CGFloat(max(samples.count, 1)), 2)
            HStack(alignment: .center, spacing: barWidth * 0.2) {
                ForEach(Array(samples.enumerated()), id: \.offset) { item in
                    let sample = max(item.element, 0.05)
                    Capsule()
                        .fill(tint)
                        .frame(width: barWidth, height: CGFloat(sample) * geometry.size.height)
                }
            }
        }
    }
}

struct ImageMessageBubble: View {
    let message: Message
    let media: MessageMediaMetadata
    let isOwnMessage: Bool

    @ObservedObject private var messagingService = MessagingService.shared

    @State private var previewImage: UIImage?
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var isPreviewPresented = false

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 14)
                .fill(Color.black.opacity(isOwnMessage ? 0.05 : 0.2))

            if let image = previewImage {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .clipped()
                    .cornerRadius(14)
                    .onTapGesture { isPreviewPresented = true }
            } else if isLoading {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: isOwnMessage ? .black : .white))
            } else {
                VStack(spacing: 8) {
                    Image(systemName: "photo")
                        .font(.largeTitle)
                        .foregroundColor(.white.opacity(0.7))
                    Text("Tap to load image")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.7))
                }
                .onTapGesture { loadImage() }
            }
        }
        .frame(width: 180, height: 220)
        .clipped()
        .contentShape(Rectangle())
        .onAppear { loadImageIfNeeded() }
        .alert("Image Error", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "Unknown error")
        }
        .fullScreenCover(isPresented: $isPreviewPresented) {
            if let image = previewImage {
                ZoomableImageView(image: image) {
                    isPreviewPresented = false
                }
            }
        }
    }

    private func loadImageIfNeeded() {
        if previewImage == nil {
            loadImage()
        }
    }

    private func loadImage() {
        guard !isLoading else { return }
        isLoading = true
        Task {
            do {
                if let cached = messagingService.cachedMediaData(for: message), let image = UIImage(data: cached) {
                    previewImage = image
                    isLoading = false
                    return
                }

                let data = try await messagingService.fetchMediaData(for: message)
                if let image = UIImage(data: data) {
                    previewImage = image
                } else {
                    errorMessage = "Unable to decode image."
                }
            } catch {
                errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            }
            isLoading = false
        }
    }
}

struct VideoMessageBubble: View {
    let message: Message
    let media: MessageMediaMetadata
    let isOwnMessage: Bool

    @ObservedObject private var messagingService = MessagingService.shared

    @State private var player: AVPlayer?
    @State private var isPresentingPlayer = false
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ZStack {
                RoundedRectangle(cornerRadius: 14)
                    .fill(Color.black.opacity(isOwnMessage ? 0.05 : 0.2))
                    .frame(width: 200, height: 130)

                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: isOwnMessage ? .black : .white))
                } else {
                    VStack(spacing: 8) {
                        Image(systemName: "play.rectangle.fill")
                            .font(.system(size: 34))
                            .foregroundColor(isOwnMessage ? .black.opacity(0.7) : .white)
                        Text(media.fileName ?? "Video")
                            .font(.caption)
                            .foregroundColor(isOwnMessage ? .black.opacity(0.6) : .white.opacity(0.8))
                    }
                }
            }
            .onTapGesture { presentVideo() }

            if let size = media.fileSize {
                Text(formatBytes(size))
                    .font(.caption2)
                    .foregroundColor(.white.opacity(0.6))
            }
        }
        .alert("Video Error", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "Unknown error")
        }
        .sheet(isPresented: $isPresentingPlayer) {
            if let player {
                VideoPlayer(player: player)
                    .edgesIgnoringSafeArea(.all)
                    .onDisappear { player.pause() }
            }
        }
    }

    private func presentVideo() {
        guard !isLoading else { return }
        if let player {
            isPresentingPlayer = true
            player.seek(to: .zero)
            player.play()
            return
        }

        isLoading = true
        Task {
            do {
                let data = try await messagingService.fetchMediaData(for: message)
                let tempURL = FileManager.default.temporaryDirectory
                    .appendingPathComponent("cyphr-video-\(message.id).mp4")
                if FileManager.default.fileExists(atPath: tempURL.path) {
                    try FileManager.default.removeItem(at: tempURL)
                }
                try data.write(to: tempURL, options: .atomic)
                let newPlayer = AVPlayer(url: tempURL)
                self.player = newPlayer
                isPresentingPlayer = true
                newPlayer.play()
            } catch {
                errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            }
            isLoading = false
        }
    }
}

struct DocumentMessageBubble: View {
    let message: Message
    let media: MessageMediaMetadata

    @ObservedObject private var messagingService = MessagingService.shared

    @State private var isLoading = false
    @State private var shareURL: URL?
    @State private var showShareSheet = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 12) {
                Image(systemName: "doc.text.fill")
                    .font(.title2)
                    .foregroundColor(.white)
                    .frame(width: 36, height: 36)
                    .background(Color.blue.opacity(0.6))
                    .clipShape(RoundedRectangle(cornerRadius: 8))

                VStack(alignment: .leading, spacing: 4) {
                    Text(media.fileName ?? "Document")
                        .font(.subheadline)
                        .foregroundColor(.white)
                        .lineLimit(1)

                    if let size = media.fileSize {
                        Text(formatBytes(size))
                            .font(.caption2)
                            .foregroundColor(.white.opacity(0.6))
                    }
                }

                Spacer()

                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                } else {
                    Button("Open") {
                        fetchDocument()
                    }
                    .font(.caption.bold())
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color.white.opacity(0.15))
                    .clipShape(Capsule())
                }
            }
        }
        .alert("Document Error", isPresented: Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "Unknown error")
        }
        .sheet(isPresented: $showShareSheet, onDismiss: { shareURL = nil }) {
            if let shareURL {
                ShareSheet(activityItems: [shareURL])
            }
        }
    }

    private func fetchDocument() {
        guard !isLoading else { return }
        isLoading = true
        Task {
            do {
                let data = try await messagingService.fetchMediaData(for: message)
                let tempURL = FileManager.default.temporaryDirectory
                    .appendingPathComponent(media.fileName ?? "document-\(message.id)")
                if FileManager.default.fileExists(atPath: tempURL.path) {
                    try FileManager.default.removeItem(at: tempURL)
                }
                try data.write(to: tempURL, options: .atomic)
                shareURL = tempURL
                showShareSheet = true
            } catch {
                errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            }
            isLoading = false
        }
    }
}

struct ZoomableImageView: View {
    let image: UIImage
    let onClose: () -> Void

    @State private var scale: CGFloat = 1
    @State private var lastScale: CGFloat = 1
    @State private var offset: CGSize = .zero

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Color.black.ignoresSafeArea()

            Image(uiImage: image)
                .resizable()
                .scaledToFit()
                .scaleEffect(scale)
                .offset(offset)
                .gesture(MagnificationGesture()
                    .onChanged { value in
                        let newScale = lastScale * value
                        scale = max(1, min(newScale, 6))
                    }
                    .onEnded { _ in
                        lastScale = scale
                    })
                .gesture(DragGesture()
                    .onChanged { value in offset = value.translation }
                    .onEnded { _ in withAnimation { offset = .zero } })

            Button(action: onClose) {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 28))
                    .foregroundColor(.white)
                    .padding()
            }
        }
    }
}

struct ShareSheet: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

private func formatBytes(_ bytes: Int) -> String {
    let formatter = ByteCountFormatter()
    formatter.countStyle = .file
    return formatter.string(fromByteCount: Int64(bytes))
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
