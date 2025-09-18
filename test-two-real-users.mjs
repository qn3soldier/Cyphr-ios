#!/usr/bin/env node

/**
 * Two Real Users Testing Helper
 * Automates browser setup and provides guided testing
 */

import { chromium, firefox } from 'playwright';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = (question) => new Promise((resolve) => rl.question(question, resolve));

console.log('🚀 CYPHR MESSENGER - TWO REAL USERS TESTING HELPER\n');

// Configuration
let userA_phone = '';
let userB_phone = '';
let userA_name = '';
let userB_name = '';

async function setupTest() {
  console.log('📋 SETUP PHASE - Enter Real User Information\n');
  
  userA_phone = await ask('📱 Enter User A phone number (with country code, e.g. +19075388374): ');
  userA_name = await ask('👤 Enter User A name (e.g. Alice Test): ');
  
  userB_phone = await ask('📱 Enter User B phone number (with country code): ');
  userB_name = await ask('👤 Enter User B name (e.g. Bob Test): ');
  
  console.log('\n✅ Configuration saved:');
  console.log(`   User A: ${userA_name} (${userA_phone})`);
  console.log(`   User B: ${userB_name} (${userB_phone})`);
  
  const proceed = await ask('\n🚀 Ready to start testing? (y/n): ');
  if (proceed.toLowerCase() !== 'y') {
    console.log('❌ Testing cancelled');
    process.exit(0);
  }
}

async function launchBrowsers() {
  console.log('\n🌐 LAUNCHING BROWSERS...\n');
  
  // Launch Chrome for User A
  console.log('🟢 Launching Chrome for User A...');
  const chromeBrowser = await chromium.launch({ 
    headless: false, 
    slowMo: 500,
    args: ['--window-position=0,0', '--window-size=800,900']
  });
  
  const chromeContext = await chromeBrowser.newContext({
    viewport: { width: 800, height: 700 }
  });
  
  const chromeContextId = await chromeContext.addInitScript(() => {
    window.USER_ROLE = 'USER_A';
    window.USER_NAME = '${userA_name}';
    window.USER_PHONE = '${userA_phone}';
  });
  
  const chromePage = await chromeContext.newPage();
  
  // Launch Firefox for User B  
  console.log('🟠 Launching Firefox for User B...');
  const firefoxBrowser = await firefox.launch({ 
    headless: false, 
    slowMo: 500,
    args: ['--width=800', '--height=900']
  });
  
  const firefoxContext = await firefoxBrowser.newContext({
    viewport: { width: 800, height: 700 }
  });
  
  await firefoxContext.addInitScript(() => {
    window.USER_ROLE = 'USER_B';
    window.USER_NAME = '${userB_name}';  
    window.USER_PHONE = '${userB_phone}';
  });
  
  const firefoxPage = await firefoxContext.newPage();
  
  return { 
    chromePageA: chromePage, 
    firefoxPageB: firefoxPage,
    chromeBrowser,
    firefoxBrowser 
  };
}

async function runPhase1Registration(chromePageA, firefoxPageB) {
  console.log('\n📝 PHASE 1: DUAL REGISTRATION\n');
  
  // User A Registration
  console.log('👤 Starting User A registration (Chrome)...');
  await chromePageA.goto('http://localhost:5173/');
  await chromePageA.waitForSelector('text=Cyphr Messenger');
  
  // Fill phone number for User A
  const phoneInputA = chromePageA.locator('input[placeholder*="phone"]').first();
  await phoneInputA.fill(userA_phone);
  
  const continueButtonA = chromePageA.locator('button').filter({ hasText: /continue/i }).first();
  await continueButtonA.click();
  
  console.log(`📱 SMS sent to ${userA_phone} - waiting for OTP input...`);
  
  // User B Registration (in parallel)
  console.log('👤 Starting User B registration (Firefox)...');
  await firefoxPageB.goto('http://localhost:5173/');
  await firefoxPageB.waitForSelector('text=Cyphr Messenger');
  
  // Fill phone number for User B
  const phoneInputB = firefoxPageB.locator('input[placeholder*="phone"]').first();
  await phoneInputB.fill(userB_phone);
  
  const continueButtonB = firefoxPageB.locator('button').filter({ hasText: /continue/i }).first();
  await continueButtonB.click();
  
  console.log(`📱 SMS sent to ${userB_phone} - waiting for OTP input...`);
  
  // Wait for manual OTP entry
  console.log('\n⏳ MANUAL STEP: Enter OTP codes in both browsers');
  console.log('   - Chrome (User A): Enter OTP from', userA_phone);
  console.log('   - Firefox (User B): Enter OTP from', userB_phone);
  
  await ask('Press Enter when both users have completed registration and reached /chats page...');
  
  // Verify both users are on chats page
  try {
    await chromePageA.waitForURL('**/chats', { timeout: 5000 });
    console.log('✅ User A reached chats page');
  } catch {
    console.log('⚠️ User A might not be on chats page yet');
  }
  
  try {
    await firefoxPageB.waitForURL('**/chats', { timeout: 5000 });
    console.log('✅ User B reached chats page');
  } catch {
    console.log('⚠️ User B might not be on chats page yet');
  }
}

async function runPhase2Discovery(chromePageA, firefoxPageB) {
  console.log('\n🔍 PHASE 2: USER DISCOVERY\n');
  
  console.log('👤 User A: Starting new chat...');
  
  // User A starts new chat
  try {
    const newChatButton = chromePageA.locator('button, [role="button"]').filter({ 
      hasText: /new|chat|\+|add/i 
    }).first();
    await newChatButton.click();
    
    console.log('✅ User A clicked new chat button');
    
    // Search for User B
    const searchInput = chromePageA.locator('input[placeholder*="search"], input[placeholder*="phone"], input[type="search"]').first();
    await searchInput.fill(userB_phone);
    
    console.log(`🔍 User A searching for ${userB_phone}...`);
    
    await ask('Press Enter when User A has found and started chat with User B...');
    
  } catch (error) {
    console.log('⚠️ Automated user discovery failed. Please manually:');
    console.log('   1. User A: Click New Chat button');
    console.log('   2. Search for User B by phone:', userB_phone);
    console.log('   3. Start conversation');
    
    await ask('Press Enter when chat is started...');
  }
}

async function runPhase3Messaging(chromePageA, firefoxPageB) {
  console.log('\n💬 PHASE 3: REAL-TIME MESSAGING\n');
  
  console.log('🎯 MANUAL TESTING PHASE - Please test:');
  console.log('');
  console.log('📝 Test 1: Basic Text Messages');
  console.log('   - User A: Send "Hello from Chrome!" ');
  console.log('   - User B: Reply "Hello from Firefox!"');  
  console.log('   - Verify messages appear instantly');
  console.log('');
  console.log('🔐 Test 2: Check Encryption Logs');
  console.log('   - Open Dev Tools (F12) in both browsers');
  console.log('   - Look for "🔐 Message encrypted" logs');
  console.log('   - Verify Kyber1024 + ChaCha20 mentioned');
  console.log('');
  console.log('📚 Test 3: Message History');
  console.log('   - Send 5+ messages back and forth');
  console.log('   - Refresh both browsers (F5)');
  console.log('   - Verify all messages persist');
  console.log('');
  
  await ask('Press Enter when messaging tests are complete...');
}

async function runPhase4Advanced(chromePageA, firefoxPageB) {
  console.log('\n🚀 PHASE 4: ADVANCED FEATURES\n');
  
  console.log('📎 Test 4: File Sharing');
  console.log('   - User A: Try to send an image');
  console.log('   - User B: Verify image received');
  console.log('');
  console.log('💰 Test 5: HD Wallet');
  console.log('   - Both users: Check wallet section');
  console.log('   - Verify wallets were auto-created');
  console.log('   - Note wallet addresses');
  console.log('');
  console.log('⚙️ Test 6: Settings');
  console.log('   - Update profiles in settings');
  console.log('   - Verify changes sync in chat');
  console.log('');
  
  await ask('Press Enter when advanced tests are complete...');
}

async function runPhase5Stress(chromePageA, firefoxPageB) {
  console.log('\n💪 PHASE 5: STRESS TESTING\n');
  
  console.log('⚡ Test 7: Rapid Messaging');
  console.log('   - Both users: Type very fast alternating messages');
  console.log('   - Send 20+ messages in 30 seconds');
  console.log('   - Check message order and delivery');
  console.log('');
  console.log('📡 Test 8: Connection Resilience');
  console.log('   - User A: Disconnect WiFi temporarily');
  console.log('   - User B: Send messages while A offline');
  console.log('   - User A: Reconnect and check delivery');
  console.log('');
  console.log('🔄 Test 9: Browser Refresh');
  console.log('   - During active chat, refresh one browser');
  console.log('   - Verify seamless continuation');
  console.log('');
  
  await ask('Press Enter when stress tests are complete...');
}

async function generateReport() {
  console.log('\n📊 GENERATING TEST REPORT\n');
  
  const registrationWorked = await ask('✅ Did registration work for both users? (y/n): ');
  const messagingWorked = await ask('✅ Did real-time messaging work? (y/n): ');
  const encryptionVisible = await ask('✅ Were encryption logs visible in console? (y/n): ');
  const filesWorked = await ask('✅ Did file sharing work? (y/n): ');
  const walletsWorked = await ask('✅ Were HD wallets created? (y/n): ');
  const overallScore = await ask('⭐ Overall experience score (1-10): ');
  const comments = await ask('💬 Any additional comments or bugs found: ');
  
  const report = `
🧪 CYPHR MESSENGER - REAL USER TEST RESULTS
Date: ${new Date().toISOString().split('T')[0]}
Testers: ${userA_name} (${userA_phone}) + ${userB_name} (${userB_phone})
Browsers: Chrome + Firefox

✅ TEST RESULTS:
- Registration: ${registrationWorked.toUpperCase()}
- Real-time Messaging: ${messagingWorked.toUpperCase()}
- Encryption Visible: ${encryptionVisible.toUpperCase()}
- File Sharing: ${filesWorked.toUpperCase()}
- HD Wallets: ${walletsWorked.toUpperCase()}

⭐ OVERALL SCORE: ${overallScore}/10
💬 COMMENTS: ${comments || 'None'}

Generated by: test-two-real-users.mjs
`;
  
  console.log('\n📝 TEST REPORT:');
  console.log(report);
  
  // Save to file
  const fs = await import('fs');
  const filename = `test-report-${Date.now()}.txt`;
  fs.writeFileSync(filename, report);
  console.log(`💾 Report saved to: ${filename}`);
}

async function main() {
  try {
    await setupTest();
    
    const { chromePageA, firefoxPageB, chromeBrowser, firefoxBrowser } = await launchBrowsers();
    
    console.log('\n✅ Both browsers launched successfully!');
    console.log('   - Chrome (User A): Ready for', userA_name);
    console.log('   - Firefox (User B): Ready for', userB_name);
    
    await runPhase1Registration(chromePageA, firefoxPageB);
    await runPhase2Discovery(chromePageA, firefoxPageB);  
    await runPhase3Messaging(chromePageA, firefoxPageB);
    await runPhase4Advanced(chromePageA, firefoxPageB);
    await runPhase5Stress(chromePageA, firefoxPageB);
    
    await generateReport();
    
    console.log('\n🎉 TESTING COMPLETED!');
    const cleanup = await ask('🧹 Close browsers and cleanup? (y/n): ');
    
    if (cleanup.toLowerCase() === 'y') {
      await chromeBrowser.close();
      await firefoxBrowser.close();
      console.log('✅ Browsers closed');
    }
    
  } catch (error) {
    console.error('❌ Testing failed:', error.message);
  } finally {
    rl.close();
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n⚠️ Testing interrupted by user');
  rl.close();
  process.exit(0);
});

main();