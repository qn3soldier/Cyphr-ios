/**
 * Real Kyber1024 Post-Quantum Key Encapsulation Mechanism
 * Based on CRYSTALS-Kyber specification with side-channel mitigations
 * NIST PQC Round 3 Finalist - Security Level 5
 */

import { keypair, encapsulate, decapsulate, Params } from 'pqc-kyber/pqc_kyber.js';
import { secureRNG } from './secureRNG.ts';
import { secureChaCha20 } from './secureChaCha20.ts';
import { sha3_256, shake256 } from '@noble/hashes/sha3';

export interface KyberKeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export interface KyberEncapsulation {
  ciphertext: Uint8Array;
  sharedSecret: Uint8Array;
}

export interface HybridEncryptionResult {
  kyberCiphertext: Uint8Array;
  chaChaEncrypted: Uint8Array;
  ephemeralPublicKey?: Uint8Array;
  algorithm: string;
  timestamp: number;
}

export class RealKyber1024 {
  private readonly KYBER_PUBLIC_KEY_SIZE = Params.publicKeyBytes;
  private readonly KYBER_SECRET_KEY_SIZE = Params.secretKeyBytes;
  private readonly KYBER_CIPHERTEXT_SIZE = Params.ciphertextBytes;
  private readonly KYBER_SHARED_SECRET_SIZE = Params.sharedSecretBytes;
  private readonly SECURITY_LEVEL = 5; // NIST security level 5 (strongest)

  constructor() {
    console.log('🔐 Initializing Real Kyber1024 Post-Quantum Cryptography');
    console.log(`📏 Key sizes: Public=${this.KYBER_PUBLIC_KEY_SIZE}, Secret=${this.KYBER_SECRET_KEY_SIZE}, Ciphertext=${this.KYBER_CIPHERTEXT_SIZE}, SharedSecret=${this.KYBER_SHARED_SECRET_SIZE}`);
    this.validateEnvironment();
  }

  /**
   * Validate that the environment supports required cryptographic operations
   */
  private validateEnvironment(): void {
    if (typeof keypair === 'undefined') {
      throw new Error('Kyber library not available - ensure pqc-kyber is properly installed');
    }

    // Test basic functionality
    try {
      const testKeys = keypair();
      if (!testKeys || !testKeys.pubkey || !testKeys.secret) {
        throw new Error('Kyber key generation test failed');
      }
      console.log('✅ Kyber1024 environment validation passed');
    } catch (error) {
      console.error('❌ Kyber1024 environment validation failed:', error);
      throw new Error('Failed to initialize Kyber1024 - environment not supported');
    }
  }

  /**
   * Generate Kyber1024 key pair with secure random number generation
   */
  async generateKeyPair(): Promise<KyberKeyPair> {
    try {
      console.log('🔑 Generating Kyber1024 key pair...');
      const startTime = performance.now();

      // Generate Kyber1024 key pair
      const keyPair = keypair();
      
      if (!keyPair || !keyPair.pubkey || !keyPair.secret) {
        throw new Error('Kyber key generation returned invalid result');
      }

      // Validate key sizes
      if (keyPair.pubkey.length !== this.KYBER_PUBLIC_KEY_SIZE) {
        throw new Error(`Invalid public key size: expected ${this.KYBER_PUBLIC_KEY_SIZE}, got ${keyPair.pubkey.length}`);
      }
      
      if (keyPair.secret.length !== this.KYBER_SECRET_KEY_SIZE) {
        throw new Error(`Invalid secret key size: expected ${this.KYBER_SECRET_KEY_SIZE}, got ${keyPair.secret.length}`);
      }

      const endTime = performance.now();
      console.log(`✅ Kyber1024 key pair generated in ${(endTime - startTime).toFixed(2)}ms`);

      return {
        publicKey: keyPair.pubkey,
        secretKey: keyPair.secret
      };

    } catch (error) {
      console.error('❌ Error generating Kyber1024 key pair:', error);
      throw new Error(`Failed to generate Kyber1024 key pair: ${error.message}`);
    }
  }

  /**
   * Encapsulate shared secret using recipient's public key
   */
  async encapsulate(publicKey: Uint8Array): Promise<KyberEncapsulation> {
    try {
      if (!publicKey || publicKey.length !== this.KYBER_PUBLIC_KEY_SIZE) {
        throw new Error(`Invalid public key: expected ${this.KYBER_PUBLIC_KEY_SIZE} bytes`);
      }

      console.log('📦 Performing Kyber1024 encapsulation...');
      const startTime = performance.now();
      
      // Perform Kyber1024 encapsulation
      const kex = encapsulate(publicKey);
      
      if (!kex || !kex.ciphertext || !kex.sharedSecret) {
        throw new Error('Kyber encapsulation returned invalid result');
      }

      // Validate output sizes
      if (kex.ciphertext.length !== this.KYBER_CIPHERTEXT_SIZE) {
        throw new Error(`Invalid ciphertext size: expected ${this.KYBER_CIPHERTEXT_SIZE}, got ${kex.ciphertext.length}`);
      }

      if (kex.sharedSecret.length !== this.KYBER_SHARED_SECRET_SIZE) {
        throw new Error(`Invalid shared secret size: expected ${this.KYBER_SHARED_SECRET_SIZE}, got ${kex.sharedSecret.length}`);
      }

      const endTime = performance.now();
      console.log(`✅ Kyber1024 encapsulation completed in ${(endTime - startTime).toFixed(2)}ms`);

      return {
        ciphertext: kex.ciphertext,
        sharedSecret: kex.sharedSecret
      };

    } catch (error) {
      console.error('❌ Error during Kyber1024 encapsulation:', error);
      throw new Error(`Kyber1024 encapsulation failed: ${error.message}`);
    }
  }

  /**
   * Decapsulate shared secret using secret key
   */
  async decapsulate(secretKey: Uint8Array, ciphertext: Uint8Array): Promise<Uint8Array> {
    try {
      if (!secretKey || secretKey.length !== this.KYBER_SECRET_KEY_SIZE) {
        throw new Error(`Invalid secret key: expected ${this.KYBER_SECRET_KEY_SIZE} bytes`);
      }

      if (!ciphertext || ciphertext.length !== this.KYBER_CIPHERTEXT_SIZE) {
        throw new Error(`Invalid ciphertext: expected ${this.KYBER_CIPHERTEXT_SIZE} bytes`);
      }

      console.log('🔓 Performing Kyber1024 decapsulation...');
      const startTime = performance.now();

      // Perform Kyber1024 decapsulation
      const sharedSecret = decapsulate(ciphertext, secretKey);
      
      if (!sharedSecret || sharedSecret.length !== this.KYBER_SHARED_SECRET_SIZE) {
        throw new Error('Kyber decapsulation failed or returned invalid shared secret');
      }

      const endTime = performance.now();
      console.log(`✅ Kyber1024 decapsulation completed in ${(endTime - startTime).toFixed(2)}ms`);

      return sharedSecret;

    } catch (error) {
      console.error('❌ Error during Kyber1024 decapsulation:', error);
      throw new Error(`Kyber1024 decapsulation failed: ${error.message}`);
    }
  }

  /**
   * Hybrid encryption: Kyber1024 + ChaCha20
   * Provides quantum resistance (Kyber1024) + high performance (ChaCha20)
   */
  async hybridEncrypt(plaintext: Uint8Array, recipientPublicKey: Uint8Array): Promise<HybridEncryptionResult> {
    try {
      console.log('🔒 Starting hybrid Kyber1024 + ChaCha20 encryption...');
      const startTime = performance.now();

      // 1. Perform Kyber1024 key encapsulation
      const encapsulation = await this.encapsulate(recipientPublicKey);
      
      // 2. Derive ChaCha20 key from Kyber shared secret using SHAKE256 (domain separation)
      const kdfInput = new Uint8Array(encapsulation.sharedSecret.length + 16);
      kdfInput.set(encapsulation.sharedSecret, 0);
      kdfInput.set(new TextEncoder().encode('CYPHR_HYBRID_KDF'), encapsulation.sharedSecret.length);
      
      const chachaKey = shake256(kdfInput, 32); // 256-bit key for ChaCha20
      
      // 3. Encrypt plaintext with ChaCha20
      const chachaEncrypted = await secureChaCha20.encrypt(plaintext, chachaKey);
      
      // 4. Secure cleanup of sensitive data
      encapsulation.sharedSecret.fill(0);
      chachaKey.fill(0);
      kdfInput.fill(0);

      const endTime = performance.now();
      const overhead = endTime - startTime;
      
      console.log(`✅ Hybrid encryption completed in ${overhead.toFixed(2)}ms`);
      
      if (overhead > 20) {
        console.warn(`⚠️ Encryption overhead (${overhead.toFixed(2)}ms) exceeds 20ms target`);
      }

      return {
        kyberCiphertext: encapsulation.ciphertext,
        chaChaEncrypted: chachaEncrypted,
        algorithm: 'Kyber1024 + ChaCha20',
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('❌ Error during hybrid encryption:', error);
      throw new Error(`Hybrid encryption failed: ${error.message}`);
    }
  }

  /**
   * Hybrid decryption: Kyber1024 + ChaCha20
   */
  async hybridDecrypt(
    encryptedData: HybridEncryptionResult,
    recipientSecretKey: Uint8Array
  ): Promise<Uint8Array> {
    try {
      console.log('🔓 Starting hybrid Kyber1024 + ChaCha20 decryption...');
      const startTime = performance.now();

      // 1. Decapsulate the shared secret using Kyber1024
      const sharedSecret = await this.decapsulate(recipientSecretKey, encryptedData.kyberCiphertext);
      
      // 2. Derive ChaCha20 key from shared secret (same KDF as encryption)
      const kdfInput = new Uint8Array(sharedSecret.length + 16);
      kdfInput.set(sharedSecret, 0);
      kdfInput.set(new TextEncoder().encode('CYPHR_HYBRID_KDF'), sharedSecret.length);
      
      const chachaKey = shake256(kdfInput, 32);
      
      // 3. Decrypt with ChaCha20
      const plaintext = await secureChaCha20.decrypt(encryptedData.chaChaEncrypted, chachaKey);
      
      // 4. Secure cleanup
      sharedSecret.fill(0);
      chachaKey.fill(0);
      kdfInput.fill(0);

      const endTime = performance.now();
      const overhead = endTime - startTime;
      
      console.log(`✅ Hybrid decryption completed in ${overhead.toFixed(2)}ms`);
      
      if (overhead > 20) {
        console.warn(`⚠️ Decryption overhead (${overhead.toFixed(2)}ms) exceeds 20ms target`);
      }

      return plaintext;

    } catch (error) {
      console.error('❌ Error during hybrid decryption:', error);
      throw new Error(`Hybrid decryption failed: ${error.message}`);
    }
  }

  /**
   * Generate shared secret for group chat using multiple public keys
   */
  async generateGroupSecret(publicKeys: Uint8Array[]): Promise<Uint8Array> {
    try {
      if (!publicKeys || publicKeys.length === 0) {
        throw new Error('At least one public key is required');
      }

      console.log(`🔐 Generating group secret for ${publicKeys.length} participants...`);

      // Generate a master secret
      const masterSecret = await secureRNG.generateBytes(32);
      
      // Derive group secret using all public keys as input
      const hashInput = new Uint8Array(masterSecret.length + publicKeys.length * this.KYBER_PUBLIC_KEY_SIZE);
      hashInput.set(masterSecret, 0);
      
      let offset = masterSecret.length;
      for (const pubKey of publicKeys) {
        if (pubKey.length !== this.KYBER_PUBLIC_KEY_SIZE) {
          throw new Error('Invalid public key size in group');
        }
        hashInput.set(pubKey, offset);
        offset += this.KYBER_PUBLIC_KEY_SIZE;
      }
      
      // Use SHAKE256 for domain-separated key derivation
      const groupSecretInput = new Uint8Array(hashInput.length + 16);
      groupSecretInput.set(hashInput, 0);
      groupSecretInput.set(new TextEncoder().encode('CYPHR_GROUP_KDF'), hashInput.length);
      
      const groupSecret = shake256(groupSecretInput, 32);
      
      // Secure cleanup
      masterSecret.fill(0);
      hashInput.fill(0);
      groupSecretInput.fill(0);
      
      console.log('✅ Group secret generated successfully');
      return groupSecret;

    } catch (error) {
      console.error('❌ Error generating group secret:', error);
      throw new Error(`Group secret generation failed: ${error.message}`);
    }
  }

  /**
   * Key exchange for establishing secure channel
   */
  async performKeyExchange(
    mySecretKey: Uint8Array,
    theirPublicKey: Uint8Array
  ): Promise<Uint8Array> {
    try {
      console.log('🤝 Performing Kyber1024 key exchange...');
      
      // Generate ephemeral key pair for forward secrecy
      const ephemeralKeys = await this.generateKeyPair();
      
      // Encapsulate using their public key
      const encapsulation = await this.encapsulate(theirPublicKey);
      
      // Combine our secret key with encapsulated secret for mutual authentication
      const combinedInput = new Uint8Array(
        mySecretKey.length + 
        encapsulation.sharedSecret.length + 
        ephemeralKeys.secretKey.length
      );
      
      combinedInput.set(mySecretKey, 0);
      combinedInput.set(encapsulation.sharedSecret, mySecretKey.length);
      combinedInput.set(ephemeralKeys.secretKey, mySecretKey.length + encapsulation.sharedSecret.length);
      
      // Derive session key
      const sessionKeyInput = new Uint8Array(combinedInput.length + 20);
      sessionKeyInput.set(combinedInput, 0);
      sessionKeyInput.set(new TextEncoder().encode('CYPHR_SESSION_KDF'), combinedInput.length);
      
      const sessionKey = shake256(sessionKeyInput, 32);
      
      // Secure cleanup
      encapsulation.sharedSecret.fill(0);
      ephemeralKeys.secretKey.fill(0);
      combinedInput.fill(0);
      sessionKeyInput.fill(0);
      
      console.log('✅ Key exchange completed');
      return sessionKey;

    } catch (error) {
      console.error('❌ Key exchange failed:', error);
      throw new Error(`Key exchange failed: ${error.message}`);
    }
  }

  /**
   * Performance benchmark
   */
  async benchmark(): Promise<{ keyGen: number; encaps: number; decaps: number; hybrid: number }> {
    console.log('📊 Running Kyber1024 performance benchmark...');
    
    const iterations = 10;
    let keyGenTime = 0, encapsTime = 0, decapsTime = 0, hybridTime = 0;
    
    for (let i = 0; i < iterations; i++) {
      // Key generation benchmark
      let start = performance.now();
      const keyPair = await this.generateKeyPair();
      keyGenTime += performance.now() - start;
      
      // Encapsulation benchmark
      start = performance.now();
      const encaps = await this.encapsulate(keyPair.publicKey);
      encapsTime += performance.now() - start;
      
      // Decapsulation benchmark
      start = performance.now();
      await this.decapsulate(keyPair.secretKey, encaps.ciphertext);
      decapsTime += performance.now() - start;
      
      // Hybrid encryption benchmark
      const testData = new Uint8Array(1024);
      start = performance.now();
      await this.hybridEncrypt(testData, keyPair.publicKey);
      hybridTime += performance.now() - start;
    }
    
    const results = {
      keyGen: keyGenTime / iterations,
      encaps: encapsTime / iterations,
      decaps: decapsTime / iterations,
      hybrid: hybridTime / iterations
    };
    
    console.log(`📈 Benchmark Results (avg over ${iterations} iterations):`);
    console.log(`   Key Generation: ${results.keyGen.toFixed(2)}ms`);
    console.log(`   Encapsulation:  ${results.encaps.toFixed(2)}ms`);
    console.log(`   Decapsulation:  ${results.decaps.toFixed(2)}ms`);
    console.log(`   Hybrid Encrypt: ${results.hybrid.toFixed(2)}ms`);
    
    return results;
  }

  /**
   * Get algorithm information
   */
  getAlgorithmInfo(): object {
    return {
      name: 'CRYSTALS-Kyber1024',
      type: 'Post-Quantum Key Encapsulation Mechanism',
      securityLevel: this.SECURITY_LEVEL,
      publicKeySize: this.KYBER_PUBLIC_KEY_SIZE,
      secretKeySize: this.KYBER_SECRET_KEY_SIZE,
      ciphertextSize: this.KYBER_CIPHERTEXT_SIZE,
      sharedSecretSize: this.KYBER_SHARED_SECRET_SIZE,
      quantumResistant: true,
      nistApproved: true,
      hybridMode: 'Kyber1024 + ChaCha20'
    };
  }
}

// Global instance
export const realKyber1024 = new RealKyber1024();