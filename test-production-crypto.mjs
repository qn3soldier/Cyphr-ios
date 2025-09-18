/**
 * Production Crypto Module Testing
 * Tests the actual production crypto modules used in the app
 */

import { realKyber1024 } from './src/api/crypto/realKyber1024.ts';
import { secureChaCha20 } from './src/api/crypto/secureChaCha20.ts';
import { secureRNG } from './src/api/crypto/secureRNG.ts';

console.log('🚀 Testing Production Post-Quantum Cryptography Modules...\n');

async function testPostQuantumCrypto() {
  try {
    console.log('1️⃣ Testing Kyber1024 Key Generation...');
    const startTime = performance.now();
    
    // Test key generation
    const keyPair = await realKyber1024.generateKeyPair();
    const keyGenTime = performance.now() - startTime;
    
    console.log(`✅ Kyber1024 key pair generated in ${keyGenTime.toFixed(2)}ms`);
    console.log(`   Public key size: ${keyPair.publicKey.length} bytes`);
    console.log(`   Secret key size: ${keyPair.secretKey.length} bytes`);
    
    // Test encapsulation
    console.log('\n2️⃣ Testing Kyber1024 Encapsulation...');
    const encapsulation = await realKyber1024.encapsulate(keyPair.publicKey);
    console.log(`✅ Encapsulation successful`);
    console.log(`   Ciphertext size: ${encapsulation.ciphertext.length} bytes`);
    console.log(`   Shared secret size: ${encapsulation.sharedSecret.length} bytes`);
    
    // Test decapsulation
    console.log('\n3️⃣ Testing Kyber1024 Decapsulation...');
    const decapsulatedSecret = await realKyber1024.decapsulate(keyPair.secretKey, encapsulation.ciphertext);
    console.log(`✅ Decapsulation successful`);
    
    // Verify shared secrets match
    const secretsMatch = encapsulation.sharedSecret.every((byte, index) => byte === decapsulatedSecret[index]);
    console.log(`   Shared secrets match: ${secretsMatch ? '✅' : '❌'}`);
    
    if (!secretsMatch) {
      throw new Error('Shared secrets do not match!');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Post-quantum crypto test failed:', error);
    return false;
  }
}

async function testChaCha20Encryption() {
  try {
    console.log('\n4️⃣ Testing Secure ChaCha20 Encryption...');
    
    // Generate secure key
    const key = await secureChaCha20.generateKey();
    console.log(`✅ ChaCha20 key generated (${key.length} bytes)`);
    
    // Test data
    const plaintext = new TextEncoder().encode('Hello from post-quantum secure world! 🔐');
    console.log(`   Original message: "${new TextDecoder().decode(plaintext)}"`);
    
    // Encrypt
    const startEncrypt = performance.now();
    const encrypted = await secureChaCha20.encrypt(plaintext, key);
    const encryptTime = performance.now() - startEncrypt;
    
    console.log(`✅ ChaCha20 encryption completed in ${encryptTime.toFixed(2)}ms`);
    console.log(`   Encrypted size: ${encrypted.length} bytes`);
    
    // Decrypt
    const startDecrypt = performance.now();
    const decrypted = await secureChaCha20.decrypt(encrypted, key);
    const decryptTime = performance.now() - startDecrypt;
    
    console.log(`✅ ChaCha20 decryption completed in ${decryptTime.toFixed(2)}ms`);
    
    // Verify
    const decryptedText = new TextDecoder().decode(decrypted);
    const originalText = new TextDecoder().decode(plaintext);
    const matches = decryptedText === originalText;
    
    console.log(`   Decrypted message: "${decryptedText}"`);
    console.log(`   Messages match: ${matches ? '✅' : '❌'}`);
    
    if (!matches) {
      throw new Error('Decrypted message does not match original!');
    }
    
    return true;
  } catch (error) {
    console.error('❌ ChaCha20 test failed:', error);
    return false;
  }
}

async function testSecureRNG() {
  try {
    console.log('\n5️⃣ Testing Secure Random Number Generation...');
    
    // Generate random bytes
    const randomBytes = await secureRNG.generateBytes(32);
    console.log(`✅ Generated ${randomBytes.length} random bytes`);
    
    // Test entropy quality
    const entropyTest = secureRNG.testEntropy(randomBytes);
    console.log(`   Entropy quality: ${entropyTest.quality}`);
    console.log(`   Entropy score: ${entropyTest.score.toFixed(3)}`);
    
    // Generate secure nonce
    const nonce = await secureRNG.generateNonce(12);
    console.log(`✅ Generated secure nonce (${nonce.length} bytes)`);
    
    // Generate secure key
    const key = await secureRNG.generateKey(32);
    console.log(`✅ Generated secure key (${key.length} bytes)`);
    
    return true;
  } catch (error) {
    console.error('❌ Secure RNG test failed:', error);
    return false;
  }
}

async function testHybridEncryption() {
  try {
    console.log('\n6️⃣ Testing Hybrid Kyber1024 + ChaCha20 Encryption...');
    
    // Generate recipient key pair
    const recipientKeys = await realKyber1024.generateKeyPair();
    
    // Test message
    const message = new TextEncoder().encode('This is a hybrid encrypted message using Kyber1024 + ChaCha20! 🚀');
    console.log(`   Original message: "${new TextDecoder().decode(message)}"`);
    
    // Hybrid encrypt
    const startHybridEncrypt = performance.now();
    const hybridEncrypted = await realKyber1024.hybridEncrypt(message, recipientKeys.publicKey);
    const hybridEncryptTime = performance.now() - startHybridEncrypt;
    
    console.log(`✅ Hybrid encryption completed in ${hybridEncryptTime.toFixed(2)}ms`);
    console.log(`   Algorithm: ${hybridEncrypted.algorithm}`);
    console.log(`   Kyber ciphertext size: ${hybridEncrypted.kyberCiphertext.length} bytes`);
    console.log(`   ChaCha20 encrypted size: ${hybridEncrypted.chaChaEncrypted.length} bytes`);
    
    // Check performance target
    if (hybridEncryptTime > 20) {
      console.warn(`⚠️ Hybrid encryption time (${hybridEncryptTime.toFixed(2)}ms) exceeds 20ms target`);
    } else {
      console.log(`✅ Performance target met: ${hybridEncryptTime.toFixed(2)}ms < 20ms`);
    }
    
    // Hybrid decrypt
    const startHybridDecrypt = performance.now();
    const hybridDecrypted = await realKyber1024.hybridDecrypt(hybridEncrypted, recipientKeys.secretKey);
    const hybridDecryptTime = performance.now() - startHybridDecrypt;
    
    console.log(`✅ Hybrid decryption completed in ${hybridDecryptTime.toFixed(2)}ms`);
    
    // Verify
    const decryptedText = new TextDecoder().decode(hybridDecrypted);
    const originalText = new TextDecoder().decode(message);
    const matches = decryptedText === originalText;
    
    console.log(`   Decrypted message: "${decryptedText}"`);
    console.log(`   Messages match: ${matches ? '✅' : '❌'}`);
    
    if (!matches) {
      throw new Error('Hybrid decrypted message does not match original!');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Hybrid encryption test failed:', error);
    return false;
  }
}

async function runAllTests() {
  console.log('🔍 Starting comprehensive production crypto testing...\n');
  
  const results = {
    kyber1024: false,
    chacha20: false,
    secureRNG: false,
    hybrid: false
  };
  
  results.kyber1024 = await testPostQuantumCrypto();
  results.chacha20 = await testChaCha20Encryption();
  results.secureRNG = await testSecureRNG();
  results.hybrid = await testHybridEncryption();
  
  console.log('\n📊 TEST RESULTS SUMMARY:');
  console.log('================================');
  console.log(`Kyber1024 Post-Quantum: ${results.kyber1024 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`ChaCha20 Encryption:     ${results.chacha20 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Secure RNG:              ${results.secureRNG ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Hybrid Encryption:       ${results.hybrid ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = Object.values(results).every(result => result);
  const passCount = Object.values(results).filter(result => result).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`\nOverall: ${passCount}/${totalTests} tests passed (${((passCount/totalTests)*100).toFixed(1)}%)`);
  
  if (allPassed) {
    console.log('🎉 ALL PRODUCTION CRYPTO TESTS PASSED! System is ready for production.');
  } else {
    console.log('⚠️ Some tests failed. Review the errors above.');
  }
  
  return allPassed;
}

// Run all tests
runAllTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('💥 Critical test failure:', error);
  process.exit(1);
});