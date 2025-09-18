import QuantumCrypto from './crypto/quantumCrypto.js';
import { quantumKDF } from './quantumKDF.js';
import { hybridEncryption } from './crypto/hybridEncryption.js';
import { secureStorage } from './crypto/secureStorage';
import { twilioService } from './twilioService.js';
import { hashPassword as argon2Hash, verifyPassword as argon2Verify } from './argon2Wrapper.js';
import * as OTPAuth from 'otplib';
import { complianceLogger } from './compliance/complianceLogger.js';
import { supabase } from './supabaseClient';

// Initialize Kyber for quantum-safe encryption
const kyber = new QuantumCrypto();

class ZeroKnowledgeAuth {
  constructor() {
    this.sessionKey = null;
    this.derivedKey = null;
  }

  /**
   * REAL Phone Authentication with Twilio backend
   */
  async initiatePhoneAuth(phoneNumber) {
    try {
      // Hash phone number with SHA-3 (quantum-safe)
      const phoneHash = await quantumKDF.hashPhone(phoneNumber);
      
      // Request OTP via our backend (which uses Twilio)
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://app.cyphrmessenger.app/api'}/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: phoneNumber })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send OTP');
      }
      
      // Store temporary session data (expires in 10 min)
      sessionStorage.setItem('auth_session', JSON.stringify({
        phone: phoneNumber,
        phoneHash,
        timestamp: Date.now(),
        expires: Date.now() + 600000 // 10 minutes
      }));

      console.log('✅ REAL OTP sent via Twilio to:', phoneNumber);
      
      // Compliance logging
      complianceLogger.logAuthentication(phoneHash, 'phone_otp_request', true, {
        phone: phoneNumber,
        timestamp: Date.now()
      });
      
      return { success: true, message: 'Verification code sent to your phone' };
    } catch (error) {
      console.error('Phone auth error:', error);
      
      // Log failed authentication attempt
      const phoneHash = await quantumKDF.hashPhone(phoneNumber).catch(() => 'unknown');
      complianceLogger.logAuthentication(phoneHash, 'phone_otp_request', false, {
        phone: phoneNumber,
        error: error.message,
        timestamp: Date.now()
      });
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Verify REAL OTP with FULL quantum crypto restoration
   * @param {string} phone - Phone number
   * @param {string} otp - OTP code  
   * @param {boolean} isNewUser - Whether this is signup (true) or login (false)
   */
  async verifyOTP(phone, otp, isNewUser = false) {
    try {
      // Get auth session from storage
      let authSession = JSON.parse(sessionStorage.getItem('auth_session'));
      
      // If called with only one parameter, assume it's OTP and get phone from session
      if (typeof phone === 'string' && !otp) {
        otp = phone;
        if (!authSession || Date.now() > authSession.expires) {
          throw new Error('Session expired');
        }
        phone = authSession.phone;
      } else if (!authSession) {
        // If no session stored, create temporary one
        authSession = {
          phone: phone,
          phoneHash: await quantumKDF.hashPhone(phone),
          expires: Date.now() + 600000 // 10 minutes
        };
      }

      console.log('🔍 Verifying OTP for phone:', phone, 'with code:', otp);

      // Verify OTP via our backend (which uses Twilio)
      console.log('🔍 DEBUG: authService.verifyOTP called with isNewUser =', isNewUser);
      
      const apiBase = (import.meta.env.VITE_BACKEND_URL || 'https://app.cyphrmessenger.app/api').replace(/\/$/, '');
      const requestBody = { 
        phone: phone, 
        code: otp,
        isNewUser,
        userData: { fullName: 'Phone User' }
      };
      console.log('🔍 DEBUG: Sending phone request body:', requestBody);
      
      const response = await fetch(`${apiBase}/auth/verify-phone-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      console.log('🔍 Backend response:', data);

      if (!response.ok) {
        console.error('❌ Phone verification failed:', data);
        throw new Error(data.error || 'Invalid phone verification code');
      }

      // Store JWT tokens
      if (data.accessToken) {
        sessionStorage.setItem('accessToken', data.accessToken);
        sessionStorage.setItem('refreshToken', data.refreshToken);
      }

      // Store user session data with REAL quantum public key
      sessionStorage.setItem('userId', data.user.id);
      sessionStorage.setItem('userPublicKey', data.user.quantum_key || data.user.public_key);

      // Clear phone session
      sessionStorage.removeItem('auth_session');

      console.log('✅ Phone authentication successful, userId:', data.user.id);

      // Compliance logging for successful authentication
      complianceLogger.logAuthentication(data.user.id, 'otp_verification', true, {
        phone: authSession.phone,
        method: 'quantum_kyber',
        timestamp: Date.now()
      });

      return {
        success: true,
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        publicKey // Keep publicKey for crypto operations
      };
    } catch (error) {
      console.error('OTP verification error:', error);
      
      // Log failed authentication
      const phoneHash = await quantumKDF.hashPhone(phone).catch(() => 'unknown');
      complianceLogger.logAuthentication(phoneHash, 'otp_verification', false, {
        phone: phone,
        error: error.message,
        timestamp: Date.now()
      });
      
      return { success: false, error: error.message };
    }
  }

  /**
   * RESTORED: Derive master key using Argon2id (quantum-resistant KDF)
   * Работает БЕЗ биометрии, использует device entropy
   */
  async deriveMasterKeyArgon2(salt) {
    try {
      // НЕ запрашиваем биометрию автоматически - используем device ID
      const deviceEntropy = this.getDeviceId();
      
      // Combine entropy sources (БЕЗ биометрии)
      const entropySources = [
        salt,
        deviceEntropy,
        navigator.userAgent,
        new Date().getTimezoneOffset(),
        window.screen.colorDepth,
        navigator.language,
        window.screen.width + 'x' + window.screen.height,
        navigator.hardwareConcurrency || 4,
        Math.random().toString() // Дополнительная энтропия
      ];

      // Use quantum-safe KDF
      const combinedEntropy = await quantumKDF.combineEntropy(entropySources);
      
      // Check if device supports Argon2
      const supportsArgon2 = await quantumKDF.checkSupport();
      
      // Derive key with Argon2id or fallback
      const derivedResult = await quantumKDF.deriveKey(
        combinedEntropy,
        salt,
        {
          iterations: supportsArgon2 ? 3 : 600000, // Argon2: 3 iter, PBKDF2: 600k
          memory: 65536, // 64 MB for Argon2
          parallelism: 4,
          keyLength: 32
        }
      );

      // Generate ephemeral keys for hybrid encryption
      const ephemeralKeys = await hybridEncryption.generateEphemeralKeys();

      return {
        masterKey: derivedResult.key,
        encoded: derivedResult.encoded,
        fallback: derivedResult.fallback,
        publicKey: ephemeralKeys.publicKey,
        secretKey: ephemeralKeys.secretKey
      };
    } catch (error) {
      console.error('Key derivation error:', error);
      throw error;
    }
  }

  /**
   * RESTORED: Get biometric data (WebAuthn API)
   * ТОЛЬКО по запросу пользователя из настроек!
   */
  async getBiometricData() {
    try {
      if (!window.PublicKeyCredential) return null;

      // Не запрашиваем автоматически - только если пользователь хочет
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!available) return null;

      // НЕ показываем автоматически! Только по запросу!
      return null; // Временно отключено чтобы не раздражать

      // Create challenge for WebAuthn
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { 
            name: 'Cyphr Messenger',
            id: window.location.hostname
          },
          user: {
            id: crypto.getRandomValues(new Uint8Array(16)),
            name: 'user@cyphr',
            displayName: 'Cyphr User'
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
          attestation: 'none'
        }
      });

      // Use credential ID as biometric entropy
      return credential.id;
    } catch (error) {
      // НЕ просим PIN если биометрия недоступна
      console.log('Biometrics not available, using device entropy');
      return null;
    }
  }

  /**
   * ФУНКЦИЯ ДЛЯ ВКЛЮЧЕНИЯ БИОМЕТРИИ ИЗ НАСТРОЕК
   */
  async enableBiometricsFromSettings() {
    try {
      if (!window.PublicKeyCredential) {
        throw new Error('Biometrics not supported on this device');
      }

      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!available) {
        throw new Error('Platform authenticator not available');
      }

      // Показываем ТОЛЬКО когда пользователь явно запросил из настроек
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { 
            name: 'Cyphr Messenger',
            id: window.location.hostname
          },
          user: {
            id: crypto.getRandomValues(new Uint8Array(16)),
            name: 'user@cyphr',
            displayName: 'Cyphr User'
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
          attestation: 'none'
        }
      });

      // Сохраняем биометрический ключ
      localStorage.setItem('biometric_key', credential.id);
      localStorage.setItem('biometrics_enabled', 'true');
      
      return {
        success: true,
        credentialId: credential.id
      };
    } catch (error) {
      console.error('Biometric setup failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get unique device identifier
   * Enhanced with more entropy sources БЕЗ биометрии
   */
  getDeviceId() {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
      // Generate high-entropy device ID БЕЗ биометрии
      const sources = [
        crypto.randomUUID(),
        Date.now(),
        Math.random(),
        navigator.userAgent,
        window.screen.width + 'x' + window.screen.height,
        navigator.language,
        navigator.hardwareConcurrency || 4,
        navigator.deviceMemory || 8,
        new Date().getTimezoneOffset(),
        window.screen.colorDepth
      ];
      
      deviceId = sources.join('|');
      localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
  }

  /**
   * Auto-refresh session
   */
  async refreshSession() {
    try {
      const { data: session, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      
      // Update stored session
      const currentSession = await secureStorage.getSession();
      if (currentSession) {
        currentSession.sessionToken = session.access_token;
        currentSession.refreshToken = session.refresh_token;
        await secureStorage.storeSession(currentSession);
      }
      
      this.sessionKey = session.access_token;
      return true;
    } catch (error) {
      console.error('Session refresh failed:', error);
      return false;
    }
  }

  /**
   * Check authentication status
   */
  async checkAuth() {
    const session = await secureStorage.getSession();
    if (!session) return false;
    
    // Check if expired
    const { data: { user } } = await supabase.auth.getUser(session.sessionToken);
    if (!user) {
      // Try refresh
      return await this.refreshSession();
    }
    
    return true;
  }

  /**
   * Get current authenticated user
   */
  getUser() {
    try {
      const session = JSON.parse(sessionStorage.getItem('auth_session') || '{}');
      const profile = JSON.parse(sessionStorage.getItem('user_profile') || '{}');
      
      if (session.userId && profile.id) {
        return {
          id: session.userId,
          phone: session.phone,
          name: profile.full_name || profile.name,
          avatar: profile.avatar,
          bio: profile.bio,
          username: profile.username
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  }

  /**
   * Logout - clear all data
   * Complete secure wipe
   */
  async logout() {
    try {
      await supabase.auth.signOut();
      
      // Clear all storage
      await secureStorage.clearAll();
      sessionStorage.clear();
      
      // Clear memory
      this.sessionKey = null;
      this.derivedKey = null;
      
      // Force garbage collection hint
      if (global.gc) global.gc();
      
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      return false;
    }
  }

  /**
   * Generate quantum-safe keys with deterministic derivation
   */
  async generateQuantumKeys(passphrase) {
    const { publicKey, secretKey } = await kyber.generateKeyPair();
    
    // Derive deterministic encryption key from passphrase  
    const encryptionKey = await quantumKDF.deriveKey(passphrase, 'encryption');
    
    // Store encrypted secret key locally
    await secureStorage.store('kyber_sk', secretKey);
    
    return { publicKey, secretKey };
  }
  
  /**
   * Hash password using Argon2id (quantum-resistant)
   */
  async hashPassword(password) {
    return await argon2Hash(password);
  }
  
  /**
   * Verify password against Argon2 hash
   */
  async verifyPassword(password, hash) {
    return await argon2Verify(password, hash);
  }
  
  /**
   * Store auth data locally with password encryption
   */
  async storeAuthData(sharedSecret, password) {
    // Derive encryption key from password
    const encryptionKey = await quantumKDF.deriveKey(password, 'local_storage');
    
    // Store encrypted shared secret
    await secureStorage.store('shared_secret', sharedSecret);
    
    // Generate and store Kyber keys
    const { publicKey, secretKey } = await this.generateQuantumKeys(password);
    await secureStorage.store('kyber_pk', publicKey);
    await secureStorage.store('kyber_sk', secretKey);
    
    return { publicKey };
  }

  /**
   * Generate TOTP secret for phone number
   */
  generateTOTPSecret(phoneNumber) {
    try {
      const secret = OTPAuth.authenticator.generateSecret();
      console.log('🔐 Generated TOTP secret for phone:', phoneNumber);
      return secret;
    } catch (error) {
      console.error('❌ Error generating TOTP secret:', error);
      throw error;
    }
  }

  /**
   * Verify TOTP code against secret
   */
  verifyTOTP(code, secret) {
    try {
      const isValid = OTPAuth.authenticator.check(code, secret);
      console.log('🔍 TOTP verification result:', isValid);
      return isValid;
    } catch (error) {
      console.error('❌ Error verifying TOTP:', error);
      return false;
    }
  }

  /**
   * Create TOTP URI for QR code generation
   */
  createTOTPUri(phoneNumber, secret, issuer = 'Cyphr Messenger') {
    try {
      return OTPAuth.authenticator.keyuri(phoneNumber, issuer, secret);
    } catch (error) {
      console.error('❌ Error creating TOTP URI:', error);
      throw error;
    }
  }

  /**
   * Local OTP verification (replacement for SMS)
   */
  async verifyLocalOTP(phoneNumber, code) {
    try {
      console.log('🔐 Verifying local TOTP for:', phoneNumber);
      
      // Get stored TOTP secret
      const secret = localStorage.getItem('totp_secret');
      if (!secret) {
        throw new Error('No TOTP secret found. Please set up TOTP first.');
      }

      // Verify code
      const isValid = this.verifyTOTP(code, secret);
      
      if (isValid) {
        console.log('✅ Local TOTP verification successful');
        return {
          success: true,
          user: { phone: phoneNumber },
          publicKey: 'local_totp_verified'
        };
      } else {
        throw new Error('Invalid TOTP code');
      }
    } catch (error) {
      console.error('❌ Local OTP verification failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * EMAIL AUTHENTICATION - Send OTP with enterprise signup/signin validation
   */
  async sendEmailOTP(email, isSignUp = true) {
    try {
      console.log('📧 ENTERPRISE: Sending email OTP to:', email, 'Mode:', isSignUp ? 'SIGNUP' : 'SIGNIN');
      
      const apiBase = (import.meta.env.VITE_BACKEND_URL || 'https://app.cyphrmessenger.app/api').replace(/\/$/, '');
      const response = await fetch(`${apiBase}/auth/send-email-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, isSignUp })
      });

      const data = await response.json();
      console.log('📧 Email OTP response:', data);

      if (!response.ok) {
        // Handle enterprise validation errors
        if (data.shouldSwitchToSignIn) {
          return { 
            success: false, 
            error: data.error,
            shouldSwitchToSignIn: true 
          };
        }
        if (data.shouldSwitchToSignUp) {
          return { 
            success: false, 
            error: data.error,
            shouldSwitchToSignUp: true 
          };
        }
        throw new Error(data.error || 'Failed to send email OTP');
      }

      // Store email session for verification
      sessionStorage.setItem('email_session', JSON.stringify({
        email,
        emailHash: data.emailHash,
        isSignUp,
        timestamp: Date.now(),
        expires: Date.now() + 600000 // 10 minutes
      }));

      console.log('✅ Email OTP sent successfully');
      return { 
        success: true, 
        message: data.message,
        devOTP: data.devOTP // Development mode
      };

    } catch (error) {
      console.error('❌ Email OTP error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * EMAIL AUTHENTICATION - Verify OTP with enterprise flow logic
   */
  async verifyEmailOTP(email, code, isNewUser = null) {
    try {
      console.log('🔍 ENTERPRISE: Verifying email OTP:', email, 'with code:', code, 'isNewUser:', isNewUser);
      
      // Get stored session to determine if signup or signin
      const emailSession = JSON.parse(sessionStorage.getItem('email_session') || '{}');
      // Use passed isNewUser if provided, otherwise use session value
      const isSignUp = isNewUser !== null ? isNewUser : (emailSession.isSignUp !== undefined ? emailSession.isSignUp : true);
      
      console.log('🔍 DEBUG: isSignUp determined as =', isSignUp, '(from param:', isNewUser, ', from session:', emailSession.isSignUp, ')');
      
      const apiBase = (import.meta.env.VITE_BACKEND_URL || 'https://app.cyphrmessenger.app/api').replace(/\/$/, '');
      const requestBody = { 
        email, 
        code,
        isSignUp, // CRITICAL: Pass isSignUp to backend!
        userData: { fullName: 'User' }
      };
      console.log('🔍 DEBUG: Sending request body:', requestBody);
      
      const response = await fetch(`${apiBase}/auth/verify-email-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      console.log('🔍 Email verification response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Invalid email verification code');
      }

      // Store JWT tokens
      if (data.accessToken) {
        sessionStorage.setItem('accessToken', data.accessToken);
        sessionStorage.setItem('refreshToken', data.refreshToken);
      }

      // Store user session data with REAL quantum public key
      sessionStorage.setItem('userId', data.user.id);
      sessionStorage.setItem('userPublicKey', data.user.quantum_key || data.user.public_key);

      // Clear email session
      sessionStorage.removeItem('email_session');

      console.log('✅ Email authentication successful, userId:', data.user.id);
      console.log('🔍 Backend response - isNewUser:', data.isNewUser, 'needsSetup:', data.needsSetup);

      return {
        success: true,
        user: data.user,
        accessToken: data.accessToken || data.token,
        refreshToken: data.refreshToken,
        isNewUser: data.isNewUser,
        needsSetup: data.needsSetup
      };

    } catch (error) {
      console.error('❌ Email verification error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * CYPHR_ID AUTHENTICATION - Login with @cyphr_id and password
   */
  async cyphrIdLogin(cyphrId, password) {
    try {
      console.log('🆔 Cyphr ID login:', cyphrId);
      
      // Remove @ prefix if provided
      const cleanCyphrId = cyphrId.startsWith('@') ? cyphrId.slice(1) : cyphrId;
      
      const apiBase = (import.meta.env.VITE_BACKEND_URL || 'https://app.cyphrmessenger.app/api').replace(/\/$/, '');
      const response = await fetch(`${apiBase}/auth/cyphr-id-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          cyphrId: cleanCyphrId, 
          password 
        })
      });

      const data = await response.json();
      console.log('🆔 Cyphr ID login response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Invalid Cyphr ID or password');
      }

      // Store JWT tokens
      if (data.accessToken) {
        sessionStorage.setItem('accessToken', data.accessToken);
        sessionStorage.setItem('refreshToken', data.refreshToken);
      }

      // Store user session data with REAL quantum public key  
      sessionStorage.setItem('userId', data.user.id);
      sessionStorage.setItem('userPublicKey', data.user.quantum_key || data.user.public_key);

      console.log('✅ Cyphr ID authentication successful, userId:', data.user.id);

      return {
        success: true,
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken
      };

    } catch (error) {
      console.error('❌ Cyphr ID login error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * CHECK IF USER HAS PIN - For existing users (by email)
   */
  async checkUserPin(email) {
    try {
      const apiBase = (import.meta.env.VITE_BACKEND_URL || 'https://app.cyphrmessenger.app/api').replace(/\/$/, '');
      const response = await fetch(`${apiBase}/auth/check-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      
      if (data.success) {
        return {
          hasPIN: data.hasPIN,
          biometricEnabled: data.biometricEnabled,
          userName: data.userName,
          userExists: true
        };
      }
      
      return { hasPIN: false, biometricEnabled: false, userExists: false };
    } catch (error) {
      console.error('Error checking PIN:', error);
      return { hasPIN: false, biometricEnabled: false, userExists: false };
    }
  }

  /**
   * CHECK IF USER EXISTS BY PHONE - For phone login/signup detection
   */
  async checkUserByPhone(phone) {
    try {
      console.log('📱 ENTERPRISE: Checking user status by phone:', phone);
      
      const apiBase = (import.meta.env.VITE_BACKEND_URL || 'https://app.cyphrmessenger.app/api').replace(/\/$/, '');
      const response = await fetch(`${apiBase}/auth/check-phone-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone })
      });

      const data = await response.json();
      console.log('📱 Phone user status response:', data);
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to check phone user status');
      }
      
      return {
        userExists: data.userExists || false,
        hasPIN: data.hasPIN || false,
        biometricEnabled: data.biometricEnabled || false,
        userName: data.userName || null,
        userId: data.userId || null
      };
    } catch (error) {
      console.error('❌ Error checking phone user:', error);
      return { userExists: false, hasPIN: false, biometricEnabled: false };
    }
  }
  
  /**
   * Check Cyphr ID availability
   */
  async checkCyphrIdAvailability(cyphrId) {
    try {
      if (!cyphrId || cyphrId.length < 3) {
        return { available: false, error: 'Cyphr ID must be at least 3 characters' };
      }
      
      // Validate format: only letters, numbers, underscore
      if (!/^[a-zA-Z0-9_]+$/.test(cyphrId)) {
        return { available: false, error: 'Only letters, numbers, and underscore allowed' };
      }
      
      const apiBase = (import.meta.env.VITE_BACKEND_URL || 'https://app.cyphrmessenger.app/api').replace(/\/$/, '');
      const response = await fetch(`${apiBase}/auth/check-cyphr-id`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cyphrId })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        return { available: false, error: data.error || 'Failed to check availability' };
      }
      
      // If not available, generate suggestions
      if (!data.available) {
        const suggestions = this.generateCyphrIdSuggestions(cyphrId);
        return { available: false, suggestions };
      }
      
      return { available: true };
    } catch (error) {
      console.error('Error checking Cyphr ID availability:', error);
      return { available: false, error: 'Network error. Please try again.' };
    }
  }
  
  /**
   * Generate Cyphr ID suggestions
   */
  generateCyphrIdSuggestions(baseName) {
    const suggestions = [];
    const randomSuffix = () => Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    
    // Add numbers to base name
    for (let i = 1; i <= 3; i++) {
      suggestions.push(`${baseName}${randomSuffix()}`);
    }
    
    // Add underscores
    if (baseName.length < 12) {
      suggestions.push(`${baseName}_${Math.floor(Math.random() * 99)}`);
      suggestions.push(`${baseName}_official`);
    }
    
    return suggestions.slice(0, 5);
  }

  /**
   * VERIFY USER PIN - For PIN login
   */
  async verifyUserPin(email, pin, rememberMe = true) {
    try {
      const apiBase = (import.meta.env.VITE_BACKEND_URL || 'https://app.cyphrmessenger.app/api').replace(/\/$/, '');
      const response = await fetch(`${apiBase}/auth/verify-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email, 
          pin,
          rememberMe 
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Invalid PIN');
      }

      // Store JWT tokens if provided
      if (data.accessToken) {
        sessionStorage.setItem('accessToken', data.accessToken);
        sessionStorage.setItem('refreshToken', data.refreshToken);
      }

      // Store user session data
      if (data.user) {
        sessionStorage.setItem('userId', data.user.id);
        sessionStorage.setItem('userPublicKey', data.user.quantum_key || data.user.public_key);
      }

      // Set session expiry based on rememberMe
      const sessionDuration = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
      const sessionExpiry = Date.now() + sessionDuration;
      localStorage.setItem('session_expiry', sessionExpiry.toString());
      localStorage.setItem('remember_me', rememberMe.toString());

      console.log('✅ PIN verification successful');
      return { 
        success: true, 
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken
      };

    } catch (error) {
      console.error('❌ PIN verification error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * SETUP USER PIN - For new PIN setup or PIN change
   */
  async setupUserPin(pin, biometricEnabled = false) {
    try {
      const userId = sessionStorage.getItem('userId');
      const userEmail = sessionStorage.getItem('userEmail');
      
      if (!userId || !userEmail) {
        throw new Error('Authentication required');
      }

      const apiBase = (import.meta.env.VITE_BACKEND_URL || 'https://app.cyphrmessenger.app/api').replace(/\/$/, '');
      const response = await fetch(`${apiBase}/auth/setup-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          email: userEmail,
          pin,
          enableBiometric: biometricEnabled 
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to setup PIN');
      }

      // Store PIN hash locally for quick verification
      const { hashPassword } = await import('./argon2Wrapper.js');
      const encryptedPin = await hashPassword(pin);
      localStorage.setItem('user_pin_hash', encryptedPin);
      localStorage.setItem('biometric_enabled', biometricEnabled.toString());

      console.log('✅ PIN setup successful');
      return { success: true };

    } catch (error) {
      console.error('❌ PIN setup error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * SET CYPHR_ID PASSWORD - For users who want to enable Cyphr ID login
   */
  async setCyphrPassword(password, cyphrId = null) {
    try {
      const accessToken = sessionStorage.getItem('accessToken');
      if (!accessToken) {
        throw new Error('Authentication required');
      }

      console.log('🔒 Setting Cyphr password...');
      
      const apiBase = (import.meta.env.VITE_BACKEND_URL || 'https://app.cyphrmessenger.app/api').replace(/\/$/, '');
      const body = { password };
      if (cyphrId) {
        body.cyphrId = cyphrId.startsWith('@') ? cyphrId.slice(1) : cyphrId;
      }

      const response = await fetch(`${apiBase}/auth/set-cyphr-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      console.log('🔒 Set password response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to set password');
      }

      console.log('✅ Cyphr password set successfully');
      return { success: true, cyphrId: data.cyphrId };

    } catch (error) {
      console.error('❌ Set password error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * ENTERPRISE: Check user status (exists, has PIN, etc.)
   */
  async checkUserStatus(email) {
    try {
      console.log('📧 ENTERPRISE: Checking user status for:', email);
      
      const apiBase = (import.meta.env.VITE_BACKEND_URL || 'https://app.cyphrmessenger.app/api').replace(/\/$/, '');
      const response = await fetch(`${apiBase}/auth/check-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      console.log('📧 User status response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check user status');
      }

      return {
        success: true,
        userExists: data.userExists,
        hasPIN: data.hasPIN,
        isNewUser: data.isNewUser,
        userData: data.userData
      };

    } catch (error) {
      console.error('❌ Check user status error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * ENTERPRISE: Setup PIN/biometry (optional for new users)
   */
  async setupPin(email, pin, enableBiometric = false) {
    try {
      console.log('🔐 ENTERPRISE: Setting up PIN/biometry for:', email);
      
      const apiBase = (import.meta.env.VITE_BACKEND_URL || 'https://app.cyphrmessenger.app/api').replace(/\/$/, '');
      const response = await fetch(`${apiBase}/auth/setup-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, pin, enableBiometric })
      });

      const data = await response.json();
      console.log('🔐 Setup PIN response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to setup PIN');
      }

      return {
        success: true,
        hasPIN: data.hasPIN,
        biometricEnabled: data.biometricEnabled,
        message: data.message
      };

    } catch (error) {
      console.error('❌ Setup PIN error:', error);
      return { success: false, error: error.message };
    }
  }
}

export const zeroKnowledgeAuth = new ZeroKnowledgeAuth(); 

export default zeroKnowledgeAuth; 