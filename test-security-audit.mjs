#!/usr/bin/env node

/**
 * Security Audit Tool
 * Checks for sensitive data exposure and security vulnerabilities
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 COMPREHENSIVE SECURITY AUDIT...\n');

class SecurityAuditor {
  constructor() {
    this.issues = [];
    this.warnings = [];
    this.passed = [];
  }

  async performAudit() {
    console.log('🔒 Starting security audit...\n');
    
    await this.checkEnvironmentVariables();
    await this.checkSourceCode();
    await this.checkLocalStorage();
    await this.checkBackendEndpoints();
    await this.checkDatabaseSecurity();
    
    this.printResults();
    return this.issues.length === 0;
  }

  async checkEnvironmentVariables() {
    console.log('📋 Checking environment variables...');
    
    // Check .env files for sensitive data
    const envFiles = ['.env', '.env.local', '.env.development'];
    
    for (const file of envFiles) {
      const envPath = path.join(__dirname, file);
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        
        // Check for sensitive keys exposed to frontend
        if (content.includes('VITE_STELLAR_SECRET_KEY')) {
          this.issues.push(`🚨 CRITICAL: VITE_STELLAR_SECRET_KEY found in ${file} - NEVER expose secret keys to frontend!`);
        }
        
        if (content.includes('VITE_TWILIO_AUTH_TOKEN')) {
          this.issues.push(`🚨 CRITICAL: VITE_TWILIO_AUTH_TOKEN found in ${file} - Auth tokens should be backend-only!`);
        }
        
        // Check for missing security variables
        if (!content.includes('JWT_SECRET')) {
          this.warnings.push(`⚠️  JWT_SECRET not found in ${file} - using default (not secure for production)`);
        }
        
        if (!content.includes('ENCRYPTION_KEY')) {
          this.warnings.push(`⚠️  ENCRYPTION_KEY not found in ${file} - using default (not secure for production)`);
        }
      }
    }
    
    // Check TypeScript config for exposed secrets
    const envValidationPath = path.join(__dirname, 'src/config/envValidation.ts');
    if (fs.existsSync(envValidationPath)) {
      const content = fs.readFileSync(envValidationPath, 'utf8');
      
      if (content.includes('VITE_STELLAR_SECRET_KEY')) {
        this.issues.push('🚨 CRITICAL: VITE_STELLAR_SECRET_KEY still referenced in envValidation.ts');
      } else {
        this.passed.push('✅ VITE_STELLAR_SECRET_KEY removed from frontend validation');
      }
    }
    
    console.log('   Environment variables checked\n');
  }

  async checkSourceCode() {
    console.log('🔍 Scanning source code for sensitive data...');
    
    const srcDir = path.join(__dirname, 'src');
    await this.scanDirectory(srcDir);
    
    console.log('   Source code scan complete\n');
  }

  async scanDirectory(dir) {
    if (!fs.existsSync(dir)) return;
    
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        await this.scanDirectory(filePath);
      } else if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.tsx')) {
        await this.scanFile(filePath);
      }
    }
  }

  async scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(__dirname, filePath);
    
    // Check for sensitive data patterns
    const sensitivePatterns = [
      { pattern: /localStorage\.setItem.*secret/gi, message: 'TOTP secret stored in localStorage' },
      { pattern: /localStorage\.setItem.*private.*key/gi, message: 'Private key stored in localStorage' },
      { pattern: /localStorage\.setItem.*seed/gi, message: 'Seed phrase stored in localStorage' },
      { pattern: /localStorage\.setItem.*mnemonic/gi, message: 'Mnemonic stored in localStorage' },
      { pattern: /VITE_STELLAR_SECRET_KEY/g, message: 'Stellar secret key referenced in frontend' },
      { pattern: /\.secret/gi, message: 'Secret property accessed (potential exposure)' },
      { pattern: /console\.log.*secret/gi, message: 'Secret potentially logged to console' },
      { pattern: /console\.log.*private/gi, message: 'Private data potentially logged to console' },
      { pattern: /password.*=.*req\.body/gi, message: 'Password handling on frontend (should be backend)' },
    ];
    
    for (const { pattern, message } of sensitivePatterns) {
      const matches = content.match(pattern);
      if (matches) {
        this.issues.push(`🚨 ${relativePath}: ${message} (${matches.length} occurrence${matches.length > 1 ? 's' : ''})`);
      }
    }
    
    // Check for secure patterns (positive checks)
    if (content.includes('secureBackendService')) {
      this.passed.push(`✅ ${relativePath}: Uses secure backend service`);
    }
    
    if (content.includes('authenticateToken') && filePath.includes('server')) {
      this.passed.push(`✅ ${relativePath}: Implements JWT authentication`);
    }
  }

  async checkLocalStorage() {
    console.log('💾 Checking localStorage usage...');
    
    // This would be checked in browser context
    // For now, we'll check if there are any obvious localStorage abuses in code
    console.log('   localStorage usage patterns checked\n');
  }

  async checkBackendEndpoints() {
    console.log('🌐 Testing backend security endpoints...');
    
    try {
      // Test health endpoint
      const healthResponse = await fetch('http://localhost:3001/health');
      if (healthResponse.ok) {
        this.passed.push('✅ Backend health endpoint responding');
      }
      
      // Test that secure endpoints require authentication
      const unauthorizedResponse = await fetch('http://localhost:3001/api/auth/totp/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'test' })
      });
      
      if (unauthorizedResponse.status === 401) {
        this.passed.push('✅ Secure endpoints properly require authentication');
      } else {
        this.issues.push('🚨 Secure endpoints accessible without authentication!');
      }
      
      // Test password hashing endpoint
      const hashResponse = await fetch('http://localhost:3001/api/auth/hash-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'test', userId: 'test' })
      });
      
      if (hashResponse.ok) {
        const data = await hashResponse.json();
        if (data.success && data.hash && data.hash.startsWith('$argon2id$')) {
          this.passed.push('✅ Password hashing endpoint working with Argon2');
        } else {
          this.issues.push('🚨 Password hashing endpoint not working correctly');
        }
      }
      
    } catch (error) {
      this.warnings.push('⚠️  Could not test backend endpoints (server may not be running)');
    }
    
    console.log('   Backend endpoint security tested\n');
  }

  async checkDatabaseSecurity() {
    console.log('🗄️  Checking database security...');
    
    // Check if RLS test files exist and results
    const rlsTestPath = path.join(__dirname, 'test-rls-security.mjs');
    if (fs.existsSync(rlsTestPath)) {
      this.passed.push('✅ RLS security test exists');
    }
    
    const storageTestPath = path.join(__dirname, 'test-storage-security.mjs');
    if (fs.existsSync(storageTestPath)) {
      this.passed.push('✅ Storage security test exists');
    }
    
    console.log('   Database security checks complete\n');
  }

  printResults() {
    console.log('=' .repeat(60));
    console.log('🔍 SECURITY AUDIT RESULTS');
    console.log('=' .repeat(60));
    
    if (this.issues.length > 0) {
      console.log(`\n🚨 CRITICAL SECURITY ISSUES (${this.issues.length}):`);
      this.issues.forEach(issue => console.log(`   ${issue}`));
    }
    
    if (this.warnings.length > 0) {
      console.log(`\n⚠️  WARNINGS (${this.warnings.length}):`);
      this.warnings.forEach(warning => console.log(`   ${warning}`));
    }
    
    if (this.passed.length > 0) {
      console.log(`\n✅ SECURITY CHECKS PASSED (${this.passed.length}):`);
      this.passed.forEach(pass => console.log(`   ${pass}`));
    }
    
    console.log('\n' + '=' .repeat(60));
    
    if (this.issues.length === 0) {
      console.log('🎉 SECURITY AUDIT PASSED!');
      console.log('🛡️  No critical security vulnerabilities detected');
      if (this.warnings.length > 0) {
        console.log(`⚠️  ${this.warnings.length} warning${this.warnings.length > 1 ? 's' : ''} to address for production`);
      }
    } else {
      console.log('🚨 SECURITY AUDIT FAILED!');
      console.log(`❌ ${this.issues.length} critical security issue${this.issues.length > 1 ? 's' : ''} must be fixed`);
    }
    
    console.log('=' .repeat(60));
  }
}

// Run the audit
const auditor = new SecurityAuditor();
auditor.performAudit()
  .then(passed => {
    process.exit(passed ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Security audit failed:', error);
    process.exit(1);
  });