// Very simple Kyber1024 test to isolate the polynomial issue
import Kyber1024 from './src/api/crypto/kyber1024.js';

async function simpleKyberTest() {
  console.log('🔍 Simple Kyber Test - Focus on Polynomial Recovery...\n');
  
  const kyber = new Kyber1024();
  
  try {
    // Generate key pair
    const keyPair = kyber.generateKeyPair();
    
    // Create a simple test message (all zeros except first byte)
    const testMessage = new Uint8Array(32);
    testMessage[0] = 170; // 10101010 in binary
    console.log('Test message (simple):', Array.from(testMessage.slice(0, 4)).join(', '));
    
    // Encode message
    const encodedMsg = kyber.encodeMessage(testMessage);
    console.log('Encoded first 8 coeffs:', Array.from(encodedMsg.slice(0, 8)).join(', '));
    
    // Now let's manually do a very simplified encapsulation
    // We'll skip most of the noise and matrix operations for debugging
    
    // Create minimal noise (mostly zeros)
    const e2 = new Uint16Array(kyber.n);
    for (let i = 0; i < kyber.n; i++) {
      e2[i] = 0; // No noise for debugging
    }
    
    // Create v = encodedMsg (no matrix operations for now)
    const v = new Uint16Array(kyber.n);
    for (let i = 0; i < kyber.n; i++) {
      v[i] = encodedMsg[i]; // Just the message, no matrix multiply
    }
    
    console.log('v first 8 coeffs:', Array.from(v.slice(0, 8)).join(', '));
    
    // Now decode v back to message
    const recoveredMsg = kyber.decodeMessage(v);
    console.log('Recovered message:', Array.from(recoveredMsg.slice(0, 4)).join(', '));
    
    // Check if they match
    const match = testMessage.every((byte, i) => byte === recoveredMsg[i]);
    console.log('Message recovery (no noise):', match ? '✅ SUCCESS' : '❌ FAILED');
    
    if (!match) {
      console.log('Original bits (byte 0):', testMessage[0].toString(2).padStart(8, '0'));
      console.log('Recovered bits (byte 0):', recoveredMsg[0].toString(2).padStart(8, '0'));
    }
    
  } catch (error) {
    console.error('❌ Simple test failed:', error);
  }
}

simpleKyberTest();