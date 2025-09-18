// cyphr-id-cache-layer.cjs - In-memory caching for Cyphr ID endpoints
// Enterprise optimization for <30ms response times

const LRU = require('lru-cache');

// Cache configurations
const cacheOptions = {
  max: 10000,                    // Max 10,000 entries
  ttl: 1000 * 60 * 5,           // 5 minutes TTL
  updateAgeOnGet: true,          // Refresh TTL on access
  updateAgeOnHas: true,
  stale: true,                   // Return stale while revalidating
};

// Create different caches for different data types
const caches = {
  cyphrIdExists: new LRU({ ...cacheOptions, ttl: 1000 * 60 * 10 }), // 10 min for ID checks
  publicKeys: new LRU({ ...cacheOptions, ttl: 1000 * 60 * 60 }),    // 1 hour for keys
  userProfiles: new LRU({ ...cacheOptions, ttl: 1000 * 60 * 5 }),    // 5 min for profiles
  searchResults: new LRU({ ...cacheOptions, ttl: 1000 * 60 * 2 }),   // 2 min for search
};

// Cache statistics
let stats = {
  hits: 0,
  misses: 0,
  sets: 0,
  deletes: 0,
  startTime: Date.now()
};

// Enhanced Cyphr ID check with caching
async function checkCyphrIdCached(cyphrId, dbQuery) {
  const cacheKey = `exists:${cyphrId.toLowerCase()}`;
  
  // Try cache first
  const cached = caches.cyphrIdExists.get(cacheKey);
  if (cached !== undefined) {
    stats.hits++;
    console.log(`✅ Cache HIT for ${cyphrId} (${stats.hits}/${stats.hits + stats.misses})`);
    return cached;
  }
  
  // Cache miss - query database
  stats.misses++;
  console.log(`❌ Cache MISS for ${cyphrId} - querying DB`);
  
  const result = await dbQuery(cyphrId);
  
  // Store in cache
  caches.cyphrIdExists.set(cacheKey, result);
  stats.sets++;
  
  return result;
}

// Cache public keys
async function getPublicKeyCached(cyphrId, dbQuery) {
  const cacheKey = `pubkey:${cyphrId.toLowerCase()}`;
  
  const cached = caches.publicKeys.get(cacheKey);
  if (cached) {
    stats.hits++;
    return cached;
  }
  
  stats.misses++;
  const result = await dbQuery(cyphrId);
  
  if (result) {
    caches.publicKeys.set(cacheKey, result);
    stats.sets++;
  }
  
  return result;
}

// Cache user profiles
async function getUserProfileCached(cyphrId, dbQuery) {
  const cacheKey = `profile:${cyphrId.toLowerCase()}`;
  
  const cached = caches.userProfiles.get(cacheKey);
  if (cached) {
    stats.hits++;
    return cached;
  }
  
  stats.misses++;
  const result = await dbQuery(cyphrId);
  
  if (result) {
    caches.userProfiles.set(cacheKey, result);
    stats.sets++;
  }
  
  return result;
}

// Cache search results
async function searchUsersCached(query, dbQuery) {
  const cacheKey = `search:${query.toLowerCase()}`;
  
  const cached = caches.searchResults.get(cacheKey);
  if (cached) {
    stats.hits++;
    return cached;
  }
  
  stats.misses++;
  const results = await dbQuery(query);
  
  caches.searchResults.set(cacheKey, results);
  stats.sets++;
  
  return results;
}

// Invalidate cache when user data changes
function invalidateUser(cyphrId) {
  const id = cyphrId.toLowerCase();
  
  // Clear all caches for this user
  caches.cyphrIdExists.delete(`exists:${id}`);
  caches.publicKeys.delete(`pubkey:${id}`);
  caches.userProfiles.delete(`profile:${id}`);
  
  // Clear search caches that might contain this user
  for (const key of caches.searchResults.keys()) {
    if (key.includes(id.substring(0, 3))) {
      caches.searchResults.delete(key);
    }
  }
  
  stats.deletes++;
  console.log(`🗑️ Cache invalidated for ${cyphrId}`);
}

// Batch preload for common queries
async function preloadCommonData(dbQuery) {
  console.log('📦 Preloading common data into cache...');
  
  try {
    // Preload active users
    const activeUsers = await dbQuery.getActiveUsers(100);
    for (const user of activeUsers) {
      caches.cyphrIdExists.set(`exists:${user.cyphr_id}`, true);
      caches.publicKeys.set(`pubkey:${user.cyphr_id}`, {
        publicKey: user.public_key,
        kyberPublicKey: user.kyber_public_key
      });
    }
    
    console.log(`✅ Preloaded ${activeUsers.length} active users`);
  } catch (error) {
    console.error('❌ Preload failed:', error.message);
  }
}

// Get cache statistics
function getCacheStats() {
  const uptime = Date.now() - stats.startTime;
  const hitRate = stats.hits / (stats.hits + stats.misses) || 0;
  
  return {
    ...stats,
    hitRate: `${(hitRate * 100).toFixed(2)}%`,
    uptime: `${Math.floor(uptime / 1000)}s`,
    sizes: {
      cyphrIdExists: caches.cyphrIdExists.size,
      publicKeys: caches.publicKeys.size,
      userProfiles: caches.userProfiles.size,
      searchResults: caches.searchResults.size
    },
    memory: {
      cyphrIdExists: `${(caches.cyphrIdExists.calculatedSize / 1024).toFixed(2)} KB`,
      publicKeys: `${(caches.publicKeys.calculatedSize / 1024).toFixed(2)} KB`,
      userProfiles: `${(caches.userProfiles.calculatedSize / 1024).toFixed(2)} KB`,
      searchResults: `${(caches.searchResults.calculatedSize / 1024).toFixed(2)} KB`
    }
  };
}

// Clear all caches (for testing/maintenance)
function clearAllCaches() {
  for (const cache of Object.values(caches)) {
    cache.clear();
  }
  console.log('🧹 All caches cleared');
}

// Export enhanced endpoints wrapper
function wrapEndpoints(originalEndpoints) {
  return {
    ...originalEndpoints,
    
    // Wrap check endpoint
    checkCyphrId: async (req, res, pool) => {
      const { cyphrId } = req.body;
      
      if (!cyphrId) {
        return res.status(400).json({ success: false, message: 'Cyphr ID required' });
      }
      
      try {
        const exists = await checkCyphrIdCached(cyphrId, async (id) => {
          const result = await pool.query(
            'SELECT EXISTS(SELECT 1 FROM cyphr_identities WHERE cyphr_id = $1)',
            [id]
          );
          return result.rows[0].exists;
        });
        
        res.json({ 
          success: true, 
          available: !exists,
          cached: caches.cyphrIdExists.has(`exists:${cyphrId.toLowerCase()}`)
        });
      } catch (error) {
        console.error('Check error:', error);
        res.status(500).json({ success: false, message: 'Database error' });
      }
    },
    
    // Get cache stats endpoint
    getCacheStats: (req, res) => {
      res.json({
        success: true,
        stats: getCacheStats()
      });
    },
    
    // Clear cache endpoint (admin only)
    clearCache: (req, res) => {
      clearAllCaches();
      stats = { hits: 0, misses: 0, sets: 0, deletes: 0, startTime: Date.now() };
      res.json({ success: true, message: 'Cache cleared' });
    }
  };
}

module.exports = {
  checkCyphrIdCached,
  getPublicKeyCached,
  getUserProfileCached,
  searchUsersCached,
  invalidateUser,
  preloadCommonData,
  getCacheStats,
  clearAllCaches,
  wrapEndpoints
};