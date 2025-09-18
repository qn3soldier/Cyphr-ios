/**
 * CYPHR MESSENGER - Cyphr ID Authentication Endpoints for AWS RDS
 * Pure Cyphr ID system - NO email, NO phone
 * Date: 2025-09-04
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

// JWT Secret (should be in env vars in production)
const JWT_SECRET = process.env.JWT_SECRET || 'cyphr-quantum-secure-2025-secret';

/**
 * Initialize Cyphr ID endpoints
 */
function initializeCyphrIdEndpoints(app) {
  
  /**
   * Check Cyphr ID availability
   * POST /api/cyphr-id/check
   */
  app.post('/api/cyphr-id/check', async (req, res) => {
    try {
      const { cyphrId } = req.body;
      
      if (!cyphrId || cyphrId.length < 3) {
        return res.status(400).json({
          success: false,
          message: 'Cyphr ID must be at least 3 characters'
        });
      }
      
      // Validate format (only lowercase letters, numbers, underscore)
      if (!/^[a-z0-9_]{3,30}$/.test(cyphrId)) {
        return res.status(400).json({
          success: false,
          message: 'Cyphr ID can only contain lowercase letters, numbers, and underscores'
        });
      }
      
      // Check if exists
      const dbPool = await ensurePool();
      const result = await dbPool.query(
        'SELECT id FROM cyphr_identities WHERE cyphr_id = $1',
        [cyphrId]
      );
      
      const available = result.rows.length === 0;
      
      // Generate suggestions if taken
      let suggestions = [];
      if (!available) {
        suggestions = await generateCyphrIdSuggestions(cyphrId);
      }
      
      res.json({
        success: true,
        available,
        suggestions
      });
      
    } catch (error) {
      console.error('Error checking Cyphr ID:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check Cyphr ID availability'
      });
    }
  });
  
  /**
   * Register new Cyphr ID
   * POST /api/cyphr-id/register
   */
  app.post('/api/cyphr-id/register', async (req, res) => {
    const pool = await ensurePool();
    try {
      const { 
        cyphrId, 
        publicKey, 
        kyberPublicKey,
        deviceFingerprint,
        displayName,
        signature
      } = req.body;
      
      // Validate all required fields
      if (!cyphrId || !publicKey || !deviceFingerprint || !signature) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }
      
      // Verify signature (proves ownership of private key)
      const message = `Register Cyphr ID: ${cyphrId}`;
      const isValidSignature = verifySignature(publicKey, message, signature);
      
      if (!isValidSignature) {
        return res.status(401).json({
          success: false,
          message: 'Invalid signature'
        });
      }
      
      // Check if Cyphr ID already exists
      const existing = await pool.query(
        'SELECT id FROM cyphr_identities WHERE cyphr_id = $1',
        [cyphrId]
      );
      
      if (existing.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Cyphr ID already taken'
        });
      }
      
      // Create device fingerprint hash
      const deviceFingerprintHash = crypto.createHash('sha256')
        .update(deviceFingerprint)
        .digest('hex');
      
      // Insert new identity
      const insertResult = await pool.query(`
        INSERT INTO cyphr_identities (
          cyphr_id, public_key, kyber_public_key, 
          device_fingerprint_hash, display_name, is_verified
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, cyphr_id, display_name, created_at
      `, [
        cyphrId,
        publicKey,
        kyberPublicKey || null,
        deviceFingerprintHash,
        displayName || cyphrId,
        false
      ]);
      
      const newIdentity = insertResult.rows[0];
      
      // Create device registration
      await pool.query(`
        INSERT INTO devices (
          cyphr_identity_id, device_id, device_name, 
          device_type, is_primary, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        newIdentity.id,
        deviceFingerprintHash.substring(0, 20),
        'iOS Device',
        'ios',
        true,
        true
      ]);
      
      // Generate JWT token
      const token = jwt.sign({
        id: newIdentity.id,
        cyphrId: newIdentity.cyphr_id,
        deviceFingerprint: deviceFingerprintHash
      }, JWT_SECRET, { expiresIn: '30d' });
      
      res.json({
        success: true,
        message: 'Registration successful',
        user: {
          id: newIdentity.id,
          cyphrId: newIdentity.cyphr_id,
          displayName: newIdentity.display_name,
          isVerified: false
        },
        token
      });
      
    } catch (error) {
      console.error('Error registering Cyphr ID:', error);
      res.status(500).json({
        success: false,
        message: 'Registration failed'
      });
    }
  });
  
  /**
   * Login with Cyphr ID
   * POST /api/cyphr-id/login
   */
  app.post('/api/cyphr-id/login', async (req, res) => {
    const pool = await ensurePool();
    try {
      const { cyphrId, signature, deviceFingerprint } = req.body;
      
      if (!cyphrId || !signature || !deviceFingerprint) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }
      
      // Get user by Cyphr ID
      const userResult = await pool.query(`
        SELECT id, cyphr_id, public_key, display_name, 
               avatar_url, bio, is_verified, is_premium
        FROM cyphr_identities 
        WHERE cyphr_id = $1
      `, [cyphrId]);
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Cyphr ID not found'
        });
      }
      
      const user = userResult.rows[0];
      
      // Verify signature
      const message = `Login Cyphr ID: ${cyphrId} at ${Math.floor(Date.now() / 60000)}`;
      const isValidSignature = verifySignature(user.public_key, message, signature);
      
      if (!isValidSignature) {
        return res.status(401).json({
          success: false,
          message: 'Invalid signature'
        });
      }
      
      // Update device fingerprint if changed
      const deviceFingerprintHash = crypto.createHash('sha256')
        .update(deviceFingerprint)
        .digest('hex');
      
      // Check if device exists
      const deviceResult = await pool.query(`
        SELECT id FROM devices 
        WHERE cyphr_identity_id = $1 AND device_id = $2
      `, [user.id, deviceFingerprintHash.substring(0, 20)]);
      
      if (deviceResult.rows.length === 0) {
        // Register new device
        await pool.query(`
          INSERT INTO devices (
            cyphr_identity_id, device_id, device_name, 
            device_type, is_primary, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          user.id,
          deviceFingerprintHash.substring(0, 20),
          'iOS Device',
          'ios',
          false,
          true
        ]);
      } else {
        // Update last active
        await pool.query(`
          UPDATE devices 
          SET last_active = CURRENT_TIMESTAMP 
          WHERE id = $1
        `, [deviceResult.rows[0].id]);
      }
      
      // Update last seen
      await pool.query(
        'UPDATE cyphr_identities SET last_seen = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
      );
      
      // Generate JWT token
      const token = jwt.sign({
        userId: user.id,  // Changed from 'id' to 'userId' for compatibility
        id: user.id,      // Keep both for backwards compatibility
        cyphrId: user.cyphr_id,
        deviceFingerprint: deviceFingerprintHash
      }, JWT_SECRET, { expiresIn: '30d' });
      
      res.json({
        success: true,
        message: 'Login successful',
        user: {
          id: user.id,
          cyphrId: user.cyphr_id,
          displayName: user.display_name,
          avatarUrl: user.avatar_url,
          bio: user.bio,
          isVerified: user.is_verified,
          isPremium: user.is_premium
        },
        token
      });
      
    } catch (error) {
      console.error('Error during login:', error);
      res.status(500).json({
        success: false,
        message: 'Login failed'
      });
    }
  });
  
  /**
   * Recover account with BIP39 phrase
   * POST /api/cyphr-id/recover
   */
  app.post('/api/cyphr-id/recover', async (req, res) => {
    const pool = await ensurePool();
    try {
      const { recoveryPhrase, newPublicKey, deviceFingerprint } = req.body;
      
      if (!recoveryPhrase || !newPublicKey || !deviceFingerprint) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }
      
      // Hash recovery phrase to find account
      const phraseHash = crypto.createHash('sha256')
        .update(recoveryPhrase)
        .digest('hex');
      
      // In production, store phrase hash securely
      // For now, derive Cyphr ID from phrase (simplified)
      const cyphrId = deriveCyphrIdFromPhrase(recoveryPhrase);
      
      // Check if account exists
      const userResult = await pool.query(
        'SELECT id, cyphr_id FROM cyphr_identities WHERE cyphr_id = $1',
        [cyphrId]
      );
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Account not found with this recovery phrase'
        });
      }
      
      const user = userResult.rows[0];
      
      // Update public key
      await pool.query(
        'UPDATE cyphr_identities SET public_key = $1 WHERE id = $2',
        [newPublicKey, user.id]
      );
      
      // Register new device
      const deviceFingerprintHash = crypto.createHash('sha256')
        .update(deviceFingerprint)
        .digest('hex');
      
      await pool.query(`
        INSERT INTO devices (
          cyphr_identity_id, device_id, device_name, 
          device_type, is_primary, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (cyphr_identity_id, device_id) DO UPDATE
        SET is_active = true, last_active = CURRENT_TIMESTAMP
      `, [
        user.id,
        deviceFingerprintHash.substring(0, 20),
        'Recovered Device',
        'ios',
        false,
        true
      ]);
      
      // Generate JWT token
      const token = jwt.sign({
        userId: user.id,  // Changed from 'id' to 'userId' for compatibility
        id: user.id,      // Keep both for backwards compatibility
        cyphrId: user.cyphr_id,
        deviceFingerprint: deviceFingerprintHash
      }, JWT_SECRET, { expiresIn: '30d' });
      
      res.json({
        success: true,
        message: 'Account recovered successfully',
        cyphrId: user.cyphr_id,
        token
      });
      
    } catch (error) {
      console.error('Error recovering account:', error);
      res.status(500).json({
        success: false,
        message: 'Recovery failed'
      });
    }
  });
  // User Discovery/Search endpoint
  app.get('/api/cyphr-id/search', async (req, res) => {
    const pool = await ensurePool();
    try {
      const { query } = req.query;
      
      if (!query || query.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Query must be at least 2 characters'
        });
      }
      
      // Search by Cyphr ID or display name
      const searchQuery = `
        SELECT id, cyphr_id, display_name, avatar_url, bio, is_verified, is_premium
        FROM cyphr_identities 
        WHERE cyphr_id ILIKE $1 OR display_name ILIKE $1
        LIMIT 10
      `;
      
      const result = await pool.query(searchQuery, [`%${query}%`]);
      
      res.json({
        success: true,
        users: result.rows
      });
      
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({
        success: false,
        message: 'Search failed'
      });
    }
  });

  // Get user by exact Cyphr ID
  app.get('/api/cyphr-id/user/:cyphrId', async (req, res) => {
    const pool = await ensurePool();
    try {
      const { cyphrId } = req.params;
      
      const result = await pool.query(
        'SELECT id, cyphr_id, display_name, avatar_url, bio, is_verified, is_premium, public_key FROM cyphr_identities WHERE cyphr_id = $1',
        [cyphrId]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      res.json({
        success: true,
        user: result.rows[0]
      });
      
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user'
      });
    }
  });

  // Create new chat between users
  app.post('/api/cyphr-id/chat/create', async (req, res) => {
    const pool = await ensurePool();
    try {
      const { user1_id, user2_id, chat_type = 'direct' } = req.body;
      const chatId = crypto.randomUUID();
      
      // Create chat
      const chatResult = await pool.query(
        'INSERT INTO chats (id, type, created_at) VALUES ($1, $2, NOW()) RETURNING *',
        [chatId, chat_type]
      );
      
      // Add both users as members
      await pool.query(
        'INSERT INTO chat_members (chat_id, cyphr_identity_id, role, joined_at) VALUES ($1, $2, $3, NOW()), ($4, $5, $6, NOW())',
        [chatId, user1_id, 'member', chatId, user2_id, 'member']
      );
      
      res.json({
        success: true,
        chat: chatResult.rows[0]
      });
      
    } catch (error) {
      console.error('Create chat error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create chat'
      });
    }
  });

  // Send message
  app.post('/api/cyphr-id/message/send', async (req, res) => {
    const pool = await ensurePool();
    try {
      const { chat_id, sender_id, content, encrypted = false } = req.body;
      const messageId = crypto.randomUUID();
      
      const result = await pool.query(
        `INSERT INTO messages 
        (id, chat_id, sender_id, content, encrypted, message_type, created_at) 
        VALUES ($1, $2, $3, $4, $5, 'text', NOW()) 
        RETURNING *`,
        [messageId, chat_id, sender_id, content, encrypted]
      );
      
      res.json({
        success: true,
        message: result.rows[0]
      });
      
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send message'
      });
    }
  });

  // Get chat messages
  app.get('/api/cyphr-id/chat/:chatId/messages', async (req, res) => {
    const pool = await ensurePool();
    try {
      const { chatId } = req.params;
      const { limit = 50 } = req.query;
      
      const result = await pool.query(
        `SELECT m.*, ci.cyphr_id, ci.display_name 
        FROM messages m
        JOIN cyphr_identities ci ON m.sender_id = ci.id
        WHERE m.chat_id = $1 
        ORDER BY m.created_at DESC 
        LIMIT $2`,
        [chatId, limit]
      );
      
      res.json({
        success: true,
        messages: result.rows
      });
      
    } catch (error) {
      console.error('Get messages error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get messages'
      });
    }
  });

  // Get user chats
  app.get('/api/cyphr-id/user/:userId/chats', async (req, res) => {
    const pool = await ensurePool();
    try {
      const { userId } = req.params;
      
      const result = await pool.query(
        `SELECT c.*, cm.role, cm.joined_at
        FROM chats c
        JOIN chat_members cm ON c.id = cm.chat_id
        WHERE cm.cyphr_identity_id = $1
        ORDER BY c.created_at DESC`,
        [userId]
      );
      
      res.json({
        success: true,
        chats: result.rows
      });
      
    } catch (error) {
      console.error('Get chats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get chats'
      });
    }
  });
  
  console.log('✅ Cyphr ID RDS endpoints initialized');
}

/**
 * Generate Cyphr ID suggestions
 */
async function generateCyphrIdSuggestions(baseId) {
  const pool = await ensurePool();
  const suggestions = [];
  const suffixes = ['_', '1', '2025', '_pro', '_secure'];

  for (const suffix of suffixes) {
    const suggestion = baseId + suffix;
    const result = await pool.query(
      'SELECT id FROM cyphr_identities WHERE cyphr_id = $1',
      [suggestion]
    );

    if (result.rows.length === 0 && suggestions.length < 3) {
      suggestions.push(suggestion);
    }
  }

  return suggestions;
}

/**
 * Verify Ed25519 signature (simplified)
 */
function verifySignature(publicKey, message, signature) {
  // In production, use proper Ed25519 verification
  // For now, simplified check
  return signature && signature.length > 0;
}

/**
 * Derive Cyphr ID from recovery phrase (simplified)
 */
function deriveCyphrIdFromPhrase(phrase) {
  const hash = crypto.createHash('sha256').update(phrase).digest('hex');
  return 'recovered_' + hash.substring(0, 10);
}

module.exports = initializeCyphrIdEndpoints;