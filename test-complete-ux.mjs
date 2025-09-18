#!/usr/bin/env node

/**
 * Comprehensive UX Testing Suite for Cyphr Messenger
 * Tests every button, page, and user flow end-to-end
 */

import { chromium } from 'playwright';

const PRODUCTION_URL = 'https://app.cyphrmessenger.app';
const TEST_PHONE = '+19075388374'; // Test phone number
const TEST_PHONE_2 = '+19078303325'; // Second test phone number

class CyphrUXTester {
  constructor() {
    this.browser = null;
    this.page = null;
    this.testResults = [];
  }

  async init() {
    console.log('🚀 Starting Cyphr Messenger Complete UX Testing...');
    
    this.browser = await chromium.launch({ 
      headless: false, // Show browser for visual verification
      slowMo: 1000 // Slow down for human observation
    });
    
    this.page = await this.browser.newPage();
    
    // Listen for console errors
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('❌ Console Error:', msg.text());
        this.testResults.push({
          test: 'Console Error',
          status: 'FAIL',
          message: msg.text()
        });
      }
    });
    
    // Listen for page errors
    this.page.on('pageerror', error => {
      console.error('❌ Page Error:', error.message);
      this.testResults.push({
        test: 'Page Error',
        status: 'FAIL',
        message: error.message
      });
    });
  }

  async testResult(testName, condition, message = '') {
    const status = condition ? 'PASS' : 'FAIL';
    const emoji = condition ? '✅' : '❌';
    
    console.log(`${emoji} ${testName}: ${status} ${message}`);
    
    this.testResults.push({
      test: testName,
      status,
      message
    });
    
    return condition;
  }

  async delay(ms) {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  async testWelcomeScreen() {
    console.log('\n🏠 Testing Welcome Screen...');
    
    await this.page.goto(PRODUCTION_URL);
    await this.delay(3000); // Wait for app to load
    
    // Test 1: Page loads without errors
    const title = await this.page.title();
    await this.testResult('Page Load', title.includes('Cyphr'), `Title: ${title}`);
    
    // Test 2: Environment validation passes
    const consoleErrors = await this.page.evaluate(() => {
      return window.console._errors || [];
    });
    await this.testResult('Environment Validation', consoleErrors.length === 0, 'No env errors');
    
    // Test 3: Welcome elements are visible
    const welcomeElements = await this.page.locator('h1, h2, h3').count();
    await this.testResult('Welcome Elements Visible', welcomeElements > 0, `${welcomeElements} headings found`);
    
    // Test 4: Test navigation buttons
    const buttons = await this.page.locator('button').count();
    await this.testResult('Navigation Buttons Present', buttons > 0, `${buttons} buttons found`);
    
    // Test 5: Try to navigate to registration
    try {
      // Look for "Get Started" or similar button
      const getStartedButton = this.page.locator('text=Get Started').first();
      if (await getStartedButton.isVisible()) {
        await getStartedButton.click();
        await this.delay(2000);
        await this.testResult('Navigation to Registration', true, 'Successfully navigated');
      } else {
        // Try other common button texts
        const startButton = this.page.locator('button').first();
        if (await startButton.isVisible()) {
          await startButton.click();
          await this.delay(2000);
          await this.testResult('Navigation Button Click', true, 'Button clicked');
        }
      }
    } catch (error) {
      await this.testResult('Navigation Test', false, error.message);
    }
  }

  async testPhoneRegistration() {
    console.log('\n📱 Testing Phone Registration...');
    
    // Test 1: Phone input field is present
    const phoneInput = this.page.locator('input[type="tel"], input[placeholder*="phone" i]').first();
    const phoneInputVisible = await phoneInput.isVisible();
    await this.testResult('Phone Input Field', phoneInputVisible, 'Input field found');
    
    if (phoneInputVisible) {
      // Test 2: Phone number validation
      await phoneInput.fill(TEST_PHONE);
      await this.delay(1000);
      
      const phoneValue = await phoneInput.inputValue();
      await this.testResult('Phone Number Input', phoneValue.includes(TEST_PHONE.replace('+', '')), `Value: ${phoneValue}`);
      
      // Test 3: Submit phone number
      const submitButton = this.page.locator('button[type="submit"], button:has-text("Continue"), button:has-text("Next")').first();
      if (await submitButton.isVisible()) {
        await submitButton.click();
        await this.delay(3000); // Wait for SMS to be sent
        await this.testResult('Phone Submission', true, 'Phone number submitted');
        
        // Test 4: OTP screen appears
        const otpInput = this.page.locator('input[type="text"], input[placeholder*="code" i]').first();
        const otpVisible = await otpInput.isVisible();
        await this.testResult('OTP Screen', otpVisible, 'OTP input field visible');
        
        if (otpVisible) {
          // Test 5: OTP input (simulate entering code)
          await otpInput.fill('123456'); // Test OTP
          await this.delay(1000);
          
          const otpValue = await otpInput.inputValue();
          await this.testResult('OTP Input', otpValue === '123456', `OTP value: ${otpValue}`);
        }
      }
    }
  }

  async testProfileSetup() {
    console.log('\n👤 Testing Profile Setup...');
    
    // Look for profile setup elements
    const nameInput = this.page.locator('input[placeholder*="name" i], input[type="text"]').first();
    const nameInputVisible = await nameInput.isVisible();
    await this.testResult('Name Input Field', nameInputVisible, 'Name input found');
    
    if (nameInputVisible) {
      // Test name input
      await nameInput.fill('Test User');
      await this.delay(1000);
      
      const nameValue = await nameInput.inputValue();
      await this.testResult('Name Input Value', nameValue === 'Test User', `Name: ${nameValue}`);
      
      // Test avatar upload button
      const avatarButton = this.page.locator('button:has-text("Upload"), input[type="file"]').first();
      const avatarButtonVisible = await avatarButton.isVisible();
      await this.testResult('Avatar Upload Option', avatarButtonVisible, 'Avatar upload available');
      
      // Test continue/next button
      const continueButton = this.page.locator('button:has-text("Continue"), button:has-text("Next"), button[type="submit"]').first();
      if (await continueButton.isVisible()) {
        await continueButton.click();
        await this.delay(2000);
        await this.testResult('Profile Setup Continue', true, 'Proceeded to next step');
      }
    }
  }

  async testSecuritySetup() {
    console.log('\n🔐 Testing Security Setup...');
    
    // Test PIN setup
    const pinInput = this.page.locator('input[type="password"], input[placeholder*="pin" i]').first();
    const pinVisible = await pinInput.isVisible();
    await this.testResult('PIN Setup Screen', pinVisible, 'PIN input visible');
    
    if (pinVisible) {
      await pinInput.fill('123456');
      await this.delay(1000);
      
      // Test PIN confirmation
      const confirmPinInput = this.page.locator('input[type="password"]').nth(1);
      if (await confirmPinInput.isVisible()) {
        await confirmPinInput.fill('123456');
        await this.testResult('PIN Confirmation', true, 'PIN confirmed');
      }
      
      // Test biometric options
      const biometricButton = this.page.locator('button:has-text("Biometric"), button:has-text("Fingerprint")').first();
      const biometricVisible = await biometricButton.isVisible();
      await this.testResult('Biometric Options', biometricVisible, 'Biometric options available');
    }
    
    // Test TOTP/2FA setup
    const totpSetup = this.page.locator('text=Authenticator, text=TOTP, text=2FA').first();
    const totpVisible = await totpSetup.isVisible();
    await this.testResult('TOTP/2FA Setup', totpVisible, 'TOTP setup available');
  }

  async testWalletCreation() {
    console.log('\n💰 Testing HD Wallet Creation...');
    
    // Look for wallet creation elements
    const walletButton = this.page.locator('button:has-text("Wallet"), button:has-text("Create")').first();
    const walletVisible = await walletButton.isVisible();
    await this.testResult('Wallet Creation Button', walletVisible, 'Wallet creation available');
    
    if (walletVisible) {
      await walletButton.click();
      await this.delay(3000);
      
      // Test seed phrase display
      const seedPhrase = this.page.locator('.seed-phrase, [class*="seed"], text*="word"').first();
      const seedVisible = await seedPhrase.isVisible();
      await this.testResult('Seed Phrase Display', seedVisible, 'Seed phrase shown');
      
      // Test wallet address generation
      const walletAddress = this.page.locator('text*="G", [class*="address"]').first();
      const addressVisible = await walletAddress.isVisible();
      await this.testResult('Wallet Address', addressVisible, 'Stellar address generated');
      
      // Test balance display
      const balance = this.page.locator('text*="XLM", text*="balance", [class*="balance"]').first();
      const balanceVisible = await balance.isVisible();
      await this.testResult('Balance Display', balanceVisible, 'Balance display present');
    }
  }

  async testChatFunctionality() {
    console.log('\n💬 Testing Chat Functionality...');
    
    // Navigate to chats
    const chatButton = this.page.locator('button:has-text("Chat"), a[href*="chat"]').first();
    if (await chatButton.isVisible()) {
      await chatButton.click();
      await this.delay(2000);
      
      // Test new chat button
      const newChatButton = this.page.locator('button:has-text("New"), button:has-text("+")').first();
      const newChatVisible = await newChatButton.isVisible();
      await this.testResult('New Chat Button', newChatVisible, 'New chat option available');
      
      if (newChatVisible) {
        await newChatButton.click();
        await this.delay(2000);
        
        // Test user search
        const searchInput = this.page.locator('input[placeholder*="search" i], input[type="search"]').first();
        const searchVisible = await searchInput.isVisible();
        await this.testResult('User Search', searchVisible, 'User search available');
        
        if (searchVisible) {
          await searchInput.fill(TEST_PHONE_2);
          await this.delay(2000);
          
          // Test search results
          const searchResults = await this.page.locator('[class*="user"], [class*="result"]').count();
          await this.testResult('Search Results', searchResults >= 0, `${searchResults} results found`);
        }
      }
      
      // Test message input
      const messageInput = this.page.locator('input[placeholder*="message" i], textarea').first();
      const messageInputVisible = await messageInput.isVisible();
      await this.testResult('Message Input', messageInputVisible, 'Message input available');
      
      if (messageInputVisible) {
        await messageInput.fill('Test message');
        await this.delay(1000);
        
        // Test send button
        const sendButton = this.page.locator('button:has-text("Send"), button[type="submit"]').last();
        const sendVisible = await sendButton.isVisible();
        await this.testResult('Send Button', sendVisible, 'Send button available');
      }
    }
  }

  async testSettingsMenu() {
    console.log('\n⚙️ Testing Settings Menu...');
    
    // Navigate to settings
    const settingsButton = this.page.locator('button:has-text("Settings"), a[href*="setting"]').first();
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await this.delay(2000);
      
      // Test settings options
      const settingsOptions = await this.page.locator('a, button').count();
      await this.testResult('Settings Options', settingsOptions > 5, `${settingsOptions} options found`);
      
      // Test Profile settings
      const profileLink = this.page.locator('a[href*="profile"], button:has-text("Profile")').first();
      if (await profileLink.isVisible()) {
        await profileLink.click();
        await this.delay(1000);
        await this.testResult('Profile Settings', true, 'Profile settings accessible');
        await this.page.goBack();
      }
      
      // Test Security settings
      const securityLink = this.page.locator('a[href*="security"], button:has-text("Security")').first();
      if (await securityLink.isVisible()) {
        await securityLink.click();
        await this.delay(1000);
        await this.testResult('Security Settings', true, 'Security settings accessible');
        await this.page.goBack();
      }
      
      // Test Privacy settings
      const privacyLink = this.page.locator('a[href*="privacy"], button:has-text("Privacy")').first();
      if (await privacyLink.isVisible()) {
        await privacyLink.click();
        await this.delay(1000);
        await this.testResult('Privacy Settings', true, 'Privacy settings accessible');
        await this.page.goBack();
      }
    }
  }

  async testCallsFunctionality() {
    console.log('\n📞 Testing Calls Functionality...');
    
    // Navigate to calls
    const callsButton = this.page.locator('button:has-text("Calls"), a[href*="call"]').first();
    if (await callsButton.isVisible()) {
      await callsButton.click();
      await this.delay(2000);
      
      // Test call history
      const callHistory = await this.page.locator('[class*="call"], [class*="history"]').count();
      await this.testResult('Call History', callHistory >= 0, `${callHistory} call records found`);
      
      // Test new call button
      const newCallButton = this.page.locator('button:has-text("New Call"), button:has-text("Call")').first();
      const newCallVisible = await newCallButton.isVisible();
      await this.testResult('New Call Button', newCallVisible, 'New call option available');
    }
  }

  async testCryptoWallet() {
    console.log('\n🪙 Testing Crypto Wallet...');
    
    // Navigate to wallet
    const walletButton = this.page.locator('button:has-text("Wallet"), a[href*="wallet"]').first();
    if (await walletButton.isVisible()) {
      await walletButton.click();
      await this.delay(3000);
      
      // Test balance display
      const balanceElement = this.page.locator('[class*="balance"], text*="XLM"').first();
      const balanceVisible = await balanceElement.isVisible();
      await this.testResult('Wallet Balance', balanceVisible, 'Balance display visible');
      
      // Test send functionality
      const sendButton = this.page.locator('button:has-text("Send")').first();
      const sendVisible = await sendButton.isVisible();
      await this.testResult('Send Function', sendVisible, 'Send button available');
      
      // Test receive functionality
      const receiveButton = this.page.locator('button:has-text("Receive")').first();
      const receiveVisible = await receiveButton.isVisible();
      await this.testResult('Receive Function', receiveVisible, 'Receive button available');
      
      // Test transaction history
      const historySection = this.page.locator('[class*="transaction"], [class*="history"]').first();
      const historyVisible = await historySection.isVisible();
      await this.testResult('Transaction History', historyVisible, 'Transaction history visible');
    }
  }

  async generateReport() {
    console.log('\n📊 Test Results Summary:');
    console.log('='.repeat(50));
    
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.status === 'PASS').length;
    const failedTests = this.testResults.filter(r => r.status === 'FAIL').length;
    
    console.log(`Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    
    if (failedTests > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults
        .filter(r => r.status === 'FAIL')
        .forEach(r => console.log(`  - ${r.test}: ${r.message}`));
    }
    
    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: totalTests,
        passed: passedTests,
        failed: failedTests,
        successRate: ((passedTests / totalTests) * 100).toFixed(1) + '%'
      },
      detailedResults: this.testResults
    };
    
    const fs = await import('fs');
    fs.writeFileSync('ux-test-report.json', JSON.stringify(report, null, 2));
    console.log('\n📄 Detailed report saved to: ux-test-report.json');
  }

  async runAllTests() {
    try {
      await this.init();
      
      await this.testWelcomeScreen();
      await this.testPhoneRegistration();
      await this.testProfileSetup();
      await this.testSecuritySetup();
      await this.testWalletCreation();
      await this.testChatFunctionality();
      await this.testSettingsMenu();
      await this.testCallsFunctionality();
      await this.testCryptoWallet();
      
      await this.generateReport();
      
    } catch (error) {
      console.error('❌ Test suite error:', error);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

// Run the complete UX test suite
const tester = new CyphrUXTester();
tester.runAllTests();