import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  KeyRound, 
  ArrowLeft, 
  AlertCircle, 
  CheckCircle,
  Eye,
  EyeOff,
  FileText,
  Upload
} from 'lucide-react';
import { Button } from '@/ui/button';
import { toast } from 'sonner';
import { HDWallet } from '@/api/crypto/hdWallet';

export default function SeedPhraseRestore({ onComplete, onCancel }) {
  const [seedPhrase, setSeedPhrase] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [inputMethod, setInputMethod] = useState('manual'); // 'manual' or 'file'

  const validateSeedPhrase = async (phrase) => {
    setIsValidating(true);
    
    try {
      const trimmedPhrase = phrase.trim();
      
      if (!trimmedPhrase) {
        setValidationResult({ valid: false, error: 'Seed phrase is required' });
        return;
      }

      const wordCount = HDWallet.getMnemonicWordCount(trimmedPhrase);
      if (![12, 15, 18, 21, 24].includes(wordCount)) {
        setValidationResult({ 
          valid: false, 
          error: `Invalid word count: ${wordCount}. Must be 12, 15, 18, 21, or 24 words.` 
        });
        return;
      }

      const isValid = HDWallet.validateMnemonic(trimmedPhrase);
      
      if (isValid) {
        setValidationResult({ 
          valid: true, 
          wordCount,
          message: `Valid ${wordCount}-word BIP39 mnemonic` 
        });
      } else {
        setValidationResult({ 
          valid: false, 
          error: 'Invalid BIP39 mnemonic. Please check your seed phrase.' 
        });
      }
    } catch (error) {
      setValidationResult({ 
        valid: false, 
        error: `Validation error: ${error.message}` 
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleSeedPhraseChange = (value) => {
    setSeedPhrase(value);
    setValidationResult(null);
    
    // Auto-validate after user stops typing
    clearTimeout(window.validateTimer);
    window.validateTimer = setTimeout(() => {
      if (value.trim()) {
        validateSeedPhrase(value);
      }
    }, 500);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/plain') {
      toast.error('Please upload a text file (.txt)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === 'string') {
        setSeedPhrase(content.trim());
        setInputMethod('manual');
        validateSeedPhrase(content.trim());
      }
    };
    reader.readAsText(file);
  };

  const handleRestore = async () => {
    if (!validationResult?.valid) {
      toast.error('Please enter a valid seed phrase');
      return;
    }

    try {
      toast.success('Wallet restored successfully!');
      onComplete(seedPhrase.trim());
    } catch (error) {
      console.error('Wallet restoration error:', error);
      toast.error('Failed to restore wallet');
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setSeedPhrase(text);
      validateSeedPhrase(text);
      toast.success('Pasted from clipboard');
    } catch (error) {
      toast.error('Failed to access clipboard');
    }
  };

  const formatSeedPhrase = (phrase) => {
    return phrase
      .toLowerCase()
      .replace(/[^a-z\s]/g, '') // Remove non-alphabetic characters except spaces
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
  };

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
          {/* Header */}
          <div className="text-center mb-6">
            <KeyRound className="w-16 h-16 text-blue-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">
              Restore Wallet
            </h2>
            <p className="text-gray-300">
              Enter your 12-24 word recovery phrase to restore your wallet
            </p>
          </div>

          {/* Input Method Selection */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={inputMethod === 'manual' ? 'default' : 'ghost'}
              onClick={() => setInputMethod('manual')}
              className="flex-1"
            >
              <FileText className="w-4 h-4 mr-2" />
              Type Manually
            </Button>
            <Button
              variant={inputMethod === 'file' ? 'default' : 'ghost'}
              onClick={() => setInputMethod('file')}
              className="flex-1"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload File
            </Button>
          </div>

          {/* File Upload */}
          {inputMethod === 'file' && (
            <div className="mb-4">
              <input
                type="file"
                accept=".txt"
                onChange={handleFileUpload}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white file:bg-blue-600 file:border-0 file:text-white file:rounded file:px-3 file:py-1 file:mr-3"
              />
              <p className="text-xs text-gray-400 mt-2">
                Upload a .txt file containing your seed phrase
              </p>
            </div>
          )}

          {/* Manual Input */}
          {inputMethod === 'manual' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-300">
                    Recovery Phrase
                  </label>
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
                      onClick={pasteFromClipboard}
                      className="text-gray-400 hover:text-white text-xs"
                    >
                      Paste
                    </Button>
                  </div>
                </div>
                
                <textarea
                  value={seedPhrase}
                  onChange={(e) => handleSeedPhraseChange(formatSeedPhrase(e.target.value))}
                  placeholder="Enter your recovery phrase (12-24 words)..."
                  rows={4}
                  className={`w-full bg-gray-700 border rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none resize-none ${
                    isVisible ? 'font-mono' : 'font-mono tracking-widest'
                  } ${
                    validationResult?.valid 
                      ? 'border-green-500' 
                      : validationResult?.valid === false 
                      ? 'border-red-500' 
                      : 'border-gray-600'
                  }`}
                  style={{ 
                    fontSize: isVisible ? '14px' : '14px',
                    lineHeight: '1.5'
                  }}
                />
                
                {/* Word Count */}
                {seedPhrase && (
                  <div className="text-xs text-gray-400">
                    Word count: {HDWallet.getMnemonicWordCount(seedPhrase)}
                  </div>
                )}
              </div>

              {/* Validation Status */}
              {isValidating && (
                <div className="flex items-center gap-2 text-blue-400">
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Validating...</span>
                </div>
              )}

              {validationResult && !isValidating && (
                <div className={`flex items-start gap-2 p-3 rounded-lg ${
                  validationResult.valid 
                    ? 'bg-green-900/20 border border-green-500/30' 
                    : 'bg-red-900/20 border border-red-500/30'
                }`}>
                  {validationResult.valid ? (
                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
                  )}
                  <div className={`text-sm ${
                    validationResult.valid ? 'text-green-300' : 'text-red-300'
                  }`}>
                    {validationResult.message || validationResult.error}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Security Warning */}
          <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5" />
              <div className="text-amber-300 text-sm">
                <p className="font-semibold mb-1">Security Reminder:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Never share your seed phrase with anyone</li>
                  <li>Cyphr support will never ask for your seed phrase</li>
                  <li>Make sure you're on the official Cyphr app</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={onCancel}
              className="flex-1"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleRestore}
              disabled={!validationResult?.valid}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              Restore Wallet
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}