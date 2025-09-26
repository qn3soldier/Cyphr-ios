# Test Status (Phase 0 critical)

Last Updated: 2025-09-15

BIP39
- Load from bundle (2048 words): PASS (simulator)
- SHA-256 integrity check: PASS (simulator)
- Fallback loader present: PASS (returns [] if misconfigured to surface issue)

Keychain & Biometry
- Store/retrieve non-UI item: PASS (simulator)
- Biometry-gated retrieve (LAContext prompt): PENDING (device)
- errSecInteractionNotAllowed handling with kSecUseAuthenticationContext: PENDING (device)
- Persistence across app restarts: PENDING (device)

Kyber / Messaging
- getKyberPrivateKey persists and reuses key: PASS (logic verified)
- MessagingService uses Keychain (no UserDefaults): PASS (code path)
- Hybrid decrypt path with persisted key: PENDING (end-to-end on device)

Auth Flow (for Day 3-4)
- Auto-login after Sign Up (isAuthenticated = true): PENDING
- JWT to Keychain storage + session restore: PENDING
- No double Face ID prompts (signLoginPayload): PENDING
