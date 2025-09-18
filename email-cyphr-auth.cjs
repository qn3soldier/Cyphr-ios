// ENTERPRISE EMAIL & CYPHR_ID AUTHENTICATION MODULE
// Zero-Knowledge implementation for Cyphr Messenger
// Elite team approach: Signal/WhatsApp/Telegram level

const nodemailer = require('nodemailer');
const crypto = require('crypto');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');

// Email transporter configuration (use SendGrid/AWS SES in production)
const emailTransporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER || 'noreply@cyphrmessenger.app',  
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});

// In-memory OTP storage (should use Redis in production)
const emailOTPCodes = new Map();
const cyphrIdSessions = new Map();

// Generate secure OTP
function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

// Hash email for zero-knowledge storage
function hashEmail(email) {
  return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
}

// Create email authentication endpoints
function createEmailAuthEndpoints(app, supabase, redis, JWT_SECRET) {
  
  // ENDPOINT: Send OTP to email
  app.post('/api/auth/send-email-otp', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email || !email.includes('@')) {
        return res.status(400).json({ 
          success: false, 
          error: 'Valid email address required' 
        });
      }

      // Generate OTP
      const otp = generateOTP();
      const emailHash = hashEmail(email);
      
      // Store OTP in Redis with 10 min expiry
      if (redis) {
        await redis.setex(`email_otp:${emailHash}`, 600, otp);
      } else {
        emailOTPCodes.set(emailHash, { otp, expires: Date.now() + 600000 });
      }

      // Send email (production-ready HTML template)
      const mailOptions = {
        from: 'Cyphr Messenger <noreply@cyphrmessenger.app>',
        to: email,
        subject: 'Your Cyphr Messenger Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #7c3aed;">Cyphr Messenger</h2>
            <p>Your verification code is:</p>
            <h1 style="color: #7c3aed; font-size: 36px; letter-spacing: 5px;">${otp}</h1>
            <p>This code will expire in 10 minutes.</p>
            <p style="color: #666; font-size: 12px;">
              If you didn't request this code, please ignore this email.
              <br>Zero-Knowledge Architecture: We don't store your email address.
            </p>
          </div>
        `
      };

      await emailTransporter.sendMail(mailOptions);

      res.json({ 
        success: true, 
        message: 'Verification code sent to email',
        emailHash // Return hash for verification
      });

    } catch (error) {
      console.error('Email OTP error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to send verification code' 
      });
    }
  });

  // ENDPOINT: Verify email OTP
  app.post('/api/auth/verify-email-otp', async (req, res) => {
    try {
      const { email, code, isNewUser } = req.body;
      const emailHash = hashEmail(email);
      
      // Get stored OTP
      let storedOTP;
      if (redis) {
        storedOTP = await redis.get(`email_otp:${emailHash}`);
      } else {
        const stored = emailOTPCodes.get(emailHash);
        if (stored && stored.expires > Date.now()) {
          storedOTP = stored.otp;
        }
      }

      if (!storedOTP || storedOTP !== code) {
        return res.status(401).json({ 
          success: false, 
          error: 'Invalid or expired verification code' 
        });
      }

      // Clear OTP after successful verification
      if (redis) {
        await redis.del(`email_otp:${emailHash}`);
      } else {
        emailOTPCodes.delete(emailHash);
      }

      // Check if user exists or create new
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('email_hash', emailHash)
        .single();

      let user;
      if (existingUser) {
        user = existingUser;
      } else if (isNewUser) {
        // Create new user with email
        const { data: newUser, error } = await supabase
          .from('users')
          .insert({
            email_hash: emailHash,
            created_at: new Date().toISOString(),
            status: 'online'
          })
          .select()
          .single();

        if (error) throw error;
        user = newUser;
      } else {
        return res.status(404).json({ 
          success: false, 
          error: 'User not found. Please sign up first.' 
        });
      }

      // Generate JWT tokens
      const accessToken = jwt.sign(
        { userId: user.id, type: 'access', authMethod: 'email' },
        JWT_SECRET,
        { expiresIn: '15m' }
      );
      
      const refreshToken = jwt.sign(
        { userId: user.id, type: 'refresh' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        success: true,
        user: {
          id: user.id,
          emailHash: user.email_hash,
          cyphrId: user.cyphr_id
        },
        accessToken,
        refreshToken
      });

    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Verification failed' 
      });
    }
  });

  // ENDPOINT: Cyphr ID login
  app.post('/api/auth/cyphr-id-login', async (req, res) => {
    try {
      const { cyphrId, password } = req.body;
      
      if (!cyphrId || !password) {
        return res.status(400).json({ 
          success: false, 
          error: 'Cyphr ID and password required' 
        });
      }

      // Clean cyphr ID (remove @ if present)
      const cleanId = cyphrId.replace('@', '').toLowerCase();

      // Find user by cyphr_id
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('cyphr_id', cleanId)
        .single();

      if (error || !user) {
        return res.status(401).json({ 
          success: false, 
          error: 'Invalid Cyphr ID or password' 
        });
      }

      // Verify password with Argon2
      if (!user.password_hash) {
        return res.status(401).json({ 
          success: false, 
          error: 'Password not set for this account' 
        });
      }

      const isValid = await argon2.verify(user.password_hash, password);
      if (!isValid) {
        return res.status(401).json({ 
          success: false, 
          error: 'Invalid Cyphr ID or password' 
        });
      }

      // Generate JWT tokens
      const accessToken = jwt.sign(
        { userId: user.id, type: 'access', authMethod: 'cyphr_id' },
        JWT_SECRET,
        { expiresIn: '15m' }
      );
      
      const refreshToken = jwt.sign(
        { userId: user.id, type: 'refresh' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Store session in Redis
      if (redis) {
        await redis.setex(`session:${user.id}`, 900, JSON.stringify({
          cyphrId: user.cyphr_id,
          loginTime: Date.now()
        }));
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          cyphrId: user.cyphr_id,
          fullName: user.full_name
        },
        accessToken,
        refreshToken
      });

    } catch (error) {
      console.error('Cyphr ID login error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Login failed' 
      });
    }
  });

  // ENDPOINT: Set password for Cyphr ID
  app.post('/api/auth/set-cyphr-password', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1];
      
      if (!token) {
        return res.status(401).json({ 
          success: false, 
          error: 'Authentication required' 
        });
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      const { password } = req.body;

      if (!password || password.length < 8) {
        return res.status(400).json({ 
          success: false, 
          error: 'Password must be at least 8 characters' 
        });
      }

      // Hash password with Argon2
      const passwordHash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 2 ** 16,
        timeCost: 3,
        parallelism: 1
      });

      // Update user password
      const { error } = await supabase
        .from('users')
        .update({ password_hash: passwordHash })
        .eq('id', decoded.userId);

      if (error) throw error;

      res.json({ 
        success: true, 
        message: 'Password set successfully' 
      });

    } catch (error) {
      console.error('Set password error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to set password' 
      });
    }
  });

  console.log('✅ Email & Cyphr ID authentication endpoints created');
}

module.exports = { createEmailAuthEndpoints };