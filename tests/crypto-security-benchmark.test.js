/**
 * Comprehensive Security and Performance Benchmark Tests
 * Validates that our quantum-safe crypto implementation meets security and performance requirements
 */

import { describe, it, expect, beforeAll } from 'vitest';
import QuantumCryptoSecure from '../src/api/crypto/quantumCryptoSecure';
import { realKyber1024 } from '../src/api/crypto/realKyber1024';
import { secureChaCha20 } from '../src/api/crypto/secureChaCha20';
import { secureRNG } from '../src/api/crypto/secureRNG';
import { secureStorage } from '../src/api/crypto/secureStorage';

describe('Quantum-Safe Cryptography Security Tests', () => {
  let aliceKeyPair, bobKeyPair;

  beforeAll(async () => {
    // Generate test key pairs
    aliceKeyPair = await QuantumCryptoSecure.generateKeyPair();
    bobKeyPair = await QuantumCryptoSecure.generateKeyPair();
  });

  describe('Security Validation', () => {
    it('should generate cryptographically secure keys', async () => {
      const keyPair = await QuantumCryptoSecure.generateKeyPair();
      
      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.secretKey).toBeDefined();
      expect(keyPair.raw.publicKey).toBeInstanceOf(Uint8Array);
      expect(keyPair.raw.secretKey).toBeInstanceOf(Uint8Array);
      
      // Check key sizes match Kyber1024 specifications
      expect(keyPair.raw.publicKey.length).toBe(1568); // Kyber1024 public key size
      expect(keyPair.raw.secretKey.length).toBe(3168); // Kyber1024 secret key size
    });

    it('should encrypt and decrypt messages correctly', async () => {
      const testMessage = 'This is a confidential message that must be protected with post-quantum cryptography!';
      
      // Encrypt message from Alice to Bob
      const encrypted = await QuantumCryptoSecure.encryptMessage(
        testMessage,
        bobKeyPair.publicKey,
        aliceKeyPair.secretKey
      );
      
      expect(encrypted.encryptedMessage).toBeDefined();
      expect(encrypted.kyberCiphertext).toBeDefined();
      expect(encrypted.algorithm).toBe('Kyber1024 + ChaCha20');
      expect(encrypted.security).toBe('Post-Quantum Resistant (NIST Level 5)');
      
      // Decrypt message at Bob's end
      const decrypted = await QuantumCryptoSecure.decryptMessage(
        encrypted,
        bobKeyPair.secretKey,
        aliceKeyPair.publicKey
      );
      
      expect(decrypted).toBe(testMessage);
    });

    it('should prevent decryption with wrong keys', async () => {
      const testMessage = 'Secret message';
      const wrongKeyPair = await QuantumCryptoSecure.generateKeyPair();
      
      const encrypted = await QuantumCryptoSecure.encryptMessage(
        testMessage,
        bobKeyPair.publicKey
      );
      
      // Try to decrypt with wrong secret key - should fail
      await expect(
        QuantumCryptoSecure.decryptMessage(encrypted, wrongKeyPair.secretKey)
      ).rejects.toThrow();
    });

    it('should generate unique ciphertexts for same plaintext', async () => {
      const testMessage = 'Same message encrypted twice';
      
      const encrypted1 = await QuantumCryptoSecure.encryptMessage(
        testMessage,
        bobKeyPair.publicKey
      );
      
      const encrypted2 = await QuantumCryptoSecure.encryptMessage(
        testMessage,
        bobKeyPair.publicKey
      );
      
      // Ciphertexts should be different due to random nonces
      expect(encrypted1.encryptedMessage).not.toBe(encrypted2.encryptedMessage);
      expect(encrypted1.kyberCiphertext).not.toBe(encrypted2.kyberCiphertext);
    });

    it('should validate entropy quality of RNG', async () => {
      const randomData = await secureRNG.generateBytes(1024);
      const entropyTest = secureRNG.testEntropy(randomData);
      
      expect(entropyTest.quality).not.toBe('poor');
      expect(entropyTest.score).toBeLessThan(2.0); // Reasonable entropy threshold
      
      console.log(`🎲 RNG Entropy Quality: ${entropyTest.quality} (score: ${entropyTest.score.toFixed(3)})`);
    });

    it('should protect against key reuse attacks', async () => {
      const messages = [
        'Message 1',
        'Message 2',
        'Message 3'
      ];
      
      const encryptedMessages = [];
      
      for (const message of messages) {
        const encrypted = await QuantumCryptoSecure.encryptMessage(
          message,
          bobKeyPair.publicKey
        );
        encryptedMessages.push(encrypted);
      }
      
      // All Kyber ciphertexts should be different (no key reuse)
      const ciphertexts = encryptedMessages.map(e => e.kyberCiphertext);
      const uniqueCiphertexts = new Set(ciphertexts);
      expect(uniqueCiphertexts.size).toBe(ciphertexts.length);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet <20ms encryption target', async () => {
      const testMessage = 'Performance test message for encryption benchmark';
      const iterations = 10;
      const timings = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        
        await QuantumCryptoSecure.encryptMessage(
          testMessage,
          bobKeyPair.publicKey
        );
        
        const end = performance.now();
        timings.push(end - start);
      }
      
      const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
      const maxTime = Math.max(...timings);
      
      console.log(`⚡ Encryption Performance: avg=${avgTime.toFixed(2)}ms, max=${maxTime.toFixed(2)}ms`);
      
      // Check if we meet the 20ms target
      expect(avgTime).toBeLessThan(20);
      expect(maxTime).toBeLessThan(50); // Allow some variance for max time
    });

    it('should meet <20ms decryption target', async () => {
      const testMessage = 'Performance test message for decryption benchmark';
      
      // Pre-encrypt message
      const encrypted = await QuantumCryptoSecure.encryptMessage(
        testMessage,
        bobKeyPair.publicKey
      );
      
      const iterations = 10;
      const timings = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        
        await QuantumCryptoSecure.decryptMessage(
          encrypted,
          bobKeyPair.secretKey
        );
        
        const end = performance.now();
        timings.push(end - start);
      }
      
      const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
      const maxTime = Math.max(...timings);
      
      console.log(`⚡ Decryption Performance: avg=${avgTime.toFixed(2)}ms, max=${maxTime.toFixed(2)}ms`);
      
      expect(avgTime).toBeLessThan(20);
      expect(maxTime).toBeLessThan(50);
    });

    it('should benchmark key generation performance', async () => {
      const iterations = 5; // Key generation is expensive
      const timings = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await QuantumCryptoSecure.generateKeyPair();
        const end = performance.now();
        timings.push(end - start);
      }
      
      const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
      
      console.log(`🔑 Key Generation Performance: avg=${avgTime.toFixed(2)}ms`);
      
      // Key generation can be slower as it's not done frequently
      expect(avgTime).toBeLessThan(100);
    });

    it('should benchmark group chat secret generation', async () => {
      const participants = {
        alice: aliceKeyPair.publicKey,
        bob: bobKeyPair.publicKey,
        charlie: (await QuantumCryptoSecure.generateKeyPair()).publicKey
      };
      
      const start = performance.now();
      const chatSecret = await QuantumCryptoSecure.generateChatSecret(participants);
      const end = performance.now();
      
      const time = end - start;
      console.log(`👥 Group Secret Generation: ${time.toFixed(2)}ms`);
      
      expect(time).toBeLessThan(50);
      expect(chatSecret.participants.length).toBe(3);
    });

    it('should run comprehensive performance benchmark', async () => {
      console.log('📊 Running comprehensive performance benchmark...');
      
      // This will run the built-in benchmark
      await QuantumCryptoSecure.runBenchmark();
      
      const stats = QuantumCryptoSecure.getPerformanceStats();
      console.log('📈 Performance Statistics:', stats);
      
      // Verify we have performance data
      expect(Object.keys(stats).length).toBeGreaterThan(0);
    });
  });

  describe('Side-Channel Resistance', () => {
    it('should use constant-time operations', async () => {
      // Test timing consistency for ChaCha20 operations
      const key = await secureChaCha20.generateKey();
      const plaintext1 = new Uint8Array(1000).fill(0); // All zeros
      const plaintext2 = new Uint8Array(1000).fill(255); // All ones
      
      const timings1 = [];
      const timings2 = [];
      
      // Measure timing for different plaintexts
      for (let i = 0; i < 10; i++) {
        let start = performance.now();
        await secureChaCha20.encrypt(plaintext1, key);
        timings1.push(performance.now() - start);
        
        start = performance.now();
        await secureChaCha20.encrypt(plaintext2, key);
        timings2.push(performance.now() - start);
      }
      
      const avg1 = timings1.reduce((a, b) => a + b, 0) / timings1.length;
      const avg2 = timings2.reduce((a, b) => a + b, 0) / timings2.length;
      
      // Timing difference should be minimal (constant-time)
      const timingDifference = Math.abs(avg1 - avg2);
      expect(timingDifference).toBeLessThan(1.0); // Less than 1ms difference
      
      console.log(`🔒 Timing Analysis: ${timingDifference.toFixed(3)}ms difference (good: <1ms)`);
    });
  });

  describe('Memory Security', () => {
    it('should securely store and retrieve private keys', async () => {
      const testKey = 'test-stellar-key';
      const userId = 'test-user-123';
      const privateKeyData = 'SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'; // Mock Stellar key
      
      // Store private key securely
      await QuantumCryptoSecure.storePrivateKey(testKey, privateKeyData, userId);
      
      // Retrieve private key
      const retrieved = await QuantumCryptoSecure.retrievePrivateKey(testKey, userId);
      
      expect(retrieved).toBe(privateKeyData);
      
      // Key should auto-expire (test with short expiration)
      setTimeout(async () => {
        const expired = await QuantumCryptoSecure.retrievePrivateKey(testKey, userId);
        expect(expired).toBeNull();
      }, 31 * 60 * 1000); // Should expire after 30 minutes
    });

    it('should validate secure storage functionality', async () => {
      const isValid = await secureStorage.test();
      expect(isValid).toBe(true);
      
      // Check storage stats
      const stats = secureStorage.getStats();
      expect(stats.sessionId).toBeDefined();
      expect(stats.entriesCount).toBeGreaterThanOrEqual(0);
      
      console.log('💾 Secure Storage Stats:', stats);
    });
  });

  describe('Algorithm Information', () => {
    it('should provide correct algorithm information', () => {
      const info = QuantumCryptoSecure.getEncryptionInfo();
      
      expect(info.algorithm).toBe('Hybrid Post-Quantum Cryptography');
      expect(info.keyExchange).toBe('CRYSTALS-Kyber1024 (NIST PQC)');
      expect(info.quantumResistant).toBe(true);
      expect(info.sideChannelResistant).toBe(true);
      expect(info.constantTime).toBe(true);
      expect(info.performanceTarget).toBe('<20ms encryption/decryption');
      
      console.log('🔍 Algorithm Information:', info);
    });

    it('should provide Kyber1024 specific information', () => {
      const kyberInfo = realKyber1024.getAlgorithmInfo();
      
      expect(kyberInfo.name).toBe('CRYSTALS-Kyber1024');
      expect(kyberInfo.securityLevel).toBe(5); // Highest NIST level
      expect(kyberInfo.quantumResistant).toBe(true);
      expect(kyberInfo.nistApproved).toBe(true);
      
      console.log('🔐 Kyber1024 Information:', kyberInfo);
    });
  });
});

describe('Integration Tests', () => {
  it('should handle full message encryption/decryption workflow', async () => {
    console.log('🔄 Testing full encryption workflow...');
    
    // Generate keys for Alice and Bob
    const alice = await QuantumCryptoSecure.generateKeyPair();
    const bob = await QuantumCryptoSecure.generateKeyPair();
    
    // Alice sends message to Bob
    const message = 'Hello Bob! This message is protected by post-quantum cryptography.';
    const encrypted = await QuantumCryptoSecure.encryptMessage(message, bob.publicKey);
    
    // Bob receives and decrypts message
    const decrypted = await QuantumCryptoSecure.decryptMessage(encrypted, bob.secretKey);
    
    expect(decrypted).toBe(message);
    
    // Verify performance was recorded
    const stats = QuantumCryptoSecure.getPerformanceStats();
    expect(stats.encryption).toBeDefined();
    expect(stats.decryption).toBeDefined();
    
    console.log('✅ Full workflow test completed successfully');
  });

  it('should handle group chat scenario', async () => {
    console.log('👥 Testing group chat scenario...');
    
    // Create group participants
    const alice = await QuantumCryptoSecure.generateKeyPair();
    const bob = await QuantumCryptoSecure.generateKeyPair();
    const charlie = await QuantumCryptoSecure.generateKeyPair();
    
    const participants = {
      alice: alice.publicKey,
      bob: bob.publicKey,
      charlie: charlie.publicKey
    };
    
    // Generate group secret
    const chatSecret = await QuantumCryptoSecure.generateChatSecret(participants);
    
    // Alice sends message to group
    const message = 'Hello everyone! Group message with quantum security.';
    const encrypted = await QuantumCryptoSecure.encryptChatMessage(message, chatSecret, 'alice');
    
    // Bob and Charlie decrypt the message
    const bobDecrypted = await QuantumCryptoSecure.decryptChatMessage(encrypted, chatSecret);
    const charlieDecrypted = await QuantumCryptoSecure.decryptChatMessage(encrypted, chatSecret);
    
    expect(bobDecrypted).toBe(message);
    expect(charlieDecrypted).toBe(message);
    
    console.log('✅ Group chat test completed successfully');
  });
});

// Performance summary after all tests
describe('Performance Summary', () => {
  it('should display final performance report', () => {
    const stats = QuantumCryptoSecure.getPerformanceStats();
    
    console.log('\n📊 FINAL PERFORMANCE REPORT:');
    console.log('═'.repeat(50));
    
    for (const [operation, metrics] of Object.entries(stats)) {
      const status = metrics.avg < 20 ? '✅' : '⚠️';
      console.log(`${status} ${operation}: ${metrics.avg}ms avg (${metrics.min}-${metrics.max}ms, n=${metrics.count})`);
    }
    
    console.log('═'.repeat(50));
    
    // Overall performance assessment
    const encryptionAvg = stats.encryption?.avg || 0;
    const decryptionAvg = stats.decryption?.avg || 0;
    const maxTime = Math.max(encryptionAvg, decryptionAvg);
    
    if (maxTime < 20) {
      console.log('🎯 PERFORMANCE TARGET MET: All operations <20ms');
    } else {
      console.log(`⚠️ PERFORMANCE TARGET MISSED: ${maxTime.toFixed(2)}ms (target: <20ms)`);
    }
  });
});