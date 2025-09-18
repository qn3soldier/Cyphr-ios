// Direct test of Kyber1024 encapsulation/decapsulation
import Kyber1024 from './src/api/crypto/kyber1024.js';

async function testDirectKyber() {
  console.log('🔐 Direct Kyber1024 Test...\n');
  
  const kyber = new Kyber1024();
  
  try {
    // Generate key pair
    console.log('1. Generating key pair...');
    const keyPair = kyber.generateKeyPair();
    console.log('✅ Key pair generated');
    console.log(`   Public key has properties: ${Object.keys(keyPair.publicKey).join(', ')}`);
    console.log(`   Secret key has properties: ${Object.keys(keyPair.secretKey).join(', ')}`);
    
    // Test encapsulation
    console.log('2. Testing encapsulation...');
    const encapsulation = kyber.encapsulate(keyPair.publicKey);
    console.log('✅ Encapsulation successful');
    console.log(`   Ciphertext has properties: ${Object.keys(encapsulation.ciphertext).join(', ')}`);
    console.log(`   Shared secret length: ${encapsulation.sharedSecret.length} bytes`);
    console.log(`   Shared secret sample: ${Array.from(encapsulation.sharedSecret.slice(0, 8)).join(', ')}...`);
    
    // Test decapsulation  
    console.log('3. Testing decapsulation...');
    const decapsulatedSecret = kyber.decapsulate(encapsulation.ciphertext, keyPair.secretKey);
    console.log('✅ Decapsulation successful');
    console.log(`   Decapsulated secret length: ${decapsulatedSecret.length} bytes`);
    console.log(`   Decapsulated secret sample: ${Array.from(decapsulatedSecret.slice(0, 8)).join(', ')}...`);
    
    // Compare secrets
    console.log('4. Comparing shared secrets...');
    const secretsMatch = encapsulation.sharedSecret.length === decapsulatedSecret.length &&
      encapsulation.sharedSecret.every((byte, i) => byte === decapsulatedSecret[i]);
    
    if (secretsMatch) {
      console.log('✅ SHARED SECRETS MATCH! Kyber1024 is working correctly.');
    } else {
      console.log('❌ SHARED SECRETS DO NOT MATCH!');
      console.log('Original secret:', Array.from(encapsulation.sharedSecret).join(', '));
      console.log('Decapsulated secret:', Array.from(decapsulatedSecret).join(', '));
    }
    
  } catch (error) {
    console.error('❌ Direct test failed:', error);
    console.error('Stack:', error.stack);
  }
}

testDirectKyber();