#!/usr/bin/env node

import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { randomBytes } from 'crypto';

const FRONTEND_URL = 'http://localhost:5173';

// Test data
const TEST_PHONE = '+1234567890'; // Will use test mode
const TEST_NAME = 'Test User ' + randomBytes(4).toString('hex');
const TEST_PASSWORD = 'TestPassword123!';
const TEST_PIN = '123456';

console.log('🚀 Starting FULL User Flow Test for Cyphr Messenger');
console.log('📱 Test Mode: Using mock OTP for testing');
console.log('');

// Create screenshots directory
try {
    mkdirSync('screenshots', { recursive: true });
} catch (e) {}

// Test tracking
const testResults = {
    steps: [],
    errors: [],
    warnings: [],
    performance: []
};

function logStep(emoji, message, details = '') {
    const timestamp = new Date().toISOString();
    console.log(`${emoji} ${message}${details ? ': ' + details : ''}`);
    testResults.steps.push({ timestamp, emoji, message, details });
}

function logError(message, error) {
    console.error(`❌ ${message}:`, error.message || error);
    testResults.errors.push({ message, error: error.message || error });
}

function logWarning(message) {
    console.warn(`⚠️  ${message}`);
    testResults.warnings.push({ message });
}

async function testFullUserFlow() {
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800'],
        defaultViewport: { width: 1280, height: 800 }
    });

    const page = await browser.newPage();
    
    // Track console messages
    page.on('console', msg => {
        const text = msg.text();
        if (msg.type() === 'error' && !text.includes('Failed to initialize crypto')) {
            logError('Browser Console', text);
        } else if (text.includes('✅') || text.includes('🔐') || text.includes('📱')) {
            console.log('   🌐', text);
        }
    });

    // Track performance
    page.on('metrics', ({ title, metrics }) => {
        if (metrics.TaskDuration > 1000) {
            logWarning(`Slow task detected: ${title} (${metrics.TaskDuration}ms)`);
        }
    });

    try {
        // ============= STAGE 1: WELCOME & REGISTRATION =============
        logStep('🎬', 'STAGE 1: Welcome & Registration Flow');
        
        await page.goto(FRONTEND_URL, { waitUntil: 'networkidle2' });
        await page.screenshot({ path: 'screenshots/1-welcome.png' });
        
        // Check for welcome screen
        try {
            await page.waitForSelector('button', { timeout: 5000 });
            const buttons = await page.$$eval('button', btns => btns.map(b => b.textContent));
            logStep('📋', 'Available buttons', buttons.join(', '));
            
            // Click Get Started if available
            const getStartedBtn = await page.$('button:has-text("Get Started")');
            if (getStartedBtn) {
                await getStartedBtn.click();
                logStep('✅', 'Clicked Get Started');
            }
        } catch (e) {
            logWarning('No Get Started button found, might already be on phone input');
        }

        // Phone number input
        await page.waitForSelector('input[type="tel"]', { timeout: 10000 });
        await page.screenshot({ path: 'screenshots/2-phone-input.png' });
        
        // For testing, we'll use a mock flow
        logStep('📱', 'Entering test phone number');
        await page.type('input[type="tel"]', TEST_PHONE);
        
        // Try to find and click Send OTP
        const sendOtpSelectors = [
            'button:has-text("Send OTP")',
            'button:has-text("Send Code")',
            'button:has-text("Continue")',
            'button[type="submit"]'
        ];
        
        let otpSent = false;
        for (const selector of sendOtpSelectors) {
            const btn = await page.$(selector);
            if (btn) {
                await btn.click();
                logStep('📤', 'OTP request triggered');
                otpSent = true;
                break;
            }
        }
        
        if (!otpSent) {
            throw new Error('Could not find Send OTP button');
        }

        // Wait for OTP inputs
        await page.waitForSelector('input[maxlength="1"]', { timeout: 10000 });
        await page.screenshot({ path: 'screenshots/3-otp-input.png' });
        
        // Enter test OTP
        const otpInputs = await page.$$('input[maxlength="1"]');
        logStep('🔢', `Found ${otpInputs.length} OTP input fields`);
        
        const testOTP = '123456';
        for (let i = 0; i < otpInputs.length && i < 6; i++) {
            await otpInputs[i].click();
            await otpInputs[i].type(testOTP[i]);
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        logStep('✅', 'OTP entered');

        // ============= STAGE 2: PROFILE SETUP =============
        await new Promise(resolve => setTimeout(resolve, 3000));
        logStep('🎬', 'STAGE 2: Profile Setup');
        
        // Look for name input
        const nameSelectors = [
            'input[placeholder*="Name"]',
            'input[placeholder*="name"]',
            'input[type="text"]'
        ];
        
        let nameEntered = false;
        for (const selector of nameSelectors) {
            const input = await page.$(selector);
            if (input) {
                await input.click();
                await input.type(TEST_NAME);
                nameEntered = true;
                logStep('✅', 'Name entered', TEST_NAME);
                break;
            }
        }
        
        await page.screenshot({ path: 'screenshots/4-profile-setup.png' });
        
        // Check for avatar upload
        const fileInput = await page.$('input[type="file"]');
        if (fileInput) {
            logStep('📸', 'Avatar upload available');
        }
        
        // Check for biometric option
        const biometricCheckbox = await page.$('input[type="checkbox"]');
        if (biometricCheckbox) {
            const isChecked = await page.$eval('input[type="checkbox"]', el => el.checked);
            logStep('🔐', 'Biometric option', isChecked ? 'enabled' : 'available');
        }
        
        // Continue
        const continueBtn = await page.$('button:has-text("Continue")');
        if (continueBtn) {
            await continueBtn.click();
            logStep('➡️', 'Continued to next step');
        }

        // ============= STAGE 3: SECURITY (PASSWORD/PIN) =============
        await new Promise(resolve => setTimeout(resolve, 2000));
        logStep('🎬', 'STAGE 3: Security Setup');
        
        // Password setup
        const passwordInputs = await page.$$('input[type="password"]');
        if (passwordInputs.length >= 2) {
            await passwordInputs[0].type(TEST_PASSWORD);
            await passwordInputs[1].type(TEST_PASSWORD);
            logStep('🔑', 'Password set');
            
            await page.screenshot({ path: 'screenshots/5-password-setup.png' });
            
            // Complete registration
            const completeBtn = await page.$('button:has-text("Complete")');
            if (completeBtn) {
                await completeBtn.click();
                logStep('✅', 'Registration completed');
            }
        }

        // ============= STAGE 4: WALLET & MAIN APP =============
        await new Promise(resolve => setTimeout(resolve, 3000));
        logStep('🎬', 'STAGE 4: Wallet & Main App Features');
        
        // Check current page
        const currentUrl = page.url();
        logStep('📍', 'Current location', currentUrl);
        
        await page.screenshot({ path: 'screenshots/6-main-app.png' });
        
        // Check for wallet elements
        const pageContent = await page.content();
        const hasWallet = pageContent.includes('wallet') || pageContent.includes('Wallet');
        const hasBalance = pageContent.includes('balance') || pageContent.includes('Balance');
        const hasChats = pageContent.includes('chat') || pageContent.includes('Chat');
        
        logStep('💰', 'Wallet detected', hasWallet ? 'Yes' : 'No');
        logStep('💳', 'Balance display', hasBalance ? 'Yes' : 'No');
        logStep('💬', 'Chat interface', hasChats ? 'Yes' : 'No');

        // ============= STAGE 5: FEATURE TESTING =============
        logStep('🎬', 'STAGE 5: Testing Core Features');
        
        // Test navigation
        const navItems = await page.$$('nav a, .bottom-nav a, [role="navigation"] a');
        logStep('🧭', 'Navigation items found', navItems.length);
        
        // Check for key features
        const features = {
            messaging: await page.$('button[aria-label*="message"], button[aria-label*="chat"]'),
            calls: await page.$('button[aria-label*="call"], button[aria-label*="Call"]'),
            video: await page.$('button[aria-label*="video"], button[aria-label*="Video"]'),
            files: await page.$('button[aria-label*="attach"], button[aria-label*="file"]'),
            groups: await page.$('button:has-text("Group"), button[aria-label*="group"]'),
            wallet: await page.$('a[href*="wallet"], button:has-text("Wallet")')
        };
        
        for (const [feature, element] of Object.entries(features)) {
            logStep(element ? '✅' : '❌', `${feature} feature`, element ? 'Available' : 'Not found');
        }

        // ============= STAGE 6: CRYPTO PERFORMANCE =============
        logStep('🎬', 'STAGE 6: Testing Crypto Performance');
        
        const cryptoPerf = await page.evaluate(() => {
            const tests = {
                randomGeneration: 0,
                cryptoAvailable: false,
                quantumCrypto: false,
                kyber1024: false
            };
            
            // Test random generation
            const start = performance.now();
            const data = new Uint8Array(1024);
            crypto.getRandomValues(data);
            tests.randomGeneration = performance.now() - start;
            
            // Check crypto availability
            tests.cryptoAvailable = !!window.crypto;
            tests.quantumCrypto = typeof window.QuantumCrypto !== 'undefined';
            tests.kyber1024 = typeof window.Kyber1024 !== 'undefined';
            
            return tests;
        });
        
        logStep('⚡', 'Random generation', `${cryptoPerf.randomGeneration.toFixed(2)}ms`);
        logStep(cryptoPerf.cryptoAvailable ? '✅' : '❌', 'WebCrypto API', cryptoPerf.cryptoAvailable ? 'Available' : 'Not found');
        logStep(cryptoPerf.quantumCrypto ? '✅' : '❌', 'Quantum Crypto', cryptoPerf.quantumCrypto ? 'Loaded' : 'Not found');
        logStep(cryptoPerf.kyber1024 ? '✅' : '❌', 'Kyber1024', cryptoPerf.kyber1024 ? 'Loaded' : 'Not found');

        // ============= FINAL REPORT =============
        console.log('\n' + '='.repeat(70));
        console.log('📊 COMPLETE USER EXPERIENCE TEST REPORT');
        console.log('='.repeat(70));
        
        console.log('\n📝 Test Summary:');
        console.log(`   Total Steps: ${testResults.steps.length}`);
        console.log(`   Errors: ${testResults.errors.length}`);
        console.log(`   Warnings: ${testResults.warnings.length}`);
        
        if (testResults.errors.length > 0) {
            console.log('\n❌ Errors:');
            testResults.errors.forEach(err => {
                console.log(`   - ${err.message}: ${err.error}`);
            });
        }
        
        if (testResults.warnings.length > 0) {
            console.log('\n⚠️  Warnings:');
            testResults.warnings.forEach(warn => {
                console.log(`   - ${warn.message}`);
            });
        }
        
        // Save detailed report
        const report = {
            timestamp: new Date().toISOString(),
            testData: { phone: TEST_PHONE, name: TEST_NAME },
            results: testResults,
            cryptoPerformance: cryptoPerf,
            screenshots: [
                '1-welcome.png',
                '2-phone-input.png', 
                '3-otp-input.png',
                '4-profile-setup.png',
                '5-password-setup.png',
                '6-main-app.png'
            ]
        };
        
        writeFileSync('test-report-full-flow.json', JSON.stringify(report, null, 2));
        console.log('\n📄 Detailed report saved to: test-report-full-flow.json');
        console.log('📸 Screenshots saved to: screenshots/');
        
    } catch (error) {
        logError('Test failed', error);
        await page.screenshot({ path: 'screenshots/error-state.png' });
    } finally {
        console.log('\n⏱️  Keeping browser open for 15 seconds for inspection...');
        await new Promise(resolve => setTimeout(resolve, 15000));
        await browser.close();
    }
}

// Run the test
console.log('🎬 Starting test in 3 seconds...\n');
setTimeout(() => {
    testFullUserFlow().catch(console.error);
}, 3000);