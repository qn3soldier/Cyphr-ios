# Cyphr Messenger — Overview (Session Summary)

Updated: 2025‑09‑23
Owner: Codex (agent) + Daniil
Scope: Single‑source summary of project state, decisions, progress, and next steps. This overview complements three living docs:
- codex_role)model.md — Operating Model (how we work)
- codex_release_plan.md — 2‑week release blueprint (App Store MVP, wallet OFF)
- Codex_todo_next.md — tight actionable TODO for the next session

---

## 1) Goals & Strategy

- Ship App Store‑MVP messenger in ~2 weeks (wallet disabled), with rock‑solid E2E security and reliable messaging.
- Strict v5.0 alignment for Cyphr ID: Secure Enclave device binding, Single‑Key recovery (12 words), challenge‑response everywhere.
- Zero‑knowledge server: only public keys + device binding hash + ciphertext (messages/media), no plaintext content.

Wallet Policy for MVP: code kept, feature disabled and hidden in UI/metadata to avoid review friction; will be developed post‑approval (v1.1).

---

## 2) Security/Architecture Principles (v5.0)

- Device Binding v2: P‑256 in Secure Enclave; fingerprint = SHA256(DER(SPKI(pub))).
- Single‑Key Recovery (12 words): Ed25519 is used for both login and recovery confirmations.
- Challenge–response for login and recovery: server issues single‑use nonces with TTL.
- PQ‑E2E: Kyber1024 (KEM) + ChaCha20‑Poly1305 (AEAD) for all payloads (messages/media/voice) — decryption only on client.

---

## 3) Server — What’s Done (Production)

- Cyphr ID endpoints (v5.0, production):
  - POST /api/cyphr-id/register — stores ed25519AuthPublicKey, deviceBindingPublicKey (DER/SPKI), deviceFingerprintHash; returns JWT(24h).
  - GET /api/cyphr-id/challenge?cyphrId=… — { challengeId, challenge, ttl }.
  - POST /api/cyphr-id/login — { cyphrId, challengeId, authSignature, deviceSignature?, deviceBindingPublicKey? } (dual‑signature, binding check, JWT).
  - POST /api/cyphr-id/recovery/init — { cyphrId, newDeviceBindingPublicKey|Hash } → { recoveryChallenge, challengeId, ttl }.
  - POST /api/cyphr-id/recovery/confirm — { cyphrId, challengeId, recoverySignature } → re‑bind + JWT.
- Infra fixed: RDS password synced with AWS Secrets (cyphr-rds-prod); psql with SSL ok.
- Schema added: device_binding_pub, device_fingerprint_hash, fingerprint_method_ver, security_level, last_seen.
- E2E synthetic test (prod): register → login(dual) → FINGERPRINT_MISMATCH → recovery re‑bind → login — PASSED.
- Production hardening (/api/cyphr-id/*): per‑route rate limiting, minimal logging (no bodies), counters endpoint /_stats.
- Resources: PM2 CPU≈0%, RAM≈23–112MB; load≈0 — server cost profile is small.

Server files (prod):
- /var/www/cyphr/cyphr-id-rds-endpoints.cjs
- /var/www/cyphr/server.cjs (rate limit/log/counters for /api/cyphr-id/*)
- /var/www/cyphr/shared-db-pool.cjs, /var/www/cyphr/aws-secrets-config.cjs

---

## 4) iOS — What’s Done (v5.0 alignment)

- NetworkService.swift: v5.0 payloads for register/login/recovery; login uses challengeId.
- AuthenticationService.swift: dual‑signature login (Ed25519 + P‑256 SE), recovery = re‑bind; Face ID prompt minimized by LAContext reuse.
- SecureEnclaveService.swift: export deviceBindingPublicKey in DER/SPKI; fingerprint = SHA256(DER(SPKI(pub))).
- Recovery UI: existing @id entry; calls recoverIdentity (no “new ID” step).
- Keychain consolidation: all active flows use EnterpriseKeychainService; legacy KeychainService.swift removed from project.

---

## 5) Project State (for App Store‑MVP, wallet OFF)

- Cyphr ID v5.0 (auth/recovery): 100% — production‑ready.
- Backend overall: 90–95% — add /api/messaging/* counters/limiters similar to cyphr‑id.
- iOS Cyphr ID layer: 90–95% — on‑device E2E to run as UX validation.
- Messaging (content): ~40–50% — to add full client‑side PQ‑E2E, Outbox/Retry/Offline, and media encryption.
- WebRTC: ~30–40% — optional for 1.0; can be polished post‑MVP.
- Compliance & Submission: ~30–40% — Account Deletion, Privacy/Terms, App Privacy form, export crypto, screenshots/metadata (no wallet).

2‑week MVP plan: see codex_release_plan.md (timeline + workstreams + DoD).

---

## 6) Messaging Storage — Current vs Target

Current (honest):
- Text: server stores ciphertext in DB (persistent); temporary /decrypt exists (to be removed).
- Media: not fully client‑encrypted yet; no S3 lifecycle configured.

Target (Signal/WhatsApp‑like):
- Queue + short TTL/ACK‑delete for ciphertext; no plaintext storage ever.
- Media/voice: client‑side encryption + S3 lifecycle (30–60 days TTL) or ACK‑based deletion.
- All decryption on client; remove any /decrypt server routes.

---

## 7) Audio Messages (MVP scope)

- Record with AVFoundation (M4A/AAC mono 16–22 kHz ~64 kbps); limit ~60s.
- Encrypt on client (Kyber+ChaCha); upload ciphertext to S3; metadata only on server.
- Download → decrypt → play; reuse Outbox/Retry; delivery states.
- DoD: two devices exchange & play multiple audio messages; no plaintext on server; size/duration limits enforced.

---

## 8) Next Session — P0 TODO (excerpt)

See Codex_todo_next.md for full list. P0 items:
- On‑device E2E Cyphr ID v5.0: Sign Up → Login(dual) → FINGERPRINT_MISMATCH → Recovery → Login (one Face ID prompt across flow).
- Messaging PQ‑E2E (text): end‑to‑end encrypt/decrypt on device (Kyber + ChaCha), no server decrypt.
- Outbox + Retry + Offline: persistent queue, backoff, idempotency, delivery states.
- Media (images) encryption: client‑side, upload/download, progress.
- Account Deletion: in‑app + server; post‑delete login fails.
- Onboarding & Permissions: wallet OFF (feature flag), Info.plist usage strings.
- Prod‑hardening for /api/messaging/*: limiter, minimal logs, /_stats.

---

## 9) Compliance & Review Notes (MVP)

- Wallet disabled (feature flag + removed from UI/metadata) — minimizes review risk.
- Account Deletion required by Apple for server‑based accounts.
- Privacy Policy & Terms links in‑app.
- App Privacy form in ASC: minimal categories; no tracking; E2E content not collected.
- Export compliance: “Uses encryption: Yes (standard mass‑market algorithms)”.
- Permissions rationale: camera/mic/photo/Face ID — clear, honest strings.

---

## 10) Risks & Mitigations

- Messaging reliability on poor networks — Outbox+Retry+Idempotency; Socket.IO reconnect/backoff.
- Storage growth — short TTL/ACK‑delete for ciphertext; S3 lifecycle for media.
- Review surprises — remove wallet mentions, ensure deletion flow, fill App Privacy correctly, no secret logging.

---

## 11) Live Documents (Closed Update Loop)

- codex_role)model.md — how we work; add Lessons/Guardrails after each task.
- codex_release_plan.md — delivery blueprint; update statuses/checklists.
- Codex_todo_next.md — next‑session actionable list; keep short and current.
- codex.md — session log (changes, tests, commands, outcomes) per task.

This overview stays stable and high‑level; all progress deltas go into the living docs above.

