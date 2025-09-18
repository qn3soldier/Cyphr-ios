import puppeteer from 'puppeteer';

async function checkAppStatus() {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Collect console messages
  const errors = [];
  const logs = [];
  
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    
    if (type === 'error') {
      errors.push(text);
      console.log('❌ ERROR:', text);
    } else if (type === 'warning') {
      console.log('⚠️  WARNING:', text);
    } else {
      logs.push(text);
      if (text.includes('Cyphr') || text.includes('initialized')) {
        console.log('✅', text);
      }
    }
  });
  
  page.on('pageerror', error => {
    errors.push(error.message);
    console.log('💥 PAGE ERROR:', error.message);
  });
  
  console.log('🔍 Checking Cyphr Messenger status...\n');
  
  try {
    await page.goto('http://localhost:5173/', { 
      waitUntil: 'networkidle2',
      timeout: 10000 
    });
    
    // Wait for React to render
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if root element has content
    const hasContent = await page.evaluate(() => {
      const root = document.getElementById('root');
      return root && root.children.length > 0;
    });
    
    // Get page content preview
    const bodyText = await page.evaluate(() => {
      return document.body.innerText.substring(0, 200);
    });
    
    console.log('\n📊 Status Report:');
    console.log(`   Errors: ${errors.length}`);
    console.log(`   React Rendered: ${hasContent ? 'Yes ✅' : 'No ❌'}`);
    
    if (bodyText.trim()) {
      console.log(`\n📄 Page Content Preview:`);
      console.log(`   "${bodyText.trim()}..."`);
    } else {
      console.log(`\n⚠️  Page appears to be blank!`);
    }
    
    if (errors.length === 0 && hasContent) {
      console.log('\n✅ App loaded successfully!');
    } else {
      console.log('\n❌ App has issues that need fixing.');
    }
    
  } catch (error) {
    console.error('\n💥 Failed to load app:', error.message);
  } finally {
    await browser.close();
  }
}

checkAppStatus().catch(console.error);