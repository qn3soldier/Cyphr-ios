/**
 * Quick Kyber1024 Browser Import Test
 * This will test if the corrected import path works
 */

console.log('🔍 Testing Kyber1024 import paths...');

try {
  // Test the corrected import path that was mentioned in CLAUDE.md
  console.log('1️⃣ Testing: pqc-kyber/pqc_kyber.js');
  const { keypair, encapsulate, decapsulate, Params } = await import('pqc-kyber/pqc_kyber.js');
  
  console.log('✅ Import successful!');
  console.log('📊 Available functions:', { keypair: typeof keypair, encapsulate: typeof encapsulate, decapsulate: typeof decapsulate });
  
  // Quick functionality test
  console.log('2️⃣ Testing basic functionality...');
  const keys = keypair();
  console.log('✅ Key generation successful');
  console.log(`   Public key: ${keys.pubkey.length} bytes`);
  console.log(`   Secret key: ${keys.secret.length} bytes`);
  
  const encaps = encapsulate(keys.pubkey);
  console.log('✅ Encapsulation successful');
  console.log(`   Ciphertext: ${encaps.ciphertext.length} bytes`);
  console.log(`   Shared secret: ${encaps.sharedSecret.length} bytes`);
  
  const decaps = decapsulate(encaps.ciphertext, keys.secret);
  console.log('✅ Decapsulation successful');
  console.log(`   Decapsulated secret: ${decaps.length} bytes`);
  
  // Verify match
  const match = encaps.sharedSecret.every((b, i) => b === decaps[i]);
  console.log(`🔍 Secrets match: ${match ? '✅ YES' : '❌ NO'}`);
  
  if (match) {
    console.log('');
    console.log('🎉🎉🎉 KYBER1024 IS WORKING! 🎉🎉🎉');
    console.log('✅ Import path is correct');
    console.log('✅ All operations functional');
    console.log('✅ Ready for browser testing');
  } else {
    console.log('❌ FUNCTIONALITY TEST FAILED');
  }
  
} catch (error) {
  console.error('❌ ERROR:', error.message);
  
  // Try alternative import
  try {
    console.log('🔄 Trying alternative import: pqc-kyber');
    const kyberAlt = await import('pqc-kyber');
    console.log('✅ Alternative import successful');
    console.log('📋 Available exports:', Object.keys(kyberAlt));
  } catch (altError) {
    console.error('❌ Alternative import also failed:', altError.message);
  }
}