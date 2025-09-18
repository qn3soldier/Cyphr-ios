import React, { useState, useEffect } from 'react';
import Animated from 'react-native-reanimated';
import { Copy, QrCode, Check } from 'react-native-vector-icons/MaterialIcons';
import { Button } from '../../ui/button';
import { toast } from 'react-native-toast-message';

export default function ReceiveTransaction({ userWallet, onClose }) {
  const [copied, setCopied] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  useEffect(() => {
    if (userWallet?.stellar_address) {
      // Generate QR code URL using a QR service
      const qrData = `stellar:${userWallet.stellar_address}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;
      setQrCodeUrl(qrUrl);
    }
  }, [userWallet]);

  const copyAddress = async () => {
    if (userWallet?.stellar_address) {
      try {
        await navigator.clipboard.writeText(userWallet.stellar_address);
        setCopied(true);
        toast.success('Address copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        toast.error('Failed to copy address');
      }
    }
  };

  if (!userWallet?.stellar_address) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-slate-800 rounded-3xl p-6 w-full max-w-md text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Receive XLM</h2>
          <p className="text-gray-400 mb-4">Wallet address not available</p>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-800 rounded-3xl p-6 w-full max-w-md"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Receive XLM</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            ✕
          </button>
        </div>

        <div className="text-center space-y-6">
          {/* QR Code */}
          <div className="bg-white p-4 rounded-2xl inline-block">
            {qrCodeUrl ? (
              <img 
                src={qrCodeUrl} 
                alt="Wallet QR Code" 
                className="w-48 h-48 object-contain"
                onError={() => {
                  console.warn('QR code failed to load');
                }}
              />
            ) : (
              <div className="w-48 h-48 bg-gray-200 rounded-lg flex items-center justify-center">
                <QrCode className="w-12 h-12 text-gray-400" />
              </div>
            )}
          </div>

          {/* Address */}
          <div className="space-y-3">
            <p className="text-gray-300 text-sm">Your Stellar Address:</p>
            <div className="bg-slate-700 rounded-lg p-3 border-2 border-dashed border-slate-600">
              <p className="text-white font-mono text-sm break-all">
                {userWallet.stellar_address}
              </p>
            </div>
          </div>

          {/* Copy Button */}
          <Button onClick={copyAddress} className="w-full">
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-2 text-green-400" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Copy Address
              </>
            )}
          </Button>

          {/* Instructions */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
            <h3 className="text-blue-400 font-semibold mb-2">Instructions:</h3>
            <ul className="text-gray-300 text-sm space-y-1 text-left">
              <li>• Share this address to receive XLM</li>
              <li>• Scan QR code from another wallet</li>
              <li>• Minimum: 0.0000001 XLM</li>
              <li>• Network: Stellar Testnet</li>
            </ul>
          </div>
        </div>
      </motion.div>
    </div>
  );
}