# Architecture Decision Records (ADR)

## ADR-001: Keychain accessibility and biometry policy
Date: 2025-09-15
Context:
- Sensitive items (private keys, recovery phrase) must never leave device and must be protected by biometry.
Decision:
- Use kSecAttrAccessibleWhenUnlockedThisDeviceOnly.
- Use SecAccessControlCreateWithFlags(..., .biometryCurrentSet) for biometry-protected items.
- Integrate LAContext via kSecUseAuthenticationContext and allow UI only when needed.
Consequences:
- Items are non-migratable and require device auth. Biometry changes invalidate access (expected).

## ADR-002: BIP39 word list source and integrity
Date: 2025-09-15
Context:
- Recovery phrase generation requires exact 2048-word list and integrity verification.
Decision:
- Primary: load bip39-english.txt from app bundle.
- Verify SHA-256 against known upstream hash (2f5eed53a4...dbda).
- Provide safe fallback loader (BIP39WordList) to avoid crashes; fallback returns [] if misconfigured to surface the issue in tests.
Consequences:
- Build must include resource; CI can verify integrity and count.

## ADR-003: Kyber private key persistence
Date: 2025-09-15
Context:
- Decapsulation requires stable private key; generating new key per call breaks decryption.
Decision:
- Persist Kyber private key in Keychain under "kyber_private_key" with biometry protection.
- Cache public key and keyId in UserDefaults (non-sensitive).
Consequences:
- Stable decryption across sessions; Face ID prompts occur on access (expected).
