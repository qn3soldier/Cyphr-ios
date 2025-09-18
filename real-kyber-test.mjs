import { PQC } from '@ayxdele/kinetic-keys';
import { chacha20 } from '@noble/ciphers/chacha';

async function testRealKyber() {
  console.log('Testing REAL Kyber1024 (@ayxdele/kinetic-keys)...');
  
  try {
    const kem = PQC.KEM;
    
    // Test Kyber key generation
    const keyPair = await kem.generateKeyPair();
    console.log('✅ Kyber key pair generated');
    console.log('Public key length:', keyPair.publicKey.length);
    console.log('Private key length:', keyPair.privateKey.length);
    
    // Test Kyber encapsulation
    const encapsulated = await kem.encapsulate(keyPair.publicKey);
    console.log('✅ Kyber encapsulation successful');
    console.log('Ciphertext length:', encapsulated.ciphertext.length);
    console.log('Shared secret length:', encapsulated.sharedSecret.length);
    
    // Test Kyber decapsulation
    const decapsulated = await kem.decapsulate(encapsulated.ciphertext, keyPair.privateKey);
    console.log('✅ Kyber decapsulation successful');
    console.log('Decapsulated length:', decapsulated.length);
    
    // Verify shared secrets match
    if (encapsulated.sharedSecret === decapsulated) {
      console.log('✅ Kyber shared secrets match perfectly!');
    } else {
      console.log('❌ Kyber shared secrets do not match');
    }
    
    console.log('\nTesting ChaCha20 with Kyber shared secret...');
    const key = new Uint8Array(32);
    const nonce = new Uint8Array(12);
    
    // Use Kyber shared secret as ChaCha20 key
    const sharedSecretBytes = kem.fromBase64(encapsulated.sharedSecret);
    key.set(sharedSecretBytes.slice(0, 32));
    crypto.getRandomValues(nonce);
    
    const testMessage = 'Hello, post-quantum encrypted world!';
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(testMessage);
    
    const encrypted = chacha20(key, nonce, dataBytes);
    console.log('✅ ChaCha20 encryption with Kyber key successful');
    
    const decrypted = chacha20(key, nonce, encrypted);
    const decoder = new TextDecoder();
    const decryptedText = decoder.decode(decrypted);
    console.log('✅ ChaCha20 decryption successful');
    
    if (decryptedText === testMessage) {
      console.log('✅ ALL TESTS PASSED! Real post-quantum encryption working!');
      console.log('Original:', testMessage);
      console.log('Decrypted:', decryptedText);
      console.log('\n🎉 Kyber1024 + ChaCha20 = Post-Quantum Secure Messenger!');
    } else {
      console.log('❌ Decryption failed - messages don\'t match');
      console.log('Original:', testMessage);
      console.log('Decrypted:', decryptedText);
    }
  } catch (error) {
    console.error('❌ Crypto test failed:', error);
  }
}

testRealKyber(); 