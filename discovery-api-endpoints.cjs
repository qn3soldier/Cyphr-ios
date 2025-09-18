/**
 * 🚀 CYPHR DISCOVERY API ENDPOINTS
 * Revolutionary user discovery system API
 * Supporting all 6 discovery methods
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const QRCode = require('qrcode');
const crypto = require('crypto');

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://fkhwhplufjzlicccgbrf.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZraHdocGx1Zmp6bGljY2NnYnJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTg0MzU0MiwiZXhwIjoyMDY3NDE5NTQyfQ.4WF2pYzJIeXIaKo_JnMx6QI5zF0FKa8_LZgCsqf4H8s'
);

/**
 * 🆔 CYPHR ID ENDPOINTS
 */

// Check if Cyphr ID is available
async function checkCyphrIdAvailable(req, res) {
  try {
    const { cyphrId } = req.body;
    
    if (!cyphrId) {
      return res.status(400).json({ success: false, error: 'Cyphr ID required' });
    }

    // Clean cyphr ID
    const cleanId = cyphrId.replace('@', '').toLowerCase().trim();
    
    // Validate format
    if (!/^[a-z0-9_]{3,20}$/.test(cleanId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid format. Use 3-20 characters: letters, numbers, underscores only.' 
      });
    }

    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('cyphr_id', cleanId)
      .limit(1);

    if (error) throw error;

    const available = !data || data.length === 0;
    const suggestions = available ? [] : generateCyphrIdSuggestions(cleanId);

    res.json({ 
      success: true,
      available,
      cyphrId: `@${cleanId}`,
      suggestions 
    });
  } catch (error) {
    console.error('❌ Error checking Cyphr ID:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Set user's Cyphr ID
async function setCyphrId(req, res) {
  try {
    const { cyphrId } = req.body;
    const userId = req.user?.id || req.headers['x-user-id']; // From JWT middleware
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (!cyphrId) {
      return res.status(400).json({ success: false, error: 'Cyphr ID required' });
    }

    const cleanId = cyphrId.replace('@', '').toLowerCase().trim();
    
    // Validate format
    if (!/^[a-z0-9_]{3,20}$/.test(cleanId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid format. Use 3-20 characters: letters, numbers, underscores only.' 
      });
    }

    // Check if user can change Cyphr ID (once per month)
    const { data: userData } = await supabase
      .from('users')
      .select('cyphr_id_changed_at')
      .eq('id', userId)
      .single();

    if (userData?.cyphr_id_changed_at) {
      const lastChange = new Date(userData.cyphr_id_changed_at);
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      
      if (lastChange > monthAgo) {
        return res.status(429).json({ 
          success: false, 
          error: 'Cyphr ID can only be changed once per month' 
        });
      }
    }

    // Check availability
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('cyphr_id', cleanId)
      .limit(1);

    if (existingUser && existingUser.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cyphr ID not available',
        suggestions: generateCyphrIdSuggestions(cleanId)
      });
    }

    // Update user record
    const { error } = await supabase
      .from('users')
      .update({ 
        cyphr_id: cleanId,
        cyphr_id_changed_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) throw error;

    console.log(`✅ User ${userId} set Cyphr ID: @${cleanId}`);
    res.json({ 
      success: true, 
      cyphrId: `@${cleanId}`,
      message: 'Cyphr ID set successfully'
    });
  } catch (error) {
    console.error('❌ Error setting Cyphr ID:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Search by Cyphr ID
async function searchByCyphrId(req, res) {
  try {
    const { cyphrId } = req.params;
    const cleanId = cyphrId.replace('@', '').toLowerCase().trim();
    
    const { data, error } = await supabase
      .from('users')
      .select('id, cyphr_id, full_name, avatar_url, bio, status')
      .eq('cyphr_id', cleanId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    const user = data ? {
      ...data,
      cyphr_id: `@${data.cyphr_id}`
    } : null;

    res.json({
      success: true,
      user: user,
      found: !!user
    });
  } catch (error) {
    console.error('❌ Error searching by Cyphr ID:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * 📱 QR CODE ENDPOINTS
 */

// Generate QR code token
async function generateQRToken(req, res) {
  try {
    const userId = req.user?.id || req.headers['x-user-id'];
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Generate unique token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry

    // Store in discovery_tokens table
    const { error } = await supabase
      .from('discovery_tokens')
      .insert({
        user_id: userId,
        token_type: 'qr',
        token_value: token,
        expires_at: expiresAt.toISOString()
      });

    if (error) throw error;

    // Generate QR code data
    const qrData = {
      type: 'cyphr_add',
      token: token,
      expires: expiresAt.getTime(),
      app: 'cyphr'
    };

    const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData), {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      width: 256,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    console.log(`✅ Generated QR code for user ${userId}, expires: ${expiresAt}`);
    
    res.json({
      success: true,
      qrCode: qrCodeDataURL,
      token: token,
      expiresAt: expiresAt.toISOString(),
      duration: '1 hour'
    });
  } catch (error) {
    console.error('❌ Error generating QR token:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Scan QR code token
async function scanQRToken(req, res) {
  try {
    const { qrData } = req.body;
    
    if (!qrData) {
      return res.status(400).json({ success: false, error: 'QR data required' });
    }

    const data = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
    
    if (data.type !== 'cyphr_add') {
      return res.status(400).json({ success: false, error: 'Invalid QR code type' });
    }

    // Check if token is expired
    if (Date.now() > data.expires) {
      return res.status(400).json({ success: false, error: 'QR code has expired' });
    }

    // Get user from token
    const { data: tokenData, error } = await supabase
      .from('discovery_tokens')
      .select(`
        user_id,
        users(id, cyphr_id, full_name, avatar_url, bio, status)
      `)
      .eq('token_value', data.token)
      .eq('token_type', 'qr')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !tokenData) {
      return res.status(400).json({ success: false, error: 'Invalid or expired QR code' });
    }

    const user = {
      ...tokenData.users,
      cyphr_id: tokenData.users.cyphr_id ? `@${tokenData.users.cyphr_id}` : null
    };

    console.log(`✅ QR code scanned successfully for user ${user.id}`);

    res.json({
      success: true,
      user: user,
      method: 'qr_code'
    });
  } catch (error) {
    console.error('❌ Error scanning QR token:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * 🔗 SHARE LINK ENDPOINTS
 */

// Generate share link
async function generateShareLink(req, res) {
  try {
    const userId = req.user?.id || req.headers['x-user-id'];
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('cyphr_id, share_link_enabled')
      .eq('id', userId)
      .single();

    if (!userData?.share_link_enabled) {
      return res.status(403).json({ success: false, error: 'Share links are disabled' });
    }

    if (!userData.cyphr_id) {
      return res.status(400).json({ success: false, error: 'Cyphr ID required for share links' });
    }

    const shareLink = `https://cyphr.me/add/${userData.cyphr_id}`;
    
    res.json({
      success: true,
      shareLink: shareLink,
      cyphrId: `@${userData.cyphr_id}`,
      qrLink: `https://app.cyphrmessenger.app/add/${userData.cyphr_id}`
    });
  } catch (error) {
    console.error('❌ Error generating share link:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Resolve share link profile
async function getShareProfile(req, res) {
  try {
    const { cyphrId } = req.params;
    const cleanId = cyphrId.replace('@', '').toLowerCase();
    
    const { data, error } = await supabase
      .from('users')
      .select('id, cyphr_id, full_name, avatar_url, bio, share_link_enabled')
      .eq('cyphr_id', cleanId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    if (!data || !data.share_link_enabled) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found or share links disabled' 
      });
    }

    const user = {
      ...data,
      cyphr_id: `@${data.cyphr_id}`
    };

    res.json({
      success: true,
      user: user,
      method: 'share_link'
    });
  } catch (error) {
    console.error('❌ Error resolving share profile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * 🗺️ NEARBY DISCOVERY ENDPOINTS
 */

// Enable nearby discovery
async function enableNearbyDiscovery(req, res) {
  try {
    const userId = req.user?.id || req.headers['x-user-id'];
    const { durationMinutes = 10, regionHash } = req.body;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Check if user has nearby discovery enabled
    const { data: userData } = await supabase
      .from('users')
      .select('nearby_discovery_enabled')
      .eq('id', userId)
      .single();

    if (!userData?.nearby_discovery_enabled) {
      return res.status(403).json({ 
        success: false, 
        error: 'Nearby discovery is disabled in your settings' 
      });
    }

    // Generate region hash if not provided
    const finalRegionHash = regionHash || generateRegionHash();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + Math.min(durationMinutes, 30)); // Max 30 minutes

    const { error } = await supabase
      .from('nearby_discovery')
      .insert({
        user_id: userId,
        region_hash: finalRegionHash,
        expires_at: expiresAt.toISOString()
      });

    if (error) throw error;

    console.log(`✅ User ${userId} enabled nearby discovery for ${durationMinutes} minutes`);

    res.json({
      success: true,
      visible: true,
      expiresAt: expiresAt.toISOString(),
      duration: durationMinutes,
      regionHash: finalRegionHash
    });
  } catch (error) {
    console.error('❌ Error enabling nearby discovery:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Get nearby users
async function getNearbyUsers(req, res) {
  try {
    const userId = req.user?.id || req.headers['x-user-id'];
    const { regionHash } = req.query;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (!regionHash) {
      return res.status(400).json({ success: false, error: 'Region hash required' });
    }

    const { data, error } = await supabase
      .from('nearby_discovery')
      .select(`
        user_id,
        users(id, cyphr_id, full_name, avatar_url, bio)
      `)
      .eq('region_hash', regionHash)
      .neq('user_id', userId)
      .gt('expires_at', new Date().toISOString());

    if (error) throw error;

    const users = data?.map(item => ({
      ...item.users,
      cyphr_id: item.users.cyphr_id ? `@${item.users.cyphr_id}` : null
    })) || [];

    res.json({
      success: true,
      users: users,
      count: users.length,
      method: 'nearby_discovery'
    });
  } catch (error) {
    console.error('❌ Error getting nearby users:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * 📞 PHONE DISCOVERY ENDPOINTS
 */

// Enable phone discovery
async function enablePhoneDiscovery(req, res) {
  try {
    const userId = req.user?.id || req.headers['x-user-id'];
    const { phoneNumber } = req.body;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (!phoneNumber) {
      return res.status(400).json({ success: false, error: 'Phone number required' });
    }

    const phoneHash = await createPhoneHash(phoneNumber);

    const { error } = await supabase
      .from('phone_hashes')
      .upsert({
        user_id: userId,
        phone_hash: phoneHash
      });

    if (error) throw error;

    // Update user preference
    await supabase
      .from('users')
      .update({ phone_discovery_enabled: true })
      .eq('id', userId);

    console.log(`✅ User ${userId} enabled phone discovery`);

    res.json({ 
      success: true,
      message: 'Phone discovery enabled'
    });
  } catch (error) {
    console.error('❌ Error enabling phone discovery:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Search by phone hash
async function searchByPhoneHash(req, res) {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ success: false, error: 'Phone number required' });
    }

    const phoneHash = await createPhoneHash(phoneNumber);

    const { data, error } = await supabase
      .from('phone_hashes')
      .select(`
        user_id,
        users(id, cyphr_id, full_name, avatar_url, phone_discovery_enabled)
      `)
      .eq('phone_hash', phoneHash)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    if (!data?.users?.phone_discovery_enabled) {
      return res.json({ 
        success: true, 
        user: null,
        message: 'User not found or phone discovery disabled'
      });
    }

    const user = {
      ...data.users,
      cyphr_id: data.users.cyphr_id ? `@${data.users.cyphr_id}` : null
    };

    res.json({
      success: true,
      user: user,
      method: 'phone_discovery'
    });
  } catch (error) {
    console.error('❌ Error searching by phone:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * ⚙️ SETTINGS ENDPOINTS
 */

// Update discovery settings
async function updateDiscoverySettings(req, res) {
  try {
    const userId = req.user?.id || req.headers['x-user-id'];
    const { phoneDiscovery, nearbyDiscovery, shareLinks } = req.body;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const allowedSettings = {};
    if (typeof phoneDiscovery === 'boolean') allowedSettings.phone_discovery_enabled = phoneDiscovery;
    if (typeof nearbyDiscovery === 'boolean') allowedSettings.nearby_discovery_enabled = nearbyDiscovery;
    if (typeof shareLinks === 'boolean') allowedSettings.share_link_enabled = shareLinks;

    const { error } = await supabase
      .from('users')
      .update(allowedSettings)
      .eq('id', userId);

    if (error) throw error;

    console.log(`✅ User ${userId} updated discovery settings:`, allowedSettings);

    res.json({ 
      success: true,
      settings: allowedSettings,
      message: 'Discovery settings updated'
    });
  } catch (error) {
    console.error('❌ Error updating discovery settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * HELPER FUNCTIONS
 */

function generateCyphrIdSuggestions(baseCyphrId) {
  const suggestions = [];
  const suffixes = ['_2025', '_crypto', '_quantum', '_secure', '_pro'];
  const numbers = ['2', '7', '13', '42', '99'];
  
  suffixes.forEach(suffix => {
    suggestions.push(`${baseCyphrId}${suffix}`);
  });
  
  numbers.forEach(num => {
    suggestions.push(`${baseCyphrId}${num}`);
  });

  return suggestions.slice(0, 5);
}

async function createPhoneHash(phoneNumber) {
  // Triple-hash cascade for privacy
  const data = Buffer.from(phoneNumber, 'utf8');
  
  // First hash: SHA-256
  const firstHash = crypto.createHash('sha256').update(data).digest();
  
  // Second hash: SHA-256 again
  const secondHash = crypto.createHash('sha256').update(firstHash).digest();
  
  // Third hash: SHA-256 final
  const finalHash = crypto.createHash('sha256').update(secondHash).digest('hex');
  
  return finalHash;
}

function generateRegionHash() {
  // Generate approximate region hash without exact location
  const regions = ['north', 'south', 'east', 'west', 'central'];
  const randomRegion = regions[Math.floor(Math.random() * regions.length)];
  const timestamp = Math.floor(Date.now() / (1000 * 60 * 10)); // 10-minute blocks
  
  return `region_${randomRegion}_${timestamp}`;
}

/**
 * CLEANUP FUNCTION
 */
async function cleanupExpiredTokens() {
  try {
    await supabase
      .from('discovery_tokens')
      .delete()
      .lt('expires_at', new Date().toISOString());

    await supabase
      .from('nearby_discovery')
      .delete()
      .lt('expires_at', new Date().toISOString());

    console.log('✅ Cleaned up expired discovery tokens');
  } catch (error) {
    console.error('❌ Error cleaning up expired tokens:', error);
  }
}

// Auto-cleanup every 10 minutes
setInterval(cleanupExpiredTokens, 10 * 60 * 1000);

/**
 * EXPORT FUNCTIONS FOR EXPRESS ROUTES
 */
module.exports = {
  // Cyphr ID endpoints
  checkCyphrIdAvailable,
  setCyphrId,
  searchByCyphrId,
  
  // QR Code endpoints
  generateQRToken,
  scanQRToken,
  
  // Share Link endpoints
  generateShareLink,
  getShareProfile,
  
  // Nearby Discovery endpoints
  enableNearbyDiscovery,
  getNearbyUsers,
  
  // Phone Discovery endpoints
  enablePhoneDiscovery,
  searchByPhoneHash,
  
  // Settings endpoints
  updateDiscoverySettings,
  
  // Utilities
  cleanupExpiredTokens
};

/**
 * EXPRESS ROUTES SETUP
 * Add these routes to your main server file:
 */
/*
const discoveryEndpoints = require('./discovery-api-endpoints.cjs');

// Cyphr ID routes
app.post('/api/discovery/check-cyphr-id', discoveryEndpoints.checkCyphrIdAvailable);
app.post('/api/discovery/set-cyphr-id', discoveryEndpoints.setCyphrId);
app.get('/api/discovery/search-cyphr-id/:cyphrId', discoveryEndpoints.searchByCyphrId);

// QR Code routes
app.post('/api/discovery/generate-qr-token', discoveryEndpoints.generateQRToken);
app.post('/api/discovery/scan-qr-token', discoveryEndpoints.scanQRToken);

// Share Link routes
app.post('/api/discovery/generate-share-link', discoveryEndpoints.generateShareLink);
app.get('/api/discovery/share-profile/:cyphrId', discoveryEndpoints.getShareProfile);

// Nearby Discovery routes
app.post('/api/discovery/enable-nearby', discoveryEndpoints.enableNearbyDiscovery);
app.get('/api/discovery/nearby-users', discoveryEndpoints.getNearbyUsers);

// Phone Discovery routes
app.post('/api/discovery/enable-phone-discovery', discoveryEndpoints.enablePhoneDiscovery);
app.post('/api/discovery/search-phone-hash', discoveryEndpoints.searchByPhoneHash);

// Settings routes
app.post('/api/discovery/update-settings', discoveryEndpoints.updateDiscoverySettings);
*/