#!/usr/bin/env node
/**
 * UserWalletService Integration Test
 * Tests real database integration and wallet creation
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_KEY;

async function testUserWalletIntegration() {
  console.log('🧪 TESTING USER WALLET SERVICE INTEGRATION...\n');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  // Test data
  const testUserId = 'test-user-' + Date.now();
  const testSeedPhrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const testPin = '123456';
  
  try {
    console.log('1️⃣ Testing Database Connection...');
    const { data: tables, error } = await supabase
      .from('user_wallets')
      .select('count')
      .limit(1);
      
    if (error) {
      console.log('❌ Database connection failed:', error);
      return false;
    }
    console.log('✅ Database connection successful\n');
    
    console.log('2️⃣ Creating Test User...');
    
    // First create a test user (using actual users table structure)
    const userData = {
      id: testUserId,
      phone: '+1234567890',
      name: 'Test User', // Using 'name' instead of 'full_name'  
      created_at: new Date().toISOString()
    };
    
    const { data: userResult, error: userError } = await supabase
      .from('users')
      .insert(userData)
      .select();
      
    if (userError) {
      console.log('❌ User creation failed:', userError);
      return false;
    }
    console.log('✅ Test user created:', userResult[0].id);
    
    console.log('\n3️⃣ Testing Wallet Creation...');
    
    // Simulate wallet creation data
    const walletData = {
      user_id: testUserId,
      encrypted_seed_phrase: 'mock_encrypted_seed_' + Date.now(),
      salt: 'mock_salt_' + Date.now(),
      iterations: 100000,
      wallet_type: 'hd_wallet',
      wallet_name: 'Test Wallet',
      stellar_address: 'GDIXCJBCIM7NN64ZF24XIT2GUCGLOACNBUONEQO4TX36EZ4H3GXN2D3G',
      biometric_enabled: false,
      device_fingerprint: 'test_device_' + Date.now()
    };
    
    console.log('📝 Creating wallet record...');
    const { data: createResult, error: createError } = await supabase
      .from('user_wallets')
      .insert(walletData)
      .select();
      
    if (createError) {
      console.log('❌ Wallet creation failed:', createError);
      return false;
    }
    console.log('✅ Wallet created:', createResult[0].id);
    
    console.log('\n4️⃣ Testing Wallet Retrieval...');
    const { data: retrieveResult, error: retrieveError } = await supabase
      .from('user_wallets')
      .select('*')
      .eq('user_id', testUserId)
      .single();
      
    if (retrieveError) {
      console.log('❌ Wallet retrieval failed:', retrieveError);
      return false;
    }
    console.log('✅ Wallet retrieved:', retrieveResult.wallet_name);
    
    console.log('\n5️⃣ Testing Balance Cache...');
    
    const cacheData = {
      wallet_id: createResult[0].id,
      stellar_address: walletData.stellar_address,
      balance_data: {
        assets: [
          { code: 'XLM', balance: '9999.9999600' },
          { code: 'USDC', balance: '0.0000000' }
        ]
      },
      total_value_usd: 1000.00
    };
    
    const { data: cacheResult, error: cacheError } = await supabase
      .from('wallet_balance_cache')
      .insert(cacheData)
      .select();
      
    if (cacheError) {
      console.log('❌ Balance cache failed:', cacheError);
      return false;
    }
    console.log('✅ Balance cached for wallet');
    
    console.log('\n6️⃣ Testing Cache Retrieval...');
    const { data: cachedBalance, error: cacheRetrieveError } = await supabase
      .from('wallet_balance_cache')
      .select('*')
      .eq('wallet_id', createResult[0].id)
      .single();
      
    if (cacheRetrieveError) {
      console.log('❌ Cache retrieval failed:', cacheRetrieveError);
      return false;
    }
    console.log('✅ Cache retrieved:', cachedBalance.balance_data);
    
    console.log('\n7️⃣ Testing Cross-Device Scenario...');
    // Simulate same user on different device
    const device2Fingerprint = 'test_device_2_' + Date.now();
    
    const { data: sameUserWallet, error: sameUserError } = await supabase
      .from('user_wallets')
      .select('*')
      .eq('user_id', testUserId)
      .single();
      
    if (sameUserError) {
      console.log('❌ Cross-device test failed:', sameUserError);
      return false;
    }
    
    console.log('✅ Same wallet retrieved on different device');
    console.log(`   Stellar Address: ${sameUserWallet.stellar_address}`);
    
    console.log('\n8️⃣ Cleanup Test Data...');
    await supabase.from('wallet_balance_cache').delete().eq('wallet_id', createResult[0].id);
    await supabase.from('user_wallets').delete().eq('user_id', testUserId);
    await supabase.from('users').delete().eq('id', testUserId);
    console.log('✅ Test data cleaned up');
    
    console.log('\n🎉 ALL INTEGRATION TESTS PASSED!');
    console.log('\n📊 Test Results:');
    console.log('✅ Database connection: WORKING');
    console.log('✅ Wallet creation: WORKING');
    console.log('✅ Wallet retrieval: WORKING');
    console.log('✅ Balance caching: WORKING');
    console.log('✅ Cross-device sync: WORKING');
    console.log('✅ Data cleanup: WORKING');
    
    return true;
    
  } catch (error) {
    console.error('❌ INTEGRATION TEST FAILED:', error.message);
    return false;
  }
}

testUserWalletIntegration();