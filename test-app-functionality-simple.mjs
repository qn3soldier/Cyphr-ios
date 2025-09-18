#!/usr/bin/env node

/**
 * Simple App Functionality Test
 * Tests that the app loads and basic features work
 */

console.log('🧪 TESTING APP FUNCTIONALITY...\n');

async function testAppFunctionality() {
  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: Backend Health
  console.log('Test 1: Backend health check...');
  try {
    const response = await fetch('http://localhost:3001/health');
    if (response.ok) {
      const data = await response.json();
      if (data.status === 'OK') {
        console.log('✅ PASS: Backend is healthy');
        testsPassed++;
      } else {
        console.log('❌ FAIL: Backend unhealthy response');
        testsFailed++;
      }
    } else {
      console.log('❌ FAIL: Backend not responding');
      testsFailed++;
    }
  } catch (error) {
    console.log('❌ FAIL: Backend connection error');
    testsFailed++;
  }

  // Test 2: Frontend Loading
  console.log('\nTest 2: Frontend loading...');
  try {
    const response = await fetch('http://localhost:5173/');
    if (response.ok) {
      const html = await response.text();
      if (html.includes('html') && html.includes('vite')) {
        console.log('✅ PASS: Frontend loads correctly');
        testsPassed++;
      } else {
        console.log('❌ FAIL: Frontend content invalid');
        testsFailed++;
      }
    } else {
      console.log('❌ FAIL: Frontend not responding');
      testsFailed++;
    }
  } catch (error) {
    console.log('❌ FAIL: Frontend connection error');
    testsFailed++;
  }

  // Test 3: Secure Password Hashing
  console.log('\nTest 3: Secure password hashing...');
  try {
    const response = await fetch('http://localhost:3001/api/auth/hash-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'test123', userId: 'test' })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.hash && data.hash.includes('$argon2id$')) {
        console.log('✅ PASS: Secure password hashing works');
        testsPassed++;
      } else {
        console.log('❌ FAIL: Password hashing response invalid');
        testsFailed++;
      }
    } else {
      console.log('❌ FAIL: Password hashing endpoint error');
      testsFailed++;
    }
  } catch (error) {
    console.log('❌ FAIL: Password hashing request failed');
    testsFailed++;
  }

  // Test 4: Secure Authentication
  console.log('\nTest 4: Secure authentication...');
  try {
    const response = await fetch('http://localhost:3001/api/auth/secure-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'test', passwordHash: 'hash' })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.sessionToken) {
        console.log('✅ PASS: Secure authentication works');
        testsPassed++;
      } else {
        console.log('❌ FAIL: Authentication response invalid');
        testsFailed++;
      }
    } else {
      console.log('❌ FAIL: Authentication endpoint error');
      testsFailed++;
    }
  } catch (error) {
    console.log('❌ FAIL: Authentication request failed');
    testsFailed++;
  }

  // Test 5: Unauthorized Access Blocked
  console.log('\nTest 5: Unauthorized access protection...');
  try {
    const response = await fetch('http://localhost:3001/api/auth/totp/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'test' })
    });
    
    if (response.status === 401) {
      console.log('✅ PASS: Unauthorized access correctly blocked');
      testsPassed++;
    } else {
      console.log('❌ FAIL: Unauthorized access not blocked');
      testsFailed++;
    }
  } catch (error) {
    console.log('❌ FAIL: Authorization test failed');
    testsFailed++;
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('🧪 APP FUNCTIONALITY TEST RESULTS');
  console.log('='.repeat(50));
  console.log(`✅ Tests Passed: ${testsPassed}`);
  console.log(`❌ Tests Failed: ${testsFailed}`);
  
  if (testsFailed === 0) {
    console.log('\n🎉 ALL FUNCTIONALITY TESTS PASSED!');
    console.log('✨ App is working correctly with secure backend');
    return true;
  } else {
    console.log('\n🚨 SOME FUNCTIONALITY TESTS FAILED!');
    console.log('❌ App may have issues - check the failures above');
    return false;
  }
}

// Run the test
testAppFunctionality()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
  });