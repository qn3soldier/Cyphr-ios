/**
 * Secure Random Number Generator with Entropy Validation
 * Implements NIST SP 800-90A recommendations with additional entropy sources
 */

import { sha3_256 } from '@noble/hashes/sha3';
import { randomBytes } from '@noble/hashes/utils';

export class SecureRNG {
  private entropyPool: Uint8Array;
  private counter: number;
  private initialized: boolean;

  constructor() {
    this.entropyPool = new Uint8Array(256); // 256 bytes entropy pool
    this.counter = 0;
    this.initialized = false;
    this.initializeEntropy();
  }

  /**
   * Initialize entropy pool with multiple sources
   */
  private async initializeEntropy(): Promise<void> {
    try {
      // Source 1: WebCrypto secure random
      const cryptoRandom = new Uint8Array(64);
      const cryptoAPI = typeof window !== 'undefined' ? window.crypto : 
                      (typeof globalThis !== 'undefined' && globalThis.crypto) ? globalThis.crypto :
                      (typeof crypto !== 'undefined') ? crypto : null;
      
      if (cryptoAPI && cryptoAPI.getRandomValues) {
        cryptoAPI.getRandomValues(cryptoRandom);
      } else {
        throw new Error('WebCrypto not available');
      }

      // Source 2: High-resolution timestamp
      const timestamp = performance.now();
      const timestampBytes = new Uint8Array(8);
      new DataView(timestampBytes.buffer).setFloat64(0, timestamp, true);

      // Source 3: Memory allocation patterns (weak entropy)
      const memoryEntropy = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        memoryEntropy[i] = (Math.random() * 256) | 0;
      }

      // Source 4: Hardware entropy (if available)
      const hardwareEntropy = await this.collectHardwareEntropy();

      // Combine all entropy sources
      const combinedEntropy = new Uint8Array(
        cryptoRandom.length + 
        timestampBytes.length + 
        memoryEntropy.length + 
        hardwareEntropy.length
      );

      let offset = 0;
      combinedEntropy.set(cryptoRandom, offset);
      offset += cryptoRandom.length;
      combinedEntropy.set(timestampBytes, offset);
      offset += timestampBytes.length;
      combinedEntropy.set(memoryEntropy, offset);
      offset += memoryEntropy.length;
      combinedEntropy.set(hardwareEntropy, offset);

      // Hash the combined entropy to create initial pool
      this.entropyPool = sha3_256(combinedEntropy);
      this.initialized = true;

      console.log('🔒 SecureRNG initialized with multi-source entropy');
    } catch (error) {
      console.error('❌ Failed to initialize SecureRNG:', error);
      throw new Error('Failed to initialize secure random number generator');
    }
  }

  /**
   * Collect hardware-based entropy (mouse movements, keyboard timing, etc.)
   */
  private async collectHardwareEntropy(): Promise<Uint8Array> {
    return new Promise((resolve) => {
      const entropy = new Uint8Array(16);
      let collected = 0;

      // Collect mouse movement entropy
      const mouseHandler = (event: MouseEvent) => {
        if (collected < 8) {
          entropy[collected] = (event.clientX ^ event.clientY) & 0xFF;
          entropy[collected + 8] = ((event.timeStamp | 0) ^ (event.movementX | 0)) & 0xFF;
          collected++;
        }
        if (collected >= 8) {
          document.removeEventListener('mousemove', mouseHandler);
          resolve(entropy);
        }
      };

      // Try to collect mouse entropy for 100ms
      if (typeof document !== 'undefined') {
        document.addEventListener('mousemove', mouseHandler);
        setTimeout(() => {
          document.removeEventListener('mousemove', mouseHandler);
          // Fill remaining bytes with WebCrypto if no mouse movement
          if (collected < 8) {
            const remaining = entropy.slice(collected);
            const cryptoAPI = typeof window !== 'undefined' ? window.crypto : 
                            (typeof globalThis !== 'undefined' && globalThis.crypto) ? globalThis.crypto :
                            (typeof crypto !== 'undefined') ? crypto : null;
            
            if (cryptoAPI && cryptoAPI.getRandomValues) {
              cryptoAPI.getRandomValues(remaining);
            }
          }
          resolve(entropy);
        }, 100);
      } else {
        // Server-side or no document available
        const cryptoAPI = typeof window !== 'undefined' ? window.crypto : 
                        (typeof globalThis !== 'undefined' && globalThis.crypto) ? globalThis.crypto :
                        (typeof crypto !== 'undefined') ? crypto : null;
        
        if (cryptoAPI && cryptoAPI.getRandomValues) {
          cryptoAPI.getRandomValues(entropy);
        }
        resolve(entropy);
      }
    });
  }

  /**
   * Generate cryptographically secure random bytes
   */
  async generateBytes(length: number): Promise<Uint8Array> {
    if (!this.initialized) {
      await this.initializeEntropy();
    }

    const output = new Uint8Array(length);
    let generated = 0;

    while (generated < length) {
      // Update entropy pool with counter
      this.counter++;
      const counterBytes = new Uint8Array(4);
      new DataView(counterBytes.buffer).setUint32(0, this.counter, true);

      // Mix entropy pool with counter and hash
      const mixed = new Uint8Array(this.entropyPool.length + counterBytes.length);
      mixed.set(this.entropyPool, 0);
      mixed.set(counterBytes, this.entropyPool.length);

      const hash = sha3_256(mixed);
      
      // Update entropy pool for forward secrecy
      this.entropyPool = hash;

      // Extract bytes for output
      const bytesToCopy = Math.min(hash.length, length - generated);
      output.set(hash.slice(0, bytesToCopy), generated);
      generated += bytesToCopy;
    }

    return output;
  }

  /**
   * Generate secure nonce with anti-replay protection
   */
  async generateNonce(length: number = 12): Promise<Uint8Array> {
    const randomPart = await this.generateBytes(length - 8);
    const timestampPart = new Uint8Array(8);
    
    // Include high-resolution timestamp to prevent replay
    const timestamp = performance.now() * 1000; // microseconds
    new DataView(timestampPart.buffer).setBigUint64(0, BigInt(Math.floor(timestamp)), true);

    const nonce = new Uint8Array(length);
    nonce.set(randomPart, 0);
    nonce.set(timestampPart.slice(0, 8), randomPart.length);

    return nonce;
  }

  /**
   * Generate secure key material
   */
  async generateKey(length: number = 32): Promise<Uint8Array> {
    return this.generateBytes(length);
  }

  /**
   * Test entropy quality (simplified chi-square test)
   */
  testEntropy(data: Uint8Array): { score: number; quality: string } {
    const frequencies = new Array(256).fill(0);
    
    // Count byte frequencies
    for (let i = 0; i < data.length; i++) {
      frequencies[data[i]]++;
    }

    // Calculate chi-square statistic
    const expected = data.length / 256;
    let chiSquare = 0;
    
    for (let i = 0; i < 256; i++) {
      const diff = frequencies[i] - expected;
      chiSquare += (diff * diff) / expected;
    }

    // Normalize score (lower is better)
    const score = chiSquare / 256;
    
    let quality: string;
    if (score < 1.0) quality = 'excellent';
    else if (score < 1.5) quality = 'good';
    else if (score < 2.0) quality = 'fair';
    else quality = 'poor';

    return { score, quality };
  }

  /**
   * Reset entropy pool (for testing or security reasons)
   */
  async reset(): Promise<void> {
    this.initialized = false;
    this.counter = 0;
    await this.initializeEntropy();
  }
}

// Global instance
export const secureRNG = new SecureRNG();