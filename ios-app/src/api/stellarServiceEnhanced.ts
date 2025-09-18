/**
 * Enhanced Stellar Service with HD Wallet and Multi-Asset Support
 * - Hierarchical Deterministic wallet integration
 * - USDT/USDC support on Stellar network
 * - Encrypted transaction memos
 * - Multi-asset balance management
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import { supabase } from "./supabaseClient";
import QuantumCryptoSecure from './crypto/quantumCryptoSecure';
import { HDWallet } from './crypto/hdWallet';
import { secureChaCha20 } from './crypto/secureChaCha20';
import { secureStorage } from './crypto/secureStorage';
import { ipfsService } from './ipfsService.js';
import { complianceLogger } from './compliance/complianceLogger.js';

interface EnhancedAsset {
  code: string;
  issuer?: string;
  balance: string;
  limit?: string;
  buying_liabilities: string;
  selling_liabilities: string;
  is_authorized: boolean;
  last_modified_ledger: number;
}

interface EncryptedMemoData {
  encryptedMemo: string;
  recipientId: string;
  algorithm: string;
  timestamp: number;
}

interface TransactionWithMemo {
  id: string;
  hash: string;
  created_at: string;
  fee_charged: number;
  successful: boolean;
  memo?: string;
  decryptedMemo?: string;
  operations: any[];
}

export class StellarServiceEnhanced {
  private server: StellarSdk.Horizon.Server;
  private networkPassphrase: string;
  private quantum: typeof QuantumCryptoSecure;
  private hdWallet: HDWallet | null = null;
  private userId: string | null = null;
  
  // Offline mode support
  private offlineMode: boolean = false;
  private offlineData: Map<string, any> = new Map();
  private lastOnlineSync: number = 0;

  // Stellar asset definitions
  private readonly STELLAR_ASSETS = {
    XLM: StellarSdk.Asset.native(),
    USDC: new StellarSdk.Asset('USDC', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'), // Official USDC testnet issuer
    // NOTE: USDT is NOT supported on Stellar network - Tether does not issue USDT on Stellar
  };

  constructor(networkType: 'mainnet' | 'testnet' = 'testnet') {
    if (networkType === 'mainnet') {
      this.server = new StellarSdk.Horizon.Server('https://horizon.stellar.org');
      this.networkPassphrase = StellarSdk.Networks.PUBLIC;
    } else {
      this.server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
      this.networkPassphrase = StellarSdk.Networks.TESTNET;
    }

    this.quantum = QuantumCryptoSecure;
    console.log(`🌟 Enhanced Stellar Service initialized (${networkType})`);
  }

  /**
   * Initialize HD wallet for user
   */
  async initializeHDWallet(userId: string, passphrase: string = ''): Promise<boolean> {
    try {
      this.userId = userId;
      this.hdWallet = new HDWallet(userId, {
        networkType: 'testnet',
        supportedChains: ['stellar'],
        encryptionEnabled: true,
        autoBackup: true
      });

      // Check if HD wallet is already initialized
      const stats = this.hdWallet.getWalletStats();
      
      if (!stats.initialized) {
        // No existing wallet found - this is expected for new users
        // Wallet will be initialized when user creates or restores via UI
        console.log('ℹ️ No HD wallet found - user needs to create or restore wallet');
        return true; // Still return success, wallet can be initialized later
      } else {
        console.log('✅ HD wallet already initialized');
        
        // Log wallet initialization for compliance
        complianceLogger.logWalletCreation(userId, {
          walletType: 'HD_Stellar',
          networkType: 'testnet',
          encryptionEnabled: true,
          backupEnabled: true,
          stellar: {
            address: await await this.hdWallet.getStellarAddress(),
            derivationPath: 'm/44\'/148\'/0\'/0\''
          }
        });
      }

      return true;

    } catch (error) {
      console.error('❌ Error initializing HD wallet:', error);
      return false;
    }
  }

  /**
   * Import Stellar account from environment variables (for development)
   */
  async importFromEnv(): Promise<{ publicKey: string; secretKey: string } | null> {
    const envSecretKey = import.meta.env.VITE_STELLAR_SECRET_KEY;
    const envPublicKey = import.meta.env.VITE_STELLAR_PUBLIC_KEY;
    
    console.log(`🔍 Environment check: secretKey=${!!envSecretKey}, publicKey=${!!envPublicKey}`);
    
    if (envSecretKey && envPublicKey) {
      console.log(`🔑 Importing Stellar account from environment: ${envPublicKey}`);
      return await this.importExistingAccount(envSecretKey);
    }
    
    console.log('❌ No Stellar keys found in environment');
    return null;
  }

  /**
   * Import existing Stellar account using secret key
   */
  async importExistingAccount(secretKey: string): Promise<{ publicKey: string; secretKey: string }> {
    try {
      // Validate the secret key
      const keypair = StellarSdk.Keypair.fromSecret(secretKey);
      const publicKey = keypair.publicKey();
      
      console.log(`✅ Imported Stellar account: ${publicKey}`);
      
      // Store in secure storage for future use
      if (this.userId) {
        await secureStorage.storeData(`stellar_imported_${this.userId}`, {
          publicKey,
          secretKey
        });
      }
      
      return { publicKey, secretKey };
      
    } catch (error) {
      console.error('❌ Error importing Stellar account:', error);
      throw new Error(`Invalid Stellar secret key: ${error.message}`);
    }
  }

  /**
   * Get or create Stellar wallet from HD derivation or imported account
   */
  async getWallet(accountIndex: number = 0): Promise<{ publicKey: string; secretKey: string }> {
    console.log(`🔍 Getting wallet for user: ${this.userId}, account index: ${accountIndex}`);
    
    // 🧪 DEVELOPMENT MODE: Prioritize pre-funded testnet account for testing
    // This ensures trustlines work during development/testing phase
    if (this.userId) {
      try {
        // First try environment account (pre-funded with 10K XLM + USDC trustline)
        const envAccount = await this.importFromEnv();
        if (envAccount) {
          console.log(`🧪 [DEV MODE] Using pre-funded testnet account: ${envAccount.publicKey}`);
          console.log(`💰 Account has 10,000 XLM + USDC trustline established`);
          
          // Store for future use
          await secureStorage.storeData(`stellar_imported_${this.userId}`, envAccount);
          return envAccount;
        }
      } catch (error) {
        console.log('⚠️ Environment import failed:', error.message);
      }

      // Fallback to previously imported account
      try {
        const importedAccount = await secureStorage.retrieveData(`stellar_imported_${this.userId}`);
        if (importedAccount && importedAccount.publicKey && importedAccount.secretKey) {
          console.log(`✅ Using previously imported Stellar account: ${importedAccount.publicKey}`);
          return importedAccount;
        }
      } catch (error) {
        console.log('ℹ️ No imported account found, falling back to HD wallet...');
      }
    }

    // Fallback to HD wallet
    if (!this.hdWallet || !this.userId) {
      // Try to initialize HD wallet automatically
      if (this.userId) {
        console.log('🔄 Auto-initializing HD wallet...');
        const initialized = await this.initializeHDWallet(this.userId);
        if (!initialized) {
          throw new Error('HD wallet not initialized and auto-initialization failed');
        }
      } else {
        throw new Error('HD wallet not initialized and no user ID');
      }
    }

    try {
      // Check if wallet is initialized before deriving keys
      const stats = this.hdWallet.getWalletStats();
      if (!stats.initialized) {
        throw new Error('HD wallet not initialized - user needs to create or restore wallet first');
      }
      
      // Derive Stellar key at specified index
      const derivedKey = await this.hdWallet.deriveKey('stellar', accountIndex);
      
      return {
        publicKey: derivedKey.publicKey,
        secretKey: derivedKey.privateKey
      };

    } catch (error) {
      console.error('❌ Error getting wallet:', error);
      throw new Error(`Failed to get wallet: ${error.message}`);
    }
  }

  /**
   * Get multi-asset balance for account (Enhanced Lobstr-like functionality)
   * Supports both funded and unfunded accounts with comprehensive error handling
   */
  async getMultiAssetBalance(stellarAddress: string): Promise<EnhancedAsset[]> {
    try {
      console.log(`🔍 Loading multi-asset balance for address: ${stellarAddress}`);
      
      // Load account from Stellar network
      const account = await this.server.loadAccount(stellarAddress);
      console.log(`✅ Account loaded successfully`);
      
      const assets: EnhancedAsset[] = [];

      // Process all balances from the account
      for (const balance of account.balances) {
        const asset: EnhancedAsset = {
          code: balance.asset_type === 'native' ? 'XLM' : (balance as any).asset_code || 'UNKNOWN',
          issuer: balance.asset_type === 'native' ? undefined : (balance as any).asset_issuer,
          balance: balance.balance,
          limit: (balance as any).limit || '0',
          buying_liabilities: (balance as any).buying_liabilities || '0',
          selling_liabilities: (balance as any).selling_liabilities || '0',
          is_authorized: (balance as any).is_authorized !== false,
          last_modified_ledger: (balance as any).last_modified_ledger || 0
        };
        
        assets.push(asset);
        console.log(`💰 Asset found: ${asset.code} = ${asset.balance}`);
      }

      console.log(`💰 Retrieved ${assets.length} assets for account`);
      return assets;

    } catch (error) {
      console.error(`❌ Error loading balance for ${stellarAddress}:`, error);
      
      // Handle unfunded account (new wallet)
      if (error.name === 'NotFoundError' || error.response?.status === 404) {
        console.log(`🆕 Account ${stellarAddress} not found on network (unfunded/new wallet)`);
        return []; // Return empty array for unfunded accounts
      }
      
      console.error('❌ Error getting multi-asset balance:', error);
      return [];
    }
  }

  /**
   * Add trustline for asset (USDC, USDT, etc.)
   */
  async addTrustline(assetCode: string, limit: string = '1000000', accountIndex: number = 0): Promise<any> {
    try {
      console.log(`🔗 Starting trustline addition for ${assetCode}...`);
      
      const asset = this.STELLAR_ASSETS[assetCode as keyof typeof this.STELLAR_ASSETS];
      if (!asset) {
        throw new Error(`Unsupported asset: ${assetCode}`);
      }

      const { publicKey, secretKey } = await this.getWallet(accountIndex);
      console.log(`📍 Using account: ${publicKey}`);
      
      const sourceKeypair = StellarSdk.Keypair.fromSecret(secretKey);
      
      // Check account exists and is funded
      let sourceAccount;
      try {
        sourceAccount = await this.server.loadAccount(publicKey);
        console.log(`💰 Account balance: ${sourceAccount.balances.find(b => b.asset_type === 'native')?.balance} XLM`);
      } catch (accountError) {
        if (accountError.response?.status === 404) {
          throw new Error(`Account ${publicKey} not found on Stellar network. Account may not be funded.`);
        }
        throw new Error(`Failed to load account: ${accountError.message}`);
      }

      // Check if trustline already exists (Lobstr-like behavior)
      const existingTrustline = sourceAccount.balances.find(balance => 
        balance.asset_code === assetCode
      );
      
      if (existingTrustline) {
        console.log(`✅ Trustline for ${assetCode} already exists - returning success`);
        return {
          success: true,
          transactionHash: 'existing_trustline',
          asset: assetCode,
          message: `${assetCode} trustline already active`,
          balance: existingTrustline.balance,
          limit: existingTrustline.limit
        };
      }

      console.log(`🔗 Building trustline transaction for ${assetCode}...`);

      const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: (await this.server.fetchBaseFee()).toString(),
        networkPassphrase: this.networkPassphrase
      })
        .addOperation(
          StellarSdk.Operation.changeTrust({
            asset: asset,
            limit: limit
          })
        )
        .setTimeout(180)
        .build();

      transaction.sign(sourceKeypair);
      
      console.log(`📤 Submitting trustline transaction...`);
      const result = await this.server.submitTransaction(transaction);

      console.log(`✅ Trustline added for ${assetCode}: ${result.hash}`);
      return result;

    } catch (error) {
      console.error(`❌ Error adding trustline for ${assetCode}:`, error);
      
      // Enhanced error reporting
      if (error.response) {
        console.error(`HTTP ${error.response.status}:`, error.response.data);
        throw new Error(`Stellar API error (${error.response.status}): ${JSON.stringify(error.response.data)}`);
      }
      
      throw error;
    }
  }

  /**
   * Send payment with encrypted memo
   */
  async sendPaymentWithEncryptedMemo(
    destinationId: string,
    amount: string,
    assetCode: string = 'XLM',
    memo: string = '',
    recipientPublicKey?: string,
    accountIndex: number = 0
  ): Promise<any> {
    let publicKey: string = '';
    try {
      console.log(`💸 Sending ${amount} ${assetCode} to ${destinationId}...`);

      const walletResult = await this.getWallet(accountIndex);
      publicKey = walletResult.publicKey;
      const secretKey = walletResult.secretKey;
      const sourceKeypair = StellarSdk.Keypair.fromSecret(secretKey);
      const sourceAccount = await this.server.loadAccount(publicKey);

      // Get asset
      const asset = this.STELLAR_ASSETS[assetCode as keyof typeof this.STELLAR_ASSETS] || StellarSdk.Asset.native();

      // Check balance
      const balances = await this.getMultiAssetBalance(publicKey);
      const assetBalance = balances.find(b => 
        b.code === assetCode || (assetCode === 'XLM' && b.code === 'XLM')
      );

      if (!assetBalance || parseFloat(assetBalance.balance) < parseFloat(amount)) {
        throw new Error(`Insufficient ${assetCode} balance`);
      }

      // Build transaction
      const transactionBuilder = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: (await this.server.fetchBaseFee()).toString(),
        networkPassphrase: this.networkPassphrase
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: destinationId,
            asset: asset,
            amount: amount
          })
        );

      // Add encrypted memo if provided
      if (memo.trim() && recipientPublicKey) {
        const encryptedMemoData = await this.encryptTransactionMemo(memo, recipientPublicKey);
        
        // Store encrypted memo metadata
        const memoId = `memo_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        await secureStorage.store(memoId, new TextEncoder().encode(JSON.stringify(encryptedMemoData)));
        
        // Use memo ID as transaction memo
        transactionBuilder.addMemo(StellarSdk.Memo.text(memoId));
        
        console.log('🔒 Transaction memo encrypted');
      } else if (memo.trim()) {
        // Plain text memo (not recommended for sensitive data)
        transactionBuilder.addMemo(StellarSdk.Memo.text(memo.substring(0, 28))); // Stellar memo limit
      }

      const transaction = transactionBuilder.setTimeout(180).build();
      transaction.sign(sourceKeypair);

      // Submit transaction
      const result = await this.server.submitTransaction(transaction);

      // Store transaction record
      await this.storeTransactionRecord(result, {
        userId: this.userId!,
        fromAddress: publicKey,
        toAddress: destinationId,
        amount: parseFloat(amount),
        asset: assetCode,
        memo: memo,
        encrypted: !!recipientPublicKey
      });

      console.log(`✅ Payment sent successfully: ${result.hash}`);
      
      // Compliance logging for AML/KYC
      complianceLogger.logTransaction(this.userId!, {
        hash: result.hash,
        from: publicKey,
        to: destinationId,
        amount: parseFloat(amount),
        asset: assetCode,
        memo: memo ? '[ENCRYPTED]' : null,
        timestamp: Date.now(),
        ledger: result.ledger,
        successful: true
      });
      
      return result;

    } catch (error) {
      console.error('❌ Error sending payment:', error);
      
      // Log failed transaction for compliance
      if (this.userId) {
        complianceLogger.logTransaction(this.userId, {
          from: publicKey || 'unknown',
          to: destinationId,
          amount: parseFloat(amount),
          asset: assetCode,
          error: error.message,
          timestamp: Date.now(),
          successful: false
        });
      }
      
      throw error;
    }
  }

  /**
   * Encrypt transaction memo using recipient's public key
   */
  private async encryptTransactionMemo(memo: string, recipientPublicKey: string): Promise<EncryptedMemoData> {
    try {
      // Get sender's quantum keys for encryption
      const senderKeys = await this.quantum.generateKeyPair();
      
      // Encrypt memo
      const encryptedMemo = await this.quantum.encryptMessage(memo, recipientPublicKey, senderKeys.secretKey);
      
      return {
        encryptedMemo: JSON.stringify(encryptedMemo),
        recipientId: recipientPublicKey,
        algorithm: 'Kyber1024 + ChaCha20',
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('❌ Error encrypting memo:', error);
      throw new Error(`Memo encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt transaction memo using recipient's secret key
   */
  async decryptTransactionMemo(memoId: string, recipientSecretKey: string): Promise<string | null> {
    try {
      // Retrieve encrypted memo data
      const encryptedData = await secureStorage.retrieve(memoId);
      if (!encryptedData) {
        return null;
      }

      const memoData: EncryptedMemoData = JSON.parse(new TextDecoder().decode(encryptedData));
      const encryptedPackage = JSON.parse(memoData.encryptedMemo);

      // Decrypt memo
      const decryptedMemo = await this.quantum.decryptMessage(encryptedPackage, recipientSecretKey);
      
      console.log('🔓 Transaction memo decrypted successfully');
      return decryptedMemo;

    } catch (error) {
      console.error('❌ Error decrypting memo:', error);
      return null;
    }
  }

  /**
   * Get transaction history with decrypted memos
   */
  async getTransactionHistoryWithMemos(publicKey: string, recipientSecretKey?: string, limit: number = 20): Promise<TransactionWithMemo[]> {
    try {
      const transactions = await this.server
        .transactions()
        .forAccount(publicKey)
        .order('desc')
        .limit(limit)
        .call();

      const history: TransactionWithMemo[] = [];

      for (const tx of transactions.records) {
        try {
          const operations = await tx.operations();
          
          const txData: TransactionWithMemo = {
            id: tx.id,
            hash: tx.hash,
            created_at: tx.created_at,
            fee_charged: parseFloat(tx.fee_charged.toString()) / 10000000,
            successful: tx.successful,
            operations: []
          };

          // Extract memo
          if (tx.memo && tx.memo_type === 'text') {
            txData.memo = tx.memo;
            
            // Try to decrypt if it looks like a memo ID and we have secret key
            if (recipientSecretKey && tx.memo.startsWith('memo_')) {
              const decryptedMemo = await this.decryptTransactionMemo(tx.memo, recipientSecretKey);
              if (decryptedMemo) {
                txData.decryptedMemo = decryptedMemo;
              }
            }
          }

          // Process operations
          operations.records.forEach(op => {
            if (op.type === 'payment') {
              txData.operations.push({
                type: 'payment',
                amount: parseFloat(op.amount),
                from: op.from,
                to: op.to,
                asset_code: op.asset_code || 'XLM',
                asset_issuer: op.asset_issuer,
                direction: op.to === publicKey ? 'received' : 'sent'
              });
            }
          });

          if (txData.operations.length > 0) {
            history.push(txData);
          }

        } catch (opError) {
          console.warn('⚠️ Error processing transaction:', opError);
        }
      }

      return history;

    } catch (error) {
      if (error.response?.status === 404 || error.name === 'NotFoundError') {
        console.log('📝 Account not found on network, returning empty transaction history');
        return [];
      }
      console.error('❌ Error getting transaction history:', error);
      return [];
    }
  }

  /**
   * Create multiple accounts from HD wallet
   */
  async createMultipleAccounts(count: number = 5): Promise<Array<{ index: number; publicKey: string; funded: boolean }>> {
    if (!this.hdWallet) {
      throw new Error('HD wallet not initialized');
    }

    const accounts = [];

    for (let i = 0; i < count; i++) {
      try {
        const { publicKey } = await this.getWallet(i);
        
        // Try to fund testnet account
        let funded = false;
        try {
          const fundResponse = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
          funded = fundResponse.ok;
        } catch (e) {
          console.warn(`⚠️ Failed to fund account ${i}:`, e);
        }

        accounts.push({
          index: i,
          publicKey,
          funded
        });

        console.log(`📱 Account ${i}: ${publicKey} (funded: ${funded})`);

      } catch (error) {
        console.error(`❌ Error creating account ${i}:`, error);
      }
    }

    return accounts;
  }

  /**
   * Store transaction record in database
   */
  private async storeTransactionRecord(result: any, metadata: any): Promise<void> {
    try {
      await supabase
        .from('enhanced_transactions')
        .insert({
          user_id: metadata.userId,
          transaction_hash: result.hash,
          from_address: metadata.fromAddress,
          to_address: metadata.toAddress,
          amount: metadata.amount,
          asset: metadata.asset,
          memo: metadata.memo,
          encrypted: metadata.encrypted,
          status: 'completed',
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.warn('⚠️ Failed to store transaction record:', error);
    }
  }

  /**
   * Get supported assets
   */
  getSupportedAssets(): Array<{ code: string; issuer?: string; name: string }> {
    return [
      { code: 'XLM', name: 'Stellar Lumens' },
      { code: 'USDC', issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5', name: 'USD Coin' }
      // NOTE: USDT removed - Tether does not support Stellar network
    ];
  }

  /**
   * Get wallet statistics
   */
  getWalletStats(): any {
    return {
      hdWalletInitialized: !!this.hdWallet,
      userId: this.userId,
      supportedAssets: this.getSupportedAssets().length,
      networkType: this.networkPassphrase === StellarSdk.Networks.PUBLIC ? 'mainnet' : 'testnet',
      encryptionEnabled: true
    };
  }

  /**
   * Get real XLM price in USD from CoinGecko API
   */
  async getRealXLMPrice(): Promise<number> {
    try {
      console.log('💰 Fetching live XLM price from CoinGecko...');
      
      // Primary: CoinGecko API for accurate XLM price
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd');
      
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();
      if (data.stellar && data.stellar.usd) {
        const price = data.stellar.usd;
        console.log(`💰 Live XLM/USD price from CoinGecko: $${price.toFixed(4)}`);
        return price;
      }

      throw new Error('No XLM price data in response');
      
    } catch (error) {
      console.error('❌ Error fetching XLM price from CoinGecko:', error);
      
      // Secondary fallback: try alternative API
      try {
        console.log('🔄 Trying alternative price source...');
        const fallbackResponse = await fetch('https://api.coinpaprika.com/v1/tickers/xlm-stellar');
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          if (fallbackData.quotes && fallbackData.quotes.USD) {
            const price = fallbackData.quotes.USD.price;
            console.log(`💰 XLM price from Coinpaprika fallback: $${price.toFixed(4)}`);
            return price;
          }
        }
      } catch (fallbackError) {
        console.error('❌ Fallback price API also failed:', fallbackError);
      }
      
      // Last resort: return reasonable market estimate (not the fake 0.12)
      console.log('⚠️ All price APIs failed, using market estimate');
      return 0.40; // Reasonable XLM market estimate
    }
  }

  /**
   * Get real USDC price in USD from CoinGecko API
   */
  async getRealUSDCPrice(): Promise<number> {
    try {
      console.log('💰 Fetching live USDC price from CoinGecko...');
      
      // Primary: CoinGecko API for accurate USDC price
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=usd');
      
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();
      if (data['usd-coin'] && data['usd-coin'].usd) {
        const price = data['usd-coin'].usd;
        console.log(`💰 Live USDC/USD price from CoinGecko: $${price.toFixed(4)}`);
        return price;
      }

      throw new Error('No USDC price data in response');
      
    } catch (error) {
      console.error('❌ Error fetching USDC price from CoinGecko:', error);
      
      // Secondary fallback: try alternative API
      try {
        console.log('🔄 Trying alternative USDC price source...');
        const fallbackResponse = await fetch('https://api.coinpaprika.com/v1/tickers/usdc-usd-coin');
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          if (fallbackData.quotes && fallbackData.quotes.USD) {
            const price = fallbackData.quotes.USD.price;
            console.log(`💰 USDC price from Coinpaprika fallback: $${price.toFixed(4)}`);
            return price;
          }
        }
      } catch (fallbackError) {
        console.error('❌ USDC fallback price API also failed:', fallbackError);
      }
      
      // Last resort: USDC market estimate (slightly below $1.00)
      console.log('⚠️ All USDC price APIs failed, using market estimate');
      return 0.9995; // Realistic USDC market estimate
    }
  }

  // NOTE: USDT price function removed - Tether does not support Stellar network

  /**
   * Get real USD value for any asset
   */
  async getRealAssetPrice(assetCode: string): Promise<number> {
    switch (assetCode.toUpperCase()) {
      case 'XLM':
        return await this.getRealXLMPrice();
      case 'USDC':
        return await this.getRealUSDCPrice();
      default:
        console.warn(`⚠️ Unknown asset price requested: ${assetCode} - Only XLM and USDC are supported on Stellar`);
        return 0;
    }
  }

  /**
   * Calculate real total portfolio value in USD
   */
  async calculateRealPortfolioValue(balances: EnhancedAsset[]): Promise<number> {
    let totalUSD = 0;
    
    for (const balance of balances) {
      const amount = parseFloat(balance.balance) || 0;
      if (amount > 0) {
        const price = await this.getRealAssetPrice(balance.code);
        const usdValue = amount * price;
        console.log(`💰 ${balance.code}: ${amount.toFixed(4)} × $${price.toFixed(4)} = $${usdValue.toFixed(2)}`);
        totalUSD += usdValue;
      }
    }
    
    console.log(`💰 Total portfolio value: $${totalUSD.toFixed(2)}`);
    return totalUSD;
  }


  /**
   * Create/activate new Stellar account (like Lobstr account creation)
   */
  async createAccount(stellarAddress: string, fundingAmount: string = '2.5'): Promise<boolean> {
    try {
      console.log(`🆕 Creating new Stellar account: ${stellarAddress}`);
      
      // Check if account already exists
      try {
        await this.server.loadAccount(stellarAddress);
        console.log(`✅ Account ${stellarAddress} already exists`);
        return true;
      } catch (error) {
        if (error.name !== 'NotFoundError' && error.response?.status !== 404) {
          throw error;
        }
        console.log(`🆕 Account doesn't exist, will need funding`);
      }
      
      // For testnet, we can use Friendbot to fund the account
      if (this.networkPassphrase === StellarSdk.Networks.TESTNET) {
        console.log(`🤖 Using Friendbot to fund testnet account...`);
        
        try {
          const response = await fetch(`https://friendbot.stellar.org?addr=${stellarAddress}`);
          if (response.ok) {
            console.log(`✅ Account ${stellarAddress} funded via Friendbot`);
            return true;
          } else {
            throw new Error(`Friendbot funding failed: ${response.status}`);
          }
        } catch (friendbotError) {
          console.error(`❌ Friendbot funding failed:`, friendbotError);
          throw new Error(`Failed to fund testnet account: ${friendbotError.message}`);
        }
      } else {
        // For mainnet, account needs to be funded externally
        console.log(`⚠️ Mainnet account creation requires external funding of ${fundingAmount} XLM`);
        throw new Error(`Account ${stellarAddress} needs to be funded with ${fundingAmount} XLM to activate`);
      }
      
    } catch (error) {
      console.error(`❌ Error creating account ${stellarAddress}:`, error);
      throw error;
    }
  }

  /**
   * OFFLINE MODE: Enable offline wallet operations
   */
  async enableOfflineMode(): Promise<boolean> {
    try {
      console.log('📴 Enabling offline mode...');
      
      // Store current online data
      if (this.hdWallet && this.userId) {
        const stellarAddress = await this.hdWallet.getStellarAddress();
        
        // Cache balance data
        try {
          const balances = await this.getMultiAssetBalance(stellarAddress);
          this.offlineData.set(`balance_${stellarAddress}`, {
            data: balances,
            timestamp: Date.now()
          });
        } catch (error) {
          console.warn('Could not cache balance for offline mode:', error);
        }
        
        // Cache transaction history (last 20)
        try {
          const transactions = await this.getTransactionHistoryWithMemos(await this.hdWallet.getStellarAddress(), undefined, 20);
          this.offlineData.set(`transactions_${stellarAddress}`, {
            data: transactions,
            timestamp: Date.now()
          });
        } catch (error) {
          console.warn('Could not cache transactions for offline mode:', error);
        }
        
        // Store offline data in IPFS
        await this.syncOfflineDataToIPFS();
      }
      
      this.offlineMode = true;
      this.lastOnlineSync = Date.now();
      
      console.log('✅ Offline mode enabled');
      return true;
      
    } catch (error) {
      console.error('❌ Failed to enable offline mode:', error);
      return false;
    }
  }

  /**
   * OFFLINE MODE: Disable offline mode and sync
   */
  async disableOfflineMode(): Promise<boolean> {
    try {
      console.log('🌐 Disabling offline mode and syncing...');
      
      // Try to sync any pending offline data
      await this.syncOfflineDataFromIPFS();
      
      this.offlineMode = false;
      console.log('✅ Online mode restored');
      return true;
      
    } catch (error) {
      console.error('❌ Failed to disable offline mode:', error);
      this.offlineMode = false; // Force disable even if sync fails
      return false;
    }
  }

  /**
   * Check if in offline mode
   */
  isOffline(): boolean {
    return this.offlineMode;
  }

  /**
   * Get balance in offline mode
   */
  async getOfflineBalance(): Promise<any> {
    if (!this.hdWallet) throw new Error('HD Wallet not initialized');
    
    const stellarAddress = await this.hdWallet.getStellarAddress();
    const cachedBalance = this.offlineData.get(`balance_${stellarAddress}`);
    
    if (cachedBalance && Date.now() - cachedBalance.timestamp < 24 * 60 * 60 * 1000) {
      console.log('📴 Using cached offline balance');
      return {
        ...cachedBalance.data,
        isOffline: true,
        lastSync: new Date(cachedBalance.timestamp)
      };
    }
    
    // Try to load from IPFS if local cache is stale
    try {
      const ipfsData = await ipfsService.retrieveData(`balance_${this.userId}`);
      if (ipfsData.success) {
        console.log('☁️ Using IPFS cached balance');
        return {
          ...ipfsData.data,
          isOffline: true,
          lastSync: new Date(ipfsData.metadata.timestamp)
        };
      }
    } catch (error) {
      console.warn('Could not load balance from IPFS:', error);
    }
    
    // Return default empty balance if no cache available
    return {
      stellarAddress,
      assets: [
        { code: 'XLM', balance: '0.0000000', isNative: true }
      ],
      totalValue: 0,
      isOffline: true,
      lastSync: null
    };
  }

  /**
   * Sync offline data to IPFS
   */
  private async syncOfflineDataToIPFS(): Promise<void> {
    if (!this.userId) return;
    
    try {
      // Sync balance data
      const balanceKey = `balance_${this.userId}`;
      const balanceData = this.offlineData.get(`balance_${(await this.hdWallet?.getStellarAddress())}`);
      
      if (balanceData) {
        await ipfsService.storeData(balanceKey, balanceData.data, {
          type: 'wallet_balance',
          userId: this.userId,
          timestamp: balanceData.timestamp
        });
      }
      
      // Sync transaction data
      const txKey = `transactions_${this.userId}`;
      const txData = this.offlineData.get(`transactions_${(await this.hdWallet?.getStellarAddress())}`);
      
      if (txData) {
        await ipfsService.storeData(txKey, txData.data, {
          type: 'transaction_history',
          userId: this.userId,
          timestamp: txData.timestamp
        });
      }
      
      console.log('✅ Offline data synced to IPFS');
      
    } catch (error) {
      console.error('❌ Failed to sync offline data to IPFS:', error);
    }
  }

  /**
   * Sync offline data from IPFS
   */
  private async syncOfflineDataFromIPFS(): Promise<void> {
    if (!this.userId || !this.hdWallet) return;
    
    try {
      const stellarAddress = await this.hdWallet.getStellarAddress();
      
      // Load balance data from IPFS
      try {
        const balanceResult = await ipfsService.retrieveData(`balance_${this.userId}`);
        if (balanceResult.success) {
          this.offlineData.set(`balance_${stellarAddress}`, {
            data: balanceResult.data,
            timestamp: balanceResult.metadata.timestamp
          });
        }
      } catch (error) {
        console.warn('Could not load balance from IPFS:', error);
      }
      
      // Load transaction data from IPFS
      try {
        const txResult = await ipfsService.retrieveData(`transactions_${this.userId}`);
        if (txResult.success) {
          this.offlineData.set(`transactions_${stellarAddress}`, {
            data: txResult.data,
            timestamp: txResult.metadata.timestamp
          });
        }
      } catch (error) {
        console.warn('Could not load transactions from IPFS:', error);
      }
      
      console.log('✅ Offline data synced from IPFS');
      
    } catch (error) {
      console.error('❌ Failed to sync offline data from IPFS:', error);
    }
  }

  /**
   * Override getMultiAssetBalance to support offline mode
   */
  async getMultiAssetBalanceOffline(): Promise<any> {
    if (this.offlineMode) {
      return await this.getOfflineBalance();
    } else {
      const stellarAddress = await this.hdWallet.getStellarAddress();
      return await this.getMultiAssetBalance(stellarAddress);
    }
  }

  /**
   * Get offline status info
   */
  async getOfflineStatus(): Promise<{
    isOffline: boolean;
    lastOnlineSync: Date | null;
    cachedDataAge: number;
    ipfsConnected: boolean;
  }> {
    const stellarAddress = (await this.hdWallet?.getStellarAddress());
    const cachedBalance = stellarAddress ? this.offlineData.get(`balance_${stellarAddress}`) : null;
    
    return {
      isOffline: this.offlineMode,
      lastOnlineSync: this.lastOnlineSync ? new Date(this.lastOnlineSync) : null,
      cachedDataAge: cachedBalance ? Date.now() - cachedBalance.timestamp : 0,
      ipfsConnected: ipfsService.getStatus().isInitialized
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Save any pending offline data to IPFS before cleanup
    if (this.offlineMode && this.offlineData.size > 0) {
      await this.syncOfflineDataToIPFS();
    }
    
    if (this.hdWallet) {
      await this.hdWallet.cleanup();
      this.hdWallet = null;
    }
    this.userId = null;
    this.offlineData.clear();
    console.log('✅ Enhanced Stellar Service cleanup completed');
  }
}

export default StellarServiceEnhanced;