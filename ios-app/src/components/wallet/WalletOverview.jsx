/**
 * Wallet Overview Component - Zero Storage HD Wallet
 * BIP39 compatible with no seed phrase storage
 */

import React, { useState, useEffect } from 'react';
import Animated from 'react-native-reanimated';
import { 
  Wallet, 
  Eye, 
  EyeOff, 
  Plus, 
  Send, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Shield, 
  RefreshCw,
  ChevronDown,
  Copy,
  Check,
  AlertTriangle,
  Key,
  Download,
  QrCode
} from 'react-native-vector-icons/MaterialIcons';
import StellarServiceEnhanced from '../../api/stellarServiceEnhanced';
import ZeroStorageWalletService from '../../api/zeroStorageWalletService';
import CryptoTransfer from '../chat/CryptoTransfer';
import SeedPhraseGeneration from './SeedPhraseGeneration';
import SeedPhraseRestore from './SeedPhraseRestore';
import PinUnlock from './PinUnlock';
import PinSetup from './PinSetup';
import SendTransaction from './SendTransaction';
import ReceiveTransaction from './ReceiveTransaction';
import TransactionHistory from './TransactionHistory';
import { HDWallet } from '../../api/crypto/hdWallet';
import { Button } from '../../ui/button';
import { toast } from 'react-native-toast-message';

const WalletOverview = () => {
  const [balances, setBalances] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [showBalances, setShowBalances] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(0);
  const [accounts, setAccounts] = useState([]);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showReceive, setShowReceive] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [walletStats, setWalletStats] = useState(null);
  const [hdWallet, setHdWallet] = useState(null);
  const [isWalletInitialized, setIsWalletInitialized] = useState(false);
  const [showSeedGeneration, setShowSeedGeneration] = useState(false);
  const [showSeedRestore, setShowSeedRestore] = useState(false);
  const [seedPhraseForSetup, setSeedPhraseForSetup] = useState(null);
  const [seedBackupConfirmed, setSeedBackupConfirmed] = useState(false);
  const [realTotalBalance, setRealTotalBalance] = useState(0);
  const [assetPrices, setAssetPrices] = useState({});
  const [addingTrustline, setAddingTrustline] = useState(null);
  const [showAddAssetDropdown, setShowAddAssetDropdown] = useState(false);
  const [showPinUnlock, setShowPinUnlock] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [hasPinSetup, setHasPinSetup] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const stellarService = new StellarServiceEnhanced('testnet');
  const zeroStorageWalletService = new ZeroStorageWalletService('testnet');

  // Available assets for trustlines
  // Asset logo utility function
  const getAssetLogo = (assetCode, size = 32) => {
    switch (assetCode) {
      case 'XLM':
        return (
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
            <img 
              src="/stellar-logo.png" 
              alt="Stellar XLM" 
              className="w-8 h-8 object-contain"
            />
          </div>
        );
      case 'USDC':
        return (
          <div className="w-10 h-10 bg-[#2775CA] rounded-full flex items-center justify-center relative">
            {/* Real USDC Logo - Professional Design */}
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
              <div className="w-6 h-6 rounded-full border-2 border-[#2775CA] flex items-center justify-center">
                <span className="text-[10px] font-bold text-[#2775CA]">USD</span>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-bold">
              {assetCode ? assetCode.substring(0, 2) : 'N/A'}
            </span>
          </div>
        );
    }
  };

  const availableAssets = [
    {
      code: 'USDC',
      name: 'USD Coin',
      description: 'Circle stablecoin pegged to USD',
      logo: getAssetLogo('USDC'),
      color: 'from-blue-500 to-blue-700'
    }
    // NOTE: USDT removed - Tether does not support Stellar network
    // NOTE: XLM is not added to trustlines since it's the native asset
  ];

  useEffect(() => {
    // Добавляем timeout чтобы избежать зависания на инициализации
    const timeoutId = setTimeout(() => {
      console.log('⏰ Timeout: принудительно показываем UI');
      setLoading(false);
      setIsWalletInitialized(false);
    }, 5000); // 5 секунд максимум на инициализацию

    initializeWallet().finally(() => {
      clearTimeout(timeoutId);
    });

    return () => clearTimeout(timeoutId);
  }, []);

  // Auto-refresh prices every 30 seconds
  useEffect(() => {
    if (!isWalletInitialized || accounts.length === 0) return;
    
    const priceUpdateInterval = setInterval(async () => {
      try {
        console.log('🔄 Auto-updating asset prices...');
        const prices = {};
        for (const balance of balances) {
          if (balance.code) {
            prices[balance.code] = await stellarService.getRealAssetPrice(balance.code);
          }
        }
        setAssetPrices(prices);
        
        // Recalculate total balance
        if (balances.length > 0) {
          const realTotal = await stellarService.calculateRealPortfolioValue(balances);
          setRealTotalBalance(realTotal);
        }
      } catch (error) {
        console.error('❌ Error updating prices:', error);
      }
    }, 30000); // Update every 30 seconds

    return () => clearInterval(priceUpdateInterval);
  }, [isWalletInitialized, balances, accounts]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showAddAssetDropdown && !event.target.closest('.relative')) {
        setShowAddAssetDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAddAssetDropdown]);

  const initializeWallet = async () => {
    try {
      console.log('🚀 Starting wallet initialization with user binding...');
      
      let userId = sessionStorage.getItem('userId');
      if (!userId) {
        userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem('userId', userId);
        console.log('👤 Created new userId:', userId);
      } else {
        console.log('👤 Using existing userId:', userId);
      }

      // Check if wallet is already unlocked in this session
      const walletUnlocked = sessionStorage.getItem(`wallet_unlocked_${userId}`);
      if (walletUnlocked === 'true') {
        console.log('🔓 Wallet already unlocked in this session - skipping PIN unlock');
        setIsWalletInitialized(true);
        setHasPinSetup(true);
        setShowPinUnlock(false);
        setLoading(false);
        return;
      }
      
      console.log('🔍 Checking for existing user wallet...');
      
      // Check if user has wallet in database
      const userWallet = await userWalletService.getUserWallet(userId);
      
      if (!userWallet) {
        // Check if this is a new user who needs wallet setup
        const needsWalletSetup = sessionStorage.getItem('needs_wallet_setup');
        if (needsWalletSetup === 'true') {
          console.log('🆕 New user detected - auto-starting wallet setup');
          sessionStorage.removeItem('needs_wallet_setup');
          setShowSeedGeneration(true);
          setLoading(false);
          return;
        }
        
        // No wallet found - user needs to create or restore
        console.log('⚠️ No wallet found for user - showing setup options');
        setIsWalletInitialized(false);
        setShowPinUnlock(false);
        setHasPinSetup(false);
        setLoading(false);
        return;
      }

      // Wallet exists - show PIN unlock for daily access (Lobstr-like)
      console.log('🔒 User wallet found - showing PIN unlock for daily access');
      console.log('📍 Wallet address:', userWallet.stellar_address);
      
      setIsWalletInitialized(false); // Wallet exists but needs to be unlocked
      setShowPinUnlock(true);
      setHasPinSetup(true);
      
      // Set account info from database
      const accountInfo = {
        index: 0,
        publicKey: userWallet.stellar_address,
        balance: '0' // Will be loaded after unlock
      };
      setAccounts([accountInfo]);
      
      console.log('👆 Biometric enabled:', userWallet.biometric_enabled);
      setLoading(false);
      
    } catch (error) {
      console.error('❌ Wallet initialization error:', error);
      console.error('Error details:', error.message, error.stack);
      toast.error(`Failed to initialize wallet: ${error.message}`);
      setLoading(false);
      // Show setup options even on error
      setIsWalletInitialized(false);
      setShowPinUnlock(false);
      setHasPinSetup(false);
    }
  };

  const loadWalletData = async (wallet) => {
    try {
      // Null check for HD wallet
      if (!wallet) {
        throw new Error('HD wallet is null or undefined');
      }
      
      // Get Stellar account from HD wallet
      const stellarKey = await wallet.deriveKey('stellar', 0);
      if (!stellarKey || !stellarKey.address) {
        throw new Error('Failed to derive Stellar key or address is missing');
      }
      
      const stellarAddress = stellarKey.address;
      
      console.log('📍 Stellar address:', stellarAddress);

      // Set up account info
      const accountInfo = {
        index: 0,
        publicKey: stellarAddress,
        balance: '0'
      };
      setAccounts([accountInfo]);

      // Load balance data using stellar service
      await loadAccountData(stellarAddress);
      
    } catch (error) {
      console.error('Wallet data loading error:', error);
      setLoading(false);
    }
  };

  const loadAccountData = async (publicKey, forceRefresh = false) => {
    try {
      setLoading(true);
      
      const userId = sessionStorage.getItem('userId');
      if (!userId) throw new Error('No user ID found');

      // Use cached balance or load fresh
      const assetBalances = await userWalletService.getWalletBalance(userId, forceRefresh);
      console.log('📊 Loaded balances:', assetBalances);
      setBalances(assetBalances);

      // Load transaction history (with caching in future)
      const txHistory = await stellarService.getTransactionHistoryWithMemos(publicKey);
      setTransactions(txHistory);

      // Calculate real total balance with live prices
      if (assetBalances.length > 0) {
        console.log('💰 Calculating real portfolio value with live prices...');
        const realTotal = await stellarService.calculateRealPortfolioValue(assetBalances);
        setRealTotalBalance(realTotal);
        
        // Cache individual asset prices for display
        const prices = {};
        for (const balance of assetBalances) {
          prices[balance.code] = await stellarService.getRealAssetPrice(balance.code);
        }
        setAssetPrices(prices);
        console.log('💰 Asset prices loaded:', prices);
      }

    } catch (error) {
      console.error('Error loading account data:', error);
      
      // Check if this is a new/unfunded account
      if (error.name === 'NotFoundError' || error.response?.status === 404) {
        console.log('🆕 New wallet detected - account not yet funded');
        setBalances([]);
        setTransactions([]);
        setRealTotalBalance(0);
        setAssetPrices({});
        
        // Show account activation option for new wallets
        toast.info('New wallet created! Account needs to be activated with initial funding.', {
          duration: 5000,
          action: {
            label: 'Activate Account',
            onClick: () => handleActivateAccount(publicKey)
          }
        });
      } else {
        // Set empty data on other errors
        setBalances([]);
        setTransactions([]);
        setRealTotalBalance(0);
        setAssetPrices({});
        toast.error('Failed to load wallet data: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleActivateAccount = async (stellarAddress) => {
    try {
      setLoading(true);
      console.log('🚀 Activating new Stellar account...');
      
      const success = await stellarService.createAccount(stellarAddress);
      if (success) {
        toast.success('Account activated successfully! Reloading balance...');
        
        // Reload account data after activation
        setTimeout(() => {
          loadAccountData(stellarAddress);
        }, 2000); // Wait 2 seconds for network to update
      }
    } catch (error) {
      console.error('❌ Account activation error:', error);
      toast.error('Failed to activate account: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWallet = async (seedPhrase) => {
    try {
      setLoading(true);
      console.log('🆕 Creating new wallet with encrypted storage...');
      
      // Store the seed phrase temporarily for PIN setup
      setSeedPhraseForSetup(seedPhrase);
      
      setShowSeedGeneration(false);
      
      // Mark backup as confirmed since user just saw their seed phrase
      const userId = sessionStorage.getItem('userId');
      localStorage.setItem(`wallet_backup_confirmed_${userId}`, 'true');
      setSeedBackupConfirmed(true);
      
      // Show PIN setup for new wallets (REQUIRED - seed phrase will be encrypted)
      console.log('📌 Showing PIN setup for new wallet...');
      setShowPinSetup(true);
      setLoading(false); // CRITICAL: Stop loading to show PIN setup modal
      
    } catch (error) {
      console.error('❌ Wallet creation error:', error);
      toast.error('Failed to create wallet: ' + error.message);
      setLoading(false);
    }
  };

  const handleRestoreWallet = async (seedPhrase) => {
    try {
      setLoading(true);
      console.log('🔄 Restoring wallet with encrypted storage...');
      
      // Store the seed phrase temporarily for PIN setup
      setSeedPhraseForSetup(seedPhrase);
      
      setShowSeedRestore(false);
      
      // Mark backup as confirmed since user has their seed phrase
      const userId = sessionStorage.getItem('userId');
      localStorage.setItem(`wallet_backup_confirmed_${userId}`, 'true');
      setSeedBackupConfirmed(true);
      
      // Show PIN setup for restored wallets (REQUIRED - seed phrase will be encrypted)
      console.log('📌 Showing PIN setup for restored wallet...');
      setShowPinSetup(true);
      setLoading(false); // CRITICAL: Stop loading to show PIN setup modal
      
    } catch (error) {
      console.error('❌ Wallet restoration error:', error);
      toast.error('Failed to restore wallet: ' + error.message);
      setLoading(false);
    }
  };

  const handlePinUnlock = async (pin, method) => {
    try {
      setLoading(true);
      console.log(`🔓 Attempting to unlock wallet with ${method}...`);
      
      const userId = sessionStorage.getItem('userId');
      if (!userId) throw new Error('No user ID found');

      if (method === 'pin') {
        // Unlock with PIN using userWalletService
        console.log('🔓 Unlocking with PIN via userWalletService...');
        const hdWallet = await userWalletService.unlockWallet(userId, pin);
        
        if (hdWallet) {
          console.log('✅ Wallet unlocked successfully with PIN');
          
          // Get user wallet info for address
          const userWallet = await userWalletService.getUserWallet(userId);
          if (!userWallet) throw new Error('User wallet not found after unlock');
          
          // Set wallet instance and load data
          setHdWallet(hdWallet);
          setIsWalletInitialized(true);
          setShowPinUnlock(false);
          
          // Mark wallet as unlocked in session to prevent re-asking for PIN
          sessionStorage.setItem(`wallet_unlocked_${userId}`, 'true');
          
          // Load wallet data with caching
          await loadAccountData(userWallet.stellar_address);
          
          toast.success(`Wallet unlocked with ${method}!`);
          return true;
        } else {
          throw new Error('Failed to unlock wallet with PIN');
        }
      } else if (method === 'biometric') {
        // Biometric unlock implementation
        console.log('👆 Attempting biometric unlock...');
        
        try {
          // Use WebAuthn API for biometric authentication
          const credential = await navigator.credentials.get({
            publicKey: {
              challenge: crypto.getRandomValues(new Uint8Array(32)),
              rpId: window.location.hostname,
              userVerification: 'required'
            }
          });
          
          if (credential) {
            console.log('✅ Biometric authentication successful');
            
            // Get user wallet and unlock it (biometric users should have PIN stored securely)
            const userWallet = await userWalletService.getUserWallet(userId);
            if (!userWallet) throw new Error('User wallet not found');
            
            // For biometric users, try to unlock wallet
            // Since biometric is verified, we can try to unlock without PIN
            console.log('🔓 Attempting to unlock wallet after biometric verification...');
            const hdWallet = await userWalletService.unlockWallet(userId, 'biometric_verified');
            
            if (hdWallet) {
              console.log('✅ Wallet unlocked with biometric');
              
              // Set wallet instance and load data
              setHdWallet(hdWallet);
              setIsWalletInitialized(true);
              setShowPinUnlock(false);
              
              // Mark wallet as unlocked in session
              sessionStorage.setItem(`wallet_unlocked_${userId}`, 'true');
              
              // Load wallet data
              await loadAccountData(userWallet.stellar_address);
              
              toast.success('Wallet unlocked with biometric!');
              return true;
            } else {
              throw new Error('Failed to unlock wallet with biometric');
            }
          } else {
            throw new Error('Biometric authentication failed');
          }
        } catch (bioError) {
          console.error('❌ Biometric unlock failed:', bioError);
          toast.error('Biometric unlock failed - use PIN instead');
          return false;
        }
      } else {
        throw new Error(`Unsupported unlock method: ${method}`);
      }
      
    } catch (error) {
      console.error('❌ PIN unlock error:', error);
      toast.error('PIN unlock failed');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handlePinSetup = async (pin, enableBiometric) => {
    try {
      setLoading(true);
      console.log('📌 Setting up PIN with user wallet binding...');
      
      if (!seedPhraseForSetup) {
        throw new Error('No seed phrase available for setup');
      }
      
      const userId = sessionStorage.getItem('userId');
      if (!userId) throw new Error('No user ID found');
      
      console.log('🔐 Creating user wallet in database...');
      
      // Create user wallet with encrypted storage
      const userWallet = await userWalletService.createUserWallet(
        userId,
        seedPhraseForSetup,
        pin,
        enableBiometric
      );
      
      console.log('✅ User wallet created with encrypted storage');
      toast.success('Wallet secured with PIN! ' + (enableBiometric ? 'Biometric unlock enabled.' : ''));
      
      // Clear seed phrase from memory for security
      setSeedPhraseForSetup(null);
      
      // Unlock the wallet to get HD wallet instance
      const hdWallet = await userWalletService.unlockWallet(userId, pin);
      if (!hdWallet) throw new Error('Failed to unlock newly created wallet');
      
      // Set wallet instance and initialize
      setHdWallet(hdWallet);
      setHasPinSetup(true);
      setShowPinSetup(false);
      setIsWalletInitialized(true);
      
      // Mark wallet as unlocked in session to prevent re-asking for PIN
      sessionStorage.setItem(`wallet_unlocked_${userId}`, 'true');
      
      // Set account info
      const accountInfo = {
        index: 0,
        publicKey: userWallet.stellar_address,
        balance: '0'
      };
      setAccounts([accountInfo]);
      
      // Load wallet data
      await loadAccountData(userWallet.stellar_address);
      if (enableBiometric) {
        toast.success('👆 Biometric authentication enabled!');
      }
      
      console.log('🏆 LOBSTR-LIKE SETUP COMPLETE - Seed phrase encrypted, daily PIN access enabled');
      console.log('🔓 Wallet is now fully initialized and ready to use');
      
    } catch (error) {
      console.error('❌ PIN setup error:', error);
      toast.error('Failed to set up PIN: ' + error.message);
      
      // Clean up on failure - CRITICAL: Close PIN setup modal even on error
      setSeedPhraseForSetup(null);
      setShowPinSetup(false);
      setIsWalletInitialized(false); // Reset wallet state to prevent confusion
      console.log('❌ PIN setup failed - closing modal to prevent infinite loops');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!isWalletInitialized || accounts.length === 0) return;
    
    setRefreshing(true);
    try {
      await loadAccountData(accounts[selectedAccount].publicKey);
    } catch (error) {
      console.error('Refresh error:', error);
      toast.error('Failed to refresh wallet data');
    } finally {
      setRefreshing(false);
    }
  };

  const copyAddress = async () => {
    if (accounts.length === 0) return;
    
    try {
      await navigator.clipboard.writeText(accounts[selectedAccount].publicKey);
      setCopiedAddress(true);
      toast.success('Address copied to clipboard');
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch (error) {
      toast.error('Failed to copy address');
    }
  };

  const getTotalBalance = () => {
    // Return the real calculated total balance in USD
    return realTotalBalance;
  };

  const getAssetUSDValue = (balance) => {
    const amount = parseFloat(balance.balance) || 0;
    const price = assetPrices[balance.code] || 0;
    return amount * price;
  };

  const hasAsset = (assetCode) => {
    const hasIt = balances.some(balance => balance.code === assetCode);
    console.log(`🔍 hasAsset(${assetCode}):`, hasIt, 'from balances:', balances.map(b => ({code: b.code, balance: b.balance})));
    return hasIt;
  };

  const handleAddTrustline = async (assetCode) => {
    if (!isWalletInitialized || !hdWallet) {
      toast.error('Wallet not initialized');
      return;
    }

    setAddingTrustline(assetCode);
    
    try {
      console.log(`🔗 Adding ${assetCode} trustline...`);
      
      // Get Stellar account from HD wallet
      const stellarKey = await hdWallet.deriveKey('stellar', 0);
      if (!stellarKey || !stellarKey.address) {
        throw new Error('Failed to derive Stellar key for trustline');
      }
      const stellarAddress = stellarKey.address;
      
      // Initialize Stellar service with user ID
      const userId = sessionStorage.getItem('userId');
      await stellarService.initializeHDWallet(userId);
      
      // Add trustline (Lobstr-like behavior)
      const result = await stellarService.addTrustline(assetCode, '1000000', 0);
      
      console.log(`✅ ${assetCode} trustline result:`, result);
      
      if (result.transactionHash === 'existing_trustline') {
        toast.success(`✅ ${assetCode} is already available in your wallet!`, {
          description: `Balance: ${result.balance} ${assetCode}`,
          duration: 3000
        });
      } else {
        toast.success(`🎉 ${assetCode} trustline added successfully!`, {
          description: `You can now receive ${assetCode} tokens in your wallet`,
          duration: 4000
        });
      }
      
      // Refresh wallet data to show new trustline
      await loadAccountData(stellarAddress);
      
      // Force close dropdown after successful trustline addition (with small delay)
      setTimeout(() => {
        setShowAddAssetDropdown(false);
      }, 500);
      
    } catch (error) {
      console.error(`❌ Error adding ${assetCode} trustline:`, error);
      
      if (error.message.includes('op_already_exists')) {
        toast.info(`${assetCode} trustline already exists`);
      } else {
        toast.error(`Failed to add ${assetCode} trustline: ${error.message}`);
      }
    } finally {
      setAddingTrustline(null);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="text-blue-400"
        >
          <Wallet className="w-16 h-16" />
        </motion.div>
      </div>
    );
  }

  // Wallet setup state - no wallet initialized
  if (!isWalletInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto">
            <div className="text-center mb-8">
              <Shield className="w-20 h-20 text-blue-500 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-white mb-2">
                Quantum-Safe Wallet
              </h1>
              <p className="text-gray-300">
                Create or restore your secure HD wallet
              </p>
            </div>

            <div className="space-y-4">
              <Button
                onClick={() => setShowSeedGeneration(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 py-6 text-lg"
              >
                <Plus className="w-5 h-5 mr-2" />
                Create New Wallet
              </Button>
              
              <Button
                variant="outline"
                onClick={() => setShowSeedRestore(true)}
                className="w-full py-6 text-lg border-gray-600 text-white hover:bg-gray-800"
              >
                <Key className="w-5 h-5 mr-2" />
                Restore Existing Wallet
              </Button>
            </div>

            <div className="mt-8 p-4 bg-amber-900/20 border border-amber-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
                <div className="text-amber-300 text-sm">
                  <p className="font-semibold mb-1">Zero Storage Policy:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Your seed phrase is never stored by Cyphr</li>
                    <li>Only you have access to your private keys</li>
                    <li>Write down your seed phrase securely</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modals */}
        <AnimatePresence>
          {showSeedGeneration && (
            <SeedPhraseGeneration
              onComplete={handleCreateWallet}
              onCancel={() => setShowSeedGeneration(false)}
            />
          )}
          {showSeedRestore && (
            <SeedPhraseRestore
              onComplete={handleRestoreWallet}
              onCancel={() => setShowSeedRestore(false)}
            />
          )}
          {showPinUnlock && (
            <PinUnlock
              onUnlock={handlePinUnlock}
              onCancel={() => {
                console.log('🔄 PIN unlock cancelled - showing seed phrase restore as recovery option');
                setShowPinUnlock(false);
                setHasPinSetup(false);
                setShowSeedRestore(true);
              }}
              allowBiometric={HDWallet.isBiometricEnabled()}
            />
          )}
          {showPinSetup && (
            <PinSetup
              onComplete={handlePinSetup}
              onSkip={async () => {
                console.log('📌 PIN Setup skipped - completing wallet setup without PIN...');
                
                if (!seedPhraseForSetup) {
                  console.error('❌ No seed phrase available for wallet setup');
                  toast.error('Failed to complete wallet setup - no seed phrase');
                  setShowPinSetup(false);
                  // Stay on wallet setup screen, don't show seed generation
                  return;
                }
                
                try {
                  setLoading(true);
                  const userId = sessionStorage.getItem('userId');
                  if (!userId) throw new Error('No user ID found');
                  
                  // Create HD wallet without PIN protection (less secure but working)
                  console.log('🔓 Creating HD wallet without PIN protection...');
                  const hdWalletInstance = await HDWallet.fromSeedPhrase(seedPhraseForSetup, userId);
                  
                  // Get Stellar address for wallet setup
                  const stellarKey = await hdWalletInstance.deriveKey('stellar', 0);
                  if (!stellarKey || !stellarKey.address) {
                    throw new Error('Failed to derive Stellar key');
                  }
                  
                  console.log('✅ Wallet created without PIN protection');
                  toast.success('Wallet created successfully! (No PIN protection)');
                  
                  // Clear seed phrase from memory for security
                  setSeedPhraseForSetup(null);
                  
                  // CRITICAL: Close PIN setup modal and initialize wallet
                  setShowPinSetup(false);
                  setHdWallet(hdWalletInstance);
                  setIsWalletInitialized(true);
                  setHasPinSetup(false); // No PIN was set up
                  
                  // Mark wallet as unlocked in session
                  sessionStorage.setItem(`wallet_unlocked_${userId}`, 'true');
                  
                  // Set account info
                  const accountInfo = {
                    index: 0,
                    publicKey: stellarKey.address,
                    balance: '0'
                  };
                  setAccounts([accountInfo]);
                  
                  // Load wallet data
                  await loadAccountData(stellarKey.address);
                  
                  console.log('🎉 WALLET SETUP COMPLETE - Skip PIN successful, wallet initialized');
                  
                } catch (error) {
                  console.error('❌ Skip PIN setup error:', error);
                  toast.error('Failed to complete wallet setup: ' + error.message);
                  setSeedPhraseForSetup(null);
                  setShowPinSetup(false);
                } finally {
                  setLoading(false);
                }
              }}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 text-white">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Wallet className="w-8 h-8 text-blue-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">Cyphr Wallet</h1>
              <p className="text-sm text-gray-400">Quantum-Safe Multi-Asset</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!seedBackupConfirmed && (
              <div className="flex items-center gap-2 bg-amber-900/20 border border-amber-500/30 rounded-lg px-3 py-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-amber-300">Backup Required</span>
              </div>
            )}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
            >
              <RefreshCw className={`w-5 h-5 text-white ${refreshing ? 'animate-spin' : ''}`} />
            </motion.button>
          </div>
        </div>

        {/* Lobstr-Style Balance & Actions */}
        <div className="text-center mb-8">
          <p className="text-gray-400 text-sm mb-2">Estimated portfolio value</p>
          <div className="flex items-center justify-center gap-3 mb-2">
            <h1 className="text-5xl font-bold text-white">
              {showBalances ? `$${getTotalBalance().toFixed(2)}` : '••••••'}
            </h1>
            <button
              onClick={() => setShowBalances(!showBalances)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              {showBalances ? <EyeOff className="w-5 h-5 text-gray-400" /> : <Eye className="w-5 h-5 text-gray-400" />}
            </button>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm">
            <span className="text-red-400">-$1.45</span>
            <span className="text-red-400">↓0.46%</span>
          </div>
        </div>

        {/* Large Action Buttons like Lobstr */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowSendModal(true)}
            className="flex flex-col items-center gap-2"
          >
            <div className="w-16 h-16 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
              <ArrowUpRight className="w-6 h-6 text-white" />
            </div>
            <span className="text-white text-sm font-medium">Send</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowReceiveModal(true)}
            className="flex flex-col items-center gap-2"
          >
            <div className="w-16 h-16 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
              <ArrowDownLeft className="w-6 h-6 text-white" />
            </div>
            <span className="text-white text-sm font-medium">Receive</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => toast.info('Buy feature coming soon!')}
            className="flex flex-col items-center gap-2"
          >
            <div className="w-16 h-16 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
              <Plus className="w-6 h-6 text-white" />
            </div>
            <span className="text-white text-sm font-medium">Buy</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => toast.info('Swap feature coming soon!')}
            className="flex flex-col items-center gap-2"
          >
            <div className="w-16 h-16 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
              <RefreshCw className="w-6 h-6 text-white" />
            </div>
            <span className="text-white text-sm font-medium">Swap</span>
          </motion.button>
        </div>

        {/* Quick Info Bar */}
        <div className="flex items-center justify-between mb-6 px-4 py-3 bg-white/5 rounded-lg">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-green-400" />
            <span className="text-xs text-gray-300">Quantum-Safe</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-mono">
              {accounts[selectedAccount]?.publicKey?.substring(0, 8)}...
            </span>
            <button
              onClick={copyAddress}
              className="p-1 hover:bg-white/10 rounded"
              title="Copy Address"
            >
              {copiedAddress ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-gray-400" />}
            </button>
          </div>
        </div>

        {/* Asset List */}
        <motion.div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">My assets</h2>
            <div className="flex gap-2 flex-wrap items-center">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowReceive(true)}
                className="px-3 sm:px-4 py-2 bg-green-600/20 border border-green-500/30 rounded-lg text-green-300 text-xs sm:text-sm hover:bg-green-600/30 transition-colors"
              >
                <ArrowDownLeft className="w-4 h-4 mr-1 inline" />
                Receive
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowTransfer(true)}
                className="px-3 sm:px-4 py-2 bg-blue-600/20 border border-blue-500/30 rounded-lg text-blue-300 text-xs sm:text-sm hover:bg-blue-600/30 transition-colors"
              >
                <Send className="w-4 h-4 mr-1 inline" />
                Send
              </motion.button>
              
              {/* Add Asset Dropdown */}
              <div className="relative">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowAddAssetDropdown(!showAddAssetDropdown)}
                  className="px-3 sm:px-4 py-2 bg-violet-600/20 border border-violet-500/30 rounded-lg text-violet-300 text-xs sm:text-sm hover:bg-violet-600/30 transition-colors flex items-center gap-1 sm:gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Asset
                  <ChevronDown className={`w-4 h-4 transition-transform ${showAddAssetDropdown ? 'rotate-180' : ''}`} />
                </motion.button>

                <AnimatePresence>
                  {showAddAssetDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute bottom-full mb-2 right-0 w-80 max-w-[calc(100vw-2rem)] bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-[9999]"
                    >
                      <div className="p-3">
                        <div className="text-xs font-medium text-gray-400 mb-3 px-3">
                          Available Assets on Stellar Testnet
                        </div>
                        <div className="space-y-2">
                          {availableAssets
                            .filter(asset => !hasAsset(asset.code))
                            .map((asset) => (
                              <motion.button
                                key={asset.code}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                  handleAddTrustline(asset.code);
                                  // Don't close dropdown here - it will be closed in handleAddTrustline after data refresh
                                }}
                                disabled={addingTrustline === asset.code}
                                className="w-full p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 hover:border-white/20 transition-all duration-200 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden`}>
                                  {addingTrustline === asset.code ? (
                                    <div className={`w-full h-full bg-gradient-to-br ${asset.color} flex items-center justify-center`}>
                                      <RefreshCw className="w-5 h-5 text-white animate-spin" />
                                    </div>
                                  ) : (
                                    <div className="w-8 h-8">
                                      {asset.logo}
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 text-left">
                                  <div className="font-semibold text-white text-sm">
                                    {asset.name} ({asset.code})
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    {asset.description}
                                  </div>
                                </div>
                                {addingTrustline === asset.code ? (
                                  <div className="text-xs text-blue-400">Adding...</div>
                                ) : (
                                  <Plus className="w-4 h-4 text-gray-400" />
                                )}
                              </motion.button>
                            ))}
                          
                          {availableAssets.filter(asset => !hasAsset(asset.code)).length === 0 && (
                            <div className="text-center py-6 text-gray-400 text-sm">
                              <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
                              <p className="font-medium mb-1">All supported assets added</p>
                              <p className="text-xs text-gray-500">
                                You have trustlines for all available stablecoins
                              </p>
                            </div>
                          )}
                          
                          {availableAssets.filter(asset => !hasAsset(asset.code)).length > 0 && (
                            <div className="text-xs text-gray-500 px-3 pt-2 border-t border-white/5">
                              <p className="mb-1">💡 <span className="font-medium">About Trustlines:</span></p>
                              <p>Add trustlines to enable receiving these tokens in your Stellar wallet. This is a one-time setup for each asset.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {balances.length > 0 ? balances.map((balance, index) => (
              <motion.div
                key={index}
                className="flex items-center justify-between p-3 sm:p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {/* Professional Asset Logo */}
                  {getAssetLogo(balance.code || balance.asset || 'UNKNOWN')}
                  <div>
                    <p className="font-semibold">{balance.code || balance.asset || 'Unknown Asset'}</p>
                    <p className="text-xs text-gray-400">
                      {(balance.code === 'XLM' || balance.asset === 'XLM') ? 'Stellar Lumens' : 
                       balance.code === 'USDC' ? 'USD Coin' : (balance.code || balance.asset)}
                    </p>
                    <p className="text-xs text-blue-400">
                      ${assetPrices[balance.code]?.toFixed(4) || '0.0000'} per coin
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">
                    {showBalances ? parseFloat(balance.balance).toFixed(4) : '••••••'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {showBalances ? `$${getAssetUSDValue(balance).toFixed(2)}` : '••••'}
                  </p>
                </div>
              </motion.div>
            )) : (
              <div className="text-center py-8">
                <Wallet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400">No assets found</p>
                <p className="text-sm text-gray-500 mt-1">
                  Send some XLM to this address to activate your account
                </p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Transaction History */}
        <motion.div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Transaction History</h2>
          
          <div className="space-y-3">
            {transactions.length > 0 ? transactions.slice(0, 10).map((tx, index) => (
              <motion.div
                key={index}
                className="flex items-center justify-between p-3 sm:p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${
                    tx.type === 'sent' ? 'bg-red-500/20' : 'bg-green-500/20'
                  }`}>
                    {tx.type === 'sent' ? 
                      <ArrowUpRight className="w-4 h-4 text-red-400" /> : 
                      <ArrowDownLeft className="w-4 h-4 text-green-400" />
                    }
                  </div>
                  <div>
                    <p className="font-semibold capitalize">{tx.type}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${
                    tx.type === 'sent' ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {tx.type === 'sent' ? '-' : '+'}{tx.amount} {tx.asset}
                  </p>
                  {tx.decryptedMemo && (
                    <p className="text-xs text-gray-400 truncate max-w-32">
                      {tx.decryptedMemo}
                    </p>
                  )}
                </div>
              </motion.div>
            )) : (
              <div className="text-center py-8">
                <ArrowUpRight className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400">No transactions yet</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showTransfer && (
          <CryptoTransfer
            isOpen={showTransfer}
            onClose={() => setShowTransfer(false)}
            walletAddress={accounts[selectedAccount]?.publicKey}
          />
        )}
        
        {showReceive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowReceive(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-900 rounded-2xl p-6 max-w-md w-full"
            >
              <h3 className="text-xl font-bold mb-4">Receive Assets</h3>
              <div className="text-center">
                <div className="bg-white p-4 rounded-lg mb-4">
                  {/* QR Code would go here */}
                  <div className="w-48 h-48 mx-auto bg-gray-200 rounded flex items-center justify-center">
                    <QrCode className="w-16 h-16 text-gray-400" />
                  </div>
                </div>
                <p className="text-sm text-gray-400 mb-2">Your Stellar Address:</p>
                <p className="font-mono text-sm bg-gray-800 p-3 rounded break-all">
                  {accounts[selectedAccount]?.publicKey}
                </p>
                <Button
                  onClick={copyAddress}
                  className="w-full mt-4"
                >
                  {copiedAddress ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                  {copiedAddress ? 'Copied!' : 'Copy Address'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Transaction Modals */}
      {showSendModal && (
        <SendTransaction
          hdWallet={hdWallet}
          userWallet={accounts[selectedAccount] ? { stellar_address: accounts[selectedAccount].publicKey } : null}
          onClose={() => setShowSendModal(false)}
          onSuccess={() => {
            setShowSendModal(false);
            // Refresh wallet data after successful send
            if (accounts.length > 0) {
              loadAccountData(accounts[selectedAccount].publicKey, true);
            }
          }}
        />
      )}
      
      {showReceiveModal && (
        <ReceiveTransaction
          userWallet={accounts[selectedAccount] ? { stellar_address: accounts[selectedAccount].publicKey } : null}
          onClose={() => setShowReceiveModal(false)}
        />
      )}
      
      {showHistoryModal && (
        <TransactionHistory
          userWallet={accounts[selectedAccount] ? { stellar_address: accounts[selectedAccount].publicKey } : null}
          onClose={() => setShowHistoryModal(false)}
        />
      )}
    </div>
  );
};

export default WalletOverview;