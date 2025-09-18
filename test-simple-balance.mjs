#!/usr/bin/env node
/**
 * Simple Balance Test - Direct Stellar API
 */

async function testStellarBalance() {
  console.log('🔍 TESTING STELLAR BALANCE API...');
  
  const testAddress = 'GDIXCJBCIM7NN64ZF24XIT2GUCGLOACNBUONEQO4TX36EZ4H3GXN2D3G';
  console.log(`📍 Address: ${testAddress}`);
  
  try {
    const response = await fetch(`https://horizon-testnet.stellar.org/accounts/${testAddress}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log('\n💰 ACTUAL BALANCES:');
    data.balances.forEach(balance => {
      const asset = balance.asset_type === 'native' ? 'XLM' : `${balance.asset_code} (${balance.asset_issuer.substring(0,8)}...)`;
      console.log(`  ${asset}: ${balance.balance}`);
    });
    
    // Calculate total USD value (mock prices for now)
    const xlmBalance = parseFloat(data.balances.find(b => b.asset_type === 'native')?.balance || '0');
    const usdcBalance = parseFloat(data.balances.find(b => b.asset_code === 'USDC')?.balance || '0');
    
    const xlmPrice = 0.10; // ~$0.10 per XLM
    const usdcPrice = 1.00; // $1.00 per USDC
    
    const totalUSD = (xlmBalance * xlmPrice) + (usdcBalance * usdcPrice);
    
    console.log(`\n📊 PORTFOLIO VALUE:`);
    console.log(`  XLM: ${xlmBalance} × $${xlmPrice} = $${(xlmBalance * xlmPrice).toFixed(2)}`);
    console.log(`  USDC: ${usdcBalance} × $${usdcPrice} = $${(usdcBalance * usdcPrice).toFixed(2)}`);
    console.log(`  TOTAL: $${totalUSD.toFixed(2)}`);
    
    console.log('\n✅ TEST COMPLETED - Data is ready for UI display!');
    return { xlmBalance, usdcBalance, totalUSD };
    
  } catch (error) {
    console.error('❌ API Test failed:', error.message);
    return null;
  }
}

testStellarBalance();