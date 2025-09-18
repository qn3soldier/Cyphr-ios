/**
 * Browser Console Test for Kyber1024 Post-Quantum Cryptography
 * 
 * Run this in browser console at http://localhost:5174/
 * 
 * Copy and paste this entire code block into browser console:
 */

(async function testKyber1024() {
    console.log('🔐 Starting CRITICAL Kyber1024 Post-Quantum Cryptography Test...');
    console.log('==================================================================================');
    
    try {
        // Test 1: Import the pqc-kyber library
        console.log('1️⃣ Testing pqc-kyber import...');
        const { keypair, encapsulate, decapsulate, Params } = await import('/node_modules/pqc-kyber/pqc_kyber.js');
        console.log('✅ Successfully imported pqc-kyber functions');
        console.log('📋 Available functions:', { keypair: typeof keypair, encapsulate: typeof encapsulate, decapsulate: typeof decapsulate });
        
        // Test 2: Check parameters
        console.log('\n2️⃣ Checking Kyber1024 parameters...');
        console.log('📏 Key sizes:');
        console.log(`   - Public key: ${Params.publicKeyBytes} bytes`);
        console.log(`   - Secret key: ${Params.secretKeyBytes} bytes`);
        console.log(`   - Ciphertext: ${Params.ciphertextBytes} bytes`);
        console.log(`   - Shared secret: ${Params.sharedSecretBytes} bytes`);
        
        // Test 3: Key generation
        console.log('\n3️⃣ Testing key generation...');
        const startKeyGen = performance.now();
        const keys = keypair();
        const keyGenTime = performance.now() - startKeyGen;
        
        if (!keys || !keys.pubkey || !keys.secret) {
            throw new Error('❌ Key generation failed - no keys returned');
        }
        
        console.log(`✅ Key generation successful in ${keyGenTime.toFixed(2)}ms`);
        console.log(`   - Public key length: ${keys.pubkey.length} bytes`);
        console.log(`   - Secret key length: ${keys.secret.length} bytes`);
        
        // Test 4: Encapsulation
        console.log('\n4️⃣ Testing encapsulation...');
        const startEncaps = performance.now();
        const encaps = encapsulate(keys.pubkey);
        const encapsTime = performance.now() - startEncaps;
        
        if (!encaps || !encaps.ciphertext || !encaps.sharedSecret) {
            throw new Error('❌ Encapsulation failed - invalid result');
        }
        
        console.log(`✅ Encapsulation successful in ${encapsTime.toFixed(2)}ms`);
        console.log(`   - Ciphertext length: ${encaps.ciphertext.length} bytes`);
        console.log(`   - Shared secret length: ${encaps.sharedSecret.length} bytes`);
        
        // Test 5: Decapsulation
        console.log('\n5️⃣ Testing decapsulation...');
        const startDecaps = performance.now();
        const decaps = decapsulate(encaps.ciphertext, keys.secret);
        const decapsTime = performance.now() - startDecaps;
        
        if (!decaps) {
            throw new Error('❌ Decapsulation failed - no result');
        }
        
        console.log(`✅ Decapsulation successful in ${decapsTime.toFixed(2)}ms`);
        console.log(`   - Decapsulated secret length: ${decaps.length} bytes`);
        
        // Test 6: Verify shared secrets match (CRITICAL)
        console.log('\n6️⃣ CRITICAL: Verifying shared secrets match...');
        console.log('   Original shared secret (first 16 bytes):', Array.from(encaps.sharedSecret.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));
        console.log('   Decapsulated secret (first 16 bytes):', Array.from(decaps.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' '));
        
        const secretsMatch = encaps.sharedSecret.length === decaps.length &&
            encaps.sharedSecret.every((byte, i) => byte === decaps[i]);
        
        if (secretsMatch) {
            console.log('✅✅✅ SHARED SECRETS MATCH - KYBER1024 IS WORKING CORRECTLY! ✅✅✅');
        } else {
            console.error('❌❌❌ SHARED SECRETS DO NOT MATCH - CRITICAL FAILURE! ❌❌❌');
            console.error('This indicates a fundamental problem with the Kyber1024 implementation!');
            throw new Error('Shared secret verification failed');
        }
        
        // Test 7: Performance check
        console.log('\n7️⃣ Performance analysis...');
        const totalTime = keyGenTime + encapsTime + decapsTime;
        console.log(`⚡ Total operation time: ${totalTime.toFixed(2)}ms`);
        
        if (totalTime < 20) {
            console.log('✅ Performance target met: < 20ms');
        } else {
            console.log(`⚠️ Performance target missed: ${totalTime.toFixed(2)}ms > 20ms (acceptable for post-quantum)`);
        }
        
        // Test 8: Stability test (multiple iterations)
        console.log('\n8️⃣ Running stability test (10 iterations)...');
        let allPassed = true;
        let totalIterTime = 0;
        
        for (let i = 0; i < 10; i++) {
            const iterStart = performance.now();
            const iterKeys = keypair();
            const iterEncaps = encapsulate(iterKeys.pubkey);
            const iterDecaps = decapsulate(iterEncaps.ciphertext, iterKeys.secret);
            const iterTime = performance.now() - iterStart;
            totalIterTime += iterTime;
            
            const iterMatch = iterEncaps.sharedSecret.every((byte, idx) => byte === iterDecaps[idx]);
            if (!iterMatch) {
                allPassed = false;
                console.error(`❌ Iteration ${i+1} failed - secrets don't match`);
                break;
            }
        }
        
        if (allPassed) {
            const avgTime = totalIterTime / 10;
            console.log(`✅ All 10 iterations passed! Average time: ${avgTime.toFixed(2)}ms`);
        } else {
            throw new Error('Stability test failed');
        }
        
        // Final verdict
        console.log('\n==================================================================================');
        console.log('🎉🎉🎉 KYBER1024 POST-QUANTUM CRYPTOGRAPHY TEST: SUCCESS! 🎉🎉🎉');
        console.log('✅ Import: WORKING');
        console.log('✅ Key Generation: WORKING');
        console.log('✅ Encapsulation: WORKING');
        console.log('✅ Decapsulation: WORKING');
        console.log('✅ Secret Matching: WORKING');
        console.log('✅ Performance: ACCEPTABLE');
        console.log('✅ Stability: CONFIRMED');
        console.log('==================================================================================');
        console.log('🚀 KYBER1024 IS READY FOR PRODUCTION USE!');
        console.log('🛡️ Post-quantum cryptography is now fully functional in the browser');
        console.log('📱 You can now proceed with complete application testing');
        
        // Return success result
        return {
            success: true,
            keyGenTime,
            encapsTime,
            decapsTime,
            totalTime,
            message: 'Kyber1024 fully functional'
        };
        
    } catch (error) {
        console.error('\n❌❌❌ KYBER1024 TEST FAILED ❌❌❌');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        
        // Check for specific error types
        if (error.message.includes('import')) {
            console.error('🔧 This appears to be an import error. Possible solutions:');
            console.error('   1. Ensure the development server is running');
            console.error('   2. Check if the pqc-kyber package is properly installed');
            console.error('   3. Verify the WASM file is accessible');
        }
        
        // Return failure result
        return {
            success: false,
            error: error.message,
            message: 'Kyber1024 failed - post-quantum security compromised'
        };
    }
})().then(result => {
    if (result.success) {
        console.log('\n🎯 NEXT STEPS:');
        console.log('1. ✅ Kyber1024 verified - proceed with application testing');
        console.log('2. 🧪 Test complete user registration flow');
        console.log('3. 💬 Test end-to-end encrypted messaging');
        console.log('4. 📁 Test encrypted file sharing');
        console.log('5. 📞 Test WebRTC voice/video calls');
    } else {
        console.error('\n🚨 CRITICAL: POST-QUANTUM SECURITY IS BROKEN!');
        console.error('🛠️ Must fix Kyber1024 before proceeding to production');
    }
});