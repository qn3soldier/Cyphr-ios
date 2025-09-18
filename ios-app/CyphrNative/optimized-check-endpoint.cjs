// Optimized check endpoint with caching
// Replace lines 26-71 in cyphr-id-rds-endpoints.cjs

app.post('/api/cyphr-id/check', async (req, res) => {
  const { cyphrId } = req.body;

  if (!cyphrId || cyphrId.length < 3) {
    return res.status(400).json({ 
      success: false, 
      message: 'Cyphr ID must be at least 3 characters' 
    });
  }

  // Normalize for consistency
  const normalizedId = cyphrId.toLowerCase().trim();
  
  // Check cache first
  const cacheKey = `check:${normalizedId}`;
  const cached = cache.get(cacheKey);
  
  if (cached !== undefined) {
    console.log(`✅ Cache HIT for ${cyphrId}`);
    return res.json({ 
      success: true, 
      available: !cached,
      cached: true
    });
  }

  console.log(`❌ Cache MISS for ${cyphrId}`);
  
  let client;
  try {
    const pool = require('./shared-db-pool.cjs');
    client = await pool.connect();
    
    // Optimized query using EXISTS
    const result = await client.query(
      'SELECT EXISTS(SELECT 1 FROM cyphr_identities WHERE LOWER(cyphr_id) = $1) AS exists',
      [normalizedId]
    );
    
    const exists = result.rows[0].exists;
    
    // Cache the result
    cache.set(cacheKey, exists);
    
    res.json({ 
      success: true, 
      available: !exists,
      cached: false
    });
  } catch (error) {
    console.error('Error checking Cyphr ID:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to check Cyphr ID availability'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Add cache stats endpoint
app.get('/api/cyphr-id/cache-stats', (req, res) => {
  res.json({
    success: true,
    stats: cache.getStats()
  });
});

// Add cache clear endpoint (admin only in production)
app.post('/api/cyphr-id/cache-clear', (req, res) => {
  cache.clear();
  res.json({
    success: true,
    message: 'Cache cleared'
  });
});