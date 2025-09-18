import React, { useState } from 'react';
import Animated from 'react-native-reanimated';
import { ArrowRight, QrCode, User, DollarSign } from 'react-native-vector-icons/MaterialIcons';
import { Button } from '../../ui/button';
import { toast } from 'react-native-toast-message';

export default function SendTransaction({ hdWallet, userWallet, onClose, onSuccess }) {
  const [step, setStep] = useState('amount'); // amount, confirm, sending
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    try {
      setLoading(true);
      setStep('sending');
      
      if (!hdWallet) {
        throw new Error('Wallet not available');
      }

      // Get user ID for API call
      const userId = sessionStorage.getItem('userId');
      if (!userId) {
        throw new Error('User ID not found');
      }

      // Use backend API for secure transaction submission
      const response = await fetch('/api/wallet/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('authToken') || 'temp-token'}`
        },
        body: JSON.stringify({
          userId,
          recipient,
          amount,
          asset: 'XLM',
          memo
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Send transaction failed');
      }
      
      console.log('✅ Transaction successful:', result.transactionHash);
      toast.success(`Transaction sent! Hash: ${result.transactionHash.substring(0, 8)}...`);
      
      if (onSuccess) onSuccess(result);
      if (onClose) onClose();
      
    } catch (error) {
      console.error('❌ Send transaction error:', error);
      toast.error(`Send failed: ${error.message}`);
      setStep('confirm');
    } finally {
      setLoading(false);
    }
  };

  const validateInputs = () => {
    if (!recipient || recipient.length < 56) return false;
    if (!amount || parseFloat(amount) <= 0) return false;
    return true;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-800 rounded-3xl p-6 w-full max-w-md"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Send XLM</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            ✕
          </button>
        </div>

        {step === 'amount' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Recipient Address
              </label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Amount (XLM)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                step="0.0000001"
                min="0.0000001"
                className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Memo (Optional)
              </label>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="Payment memo"
                maxLength={28}
                className="w-full p-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400"
              />
            </div>

            <Button 
              onClick={() => setStep('confirm')} 
              disabled={!validateInputs()}
              className="w-full"
            >
              Review Transaction
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="bg-slate-700 rounded-lg p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-300">To:</span>
                <span className="text-white font-mono text-sm">
                  {recipient.substring(0, 8)}...{recipient.substring(-8)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Amount:</span>
                <span className="text-white font-bold">{amount} XLM</span>
              </div>
              {memo && (
                <div className="flex justify-between">
                  <span className="text-gray-300">Memo:</span>
                  <span className="text-white">{memo}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-300">Fee:</span>
                <span className="text-white">0.00001 XLM</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => setStep('amount')}
                className="flex-1"
              >
                Back
              </Button>
              <Button 
                onClick={handleSend}
                disabled={loading}
                className="flex-1"
              >
                {loading ? 'Sending...' : 'Send Now'}
              </Button>
            </div>
          </div>
        )}

        {step === 'sending' && (
          <div className="text-center py-8">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"
            />
            <p className="text-white">Sending transaction...</p>
            <p className="text-gray-400 text-sm">Please wait</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}