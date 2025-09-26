# Cyphr Messenger — Release Plan (MVP for App Store)

Version: 1.0 (Living Document)
Owner: Codex (agent) + Daniil (PM/Founder)
Last Updated: 2025‑09‑24 (Reality Check applied)
Scope: Deliver a production‑ready, App Store‑approved MVP messenger in ~2 weeks (wallet disabled)

Important: This plan is tightly integrated with two sister documents and must be kept in lock‑step:
- codex_role)model.md — Operating Model (how we think/plan/execute/verify/learn)
- codex.md — Session Log (what changed, where, how it was tested)

Update Loop (Closed): After each completed sub‑task,
1) Update codex.md (Session Log Entry)
2) Update codex_role)model.md (Lessons → Guardrails)
3) Update Codex_todo_next.md (short actionable list)
4) Update this file (checkboxes, statuses, risks, dates)

Wallet Policy for MVP: Wallet is present in code but disabled via feature flag and hidden in UI/metadata. App Store scope: secure messenger only.

---

## 0) Goals & Non‑Negotiables

Goals
- Submit and pass App Store review for an E2E messenger MVP (no wallet), with superior reliability, privacy, and UX.
- Ship a production‑hardened Cyphr ID v5.0: Sign Up, Challenge‑Login (dual signatures), Recovery (re‑bind).
- Ensure basic real‑time messaging with robust retries/offline support and media encryption.

Non‑Negotiables
- Zero‑knowledge server; no secrets, mnemonics, or private keys leave device.
- Device binding v2 (P‑256 SE; fingerprint = SHA256(DER(SPKI(pub)))).
- Single‑Key Recovery (12 words, Ed25519 for login+recovery).
- Challenge–response on login and recovery (server nonce, single‑use, TTL).
- App Store compliance: Account Deletion, Privacy Policy/Terms, usage descriptions, export crypto compliance.

Out of Scope for MVP
- Wallet (disabled in UI, code behind feature flag).
- Advanced group features, push‑to‑talk, complex presence.

---

## 1) Timeline (2 Weeks)

Reality Check re‑ordering
- W1 D1–D2: UI Redesign (Theme tokens + Glass components + Chats/Settings/Profile base)
- W1 D3: Auth/Recovery negative QA; startup/edge flows
- W1 D4: Delete Account (server+client) + docs/strings
- W1 D5: Messaging Outbox/Retry/Offline framework
- W2 D1–D2: Messaging PQ‑E2E + Media encryption (images)
- W2 D3: App Store assets (screenshots, privacy forms)
- W2 D4–D5: TestFlight internal + bugfix + submission package

Milestones
- M1 (end of Week 1): Messaging + media working e2e; outbox/ retry stable.
- M2 (end of Week 2): App Store submission (no wallet), with all compliance gates.

---

## 2) Workstreams (Tasks, DoD, Checks)

2.1 Cyphr ID v5.0 (On‑device E2E)
- Tasks
  - Run on‑device: Sign Up → Login dual → FINGERPRINT_MISMATCH → Recovery → Login.
  - Verify Face ID prompt appears only once across flows (LAContext reuse).
- DoD
  - ChallengeId used consistently; dual signatures validated by server; recovery replaces binding.
  - One biometry prompt on cold start/login; no legacy fingerprint paths.
- Status: Functional (100%). Next = negative QA (expired/malformed/offline).

2.2 Messaging PQ‑E2E
- Tasks
  - Implement encrypt/decrypt with Kyber1024 KEM + ChaCha20‑Poly1305 AEAD on device.
  - Ensure server stores ciphertext only; metadata minimal.
- DoD
  - Two devices exchange messages E2E; large sequences (100+) pass without corruption.
- Checks
  - Manual two‑device test; negative tests (wrong key, tampered payload) reject.

2.3 Outbox + Retry + Offline
- Tasks
  - Persistent outbox with exponential backoff; idempotent server acceptance (messageId).
  - Offline capture; auto‑flush on reconnect.
- DoD
  - No message loss/duplication under toggling airplane mode and app restarts.
- Checks
  - Test script/steps; visual delivery states (sending/sent/failed/retry).

2.4 Media (Images) Encryption
- Tasks
  - Client‑side encryption before upload (same hybrid scheme); secure download/decrypt.
  - Reasonable limits on size/types for MVP.
- DoD
  - Encrypted upload/download works on both ends; placeholder UI for progress/preview.
- Checks
  - Manual transfer, poor network tests, resume behavior.

2.5 Socket.IO Resiliency
- Tasks
  - Backoff strategy; auth on connect; reconnect flow; late join of rooms.
- DoD
  - Sustained connection through network changes; messages do not get lost (covered by outbox/idempotency).
- Checks
  - dev tools/logs; toggling Wi‑Fi/LTE.

2.6 Account Deletion & Privacy
- Tasks
  - In‑app “Delete Account” (server: Ed25519(challenge) confirm; disables user; scrubs minimal metadata).
  - Privacy Policy & Terms links in app settings; “About encryption” info.
- DoD
  - Deletion flow present and functional per Apple guideline.
  - Privacy nutrition labels truthful.
- Checks
  - Manual run; server logs; QA doc.

2.7 Onboarding & Permissions
- Tasks
  - Clean onboarding path; permissions with clear rationale; error banners.
  - Ensure Face ID/Camera/Microphone/Photo Library strings are present and meaningful.
- DoD
  - No missing permission strings; no unexpected prompts.
- Checks
  - On new device/simulator runs; screenshot review.

2.8 App Store Compliance
- Tasks
  - App Privacy: data types; encryption usage; no tracking unless needed.
  - Export compliance: standard encryption used; no special filing; answer crypto questionnaire.
  - Metadata: exclude wallet; describe messenger accurately.
- DoD
  - All forms answered; screenshots reflect product; submission passes automated checks.
- Checks
  - Pre‑submission checklist (see Section 5).

2.9 Production Hardening
- Tasks
  - Rate limiting /api/cyphr-id/* (done); add minimal counters for /api/messaging/* if needed.
  - Minimal logs; no request bodies; zero secrets in logs.
- DoD
  - /api/cyphr-id/_stats stable; no spikes; no body logs.
- Checks
  - curl /api/*/_stats; PM2 logs; resource usage.

---

## 3) Feature Flags & Build Settings

- Wallet disabled
  - Swift flag: `WALLET_ENABLED=0` (exclude wallet views/routes via `#if WALLET_ENABLED`).
  - Hide wallet tab/navigation; remove mentions from strings/screenshots/metadata.

- Info.plist (usage descriptions)
  - NSCameraUsageDescription, NSMicrophoneUsageDescription, NSPhotoLibrary(Add)UsageDescription, NSFaceIDUsageDescription — clear user‑facing rationale.

- Export Compliance
  - “Uses encryption: Yes” (standard, mass‑market); no custom algorithms; no dual‑use beyond standard messaging security.

---

## 4) Test Plan (Manual + Targeted Automation)

Manual (critical paths)
- Cyphr ID: full on‑device flow; Face ID one prompt.
- Messaging: 2 devices, 100+ messages, offline toggles, app restarts.
- Media: send/receive images; slow network; background/foreground.
- Account deletion: create → delete → ensure login fails; recreate fresh.

Targeted “scripts” (lightweight)
- Server sanity: `/api/*/_stats` deltas after scripted bursts.
- Local harness for outbox retry (toggle connectivity via OS tools).

---

## 5) App Store Submission Checklist

Metadata & Assets
- [ ] App name, subtitle, keywords — без wallet/crypto‑кошелёк терминов.
- [ ] Screenshots (iPhone 6.5/5.5); не демонстрируют кошелёк.
- [ ] Description — Messenger, E2E encryption, privacy, no payments.

Policies
- [ ] Privacy Policy URL + Terms URL.
- [ ] App Privacy form (data types): minimal; no tracking; E2E content not collected.
- [ ] Account Deletion flow (в приложении) — описан и продемонстрирован.

Encryption/Export
- [ ] “Uses encryption: Yes”; “Standard algorithms (Apple CryptoKit/ChaCha20‑Poly1305)”; mass‑market exemption.

Technical
- [ ] No crashes on cold start/login/offline scenarios.
- [ ] Permissions prompts have clear rationale.
- [ ] Wallet feature is disabled (no UI, no references).

Review Notes (optional)
- [ ] Кратко объяснить E2E шифрование, отсутствие кошелька, возможность удаления аккаунта.

---

## 6) Risks & Mitigations

- Wallet content detected by reviewer
  - Mitigation: feature flag + no UI + no metadata; PRD screenshot review.

- Messaging reliability under poor networks
  - Mitigation: outbox + retry + idempotency; Socket.IO reconnect strategy.

- Unexpected prompts & privacy labels
  - Mitigation: run through all permission flows on a clean device; re‑validate labels in App Store Connect.

- Server cost spikes
  - Mitigation: rate limits, minimal logs, periodic PM2/resource checks; turn off unused daemons.

---

## 7) Rollback & Monitoring

- Rollback
  - PM2 restart to previous artifact; preserve DB schema (non‑destructive changes only).
  - Feature flags to disable risky paths.

- Monitoring (lightweight)
  - `/api/cyphr-id/_stats` (ok/4xx/5xx); consider adding `/api/messaging/_stats`.
  - PM2 logs; resource usage snapshots.

---

## 8) Ownership & Communication

- Ownership
  - iOS: Codex (agent) + Daniil for product sign‑off
  - Server: Codex (agent)
  - Submission: Daniil (account owner), Codex prepares artifacts/checklists

- Communication
  - codex.md — Session entries per task (before/after commands/changes/tests)
  - codex_role)model.md — Lessons/Guardrails appended per risk/fix
  - This plan — status boxes + dates per workstream

---

## 9) Status Tracker (Living)

Core
- [x] Cyphr ID v5.0 server endpoints (prod)
- [x] iOS v5.0 contracts (register/login/recovery) + DER/SPKI
- [ ] On‑device E2E (to run & log)

Messaging
- [ ] PQ‑E2E send/receive
- [ ] Outbox/Retry/Idempotency
- [ ] Media (images) encryption

Compliance
- [ ] Account Deletion flow (client+server)
- [ ] Privacy/Terms links in app
- [ ] App Privacy form in ASC
- [ ] Export crypto questionnaire

Submission
- [ ] Screenshots (no wallet)
- [ ] Metadata final
- [ ] TestFlight internal pass
- [ ] Submit for review

---

## 10) Appendix — Artifact Index

- Operating Model: codex_role)model.md
- Session Log: codex.md
- Release Plan: this file
- Server endpoints: /var/www/cyphr/cyphr-id-rds-endpoints.cjs, /var/www/cyphr/server.cjs
- iOS: NetworkService.swift, AuthenticationService.swift, SecureEnclaveService.swift, MessagingService.swift
