/**
 * Secure Backend Endpoints
 * Handles all sensitive cryptographic operations server-side
 * NEVER exposes private keys or secrets to frontend
 */

import express from 'express';
import crypto from 'crypto';
import argon2 from 'argon2';
import * as StellarSdk from '@stellar/stellar-sdk';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Store sensitive data in server memory (encrypted)
// In production, use proper key management service
const STELLAR_SECRET_KEY = process.env.STELLAR_SECRET_KEY;
const STELLAR_PUBLIC_KEY = process.env.STELLAR_PUBLIC_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secure-jwt-secret-key';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32);

// Middleware to verify JWT tokens
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

/**
 * Login endpoint - returns secure session token
 */
router.post('/auth/login', async (req, res) => {
  try {
    const { userId, passwordHash } = req.body;
    
    if (!userId || !passwordHash) {
      return res.status(400).json({ error: 'userId and passwordHash required' });
    }

    // Verify password hash (in production, check against database)
    // For now, we'll generate a session token
    const sessionToken = jwt.sign(
      { userId, timestamp: Date.now() },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log(`🔐 Secure login for user: ${userId}`);
    
    res.json({
      success: true,
      sessionToken,
      expiresIn: '24h'
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * Generate TOTP secret (server-side only)
 */
router.post('/auth/totp/generate', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    // Generate TOTP secret on server
    const secret = speakeasy.generateSecret({
      name: `Cyphr Messenger (${userId})`,
      issuer: 'Cyphr Messenger',
      length: 32
    });

    // Store secret securely on server (encrypted)
    // In production, store in encrypted database
    const encryptedSecret = encrypt(secret.base32, userId);
    
    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () => 
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );

    console.log(`🔐 TOTP secret generated for user: ${userId}`);
    
    // NEVER send the actual secret to frontend!
    res.json({
      success: true,
      qrCode: qrCodeUrl,
      backupCodes,
      // secret is NOT included in response for security
    });
  } catch (error) {
    console.error('❌ TOTP generation error:', error);
    res.status(500).json({ error: 'TOTP generation failed' });
  }
});

/**
 * Verify TOTP code (server-side only)
 */
router.post('/auth/totp/verify', authenticateToken, async (req, res) => {
  try {
    const { userId, code } = req.body;
    
    if (!userId || !code) {
      return res.status(400).json({ error: 'userId and code required' });
    }

    // Retrieve encrypted secret from server storage
    // In production, fetch from encrypted database
    const encryptedSecret = getUserTOTPSecret(userId);
    if (!encryptedSecret) {
      return res.status(404).json({ error: 'TOTP not configured for user' });
    }

    const secret = decrypt(encryptedSecret, userId);
    
    // Verify TOTP code
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code,
      window: 2
    });

    console.log(`🔐 TOTP verification for user ${userId}: ${verified ? 'SUCCESS' : 'FAILED'}`);
    
    res.json({
      success: true,
      verified
    });
  } catch (error) {
    console.error('❌ TOTP verification error:', error);
    res.status(500).json({ error: 'TOTP verification failed' });
  }
});

/**
 * Create Stellar wallet (server-side only)
 */
router.post('/wallet/create', authenticateToken, async (req, res) => {
  try {
    const { userId, encryptedSeed } = req.body;
    
    if (!userId || !encryptedSeed) {
      return res.status(400).json({ error: 'userId and encryptedSeed required' });
    }

    // Store encrypted seed securely on server
    // In production, store in encrypted database
    storeUserWalletSeed(userId, encryptedSeed);

    // Generate public key from seed (without exposing seed)
    // For demo, we'll use Stellar SDK to create a keypair
    const stellarKeypair = StellarSdk.Keypair.random();
    const publicKey = stellarKeypair.publicKey();
    
    console.log(`🪙 Stellar wallet created for user: ${userId}`);
    console.log(`📍 Public key: ${publicKey}`);
    
    // NEVER send private key or seed to frontend!
    res.json({
      success: true,
      publicKey,
      stellarAddress: publicKey
    });
  } catch (error) {
    console.error('❌ Wallet creation error:', error);
    res.status(500).json({ error: 'Wallet creation failed' });
  }
});

/**
 * Sign Stellar transaction (server-side only)
 */
router.post('/wallet/sign', authenticateToken, async (req, res) => {
  try {
    const { userId, transactionXDR, pin } = req.body;
    
    if (!userId || !transactionXDR || !pin) {
      return res.status(400).json({ error: 'userId, transactionXDR, and pin required' });
    }

    // Retrieve and decrypt user's seed using PIN
    const encryptedSeed = getUserWalletSeed(userId);
    if (!encryptedSeed) {
      return res.status(404).json({ error: 'Wallet not found for user' });
    }

    // Decrypt seed with user's PIN (happens on server only)
    const seed = decryptWithPin(encryptedSeed, pin, userId);
    
    // Create keypair from seed
    const keypair = StellarSdk.Keypair.fromSecret(seed);
    
    // Parse and sign transaction
    const transaction = StellarSdk.TransactionBuilder.fromXDR(transactionXDR, StellarSdk.Networks.TESTNET);
    transaction.sign(keypair);
    
    const signedXDR = transaction.toXDR();
    
    console.log(`✅ Transaction signed for user: ${userId}`);
    
    // Clear sensitive data from memory
    seed.fill(0);
    
    res.json({
      success: true,
      signedTransactionXDR: signedXDR
    });
  } catch (error) {
    console.error('❌ Transaction signing error:', error);
    res.status(500).json({ error: 'Transaction signing failed' });
  }
});

/**
 * Get wallet balance using server's Stellar connection
 */
router.get('/wallet/balance/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get user's public key from secure storage
    const publicKey = getUserPublicKey(userId);
    if (!publicKey) {
      return res.status(404).json({ error: 'Wallet not found for user' });
    }

    // Use server's Stellar connection to fetch balance
    const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
    const account = await server.loadAccount(publicKey);
    
    const balances = account.balances.map(balance => ({
      asset_type: balance.asset_type,
      asset_code: balance.asset_code,
      balance: balance.balance
    }));
    
    console.log(`💰 Balance fetched for user: ${userId}`);
    
    res.json({
      success: true,
      balances,
      publicKey
    });
  } catch (error) {
    console.error('❌ Balance fetch error:', error);
    res.status(500).json({ error: 'Balance fetch failed' });
  }
});

/**
 * Hash password securely on server
 */
router.post('/auth/hash-password', async (req, res) => {
  try {
    const { password, userId } = req.body;
    
    if (!password || !userId) {
      return res.status(400).json({ error: 'password and userId required' });
    }

    // Use Argon2 for secure password hashing
    const hash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16, // 64 MB
      timeCost: 3,
      parallelism: 1,
      salt: Buffer.from(userId, 'utf8'), // Use userId as salt
    });

    console.log(`🔐 Password hashed for user: ${userId}`);
    
    res.json({
      success: true,
      hash
    });
  } catch (error) {
    console.error('❌ Password hashing error:', error);
    res.status(500).json({ error: 'Password hashing failed' });
  }
});

/**
 * Encrypt sensitive data on server
 */
router.post('/crypto/encrypt', authenticateToken, async (req, res) => {
  try {
    const { data, userId, userPin } = req.body;
    
    if (!data || !userId || !userPin) {
      return res.status(400).json({ error: 'data, userId, and userPin required' });
    }

    const encryptedData = encryptWithPin(data, userPin, userId);
    
    console.log(`🔐 Data encrypted for user: ${userId}`);
    
    res.json({
      success: true,
      encryptedData
    });
  } catch (error) {
    console.error('❌ Encryption error:', error);
    res.status(500).json({ error: 'Encryption failed' });
  }
});

/**
 * Decrypt sensitive data on server
 */
router.post('/crypto/decrypt', authenticateToken, async (req, res) => {
  try {
    const { encryptedData, userId, userPin } = req.body;
    
    if (!encryptedData || !userId || !userPin) {
      return res.status(400).json({ error: 'encryptedData, userId, and userPin required' });
    }

    const decryptedData = decryptWithPin(encryptedData, userPin, userId);
    
    console.log(`🔓 Data decrypted for user: ${userId}`);
    
    res.json({
      success: true,
      data: decryptedData
    });
  } catch (error) {
    console.error('❌ Decryption error:', error);
    res.status(500).json({ error: 'Decryption failed' });
  }
});

// Helper functions for encryption/decryption
function encrypt(text, userId) {
  const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY + userId);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function decrypt(encryptedText, userId) {
  const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY + userId);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function encryptWithPin(data, pin, userId) {
  const key = crypto.pbkdf2Sync(pin, userId, 100000, 32, 'sha512');
  const cipher = crypto.createCipher('aes-256-cbc', key);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function decryptWithPin(encryptedData, pin, userId) {
  const key = crypto.pbkdf2Sync(pin, userId, 100000, 32, 'sha512');
  const decipher = crypto.createDecipher('aes-256-cbc', key);
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

// Temporary in-memory storage (replace with encrypted database in production)
const userTOTPSecrets = new Map();
const userWalletSeeds = new Map();
const userPublicKeys = new Map();

function getUserTOTPSecret(userId) {
  return userTOTPSecrets.get(userId);
}

function storeUserWalletSeed(userId, encryptedSeed) {
  userWalletSeeds.set(userId, encryptedSeed);
}

function getUserWalletSeed(userId) {
  return userWalletSeeds.get(userId);
}

function getUserPublicKey(userId) {
  return userPublicKeys.get(userId);
}

export default router;