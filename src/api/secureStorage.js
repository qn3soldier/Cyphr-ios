/**
 * Secure Storage Service
 * РАБОТАЕТ БЕЗ БИОМЕТРИИ - только device-based encryption
 */

class SecureStorage {
  constructor() {
    this.storagePrefix = 'cyphr_';
    this.isSupported = this.checkSupport();
  }

  checkSupport() {
    return typeof localStorage !== 'undefined' && 
           typeof crypto !== 'undefined';
  }

  /**
   * Generate device-based encryption key (БЕЗ биометрии)
   */
  async generateDeviceKey() {
    const deviceFingerprint = [
      navigator.userAgent,
      navigator.language,
      window.screen.width + 'x' + window.screen.height,
      window.screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 4,
      navigator.deviceMemory || 8
    ].join('|');

    // Use WebCrypto to derive key from device fingerprint
    const encoder = new TextEncoder();
    const data = encoder.encode(deviceFingerprint);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    return new Uint8Array(hashBuffer);
  }

  /**
   * Simple XOR encryption (fallback)
   */
  simpleEncrypt(data, key) {
    const dataBytes = new TextEncoder().encode(JSON.stringify(data));
    const encrypted = new Uint8Array(dataBytes.length);
    
    for (let i = 0; i < dataBytes.length; i++) {
      encrypted[i] = dataBytes[i] ^ key[i % key.length];
    }
    
    return Array.from(encrypted);
  }

  /**
   * Simple XOR decryption (fallback)
   */
  simpleDecrypt(encryptedArray, key) {
    const encrypted = new Uint8Array(encryptedArray);
    const decrypted = new Uint8Array(encrypted.length);
    
    for (let i = 0; i < encrypted.length; i++) {
      decrypted[i] = encrypted[i] ^ key[i % key.length];
    }
    
    const decryptedString = new TextDecoder().decode(decrypted);
    return JSON.parse(decryptedString);
  }

  /**
   * Store private key (БЕЗ биометрии - device-based)
   */
  async storePrivateKey(userId, privateKey, metadata = {}) {
    try {
      const deviceKey = await this.generateDeviceKey();
      
      const keyData = {
        privateKey,
        metadata,
        timestamp: Date.now(),
        deviceBased: true // Указываем что это device-based хранение
      };

      const encrypted = this.simpleEncrypt(keyData, deviceKey);
      
      localStorage.setItem(
        `${this.storagePrefix}key_${userId}`, 
        JSON.stringify(encrypted)
      );
      
      return true;
    } catch (error) {
      console.error('Store private key error:', error);
      return false;
    }
  }

  /**
   * Get private key (БЕЗ биометрии - device-based)
   */
  async getPrivateKey(userId) {
    try {
      const stored = localStorage.getItem(`${this.storagePrefix}key_${userId}`);
      if (!stored) return null;

      const deviceKey = await this.generateDeviceKey();
      const encryptedArray = JSON.parse(stored);
      
      const decrypted = this.simpleDecrypt(encryptedArray, deviceKey);
      
      return decrypted;
    } catch (error) {
      console.error('Get private key error:', error);
      return null;
    }
  }

  /**
   * Store session data (device-based encryption)
   */
  async storeSession(sessionData) {
    try {
      const deviceKey = await this.generateDeviceKey();
      const encrypted = this.simpleEncrypt(sessionData, deviceKey);
      
      localStorage.setItem(
        `${this.storagePrefix}session`, 
        JSON.stringify(encrypted)
      );
      
      return true;
    } catch (error) {
      console.error('Store session error:', error);
      return false;
    }
  }

  /**
   * Get session data (device-based decryption)
   */
  async getSession() {
    try {
      const stored = localStorage.getItem(`${this.storagePrefix}session`);
      if (!stored) return null;

      const deviceKey = await this.generateDeviceKey();
      const encryptedArray = JSON.parse(stored);
      
      const decrypted = this.simpleDecrypt(encryptedArray, deviceKey);
      
      return decrypted;
    } catch (error) {
      console.error('Get session error:', error);
      return null;
    }
  }

  /**
   * Store user password (simple hashing БЕЗ биометрии)
   */
  async storePassword(userId, password) {
    try {
      // Hash password with device-specific salt
      const deviceKey = await this.generateDeviceKey();
      const passwordData = {
        passwordHash: await this.hashPassword(password, deviceKey),
        timestamp: Date.now()
      };

      localStorage.setItem(
        `${this.storagePrefix}pwd_${userId}`, 
        JSON.stringify(passwordData)
      );
      
      return true;
    } catch (error) {
      console.error('Store password error:', error);
      return false;
    }
  }

  /**
   * Verify password (device-based verification)
   */
  async verifyPassword(userId, password) {
    try {
      const stored = localStorage.getItem(`${this.storagePrefix}pwd_${userId}`);
      if (!stored) return false;

      const passwordData = JSON.parse(stored);
      const deviceKey = await this.generateDeviceKey();
      
      const inputHash = await this.hashPassword(password, deviceKey);
      
      return inputHash === passwordData.passwordHash;
    } catch (error) {
      console.error('Verify password error:', error);
      return false;
    }
  }

  /**
   * Hash password with device salt
   */
  async hashPassword(password, deviceKey) {
    const encoder = new TextEncoder();
    const passwordBytes = encoder.encode(password);
    
    // Combine password with device key
    const combined = new Uint8Array(passwordBytes.length + deviceKey.length);
    combined.set(passwordBytes, 0);
    combined.set(deviceKey, passwordBytes.length);
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Clear all stored data
   */
  async clearAll() {
    try {
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith(this.storagePrefix)) {
          localStorage.removeItem(key);
        }
      }
      return true;
    } catch (error) {
      console.error('Clear all error:', error);
      return false;
    }
  }

  /**
   * ФУНКЦИИ ДЛЯ БИОМЕТРИИ (используются ТОЛЬКО из настроек)
   */

  /**
   * Enable biometric storage (ТОЛЬКО из настроек)
   */
  async enableBiometricStorage(userId, biometricKey) {
    try {
      // Миграция существующих данных на биометрическое хранение
      const existingKey = await this.getPrivateKey(userId);
      const existingSession = await this.getSession();
      
      if (existingKey) {
        // Re-encrypt с биометрическим ключом
        const biometricKeyBytes = new TextEncoder().encode(biometricKey);
        const encrypted = this.simpleEncrypt(existingKey, biometricKeyBytes);
        
        localStorage.setItem(
          `${this.storagePrefix}bio_key_${userId}`, 
          JSON.stringify(encrypted)
        );
      }
      
      // Отмечаем что биометрия активна
      localStorage.setItem(
        `${this.storagePrefix}biometric_enabled`, 
        'true'
      );
      
      return true;
    } catch (error) {
      console.error('Enable biometric storage error:', error);
      return false;
    }
  }

  /**
   * Get data with biometric key (ТОЛЬКО если включена биометрия)
   */
  async getBiometricData(userId, biometricKey) {
    try {
      const biometricEnabled = localStorage.getItem(`${this.storagePrefix}biometric_enabled`);
      if (!biometricEnabled) return null;

      const stored = localStorage.getItem(`${this.storagePrefix}bio_key_${userId}`);
      if (!stored) return null;

      const biometricKeyBytes = new TextEncoder().encode(biometricKey);
      const encryptedArray = JSON.parse(stored);
      
      const decrypted = this.simpleDecrypt(encryptedArray, biometricKeyBytes);
      
      return decrypted;
    } catch (error) {
      console.error('Get biometric data error:', error);
      return null;
    }
  }

  /**
   * Disable biometric storage
   */
  async disableBiometricStorage(userId) {
    try {
      localStorage.removeItem(`${this.storagePrefix}bio_key_${userId}`);
      localStorage.removeItem(`${this.storagePrefix}biometric_enabled`);
      return true;
    } catch (error) {
      console.error('Disable biometric storage error:', error);
      return false;
    }
  }

  /**
   * Check if biometric storage is enabled
   */
  isBiometricEnabled() {
    return localStorage.getItem(`${this.storagePrefix}biometric_enabled`) === 'true';
  }

  /**
   * Generic getItem method (for compatibility with other services)
   */
  async getItem(key) {
    try {
      const stored = localStorage.getItem(`${this.storagePrefix}${key}`);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('getItem error:', error);
      return null;
    }
  }

  /**
   * Generic setItem method (for compatibility with other services)
   */
  async setItem(key, value) {
    try {
      localStorage.setItem(`${this.storagePrefix}${key}`, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('setItem error:', error);
      return false;
    }
  }

  /**
   * Generic removeItem method
   */
  async removeItem(key) {
    try {
      localStorage.removeItem(`${this.storagePrefix}${key}`);
      return true;
    } catch (error) {
      console.error('removeItem error:', error);
      return false;
    }
  }
}

export const secureStorage = new SecureStorage(); 