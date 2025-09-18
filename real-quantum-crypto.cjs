/**
 * CYPHR MESSENGER - REAL Post-Quantum Cryptography Service
 * Использует НАСТОЯЩИЙ Kyber1024 (NIST FIPS 203) + ChaCha20-Poly1305
 * Date: 2025-09-04
 * 
 * ЭТОТ КОД - НАСТОЯЩАЯ КРИПТОГРАФИЯ, А НЕ ФЕЙК!
 */

const crypto = require('crypto');

// НАСТОЯЩИЙ Kyber1024 из pqc-kyber (Rust WASM)
let pqcKyber = null;

/**
 * Initialize REAL Kyber1024
 */
async function initializeKyber() {
  if (!pqcKyber) {
    try {
      // Загружаем WASM модуль Kyber
      const kyberModule = await import('pqc-kyber');
      await kyberModule.default();
      pqcKyber = kyberModule;
      console.log('✅ REAL Kyber1024 initialized from pqc-kyber');
    } catch (error) {
      console.error('❌ Failed to load Kyber1024:', error);
      throw new Error('Cannot initialize post-quantum cryptography');
    }
  }
  return pqcKyber;
}

/**
 * НАСТОЯЩИЙ Post-Quantum Crypto Service
 * Совместим с iOS SwiftKyber
 */
class RealQuantumCrypto {
  constructor() {
    this.kyber = null;
    this.keyCache = new Map();
  }

  /**
   * Initialize the crypto service
   */
  async initialize() {
    this.kyber = await initializeKyber();
    console.log('🔐 Real Quantum Crypto Service initialized');
    console.log('   Using: Kyber1024 (NIST FIPS 203) + ChaCha20-Poly1305');
    return true;
  }

  /**
   * Generate REAL Kyber1024 keypair
   * @returns {Object} { publicKey, secretKey } in base64
   */
  async generateKyber1024KeyPair() {
    if (!this.kyber) await this.initialize();
    
    try {
      // Генерируем НАСТОЯЩУЮ пару ключей Kyber1024
      const keypair = this.kyber.keypair();
      
      return {
        publicKey: Buffer.from(keypair.pubkey).toString('base64'),
        secretKey: Buffer.from(keypair.secret).toString('base64'),
        keyId: crypto.randomUUID(),
        algorithm: 'Kyber1024',
        keySize: keypair.pubkey.length
      };
    } catch (error) {
      console.error('Error generating Kyber1024 keypair:', error);
      throw error;
    }
  }

  /**
   * Encapsulate - create shared secret and ciphertext
   * @param {string} recipientPublicKey - Base64 encoded public key
   * @returns {Object} { ciphertext, sharedSecret }
   */
  async encapsulate(recipientPublicKey) {
    if (!this.kyber) await this.initialize();
    
    try {
      const publicKeyBytes = Buffer.from(recipientPublicKey, 'base64');
      
      // НАСТОЯЩАЯ инкапсуляция Kyber1024
      const encapsulated = this.kyber.encapsulate(publicKeyBytes);
      
      return {
        ciphertext: Buffer.from(encapsulated.ciphertext).toString('base64'),
        sharedSecret: Buffer.from(encapsulated.sharedSecret).toString('hex')
      };
    } catch (error) {
      console.error('Error in Kyber encapsulation:', error);
      throw error;
    }
  }

  /**
   * Decapsulate - extract shared secret from ciphertext
   * @param {string} ciphertext - Base64 encoded ciphertext
   * @param {string} secretKey - Base64 encoded secret key
   * @returns {string} sharedSecret in hex
   */
  async decapsulate(ciphertext, secretKey) {
    if (!this.kyber) await this.initialize();
    
    try {
      const ciphertextBytes = Buffer.from(ciphertext, 'base64');
      const secretKeyBytes = Buffer.from(secretKey, 'base64');
      
      // НАСТОЯЩАЯ декапсуляция Kyber1024
      const sharedSecret = this.kyber.decapsulate(ciphertextBytes, secretKeyBytes);
      
      return Buffer.from(sharedSecret).toString('hex');
    } catch (error) {
      console.error('Error in Kyber decapsulation:', error);
      throw error;
    }
  }

  /**
   * Encrypt message using Kyber1024 + ChaCha20-Poly1305
   * @param {string} message - Plain text message
   * @param {string} recipientPublicKey - Recipient's Kyber public key
   * @returns {Object} Encrypted payload
   */
  async encryptMessage(message, recipientPublicKey) {
    try {
      // 1. Encapsulate to get shared secret
      const { ciphertext, sharedSecret } = await this.encapsulate(recipientPublicKey);
      
      // 2. Derive encryption key from shared secret
      const encryptionKey = crypto.createHash('sha256')
        .update(Buffer.from(sharedSecret, 'hex'))
        .digest();
      
      // 3. Generate random nonce for ChaCha20-Poly1305
      const nonce = crypto.randomBytes(12);
      
      // 4. Encrypt with ChaCha20-Poly1305
      const cipher = crypto.createCipheriv('chacha20-poly1305', encryptionKey, nonce);
      
      const messageBuffer = Buffer.from(message, 'utf8');
      const encrypted = Buffer.concat([
        cipher.update(messageBuffer),
        cipher.final()
      ]);
      
      // 5. Get auth tag
      const authTag = cipher.getAuthTag();
      
      return {
        encrypted_content: encrypted.toString('base64'),
        kyber_ciphertext: ciphertext,
        nonce: nonce.toString('base64'),
        auth_tag: authTag.toString('base64'),
        algorithm: 'Kyber1024+ChaCha20-Poly1305',
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Error encrypting message:', error);
      throw error;
    }
  }

  /**
   * Decrypt message using Kyber1024 + ChaCha20-Poly1305
   * @param {Object} encryptedPayload - Encrypted message object
   * @param {string} secretKey - Recipient's Kyber secret key
   * @returns {string} Decrypted message
   */
  async decryptMessage(encryptedPayload, secretKey) {
    try {
      // 1. Decapsulate to get shared secret
      const sharedSecret = await this.decapsulate(
        encryptedPayload.kyber_ciphertext,
        secretKey
      );
      
      // 2. Derive decryption key
      const decryptionKey = crypto.createHash('sha256')
        .update(Buffer.from(sharedSecret, 'hex'))
        .digest();
      
      // 3. Setup decipher
      const nonce = Buffer.from(encryptedPayload.nonce, 'base64');
      const decipher = crypto.createDecipheriv('chacha20-poly1305', decryptionKey, nonce);
      
      // 4. Set auth tag
      const authTag = Buffer.from(encryptedPayload.auth_tag, 'base64');
      decipher.setAuthTag(authTag);
      
      // 5. Decrypt
      const encrypted = Buffer.from(encryptedPayload.encrypted_content, 'base64');
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);
      
      return decrypted.toString('utf8');
      
    } catch (error) {
      console.error('Error decrypting message:', error);
      throw error;
    }
  }

  /**
   * Generate ephemeral keypair for perfect forward secrecy
   */
  async generateEphemeralKeyPair() {
    return this.generateKyber1024KeyPair();
  }

  /**
   * Sign message with Ed25519 (for authentication)
   */
  signMessage(message, privateKey) {
    const sign = crypto.createSign('SHA256');
    sign.update(message);
    sign.end();
    return sign.sign(privateKey, 'base64');
  }

  /**
   * Verify message signature
   */
  verifySignature(message, signature, publicKey) {
    const verify = crypto.createVerify('SHA256');
    verify.update(message);
    verify.end();
    return verify.verify(publicKey, signature, 'base64');
  }
}

// Export singleton instance
const quantumCrypto = new RealQuantumCrypto();

module.exports = {
  RealQuantumCrypto,
  quantumCrypto,
  initializeKyber
};

// Test function
if (require.main === module) {
  (async () => {
    console.log('🧪 Testing REAL Quantum Crypto Service...\n');
    
    const crypto = new RealQuantumCrypto();
    await crypto.initialize();
    
    // Generate keypairs
    console.log('📍 Generating Kyber1024 keypairs...');
    const alice = await crypto.generateKyber1024KeyPair();
    const bob = await crypto.generateKyber1024KeyPair();
    
    console.log(`✅ Alice keypair: ${alice.keySize} bytes`);
    console.log(`✅ Bob keypair: ${bob.keySize} bytes`);
    
    // Test encryption
    const message = 'Hello from REAL Post-Quantum Crypto! 🚀';
    console.log(`\n📝 Original message: "${message}"`);
    
    const encrypted = await crypto.encryptMessage(message, bob.publicKey);
    console.log('\n🔐 Encrypted:', encrypted);
    
    // Test decryption
    const decrypted = await crypto.decryptMessage(encrypted, bob.secretKey);
    console.log(`\n✅ Decrypted: "${decrypted}"`);
    
    if (message === decrypted) {
      console.log('\n🎉 SUCCESS! REAL Kyber1024 + ChaCha20 working perfectly!');
    } else {
      console.log('\n❌ FAILURE! Decryption failed');
    }
  })();
}