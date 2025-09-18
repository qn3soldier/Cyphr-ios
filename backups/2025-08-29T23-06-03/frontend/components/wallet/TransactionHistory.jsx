import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownLeft, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/ui/button';
import { toast } from 'sonner';

export default function TransactionHistory({ userWallet, onClose }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadTransactions = async () => {
    if (!userWallet?.stellar_address) return;

    try {
      setLoading(true);
      setError(null);

      const StellarSdk = await import('@stellar/stellar-sdk');
      const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
      
      // Load account transactions
      const transactionResponse = await server
        .transactions()
        .forAccount(userWallet.stellar_address)
        .order('desc')
        .limit(20)
        .call();

      const transactionList = [];
      
      for (const tx of transactionResponse.records) {
        try {
          // Get operations for this transaction
          const operations = await tx.operations();
          
          for (const op of operations.records) {
            if (op.type === 'payment' && op.asset_type === 'native') {
              transactionList.push({
                id: tx.id,
                hash: tx.hash,
                type: op.from === userWallet.stellar_address ? 'sent' : 'received',
                amount: op.amount,
                from: op.from,
                to: op.to,
                memo: tx.memo || '',
                timestamp: tx.created_at,
                successful: tx.successful,
                fee: tx.fee_charged
              });
            }
          }
        } catch (opError) {
          console.warn('Error loading transaction operations:', opError);
        }
      }

      setTransactions(transactionList);
    } catch (error) {
      console.error('❌ Error loading transactions:', error);
      setError(error.message);
      toast.error('Failed to load transaction history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [userWallet]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAmount = (amount) => {
    const num = parseFloat(amount);
    return num.toFixed(7).replace(/\.?0+$/, '');
  };

  const openInExplorer = (hash) => {
    const url = `https://stellar.expert/explorer/testnet/tx/${hash}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-800 rounded-3xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white">Transaction History</h2>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={loadTransactions}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="text-center py-8">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"
              />
              <p className="text-gray-400">Loading transactions...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-red-400 mb-4">Failed to load transactions</p>
              <Button onClick={loadTransactions}>Try Again</Button>
            </div>
          )}

          {!loading && !error && transactions.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-2">No transactions found</p>
              <p className="text-gray-500 text-sm">Your transaction history will appear here</p>
            </div>
          )}

          {!loading && !error && transactions.length > 0 && (
            <div className="space-y-3">
              {transactions.map((tx, index) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-slate-700 rounded-lg p-4 hover:bg-slate-600 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${
                        tx.type === 'sent' ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'
                      }`}>
                        {tx.type === 'sent' ? 
                          <ArrowUpRight className="w-4 h-4" /> : 
                          <ArrowDownLeft className="w-4 h-4" />
                        }
                      </div>
                      <div>
                        <p className="text-white font-semibold">
                          {tx.type === 'sent' ? 'Sent' : 'Received'}
                        </p>
                        <p className="text-gray-400 text-sm">
                          {formatDate(tx.timestamp)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className={`font-bold ${
                        tx.type === 'sent' ? 'text-red-400' : 'text-green-400'
                      }`}>
                        {tx.type === 'sent' ? '-' : '+'}{formatAmount(tx.amount)} XLM
                      </p>
                      <button
                        onClick={() => openInExplorer(tx.hash)}
                        className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
                      >
                        View <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  
                  {tx.memo && (
                    <div className="mt-2 pt-2 border-t border-slate-600">
                      <p className="text-gray-400 text-sm">Memo: {tx.memo}</p>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}