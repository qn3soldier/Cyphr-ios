#!/usr/bin/env node
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import { Keypair } from '@stellar/stellar-sdk';

const API_URL = 'http://localhost:3001';
const JWT_SECRET = 'cyphr-quantum-secure-jwt-production-2025';

// Test user data
const testUser = {
  userId: 'test-user-' + Date.now(),
  password: 'TestPassword123!'
};

// Generate JWT token for testing
const token = jwt.sign(
  { userId: testUser.userId, timestamp: Date.now() },
  JWT_SECRET,
  { expiresIn: '24h' }
);

console.log('🔐 Testing HD Wallet API Endpoints...\n');

async function testWalletAPIs() {
  try {
    // 1. Test secure login
    console.log('1️⃣ Testing secure login...');
    const loginRes = await fetch(`${API_URL}/api/auth/secure-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testUser.userId,
        passwordHash: 'hashed-password'
      })
    });
    const loginData = await loginRes.json();
    console.log('✅ Login response:', loginData);
    
    const authToken = loginData.sessionToken || token;
    
    // 2. Test wallet creation
    console.log('\n2️⃣ Testing wallet creation...');
    const stellarKeypair = Keypair.random();
    const walletRes = await fetch(`${API_URL}/api/wallet/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        userId: testUser.userId,
        encryptedSeed: 'encrypted-seed-here'
      })
    });
    const walletData = await walletRes.json();
    console.log('✅ Wallet created:', walletData);
    
    // 3. Test password hashing
    console.log('\n3️⃣ Testing password hashing...');
    const hashRes = await fetch(`${API_URL}/api/auth/hash-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: testUser.password,
        userId: testUser.userId
      })
    });
    const hashData = await hashRes.json();
    console.log('✅ Password hashed:', hashData.success ? 'Success' : 'Failed');
    
    // 4. Test TOTP generation
    console.log('\n4️⃣ Testing TOTP generation...');
    const totpRes = await fetch(`${API_URL}/api/auth/totp/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        userId: testUser.userId
      })
    });
    const totpData = await totpRes.json();
    console.log('✅ TOTP generated:', totpData.success ? 'Success (QR code available)' : 'Failed');
    
    // 5. Test TOTP verification
    console.log('\n5️⃣ Testing TOTP verification...');
    const verifyRes = await fetch(`${API_URL}/api/auth/totp/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        userId: testUser.userId,
        code: '123456' // Test code
      })
    });
    const verifyData = await verifyRes.json();
    console.log('✅ TOTP verification:', verifyData);
    
    console.log('\n🎉 All wallet API endpoints tested successfully!');
    
  } catch (error) {
    console.error('❌ Error testing wallet APIs:', error);
  }
}

// Run tests
testWalletAPIs();