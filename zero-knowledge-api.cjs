/**
 * ZERO-KNOWLEDGE USER DISCOVERY API
 * Server-side implementation following Signal's Private Contact Discovery
 * 
 * This file should be integrated into server.cjs
 */

const crypto = require('crypto');

// Quantum-safe phone number hashing (matches frontend)
function hashPhoneQuantumSafe(phoneNumber) {
  // Use SHA-3 for quantum resistance
  const hash = crypto.createHash('sha3-256');
  hash.update(phoneNumber + 'cyphr-salt-2025'); // Add app-specific salt
  return hash.digest('hex');
}

// Normalize phone to E.164 format
function normalizePhoneNumber(phoneNumber) {
  let digits = phoneNumber.replace(/\D/g, '');
  if (!digits.startsWith('1') && digits.length === 10) {
    digits = '1' + digits;
  }
  return '+' + digits;
}

/**
 * CREATE ZERO-KNOWLEDGE API ENDPOINTS
 * These endpoints should be added to server.cjs
 */
function createZeroKnowledgeEndpoints(app, supabase) {
  
  /**
   * SIGNAL-STYLE PRIVATE CONTACT DISCOVERY
   * POST /api/discover-contacts
   * Body: { phoneHashes: ["hash1", "hash2", ...] }
   */
  app.post('/api/discover-contacts', async (req, res) => {
    try {
      const { phoneHashes } = req.body;
      
      if (!phoneHashes || !Array.isArray(phoneHashes)) {
        return res.status(400).json({
          success: false,
          error: 'phoneHashes array required'
        });
      }

      // Limit to prevent abuse
      if (phoneHashes.length > 100) {
        return res.status(400).json({
          success: false,
          error: 'Too many contacts (max 100)'
        });
      }

      console.log('🔍 Contact discovery for', phoneHashes.length, 'hashed contacts');

      // Query database with hashes only
      const { data: users, error } = await supabase
        .from('users')
        .select(`
          id,
          phone_hash,
          full_name,
          avatar_url,
          bio,
          unique_id,
          status,
          public_key,
          last_seen
        `)
        .in('phone_hash', phoneHashes)
        .eq('status', 'active')
        .eq('discoverable_by_phone', true); // Respect privacy settings

      if (error) {
        console.error('❌ Contact discovery database error:', error);
        return res.status(500).json({
          success: false,
          error: 'Database query failed'
        });
      }

      console.log('✅ Found', users?.length || 0, 'discoverable users');

      res.json({
        success: true,
        users: users || [],
        found: users?.length || 0
      });

    } catch (error) {
      console.error('❌ Contact discovery endpoint error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * TELEGRAM-STYLE USERNAME SEARCH
   * GET /api/search-users?q=username
   */
  app.get('/api/search-users', async (req, res) => {
    try {
      const { q: query } = req.query;
      
      if (!query || query.length < 2) {
        return res.json({
          success: true,
          users: [],
          message: 'Query too short'
        });
      }

      console.log('🔍 Username search for:', query);

      // Determine search type
      const isPhoneNumber = /^\+?[\d\s\-\(\)]+$/.test(query);
      
      let users = [];
      
      if (isPhoneNumber) {
        // Hash phone number and search
        const normalized = normalizePhoneNumber(query);
        const phoneHash = hashPhoneQuantumSafe(normalized);
        
        const { data, error } = await supabase
          .from('users')
          .select(`
            id,
            unique_id,
            full_name,
            avatar_url,
            bio,
            status,
            public_key,
            last_seen
          `)
          .eq('phone_hash', phoneHash)
          .eq('status', 'active')
          .eq('discoverable_by_phone', true);
          
        if (!error && data) {
          users = data;
        }
      } else {
        // Username search
        const { data, error } = await supabase
          .from('users')
          .select(`
            id,
            unique_id,
            full_name,
            avatar_url,
            bio,
            status,
            public_key,
            last_seen
          `)
          .ilike('unique_id', `%${query}%`)
          .eq('status', 'active')
          .eq('discoverable_by_username', true)
          .limit(10);
          
        if (!error && data) {
          users = data;
        }
      }

      console.log('✅ Search found', users.length, 'users');

      res.json({
        success: true,
        users: users,
        query: query,
        type: isPhoneNumber ? 'phone' : 'username'
      });

    } catch (error) {
      console.error('❌ User search endpoint error:', error);
      res.status(500).json({
        success: false,
        error: 'Search failed'
      });
    }
  });

  /**
   * PRIVACY SETTINGS UPDATE
   * POST /api/privacy-settings
   * Body: { discoverableByPhone: true, discoverableByUsername: true }
   */
  app.post('/api/privacy-settings', authenticateJWT, async (req, res) => {
    try {
      const { userId } = req.user;
      const { discoverableByPhone, discoverableByUsername } = req.body;
      
      console.log('🔒 Updating privacy settings for user:', userId);

      const { data, error } = await supabase
        .from('users')
        .update({
          discoverable_by_phone: discoverableByPhone ?? true,
          discoverable_by_username: discoverableByUsername ?? true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.error('❌ Privacy settings update error:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to update privacy settings'
        });
      }

      console.log('✅ Privacy settings updated successfully');

      res.json({
        success: true,
        message: 'Privacy settings updated',
        settings: {
          discoverableByPhone,
          discoverableByUsername
        }
      });

    } catch (error) {
      console.error('❌ Privacy settings endpoint error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * GET USER BY ID (for messaging)
   * GET /api/user/:userId
   */
  app.get('/api/user/:userId', authenticateJWT, async (req, res) => {
    try {
      const { userId } = req.params;
      
      console.log('🔍 Getting user info for:', userId);

      const { data: user, error } = await supabase
        .from('users')
        .select(`
          id,
          unique_id,
          full_name,
          avatar_url,
          bio,
          status,
          public_key,
          last_seen,
          created_at
        `)
        .eq('id', userId)
        .single();

      if (error || !user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      res.json({
        success: true,
        user: user
      });

    } catch (error) {
      console.error('❌ Get user endpoint error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  });

}

module.exports = {
  createZeroKnowledgeEndpoints,
  hashPhoneQuantumSafe,
  normalizePhoneNumber
};