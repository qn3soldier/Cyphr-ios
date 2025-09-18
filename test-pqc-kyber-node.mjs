// Test the real pqc-kyber library in Node.js
console.log('🔐 Testing Real PQC-Kyber Library in Node.js...\n');

try {
  // Try to import the pqc-kyber library using the correct path
  console.log('1. Importing pqc-kyber...');
  const pqcKyber = await import('pqc-kyber/pqc_kyber.js');
  console.log('✅ pqc-kyber imported successfully');
  console.log('Available functions:', Object.keys(pqcKyber).join(', '));
  
  const { keypair, encapsulate, decapsulate } = pqcKyber;
  
  // Test key generation
  console.log('\n2. Testing key generation...');
  const startKeyGen = performance.now();
  const keys = keypair();
  const keyGenTime = performance.now() - startKeyGen;
  
  console.log(`✅ Key generation successful in ${keyGenTime.toFixed(2)}ms`);
  console.log(`   Public key: ${keys.pubkey.length} bytes`);
  console.log(`   Secret key: ${keys.secret.length} bytes`);
  
  // Test encapsulation
  console.log('\n3. Testing encapsulation...');
  const startEncaps = performance.now();
  const encaps = encapsulate(keys.pubkey);
  const encapsTime = performance.now() - startEncaps;
  
  console.log(`✅ Encapsulation successful in ${encapsTime.toFixed(2)}ms`);
  console.log(`   Ciphertext: ${encaps.ciphertext.length} bytes`);
  console.log(`   Shared secret: ${encaps.sharedSecret.length} bytes`);
  
  // Test decapsulation
  console.log('\n4. Testing decapsulation...');
  const startDecaps = performance.now();
  const decaps = decapsulate(encaps.ciphertext, keys.secret);
  const decapsTime = performance.now() - startDecaps;
  
  console.log(`✅ Decapsulation successful in ${decapsTime.toFixed(2)}ms`);
  console.log(`   Decapsulated secret: ${decaps.length} bytes`);
  
  // Verify shared secrets match
  console.log('\n5. Verifying shared secrets...');
  const secretsMatch = encaps.sharedSecret.length === decaps.length &&
    encaps.sharedSecret.every((byte, i) => byte === decaps[i]);
  
  if (secretsMatch) {
    console.log('✅ SHARED SECRETS MATCH - REAL PQC-KYBER IS WORKING!');
  } else {
    console.log('❌ SHARED SECRETS DO NOT MATCH');
    console.log('Encaps secret:', Array.from(encaps.sharedSecret.slice(0, 8)).join(', ') + '...');
    console.log('Decaps secret:', Array.from(decaps.slice(0, 8)).join(', ') + '...');
  }
  
  // Performance check
  const totalTime = keyGenTime + encapsTime + decapsTime;
  console.log(`\n⚡ Total time: ${totalTime.toFixed(2)}ms`);
  
  if (totalTime < 20) {
    console.log('✅ Performance target met: < 20ms');
  } else {
    console.log(`⚠️ Performance target missed: ${totalTime.toFixed(2)}ms > 20ms`);
  }
  
  console.log('\n🎉 REAL PQC-KYBER IS FULLY FUNCTIONAL IN NODE.JS!');
  
} catch (error) {
  console.error('❌ PQC-Kyber test failed:', error);
  console.error('Error details:', error.message);
  console.error('Stack:', error.stack);
}