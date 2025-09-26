/**
 * CYPHR MESSENGER - Cyphr ID Authentication Endpoints (v5.0 compliant)
 * One device = One account. Zero-knowledge. Challenge–response.
 */

const db = require('./shared-db-pool.cjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'cyphr-quantum-secure-2025-secret';

function initializeCyphrIdEndpoints(app) {
  // In-memory challenge store (login + recovery)
  const challenges = new Map();
  const LOGIN_TTL_MS = 60 * 1000;
  const RECOVERY_TTL_MS = 5 * 60 * 1000;

  // Helpers
  const getPool = async () => db.sharedPool || await db.getPool();

  function verifyEd25519Signature(base64PublicKey, message, base64Signature) {
    try {
      const rawPub = Buffer.from(base64PublicKey, 'base64');
      let spki;
      // If 32 bytes, wrap raw Ed25519 into SPKI
      if (rawPub.length === 32) {
        const prefix = Buffer.from('302a300506032b6570032100', 'hex');
        spki = Buffer.concat([prefix, rawPub]);
      } else {
        spki = rawPub; // Assume already SPKI DER
      }
      const keyObj = crypto.createPublicKey({ key: spki, format: 'der', type: 'spki' });
      const sig = Buffer.from(base64Signature, 'base64');
      return crypto.verify(null, Buffer.from(message, 'utf8'), keyObj, sig);
    } catch (e) {
      console.warn('verifyEd25519Signature error:', e.message);
      return false;
    }
  }

  function verifyP256Signature(base64RawOrDerPublicKey, message, base64DerSignature) {
    try {
      const pubBuf = Buffer.from(base64RawOrDerPublicKey, 'base64');
      let keyObj;
      // If raw uncompressed point (first byte 0x04, length 65), convert to JWK
      if (pubBuf.length === 65 && pubBuf[0] === 0x04) {
        const x = pubBuf.slice(1, 33);
        const y = pubBuf.slice(33, 65);
        const b64url = (b) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
        const jwk = { kty: 'EC', crv: 'P-256', x: b64url(x), y: b64url(y) };
        keyObj = crypto.createPublicKey({ key: jwk, format: 'jwk' });
      } else {
        // Assume SPKI DER
        keyObj = crypto.createPublicKey({ key: pubBuf, format: 'der', type: 'spki' });
      }
      const sig = Buffer.from(base64DerSignature, 'base64');
      return crypto.verify('sha256', Buffer.from(message, 'utf8'), keyObj, sig);
    } catch (e) {
      console.warn('verifyP256Signature error:', e.message);
      return false;
    }
  }

  function sha256Hex(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

  // ============ Availability Check ============
  app.post('/api/cyphr-id/check', async (req, res) => {
    try {
      const { cyphrId } = req.body || {};
      if (!cyphrId || !/^[a-z0-9_]{3,30}$/.test(cyphrId)) {
        return res.status(400).json({ success: false, message: 'Invalid cyphrId' });
      }
      const pool = await getPool();
      const r = await pool.query('SELECT 1 FROM cyphr_identities WHERE cyphr_id = $1', [cyphrId]);
      res.json({ success: true, available: r.rows.length === 0, suggestions: [] });
    } catch (e) {
      console.error('check error:', e);
      res.status(500).json({ success: false, message: 'Failed to check Cyphr ID' });
    }
  });

  // ============ Registration (v5.0) ============
  // Body: { cyphrId, ed25519AuthPublicKey, kyberPublicKey, deviceBindingPublicKey, deviceFingerprintHash, securityLevel }
  app.post('/api/cyphr-id/register', async (req, res) => {
    try {
      const { cyphrId, ed25519AuthPublicKey, kyberPublicKey, deviceBindingPublicKey, deviceFingerprintHash, securityLevel } = req.body || {};
      if (!cyphrId || !ed25519AuthPublicKey || (!deviceBindingPublicKey && !deviceFingerprintHash)) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
      }
      const pool = await getPool();
      const exists = await pool.query('SELECT 1 FROM cyphr_identities WHERE cyphr_id = $1', [cyphrId]);
      if (exists.rows.length > 0) return res.status(409).json({ success: false, message: 'Cyphr ID already taken' });

      let bindingHash = deviceFingerprintHash;
      if (!bindingHash && deviceBindingPublicKey) {
        bindingHash = sha256Hex(Buffer.from(deviceBindingPublicKey, 'base64'));
      }

      const ins = await pool.query(`
        INSERT INTO cyphr_identities (
          cyphr_id, public_key, kyber_public_key,
          device_binding_pub, device_fingerprint_hash, fingerprint_method_ver, security_level, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7, CURRENT_TIMESTAMP)
        RETURNING id, cyphr_id
      `, [
        cyphrId,
        ed25519AuthPublicKey,
        kyberPublicKey || null,
        deviceBindingPublicKey || null,
        bindingHash,
        2,
        securityLevel || 'biometry'
      ]);

      const user = ins.rows[0];
      const token = jwt.sign({ userId: user.id, cyphrId: user.cyphr_id }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ success: true, token, user: { id: user.id, cyphrId: user.cyphr_id } });
    } catch (e) {
      console.error('register error:', e);
      res.status(500).json({ success: false, message: 'Registration failed' });
    }
  });

  // ============ Challenge (login) ============
  app.get('/api/cyphr-id/challenge', async (req, res) => {
    try {
      const { cyphrId } = req.query || {};
      if (!cyphrId) return res.status(400).json({ success: false, message: 'cyphrId required' });
      const challenge = crypto.randomBytes(32).toString('base64');
      const challengeId = crypto.randomBytes(16).toString('hex');
      challenges.set(challengeId, { cyphrId, challenge, createdAt: Date.now(), type: 'login' });
      setTimeout(() => challenges.delete(challengeId), LOGIN_TTL_MS);
      res.json({ success: true, challengeId, challenge, ttl: 60 });
    } catch (e) {
      console.error('challenge error:', e);
      res.status(500).json({ success: false, message: 'Failed to generate challenge' });
    }
  });

  // ============ Login (v5.0) ============
  // Body: { cyphrId, challengeId, authSignature, deviceSignature?, deviceBindingPublicKey? }
  app.post('/api/cyphr-id/login', async (req, res) => {
    try {
      const { cyphrId, challengeId, authSignature, deviceSignature, deviceBindingPublicKey } = req.body || {};
      if (!cyphrId || !challengeId || !authSignature) return res.status(400).json({ success: false, message: 'Missing required fields' });

      const item = challenges.get(challengeId);
      if (!item || item.cyphrId !== cyphrId || item.type !== 'login') {
        return res.status(401).json({ success: false, error: 'CHALLENGE_EXPIRED' });
      }
      challenges.delete(challengeId);
      const challenge = item.challenge;

      const pool = await getPool();
      const ur = await pool.query(`SELECT id, cyphr_id, public_key, device_fingerprint_hash, device_binding_pub FROM cyphr_identities WHERE cyphr_id = $1`, [cyphrId]);
      if (ur.rows.length === 0) return res.status(404).json({ success: false, message: 'User not found' });
      const user = ur.rows[0];

      // Verify Ed25519 signature over challenge
      if (!verifyEd25519Signature(user.public_key, challenge, authSignature)) {
        return res.status(401).json({ success: false, message: 'Invalid auth signature' });
      }

      // Device binding check
      if (deviceBindingPublicKey) {
        const computed = sha256Hex(Buffer.from(deviceBindingPublicKey, 'base64'));
        if (user.device_fingerprint_hash && user.device_fingerprint_hash !== computed) {
          return res.status(401).json({ success: false, error: 'FINGERPRINT_MISMATCH', recoveryRequired: true });
        }
        // First login: persist binding
        if (!user.device_fingerprint_hash) {
          await pool.query('UPDATE cyphr_identities SET device_fingerprint_hash = $1, device_binding_pub = $2 WHERE id = $3', [computed, deviceBindingPublicKey, user.id]);
        }
        // Verify device signature if provided
        if (deviceSignature) {
          const ok = verifyP256Signature(deviceBindingPublicKey, challenge, deviceSignature);
          if (!ok) return res.status(401).json({ success: false, message: 'Invalid device signature' });
        }
      }

      // Issue JWT (24h)
      const token = jwt.sign({ userId: user.id, cyphrId: user.cyphr_id, type: 'cyphr_identity' }, JWT_SECRET, { expiresIn: '24h' });
      await pool.query('UPDATE cyphr_identities SET last_seen = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
      res.json({ success: true, token, user: { id: user.id, cyphrId: user.cyphr_id } });
    } catch (e) {
      console.error('login error:', e);
      res.status(500).json({ success: false, message: 'Login failed' });
    }
  });

  // ============ Recovery (re-bind) ============
  // INIT: { cyphrId, newDeviceBindingPublicKey?, newDeviceFingerprintHash? }
  app.post('/api/cyphr-id/recovery/init', async (req, res) => {
    try {
      const { cyphrId, newDeviceBindingPublicKey, newDeviceFingerprintHash } = req.body || {};
      if (!cyphrId) return res.status(400).json({ success: false, message: 'cyphrId required' });
      const pool = await getPool();
      const ur = await pool.query('SELECT id FROM cyphr_identities WHERE cyphr_id = $1', [cyphrId]);
      if (ur.rows.length === 0) return res.status(404).json({ success: false, error: 'USER_NOT_FOUND' });

      let bindingHash = newDeviceFingerprintHash;
      if (!bindingHash && newDeviceBindingPublicKey) {
        bindingHash = sha256Hex(Buffer.from(newDeviceBindingPublicKey, 'base64'));
      }
      const recoveryChallenge = crypto.randomBytes(32).toString('base64');
      const challengeId = crypto.randomBytes(16).toString('hex');
      challenges.set(challengeId, { cyphrId, challenge: recoveryChallenge, newDeviceBindingPublicKey, newDeviceFingerprintHash: bindingHash, type: 'recovery' });
      setTimeout(() => challenges.delete(challengeId), RECOVERY_TTL_MS);
      res.json({ success: true, challengeId, recoveryChallenge, ttl: 300 });
    } catch (e) {
      console.error('recovery init error:', e);
      res.status(500).json({ success: false, message: 'Failed to initiate recovery' });
    }
  });

  // CONFIRM: { cyphrId, challengeId, recoverySignature }
  app.post('/api/cyphr-id/recovery/confirm', async (req, res) => {
    try {
      const { cyphrId, challengeId, recoverySignature } = req.body || {};
      const data = challenges.get(challengeId);
      if (!data || data.type !== 'recovery' || data.cyphrId !== cyphrId) return res.status(400).json({ success: false, error: 'CHALLENGE_EXPIRED' });
      const pool = await getPool();
      const ur = await pool.query('SELECT id, cyphr_id, public_key FROM cyphr_identities WHERE cyphr_id = $1', [cyphrId]);
      if (ur.rows.length === 0) return res.status(404).json({ success: false, error: 'USER_NOT_FOUND' });
      const user = ur.rows[0];

      // Verify Ed25519 recovery signature over server challenge
      if (!verifyEd25519Signature(user.public_key, data.challenge, recoverySignature)) {
        return res.status(401).json({ success: false, error: 'INVALID_SIGNATURE' });
      }

      // Re-bind device fingerprint
      const newHash = data.newDeviceFingerprintHash;
      const newPub = data.newDeviceBindingPublicKey || null;
      if (!newHash) return res.status(400).json({ success: false, message: 'Missing new device binding' });
      await pool.query('UPDATE cyphr_identities SET device_fingerprint_hash = $1, device_binding_pub = $2, last_seen = CURRENT_TIMESTAMP WHERE id = $3', [newHash, newPub, user.id]);
      challenges.delete(challengeId);

      const token = jwt.sign({ userId: user.id, cyphrId: user.cyphr_id }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ success: true, token, user: { id: user.id, cyphrId: user.cyphr_id } });
    } catch (e) {
      console.error('recovery confirm error:', e);
      res.status(500).json({ success: false, message: 'Recovery failed' });
    }
  });

  console.log('✅ Cyphr ID v5.0 endpoints added');
}

module.exports = initializeCyphrIdEndpoints;

