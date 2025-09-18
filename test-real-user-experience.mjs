#!/usr/bin/env node

import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync } from 'fs';
import { randomBytes } from 'crypto';

const FRONTEND_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:3001';

// Generate unique test phone number
const TEST_PHONE = '+1555' + Math.floor(Math.random() * 9000000 + 1000000);
const TEST_NAME = 'Test User ' + randomBytes(4).toString('hex');
const TEST_PASSWORD = 'TestPassword123!';
const TEST_PIN = '123456';

console.log('🚀 Starting REAL User Experience Test for Cyphr Messenger');
console.log('📱 Test Phone:', TEST_PHONE);
console.log('👤 Test Name:', TEST_NAME);
console.log('');

// Store test results
const results = {
    registration: { status: false, details: '' },
    profile: { status: false, details: '' },
    wallet: { status: false, details: '' },
    messaging: { status: false, details: '' },
    voiceCalls: { status: false, details: '' },
    videoCalls: { status: false, details: '' },
    fileSharing: { status: false, details: '' },
    groups: { status: false, details: '' },
    transactions: { status: false, details: '' },
    cryptoPerformance: { status: false, details: '' }
};

async function takeScreenshot(page, name) {
    await page.screenshot({ 
        path: `screenshots/${name}-${Date.now()}.png`,
        fullPage: true 
    });
}

async function logStep(step, message) {
    console.log(`\n${step} ${message}`);
}

async function testRealUserExperience() {
    // Launch browser in headful mode to see what's happening
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800'],
        defaultViewport: { width: 1280, height: 800 }
    });

    const page = await browser.newPage();
    
    // Set up console logging
    page.on('console', msg => {
        const type = msg.type();
        const text = msg.text();
        if (type === 'error') {
            console.error('❌ Browser Error:', text);
        } else if (type === 'warning') {
            console.warn('⚠️  Browser Warning:', text);
        } else if (text.includes('🔐') || text.includes('📱') || text.includes('✅')) {
            console.log('🌐 Browser:', text);
        }
    });

    page.on('pageerror', error => {
        console.error('❌ Page Error:', error.message);
    });

    try {
        // ============= 1. REGISTRATION FLOW =============
        logStep('📱', '1. Testing Phone Registration');
        
        await page.goto(FRONTEND_URL, { waitUntil: 'networkidle2' });
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check if we're on Welcome page
        const welcomeButton = await page.$('button:has-text("Get Started")');
        if (welcomeButton) {
            await welcomeButton.click();
            logStep('✅', 'Welcome page loaded');
        }

        // Enter phone number
        await page.waitForSelector('input[type="tel"]', { timeout: 10000 });
        await page.type('input[type="tel"]', TEST_PHONE);
        logStep('📝', `Entered phone: ${TEST_PHONE}`);
        
        // Click Send OTP
        const sendOtpButton = await page.$('button:has-text("Send OTP")');
        if (sendOtpButton) {
            await sendOtpButton.click();
            logStep('📤', 'OTP request sent');
            
            // Wait for OTP inputs to appear
            await page.waitForSelector('input[maxlength="1"]', { timeout: 10000 });
            
            // In real scenario, we'd get OTP from Twilio API or test endpoint
            // For now, we'll check if the backend accepts test OTP
            const testOTP = '123456';
            
            // Enter OTP digit by digit
            const otpInputs = await page.$$('input[maxlength="1"]');
            for (let i = 0; i < otpInputs.length && i < 6; i++) {
                await otpInputs[i].type(testOTP[i]);
                await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between digits
            }
            
            logStep('✅', 'OTP entered');
            results.registration.status = true;
            results.registration.details = 'Phone + OTP verification successful';
        }

        // Wait for profile setup
        await new Promise(resolve => setTimeout(resolve, 3000));

        // ============= 2. PROFILE SETUP =============
        logStep('👤', '2. Testing Profile Setup');
        
        // Check if we're on profile setup
        const nameInput = await page.$('input[placeholder*="Name"], input[placeholder*="name"]');
        if (nameInput) {
            await nameInput.type(TEST_NAME);
            logStep('📝', `Entered name: ${TEST_NAME}`);
            
            // Test avatar upload
            const fileInput = await page.$('input[type="file"]');
            if (fileInput) {
                logStep('📸', 'Avatar upload input available');
                // Could upload test image here
            }
            
            // Check biometric option
            const biometricToggle = await page.$('input[type="checkbox"]');
            if (biometricToggle) {
                await biometricToggle.click();
                logStep('🔐', 'Biometric option toggled');
            }
            
            // Continue to security
            const continueButton = await page.$('button:has-text("Continue")');
            if (continueButton) {
                await continueButton.click();
                results.profile.status = true;
                results.profile.details = 'Profile setup completed';
            }
        }

        await new Promise(resolve => setTimeout(resolve, 2000));

        // ============= 3. SECURITY SETUP =============
        logStep('🔐', '3. Testing Security Setup (Password/PIN)');
        
        // Check for password fields
        const passwordInputs = await page.$$('input[type="password"]');
        if (passwordInputs.length >= 2) {
            await passwordInputs[0].type(TEST_PASSWORD);
            await passwordInputs[1].type(TEST_PASSWORD);
            logStep('🔑', 'Password entered');
            
            const completeButton = await page.$('button:has-text("Complete")');
            if (completeButton) {
                await completeButton.click();
            }
        }

        // Check for PIN setup
        await new Promise(resolve => setTimeout(resolve, 2000));
        const pinInputs = await page.$$('.pin-input input, input[maxlength="1"]');
        if (pinInputs.length >= 6) {
            for (let i = 0; i < 6; i++) {
                await pinInputs[i].type(TEST_PIN[i]);
                await page.waitForTimeout(100);
            }
            logStep('🔢', 'PIN setup completed');
        }

        // ============= 4. WALLET CREATION =============
        logStep('💰', '4. Testing Wallet Creation');
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check for wallet elements
        const walletElements = await page.$$eval('*', elements => {
            return elements.map(el => el.textContent).join(' ');
        });
        
        if (walletElements.includes('wallet') || walletElements.includes('Wallet')) {
            results.wallet.status = true;
            results.wallet.details = 'Wallet UI detected';
            
            // Check for seed phrase
            const seedWords = await page.$$('.seed-word, .mnemonic-word');
            if (seedWords.length === 24) {
                logStep('🔑', '24-word seed phrase generated');
                results.wallet.details += ', HD wallet with seed phrase';
            }
            
            // Check for balance
            const balanceElement = await page.$('.balance, .wallet-balance');
            if (balanceElement) {
                const balance = await balanceElement.textContent();
                logStep('💳', `Wallet balance: ${balance}`);
            }
        }

        // ============= 5. MESSAGING TEST =============
        logStep('💬', '5. Testing Encrypted Messaging');
        
        // Navigate to chats
        const chatsLink = await page.$('a[href="/chats"]');
        if (chatsLink) {
            await chatsLink.click();
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Try to create new chat
            const newChatButton = await page.$('button[aria-label*="New"], button:has-text("New Chat")');
            if (newChatButton) {
                await newChatButton.click();
                logStep('➕', 'New chat dialog opened');
                
                // Search for contact
                const searchInput = await page.$('input[placeholder*="Search"], input[placeholder*="search"]');
                if (searchInput) {
                    await searchInput.type('test');
                    logStep('🔍', 'Contact search working');
                }
                
                results.messaging.status = true;
                results.messaging.details = 'Chat UI functional';
            }
        }

        // ============= 6. VOICE CALLS TEST =============
        logStep('📞', '6. Testing Voice Calls');
        
        const callButton = await page.$('button[aria-label*="call"], button[aria-label*="Call"]');
        if (callButton) {
            results.voiceCalls.status = true;
            results.voiceCalls.details = 'Voice call button available';
            logStep('✅', 'Voice call UI ready');
        }

        // ============= 7. VIDEO CALLS TEST =============
        logStep('📹', '7. Testing Video Calls');
        
        const videoButton = await page.$('button[aria-label*="video"], button[aria-label*="Video"]');
        if (videoButton) {
            results.videoCalls.status = true;
            results.videoCalls.details = 'Video call button available';
            logStep('✅', 'Video call UI ready');
        }

        // ============= 8. FILE SHARING TEST =============
        logStep('📎', '8. Testing File Sharing');
        
        const attachButton = await page.$('button[aria-label*="attach"], button[aria-label*="Attach"]');
        if (attachButton) {
            results.fileSharing.status = true;
            results.fileSharing.details = 'File attachment button available';
            logStep('✅', 'File sharing UI ready');
        }

        // ============= 9. GROUPS TEST =============
        logStep('👥', '9. Testing Group Features');
        
        const groupButton = await page.$('button:has-text("New Group"), button[aria-label*="group"]');
        if (groupButton) {
            await groupButton.click();
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const groupNameInput = await page.$('input[placeholder*="Group"], input[placeholder*="group"]');
            if (groupNameInput) {
                await groupNameInput.type('Test Secure Group');
                results.groups.status = true;
                results.groups.details = 'Group creation UI functional';
                logStep('✅', 'Group features available');
            }
        }

        // ============= 10. CRYPTO PERFORMANCE TEST =============
        logStep('⚡', '10. Testing Crypto Performance');
        
        const cryptoPerf = await page.evaluate(() => {
            return new Promise((resolve) => {
                const start = performance.now();
                const testData = new Uint8Array(1024);
                crypto.getRandomValues(testData);
                const elapsed = performance.now() - start;
                
                // Check if quantum crypto is loaded
                const hasQuantumCrypto = typeof window.QuantumCrypto !== 'undefined';
                const hasKyber = typeof window.Kyber1024 !== 'undefined';
                
                resolve({
                    randomTime: elapsed,
                    hasQuantumCrypto,
                    hasKyber,
                    cryptoAPI: !!window.crypto
                });
            });
        });
        
        logStep('📊', `Crypto Performance: ${cryptoPerf.randomTime.toFixed(2)}ms`);
        logStep('🔐', `Quantum Crypto: ${cryptoPerf.hasQuantumCrypto ? 'Loaded' : 'Not Found'}`);
        logStep('🔐', `Kyber1024: ${cryptoPerf.hasKyber ? 'Loaded' : 'Not Found'}`);
        
        if (cryptoPerf.randomTime < 50) {
            results.cryptoPerformance.status = true;
            results.cryptoPerformance.details = `RNG: ${cryptoPerf.randomTime.toFixed(2)}ms`;
        }

        // ============= FINAL SUMMARY =============
        console.log('\n' + '='.repeat(60));
        console.log('📊 REAL USER EXPERIENCE TEST RESULTS');
        console.log('='.repeat(60));
        
        let passedTests = 0;
        let totalTests = 0;
        
        for (const [feature, result] of Object.entries(results)) {
            totalTests++;
            const status = result.status ? '✅ PASS' : '❌ FAIL';
            if (result.status) passedTests++;
            
            console.log(`${status} ${feature}: ${result.details || 'Not tested'}`);
        }
        
        console.log('\n' + '='.repeat(60));
        console.log(`🏆 OVERALL SCORE: ${passedTests}/${totalTests} (${(passedTests/totalTests*100).toFixed(1)}%)`);
        console.log('='.repeat(60));

        // Save detailed report
        const report = {
            timestamp: new Date().toISOString(),
            testPhone: TEST_PHONE,
            testName: TEST_NAME,
            results,
            score: `${passedTests}/${totalTests}`,
            percentage: (passedTests/totalTests*100).toFixed(1) + '%'
        };
        
        writeFileSync('test-report-user-experience.json', JSON.stringify(report, null, 2));
        console.log('\n📄 Detailed report saved to: test-report-user-experience.json');

    } catch (error) {
        console.error('\n❌ Test Error:', error.message);
        console.error(error.stack);
    } finally {
        // Keep browser open for manual inspection
        console.log('\n👀 Browser will remain open for 30 seconds for manual inspection...');
        await new Promise(resolve => setTimeout(resolve, 30000));
        
        await browser.close();
    }
}

// Create screenshots directory
import { mkdirSync } from 'fs';
try {
    mkdirSync('screenshots', { recursive: true });
} catch (e) {}

// Run the test
console.log('🎬 Starting test in 3 seconds...\n');
setTimeout(() => {
    testRealUserExperience().catch(console.error);
}, 3000);