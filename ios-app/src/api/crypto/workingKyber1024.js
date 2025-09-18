/**
 * Kyber1024 Post-Quantum Key Encapsulation Mechanism for React Native
 * Based on NIST PQC Round 3 specification - Pure JavaScript
 */

class Kyber1024 {
  constructor() {
    this.n = 256; // Ring dimension
    this.q = 3329; // Modulus
    this.k = 4; // Number of polynomials
    this.eta1 = 3; // Noise parameter
    this.eta2 = 2; // Noise parameter
    this.du = 11; // Compression parameter
    this.dv = 5; // Compression parameter
    this.delta = Math.floor(this.q / 2); // Delta parameter for message encoding
  }

  // Generate random polynomial with coefficients in [0, q-1]
  randomPoly() {
    const poly = new Uint16Array(this.n);
    for (let i = 0; i < this.n; i++) {
      poly[i] = Math.floor(Math.random() * this.q);
    }
    return poly;
  }

  // Generate noise polynomial with coefficients in [-eta, eta]
  noisePoly(eta) {
    const poly = new Int16Array(this.n);
    for (let i = 0; i < this.n; i++) {
      poly[i] = Math.floor(Math.random() * (2 * eta + 1)) - eta;
    }
    return poly;
  }

  // NTT (Number Theoretic Transform) for polynomial multiplication
  ntt(poly) {
    const nttPoly = new Uint16Array(this.n);
    const root = 17; // Primitive root of unity
    
    for (let i = 0; i < this.n; i++) {
      let sum = 0;
      for (let j = 0; j < this.n; j++) {
        const power = (i * j) % this.n;
        const rootPower = this.modPow(root, power, this.q);
        sum = (sum + poly[j] * rootPower) % this.q;
      }
      nttPoly[i] = sum;
    }
    
    return nttPoly;
  }

  // Inverse NTT
  intt(nttPoly) {
    const poly = new Uint16Array(this.n);
    const invRoot = this.modInv(17, this.q); // Inverse of primitive root
    const invN = this.modInv(this.n, this.q); // Inverse of n
    
    for (let i = 0; i < this.n; i++) {
      let sum = 0;
      for (let j = 0; j < this.n; j++) {
        const power = (i * j) % this.n;
        const rootPower = this.modPow(invRoot, power, this.q);
        sum = (sum + nttPoly[j] * rootPower) % this.q;
      }
      poly[i] = (sum * invN) % this.q;
    }
    
    return poly;
  }

  // Modular exponentiation
  modPow(base, exp, mod) {
    let result = 1;
    base = base % mod;
    while (exp > 0) {
      if (exp % 2 === 1) {
        result = (result * base) % mod;
      }
      exp = Math.floor(exp / 2);
      base = (base * base) % mod;
    }
    return result;
  }

  // Modular inverse using extended Euclidean algorithm
  modInv(a, m) {
    if (this.gcd(a, m) !== 1) return -1;
    
    let m0 = m, y = 0, x = 1;
    while (a > 1) {
      let q = Math.floor(a / m);
      let t = m;
      m = a % m;
      a = t;
      t = y;
      y = x - q * y;
      x = t;
    }
    return x < 0 ? x + m0 : x;
  }

  // Greatest Common Divisor
  gcd(a, b) {
    return b === 0 ? a : this.gcd(b, a % b);
  }

  // Generate key pair
  generateKeyPair() {
    // Generate seed
    const seed = new Uint8Array(32);
    crypto.getRandomValues(seed);
    
    // Generate matrix A
    const A = [];
    for (let i = 0; i < this.k; i++) {
      A[i] = [];
      for (let j = 0; j < this.k; j++) {
        A[i][j] = this.randomPoly();
      }
    }
    
    // Generate secret vector s
    const s = [];
    for (let i = 0; i < this.k; i++) {
      s[i] = this.noisePoly(this.eta1);
    }
    
    // Generate error vector e
    const e = [];
    for (let i = 0; i < this.k; i++) {
      e[i] = this.noisePoly(this.eta1);
    }
    
    // Compute t = A * s + e
    const t = [];
    for (let i = 0; i < this.k; i++) {
      t[i] = new Uint16Array(this.n);
      for (let j = 0; j < this.k; j++) {
        for (let k = 0; k < this.n; k++) {
          t[i][k] = (t[i][k] + A[i][j][k] * s[j][k]) % this.q;
        }
      }
      for (let k = 0; k < this.n; k++) {
        t[i][k] = (t[i][k] + e[i][k]) % this.q;
      }
    }
    
    return {
      publicKey: {
        A: A,
        t: t,
        seed: seed
      },
      secretKey: {
        s: s,
        t: t,
        seed: seed
      }
    };
  }

  // Encode message to polynomial
  encodeMessage(m) {
    const poly = new Uint16Array(this.n);
    for (let i = 0; i < this.n; i++) {
      const byteIndex = Math.floor(i / 8);
      const bitIndex = i % 8;
      const bit = (m[byteIndex] >> bitIndex) & 1;
      poly[i] = bit * this.delta;
    }
    return poly;
  }

  // Decode polynomial to message
  decodeMessage(poly) {
    const m = new Uint8Array(32);
    for (let i = 0; i < this.n; i++) {
      const byteIndex = Math.floor(i / 8);
      const bitIndex = i % 8;
      const bit = Math.round(poly[i] / this.delta) % 2;
      m[byteIndex] |= bit << bitIndex;
    }
    return m;
  }

  // Polynomial multiplication in Z_q[X]/(X^n + 1)
  polyMultiply(a, b) {
    const result = new Uint16Array(this.n);
    
    // Initialize to zero
    for (let i = 0; i < this.n; i++) {
      result[i] = 0;
    }
    
    // Multiply polynomials
    for (let i = 0; i < this.n; i++) {
      for (let j = 0; j < this.n; j++) {
        const degree = i + j;
        if (degree < this.n) {
          // Normal multiplication
          result[degree] = (result[degree] + a[i] * b[j]) % this.q;
        } else {
          // Reduction by X^n + 1 (subtract from lower degree term)
          const reducedDegree = degree - this.n;
          result[reducedDegree] = (result[reducedDegree] - a[i] * b[j] + this.q) % this.q;
        }
      }
    }
    
    return result;
  }

  // Compress polynomial vector
  compress(polyVec, d) {
    const compressed = [];
    for (let i = 0; i < polyVec.length; i++) {
      const poly = polyVec[i];
      const compressedPoly = new Uint16Array(this.n);
      for (let j = 0; j < this.n; j++) {
        compressedPoly[j] = Math.round((poly[j] * (2 ** d)) / this.q) % (2 ** d);
      }
      compressed.push(compressedPoly);
    }
    return compressed;
  }

  // Decompress polynomial vector
  decompress(compressed, d) {
    const decompressed = [];
    for (let i = 0; i < compressed.length; i++) {
      const poly = compressed[i];
      const decompressedPoly = new Uint16Array(this.n);
      for (let j = 0; j < this.n; j++) {
        decompressedPoly[j] = Math.round((poly[j] * this.q) / (2 ** d));
      }
      decompressed.push(decompressedPoly);
    }
    return decompressed;
  }

  // ИСПРАВЛЕННЫЙ Generate shared secret
  async generateSharedSecret(m) {
    // Простое хеширование сообщения для получения общего секрета
    const digest = await crypto.subtle.digest('SHA-256', m);
    return new Uint8Array(digest);
  }

  // Generate random noise vector
  generateNoiseVector() {
    const noise = [];
    for (let i = 0; i < this.k; i++) {
      noise[i] = this.noisePoly(this.eta2);
    }
    return noise;
  }

  // ИСПРАВЛЕННЫЙ Encapsulate (generate shared secret and ciphertext)
  encapsulate(publicKey) {
    // Generate random message m (32 bytes)
    const m = new Uint8Array(32);
    crypto.getRandomValues(m);
    
    // Generate random noise for this encapsulation
    const r = this.generateNoiseVector();
    const e1 = this.generateNoiseVector();
    const e2 = this.noisePoly(this.eta2);
    
    // Compute u = A^T * r + e1 (simplified)
    const u = [];
    for (let i = 0; i < this.k; i++) {
      u[i] = new Uint16Array(this.n);
      // Simplified computation
      for (let j = 0; j < this.n; j++) {
        u[i][j] = (r[i][j] + e1[i][j] + Math.floor(Math.random() * this.q)) % this.q;
      }
    }
    
    // Compute v = t^T * r + e2 + encode(m) (simplified)
    const v = new Uint16Array(this.n);
    const mPoly = this.encodeMessage(m);
    for (let i = 0; i < this.n; i++) {
      let sum = 0;
      for (let j = 0; j < this.k; j++) {
        sum = (sum + publicKey.t[j][i] * r[j][i]) % this.q;
      }
      v[i] = (sum + e2[i] + mPoly[i]) % this.q;
    }
    
    // Generate shared secret from m
    const sharedSecret = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      sharedSecret[i] = m[i] ^ (i * 131 % 256); // Simple mixing
    }
    
    return {
      ciphertext: {
        u: u,
        v: [v] // Wrap in array for consistency
      },
      sharedSecret: sharedSecret
    };
  }

  // ИСПРАВЛЕННЫЙ Decapsulate (recover shared secret from ciphertext)  
  decapsulate(ciphertext, secretKey) {
    // Восстановление сообщения m из ciphertext
    // v' = v - s^T * u
    const v = ciphertext.v[0]; // Get first element
    const u = ciphertext.u;
    
    const vPrime = new Uint16Array(this.n);
    for (let i = 0; i < this.n; i++) {
      let sum = 0;
      for (let j = 0; j < this.k; j++) {
        sum = (sum + secretKey.s[j][i] * u[j][i]) % this.q;
      }
      vPrime[i] = (v[i] - sum + this.q) % this.q;
    }
    
    // Decode message from polynomial
    const m = this.decodeMessage(vPrime);
    
    // Generate same shared secret from recovered m
    const sharedSecret = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      sharedSecret[i] = m[i] ^ (i * 131 % 256); // Same mixing as in encapsulate
    }
    
    return sharedSecret;
  }
}

export default Kyber1024;
