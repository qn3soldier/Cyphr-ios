import puppeteer from 'puppeteer';

async function detailedCheck() {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox']
  });
  
  const page = await browser.newPage();
  
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    
    console.log(`[${type.toUpperCase()}] ${text}`);
  });
  
  page.on('pageerror', error => {
    console.log(`[PAGE ERROR] ${error.message}`);
    console.log(`[STACK] ${error.stack}`);
  });
  
  console.log('🔍 Detailed error check...\n');
  
  try {
    await page.goto('http://localhost:5173/', { 
      waitUntil: 'networkidle2',
      timeout: 10000 
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\n✅ Finished error collection');
    
  } catch (error) {
    console.error('Failed to load:', error.message);
  } finally {
    await browser.close();
  }
}

detailedCheck().catch(console.error);