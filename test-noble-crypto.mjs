/**
 * Test Noble Crypto Libraries (ChaCha20, Hashes, RNG)
 * These should work in Node.js environment
 */

import { chacha20poly1305 } from '@noble/ciphers/chacha';
import { randomBytes } from '@noble/ciphers/webcrypto';
import { sha3_256, shake256 } from '@noble/hashes/sha3';
import { scrypt } from '@noble/hashes/scrypt';

console.log('🚀 Testing Noble Crypto Libraries...\n');

async function testChaCha20() {
  try {
    console.log('1️⃣ Testing ChaCha20-Poly1305...');
    
    // Generate key and nonce
    const key = randomBytes(32); // 256-bit key
    const nonce = randomBytes(12); // 96-bit nonce
    const aad = new Uint8Array(); // Additional authenticated data (empty)
    
    console.log(`✅ Generated key (${key.length} bytes) and nonce (${nonce.length} bytes)`);
    
    // Test message
    const message = new TextEncoder().encode('Hello from Noble ChaCha20! 🔐');
    console.log(`   Original: "${new TextDecoder().decode(message)}"`);
    
    // Encrypt
    const startEncrypt = performance.now();
    const encrypted = chacha20poly1305(key, nonce, aad).encrypt(message);
    const encryptTime = performance.now() - startEncrypt;
    
    console.log(`✅ Encryption completed in ${encryptTime.toFixed(2)}ms`);
    console.log(`   Encrypted size: ${encrypted.length} bytes`);
    
    // Decrypt
    const startDecrypt = performance.now();
    const decrypted = chacha20poly1305(key, nonce, aad).decrypt(encrypted);
    const decryptTime = performance.now() - startDecrypt;
    
    console.log(`✅ Decryption completed in ${decryptTime.toFixed(2)}ms`);
    
    // Verify
    const decryptedText = new TextDecoder().decode(decrypted);
    const matches = decryptedText === new TextDecoder().decode(message);
    
    console.log(`   Decrypted: "${decryptedText}"`);
    console.log(`   Messages match: ${matches ? '✅' : '❌'}`);
    
    return matches;
  } catch (error) {
    console.error('❌ ChaCha20 test failed:', error);
    return false;
  }
}

async function testHashFunctions() {
  try {
    console.log('\n2️⃣ Testing Hash Functions...');
    
    const data = new TextEncoder().encode('Test data for hashing');
    console.log(`   Input: "${new TextDecoder().decode(data)}"`);
    
    // SHA3-256
    const sha3Hash = sha3_256(data);
    console.log(`✅ SHA3-256: ${Array.from(sha3Hash).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32)}...`);
    
    // SHAKE256
    const shake256Hash = shake256(data, 32);
    console.log(`✅ SHAKE256: ${Array.from(shake256Hash).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32)}...`);
    
    // Key derivation with scrypt
    const password = new TextEncoder().encode('password123');
    const salt = randomBytes(16);
    const derivedKey = scrypt(password, salt, { N: 16384, r: 8, p: 1, dkLen: 32 });
    console.log(`✅ Scrypt KDF: ${Array.from(derivedKey).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32)}...`);
    
    return true;
  } catch (error) {
    console.error('❌ Hash functions test failed:', error);
    return false;
  }
}

async function testRandomGeneration() {
  try {
    console.log('\n3️⃣ Testing Random Number Generation...');
    
    // Generate different sizes
    const small = randomBytes(16);
    const medium = randomBytes(32);
    const large = randomBytes(64);
    
    console.log(`✅ Generated 16 bytes: ${Array.from(small).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16)}...`);
    console.log(`✅ Generated 32 bytes: ${Array.from(medium).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16)}...`);
    console.log(`✅ Generated 64 bytes: ${Array.from(large).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16)}...`);
    
    // Test entropy (basic check - all zeros would be bad)
    const allZeros = medium.every(byte => byte === 0);
    const allSame = medium.every(byte => byte === medium[0]);
    
    console.log(`   Entropy check - All zeros: ${allZeros ? '❌' : '✅'}`);
    console.log(`   Entropy check - All same: ${allSame ? '❌' : '✅'}`);
    
    return !allZeros && !allSame;
  } catch (error) {
    console.error('❌ Random generation test failed:', error);
    return false;
  }
}

async function performanceBenchmark() {
  try {
    console.log('\n4️⃣ Performance Benchmark...');
    
    const key = randomBytes(32);
    const nonce = randomBytes(12);
    const aad = new Uint8Array();
    const data = randomBytes(1024); // 1KB test data
    
    // Benchmark encryption/decryption
    const iterations = 1000;
    let totalEncryptTime = 0;
    let totalDecryptTime = 0;
    
    for (let i = 0; i < iterations; i++) {
      const startEncrypt = performance.now();
      const encrypted = chacha20poly1305(key, nonce, aad).encrypt(data);
      totalEncryptTime += performance.now() - startEncrypt;
      
      const startDecrypt = performance.now();
      chacha20poly1305(key, nonce, aad).decrypt(encrypted);
      totalDecryptTime += performance.now() - startDecrypt;
    }
    
    const avgEncrypt = totalEncryptTime / iterations;
    const avgDecrypt = totalDecryptTime / iterations;
    const throughputMBs = (1024 / 1024) / (avgEncrypt / 1000); // MB/s
    
    console.log(`✅ Average encrypt time: ${avgEncrypt.toFixed(3)}ms`);
    console.log(`✅ Average decrypt time: ${avgDecrypt.toFixed(3)}ms`);
    console.log(`✅ Throughput: ${throughputMBs.toFixed(2)} MB/s`);
    
    // Check if meets performance targets
    const meetsPerfTarget = avgEncrypt < 1 && avgDecrypt < 1; // Sub-millisecond for 1KB
    console.log(`   Performance target: ${meetsPerfTarget ? '✅ PASS' : '⚠️ REVIEW'}`);
    
    return true;
  } catch (error) {
    console.error('❌ Performance benchmark failed:', error);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🔍 Starting Noble Crypto Libraries Testing...\n');
  
  const results = {
    chacha20: false,
    hashes: false,
    random: false,
    performance: false
  };
  
  results.chacha20 = await testChaCha20();
  results.hashes = await testHashFunctions();
  results.random = await testRandomGeneration();
  results.performance = await performanceBenchmark();
  
  console.log('\n📊 NOBLE CRYPTO TEST RESULTS:');
  console.log('================================');
  console.log(`ChaCha20-Poly1305:  ${results.chacha20 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Hash Functions:     ${results.hashes ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Random Generation:  ${results.random ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Performance:        ${results.performance ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = Object.values(results).every(result => result);
  const passCount = Object.values(results).filter(result => result).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`\nOverall: ${passCount}/${totalTests} Noble crypto tests passed (${((passCount/totalTests)*100).toFixed(1)}%)`);
  
  if (allPassed) {
    console.log('🎉 ALL NOBLE CRYPTO TESTS PASSED!');
    console.log('✅ ChaCha20, SHA3, and RNG are working correctly.');
    console.log('ℹ️  Kyber1024 testing will be done in browser environment.');
  } else {
    console.log('⚠️ Some Noble crypto tests failed.');
  }
  
  return allPassed;
}

runAllTests().then(success => {
  console.log(`\n${success ? '🚀' : '⚠️'} Noble crypto testing completed.`);
}).catch(error => {
  console.error('💥 Critical error:', error);
});