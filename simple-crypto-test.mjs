import { Kyber1024 } from './src/api/crypto/kyber.ts';
import { chacha20 } from '@noble/ciphers/chacha';

async function testCrypto() {
  console.log('Testing Kyber1024 (Web Crypto API)...');
  
  try {
    const kyber = new Kyber1024();
    const keyPair = await kyber.generateKeyPair();
    console.log('✅ Kyber key pair generated');
    
    const encapsulated = await kyber.encapsulate(keyPair.publicKey);
    console.log('✅ Kyber encapsulation successful');
    
    const decapsulated = await kyber.decapsulate(encapsulated.ciphertext, keyPair.privateKey);
    console.log('✅ Kyber decapsulation successful');
    
    // Verify shared secrets match
    const sharedSecretsMatch = encapsulated.sharedSecret.length === decapsulated.length &&
      encapsulated.sharedSecret.every((byte, index) => byte === decapsulated[index]);
    
    if (sharedSecretsMatch) {
      console.log('✅ Kyber shared secrets match');
    } else {
      console.log('❌ Kyber shared secrets do not match');
    }
    
    console.log('Testing ChaCha20...');
    const key = new Uint8Array(32);
    const nonce = new Uint8Array(12);
    crypto.getRandomValues(key);
    crypto.getRandomValues(nonce);
    
    const testMessage = 'Hello, encrypted world!';
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(testMessage);
    
    const encrypted = chacha20(key, nonce, dataBytes);
    console.log('✅ ChaCha20 encryption successful');
    
    const decrypted = chacha20(key, nonce, encrypted);
    const decoder = new TextDecoder();
    const decryptedText = decoder.decode(decrypted);
    console.log('✅ ChaCha20 decryption successful');
    
    if (decryptedText === testMessage) {
      console.log('✅ All crypto tests passed!');
      console.log('Original:', testMessage);
      console.log('Decrypted:', decryptedText);
    } else {
      console.log('❌ Decryption failed - messages don\'t match');
      console.log('Original:', testMessage);
      console.log('Decrypted:', decryptedText);
    }
  } catch (error) {
    console.error('❌ Crypto test failed:', error);
  }
}

testCrypto(); 