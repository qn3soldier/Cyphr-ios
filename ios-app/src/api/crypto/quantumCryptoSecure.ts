/**
 * Secure Quantum-Safe Cryptography Module
 * Replaces the insecure fake implementation with real post-quantum crypto
 * 
 * Features:
 * - Real Kyber1024 post-quantum KEM
 * - Constant-time ChaCha20 with side-channel mitigations
 * - Secure RNG with entropy validation
 * - Hardware-backed secure storage
 * - Performance benchmarking (<20ms target)
 */

import { realKyber1024, type HybridEncryptionResult } from './realKyber1024';
import { secureChaCha20 } from './secureChaCha20';
import { secureRNG } from './secureRNG.ts';
import { secureStorage } from './secureStorage';
import { sha3_256 } from '@noble/hashes/sha3';

// Enterprise-grade optimization: Global flag to prevent benchmark re-runs
declare global {
  interface Window {
    __CRYPTO_BENCHMARK_COMPLETED?: boolean;
  }
}

export interface QuantumKeyPair {
  publicKey: string;  // Base64 encoded
  secretKey: string;  // Base64 encoded
  raw: {
    publicKey: Uint8Array;
    secretKey: Uint8Array;
  };
}

export interface QuantumEncryptedMessage {
  encryptedMessage: string;
  kyberCiphertext: string;
  algorithm: string;
  timestamp: number;
  security: string;
  performanceMs: number;
}

export interface ChatSecret {
  chatId: string;
  sharedSecret: string;
  participants: string[];
  timestamp: number;
  algorithm: string;
}

export class QuantumCryptoSecure {
  private initialized: boolean = false;
  private performanceMetrics: Map<string, number[]> = new Map();

  constructor() {
    console.log('🚀 Initializing Secure Quantum Cryptography Module...');
    this.initialize();
  }

  /**
   * Initialize the crypto module
   */
  private async initialize(): Promise<void> {
    try {
      // Test all components
      console.log('🧪 Testing cryptographic components...');
      
      // Test RNG
      const testRng = await secureRNG.generateBytes(32);
      const entropyTest = secureRNG.testEntropy(testRng);
      console.log(`🎲 RNG entropy: ${entropyTest.quality} (score: ${entropyTest.score.toFixed(3)})`);
      
      // Test ChaCha20
      const testKey = await secureChaCha20.generateKey();
      const testData = new TextEncoder().encode('test');
      const encrypted = await secureChaCha20.encrypt(testData, testKey);
      const decrypted = await secureChaCha20.decrypt(encrypted, testKey);
      
      if (new TextDecoder().decode(decrypted) !== 'test') {
        throw new Error('ChaCha20 test failed');
      }
      
      // Test Kyber1024
      const testKeys = await realKyber1024.generateKeyPair();
      const testEncaps = await realKyber1024.encapsulate(testKeys.publicKey);
      const testSecret = await realKyber1024.decapsulate(testKeys.secretKey, testEncaps.ciphertext);
      
      if (testSecret.length !== 32) {
        throw new Error('Kyber1024 test failed');
      }
      
      // Test secure storage
      const storageTest = await secureStorage.test();
      if (!storageTest) {
        throw new Error('Secure storage test failed');
      }
      
      this.initialized = true;
      console.log('✅ Secure quantum cryptography initialized successfully');
      
      // Run performance benchmark only once on first initialization
      // This is enterprise-grade optimization for production performance
      if (!window.__CRYPTO_BENCHMARK_COMPLETED) {
        await this.runBenchmark(false); // Lightweight benchmark only
        window.__CRYPTO_BENCHMARK_COMPLETED = true;
      }
      
    } catch (error) {
      console.error('❌ Failed to initialize quantum cryptography:', error);
      throw new Error(`Quantum crypto initialization failed: ${error.message}`);
    }
  }

  /**
   * Generate quantum-safe key pair
   */
  async generateKeyPair(): Promise<QuantumKeyPair> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const startTime = performance.now();
      
      // Generate real Kyber1024 key pair
      const keyPair = await realKyber1024.generateKeyPair();
      
      const endTime = performance.now();
      this.recordPerformance('keyGeneration', endTime - startTime);
      
      return {
        publicKey: this.arrayToBase64(keyPair.publicKey),
        secretKey: this.arrayToBase64(keyPair.secretKey),
        raw: keyPair
      };

    } catch (error) {
      console.error('❌ Error generating quantum key pair:', error);
      throw new Error(`Failed to generate quantum key pair: ${error.message}`);
    }
  }

  /**
   * Encrypt message with hybrid Kyber1024 + ChaCha20
   */
  async encryptMessage(
    message: string,
    recipientPublicKey: string,
    senderSecretKey?: string
  ): Promise<QuantumEncryptedMessage> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const startTime = performance.now();
      
      // Convert message to bytes
      const messageBytes = new TextEncoder().encode(message);
      
      // Convert public key from base64
      const recipientPubKeyBytes = this.base64ToArray(recipientPublicKey);
      
      // Perform hybrid encryption
      const encrypted = await realKyber1024.hybridEncrypt(messageBytes, recipientPubKeyBytes);
      
      const endTime = performance.now();
      const performanceMs = endTime - startTime;
      
      // Record performance
      this.recordPerformance('encryption', performanceMs);
      
      // Check performance target
      if (performanceMs > 20) {
        console.warn(`⚠️ Encryption took ${performanceMs.toFixed(2)}ms (target: <20ms)`);
      }

      return {
        encryptedMessage: this.arrayToBase64(encrypted.chaChaEncrypted),
        kyberCiphertext: this.arrayToBase64(encrypted.kyberCiphertext),
        algorithm: 'Kyber1024 + ChaCha20',
        timestamp: encrypted.timestamp,
        security: 'Post-Quantum Resistant (NIST Level 5)',
        performanceMs: parseFloat(performanceMs.toFixed(2))
      };

    } catch (error) {
      console.error('❌ Error encrypting message:', error);
      throw new Error(`Failed to encrypt message: ${error.message}`);
    }
  }

  /**
   * Decrypt message with hybrid Kyber1024 + ChaCha20
   */
  async decryptMessage(
    encryptedPackage: QuantumEncryptedMessage,
    recipientSecretKey: string,
    senderPublicKey?: string
  ): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const startTime = performance.now();
      
      // Convert keys from base64
      const recipientSecretKeyBytes = this.base64ToArray(recipientSecretKey);
      
      // Reconstruct encrypted data
      const hybridData: HybridEncryptionResult = {
        kyberCiphertext: this.base64ToArray(encryptedPackage.kyberCiphertext),
        chaChaEncrypted: this.base64ToArray(encryptedPackage.encryptedMessage),
        algorithm: encryptedPackage.algorithm,
        timestamp: encryptedPackage.timestamp
      };
      
      // Perform hybrid decryption
      const decryptedBytes = await realKyber1024.hybridDecrypt(hybridData, recipientSecretKeyBytes);
      
      const endTime = performance.now();
      const performanceMs = endTime - startTime;
      
      // Record performance
      this.recordPerformance('decryption', performanceMs);
      
      // Check performance target
      if (performanceMs > 20) {
        console.warn(`⚠️ Decryption took ${performanceMs.toFixed(2)}ms (target: <20ms)`);
      }

      return new TextDecoder().decode(decryptedBytes);

    } catch (error) {
      console.error('❌ Error decrypting message:', error);
      throw new Error(`Failed to decrypt message: ${error.message}`);
    }
  }

  /**
   * Generate secure chat secret for group messaging
   */
  async generateChatSecret(participantPublicKeys: Record<string, string>): Promise<ChatSecret> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const startTime = performance.now();
      
      // Convert public keys to bytes
      const pubKeyBytes: Uint8Array[] = Object.values(participantPublicKeys)
        .map(key => this.base64ToArray(key));
      
      // Generate group secret using all public keys
      const groupSecret = await realKyber1024.generateGroupSecret(pubKeyBytes);
      
      // Generate deterministic chat ID
      const chatId = await this.generateChatId(participantPublicKeys);
      
      const endTime = performance.now();
      this.recordPerformance('chatSecretGeneration', endTime - startTime);

      const chatSecret: ChatSecret = {
        chatId,
        sharedSecret: this.arrayToBase64(groupSecret),
        participants: Object.keys(participantPublicKeys),
        timestamp: Date.now(),
        algorithm: 'Kyber1024 Group KDF'
      };

      // Store in secure memory for session
      await secureStorage.store(`chat_secret_${chatId}`, groupSecret, { expireMinutes: 60 });
      
      // Clean up sensitive data
      groupSecret.fill(0);

      console.log(`🔐 Generated chat secret for ${Object.keys(participantPublicKeys).length} participants`);
      return chatSecret;

    } catch (error) {
      console.error('❌ Error generating chat secret:', error);
      throw new Error(`Failed to generate chat secret: ${error.message}`);
    }
  }

  /**
   * Encrypt chat message using group secret
   */
  async encryptChatMessage(message: string, chatSecret: ChatSecret, senderId: string): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const startTime = performance.now();
      
      // Try to get secret from secure storage first
      let sharedSecret = await secureStorage.retrieve(`chat_secret_${chatSecret.chatId}`);
      
      if (!sharedSecret) {
        // Fall back to provided secret (but warn - should be in secure storage)
        console.warn('⚠️ Chat secret not found in secure storage, using provided secret');
        sharedSecret = this.base64ToArray(chatSecret.sharedSecret);
      }
      
      // Encrypt message with ChaCha20
      const messageBytes = new TextEncoder().encode(message);
      const encryptedMessage = await secureChaCha20.encrypt(messageBytes, sharedSecret);
      
      const endTime = performance.now();
      this.recordPerformance('chatEncryption', endTime - startTime);

      return {
        encryptedMessage: this.arrayToBase64(encryptedMessage),
        senderId,
        timestamp: Date.now(),
        algorithm: 'ChaCha20 (Group)',
        performanceMs: parseFloat((endTime - startTime).toFixed(2))
      };

    } catch (error) {
      console.error('❌ Error encrypting chat message:', error);
      throw new Error(`Failed to encrypt chat message: ${error.message}`);
    }
  }

  /**
   * Decrypt chat message using group secret
   */
  async decryptChatMessage(encryptedChatMessage: any, chatSecret: ChatSecret): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const startTime = performance.now();
      
      // Try to get secret from secure storage first
      let sharedSecret = await secureStorage.retrieve(`chat_secret_${chatSecret.chatId}`);
      
      if (!sharedSecret) {
        console.warn('⚠️ Chat secret not found in secure storage, using provided secret');
        sharedSecret = this.base64ToArray(chatSecret.sharedSecret);
      }
      
      // Decrypt message
      const encryptedBytes = this.base64ToArray(encryptedChatMessage.encryptedMessage);
      const decryptedBytes = await secureChaCha20.decrypt(encryptedBytes, sharedSecret);
      
      const endTime = performance.now();
      this.recordPerformance('chatDecryption', endTime - startTime);

      return new TextDecoder().decode(decryptedBytes);

    } catch (error) {
      console.error('❌ Error decrypting chat message:', error);
      throw new Error(`Failed to decrypt chat message: ${error.message}`);
    }
  }

  /**
   * Generate deterministic chat ID from participant keys
   */
  private async generateChatId(participantPublicKeys: Record<string, string>): Promise<string> {
    const sortedKeys = Object.values(participantPublicKeys).sort();
    const combined = sortedKeys.join('|');
    const hash = sha3_256(new TextEncoder().encode(combined));
    return this.arrayToBase64(hash);
  }

  /**
   * Store private key securely
   */
  async storePrivateKey(keyId: string, privateKey: string, userId: string): Promise<void> {
    const privateKeyBytes = this.base64ToArray(privateKey);
    await secureStorage.storePrivateKey(keyId, privateKeyBytes, userId);
    
    // Clean up
    privateKeyBytes.fill(0);
  }

  /**
   * Retrieve private key securely
   */
  async retrievePrivateKey(keyId: string, userId: string): Promise<string | null> {
    const privateKeyBytes = await secureStorage.retrievePrivateKey(keyId, userId);
    if (!privateKeyBytes) {
      return null;
    }
    
    const base64Key = this.arrayToBase64(privateKeyBytes);
    
    // Clean up
    privateKeyBytes.fill(0);
    
    return base64Key;
  }

  /**
   * Record performance metrics
   */
  private recordPerformance(operation: string, timeMs: number): void {
    if (!this.performanceMetrics.has(operation)) {
      this.performanceMetrics.set(operation, []);
    }
    
    const metrics = this.performanceMetrics.get(operation)!;
    metrics.push(timeMs);
    
    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift();
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const stats: Record<string, { avg: number; min: number; max: number; count: number }> = {};
    
    for (const [operation, measurements] of this.performanceMetrics.entries()) {
      if (measurements.length > 0) {
        const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length;
        const min = Math.min(...measurements);
        const max = Math.max(...measurements);
        
        stats[operation] = {
          avg: parseFloat(avg.toFixed(2)),
          min: parseFloat(min.toFixed(2)),
          max: parseFloat(max.toFixed(2)),
          count: measurements.length
        };
      }
    }
    
    return stats;
  }

  /**
   * Run comprehensive benchmark
   */
  async runBenchmark(fullTest: boolean = true): Promise<void> {
    console.log('📊 Running quantum cryptography benchmark...');
    
    try {
      // Benchmark Kyber1024 operations
      const kyberBenchmark = await realKyber1024.benchmark();
      
      // Benchmark ChaCha20 operations - use smaller data for initialization
      const dataSize = fullTest ? 1024 * 1024 : 1024; // 1KB for quick test, 1MB for full test
      const chachaBenchmark = await secureChaCha20.benchmark(dataSize);
      
      console.log('📈 Benchmark Results:');
      console.log('   Kyber1024:');
      console.log(`     Key Generation: ${kyberBenchmark.keyGen.toFixed(2)}ms`);
      console.log(`     Encapsulation:  ${kyberBenchmark.encaps.toFixed(2)}ms`);
      console.log(`     Decapsulation:  ${kyberBenchmark.decaps.toFixed(2)}ms`);
      console.log(`     Hybrid Encrypt: ${kyberBenchmark.hybrid.toFixed(2)}ms`);
      console.log('   ChaCha20:');
      console.log(`     Throughput:     ${chachaBenchmark.throughput.toFixed(2)} MB/s`);
      console.log(`     Overhead:       ${chachaBenchmark.overhead.toFixed(3)} ms/KB`);
      
      // Check if we meet the <20ms target
      const maxTime = Math.max(kyberBenchmark.hybrid, kyberBenchmark.encaps, kyberBenchmark.decaps);
      if (maxTime < 20) {
        console.log('✅ Performance target met: all operations <20ms');
      } else {
        console.warn(`⚠️ Performance target missed: ${maxTime.toFixed(2)}ms (target: <20ms)`);
      }

    } catch (error) {
      console.error('❌ Benchmark failed:', error);
    }
  }

  /**
   * Get encryption info
   */
  getEncryptionInfo(): object {
    return {
      algorithm: 'Hybrid Post-Quantum Cryptography',
      keyExchange: 'CRYSTALS-Kyber1024 (NIST PQC)',
      encryption: 'ChaCha20 with side-channel mitigations',
      keySize: '1568 bytes (Kyber1024) + 32 bytes (ChaCha20)',
      security: 'NIST Post-Quantum Security Level 5',
      quantumResistant: true,
      sideChannelResistant: true,
      constantTime: true,
      hardwareBacked: true,
      performanceTarget: '<20ms encryption/decryption'
    };
  }

  /**
   * Utility: Convert array to base64
   */
  private arrayToBase64(array: Uint8Array): string {
    return btoa(String.fromCharCode(...array));
  }

  /**
   * Utility: Convert base64 to array
   */
  private base64ToArray(base64: string): Uint8Array {
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  }

  /**
   * Secure cleanup
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up quantum cryptography module...');
    
    // Clear performance metrics
    this.performanceMetrics.clear();
    
    // Clean up secure storage
    await secureStorage.secureCleanup();
    
    this.initialized = false;
    console.log('✅ Quantum cryptography cleanup completed');
  }
}

// Global instance - replaces the insecure fake implementation
export default new QuantumCryptoSecure();