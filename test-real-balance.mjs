#!/usr/bin/env node
/**
 * Test Real Balance Loading from Stellar Testnet
 * Direct API call to verify wallet displays actual balances
 */

import StellarServiceEnhanced from './src/api/stellarServiceEnhanced.ts';

async function testRealBalances() {
  console.log('🔍 TESTING REAL STELLAR BALANCES...');
  
  const stellarService = new StellarServiceEnhanced('testnet');
  const testAddress = 'GDIXCJBCIM7NN64ZF24XIT2GUCGLOACNBUONEQO4TX36EZ4H3GXN2D3G';
  
  console.log(`📍 Testing address: ${testAddress}`);
  
  try {
    // Test direct Stellar Horizon API
    console.log('\n🌐 Direct Horizon API Test:');
    const response = await fetch(`https://horizon-testnet.stellar.org/accounts/${testAddress}`);
    const accountData = await response.json();
    
    console.log('✅ Horizon API Response:');
    accountData.balances.forEach(balance => {
      const assetCode = balance.asset_type === 'native' ? 'XLM' : balance.asset_code;
      console.log(`  - ${assetCode}: ${balance.balance}`);
    });
    
    // Test our stellar service
    console.log('\n⚙️ StellarServiceEnhanced Test:');
    const assets = await stellarService.getMultiAssetBalance(testAddress);
    
    console.log('✅ Service Response:');
    assets.forEach(asset => {
      console.log(`  - ${asset.code}: ${asset.balance}`);
    });
    
    // Verify balances match
    console.log('\n📊 Balance Verification:');
    const horizonXLM = accountData.balances.find(b => b.asset_type === 'native');
    const serviceXLM = assets.find(a => a.code === 'XLM');
    
    if (horizonXLM && serviceXLM) {
      const match = horizonXLM.balance === serviceXLM.balance;
      console.log(`XLM Balance Match: ${match ? '✅' : '❌'}`);
      console.log(`  Horizon: ${horizonXLM.balance}`);
      console.log(`  Service: ${serviceXLM.balance}`);
    }
    
    const horizonUSDC = accountData.balances.find(b => b.asset_code === 'USDC');
    const serviceUSDC = assets.find(a => a.code === 'USDC');
    
    if (horizonUSDC && serviceUSDC) {
      const match = horizonUSDC.balance === serviceUSDC.balance;
      console.log(`USDC Balance Match: ${match ? '✅' : '❌'}`);
      console.log(`  Horizon: ${horizonUSDC.balance}`);
      console.log(`  Service: ${serviceUSDC.balance}`);
    }
    
    console.log('\n🎉 REAL BALANCE TEST COMPLETED!');
    
  } catch (error) {
    console.error('❌ Balance test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testRealBalances().catch(console.error);