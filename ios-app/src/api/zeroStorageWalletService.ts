/**
 * Zero Storage Wallet Service - TRUE PRIVACY IMPLEMENTATION
 * 
 * ZERO KNOWLEDGE POLICY:
 * - All seed phrases stored locally only (IndexedDB + PIN encryption)
 * - No private keys ever transmitted to server
 * - Server stores only public keys for messaging
 * - Wallet data cached in browser, fetched from blockchain directly
 * - No personal data or wallet balances stored on server
 */

import { HDWallet } from './crypto/hdWallet';
import StellarServiceEnhanced from './stellarServiceEnhanced';
import Toast from 'react-native-toast-message';

export interface LocalWallet {
  id: string;
  stellarAddress: string;
  encryptedSeed: string;
  publicKey: string;
  createdAt: string;
  lastAccessed: string;
  biometricEnabled: boolean;
}

export interface WalletSession {
  hdWallet: HDWallet;
  stellarAddress: string;
  publicKey: string;
  sessionExpiry: number;
}

export class ZeroStorageWalletService {
  private stellarService: StellarServiceEnhanced;
  private currentSession: WalletSession | null = null;
  
  constructor(networkType: 'mainnet' | 'testnet' = 'testnet') {
    this.stellarService = new StellarServiceEnhanced(networkType);
    console.log('🔐 Zero Storage Wallet Service initialized - NO DATA SENT TO SERVER');
  }

  /**
   * Create new wallet - EVERYTHING STAYS ON DEVICE
   */
  async createWallet(seedPhrase: string, pin: string, biometricEnabled: boolean = false): Promise<LocalWallet> {
    try {
      console.log('🆕 Creating wallet with ZERO server storage...');
      
      // Generate HD wallet locally
      const userId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const hdWallet = await HDWallet.fromSeedPhrase(seedPhrase, userId);
      const stellarKey = await hdWallet.deriveKey('stellar', 0);
      
      // Encrypt seed phrase with PIN for local storage
      const encryptedSeed = await this.encryptSeedPhrase(seedPhrase, pin);
      
      // Create local wallet object
      const localWallet: LocalWallet = {
        id: userId,
        stellarAddress: stellarKey.address,
        encryptedSeed,
        publicKey: stellarKey.address, // For messaging (public info only)
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        biometricEnabled
      };
      
      // Store ONLY in browser (IndexedDB)
      await this.saveWalletLocally(localWallet);
      
      // Register ONLY public key with server for messaging (no private data)
      await this.registerPublicKeyOnly(localWallet.publicKey);
      
      console.log('✅ Wallet created with ZERO server storage');
      toast.success('🔐 Wallet created locally - zero server storage!');
      
      return localWallet;
      
    } catch (error) {
      console.error('❌ Error creating zero-storage wallet:', error);
      throw error;
    }
  }

  /**
   * Unlock wallet with PIN - CLIENT-SIDE ONLY
   */
  async unlockWallet(walletId: string, pin: string): Promise<WalletSession> {
    try {
      console.log('🔓 Unlocking wallet locally...');
      
      // Load wallet from local storage only
      const localWallet = await this.loadWalletLocally(walletId);
      if (!localWallet) {
        throw new Error('Wallet not found locally');
      }
      
      // Decrypt seed phrase locally
      const seedPhrase = await this.decryptSeedPhrase(localWallet.encryptedSeed, pin);
      if (!seedPhrase) {
        throw new Error('Invalid PIN');
      }
      
      // Create HD wallet instance
      const hdWallet = await HDWallet.fromSeedPhrase(seedPhrase, walletId);
      
      // Create session with expiry
      this.currentSession = {
        hdWallet,
        stellarAddress: localWallet.stellarAddress,
        publicKey: localWallet.publicKey,
        sessionExpiry: Date.now() + (4 * 60 * 60 * 1000) // 4 hours
      };
      
      // Update last accessed locally
      localWallet.lastAccessed = new Date().toISOString();
      await this.saveWalletLocally(localWallet);
      
      console.log('✅ Wallet unlocked locally - no server communication');
      return this.currentSession;
      
    } catch (error) {
      console.error('❌ Error unlocking wallet:', error);
      throw error;
    }
  }

  /**
   * Get wallet balance - DIRECTLY FROM BLOCKCHAIN
   */
  async getWalletBalance(stellarAddress: string): Promise<any[]> {
    try {
      console.log('💰 Loading balance directly from Stellar network...');
      
      // Get balance directly from Stellar Horizon (no server storage)
      const balances = await this.stellarService.getMultiAssetBalance(stellarAddress);
      
      // Cache locally for performance
      this.cacheBalanceLocally(stellarAddress, balances);
      
      return balances;
      
    } catch (error) {
      console.error('❌ Error loading balance from blockchain:', error);
      
      // Fallback to local cache
      const cachedBalance = this.getCachedBalanceLocally(stellarAddress);
      if (cachedBalance) {
        console.log('📦 Using locally cached balance');
        return cachedBalance;
      }
      
      throw error;
    }
  }

  /**
   * Send transaction - CLIENT-SIDE SIGNING ONLY
   */
  async sendTransaction(recipient: string, amount: string, asset: string = 'XLM', memo?: string): Promise<any> {
    try {
      if (!this.currentSession || Date.now() > this.currentSession.sessionExpiry) {
        throw new Error('Session expired - please unlock wallet');
      }
      
      console.log('💸 Signing transaction locally...');
      
      // Get Stellar key from HD wallet
      const stellarKey = await this.currentSession.hdWallet.deriveKey('stellar', 0);
      
      // Sign and submit transaction directly to Stellar network
      const StellarSdk = await import('@stellar/stellar-sdk');
      const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
      
      // Load sender account
      const senderAccount = await server.loadAccount(stellarKey.address);
      
      // Build transaction
      const transaction = new StellarSdk.TransactionBuilder(senderAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET
      })
      .addOperation(StellarSdk.Operation.payment({
        destination: recipient,
        asset: StellarSdk.Asset.native(),
        amount: amount.toString()
      }))
      .addMemo(memo ? StellarSdk.Memo.text(memo) : StellarSdk.Memo.none())
      .setTimeout(300)
      .build();

      // Sign transaction locally
      const sourceKeypair = StellarSdk.Keypair.fromSecret(stellarKey.privateKey);
      transaction.sign(sourceKeypair);

      // Submit directly to Stellar network
      const result = await server.submitTransaction(transaction);
      
      console.log('✅ Transaction sent directly to blockchain:', result.hash);
      toast.success(`🚀 Transaction sent! Hash: ${result.hash.substring(0, 8)}...`);
      
      return result;
      
    } catch (error) {
      console.error('❌ Send transaction error:', error);
      throw error;
    }
  }

  /**
   * PRIVATE METHODS - LOCAL STORAGE ONLY
   */

  private async saveWalletLocally(wallet: LocalWallet): Promise<void> {
    try {
      // Use IndexedDB for secure local storage
      const dbName = 'CyphrWallets';
      const request = indexedDB.open(dbName, 1);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('wallets')) {
          db.createObjectStore('wallets', { keyPath: 'id' });
        }
      };
      
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['wallets'], 'readwrite');
        const store = transaction.objectStore('wallets');
        store.put(wallet);
      };
      
    } catch (error) {
      console.error('❌ Error saving wallet locally:', error);
      throw error;
    }
  }

  private async loadWalletLocally(walletId: string): Promise<LocalWallet | null> {
    try {
      return new Promise((resolve, reject) => {
        const dbName = 'CyphrWallets';
        const request = indexedDB.open(dbName, 1);
        
        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          const transaction = db.transaction(['wallets'], 'readonly');
          const store = transaction.objectStore('wallets');
          const getRequest = store.get(walletId);
          
          getRequest.onsuccess = () => {
            resolve(getRequest.result || null);
          };
          
          getRequest.onerror = () => {
            reject(getRequest.error);
          };
        };
        
        request.onerror = () => {
          reject(request.error);
        };
      });
      
    } catch (error) {
      console.error('❌ Error loading wallet locally:', error);
      return null;
    }
  }

  private async registerPublicKeyOnly(publicKey: string): Promise<void> {
    try {
      // Register ONLY public key for messaging - no private data
      const response = await fetch('/api/auth/register-public-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicKey })
      });
      
      if (!response.ok) {
        console.warn('⚠️ Failed to register public key (messaging may not work)');
      } else {
        console.log('✅ Public key registered for messaging');
      }
      
    } catch (error) {
      console.warn('⚠️ Public key registration failed:', error);
    }
  }

  private async encryptSeedPhrase(seedPhrase: string, pin: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(seedPhrase);
      
      // Create key from PIN
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(pin.padEnd(32, '0')),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );
      
      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: encoder.encode('cyphr-zero-storage-2025'),
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
      );
      
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        data
      );
      
      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(encrypted), iv.length);
      
      return this.arrayBufferToBase64(combined.buffer);
      
    } catch (error) {
      console.error('❌ Encryption failed:', error);
      throw new Error('Failed to encrypt seed phrase');
    }
  }

  private async decryptSeedPhrase(encryptedSeed: string, pin: string): Promise<string | null> {
    try {
      const encoder = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(pin.padEnd(32, '0')),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );
      
      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: encoder.encode('cyphr-zero-storage-2025'),
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );
      
      const combined = this.base64ToArrayBuffer(encryptedSeed);
      const iv = combined.slice(0, 12);
      const encryptedData = combined.slice(12);
      
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encryptedData
      );
      
      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
      
    } catch (error) {
      console.error('❌ Decryption failed:', error);
      return null;
    }
  }

  private cacheBalanceLocally(stellarAddress: string, balances: any[]): void {
    try {
      const cacheKey = `balance_${stellarAddress}`;
      const cacheData = {
        balances,
        timestamp: Date.now(),
        expiry: Date.now() + (5 * 60 * 1000) // 5 minutes
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('⚠️ Failed to cache balance locally:', error);
    }
  }

  private getCachedBalanceLocally(stellarAddress: string): any[] | null {
    try {
      const cacheKey = `balance_${stellarAddress}`;
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;
      
      const cacheData = JSON.parse(cached);
      if (Date.now() > cacheData.expiry) {
        localStorage.removeItem(cacheKey);
        return null;
      }
      
      return cacheData.balances;
    } catch (error) {
      return null;
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Get current session
   */
  getCurrentSession(): WalletSession | null {
    if (this.currentSession && Date.now() > this.currentSession.sessionExpiry) {
      this.currentSession = null;
    }
    return this.currentSession;
  }

  /**
   * Clear session (logout)
   */
  clearSession(): void {
    this.currentSession = null;
    console.log('🔓 Wallet session cleared');
  }

  /**
   * Check if any wallets exist locally
   */
  async hasLocalWallets(): Promise<boolean> {
    try {
      return new Promise((resolve) => {
        const dbName = 'CyphrWallets';
        const request = indexedDB.open(dbName, 1);
        
        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          const transaction = db.transaction(['wallets'], 'readonly');
          const store = transaction.objectStore('wallets');
          const countRequest = store.count();
          
          countRequest.onsuccess = () => {
            resolve(countRequest.result > 0);
          };
          
          countRequest.onerror = () => {
            resolve(false);
          };
        };
        
        request.onerror = () => {
          resolve(false);
        };
      });
    } catch (error) {
      return false;
    }
  }

  /**
   * List local wallets (public data only)
   */
  async listLocalWallets(): Promise<Partial<LocalWallet>[]> {
    try {
      return new Promise((resolve, reject) => {
        const dbName = 'CyphrWallets';
        const request = indexedDB.open(dbName, 1);
        
        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          const transaction = db.transaction(['wallets'], 'readonly');
          const store = transaction.objectStore('wallets');
          const getAllRequest = store.getAll();
          
          getAllRequest.onsuccess = () => {
            const wallets = getAllRequest.result.map((wallet: LocalWallet) => ({
              id: wallet.id,
              stellarAddress: wallet.stellarAddress,
              createdAt: wallet.createdAt,
              lastAccessed: wallet.lastAccessed,
              biometricEnabled: wallet.biometricEnabled
              // NOTE: encryptedSeed excluded for security
            }));
            resolve(wallets);
          };
          
          getAllRequest.onerror = () => {
            reject(getAllRequest.error);
          };
        };
        
        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('❌ Error listing local wallets:', error);
      return [];
    }
  }
}

export default ZeroStorageWalletService;