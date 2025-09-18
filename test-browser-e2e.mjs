#!/usr/bin/env node

/**
 * 🧪 BROWSER E2E ТЕСТ CYPHR MESSENGER  
 * Полное тестирование в реальном браузере
 */

import puppeteer from 'puppeteer';

const BASE_URL = 'https://app.cyphrmessenger.app';

class BrowserE2ETester {
  constructor() {
    this.browser = null;
    this.page = null;
    this.results = [];
  }

  async log(step, status, details = '') {
    const timestamp = new Date().toISOString();
    const result = { step, status, details, timestamp };
    this.results.push(result);
    
    const emoji = status === 'SUCCESS' ? '✅' : status === 'FAIL' ? '❌' : '🔄';
    console.log(`${emoji} [${timestamp}] ${step}: ${status}`);
    if (details) console.log(`   └─ ${details}`);
  }

  async setup() {
    try {
      this.browser = await puppeteer.launch({ 
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      this.page = await this.browser.newPage();
      
      // Настройка viewport и user agent
      await this.page.setViewport({ width: 1280, height: 800 });
      await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
      
      await this.log('Browser Setup', 'SUCCESS', 'Puppeteer initialized');
      return true;
    } catch (error) {
      await this.log('Browser Setup', 'FAIL', error.message);
      return false;
    }
  }

  async testPageLoad() {
    try {
      const startTime = Date.now();
      await this.page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 });
      const loadTime = Date.now() - startTime;
      
      // Проверяем заголовок
      const title = await this.page.title();
      if (title.includes('Cyphr Messenger')) {
        await this.log('Page Load', 'SUCCESS', `Loaded in ${loadTime}ms, Title: ${title}`);
        return true;
      } else {
        await this.log('Page Load', 'FAIL', `Wrong title: ${title}`);
        return false;
      }
    } catch (error) {
      await this.log('Page Load', 'FAIL', error.message);
      return false;
    }
  }

  async testConsoleErrors() {
    try {
      const errors = [];
      
      this.page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      // Ждем загрузки
      await this.page.waitForTimeout(3000);
      
      if (errors.length === 0) {
        await this.log('Console Errors', 'SUCCESS', 'No JavaScript errors');
        return true;
      } else {
        await this.log('Console Errors', 'FAIL', `${errors.length} errors: ${errors[0]}`);
        return false;
      }
    } catch (error) {
      await this.log('Console Errors', 'FAIL', error.message);
      return false;
    }
  }

  async testWelcomeScreen() {
    try {
      // Ищем элементы Welcome экрана
      await this.page.waitForSelector('body', { timeout: 10000 });
      
      // Проверяем наличие основных элементов
      const hasContent = await this.page.evaluate(() => {
        return document.body.textContent.length > 100;
      });
      
      if (hasContent) {
        await this.log('Welcome Screen', 'SUCCESS', 'Welcome content loaded');
        return true;
      } else {
        await this.log('Welcome Screen', 'FAIL', 'Welcome content missing');
        return false;
      }
    } catch (error) {
      await this.log('Welcome Screen', 'FAIL', error.message);
      return false;
    }
  }

  async testReactApp() {
    try {
      // Проверяем, что React приложение загрузилось
      const isReactApp = await this.page.evaluate(() => {
        const root = document.getElementById('root');
        return root && root.children.length > 0;
      });
      
      if (isReactApp) {
        await this.log('React App', 'SUCCESS', 'React application rendered');
        return true;
      } else {
        await this.log('React App', 'FAIL', 'React app not rendered');
        return false;
      }
    } catch (error) {
      await this.log('React App', 'FAIL', error.message);
      return false;
    }
  }

  async testResponsiveness() {
    try {
      // Тест на мобильном разрешении
      await this.page.setViewport({ width: 375, height: 667 });
      await this.page.waitForTimeout(1000);
      
      const isMobileResponsive = await this.page.evaluate(() => {
        return window.innerWidth === 375;
      });
      
      // Возвращаем к desktop
      await this.page.setViewport({ width: 1280, height: 800 });
      
      if (isMobileResponsive) {
        await this.log('Responsiveness', 'SUCCESS', 'Mobile viewport works');
        return true;
      } else {
        await this.log('Responsiveness', 'FAIL', 'Mobile viewport issue');
        return false;
      }
    } catch (error) {
      await this.log('Responsiveness', 'FAIL', error.message);
      return false;
    }
  }

  async testCryptoFeatures() {
    try {
      // Проверяем доступность WebCrypto API
      const hasCrypto = await this.page.evaluate(() => {
        return typeof window.crypto !== 'undefined' && 
               typeof window.crypto.subtle !== 'undefined';
      });
      
      if (hasCrypto) {
        await this.log('Crypto Features', 'SUCCESS', 'WebCrypto API available');
        return true;
      } else {
        await this.log('Crypto Features', 'FAIL', 'WebCrypto API missing');
        return false;
      }
    } catch (error) {
      await this.log('Crypto Features', 'FAIL', error.message);
      return false;
    }
  }

  async takeScreenshot() {
    try {
      const filename = `cyphr-screenshot-${Date.now()}.png`;
      await this.page.screenshot({ 
        path: filename, 
        fullPage: true 
      });
      await this.log('Screenshot', 'SUCCESS', `Saved as ${filename}`);
      return true;
    } catch (error) {
      await this.log('Screenshot', 'FAIL', error.message);
      return false;
    }
  }

  async cleanup() {
    try {
      if (this.browser) {
        await this.browser.close();
      }
      await this.log('Cleanup', 'SUCCESS', 'Browser closed');
    } catch (error) {
      await this.log('Cleanup', 'FAIL', error.message);
    }
  }

  async runBrowserTests() {
    console.log('🌐 Starting Browser E2E Tests for Cyphr Messenger');
    console.log(`🔗 URL: ${BASE_URL}`);
    console.log('=' * 60);
    
    const tests = [
      () => this.setup(),
      () => this.testPageLoad(),
      () => this.testConsoleErrors(),
      () => this.testWelcomeScreen(),
      () => this.testReactApp(),
      () => this.testResponsiveness(),
      () => this.testCryptoFeatures(),
      () => this.takeScreenshot(),
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
      try {
        const result = await test();
        if (result) passed++;
        else failed++;
      } catch (error) {
        failed++;
        await this.log('Test Execution', 'FAIL', error.message);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    await this.cleanup();
    
    // Финальный отчет
    console.log('\n' + '=' * 60);
    console.log('🌐 BROWSER E2E TEST RESULTS');
    console.log('=' * 60);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
    
    return { passed, failed, results: this.results };
  }
}

// Запуск тестов
const tester = new BrowserE2ETester();
await tester.runBrowserTests();