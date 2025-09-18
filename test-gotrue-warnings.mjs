#!/usr/bin/env node

/**
 * Quick test for GoTrueClient warnings
 */

import { chromium } from 'playwright';

console.log('🧪 Testing GoTrueClient warnings fix...\n');

const browser = await chromium.launch({ headless: false, slowMo: 300 });
const page = await browser.newPage();

let goTrueWarnings = 0;

page.on('console', (msg) => {
  const text = msg.text();
  if (text.includes('Multiple GoTrueClient instances detected')) {
    goTrueWarnings++;
    console.log('⚠️ GoTrueClient warning #' + goTrueWarnings + ':', text.substring(0, 80) + '...');
  }
});

try {
  console.log('📱 Loading app...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  
  // Wait for full initialization
  await page.waitForTimeout(5000);
  
  console.log(`📊 Final count: ${goTrueWarnings} GoTrueClient warnings`);
  
  if (goTrueWarnings === 0) {
    console.log('🎉 SUCCESS: No Multiple GoTrueClient warnings!');
  } else if (goTrueWarnings <= 2) {
    console.log('⚠️ PARTIAL: Reduced GoTrueClient warnings (was more, now ' + goTrueWarnings + ')');
  } else {
    console.log('❌ FAILED: Still too many GoTrueClient warnings');
  }
  
} catch (error) {
  console.error('❌ Test error:', error.message);
}

await browser.close();
console.log('\n🧪 GoTrueClient warning test completed');