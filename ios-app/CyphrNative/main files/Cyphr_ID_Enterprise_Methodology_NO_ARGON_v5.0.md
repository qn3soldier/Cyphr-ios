
# Cyphr ID — Enterprise Methodology (NO‑ARGON) — **v5.0**
**Date:** 2025‑09‑22  
**Status:** Production‑ready blueprint (updated with Device Binding v2, Single‑Key Recovery, full PQ‑E2E coverage)

> This document supersedes v4.2/v4.3/v4.4 and consolidates the decisions taken:  
> **(1)** Stable device binding via **Secure Enclave P‑256** key (Fingerprint v2),  
> **(2)** **Single‑Key Recovery** — one Ed25519 pair from 12 words for both login and recovery confirmations,  
> **(3)** Full **post‑quantum hybrid E2E** across **all communication** (messages, calls, voice notes, file transfers): **Kyber1024 (KEM) + ChaCha20‑Poly1305 (AEAD)**,  
> **(4)** Strict **one device = one account**, zero‑knowledge server, and **challenge–response** for both login and recovery.

---

## 0) Invariants & Guarantees
1. **Zero‑knowledge server.** The backend never stores private keys, biometrics, recovery phrases, or PINs; only **public keys** and a **device binding identifier** (public key or its hash).  
2. **One Device = One Account (strict).** Each `@id` has exactly **one** active device binding. Any other device must pass Recovery.  
3. **Every launch gated by Face/Touch ID.** UI opens only after successful local biometric. PIN is a **local fallback** for DEK unlock (no Argon, see §4.4).  
4. **Single‑Key Recovery (12 words).** The **same Ed25519 key** derived from the 12‑word phrase authorizes both login and recovery confirmation. Recovery **re‑binds** the account to a new device and **invalidates the old binding**.  
5. **Challenge–response everywhere.** Both `/login` and `/recovery/confirm` sign **server‑issued** nonces (single‑use, short TTL).  
6. **PQ‑E2E for all communication.** Messages, calls, voice notes, file transfers — all are E2E‑encrypted on clients using **Kyber1024 (KEM)** + **ChaCha20‑Poly1305 (AEAD)**. Transport remains TLS, but content is unreadable to the server.  

---

## 1) Key Material & Derivation (client‑side only)
- **BIP39 mnemonic (12 words)** → `seed` (512 bits).  
- **Ed25519 (Auth/Recovery)**: derived via SLIP‑0010 / ed25519‑bip32 at a fixed path, e.g. `m/44'/637'/0'/0/0`.  
  - Used to sign **login challenge** and **recovery challenge** (Single‑Key model).  
- **P‑256 Secure Enclave** — **DeviceBindingKey** (non‑exportable, not gated by biometrics).  
  - Proves “this device” during login; also defines the **device fingerprint v2**.  
- **Kyber1024** — client E2E KEM for all content channels.  
- **DEK (32 bytes)** — local data encryption key to wrap private keys and sensitive blobs in Keychain.

> **Do not store** the 12‑word phrase by default. If the user explicitly opts in, store it under `.biometryCurrentSet` only.

---

## 2) Device Fingerprint v2 (Secure Enclave Binding)
**Problem solved:** IDFV/iOS version based hashes “drift” after OS/app changes.  
**Solution:** bind the account to a **cryptographic device key**.

### 2.1. Creation (on Sign Up / first run)
- Generate **P‑256** key in **Secure Enclave** with attributes:  
  `kSecAttrTokenIDSecureEnclave`, `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`, **without** `.biometryCurrentSet` (to survive Face ID resets).  
- Extract **public key** (`deviceBindingPublicKey`).

### 2.2. Fingerprint value
```
device_fingerprint_hash = SHA256( DER(deviceBindingPublicKey) )
```
- **Server stores only** this hash (and optionally the raw public key).  
- On login, the client presents `deviceBindingPublicKey` + signature over server challenge; server recomputes the hash and verifies signature.

### 2.3. Why this works
- **Stable across iOS updates** and app reinstalls that preserve Keychain; new physical device ⇒ new key ⇒ requires Recovery.  
- **Zero PII.** It’s a hash of a public key; server cannot reverse it to anything sensitive.

---

## 3) Flows (UX + protocol)

### 3.1. App Launch (always)
1) **Biometric gate** (Face/Touch ID).  
2) If local identity exists and biometric succeeds → **unlock DEK** (via biometry or PIN fallback) → continue.  
3) If no identity → **Sign Up**.

### 3.2. Sign Up
1) User picks **Cyphr ID**; client checks availability.  
2) Client locally generates: BIP39 (12), Ed25519, Kyber1024, **DeviceBindingKey (SE)**, `device_fingerprint_hash`.  
3) Client **does not upload** secrets; sends to server:  
   `{ cyphrId, ed25519AuthPublicKey, kyberPublicKey, deviceBindingPublicKey|device_fingerprint_hash, securityLevel }`.  
4) Server creates identity; client persists keys under **DEK** and prepares DEK wrappers (bio/pin).  
5) App opens (signed‑in).

### 3.3. Sign In (subsequent)
1) App asks server for **challenge** (`GET /challenge?cyphrId`).  
2) Client signs with **Ed25519** (account) **and** with **P‑256 DeviceBindingKey** (device).  
3) `POST /login { cyphrId, authSignature, deviceSignature, deviceBindingPublicKey? }` → server verifies both signatures + recomputed hash → issues JWT (TTL 24h).  
4) If device signature/hash mismatches → `{ error: "FINGERPRINT_MISMATCH", recoveryRequired: true }`.

### 3.4. Recovery (lost device)
Goal: restore **the same account** on a new device and **replace** the device binding.  
1) New device: user enters **12 words** → derive **the same Ed25519**.  
2) Generate a new **DeviceBindingKey (SE)** → compute new `device_fingerprint_hash`.  
3) `POST /recovery/init { cyphrId, newDeviceBindingPublicKey|newDeviceFingerprintHash }` → `{ recoveryChallenge, ttl }`.  
4) Client signs `recoveryChallenge` with **the same Ed25519** (Single‑Key).  
5) `POST /recovery/confirm { cyphrId, recoverySignature }` → server verifies by stored `ed25519_auth_pub`, **replaces** device binding with the new key/hash, optionally accepts a new `kyberPublicKey`, and returns JWT.  
6) Old device’s binding is now **invalid**.

> **Important:** Regular `/login` **never** re‑binds the device. Binding changes **only** in `/recovery/*`.

### 3.5. Biometric reset / fallback
- If `.biometryCurrentSet` changes, `bioWrappedDEK` becomes inaccessible → use **PIN** to unwrap DEK and **re‑wrap** it under new biometry. Device binding **is not affected**.

### 3.6. Reinstall / iOS update
- iOS updates: no change (key persists; binding stable).  
- Full reinstall / Keychain wiped: device key lost → login fails with `FINGERPRINT_MISMATCH` → user performs **Recovery**.

---

## 4) Local Secrets: Storage & Unlock

### 4.1. Keychain layout (all **ThisDeviceOnly**)
- `cyphr_username`, `security_level` (public)  
- `deviceBindingPublicKey` (public) and/or `device_fingerprint_hash`  
- `ed25519_auth_priv_enc` (under **DEK**)  
- `kyber_priv_enc` (under **DEK**)  
- `dek_bio_wrap`, `dek_pin_wrap`  
- `pin_salt`, `pin_kdf_iter`, `pin_verifier?`, counters/lastAttempt  
- `jwt_token`

### 4.2. DEK model
- One 32‑byte **DEK**; **all private keys stay only as AES‑GCM(DEK, …)** blobs.  
- Two wrappers: **biometric** and **PIN**.

### 4.3. Biometry
- Use `SecAccessControl(.biometryCurrentSet, .whenUnlockedThisDeviceOnly)` for BIO‑wrapper.

### 4.4. PIN (NO‑ARGON)
- `pinKey = PBKDF2‑HMAC‑SHA256(PIN, salt32, iter≈50‑120ms)`  
- `pepperKey (32B)` stored **ThisDeviceOnly**.  
- `KEK_pin = HKDF‑SHA256(ikm=pinKey, salt=pepperKey, info="CYPHR‑KEK‑v1")`  
- `dek_pin_wrap = AES‑GCM_Encrypt(KEK_pin, DEK)`  
- Rate limiting: attempts 1‑3 → 0s; 4→1s; 5→2s; 6→5s; 7→15s; 8→60s; 9→300s; 10→900s; 11+→3600s; **wipe** after 15.

---

## 5) Post‑Quantum Hybrid E2E (for **all** communication)
**Target:** messages, calls (signaling + SRTP keys), voice notes, file transfers — all end‑to‑end.

### 5.1. Key agreement
- **Kyber1024 (KEM)** to derive ephemeral shared secrets per session / per conversation / per file block (as designed).  
- Authenticate KEM exchanges by **Ed25519 signatures** (bind ephemeral Kyber public keys to identities).

### 5.2. Content encryption
- **ChaCha20‑Poly1305 (AEAD)** for payloads.  
- Keys derived as `CEK = HKDF‑SHA256( KEM_shared, info=channel|session|nonce )`.  
- For attachments: client encrypts to **ciphertext**, uploads to S3 via presigned URL; server stores **ciphertext only**.  
- For calls: derive SRTP master keys from KEM_shared; use ChaCha20‑Poly1305‑based SRTP profile (or map to AES‑GCM SRTP if required by stack).

### 5.3. Metadata minimization
- Server stores minimal routing metadata and timestamps; no plaintext content; redact logs.

---

## 6) API Contracts

### 6.1. Registration
`POST /api/cyphr-id/register`
```json
{
  "cyphrId": "alice",
  "ed25519AuthPublicKey": "<base64>",
  "kyberPublicKey": "<base64>",
  "deviceBindingPublicKey": "<base64-der>",
  "deviceFingerprintHash": "<hex>",
  "securityLevel": "biometry" // or pinAndBiometry / none
}
```
**Response:** `{ "success": true, "token": "<jwt_24h>" }`

### 6.2. Challenge
`GET /api/cyphr-id/challenge?cyphrId=alice` → `{ "challenge": "<base64>", "ttl": 60 }`

### 6.3. Login
`POST /api/cyphr-id/login`
```json
{
  "cyphrId": "alice",
  "authSignature": "<base64 ed25519(challenge)>",
  "deviceSignature": "<base64 p256-se(challenge)>",
  "deviceBindingPublicKey": "<base64-der>"
}
```
**Server:** recompute `SHA256(DER(pub))`, compare with stored hash, verify both signatures, issue JWT (24h).  
**Error on mismatch:** `{ "error": "FINGERPRINT_MISMATCH", "recoveryRequired": true }`

### 6.4. Recovery
`POST /api/cyphr-id/recovery/init`
```json
{ "cyphrId": "alice", "newDeviceBindingPublicKey": "<base64-der>", "newDeviceFingerprintHash": "<hex>" }
```
→ `{ "recoveryChallenge": "<base64>", "ttl": 300 }`

`POST /api/cyphr-id/recovery/confirm`
```json
{ "cyphrId": "alice", "recoverySignature": "<base64 ed25519(recoveryChallenge)>" }
```
**Server:** verify by `ed25519AuthPublicKey` (Single‑Key), **replace** device binding, optionally accept new `kyberPublicKey`, return JWT.

### 6.5. Errors (canonical)
- `FINGERPRINT_MISMATCH`, `CHALLENGE_EXPIRED`, `RECOVERY_REQUIRED`, `TOO_MANY_ATTEMPTS`

---

## 7) Database Schema (Aurora/PostgreSQL)
```sql
CREATE TABLE cyphr_identities (
  cyphr_id                 TEXT PRIMARY KEY,
  ed25519_auth_pub         TEXT NOT NULL,
  kyber_public_key         TEXT,
  device_binding_pub       TEXT,   -- optional, store if you need, else store only the hash
  device_fingerprint_hash  TEXT NOT NULL,
  fingerprint_method_ver   SMALLINT NOT NULL DEFAULT 2,
  security_level           VARCHAR(20) NOT NULL DEFAULT 'biometry',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen                TIMESTAMPTZ
);

CREATE UNIQUE INDEX uniq_binding ON cyphr_identities (cyphr_id);
```
- Exactly **one** `device_fingerprint_hash` per `cyphr_id`.  
- For future changes, bump `fingerprint_method_ver` and migrate.

---

## 8) iOS Implementation Notes
- **Secure Enclave key**: `kSecAttrTokenIDSecureEnclave`, `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`, no `.biometryCurrentSet`.  
- **Biometric wrapper**: `SecAccessControlCreateWithFlags(..., .biometryCurrentSet, ...)`.  
- **Keychain**: set `kSecAttrSynchronizable=false` (no iCloud sync).  
- **Foreground lock**: blur snapshot; auto‑lock after **5 minutes** inactivity (re‑gate with biometry).  
- **JWT handling**: refresh or re‑login via challenge when TTL (24h) expires.  
- **No default storage** for the 12‑word phrase; provide explicit opt‑in with Face ID protection.

---

## 9) Migration Plan (v4.x → v5.0)
1) **Add columns**: `device_binding_pub`, `device_fingerprint_hash`, `fingerprint_method_ver`.  
2) **Client update**: generate DeviceBindingKey; on next login run a one‑time **binding upload** (`/migration/binding`) signing a server challenge with both Ed25519 and P‑256.  
3) **Dual‑mode login window**: accept legacy v1 fingerprint for T+30 days while prompting clients to migrate; then enforce v2 only.  
4) **No change** to account recovery semantics — remains **re‑binding** using 12 words.

---

## 10) Threat Model & Mitigations (summary)
- **Stolen server DB** → contains only public keys + binding hashes + ciphertext; no plaintext, no private keys.  
- **Compromised old device** → attacker may have local Auth key but **cannot re‑bind** without the mnemonic (recovery flow required and server requires device signature + recovery signature).  
- **Replay attacks** → blocked by server **challenge** (single‑use, TTL).  
- **Brute force PIN** → rate limiting + wipe; DEK wrapped with peppered KDF.  
- **iOS updates/biometry changes** → do not break binding; only DEK wrapper may need re‑wrap via PIN fallback.

---

## 11) QA Checklist (must pass)
- Login checks both signatures; returns `FINGERPRINT_MISMATCH` if device binding is different.  
- Recovery replaces device binding; old device cannot log in.  
- iOS major/minor update does **not** trigger false mismatch.  
- Reinstall with Keychain wipe → requires Recovery.  
- Attachments are uploaded as ciphertext; downloads are decrypted locally.  
- Calls/voice notes derive SRTP/stream keys from Kyber KEM shared secret; audio cannot be decoded by server.  
- Performance: biometric → app home < 2 s; login (dual signature) < 2 s including network; PIN KDF ~80 ms on target devices.

---

## 12) Pseudocode (critical snippets)

**Device Binding Key (iOS)**
```swift
let access = SecAccessControlCreateWithFlags(nil,
    kSecAttrAccessibleWhenUnlockedThisDeviceOnly, [], nil)!

let attrs: [CFString: Any] = [
  kSecAttrKeyType: kSecAttrKeyTypeECSECPrimeRandom,
  kSecAttrKeySizeInBits: 256,
  kSecAttrTokenID: kSecAttrTokenIDSecureEnclave,
  kSecPrivateKeyAttrs: [
    kSecAttrIsPermanent: true,
    kSecAttrApplicationTag: "cyphr_device_binding_priv".data(using: .utf8)!,
    kSecAttrAccessControl: access
  ]
]
let devicePriv = SecKeyCreateRandomKey(attrs as CFDictionary, nil)!
let devicePub  = SecKeyCopyPublicKey(devicePriv)!
// hash = SHA256(DER(devicePub))
```

**Login (dual signature)**
```http
GET /api/cyphr-id/challenge?cyphrId=@alice -> { "challenge": "<base64>", "ttl": 60 }
authSig = Ed25519.sign(authPriv, challenge)
devSig  = P256.sign(devicePriv, challenge)

POST /api/cyphr-id/login {
  "cyphrId": "alice",
  "authSignature": base64(authSig),
  "deviceSignature": base64(devSig),
  "deviceBindingPublicKey": base64(DER(devicePub))
}
<- { token: jwt_24h } or { "error": "FINGERPRINT_MISMATCH", "recoveryRequired": true }
```

**Recovery (re‑bind)**
```http
POST /api/cyphr-id/recovery/init { "cyphrId": "alice", "newDeviceBindingPublicKey": "<base64-der>", "newDeviceFingerprintHash": "<hex>" }
-> { "recoveryChallenge": "<base64>", "ttl": 300 }

recSig = Ed25519.sign(authPrivRestoredFrom12Words, recoveryChallenge)
POST /api/cyphr-id/recovery/confirm { "cyphrId": "alice", "recoverySignature": base64(recSig) }
-> { "success": true, "token": "<jwt_24h>" }
```

---

**Definition of Done (v5.0)**  
- [ ] Device Binding v2 (SE) implemented; server verifies **both** signatures at login.  
- [ ] Single‑Key Recovery works; `/login` never re‑binds; only `/recovery/*` replaces binding.  
- [ ] PQ‑E2E (Kyber1024 + ChaCha20‑Poly1305) applied to **all** channels.  
- [ ] No secrets on server; attachments are ciphertext; minimal metadata only.  
- [ ] iOS Keychain: all secrets `WhenUnlockedThisDeviceOnly`; 12‑word phrase not stored by default.  
- [ ] QA & performance targets pass.
