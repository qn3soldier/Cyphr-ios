import SwiftUI
import Combine

/// Enterprise-Grade New Chat Screen - WhatsApp/Telegram Level
struct NewChatView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var networkService = NetworkService.shared
    @StateObject private var messagingService = MessagingService.shared
    @StateObject private var zeroKnowledge = ZeroKnowledgeLookup.shared
    
    @State private var searchText = ""
    @State private var searchMode: SearchMode = .cyphrId
    @State private var searchResults: [DiscoveredUser] = []
    @State private var recentContacts: [DiscoveredUser] = []
    @State private var suggestedContacts: [DiscoveredUser] = []
    @State private var isSearching = false
    @State private var showingQRScanner = false
    @State private var showingGroupCreation = false
    @State private var selectedUser: DiscoveredUser?
    
    // Debounce timer for search
    @State private var searchTimer: Timer?
    
    enum SearchMode: String, CaseIterable {
        case cyphrId = "Cyphr ID"
        case username = "Username"
        case publicKey = "Public Key"
        case nearby = "Nearby"
        
        var icon: String {
            switch self {
            case .cyphrId: return "at"
            case .username: return "person"
            case .publicKey: return "key"
            case .nearby: return "location.circle"
            }
        }
    }
    
    var body: some View {
        NavigationView {
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
                    // Header
                    header
                    
                    // Search modes
                    searchModePicker
                    
                    // Search bar
                    searchBar
                    
                    // Content
                    ScrollView {
                        VStack(spacing: 24) {
                            // Quick actions
                            if searchText.isEmpty && !isSearching {
                                quickActions
                            }
                            
                            // Search results
                            if isSearching {
                                searchingIndicator
                            } else if !searchResults.isEmpty {
                                searchResultsList
                            } else if !searchText.isEmpty {
                                noResultsView
                            }
                            
                            // Recent contacts
                            if searchText.isEmpty && !recentContacts.isEmpty {
                                recentContactsList
                            }
                            
                            // Suggested contacts
                            if searchText.isEmpty && !suggestedContacts.isEmpty {
                                suggestedContactsList
                            }
                        }
                        .padding()
                    }
                }
            }
            #if os(iOS)
            .navigationBarHidden(true)
            #endif
            .sheet(isPresented: $showingQRScanner) {
                QRScannerView { cyphrId in
                    handleScannedQR(cyphrId)
                }
            }
            .sheet(isPresented: $showingGroupCreation) {
                CreateGroupView()
            }
            .sheet(item: $selectedUser) { user in
                UserDetailView(user: user)
            }
        }
        .onAppear {
            loadRecentContacts()
            loadSuggestedContacts()
        }
    }
    
    // MARK: - Header
    
    private var header: some View {
        HStack {
            Button(action: { dismiss() }) {
                Image(systemName: "xmark.circle.fill")
                    .font(.title2)
                    .foregroundColor(.white.opacity(0.5))
            }
            
            Spacer()
            
            Text("New Chat")
                .font(.title2.bold())
                .foregroundColor(.white)
            
            Spacer()
            
            Button(action: { showingQRScanner = true }) {
                Image(systemName: "qrcode.viewfinder")
                    .font(.title2)
                    .foregroundColor(.white.opacity(0.7))
            }
        }
        .padding()
    }
    
    // MARK: - Search Mode Picker
    
    private var searchModePicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(SearchMode.allCases, id: \.self) { mode in
                    Button(action: { searchMode = mode }) {
                        HStack(spacing: 4) {
                            Image(systemName: mode.icon)
                                .font(.caption)
                            Text(mode.rawValue)
                                .font(.caption.bold())
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(
                            searchMode == mode ?
                            AnyShapeStyle(LinearGradient(
                                colors: [.purple, .blue],
                                startPoint: .leading,
                                endPoint: .trailing
                            )) :
                            AnyShapeStyle(Color.white.opacity(0.1))
                        )
                        .foregroundColor(.white)
                        .cornerRadius(20)
                    }
                }
            }
            .padding(.horizontal)
        }
        .padding(.bottom, 8)
    }
    
    // MARK: - Search Bar
    
    private var searchBar: some View {
        HStack {
            Image(systemName: "magnifyingglass")
                .foregroundColor(.white.opacity(0.5))
            
            TextField(searchPlaceholder, text: $searchText)
                .foregroundColor(.white)
                .accentColor(.purple)
                #if os(iOS)
                .autocapitalization(.none)
                #endif
                .disableAutocorrection(true)
                .onChangeCompat(of: searchText) {
                    handleSearchChange(searchText)
                }
            
            if !searchText.isEmpty {
                Button(action: { searchText = "" }) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.white.opacity(0.3))
                }
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.white.opacity(0.1))
        )
        .padding(.horizontal)
    }
    
    private var searchPlaceholder: String {
        switch searchMode {
        case .cyphrId:
            return "Enter @cyphr_id..."
        case .username:
            return "Enter username..."
        case .publicKey:
            return "Enter public key..."
        case .nearby:
            return "Discovering nearby users..."
        }
    }
    
    // MARK: - Quick Actions
    
    private var quickActions: some View {
        VStack(spacing: 12) {
            // Create Group
            Button(action: { showingGroupCreation = true }) {
                HStack {
                    Circle()
                        .fill(LinearGradient(
                            colors: [.green, .mint],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ))
                        .frame(width: 50, height: 50)
                        .overlay(
                            Image(systemName: "person.3.fill")
                                .foregroundColor(.white)
                        )
                    
                    Text("New Group")
                        .font(.headline)
                        .foregroundColor(.white)
                    
                    Spacer()
                    
                    Image(systemName: "chevron.right")
                        .foregroundColor(.white.opacity(0.5))
                }
                .padding()
                .background(Color.white.opacity(0.05))
                .cornerRadius(12)
            }
            
            // New Channel
            Button(action: {}) {
                HStack {
                    Circle()
                        .fill(LinearGradient(
                            colors: [.blue, .cyan],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ))
                        .frame(width: 50, height: 50)
                        .overlay(
                            Image(systemName: "megaphone.fill")
                                .foregroundColor(.white)
                        )
                    
                    Text("New Channel")
                        .font(.headline)
                        .foregroundColor(.white)
                    
                    Spacer()
                    
                    Image(systemName: "chevron.right")
                        .foregroundColor(.white.opacity(0.5))
                }
                .padding()
                .background(Color.white.opacity(0.05))
                .cornerRadius(12)
            }
            
            // Nearby Users
            Button(action: { searchMode = .nearby }) {
                HStack {
                    Circle()
                        .fill(LinearGradient(
                            colors: [.orange, .yellow],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ))
                        .frame(width: 50, height: 50)
                        .overlay(
                            Image(systemName: "location.circle.fill")
                                .foregroundColor(.white)
                        )
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text("People Nearby")
                            .font(.headline)
                            .foregroundColor(.white)
                        Text("Find users within 1km")
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.5))
                    }
                    
                    Spacer()
                    
                    Image(systemName: "chevron.right")
                        .foregroundColor(.white.opacity(0.5))
                }
                .padding()
                .background(Color.white.opacity(0.05))
                .cornerRadius(12)
            }
        }
    }
    
    // MARK: - Search Results
    
    private var searchingIndicator: some View {
        VStack(spacing: 12) {
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: .purple))
                .scaleEffect(1.5)
            
            Text("Searching...")
                .font(.caption)
                .foregroundColor(.white.opacity(0.5))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }
    
    private var searchResultsList: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Search Results")
                .font(.headline)
                .foregroundColor(.white.opacity(0.7))
            
            VStack(spacing: 0) {
                ForEach(searchResults) { user in
                    UserRow(user: user) {
                        startChat(with: user)
                    }
                    
                    if user.id != searchResults.last?.id {
                        Divider()
                            .background(Color.white.opacity(0.1))
                            .padding(.leading, 66)
                    }
                }
            }
            .background(Color.white.opacity(0.05))
            .cornerRadius(12)
        }
    }
    
    private var noResultsView: some View {
        VStack(spacing: 16) {
            Image(systemName: "magnifyingglass.circle")
                .font(.system(size: 60))
                .foregroundColor(.white.opacity(0.3))
            
            Text("No users found")
                .font(.headline)
                .foregroundColor(.white.opacity(0.5))
            
            Text("Try a different search term")
                .font(.caption)
                .foregroundColor(.white.opacity(0.3))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }
    
    // MARK: - Recent Contacts
    
    private var recentContactsList: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Recent")
                    .font(.headline)
                    .foregroundColor(.white.opacity(0.7))
                
                Spacer()
                
                Button(action: { recentContacts.removeAll() }) {
                    Text("Clear")
                        .font(.caption)
                        .foregroundColor(.purple)
                }
            }
            
            VStack(spacing: 0) {
                ForEach(recentContacts) { user in
                    UserRow(user: user) {
                        startChat(with: user)
                    }
                    
                    if user.id != recentContacts.last?.id {
                        Divider()
                            .background(Color.white.opacity(0.1))
                            .padding(.leading, 66)
                    }
                }
            }
            .background(Color.white.opacity(0.05))
            .cornerRadius(12)
        }
    }
    
    // MARK: - Suggested Contacts
    
    private var suggestedContactsList: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Suggested")
                .font(.headline)
                .foregroundColor(.white.opacity(0.7))
            
            VStack(spacing: 0) {
                ForEach(suggestedContacts) { user in
                    UserRow(user: user) {
                        startChat(with: user)
                    }
                    
                    if user.id != suggestedContacts.last?.id {
                        Divider()
                            .background(Color.white.opacity(0.1))
                            .padding(.leading, 66)
                    }
                }
            }
            .background(Color.white.opacity(0.05))
            .cornerRadius(12)
        }
    }
    
    // MARK: - Actions
    
    private func handleSearchChange(_ query: String) {
        // Cancel previous timer
        searchTimer?.invalidate()
        
        guard !query.isEmpty else {
            searchResults = []
            isSearching = false
            return
        }
        
        // Start new timer with debounce
        searchTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: false) { _ in
            Task {
                await performSearch(query)
            }
        }
    }
    
    private func performSearch(_ query: String) async {
        isSearching = true
        
        do {
            switch searchMode {
            case .cyphrId:
                if let user = try await zeroKnowledge.searchByCyphrId(query) {
                    searchResults = [user]
                } else {
                    searchResults = []
                }
                
            case .username:
                searchResults = try await zeroKnowledge.searchByUsername(query)
                
            case .publicKey:
                if try await zeroKnowledge.checkUserExists(cyphrId: query) {
                    // Create placeholder user for public key
                    searchResults = [DiscoveredUser(
                        id: UUID().uuidString,
                        cyphrIdHash: nil,
                        fullName: "Public Key User",
                        avatarUrl: nil,
                        bio: nil,
                        uniqueId: nil,
                        username: nil,
                        status: "active",
                        publicKey: query,
                        lastSeen: nil,
                        createdAt: Date()
                    )]
                } else {
                    searchResults = []
                }
                
            case .nearby:
                // TODO: Implement nearby discovery
                searchResults = []
            }
        } catch {
            print("Search error: \(error)")
            searchResults = []
        }
        
        isSearching = false
    }
    
    private func handleScannedQR(_ cyphrId: String) {
        searchMode = .cyphrId
        searchText = cyphrId
        showingQRScanner = false
    }
    
    private func startChat(with user: DiscoveredUser) {
        // Create new chat
        let chat = Chat(
            id: UUID().uuidString,
            participants: [user.cyphrId ?? user.id],
            lastMessage: nil,
            unreadCount: 0
        )
        
        // Add to active chats
        messagingService.activeChats.append(chat)
        
        // Navigate to chat
        dismiss()
    }
    
    private func loadRecentContacts() {
        // Load from UserDefaults or database
        recentContacts = []
    }
    
    private func loadSuggestedContacts() {
        // Load suggested users
        suggestedContacts = []
    }
}

// MARK: - User Row View

struct UserRow: View {
    let user: DiscoveredUser
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                let initialsSource = user.displayName.isEmpty ? (user.cyphrId ?? "?") : user.displayName
                let primaryDisplay = user.displayName.isEmpty ? (user.cyphrId ?? "Unknown") : user.displayName
                // Avatar
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [.purple, .blue],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 50, height: 50)
                    .overlay(
                        Text(initialsSource.prefix(2).uppercased())
                            .font(.headline)
                            .foregroundColor(.white)
                    )
                    .overlay(
                        // Online indicator
                        Circle()
                            .fill(Color.green)
                            .frame(width: 14, height: 14)
                            .overlay(
                                Circle()
                                    .stroke(Color.black, lineWidth: 2)
                            )
                            .offset(x: 15, y: 15)
                            .opacity(user.isOnline ? 1 : 0)
                    )
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(primaryDisplay)
                        .font(.headline)
                        .foregroundColor(.white)
                    
                    if let cyphrId = user.cyphrId {
                        Text("@\(cyphrId)")
                            .font(.caption)
                            .foregroundColor(.purple)
                    }
                    
                    if user.isOnline {
                        Text("Online")
                            .font(.caption2)
                            .foregroundColor(.green)
                    }
                }
                
                Spacer()
                
                // Encryption badge
                Image(systemName: "lock.shield.fill")
                    .font(.caption)
                    .foregroundColor(.green.opacity(0.7))
            }
            .padding()
        }
    }
}

// MARK: - QR Scanner View

struct QRScannerView: View {
    @Environment(\.dismiss) private var dismiss
    let onScan: (String) -> Void
    
    var body: some View {
        NavigationView {
            ZStack {
                LinearGradient(
                    colors: [
                        Color(red: 0.05, green: 0.06, blue: 0.10),
                        Color(red: 0.07, green: 0.08, blue: 0.12)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()
                
                VStack(spacing: 24) {
                    Text("Scan QR Code")
                        .font(.largeTitle.bold())
                        .foregroundColor(.white)
                    
                    // QR Scanner placeholder
                    RoundedRectangle(cornerRadius: 20)
                        .stroke(Color.purple, lineWidth: 2)
                        .frame(width: 250, height: 250)
                        .overlay(
                            Image(systemName: "qrcode.viewfinder")
                                .font(.system(size: 100))
                                .foregroundColor(.white.opacity(0.3))
                        )
                    
                    Text("Point camera at QR code")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.5))
                }
            }
            #if os(iOS)
            .navigationBarItems(
                trailing: Button("Cancel") {
                    dismiss()
                }
            )
            #else
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
            #endif
                .foregroundColor(.white)
        }
    }
}

// MARK: - Create Group View

struct CreateGroupView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var groupName = ""
    @State private var selectedMembers: Set<String> = []
    
    var body: some View {
        NavigationView {
            ZStack {
                LinearGradient(
                    colors: [
                        Color(red: 0.05, green: 0.06, blue: 0.10),
                        Color(red: 0.07, green: 0.08, blue: 0.12)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()
                
                VStack(spacing: 24) {
                    Text("New Group")
                        .font(.largeTitle.bold())
                        .foregroundColor(.white)
                    
                    // Group name input
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Group Name")
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.5))
                        
                        TextField("Enter group name", text: $groupName)
                            .padding()
                            .background(Color.white.opacity(0.1))
                            .cornerRadius(12)
                            .foregroundColor(.white)
                    }
                    .padding(.horizontal)
                    
                    // Add members section
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Add Members")
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.5))
                            .padding(.horizontal)
                        
                        // Member selection list
                        ScrollView {
                            // TODO: Add member selection
                        }
                    }
                    
                    Spacer()
                }
            }
            #if os(iOS)
            .navigationBarItems(
                leading: Button("Cancel") {
                    dismiss()
                }
                .foregroundColor(.white),
                trailing: Button("Create") {
                    createGroup()
                }
                .foregroundColor(.purple)
                .disabled(groupName.isEmpty || selectedMembers.isEmpty)
            )
            #endif
        }
    }
    
    private func createGroup() {
        // TODO: Implement group creation
        dismiss()
    }
}

// MARK: - User Detail View

struct UserDetailView: View {
    @Environment(\.dismiss) private var dismiss
    let user: DiscoveredUser
    
    var body: some View {
        NavigationView {
            ZStack {
                LinearGradient(
                    colors: [
                        Color(red: 0.05, green: 0.06, blue: 0.10),
                        Color(red: 0.07, green: 0.08, blue: 0.12)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()
                
                VStack(spacing: 24) {
                    // User avatar
                    let initialsSource = user.displayName.isEmpty ? (user.cyphrId ?? "?") : user.displayName
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [.purple, .blue],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 120, height: 120)
                        .overlay(
                            Text(initialsSource.prefix(2).uppercased())
                                .font(.system(size: 48, weight: .bold))
                                .foregroundColor(.white)
                        )
                    
                    // User info
                    VStack(spacing: 8) {
                        let primaryDisplay = user.displayName.isEmpty ? (user.cyphrId ?? "Unknown") : user.displayName
                        Text(primaryDisplay)
                            .font(.title2.bold())
                            .foregroundColor(.white)
                        
                        if let cyphrId = user.cyphrId {
                            Text("@\(cyphrId)")
                                .font(.body)
                                .foregroundColor(.purple)
                        }
                        
                        if user.isOnline {
                            HStack(spacing: 4) {
                                Circle()
                                    .fill(Color.green)
                                    .frame(width: 8, height: 8)
                                Text("Online")
                                    .font(.caption)
                                    .foregroundColor(.green)
                            }
                        }
                    }
                    
                    // Actions
                    VStack(spacing: 12) {
                        Button(action: {}) {
                            Label("Start Chat", systemImage: "message.fill")
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(LinearGradient(
                                    colors: [.purple, .blue],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                ))
                                .foregroundColor(.white)
                                .cornerRadius(12)
                        }
                        
                        Button(action: {}) {
                            Label("Voice Call", systemImage: "phone.fill")
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(Color.white.opacity(0.1))
                                .foregroundColor(.white)
                                .cornerRadius(12)
                        }
                        
                        Button(action: {}) {
                            Label("Video Call", systemImage: "video.fill")
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(Color.white.opacity(0.1))
                                .foregroundColor(.white)
                                .cornerRadius(12)
                        }
                    }
                    .padding(.horizontal)
                    
                    Spacer()
                }
                .padding(.top, 40)
            }
            #if os(iOS)
            .navigationBarItems(
                trailing: Button("Done") {
                    dismiss()
                }
                .foregroundColor(.white)
            )
            #endif
        }
    }
}

// MARK: - Preview

struct NewChatView_Previews: PreviewProvider {
    static var previews: some View {
        NewChatView()
    }
}
