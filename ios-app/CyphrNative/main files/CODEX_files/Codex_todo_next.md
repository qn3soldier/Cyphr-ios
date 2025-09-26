# Codex TODO — Next Session (Living)

Last Updated: 2025‑09‑24
Owner: Codex (agent)
Scope: High‑leverage, executable checklist for the next work session.

Links
- Operating Model (how to work): codex_role)model.md
- Release Plan (2‑week blueprint): codex_release_plan.md
- Session Log (what changed): codex.md

Update Loop (Closed)
- After each sub‑task: update this file (checkboxes), codex.md (Session Log), codex_role)model.md (Lessons/Guardrails), codex_release_plan.md (statuses).

---

## P0 — Critical (do first)

1) UI Redesign (systemic)
- [ ] Add Theme.swift (tokens: colors/gradients/typography/shadows)
- [ ] Implement Glass components: GlassBar, GlassCard, GlassField, GlassDock
- [ ] Chats: remove header; glass search; empty state with brand logo; FAB/CTA
- [ ] Settings/Profile: convert sections to GlassCard; unify toggles/typography
- Links: CODEX_files/redesign.md

2) Auth/Recovery negative QA (device/on‑device)
- [ ] CHALLENGE_EXPIRED handling; malformed/expired signatures
- [ ] Offline/timeout paths; graceful messaging
- DoD: no unexpected alerts; clean fallbacks; logs minimal

3) Delete Account (server + client)
- [ ] Server endpoint: Ed25519(challenge) confirm; disable + scrub minimal metadata
- [ ] Client: wipe keys (Ed25519/Kyber/SE), clear ID; startup 404 → new device

4) Documentation refresh (truthful)
- [ ] Update: codex_overview.md, codex_release_plan.md, codex_role)model.md
- [ ] Update: CODEX_files/Codex_todo_next.md (this), codex.md (session log)
- [ ] Keep main specs intact; add Reality Check blocks only

---

## P1 — Important (polish)

5) App Store Compliance Pack
- [ ] Privacy Policy / Terms in Settings
- [ ] App Privacy form in App Store Connect
- [ ] Export crypto questionnaire (standard mass‑market)

6) Messaging PQ‑E2E (text) — after P0
- [ ] Kyber1024 + ChaCha20‑Poly1305 e2e; server stores ciphertext only
- [ ] Outbox/Retry/Offline idempotent flows

7) UI/UX polish
- [ ] Error banners, retry UX, message states consistent

---

## Notes (Session‑to‑Session)

- Keep this list short and actionable; everything else belongs in codex_release_plan.md.
- Ensure each checked item has a matching Session Log entry + guardrails entry.
