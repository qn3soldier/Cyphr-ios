// Debug Kyber1024 step by step
import Kyber1024 from './src/api/crypto/kyber1024.js';

async function debugKyber() {
  console.log('🔍 Debug Kyber1024 Step by Step...\n');
  
  const kyber = new Kyber1024();
  
  try {
    // Generate key pair
    const keyPair = kyber.generateKeyPair();
    console.log('✅ Key pair generated');
    
    // Manual encapsulation with debugging
    const m = new Uint8Array(32);
    crypto.getRandomValues(m);
    console.log('Random message m:', Array.from(m.slice(0, 8)).join(', ') + '...');
    
    // Generate shared secret from m (encapsulation side)
    const sharedSecretEnc = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      sharedSecretEnc[i] = m[i] ^ (i * 131 % 256);
    }
    console.log('Encap shared secret:', Array.from(sharedSecretEnc.slice(0, 8)).join(', ') + '...');
    
    // Now let's see what happens in decapsulation
    // We'll simulate the polynomial operations but check each step
    
    // Encode the message
    const mPoly = kyber.encodeMessage(m);
    console.log('Encoded message poly sample:', Array.from(mPoly.slice(0, 8)).join(', ') + '...');
    
    // Decode it back (should give us m)
    const mDecoded = kyber.decodeMessage(mPoly);
    console.log('Decoded message:', Array.from(mDecoded.slice(0, 8)).join(', ') + '...');
    
    const messageMatch = m.every((byte, i) => byte === mDecoded[i]);
    console.log('Message encode/decode match:', messageMatch);
    
    // Generate shared secret from decoded m (decapsulation side)
    const sharedSecretDec = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      sharedSecretDec[i] = mDecoded[i] ^ (i * 131 % 256);
    }
    console.log('Decap shared secret:', Array.from(sharedSecretDec.slice(0, 8)).join(', ') + '...');
    
    // Compare
    const secretsMatch = sharedSecretEnc.every((byte, i) => byte === sharedSecretDec[i]);
    console.log('Shared secrets match:', secretsMatch);
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugKyber();