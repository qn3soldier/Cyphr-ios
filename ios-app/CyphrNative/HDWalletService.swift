import Foundation
import Combine

/// HD Wallet Service (Mock)
/// Полностью моковый сервис, чтобы не блокировать сборку мессенджера.
/// - Без использования CryptoKit/Keychain/пост‑квантовой криптографии.
/// - Возвращает стабильные фиктивные данные и совместим с текущим UI.
class HDWalletService: ObservableObject {
    
    // MARK: - Properties
    static let shared = HDWalletService()
    
    // Паблишеды оставлены для совместимости с UI
    @Published private(set) var seedPhrase: [String]?
    @Published private(set) var masterSeed: Data?
    @Published private(set) var stellarKeyPair: StellarKeyPair?
    @Published private(set) var stellarAddress: String?
    @Published private(set) var balance: Decimal = 0
    @Published private(set) var isWalletSetup: Bool = false
    
    // Моковые данные
    private let mockStellarAddress = "GMOCKADDRESS1234567890MOCKADDRESS1234567890MOCK"
    private let requiredWordCount = 12
    private let fallbackSeedPhrase12 = [
        "quantum","secure","wallet","message","stellar","payment",
        "crypto","private","seed","phrase","recover","backup"
    ]
    
    // MARK: - Initialization
    private init() {
        print("💰 HD Wallet Service (MOCK) initialized")
        // Инициализируем фиктивные значения, чтобы UI мог их отобразить
        self.seedPhrase = loadDefaultSeedPhrase()
        self.stellarKeyPair = StellarKeyPair(publicKey: mockStellarAddress, privateKey: Data())
        self.stellarAddress = mockStellarAddress
        self.isWalletSetup = true
    }
    
    // MARK: - Wallet Creation (Mock)
    
    /// Generate new HD wallet with BIP39 seed phrase (Mock)
    func generateWallet() async throws -> WalletInfo {
        // Мокаем «создание» кошелька
        try await Task.sleep(nanoseconds: 300_000_000) // небольшая задержка для UX
        
        let newSeedPhrase = loadDefaultSeedPhrase()
        self.seedPhrase = newSeedPhrase
        self.masterSeed = Data()
        self.stellarKeyPair = StellarKeyPair(publicKey: mockStellarAddress, privateKey: Data())
        self.stellarAddress = mockStellarAddress
        self.isWalletSetup = true
        
        print("✅ (MOCK) HD Wallet generated with 12-word phrase: \(mockStellarAddress.prefix(8))...")
        return WalletInfo(
            publicKey: mockStellarAddress,
            seedPhrase: newSeedPhrase,
            createdAt: Date()
        )
    }
    
    /// Restore wallet from seed phrase (Mock)
    func restoreWallet(seedPhrase: [String]) async throws -> WalletInfo {
        // Валидацию делаем минимальную
        guard seedPhrase.count == requiredWordCount else {
            throw WalletError.invalidSeedPhrase
        }
        try await Task.sleep(nanoseconds: 300_000_000)
        
        self.seedPhrase = seedPhrase
        self.masterSeed = Data()
        self.stellarKeyPair = StellarKeyPair(publicKey: mockStellarAddress, privateKey: Data())
        self.stellarAddress = mockStellarAddress
        self.isWalletSetup = true
        
        print("✅ (MOCK) Wallet restored: \(mockStellarAddress.prefix(8))...")
        return WalletInfo(
            publicKey: mockStellarAddress,
            seedPhrase: seedPhrase,
            createdAt: Date()
        )
    }
    
    // MARK: - Wallet Operations (Mock)
    
    /// Get wallet balance from Stellar network (Mock)
    func getBalance() async throws -> WalletBalance {
        // Возвращаем стабильные фиктивные значения,
        // чтобы UI мог корректно посчитать Total Balance и т.д.
        try await Task.sleep(nanoseconds: 200_000_000)
        let balance = WalletBalance(
            xlm: "123.4567",
            usdc: "250.00",
            assets: [
                "USDT": "500.0",
                "BTC": "0.0123"
            ]
        )
        self.balance = Decimal(string: balance.xlm) ?? 0
        return balance
    }
    
    /// Send payment transaction (Mock)
    func sendPayment(to destinationAddress: String, amount: String, asset: String = "XLM") async throws -> TransactionResult {
        try await Task.sleep(nanoseconds: 300_000_000)
        print("💸 (MOCK) Sending \(amount) \(asset) to \(destinationAddress.prefix(8))...")
        return TransactionResult(
            success: true,
            transactionId: UUID().uuidString,
            hash: UUID().uuidString.replacingOccurrences(of: "-", with: "")
        )
    }
    
    /// Generate receiving address (same as public key for Stellar) (Mock)
    func getReceivingAddress() -> String? {
        return stellarAddress ?? mockStellarAddress
    }
    
    // MARK: - Encrypted Storage (No-Op in Mock)
    
    /// Store wallet data with quantum encryption (Mock no-op)
    func encryptAndStoreWalletData(_ data: WalletData) async throws {
        // Ничего не делаем в моковом режиме
        print("🔐 (MOCK) encryptAndStoreWalletData - no-op")
    }
    
    /// Retrieve and decrypt wallet data (Mock)
    func retrieveWalletData() async throws -> WalletData? {
        // Возвращаем фиктивные данные
        print("🔓 (MOCK) retrieveWalletData - returning mock")
        return WalletData(
            mnemonic: (seedPhrase ?? loadDefaultSeedPhrase()).joined(separator: " "),
            stellarKeys: StellarKeys(publicKey: mockStellarAddress, secretKey: "MOCK_PRIVATE_KEY"),
            ethereumKeys: nil,
            bitcoinKeys: nil
        )
    }

    private func loadDefaultSeedPhrase() -> [String] {
        let bundledWords = BIP39WordList.englishWords
        guard bundledWords.count == 2048 else {
            print("⚠️ (MOCK) Falling back to hard-coded 12-word phrase (bundle missing)")
            return fallbackSeedPhrase12
        }

        return Array(bundledWords.shuffled().prefix(requiredWordCount))
    }
}

// MARK: - Models (оставляем как в оригинале для совместимости)

struct WalletInfo {
    let publicKey: String
    let seedPhrase: [String]
    let createdAt: Date
}

struct StellarKeyPair {
    let publicKey: String
    let privateKey: Data
}

struct WalletActivityData: Codable {
    let transactions: [TransactionHistory]
    let contacts: [PaymentContact]
    let settings: WalletSettings
}

struct TransactionHistory: Codable {
    let id: String
    let type: String // "sent" or "received"
    let amount: String
    let asset: String
    let address: String
    let timestamp: Date
    let memo: String?
}

struct PaymentContact: Codable {
    let name: String
    let address: String
    let cyphrId: String?
}

struct WalletSettings: Codable {
    let defaultAsset: String
    let autoConvert: Bool
    let notifications: Bool
}

// MARK: - Errors

enum WalletError: LocalizedError {
    case walletNotInitialized
    case invalidSeedPhrase
    case encryptionFailed
    case transactionFailed
    case insufficientBalance
    
    var errorDescription: String? {
        switch self {
        case .walletNotInitialized:
            return "Wallet not initialized"
        case .invalidSeedPhrase:
            return "Invalid seed phrase"
        case .encryptionFailed:
            return "Failed to encrypt wallet data"
        case .transactionFailed:
            return "Transaction failed"
        case .insufficientBalance:
            return "Insufficient balance"
        }
    }
}
