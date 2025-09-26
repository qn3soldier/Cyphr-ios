# Codex Role & Operating Model (Living Document)

Purpose: This is the canonical, always‑evolving operating model for my work on Cyphr. It captures how I think, plan, execute, verify, and learn — with concrete playbooks and prompts. It must be updated at the end of every material task to encode lessons learned and strengthen future execution.

Status: ACTIVE — update after each task
Scope: Entire Cyphr stack (iOS, backend, infra, cryptography, QA)

---

## Core Principles

1) Source‑of‑Truth First
- Treat the spec `Cyphr_ID_Enterprise_Methodology_NO_ARGON_v5.0.md` as law.
- Derive explicit acceptance criteria (interfaces, data, cryptography). No ambiguity.
- Map spec → contracts → code files before any change.

2) Plan → Execute → Verify → Document
- Plan: write a short, testable plan (update_plan), identify checkpoints.
- Execute: minimal, surgical changes; keep style, avoid collateral edits.
- Verify: start narrow, then expand. Unit → endpoint → E2E. Use explicit oracles.
- Document: log changes, commands, and decisions (codex.md + this file). Capture pitfalls and how to avoid them.

3) Security & Zero‑Knowledge Discipline
- Secrets only via AWS Secrets Manager. Never log sensitive values.
- No private keys, mnemonics, or PINs on server. Only public keys and binding hashes.
- Use TLS/SSL to RDS. Confirm with psql and PGSSLMODE.

4) Observability & Reproducibility
- Before/after snapshots; backups of critical server files.
- Fast probes: curl, jq, psql, pm2 logs, tail, grep.
- Synthetic E2E scripts allowed for server validation — always remove afterwards.

5) Minimal Disruption
- Respect existing code and conventions; isolate refactors.
- Keep public contracts stable; add aliases only when necessary.

---

## Playbooks

### A. Spec → Code Mapping
1. Extract contracts from the spec (fields, signatures, hashes, TTLs, error codes).
2. Create a checklist per flow (Sign Up, Challenge, Login dual, Recovery re‑bind).
3. Validate DB schema matches contracts; plan migrations if deltas exist.
4. Locate iOS call sites; adjust payloads and models.
5. Locate backend routes; adjust logic and verification.

### B. Server Change Procedure
1. Audit: grep for routes, challenge maps, pool usage, logs.
2. Backup target files.
3. Patch endpoints inside the proper initialization scope; avoid global scope bugs.
4. Validate with `node -c` or equivalent; restart pm2.
5. Observe logs: pm2 logs + tail log files directly (timeouts happen).
6. Quick curl checks for positive/negative paths.
7. If DB errors: verify secret (aws secretsmanager), rotate password only if needed; test with psql + SSL.

### C. iOS Change Procedure
1. Align NetworkService models to server contracts.
2. Align AuthenticationService flows (challengeId, dual signatures, recovery semantics).
3. SecureEnclaveService: ensure DER(SPKI) for P‑256 pub, fingerprint = SHA256(DER(SPKI(pub))).
4. UI: no “new account” in recovery; use existing @id; ensure Face ID prompt reuse.
5. Run device E2E after server confirms.

### D. Validation Ladder
1. Unit: local computations (hashes, encodings) produce expected results.
2. Endpoint: curl JSON shape; errors on negative input.
3. E2E synthetic (server): register → login(dual) → mismatch → recovery → login.
4. E2E device: Sign Up → Sign In → mismatch → Recovery.
5. Cleanup: remove temporary scripts/data.

---

## Lessons from This Session (Concretized)

1) Route Scope Errors (login‑v5 404)
- Symptom: Express 404/ReferenceError for `challenges`.
- Root cause: Endpoint registered outside init function; `challenges` out of scope.
- Fix: Define/store routes strictly inside `initializeCyphrIdEndpoints(app)`.
- Heuristic: Always search for map definitions and enclosing scopes; never attach routes past the closing brace.

2) DB Pool Misuse (`pool.query is not a function`)
- Symptom: crashes on warmup/query.
- Root cause: importing a module export that isn’t an instance; misaligned API.
- Fix: Central `shared-db-pool.cjs`; `await getPool()`; pass live pool to endpoints.
- Heuristic: Inspect module exports and usage; confirm a working Pool instance before first query.

3) RDS Password / Secrets Drift
- Symptom: `password authentication failed` / `no pg_hba.conf entry ... no encryption`.
- Fix: Sync RDS master password to match AWS secret; enforce SSL via pg settings and psql test.
- Heuristic: Always verify `aws secretsmanager get-secret-value`, then psql with `PGSSLMODE=require`.

4) Fingerprint Semantics
- Requirement: fingerprint = SHA256(DER(SPKI(pub P‑256)))
- Pitfall: hashing raw ANSI X9.63 instead of DER(SPKI).
- Fix: Wrap raw pubkey in SPKI prefix; hash DER(SPKI). Export DER for transport to server.

5) Challenge Semantics
- Requirement: server returns challengeId + challenge; client sends challengeId back.
- Pitfall: client earlier sent `challenge` in body; server expected `challengeId`.
- Fix: Use `challengeId` consistently in login + recovery.

6) Shell/Quoting Hygiene
- Lessons: Use single quotes on remote SSH commands; multi‑line apply_patch carefully; avoid jq when not present; fall back to sed as needed.

7) Test Discipline
- Negative first: ensure proper rejections (invalid signatures, missing fields).
- Positive next: synthetic E2E with real keys, then device E2E.
- Always remove test artifacts (scripts, temp users) post‑success.

8) Face ID Prompt Reuse
- Symptom: double biometry prompts on app start + login.
- Fix: reuse authenticated LAContext when available, and request a new one only if absent.
- Guardrail: before any keychain‑gated operation in a flow, check cached context first.

9) Production Hardening (Cost/Noise)
- Need: protect `/api/cyphr-id/*` without extra infra/services.
- Fixes: per‑route rate limiting; minimal access logging (no request bodies); lightweight counters endpoint for quick SLO checks.
- Guardrail: never log request bodies under auth routes; metrics must exclude secrets and be O(1) storage.

---

## Canonical Prompts (Mental Macros)

PROMPT: v5.0 Alignment
- Extract endpoint payloads + error codes from spec.
- Confirm DB columns exist (add if needed).
- Client: update models, request/response types, challengeId usage.
- Server: implement verification (Ed25519 over challenge, P‑256 over challenge, SHA256(DER(SPKI(pub))).
- Validate: curl + synthetic E2E + device E2E.

PROMPT: Secure Enclave Binding
- Generate P‑256 without biometry flags.
- Export pubkey as DER(SPKI). Hash DER(SPKI) for fingerprint.
- Sign server challenge with P‑256 (ecdsa-sha256).

PROMPT: Recovery = Re‑bind
- INIT: { cyphrId, newDeviceBindingPublicKey|Hash } → recoveryChallenge, challengeId.
- CONFIRM: sign recoveryChallenge with Ed25519; server replaces binding.

PROMPT: Secrets & RDS
- Read secret via AWS SDK/CLI. If auth fails, reconcile RDS password with secret.
- Test psql with SSL; never log passwords.

---

## Continuous Improvement Hooks

- After each task, append:
  - What signals I used (files, logs, commands)
  - What went wrong and the root cause
  - The guardrail added to prevent recurrence
  - The test I added/ran to prove the fix
  - Update `codex_release_plan.md` (status boxes, dates, risks) to keep delivery path synchronized
  - Update `Codex_todo_next.md` (reflect remaining high‑leverage tasks for the next session)

---

## Session Update (2025‑09‑23)

Added: end‑to‑end v5.0 server flow; iOS contracts; DER(SPKI) + SHA256; secrets & RDS fix; synthetic E2E with removal. Encoded all pitfalls into this model as guardrails.
