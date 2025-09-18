/**
 * Test Fixed Kyber1024 Implementation
 */

console.log('🔍 Testing FIXED Kyber1024 Implementation...\n');

try {
  // Test the TypeScript module compilation first
  console.log('1️⃣ Testing TypeScript to JavaScript compilation...');
  
  // Import the fixed realKyber1024 module
  const { realKyber1024 } = await import('./src/api/crypto/realKyber1024.ts');
  console.log('✅ Successfully imported realKyber1024');
  
  // Test key generation
  console.log('\n2️⃣ Testing key generation...');
  const keyPair = await realKyber1024.generateKeyPair();
  console.log('✅ Key generation successful');
  console.log(`   Public key: ${keyPair.publicKey.length} bytes`);
  console.log(`   Secret key: ${keyPair.secretKey.length} bytes`);
  
  // Test encapsulation
  console.log('\n3️⃣ Testing encapsulation...');
  const encapsulation = await realKyber1024.encapsulate(keyPair.publicKey);
  console.log('✅ Encapsulation successful');
  console.log(`   Ciphertext: ${encapsulation.ciphertext.length} bytes`);
  console.log(`   Shared secret: ${encapsulation.sharedSecret.length} bytes`);
  
  // Test decapsulation
  console.log('\n4️⃣ Testing decapsulation...');
  const decapsulatedSecret = await realKyber1024.decapsulate(keyPair.secretKey, encapsulation.ciphertext);
  console.log('✅ Decapsulation successful');
  console.log(`   Decapsulated secret: ${decapsulatedSecret.length} bytes`);
  
  // Verify secrets match
  const secretsMatch = encapsulation.sharedSecret.every((byte, index) => byte === decapsulatedSecret[index]);
  console.log(`   Secrets match: ${secretsMatch ? '✅' : '❌'}`);
  
  if (secretsMatch) {
    console.log('\n🎉 KYBER1024 IS NOW WORKING!');
    
    // Test hybrid encryption
    console.log('\n5️⃣ Testing hybrid Kyber1024 + ChaCha20 encryption...');
    const message = new TextEncoder().encode('FIXED: Post-quantum cryptography working! 🚀');
    
    const hybridEncrypted = await realKyber1024.hybridEncrypt(message, keyPair.publicKey);
    console.log('✅ Hybrid encryption successful');
    
    const hybridDecrypted = await realKyber1024.hybridDecrypt(hybridEncrypted, keyPair.secretKey);
    const decryptedText = new TextDecoder().decode(hybridDecrypted);
    
    console.log(`🔓 Decrypted: "${decryptedText}"`);
    
    if (decryptedText === new TextDecoder().decode(message)) {
      console.log('✅ HYBRID ENCRYPTION WORKING PERFECTLY!');
    } else {
      console.log('❌ Hybrid encryption failed');
    }
    
  } else {
    console.log('\n❌ KYBER1024 STILL NOT WORKING - Secret mismatch');
  }
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
  console.error('Stack trace:', error.stack);
  
  // Try direct pqc-kyber test
  console.log('\n🔧 Trying direct pqc-kyber test...');
  try {
    const { keypair, encapsulate, decapsulate } = await import('pqc-kyber');
    console.log('✅ Direct pqc-kyber import successful');
    
    const keys = keypair();
    console.log('✅ Direct keypair generation successful');
    
    const encaps = encapsulate(keys.pubkey);
    console.log('✅ Direct encapsulation successful');
    
    const decaps = decapsulate(encaps.ciphertext, keys.secret);
    console.log('✅ Direct decapsulation successful');
    
    const match = encaps.sharedSecret.every((byte, i) => byte === decaps[i]);
    console.log(`✅ Direct test result: ${match ? 'SUCCESS' : 'FAILURE'}`);
    
  } catch (directError) {
    console.error('❌ Direct pqc-kyber test also failed:', directError.message);
  }
}