/**
 * Secure Backend Service
 * Handles all sensitive cryptographic operations on the backend
 * NEVER exposes private keys, secrets, or sensitive data to frontend
 */

class SecureBackendService {
  constructor() {
    this.baseURL = import.meta.env.VITE_SERVER_URL || 'https://app.cyphrmessenger.app';
  }

  /**
   * Authenticate with backend using secure token
   */
  async authenticate(userId, passwordHash) {
    try {
      const response = await fetch(`${this.baseURL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          passwordHash,
        }),
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Store secure session token (not sensitive keys!)
      if (data.sessionToken) {
        localStorage.setItem('secure_session_token', data.sessionToken);
      }

      return data;
    } catch (error) {
      console.error('❌ Authentication failed:', error);
      throw error;
    }
  }

  /**
   * Generate TOTP secret on backend (never expose to frontend)
   */
  async generateTOTPSecret(userId) {
    try {
      const response = await fetch(`${this.baseURL}/api/auth/totp/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getSessionToken()}`,
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error(`TOTP generation failed: ${response.statusText}`);
      }

      return await response.json();
      // Returns: { qrCode: string, backupCodes: string[] }
      // NEVER returns the actual secret!
    } catch (error) {
      console.error('❌ TOTP secret generation failed:', error);
      throw error;
    }
  }

  /**
   * Verify TOTP code on backend
   */
  async verifyTOTPCode(userId, code) {
    try {
      const response = await fetch(`${this.baseURL}/api/auth/totp/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getSessionToken()}`,
        },
        body: JSON.stringify({ userId, code }),
      });

      if (!response.ok) {
        throw new Error(`TOTP verification failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ TOTP verification failed:', error);
      throw error;
    }
  }

  /**
   * Create Stellar wallet on backend (private keys never leave server)
   */
  async createStellarWallet(userId, encryptedSeed) {
    try {
      const response = await fetch(`${this.baseURL}/api/wallet/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getSessionToken()}`,
        },
        body: JSON.stringify({
          userId,
          encryptedSeed, // Already encrypted on frontend with user's PIN
        }),
      });

      if (!response.ok) {
        throw new Error(`Wallet creation failed: ${response.statusText}`);
      }

      return await response.json();
      // Returns: { publicKey: string, stellarAddress: string }
      // NEVER returns private key or seed!
    } catch (error) {
      console.error('❌ Wallet creation failed:', error);
      throw error;
    }
  }

  /**
   * Sign Stellar transaction on backend
   */
  async signStellarTransaction(userId, transactionXDR, pin) {
    try {
      const response = await fetch(`${this.baseURL}/api/wallet/sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getSessionToken()}`,
        },
        body: JSON.stringify({
          userId,
          transactionXDR,
          pin, // Used to decrypt user's seed on backend
        }),
      });

      if (!response.ok) {
        throw new Error(`Transaction signing failed: ${response.statusText}`);
      }

      return await response.json();
      // Returns: { signedTransactionXDR: string }
    } catch (error) {
      console.error('❌ Transaction signing failed:', error);
      throw error;
    }
  }

  /**
   * Get wallet balance (using backend's Stellar keys)
   */
  async getWalletBalance(userId) {
    try {
      const response = await fetch(`${this.baseURL}/api/wallet/balance/${userId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getSessionToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Balance fetch failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Balance fetch failed:', error);
      throw error;
    }
  }

  /**
   * Hash password securely on backend
   */
  async hashPassword(password, userId) {
    try {
      const response = await fetch(`${this.baseURL}/api/auth/hash-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password,
          userId, // Used for salt generation
        }),
      });

      if (!response.ok) {
        throw new Error(`Password hashing failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.hash;
    } catch (error) {
      console.error('❌ Password hashing failed:', error);
      throw error;
    }
  }

  /**
   * Encrypt sensitive data on backend
   */
  async encryptSensitiveData(data, userId, userPin) {
    try {
      const response = await fetch(`${this.baseURL}/api/crypto/encrypt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getSessionToken()}`,
        },
        body: JSON.stringify({
          data,
          userId,
          userPin,
        }),
      });

      if (!response.ok) {
        throw new Error(`Encryption failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Encryption failed:', error);
      throw error;
    }
  }

  /**
   * Decrypt sensitive data on backend
   */
  async decryptSensitiveData(encryptedData, userId, userPin) {
    try {
      const response = await fetch(`${this.baseURL}/api/crypto/decrypt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getSessionToken()}`,
        },
        body: JSON.stringify({
          encryptedData,
          userId,
          userPin,
        }),
      });

      if (!response.ok) {
        throw new Error(`Decryption failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Decryption failed:', error);
      throw error;
    }
  }

  /**
   * Get session token from secure storage
   */
  getSessionToken() {
    return localStorage.getItem('secure_session_token');
  }

  /**
   * Clear all sensitive data from local storage
   */
  clearSensitiveData() {
    // Remove any potentially sensitive items
    localStorage.removeItem('secure_session_token');
    localStorage.removeItem('totp_secret'); // This should never exist after our fix
    
    // Clear any other sensitive items
    const sensitiveKeys = [
      'stellar_private_key',
      'stellar_secret',
      'private_key',
      'seed_phrase',
      'mnemonic',
      'wallet_seed'
    ];
    
    sensitiveKeys.forEach(key => {
      localStorage.removeItem(key);
    });
    
    console.log('🧹 Cleared all sensitive data from frontend storage');
  }

  /**
   * Security audit - check for exposed sensitive data
   */
  performSecurityAudit() {
    const issues = [];
    
    // Check localStorage for sensitive data
    const sensitivePatterns = [
      'secret',
      'private',
      'seed',
      'mnemonic',
      'password',
      'key'
    ];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const hasPattern = sensitivePatterns.some(pattern => 
        key?.toLowerCase().includes(pattern)
      );
      
      if (hasPattern && key !== 'secure_session_token') {
        issues.push(`Sensitive data found in localStorage: ${key}`);
      }
    }
    
    // Check environment variables
    const envVars = Object.keys(import.meta.env);
    const sensitiveEnvVars = envVars.filter(key => 
      sensitivePatterns.some(pattern => 
        key.toLowerCase().includes(pattern)
      )
    );
    
    if (sensitiveEnvVars.length > 0) {
      issues.push(`Sensitive environment variables exposed: ${sensitiveEnvVars.join(', ')}`);
    }
    
    return {
      isSecure: issues.length === 0,
      issues,
      timestamp: new Date().toISOString()
    };
  }
}

export default new SecureBackendService();