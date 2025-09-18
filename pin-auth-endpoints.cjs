// ENTERPRISE PIN AUTHENTICATION SYSTEM
// WhatsApp/Signal Level Implementation - PIN as Primary Auth Method
// 30-Day Sessions + Biometric Integration

const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// In-memory PIN attempt tracking (should use Redis in production)
const pinAttempts = new Map();
const sessionStorage = new Map();

// Constants
const MAX_PIN_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes
const DEFAULT_SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days
const SHORT_SESSION_DURATION = 24 * 60 * 60 * 1000; // 1 day

// Generate secure session token
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Hash PIN securely
async function hashPin(pin) {
  return await argon2.hash(pin, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    timeCost: 3,
    parallelism: 1,
  });
}

// Verify PIN
async function verifyPin(pin, hash) {
  try {
    return await argon2.verify(hash, pin);
  } catch (error) {
    return false;
  }
}

// Create JWT token with extended expiry
function createJWTToken(userId, email, cyphrId, sessionDuration) {
  const expiresIn = Math.floor(sessionDuration / 1000); // Convert to seconds
  
  return jwt.sign(
    {
      userId,
      email,
      cyphrId,
      authMethod: 'pin',
      sessionType: sessionDuration === DEFAULT_SESSION_DURATION ? 'extended' : 'standard'
    },
    process.env.JWT_SECRET || 'cyphr_jwt_secret_key',
    { expiresIn }
  );
}

// Check rate limiting for PIN attempts
function checkPinRateLimit(userId) {
  const attempts = pinAttempts.get(userId);
  if (!attempts) return { allowed: true, attemptsLeft: MAX_PIN_ATTEMPTS };
  
  // Check if locked out
  if (attempts.lockoutUntil && Date.now() < attempts.lockoutUntil) {
    const remainingTime = Math.ceil((attempts.lockoutUntil - Date.now()) / 1000 / 60);
    return { 
      allowed: false, 
      attemptsLeft: 0, 
      lockedUntil: attempts.lockoutUntil,
      remainingTime 
    };
  }
  
  // Reset attempts if lockout period expired
  if (attempts.lockoutUntil && Date.now() >= attempts.lockoutUntil) {
    pinAttempts.delete(userId);
    return { allowed: true, attemptsLeft: MAX_PIN_ATTEMPTS };
  }
  
  const attemptsLeft = MAX_PIN_ATTEMPTS - attempts.count;
  return { 
    allowed: attemptsLeft > 0, 
    attemptsLeft: Math.max(0, attemptsLeft) 
  };
}

// Record failed PIN attempt
function recordFailedPinAttempt(userId) {
  const attempts = pinAttempts.get(userId) || { count: 0 };
  attempts.count++;
  attempts.lastAttempt = Date.now();
  
  if (attempts.count >= MAX_PIN_ATTEMPTS) {
    attempts.lockoutUntil = Date.now() + LOCKOUT_TIME;
  }
  
  pinAttempts.set(userId, attempts);
  return attempts;
}

// Clear PIN attempts on successful login
function clearPinAttempts(userId) {
  pinAttempts.delete(userId);
}

// Create PIN authentication endpoints
function createPinAuthEndpoints(app, dbQuery, redis, JWT_SECRET) {
  
  // ENDPOINT: Setup PIN for new user (called after email verification)
  app.post('/api/auth/setup-pin', async (req, res) => {
    try {
      const { userId, pin, biometricEnabled = false } = req.body;
      
      if (!userId || !pin) {
        return res.status(400).json({ 
          success: false, 
          error: 'User ID and PIN are required' 
        });
      }

      if (!/^\d{4,6}$/.test(pin)) {
        return res.status(400).json({ 
          success: false, 
          error: 'PIN must be 4-6 digits' 
        });
      }

      console.log('🔐 Setting up PIN for user:', userId);

      // Hash the PIN
      const pinHash = await hashPin(pin);

      // Store PIN hash in database
      const updateResult = await dbQuery('users', 'update', 
        { 
          pin_hash: pinHash,
          biometric_enabled: biometricEnabled,
          updated_at: new Date().toISOString()
        },
        { id: userId }
      );
      
      const { data: updatedUser, error: updateError } = updateResult;

      if (updateError) {
        console.error('❌ Error storing PIN:', updateError);
        return res.status(500).json({ 
          success: false,
          error: 'Failed to setup PIN: ' + updateError.message
        });
      }

      console.log('✅ PIN setup successful for user:', userId);

      res.json({
        success: true,
        message: 'PIN setup completed successfully',
        user: {
          id: updatedUser.id,
          biometricEnabled: updatedUser.biometric_enabled
        }
      });

    } catch (error) {
      console.error('❌ PIN setup error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error: ' + error.message 
      });
    }
  });

  // ENDPOINT: Verify PIN and login
  app.post('/api/auth/verify-pin', async (req, res) => {
    try {
      const { email, pin, rememberMe = false } = req.body;
      
      if (!email || !pin) {
        return res.status(400).json({ 
          success: false, 
          error: 'Email and PIN are required' 
        });
      }

      console.log('🔐 PIN verification for email:', email);

      // Get user by email hash
      const emailHash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
      const userResult = await dbQuery('users', 'select', {}, { email_hash: emailHash });
      const user = userResult.data && userResult.data[0];
      const userError = userResult.error;

      if (userError || !user) {
        console.log('❌ User not found:', emailHash);
        return res.status(404).json({ 
          success: false, 
          error: 'User not found. Please register first.' 
        });
      }

      if (!user.pin_hash) {
        return res.status(400).json({ 
          success: false, 
          error: 'PIN not set. Please use email verification to setup PIN.' 
        });
      }

      // Check rate limiting
      const rateLimit = checkPinRateLimit(user.id);
      if (!rateLimit.allowed) {
        console.log('❌ PIN rate limit exceeded for user:', user.id);
        return res.status(429).json({ 
          success: false, 
          error: `Too many failed attempts. Try again in ${rateLimit.remainingTime} minutes.`,
          lockedUntil: rateLimit.lockedUntil
        });
      }

      // Verify PIN
      const isValidPin = await verifyPin(pin, user.pin_hash);
      
      if (!isValidPin) {
        // Record failed attempt
        const attempts = recordFailedPinAttempt(user.id);
        const attemptsLeft = MAX_PIN_ATTEMPTS - attempts.count;
        
        console.log('❌ Invalid PIN for user:', user.id, 'Attempts left:', attemptsLeft);
        
        if (attempts.lockoutUntil) {
          return res.status(429).json({ 
            success: false, 
            error: `Too many failed attempts. Account locked for ${Math.ceil(LOCKOUT_TIME / 1000 / 60)} minutes.`,
            lockedUntil: attempts.lockoutUntil
          });
        }
        
        return res.status(400).json({ 
          success: false, 
          error: `Invalid PIN. ${attemptsLeft} attempts remaining.`,
          attemptsLeft
        });
      }

      // PIN is valid - clear failed attempts
      clearPinAttempts(user.id);

      // Determine session duration
      const sessionDuration = rememberMe ? DEFAULT_SESSION_DURATION : SHORT_SESSION_DURATION;
      const sessionExpiry = new Date(Date.now() + sessionDuration);

      // Generate tokens
      const accessToken = createJWTToken(user.id, email, user.cyphr_id, sessionDuration);
      const refreshToken = jwt.sign(
        {
          userId: user.id,
          tokenType: 'refresh',
          authMethod: 'pin'
        },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      // Store session in Redis/memory
      const sessionToken = generateSessionToken();
      const sessionData = {
        userId: user.id,
        email,
        cyphrId: user.cyphr_id,
        authMethod: 'pin',
        expiresAt: sessionExpiry,
        rememberMe,
        createdAt: new Date()
      };

      // Store in Redis if available, otherwise in memory
      if (redis) {
        await redis.setex(`session:${sessionToken}`, Math.floor(sessionDuration / 1000), JSON.stringify(sessionData));
        await redis.setex(`refresh:${user.id}`, 30 * 24 * 60 * 60, refreshToken);
      } else {
        sessionStorage.set(sessionToken, sessionData);
      }

      // Update user status
      const updateResult = await dbQuery('users', 'update',
        { 
          status: 'online',
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        { id: user.id }
      );
      const updateError = updateResult.error;

      if (updateError) {
        console.error('⚠️ Failed to update user status:', updateError);
      }

      console.log('✅ PIN login successful for user:', user.id, 'Session duration:', rememberMe ? '30 days' : '1 day');

      res.json({
        success: true,
        message: 'PIN authentication successful',
        user: {
          id: user.id,
          cyphr_id: user.cyphr_id,
          full_name: user.full_name,
          quantum_key: user.public_key,
          auth_method: 'pin',
          biometric_enabled: user.biometric_enabled
        },
        accessToken,
        refreshToken,
        sessionToken,
        expiresAt: sessionExpiry.toISOString(),
        rememberMe
      });

    } catch (error) {
      console.error('❌ PIN verification error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error: ' + error.message 
      });
    }
  });

  // ENDPOINT: Check if user has PIN set
  app.post('/api/auth/check-pin', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ 
          success: false, 
          error: 'Email is required' 
        });
      }

      const emailHash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
      const userResult = await dbQuery('users', 'select', {}, { email_hash: emailHash });
      const user = userResult.data && userResult.data[0];
      const userError = userResult.error;

      if (userError || !user) {
        return res.status(404).json({ 
          success: false, 
          error: 'User not found' 
        });
      }

      res.json({
        success: true,
        hasPIN: !!user.pin_hash,
        biometricEnabled: user.biometric_enabled || false,
        userName: user.full_name
      });

    } catch (error) {
      console.error('❌ Check PIN error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error: ' + error.message 
      });
    }
  });

  // ENDPOINT: Validate session token
  app.post('/api/auth/validate-session', async (req, res) => {
    try {
      const { sessionToken } = req.body;
      
      if (!sessionToken) {
        return res.status(400).json({ 
          success: false, 
          error: 'Session token required' 
        });
      }

      let sessionData;
      
      // Check Redis first, then memory
      if (redis) {
        const redisData = await redis.get(`session:${sessionToken}`);
        if (redisData) {
          sessionData = JSON.parse(redisData);
        }
      } else {
        sessionData = sessionStorage.get(sessionToken);
      }

      if (!sessionData) {
        return res.status(401).json({ 
          success: false, 
          error: 'Invalid or expired session' 
        });
      }

      // Check if session expired
      if (new Date() > new Date(sessionData.expiresAt)) {
        // Clean up expired session
        if (redis) {
          await redis.del(`session:${sessionToken}`);
        } else {
          sessionStorage.delete(sessionToken);
        }
        
        return res.status(401).json({ 
          success: false, 
          error: 'Session expired' 
        });
      }

      res.json({
        success: true,
        sessionData,
        valid: true
      });

    } catch (error) {
      console.error('❌ Session validation error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error: ' + error.message 
      });
    }
  });

  console.log('🔐 PIN Authentication endpoints loaded:');
  console.log('   POST /api/auth/setup-pin');
  console.log('   POST /api/auth/verify-pin');
  console.log('   POST /api/auth/check-pin');
  console.log('   POST /api/auth/validate-session');
}

module.exports = { 
  createPinAuthEndpoints,
  hashPin,
  verifyPin,
  generateSessionToken,
  MAX_PIN_ATTEMPTS,
  LOCKOUT_TIME,
  DEFAULT_SESSION_DURATION,
  SHORT_SESSION_DURATION
};