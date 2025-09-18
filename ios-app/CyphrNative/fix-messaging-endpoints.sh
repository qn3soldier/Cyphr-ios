#!/bin/bash

# Fix messaging endpoints to be zero-knowledge
# Server should only store and route encrypted blobs

ssh -i /Users/daniilbogdanov/cyphrmessenger/cyphr-messenger-key.pem ubuntu@23.22.159.209 << 'EOF'
cd /var/www/cyphr

# Create modified version
cat > cyphr-messaging-endpoints-fixed.cjs << 'ENDPOINTS'
/**
 * Zero-Knowledge Messaging Endpoints
 * Server stores and routes encrypted blobs only
 * All encryption happens on iOS with SwiftKyber
 */

const { pool } = require('./rds-service.cjs');
const crypto = require('crypto');

function initializeMessagingEndpoints(app, io) {
  console.log('📬 Initializing Zero-Knowledge Messaging Endpoints...');

  /**
   * Store public keys for message routing (NOT for encryption on server)
   */
  app.post('/api/messaging/store-public-key', async (req, res) => {
    try {
      const { userId, publicKey, kyberPublicKey } = req.body;

      await pool.query(
        `INSERT INTO user_keys (user_id, public_key, kyber_public_key, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id) 
         DO UPDATE SET public_key = $2, kyber_public_key = $3`,
        [userId, publicKey, kyberPublicKey]
      );

      res.json({ success: true });
    } catch (error) {
      console.error('Error storing public key:', error);
      res.status(500).json({ error: 'Failed to store public key' });
    }
  });

  /**
   * Store encrypted message - server CANNOT decrypt
   */
  app.post('/api/messaging/send', async (req, res) => {
    try {
      const { 
        senderId, 
        recipientId, 
        encryptedPayload,  // Already encrypted by iOS
        messageType = 'text'
      } = req.body;

      const messageId = crypto.randomUUID();

      // Get or create chat
      let chatResult = await pool.query(
        `SELECT id FROM chats 
         WHERE (user1_id = $1 AND user2_id = $2) 
         OR (user1_id = $2 AND user2_id = $1)`,
        [senderId, recipientId]
      );

      let chatId;
      if (chatResult.rows.length === 0) {
        const newChat = await pool.query(
          `INSERT INTO chats (id, user1_id, user2_id, created_at)
           VALUES ($1, $2, $3, NOW())
           RETURNING id`,
          [crypto.randomUUID(), senderId, recipientId]
        );
        chatId = newChat.rows[0].id;
      } else {
        chatId = chatResult.rows[0].id;
      }

      // Store encrypted payload
      await pool.query(
        `INSERT INTO messages (
          id, chat_id, sender_id, encrypted_content,
          message_type, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())`,
        [messageId, chatId, senderId, encryptedPayload, messageType]
      );

      // Notify recipient with encrypted payload
      io.to(recipientId).emit('new_message', {
        messageId,
        chatId,
        senderId,
        encryptedPayload,
        messageType,
        timestamp: Date.now()
      });

      res.json({ success: true, messageId, chatId });
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  /**
   * Get encrypted chat history
   */
  app.get('/api/messaging/chat/:chatId', async (req, res) => {
    try {
      const { chatId } = req.params;
      const { userId } = req.query;

      // Verify user is participant
      const chatCheck = await pool.query(
        `SELECT * FROM chats 
         WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)`,
        [chatId, userId]
      );

      if (chatCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Get encrypted messages
      const messages = await pool.query(
        `SELECT id, sender_id, encrypted_content, message_type, created_at
         FROM messages 
         WHERE chat_id = $1
         ORDER BY created_at DESC
         LIMIT 100`,
        [chatId]
      );

      res.json({
        success: true,
        messages: messages.rows
      });
    } catch (error) {
      console.error('Error fetching history:', error);
      res.status(500).json({ error: 'Failed to fetch history' });
    }
  });

  /**
   * Get public key for recipient (for iOS to encrypt)
   */
  app.get('/api/messaging/public-key/:userId', async (req, res) => {
    try {
      const { userId } = req.params;

      const result = await pool.query(
        `SELECT public_key, kyber_public_key 
         FROM user_keys 
         WHERE user_id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User keys not found' });
      }

      res.json({
        success: true,
        publicKey: result.rows[0].public_key,
        kyberPublicKey: result.rows[0].kyber_public_key
      });
    } catch (error) {
      console.error('Error fetching public key:', error);
      res.status(500).json({ error: 'Failed to fetch public key' });
    }
  });

  console.log('✅ Zero-Knowledge Messaging Endpoints initialized');
}

function initializeSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log('📱 Client connected:', socket.id);

    socket.on('authenticate', async (data) => {
      const { userId } = data;
      socket.userId = userId;
      socket.join(userId);
      console.log(`✅ User ${userId} authenticated`);
    });

    socket.on('disconnect', () => {
      console.log('📱 Client disconnected:', socket.id);
    });
  });
}

module.exports = {
  initializeMessagingEndpoints,
  initializeSocketHandlers
};
ENDPOINTS

# Replace old with new
mv cyphr-messaging-endpoints.cjs cyphr-messaging-endpoints.old.cjs
mv cyphr-messaging-endpoints-fixed.cjs cyphr-messaging-endpoints.cjs

echo "✅ Messaging endpoints fixed for zero-knowledge"

# Restart PM2
pm2 restart cyphr-backend
pm2 status
EOF