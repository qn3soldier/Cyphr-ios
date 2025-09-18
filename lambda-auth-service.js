/**
 * CYPHR MESSENGER - AWS LAMBDA AUTH SERVICE  
 * Enterprise serverless backend (замена PM2 crashes)
 */

const AWS = require('aws-sdk');
const { Client } = require('pg');

// Configure AWS services
const ses = new AWS.SES({ region: 'us-east-1' });
const sns = new AWS.SNS({ region: 'us-east-1' });

// RDS connection configuration
const dbConfig = {
  host: 'cyphr-production-db.cgni4my4o6a2.us-east-1.rds.amazonaws.com',
  port: 5432,
  database: 'postgres',
  user: 'cyphr_admin',
  password: 'xE2ucVDc4ihj8dAoPIoy3Hst',
  ssl: { rejectUnauthorized: false }
};

// Lambda handler for email OTP
exports.sendEmailOTP = async (event) => {
  try {
    const { email, isSignUp } = JSON.parse(event.body);
    
    console.log('📧 AWS Lambda: Send email OTP to:', email);
    
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP in RDS (with expiration)
    const client = new Client(dbConfig);
    await client.connect();
    
    await client.query(`
      INSERT INTO otp_codes (email, code, expires_at, type) 
      VALUES ($1, $2, NOW() + INTERVAL '10 minutes', $3)
      ON CONFLICT (email) DO UPDATE SET 
        code = EXCLUDED.code, 
        expires_at = EXCLUDED.expires_at
    `, [email, otp, isSignUp ? 'signup' : 'signin']);
    
    await client.end();
    
    // Send via AWS SES
    const emailParams = {
      Source: 'noreply@cyphrmessenger.app',
      Destination: { ToAddresses: [email] },
      Message: {
        Subject: { Data: 'Your Cyphr Messenger Code', Charset: 'UTF-8' },
        Body: {
          Html: {
            Data: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #6366f1;">Your Cyphr Messenger Verification Code</h2>
                <p>Enter this code to ${isSignUp ? 'complete registration' : 'sign in'}:</p>
                <div style="font-size: 32px; font-weight: bold; color: #6366f1; text-align: center; padding: 20px; background: #f8fafc; border-radius: 8px; margin: 20px 0;">
                  ${otp}
                </div>
                <p style="color: #64748b;">This code expires in 10 minutes.</p>
                <p style="color: #64748b;">Protected by post-quantum encryption.</p>
              </div>
            `,
            Charset: 'UTF-8'
          }
        }
      }
    };
    
    const result = await ses.sendEmail(emailParams).promise();
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        messageId: result.MessageId,
        message: 'OTP sent successfully'
      })
    };
    
  } catch (error) {
    console.error('❌ Lambda email OTP error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// Lambda handler for SMS OTP  
exports.sendSMSOTP = async (event) => {
  try {
    const { phone, isSignUp } = JSON.parse(event.body);
    
    console.log('📱 AWS Lambda: Send SMS OTP to:', phone);
    
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP in RDS
    const client = new Client(dbConfig);
    await client.connect();
    
    await client.query(`
      INSERT INTO otp_codes (phone, code, expires_at, type) 
      VALUES ($1, $2, NOW() + INTERVAL '10 minutes', $3)
      ON CONFLICT (phone) DO UPDATE SET 
        code = EXCLUDED.code, 
        expires_at = EXCLUDED.expires_at
    `, [phone, otp, isSignUp ? 'signup' : 'signin']);
    
    await client.end();
    
    // Send via AWS SNS
    const smsParams = {
      Message: `Your Cyphr Messenger code: ${otp}\n\nExpires in 10 minutes.\nSecured with post-quantum encryption.`,
      PhoneNumber: phone,
      MessageAttributes: {
        'AWS.SNS.SMS.SenderID': { DataType: 'String', StringValue: 'Cyphr' },
        'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' }
      }
    };
    
    const result = await sns.publish(smsParams).promise();
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        messageId: result.MessageId,
        message: 'SMS OTP sent successfully'
      })
    };
    
  } catch (error) {
    console.error('❌ Lambda SMS OTP error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// Lambda handler for OTP verification
exports.verifyOTP = async (event) => {
  try {
    const { email, phone, code, isSignUp } = JSON.parse(event.body);
    const identifier = email || phone;
    const column = email ? 'email' : 'phone';
    
    console.log('🔍 AWS Lambda: Verify OTP for:', identifier);
    
    // Verify OTP in RDS
    const client = new Client(dbConfig);
    await client.connect();
    
    const otpResult = await client.query(`
      SELECT code, expires_at, type FROM otp_codes 
      WHERE ${column} = $1 AND code = $2 AND expires_at > NOW()
    `, [identifier, code]);
    
    if (otpResult.rows.length === 0) {
      await client.end();
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid or expired OTP' })
      };
    }
    
    // Create or find user
    let user;
    const userResult = await client.query(`
      SELECT * FROM users WHERE ${column} = $1
    `, [identifier]);
    
    if (userResult.rows.length === 0 && isSignUp) {
      // Create new user
      const newUserResult = await client.query(`
        INSERT INTO users (${column}, full_name, status) 
        VALUES ($1, $2, 'online')
        RETURNING *
      `, [identifier, 'New User']);
      user = newUserResult.rows[0];
    } else {
      user = userResult.rows[0];
    }
    
    // Delete used OTP
    await client.query('DELETE FROM otp_codes WHERE ${column} = $1', [identifier]);
    await client.end();
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        user: user,
        isNewUser: !userResult.rows.length,
        accessToken: 'aws_jwt_token_placeholder'
      })
    };
    
  } catch (error) {
    console.error('❌ Lambda verify OTP error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};