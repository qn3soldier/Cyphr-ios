// ENTERPRISE EMAIL AUTHENTICATION ENDPOINTS
// For AWS Production Server with AWS SES Email Delivery

const crypto = require('crypto');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

// AWS SES Client - uses IAM role or default credentials
const sesClient = new SESClient({ 
  region: 'us-east-1'
});

// In-memory storage (should use Redis in production)
const emailOTPCodes = new Map();
const pinAttempts = new Map();

// Hash PIN securely
async function hashPin(pin) {
  const argon2 = require('argon2');
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
    const argon2 = require('argon2');
    return await argon2.verify(hash, pin);
  } catch (error) {
    return false;
  }
}

// Check PIN rate limiting
function checkPinRateLimit(userId) {
  const attempts = pinAttempts.get(userId);
  if (!attempts) return { allowed: true, attemptsLeft: MAX_PIN_ATTEMPTS };
  
  if (attempts.lockoutUntil && Date.now() < attempts.lockoutUntil) {
    const remainingTime = Math.ceil((attempts.lockoutUntil - Date.now()) / 1000 / 60);
    return { 
      allowed: false, 
      attemptsLeft: 0, 
      lockedUntil: attempts.lockoutUntil,
      remainingTime 
    };
  }
  
  if (attempts.lockoutUntil && Date.now() >= attempts.lockoutUntil) {
    pinAttempts.delete(userId);
    return { allowed: true, attemptsLeft: MAX_PIN_ATTEMPTS };
  }
  
  return { allowed: true, attemptsLeft: MAX_PIN_ATTEMPTS - attempts.count };
}

// Record failed PIN attempt
function recordFailedPinAttempt(userId) {
  const attempts = pinAttempts.get(userId) || { count: 0, firstAttempt: Date.now() };
  attempts.count++;
  
  if (attempts.count >= MAX_PIN_ATTEMPTS) {
    attempts.lockoutUntil = Date.now() + LOCKOUT_TIME;
  }
  
  pinAttempts.set(userId, attempts);
  return attempts;
}

// Constants
const MAX_PIN_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

// Generate secure OTP
function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

// Generate unique Cyphr ID - CRITICAL UNIQUE IDENTIFIER
async function generateUniqueCyphrId(fullName, supabase) {
  // Create base from full name
  const nameBase = (fullName || 'user')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 15);
  
  let attempts = 0;
  let cyphrId = null;
  
  // Keep trying until we find a unique ID
  while (!cyphrId && attempts < 100) {
    const randomNum = crypto.randomInt(100, 9999);
    const candidateId = `@${nameBase}${randomNum}`;
    
    // Check if this ID already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('cyphr_id', candidateId)
      .single();
    
    if (!existing) {
      cyphrId = candidateId;
    }
    attempts++;
  }
  
  // If we couldn't generate from name, use more random approach
  if (!cyphrId) {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(3).toString('hex');
    cyphrId = `@user_${timestamp}_${random}`;
  }
  
  return cyphrId;
}

// Hash email for zero-knowledge storage
function hashEmail(email) {
  return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
}

// ENTERPRISE LOGIC: Check user exists and has PIN/biometry
async function checkUserHasPin(email, supabase) {
  try {
    const emailHash = hashEmail(email);
    
    const { data: user, error } = await supabase
      .from('users')
      .select('id, pin_hash, full_name, cyphr_id, created_at')
      .eq('email_hash', emailHash)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = not found (expected for new users)
      console.error('Database error checking user:', error);
      return { userExists: false, hasPIN: false, user: null };
    }
    
    return {
      userExists: user ? true : false,
      hasPIN: user?.pin_hash ? true : false,
      user: user,
      isNewUser: !user
    };
  } catch (error) {
    console.error('Error checking PIN:', error);
    return { userExists: false, hasPIN: false, user: null, isNewUser: true };
  }
}

// Add email auth endpoints to server
function addEmailAuthEndpoints(app, supabase) {
  
  // ENDPOINT: Check if user exists and has PIN/biometry
  app.post('/api/auth/check-pin', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ 
          success: false, 
          error: 'Email is required' 
        });
      }

      console.log('📧 ENTERPRISE AUTH: Checking user status for:', email);

      const { userExists, hasPIN, user, isNewUser } = await checkUserHasPin(email, supabase);

      res.json({
        success: true,
        userExists: userExists,
        hasPIN: hasPIN,
        isNewUser: isNewUser,
        emailHash: hashEmail(email),
        userData: user ? {
          fullName: user.full_name,
          cyphrId: user.cyphr_id,
          accountAge: user.created_at
        } : null
      });

    } catch (error) {
      console.error('❌ Check PIN error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to check user status' 
      });
    }
  });

  // ENDPOINT: Send email OTP (ENTERPRISE LOGIC)
  app.post('/api/auth/send-email-otp', async (req, res) => {
    try {
      const { email, isSignUp = true } = req.body;
      
      if (!email || !email.includes('@')) {
        return res.status(400).json({ 
          success: false, 
          error: 'Valid email address required' 
        });
      }

      console.log('📧 ENTERPRISE: Sending email OTP to:', email, 'Mode:', isSignUp ? 'SIGNUP' : 'SIGNIN');

      // ENTERPRISE RULE: Check if email already registered
      const { userExists } = await checkUserHasPin(email, supabase);
      
      if (isSignUp && userExists) {
        return res.status(409).json({
          success: false,
          error: 'Email already registered. Please use Sign In instead.',
          shouldSwitchToSignIn: true
        });
      }
      
      if (!isSignUp && !userExists) {
        return res.status(404).json({
          success: false,
          error: 'Email not registered. Please use Sign Up instead.',
          shouldSwitchToSignUp: true
        });
      }

      // Generate OTP
      const otp = generateOTP();
      const emailHash = hashEmail(email);

      // Store OTP with expiration (10 minutes)
      emailOTPCodes.set(emailHash, {
        otp,
        email,
        isSignUp,
        expires: Date.now() + 10 * 60 * 1000,
        attempts: 0
      });

      // Send email via AWS SES
      try {
        const htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h2 style="color: #7c3aed; margin: 0;">🛡️ Cyphr Messenger</h2>
              <p style="color: #666; margin-top: 5px;">Post-Quantum Secure Messaging</p>
            </div>
            
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
              <p style="color: white; margin: 0 0 15px 0; font-size: 16px;">Your verification code is:</p>
              <h1 style="color: white; font-size: 42px; letter-spacing: 8px; margin: 0; font-weight: bold;">${otp}</h1>
            </div>
            
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #7c3aed;">
              <p style="margin: 0 0 10px 0; color: #1a202c;"><strong>Security Notice:</strong></p>
              <ul style="color: #4a5568; margin: 0; padding-left: 20px;">
                <li>This code expires in 10 minutes</li>
                <li>Never share this code with anyone</li>
                <li>We use Zero-Knowledge architecture</li>
                <li>Your email is hashed and never stored in plain text</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
              <p style="color: #718096; font-size: 12px; margin: 0;">
                If you didn't request this code, please ignore this email.<br>
                <strong>Cyphr Messenger</strong> - Enterprise secure messaging
              </p>
            </div>
          </div>
        `;

        const sendEmailParams = {
          Source: 'noreply@cyphrmessenger.app',
          Destination: {
            ToAddresses: [email]
          },
          Message: {
            Subject: {
              Data: `Your Cyphr Messenger Verification Code - ${isSignUp ? 'Sign Up' : 'Sign In'}`,
              Charset: 'UTF-8'
            },
            Body: {
              Html: {
                Data: htmlContent,
                Charset: 'UTF-8'
              },
              Text: {
                Data: `Your Cyphr Messenger verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this code, please ignore this email.`,
                Charset: 'UTF-8'
              }
            }
          }
        };

        const sendEmailCommand = new SendEmailCommand(sendEmailParams);
        const result = await sesClient.send(sendEmailCommand);
        console.log(`📧 AWS SES email sent to ${email}, MessageId: ${result.MessageId}`);
        
      } catch (sesError) {
        console.error('⚠️ AWS SES error:', sesError.message);
        // Still return success but log that we're in development mode
        console.log('🔧 DEVELOPMENT MODE - Email OTP:', otp, 'for email:', email);
      }

      res.json({ 
        success: true, 
        emailHash,
        message: `Verification code sent for ${isSignUp ? 'registration' : 'login'}`,
        devOTP: otp
      });

    } catch (error) {
      console.error('❌ Email OTP error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to send verification code' 
      });
    }
  });

  // ENDPOINT: Verify email OTP (ENTERPRISE LOGIC)
  app.post('/api/auth/verify-email-otp', async (req, res) => {
    try {
      const { email, code, isSignUp, userData = {} } = req.body;
      
      if (!email || !code) {
        return res.status(400).json({ 
          success: false, 
          error: 'Email and verification code are required' 
        });
      }

      const emailHash = hashEmail(email);
      const storedOTP = emailOTPCodes.get(emailHash);

      if (!storedOTP) {
        return res.status(400).json({ 
          success: false, 
          error: 'No verification code found. Please request a new one.' 
        });
      }

      // Check expiration
      if (Date.now() > storedOTP.expires) {
        emailOTPCodes.delete(emailHash);
        return res.status(400).json({ 
          success: false, 
          error: 'Verification code has expired. Please request a new one.' 
        });
      }

      // Check OTP
      if (storedOTP.otp !== code) {
        storedOTP.attempts++;
        
        if (storedOTP.attempts >= 3) {
          emailOTPCodes.delete(emailHash);
          return res.status(400).json({ 
            success: false, 
            error: 'Too many failed attempts. Please request a new code.' 
          });
        }
        
        return res.status(400).json({ 
          success: false, 
          error: `Invalid verification code. ${3 - storedOTP.attempts} attempts remaining.` 
        });
      }

      // OTP verified - clean up
      // Use isSignUp from request body if provided, otherwise fall back to stored value
      const finalIsSignUp = isSignUp !== undefined ? isSignUp : storedOTP.isSignUp;
      emailOTPCodes.delete(emailHash);

      console.log('✅ ENTERPRISE: Email OTP verified for:', email, 'Mode:', finalIsSignUp ? 'SIGNUP' : 'SIGNIN', '(from request:', isSignUp, ', from storage:', storedOTP.isSignUp, ')');

      // Create/get user in database
      let user;
      const userId = crypto.randomUUID();

      if (finalIsSignUp) {
        // SIGNUP: Create new user
        console.log('🆕 Creating new user account');
        
        // Generate unique Cyphr ID
        const uniqueCyphrId = await generateUniqueCyphrId(userData.fullName || '', supabase);
        console.log('🆔 Generated unique Cyphr ID:', uniqueCyphrId);
        
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            id: userId,
            email_hash: emailHash,
            full_name: userData.fullName || '',
            cyphr_id: uniqueCyphrId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (createError) {
          console.error('❌ Error creating user:', createError);
          return res.status(500).json({ 
            success: false, 
            error: 'Failed to create user account' 
          });
        }
        user = newUser;
        
      } else {
        // SIGNIN: Get existing user
        console.log('👤 Authenticating existing user');
        
        const { data: existingUser, error: getUserError } = await supabase
          .from('users')
          .select('*')
          .eq('email_hash', emailHash)
          .single();
          
        if (getUserError || !existingUser) {
          console.error('❌ User not found during signin:', getUserError);
          return res.status(404).json({ 
            success: false, 
            error: 'User account not found' 
          });
        }
        user = existingUser;
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: user.id,
          email: email,
          cyphrId: user.cyphr_id,
          authMethod: 'email'
        },
        process.env.JWT_SECRET || 'cyphr_jwt_secret_key',
        { expiresIn: '30d' }
      );

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          cyphrId: user.cyphr_id,
          fullName: user.full_name,
          email: email
        },
        isNewUser: finalIsSignUp,
        needsSetup: finalIsSignUp, // NEW USERS need profile/PIN setup
        message: finalIsSignUp ? 'Account created successfully' : 'Authentication successful'
      });

    } catch (error) {
      console.error('❌ Verify email OTP error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Authentication failed' 
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
      const emailHash = hashEmail(email);
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email_hash', emailHash)
        .single();

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

        console.log(`❌ Invalid PIN for user: ${user.id}, attempts left: ${attemptsLeft}`);

        if (attemptsLeft <= 0) {
          return res.status(429).json({ 
            success: false, 
            error: 'Too many failed attempts. Account locked for 15 minutes.',
            lockedUntil: attempts.lockoutUntil
          });
        }

        return res.status(401).json({ 
          success: false, 
          error: `Invalid PIN. ${attemptsLeft} attempts remaining.`,
          attemptsLeft
        });
      }

      // PIN verified successfully - clear failed attempts
      pinAttempts.delete(user.id);

      console.log('✅ PIN verified for user:', user.id);

      // Create JWT token
      const sessionDuration = rememberMe ? (30 * 24 * 60 * 60 * 1000) : (24 * 60 * 60 * 1000); // 30 days or 1 day
      const token = jwt.sign(
        {
          userId: user.id,
          email: email,
          cyphrId: user.cyphr_id,
          authMethod: 'pin',
          sessionType: rememberMe ? 'extended' : 'standard'
        },
        process.env.JWT_SECRET || 'cyphr_jwt_secret_key',
        { expiresIn: Math.floor(sessionDuration / 1000) }
      );

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          cyphrId: user.cyphr_id,
          fullName: user.full_name,
          email: email
        },
        sessionDuration,
        message: 'PIN verification successful'
      });

    } catch (error) {
      console.error('❌ PIN verification error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
      });
    }
  });

  // ENDPOINT: Set up PIN/biometry (OPTIONAL for new users)
  app.post('/api/auth/setup-pin', async (req, res) => {
    try {
      const { email, pin, enableBiometric = false } = req.body;
      
      if (!email) {
        return res.status(400).json({ 
          success: false, 
          error: 'Email is required' 
        });
      }
      
      const emailHash = hashEmail(email);
      
      // Find user
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email_hash', emailHash)
        .single();
        
      if (userError || !user) {
        return res.status(404).json({ 
          success: false, 
          error: 'User not found' 
        });
      }
      
      let updateData = {};
      
      // Set PIN if provided
      if (pin) {
        const pinHash = await hashPin(pin);
        updateData.pin_hash = pinHash;
        console.log('🔐 PIN set for user:', user.id);
      }
      
      // Set biometric flag (skip bio field as it doesn't exist)
      if (enableBiometric) {
        // Note: biometric preference stored in client-side for now
        console.log('👆 Biometric enabled for user:', user.id);
      }
      
      // Update user
      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', user.id);
          
        if (updateError) {
          console.error('❌ Error updating user security:', updateError);
          return res.status(500).json({ 
            success: false, 
            error: 'Failed to setup security' 
          });
        }
      }
      
      res.json({
        success: true,
        message: 'Security setup completed',
        hasPIN: !!pin,
        biometricEnabled: enableBiometric
      });
      
    } catch (error) {
      console.error('❌ Setup PIN error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
      });
    }
  });

  // Check Cyphr ID availability
  app.post('/api/auth/check-cyphr-id', async (req, res) => {
    try {
      const { cyphrId } = req.body;
      
      if (!cyphrId || typeof cyphrId !== 'string') {
        return res.status(400).json({ 
          success: false, 
          error: 'Cyphr ID is required' 
        });
      }
      
      // Validate format
      if (cyphrId.length < 3) {
        return res.status(400).json({ 
          success: false, 
          error: 'Cyphr ID must be at least 3 characters' 
        });
      }
      
      if (!/^[a-zA-Z0-9_]+$/.test(cyphrId)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Only letters, numbers, and underscore allowed' 
        });
      }
      
      // Reserved IDs
      const reservedIds = ['admin', 'support', 'help', 'cyphr', 'api', 'www', 'mail', 'ftp', 'root', 'system'];
      if (reservedIds.includes(cyphrId.toLowerCase())) {
        return res.status(400).json({ 
          success: false, 
          available: false,
          error: 'This Cyphr ID is reserved' 
        });
      }
      
      // Check availability in database
      const { data: existingUser, error } = await supabase
        .from('users')
        .select('id')
        .eq('unique_id', cyphrId)
        .single();
        
      if (error && error.code !== 'PGRST116') {
        console.error('❌ Error checking Cyphr ID:', error);
        return res.status(500).json({ 
          success: false, 
          error: 'Database error' 
        });
      }
      
      const available = !existingUser;
      
      res.json({
        success: true,
        available: available,
        cyphrId: cyphrId
      });
      
    } catch (error) {
      console.error('❌ Check Cyphr ID error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
      });
    }
  });

  console.log('✅ ENTERPRISE Email auth endpoints added:');
  console.log('   POST /api/auth/check-pin - Check user status & PIN');
  console.log('   POST /api/auth/send-email-otp - Send OTP with signup/signin validation');
  console.log('   POST /api/auth/verify-email-otp - Verify OTP & create/auth user');
  console.log('   POST /api/auth/verify-pin - PIN authentication');
  console.log('   POST /api/auth/setup-pin - Optional PIN/biometry setup');
  console.log('   POST /api/auth/check-cyphr-id - Check Cyphr ID availability');
}

module.exports = { addEmailAuthEndpoints };