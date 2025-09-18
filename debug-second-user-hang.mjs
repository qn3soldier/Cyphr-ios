#!/usr/bin/env node

/**
 * Debug Second User Registration Hang
 * Specifically when Safari used for user 1, Chrome for user 2
 */

import { chromium } from 'playwright';

console.log('🔍 Debugging Second User "Secure Your Account" Hang...\n');

const browser = await chromium.launch({ headless: false, slowMo: 500 });
const context = await browser.newContext();
const page = await context.newPage();

// Track console messages and errors
const messages = [];
page.on('console', msg => {
  messages.push({
    type: msg.type(),
    text: msg.text(),
    timestamp: new Date().toISOString()
  });
  
  if (msg.type() === 'error') {
    console.log('❌ Console Error:', msg.text());
  }
});

page.on('pageerror', error => {
  console.log('🚨 Page Error:', error.message);
});

try {
  console.log('📱 Simulating second user registration in Chrome...');
  
  // Navigate to app
  await page.goto('http://localhost:5173/');
  
  // Check if we can get to "Secure Your Account" page directly
  console.log('🔄 Trying to navigate directly to /phone-registration...');
  await page.goto('http://localhost:5173/phone-registration');
  
  await page.waitForTimeout(3000);
  
  // Check current page state
  const currentUrl = page.url();
  const pageTitle = await page.title();
  
  console.log(`📍 Current URL: ${currentUrl}`);
  console.log(`📄 Page Title: ${pageTitle}`);
  
  // Check for "Secure Your Account" text
  const hasSecureText = await page.locator('text=Secure Your Account').count() > 0;
  console.log(`🔒 "Secure Your Account" visible: ${hasSecureText}`);
  
  if (hasSecureText) {
    console.log('✅ Page loaded, checking form elements...');
    
    // Check form elements
    const passwordInputs = await page.locator('input[type="password"]').count();
    const nameInput = await page.locator('input[placeholder*="Full Name"], input[placeholder*="Name"]').count();
    const submitButton = await page.locator('button').filter({ hasText: /Complete Registration/i }).count();
    
    console.log(`📝 Password inputs found: ${passwordInputs}`);
    console.log(`👤 Name input found: ${nameInput}`);
    console.log(`🚀 Submit button found: ${submitButton}`);
    
    // Check sessionStorage for tempUser
    const tempUserData = await page.evaluate(() => {
      try {
        return {
          tempUser: sessionStorage.getItem('tempUser'),
          userId: sessionStorage.getItem('userId'),
          allKeys: Object.keys(sessionStorage)
        };
      } catch (e) {
        return { error: e.message };
      }
    });
    
    console.log('\n💾 SessionStorage Analysis:');
    console.log('   tempUser exists:', !!tempUserData.tempUser);
    console.log('   userId exists:', !!tempUserData.userId);
    console.log('   All sessionStorage keys:', tempUserData.allKeys);
    
    if (tempUserData.tempUser) {
      try {
        const parsedTempUser = JSON.parse(tempUserData.tempUser);
        console.log('   tempUser data:', parsedTempUser);
      } catch (e) {
        console.log('   tempUser parse error:', e.message);
      }
    } else {
      console.log('❌ PROBLEM: tempUser is missing from sessionStorage!');
      console.log('   This would cause "Session expired" error');
    }
    
    // Try to fill form and see what happens
    if (nameInput > 0 && passwordInputs >= 2) {
      console.log('\n🧪 Testing form submission...');
      
      await page.fill('input[placeholder*="Full Name"], input[placeholder*="Name"]', 'Test User Chrome');
      await page.fill('input[type="password"]', 'testpassword123', { timeout: 5000 });
      
      // Wait a bit to see if anything happens
      await page.waitForTimeout(2000);
      
      // Check if button is enabled
      const submitBtn = page.locator('button').filter({ hasText: /Complete Registration/i });
      const isEnabled = await submitBtn.isEnabled();
      console.log(`🔘 Submit button enabled: ${isEnabled}`);
      
      if (isEnabled) {
        console.log('🔄 Attempting form submission...');
        await submitBtn.click();
        
        // Wait for response
        await page.waitForTimeout(5000);
        
        const newUrl = page.url();
        console.log(`📍 URL after submit: ${newUrl}`);
        
        if (newUrl.includes('/chats')) {
          console.log('✅ SUCCESS: User redirected to chats!');
        } else {
          console.log('❌ HANG: User still on same page');
        }
      }
    }
  } else {
    console.log('❌ "Secure Your Account" page not found');
    
    // Check what page we're actually on
    const bodyText = await page.textContent('body');
    console.log('📄 Page content (first 200 chars):', bodyText?.substring(0, 200));
  }
  
  // Analyze console messages
  console.log('\n📊 Console Messages Summary:');
  const errorMessages = messages.filter(m => m.type === 'error');
  const warningMessages = messages.filter(m => m.type === 'warning');
  
  console.log(`   Errors: ${errorMessages.length}`);
  console.log(`   Warnings: ${warningMessages.length}`);
  
  if (errorMessages.length > 0) {
    console.log('\n❌ Error Messages:');
    errorMessages.slice(0, 5).forEach((msg, i) => {
      console.log(`   ${i + 1}. ${msg.text}`);
    });
  }
  
} catch (error) {
  console.error('🚨 Debug script failed:', error.message);
} finally {
  console.log('\n⏳ Keeping browser open for manual inspection...');
  console.log('   Press Ctrl+C to close when done');
  
  // Keep browser open for manual inspection
  await new Promise(resolve => {
    process.on('SIGINT', () => {
      browser.close();
      resolve();
    });
  });
}

console.log('\n🔍 Debug completed');