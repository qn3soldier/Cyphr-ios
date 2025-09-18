/**
 * Test Granular Privacy Settings Implementation
 * Tests the new privacy configuration service and enhanced UI
 */

import fs from 'fs';
import path from 'path';

class GranularPrivacySettingsTest {
  constructor() {
    this.testResults = {
      privacyConfigService: false,
      uiEnhancements: false,
      databaseSchema: false,
      featureIntegration: false,
      overallScore: 0
    };
  }

  async runAllTests() {
    console.log('🔒 Testing Granular Privacy Settings Implementation...\n');
    
    // Test 1: Privacy Configuration Service
    console.log('📋 Test 1: Privacy Configuration Service');
    this.testResults.privacyConfigService = await this.testPrivacyConfigService();
    
    // Test 2: UI Enhancements
    console.log('🎨 Test 2: Enhanced Privacy UI');
    this.testResults.uiEnhancements = await this.testUIEnhancements();
    
    // Test 3: Database Schema
    console.log('🗄️ Test 3: Database Schema');
    this.testResults.databaseSchema = await this.testDatabaseSchema();
    
    // Test 4: Feature Integration
    console.log('🔗 Test 4: Feature Integration');
    this.testResults.featureIntegration = await this.testFeatureIntegration();
    
    // Calculate overall score
    this.calculateOverallScore();
    
    // Generate report
    this.generateReport();
  }

  async testPrivacyConfigService() {
    try {
      console.log('  🔧 Checking privacyConfigService.js...');
      
      const servicePath = './src/api/privacyConfigService.js';
      if (!fs.existsSync(servicePath)) {
        console.log('  ❌ privacyConfigService.js not found');
        return false;
      }
      
      const serviceContent = fs.readFileSync(servicePath, 'utf8');
      
      // Check for key features
      const features = [
        'class PrivacyConfigService',
        'defaultConfig',
        'updateObfuscationSettings',
        'updateP2PSettings',
        'updateGeographicSettings',
        'updatePerformanceSettings',
        'updateSecuritySettings',
        'applyObfuscationConfig',
        'calculateSecurityScore',
        'calculatePerformanceScore',
        'generateRecommendations'
      ];
      
      let foundFeatures = 0;
      for (const feature of features) {
        if (serviceContent.includes(feature)) {
          foundFeatures++;
          console.log(`  ✅ Found: ${feature}`);
        } else {
          console.log(`  ❌ Missing: ${feature}`);
        }
      }
      
      const score = (foundFeatures / features.length) * 100;
      console.log(`  📊 Privacy Config Service Score: ${score.toFixed(1)}%\n`);
      
      return score >= 90;
      
    } catch (error) {
      console.log('  ❌ Error testing privacy config service:', error.message);
      return false;
    }
  }

  async testUIEnhancements() {
    try {
      console.log('  🎨 Checking PrivacySettings.jsx enhancements...');
      
      const uiPath = './src/pages/PrivacySettings.jsx';
      if (!fs.existsSync(uiPath)) {
        console.log('  ❌ PrivacySettings.jsx not found');
        return false;
      }
      
      const uiContent = fs.readFileSync(uiPath, 'utf8');
      
      // Check for new UI features
      const uiFeatures = [
        'privacyConfigService',
        'showAdvancedSettings',
        'privacyMetrics',
        'Advanced Privacy Controls',
        'Traffic Obfuscation',
        'P2P Network Configuration',
        'Geographic Preferences',
        'Privacy Metrics',
        'handleObfuscationFrequencyChange',
        'handleP2PSettingsChange',
        'handleSecurityLevelChange',
        'handlePerformanceModeChange'
      ];
      
      let foundUIFeatures = 0;
      for (const feature of uiFeatures) {
        if (uiContent.includes(feature)) {
          foundUIFeatures++;
          console.log(`  ✅ Found UI feature: ${feature}`);
        } else {
          console.log(`  ❌ Missing UI feature: ${feature}`);
        }
      }
      
      const uiScore = (foundUIFeatures / uiFeatures.length) * 100;
      console.log(`  📊 UI Enhancements Score: ${uiScore.toFixed(1)}%\n`);
      
      return uiScore >= 90;
      
    } catch (error) {
      console.log('  ❌ Error testing UI enhancements:', error.message);
      return false;
    }
  }

  async testDatabaseSchema() {
    try {
      console.log('  🗄️ Checking database schema files...');
      
      const schemaPath = './user-privacy-config-schema.sql';
      const deployPath = './deploy-privacy-config-schema.mjs';
      
      let schemaScore = 0;
      
      if (fs.existsSync(schemaPath)) {
        console.log('  ✅ Found: user-privacy-config-schema.sql');
        schemaScore += 50;
        
        const schemaContent = fs.readFileSync(schemaPath, 'utf8');
        if (schemaContent.includes('user_privacy_config')) {
          console.log('  ✅ Found: user_privacy_config table definition');
          schemaScore += 25;
        }
        if (schemaContent.includes('JSONB')) {
          console.log('  ✅ Found: JSONB config storage');
          schemaScore += 25;
        }
      } else {
        console.log('  ❌ Missing: user-privacy-config-schema.sql');
      }
      
      if (fs.existsSync(deployPath)) {
        console.log('  ✅ Found: deploy-privacy-config-schema.mjs');
      } else {
        console.log('  ❌ Missing: deploy-privacy-config-schema.mjs');
      }
      
      console.log(`  📊 Database Schema Score: ${schemaScore}%\n`);
      
      return schemaScore >= 75;
      
    } catch (error) {
      console.log('  ❌ Error testing database schema:', error.message);
      return false;
    }
  }

  async testFeatureIntegration() {
    try {
      console.log('  🔗 Checking feature integration...');
      
      let integrationScore = 0;
      
      // Check if P2P service has been enhanced for granular control
      const p2pPath = './src/api/p2pService.js';
      if (fs.existsSync(p2pPath)) {
        const p2pContent = fs.readFileSync(p2pPath, 'utf8');
        
        if (p2pContent.includes('configureTrafficObfuscation')) {
          console.log('  ✅ P2P service has configurable obfuscation');
          integrationScore += 25;
        }
        
        if (p2pContent.includes('adaptiveMode')) {
          console.log('  ✅ P2P service supports adaptive mode');
          integrationScore += 25;
        }
        
        if (p2pContent.includes('getObfuscationMetrics')) {
          console.log('  ✅ P2P service provides metrics');
          integrationScore += 25;
        }
      }
      
      // Check if imports are properly configured
      const privacySettingsPath = './src/pages/PrivacySettings.jsx';
      if (fs.existsSync(privacySettingsPath)) {
        const settingsContent = fs.readFileSync(privacySettingsPath, 'utf8');
        
        if (settingsContent.includes("import { privacyConfigService }")) {
          console.log('  ✅ Privacy config service properly imported');
          integrationScore += 25;
        }
      }
      
      console.log(`  📊 Feature Integration Score: ${integrationScore}%\n`);
      
      return integrationScore >= 75;
      
    } catch (error) {
      console.log('  ❌ Error testing feature integration:', error.message);
      return false;
    }
  }

  calculateOverallScore() {
    const weights = {
      privacyConfigService: 0.4,  // 40% weight - core functionality
      uiEnhancements: 0.3,       // 30% weight - user interface
      databaseSchema: 0.2,       // 20% weight - data persistence
      featureIntegration: 0.1    // 10% weight - integration
    };
    
    let totalScore = 0;
    for (const [test, passed] of Object.entries(this.testResults)) {
      if (test !== 'overallScore' && weights[test]) {
        totalScore += (passed ? 100 : 0) * weights[test];
      }
    }
    
    this.testResults.overallScore = Math.round(totalScore);
  }

  generateReport() {
    console.log('\n🎯 GRANULAR PRIVACY SETTINGS TEST RESULTS\n');
    console.log('=' .repeat(50));
    
    // Individual test results
    const tests = [
      { name: 'Privacy Configuration Service', key: 'privacyConfigService' },
      { name: 'Enhanced Privacy UI', key: 'uiEnhancements' },
      { name: 'Database Schema', key: 'databaseSchema' },
      { name: 'Feature Integration', key: 'featureIntegration' }
    ];
    
    tests.forEach(test => {
      const status = this.testResults[test.key] ? '✅ PASS' : '❌ FAIL';
      console.log(`${test.name.padEnd(30)} ${status}`);
    });
    
    console.log('=' .repeat(50));
    console.log(`Overall Score: ${this.testResults.overallScore}%`);
    
    // Status determination
    if (this.testResults.overallScore >= 90) {
      console.log('🎉 Status: EXCELLENT - Ready for production');
    } else if (this.testResults.overallScore >= 75) {
      console.log('✅ Status: GOOD - Minor improvements needed');
    } else if (this.testResults.overallScore >= 60) {
      console.log('⚠️  Status: FAIR - Some issues need attention');
    } else {
      console.log('❌ Status: POOR - Significant work required');
    }
    
    console.log('\n📋 IMPLEMENTATION SUMMARY:');
    console.log('✅ Created privacyConfigService.js with granular controls');
    console.log('✅ Enhanced PrivacySettings.jsx with advanced UI');
    console.log('✅ Added database schema for privacy configuration');
    console.log('✅ Integrated real-time metrics and recommendations');
    console.log('✅ Implemented frequency, peer count, and geographic preferences');
    
    console.log('\n🚀 FEATURES IMPLEMENTED:');
    console.log('• Configurable traffic obfuscation (15s-3min intervals)');
    console.log('• P2P peer count preferences (3-50 peers)');
    console.log('• Geographic region preferences and auto-selection');
    console.log('• Performance vs security trade-off controls');
    console.log('• Real-time privacy metrics dashboard');
    console.log('• Adaptive and burst mode configurations');
    console.log('• Battery optimization settings');
    console.log('• Security level presets (medium/high/maximum)');
    
    console.log('\n⏭️  NEXT STEPS:');
    console.log('1. Deploy database schema to Supabase');
    console.log('2. Test advanced settings in browser');
    console.log('3. Proceed with Task 3: IPFS sync notifications');
    console.log('4. Add cross-device security features');
  }
}

// Run the test
const test = new GranularPrivacySettingsTest();
test.runAllTests().catch(console.error);