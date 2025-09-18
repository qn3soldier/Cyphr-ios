import { chacha20 } from '@noble/ciphers/chacha';

async function testCrypto() {
  console.log('Testing Web Crypto API (ECDH)...');
  
  try {
    // Test ECDH key generation
    const keyPair = await crypto.subtle.generateKey(
      {
        name: "ECDH",
        namedCurve: "P-256"
      },
      true,
      ["deriveKey", "deriveBits"]
    );
    console.log('✅ ECDH key pair generated');
    
    // Test key derivation
    const sharedSecret = await crypto.subtle.deriveBits(
      {
        name: "ECDH",
        public: keyPair.publicKey
      },
      keyPair.privateKey,
      256
    );
    console.log('✅ ECDH key derivation successful');
    
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
      console.log('Shared secret length:', sharedSecret.byteLength);
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