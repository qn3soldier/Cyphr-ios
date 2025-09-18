/**
 * TEST HD WALLET FUNCTIONALITY WITH JWT AUTH
 * Tests Stellar HD wallet integration with enterprise authentication
 * August 18, 2025
 */

import fetch from 'node-fetch';

const SERVER_URL = 'https://app.cyphrmessenger.app';
const TEST_PHONE = '+19075388374'; // User's test number

async function testHDWalletWithJWT() {
  console.log('🪙 TESTING HD WALLET WITH JWT AUTHENTICATION');
  console.log('=' + '='.repeat(50));
  
  try {
    // Step 1: Login to get JWT tokens
    console.log('\n📱 Step 1: Login with OTP...');
    const loginResponse = await fetch(`${SERVER_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: TEST_PHONE })
    });
    
    const loginData = await loginResponse.json();
    console.log('Login response:', loginData);
    
    if (!loginData.success) {
      throw new Error('Login failed: ' + loginData.error);
    }
    
    // Step 2: Simulate OTP verification (user will provide)
    console.log('\n⏸️  WAITING: Please check SMS and provide OTP code...');
    console.log('   After receiving OTP, manually test verify-login endpoint');
    console.log(`   curl -X POST ${SERVER_URL}/api/verify-login \\`);
    console.log(`   -H "Content-Type: application/json" \\`);
    console.log(`   -d '{"phone": "${TEST_PHONE}", "otp": "YOUR_OTP_CODE"}'`);
    
    // Step 3: Test wallet endpoints with mock JWT
    console.log('\n🪙 Step 3: Testing HD Wallet endpoints...');
    
    // Mock JWT for testing (in real scenario, use token from verify-login)
    const mockJWT = 'mock-jwt-token-for-testing';
    
    // Test wallet creation
    const walletResponse = await fetch(`${SERVER_URL}/api/wallet/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mockJWT}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pin: '123456',
        seedPhrase: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
      })
    });
    
    const walletData = await walletResponse.json();
    console.log('Wallet creation response:', walletData);
    
    // Test wallet balance
    const balanceResponse = await fetch(`${SERVER_URL}/api/wallet/balance`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${mockJWT}`
      }
    });
    
    const balanceData = await balanceResponse.json();
    console.log('Wallet balance response:', balanceData);
    
    // Test send transaction preparation
    const sendResponse = await fetch(`${SERVER_URL}/api/wallet/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mockJWT}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipientAddress: 'GDQNY3PBOJOKYZSRMK2S7LHHGWZIUISD4QORETLMXEWXBI7KFZZMKTL3',
        amount: '1',
        pin: '123456'
      })
    });
    
    const sendData = await sendResponse.json();
    console.log('Send transaction response:', sendData);
    
    console.log('\n✅ HD Wallet + JWT test completed');
    
    // Summary
    console.log('\n📊 TEST SUMMARY:');
    console.log('- Login endpoint: ' + (loginData.success ? '✅ Working' : '❌ Failed'));
    console.log('- JWT Authentication: ⏸️  Manual verification needed');
    console.log('- HD Wallet endpoints: ' + (walletData || balanceData ? '✅ Responding' : '❌ Failed'));
    
  } catch (error) {
    console.error('❌ HD Wallet + JWT test failed:', error.message);
    console.error('\nError details:', error);
  }
}

// Additional test: Check wallet API endpoints
async function checkWalletEndpoints() {
  console.log('\n🔍 CHECKING WALLET API ENDPOINTS...');
  
  const endpoints = [
    '/api/wallet/create',
    '/api/wallet/balance', 
    '/api/wallet/send',
    '/api/wallet/history',
    '/api/wallet/trustline'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${SERVER_URL}${endpoint}`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer mock-token'
        }
      });
      
      const statusText = response.status === 401 ? '✅ Protected (401)' : 
                        response.status === 404 ? '❌ Not Found (404)' :
                        response.status === 500 ? '⚠️  Server Error (500)' :
                        `✅ Available (${response.status})`;
                        
      console.log(`  ${endpoint}: ${statusText}`);
      
    } catch (error) {
      console.log(`  ${endpoint}: ❌ Connection Error`);
    }
  }
}

// Run tests
async function runAllTests() {
  await testHDWalletWithJWT();
  await checkWalletEndpoints();
  
  console.log('\n🎯 NEXT STEPS:');
  console.log('1. Get real OTP code and test verify-login');
  console.log('2. Use real JWT token to test wallet operations');
  console.log('3. Test actual Stellar transactions on testnet');
}

runAllTests().catch(console.error);