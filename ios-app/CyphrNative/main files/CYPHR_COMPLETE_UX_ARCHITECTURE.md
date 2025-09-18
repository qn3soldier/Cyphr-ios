# 🏗️ CYPHR MESSENGER - COMPLETE UX ARCHITECTURE & FLOW MAP
**Version**: 2.0.0
**Date**: September 13, 2025
**Last Updated**: September 13, 2025
**Purpose**: Complete UX/UI architecture, navigation flows, and interaction specifications

## 📝 CHANGELOG

### Version 2.0.0 (September 13, 2025)
- ✅ Synchronized with CYPHR_ID_ARCHITECTURE.md
- ✅ Fixed Sign Up flow order: ID → Keys → Biometric → PIN → Register → Recovery
- ✅ Added device fingerprinting to security flows
- ✅ Fixed Reset Identity: now invalidates (not deletes) on backend
- ✅ Added wallet/blockchain logic to Reset flow
- ✅ Added HD wallet integration to Sign Up
- ✅ Added comprehensive wallet warnings for Reset Identity
- ✅ Fixed Recovery flow with wallet restoration
- ✅ Added progressive PIN rate limiting details
- ✅ Added wallet security thresholds

### Version 1.0.0 (September 8, 2025)
- Initial release

---

## 📋 TABLE OF CONTENTS

1. [App Launch & Initialization](#app-launch--initialization)
2. [Authentication Flows](#authentication-flows)
3. [Main Application Structure](#main-application-structure)
4. [Screen Specifications](#screen-specifications)
5. [Modal & Alert Patterns](#modal--alert-patterns)
6. [Error Handling Matrix](#error-handling-matrix)
7. [State Management](#state-management)
8. [Navigation Rules](#navigation-rules)
9. [Security Flows](#security-flows)
10. [Data Flow Architecture](#data-flow-architecture)

---

## 🚀 APP LAUNCH & INITIALIZATION

### **Launch Sequence**
```
[App Icon Tap]
    ↓
[Splash Screen] (1-2 seconds)
    ├── Load app resources
    ├── Check network connectivity
    ├── Initialize crypto services
    └── Determine initial route
        ↓
[Route Decision]
    ├── Has stored identity? → [Biometric/PIN Login]
    ├── No identity? → [Welcome Screen]
    └── Identity corrupted? → [Recovery Required]
```

### **Splash Screen Specifications**
- **Duration**: 1-2 seconds minimum, 5 seconds maximum
- **UI Elements**:
  - Cyphr logo (animated glow effect)
  - App version number (bottom)
  - Loading indicator (subtle)
- **Background Tasks**:
  - Initialize SwiftKyber
  - Check Keychain for stored identity
  - Verify network connectivity
  - Preload frequently used assets
- **Exit Conditions**:
  - Success → Navigate based on auth state
  - Network failure → Offline mode warning
  - Critical error → Error screen

---

## 🔐 AUTHENTICATION FLOWS

### **1. WELCOME SCREEN**
```
[Welcome Screen]
├── UI Elements:
│   ├── Logo + Tagline
│   ├── "World's First Quantum-Safe Messenger"
│   └── Three action buttons
│
├── Actions:
│   ├── [Create New Identity] → Sign Up Flow
│   ├── [I Have Cyphr ID] → Sign In Flow
│   └── [Recover Identity] → Recovery Flow
│
└── Background:
    └── Animated gradient (purple → blue)
```

### **2. SIGN UP FLOW (NEW USER)**

#### **Step 1: Choose Cyphr ID**
```
[Choose Cyphr ID Screen]
├── Header: "Choose Your Unique Identity"
├── Subtitle: "This cannot be changed later"
│
├── Input Field:
│   ├── Placeholder: "@username"
│   ├── Real-time validation
│   ├── Character limit: 3-30
│   ├── Allowed: a-z, 0-9, underscore
│   └── Visual feedback:
│       ├── ❌ Red border if taken
│       ├── ✅ Green border if available
│       └── ⏳ Loading spinner while checking
│
├── Availability Check:
│   ├── Debounce: 500ms after typing stops
│   ├── API call: POST /api/cyphr-id/check
│   └── Cache results for 5 minutes
│
├── If Taken:
│   ├── Show: "This ID is taken"
│   └── Suggestions: 3-5 alternatives (randomized)
│       └── Tap to auto-fill
│
├── Navigation:
│   ├── [Back] → Welcome Screen
│   └── [Next] → Step 2 (only if available)
│
└── Error States:
    ├── Network error → Retry button
    ├── Invalid format → Inline error message
    └── Server error → Modal with retry
```

#### **Step 2: Generate Identity & Keys**
```
[Generating Identity Screen]
├── Header: "Creating Your Secure Identity"
├── Progress indicators:
│   ├── "Generating Ed25519 keypair..." ✅
│   ├── "Generating Kyber1024 post-quantum keys..." ✅
│   ├── "Creating BIP39 seed phrase..." ✅
│   ├── "Deriving HD wallet..." ✅
│   ├── "Generating device fingerprint..." ✅
│   └── "Securing in Secure Enclave..." ✅
│
├── What's happening (technical):
│   ├── Generate Ed25519 keypair (identity)
│   ├── Generate Kyber1024 keypair (messaging)
│   ├── Create BIP39 seed phrase (12 words)
│   ├── Derive HD wallet (Stellar/multi-chain)
│   ├── Generate device fingerprint:
│   │   └── SHA256(SALT + deviceId + model + OS + app version)
│   ├── Store private keys in Secure Enclave
│   └── Prepare public keys for registration
│
├── Error Handling:
│   ├── Key generation failed → Retry
│   ├── Secure Enclave error → Fallback to Keychain
│   └── Critical error → Start over
│
└── Success → Step 3
```

#### **Step 3: Biometric Setup (Primary Auth)**
```
[Enable Biometric Screen]
├── Header: "Secure Your Identity"
├── Subtitle: "Use Face ID/Touch ID for quick access"
│
├── UI Elements:
│   ├── Large Face ID/Touch ID icon
│   ├── Benefits list:
│   │   ├── "Most secure option"
│   │   ├── "Hardware-backed protection"
│   │   └── "Recommended"
│   └── Toggle switch (default: ON)
│
├── Actions:
│   ├── [Enable Face ID/Touch ID] → System permission
│   │   ├── Success → Step 4
│   │   └── Denied → Show instructions → Step 4
│   └── [Skip] → Step 4 (PIN required)
│
├── Permission Handling:
│   ├── First time → System dialog
│   ├── Previously denied → Settings deeplink
│   └── Not available → Skip to Step 4
│
└── Navigation:
    └── [Continue] → Step 4
```

#### **Step 4: PIN Setup (Fallback Auth)**
```
[Create PIN Screen]
├── Header: "Backup Authentication"
├── Subtitle: "Create a 6-digit PIN for when biometric fails"
│   └── Or "Primary authentication" if no biometric
│
├── PIN Entry:
│   ├── 6 secure text fields
│   ├── Auto-focus next field
│   ├── Numeric keyboard only
│   └── Visual: ● ● ● ● ● ●
│
├── Validation:
│   ├── Must be 6 digits
│   ├── Not sequential (123456)
│   ├── Not repeated (111111)
│   └── Not common (000000, 123123)
│
├── Confirm PIN:
│   ├── Second entry for confirmation
│   ├── Must match first entry
│   └── Show error if mismatch
│
├── Storage:
│   └── SHA256(salt + PIN) → Keychain
│
├── Navigation:
│   ├── [Back] → Step 3
│   └── [Next] → Step 5
│
└── Note: PIN is REQUIRED even with biometric
```

#### **Step 5: Register on Network**
```
[Registering Screen]
├── Header: "Registering Your Identity"
├── Progress:
│   └── "Registering with zero-knowledge network..."
│
├── What's sent to server:
│   ├── Cyphr ID (chosen username)
│   ├── Ed25519 public key
│   ├── Kyber1024 public key
│   ├── Device fingerprint hash
│   └── Signature (proof of private key)
│
├── What's NOT sent:
│   ├── ❌ Private keys (stay in Secure Enclave)
│   ├── ❌ PIN or biometric data
│   ├── ❌ Recovery phrase
│   ├── ❌ Wallet private keys
│   └── ❌ Any personal information
│
├── Error Handling:
│   ├── Network error → Retry with exponential backoff
│   ├── Username taken → Back to Step 1
│   └── Server error → Show error → Retry
│
└── Success → Step 6
```

#### **Step 6: Backup Recovery Phrase**
```
[Recovery Phrase Screen]
├── Header: "Save Your Recovery Phrase"
├── Warning: "⚠️ This is the ONLY way to recover your account"
│
├── 12 Words Display:
│   ├── 4x3 grid layout
│   ├── Numbered 1-12
│   ├── Monospace font
│   └── Blur effect initially
│
├── Actions:
│   ├── [Reveal] → Show words (blur removed)
│   ├── [Copy All] → Clipboard + confirmation
│   └── [I've Written It Down] → Verification
│
├── Verification Screen:
│   ├── "Verify word #3, #7, #11"
│   ├── Text input for each
│   ├── Case-insensitive check
│   └── 3 attempts maximum
│
├── Security:
│   ├── Screenshot detection → Warning
│   ├── Screen recording → Blocked
│   └── App switcher → Blur content
│
└── Success → Main App
```

### **3. SIGN IN FLOW (EXISTING USER)**

#### **Step 1: Enter Cyphr ID**
```
[Sign In Screen]
├── Header: "Welcome Back"
├── Input: Cyphr ID
│   ├── Placeholder: "@your_cyphr_id"
│   └── Auto-capitalize: OFF
│
├── [Next] → Check backend
│   ├── User exists → Auth method selection
│   ├── User not found → Error message
│   └── Multiple devices → Device selection
│
└── [Forgot Cyphr ID?] → Recovery options
```

#### **Step 2: Authentication Method**
```
[Auth Method Detection]
├── Query backend for user's auth methods
│
├── If has biometric:
│   └── → Biometric Authentication Screen
│
├── If has PIN only:
│   └── → PIN Entry Screen
│
├── If neither (shouldn't happen):
│   └── → Recovery Required Screen
│
└── If multiple devices:
    └── → Device Selection Screen
```

#### **Biometric Authentication**
```
[Biometric Login Screen]
├── Header: "Verify Your Identity"
├── Large Face ID/Touch ID animation
│
├── Auto-trigger on screen load
│   ├── Success → Decrypt keys → Main App
│   ├── Failed → Show retry button
│   └── Canceled → Show PIN option
│
├── Fallback Options:
│   ├── [Use PIN Instead] → PIN Entry
│   └── [Use Recovery Phrase] → Recovery Flow
│
└── After 3 failures → Force PIN
```

#### **PIN Entry**
```
[PIN Entry Screen]
├── Header: "Enter Your PIN"
├── 6 secure digit fields
│
├── Auto-submit when 6 digits entered
│   ├── Correct → Decrypt keys → Main App
│   ├── Wrong → Shake animation + clear
│   └── 3 failures → 30 second lockout
│
├── Progressive Lockout:
│   ├── 3 attempts: 30 seconds
│   ├── 5 attempts: 5 minutes
│   ├── 10 attempts: 1 hour
│   └── 15 attempts: Wipe option
│
└── [Forgot PIN?] → Recovery Flow
```

### **4. RECOVERY FLOW**

#### **Recovery Method Selection**
```
[Recovery Options Screen]
├── Option 1: Recovery Phrase
│   └── [I Have My 12 Words] → Phrase Entry
│
├── Option 2: Another Device
│   └── [Recover from Device] → QR Scan
│
└── Option 3: No Recovery
    └── [Start Fresh] → Confirm wipe → Sign Up
```

#### **Recovery Phrase Entry**
```
[Enter Recovery Phrase]
├── Header: "Restore Your Identity"
├── Subtitle: "Enter your 12-word recovery phrase"
│
├── Input:
│   ├── 12 input fields (4x3 grid)
│   ├── Auto-focus next field
│   ├── Autocomplete from BIP39 wordlist
│   ├── Paste detection → Auto-split by spaces
│   └── Clear all button
│
├── Validation:
│   ├── All words in BIP39 list
│   ├── Checksum validation
│   └── Derive keys to verify
│
├── Success - What gets restored:
│   ├── Identity keys (Ed25519) → Need new Cyphr ID
│   ├── Messaging keys (Kyber1024) → Same as before
│   ├── HD Wallet keys → SAME blockchain addresses!
│   │   └── Balances will auto-appear from blockchain
│   ├── Device fingerprint → Generate new
│   └── Messages → Cannot restore (different identity)
│
├── Recovery Flow:
│   ├── Step 1: Choose new Cyphr ID
│   │   └── Old one might be taken
│   ├── Step 2: Set up PIN
│   ├── Step 3: Set up Biometric
│   ├── Step 4: Register with backend
│   │   └── New cyphr_id + same public keys
│   └── Step 5: Wallet sync
│       ├── Check blockchain balances
│       ├── Show: "Wallet restored: $X,XXX.XX"
│       └── All funds accessible!
│
└── Failure:
    ├── Invalid phrase → Error message
    ├── Network error → Retry
    └── 5 attempts → 30 min lockout
```

---

## 📱 MAIN APPLICATION STRUCTURE

### **Tab Bar Navigation**
```
[Main App]
├── Tab 1: Chats (default)
├── Tab 2: Calls
├── Tab 3: Wallet
└── Tab 4: Profile

Visual Style:
├── Background: Blur effect
├── Selected: Purple gradient
├── Icons: SF Symbols
└── Badge: Unread count
```

### **1. CHATS TAB**

#### **Chat List Screen**
```
[Chat List]
├── Navigation Bar:
│   ├── Title: "Chats"
│   ├── [Search] → Search overlay
│   └── [New Chat] → New chat screen
│
├── List Items (per chat):
│   ├── Avatar (left)
│   ├── Name + Last message
│   ├── Timestamp (right)
│   ├── Unread badge
│   └── Swipe actions:
│       ├── Delete (red)
│       ├── Mute (purple)
│       └── Pin (yellow)
│
├── Empty State:
│   ├── Icon: Chat bubbles
│   ├── Text: "No conversations yet"
│   └── [Start Chatting] → New chat
│
├── Pull to Refresh:
│   └── Sync latest messages
│
└── Long Press:
    └── Context menu
        ├── Mark as read
        ├── Mute
        ├── Delete
        └── Pin to top
```

#### **Chat Detail Screen**
```
[Chat Detail]
├── Navigation Bar:
│   ├── [Back] → Chat list
│   ├── Avatar + Name (center)
│   ├── Status: Online/Offline/Typing
│   └── [Options] → Chat settings
│
├── Messages Area:
│   ├── Message Bubble (sent):
│   │   ├── Text content
│   │   ├── Timestamp
│   │   ├── Read receipts (✓✓)
│   │   └── Long press → Options
│   │
│   ├── Message Bubble (received):
│   │   ├── Text content
│   │   ├── Timestamp
│   │   └── Long press → Options
│   │
│   ├── System Messages:
│   │   ├── "Messages are end-to-end encrypted"
│   │   └── Date separators
│   │
│   └── Special Types:
│       ├── Images → Lightbox on tap
│       ├── Voice → Waveform player
│       ├── Files → Download button
│       └── Calls → Duration + icon
│
├── Input Bar:
│   ├── [Attach] → Media picker
│   ├── Text field (expandable)
│   ├── [Voice] → Hold to record
│   └── [Send] → Disabled if empty
│
├── Encryption Indicator:
│   └── 🔒 "Secured with Kyber1024"
│
└── Typing Indicator:
    └── "Alice is typing..."
```

#### **New Chat Screen**
```
[New Chat]
├── Search Bar:
│   ├── Placeholder: "Search Cyphr ID"
│   └── Real-time search
│
├── Sections:
│   ├── Recent Contacts
│   ├── All Contacts
│   └── Suggested Users
│
├── Contact Item:
│   ├── Avatar
│   ├── Display name
│   ├── @cyphr_id
│   └── [Message] → Create chat
│
├── Empty Search:
│   └── "No users found"
│
└── Add by ID:
    ├── Input: @cyphr_id
    └── [Add] → Verify → Create chat
```

### **2. CALLS TAB**

#### **Call History Screen**
```
[Call History]
├── Navigation Bar:
│   ├── Title: "Calls"
│   ├── [Filter] → All/Missed
│   └── [New Call] → Contact picker
│
├── Call Item:
│   ├── Avatar
│   ├── Name
│   ├── Call type (↗️ out / ↙️ in)
│   ├── Duration or "Missed"
│   ├── Timestamp
│   └── [i] → Call details
│
├── Actions:
│   ├── Tap → Call again
│   └── Swipe → Delete
│
└── Empty State:
    └── "No calls yet"
```

#### **Active Call Screen**
```
[Call Screen]
├── Background: Blurred + dark
│
├── Top Section:
│   ├── Contact name
│   ├── Call status/duration
│   └── Signal strength
│
├── Center:
│   ├── Avatar (audio call)
│   └── Video feed (video call)
│
├── Bottom Controls:
│   ├── [Mute] Toggle
│   ├── [Speaker] Toggle
│   ├── [Video] Toggle
│   ├── [End Call] (red)
│   └── [Add Person] → Contacts
│
├── Encryption Badge:
│   └── "🔒 End-to-end encrypted"
│
└── Minimized View:
    └── Floating bubble
```

### **3. WALLET TAB**

#### **Wallet Main Screen**
```
[Wallet]
├── Balance Card:
│   ├── Total Balance (USD)
│   ├── Crypto balances:
│   │   ├── XLM: amount
│   │   ├── USDC: amount
│   │   └── [See All] → Assets
│   └── 24h change %
│
├── Quick Actions:
│   ├── [Send] → Send flow
│   ├── [Receive] → QR code
│   ├── [Buy] → Purchase flow
│   └── [Swap] → Exchange
│
├── Transaction List:
│   ├── Transaction item:
│   │   ├── Icon (↑ sent / ↓ received)
│   │   ├── Contact/Address
│   │   ├── Amount + USD value
│   │   └── Timestamp
│   └── [See All] → History
│
└── Security Notice:
    └── "🔐 Zero-storage wallet"
```

#### **Send Flow**
```
[Send Crypto]
├── Step 1: Select Asset
│   ├── Asset list with balances
│   └── Tap to select
│
├── Step 2: Enter Recipient
│   ├── Cyphr contacts (verified)
│   ├── Paste address
│   ├── Scan QR
│   └── Recent recipients
│
├── Step 3: Enter Amount
│   ├── Crypto amount input
│   ├── USD equivalent
│   ├── [Max] button
│   └── Fee estimate
│
├── Step 4: Confirm
│   ├── Summary view
│   ├── Biometric/PIN auth
│   └── [Confirm] → Processing
│
└── Success:
    ├── Checkmark animation
    ├── Transaction ID
    └── [Done] → Wallet
```

### **4. PROFILE TAB**

#### **Profile Screen**
```
[Profile]
├── Header Section:
│   ├── Avatar (tap to change)
│   ├── Display name
│   ├── @cyphr_id
│   └── [Edit] → Edit profile
│
├── Menu Sections:
│   ├── Account:
│   │   ├── Edit Profile
│   │   ├── Privacy Settings
│   │   └── Security
│   │
│   ├── Preferences:
│   │   ├── Notifications
│   │   ├── Appearance
│   │   └── Chat Settings
│   │
│   ├── Wallet:
│   │   ├── Backup Phrase
│   │   ├── Connected Apps
│   │   └── Transaction History
│   │
│   ├── Help:
│   │   ├── Support
│   │   ├── FAQ
│   │   └── About
│   │
│   └── Danger Zone:
│       ├── Clear Cache
│       ├── Export Data
│       └── Reset Identity
│
└── Footer:
    └── Version + Build number
```

#### **Settings Sub-Screens**

##### **Security Settings**
```
[Security]
├── Authentication:
│   ├── Change PIN
│   ├── Biometric toggle
│   └── Auto-lock timer
│
├── Privacy:
│   ├── Read receipts toggle
│   ├── Online status toggle
│   └── Typing indicators toggle
│
├── Encryption:
│   ├── View public keys
│   ├── Verify security code
│   └── Re-generate keys
│
└── Sessions:
    ├── Active devices
    └── [Terminate All] → Confirm
```

##### **Reset Identity Flow**
```
[Reset Identity Warning]
├── Stage 1: Initial Warning
│   ├── Header: "⚠️ RESET IDENTITY - CRITICAL ACTION"
│   ├── Check wallet balance:
│   │   └── If balance > 0 → Show Stage 2
│   │   └── If balance = 0 → Skip to Stage 3
│   └── [Continue] → Next stage
│
├── Stage 2: Wallet Warning (if balance > 0)
│   ├── Display:
│   │   "💰 YOUR WALLET CONTAINS:
│   │    • XLM: 1,234.56 ($567.89)
│   │    • USDC: 100.00 ($100.00)
│   │    • Total: $667.89
│   │    
│   │    ⚠️ BLOCKCHAIN FACTS:
│   │    • Funds exist on blockchain, not in app
│   │    • Reset removes LOCAL access only
│   │    • Funds remain at your addresses forever
│   │    
│   │    WITH recovery phrase:
│   │    ✅ Restore in any wallet (Cyphr, Lobstr, etc)
│   │    ✅ Full access to same addresses
│   │    
│   │    WITHOUT recovery phrase:
│   │    ❌ FUNDS PERMANENTLY INACCESSIBLE
│   │    ❌ No way to recover, ever"
│   │
│   ├── Options:
│   │   ├── [View Recovery Phrase] → Show with screenshot warning
│   │   ├── [Transfer Funds First] → Quick send to address
│   │   └── [I Understand Risks] → Checkbox required
│   └── [Continue] → Stage 3 (only if checkbox checked)
│
├── Stage 3: Final Confirmation
│   ├── Warning Text:
│   │   "This will PERMANENTLY:
│   │    • Invalidate your @cyphr_id identity
│   │    • Make all messages unreadable
│   │    • Remove local wallet access
│   │    • Disconnect all contacts
│   │    
│   │    This CANNOT be undone!"
│   │
│   ├── Requirements:
│   │   ├── Enter current PIN: [______]
│   │   ├── Type "RESET" to confirm: [_____]
│   │   └── Biometric confirmation (if enabled)
│   │
│   └── [Reset Identity] → Stage 4 (red button)
│
├── Stage 4: Processing (Zero-Knowledge Compliant)
│   ├── Step 1: Server invalidation
│   │   └── POST /api/cyphr-id/invalidate
│   │       ├── Send: cyphr_id + device_fingerprint + signature
│   │       ├── Server: Mark public keys as revoked
│   │       ├── Server: Release username for reuse
│   │       └── Server: Log invalidation timestamp
│   │
│   ├── Step 2: Local cleanup
│   │   ├── Clear all Keychain items
│   │   ├── Delete Core Data (messages, contacts)
│   │   ├── Remove wallet keys (BUT NOT blockchain funds!)
│   │   ├── Clear UserDefaults
│   │   └── Generate new device salt for next identity
│   │
│   └── Step 3: Confirmation
│       └── Show: "Identity reset complete"
│
└── Complete:
    └── → Welcome Screen (fresh start)
```

---

## 🎨 MODAL & ALERT PATTERNS

### **Standard Modal Template**
```swift
struct StandardModal {
    // Visual Properties
    background: .ultraThinMaterial
    cornerRadius: 20
    padding: 24
    maxWidth: 320
    animation: .spring()
    
    // Structure
    ├── Icon (optional)
    ├── Title (required)
    ├── Message (required)
    ├── Custom Content (optional)
    └── Actions (1-3 buttons)
}
```

### **Modal Types**

#### **Error Modal**
```
[Error Modal]
├── Icon: exclamationmark.triangle (red)
├── Title: "Error"
├── Message: Specific error text
├── Actions:
│   ├── [Retry] (if applicable)
│   └── [OK]
```

#### **Success Modal**
```
[Success Modal]
├── Icon: checkmark.circle (green)
├── Title: "Success"
├── Message: Success details
├── Auto-dismiss: After 2 seconds
└── Or [OK] button
```

#### **Confirmation Modal**
```
[Confirmation Modal]
├── Icon: questionmark.circle (blue)
├── Title: "Confirm Action"
├── Message: What will happen
├── Actions:
│   ├── [Cancel] (secondary)
│   └── [Confirm] (primary, destructive?)
```

#### **Loading Modal**
```
[Loading Modal]
├── Progress indicator (spinner)
├── Message: Current action
├── Progress bar (if measurable)
└── [Cancel] (if cancellable)
```

#### **Input Modal**
```
[Input Modal]
├── Title: What to enter
├── Text field(s)
├── Validation feedback
├── Actions:
│   ├── [Cancel]
│   └── [Submit] (disabled until valid)
```

---

## ⚠️ ERROR HANDLING MATRIX

### **Network Errors**
| Error | User Message | Action | Recovery |
|-------|-------------|--------|----------|
| No connection | "No internet connection" | Show offline banner | Auto-retry when connected |
| Timeout | "Request timed out" | Show retry button | Exponential backoff |
| 500 Server Error | "Server error. Try again." | Log + Retry | Contact support after 3x |
| 403 Forbidden | "Access denied" | Re-authenticate | Navigate to login |
| 404 Not Found | "Content not found" | Go back | Clear cache |

### **Authentication Errors**
| Error | User Message | Action | Recovery |
|-------|-------------|--------|----------|
| Invalid credentials | "Wrong PIN/password" | Clear input | Show forgot option |
| Biometric failed | "Authentication failed" | Show PIN option | Fall back to PIN |
| Session expired | "Session expired" | Re-login required | Save current state |
| Device not trusted | "New device detected" | Verify via email/SMS | Add to trusted |

### **Crypto Errors**
| Error | User Message | Action | Recovery |
|-------|-------------|--------|----------|
| Key generation failed | "Security error" | Retry | Restart app |
| Decryption failed | "Cannot decrypt message" | Show placeholder | Request resend |
| Signature invalid | "Security verification failed" | Block action | Report issue |

### **Wallet Errors**
| Error | User Message | Action | Recovery |
|-------|-------------|--------|----------|
| Insufficient funds | "Not enough balance" | Show balance | Adjust amount |
| Network fee high | "High network fees" | Show fee | Wait or proceed |
| Transaction failed | "Transaction failed" | Show details | Retry option |
| Invalid address | "Invalid recipient address" | Clear field | Show format |

---

## 🔄 STATE MANAGEMENT

### **Global State (AppState)**
```swift
class AppState: ObservableObject {
    // Authentication
    @Published var isAuthenticated: Bool = false
    @Published var currentUser: CyphrUser?
    @Published var authToken: String?
    
    // Navigation
    @Published var selectedTab: Tab = .chats
    @Published var navigationPath = NavigationPath()
    
    // Data
    @Published var chats: [Chat] = []
    @Published var contacts: [Contact] = []
    @Published var walletBalance: WalletBalance?
    
    // UI State
    @Published var isLoading: Bool = false
    @Published var error: AppError?
    @Published var notification: AppNotification?
    
    // Preferences
    @Published var theme: Theme = .system
    @Published var notifications: NotificationSettings
    
    // Real-time
    @Published var socketConnected: Bool = false
    @Published var typingUsers: Set<String> = []
    @Published var onlineUsers: Set<String> = []
}
```

### **Local State (Per Screen)**
```swift
struct ScreenState {
    // Form State
    @State var inputText: String = ""
    @State var isValid: Bool = false
    @State var errors: [String] = []
    
    // UI State
    @State var isLoading: Bool = false
    @State var showModal: Bool = false
    @State var selectedItem: Item?
    
    // Pagination
    @State var currentPage: Int = 1
    @State var hasMore: Bool = true
    @State var items: [Item] = []
}
```

### **State Persistence**
```swift
// UserDefaults (non-sensitive)
- Selected theme
- Notification preferences
- Last sync timestamp
- UI preferences

// Keychain (sensitive)
- Auth tokens
- Encryption keys
- PIN hash
- Biometric settings

// Core Data (app data)
- Messages (encrypted)
- Contacts
- Transaction history
- Media cache

// In-Memory (temporary)
- Navigation state
- Form data
- UI state
- Socket connection
```

---

## 🧭 NAVIGATION RULES

### **Navigation Hierarchy**
```
1. Root Navigation:
   - Unauthenticated → Auth flows
   - Authenticated → Main app

2. Tab Navigation:
   - Independent navigation stacks per tab
   - State preserved when switching tabs

3. Modal Navigation:
   - Presented over current context
   - Dismissible (unless critical)
   - No nested modals

4. Push Navigation:
   - Within tab stacks
   - Back button always visible
   - Swipe to go back enabled
```

### **Deep Linking**
```
cyphr://chat/{chat_id} → Open specific chat
cyphr://user/{user_id} → Open user profile
cyphr://wallet/send → Open send screen
cyphr://settings/security → Open security settings
```

### **Navigation Guards**
```swift
// Authentication required
if !isAuthenticated {
    navigateToLogin()
    return
}

// Biometric required for sensitive
if requiresBiometric && !biometricPassed {
    showBiometricPrompt()
    return
}

// Network required
if requiresNetwork && !isConnected {
    showOfflineError()
    return
}
```

---

## 🔐 SECURITY FLOWS

### **Device Fingerprinting (Zero-Knowledge)**
```
Device Fingerprint Generation:
├── Components:
│   ├── Device ID (identifierForVendor)
│   ├── Device Model (iPhone 15 Pro)
│   ├── OS Version (iOS 17.2)
│   ├── App Version (1.0.0)
│   └── Salt: "CYPHR_DEVICE_SALT_2025"
│
├── Process:
│   └── SHA256(SALT + deviceId + model + OS + appVersion)
│
├── Properties:
│   ├── Unique per device
│   ├── Changes with OS updates (security feature)
│   ├── One-way hash (irreversible)
│   ├── No PII exposure
│   └── Stored on server for device binding
│
└── Use cases:
    ├── Detect new devices
    ├── Prevent unauthorized access
    ├── Track device migrations
    └── Security audit trail
```

### **PIN/Biometric Flow**
```
Every app launch:
├── Check stored identity in Keychain
├── If has biometric → Prompt Face ID/Touch ID
├── If PIN only → PIN screen
├── If neither → Recovery required
└── After auth → Decrypt private keys

Sensitive actions requiring auth:
├── View recovery phrase
├── Send transaction (> $100)
├── Change security settings
├── Export data
├── Reset identity
└── Add new device

Progressive PIN Rate Limiting:
├── Attempts 1-3: No delay (free)
├── Attempt 4: 1 second
├── Attempt 5: 2 seconds
├── Attempt 6: 5 seconds
├── Attempt 7: 15 seconds
├── Attempt 8: 60 seconds
├── Attempt 9: 300 seconds (5 min)
├── Attempt 10: 900 seconds (15 min)
├── Attempts 11-14: 3600 seconds (1 hour)
└── Attempt 15: AUTO-WIPE all data
```

### **Session Management**
```
Session timeout:
├── 5 minutes (PIN only)
├── 15 minutes (biometric)
└── Never (user choice with warning)

Background behavior:
├── Blur content immediately
├── Lock after timeout
├── Clear sensitive data from memory
└── If killed → Full re-auth required

Foreground return:
├── If within timeout → Continue
├── If expired → Auth required
└── If different day → Force auth
```

### **Encryption Indicators**
```
Visual feedback for security:
├── 🔒 Lock icon for encrypted
├── 🔓 Open lock for issues
├── ⚠️ Warning for unverified
├── ✅ Checkmark for verified
├── 🛡️ Shield for post-quantum
└── 🔑 Key icon for wallet operations
```

### **Wallet Security**
```
Transaction Authorization:
├── < $10: No additional auth
├── $10-$100: PIN required
├── > $100: Biometric required
├── > $1000: Biometric + PIN
└── Daily limit: User configurable

Private Key Protection:
├── Never leaves Secure Enclave
├── Never in memory plaintext
├── Never in logs/crashes
└── Never transmitted anywhere
```

---

## 💾 DATA FLOW ARCHITECTURE

### **Message Flow**
```
SENDING:
User types → Encrypt locally → Send to server → Server stores encrypted → Delivery confirmation

RECEIVING:
Server pushes → Receive encrypted → Decrypt locally → Store decrypted → Display to user
```

### **Sync Strategy**
```
Online:
- Real-time via WebSocket
- Instant push notifications
- Background sync every 30s

Offline:
- Queue actions locally
- Show offline indicator
- Sync when connected
```

### **Cache Strategy**
```
Images: 100MB limit, LRU eviction
Messages: Last 1000 per chat
Contacts: Full sync, update on change
Wallet: No cache, always fresh
```

---

## 📱 RESPONSIVE DESIGN

### **Device Support**
```
iPhone SE → iPhone 15 Pro Max
├── Safe area handling
├── Dynamic type support
├── Landscape support (iPhone)
└── iPad optimization (future)
```

### **Accessibility**
```
VoiceOver: Full support
Dynamic Type: Scales properly
Reduce Motion: Respected
Color Blind: High contrast mode
```

---

## 🎯 SUCCESS METRICS

### **Performance Targets**
```
App launch: < 2 seconds
Screen transition: < 300ms
Message send: < 100ms
Typing feedback: < 50ms
Image load: < 500ms
```

### **Reliability Targets**
```
Crash rate: < 0.1%
Message delivery: > 99.9%
Uptime: > 99.95%
Sync conflicts: < 0.01%
```

---

## 📝 IMPLEMENTATION CHECKLIST

### **Phase 1: Core Flows** 
- [ ] Fix registration crash
- [ ] Fix biometric login navigation
- [ ] Fix identity reset (backend cleanup)
- [ ] Implement proper error handling
- [ ] Add loading states everywhere

### **Phase 2: Polish**
- [ ] Smooth animations
- [ ] Consistent modals
- [ ] Proper keyboard handling
- [ ] Pull to refresh
- [ ] Empty states

### **Phase 3: Advanced**
- [ ] Offline mode
- [ ] Background sync
- [ ] Push notifications
- [ ] Deep linking
- [ ] Widgets

---

## 🚨 CRITICAL BUGS TO FIX (CURRENT IMPLEMENTATION)

### **Based on v2.0.0 Architecture Requirements:**

1. **Registration Crash** 🔴
   - **Problem**: No try-catch in generateIdentity()
   - **Fix**: Wrap all async calls in proper error handling
   - **Show**: Error modals instead of crashes

2. **Missing Sign Up Steps** 🔴
   - **Problem**: Current flow skips PIN and Biometric setup
   - **Required**: ID → Keys → Biometric → PIN → Register → Recovery
   - **Fix**: Add missing screens to match architecture

3. **Biometric Login Dead End** 🔴
   - **Problem**: After successful Face ID, no navigation occurs
   - **Fix**: Navigate to MainTabView after authentication
   - **Add**: PIN fallback option

4. **Reset Identity Wrong Implementation** 🔴
   - **Problem**: Tries to "delete" from backend (impossible in zero-knowledge)
   - **Fix**: POST /api/cyphr-id/invalidate (mark as revoked)
   - **Add**: Wallet balance check and warnings

5. **No Loading States** 🔴
   - **Problem**: User doesn't know what's happening
   - **Fix**: Add loading overlays for all async operations
   - **Pattern**: Loading → Success/Error → Next action

6. **Device Fingerprinting Missing** 🟡
   - **Problem**: Not implemented in current code
   - **Fix**: Add SHA256(salt + device info) generation
   - **Use**: For device binding and security

7. **Wallet Not Integrated in Sign Up** 🟡
   - **Problem**: HD wallet derivation not connected
   - **Fix**: Derive wallet keys from same BIP39 seed
   - **Show**: Wallet addresses after creation

---

**END OF UX ARCHITECTURE DOCUMENT**

Generated: September 8, 2025
Updated: December 18, 2024
Version: 2.0.0
Next Review: After fixing critical bugs