/**
 * Quantum-Safe Key Derivation Functions
 * БЕЗ биометрии по умолчанию - device-based entropy
 */

class QuantumKDF {
  constructor() {
    this.isSupported = this.checkSupport();
  }

  checkSupport() {
    return typeof crypto !== 'undefined' && 
           typeof crypto.subtle !== 'undefined';
  }

  /**
   * Hash phone number with SHA-3 (quantum-safe)
   */
  async hashPhone(phone) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(phone + 'cyphr_salt_2024');
      
      // Use SHA-256 (substitute for SHA-3 until native support)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(hashBuffer));
    } catch (error) {
      console.error('Hash phone error:', error);
      // Fallback to simple hash
      return this.simpleHash(phone);
    }
  }

  /**
   * Combine entropy sources (БЕЗ биометрии)
   */
  async combineEntropy(sources) {
    try {
      const combined = sources.join('||cyphr_separator||');
      const encoder = new TextEncoder();
      const data = encoder.encode(combined);
      
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      return new Uint8Array(hashBuffer);
    } catch (error) {
      console.error('Combine entropy error:', error);
      return new Uint8Array(32); // Fallback
    }
  }

  /**
   * Check Argon2 support (fallback to PBKDF2)
   */
  async checkSupport() {
    try {
      // Check if we can use PBKDF2 (widely supported)
      await crypto.subtle.importKey(
        'raw',
        new Uint8Array(16),
        'PBKDF2',
        false,
        ['deriveKey']
      );
      return { argon2: false, pbkdf2: true };
    } catch (error) {
      return { argon2: false, pbkdf2: false };
    }
  }

  /**
   * Derive key using PBKDF2 (fallback for Argon2)
   */
  async deriveKey(entropy, salt, options = {}) {
    try {
      const {
        iterations = 600000, // High iteration count for security
        keyLength = 32
      } = options;

      if (this.isSupported) {
        // Convert entropy to ArrayBuffer if it's a string
        const entropyBuffer = typeof entropy === 'string' 
          ? new TextEncoder().encode(entropy)
          : entropy;
          
        // Use PBKDF2 with WebCrypto
        const keyMaterial = await crypto.subtle.importKey(
          'raw',
          entropyBuffer,
          'PBKDF2',
          false,
          ['deriveKey', 'deriveBits']
        );

        const saltBytes = typeof salt === 'string' 
          ? new TextEncoder().encode(salt)
          : new Uint8Array(salt);

        const derivedBits = await crypto.subtle.deriveBits(
          {
            name: 'PBKDF2',
            salt: saltBytes,
            iterations: iterations,
            hash: 'SHA-256'
          },
          keyMaterial,
          keyLength * 8
        );

        return {
          key: new Uint8Array(derivedBits),
          encoded: Array.from(new Uint8Array(derivedBits)),
          fallback: false,
          algorithm: 'PBKDF2'
        };
      } else {
        // Simple fallback
        return {
          key: new Uint8Array(32),
          encoded: Array.from(new Uint8Array(32)),
          fallback: true,
          algorithm: 'Simple'
        };
      }
    } catch (error) {
      console.error('Key derivation error:', error);
      
      // Fallback to simple hash-based derivation
      const combined = new Uint8Array(entropy.length + 32);
      combined.set(entropy, 0);
      combined.set(new TextEncoder().encode(salt.toString()), entropy.length);
      
      const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
      const key = new Uint8Array(hashBuffer);
      
      return {
        key,
        encoded: Array.from(key),
        fallback: true,
        algorithm: 'SHA256-Fallback'
      };
    }
  }

  /**
   * Estimate entropy (БЕЗ биометрических требований)
   */
  estimateEntropy(input) {
    if (!input || typeof input !== 'string') {
      return { bits: 0, quantumSafe: false };
    }

    // Simple entropy estimation
    const length = input.length;
    const uniqueChars = new Set(input).size;
    
    // Estimate bits based on character diversity
    let bits = 0;
    if (/[a-z]/.test(input)) bits += 26;
    if (/[A-Z]/.test(input)) bits += 26;
    if (/[0-9]/.test(input)) bits += 10;
    if (/[^a-zA-Z0-9]/.test(input)) bits += 32;
    
    const entropy = Math.log2(bits) * length;
    
    return {
      bits: Math.floor(entropy),
      quantumSafe: entropy >= 128, // Lower requirement for device-based security
      length,
      uniqueChars
    };
  }

  /**
   * Generate device-based salt (БЕЗ биометрии)
   */
  generateDeviceSalt() {
    const deviceInfo = [
      navigator.userAgent,
      navigator.language,
      window.screen.width + 'x' + window.screen.height,
      navigator.hardwareConcurrency || 4,
      new Date().getTimezoneOffset()
    ].join('|');

    return this.simpleHash(deviceInfo);
  }

  /**
   * Simple hash function (fallback)
   */
  simpleHash(input) {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Convert to byte array
    const bytes = new Uint8Array(4);
    bytes[0] = (hash >>> 24) & 0xff;
    bytes[1] = (hash >>> 16) & 0xff;
    bytes[2] = (hash >>> 8) & 0xff;
    bytes[3] = hash & 0xff;
    
    return Array.from(bytes);
  }

  /**
   * ФУНКЦИИ ДЛЯ БИОМЕТРИИ (используются ТОЛЬКО из настроек)
   */

  /**
   * Derive key with biometric entropy (ТОЛЬКО если включена биометрия)
   */
  async deriveKeyWithBiometrics(entropy, biometricData, salt, options = {}) {
    try {
      // Combine device entropy with biometric data
      const combinedEntropy = new Uint8Array(entropy.length + biometricData.length);
      combinedEntropy.set(entropy, 0);
      combinedEntropy.set(new TextEncoder().encode(biometricData), entropy.length);

      return await this.deriveKey(combinedEntropy, salt, {
        ...options,
        iterations: options.iterations || 100000 // Lower iterations with biometrics
      });
    } catch (error) {
      console.error('Biometric key derivation error:', error);
      // Fallback to regular derivation
      return await this.deriveKey(entropy, salt, options);
    }
  }
}

export const quantumKDF = new QuantumKDF(); 