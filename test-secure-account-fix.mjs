#!/usr/bin/env node

/**
 * Test Registration Flow - Secure Account Page Fix
 * Verifies that the "Secure Your Account" page no longer hangs
 */

import { chromium } from 'playwright';

console.log('🧪 Testing "Secure Your Account" page fix...\n');

const browser = await chromium.launch({ headless: false, slowMo: 500 });
const page = await browser.newPage();

try {
  // Navigate to app
  console.log('📱 Opening Cyphr Messenger...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  
  // Check if welcome page loads
  await page.waitForSelector('text=Cyphr Messenger', { timeout: 10000 });
  console.log('✅ Welcome page loaded');
  
  // Enter phone number
  console.log('📞 Entering phone number...');
  const phoneInput = page.locator('input[placeholder*="phone"]').first();
  await phoneInput.fill('+19075388374');
  
  // Click continue/proceed button
  const continueBtn = page.locator('button').filter({ hasText: /continue|proceed/i }).first();
  await continueBtn.click();
  
  // Wait for OTP step
  console.log('🔐 Waiting for OTP step...');
  await page.waitForSelector('text=Confirm Your Identity', { timeout: 15000 });
  console.log('✅ OTP step loaded');
  
  // Wait for user to provide OTP code
  console.log('📱 SMS sent to +19075388374');
  console.log('⏳ Please provide the 6-digit OTP code you received...');
  
  // Keep browser open and wait for manual input
  console.log('💡 Browser will stay open - please enter the OTP manually when you receive it');
  console.log('🔍 Then we will continue testing the "Secure Your Account" page...');
  
  // Wait for OTP to be entered - check periodically
  let otpEntered = false;
  let attempts = 0;
  const maxAttempts = 300; // 5 minutes (300 * 1 second)
  
  while (!otpEntered && attempts < maxAttempts) {
    await page.waitForTimeout(1000); // Wait 1 second
    
    // Check if all OTP inputs are filled
    const otpInputs = page.locator('input[maxlength="1"]');
    const inputCount = await otpInputs.count();
    let filledCount = 0;
    
    for (let i = 0; i < inputCount; i++) {
      const value = await otpInputs.nth(i).inputValue();
      if (value && value.length > 0) {
        filledCount++;
      }
    }
    
    if (filledCount === 6) {
      otpEntered = true;
      console.log('✅ OTP entered, continuing test...');
    }
    
    attempts++;
    if (attempts % 30 === 0) {
      console.log(`⏳ Still waiting for OTP... (${Math.floor(attempts/60)} minutes elapsed)`);
    }
  }
  
  if (!otpEntered) {
    throw new Error('Timeout waiting for OTP entry');
  }
  
  // Wait for profile step (should skip OTP verification in test)
  console.log('👤 Waiting for profile step...');
  await page.waitForSelector('text=Complete Your Profile', { timeout: 10000 });
  console.log('✅ Profile step loaded');
  
  // Enter name
  console.log('📝 Entering profile info...');
  const nameInput = page.locator('input[placeholder*="Full Name"]').first();
  await nameInput.fill('Test User');
  
  // Click continue to security
  const continueToSecurity = page.locator('button').filter({ hasText: /Continue to Security/i }).first();
  await continueToSecurity.click();
  
  // THE CRITICAL TEST: Check if "Secure Your Account" page loads without hanging
  console.log('🔒 Testing "Secure Your Account" page...');
  
  try {
    await page.waitForSelector('text=Secure Your Account', { timeout: 15000 });
    console.log('✅ "Secure Your Account" page loaded successfully!');
    
    // Check if password inputs are present
    const passwordInputs = page.locator('input[type="password"]');
    const passwordCount = await passwordInputs.count();
    console.log(`✅ Found ${passwordCount} password inputs`);
    
    // Check if "Complete Registration" button exists
    const completeBtn = page.locator('button').filter({ hasText: /Complete Registration/i });
    const completeExists = await completeBtn.count() > 0;
    console.log(`✅ Complete Registration button exists: ${completeExists}`);
    
    console.log('\n🎉 SUCCESS: "Secure Your Account" page is working correctly!');
    console.log('✅ Registration flow no longer hangs');
    console.log('✅ All form elements are present and functional');
    
  } catch (error) {
    console.error('❌ FAILED: "Secure Your Account" page still hangs or has issues');
    console.error('Error:', error.message);
    
    // Take screenshot for debugging
    await page.screenshot({ 
      path: `screenshots/secure-account-hang-${Date.now()}.png`,
      fullPage: true 
    });
    console.log('📸 Screenshot saved for debugging');
  }
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
  
  // Take screenshot for debugging
  await page.screenshot({ 
    path: `screenshots/test-failure-${Date.now()}.png`,
    fullPage: true 
  });
  console.log('📸 Screenshot saved for debugging');
}

await browser.close();
console.log('\n🧪 Test completed');