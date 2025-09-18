#!/usr/bin/env node

/**
 * Diagnose Session Storage Collision
 * Check if multiple users interfere with each other's sessions
 */

import { chromium } from 'playwright';

console.log('🔍 Diagnosing Session Storage Collision Issue...\n');

const browser = await chromium.launch({ headless: false, slowMo: 500 });

try {
  // Create two contexts (like two users)
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();
  
  const page1 = await context1.newPage();
  const page2 = await context2.newPage();
  
  // Navigate both to the app
  await page1.goto('http://localhost:5173/');
  await page2.goto('http://localhost:5173/');
  
  // Check if sessionStorage is shared between contexts
  await page1.evaluate(() => {
    sessionStorage.setItem('test_user_1', JSON.stringify({id: 'user1', phone: '+1111111111'}));
  });
  
  const user1Data = await page1.evaluate(() => sessionStorage.getItem('test_user_1'));
  const user2Data = await page2.evaluate(() => sessionStorage.getItem('test_user_1'));
  
  console.log('📊 Session Storage Test Results:');
  console.log('   Page 1 can see test_user_1:', !!user1Data);
  console.log('   Page 2 can see test_user_1:', !!user2Data);
  
  if (user2Data) {
    console.log('❌ PROBLEM FOUND: sessionStorage is shared between contexts!');
    console.log('   This means multiple users overwrite each others temp data');
  } else {
    console.log('✅ SessionStorage isolation working correctly');
    console.log('   Problem must be elsewhere...');
  }
  
  // Check if there are existing tempUser entries
  const tempUser1 = await page1.evaluate(() => sessionStorage.getItem('tempUser'));
  const tempUser2 = await page2.evaluate(() => sessionStorage.getItem('tempUser'));
  
  console.log('\n🔍 Existing tempUser data:');
  console.log('   Context 1 tempUser:', tempUser1 ? JSON.parse(tempUser1) : 'None');
  console.log('   Context 2 tempUser:', tempUser2 ? JSON.parse(tempUser2) : 'None');
  
  // Test registration flow simulation
  console.log('\n🧪 Simulating registration flow...');
  
  // Simulate User 1 completing OTP
  await page1.evaluate(() => {
    sessionStorage.setItem('tempUser', JSON.stringify({
      id: 'user_test_1',
      phone: '+19075388374',
      publicKey: 'test_key_1'
    }));
  });
  
  // Simulate User 2 completing OTP (this might overwrite User 1)
  await page2.evaluate(() => {
    sessionStorage.setItem('tempUser', JSON.stringify({
      id: 'user_test_2', 
      phone: '+19078303325',
      publicKey: 'test_key_2'
    }));
  });
  
  // Check what each page sees
  const finalTempUser1 = await page1.evaluate(() => sessionStorage.getItem('tempUser'));
  const finalTempUser2 = await page2.evaluate(() => sessionStorage.getItem('tempUser'));
  
  console.log('\n📊 After simulated registration:');
  console.log('   Page 1 sees tempUser:', finalTempUser1 ? JSON.parse(finalTempUser1).id : 'None');
  console.log('   Page 2 sees tempUser:', finalTempUser2 ? JSON.parse(finalTempUser2).id : 'None');
  
  if (finalTempUser1 && finalTempUser2) {
    const user1Data = JSON.parse(finalTempUser1);
    const user2Data = JSON.parse(finalTempUser2);
    
    if (user1Data.id === user2Data.id) {
      console.log('❌ COLLISION DETECTED: Both pages see same user data!');
    } else {
      console.log('✅ No collision: Each page has different user data');
    }
  }
  
} catch (error) {
  console.error('❌ Diagnosis failed:', error.message);
} finally {
  await browser.close();
}

console.log('\n🔍 Diagnosis completed');