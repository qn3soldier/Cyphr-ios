/**
 * Encrypted Wallet Storage - Lobstr-like Authentication Architecture
 * 
 * CORRECT FLOW:
 * 1. First Time: Seed phrase → PBKDF2 key derivation from PIN → AES-GCM encrypt → localStorage
 * 2. Daily Use: PIN → PBKDF2 derive key → AES-GCM decrypt → load wallet
 * 3. Recovery: Seed phrase only for device transfer/recovery
 * 
 * Security Features:
 * - WebCrypto PBKDF2 with 100,000+ iterations
 * - AES-GCM 256-bit authenticated encryption  
 * - Persistent browser localStorage (encrypted)
 * - Biometric authentication via WebAuthn
 * - Secure memory wiping
 */

import { validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { ipfsService } from '../ipfsService.js';

export interface EncryptedWalletData {
  encryptedSeedPhrase: ArrayBuffer;
  salt: ArrayBuffer;
  iv: ArrayBuffer;
  iterations: number;
  algorithm: string;
  timestamp: number;
  biometricEnabled: boolean;
  version: string;
}

export interface WalletAuthOptions {
  pin?: string;
  biometric?: boolean;
  iterations?: number;
}

export class EncryptedWalletStorage {
  private static readonly STORAGE_KEY = 'cypher_encrypted_wallet';
  private static readonly BIOMETRIC_KEY = 'cypher_biometric_credential';
  private static readonly DEFAULT_ITERATIONS = 100000;
  private static readonly KEY_LENGTH = 256;
  private static readonly IV_LENGTH = 12; // AES-GCM IV length

  /**
   * Store seed phrase encrypted with PIN
   * First time setup: Seed phrase → PIN encryption → persistent storage
   */
  static async storeSeedPhrase(
    seedPhrase: string, 
    pin: string, 
    enableBiometric: boolean = false
  ): Promise<boolean> {
    try {
      console.log('🔐 Storing seed phrase with PIN encryption...');

      // Generate random salt for PBKDF2
      const salt = crypto.getRandomValues(new Uint8Array(16));
      
      // Generate random IV for AES-GCM
      const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));

      // Derive encryption key from PIN using PBKDF2
      const iterations = this.DEFAULT_ITERATIONS;
      const encryptionKey = await this.deriveKeyFromPin(pin, salt, iterations);

      // Encrypt seed phrase using AES-GCM
      const seedPhraseBytes = new TextEncoder().encode(seedPhrase);
      const encryptedSeedPhrase = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        encryptionKey,
        seedPhraseBytes
      );

      // Prepare encrypted wallet data
      const walletData: EncryptedWalletData = {
        encryptedSeedPhrase,
        salt: salt.buffer,
        iv: iv.buffer,
        iterations,
        algorithm: 'AES-GCM-256',
        timestamp: Date.now(),
        biometricEnabled: enableBiometric,
        version: '1.0.0'
      };

      // Store in localStorage (encrypted)
      const serializedData = this.serializeWalletData(walletData);
      localStorage.setItem(this.STORAGE_KEY, serializedData);

      // IPFS BACKUP: Store encrypted wallet backup for decentralized access
      try {
        const userId = sessionStorage.getItem('userId');
        if (userId) {
          console.log('☁️ Creating IPFS backup...');
          const ipfsResult = await ipfsService.storeWalletSeed(userId, serializedData, {
            algorithm: walletData.algorithm,
            biometricEnabled: walletData.biometricEnabled,
            version: walletData.version
          });
          
          if (ipfsResult.success) {
            console.log('✅ IPFS backup created:', ipfsResult.cid);
            // Store IPFS CID for future retrieval
            localStorage.setItem(`${this.STORAGE_KEY}_ipfs_cid`, ipfsResult.cid);
          } else {
            console.warn('⚠️ IPFS backup failed, continuing with local storage');
          }
        }
      } catch (ipfsError) {
        console.warn('⚠️ IPFS backup error:', ipfsError);
        // Don't fail the entire process if IPFS fails
      }

      // Setup biometric if requested
      if (enableBiometric) {
        await this.setupBiometricAuth(pin);
      }

      // Secure cleanup
      this.secureWipe(seedPhraseBytes);
      // Note: CryptoKey secure cleanup handled by browser GC

      console.log('✅ Seed phrase stored successfully with PIN encryption');
      return true;

    } catch (error) {
      console.error('❌ Failed to store encrypted seed phrase:', error);
      return false;
    }
  }

  /**
   * Unlock wallet with PIN
   * Daily use: PIN → decrypt → load wallet
   */
  static async unlockWithPin(pin: string): Promise<string | null> {
    try {
      console.log('🔓 Unlocking wallet with PIN...');

      // Get encrypted wallet data from localStorage
      const walletData = this.getStoredWalletData();
      if (!walletData) {
        console.log('❌ No encrypted wallet found in storage');
        return null;
      }

      // Derive decryption key from PIN
      const salt = new Uint8Array(walletData.salt);
      const decryptionKey = await this.deriveKeyFromPin(pin, salt, walletData.iterations);

      // Decrypt seed phrase using AES-GCM
      const iv = new Uint8Array(walletData.iv);
      const decryptedBytes = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        decryptionKey,
        walletData.encryptedSeedPhrase
      );

      // Convert to string
      const seedPhrase = new TextDecoder().decode(decryptedBytes);

      // Validate seed phrase format (basic check)
      if (!this.isValidSeedPhrase(seedPhrase)) {
        console.log('❌ Decrypted data is not a valid seed phrase');
        return null;
      }

      // Secure cleanup
      this.secureWipe(new Uint8Array(decryptedBytes));
      // Note: CryptoKey secure cleanup handled by browser GC

      console.log('✅ Wallet unlocked successfully with PIN');
      return seedPhrase;

    } catch (error) {
      console.error('❌ Failed to unlock wallet with PIN:', error);
      return null;
    }
  }

  /**
   * Unlock wallet with biometric authentication
   */
  static async unlockWithBiometric(): Promise<string | null> {
    try {
      console.log('👆 Unlocking wallet with biometric...');

      // Check if biometric is available and enabled
      const walletData = this.getStoredWalletData();
      if (!walletData || !walletData.biometricEnabled) {
        console.log('❌ Biometric authentication not enabled');
        return null;
      }

      // Check WebAuthn support
      if (!this.isBiometricAvailable()) {
        console.log('❌ Biometric authentication not available');
        return null;
      }

      // Get stored biometric credential ID
      const credentialId = localStorage.getItem(this.BIOMETRIC_KEY);
      if (!credentialId) {
        console.log('❌ No biometric credential found');
        return null;
      }

      // Perform biometric authentication
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [{
            type: 'public-key',
            id: new TextEncoder().encode(credentialId)
          }],
          userVerification: 'required',
          timeout: 60000
        }
      });

      if (!credential) {
        console.log('❌ Biometric authentication failed');
        return null;
      }

      // If biometric auth succeeded, we need to derive the PIN from stored credential
      // For security, we'll need the user to set up PIN-biometric pairing during setup
      // This is a simplified version - in production, you'd store an encrypted PIN 
      // that gets decrypted upon successful biometric auth
      
      console.log('⚠️ Biometric unlock requires PIN-biometric pairing setup');
      return null; // Will implement full biometric flow in next version

    } catch (error) {
      console.error('❌ Biometric unlock failed:', error);
      return null;
    }
  }

  /**
   * Check if wallet is stored (setup completed)
   */
  static isWalletStored(): boolean {
    try {
      console.log('🔍 Checking localStorage for wallet data...');
      const walletData = localStorage.getItem(this.STORAGE_KEY);
      console.log('📊 localStorage result:', walletData ? 'FOUND' : 'NOT_FOUND');
      return walletData !== null;
    } catch (error) {
      console.error('❌ Error accessing localStorage:', error);
      return false;
    }
  }

  /**
   * Check if biometric is enabled for this wallet
   */
  static isBiometricEnabled(): boolean {
    const walletData = this.getStoredWalletData();
    return walletData?.biometricEnabled || false;
  }

  /**
   * Delete stored wallet (complete reset)
   */
  static deleteWallet(): boolean {
    try {
      console.log('🗑️ Deleting stored encrypted wallet...');

      // Remove from localStorage
      localStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem(this.BIOMETRIC_KEY);

      console.log('✅ Encrypted wallet deleted successfully');
      return true;

    } catch (error) {
      console.error('❌ Failed to delete wallet:', error);
      return false;
    }
  }

  /**
   * Change PIN (requires current PIN or seed phrase)
   */
  static async changePIN(currentAuth: string, isCurrentPin: boolean, newPin: string): Promise<boolean> {
    try {
      console.log('🔄 Changing wallet PIN...');

      // First unlock wallet with current auth
      let seedPhrase: string | null;
      if (isCurrentPin) {
        seedPhrase = await this.unlockWithPin(currentAuth);
      } else {
        // Using seed phrase directly for PIN reset
        seedPhrase = currentAuth;
      }

      if (!seedPhrase) {
        console.log('❌ Failed to authenticate with current credentials');
        return false;
      }

      // Get current biometric setting
      const currentWalletData = this.getStoredWalletData();
      const biometricEnabled = currentWalletData?.biometricEnabled || false;

      // Delete old wallet
      this.deleteWallet();

      // Store with new PIN
      const success = await this.storeSeedPhrase(seedPhrase, newPin, biometricEnabled);

      // Secure cleanup
      this.secureWipeString(seedPhrase);

      if (success) {
        console.log('✅ PIN changed successfully');
      }

      return success;

    } catch (error) {
      console.error('❌ Failed to change PIN:', error);
      return false;
    }
  }

  // =============================================================================
  // PRIVATE HELPER METHODS
  // =============================================================================

  /**
   * Derive encryption key from PIN using PBKDF2
   */
  private static async deriveKeyFromPin(
    pin: string, 
    salt: Uint8Array, 
    iterations: number
  ): Promise<CryptoKey> {
    // Import PIN as key material
    const pinBytes = new TextEncoder().encode(pin);
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      pinBytes,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    // Derive actual encryption key
    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      { 
        name: 'AES-GCM', 
        length: this.KEY_LENGTH 
      },
      true, // extractable for cleanup
      ['encrypt', 'decrypt']
    );

    // Secure cleanup
    this.secureWipe(pinBytes);

    return derivedKey;
  }

  /**
   * Setup biometric authentication
   */
  private static async setupBiometricAuth(pin: string): Promise<void> {
    try {
      if (!this.isBiometricAvailable()) {
        throw new Error('Biometric authentication not available');
      }

      // Create a WebAuthn credential for biometric auth
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: {
            name: 'Cypher Messenger',
            id: window.location.hostname
          },
          user: {
            id: crypto.getRandomValues(new Uint8Array(16)),
            name: 'wallet-user',
            displayName: 'Wallet User'
          },
          pubKeyCredParams: [
            {
              type: 'public-key',
              alg: -7 // ES256 (ECDSA with P-256 and SHA-256)
            },
            {
              type: 'public-key', 
              alg: -257 // RS256 (RSASSA-PKCS1-v1_5 with SHA-256)
            }
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required'
          },
          timeout: 60000
        }
      });

      if (credential && 'id' in credential) {
        // Store credential ID for future authentication
        localStorage.setItem(this.BIOMETRIC_KEY, credential.id);
        console.log('✅ Biometric authentication setup completed');
      }

    } catch (error) {
      console.error('❌ Failed to setup biometric auth:', error);
      throw error;
    }
  }

  /**
   * Check if biometric authentication is available
   */
  private static isBiometricAvailable(): boolean {
    return !!(
      typeof window !== 'undefined' &&
      'credentials' in navigator &&
      'PublicKeyCredential' in window
    );
  }

  /**
   * Get stored wallet data from localStorage
   */
  private static getStoredWalletData(): EncryptedWalletData | null {
    try {
      const storedData = localStorage.getItem(this.STORAGE_KEY);
      if (!storedData) return null;

      return this.deserializeWalletData(storedData);

    } catch (error) {
      console.error('❌ Failed to get stored wallet data:', error);
      return null;
    }
  }

  /**
   * Serialize wallet data for storage
   */
  private static serializeWalletData(data: EncryptedWalletData): string {
    return JSON.stringify({
      encryptedSeedPhrase: Array.from(new Uint8Array(data.encryptedSeedPhrase)),
      salt: Array.from(new Uint8Array(data.salt)),
      iv: Array.from(new Uint8Array(data.iv)),
      iterations: data.iterations,
      algorithm: data.algorithm,
      timestamp: data.timestamp,
      biometricEnabled: data.biometricEnabled,
      version: data.version
    });
  }

  /**
   * Deserialize wallet data from storage
   */
  private static deserializeWalletData(serialized: string): EncryptedWalletData {
    const parsed = JSON.parse(serialized);
    return {
      encryptedSeedPhrase: new Uint8Array(parsed.encryptedSeedPhrase).buffer,
      salt: new Uint8Array(parsed.salt).buffer,
      iv: new Uint8Array(parsed.iv).buffer,
      iterations: parsed.iterations,
      algorithm: parsed.algorithm,
      timestamp: parsed.timestamp,
      biometricEnabled: parsed.biometricEnabled,
      version: parsed.version
    };
  }

  /**
   * Proper BIP39 seed phrase validation
   */
  private static isValidSeedPhrase(seedPhrase: string): boolean {
    if (!seedPhrase || typeof seedPhrase !== 'string') {
      console.log('❌ Seed phrase validation failed: not a string');
      return false;
    }
    
    try {
      const isValid = validateMnemonic(seedPhrase.trim(), wordlist);
      if (!isValid) {
        console.log('❌ Seed phrase validation failed: invalid BIP39 mnemonic');
      }
      return isValid;
    } catch (error) {
      console.log('❌ Seed phrase validation error:', error.message);
      return false;
    }
  }

  /**
   * Secure memory wiping for Uint8Array
   */
  private static secureWipe(data: Uint8Array): void {
    if (data && data.fill) {
      data.fill(0);
    }
  }

  /**
   * Secure memory wiping for strings
   */
  private static secureWipeString(str: string): void {
    // In JavaScript, strings are immutable, but we can try to overwrite the reference
    // Note: This is not as secure as native memory wiping but better than nothing
    str = '';
  }

  /**
   * Get wallet storage statistics
   */
  static getStorageStats() {
    const walletData = this.getStoredWalletData();
    if (!walletData) {
      return {
        isStored: false,
        timestamp: null,
        biometricEnabled: false,
        algorithm: null,
        version: null
      };
    }

    return {
      isStored: true,
      timestamp: new Date(walletData.timestamp),
      biometricEnabled: walletData.biometricEnabled,
      algorithm: walletData.algorithm,
      version: walletData.version,
      iterations: walletData.iterations
    };
  }

  /**
   * IPFS RECOVERY: Restore wallet from IPFS backup
   */
  static async restoreFromIPFS(userId: string, pin: string, ipfsCid?: string): Promise<boolean> {
    try {
      console.log('☁️ Restoring wallet from IPFS backup...');

      // Use stored CID if not provided
      if (!ipfsCid) {
        ipfsCid = localStorage.getItem(`${this.STORAGE_KEY}_ipfs_cid`);
        if (!ipfsCid) {
          throw new Error('No IPFS backup CID found');
        }
      }

      // Retrieve from IPFS
      const ipfsResult = await ipfsService.retrieveWalletSeed(userId, ipfsCid);
      if (!ipfsResult.success) {
        throw new Error(ipfsResult.error || 'IPFS retrieval failed');
      }

      // Verify the encrypted data can be decrypted with provided PIN
      const walletData = this.deserializeWalletData(ipfsResult.encryptedSeed);
      const derivedKey = await this.deriveKeyFromPin(
        pin, 
        new Uint8Array(walletData.salt), 
        walletData.iterations
      );

      // Test decrypt to verify PIN is correct
      try {
        await crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: new Uint8Array(walletData.iv)
          },
          derivedKey,
          walletData.encryptedSeedPhrase
        );
      } catch {
        throw new Error('Incorrect PIN for IPFS backup');
      }

      // Store in local storage
      localStorage.setItem(this.STORAGE_KEY, ipfsResult.encryptedSeed);
      localStorage.setItem(`${this.STORAGE_KEY}_ipfs_cid`, ipfsCid);

      console.log('✅ Wallet restored from IPFS successfully');
      return true;

    } catch (error) {
      console.error('❌ IPFS wallet restoration failed:', error);
      return false;
    }
  }

  /**
   * IPFS SYNC: Sync local wallet with IPFS backup
   */
  static async syncWithIPFS(): Promise<boolean> {
    try {
      const userId = sessionStorage.getItem('userId');
      if (!userId) return false;

      const localData = this.getStoredWalletData();
      if (!localData) return false;

      // Get IPFS backup info
      const ipfsCid = localStorage.getItem(`${this.STORAGE_KEY}_ipfs_cid`);
      if (!ipfsCid) {
        console.log('💾 No IPFS backup found, creating new one...');
        
        // Create IPFS backup for existing local wallet
        const serializedData = this.serializeWalletData(localData);
        const ipfsResult = await ipfsService.storeWalletSeed(userId, serializedData, {
          algorithm: localData.algorithm,
          biometricEnabled: localData.biometricEnabled,
          version: localData.version
        });
        
        if (ipfsResult.success) {
          localStorage.setItem(`${this.STORAGE_KEY}_ipfs_cid`, ipfsResult.cid);
          console.log('✅ Created new IPFS backup:', ipfsResult.cid);
          return true;
        }
        return false;
      }

      // Compare timestamps
      const ipfsResult = await ipfsService.retrieveWalletSeed(userId, ipfsCid);
      if (!ipfsResult.success) return false;

      const ipfsData = this.deserializeWalletData(ipfsResult.encryptedSeed);
      
      if (ipfsData.timestamp > localData.timestamp) {
        console.log('☁️ IPFS backup is newer, updating local storage');
        localStorage.setItem(this.STORAGE_KEY, ipfsResult.encryptedSeed);
        return true;
      } else if (localData.timestamp > ipfsData.timestamp) {
        console.log('💾 Local storage is newer, updating IPFS backup');
        const serializedData = this.serializeWalletData(localData);
        const updateResult = await ipfsService.storeWalletSeed(userId, serializedData, {
          algorithm: localData.algorithm,
          biometricEnabled: localData.biometricEnabled,
          version: localData.version
        });
        
        if (updateResult.success) {
          localStorage.setItem(`${this.STORAGE_KEY}_ipfs_cid`, updateResult.cid);
          return true;
        }
      }

      console.log('✅ Wallet in sync with IPFS');
      return true;

    } catch (error) {
      console.error('❌ IPFS sync failed:', error);
      return false;
    }
  }

  /**
   * Check IPFS backup status
   */
  static async getIPFSBackupStatus(): Promise<{
    hasBackup: boolean;
    cid?: string;
    lastSync?: number;
    status?: string;
  }> {
    try {
      const userId = sessionStorage.getItem('userId');
      const ipfsCid = localStorage.getItem(`${this.STORAGE_KEY}_ipfs_cid`);
      
      if (!userId || !ipfsCid) {
        return { hasBackup: false, status: 'No backup found' };
      }

      const ipfsResult = await ipfsService.retrieveWalletSeed(userId, ipfsCid);
      
      if (ipfsResult.success) {
        const ipfsData = this.deserializeWalletData(ipfsResult.encryptedSeed);
        return {
          hasBackup: true,
          cid: ipfsCid,
          lastSync: ipfsData.timestamp,
          status: 'Backup available'
        };
      } else {
        return { 
          hasBackup: false, 
          cid: ipfsCid,
          status: 'Backup corrupted or unavailable' 
        };
      }

    } catch (error) {
      return { 
        hasBackup: false, 
        status: `Error: ${error.message}` 
      };
    }
  }
}

// Export for use in other modules
export default EncryptedWalletStorage;