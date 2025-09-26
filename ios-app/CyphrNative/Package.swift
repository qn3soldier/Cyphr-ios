// swift-tools-version: 5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "CyphrNative",
    defaultLocalization: "en",
    platforms: [
        .iOS(.v16)
    ],
    products: [
        .executable(
            name: "CyphrNative",
            targets: ["CyphrNative"]),
    ],
    dependencies: [
        // SwiftKyber - НАСТОЯЩАЯ реализация NIST FIPS 203 Kyber
        .package(url: "https://github.com/leif-ibsen/SwiftKyber", from: "1.0.0"),
        // Digest нужен для SwiftKyber
        .package(url: "https://github.com/leif-ibsen/Digest", from: "1.13.0"),
        // Stellar SDK для HD wallet
        .package(url: "https://github.com/Soneso/stellar-ios-mac-sdk", from: "2.5.1"),
        // Socket.IO для real-time messaging
        .package(url: "https://github.com/socketio/socket.io-client-swift", from: "16.1.0"),
    ],
    targets: [
        .executableTarget(
            name: "CyphrNative",
            dependencies: [
                "SwiftKyber",
                .product(name: "stellarsdk", package: "stellar-ios-mac-sdk"),
                .product(name: "SocketIO", package: "socket.io-client-swift")
            ],
            path: ".",
            exclude: [
                "SwiftKyber",
                "TestKyber.swift",
                "LaunchScreen.storyboard",
                ".build",
                "build"
            ],
            sources: [
                "CyphrApp.swift",
                "CyphrIdentity.swift",
                "PostQuantumCrypto.swift",
                "NetworkService.swift",
                "MessagingService.swift",
                "NetworkBannerView.swift",
                "PinUnlockView.swift",
                "HDWalletService.swift",
                "WelcomeView.swift",
                "CyphrIdSignUpView.swift",
                "CyphrIdLoginView.swift",
                "AuthenticationService.swift",
                "ZeroKnowledgeLookup.swift",
                "ChatsView.swift",
                "ChatDetailView.swift",
                "Models.swift",
                "ProfileView.swift",
                "SettingsView.swift",
                "NewChatView.swift",
                "WalletView.swift",
                "CallView.swift",
                "SecuritySetupView.swift",
                "LoadingOverlay.swift",
                "RecoveryPhraseView.swift",
                "AuthMethodSelectionView.swift",
                "UsernameValidator.swift",
                "S3Service.swift",
                "BiometricAuthService.swift",
                "EnterpriseKeychainService.swift",
                "DeviceIdentityService.swift",
                "SecureEnclaveService.swift",
                "View+OnChangeCompat.swift",
                "ImagePicker.swift",
                "WebRTCService.swift"
            ],
            resources: [
                .process("Assets.xcassets")
            ]
        ),
    ]
)
