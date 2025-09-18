/**
 * CYPHR MESSENGER - CRYPTOGRAPHIC AUTHENTICATION SYSTEM
 * 
 * True self-sovereign identity using Ed25519 + WebAuthn
 * NO emails, phones, or passwords required!
 */

import { toast } from 'sonner';

export class CryptoAuthService {
  constructor() {
    this.keyPair = null;
    this.deviceCredential = null;
  }

  /**
   * STEP 1: Generate Ed25519 keypair for cryptographic identity
   */
  async generateIdentityKeys() {
    try {
      console.log('🔐 Generating Ed25519 keypair for cryptographic identity...');
      
      // Use Web Crypto API to generate Ed25519 keys
      const keyPair = await crypto.subtle.generateKey(
        {
          name: 'Ed25519',
          namedCurve: 'Ed25519',
        },
        true, // extractable for backup
        ['sign', 'verify']
      );

      // Export public key for User ID
      const publicKeyBuffer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
      const publicKeyBase64 = this.arrayBufferToBase64(publicKeyBuffer);
      
      // Generate UNIQUE human-readable Cyphr ID from device fingerprint
      const cyphrId = await this.generateUniqueCyphrIdFromDevice();
      
      console.log('✅ Generated cryptographic identity:', cyphrId);
      
      this.keyPair = keyPair;
      
      return {
        success: true,
        publicKey: publicKeyBase64,
        cyphrId: cyphrId,
        keyPair: keyPair
      };
      
    } catch (error) {
      console.error('❌ Failed to generate identity keys:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * STEP 2: Bind identity to device using WebAuthn
   */
  async bindToDevice(publicKey, cyphrId) {
    try {
      console.log('📱 Binding cryptographic identity to device...');
      
      // Check WebAuthn support
      if (!window.PublicKeyCredential) {
        throw new Error('WebAuthn not supported on this device');
      }
      
      // Create challenge for device binding
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: challenge,
          rp: {
            name: 'Cyphr Messenger',
            id: window.location.hostname
          },
          user: {
            id: this.stringToArrayBuffer(cyphrId),
            name: cyphrId,
            displayName: `Cyphr User ${cyphrId.slice(0, 8)}...`
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },  // ES256
            { alg: -257, type: 'public-key' } // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'preferred'
          },
          timeout: 60000,
          attestation: 'direct'
        }
      });
      
      if (!credential) {
        throw new Error('Device binding cancelled by user');
      }
      
      console.log('✅ Successfully bound to device');
      this.deviceCredential = credential;
      
      return {
        success: true,
        credentialId: credential.id,
        deviceInfo: {
          authenticatorAttachment: credential.authenticatorAttachment,
          id: credential.id
        }
      };
      
    } catch (error) {
      console.error('❌ Device binding failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * STEP 3: Create encrypted backup of private key
   */
  async createSecureBackup(keyPair, deviceCredentialId) {
    try {
      console.log('💾 Creating encrypted backup of private key...');
      
      // Export private key for backup
      const privateKeyBuffer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
      const privateKeyBase64 = this.arrayBufferToBase64(privateKeyBuffer);
      
      // Generate recovery phrase (BIP39-style but simple)
      const recoveryPhrase = this.generateRecoveryPhrase();
      
      // Encrypt private key with recovery phrase
      const encryptedPrivateKey = await this.encryptWithPassphrase(privateKeyBase64, recoveryPhrase);
      
      // Store encrypted backup locally
      const backup = {
        encryptedPrivateKey: encryptedPrivateKey,
        deviceCredentialId: deviceCredentialId,
        publicKey: this.arrayBufferToBase64(await crypto.subtle.exportKey('spki', keyPair.publicKey)),
        timestamp: Date.now(),
        version: '1.0'
      };
      
      localStorage.setItem('cyphr_crypto_backup', JSON.stringify(backup));
      sessionStorage.setItem('recovery_phrase', recoveryPhrase);
      
      console.log('✅ Secure backup created');
      
      return {
        success: true,
        recoveryPhrase: recoveryPhrase,
        backupCreated: true
      };
      
    } catch (error) {
      console.error('❌ Backup creation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * AUTO-LOGIN: Retrieve stored device credentials
   */
  async getStoredDeviceCredentials() {
    try {
      console.log('🔍 [cryptoAuth] Checking for stored device credentials...');
      console.log('🔍 [cryptoAuth] DEBUG: WebAuthn support =', !!window.PublicKeyCredential);
      console.log('🔍 [cryptoAuth] DEBUG: User Agent =', navigator.userAgent);
      
      // Check if WebAuthn is supported
      if (!window.PublicKeyCredential) {
        console.log('❌ [cryptoAuth] WebAuthn not supported on this device');
        return this.getStoredCredentialsFallback();
      }

      // Check for stored backup
      console.log('🔍 [cryptoAuth] Checking localStorage for cyphr_crypto_backup...');
      const storedBackup = localStorage.getItem('cyphr_crypto_backup');
      console.log('🔍 [cryptoAuth] storedBackup =', storedBackup ? 'EXISTS' : 'NOT_FOUND');
      
      // ДОПОЛНИТЕЛЬНАЯ ДИАГНОСТИКА для пользователя
      console.log('🔍 [cryptoAuth] All localStorage keys:', Object.keys(localStorage));
      console.log('🔍 [cryptoAuth] All sessionStorage keys:', Object.keys(sessionStorage));
      if (storedBackup) {
        try {
          const backupParsed = JSON.parse(storedBackup);
          console.log('🔍 [cryptoAuth] Backup contents:', {
            hasDeviceCredentialId: !!backupParsed.deviceCredentialId,
            hasPublicKey: !!backupParsed.publicKey,
            timestamp: backupParsed.timestamp,
            version: backupParsed.version
          });
        } catch (e) {
          console.error('🔍 [cryptoAuth] Failed to parse backup:', e);
        }
      }
      
      if (!storedBackup) {
        console.log('❌ [cryptoAuth] No stored credentials found');
        return {
          success: false,
          error: 'No stored credentials found'
        };
      }

      const backup = JSON.parse(storedBackup);
      if (!backup.deviceCredentialId) {
        return {
          success: false,
          error: 'No device credential ID found'
        };
      }

      console.log('✅ Found stored credentials, attempting auto-login...');

      // Create challenge for authentication
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: challenge,
          allowCredentials: [{
            id: this.base64ToArrayBuffer(backup.deviceCredentialId),
            type: 'public-key'
          }],
          userVerification: 'preferred',
          timeout: 30000
        }
      });

      if (!assertion) {
        throw new Error('Device authentication cancelled');
      }

      // Extract user info from DEVICE (consistent with device fingerprint)
      const cyphrId = await this.generateUniqueCyphrIdFromDevice();

      console.log('✅ Device credentials retrieved successfully:', cyphrId);

      return {
        success: true,
        cyphrId: cyphrId,
        publicKey: backup.publicKey,
        deviceCredential: assertion,
        hasStoredCredentials: true
      };

    } catch (error) {
      console.error('❌ WebAuthn failed, using localStorage fallback:', error);
      
      // MOBILE FALLBACK: Use localStorage instead of WebAuthn
      return this.getStoredCredentialsFallback();
    }
  }

  getStoredCredentialsFallback() {
    try {
      console.log('📱 Using mobile fallback for stored credentials...');
      
      const storedBackup = localStorage.getItem('cyphr_crypto_backup');
      if (!storedBackup) {
        return {
          success: false,
          error: 'No stored credentials found'
        };
      }

      const backup = JSON.parse(storedBackup);
      const cyphrId = backup.cyphrId || this.generateCyphrIdFromDevice();

      console.log('✅ Mobile fallback credentials retrieved:', cyphrId);

      return {
        success: true,
        cyphrId: cyphrId,
        publicKey: backup.publicKey,
        hasStoredCredentials: true,
        method: 'localStorage_fallback'
      };

    } catch (error) {
      console.error('❌ Mobile fallback failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * COMPLETE SIGNUP: Full cryptographic identity creation
   */
  async completeCryptoSignUp() {
    try {
      console.log('🔍 STEP 0: Checking device fingerprint for existing registrations...');
      
      // ENTERPRISE SECURITY: Check device fingerprint across ALL browsers
      const deviceFingerprint = await this.getDeviceFingerprint();
      console.log('📱 Device fingerprint generated:', deviceFingerprint.substring(0, 16) + '...');
      
      const existingRegistration = await this.checkDeviceRegistration(deviceFingerprint);
      console.log('🔍 Device registration check result:', existingRegistration);
      
      if (existingRegistration.exists) {
        const errorMsg = `This device already has a Cyphr Identity (${existingRegistration.cyphrId}). One identity per physical device allowed.`;
        console.error('❌ Device already registered:', errorMsg);
        throw new Error(errorMsg);
      }
      
      console.log('✅ Device available for new registration');
      
      // Step 1: Generate keys
      console.log('🔍 STEP 1: Generating identity keys...');
      const keysResult = await this.generateIdentityKeys();
      if (!keysResult.success) {
        throw new Error(keysResult.error);
      }
      
      // Step 2: Bind to device
      const bindResult = await this.bindToDevice(keysResult.publicKey, keysResult.cyphrId);
      if (!bindResult.success) {
        throw new Error(bindResult.error);
      }
      
      // Step 3: Create backup
      const backupResult = await this.createSecureBackup(keysResult.keyPair, bindResult.credentialId);
      if (!backupResult.success) {
        throw new Error(backupResult.error);
      }
      
      // Create user in database AND register device (enforces one per device)
      const registrationResult = await this.createCryptoUser(keysResult.cyphrId, keysResult.publicKey);
      
      // Store user session
      const userProfile = {
        id: keysResult.cyphrId,
        name: `Cyphr User`,
        cyphrId: keysResult.cyphrId,
        authMethod: 'cryptographic',
        publicKey: keysResult.publicKey,
        deviceBound: true,
        createdAt: Date.now()
      };
      
      sessionStorage.setItem('user_profile', JSON.stringify(userProfile));
      sessionStorage.setItem('userId', keysResult.cyphrId);
      sessionStorage.setItem('authMethod', 'cryptographic');
      
      console.log('🎉 Cryptographic signup completed successfully!');
      
      return {
        success: true,
        user: userProfile,
        recoveryPhrase: backupResult.recoveryPhrase,
        cyphrId: keysResult.cyphrId
      };
      
    } catch (error) {
      console.error('❌ Crypto signup failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * STABLE DEVICE FINGERPRINTING using FingerprintJS
   */
  async getDeviceFingerprint() {
    try {
      console.log('🔍 [STABLE] Generating device fingerprint with FingerprintJS...');
      
      // Use FingerprintJS for stable cross-browser device identification
      const FingerprintJS = await import('@fingerprintjs/fingerprintjs');
      const fp = await FingerprintJS.default.load({ 
        delayFallback: 500,
        debug: false
      });
      
      const result = await fp.get();
      console.log('✅ [STABLE] Device fingerprint generated:', result.visitorId.substring(0, 16) + '...');
      
      return result.visitorId; // Stable 32-char hex string, same across browsers/apps
    } catch (error) {
      console.error('❌ FingerprintJS failed, using fallback:', error);
      return this.getFallbackDeviceFingerprint();
    }
  }
  
  getFallbackDeviceFingerprint() {
    // Fallback for cases where FingerprintJS fails
    const fingerprint = [
      navigator.hardwareConcurrency || 'unknown',
      screen.width + 'x' + screen.height,
      navigator.platform,
      navigator.language,
      new Date().getTimezoneOffset()
    ].join('|');
    
    // Simple hash for fallback
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return 'fallback_' + Math.abs(hash).toString(16);
  }
  
  getWebGLFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl');
      if (!gl) return 'no_webgl';
      
      return gl.getParameter(gl.RENDERER) + '|' + gl.getParameter(gl.VENDOR);
    } catch {
      return 'webgl_error';
    }
  }
  
  getCanvasFingerprint() {
    try {
      // Use stable hardware-based fingerprint instead of canvas
      const fingerprint = [
        navigator.userAgent,
        navigator.language,
        screen.width + 'x' + screen.height,
        screen.colorDepth,
        new Date().getTimezoneOffset(),
        navigator.hardwareConcurrency || 'unknown',
        navigator.platform
      ].join('|');
      
      // Create simple hash for consistent device ID
      let hash = 0;
      for (let i = 0; i < fingerprint.length; i++) {
        const char = fingerprint.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      
      return 'stable_' + Math.abs(hash).toString(36);
    } catch {
      return 'canvas_error';
    }
  }
  
  async checkDeviceRegistration(fingerprint) {
    try {
      console.log('🔍 Checking device registration with fingerprint:', fingerprint.substring(0, 16) + '...');
      
      // Check with backend if this device fingerprint is already registered
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://app.cyphrmessenger.app/api'}/crypto/check-device-registration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceFingerprint: fingerprint })
      });
      
      const data = await response.json();
      console.log('📱 Device registration response:', data);
      
      return {
        exists: data.exists || false,
        browser: data.registeredBrowser || null,
        cyphrId: data.cyphrId || null
      };
    } catch (error) {
      console.error('❌ Device registration check failed:', error);
      return { exists: false };
    }
  }
  
  async registerDevice(fingerprint, cyphrId, browserInfo, userId = null) {
    try {
      console.log('📱 Registering device for Cyphr ID:', cyphrId);
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://app.cyphrmessenger.app/api'}/crypto/register-device`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          deviceFingerprint: fingerprint,
          cyphrId: cyphrId,
          browserInfo: browserInfo,
          userId: userId || cyphrId
        })
      });
      
      const data = await response.json();
      console.log('✅ Device registration result:', data);
      
      return data.success || false;
    } catch (error) {
      console.error('❌ Device registration failed:', error);
      return false;
    }
  }
  
  async createCryptoUser(cyphrId, publicKey) {
    try {
      console.log('👤 Creating crypto user via API (with device restrictions):', cyphrId);
      
      // Use backend API instead of direct database access
      // This ensures device registration checks are enforced
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://app.cyphrmessenger.app/api'}/crypto/register-device`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceFingerprint: await this.getDeviceFingerprint(),
          cyphrId: cyphrId,
          publicKey: publicKey,
          webauthnCredentialId: this.deviceCredential?.id || 'pending',
          browserInfo: {
            name: navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Other',
            platform: navigator.platform
          }
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('❌ Failed to create crypto user:', data);
        throw new Error(data.error || 'Failed to create user account');
      }
      
      console.log('✅ Crypto user created successfully');
      return data;
    } catch (error) {
      console.error('❌ Create crypto user error:', error);
      throw error;
    }
  }

  /**
   * UTILITY FUNCTIONS
   */
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach((b) => binary += String.fromCharCode(b));
    return window.btoa(binary);
  }
  
  base64ToArrayBuffer(base64) {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
  
  stringToArrayBuffer(str) {
    const encoder = new TextEncoder();
    return encoder.encode(str);
  }
  
  async generateCyphrIdFromDevice() {
    // Generate stable alphanumeric Cyphr ID from device fingerprint
    const deviceFingerprint = await this.getDeviceFingerprint();
    console.log('🆔 Generating Cyphr ID from device fingerprint...');
    
    // Create deterministic ID from device hash - 8 characters alphanumeric  
    const hash = this.simpleHash(deviceFingerprint);
    const cyphrId = hash.substring(0, 8).toLowerCase();
    
    console.log('✅ Generated device-bound Cyphr ID:', cyphrId);
    return cyphrId;
  }

  async generateUniqueCyphrIdFromDevice() {
    // Generate unique alphanumeric Cyphr ID from device fingerprint with uniqueness check
    const deviceFingerprint = await this.getDeviceFingerprint();
    console.log('🆔 Generating unique Cyphr ID from device fingerprint...');
    
    // Create base ID from device hash - 8 characters alphanumeric  
    const hash = this.simpleHash(deviceFingerprint);
    const baseId = hash.substring(0, 8).toLowerCase();
    
    // CHECK UNIQUENESS and find available variant
    let finalCyphrId = baseId;
    let attempt = 0;
    let isUnique = false;
    
    while (!isUnique && attempt < 50) {
      console.log('🔍 Checking uniqueness for:', finalCyphrId);
      
      const uniqueCheck = await this.checkCyphrIdAvailability(finalCyphrId);
      if (uniqueCheck.available) {
        isUnique = true;
        console.log('✅ Found unique Cyphr ID:', finalCyphrId);
      } else {
        attempt++;
        finalCyphrId = baseId + (1000 + attempt).toString();
        console.log('⚠️ Cyphr ID taken, trying:', finalCyphrId);
      }
    }
    
    if (!isUnique) {
      throw new Error('Failed to generate unique Cyphr ID after 50 attempts');
    }
    
    return finalCyphrId;
  }
  
  async checkCyphrIdAvailability(cyphrId) {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://app.cyphrmessenger.app/api'}/auth/check-cyphr-id-availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cyphrId })
      });
      
      const result = await response.json();
      return result; // { available: boolean, suggestions?: string[] }
    } catch (error) {
      console.error('❌ Failed to check Cyphr ID availability:', error);
      return { available: false, error: error.message };
    }
  }
  
  simpleHash(input) {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    // Ensure 32 character hex string for UUID generation
    return Math.abs(hash).toString(16).padStart(8, '0').repeat(4);
  }
  
  generateRecoveryPhrase() {
    // Simple 12-word recovery phrase
    const words = [
      'quantum', 'secure', 'private', 'crypto', 'identity', 'freedom',
      'sovereign', 'digital', 'future', 'decentralized', 'authentic', 'trust'
    ];
    
    const phrase = [];
    for (let i = 0; i < 12; i++) {
      const randomIndex = Math.floor(Math.random() * words.length);
      phrase.push(words[randomIndex] + Math.floor(Math.random() * 1000));
    }
    
    return phrase.join(' ');
  }
  
  async encryptWithPassphrase(data, passphrase) {
    // Simple encryption for demo (in production use proper KDF)
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(passphrase.padEnd(32, '0').substring(0, 32)),
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encoder.encode(data)
    );
    
    return {
      encrypted: this.arrayBufferToBase64(encrypted),
      iv: this.arrayBufferToBase64(iv)
    };
  }
}

// Export singleton instance
export const cryptoAuth = new CryptoAuthService();