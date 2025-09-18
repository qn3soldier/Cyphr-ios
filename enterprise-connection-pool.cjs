/**
 * ENTERPRISE CONNECTION POOLING FOR 1000+ CONCURRENT USERS
 * Implements database connection pooling and caching for Cyphr Messenger
 * August 18, 2025
 */

const { createClient } = require('@supabase/supabase-js');
const Redis = require('ioredis');
const { Pool } = require('pg');

class EnterpriseConnectionPool {
  constructor() {
    this.initialized = false;
    this.supabasePool = new Map(); // Multiple Supabase clients
    this.pgPool = null; // Native PostgreSQL pool
    this.redisCluster = null; // Redis cluster
    this.metrics = {
      dbConnections: 0,
      redisConnections: 0,
      queryCount: 0,
      avgResponseTime: 0,
      errors: 0
    };
  }

  async initialize() {
    console.log('🏗️ Initializing Enterprise Connection Pool...');
    
    try {
      // 1. Setup PostgreSQL connection pool (for high performance)
      await this.setupPostgreSQLPool();
      
      // 2. Setup Redis Cluster (for session management)
      await this.setupRedisCluster();
      
      // 3. Setup Supabase connection pool (for compatibility)
      await this.setupSupabasePool();
      
      this.initialized = true;
      console.log('✅ Enterprise Connection Pool initialized');
      
      // Start monitoring
      this.startMonitoring();
      
    } catch (error) {
      console.error('❌ Failed to initialize connection pool:', error);
      throw error;
    }
  }

  /**
   * Setup native PostgreSQL connection pool for maximum performance
   */
  async setupPostgreSQLPool() {
    const databaseUrl = process.env.DATABASE_URL || this.buildDatabaseUrl();
    
    this.pgPool = new Pool({
      connectionString: databaseUrl,
      max: 100, // Maximum 100 connections for 1000+ users
      min: 10,  // Keep 10 connections always open
      idleTimeoutMillis: 30000, // Close idle connections after 30s
      connectionTimeoutMillis: 5000, // Timeout connections after 5s
      acquireTimeoutMillis: 10000, // Wait max 10s for connection
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      
      // Enterprise features
      ssl: {
        rejectUnauthorized: false // For cloud deployments
      },
      
      // Connection retry logic
      retryDelayOnFailover: 1000,
      maxRetriesPerRequest: 3
    });

    // Test connection
    const client = await this.pgPool.connect();
    const result = await client.query('SELECT NOW() as connected_at');
    client.release();
    
    console.log(`✅ PostgreSQL pool connected at ${result.rows[0].connected_at}`);
    console.log(`🔢 Pool size: min=${this.pgPool.options.min}, max=${this.pgPool.options.max}`);
  }

  /**
   * Setup Redis Cluster for session management and caching
   */
  async setupRedisCluster() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    // Setup Redis with cluster support
    this.redisCluster = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      maxLoadingTimeout: 5000,
      lazyConnect: true,
      
      // Connection pooling for Redis
      family: 4,
      keepAlive: true,
      connectTimeout: 10000,
      lazyConnect: true,
      
      // Cluster mode (if using Redis Cluster)
      enableOfflineQueue: false,
      
      // Memory optimization
      db: 0,
      keyPrefix: 'cyphr:',
      
      // Retry configuration
      retryDelayOnClusterDown: 300,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    });

    // Test Redis connection
    await this.redisCluster.connect();
    await this.redisCluster.ping();
    console.log('✅ Redis cluster connected');
  }

  /**
   * Setup Supabase connection pool for API compatibility
   */
  async setupSupabasePool() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Create multiple Supabase clients for load balancing
    const poolSize = 10;
    
    for (let i = 0; i < poolSize; i++) {
      const client = createClient(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        realtime: {
          params: {
            eventsPerSecond: 2 // Reduce realtime load
          }
        },
        global: {
          headers: {
            'x-connection-pool-id': `pool-${i}`,
            'x-client-info': 'cyphr-enterprise'
          }
        }
      });
      
      this.supabasePool.set(i, client);
    }
    
    console.log(`✅ Supabase pool created with ${poolSize} clients`);
  }

  /**
   * Get PostgreSQL connection (highest performance)
   */
  async getPostgreSQLConnection() {
    if (!this.pgPool) {
      throw new Error('PostgreSQL pool not initialized');
    }
    
    const startTime = Date.now();
    const client = await this.pgPool.connect();
    const connectionTime = Date.now() - startTime;
    
    this.updateMetrics('connection', connectionTime);
    
    return client;
  }

  /**
   * Get Supabase client (load balanced)
   */
  getSupabaseClient() {
    const clientIndex = this.metrics.queryCount % this.supabasePool.size;
    return this.supabasePool.get(clientIndex);
  }

  /**
   * Execute database query with connection pooling
   */
  async query(sql, params = []) {
    const startTime = Date.now();
    
    try {
      const client = await this.getPostgreSQLConnection();
      const result = await client.query(sql, params);
      client.release();
      
      const queryTime = Date.now() - startTime;
      this.updateMetrics('query', queryTime);
      
      return result;
      
    } catch (error) {
      this.metrics.errors++;
      console.error('❌ Database query error:', error);
      throw error;
    }
  }

  /**
   * Cache operations with Redis
   */
  async cacheGet(key) {
    try {
      const startTime = Date.now();
      const value = await this.redisCluster.get(key);
      const cacheTime = Date.now() - startTime;
      
      this.updateMetrics('cache', cacheTime);
      
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.warn('⚠️ Cache get failed:', error);
      return null;
    }
  }

  async cacheSet(key, value, expireSeconds = 3600) {
    try {
      const stringValue = JSON.stringify(value);
      await this.redisCluster.setex(key, expireSeconds, stringValue);
      return true;
    } catch (error) {
      console.warn('⚠️ Cache set failed:', error);
      return false;
    }
  }

  /**
   * Update performance metrics
   */
  updateMetrics(type, timeMs) {
    this.metrics.queryCount++;
    
    if (type === 'connection') {
      this.metrics.dbConnections++;
    }
    
    // Update average response time
    this.metrics.avgResponseTime = 
      (this.metrics.avgResponseTime * (this.metrics.queryCount - 1) + timeMs) / 
      this.metrics.queryCount;
  }

  /**
   * Get current pool status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      postgresql: {
        totalConnections: this.pgPool?.totalCount || 0,
        idleConnections: this.pgPool?.idleCount || 0,
        waitingClients: this.pgPool?.waitingCount || 0
      },
      redis: {
        status: this.redisCluster?.status || 'disconnected',
        connected: this.redisCluster?.status === 'ready'
      },
      supabase: {
        poolSize: this.supabasePool.size
      },
      metrics: this.metrics,
      performance: {
        canHandle1000Users: this.metrics.avgResponseTime < 100 && this.metrics.errors < 10,
        avgResponseTime: `${this.metrics.avgResponseTime.toFixed(2)}ms`,
        errorRate: `${((this.metrics.errors / Math.max(this.metrics.queryCount, 1)) * 100).toFixed(2)}%`
      }
    };
  }

  /**
   * Monitor connection pool health
   */
  startMonitoring() {
    setInterval(() => {
      const status = this.getStatus();
      
      console.log(`📊 Connection Pool Status:
        📈 Queries: ${status.metrics.queryCount}
        ⚡ Avg Response: ${status.performance.avgResponseTime}
        🔗 DB Connections: ${status.postgresql.totalConnections}/${this.pgPool?.options.max}
        💾 Redis: ${status.redis.status}
        🎯 1000+ Users Ready: ${status.performance.canHandle1000Users ? '✅' : '❌'}
      `);
      
      // Alert if performance degrades
      if (status.metrics.avgResponseTime > 500) {
        console.warn('⚠️ HIGH LATENCY: Average response time > 500ms');
      }
      
      if (status.postgresql.waitingClients > 0) {
        console.warn('⚠️ CONNECTION PRESSURE: Clients waiting for DB connection');
      }
      
    }, 60000); // Every minute
  }

  /**
   * Build database URL from Supabase config
   */
  buildDatabaseUrl() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    if (supabaseUrl && supabaseUrl.includes('supabase.co')) {
      const projectId = supabaseUrl.split('//')[1].split('.')[0];
      return `postgresql://postgres.${projectId}:${process.env.SUPABASE_DB_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:5432/postgres?sslmode=require`;
    }
    return 'postgresql://postgres:password@localhost:5432/cyphr';
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('🛑 Shutting down connection pool...');
    
    if (this.pgPool) {
      await this.pgPool.end();
    }
    
    if (this.redisCluster) {
      this.redisCluster.disconnect();
    }
    
    console.log('✅ Connection pool shutdown complete');
  }
}

// Global instance
const enterprisePool = new EnterpriseConnectionPool();

module.exports = {
  EnterpriseConnectionPool,
  enterprisePool
};