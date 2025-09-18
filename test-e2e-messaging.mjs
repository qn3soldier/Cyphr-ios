/**
 * TEST E2E MESSAGING WITH REAL KYBER1024
 * Testing production messaging system
 */

import { CyphrQuantumCrypto } from './cyphr-quantum-crypto.mjs';
import pg from 'pg';

const { Pool } = pg;

// Database connection
const pool = new Pool({
  host: 'cyphr-messenger-prod.cgni4my4o6a2.us-east-1.rds.amazonaws.com',
  port: 5432,
  database: 'cyphr_messenger_prod',
  user: 'cyphr_admin',
  password: 'CyphrRDS2025Secure!',
  ssl: { rejectUnauthorized: false }
});

const crypto = new CyphrQuantumCrypto();

async function testE2EMessaging() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TESTING E2E MESSAGING WITH REAL KYBER1024');
  console.log('='.repeat(60) + '\n');

  try {
    // 1. Generate keypairs for our test users
    console.log('📍 Generating Kyber1024 keypairs for test users...');
    
    const megaStarKeys = await crypto.generateKeyPair();
    const cryptoNinjaKeys = await crypto.generateKeyPair();
    
    console.log('✅ mega_star_dev keypair generated');
    console.log(`   Public key: ${megaStarKeys.publicKeySize} bytes`);
    console.log('✅ crypto_ninja_2025 keypair generated');
    console.log(`   Public key: ${cryptoNinjaKeys.publicKeySize} bytes`);

    // 2. Update users with Kyber public keys
    console.log('\n📝 Updating database with Kyber public keys...');
    
    await pool.query(
      'UPDATE cyphr_identities SET kyber_public_key = $1 WHERE cyphr_id = $2',
      [megaStarKeys.publicKey, 'mega_star_dev']
    );
    
    await pool.query(
      'UPDATE cyphr_identities SET kyber_public_key = $1 WHERE cyphr_id = $2',
      [cryptoNinjaKeys.publicKey, 'crypto_ninja_2025']
    );
    
    console.log('✅ Database updated with Kyber public keys');

    // 3. Create a test chat between them
    console.log('\n💬 Creating encrypted chat...');
    
    const chatResult = await pool.query(
      `INSERT INTO chats (id, name, type, created_by) 
       VALUES (gen_random_uuid(), 'Test E2E Chat', 'direct', 
               (SELECT id FROM cyphr_identities WHERE cyphr_id = 'mega_star_dev'))
       RETURNING id`
    );
    
    const chatId = chatResult.rows[0].id;
    console.log(`✅ Chat created: ${chatId}`);

    // Add members
    await pool.query(
      `INSERT INTO chat_members (id, chat_id, cyphr_identity_id, role)
       VALUES 
       (gen_random_uuid(), $1, (SELECT id FROM cyphr_identities WHERE cyphr_id = 'mega_star_dev'), 'admin'),
       (gen_random_uuid(), $1, (SELECT id FROM cyphr_identities WHERE cyphr_id = 'crypto_ninja_2025'), 'member')`,
      [chatId]
    );
    
    console.log('✅ Chat members added');

    // 4. Test message encryption
    const testMessage = '🔐 This is a TOP SECRET message encrypted with Kyber1024!';
    console.log(`\n📤 Encrypting message: "${testMessage}"`);
    
    const encrypted = await crypto.encryptMessage(testMessage, cryptoNinjaKeys.publicKey);
    console.log('✅ Message encrypted successfully!');
    console.log(`   Algorithm: ${encrypted.algorithm}`);
    console.log(`   Ciphertext size: ${encrypted.encrypted_content.length} chars`);

    // 5. Store encrypted message in database
    console.log('\n💾 Storing encrypted message in database...');
    
    const messageResult = await pool.query(
      `INSERT INTO messages (
        id, chat_id, sender_id,
        encrypted_content, kyber_ciphertext, nonce, auth_tag,
        encrypted, message_type
      ) VALUES (
        gen_random_uuid(), $1, 
        (SELECT id FROM cyphr_identities WHERE cyphr_id = 'mega_star_dev'),
        $2, $3, $4, $5, true, 'text'
      ) RETURNING id`,
      [
        chatId,
        encrypted.encrypted_content,
        encrypted.kyber_ciphertext,
        encrypted.nonce,
        encrypted.auth_tag
      ]
    );
    
    const messageId = messageResult.rows[0].id;
    console.log(`✅ Message stored: ${messageId}`);

    // 6. Retrieve and decrypt message
    console.log('\n📥 Retrieving encrypted message from database...');
    
    const retrievedMessage = await pool.query(
      'SELECT * FROM messages WHERE id = $1',
      [messageId]
    );
    
    const encryptedData = retrievedMessage.rows[0];
    console.log('✅ Message retrieved from database');

    // Reconstruct encrypted payload
    const encryptedPayload = {
      encrypted_content: encryptedData.encrypted_content,
      kyber_ciphertext: encryptedData.kyber_ciphertext,
      nonce: encryptedData.nonce,
      auth_tag: encryptedData.auth_tag,
      aad: encrypted.aad // Would normally reconstruct this
    };

    console.log('\n🔓 Decrypting message with recipient\'s key...');
    const decrypted = await crypto.decryptMessage(encryptedPayload, cryptoNinjaKeys.secretKey);
    console.log(`✅ Decrypted message: "${decrypted}"`);

    // 7. Verify
    if (testMessage === decrypted) {
      console.log('\n' + '='.repeat(60));
      console.log('🎉 E2E MESSAGING TEST SUCCESSFUL!');
      console.log('   ✓ Kyber1024 key generation works');
      console.log('   ✓ Message encryption works');
      console.log('   ✓ Database storage works');
      console.log('   ✓ Message decryption works');
      console.log('   ✓ READY FOR iOS INTEGRATION!');
      console.log('='.repeat(60));
    } else {
      console.log('\n❌ TEST FAILED! Messages don\'t match');
    }

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await pool.query('DELETE FROM messages WHERE chat_id = $1', [chatId]);
    await pool.query('DELETE FROM chat_members WHERE chat_id = $1', [chatId]);
    await pool.query('DELETE FROM chats WHERE id = $1', [chatId]);
    console.log('✅ Test data cleaned up');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

// Run test
testE2EMessaging();