# Cyphr Messenger - iOS

🔐 **World's First Post-Quantum Secure Messenger with Integrated HD Wallet**

## Overview

Cyphr Messenger is a revolutionary secure messaging platform that combines military-grade post-quantum cryptography with seamless user experience. Built to exceed the security standards of Signal and WhatsApp while maintaining the usability of modern messaging apps.

## 🚀 Key Features

### Security & Privacy
- **Post-Quantum Cryptography**: Kyber1024 (NIST FIPS 203 approved) + ChaCha20-Poly1305
- **Zero-Knowledge Architecture**: Server cannot decrypt messages or access user data
- **Device-Based Identity**: No phone numbers or emails required
- **Secure Enclave Integration**: Hardware-backed security on iOS devices
- **BIP39 Recovery**: 12-word recovery phrase for account restoration

### Messaging
- **End-to-End Encryption**: All messages encrypted on-device
- **Real-time Communication**: WebSocket-based instant messaging
- **Media Support**: Photos, videos, voice messages (all encrypted)
- **Group Chats**: Secure group messaging with admin controls
- **Voice/Video Calls**: P2P encrypted calls via WebRTC

### Blockchain & Wallet
- **HD Wallet Integration**: Multi-chain cryptocurrency support
- **Stellar Network**: Native USDC/USDT support
- **Zero-Storage Wallet**: Private keys never leave device
- **In-Chat Payments**: Send crypto directly in conversations

## 🏗️ Architecture

### iOS Client
- **SwiftUI**: Modern declarative UI
- **Swift Kyber**: Post-quantum key encapsulation
- **CryptoKit**: Native iOS cryptography
- **Secure Enclave**: Hardware security module

### Backend (AWS)
- **EC2**: Node.js + Express server
- **RDS PostgreSQL**: Encrypted database
- **Socket.IO**: Real-time messaging
- **Zero-Knowledge**: Server stores only encrypted blobs

## 📱 iOS Project Structure

```
ios-app/CyphrNative/
├── CyphrApp.swift           # Main app entry
├── Authentication/
│   ├── WelcomeView.swift
│   ├── CyphrIdSignUpView.swift
│   ├── BiometricAuthService.swift
│   └── RecoveryPhraseView.swift
├── Messaging/
│   ├── ChatsView.swift
│   ├── ChatDetailView.swift
│   └── MessagingService.swift
├── Crypto/
│   ├── PostQuantumCrypto.swift
│   ├── SwiftKyber/
│   └── HDWalletService.swift
├── Wallet/
│   └── WalletView.swift
└── Profile/
    └── ProfileView.swift
```

## 🔧 Setup Instructions

### Prerequisites
- Xcode 15.0+
- iOS 17.0+ deployment target
- CocoaPods or Swift Package Manager
- Node.js 18+ (for backend)

### iOS Development Setup

1. Clone the repository:
```bash
git clone https://github.com/qn3soldier/cyphr-ios.git
cd cyphr-ios
```

2. Install iOS dependencies:
```bash
cd ios-app/CyphrNative
swift package resolve
```

3. Open in Xcode:
```bash
open CyphrNative.xcodeproj
```

4. Configure signing:
   - Select your development team
   - Update bundle identifier if needed

5. Build and run on simulator or device

### Backend Setup (Optional for local development)

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your AWS RDS credentials
```

3. Start server:
```bash
npm run server
```

## 🚦 Current Status

### ✅ Completed
- Post-quantum encryption implementation
- AWS infrastructure deployment
- Database schema and RDS setup
- Core messaging functionality
- Cyphr ID authentication system
- WebSocket real-time communication

### 🔄 In Progress
- iOS UI/UX polish
- Face ID integration fixes
- Keychain persistence improvements
- Media messaging optimization

### 📋 Planned
- App Store deployment
- Android client
- Desktop applications
- Advanced group features
- Payment integrations

## 🔒 Security

### Encryption Stack
- **Key Exchange**: Kyber1024 (quantum-resistant)
- **Message Encryption**: ChaCha20-Poly1305
- **Key Derivation**: Argon2id
- **Digital Signatures**: Ed25519
- **Recovery**: BIP39 mnemonic phrases

### Zero-Knowledge Guarantees
- Server never sees private keys
- Messages encrypted end-to-end
- No access to user contacts
- Metadata minimization
- Anonymous user identities

## 📄 Documentation

- [API Documentation](./API_ENDPOINTS.md)
- [Database Architecture](./ios-app/CyphrNative/main%20files/DATABASE_ARCHITECTURE.md)
- [Server Architecture](./ios-app/CyphrNative/main%20files/SERVER_ARCHITECTURE.md)
- [Encryption Architecture](./ios-app/CyphrNative/main%20files/ENCRYPTION_ARCHITECTURE.md)

## 🤝 Contributing

This project is currently in active development. For contribution guidelines, please contact the development team.

## 📜 License

Proprietary - All Rights Reserved

## 🔗 Links

- **Production**: https://app.cyphrmessenger.app
- **Landing Page**: https://www.cyphrmessenger.app

## 👥 Team

Built with dedication to privacy and security by the Cyphr team.

---

**Note**: This repository contains the iOS client and backend infrastructure for Cyphr Messenger. Sensitive configuration files and private keys are excluded from version control.