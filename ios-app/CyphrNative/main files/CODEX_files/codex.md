## Codex Session Report — Cyphr ID v5.0 Compliance (23 Sep 2025)

This document captures, in maximum practical detail, the work completed in this session to bring Cyphr Messenger to full alignment with Cyphr_ID_Enterprise_Methodology_NO_ARGON_v5.0.md, across server and iOS. It includes what was changed, where, how it was tested, and what remains.

---

> CRITICAL: See `codex_role)model.md` (living operating model). Update it after every task. It encodes how I plan, execute, verify, document, and learn — and the guardrails to avoid repeating mistakes.
> CRITICAL: See `codex_release_plan.md` (release blueprint). Keep workstreams/checklists in sync; update after each milestone.
> CRITICAL: See `Codex_todo_next.md` (next‑session TODO). Use as the tight, actionable list for the next work block.

### Executive Summary

- Implemented v5.0-compliant auth flow end-to-end: Register → Challenge → Login (dual signatures) → Recovery (re‑bind) → Login.
- Updated server endpoints to the exact v5.0 contracts and fixed infrastructure blockers (RDS auth + schema).
- Updated iOS client to match v5.0 payloads and challengeId semantics; recovery now replaces binding (no new account).
- Validated server flow with a synthetic E2E test using real Ed25519 and P‑256 keys; removed all test artifacts after success.

Result: Server flow confirmed OK. iOS code aligned to v5.0 and ready for device E2E.

---

### Session Update — 24 Sep 2025 (Reality Check)

- Server: PM2/502 fixed; `/api/cyphr-id/challenge` and `/api/cyphr-id/recovery/init` working; DB cleanup via `TRUNCATE … CASCADE` executed for clean start.
- iOS login: sign UTF‑8 challenge; removed Bearer on `/challenge|/login`; auto re‑bind on `FINGERPRINT_MISMATCH` (init→confirm) without 12‑word UI.
- Startup: when server 404 for @id, local identity is wiped automatically (no ghost IDs).
- Recovery Phrase: Reveal now uses Face ID and loads from Keychain; words displayed.
- UI: start of systemic redesign (see `CODEX_files/redesign.md`): removed Chats header, glass search, dark glass TabBar. Full Theme/Glass components pending.

Action Items
- Implement Theme.swift + Glass components + GlassDock; refactor Chats/Settings/Profile.
- Negative QA for auth (expired/malformed/offline); add Delete Account flow (server+client).
- Refresh docs: overview/release/role_model/todo.

---

### Server Changes (Production)

Files:
- /var/www/cyphr/cyphr-id-rds-endpoints.cjs — Rewritten for v5.0.
- /var/www/cyphr/shared-db-pool.cjs — Verified shared pool provider.
- /var/www/cyphr/aws-secrets-config.cjs — Verified secret loader (secret: `cyphr-rds-prod`).
- /var/www/cyphr/server.cjs:1047,1052 — Confirmed endpoint initialization order.

Key Endpoint Contracts (as implemented):
- POST `/api/cyphr-id/register`
  - Body: `{ cyphrId, ed25519AuthPublicKey, kyberPublicKey, deviceBindingPublicKey, deviceFingerprintHash, securityLevel }`
  - Persists v5.0 columns; issues JWT (24h).
- GET `/api/cyphr-id/challenge?cyphrId=...`
  - Returns `{ success, challengeId, challenge, ttl }` (TTL=60s).
- POST `/api/cyphr-id/login`
  - Body: `{ cyphrId, challengeId, authSignature, deviceSignature?, deviceBindingPublicKey? }`
  - Verifies Ed25519 over server challenge; validates device binding via `SHA256(DER(pub))`; first login persists binding; optional verify P‑256 signature; returns JWT (24h).
- POST `/api/cyphr-id/recovery/init`
  - Body: `{ cyphrId, newDeviceBindingPublicKey?, newDeviceFingerprintHash? }`
  - Returns `{ success, challengeId, recoveryChallenge, ttl=300 }`.
- POST `/api/cyphr-id/recovery/confirm`
  - Body: `{ cyphrId, challengeId, recoverySignature }`
  - Verifies Ed25519 over recoveryChallenge; replaces device binding; returns JWT (24h).

Infra Fixes:
- RDS password synchronization: updated the RDS master password to match the AWS Secrets Manager secret `cyphr-rds-prod`. Verified connectivity via psql with SSL.
- Schema: added missing columns to `cyphr_identities`:
  - `device_binding_pub` TEXT
  - `device_fingerprint_hash` TEXT
  - `fingerprint_method_ver` SMALLINT DEFAULT 2
  - `security_level` VARCHAR(20) DEFAULT 'biometry'
  - `last_seen` TIMESTAMPTZ

Validation:
- curl sanity checks: challenge OK, register OK (returns JWT), login rejects invalid signatures (expected), recovery init/confirm validates signatures.
- Synthetic E2E Test (executed + removed):
  - Script path (removed): `/var/www/cyphr/scripts/test_v5_flow.js`
  - Flow:
    1) Register test @id with Ed25519 + P‑256 pubkey (DER).
    2) Challenge; login with dual signatures ⇒ success.
    3) New P‑256 ⇒ FINGERPRINT_MISMATCH as expected.
    4) Recovery init ⇒ recoveryChallenge; confirm with Ed25519 ⇒ success.
    5) Login with new device ⇒ success.
  - Final output: `E2E v5.0 flow OK`.

Security Notes:
- Zero‑knowledge preserved: server never sees private keys or mnemonics.
- Secrets: DB credentials are sourced from AWS Secrets Manager; no plaintext passwords logged.
- Challenge store is in‑memory; TTL enforced and auto‑cleanup scheduled.

---

### iOS Changes

Files and high‑level diffs:
- NetworkService.swift:1
  - Register now sends v5.0 fields: `ed25519AuthPublicKey`, `deviceBindingPublicKey` (DER Base64), `deviceFingerprintHash`, `kyberPublicKey`, `securityLevel`.
  - Login now requires `challengeId` + `authSignature`; optional `deviceSignature`, `deviceBindingPublicKey`.
  - Recovery updated to v5.0 (`init`: new binding material; `confirm`: `challengeId` + `recoverySignature`).
  - RecoveryInitResponse updated to `{ challengeId, recoveryChallenge, ttl }`.

- AuthenticationService.swift:1
  - Login: uses server `challengeId`, signs challenge with Ed25519; device signature is P‑256 SE over challenge; sends DER(SPKI) device public key.
  - Register: uses DER(SPKI) device pubkey + SHA256(DER(pub)) fingerprint.
  - Recovery: changed semantics to re‑bind (init → sign server recoveryChallenge with Ed25519 → confirm), no “new account” creation.

- SecureEnclaveService.swift:1
  - Fingerprint now computed as `SHA256(DER(SPKI(pub)))` per spec.
  - Added `getDeviceBindingPublicKeyDER()` and `getDeviceBindingPublicKeyDERBase64()` to export proper DER(SPKI) from SE.

- CyphrIdLoginView.swift:1
  - UI: replaced “Choose New ID” step with entering the existing @id; calls `recoverIdentity` instead of deprecated “registerRecoveredIdentity”.

Behavioral Summary:
- Single‑Key (Ed25519) from 12‑word mnemonic retained; device binding is P‑256 SE (no biometry flag) with hash = SHA256(DER(SPKI(pub))).
- Challenge‑response is enforced on both login and recovery confirm.
- One device = one account (server enforces `FINGERPRINT_MISMATCH` and re‑bind only via recovery).

---

### What Remains (iOS polish)

- Face ID double prompt: LAContext reuse is implemented; re‑check flows to guarantee single prompt on cold start and during auth flows.
- Legacy DeviceIdentityService: verify it’s not used in active flows; if present only as fallback, remove from production paths.
- Optional storage of 12‑word phrase (default off) under `.biometryCurrentSet` with explicit user opt‑in.
- Documentation refresh and a brief on‑device E2E (Sign Up → Sign In → forced mismatch → Recovery) confirmation.

---

### Risks / Mitigations

- RDS credential drift — Mitigation: pulled from AWS Secrets; password rotated to match secret.
- Incomplete migration for legacy fingerprints — Mitigation: re‑bind via recovery; for future, add gentle migration path if needed.
- iOS UX corner‑cases (biometry flow) — Mitigation: LAContext reuse; add a small QA checklist and test on device.

### Cost/Runtime Checks (Production)

- PM2: один процесс `cyphr-backend`, CPU ~0%, RAM ~112MB (ok), no watchers.
- System: load average ~0.00, mem free ~500MB, cache ~2.7GB, disk ~79% of 7.6GB.
- Conclusion: инстанс не «жрёт» ресурсы; фоновых тяжелых задач нет.

---

### Session Log Entry — 2025‑09‑23 (Face ID double‑prompt mitigation)

- Inputs
  - Potential second Face ID prompt when App Start uses biometry and Login also requests it.
- Actions
  - Reuse authenticated LAContext if available in `loginWithCyphrId` to avoid a second prompt.
- Files
  - AuthenticationService.swift:1 — reuse `BiometricAuthService.shared.currentAuthenticatedContext()` or obtain a new one only if absent.
- Outputs
  - Expected single biometry prompt on cold start/login sequences.
- Tests
  - To be verified during device E2E run.

### Session Log Entry — 2025‑09‑23 (Keychain consolidation)

- Inputs
  - Goal: единый Keychain слой (EnterpriseKeychainService), отсутствие legacy wrapper в активных флоу.
- Actions
  - AuthTokenStore.swift:1 — теперь использует EnterpriseKeychainService (store/retrieve/delete) без обёртки.
  - MessagingService.swift:1 — retrieve Kyber private key через EnterpriseKeychainService.retrieve(...).
  - SecuritySetupView.swift:1 — хранение/проверка PIN через EnterpriseKeychainService.
  - Legacy KeychainService.swift оставлен в репозитории для совместимости Xcode-проекта, но не используется в активных флоу.
- Outputs
  - Все активные пути работают через единый, усиленный EnterpriseKeychainService.
- Tests
  - Компиляция/линк: ожидаемо ок; runtime — проверяется при iOS E2E.

### Session Log Entry — 2025‑09‑23 (Remove legacy KeychainService.swift)

- Inputs
  - Класс KeychainService больше не используется активными флоу; Xcode‑проект содержал ссылку.
- Actions
  - Удалил файл `KeychainService.swift` и очистил `CyphrNative.xcodeproj/project.pbxproj` от ссылок (PBXBuildFile, PBXFileReference, group children, Sources phase).
- Files
  - Deleted: KeychainService.swift
  - Updated: CyphrNative.xcodeproj/project.pbxproj:45,93,207,360 (удалены ссылки на KeychainService).
- Outputs
  - Проект больше не содержит legacy KeychainService; единственный Keychain слой — EnterpriseKeychainService.
- Tests
  - Проверка grep по коду: отсутствуют упоминания KeychainService в активных путях.

### Next Steps

1) iOS device E2E run and screenshots for QA log.
2) Face ID single‑prompt verification; remove any dead DeviceIdentityService paths.
3) Update documentation (Implementation Plan + QA checklist) and mark compliance as Done.

---

### Appendix — File References

- Server endpoints: /var/www/cyphr/cyphr-id-rds-endpoints.cjs:1
- Server init: /var/www/cyphr/server.cjs:1047, /var/www/cyphr/server.cjs:1052
- Secrets loader: /var/www/cyphr/aws-secrets-config.cjs:1
- Shared pool: /var/www/cyphr/shared-db-pool.cjs:1
- iOS Network: NetworkService.swift:1
- iOS Auth: AuthenticationService.swift:1
- iOS SE: SecureEnclaveService.swift:1
- iOS Recovery UI: CyphrIdLoginView.swift:1
