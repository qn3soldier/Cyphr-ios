/**
 * LOAD TEST FOR CYPHR MESSENGER
 * Tests performance with concurrent users
 */

import fetch from 'node-fetch';
import crypto from 'crypto';
import { ed25519 } from '@noble/curves/ed25519';

const API_BASE = 'https://app.cyphrmessenger.app/api';
const CONCURRENT_USERS = 10;  // Start with 10 concurrent
const MESSAGES_PER_USER = 5;

// Generate keypair
function generateKeyPair() {
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = ed25519.getPublicKey(privateKey);
  return {
    privateKey: Buffer.from(privateKey).toString('hex'),
    publicKey: Buffer.from(publicKey).toString('hex')
  };
}

// Sign message
function signMessage(privateKey, message) {
  const msgHash = crypto.createHash('sha256').update(message).digest();
  const signature = ed25519.sign(msgHash, Buffer.from(privateKey, 'hex'));
  return Buffer.from(signature).toString('hex');
}

// Simulate single user
async function simulateUser(userId) {
  const startTime = Date.now();
  const cyphrId = `test_user_${userId}_${Date.now()}`;
  const keys = generateKeyPair();
  
  try {
    // 1. Register
    const regRes = await fetch(`${API_BASE}/cyphr-id/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cyphrId,
        publicKey: keys.publicKey,
        deviceFingerprint: crypto.randomBytes(32).toString('hex'),
        displayName: `Test User ${userId}`
      })
    });
    
    const regData = await regRes.json();
    if (!regData.success) throw new Error(regData.message || 'Registration failed');
    
    // 2. Login
    const message = `Login Cyphr ID: ${cyphrId} at ${Math.floor(Date.now() / 60000)}`;
    const signature = signMessage(keys.privateKey, message);
    
    const loginRes = await fetch(`${API_BASE}/cyphr-id/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cyphrId,
        signature,
        deviceFingerprint: crypto.randomBytes(32).toString('hex')
      })
    });
    
    const loginData = await loginRes.json();
    if (!loginData.success) throw new Error(loginData.message || 'Login failed');
    
    const token = loginData.token;
    
    // 3. Generate Kyber keys
    await fetch(`${API_BASE}/messaging/generate-keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    const duration = Date.now() - startTime;
    return { success: true, userId, duration };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    return { success: false, userId, duration, error: error.message };
  }
}

// Run load test
async function runLoadTest() {
  console.log('\n' + '='.repeat(60));
  console.log(`🚀 LOAD TEST: ${CONCURRENT_USERS} CONCURRENT USERS`);
  console.log('='.repeat(60) + '\n');
  
  const startTime = Date.now();
  
  // Create promises for concurrent users
  const promises = [];
  for (let i = 0; i < CONCURRENT_USERS; i++) {
    promises.push(simulateUser(i));
  }
  
  // Execute all concurrently
  console.log(`⏳ Simulating ${CONCURRENT_USERS} users concurrently...`);
  const results = await Promise.all(promises);
  
  // Calculate statistics
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const avgDuration = results.reduce((acc, r) => acc + r.duration, 0) / results.length;
  const totalDuration = Date.now() - startTime;
  
  console.log('\n📊 RESULTS:');
  console.log(`   ✅ Successful: ${successful}/${CONCURRENT_USERS}`);
  console.log(`   ❌ Failed: ${failed}/${CONCURRENT_USERS}`);
  console.log(`   ⏱️  Avg response time: ${Math.round(avgDuration)}ms`);
  console.log(`   ⏱️  Total time: ${Math.round(totalDuration)}ms`);
  console.log(`   📈 Requests/sec: ${Math.round((CONCURRENT_USERS * 3) / (totalDuration / 1000))}`);
  
  if (failed > 0) {
    console.log('\n❌ FAILURES:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   User ${r.userId}: ${r.error}`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Memory check on server
  console.log('\n📍 Checking server memory...');
  const memCheck = await fetch(`${API_BASE}/health`);
  if (memCheck.ok) {
    console.log('✅ Server is healthy');
  } else {
    console.log('⚠️ Server may be overloaded');
  }
}

// Run test
runLoadTest();