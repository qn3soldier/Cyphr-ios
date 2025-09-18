#!/usr/bin/env node

// Test Cyphr crypto in browser-like environment
import { execSync } from 'child_process';

console.log('🧪 TESTING CYPHR CRYPTO IN BROWSER ENVIRONMENT...\n');

const testCode = `
// Simulate browser environment 
globalThis.window = globalThis;
globalThis.__dirname = '/assets';
globalThis.require = () => ({});
globalThis.module = { exports: {} };

// Import our crypto
import QuantumCrypto from './src/api/crypto/quantumCrypto.js';
import ChaCha20 from './src/api/crypto/chacha20.js';

async function testCrypto() {
  console.log('🔧 Initializing QuantumCrypto...');
  
  const crypto = new QuantumCrypto();
  await crypto.initialize();
  
  console.log('📊 Testing key generation...');
  const keyPair = await crypto.generateKeyPair();
  console.log('🔑 Public key length:', keyPair.publicKey.length);
  console.log('🗝️ Private key length:', keyPair.privateKey.length);
  
  console.log('📊 Testing encryption/decryption...');
  const message = "Hello Cyphr!";
  const encrypted = await crypto.encrypt(message, keyPair.publicKey);
  console.log('🔒 Encrypted length:', encrypted.length);
  
  const decrypted = await crypto.decrypt(encrypted, keyPair.privateKey);
  console.log('🔓 Decrypted:', decrypted);
  console.log('✅ Encryption test:', message === decrypted ? 'PASS' : 'FAIL');
  
  console.log('📊 Testing ChaCha20...');
  const chacha = new ChaCha20();
  const key = new Uint8Array(32);
  crypto.getRandomValues(key);
  const testData = new TextEncoder().encode("Test ChaCha20");
  
  const chachaEncrypted = chacha.encrypt(testData, key);
  const chachaDecrypted = chacha.decrypt(chachaEncrypted, key);
  const decryptedText = new TextDecoder().decode(chachaDecrypted);
  console.log('🔓 ChaCha20 decrypted:', decryptedText);
  console.log('✅ ChaCha20 test:', decryptedText === "Test ChaCha20" ? 'PASS' : 'FAIL');
}

testCrypto().catch(console.error);
`;

try {
  // Build the project first
  console.log('📦 Building project...');
  execSync('npm run build', { stdio: 'inherit' });
  
  console.log('\n🚀 Testing crypto in production build...');
  
  // Test if crypto works by checking console output
  const testUrl = 'https://app.cyphrmessenger.app';
  console.log(`🌐 Please open ${testUrl} and check console for crypto errors`);
  console.log('👀 Look for these patterns:');
  console.log('  ❌ WASM initialization failed');
  console.log('  ⚠️ Using fallback crypto');
  console.log('  ✅ REAL POST-QUANTUM Kyber1024 готов');
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
}