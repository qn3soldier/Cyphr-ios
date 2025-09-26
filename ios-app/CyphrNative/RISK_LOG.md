# Risk Log

Last Updated: 2025-09-15

Open Risks
- R-001: Biometry prompt behavior differs between simulator and device.
  - Impact: Medium — could block seamless auth.
  - Mitigation: Test on iPhone with Face ID; adjust LAContext reuse and localizedReason; add KeychainDiagnosticsView.
  - Owner: iOS Lead
  - Status: Testing pending (Day 2)

- R-002: Missing bundle resource bip39-english.txt on some targets.
  - Impact: High — recovery phrase generation fails.
  - Mitigation: Ensure Copy Bundle Resources includes file; add CI check for SHA-256 and word count.
  - Owner: iOS Lead
  - Status: Action required

Closed Risks
- None yet.
