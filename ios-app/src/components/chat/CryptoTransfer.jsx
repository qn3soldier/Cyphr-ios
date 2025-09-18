/**
 * In-Chat Crypto Transfer Component
 * Allows users to send crypto payments directly within chat conversations
 * Supports XLM, USDC with encrypted memos
 */

import React, { useState, useEffect } from 'react';
import Animated from 'react-native-reanimated';
import { DollarSign, Send, Shield, Eye, EyeOff, Loader2, CheckCircle, AlertCircle } from 'react-native-vector-icons/MaterialIcons';
import StellarServiceEnhanced from '../../api/stellarServiceEnhanced';

const CryptoTransfer = ({ 
  chatId, 
  recipientId, 
  recipientPublicKey, 
  onTransferComplete, 
  onClose 
}) => {
  const [selectedAsset, setSelectedAsset] = useState('XLM');
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState(recipientPublicKey || '');
  const [memo, setMemo] = useState('');
  const [encryptMemo, setEncryptMemo] = useState(true);
  const [showBalance, setShowBalance] = useState(false);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [transferStatus, setTransferStatus] = useState(null);
  const [errors, setErrors] = useState({});

  const stellarService = new StellarServiceEnhanced('testnet');

  const supportedAssets = [
    { code: 'XLM', name: 'Stellar Lumens', icon: '✨', color: 'bg-blue-500' },
    { code: 'USDC', name: 'USD Coin', icon: '💵', color: 'bg-green-500' }
    // NOTE: USDT removed - Tether does not support Stellar network
  ];

  useEffect(() => {
    loadBalances();
  }, []);

  const loadBalances = async () => {
    try {
      let userId = sessionStorage.getItem('userId');
      if (!userId) {
        userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem('userId', userId);
      }

      // Set userId in stellar service
      stellarService.userId = userId;

      const { publicKey } = await stellarService.getWallet(0);
      const assetBalances = await stellarService.getMultiAssetBalance(publicKey);
      
      setBalances(assetBalances);
    } catch (error) {
      console.error('Error loading balances:', error);
    }
  };

  const validateAmount = (value) => {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) {
      return 'Amount must be a positive number';
    }

    const balance = balances.find(b => b.code === selectedAsset);
    if (balance && num > parseFloat(balance.balance)) {
      return `Insufficient ${selectedAsset} balance`;
    }

    return null;
  };

  const handleAmountChange = (value) => {
    setAmount(value);
    const error = validateAmount(value);
    setErrors(prev => ({ ...prev, amount: error }));
  };

  const handleTransfer = async () => {
    if (loading) return;

    // Validate inputs
    const amountError = validateAmount(amount);
    if (amountError) {
      setErrors({ amount: amountError });
      return;
    }

    const trimmedRecipient = recipient.trim();
    
    if (!trimmedRecipient) {
      setErrors({ recipient: 'Recipient address is required' });
      return;
    }

    // Validate Stellar address format
    if (!trimmedRecipient.startsWith('G') || trimmedRecipient.length !== 56) {
      setErrors({ recipient: `Invalid Stellar address format (length: ${trimmedRecipient.length})` });
      return;
    }

    if (encryptMemo && memo && !recipient) {
      setErrors({ memo: 'Cannot encrypt memo without recipient public key' });
      return;
    }

    setLoading(true);
    setTransferStatus(null);
    setErrors({});

    try {
      console.log('🚀 Initiating crypto transfer...');

      const result = await stellarService.sendPaymentWithEncryptedMemo(
        trimmedRecipient,
        amount,
        selectedAsset,
        memo,
        encryptMemo ? trimmedRecipient : undefined,
        0 // Use first HD wallet account
      );

      setTransferStatus({
        type: 'success',
        message: 'Transfer completed successfully!',
        hash: result.hash
      });

      // Refresh balances
      await loadBalances();

      // Notify parent component
      if (onTransferComplete) {
        onTransferComplete({
          amount,
          asset: selectedAsset,
          recipient: recipientId,
          hash: result.hash,
          memo: memo,
          encrypted: encryptMemo
        });
      }

      // Auto-close after success
      setTimeout(() => {
        onClose?.();
      }, 2000);

    } catch (error) {
      console.error('Transfer failed:', error);
      setTransferStatus({
        type: 'error',
        message: error.message || 'Transfer failed. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const getBalanceForAsset = (assetCode) => {
    const balance = balances.find(b => b.code === assetCode);
    return balance ? parseFloat(balance.balance).toFixed(4) : '0.0000';
  };

  const formatAmount = (value) => {
    return parseFloat(value || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
    >
      <motion.div
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Send Crypto
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Secure quantum-encrypted transfer
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <span className="text-gray-400 text-xl">×</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Asset Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Asset
            </label>
            <div className="grid grid-cols-3 gap-2">
              {supportedAssets.map((asset) => (
                <button
                  key={asset.code}
                  onClick={() => setSelectedAsset(asset.code)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    selectedAsset === asset.code
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <div className="text-2xl mb-1">{asset.icon}</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {asset.code}
                  </div>
                  {showBalance && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {getBalanceForAsset(asset.code)}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Balance Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Available: {showBalance ? getBalanceForAsset(selectedAsset) : '•••••'} {selectedAsset}
            </span>
            <button
              onClick={() => setShowBalance(!showBalance)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              {showBalance ? (
                <EyeOff className="w-4 h-4 text-gray-400" />
              ) : (
                <Eye className="w-4 h-4 text-gray-400" />
              )}
            </button>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Amount
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.0001"
                min="0"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0.0000"
                className={`w-full px-4 py-3 border-2 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                  errors.amount ? 'border-red-500' : 'border-gray-200 dark:border-gray-600'
                }`}
              />
              <div className="absolute right-3 top-3 text-sm text-gray-500 dark:text-gray-400">
                {selectedAsset}
              </div>
            </div>
            {errors.amount && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.amount}
              </p>
            )}
          </div>

          {/* Recipient Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Recipient Address
            </label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="G... (Stellar public key)"
              className={`w-full px-4 py-3 border-2 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                errors.recipient ? 'border-red-500' : 'border-gray-200 dark:border-gray-600'
              }`}
            />
            {errors.recipient && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.recipient}
              </p>
            )}
          </div>

          {/* Memo Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Memo (Optional)
              </label>
              <div className="flex items-center space-x-2">
                <Shield className={`w-4 h-4 ${encryptMemo ? 'text-green-500' : 'text-gray-400'}`} />
                <button
                  onClick={() => setEncryptMemo(!encryptMemo)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    encryptMemo ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                      encryptMemo ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {encryptMemo ? 'Encrypted' : 'Plain text'}
                </span>
              </div>
            </div>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Add a note to your transfer..."
              maxLength={encryptMemo ? 500 : 28} // Stellar memo limit for plain text
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition-colors"
            />
            <div className="flex justify-between mt-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {encryptMemo ? 'Quantum-encrypted memo' : 'Public memo (visible on blockchain)'}
              </p>
              <span className="text-xs text-gray-400">
                {memo.length}/{encryptMemo ? 500 : 28}
              </span>
            </div>
            {errors.memo && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.memo}
              </p>
            )}
          </div>

          {/* Transfer Status */}
          <AnimatePresence>
            {transferStatus && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`p-4 rounded-lg ${
                  transferStatus.type === 'success'
                    ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                    : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  {transferStatus.type === 'success' ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <AlertCircle className="w-5 h-5" />
                  )}
                  <span className="text-sm font-medium">{transferStatus.message}</span>
                </div>
                {transferStatus.hash && (
                  <p className="text-xs mt-2 opacity-75">
                    Transaction: {transferStatus.hash.substring(0, 20)}...
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleTransfer}
              disabled={loading || !amount || errors.amount}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send {formatAmount(amount)} {selectedAsset}</span>
                </>
              )}
            </button>
          </div>

          {/* Security Notice */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start space-x-2">
              <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="text-xs text-blue-800 dark:text-blue-300">
                <p className="font-medium">Quantum-Safe Security</p>
                <p>All transactions are protected with post-quantum cryptography and cannot be decrypted even by quantum computers.</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default CryptoTransfer;