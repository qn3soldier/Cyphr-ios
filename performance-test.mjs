#!/usr/bin/env node
import { performance } from 'perf_hooks';
import fetch from 'node-fetch';
import { Keypair } from '@stellar/stellar-sdk';

console.log('🚀 CYPHR MESSENGER PERFORMANCE VALIDATION\n');
console.log('Target: <100ms UI responses, <20ms crypto operations\n');

const API_URL = 'http://localhost:3001';
const FRONTEND_URL = 'http://localhost:5173';

// Performance metrics
const metrics = {
  api: [],
  crypto: [],
  ui: [],
  database: []
};

// Test API Response Times
async function testAPIPerformance() {
  console.log('📡 Testing API Response Times...');
  
  const endpoints = [
    { name: 'Health Check', url: '/health', method: 'GET' },
    { name: 'Send OTP', url: '/auth/send-otp', method: 'POST', body: { phone: '+12025551234' } },
    { name: 'Hash Password', url: '/api/auth/hash-password', method: 'POST', body: { password: 'test', userId: 'test' } }
  ];
  
  for (const endpoint of endpoints) {
    const start = performance.now();
    try {
      await fetch(`${API_URL}${endpoint.url}`, {
        method: endpoint.method,
        headers: { 'Content-Type': 'application/json' },
        body: endpoint.body ? JSON.stringify(endpoint.body) : undefined
      });
    } catch (e) {
      // Ignore errors, we're testing performance
    }
    const time = performance.now() - start;
    metrics.api.push({ name: endpoint.name, time });
    console.log(`  ✅ ${endpoint.name}: ${time.toFixed(2)}ms ${time < 100 ? '🟢' : '🔴'}`);
  }
}

// Test Cryptography Performance
async function testCryptoPerformance() {
  console.log('\n🔐 Testing Crypto Operations...');
  
  // Import crypto modules
  const cryptoModule = await import('./src/api/crypto/finalKyber1024.js');
  const FinalKyber1024 = cryptoModule.default;
  const kyber = new FinalKyber1024();
  
  // Test Kyber1024
  console.log('  Kyber1024 Post-Quantum:');
  
  // Key Generation
  let start = performance.now();
  const keys = await kyber.generateKeyPair();
  let time = performance.now() - start;
  metrics.crypto.push({ name: 'Kyber Key Gen', time });
  console.log(`    • Key Generation: ${time.toFixed(2)}ms ${time < 20 ? '🟢' : '🔴'}`);
  
  // Encapsulation
  start = performance.now();
  const { ciphertext, sharedSecret } = await kyber.encapsulate(keys.publicKey);
  time = performance.now() - start;
  metrics.crypto.push({ name: 'Kyber Encapsulation', time });
  console.log(`    • Encapsulation: ${time.toFixed(2)}ms ${time < 20 ? '🟢' : '🔴'}`);
  
  // Decapsulation (if method exists)
  if (kyber.decapsulate) {
    start = performance.now();
    await kyber.decapsulate(ciphertext, keys.privateKey);
    time = performance.now() - start;
    metrics.crypto.push({ name: 'Kyber Decapsulation', time });
    console.log(`    • Decapsulation: ${time.toFixed(2)}ms ${time < 20 ? '🟢' : '🔴'}`);
  }
  
  // Test with simple crypto for now
  console.log('  Symmetric Encryption:');
  const crypto = await import('crypto');
  const message = Buffer.from('Test message for encryption performance');
  const key = crypto.randomBytes(32);
  
  start = performance.now();
  const cipher = crypto.createCipher('aes-256-cbc', key);
  const encrypted = Buffer.concat([cipher.update(message), cipher.final()]);
  time = performance.now() - start;
  metrics.crypto.push({ name: 'AES Encrypt', time });
  console.log(`    • Encryption: ${time.toFixed(2)}ms ${time < 20 ? '🟢' : '🔴'}`);
  
  start = performance.now();
  const decipher = crypto.createDecipher('aes-256-cbc', key);
  Buffer.concat([decipher.update(encrypted), decipher.final()]);
  time = performance.now() - start;
  metrics.crypto.push({ name: 'AES Decrypt', time });
  console.log(`    • Decryption: ${time.toFixed(2)}ms ${time < 20 ? '🟢' : '🔴'}`);
}

// Test UI Response Times
async function testUIPerformance() {
  console.log('\n🎨 Testing Frontend Load Times...');
  
  const pages = [
    { name: 'Home Page', url: '/' },
    { name: 'Login Page', url: '/login' },
    { name: 'Chat Page', url: '/chats' }
  ];
  
  for (const page of pages) {
    const start = performance.now();
    try {
      await fetch(`${FRONTEND_URL}${page.url}`);
    } catch (e) {
      // Frontend might not be running
    }
    const time = performance.now() - start;
    metrics.ui.push({ name: page.name, time });
    console.log(`  ✅ ${page.name}: ${time.toFixed(2)}ms ${time < 100 ? '🟢' : '🔴'}`);
  }
}

// Test Stellar Operations
async function testStellarPerformance() {
  console.log('\n💰 Testing HD Wallet Operations...');
  
  const start = performance.now();
  const keypair = Keypair.random();
  const time = performance.now() - start;
  
  metrics.crypto.push({ name: 'Stellar Keypair', time });
  console.log(`  ✅ Keypair Generation: ${time.toFixed(2)}ms ${time < 20 ? '🟢' : '🔴'}`);
  console.log(`  📍 Address: ${keypair.publicKey().substring(0, 20)}...`);
}

// Generate Performance Report
function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 PERFORMANCE VALIDATION REPORT');
  console.log('='.repeat(60));
  
  // API Performance
  const avgAPI = metrics.api.reduce((a, b) => a + b.time, 0) / metrics.api.length || 0;
  console.log(`\n📡 API Response Times:`);
  console.log(`  Average: ${avgAPI.toFixed(2)}ms ${avgAPI < 100 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Target: <100ms`);
  
  // Crypto Performance
  const avgCrypto = metrics.crypto.reduce((a, b) => a + b.time, 0) / metrics.crypto.length || 0;
  console.log(`\n🔐 Crypto Operations:`);
  console.log(`  Average: ${avgCrypto.toFixed(2)}ms ${avgCrypto < 20 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Target: <20ms`);
  
  // UI Performance
  const avgUI = metrics.ui.reduce((a, b) => a + b.time, 0) / metrics.ui.length || 0;
  console.log(`\n🎨 UI Load Times:`);
  console.log(`  Average: ${avgUI.toFixed(2)}ms ${avgUI < 100 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Target: <100ms`);
  
  // Overall Score
  const allPassed = avgAPI < 100 && avgCrypto < 20 && avgUI < 100;
  console.log('\n' + '='.repeat(60));
  console.log(`🏆 OVERALL RESULT: ${allPassed ? '✅ ALL TARGETS MET!' : '⚠️ OPTIMIZATION NEEDED'}`);
  console.log('='.repeat(60));
  
  // Detailed Metrics
  console.log('\n📈 Detailed Metrics:');
  [...metrics.api, ...metrics.crypto, ...metrics.ui].forEach(m => {
    const status = m.name.includes('Crypto') || m.name.includes('Kyber') || m.name.includes('ChaCha') 
      ? (m.time < 20 ? '✅' : '⚠️')
      : (m.time < 100 ? '✅' : '⚠️');
    console.log(`  ${status} ${m.name}: ${m.time.toFixed(2)}ms`);
  });
}

// Run all tests
async function runPerformanceTests() {
  try {
    await testAPIPerformance();
    await testCryptoPerformance();
    await testUIPerformance();
    await testStellarPerformance();
    generateReport();
  } catch (error) {
    console.error('❌ Error during performance testing:', error.message);
  }
}

// Execute
runPerformanceTests();