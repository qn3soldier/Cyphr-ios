/**
 * Simple Crypto Test - Test pqc-kyber directly
 */

try {
  console.log('🔍 Testing pqc-kyber import...');
  
  // Try different import methods
  const kyber = await import('pqc-kyber/pqc_kyber.js');
  console.log('✅ pqc-kyber imported successfully');
  console.log('Available functions:', Object.keys(kyber));
  
  // Test key generation
  if (kyber.keypair) {
    console.log('\n🔑 Testing Kyber key generation...');
    const keys = kyber.keypair();
    console.log('✅ Key generation successful');
    console.log(`   Public key length: ${keys.pubkey?.length || 0} bytes`);
    console.log(`   Secret key length: ${keys.secret?.length || 0} bytes`);
    
    if (keys.pubkey && keys.secret) {
      console.log('\n🔐 Testing encapsulation...');
      const encaps = kyber.encapsulate(keys.pubkey);
      console.log('✅ Encapsulation successful');
      console.log(`   Ciphertext length: ${encaps.ciphertext?.length || 0} bytes`);
      console.log(`   Shared secret length: ${encaps.sharedSecret?.length || 0} bytes`);
      
      console.log('\n🔓 Testing decapsulation...');
      const decaps = kyber.decapsulate(encaps.ciphertext, keys.secret);
      console.log('✅ Decapsulation successful');
      console.log(`   Decapsulated secret length: ${decaps?.length || 0} bytes`);
      
      // Compare secrets
      const secretsMatch = encaps.sharedSecret && decaps && 
        encaps.sharedSecret.length === decaps.length &&
        encaps.sharedSecret.every((byte, i) => byte === decaps[i]);
      
      console.log(`   Secrets match: ${secretsMatch ? '✅' : '❌'}`);
      
      if (secretsMatch) {
        console.log('\n🎉 PQC-Kyber is working correctly!');
      } else {
        console.log('\n❌ Secret mismatch - crypto verification failed');
      }
    }
  } else {
    console.log('❌ keypair function not found in pqc-kyber');
  }
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
  console.log('\n🔧 Trying alternative import methods...');
  
  // Try alternative import
  try {
    const kyberAlt = await import('pqc-kyber');
    console.log('✅ Alternative import successful');
    console.log('Available:', Object.keys(kyberAlt));
  } catch (altError) {
    console.error('❌ Alternative import also failed:', altError.message);
  }
}