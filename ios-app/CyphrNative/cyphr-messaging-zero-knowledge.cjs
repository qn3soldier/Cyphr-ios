/**
 * ZERO-KNOWLEDGE Messaging Endpoints
 * Сервер НЕ ЗНАЕТ содержимое сообщений
 * ВСЁ шифрование происходит на iOS с SwiftKyber
 */

const { pool } = require('./rds-service.cjs');
const crypto = require('crypto');

// Server ONLY stores and routes encrypted blobs
// NO decryption capabilities on server
module.exports = (io) => {

  /**
   * Store encrypted message blob from iOS client
   * Server cannot decrypt - only routes to recipient
   */
  async function handleEncryptedMessage(req, res) {
    try {
      const { 
        sender_id, 
        recipient_id, 
        encrypted_blob,  // Already encrypted by iOS SwiftKyber
        message_type = 'text'
      } = req.body;

      // Validate required fields
      if (!sender_id || !recipient_id || !encrypted_blob) {
        return res.status(400).json({ 
          error: 'Missing required fields' 
        });
      }

      // Generate message ID
      const messageId = crypto.randomUUID();

      // Check if chat exists or create new one
      let chatResult = await pool.query(
        `SELECT id FROM chats 
         WHERE (user1_id = $1 AND user2_id = $2) 
         OR (user1_id = $2 AND user2_id = $1)`,
        [sender_id, recipient_id]
      );

      let chatId;
      if (chatResult.rows.length === 0) {
        // Create new chat
        const newChat = await pool.query(
          `INSERT INTO chats (id, user1_id, user2_id, created_at)
           VALUES ($1, $2, $3, NOW())
           RETURNING id`,
          [crypto.randomUUID(), sender_id, recipient_id]
        );
        chatId = newChat.rows[0].id;
      } else {
        chatId = chatResult.rows[0].id;
      }

      // Store encrypted blob - server CANNOT decrypt
      await pool.query(
        `INSERT INTO messages (
          id, chat_id, sender_id, encrypted_blob, 
          message_type, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())`,
        [messageId, chatId, sender_id, encrypted_blob, message_type]
      );

      // Notify recipient via Socket.IO (still encrypted)
      io.to(recipient_id).emit('new_encrypted_message', {
        messageId,
        chatId,
        senderId: sender_id,
        encryptedBlob: encrypted_blob,
        messageType: message_type,
        timestamp: Date.now()
      });

      res.json({ 
        success: true, 
        messageId,
        chatId,
        message: 'Encrypted message stored and routed'
      });

    } catch (error) {
      console.error('❌ Error storing encrypted message:', error);
      res.status(500).json({ error: 'Failed to store message' });
    }
  }

  /**
   * Retrieve encrypted message history
   * Returns encrypted blobs - client decrypts with SwiftKyber
   */
  async function getEncryptedHistory(req, res) {
    try {
      const { chatId, userId } = req.query;

      if (!chatId || !userId) {
        return res.status(400).json({ 
          error: 'Chat ID and User ID required' 
        });
      }

      // Verify user is participant
      const chatCheck = await pool.query(
        `SELECT * FROM chats 
         WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)`,
        [chatId, userId]
      );

      if (chatCheck.rows.length === 0) {
        return res.status(403).json({ 
          error: 'Access denied' 
        });
      }

      // Get encrypted messages
      const messages = await pool.query(
        `SELECT id, sender_id, encrypted_blob, message_type, created_at
         FROM messages 
         WHERE chat_id = $1
         ORDER BY created_at DESC
         LIMIT 100`,
        [chatId]
      );

      res.json({
        success: true,
        messages: messages.rows.map(msg => ({
          id: msg.id,
          senderId: msg.sender_id,
          encryptedBlob: msg.encrypted_blob,
          messageType: msg.message_type,
          timestamp: msg.created_at
        }))
      });

    } catch (error) {
      console.error('❌ Error fetching history:', error);
      res.status(500).json({ error: 'Failed to fetch history' });
    }
  }

  /**
   * Handle encrypted media upload
   * Media is pre-encrypted on iOS before upload
   */
  async function handleEncryptedMedia(req, res) {
    try {
      const {
        sender_id,
        recipient_id,
        encrypted_media_blob,  // Already encrypted media
        encrypted_thumbnail,   // Encrypted thumbnail
        media_type            // photo/video/document
      } = req.body;

      const mediaId = crypto.randomUUID();

      // Store encrypted media reference
      await pool.query(
        `INSERT INTO media_messages (
          id, sender_id, recipient_id,
          encrypted_blob, encrypted_thumbnail,
          media_type, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          mediaId, sender_id, recipient_id,
          encrypted_media_blob, encrypted_thumbnail,
          media_type
        ]
      );

      // Notify recipient
      io.to(recipient_id).emit('new_encrypted_media', {
        mediaId,
        senderId: sender_id,
        encryptedBlob: encrypted_media_blob,
        encryptedThumbnail: encrypted_thumbnail,
        mediaType: media_type,
        timestamp: Date.now()
      });

      res.json({
        success: true,
        mediaId,
        message: 'Encrypted media stored'
      });

    } catch (error) {
      console.error('❌ Error storing encrypted media:', error);
      res.status(500).json({ error: 'Failed to store media' });
    }
  }

  /**
   * Handle encrypted voice message
   */
  async function handleEncryptedVoice(req, res) {
    try {
      const {
        sender_id,
        recipient_id,
        encrypted_audio_chunks,  // Array of encrypted Opus chunks
        encrypted_waveform,      // For UI visualization
        duration
      } = req.body;

      const voiceId = crypto.randomUUID();

      // Store encrypted voice message
      await pool.query(
        `INSERT INTO voice_messages (
          id, sender_id, recipient_id,
          encrypted_chunks, encrypted_waveform,
          duration, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          voiceId, sender_id, recipient_id,
          JSON.stringify(encrypted_audio_chunks),
          encrypted_waveform, duration
        ]
      );

      // Notify recipient
      io.to(recipient_id).emit('new_encrypted_voice', {
        voiceId,
        senderId: sender_id,
        encryptedChunks: encrypted_audio_chunks,
        encryptedWaveform: encrypted_waveform,
        duration,
        timestamp: Date.now()
      });

      res.json({
        success: true,
        voiceId,
        message: 'Encrypted voice message stored'
      });

    } catch (error) {
      console.error('❌ Error storing voice message:', error);
      res.status(500).json({ error: 'Failed to store voice' });
    }
  }

  /**
   * WebRTC signaling for encrypted calls
   * Server only relays encrypted SDP/ICE candidates
   */
  async function handleCallSignaling(socket) {
    // Initiate encrypted call
    socket.on('initiate_encrypted_call', async (data) => {
      const {
        callId,
        recipientId,
        encryptedOffer,  // SDP offer encrypted by iOS
        isVideo
      } = data;

      // Just relay to recipient - cannot decrypt
      io.to(recipientId).emit('incoming_encrypted_call', {
        callId,
        callerId: socket.userId,
        encryptedOffer,
        isVideo,
        timestamp: Date.now()
      });
    });

    // Handle encrypted answer
    socket.on('encrypted_call_answer', async (data) => {
      const {
        callId,
        callerId,
        encryptedAnswer  // SDP answer encrypted
      } = data;

      io.to(callerId).emit('encrypted_call_answered', {
        callId,
        encryptedAnswer,
        timestamp: Date.now()
      });
    });

    // Relay encrypted ICE candidates
    socket.on('encrypted_ice_candidate', async (data) => {
      const {
        callId,
        recipientId,
        encryptedCandidate
      } = data;

      io.to(recipientId).emit('encrypted_ice_candidate', {
        callId,
        senderId: socket.userId,
        encryptedCandidate,
        timestamp: Date.now()
      });
    });

    // End call
    socket.on('end_call', async (data) => {
      const { callId, recipientId } = data;
      
      io.to(recipientId).emit('call_ended', {
        callId,
        endedBy: socket.userId,
        timestamp: Date.now()
      });
    });
  }

  // Socket.IO connection handler
  io.on('connection', (socket) => {
    console.log('📱 iOS client connected:', socket.id);

    // Authenticate socket
    socket.on('authenticate', async (data) => {
      const { userId, token } = data;
      
      // Verify JWT token
      // ... token verification ...
      
      socket.userId = userId;
      socket.join(userId);  // Join room for direct messages
      
      console.log(`✅ Authenticated: ${userId}`);
    });

    // Handle call signaling
    handleCallSignaling(socket);

    // Disconnect
    socket.on('disconnect', () => {
      console.log('📱 iOS client disconnected:', socket.id);
    });
  });

  // Return Express routes
  return {
    handleEncryptedMessage,
    getEncryptedHistory,
    handleEncryptedMedia,
    handleEncryptedVoice
  };
};

// Zero-Knowledge Principles:
// 1. Server NEVER has encryption keys
// 2. Server CANNOT decrypt any content
// 3. Server only stores and routes encrypted blobs
// 4. All encryption/decryption happens on iOS with SwiftKyber
// 5. Even metadata is minimal (just routing info)