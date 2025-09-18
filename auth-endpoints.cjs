// Enterprise Authentication Endpoints for Cyphr Messenger
const express = require('express');
const argon2 = require('argon2');
const { generateTokens, validateRefreshToken } = require('./jwt-auth-middleware.cjs');

// Create auth endpoints
function createAuthEndpoints(app, supabase, twilioClient, redis) {
  
  // Login endpoint for existing users
  app.post('/api/login', async (req, res) => {
    try {
      const { phone, method = 'otp' } = req.body;

      if (!phone) {
        return res.status(400).json({ 
          success: false, 
          error: 'Phone number required' 
        });
      }

      // Check if user exists
      const { data: users, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('phone', phone)
        .limit(1);

      if (fetchError) {
        console.error('❌ Login fetch error:', fetchError);
        return res.status(500).json({ 
          success: false, 
          error: 'Database error' 
        });
      }

      if (!users || users.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'User not found. Please register first.' 
        });
      }

      const user = users[0];

      if (method === 'otp') {
        // Send OTP for login verification
        try {
          await twilioClient.verify.v2
            .services(process.env.TWILIO_VERIFY_SID)
            .verifications
            .create({ to: phone, channel: 'sms' });

          res.json({ 
            success: true, 
            message: 'Login OTP sent successfully',
            requiresVerification: true,
            userId: user.id
          });
        } catch (twilioError) {
          console.error('❌ Twilio login OTP error:', twilioError);
          res.status(500).json({ 
            success: false, 
            error: 'Failed to send login OTP' 
          });
        }
      } else {
        res.status(400).json({ 
          success: false, 
          error: 'Unsupported login method' 
        });
      }

    } catch (error) {
      console.error('❌ Login endpoint error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Login failed' 
      });
    }
  });

  // Verify login OTP and generate tokens
  app.post('/api/verify-login', async (req, res) => {
    try {
      const { phone, otpCode } = req.body;

      if (!phone || !otpCode) {
        return res.status(400).json({ 
          success: false, 
          error: 'Phone and OTP code required' 
        });
      }

      // Verify OTP with Twilio
      try {
        const verification = await twilioClient.verify.v2
          .services(process.env.TWILIO_VERIFY_SID)
          .verificationChecks
          .create({ to: phone, code: otpCode });

        if (verification.status !== 'approved') {
          return res.status(400).json({ 
            success: false, 
            error: 'Invalid OTP code' 
          });
        }
      } catch (twilioError) {
        console.error('❌ Twilio verification error:', twilioError);
        return res.status(400).json({ 
          success: false, 
          error: 'OTP verification failed' 
        });
      }

      // Get user data
      const { data: users, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('phone', phone)
        .limit(1);

      if (fetchError || !users || users.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'User not found' 
        });
      }

      const user = users[0];

      // Generate JWT tokens
      const { accessToken, refreshToken } = generateTokens(user.id, {
        phone: user.phone,
        fullName: user.full_name
      });

      // Store refresh token in Redis (for session management)
      if (redis) {
        try {
          await redis.setex(`cyphr:refresh:${user.id}`, 7 * 24 * 3600, refreshToken);
        } catch (redisError) {
          console.error('❌ Redis session storage error:', redisError);
        }
      }

      // Update last login
      await supabase
        .from('users')
        .update({ 
          last_seen: new Date().toISOString(),
          status: 'online'
        })
        .eq('id', user.id);

      res.json({
        success: true,
        message: 'Login successful',
        tokens: {
          accessToken,
          refreshToken
        },
        user: {
          id: user.id,
          phone: user.phone,
          fullName: user.full_name,
          uniqueId: user.unique_id,
          status: 'online'
        }
      });

    } catch (error) {
      console.error('❌ Verify login error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Login verification failed' 
      });
    }
  });

  // Refresh token endpoint
  app.post('/api/refresh-token', validateRefreshToken, async (req, res) => {
    try {
      const { userId } = req.user;

      // Check if refresh token exists in Redis
      if (redis) {
        const storedToken = await redis.get(`cyphr:refresh:${userId}`);
        if (!storedToken || storedToken !== req.body.refreshToken) {
          return res.status(401).json({ 
            success: false, 
            error: 'Invalid refresh token session' 
          });
        }
      }

      // Get user data for new token
      const { data: users, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .limit(1);

      if (fetchError || !users || users.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'User not found' 
        });
      }

      const user = users[0];

      // Generate new tokens
      const { accessToken, refreshToken } = generateTokens(userId, {
        phone: user.phone,
        fullName: user.full_name
      });

      // Update refresh token in Redis
      if (redis) {
        await redis.setex(`cyphr:refresh:${userId}`, 7 * 24 * 3600, refreshToken);
      }

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        tokens: {
          accessToken,
          refreshToken
        }
      });

    } catch (error) {
      console.error('❌ Refresh token error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Token refresh failed' 
      });
    }
  });

  // Logout endpoint
  app.post('/api/logout', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1];

      if (token) {
        const jwt = require('jsonwebtoken');
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          
          // Remove refresh token from Redis
          if (redis && decoded.userId) {
            await redis.del(`cyphr:refresh:${decoded.userId}`);
          }

          // Update user status to offline
          await supabase
            .from('users')
            .update({ 
              status: 'offline',
              last_seen: new Date().toISOString()
            })
            .eq('id', decoded.userId);

        } catch (jwtError) {
          console.error('❌ Logout JWT error:', jwtError);
        }
      }

      res.json({
        success: true,
        message: 'Logged out successfully'
      });

    } catch (error) {
      console.error('❌ Logout error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Logout failed' 
      });
    }
  });

  console.log('✅ Enterprise auth endpoints configured');
}

module.exports = { createAuthEndpoints };