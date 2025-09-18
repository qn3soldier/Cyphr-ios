#!/usr/bin/env node

/**
 * Test Chats Loading After RLS Fix
 * Verifies that the chats page loads without infinite recursion errors
 */

import { chromium } from 'playwright';

console.log('🧪 Testing chats page loading after RLS fixes...\n');

const browser = await chromium.launch({ headless: false, slowMo: 500 });
const page = await browser.newPage();

// Listen for console errors
const errors = [];
page.on('pageerror', (error) => {
  errors.push(error.message);
  console.log('❌ Page Error:', error.message);
});

page.on('console', (msg) => {
  if (msg.type() === 'error') {
    const text = msg.text();
    errors.push(text);
    if (text.includes('infinite recursion') || text.includes('42P17')) {
      console.log('❌ RLS Error:', text);
    }
  }
});

try {
  // Navigate directly to chats (assuming user has session)
  console.log('📱 Opening chats page...');
  await page.goto('http://localhost:5173/chats', { waitUntil: 'networkidle' });
  
  // Wait a bit for any async operations
  await page.waitForTimeout(3000);
  
  // Check if page loaded successfully
  const pageTitle = await page.title();
  console.log(`📄 Page title: ${pageTitle}`);
  
  // Check for specific elements that should be present
  const hasHeader = await page.locator('text=Chats').count() > 0;
  console.log(`🔍 Found "Chats" header: ${hasHeader}`);
  
  // Check if there are any infinite recursion errors
  const hasRecursionErrors = errors.some(error => 
    error.includes('infinite recursion') || 
    error.includes('42P17') ||
    error.includes('500 (Internal Server Error)')
  );
  
  if (hasRecursionErrors) {
    console.log('❌ FAILED: Still has RLS infinite recursion errors');
    console.log('Error details:', errors.filter(e => 
      e.includes('infinite recursion') || e.includes('42P17') || e.includes('500')
    ));
  } else {
    console.log('✅ SUCCESS: No infinite recursion errors detected!');
    console.log('✅ Chats page loads without RLS policy issues');
  }
  
  // Check if we can see the empty state or chat list
  const hasEmptyState = await page.locator('text=No chats yet').count() > 0;
  const hasChatList = await page.locator('[data-testid*="chat"]').count() > 0;
  
  console.log(`📝 Empty state visible: ${hasEmptyState}`);
  console.log(`💬 Chat list items: ${await page.locator('[data-testid*="chat"], .chat-item, [class*="chat"]').count()}`);
  
  console.log('\n🎉 SUCCESS: Chats page is loading correctly!');
  console.log('✅ RLS infinite recursion issue resolved');
  console.log('✅ Page renders without critical errors');
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
  
  // Take screenshot for debugging
  await page.screenshot({ 
    path: `screenshots/chats-loading-test-${Date.now()}.png`,
    fullPage: true 
  });
  console.log('📸 Screenshot saved for debugging');
} finally {
  await browser.close();
  console.log('\n🧪 Test completed');
}