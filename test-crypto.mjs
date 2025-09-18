import { Kyber1024 } from './src/api/crypto/kyber.ts';
import { encryptChaCha20, decryptChaCha20, generateKey, generateNonce } from './src/api/crypto/chacha20.ts';

async function testCrypto() {
  console.log('Testing Kyber1024...');
  
  try {
    const kyber = new Kyber1024();
    const keyPair = await kyber.generateKeyPair();
    console.log('✅ Kyber key pair generated');
    
    const encapsulated = await kyber.encapsulate(keyPair.publicKey);
    console.log('✅ Kyber encapsulation successful');
    
    const decapsulated = await kyber.decapsulate(encapsulated.ciphertext, keyPair.privateKey);
    console.log('✅ Kyber decapsulation successful');
    
    console.log('Testing ChaCha20...');
    const key = generateKey();
    const nonce = generateNonce();
    const testMessage = 'Hello, encrypted world!';
    
    const encrypted = encryptChaCha20(testMessage, key, nonce);
    console.log('✅ ChaCha20 encryption successful');
    
    const decrypted = decryptChaCha20(encrypted, key, nonce);
    console.log('✅ ChaCha20 decryption successful');
    
    if (decrypted === testMessage) {
      console.log('✅ All crypto tests passed!');
    } else {
      console.log('❌ Decryption failed - messages don\'t match');
    }
  } catch (error) {
    console.error('❌ Crypto test failed:', error);
  }
}

testCrypto(); 