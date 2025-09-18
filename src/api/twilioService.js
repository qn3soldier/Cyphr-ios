const TWILIO_ACCOUNT_SID = import.meta.env.VITE_TWILIO_ACCOUNT_SID;
const TWILIO_VERIFY_SID = import.meta.env.VITE_TWILIO_VERIFY_SID;
// TWILIO_AUTH_TOKEN is backend-only for security - not exposed to frontend
const TWILIO_PHONE_NUMBER = import.meta.env.VITE_TWILIO_PHONE_NUMBER;
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'https://app.cyphrmessenger.app';

// Client-side Twilio service that communicates with our backend
export const twilioService = {
  // Send direct SMS (not using Verify service)
  async sendSMS(phoneNumber, message) {
    try {
      const response = await fetch(`${SERVER_URL}/sms/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          to: phoneNumber.replace(/[^\d+]/g, ''), // Remove formatting, keep + for country code
          body: message
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send SMS');
      }

      return { success: true, sid: data.sid };
    } catch (error) {
      console.error('Error sending SMS:', error);
      return { success: false, error: error.message };
    }
  },

  // Send OTP code to phone number
  async sendOTP(phoneNumber) {
    try {
      const response = await fetch(`${SERVER_URL}/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          phone: phoneNumber.replace(/[^\d+]/g, '') // Remove formatting, keep + for country code
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send OTP');
      }

      return data;
    } catch (error) {
      console.error('Error sending OTP:', error);
      throw error;
    }
  },

  // Verify OTP code
  async verifyOTP(phoneNumber, code) {
    try {
      const response = await fetch(`${SERVER_URL}/auth/verify-otp-jwt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          phone: phoneNumber.replace(/[^\d+]/g, ''), // Remove formatting, keep + for country code
          otp: code 
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Invalid verification code');
      }

      return data;
    } catch (error) {
      console.error('Error verifying OTP:', error);
      throw error;
    }
  },

  // Resend OTP code
  async resendOTP(phoneNumber) {
    return this.sendOTP(phoneNumber);
  }
}; 