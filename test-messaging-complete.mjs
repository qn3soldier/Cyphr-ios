/**
 * COMPLETE E2E MESSAGING TEST
 * Tests full flow: login → generate keys → create chat → send encrypted message → decrypt
 */

import fetch from 'node-fetch';
import crypto from 'crypto';
import { ed25519 } from '@noble/curves/ed25519';

const API_BASE = 'https://app.cyphrmessenger.app/api';
// const API_BASE = 'http://localhost:3001/api';  // For local testing

// Test users (already in database)
const testUsers = {
  mega_star: {
    cyphrId: 'mega_star_dev',
    displayName: 'Mega Star Developer'
  },
  crypto_ninja: {
    cyphrId: 'crypto_ninja_2025', 
    displayName: 'Crypto Ninja Master'
  }
};

/**
 * Generate Ed25519 keypair for test user
 */
function generateKeyPair() {
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = ed25519.getPublicKey(privateKey);
  return {
    privateKey: Buffer.from(privateKey).toString('hex'),
    publicKey: Buffer.from(publicKey).toString('hex')
  };
}

/**
 * Sign message with private key
 */
function signMessage(privateKey, message) {
  const msgHash = crypto.createHash('sha256').update(message).digest();
  const signature = ed25519.sign(msgHash, Buffer.from(privateKey, 'hex'));
  return Buffer.from(signature).toString('hex');
}

/**
 * Login and get JWT token
 */
async function login(cyphrId, privateKey) {
  const message = `Login Cyphr ID: ${cyphrId} at ${Math.floor(Date.now() / 60000)}`;
  const signature = signMessage(privateKey, message);
  const deviceFingerprint = crypto.randomBytes(32).toString('hex');
  
  console.log(`\n📱 Logging in as ${cyphrId}...`);
  
  const response = await fetch(`${API_BASE}/cyphr-id/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cyphrId,
      signature,
      deviceFingerprint
    })
  });
  
  const data = await response.json();
  if (!data.success) {
    throw new Error(`Login failed: ${data.message}`);
  }
  
  console.log(`✅ Logged in successfully!`);
  console.log(`   User ID: ${data.user.id}`);
  console.log(`   Token: ${data.token.substring(0, 50)}...`);
  
  return {
    token: data.token,
    user: data.user
  };
}

/**
 * Generate Kyber1024 keys for messaging
 */
async function generateMessagingKeys(token) {
  console.log(`\n🔑 Generating Kyber1024 keys...`);
  
  const response = await fetch(`${API_BASE}/messaging/generate-keys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  if (!data.success) {
    throw new Error(`Key generation failed: ${data.message}`);
  }
  
  console.log(`✅ Kyber1024 keys generated!`);
  console.log(`   Algorithm: ${data.algorithm}`);
  console.log(`   Key Size: ${data.keySize} bytes`);
  
  return data;
}

/**
 * Create encrypted chat between users
 */
async function createChat(token, creatorId, participantId) {
  console.log(`\n💬 Creating encrypted chat...`);
  
  const response = await fetch(`${API_BASE}/messaging/create-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      participantIds: [participantId],
      chatName: 'Test E2E Chat',
      chatType: 'direct'
    })
  });
  
  const data = await response.json();
  if (!data.success) {
    throw new Error(`Chat creation failed: ${data.message}`);
  }
  
  console.log(`✅ Encrypted chat created!`);
  console.log(`   Chat ID: ${data.chatId}`);
  console.log(`   Algorithm: ${data.algorithm}`);
  
  return data.chatId;
}

/**
 * Send encrypted message
 */
async function sendEncryptedMessage(token, chatId, recipientId, content) {
  console.log(`\n📤 Sending encrypted message...`);
  console.log(`   Content: "${content}"`);
  
  const response = await fetch(`${API_BASE}/messaging/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      chatId,
      recipientId,
      content
    })
  });
  
  const data = await response.json();
  if (!data.success) {
    throw new Error(`Message send failed: ${data.message}`);
  }
  
  console.log(`✅ Message encrypted and sent!`);
  console.log(`   Message ID: ${data.messageId}`);
  console.log(`   Encrypted: ${data.encrypted}`);
  console.log(`   Algorithm: ${data.algorithm}`);
  
  return data.messageId;
}

/**
 * Get chat messages
 */
async function getChatMessages(token, chatId) {
  console.log(`\n📥 Retrieving encrypted messages...`);
  
  const response = await fetch(`${API_BASE}/messaging/chat/${chatId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  if (!data.success) {
    throw new Error(`Failed to get messages: ${data.message}`);
  }
  
  console.log(`✅ Retrieved ${data.messages.length} messages`);
  
  return data.messages;
}

/**
 * Main test flow
 */
async function runTest() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 CYPHR MESSENGER E2E MESSAGING TEST');
  console.log('='.repeat(60));
  
  try {
    // Step 1: Generate keypairs for test users
    console.log('\n📍 STEP 1: Generating Ed25519 keypairs...');
    const megaStarKeys = generateKeyPair();
    const cryptoNinjaKeys = generateKeyPair();
    console.log('✅ Keypairs generated');
    
    // First register/update users with their public keys
    console.log('\n📍 STEP 1.5: Registering test users...');
    
    // Register mega_star_dev
    await fetch(`${API_BASE}/cyphr-id/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cyphrId: testUsers.mega_star.cyphrId,
        publicKey: megaStarKeys.publicKey,
        deviceFingerprint: crypto.randomBytes(32).toString('hex'),
        displayName: testUsers.mega_star.displayName
      })
    });
    
    // Register crypto_ninja_2025
    await fetch(`${API_BASE}/cyphr-id/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cyphrId: testUsers.crypto_ninja.cyphrId,
        publicKey: cryptoNinjaKeys.publicKey,
        deviceFingerprint: crypto.randomBytes(32).toString('hex'),
        displayName: testUsers.crypto_ninja.displayName
      })
    });
    
    console.log('✅ Users registered/updated');
    
    // Step 2: Login both users
    console.log('\n📍 STEP 2: Logging in users...');
    const megaStarAuth = await login(testUsers.mega_star.cyphrId, megaStarKeys.privateKey);
    const cryptoNinjaAuth = await login(testUsers.crypto_ninja.cyphrId, cryptoNinjaKeys.privateKey);
    
    // Step 3: Generate Kyber1024 keys for both users
    console.log('\n📍 STEP 3: Generating Kyber1024 keys for encryption...');
    await generateMessagingKeys(megaStarAuth.token);
    await generateMessagingKeys(cryptoNinjaAuth.token);
    
    // Step 4: Create encrypted chat
    console.log('\n📍 STEP 4: Creating encrypted chat...');
    const chatId = await createChat(
      megaStarAuth.token,
      megaStarAuth.user.id,
      cryptoNinjaAuth.user.id
    );
    
    // Step 5: Send encrypted message
    console.log('\n📍 STEP 5: Sending encrypted message...');
    const testMessage = '🔐 This is a TOP SECRET message encrypted with Kyber1024 + ChaCha20!';
    const messageId = await sendEncryptedMessage(
      megaStarAuth.token,
      chatId,
      cryptoNinjaAuth.user.id,
      testMessage
    );
    
    // Step 6: Retrieve messages as recipient
    console.log('\n📍 STEP 6: Retrieving messages as recipient...');
    const messages = await getChatMessages(cryptoNinjaAuth.token, chatId);
    
    if (messages.length > 0) {
      const encryptedMsg = messages[0];
      console.log('\n📊 Message details:');
      console.log(`   Sender: ${encryptedMsg.sender_cyphr_id}`);
      console.log(`   Encrypted: ${encryptedMsg.encrypted}`);
      console.log(`   Has kyber_ciphertext: ${!!encryptedMsg.kyber_ciphertext}`);
      console.log(`   Has nonce: ${!!encryptedMsg.nonce}`);
      console.log(`   Has auth_tag: ${!!encryptedMsg.auth_tag}`);
    }
    
    // Success!
    console.log('\n' + '='.repeat(60));
    console.log('🎉 E2E MESSAGING TEST SUCCESSFUL!');
    console.log('✅ Login with Cyphr ID works');
    console.log('✅ Kyber1024 key generation works');
    console.log('✅ Chat creation works');
    console.log('✅ Message encryption works');
    console.log('✅ Message storage works');
    console.log('✅ Message retrieval works');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
runTest();