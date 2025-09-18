import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  Eye, 
  EyeOff, 
  Copy, 
  Download, 
  AlertTriangle, 
  CheckCircle,
  RefreshCw,
  Lock
} from 'lucide-react';
import { Button } from '@/ui/button';
import { toast } from 'sonner';
import { HDWallet } from '@/api/crypto/hdWallet';

export default function SeedPhraseGeneration({ onComplete, onCancel }) {
  const [seedPhrase, setSeedPhrase] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [step, setStep] = useState(1); // 1: Generate, 2: Backup, 3: Verify
  const [verificationWords, setVerificationWords] = useState([]);
  const [userInputs, setUserInputs] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    generateSeedPhrase();
  }, []);

  const generateSeedPhrase = async () => {
    setIsGenerating(true);
    try {
      // Generate new BIP39 mnemonic
      const mnemonic = HDWallet.generateMnemonic(256); // 24 words
      setSeedPhrase(mnemonic);
      
      // Set up verification (random 3 words)
      const words = mnemonic.split(' ');
      const randomIndices = [];
      while (randomIndices.length < 3) {
        const idx = Math.floor(Math.random() * words.length);
        if (!randomIndices.includes(idx)) {
          randomIndices.push(idx);
        }
      }
      setVerificationWords(randomIndices.sort((a, b) => a - b));
    } catch (error) {
      console.error('Error generating seed phrase:', error);
      toast.error('Failed to generate seed phrase');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(seedPhrase);
    toast.success('Seed phrase copied to clipboard');
  };

  const downloadBackup = () => {
    const element = document.createElement('a');
    const file = new Blob([seedPhrase], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `cyphr-wallet-backup-${Date.now()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success('Backup file downloaded');
  };

  const handleVerification = () => {
    const words = seedPhrase.split(' ');
    let isValid = true;

    for (const idx of verificationWords) {
      if (userInputs[idx]?.toLowerCase().trim() !== words[idx].toLowerCase()) {
        isValid = false;
        break;
      }
    }

    if (isValid) {
      setIsConfirmed(true);
      toast.success('Seed phrase verified successfully!');
      setTimeout(() => {
        onComplete(seedPhrase);
      }, 1000);
    } else {
      toast.error('Verification failed. Please check your words.');
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Shield className="w-16 h-16 text-blue-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">
          Generate Recovery Phrase
        </h2>
        <p className="text-gray-300">
          Your wallet will be secured by a 24-word recovery phrase
        </p>
      </div>

      {isGenerating ? (
        <div className="text-center py-8">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-300">Generating quantum-safe entropy...</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
              <div className="text-red-300 text-sm space-y-2">
                <p className="font-semibold">Critical Security Warning:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Your seed phrase is NEVER stored by Cyphr</li>
                  <li>Write it down on paper and store safely</li>
                  <li>Anyone with your seed phrase controls your funds</li>
                  <li>Lost seed phrases cannot be recovered</li>
                </ul>
              </div>
            </div>
          </div>

          <Button 
            onClick={() => setStep(2)}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            I Understand - Show My Seed Phrase
          </Button>
        </div>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Lock className="w-16 h-16 text-amber-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">
          Your Recovery Phrase
        </h2>
        <p className="text-gray-300">
          Write these 24 words down in order
        </p>
      </div>

      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-600">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-gray-300">
            Recovery Phrase (24 words)
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsVisible(!isVisible)}
              className="text-gray-400 hover:text-white"
            >
              {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={copyToClipboard}
              className="text-gray-400 hover:text-white"
            >
              <Copy className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={downloadBackup}
              className="text-gray-400 hover:text-white"
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {seedPhrase.split(' ').map((word, index) => (
            <div
              key={index}
              className="bg-gray-700 rounded-lg p-3 text-center"
            >
              <div className="text-xs text-gray-400 mb-1">{index + 1}</div>
              <div className="font-mono text-white">
                {isVisible ? word : '••••••'}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
          <div className="text-amber-300 text-sm">
            <p className="font-semibold mb-1">Security Checklist:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Have you written down all 24 words?</li>
              <li>Are they in the correct order?</li>
              <li>Is your backup stored securely?</li>
            </ul>
          </div>
        </div>
      </div>

      <Button 
        onClick={() => setStep(3)}
        className="w-full bg-amber-600 hover:bg-amber-700"
      >
        I've Backed Up My Seed Phrase
      </Button>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">
          Verify Your Backup
        </h2>
        <p className="text-gray-300">
          Enter the requested words to confirm your backup
        </p>
      </div>

      <div className="space-y-4">
        {verificationWords.map((wordIndex) => (
          <div key={wordIndex} className="space-y-2">
            <label className="text-sm font-medium text-gray-300">
              Word #{wordIndex + 1}
            </label>
            <input
              type="text"
              placeholder={`Enter word ${wordIndex + 1}`}
              value={userInputs[wordIndex] || ''}
              onChange={(e) => setUserInputs({
                ...userInputs,
                [wordIndex]: e.target.value
              })}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Button
          variant="ghost"
          onClick={() => setStep(2)}
          className="flex-1"
        >
          Back to Phrase
        </Button>
        <Button
          onClick={handleVerification}
          disabled={verificationWords.some(idx => !userInputs[idx]?.trim())}
          className="flex-1 bg-green-600 hover:bg-green-700"
        >
          Verify & Complete
        </Button>
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-gray-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6">
          {/* Progress Indicator */}
          <div className="flex items-center justify-center mb-6">
            {[1, 2, 3].map((num) => (
              <React.Fragment key={num}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  step >= num ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'
                }`}>
                  {isConfirmed && num === 3 ? <CheckCircle className="w-4 h-4" /> : num}
                </div>
                {num < 3 && (
                  <div className={`w-12 h-0.5 ${
                    step > num ? 'bg-blue-600' : 'bg-gray-700'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
            >
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
            </motion.div>
          </AnimatePresence>

          {/* Cancel Button */}
          {!isConfirmed && (
            <div className="mt-6 pt-4 border-t border-gray-700">
              <Button
                variant="ghost"
                onClick={onCancel}
                className="w-full text-gray-400 hover:text-white"
              >
                Cancel Wallet Creation
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}