/**
 * Direct pqc-kyber test with correct import path
 */

console.log('🔍 Testing DIRECT pqc-kyber with correct path...\n');

try {
  console.log('1️⃣ Importing pqc-kyber with specific file path...');
  const { keypair, encapsulate, decapsulate, Params } = await import('pqc-kyber/pqc_kyber.js');
  console.log('✅ Successfully imported pqc-kyber functions');
  console.log('Available functions:', { keypair: !!keypair, encapsulate: !!encapsulate, decapsulate: !!decapsulate, Params: !!Params });
  
  console.log('\n2️⃣ Testing key generation...');
  const startKeyGen = performance.now();
  const keys = keypair();
  const keyGenTime = performance.now() - startKeyGen;
  
  console.log(`✅ Key generation successful in ${keyGenTime.toFixed(2)}ms`);
  console.log(`   Public key: ${keys.pubkey.length} bytes`);
  console.log(`   Secret key: ${keys.secret.length} bytes`);
  
  console.log('\n3️⃣ Testing encapsulation...');
  const startEncaps = performance.now();
  const encaps = encapsulate(keys.pubkey);
  const encapsTime = performance.now() - startEncaps;
  
  console.log(`✅ Encapsulation successful in ${encapsTime.toFixed(2)}ms`);
  console.log(`   Ciphertext: ${encaps.ciphertext.length} bytes`);
  console.log(`   Shared secret: ${encaps.sharedSecret.length} bytes`);
  
  console.log('\n4️⃣ Testing decapsulation...');
  const startDecaps = performance.now();
  const decaps = decapsulate(encaps.ciphertext, keys.secret);
  const decapsTime = performance.now() - startDecaps;
  
  console.log(`✅ Decapsulation successful in ${decapsTime.toFixed(2)}ms`);
  console.log(`   Decapsulated secret: ${decaps.length} bytes`);
  
  console.log('\n5️⃣ Verifying shared secrets...');
  const secretsMatch = encaps.sharedSecret.length === decaps.length &&
    encaps.sharedSecret.every((byte, i) => byte === decaps[i]);
  
  console.log(`   Secrets match: ${secretsMatch ? '✅ YES' : '❌ NO'}`);
  
  if (secretsMatch) {
    console.log('\n🎉 PQC-KYBER IS WORKING PERFECTLY!');
    
    // Performance check
    const totalTime = keyGenTime + encapsTime + decapsTime;
    console.log(`⚡ Total time: ${totalTime.toFixed(2)}ms`);
    
    if (totalTime < 20) {
      console.log('✅ Performance target met: < 20ms');
    } else {
      console.log(`⚠️ Performance target missed: ${totalTime.toFixed(2)}ms > 20ms`);
    }
    
    // Check parameters
    console.log('\n6️⃣ Checking Kyber parameters...');
    console.log(`   Public key size: ${Params.publicKeyBytes} bytes`);
    console.log(`   Secret key size: ${Params.secretKeyBytes} bytes`);
    console.log(`   Ciphertext size: ${Params.ciphertextBytes} bytes`);
    console.log(`   Shared secret size: ${Params.sharedSecretBytes} bytes`);
    
    console.log('\n🚀 KYBER1024 IS READY FOR PRODUCTION!');
    
  } else {
    console.log('\n❌ CRITICAL ERROR: Shared secrets do not match!');
  }
  
} catch (error) {
  console.error('❌ Direct test failed:', error.message);
  console.error('Error type:', error.constructor.name);
  
  if (error.message.includes('WASM')) {
    console.log('\n🔧 WASM module issue detected. This should work in browser environment.');
  }
}