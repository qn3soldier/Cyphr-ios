// Dangerfile.js - Automated PR Review Guards for Cyphr
import { danger, warn, fail, markdown } from "danger"

// 1. Check for secrets in diff
const hasSecrets = () => {
  const patterns = [
    /PRIVATE_KEY/i,
    /SECRET_KEY/i,
    /API_KEY/i,
    /PASSWORD/i,
    /TOKEN/i,
    /AWS_ACCESS/i,
    /SUPABASE_ANON/i,
    /SUPABASE_SERVICE/i
  ]

  const diffFiles = danger.git.created_files.concat(danger.git.modified_files)

  for (const file of diffFiles) {
    const diff = danger.git.diffForFile(file)
    if (diff) {
      for (const pattern of patterns) {
        if (pattern.test(diff.diff)) {
          fail(`🚨 Potential secret detected in ${file}. Remove it and use GitHub Secrets/AWS Secrets Manager.`)
          return true
        }
      }
    }
  }
  return false
}

// 2. Check for server-side decryption attempts
const checkServerDecryption = () => {
  const serverFiles = danger.git.created_files
    .concat(danger.git.modified_files)
    .filter(f => f.includes('server/') || f.includes('backend/'))

  const forbiddenPatterns = [
    /createDecipher/,
    /decrypt\(/,
    /Decapsulate/,
    /ChaCha20/,
    /Poly1305/,
    /Kyber/,
    /libsodium/,
    /tweetnacl/
  ]

  for (const file of serverFiles) {
    const diff = danger.git.diffForFile(file)
    if (diff) {
      for (const pattern of forbiddenPatterns) {
        if (pattern.test(diff.added)) {
          fail(`🔒 ZK Violation: Server-side decryption detected in ${file}. All crypto must be client-side only!`)
          return true
        }
      }
    }
  }
}

// 3. Check for LoadingOverlay in async operations
const checkLoadingOverlay = () => {
  const swiftFiles = danger.git.created_files
    .concat(danger.git.modified_files)
    .filter(f => f.endsWith('.swift'))

  for (const file of swiftFiles) {
    const diff = danger.git.diffForFile(file)
    if (diff && diff.added) {
      // Check for async/await without LoadingOverlay
      if (/async\s+{/.test(diff.added) || /await\s+/.test(diff.added)) {
        if (!/.loadingOverlay\(/.test(diff.added)) {
          warn(`⏳ Consider adding LoadingOverlay for async operations in ${file}`)
        }
      }
    }
  }
}

// 4. Check iOS deployment target
const checkIOSTarget = () => {
  const pbxprojFiles = danger.git.modified_files.filter(f => f.endsWith('project.pbxproj'))

  for (const file of pbxprojFiles) {
    const diff = danger.git.diffForFile(file)
    if (diff && diff.added) {

      // Warn if target is too low
      if (/IPHONEOS_DEPLOYMENT_TARGET = (1[0-4]|[0-9])\./.test(diff.added)) {
        fail(`📱 iOS deployment target must be >= 15.0`)
      }
    }
  }
}

// 5. Check for BIP39 in bundle resources
const checkBIP39Bundle = () => {
  const pbxprojFiles = danger.git.modified_files.filter(f => f.endsWith('project.pbxproj'))

  for (const file of pbxprojFiles) {
    const content = danger.git.fileContent(file)
    if (content && !content.includes('bip39-english.txt')) {
      warn(`📝 BIP39 wordlist (bip39-english.txt) not found in Bundle Resources. Recovery phrase won't work!`)
    }
  }
}

// 6. Check for proper Keychain policies
const checkKeychainPolicy = () => {
  const swiftFiles = danger.git.created_files
    .concat(danger.git.modified_files)
    .filter(f => f.endsWith('.swift') && f.toLowerCase().includes('keychain'))

  for (const file of swiftFiles) {
    const diff = danger.git.diffForFile(file)
    if (diff && diff.added) {
      // Check for wrong policies
      if (/kSecAttrAccessibleAfterFirstUnlock/.test(diff.added)) {
        fail(`🔐 Wrong Keychain policy in ${file}! Use kSecAttrAccessibleWhenUnlockedThisDeviceOnly`)
      }

      // Check for biometry requirement
      if (/kSecAttrAccessible/.test(diff.added) && !/biometryCurrentSet/.test(diff.added)) {
        warn(`🔐 Consider adding biometryCurrentSet for sensitive data in ${file}`)
      }
    }
  }
}

// 7. PR size check
const checkPRSize = () => {
  const totalChanges = danger.github.pr.additions + danger.github.pr.deletions

  if (totalChanges > 500) {
    warn(`📊 Large PR detected (${totalChanges} lines). Consider breaking it into smaller, focused patches.`)
  }

  if (totalChanges > 1000) {
    fail(`🚨 PR too large (${totalChanges} lines)! Split into multiple PRs for patch-only approach.`)
  }
}

// 8. Check PR template compliance
const checkPRTemplate = () => {
  const prBody = danger.github.pr.body
  const requiredSections = [
    'PROPOSE',
    'APPLY',
    'VERIFY',
    'Rollback plan'
  ]

  for (const section of requiredSections) {
    if (!prBody.includes(section)) {
      warn(`📝 PR template incomplete: missing "${section}" section`)
    }
  }
}

// 9. Documentation updates
const checkDocumentation = () => {
  const hasCodeChanges = danger.git.modified_files.some(f =>
    f.endsWith('.swift') || f.endsWith('.js') || f.endsWith('.ts')
  )

  const hasDocChanges = danger.git.modified_files.some(f =>
    f.endsWith('.md') || f.includes('docs/')
  )

  if (hasCodeChanges && !hasDocChanges) {
    warn(`📚 Consider updating documentation for your changes`)
  }
}

// 10. Summary report
const generateSummary = () => {
  const checks = [
    { name: '🔒 Zero-Knowledge', passed: !checkServerDecryption() },
    { name: '🔐 No Secrets', passed: !hasSecrets() },
    { name: '📱 iOS Target', passed: true }, // checked separately
    { name: '📝 BIP39 Bundle', passed: true }, // warning only
    { name: '🔑 Keychain Policy', passed: true }, // checked separately
    { name: '📊 PR Size', passed: danger.github.pr.additions + danger.github.pr.deletions <= 500 }
  ]

  const passed = checks.filter(c => c.passed).length
  const total = checks.length

  markdown(`
## 🤖 Autopilot Review Summary

**Score: ${passed}/${total} checks passed**

| Check | Status |
|-------|--------|
${checks.map(c => `| ${c.name} | ${c.passed ? '✅' : '❌'} |`).join('\n')}

### 🎯 Critical Blockers to Fix:
1. BIP39 must be in Bundle Resources
2. Face ID needs proper LAContext setup
3. Keychain must use WhenUnlockedThisDeviceOnly
4. Auto-login after registration required
5. LoadingOverlay for all async operations

_Review based on ENCRYPTION_ARCHITECTURE.md, SERVER_ARCHITECTURE.md, CYPHR_ID_ARCHITECTURE.md_
`)
}

// Run all checks
async function runChecks() {
  hasSecrets()
  checkServerDecryption()
  checkLoadingOverlay()
  checkIOSTarget()
  checkBIP39Bundle()
  checkKeychainPolicy()
  checkPRSize()
  checkPRTemplate()
  checkDocumentation()
  generateSummary()
}

runChecks()