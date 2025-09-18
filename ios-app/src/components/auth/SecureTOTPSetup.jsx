/**
 * Secure TOTP Setup Component
 * Generates TOTP secrets on backend, never exposes them to frontend
 */

import { useState, useEffect } from 'react';
import Animated from 'react-native-reanimated';
import { Button } from '../../ui/button';
import { toast } from 'react-native-toast-message';
import { Smartphone, Copy, QrCode, Shield, Download } from 'react-native-vector-icons/MaterialIcons';
import secureBackendService from '../../api/secureBackendService';

export default function SecureTOTPSetup({ userId, onComplete, onSkip }) {
  const [qrCode, setQrCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [totpCode, setTotpCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(true);
  const [backupCodesDownloaded, setBackupCodesDownloaded] = useState(false);

  useEffect(() => {
    generateSecureTOTPSecret();
  }, []);

  const generateSecureTOTPSecret = async () => {
    try {
      setIsGenerating(true);
      
      // Generate TOTP secret on secure backend
      const response = await secureBackendService.generateTOTPSecret(userId);
      
      if (response.success) {
        setQrCode(response.qrCode);
        setBackupCodes(response.backupCodes);
        
        console.log('✅ Secure TOTP secret generated on backend');
        toast.success('TOTP setup ready - scan the QR code');
      } else {
        throw new Error('Failed to generate TOTP secret');
      }
    } catch (error) {
      console.error('❌ Error generating secure TOTP:', error);
      toast.error('Failed to setup TOTP authentication');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleVerifyTOTP = async () => {
    if (totpCode.length !== 6) {
      toast.error('Please enter the 6-digit code');
      return;
    }

    setIsVerifying(true);

    try {
      // Verify TOTP code on secure backend
      const response = await secureBackendService.verifyTOTPCode(userId, totpCode);
      
      if (response.success && response.verified) {
        toast.success('TOTP verified successfully!');
        
        // NEVER store TOTP secret in frontend!
        // Backend handles all TOTP operations securely
        
        // Call completion callback
        onComplete();
      } else {
        toast.error('Invalid code. Please try again.');
        setTotpCode('');
      }
    } catch (error) {
      console.error('❌ TOTP verification error:', error);
      toast.error('Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const downloadBackupCodes = () => {
    const codesText = backupCodes.join('\n');
    const blob = new Blob([
      `Cyphr Messenger TOTP Backup Codes\n` +
      `Generated: ${new Date().toISOString()}\n` +
      `User: ${userId}\n\n` +
      `IMPORTANT: Store these codes securely!\n` +
      `Each code can only be used once.\n\n` +
      codesText
    ], { type: 'text/plain' });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cyphr-backup-codes-${userId}-${Date.now()}.txt`;
    a.click();
    
    URL.revokeObjectURL(url);
    setBackupCodesDownloaded(true);
    toast.success('Backup codes downloaded');
  };

  if (isGenerating) {
    return (
      <div className="w-full max-w-md mx-auto text-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-6"
        >
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-white animate-pulse" />
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-2">
            Generating Secure TOTP
          </h2>
          <p className="text-gray-300 text-sm">
            Creating quantum-safe authentication on backend...
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-6"
      >
        <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8 text-white" />
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-2">
          Secure TOTP Authentication
        </h2>
        <p className="text-gray-300 text-sm">
          Your TOTP secret is generated and stored securely on our backend
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 mb-6"
      >
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
          <QrCode className="w-5 h-5 mr-2" />
          Scan QR Code
        </h3>
        
        {qrCode && (
          <div className="bg-white p-4 rounded-lg mb-4 flex justify-center">
            <img src={qrCode} alt="TOTP QR Code" className="max-w-full h-auto" />
          </div>
        )}
        
        <div className="text-sm text-gray-300 space-y-2 mb-4">
          <p>1. Install an authenticator app (Google Authenticator, Authy, 1Password)</p>
          <p>2. Scan the QR code above</p>
          <p>3. Enter the 6-digit code from your app below</p>
        </div>

        <div className="space-y-4">
          <div>
            <input
              type="text"
              maxLength={6}
              placeholder="Enter 6-digit code"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 text-center text-xl tracking-widest"
            />
          </div>
          
          <Button
            onClick={handleVerifyTOTP}
            disabled={isVerifying || totpCode.length !== 6}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {isVerifying ? 'Verifying...' : 'Verify & Enable TOTP'}
          </Button>
        </div>
      </motion.div>

      {/* Backup Codes Section */}
      {backupCodes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4 mb-6"
        >
          <h3 className="text-lg font-semibold text-yellow-300 mb-3 flex items-center">
            <Download className="w-5 h-5 mr-2" />
            Backup Codes
          </h3>
          
          <p className="text-sm text-yellow-200 mb-3">
            Save these backup codes in a secure location. Each code can only be used once.
          </p>
          
          <div className="grid grid-cols-2 gap-2 mb-4">
            {backupCodes.map((code, index) => (
              <div key={index} className="bg-gray-800 p-2 rounded text-center font-mono text-sm text-white">
                {code}
              </div>
            ))}
          </div>
          
          <Button
            onClick={downloadBackupCodes}
            variant="outline"
            className="w-full border-yellow-600 text-yellow-300 hover:bg-yellow-600/10"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Backup Codes
          </Button>
        </motion.div>
      )}

      <div className="flex space-x-3">
        <Button
          onClick={onSkip}
          variant="ghost"
          className="flex-1 text-gray-400 hover:text-white"
        >
          Skip for Now
        </Button>
      </div>

      {/* Security Notice */}
      <div className="mt-6 p-4 bg-green-900/20 border border-green-600/30 rounded-lg">
        <div className="flex items-start space-x-3">
          <Shield className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-green-200">
            <h4 className="font-semibold mb-1">Security Notice</h4>
            <p>Your TOTP secret is generated and stored securely on our backend. It never leaves our servers, ensuring maximum security for your account.</p>
          </div>
        </div>
      </div>
    </div>
  );
}