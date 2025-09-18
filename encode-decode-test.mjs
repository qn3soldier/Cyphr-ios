// Test encode/decode message functions
import Kyber1024 from './src/api/crypto/kyber1024.js';

async function testEncodeDecode() {
  console.log('🔐 Testing Encode/Decode Message Functions...\n');
  
  const kyber = new Kyber1024();
  
  try {
    // Create a test message
    const originalMessage = new Uint8Array(32);
    crypto.getRandomValues(originalMessage);
    
    console.log('Original message:', Array.from(originalMessage.slice(0, 8)).join(', ') + '...');
    
    // Encode message to polynomial
    const encodedPoly = kyber.encodeMessage(originalMessage);
    console.log('Encoded polynomial sample:', Array.from(encodedPoly.slice(0, 8)).join(', ') + '...');
    
    // Decode polynomial back to message
    const decodedMessage = kyber.decodeMessage(encodedPoly);
    console.log('Decoded message:', Array.from(decodedMessage.slice(0, 8)).join(', ') + '...');
    
    // Compare messages
    const messagesMatch = originalMessage.length === decodedMessage.length &&
      originalMessage.every((byte, i) => byte === decodedMessage[i]);
    
    if (messagesMatch) {
      console.log('✅ ENCODE/DECODE WORKING CORRECTLY');
    } else {
      console.log('❌ ENCODE/DECODE FAILED');
      console.log('Original:', Array.from(originalMessage).join(', '));
      console.log('Decoded: ', Array.from(decodedMessage).join(', '));
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack:', error.stack);
  }
}

testEncodeDecode();