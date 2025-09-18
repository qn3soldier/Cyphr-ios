# 📋 CYPHR MESSENGER - EXECUTION LOG
Started: 15 сентября 2025
Phase: 0 - Foundation Fixes
Current: Week 1

---

## Day 1 — BIP39 & Keychain Infrastructure
Status: ✅ Completed (core scaffolding), ▶️ Ongoing (device tests)

Work Summary:
- Added production-grade Keychain service with biometry and proper SecAccessControl
- Implemented safe BIP39 fallback loader to prevent crashes if bundle resource missing
- Fixed Kyber private key persistence (no more per-call regeneration)
- Eliminated UserDefaults usage for private keys in MessagingService (moved to Keychain)
- Prepared code paths for Face ID prompts with localizedReason and LAContext reuse

Changes:
- Added: EnterpriseKeychainService.swift
  - kSecAttrAccessibleWhenUnlockedThisDeviceOnly
  - SecAccessControl(.biometryCurrentSet)
  - LAContext integration (kSecUseAuthenticationContext/UI)
  - Verification after store()
- Added: BIP39WordList.swift (safe fallback)
  - Primary: load from bundled bip39-english.txt with SHA-256 integrity check
  - Fallback: loader attempts; returns [] if misconfigured to surface issue in tests
- Updated: CyphrIdentity.swift
  - getKyberPrivateKey(): now reads from Keychain; if missing, generates Kyber1024 pair, stores private key (Face ID protected) and caches public key/keyId
  - Replaced legacy KeychainService usage with EnterpriseKeychainService
  - BIP39 loader with expected SHA-256 (2f5eed53...dbda) and 2048-words validation
  - Kept legacy KeychainService wrapper for compatibility
- Updated: MessagingService.swift
  - getStoredPrivateKey() removed; decryptMessage now retrieves kyber_private_key from Keychain (with UI)
  - No sensitive keys in UserDefaults

Build/Config:
- ACTION REQUIRED: Ensure Resources/bip39-english.txt is in Target → Build Phases → Copy Bundle Resources
- Encoding: UTF-8 (LF), 2048 lines, no BOM

Testing (initial):
- BIP39 loader: PASS on simulator with bundled file (2048 words, SHA-256 match)
- Fallback path: Loads via BIP39WordList; returns [] if resource missing (intended to surface config issue)
- Keychain store/retrieve (non-UI): PASS
- Biometry-gated retrieve: Requires device test (pending)

Open Items / Next Actions (Day 2):
- Device test: Face ID prompt flows (Sign In / Auto-Login / Kyber key access)
- Add KeychainDiagnosticsView for manual verification (list items, access policies, last status)
- Integrate LoadingOverlay into identity + messaging critical async ops
- Confirm bip39-english.txt included in Copy Bundle Resources on all targets

Blockers:
- None in code. Physical device test required to validate LAContext prompts and errSecInteractionNotAllowed handling.

Links:
- ADRs: see DECISIONS.md (ADR-001..003)
- CHANGELOG: see CHANGELOG.md
- Test matrix: see TEST_STATUS.md
- Risks: see RISK_LOG.md
