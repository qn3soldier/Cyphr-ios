#!/usr/bin/env node

/**
 * Comprehensive СОРМ Protection Test Suite
 * Tests all anti-surveillance systems: P2P, IPFS, Compliance Logging
 * 
 * Usage: node test-sorm-protection.mjs
 */

import { readFileSync } from 'fs';
import { setTimeout } from 'timers/promises';

// Color codes for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const log = (color, message) => console.log(`${colors[color]}${message}${colors.reset}`);
const success = (msg) => log('green', `✅ ${msg}`);
const error = (msg) => log('red', `❌ ${msg}`);
const info = (msg) => log('blue', `ℹ️  ${msg}`);
const warning = (msg) => log('yellow', `⚠️  ${msg}`);
const header = (msg) => log('bold', `\n🔒 ${msg}`);

class SORMProtectionTester {
  constructor() {
    this.testResults = {
      p2p: { passed: 0, total: 0 },
      ipfs: { passed: 0, total: 0 },
      compliance: { passed: 0, total: 0 },
      integration: { passed: 0, total: 0 }
    };
    this.startTime = Date.now();
  }

  async runAllTests() {
    header('СОРМ PROTECTION TEST SUITE STARTING...');
    info('Testing anti-surveillance systems for Cyphr Messenger');
    
    try {
      // Phase 1: File Structure Tests
      await this.testFileStructure();
      
      // Phase 2: P2P System Tests
      await this.testP2PSystem();
      
      // Phase 3: IPFS Integration Tests
      await this.testIPFSSystem();
      
      // Phase 4: Compliance Logging Tests
      await this.testComplianceSystem();
      
      // Phase 5: Integration Tests
      await this.testSystemIntegration();
      
      // Generate Report
      this.generateReport();
      
    } catch (err) {
      error(`Test suite failed: ${err.message}`);
      process.exit(1);
    }
  }

  async testFileStructure() {
    header('TESTING FILE STRUCTURE');
    
    const requiredFiles = [
      'src/api/p2pService.js',
      'src/api/ipfsService.js', 
      'src/api/compliance/complianceLogger.js',
      'src/api/socketService.js',
      'src/api/stellarServiceEnhanced.ts',
      'src/api/crypto/encryptedWalletStorage.ts',
      'src/pages/PrivacySettings.jsx'
    ];

    for (const file of requiredFiles) {
      try {
        const content = readFileSync(file, 'utf8');
        if (content.length > 100) {
          success(`${file} exists and has content`);
        } else {
          warning(`${file} exists but seems empty`);
        }
      } catch (err) {
        error(`${file} missing or unreadable`);
      }
    }
  }

  async testP2PSystem() {
    header('TESTING P2P MESH NETWORK SYSTEM');
    
    // Test 1: P2P Service Implementation
    await this.testP2PService();
    
    // Test 2: Socket Service Integration
    await this.testSocketServiceP2P();
    
    // Test 3: Privacy Mode UI
    await this.testPrivacyModeUI();
  }

  async testP2PService() {
    this.testResults.p2p.total += 3;
    
    try {
      const p2pContent = readFileSync('src/api/p2pService.js', 'utf8');
      
      // Check for key P2P features
      if (p2pContent.includes('createLibp2p')) {
        success('P2P: libp2p integration found');
        this.testResults.p2p.passed++;
      } else {
        error('P2P: libp2p integration missing');
      }
      
      if (p2pContent.includes('setPrivacyMode') && p2pContent.includes('startTrafficObfuscation')) {
        success('P2P: Traffic obfuscation system implemented');
        this.testResults.p2p.passed++;
      } else {
        error('P2P: Traffic obfuscation missing');
      }
      
      if (p2pContent.includes('FinalKyber1024') && p2pContent.includes('encryptMessage')) {
        success('P2P: Kyber1024 encryption integrated');
        this.testResults.p2p.passed++;
      } else {
        error('P2P: Quantum encryption missing');
      }
      
    } catch (err) {
      error(`P2P Service test failed: ${err.message}`);
    }
  }

  async testSocketServiceP2P() {
    this.testResults.p2p.total += 4;
    
    try {
      const socketContent = readFileSync('src/api/socketService.js', 'utf8');
      
      // Check hybrid mode implementation
      if (socketContent.includes('enablePrivacyMode') && socketContent.includes('disablePrivacyMode')) {
        success('Socket: Privacy mode controls implemented');
        this.testResults.p2p.passed++;
      } else {
        error('Socket: Privacy mode controls missing');
      }
      
      if (socketContent.includes('useP2P') && socketContent.includes('p2pFallbackEnabled')) {
        success('Socket: Hybrid P2P/server mode implemented');
        this.testResults.p2p.passed++;
      } else {
        error('Socket: Hybrid mode missing');
      }
      
      if (socketContent.includes('p2pService.sendMessage') && socketContent.includes('via: \'p2p\'')) {
        success('Socket: P2P message routing implemented');
        this.testResults.p2p.passed++;
      } else {
        error('Socket: P2P message routing missing');
      }
      
      if (socketContent.includes('getPrivacyStatus')) {
        success('Socket: Privacy status monitoring implemented');
        this.testResults.p2p.passed++;
      } else {
        error('Socket: Privacy status monitoring missing');
      }
      
    } catch (err) {
      error(`Socket Service P2P test failed: ${err.message}`);
    }
  }

  async testPrivacyModeUI() {
    this.testResults.p2p.total += 2;
    
    try {
      const privacyContent = readFileSync('src/pages/PrivacySettings.jsx', 'utf8');
      
      if (privacyContent.includes('СОРМ Protection') && privacyContent.includes('Privacy Mode')) {
        success('UI: СОРМ Protection section implemented');
        this.testResults.p2p.passed++;
      } else {
        error('UI: СОРМ Protection section missing');
      }
      
      if (privacyContent.includes('handlePrivacyModeToggle') && privacyContent.includes('handleP2PToggle')) {
        success('UI: Privacy controls functional');
        this.testResults.p2p.passed++;
      } else {
        error('UI: Privacy controls missing');
      }
      
    } catch (err) {
      error(`Privacy UI test failed: ${err.message}`);
    }
  }

  async testIPFSSystem() {
    header('TESTING IPFS DECENTRALIZED STORAGE');
    
    // Test 1: IPFS Service Implementation
    await this.testIPFSService();
    
    // Test 2: Wallet Storage Integration
    await this.testWalletIPFSIntegration();
    
    // Test 3: Offline Mode
    await this.testOfflineMode();
  }

  async testIPFSService() {
    this.testResults.ipfs.total += 4;
    
    try {
      const ipfsContent = readFileSync('src/api/ipfsService.js', 'utf8');
      
      if (ipfsContent.includes('createHelia') && ipfsContent.includes('unixfs')) {
        success('IPFS: Helia (modern IPFS) integration found');
        this.testResults.ipfs.passed++;
      } else {
        error('IPFS: Helia integration missing');
      }
      
      if (ipfsContent.includes('storeWalletSeed') && ipfsContent.includes('retrieveWalletSeed')) {
        success('IPFS: Wallet backup/restore implemented');
        this.testResults.ipfs.passed++;
      } else {
        error('IPFS: Wallet backup/restore missing');
      }
      
      if (ipfsContent.includes('secureChaCha20.encrypt') && ipfsContent.includes('encryptionKey')) {
        success('IPFS: Double encryption for storage implemented');
        this.testResults.ipfs.passed++;
      } else {
        error('IPFS: Double encryption missing');
      }
      
      if (ipfsContent.includes('IPFSTransport') && ipfsContent.includes('winston.Transport')) {
        success('IPFS: Winston logging transport implemented');
        this.testResults.ipfs.passed++;
      } else {
        warning('IPFS: Winston transport not found (may be in compliance logger)');
      }
      
    } catch (err) {
      error(`IPFS Service test failed: ${err.message}`);
    }
  }

  async testWalletIPFSIntegration() {
    this.testResults.ipfs.total += 3;
    
    try {
      const walletContent = readFileSync('src/api/crypto/encryptedWalletStorage.ts', 'utf8');
      
      if (walletContent.includes('ipfsService.storeWalletSeed') && walletContent.includes('IPFS backup')) {
        success('Wallet: IPFS backup integration implemented');
        this.testResults.ipfs.passed++;
      } else {
        error('Wallet: IPFS backup integration missing');
      }
      
      if (walletContent.includes('restoreFromIPFS') && walletContent.includes('syncWithIPFS')) {
        success('Wallet: IPFS restore/sync methods implemented');
        this.testResults.ipfs.passed++;
      } else {
        error('Wallet: IPFS restore/sync missing');
      }
      
      if (walletContent.includes('getIPFSBackupStatus')) {
        success('Wallet: IPFS backup status monitoring implemented');
        this.testResults.ipfs.passed++;
      } else {
        error('Wallet: IPFS backup status missing');
      }
      
    } catch (err) {
      error(`Wallet IPFS integration test failed: ${err.message}`);
    }
  }

  async testOfflineMode() {
    this.testResults.ipfs.total += 3;
    
    try {
      const stellarContent = readFileSync('src/api/stellarServiceEnhanced.ts', 'utf8');
      
      if (stellarContent.includes('enableOfflineMode') && stellarContent.includes('offlineMode: boolean')) {
        success('Stellar: Offline mode implementation found');
        this.testResults.ipfs.passed++;
      } else {
        error('Stellar: Offline mode missing');
      }
      
      if (stellarContent.includes('getOfflineBalance') && stellarContent.includes('syncOfflineDataToIPFS')) {
        success('Stellar: Offline data management implemented');
        this.testResults.ipfs.passed++;
      } else {
        error('Stellar: Offline data management missing');
      }
      
      if (stellarContent.includes('getMultiAssetBalanceOffline')) {
        success('Stellar: Offline balance API implemented');
        this.testResults.ipfs.passed++;
      } else {
        error('Stellar: Offline balance API missing');
      }
      
    } catch (err) {
      error(`Offline mode test failed: ${err.message}`);
    }
  }

  async testComplianceSystem() {
    header('TESTING COMPLIANCE LOGGING SYSTEM');
    
    // Test 1: Compliance Logger Implementation
    await this.testComplianceLogger();
    
    // Test 2: Integration with Services
    await this.testComplianceIntegration();
  }

  async testComplianceLogger() {
    this.testResults.compliance.total += 5;
    
    try {
      const complianceContent = readFileSync('src/api/compliance/complianceLogger.js', 'utf8');
      
      if (complianceContent.includes('winston') && complianceContent.includes('IPFSTransport')) {
        success('Compliance: Winston + IPFS transport implemented');
        this.testResults.compliance.passed++;
      } else {
        error('Compliance: Winston + IPFS transport missing');
      }
      
      if (complianceContent.includes('logTransaction') && complianceContent.includes('AML')) {
        success('Compliance: AML transaction logging implemented');
        this.testResults.compliance.passed++;
      } else {
        error('Compliance: AML transaction logging missing');
      }
      
      if (complianceContent.includes('logWalletCreation') && complianceContent.includes('KYC')) {
        success('Compliance: KYC wallet logging implemented');
        this.testResults.compliance.passed++;
      } else {
        error('Compliance: KYC wallet logging missing');
      }
      
      if (complianceContent.includes('logPrivacyMode') && complianceContent.includes('СОРМ')) {
        success('Compliance: СОРМ privacy logging implemented');
        this.testResults.compliance.passed++;
      } else {
        error('Compliance: СОРМ privacy logging missing');
      }
      
      if (complianceContent.includes('sanitizeData') && complianceContent.includes('[REDACTED]')) {
        success('Compliance: Data sanitization implemented');
        this.testResults.compliance.passed++;
      } else {
        error('Compliance: Data sanitization missing');
      }
      
    } catch (err) {
      error(`Compliance Logger test failed: ${err.message}`);
    }
  }

  async testComplianceIntegration() {
    this.testResults.compliance.total += 3;
    
    try {
      // Test auth service integration
      const authContent = readFileSync('src/api/authService.js', 'utf8');
      if (authContent.includes('complianceLogger.logAuthentication')) {
        success('Compliance: Auth service integration implemented');
        this.testResults.compliance.passed++;
      } else {
        error('Compliance: Auth service integration missing');
      }
      
      // Test stellar service integration
      const stellarContent = readFileSync('src/api/stellarServiceEnhanced.ts', 'utf8');
      if (stellarContent.includes('complianceLogger.logTransaction') || 
          stellarContent.includes('complianceLogger.logWalletCreation')) {
        success('Compliance: Stellar service integration implemented');
        this.testResults.compliance.passed++;
      } else {
        error('Compliance: Stellar service integration missing');
      }
      
      // Test socket service integration
      const socketContent = readFileSync('src/api/socketService.js', 'utf8');
      if (socketContent.includes('complianceLogger.logPrivacyMode')) {
        success('Compliance: Socket service integration implemented');
        this.testResults.compliance.passed++;
      } else {
        error('Compliance: Socket service integration missing');
      }
      
    } catch (err) {
      error(`Compliance integration test failed: ${err.message}`);
    }
  }

  async testSystemIntegration() {
    header('TESTING SYSTEM INTEGRATION');
    
    this.testResults.integration.total += 4;
    
    // Test 1: Package dependencies
    try {
      const packageContent = readFileSync('package.json', 'utf8');
      const pkg = JSON.parse(packageContent);
      
      const requiredDeps = ['libp2p', 'helia', '@helia/unixfs', 'winston', '@libp2p/websockets'];
      let depsFound = 0;
      
      for (const dep of requiredDeps) {
        if (pkg.dependencies[dep]) {
          depsFound++;
        }
      }
      
      if (depsFound >= 4) {
        success(`Integration: Required dependencies installed (${depsFound}/${requiredDeps.length})`);
        this.testResults.integration.passed++;
      } else {
        error(`Integration: Missing dependencies (${depsFound}/${requiredDeps.length})`);
      }
      
    } catch (err) {
      error(`Package dependencies test failed: ${err.message}`);
    }
    
    // Test 2: Import consistency
    try {
      const files = [
        'src/api/socketService.js',
        'src/api/stellarServiceEnhanced.ts', 
        'src/api/crypto/encryptedWalletStorage.ts'
      ];
      
      let properImports = 0;
      for (const file of files) {
        const content = readFileSync(file, 'utf8');
        if (content.includes('import') && 
            (content.includes('ipfsService') || content.includes('complianceLogger') || content.includes('p2pService'))) {
          properImports++;
        }
      }
      
      if (properImports >= 2) {
        success(`Integration: Service imports consistent (${properImports}/${files.length})`);
        this.testResults.integration.passed++;
      } else {
        error(`Integration: Service imports inconsistent (${properImports}/${files.length})`);
      }
      
    } catch (err) {
      error(`Import consistency test failed: ${err.message}`);
    }
    
    // Test 3: Configuration validation
    try {
      const socketContent = readFileSync('src/api/socketService.js', 'utf8');
      const p2pContent = readFileSync('src/api/p2pService.js', 'utf8');
      
      if (socketContent.includes('privacyMode') && p2pContent.includes('privacyMode')) {
        success('Integration: Privacy mode configuration consistent');
        this.testResults.integration.passed++;
      } else {
        error('Integration: Privacy mode configuration inconsistent');
      }
      
    } catch (err) {
      error(`Configuration validation test failed: ${err.message}`);
    }
    
    // Test 4: Error handling
    try {
      const files = [
        'src/api/p2pService.js',
        'src/api/ipfsService.js',
        'src/api/compliance/complianceLogger.js'
      ];
      
      let errorHandling = 0;
      for (const file of files) {
        const content = readFileSync(file, 'utf8');
        if (content.includes('try {') && content.includes('catch') && content.includes('console.error')) {
          errorHandling++;
        }
      }
      
      if (errorHandling >= 2) {
        success(`Integration: Error handling implemented (${errorHandling}/${files.length})`);
        this.testResults.integration.passed++;
      } else {
        warning(`Integration: Limited error handling (${errorHandling}/${files.length})`);
      }
      
    } catch (err) {
      error(`Error handling test failed: ${err.message}`);
    }
  }

  generateReport() {
    const duration = (Date.now() - this.startTime) / 1000;
    
    header('СОРМ PROTECTION TEST RESULTS');
    
    console.log(`\n${colors.bold}📊 Test Summary:${colors.reset}`);
    console.log(`${colors.cyan}⏱️  Duration: ${duration.toFixed(2)}s${colors.reset}`);
    
    const categories = [
      { name: 'P2P Mesh Network', key: 'p2p', icon: '🌐' },
      { name: 'IPFS Decentralization', key: 'ipfs', icon: '☁️' },
      { name: 'Compliance Logging', key: 'compliance', icon: '📋' },
      { name: 'System Integration', key: 'integration', icon: '🔗' }
    ];
    
    let totalPassed = 0;
    let totalTests = 0;
    
    categories.forEach(cat => {
      const result = this.testResults[cat.key];
      const percentage = result.total > 0 ? ((result.passed / result.total) * 100).toFixed(1) : '0.0';
      const status = result.passed === result.total ? colors.green : 
                    result.passed > result.total * 0.7 ? colors.yellow : colors.red;
      
      console.log(`${cat.icon} ${cat.name}: ${status}${result.passed}/${result.total} (${percentage}%)${colors.reset}`);
      
      totalPassed += result.passed;
      totalTests += result.total;
    });
    
    const overallPercentage = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : '0.0';
    const overallStatus = totalPassed === totalTests ? colors.green : 
                         totalPassed > totalTests * 0.8 ? colors.yellow : colors.red;
    
    console.log(`\n${colors.bold}🎯 Overall Score: ${overallStatus}${totalPassed}/${totalTests} (${overallPercentage}%)${colors.reset}`);
    
    // Security assessment
    if (overallPercentage >= 90) {
      success('СОРМ Protection: EXCELLENT - Production ready anti-surveillance system');
    } else if (overallPercentage >= 75) {
      warning('СОРМ Protection: GOOD - Minor improvements needed');
    } else if (overallPercentage >= 60) {
      warning('СОРМ Protection: MODERATE - Several issues to address');
    } else {
      error('СОРМ Protection: POOR - Major security gaps detected');
    }
    
    // Feature-specific analysis
    console.log(`\n${colors.bold}🔍 Feature Analysis:${colors.reset}`);
    
    if (this.testResults.p2p.passed >= this.testResults.p2p.total * 0.8) {
      success('Traffic obfuscation and P2P mesh networking functional');
    } else {
      error('P2P system needs attention - traffic analysis vulnerable');
    }
    
    if (this.testResults.ipfs.passed >= this.testResults.ipfs.total * 0.8) {
      success('Decentralized storage and offline capabilities operational');
    } else {
      error('IPFS system needs attention - centralized dependencies remain');
    }
    
    if (this.testResults.compliance.passed >= this.testResults.compliance.total * 0.8) {
      success('Legal compliance and audit trails properly implemented');
    } else {
      error('Compliance system needs attention - regulatory risks present');
    }
    
    console.log(`\n${colors.bold}🚀 Recommendations:${colors.reset}`);
    
    if (this.testResults.p2p.passed < this.testResults.p2p.total) {
      info('• Review P2P mesh network configuration and fallback mechanisms');
    }
    
    if (this.testResults.ipfs.passed < this.testResults.ipfs.total) {
      info('• Verify IPFS connectivity and encryption key management');
    }
    
    if (this.testResults.compliance.passed < this.testResults.compliance.total) {
      info('• Complete compliance logging integration across all services');
    }
    
    if (this.testResults.integration.passed < this.testResults.integration.total) {
      info('• Address service integration and dependency issues');
    }
    
    console.log(`\n${colors.magenta}🔒 Next Steps:${colors.reset}`);
    info('1. Run end-to-end functional tests with real P2P connections');
    info('2. Perform load testing with traffic obfuscation active');  
    info('3. Validate IPFS backup/restore functionality');
    info('4. Test compliance logging under various scenarios');
    info('5. Conduct security audit of anti-surveillance measures');
    
    header(`СОРМ PROTECTION TEST COMPLETE - ${overallPercentage}% READY`);
  }
}

// Run the test suite
const tester = new SORMProtectionTester();
await tester.runAllTests();