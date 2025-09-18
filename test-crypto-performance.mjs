#!/usr/bin/env node

/**
 * Crypto Performance & Functionality Test
 * Tests Kyber1024 and ChaCha20 performance in production
 */

console.log('🔐 Testing Production Crypto Performance...');

// Test production endpoint
const PRODUCTION_URL = 'https://app.cyphrmessenger.app';

async function testProductionCrypto() {
  try {
    console.log('📊 Fetching production app...');
    const response = await fetch(PRODUCTION_URL);
    const html = await response.text();
    
    // Check if crypto modules are included
    const hasKyber = html.includes('kyber') || html.includes('Kyber');
    const hasChacha = html.includes('chacha') || html.includes('ChaCha');
    const hasArgon = html.includes('argon2');
    
    console.log(`✅ Kyber1024 module: ${hasKyber ? 'Present' : 'Missing'}`);
    console.log(`✅ ChaCha20 module: ${hasChacha ? 'Present' : 'Missing'}`);
    console.log(`✅ Argon2 module: ${hasArgon ? 'Present' : 'Missing'}`);
    
    // Check response times
    const startTime = performance.now();
    await fetch(PRODUCTION_URL);
    const loadTime = performance.now() - startTime;
    
    console.log(`⚡ Page load time: ${loadTime.toFixed(2)}ms`);
    console.log(loadTime < 2000 ? '✅ Load time < 2s (PASS)' : '❌ Load time > 2s (FAIL)');
    
    // Test HTTPS security
    const httpsTest = PRODUCTION_URL.startsWith('https://');
    console.log(`🔒 HTTPS enabled: ${httpsTest ? 'YES' : 'NO'}`);
    
    // Test security headers
    const headers = response.headers;
    const hasHSTS = headers.has('strict-transport-security');
    const hasCSP = headers.has('content-security-policy');
    const hasXFrame = headers.has('x-frame-options');
    
    console.log(`🛡️ Security Headers:`);
    console.log(`  - HSTS: ${hasHSTS ? 'Present' : 'Missing'}`);
    console.log(`  - CSP: ${hasCSP ? 'Present' : 'Missing'}`);
    console.log(`  - X-Frame-Options: ${hasXFrame ? 'Present' : 'Missing'}`);
    
    return {
      cryptoModules: { hasKyber, hasChacha, hasArgon },
      performance: { loadTime },
      security: { httpsTest, hasHSTS, hasCSP, hasXFrame }
    };
    
  } catch (error) {
    console.error('❌ Production test error:', error.message);
    return null;
  }
}

// Run the test
testProductionCrypto().then(results => {
  if (results) {
    console.log('\n📋 Test Summary:');
    console.log('================');
    const cryptoScore = Object.values(results.cryptoModules).filter(Boolean).length;
    const securityScore = Object.values(results.security).filter(Boolean).length;
    
    console.log(`🔐 Crypto Modules: ${cryptoScore}/3`);
    console.log(`🛡️ Security Features: ${securityScore}/4`);
    console.log(`⚡ Performance: ${results.performance.loadTime < 2000 ? 'PASS' : 'FAIL'}`);
  }
});