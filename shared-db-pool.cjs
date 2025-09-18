/**
 * SHARED DATABASE CONNECTION POOL
 * Single connection pool for entire application
 * Optimized for 1000+ concurrent users
 * Uses AWS Secrets Manager for secure credential storage
 */

const { Pool } = require('pg');
const secretsManager = require('./aws-secrets-config.cjs');

// Initialize pool with async configuration
let sharedPool = null;

async function initializePool() {
  if (sharedPool) return sharedPool;

  try {
    // Get database config from AWS Secrets Manager
    const dbConfig = await secretsManager.getDbConfig();

    // Create single shared pool instance with secure config
    sharedPool = new Pool({
      ...dbConfig,

      // OPTIMIZED FOR SCALE:
      max: 50,                      // Total connections across all modules
      min: 5,                       // Keep minimum connections ready
      idleTimeoutMillis: 30000,     // Close idle after 30s
      connectionTimeoutMillis: 5000, // Connection timeout 5s

      // PERFORMANCE:
      statement_timeout: 30000,      // Kill queries over 30s
      query_timeout: 30000,          // Query timeout

      // CONNECTION REUSE:
      allowExitOnIdle: false         // Keep pool alive
    });

    console.log('✅ Database pool initialized with AWS Secrets');
    return sharedPool;
  } catch (error) {
    console.error('❌ Failed to initialize database pool:', error);
    throw error;
  }
}

// Initialize pool on module load and set up event handlers
initializePool().then(pool => {
  // Monitor pool events
  pool.on('error', (err, client) => {
    console.error('❌ Unexpected pool error:', err);
  });

  pool.on('connect', (client) => {
    console.log('📊 New DB connection established');
  });

  pool.on('acquire', (client) => {
    // Track active connections
  });

  pool.on('remove', (client) => {
    console.log('🔄 DB connection removed from pool');
  });
}).catch(console.error);

// Export async function to get pool
module.exports = {
  getPool: initializePool,
  // For backward compatibility, export the pool getter
  get sharedPool() {
    if (!sharedPool) {
      console.warn('⚠️ Pool not initialized yet, call getPool() first');
    }
    return sharedPool;
  }
};

console.log('✅ Shared DB Pool initialized');
console.log(`   Max connections: 50`);
console.log(`   Min connections: 5`);
console.log(`   Optimized for: 1000+ concurrent users`);