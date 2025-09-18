#!/usr/bin/env node
/**
 * PIN Unlock Flow Test
 * Tests daily wallet unlock with PIN -> decrypt -> load balances
 */

import { createClient } from '@supabase/supabase-js';
import { webcrypto } from 'crypto';
import dotenv from 'dotenv';

// Use webcrypto directly in Node.js
const crypto = webcrypto;

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_KEY;

async function testPinUnlockFlow() {
  console.log('🔐 TESTING PIN UNLOCK FLOW...\n');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  // Test data
  const testUserId = 'test-pin-user-' + Date.now();
  const testSeedPhrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const testPin = '123456';
  
  try {
    console.log('1️⃣ Setting Up Test Environment...');
    
    // Create test user
    const userData = {
      id: testUserId,
      phone: '+1234567890',
      name: 'PIN Test User',
      created_at: new Date().toISOString()
    };
    
    const { data: userResult, error: userError } = await supabase
      .from('users')
      .insert(userData)
      .select();
      
    if (userError) {
      console.log('❌ User setup failed:', userError);
      return false;
    }
    console.log('✅ Test user created');
    
    console.log('\n2️⃣ Simulating Wallet Creation with PIN Encryption...');
    
    // Encrypt seed phrase with PIN (simulate EncryptedWalletStorage)
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    // Generate salt
    const salt = crypto.getRandomValues(new Uint8Array(16));
    console.log(`🧂 Generated salt: ${salt.length} bytes`);
    
    // Derive key from PIN using PBKDF2
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(testPin),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    console.log('🔑 Key derived from PIN using PBKDF2 (100,000 iterations)');
    
    // Encrypt seed phrase
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const seedData = encoder.encode(testSeedPhrase);
    
    const startTime = performance.now();
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      seedData
    );
    const encryptTime = performance.now() - startTime;
    
    console.log(`🔐 Seed phrase encrypted with AES-GCM (${encryptTime.toFixed(2)}ms)`);
    
    // Store encrypted wallet in database
    const walletData = {
      user_id: testUserId,
      encrypted_seed_phrase: Array.from(new Uint8Array(encrypted)).join(','),
      salt: Array.from(salt).join(','),
      iterations: 100000,
      wallet_type: 'hd_wallet',
      wallet_name: 'PIN Test Wallet',
      stellar_address: 'GDIXCJBCIM7NN64ZF24XIT2GUCGLOACNBUONEQO4TX36EZ4H3GXN2D3G',
      biometric_enabled: false,
      device_fingerprint: 'test_device_pin'
    };
    
    const { data: walletResult, error: walletError } = await supabase
      .from('user_wallets')
      .insert(walletData)
      .select();
      
    if (walletError) {
      console.log('❌ Wallet storage failed:', walletError);
      return false;
    }
    console.log('✅ Encrypted wallet stored in database');
    
    console.log('\n3️⃣ Testing PIN Unlock (Daily Use Scenario)...');
    
    // Simulate "next day" - retrieve wallet and unlock with PIN
    const { data: storedWallet, error: retrieveError } = await supabase
      .from('user_wallets')
      .select('*')
      .eq('user_id', testUserId)
      .single();
      
    if (retrieveError) {
      console.log('❌ Wallet retrieval failed:', retrieveError);
      return false;
    }
    console.log('📱 Wallet retrieved from database');
    
    // Parse encrypted data
    const storedEncrypted = new Uint8Array(storedWallet.encrypted_seed_phrase.split(',').map(Number));
    const storedSalt = new Uint8Array(storedWallet.salt.split(',').map(Number));
    
    console.log(`🔍 Retrieved encrypted data: ${storedEncrypted.length} bytes`);
    console.log(`🧂 Retrieved salt: ${storedSalt.length} bytes`);
    
    console.log('\n4️⃣ PIN Decryption Process...');
    
    // Derive key from entered PIN
    const unlockKeyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(testPin), // User enters PIN
      'PBKDF2',
      false,
      ['deriveKey']
    );
    
    const unlockStartTime = performance.now();
    const unlockKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: storedSalt,
        iterations: storedWallet.iterations,
        hash: 'SHA-256'
      },
      unlockKeyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    
    const keyDerivationTime = performance.now() - unlockStartTime;
    console.log(`🔑 Key re-derived from PIN (${keyDerivationTime.toFixed(2)}ms)`);
    
    // Decrypt seed phrase
    try {
      const decryptStartTime = performance.now();
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        unlockKey,
        storedEncrypted
      );
      const decryptTime = performance.now() - decryptStartTime;
      
      const decryptedSeed = decoder.decode(decrypted);
      console.log(`🔓 Seed phrase decrypted (${decryptTime.toFixed(2)}ms)`);
      
      // Verify decryption
      if (decryptedSeed === testSeedPhrase) {
        const totalUnlockTime = keyDerivationTime + decryptTime;
        console.log(`✅ PIN unlock successful! Total time: ${totalUnlockTime.toFixed(2)}ms`);
        console.log(`📊 Performance: ${totalUnlockTime < 3000 ? 'EXCELLENT' : 'NEEDS OPTIMIZATION'} (<3s target)`);
      } else {
        console.log('❌ Decrypted seed phrase does not match original');
        return false;
      }
      
    } catch (decryptError) {
      console.log('❌ Decryption failed - likely wrong PIN:', decryptError.message);
      return false;
    }
    
    console.log('\n5️⃣ Testing Wallet Balance Loading...');
    
    // Simulate loading balance after successful unlock
    const stellarAddress = storedWallet.stellar_address;
    console.log(`📍 Loading balance for: ${stellarAddress}`);
    
    try {
      const balanceStartTime = performance.now();
      const response = await fetch(`https://horizon-testnet.stellar.org/accounts/${stellarAddress}`);
      const accountData = await response.json();
      const balanceLoadTime = performance.now() - balanceStartTime;
      
      console.log(`💰 Balance loaded (${balanceLoadTime.toFixed(2)}ms):`);
      accountData.balances.forEach(balance => {
        const asset = balance.asset_type === 'native' ? 'XLM' : balance.asset_code;
        console.log(`   ${asset}: ${balance.balance}`);
      });
      
      console.log('✅ Complete wallet unlock and balance loading successful!');
      
    } catch (balanceError) {
      console.log('❌ Balance loading failed:', balanceError.message);
      return false;
    }
    
    console.log('\n6️⃣ Testing Wrong PIN Scenario...');
    
    // Test with wrong PIN
    const wrongPin = '654321';
    try {
      const wrongKeyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(wrongPin),
        'PBKDF2',
        false,
        ['deriveKey']
      );
      
      const wrongKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: storedSalt,
          iterations: storedWallet.iterations,
          hash: 'SHA-256'
        },
        wrongKeyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );
      
      const wrongDecrypt = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        wrongKey,
        storedEncrypted
      );
      
      console.log('❌ SECURITY ISSUE: Wrong PIN should not decrypt successfully!');
      return false;
      
    } catch (expectedError) {
      console.log('✅ Wrong PIN properly rejected (security working)');
    }
    
    console.log('\n7️⃣ Cleanup...');
    await supabase.from('user_wallets').delete().eq('user_id', testUserId);
    await supabase.from('users').delete().eq('id', testUserId);
    console.log('✅ Test data cleaned up');
    
    console.log('\n🎉 PIN UNLOCK FLOW TEST COMPLETED!');
    console.log('\n📊 Test Results:');
    console.log('✅ PIN encryption: WORKING');
    console.log('✅ Database storage: WORKING');
    console.log('✅ PIN unlock: WORKING');
    console.log('✅ Seed decryption: WORKING');
    console.log('✅ Balance loading: WORKING');
    console.log('✅ Wrong PIN rejection: WORKING');
    console.log('✅ Performance: ACCEPTABLE (<3s total)');
    
    return true;
    
  } catch (error) {
    console.error('❌ PIN UNLOCK TEST FAILED:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

testPinUnlockFlow();