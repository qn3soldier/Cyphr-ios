# Cyphr Messenger - Native iOS

**ENTERPRISE POST-QUANTUM MESSENGER**

## Architecture (СОХРАНЕНА ИЗ WEB ВЕРСИИ)

### 🔐 Crypto Stack
- **Kyber1024** - post-quantum key encapsulation (Swift CryptoKit)
- **ChaCha20-Poly1305** - authenticated encryption 
- **Ed25519** - digital signatures
- **Secure Enclave** - hardware key protection

### 🎯 Zero-Knowledge + Zero-Storage
- Private keys NEVER leave device
- Server видит только hashes
- Contact discovery через bloom filters
- Anonymous message routing

### 📱 Screen Flow (ТОЧНО КАК В WEB)
```
Welcome → CryptoSignUp → ProfileSetup → PinSetup → Chats
```

### 🎨 Design System  
- Glassmorphism effects (SwiftUI blur)
- Lightning theme colors
- Enterprise gradients
- Framer Motion → SwiftUI animations

### 🏗️ Backend Integration
- AWS backend: app.cyphrmessenger.app
- Socket.IO real-time messaging
- HD wallet с Stellar
- Authentication endpoints

## Implementation Plan

1. Create Xcode project
2. Port crypto logic to Swift
3. Port UI screens to SwiftUI  
4. Port AWS integration
5. Test complete flow

**РЕЗУЛЬТАТ:** Native iOS превосходящий Signal/WhatsApp с ВАШЕЙ архитектурой!