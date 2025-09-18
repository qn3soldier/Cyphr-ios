#!/usr/bin/env node

/**
 * Comprehensive Multi-Signature Wallet Implementation Test
 * Tests all aspects of the enterprise multi-sig functionality
 */

import { createClient } from '@supabase/supabase-js';
import MultiSigWalletService from './src/api/multiSigWalletService.ts';

// Test configuration
const TEST_CONFIG = {
  networkType: 'testnet',
  supabaseUrl: process.env.VITE_SUPABASE_URL,
  supabaseKey: process.env.VITE_SUPABASE_ANON_KEY,
  testUsers: {
    owner: 'test-owner-' + Date.now(),
    signer1: 'test-signer1-' + Date.now(),
    signer2: 'test-signer2-' + Date.now(),
    signer3: 'test-signer3-' + Date.now()
  }
};

console.log('🧪 Multi-Signature Wallet Implementation Test Suite');
console.log('================================================\n');

let testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  details: []
};

function logTest(testName, success, details = '') {
  testResults.total++;
  if (success) {
    testResults.passed++;
    console.log(`✅ ${testName}`);
  } else {
    testResults.failed++;
    console.log(`❌ ${testName}: ${details}`);
  }
  testResults.details.push({ testName, success, details });
}

async function runMultiSigTests() {
  let multiSigService;
  let testWallet;
  let testTransaction;

  try {
    // Test 1: Initialize Multi-Sig Service
    console.log('📋 Test 1: Service Initialization');
    try {
      multiSigService = new MultiSigWalletService(TEST_CONFIG.networkType);
      logTest('Multi-sig service initialization', true);
    } catch (error) {
      logTest('Multi-sig service initialization', false, error.message);
      return;
    }

    // Test 2: Create Multi-Sig Wallet
    console.log('\n📋 Test 2: Multi-Sig Wallet Creation');
    try {
      const initialSigners = [
        {
          userId: TEST_CONFIG.testUsers.signer1,
          userEmail: 'signer1@test.com',
          userName: 'Test Signer 1',
          publicKey: 'test-key-1',
          stellarPublicKey: 'GCFXHS4GXL6BVUCXBWXGTITROWLVYXQKQLF4YH5O5JT3YZXCYPAFBJZB',
          role: 'signer',
          status: 'pending',
          permissions: {
            canSign: true,
            canAddSigners: false,
            canRemoveSigners: false,
            canChangeThreshold: false,
            maxTransactionAmount: 1000,
            allowedAssets: ['XLM', 'USDC']
          }
        },
        {
          userId: TEST_CONFIG.testUsers.signer2,
          userEmail: 'signer2@test.com',
          userName: 'Test Signer 2',
          publicKey: 'test-key-2',
          stellarPublicKey: 'GDQOE23CFSUMSVQK4Y5JHPPYK73VYCNHZHA7ENKCV37P6SUEO6XQBKPP',
          role: 'signer',
          status: 'pending',
          permissions: {
            canSign: true,
            canAddSigners: false,
            canRemoveSigners: false,
            canChangeThreshold: false,
            maxTransactionAmount: 1000,
            allowedAssets: ['XLM', 'USDC']
          }
        }
      ];

      testWallet = await multiSigService.createMultiSigWallet(
        TEST_CONFIG.testUsers.owner,
        2, // Required signatures
        3, // Total signers
        initialSigners
      );

      if (testWallet && testWallet.id) {
        logTest('Multi-sig wallet creation', true);
        console.log(`   📍 Wallet ID: ${testWallet.id}`);
        console.log(`   📍 Stellar Address: ${testWallet.stellarAddress}`);
        console.log(`   📍 Required Signatures: ${testWallet.requiredSignatures}`);
        console.log(`   📍 Total Signers: ${testWallet.totalSigners}`);
      } else {
        logTest('Multi-sig wallet creation', false, 'No wallet returned');
      }
    } catch (error) {
      logTest('Multi-sig wallet creation', false, error.message);
    }

    // Test 3: Add New Signer
    console.log('\n📋 Test 3: Add New Signer');
    if (testWallet) {
      try {
        const newSigner = {
          userId: TEST_CONFIG.testUsers.signer3,
          userEmail: 'signer3@test.com',
          userName: 'Test Signer 3',
          publicKey: 'test-key-3',
          stellarPublicKey: 'GCKQR2GGXGHJQM5FPAJVQNYXGBW2QWRUYY3KFNFAOTPVDYYLHB4ZWQB5',
          role: 'signer',
          status: 'pending',
          permissions: {
            canSign: true,
            canAddSigners: false,
            canRemoveSigners: false,
            canChangeThreshold: false,
            maxTransactionAmount: 500,
            allowedAssets: ['XLM']
          }
        };

        const addResult = await multiSigService.addSigner(
          testWallet.id,
          TEST_CONFIG.testUsers.owner,
          newSigner
        );

        logTest('Add new signer', addResult === true);
        if (addResult) {
          console.log(`   📍 Added signer: ${newSigner.userName}`);
        }
      } catch (error) {
        logTest('Add new signer', false, error.message);
      }
    } else {
      logTest('Add new signer', false, 'No test wallet available');
    }

    // Test 4: Initiate Multi-Sig Transaction
    console.log('\n📋 Test 4: Initiate Multi-Sig Transaction');
    if (testWallet) {
      try {
        testTransaction = await multiSigService.initiateTransaction(
          testWallet.id,
          TEST_CONFIG.testUsers.owner,
          'GDQOE23CFSUMSVQK4Y5JHPPYK73VYCNHZHA7ENKCV37P6SUEO6XQBKPP', // Destination
          '10.0', // Amount
          'XLM', // Asset
          'Test multi-sig transaction' // Memo
        );

        if (testTransaction && testTransaction.id) {
          logTest('Initiate multi-sig transaction', true);
          console.log(`   📍 Transaction ID: ${testTransaction.id}`);
          console.log(`   📍 Amount: ${testTransaction.amount} ${testTransaction.assetCode}`);
          console.log(`   📍 Required Signatures: ${testTransaction.requiredSignatures}`);
          console.log(`   📍 Current Signatures: ${testTransaction.signatures.length}`);
        } else {
          logTest('Initiate multi-sig transaction', false, 'No transaction returned');
        }
      } catch (error) {
        logTest('Initiate multi-sig transaction', false, error.message);
      }
    } else {
      logTest('Initiate multi-sig transaction', false, 'No test wallet available');
    }

    // Test 5: Sign Transaction
    console.log('\n📋 Test 5: Sign Multi-Sig Transaction');
    if (testTransaction) {
      try {
        const signResult = await multiSigService.signTransaction(
          testTransaction.id,
          TEST_CONFIG.testUsers.signer1
        );

        logTest('Sign multi-sig transaction', signResult === true);
        if (signResult) {
          console.log(`   📍 Transaction signed by: ${TEST_CONFIG.testUsers.signer1}`);
        }
      } catch (error) {
        logTest('Sign multi-sig transaction', false, error.message);
      }
    } else {
      logTest('Sign multi-sig transaction', false, 'No test transaction available');
    }

    // Test 6: Get Pending Transactions
    console.log('\n📋 Test 6: Get Pending Transactions');
    if (testWallet) {
      try {
        const pendingTxs = await multiSigService.getPendingTransactions(testWallet.id);
        
        logTest('Get pending transactions', Array.isArray(pendingTxs));
        console.log(`   📍 Pending transactions count: ${pendingTxs.length}`);
        
        if (pendingTxs.length > 0) {
          const tx = pendingTxs[0];
          console.log(`   📍 First transaction: ${tx.amount} ${tx.assetCode}`);
          console.log(`   📍 Signatures: ${tx.signatures.length}/${tx.requiredSignatures}`);
        }
      } catch (error) {
        logTest('Get pending transactions', false, error.message);
      }
    } else {
      logTest('Get pending transactions', false, 'No test wallet available');
    }

    // Test 7: Get Wallet Configuration
    console.log('\n📋 Test 7: Get Wallet Configuration');
    if (testWallet) {
      try {
        const walletConfig = await multiSigService.getMultiSigWallet(testWallet.id);
        
        if (walletConfig && walletConfig.id === testWallet.id) {
          logTest('Get wallet configuration', true);
          console.log(`   📍 Wallet status: ${walletConfig.status}`);
          console.log(`   📍 Signers count: ${walletConfig.signers.length}`);
          console.log(`   📍 Required signatures: ${walletConfig.requiredSignatures}`);
        } else {
          logTest('Get wallet configuration', false, 'Wallet configuration mismatch');
        }
      } catch (error) {
        logTest('Get wallet configuration', false, error.message);
      }
    } else {
      logTest('Get wallet configuration', false, 'No test wallet available');
    }

    // Test 8: Remove Signer (with proper permissions)
    console.log('\n📋 Test 8: Remove Signer');
    if (testWallet) {
      try {
        // Try to remove the third signer we added
        const signerToRemove = testWallet.signers.find(s => s.userId === TEST_CONFIG.testUsers.signer3);
        
        if (signerToRemove) {
          const removeResult = await multiSigService.removeSigner(
            testWallet.id,
            TEST_CONFIG.testUsers.owner,
            signerToRemove.id
          );

          logTest('Remove signer', removeResult === true);
          if (removeResult) {
            console.log(`   📍 Removed signer: ${signerToRemove.userName}`);
          }
        } else {
          logTest('Remove signer', false, 'Signer to remove not found');
        }
      } catch (error) {
        logTest('Remove signer', false, error.message);
      }
    } else {
      logTest('Remove signer', false, 'No test wallet available');
    }

    // Test 9: Error Handling - Invalid Operations
    console.log('\n📋 Test 9: Error Handling');
    try {
      // Test invalid wallet creation
      let errorCaught = false;
      try {
        await multiSigService.createMultiSigWallet(
          'invalid-user',
          5, // More required signatures than total signers
          3, // Total signers
          []
        );
      } catch (error) {
        errorCaught = true;
      }
      
      logTest('Invalid wallet creation error handling', errorCaught);

      // Test invalid transaction signing
      errorCaught = false;
      try {
        await multiSigService.signTransaction('invalid-tx-id', 'invalid-user');
      } catch (error) {
        errorCaught = true;
      }
      
      logTest('Invalid transaction signing error handling', errorCaught);

    } catch (error) {
      logTest('Error handling tests', false, error.message);
    }

    // Test 10: Service Statistics
    console.log('\n📋 Test 10: Service Statistics');
    try {
      if (testWallet) {
        const stats = await multiSigService.getMultiSigStats(testWallet.id);
        
        if (stats && typeof stats === 'object') {
          logTest('Get multi-sig statistics', true);
          console.log(`   📍 Total signers: ${stats.totalSigners}`);
          console.log(`   📍 Verified signers: ${stats.verifiedSigners}`);
          console.log(`   📍 Pending transactions: ${stats.pendingTransactions}`);
        } else {
          logTest('Get multi-sig statistics', false, 'Invalid statistics returned');
        }
      } else {
        logTest('Get multi-sig statistics', false, 'No test wallet available');
      }
    } catch (error) {
      logTest('Get multi-sig statistics', false, error.message);
    }

  } catch (error) {
    console.error('❌ Critical test failure:', error);
    logTest('Critical test execution', false, error.message);
  }
}

async function runDatabaseTests() {
  console.log('\n📋 Database Schema Tests');
  console.log('========================');

  if (!TEST_CONFIG.supabaseUrl || !TEST_CONFIG.supabaseKey) {
    logTest('Database connection setup', false, 'Missing Supabase credentials');
    return;
  }

  try {
    const supabase = createClient(TEST_CONFIG.supabaseUrl, TEST_CONFIG.supabaseKey);

    // Test database tables existence
    const tables = [
      'multisig_wallets',
      'multisig_pending_transactions',
      'multisig_transaction_history',
      'multisig_approval_requests',
      'multisig_audit_log',
      'multisig_signer_permissions'
    ];

    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);

        if (error) {
          logTest(`Table '${table}' accessibility`, false, error.message);
        } else {
          logTest(`Table '${table}' accessibility`, true);
        }
      } catch (error) {
        logTest(`Table '${table}' accessibility`, false, error.message);
      }
    }

  } catch (error) {
    logTest('Database connection', false, error.message);
  }
}

async function runComplianceTests() {
  console.log('\n📋 Compliance Logging Tests');
  console.log('===========================');

  try {
    // Import compliance logger
    const { complianceLogger } = await import('./src/api/compliance/complianceLogger.js');

    // Test multi-sig compliance logging
    logTest('Compliance logger import', true);

    // Test logging methods
    try {
      complianceLogger.logMultiSigCreation('test-user', {
        walletId: 'test-wallet',
        stellarAddress: 'GCFXHS4GXL6BVUCXBWXGTITROWLVYXQKQLF4YH5O5JT3YZXCYPAFBJZB',
        requiredSignatures: 2,
        totalSigners: 3,
        signersCount: 3,
        networkType: 'testnet'
      });

      logTest('Multi-sig creation logging', true);
    } catch (error) {
      logTest('Multi-sig creation logging', false, error.message);
    }

    try {
      complianceLogger.logMultiSigTransactionInitiated('test-user', {
        transactionId: 'test-tx',
        walletId: 'test-wallet',
        amount: 100,
        asset: 'XLM',
        destination: 'GDQOE23CFSUMSVQK4Y5JHPPYK73VYCNHZHA7ENKCV37P6SUEO6XQBKPP',
        requiredSignatures: 2
      });

      logTest('Multi-sig transaction logging', true);
    } catch (error) {
      logTest('Multi-sig transaction logging', false, error.message);
    }

    // Test compliance status
    try {
      const status = complianceLogger.getComplianceStatus();
      const hasMultiSig = status.categories.includes('MULTISIG');
      logTest('Compliance status includes MULTISIG', hasMultiSig);
    } catch (error) {
      logTest('Compliance status check', false, error.message);
    }

  } catch (error) {
    logTest('Compliance logger import', false, error.message);
  }
}

async function main() {
  console.log(`🚀 Starting test suite at ${new Date().toISOString()}`);
  console.log(`📍 Network: ${TEST_CONFIG.networkType}`);
  console.log(`👥 Test users: ${Object.keys(TEST_CONFIG.testUsers).length}\n`);

  // Run all test suites
  await runMultiSigTests();
  await runDatabaseTests();
  await runComplianceTests();

  // Display results
  console.log('\n📊 Test Results Summary');
  console.log('=======================');
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📊 Total: ${testResults.total}`);
  console.log(`📈 Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);

  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.details
      .filter(t => !t.success)
      .forEach(t => console.log(`   • ${t.testName}: ${t.details}`));
  }

  const overallSuccess = testResults.failed === 0;
  
  console.log('\n🏁 Test Suite Complete');
  if (overallSuccess) {
    console.log('🎉 All tests passed! Multi-signature wallet implementation is ready for production.');
  } else {
    console.log('⚠️  Some tests failed. Review the implementation before production deployment.');
  }

  return overallSuccess;
}

// Run the test suite
main().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});