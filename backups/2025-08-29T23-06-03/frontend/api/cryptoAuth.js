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
      
      // Generate human-readable Cyphr ID from public key
      const cyphrId = this.generateCyphrIdFromPublicKey(publicKeyBase64);
      
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
      
      // Create user in database (like other auth methods)
      await this.createCryptoUser(keysResult.cyphrId, keysResult.publicKey);
      
      // Register this device to prevent multiple accounts (with user_id link)
      await this.registerDevice(deviceFingerprint, keysResult.cyphrId, navigator.userAgent, keysResult.cyphrId);
      
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
   * DEVICE FINGERPRINTING - Cross-browser device detection
   */
  async getDeviceFingerprint() {
    try {
      // Collect hardware-specific data that's same across browsers
      const fingerprint = [
        navigator.hardwareConcurrency || 'unknown',
        navigator.deviceMemory || 'unknown', 
        screen.width + 'x' + screen.height,
        screen.colorDepth,
        navigator.platform,
        navigator.maxTouchPoints || 0,
        new Date().getTimezoneOffset(),
        navigator.language,
        // Hardware-specific WebGL fingerprint
        this.getWebGLFingerprint(),
        // Canvas fingerprint (hardware dependent)
        this.getCanvasFingerprint()
      ].join('|');
      
      // Hash the fingerprint for privacy
      const encoder = new TextEncoder();
      const data = encoder.encode(fingerprint);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      
      return this.arrayBufferToBase64(hashBuffer);
    } catch (error) {
      console.error('Failed to generate device fingerprint:', error);
      return 'unknown_device';
    }
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
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('Device fingerprint test', 2, 2);
      return canvas.toDataURL().slice(-50); // Last 50 chars are device-specific
    } catch {
      return 'canvas_error';
    }
  }
  
  async checkDeviceRegistration(fingerprint) {
    try {
      console.log('🔍 Checking device registration with fingerprint:', fingerprint.substring(0, 16) + '...');
      
      // Check with backend if this device fingerprint is already registered
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://app.cyphrmessenger.app/api'}/auth/check-device-registration`, {
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
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://app.cyphrmessenger.app/api'}/auth/register-device`, {
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
      console.log('👤 Creating crypto user in database:', cyphrId);
      
      // Import Supabase client
      const { supabase } = await import('@/api/supabaseClient');
      
      // Create user record like other auth methods
      const { data, error } = await supabase
        .from('users')
        .insert([{
          id: cyphrId, // UUID format
          full_name: 'Cyphr User',
          unique_id: cyphrId,
          public_key: publicKey,
          status: 'online',
          created_at: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (error) {
        console.error('❌ Failed to create crypto user:', error);
        throw new Error('Failed to create user account');
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
  
  stringToArrayBuffer(str) {
    const encoder = new TextEncoder();
    return encoder.encode(str);
  }
  
  generateCyphrIdFromPublicKey(publicKeyBase64) {
    // Generate proper UUID v4 from public key hash for database compatibility
    const hash = this.simpleHash(publicKeyBase64);
    // Convert to UUID format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuid = [
      hash.substring(0, 8),
      hash.substring(8, 12),
      '4' + hash.substring(13, 16), // Version 4
      '8' + hash.substring(17, 20), // Variant 10
      hash.substring(20, 32)
    ].join('-');
    
    return uuid;
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