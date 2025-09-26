# Changelog

All notable changes to this project will be documented in this file.

## [2025-09-15] Phase 0 — Week 1, Day 1
### Added
- EnterpriseKeychainService with biometry (Face ID/Touch ID), SecAccessControl, LAContext integration, and post-store verification.
- BIP39WordList safe fallback loader to avoid crashes when bundle resource is missing.

### Changed
- CyphrIdentity: 
  - getKyberPrivateKey now persists and retrieves Kyber private key from Keychain (biometry protected).
  - BIP39 loader with SHA-256 integrity check and 2048-word validation.
  - Unified Keychain access via EnterpriseKeychainService.
- MessagingService:
  - Replaced UserDefaults private key usage with Keychain-backed retrieval.

### Security
- Removed reliance on UserDefaults for any private key storage.
- Enforced kSecAttrAccessibleWhenUnlockedThisDeviceOnly and .biometryCurrentSet for sensitive items.

### Notes
- Ensure Resources/bip39-english.txt is included in Copy Bundle Resources for the app target.
