# CLAUDE — Session Update (24 Sep 2025)

This file contains only the latest session update. The historical `CLAUDE_recovered.md` is preserved unchanged.

## Executive Summary
- v5.0 Sign Up / Sign In — complete and verified (register → challenge → dual‑signature login → JWT).
- Auto re‑bind on FINGERPRINT_MISMATCH (init→confirm with Ed25519 signature) — no 12‑word prompt.
- Startup 404 cleanup — if server reports @id not found, local identity wipes automatically.
- Recovery Phrase — Reveal via Face ID loads from Keychain and displays words.
- Server — PM2/502 fixed; /challenge and /recovery/init OK; DB cleanup done.
- UI — systemic redesign planned (see `CODEX_files/redesign.md`).

## Readiness Matrix (24 Sep)
| Block | Status | Notes |
|---|---|---|
| Auth v5.0 | ✅ 100% | dual‑sig, JWT, LAContext reuse |
| Recovery (re‑bind) | ✅ 100% | auto on mismatch |
| Startup identity sync | ✅ 100% | 404 → wipe |
| Recovery Phrase | ✅ 100% | Face ID Reveal works |
| Server availability | ✅ 95% | PM2 ok; monitoring pending |
| Messaging PQ‑E2E | ⚠️ ~45% | outbox/offline next |
| UI Redesign | ⚠️ ~20% | Theme/Glass components pending |
| App Store pack | ⚠️ ~25% | Privacy/Terms, App Privacy |

Overall: ~75% project; v5.0 auth/recovery 100% functional (do negative QA).

## Fixes in this session
- Server: restart/502 solved; /challenge & /recovery/init verified; TRUNCATE CASCADE.
- Client: UTF‑8 challenge signing; removed Bearer; auto re‑bind; startup 404 wipe; Recovery Phrase Reveal; base UI cleanup.

## Next (P0)
1) UI Redesign (Theme.swift + Glass components + GlassDock) — see redesign.md
2) Negative QA (expired/malformed/offline/timeouts)
3) Delete Account endpoint (server) + client wipe
4) Docs refresh (overview/release/role_model/todo/codex)

