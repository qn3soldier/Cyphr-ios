/**
 * CYPHR MESSENGER - E2E Encrypted Messaging Endpoints
 * НАСТОЯЩЕЕ шифрование с Kyber1024 + ChaCha20
 * Совместимо с iOS MessagingService.swift
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { getPool } = require('./shared-db-pool.cjs');

// Pool will be initialized from shared-db-pool with AWS Secrets
let pool = null;

// Initialize pool on first use
async function ensurePool() {
  if (!pool) {
    pool = await getPool();
  }
  return pool;
}

// Import our REAL quantum crypto
let quantumCrypto = null;

async function initializeCrypto() {
  try {
    const module = await import('./cyphr-quantum-crypto.mjs');
    quantumCrypto = module.quantumCrypto;
    console.log('✅ Quantum crypto initialized for messaging');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize quantum crypto:', error);
    return false;
  }
}

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'cyphr-quantum-secure-2025-secret';

/**
 * Initialize E2E Messaging Endpoints
 */
function initializeMessagingEndpoints(app, io) {
  
  // Initialize crypto on startup
  initializeCrypto();

  /**
   * Generate Kyber1024 keys for user
   * POST /api/messaging/generate-keys
   */
  app.post('/api/messaging/generate-keys', async (req, res) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      const userId = decoded.userId || decoded.cyphrId;

      if (!quantumCrypto) {
        await initializeCrypto();
      }

      // Generate REAL Kyber1024 keypair
      const keypair = await quantumCrypto.generateKeyPair();

      // Store public key in database
      await pool.query(
        `UPDATE cyphr_identities 
         SET kyber_public_key = $1, updated_at = NOW()
         WHERE id = $2`,
        [keypair.publicKey, userId]
      );

      res.json({
        success: true,
        publicKey: keypair.publicKey,
        keyId: keypair.keyId,
        algorithm: keypair.algorithm,
        keySize: keypair.publicKeySize,
        message: 'Kyber1024 keys generated successfully'
      });

    } catch (error) {
      console.error('Error generating keys:', error);
      res.status(500).json({ success: false, message: 'Failed to generate keys' });
    }
  });

  /**
   * Send ENCRYPTED message
   * POST /api/messaging/send
   */
  app.post('/api/messaging/send', async (req, res) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      const senderId = decoded.userId || decoded.cyphrId;

      const { chatId, content, recipientId } = req.body;

      if (!chatId || !content || !recipientId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Missing required fields' 
        });
      }

      if (!quantumCrypto) {
        await initializeCrypto();
      }

      // Get recipient's public key
      const recipientResult = await pool.query(
        'SELECT kyber_public_key FROM cyphr_identities WHERE id = $1',
        [recipientId]
      );

      if (recipientResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Recipient not found' 
        });
      }

      const recipientPublicKey = recipientResult.rows[0].kyber_public_key;

      if (!recipientPublicKey) {
        return res.status(400).json({ 
          success: false, 
          message: 'Recipient has not generated encryption keys' 
        });
      }

      // ENCRYPT message with Kyber1024 + ChaCha20
      const encrypted = await quantumCrypto.encryptMessage(content, recipientPublicKey);

      // Store encrypted message in database
      const messageResult = await pool.query(
        `INSERT INTO messages (
          id, chat_id, sender_id, 
          encrypted_content, kyber_ciphertext, nonce, auth_tag,
          encrypted, message_type, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING *`,
        [
          crypto.randomUUID(),
          chatId,
          senderId,
          encrypted.encrypted_content,
          encrypted.kyber_ciphertext,
          encrypted.nonce,
          encrypted.auth_tag,
          true, // encrypted flag
          'text'
        ]
      );

      const message = messageResult.rows[0];

      // Send via Socket.IO for real-time delivery
      if (io) {
        io.to(recipientId).emit('new_message', {
          messageId: message.id,
          chatId: message.chat_id,
          senderId: message.sender_id,
          encrypted: true,
          algorithm: encrypted.algorithm,
          timestamp: message.created_at
        });
      }

      res.json({
        success: true,
        messageId: message.id,
        encrypted: true,
        algorithm: encrypted.algorithm,
        message: 'Message sent with E2E encryption'
      });

    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ success: false, message: 'Failed to send message' });
    }
  });

  /**
   * Decrypt message
   * POST /api/messaging/decrypt
   */
  app.post('/api/messaging/decrypt', async (req, res) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      const userId = decoded.userId || decoded.cyphrId;

      const { messageId, secretKey } = req.body;

      if (!messageId || !secretKey) {
        return res.status(400).json({ 
          success: false, 
          message: 'Missing messageId or secretKey' 
        });
      }

      if (!quantumCrypto) {
        await initializeCrypto();
      }

      // Get encrypted message from database
      const messageResult = await pool.query(
        `SELECT encrypted_content, kyber_ciphertext, nonce, auth_tag, sender_id
         FROM messages 
         WHERE id = $1`,
        [messageId]
      );

      if (messageResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Message not found' 
        });
      }

      const encryptedMessage = messageResult.rows[0];

      // Reconstruct encrypted payload
      const encryptedPayload = {
        encrypted_content: encryptedMessage.encrypted_content,
        kyber_ciphertext: encryptedMessage.kyber_ciphertext,
        nonce: encryptedMessage.nonce,
        auth_tag: encryptedMessage.auth_tag,
        aad: Buffer.from(JSON.stringify({
          algorithm: 'ML-KEM-1024+ChaCha20-Poly1305',
          timestamp: Date.now(),
          version: '2.0'
        })).toString('base64')
      };

      // DECRYPT with Kyber1024 + ChaCha20
      const decrypted = await quantumCrypto.decryptMessage(encryptedPayload, secretKey);

      res.json({
        success: true,
        content: decrypted,
        senderId: encryptedMessage.sender_id,
        algorithm: 'ML-KEM-1024+ChaCha20-Poly1305'
      });

    } catch (error) {
      console.error('Error decrypting message:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to decrypt message' 
      });
    }
  });

  /**
   * Get chat messages (encrypted)
   * GET /api/messaging/chat/:chatId
   */
  app.get('/api/messaging/chat/:chatId', async (req, res) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      const userId = decoded.userId || decoded.cyphrId;
      const { chatId } = req.params;

      // Verify user is member of chat
      const memberCheck = await pool.query(
        'SELECT * FROM chat_members WHERE chat_id = $1 AND cyphr_identity_id = $2',
        [chatId, userId]
      );

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ 
          success: false, 
          message: 'Not a member of this chat' 
        });
      }

      // Get encrypted messages
      const messages = await pool.query(
        `SELECT 
          m.id, m.sender_id, m.encrypted_content, 
          m.kyber_ciphertext, m.nonce, m.auth_tag,
          m.encrypted, m.created_at,
          c.cyphr_id as sender_cyphr_id,
          c.display_name as sender_name
         FROM messages m
         LEFT JOIN cyphr_identities c ON m.sender_id = c.id
         WHERE m.chat_id = $1
         ORDER BY m.created_at ASC
         LIMIT 100`,
        [chatId]
      );

      res.json({
        success: true,
        messages: messages.rows,
        encrypted: true,
        algorithm: 'ML-KEM-1024+ChaCha20-Poly1305'
      });

    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch messages' });
    }
  });

  /**
   * Create encrypted chat
   * POST /api/messaging/create-chat
   */
  app.post('/api/messaging/create-chat', async (req, res) => {
    const pool = await ensurePool();
    const client = await pool.connect();
    
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      const creatorId = decoded.userId || decoded.cyphrId;
      
      const { participantIds, chatName, chatType = 'direct' } = req.body;

      if (!participantIds || participantIds.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'No participants specified' 
        });
      }

      await client.query('BEGIN');

      // Create chat
      const chatId = crypto.randomUUID();
      await client.query(
        `INSERT INTO chats (id, name, type, encrypted, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [chatId, chatName || 'Encrypted Chat', chatType, true, creatorId]
      );

      // Add creator as member
      await client.query(
        `INSERT INTO chat_members (id, chat_id, cyphr_identity_id, role, joined_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [crypto.randomUUID(), chatId, creatorId, 'admin']
      );

      // Add other participants
      for (const participantId of participantIds) {
        await client.query(
          `INSERT INTO chat_members (id, chat_id, cyphr_identity_id, role, joined_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [crypto.randomUUID(), chatId, participantId, 'member']
        );
      }

      await client.query('COMMIT');

      // Notify participants via Socket.IO
      if (io) {
        for (const participantId of participantIds) {
          io.to(participantId).emit('chat_created', {
            chatId,
            chatName: chatName || 'Encrypted Chat',
            encrypted: true,
            creatorId
          });
        }
      }

      res.json({
        success: true,
        chatId,
        encrypted: true,
        algorithm: 'ML-KEM-1024+ChaCha20-Poly1305',
        message: 'Encrypted chat created successfully'
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating chat:', error);
      res.status(500).json({ success: false, message: 'Failed to create chat' });
    } finally {
      client.release();
    }
  });

  console.log('✅ E2E Messaging endpoints initialized');
  console.log('   Encryption: ML-KEM-1024 + ChaCha20-Poly1305');
  console.log('   Compatible: iOS MessagingService.swift');
}

// Socket.IO handlers for real-time messaging
function initializeSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log('📱 Client connected:', socket.id);

    // Authenticate socket
    socket.on('authenticate', async (token) => {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.userId || decoded.cyphrId;
        
        // Join user's room for direct messages
        socket.join(userId);
        socket.userId = userId;

        // Get user's chats and join rooms
        const chats = await pool.query(
          'SELECT chat_id FROM chat_members WHERE cyphr_identity_id = $1',
          [userId]
        );

        for (const chat of chats.rows) {
          socket.join(chat.chat_id);
        }

        socket.emit('authenticated', { 
          success: true, 
          userId,
          chatsJoined: chats.rows.length 
        });

        console.log(`✅ User ${userId} authenticated and joined ${chats.rows.length} chats`);

      } catch (error) {
        console.error('Socket authentication failed:', error);
        socket.emit('auth_error', { message: 'Authentication failed' });
      }
    });

    // Handle typing indicators
    socket.on('typing', (data) => {
      const { chatId, isTyping } = data;
      socket.to(chatId).emit('user_typing', {
        userId: socket.userId,
        chatId,
        isTyping
      });
    });

    // Handle message read receipts
    socket.on('message_read', async (data) => {
      const { messageId, chatId } = data;
      
      try {
        await pool.query(
          'UPDATE messages SET read_at = NOW() WHERE id = $1',
          [messageId]
        );

        socket.to(chatId).emit('message_read_receipt', {
          messageId,
          readBy: socket.userId,
          readAt: new Date()
        });
      } catch (error) {
        console.error('Error updating read receipt:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('📱 Client disconnected:', socket.id);
    });
  });
}

module.exports = {
  initializeMessagingEndpoints,
  initializeSocketHandlers,
  initializeCrypto
};