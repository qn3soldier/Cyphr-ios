/**
 * User Wallet Service - Binds HD wallets to user accounts
 * 
 * Features:
 * - User-wallet binding in Supabase
 * - Encrypted seed phrase storage 
 * - Cross-device wallet sync
 * - Balance and transaction caching
 * - Security and recovery flows
 */

import { supabase, supabaseServiceRole } from "./supabaseClient";
import EncryptedWalletStorage from './crypto/encryptedWalletStorage';
import { HDWallet } from './crypto/hdWallet';
import StellarServiceEnhanced from './stellarServiceEnhanced';
import { ipfsService } from './ipfsService';
import { ipfsSyncNotificationService } from './ipfsSyncNotificationService';

export interface UserWallet {
  id: string;
  user_id: string;
  encrypted_seed: string;
  stellar_address: string;
  pin_hash?: string;
  biometric_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface WalletBalanceCache {
  id: string;
  wallet_id: string;
  stellar_address: string;
  balance_data: any;
  asset_prices?: any;
  total_value_usd?: number;
  cached_at: string;
  expires_at: string;
}

export class UserWalletService {
  private stellarService: StellarServiceEnhanced;
  
  constructor(networkType: 'mainnet' | 'testnet' = 'testnet') {
    this.stellarService = new StellarServiceEnhanced(networkType);
    
    // TODO: Re-enable IPFS sync after fixing core app issues
    // Initialize IPFS sync notifications
    // this.initializeSyncNotifications();
  }

  /**
   * Initialize IPFS sync notification service
   */
  private async initializeSyncNotifications() {
    try {
      await ipfsSyncNotificationService.initialize();
      
      // Set up sync event handler
      ipfsSyncNotificationService.onSyncEvent('wallet-service', (event) => {
        console.log('🔄 Wallet sync event:', event);
        // Handle wallet sync events here
        this.handleWalletSyncEvent(event);
      });
      
      console.log('✅ Wallet sync notifications initialized');
    } catch (error) {
      console.error('❌ Failed to initialize sync notifications:', error);
    }
  }

  /**
   * Handle wallet sync events
   */
  private handleWalletSyncEvent(event: any) {
    // Implement sync event handling logic
    if (event.type === 'wallet_backup_created') {
      console.log('📦 New wallet backup detected:', event);
    }
  }

  /**
   * Create new wallet for user (first time setup)
   */
  async createUserWallet(
    userId: string, 
    seedPhrase: string, 
    pin: string,
    biometricEnabled: boolean = false
  ): Promise<UserWallet> {
    try {
      console.log('🆕 Creating new user wallet...');
      
      // Store seed phrase with PIN encryption (returns boolean)
      const storageSuccess = await EncryptedWalletStorage.storeSeedPhrase(
        seedPhrase, 
        pin, 
        biometricEnabled
      );
      
      if (!storageSuccess) {
        throw new Error('Failed to store seed phrase securely');
      }
      
      // Generate wallet addresses
      const hdWallet = await HDWallet.fromSeedPhrase(seedPhrase);
      const stellarKey = await hdWallet.deriveKey('stellar', 0);
      
      // Device fingerprinting for security
      const deviceFingerprint = await this.generateDeviceFingerprint();
      
      // For database storage, we'll encrypt the seed phrase differently
      const encryptedSeed = await this.encryptSeedPhrase(seedPhrase, pin);
      
      // Store in Supabase (match actual schema)
      const walletData = {
        user_id: userId,
        encrypted_seed: encryptedSeed,
        stellar_address: stellarKey.address,
        pin_hash: pin ? await this.hashPin(pin) : null,
        biometric_enabled: biometricEnabled
      };
      
      const { data, error } = await supabaseServiceRole
        .from('user_wallets')
        .insert(walletData)
        .select()
        .single();
        
      if (error) throw error;
      
      // TODO: Re-enable IPFS backup after fixing core app issues
      // Backup encrypted seed to IPFS for cross-device sync
      // try {
      //   const ipfsBackup = await ipfsService.storeWalletSeed(
      //     userId,
      //     encryptedData.encryptedSeedPhrase,
      //     {
      //       walletId: data.id,
      //       stellarAddress: stellarKey.address,
      //       deviceFingerprint,
      //       walletType: 'hd_wallet',
      //       biometricEnabled
      //     }
      //   );
      //   
      //   if (ipfsBackup.success) {
      //     console.log('📦 Wallet backed up to IPFS:', ipfsBackup.cid);
      //     
      //     // Store IPFS CID in wallet record for future reference
      //     await supabaseServiceRole
      //       .from('user_wallets')
      //       .update({ 
      //         ipfs_backup_cid: ipfsBackup.cid,
      //         last_backup_at: new Date().toISOString()
      //       })
      //       .eq('id', data.id);
      //   }
      // } catch (ipfsError) {
      //   console.warn('⚠️ IPFS backup failed, continuing without backup:', ipfsError);
      //   // Don't fail wallet creation if IPFS backup fails
      // }
      
      console.log('✅ User wallet created:', data.id);
      return data;
      
    } catch (error) {
      console.error('❌ Error creating user wallet:', error);
      throw error;
    }
  }

  /**
   * Get user's wallet (with caching)
   */
  async getUserWallet(userId: string): Promise<UserWallet | null> {
    try {
      console.log(`🔍 Loading wallet for user ${userId}...`);
      
      const { data, error } = await supabase
        .from('user_wallets')
        .select('*')
        .eq('user_id', userId)
        .single();
        
      if (error) {
        if (error.code === 'PGRST116') {
          console.log('📭 No wallet found for user');
          return null;
        }
        throw error;
      }
      
      // Update last accessed
      await this.updateLastAccessed(data.id);
      
      return data;
      
    } catch (error) {
      console.error('❌ Error loading user wallet:', error);
      throw error;
    }
  }

  /**
   * Unlock wallet with PIN (daily use)
   */
  async unlockWallet(userId: string, pin: string): Promise<HDWallet | null> {
    try {
      console.log('🔓 Unlocking wallet with PIN...');
      
      const userWallet = await this.getUserWallet(userId);
      if (!userWallet) {
        throw new Error('No wallet found for user');
      }
      
      // Verify PIN hash
      const inputPinHash = await this.hashPin(pin);
      if (userWallet.pin_hash && inputPinHash !== userWallet.pin_hash) {
        throw new Error('Invalid PIN');
      }
      
      // Decrypt seed phrase from database
      console.log('🔐 Decrypting seed phrase...');
      const seedPhrase = await this.decryptSeedPhrase(userWallet.encrypted_seed, pin);
      
      if (!seedPhrase) {
        throw new Error('Failed to decrypt wallet - invalid PIN');
      }
      
      // Create HD wallet instance from decrypted seed
      const hdWallet = await HDWallet.fromSeedPhrase(seedPhrase, userId);
      
      console.log('✅ Wallet unlocked successfully');
      return hdWallet;
      
    } catch (error) {
      console.error('❌ Error unlocking wallet:', error);
      throw error;
    }
  }

  /**
   * Get cached balance or load fresh
   */
  async getWalletBalance(userId: string, forceRefresh: boolean = false): Promise<any[]> {
    try {
      const userWallet = await this.getUserWallet(userId);
      if (!userWallet) throw new Error('No wallet found');
      
      // Check cache first (unless force refresh)
      if (!forceRefresh) {
        const cachedBalance = await this.getCachedBalance(userWallet.id);
        if (cachedBalance) {
          console.log('📦 Using cached balance data');
          return cachedBalance.balance_data;
        }
      }
      
      // Load fresh balance
      console.log('🔄 Loading fresh balance from Stellar network...');
      const balances = await this.stellarService.getMultiAssetBalance(userWallet.stellar_address);
      
      // Cache the result
      await this.cacheBalance(userWallet.id, userWallet.stellar_address, balances);
      
      return balances;
      
    } catch (error) {
      console.error('❌ Error loading wallet balance:', error);
      throw error;
    }
  }

  /**
   * Cache balance data for performance
   */
  private async cacheBalance(walletId: string, stellarAddress: string, balances: any[]): Promise<void> {
    try {
      const cacheData = {
        wallet_id: walletId,
        stellar_address: stellarAddress,
        balance_data: balances,
        cached_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes
      };
      
      await supabaseServiceRole
        .from('wallet_balance_cache')
        .upsert(cacheData, { onConflict: 'wallet_id' });
        
      console.log('💾 Balance cached successfully');
      
    } catch (error) {
      console.error('❌ Error caching balance:', error);
      // Don't throw - caching is optional
    }
  }

  /**
   * Get cached balance if valid
   */
  private async getCachedBalance(walletId: string): Promise<WalletBalanceCache | null> {
    try {
      const { data, error } = await supabase
        .from('wallet_balance_cache')
        .select('*')
        .eq('wallet_id', walletId)
        .gt('expires_at', new Date().toISOString())
        .single();
        
      if (error || !data) return null;
      
      return data;
      
    } catch (error) {
      return null;
    }
  }

  /**
   * Update last accessed timestamp
   */
  private async updateLastAccessed(walletId: string): Promise<void> {
    try {
      await supabaseServiceRole
        .from('user_wallets')
        .update({ last_accessed: new Date().toISOString() })
        .eq('id', walletId);
    } catch (error) {
      // Don't throw - this is optional
      console.warn('⚠️ Failed to update last accessed:', error);
    }
  }

  /**
   * Hash PIN for secure storage
   */
  private async hashPin(pin: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generate device fingerprint for security
   */
  private async generateDeviceFingerprint(): Promise<string> {
    try {
      const components = [
        navigator.userAgent,
        navigator.language,
        screen.width + 'x' + screen.height,
        new Date().getTimezoneOffset().toString(),
        navigator.platform
      ];
      
      const fingerprint = components.join('|');
      const encoder = new TextEncoder();
      const data = encoder.encode(fingerprint);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      return hashHex.substring(0, 16); // First 16 chars
      
    } catch (error) {
      return 'unknown_device';
    }
  }

  /**
   * Encrypt seed phrase for database storage
   */
  private async encryptSeedPhrase(seedPhrase: string, pin: string): Promise<string> {
    try {
      // Use Web Crypto API for encryption
      const encoder = new TextEncoder();
      const data = encoder.encode(seedPhrase);
      
      // Create key from PIN
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(pin.padEnd(32, '0')), // Ensure 32-byte key
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );
      
      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: encoder.encode('cyphr-salt-2025'),
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

  /**
   * Utility: ArrayBuffer to Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Utility: Base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Decrypt seed phrase for daily wallet access
   */
  private async decryptSeedPhrase(encryptedSeed: string, pin: string): Promise<string | null> {
    try {
      // Create key from PIN (same process as encryption)
      const encoder = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(pin.padEnd(32, '0')), // Ensure 32-byte key
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );
      
      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: encoder.encode('cyphr-salt-2025'),
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );
      
      // Convert base64 back to ArrayBuffer
      const combined = this.base64ToArrayBuffer(encryptedSeed);
      
      // Extract IV and encrypted data
      const iv = combined.slice(0, 12);
      const encryptedData = combined.slice(12);
      
      // Decrypt the data
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

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.stellarService.cleanup();
  }
}

export default UserWalletService;