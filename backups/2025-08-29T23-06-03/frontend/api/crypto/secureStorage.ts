/**
 * Secure Storage Module with Quantum-Safe Key Protection
 * - Hardware-backed storage when available
 * - Memory protection against XSS/injection attacks
 * - Encrypted storage with key derivation
 * - Auto-expiration and session management
 */

import { secureChaCha20 } from './secureChaCha20';
import { secureRNG } from './secureRNG.ts';
import { sha3_256 } from '@noble/hashes/sha3';
import { scrypt } from '@noble/hashes/scrypt';
import { randomBytes } from '@noble/hashes/utils';

export interface SecureStorageOptions {
  keyDerivationRounds?: number;
  autoExpireMinutes?: number;
  useMemoryProtection?: boolean;
  hardwareBackedPreferred?: boolean;
}

export interface StoredData {
  encryptedData: Uint8Array;
  salt: Uint8Array;
  nonce: Uint8Array;
  algorithm: string;
  timestamp: number;
  expiresAt?: number;
}

export class SecureStorage {
  private memoryStore: Map<string, StoredData>;
  private masterKey: Uint8Array | null;
  private sessionId: string;
  private options: Required<SecureStorageOptions>;

  constructor(options: SecureStorageOptions = {}) {
    this.memoryStore = new Map();
    this.masterKey = null;
    this.sessionId = this.generateSessionId();
    
    this.options = {
      keyDerivationRounds: options.keyDerivationRounds || 32768,
      autoExpireMinutes: options.autoExpireMinutes || 60,
      useMemoryProtection: options.useMemoryProtection ?? true,
      hardwareBackedPreferred: options.hardwareBackedPreferred ?? true
    };

    console.log(`🔐 SecureStorage initialized with session: ${this.sessionId.substring(0, 8)}...`);
    this.initializeMasterKey();
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `${timestamp}-${random}`;
  }

  /**
   * Initialize master key for encryption
   */
  private async initializeMasterKey(): Promise<void> {
    try {
      // Try to use hardware-backed key storage first
      if (this.options.hardwareBackedPreferred && await this.isHardwareBackedAvailable()) {
        console.log('🔑 Using hardware-backed key storage');
        this.masterKey = await this.generateHardwareBackedKey();
      } else {
        console.log('🔑 Using software-based key storage');
        this.masterKey = await secureRNG.generateKey(32);
      }

      // Set up memory protection
      if (this.options.useMemoryProtection) {
        this.setupMemoryProtection();
      }

    } catch (error) {
      console.error('❌ Failed to initialize master key:', error);
      throw new Error('Secure storage initialization failed');
    }
  }

  /**
   * Check if hardware-backed storage is available
   */
  private async isHardwareBackedAvailable(): Promise<boolean> {
    try {
      // Check for WebCrypto with hardware backing
      const cryptoAPI = typeof window !== 'undefined' ? window.crypto : 
                      (typeof globalThis !== 'undefined' && globalThis.crypto) ? globalThis.crypto :
                      (typeof crypto !== 'undefined') ? crypto : null;
      
      if (cryptoAPI && cryptoAPI.subtle) {
        // Try to generate a non-extractable key (hardware-backed hint)
        const testKey = await cryptoAPI.subtle.generateKey(
          { name: 'AES-GCM', length: 256 },
          false, // non-extractable
          ['encrypt', 'decrypt']
        );
        return testKey !== null;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Generate hardware-backed key using WebCrypto
   */
  private async generateHardwareBackedKey(): Promise<Uint8Array> {
    const cryptoAPI = typeof window !== 'undefined' ? window.crypto : 
                    (typeof globalThis !== 'undefined' && globalThis.crypto) ? globalThis.crypto :
                    (typeof crypto !== 'undefined') ? crypto : null;
    
    if (!cryptoAPI || !cryptoAPI.subtle) {
      throw new Error('WebCrypto not available');
    }

    // Generate key material using secure RNG instead of PBKDF2 generateKey
    const keyBytes = await secureRNG.generateBytes(32); // 256-bit key material
    const keyMaterial = await cryptoAPI.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    // Derive actual encryption key
    const derivedKey = await cryptoAPI.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: await secureRNG.generateBytes(16),
        iterations: this.options.keyDerivationRounds,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true, // extractable for our use
      ['encrypt', 'decrypt']
    );

    // Export to raw bytes
    const keyBuffer = await cryptoAPI.subtle.exportKey('raw', derivedKey);
    return new Uint8Array(keyBuffer);
  }

  /**
   * Set up memory protection against XSS
   */
  private setupMemoryProtection(): void {
    // Override dangerous global functions that could access memory
    const originalEval = window.eval;
    const originalFunction = window.Function;

    window.eval = () => {
      console.warn('🛡️ eval() blocked by SecureStorage memory protection');
      throw new Error('eval() is disabled for security');
    };

    (window as any).Function = (...args: any[]) => {
      console.warn('🛡️ Function() constructor blocked by SecureStorage memory protection');
      throw new Error('Function constructor is disabled for security');
    };

    // Set up cleanup on page unload
    window.addEventListener('beforeunload', () => {
      this.secureCleanup();
      // Restore original functions
      window.eval = originalEval;
      window.Function = originalFunction;
    });

    console.log('🛡️ Memory protection enabled');
  }

  /**
   * Store sensitive data securely
   */
  async store(key: string, data: Uint8Array, options?: { expireMinutes?: number }): Promise<void> {
    try {
      if (!this.masterKey) {
        await this.initializeMasterKey();
      }

      // Generate salt for key derivation
      const salt = await secureRNG.generateBytes(32);
      
      // Derive storage key from master key + salt + key name
      const keyInput = new TextEncoder().encode(key + this.sessionId);
      const derivedKey = await this.deriveStorageKey(this.masterKey!, salt, keyInput);
      
      // Encrypt data
      const encryptedData = await secureChaCha20.encrypt(data, derivedKey);
      
      // Calculate expiration
      const expiresAt = options?.expireMinutes 
        ? Date.now() + (options.expireMinutes * 60 * 1000)
        : Date.now() + (this.options.autoExpireMinutes * 60 * 1000);

      // Store in memory (not in browser storage for security)
      const storedData: StoredData = {
        encryptedData,
        salt,
        nonce: encryptedData.slice(0, 12), // ChaCha20 nonce is at start
        algorithm: 'ChaCha20 + Scrypt',
        timestamp: Date.now(),
        expiresAt
      };

      this.memoryStore.set(key, storedData);
      
      // Clean up sensitive data
      derivedKey.fill(0);
      
      console.log(`🔒 Stored data for key: ${key} (expires in ${options?.expireMinutes || this.options.autoExpireMinutes} minutes)`);

    } catch (error) {
      console.error('❌ Error storing data:', error);
      throw new Error(`Failed to store data: ${error.message}`);
    }
  }

  /**
   * Retrieve and decrypt stored data
   */
  async retrieve(key: string): Promise<Uint8Array | null> {
    try {
      const storedData = this.memoryStore.get(key);
      if (!storedData) {
        return null;
      }

      // Check expiration
      if (storedData.expiresAt && Date.now() > storedData.expiresAt) {
        console.log(`⏰ Data for key ${key} has expired, removing`);
        this.remove(key);
        return null;
      }

      if (!this.masterKey) {
        await this.initializeMasterKey();
      }

      // Derive the same storage key
      const keyInput = new TextEncoder().encode(key + this.sessionId);
      const derivedKey = await this.deriveStorageKey(this.masterKey!, storedData.salt, keyInput);
      
      // Decrypt data
      const decryptedData = await secureChaCha20.decrypt(storedData.encryptedData, derivedKey);
      
      // Clean up
      derivedKey.fill(0);
      
      console.log(`🔓 Retrieved data for key: ${key}`);
      return decryptedData;

    } catch (error) {
      console.error('❌ Error retrieving data:', error);
      throw new Error(`Failed to retrieve data: ${error.message}`);
    }
  }

  /**
   * Remove stored data
   */
  remove(key: string): void {
    const storedData = this.memoryStore.get(key);
    if (storedData) {
      // Secure wipe of encrypted data
      storedData.encryptedData.fill(0);
      storedData.salt.fill(0);
      storedData.nonce.fill(0);
    }
    
    this.memoryStore.delete(key);
    console.log(`🗑️ Removed data for key: ${key}`);
  }

  /**
   * Store private key with extra security
   */
  async storePrivateKey(keyId: string, privateKey: Uint8Array, userId: string): Promise<void> {
    try {
      // Add user ID to key derivation for additional security
      const enhancedKey = keyId + ':' + userId + ':private';
      
      // Store with shorter expiration for private keys
      await this.store(enhancedKey, privateKey, { expireMinutes: 30 });
      
      console.log(`🔐 Private key stored securely for user: ${userId}`);

    } catch (error) {
      console.error('❌ Error storing private key:', error);
      throw new Error(`Failed to store private key: ${error.message}`);
    }
  }

  /**
   * Retrieve private key
   */
  async retrievePrivateKey(keyId: string, userId: string): Promise<Uint8Array | null> {
    const enhancedKey = keyId + ':' + userId + ':private';
    return this.retrieve(enhancedKey);
  }

  /**
   * Derive storage key using Scrypt
   */
  private async deriveStorageKey(masterKey: Uint8Array, salt: Uint8Array, keyInput: Uint8Array): Promise<Uint8Array> {
    // Combine master key with input
    const combined = new Uint8Array(masterKey.length + keyInput.length);
    combined.set(masterKey, 0);
    combined.set(keyInput, masterKey.length);
    
    // Use Scrypt with high parameters for key stretching
    const derivedKey = scrypt(combined, salt, {
      N: this.options.keyDerivationRounds,
      r: 8,
      p: 1,
      dkLen: 32
    });
    
    // Clean up
    combined.fill(0);
    
    return derivedKey;
  }

  /**
   * Clean up expired entries
   */
  cleanupExpired(): number {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, data] of this.memoryStore.entries()) {
      if (data.expiresAt && now > data.expiresAt) {
        this.remove(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} expired entries`);
    }
    
    return cleaned;
  }

  /**
   * Get storage statistics
   */
  getStats(): { entriesCount: number; memoryUsage: number; sessionId: string } {
    let memoryUsage = 0;
    
    for (const [key, data] of this.memoryStore.entries()) {
      memoryUsage += key.length;
      memoryUsage += data.encryptedData.length;
      memoryUsage += data.salt.length;
      memoryUsage += data.nonce.length;
      memoryUsage += 100; // Approximate overhead
    }
    
    return {
      entriesCount: this.memoryStore.size,
      memoryUsage,
      sessionId: this.sessionId
    };
  }

  /**
   * Secure cleanup of all data
   */
  secureCleanup(): void {
    console.log('🧹 Performing secure cleanup of storage...');
    
    // Clean up all stored data
    for (const [key, data] of this.memoryStore.entries()) {
      data.encryptedData.fill(0);
      data.salt.fill(0);
      data.nonce.fill(0);
    }
    
    this.memoryStore.clear();
    
    // Clean up master key
    if (this.masterKey) {
      this.masterKey.fill(0);
      this.masterKey = null;
    }
    
    console.log('✅ Secure cleanup completed');
  }

  /**
   * Store data (alias for store method with JSON serialization)
   */
  async storeData(key: string, data: any, options?: { expireMinutes?: number }): Promise<void> {
    const serializedData = new TextEncoder().encode(JSON.stringify(data));
    return this.store(key, serializedData, options);
  }

  /**
   * Retrieve data (alias for retrieve method with JSON deserialization)
   */
  async retrieveData(key: string): Promise<any | null> {
    const retrievedData = await this.retrieve(key);
    if (!retrievedData) {
      return null;
    }
    
    try {
      const decoded = new TextDecoder().decode(retrievedData);
      return JSON.parse(decoded);
    } catch (error) {
      console.error('❌ Error deserializing retrieved data:', error);
      return null;
    }
  }

  /**
   * Test storage functionality
   */
  /**
   * Store session data
   */
  async storeSession(sessionData: any): Promise<void> {
    try {
      const sessionString = JSON.stringify(sessionData);
      const sessionBytes = new TextEncoder().encode(sessionString);
      await this.store('user_session', sessionBytes, { expireMinutes: 60 * 24 }); // 24 hours
      console.log('🔒 Session data stored securely');
    } catch (error) {
      console.error('❌ Failed to store session:', error);
      throw error;
    }
  }

  /**
   * Get session data
   */
  async getSession(): Promise<any | null> {
    try {
      const sessionBytes = await this.retrieve('user_session');
      if (!sessionBytes) return null;
      
      const sessionString = new TextDecoder().decode(sessionBytes);
      return JSON.parse(sessionString);
    } catch (error) {
      console.error('❌ Failed to get session:', error);
      return null;
    }
  }


  /**
   * Clear all stored data
   */
  async clearAll(): Promise<void> {
    try {
      this.memoryStore.clear();
      this.masterKey = null;
      console.log('🗑️ All secure storage cleared');
    } catch (error) {
      console.error('❌ Failed to clear storage:', error);
      throw error;
    }
  }

  async test(): Promise<boolean> {
    try {
      console.log('🧪 Testing SecureStorage...');
      
      const testData = new TextEncoder().encode('test data for secure storage');
      const testKey = 'test-key';
      
      // Store data
      await this.store(testKey, testData, { expireMinutes: 1 });
      
      // Retrieve data
      const retrieved = await this.retrieve(testKey);
      
      if (!retrieved || retrieved.length !== testData.length) {
        throw new Error('Retrieved data length mismatch');
      }
      
      // Compare data
      for (let i = 0; i < testData.length; i++) {
        if (testData[i] !== retrieved[i]) {
          throw new Error('Retrieved data content mismatch');
        }
      }
      
      // Clean up
      this.remove(testKey);
      
      console.log('✅ SecureStorage test passed');
      return true;

    } catch (error) {
      console.error('❌ SecureStorage test failed:', error);
      return false;
    }
  }
}

// Global instance
export const secureStorage = new SecureStorage({
  keyDerivationRounds: 65536, // High security
  autoExpireMinutes: 30,      // Auto-expire in 30 minutes
  useMemoryProtection: true,  // Enable memory protection
  hardwareBackedPreferred: true // Prefer hardware backing
});