import puppeteer from 'puppeteer';

async function checkErrors() {
  const browser = await puppeteer.launch({ 
    headless: false, // Show browser
    args: ['--no-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Collect errors
  const errors = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
      console.log('❌ ERROR:', msg.text());
    }
  });
  
  page.on('pageerror', error => {
    errors.push(error.message);
    console.log('❌ PAGE ERROR:', error.message);
  });
  
  console.log('Opening http://localhost:5173/...');
  
  try {
    await page.goto('http://localhost:5173/', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    console.log('\n✅ Page loaded!');
    console.log(`Found ${errors.length} errors.`);
    
    // Keep browser open for manual inspection
    console.log('\n👀 Browser will stay open for manual inspection.');
    console.log('Press Ctrl+C to close.');
    
    // Wait forever
    await new Promise(() => {});
    
  } catch (error) {
    console.error('Failed to load page:', error.message);
    await browser.close();
  }
}

checkErrors().catch(console.error);