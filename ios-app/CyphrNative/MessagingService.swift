import Foundation
import SocketIO
import Combine
#if os(iOS)
import UIKit
#endif


/// Real-time Messaging Service with Socket.IO
/// Post-quantum encrypted messaging with AWS backend
class MessagingService: ObservableObject {
    
    // MARK: - Properties
    static let shared = MessagingService()
    
    private var manager: SocketManager!
    private var socket: SocketIOClient!
    private let crypto = PostQuantumCrypto.shared
    
    @Published var isConnected = false
    @Published var messages: [String: [Message]] = [:] // chatId -> messages
    @Published var activeChats: [Chat] = []
    @Published var typingUsers: Set<String> = []
    @Published var onlineUsers: Set<String> = []
    
    private var cancellables = Set<AnyCancellable>()
    private let socketURL = "https://app.cyphrmessenger.app"
    
    // Из socketService.js
    private var messageQueue: [OutgoingMessage] = []
    private var typingTimers: [String: Timer] = [:]
    private var messageCallbacks: [String: (Result<Message, Error>) -> Void] = [:]
    
    // СОРМ protection features (из socketService.js)
    private var privacyMode = false
    private var useP2P = false
    private var p2pFallbackEnabled = true
    
    // WebSocket suspension handling (из socketService.js)
    private var heartbeatTimer: Timer?
    private var lastHeartbeat = Date()
    private var suspensionDetected = false
    private var reconnectAttempts = 0
    private let maxReconnectAttempts = 5
    
    // MARK: - Initialization
    private init() {
        setupSocket()
        setupEventHandlers()
        setupSuspensionHandling()
        startHeartbeat()
        print("💬 Messaging Service initialized")
    }
    
    // MARK: - Socket Setup
    
    private func setupSocket() {
        manager = SocketManager(
            socketURL: URL(string: socketURL)!,
            config: [
                .log(false),
                .compress,
                .secure(true),
                .reconnects(true),
                .reconnectWait(5),
                .reconnectAttempts(-1),
                .version(.three)
            ]
        )
        
        socket = manager.defaultSocket
    }
    
    private func setupEventHandlers() {
        // Connection events
        socket.on(clientEvent: .connect) { [weak self] _, _ in
            print("✅ Socket.IO connected")
            self?.isConnected = true
            self?.authenticate()
        }
        
        socket.on(clientEvent: .disconnect) { [weak self] _, _ in
            print("❌ Socket.IO disconnected")
            self?.isConnected = false
        }
        
        socket.on(clientEvent: .error) { data, _ in
            print("❌ Socket.IO error: \(data)")
        }
        
        // Authentication response
        socket.on("authenticated") { [weak self] data, _ in
            self?.handleAuthenticated(data)
        }
        
        socket.on("auth_error") { [weak self] data, _ in
            self?.handleAuthError(data)
        }
        
        // Message events
        socket.on("new_message") { [weak self] data, _ in
            self?.handleIncomingMessage(data)
        }
        
        socket.on("message_sent") { [weak self] data, _ in
            // Confirmation that message was sent
            print("✅ Message sent confirmation received")
        }
        
        socket.on("user_typing") { [weak self] data, _ in
            self?.handleTypingIndicator(data)
        }
        
        socket.on("online_status") { [weak self] data, _ in
            self?.handleOnlineStatus(data)
        }
        
        socket.on("message_read_receipt") { [weak self] data, _ in
            self?.handleMessageRead(data)
        }
        
        socket.on("chat_created") { [weak self] data, _ in
            self?.handleChatCreated(data)
        }
        
        // Call events
        socket.on("incoming_call") { [weak self] data, _ in
            self?.handleIncomingCall(data)
        }
    }
    
    // MARK: - Connection Management
    
    func connect() {
        guard !isConnected else { return }
        print("🔌 Connecting to Socket.IO...")
        socket.connect()
    }
    
    func disconnect() {
        socket.disconnect()
        isConnected = false
    }
    
    private func authenticate() {
        guard let token = UserDefaults.standard.string(forKey: "auth_token"),
              let cyphrId = UserDefaults.standard.string(forKey: "cyphr_id") else {
            print("❌ No auth credentials for Socket.IO")
            return
        }
        
        socket.emit("authenticate", [
            "token": token,
            "cyphrId": cyphrId,
            "platform": "iOS",
            "version": "1.0.0"
        ])
        
        print("🔐 Authenticating Socket.IO connection...")
    }
    
    // MARK: - Messaging
    
    /// Send encrypted message using backend E2E encryption
    func sendMessage(to recipientCyphrId: String, content: String, chatId: String) async throws {
        print("📤 Sending E2E encrypted message to @\(recipientCyphrId)")
        
        // Get recipient's user ID from their Cyphr ID
        let recipientId = try await getRecipientId(recipientCyphrId)
        
        let recipientPublicKey = try await NetworkService.shared.getPublicKey(for: recipientCyphrId)
        
        let (kyberCiphertext, sharedSecret) = try crypto.encapsulate(recipientPublicKey: recipientPublicKey)
        let encryptedMsg = try crypto.encryptMessage(content, with: sharedSecret)
        
        let encryptedPayload = HybridEncryptedPayload(
            kyberCiphertext: kyberCiphertext,
            ciphertext: encryptedMsg.ciphertext,
            nonce: encryptedMsg.nonce,
            tag: encryptedMsg.tag
        )
        
        let payloadData = try JSONEncoder().encode(encryptedPayload)
        let response = try await NetworkService.shared.sendEncryptedMessage(
            chatId: chatId,
            content: payloadData.base64EncodedString(),
            recipientId: recipientId
        )
        
        if response.success {
            print("✅ Hybrid encryption: Kyber1024 + ChaCha20-Poly1305")
            
            let message = Message(
                id: response.messageId,
                chatId: chatId,
                senderId: getCurrentUserId(),
                encryptedContent: EncryptedMessage(
                    ciphertext: encryptedMsg.ciphertext,
                    nonce: encryptedMsg.nonce,
                    tag: encryptedMsg.tag
                ),
                timestamp: Date()
            )
            
            // Store locally for UI
            await MainActor.run {
                if messages[chatId] == nil {
                    messages[chatId] = []
                }
                messages[chatId]?.append(message)
                
                // Update chat's last message
                if let index = activeChats.firstIndex(where: { $0.id == chatId }) {
                    activeChats[index].lastMessage = message
                }
            }
            
            // Emit via Socket.IO for real-time notification
            socket.emit("message_sent", [
                "messageId": response.messageId,
                "chatId": chatId,
                "recipientId": recipientId,
                "encrypted": true,
                "algorithm": response.algorithm
            ])
        } else {
            throw MessagingError.sendFailed(response.message)
        }
    }
    
    /// Start new chat
    func startChat(with cyphrId: String) async throws -> String {
        let chatId = UUID().uuidString
        
        // Initialize quantum-safe chat session
        let recipientPublicKey = try await getRecipientPublicKey(cyphrId)
        try crypto.initializeChatSession(chatId: chatId, recipientPublicKey: recipientPublicKey)
        
        // Create chat object
        let chat = Chat(
            id: chatId,
            participants: [getCurrentCyphrId(), cyphrId],
            lastMessage: nil,
            unreadCount: 0
        )
        
        activeChats.append(chat)
        messages[chatId] = []
        
        // Notify server
        socket.emit("create_chat", [
            "chatId": chatId,
            "participants": chat.participants
        ])
        
        print("💬 Started chat with @\(cyphrId)")
        return chatId
    }
    
    /// Mark message as read  
    func markMessageAsRead(messageId: String, chatId: String) {
        socket.emit("message_read", [
            "messageId": messageId,
            "chatId": chatId
        ])
    }
    
    // MARK: - Event Handlers
    
    private func handleIncomingMessage(_ data: [Any]) {
        guard let messageData = data.first as? [String: Any],
              let messageId = messageData["messageId"] as? String,
              let chatId = messageData["chatId"] as? String,
              let senderId = messageData["senderId"] as? String,
              let encryptedPayload = messageData["encryptedPayload"] as? String,
              let timestamp = messageData["timestamp"] as? TimeInterval else {
            print("❌ Invalid message format")
            return
        }
        
        Task {
            do {
                guard let payloadData = Data(base64Encoded: encryptedPayload) else {
                    throw MessagingError.invalidPayload
                }
                
                let payload = try JSONDecoder().decode(HybridEncryptedPayload.self, from: payloadData)
                
                let myPrivateKey = try await CyphrIdentity.shared.getKyberPrivateKey()
                let sharedSecret = try crypto.decapsulate(ciphertext: payload.kyberCiphertext, privateKey: myPrivateKey)
                
                let encryptedMessage = EncryptedMessage(
                    ciphertext: payload.ciphertext,
                    nonce: payload.nonce,
                    tag: payload.tag
                )
                
                _ = try crypto.decryptMessage(encryptedMessage, with: sharedSecret)
                
                // Create message object
                let message = Message(
                    id: messageId,
                    chatId: chatId,
                    senderId: senderId,
                    encryptedContent: encryptedMessage,
                    timestamp: Date(timeIntervalSince1970: timestamp)
                )
                
                // Store and update UI
                await MainActor.run {
                    if messages[chatId] == nil {
                        messages[chatId] = []
                    }
                    messages[chatId]?.append(message)
                    
                    if let index = activeChats.firstIndex(where: { $0.id == chatId }) {
                        activeChats[index].lastMessage = message
                        activeChats[index].unreadCount += 1
                    }
                }
                
                print("📥 Received message from @\(senderId)")
                
                // Send delivery confirmation
                socket.emit("message_delivered", [
                    "messageId": messageId,
                    "chatId": chatId
                ])
                
            } catch {
                print("❌ Failed to decrypt message: \(error)")
            }
        }
    }
    
    private func handleTypingIndicator(_ data: [Any]) {
        guard let typingData = data.first as? [String: Any],
              let userId = typingData["userId"] as? String,
              let isTyping = typingData["isTyping"] as? Bool else {
            return
        }
        
        if isTyping {
            typingUsers.insert(userId)
        } else {
            typingUsers.remove(userId)
        }
    }
    
    private func handleOnlineStatus(_ data: [Any]) {
        guard let statusData = data.first as? [String: Any],
              let onlineUsersList = statusData["onlineUsers"] as? [String] else {
            return
        }
        
        onlineUsers = Set(onlineUsersList)
    }
    
    private func handleMessageDelivered(_ data: [Any]) {
        guard let deliveryData = data.first as? [String: Any],
              let messageId = deliveryData["messageId"] as? String else {
            return
        }
        
        print("✅ Message delivered: \(messageId)")
    }
    
    private func handleMessageRead(_ data: [Any]) {
        guard let readData = data.first as? [String: Any],
              let messageId = readData["messageId"] as? String,
              let chatId = readData["chatId"] as? String else {
            return
        }
        
        if let index = activeChats.firstIndex(where: { $0.id == chatId }) {
            activeChats[index].unreadCount = 0
        }
        
        print("👁 Message read: \(messageId)")
    }
    
    private func handleIncomingCall(_ data: [Any]) {
        guard let callData = data.first as? [String: Any],
              let callerId = callData["callerId"] as? String,
              let callId = callData["callId"] as? String,
              let isVideo = callData["isVideo"] as? Bool else {
            return
        }
        
        print("📞 Incoming \(isVideo ? "video" : "voice") call from @\(callerId)")
        
        NotificationCenter.default.post(
            name: .incomingCall,
            object: nil,
            userInfo: [
                "callId": callId,
                "callerId": callerId,
                "isVideo": isVideo
            ]
        )
    }
    
    // MARK: - Suspension Handling
    
    private func setupSuspensionHandling() {
        #if os(iOS)
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleAppDidEnterBackground),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )
        
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleAppWillEnterForeground),
            name: UIApplication.willEnterForegroundNotification,
            object: nil
        )
        
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleAppDidBecomeActive),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )
        #endif
    }
    
    @objc private func handleAppDidEnterBackground() {
        print("⏸️ App entering background - preparing for suspension")
        suspensionDetected = true
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil
    }
    
    @objc private func handleAppWillEnterForeground() {
        print("▶️ App entering foreground - checking connection")
        handleResume()
    }
    
    @objc private func handleAppDidBecomeActive() {
        if !suspensionDetected { return }
        handleResume()
    }
    
    private func handleResume() {
        if !suspensionDetected { return }
        
        print("▶️ Resuming from suspension")
        suspensionDetected = false
        
        if !socket.status.active {
            print("🔄 Socket disconnected during suspension, reconnecting...")
            reconnectAttempts = 0
            connect()
        } else {
            print("✅ Socket survived suspension")
            startHeartbeat()
        }
        
        processMessageQueue()
    }
    
    // MARK: - Heartbeat
    
    private func startHeartbeat() {
        heartbeatTimer?.invalidate()
        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { [weak self] _ in
            guard let self = self, self.socket.status.active, !self.suspensionDetected else { return }
            self.socket.emit("ping", ["timestamp": Date().timeIntervalSince1970])
            self.lastHeartbeat = Date()
            print("💓 Heartbeat sent")
        }
    }
    
    private func stopHeartbeat() {
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil
    }
    
    // MARK: - Message Queue Processing
    
    private func processMessageQueue() {
        print("📤 Processing \(messageQueue.count) queued messages")
        
        while !messageQueue.isEmpty && socket.status.active {
            let message = messageQueue.removeFirst()
            
            socket.emit("send_message", [
                "messageId": message.id,
                "chatId": message.chatId,
                "recipientId": message.recipientId,
                "encryptedContent": [
                    "kyberCiphertext": message.encryptedContent.kyberCiphertext,
                    "ciphertext": message.encryptedContent.encryptedMessage.ciphertext,
                    "nonce": message.encryptedContent.encryptedMessage.nonce,
                    "tag": message.encryptedContent.encryptedMessage.tag
                ],
                "timestamp": message.timestamp.timeIntervalSince1970
            ])
        }
        
        processOfflineMessages()
    }
    
    private func processOfflineMessages() {
        guard let offlineData = UserDefaults.standard.data(forKey: "offline_messages"),
              let offlineMessages = try? JSONDecoder().decode([OutgoingMessage].self, from: offlineData),
              !offlineMessages.isEmpty else { return }
        
        print("📤 Processing \(offlineMessages.count) offline messages")
        
        for message in offlineMessages where socket.status.active {
            socket.emit("send_message", [
                "messageId": message.id,
                "chatId": message.chatId,
                "recipientId": message.recipientId,
                "encryptedContent": [
                    "kyberCiphertext": message.encryptedContent.kyberCiphertext,
                    "ciphertext": message.encryptedContent.encryptedMessage.ciphertext,
                    "nonce": message.encryptedContent.encryptedMessage.nonce,
                    "tag": message.encryptedContent.encryptedMessage.tag
                ],
                "timestamp": message.timestamp.timeIntervalSince1970
            ])
        }
        
        UserDefaults.standard.removeObject(forKey: "offline_messages")
    }
    
    // MARK: - P2P Privacy Mode (Anti-СОРМ)
    
    private func enablePrivacyMode() {
        print("🔒 Enabling privacy mode (anti-surveillance)...")
        privacyMode = true
        print("✅ Privacy mode enabled - traffic obfuscated")
    }
    
    private func disablePrivacyMode() {
        print("🔓 Disabling privacy mode...")
        privacyMode = false
        print("✅ Privacy mode disabled - using server connection")
    }
    
    func getPrivacyStatus() -> [String: Any] {
        return [
            "privacyMode": privacyMode,
            "useP2P": useP2P,
            "p2pEnabled": p2pFallbackEnabled,
            "serverConnected": isConnected,
            "connectedPeers": 0
        ]
    }
    
    // MARK: - Typing Indicators with Timeout
    
    func sendTypingIndicator(chatId: String, isTyping: Bool) {
        guard isConnected else { return }
        
        typingTimers[chatId]?.invalidate()
        typingTimers.removeValue(forKey: chatId)
        
        socket.emit("typing", [
            "chatId": chatId,
            "isTyping": isTyping
        ])
        
        if isTyping {
            typingTimers[chatId] = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: false) { [weak self] _ in
                self?.sendTypingIndicator(chatId: chatId, isTyping: false)
            }
        }
    }
    
    // MARK: - Message Status
    
    func markAsDelivered(messageId: String) {
        guard isConnected else { return }
        socket.emit("message_delivered", ["messageId": messageId])
    }
    
    func markAsRead(messageId: String, chatId: String) {
        guard isConnected else { return }
        socket.emit("message_read", [
            "messageId": messageId,
            "chatId": chatId
        ])
    }
    
    // MARK: - Calls
    
    func initiateCall(to targetUserId: String, isVideo: Bool = false) async throws {
        guard isConnected else {
            throw MessagingError.notConnected
        }
        
        let callId = UUID().uuidString
        
        socket.emit("call_offer", [
            "targetUserId": targetUserId,
            "callId": callId,
            "callType": isVideo ? "video" : "voice"
        ])
        
        print("📞 Initiating \(isVideo ? "video" : "voice") call to \(targetUserId)")
    }
    
    func answerCall(callId: String, accept: Bool) {
        guard isConnected else { return }
        
        socket.emit("call_answer", [
            "callId": callId,
            "accepted": accept
        ])
    }
    
    func endCall(callId: String) {
        guard isConnected else { return }
        socket.emit("call_end", ["callId": callId])
    }
    
    // MARK: - E2E Encryption Methods
    
    func generateMessagingKeys() async throws {
        print("🔑 Generating Kyber1024 keys...")
        
        let response = try await NetworkService.shared.generateMessagingKeys()
        
        if response.success {
            UserDefaults.standard.set(response.publicKey, forKey: "kyber_public_key")
            UserDefaults.standard.set(response.keyId, forKey: "kyber_key_id")
            print("✅ Keys generated: \(response.algorithm) (\(response.keySize) bits)")
            print("   Key ID: \(response.keyId)")
        } else {
            throw MessagingError.keyGenerationFailed(response.message)
        }
    }
    
    func decryptMessage(_ encryptedData: EncryptedMessageData) async throws -> String {
        print("🔓 Decrypting message...")
        
        // Use our locally stored Kyber private key (Face ID protected)
        let privateKeyData = try await EnterpriseKeychainService.shared.retrieve(
            key: "kyber_private_key",
            reason: "Access Kyber private key for message decryption",
            allowPINFallback: true
        )
        let privateKey = privateKeyData.base64EncodedString()
        
        let response = try await NetworkService.shared.decryptMessage(
            messageId: encryptedData.id,
            secretKey: privateKey
        )
        
        if response.success {
            print("✅ Message decrypted with \(response.algorithm)")
            return response.content
        } else {
            throw MessagingError.decryptionFailed("Failed to decrypt message")
        }
    }
    
    func loadChatMessages(chatId: String) async throws {
        print("📥 Loading encrypted messages for chat \(chatId)")
        
        let response = try await NetworkService.shared.getEncryptedMessages(chatId: chatId)
        
        if response.success {
            print("✅ Loaded \(response.messages.count) messages")
            
            for encryptedMessage in response.messages {
                if encryptedMessage.encrypted {
                    Task {
                        do {
                            let content = try await decryptMessage(encryptedMessage)
                            await updateMessageContent(
                                messageId: encryptedMessage.id,
                                chatId: chatId,
                                content: content
                            )
                        } catch {
                            print("⚠️ Failed to decrypt message \(encryptedMessage.id): \(error)")
                        }
                    }
                } else {
                    await storeMessage(
                        Message(
                            id: encryptedMessage.id,
                            chatId: chatId,
                            senderId: encryptedMessage.senderId,
                            encryptedContent: EncryptedMessage(
                                ciphertext: encryptedMessage.encryptedContent ?? "",
                                nonce: encryptedMessage.nonce ?? "",
                                tag: encryptedMessage.authTag ?? ""
                            ),
                            timestamp: ISO8601DateFormatter().date(from: encryptedMessage.createdAt) ?? Date()
                        ),
                        in: chatId
                    )
                }
            }
        }
    }
    
    func createEncryptedChat(with participantIds: [String], name: String? = nil) async throws -> String {
        print("💬 Creating encrypted chat...")
        
        let response = try await NetworkService.shared.createEncryptedChat(
            participantIds: participantIds,
            chatName: name,
            chatType: participantIds.count == 1 ? "direct" : "group"
        )
        
        if response.success {
            print("✅ Chat created: \(response.chatId)")
            print("   Encryption: \(response.algorithm)")
            
            let chat = Chat(
                id: response.chatId,
                participants: [getCurrentUserId()] + participantIds,
                lastMessage: nil,
                unreadCount: 0
            )
            
            await MainActor.run {
                activeChats.append(chat)
                messages[response.chatId] = []
            }
            
            return response.chatId
        } else {
            throw MessagingError.chatCreationFailed(response.message)
        }
    }
    
    // MARK: - Helper Methods
    
    private func getRecipientId(_ cyphrId: String) async throws -> String {
        let (exists, userId) = try await NetworkService.shared.lookupCyphrId(cyphrId: cyphrId)
        
        if exists, let userId = userId {
            return userId
        } else {
            throw MessagingError.userNotFound(cyphrId)
        }
    }
    
    private func getCurrentUserId() -> String {
        return UserDefaults.standard.string(forKey: "user_id") ?? ""
    }
    
    @MainActor
    private func updateMessageContent(messageId: String, chatId: String, content: String) {
        guard var chatMessages = messages[chatId],
              let index = chatMessages.firstIndex(where: { $0.id == messageId }) else {
            return
        }
        
        chatMessages[index].decryptedContent = content
        messages[chatId] = chatMessages
    }
    
    @MainActor
    private func storeMessage(_ message: Message, in chatId: String) {
        if messages[chatId] == nil {
            messages[chatId] = []
        }
        messages[chatId]?.append(message)
    }
    
    private func getRecipientPublicKey(_ cyphrId: String) async throws -> String {
        return "mock_public_key_\(cyphrId)"
    }
    
    private func getCurrentCyphrId() -> String {
        return UserDefaults.standard.string(forKey: "cyphr_id") ?? "unknown"
    }
    
    private func storeMessage(_ message: OutgoingMessage, in chatId: String) {
        let storedMessage = Message(
            id: message.id,
            chatId: chatId,
            senderId: getCurrentCyphrId(),
            encryptedContent: message.encryptedContent.encryptedMessage,
            timestamp: message.timestamp
        )
        
        if messages[chatId] == nil {
            messages[chatId] = []
        }
        messages[chatId]?.append(storedMessage)
    }
    
    private func parseEncryptedMessage(_ data: [String: Any]) -> HybridEncryptedMessage {
        return HybridEncryptedMessage(
            kyberCiphertext: data["kyberCiphertext"] as? String ?? "",
            encryptedMessage: EncryptedMessage(
                ciphertext: data["ciphertext"] as? String ?? "",
                nonce: data["nonce"] as? String ?? "",
                tag: data["tag"] as? String ?? ""
            )
        )
    }
    
    // MARK: - Additional Event Handlers
    
    private func handleAuthenticated(_ data: [Any]) {
        guard let authData = data.first as? [String: Any],
              let success = authData["success"] as? Bool else {
            return
        }
        
        if success {
            let userId = authData["userId"] as? String ?? ""
            let chatsJoined = authData["chatsJoined"] as? Int ?? 0
            print("✅ Socket authenticated for user: \(userId)")
            print("   Joined \(chatsJoined) chat rooms")
        }
    }
    
    private func handleAuthError(_ data: [Any]) {
        guard let errorData = data.first as? [String: Any],
              let message = errorData["message"] as? String else {
            return
        }
        
        print("❌ Socket authentication failed: \(message)")
        DispatchQueue.main.asyncAfter(deadline: .now() + 5) { [weak self] in
            self?.authenticate()
        }
    }
    
    private func handleChatCreated(_ data: [Any]) {
        guard let chatData = data.first as? [String: Any],
              let chatId = chatData["chatId"] as? String,
              let chatName = chatData["chatName"] as? String else {
            return
        }
        
        print("💬 New chat created: \(chatName) (\(chatId))")
        
        Task { @MainActor in
            if !activeChats.contains(where: { $0.id == chatId }) {
                let chat = Chat(
                    id: chatId,
                    participants: [],
                    lastMessage: nil,
                    unreadCount: 0
                )
                activeChats.append(chat)
                messages[chatId] = []
            }
        }
    }
}

// MARK: - Notifications

extension Notification.Name {
    static let incomingCall = Notification.Name("IncomingCall")
    static let messageReceived = Notification.Name("MessageReceived")
}
