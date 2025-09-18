// cache-integration-patch.cjs - Patch for cyphr-id-rds-endpoints.cjs
// Add this at the top of cyphr-id-rds-endpoints.cjs after requires

const cacheLayer = require('./cyphr-id-cache-layer.cjs');

// Simple in-memory cache without external dependencies (fallback)
const simpleCache = new Map();
const CACHE_TTL = 60000; // 1 minute

function getCached(key) {
  const item = simpleCache.get(key);
  if (item && Date.now() - item.timestamp < CACHE_TTL) {
    console.log(`✅ Cache HIT: ${key}`);
    return item.value;
  }
  console.log(`❌ Cache MISS: ${key}`);
  return null;
}

function setCached(key, value) {
  simpleCache.set(key, {
    value,
    timestamp: Date.now()
  });
  
  // Cleanup old entries
  if (simpleCache.size > 1000) {
    const oldestKey = simpleCache.keys().next().value;
    simpleCache.delete(oldestKey);
  }
}

// Replace the check endpoint (around line 22-60) with:
/*
router.post('/check', async (req, res) => {
  const { cyphrId } = req.body;

  if (!cyphrId || cyphrId.length < 3) {
    return res.status(400).json({ 
      success: false, 
      message: 'Cyphr ID must be at least 3 characters' 
    });
  }

  const normalizedId = cyphrId.toLowerCase().trim();
  
  // Check cache first
  const cacheKey = `cyphr:${normalizedId}`;
  const cached = getCached(cacheKey);
  if (cached !== null) {
    return res.json({ 
      success: true, 
      available: !cached,
      fromCache: true 
    });
  }

  let client;
  try {
    const pool = require('./shared-db-pool.cjs');
    client = await pool.connect();
    
    const result = await client.query(
      'SELECT EXISTS(SELECT 1 FROM cyphr_identities WHERE LOWER(cyphr_id) = $1)',
      [normalizedId]
    );
    
    const exists = result.rows[0].exists;
    
    // Cache the result
    setCached(cacheKey, exists);
    
    res.json({ 
      success: true, 
      available: !exists,
      fromCache: false
    });
  } catch (error) {
    console.error('❌ Cyphr ID check error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Database error checking Cyphr ID' 
    });
  } finally {
    if (client) client.release();
  }
});
*/

// Add cache stats endpoint
/*
router.get('/cache-stats', (req, res) => {
  const stats = {
    cacheSize: simpleCache.size,
    maxSize: 1000,
    ttl: CACHE_TTL,
    entries: []
  };
  
  for (const [key, value] of simpleCache.entries()) {
    const age = Date.now() - value.timestamp;
    stats.entries.push({
      key,
      age: `${(age / 1000).toFixed(1)}s`,
      expired: age > CACHE_TTL
    });
  }
  
  res.json(stats);
});
*/

// Add cache clear endpoint (admin only)
/*
router.post('/cache-clear', (req, res) => {
  simpleCache.clear();
  console.log('🧹 Cache cleared');
  res.json({ success: true, message: 'Cache cleared' });
});
*/