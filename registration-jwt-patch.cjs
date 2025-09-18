// Registration JWT Integration Patch for Cyphr Messenger
// This patch modifies existing registration to include JWT token generation

const { generateTokens } = require('./jwt-auth-middleware.cjs');

// Enhanced registration verification with JWT tokens
function enhanceRegistrationWithJWT(app, supabase, redis) {
  
  // Override existing verify-otp endpoint to include JWT generation
  app.post('/api/auth/verify-otp-jwt', async (req, res) => {
    try {
      const { phone, otp, userData } = req.body;
      
      if (!phone || !otp) {
        return res.status(400).json({ 
          success: false,
          error: 'Phone and OTP are required' 
        });
      }

      // Normalize phone number
      let normalizedPhone = phone.trim();
      if (!normalizedPhone.startsWith('+')) {
        normalizedPhone = '+' + normalizedPhone.replace(/^[^0-9]*/, '');
      }

      // Verify OTP with Twilio (reuse existing Twilio client)
      try {
        const verification = await twilioClient.verify.v2
          .services(process.env.TWILIO_VERIFY_SID)
          .verificationChecks
          .create({ to: normalizedPhone, code: otp });

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

      // Check if user already exists
      const { data: existingUsers, error: checkError } = await supabase
        .from('users')
        .select('*')
        .eq('phone', normalizedPhone)
        .limit(1);

      if (checkError) {
        console.error('❌ User check error:', checkError);
        return res.status(500).json({ 
          success: false,
          error: 'Database error' 
        });
      }

      let user;
      let isNewUser = false;

      if (existingUsers && existingUsers.length > 0) {
        // Existing user - this is a login
        user = existingUsers[0];
        console.log('🔄 Existing user login:', user.id);
      } else {
        // New user - create account
        isNewUser = true;
        
        if (!userData || !userData.fullName) {
          return res.status(400).json({ 
            success: false,
            error: 'User data required for registration' 
          });
        }

        // Generate unique ID
        const uniqueId = `cyphr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const newUserData = {
          phone: normalizedPhone,
          full_name: userData.fullName,
          bio: userData.bio || '',
          unique_id: uniqueId,
          status: 'online',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_seen: new Date().toISOString()
        };

        const { data: newUsers, error: createError } = await supabase
          .from('users')
          .insert([newUserData])
          .select()
          .single();

        if (createError) {
          console.error('❌ User creation error:', createError);
          return res.status(500).json({ 
            success: false,
            error: 'Failed to create user account' 
          });
        }

        user = newUsers;
        console.log('✅ New user created:', user.id);
      }

      // Generate JWT tokens for both new and existing users
      const { accessToken, refreshToken } = generateTokens(user.id, {
        phone: user.phone,
        fullName: user.full_name,
        uniqueId: user.unique_id
      });

      // Store refresh token in Redis
      if (redis) {
        try {
          await redis.setex(`cyphr:refresh:${user.id}`, 7 * 24 * 3600, refreshToken);
          console.log('✅ Refresh token stored in Redis for user:', user.id);
        } catch (redisError) {
          console.error('❌ Redis session storage error:', redisError);
        }
      }

      // Update user status to online
      await supabase
        .from('users')
        .update({ 
          status: 'online',
          last_seen: new Date().toISOString()
        })
        .eq('id', user.id);

      // Success response with JWT tokens
      res.json({
        success: true,
        message: isNewUser ? 'Registration successful' : 'Login successful',
        isNewUser,
        tokens: {
          accessToken,
          refreshToken
        },
        user: {
          id: user.id,
          phone: user.phone,
          fullName: user.full_name,
          bio: user.bio,
          uniqueId: user.unique_id,
          status: 'online'
        }
      });

    } catch (error) {
      console.error('❌ Registration/Login JWT error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Authentication failed' 
      });
    }
  });

  console.log('✅ Registration enhanced with JWT tokens');
}

module.exports = { enhanceRegistrationWithJWT };