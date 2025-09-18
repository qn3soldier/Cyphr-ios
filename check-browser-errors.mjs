import puppeteer from 'puppeteer';

async function checkBrowserErrors() {
  console.log('🔍 Checking browser errors for Cyphr Messenger...\n');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Collect console messages
    const consoleMessages = [];
    const errors = [];
    
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      
      if (type === 'error') {
        errors.push(text);
        console.log('❌ ERROR:', text);
      } else if (type === 'warning') {
        console.log('⚠️  WARNING:', text);
      } else {
        consoleMessages.push(text);
      }
    });
    
    page.on('pageerror', error => {
      errors.push(error.message);
      console.log('❌ PAGE ERROR:', error.message);
    });
    
    // Navigate to the app
    console.log('📱 Loading http://localhost:5173/...\n');
    await page.goto('http://localhost:5173/', { 
      waitUntil: 'networkidle2',
      timeout: 10000 
    });
    
    // Wait a bit for any delayed errors
    await page.waitForTimeout(2000);
    
    // Check page title
    const title = await page.title();
    console.log('📄 Page Title:', title);
    
    // Try to get any React error boundary messages
    const errorBoundary = await page.$eval('body', el => el.textContent).catch(() => null);
    if (errorBoundary && errorBoundary.includes('Error')) {
      console.log('\n🚨 Error on page:', errorBoundary.substring(0, 200));
    }
    
    // Summary
    console.log('\n📊 Summary:');
    console.log(`   Total Errors: ${errors.length}`);
    console.log(`   Console Messages: ${consoleMessages.length}`);
    
    if (errors.length > 0) {
      console.log('\n🔴 Errors found! The app has issues that need fixing.');
    } else {
      console.log('\n✅ No critical errors found in console.');
    }
    
  } catch (error) {
    console.error('\n💥 Failed to check browser:', error.message);
  } finally {
    await browser.close();
  }
}

checkBrowserErrors().catch(console.error);