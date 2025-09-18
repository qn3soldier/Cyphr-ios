/**
 * Enterprise Security Features Component
 * Multi-signature wallets and hardware wallet integration
 */

import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Users, 
  Usb, 
  Key, 
  Lock, 
  CheckCircle,
  AlertTriangle,
  Settings,
  Plus,
  Trash2,
  Clock,
  DollarSign
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import MultiSigWalletService from '../api/multiSigWalletService';
import HardwareWalletService from '../api/hardwareWalletService';

const EnterpriseSecurityFeatures = ({ className = '', userId = null }) => {
  const [multiSigService] = useState(() => new MultiSigWalletService('testnet'));
  const [hardwareWalletService] = useState(() => new HardwareWalletService('testnet'));
  const [multiSigWallets, setMultiSigWallets] = useState([]);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [availableDevices, setAvailableDevices] = useState([]);
  
  const [multiSigConfig, setMultiSigConfig] = useState({
    enabled: false,
    requiredSignatures: 2,
    totalSigners: 3,
    signers: []
  });
  
  const [hardwareWallet, setHardwareWallet] = useState({
    connected: false,
    type: null,
    enabled: false,
    deviceId: null,
    firmwareVersion: null,
    stellarSupported: false,
    publicKey: null
  });

  const [newSignerForm, setNewSignerForm] = useState({
    show: false,
    userId: '',
    userEmail: '',
    userName: '',
    stellarPublicKey: '',
    role: 'signer',
    permissions: {
      canSign: true,
      canAddSigners: false,
      canRemoveSigners: false,
      canChangeThreshold: false,
      maxTransactionAmount: null,
      allowedAssets: ['XLM', 'USDC']
    }
  });

  // Load user's multi-sig wallets on component mount
  useEffect(() => {
    if (userId) {
      loadUserMultiSigWallets();
    }
  }, [userId]);

  // Load pending transactions when a wallet is selected
  useEffect(() => {
    if (selectedWallet) {
      loadPendingTransactions();
    }
  }, [selectedWallet]);

  const loadUserMultiSigWallets = async () => {
    try {
      setLoading(true);
      // In a real implementation, you'd fetch wallets for the user
      // For now, we'll simulate with empty array
      setMultiSigWallets([]);
    } catch (error) {
      console.error('Error loading multi-sig wallets:', error);
      toast.error('Failed to load multi-sig wallets');
    } finally {
      setLoading(false);
    }
  };

  const loadPendingTransactions = async () => {
    if (!selectedWallet) return;
    
    try {
      const transactions = await multiSigService.getPendingTransactions(selectedWallet.id);
      setPendingTransactions(transactions);
    } catch (error) {
      console.error('Error loading pending transactions:', error);
      toast.error('Failed to load pending transactions');
    }
  };

  const handleCreateMultiSigWallet = async () => {
    if (!userId) {
      toast.error('User ID required to create multi-sig wallet');
      return;
    }

    try {
      setLoading(true);
      toast.loading('Creating multi-signature wallet...');

      const initialSigners = multiSigConfig.signers.map(signer => ({
        userId: signer.userId || `user_${Date.now()}`,
        userEmail: signer.email || `${signer.name.toLowerCase().replace(' ', '.')}@company.com`,
        userName: signer.name,
        publicKey: signer.publicKey,
        stellarPublicKey: signer.stellarPublicKey || signer.publicKey,
        role: 'signer',
        status: 'pending',
        permissions: {
          canSign: true,
          canAddSigners: false,
          canRemoveSigners: false,
          canChangeThreshold: false,
          maxTransactionAmount: 10000,
          allowedAssets: ['XLM', 'USDC']
        }
      }));

      const wallet = await multiSigService.createMultiSigWallet(
        userId,
        multiSigConfig.requiredSignatures,
        multiSigConfig.totalSigners,
        initialSigners
      );

      setMultiSigWallets(prev => [...prev, wallet]);
      setSelectedWallet(wallet);
      setMultiSigConfig(prev => ({ ...prev, enabled: true }));

      toast.success('Multi-signature wallet created successfully!');
      console.log('Multi-sig wallet created:', wallet);

    } catch (error) {
      console.error('Error creating multi-sig wallet:', error);
      toast.error(`Failed to create wallet: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSigner = async () => {
    if (!selectedWallet || !userId) {
      toast.error('No wallet selected or user not authenticated');
      return;
    }

    try {
      const newSigner = {
        userId: newSignerForm.userId,
        userEmail: newSignerForm.userEmail,
        userName: newSignerForm.userName,
        publicKey: newSignerForm.stellarPublicKey,
        stellarPublicKey: newSignerForm.stellarPublicKey,
        role: newSignerForm.role,
        status: 'pending',
        permissions: newSignerForm.permissions
      };

      await multiSigService.addSigner(selectedWallet.id, userId, newSigner);
      
      toast.success('Signer added successfully');
      setNewSignerForm(prev => ({ ...prev, show: false }));
      await loadUserMultiSigWallets(); // Refresh wallet list
      
    } catch (error) {
      console.error('Error adding signer:', error);
      toast.error(`Failed to add signer: ${error.message}`);
    }
  };

  const handleRemoveSigner = async (signerId) => {
    if (!selectedWallet || !userId) return;

    try {
      await multiSigService.removeSigner(selectedWallet.id, userId, signerId);
      toast.success('Signer removed successfully');
      await loadUserMultiSigWallets(); // Refresh wallet list
    } catch (error) {
      console.error('Error removing signer:', error);
      toast.error(`Failed to remove signer: ${error.message}`);
    }
  };

  const handleSignTransaction = async (transactionId) => {
    if (!userId) return;

    try {
      toast.loading('Signing transaction...');
      await multiSigService.signTransaction(transactionId, userId);
      toast.success('Transaction signed successfully');
      await loadPendingTransactions(); // Refresh pending transactions
    } catch (error) {
      console.error('Error signing transaction:', error);
      toast.error(`Failed to sign transaction: ${error.message}`);
    }
  };

  const handleMultiSigToggle = () => {
    if (!multiSigConfig.enabled && multiSigWallets.length === 0) {
      handleCreateMultiSigWallet();
    } else {
      setMultiSigConfig(prev => ({
        ...prev,
        enabled: !prev.enabled
      }));
      
      if (!multiSigConfig.enabled) {
        toast.success('Multi-signature wallet enabled');
      } else {
        toast.info('Multi-signature wallet disabled');
      }
    }
  };

  // Load available hardware devices on component mount
  useEffect(() => {
    detectHardwareDevices();
  }, []);

  const detectHardwareDevices = async () => {
    try {
      setLoading(true);
      console.log('🔍 Scanning for hardware wallets...');
      
      const devices = await hardwareWalletService.detectDevices();
      setAvailableDevices(devices);
      
      if (devices.length === 0) {
        console.log('ℹ️ No hardware wallets detected');
      } else {
        console.log(`✅ Found ${devices.length} hardware wallet(s)`);
      }
    } catch (error) {
      console.error('❌ Error detecting hardware wallets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleHardwareWalletConnect = async (type) => {
    try {
      setLoading(true);
      toast.loading(`Connecting to ${type} hardware wallet...`);

      // Check browser support first
      const browserSupport = hardwareWalletService.checkBrowserSupport();
      if (!browserSupport.supported) {
        toast.error('Browser does not support hardware wallets. Please use Chrome, Firefox, or Edge.');
        return;
      }

      // Find device of the specified type
      const targetDevice = availableDevices.find(device => device.type === type);
      
      if (!targetDevice) {
        toast.error(`No ${type} device found. Please connect your device and try again.`);
        return;
      }

      // Attempt connection
      const connected = await hardwareWalletService.connectToDevice(type, targetDevice.deviceId);
      
      if (connected) {
        // Get device status
        const deviceStatus = hardwareWalletService.getDeviceStatus();
        
        // Get Stellar public key
        const publicKey = await hardwareWalletService.getStellarPublicKey();
        
        // Update state
        setHardwareWallet({
          connected: true,
          type: type,
          enabled: true,
          deviceId: deviceStatus.deviceId,
          firmwareVersion: deviceStatus.firmwareVersion,
          stellarSupported: true,
          publicKey: publicKey
        });

        toast.success(`${type} hardware wallet connected successfully!`);
        console.log(`✅ ${type} connected:`, {
          deviceId: deviceStatus.deviceId,
          firmware: deviceStatus.firmwareVersion,
          publicKey: publicKey ? `${publicKey.substring(0, 8)}...` : 'N/A'
        });

        // Save connection preference
        await hardwareWalletService.storeDevicePreferences({
          preferredDevice: type,
          autoConnect: true
        });
        
      } else {
        toast.error(`Failed to connect to ${type}. Please check your device and try again.`);
      }

    } catch (error) {
      console.error(`❌ ${type} connection error:`, error);
      toast.error(`${type} connection failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleHardwareWalletDisconnect = async () => {
    try {
      await hardwareWalletService.disconnect();
      
      setHardwareWallet({
        connected: false,
        type: null,
        enabled: false,
        deviceId: null,
        firmwareVersion: null,
        stellarSupported: false,
        publicKey: null
      });

      toast.info('Hardware wallet disconnected');
      console.log('🔌 Hardware wallet disconnected');
      
    } catch (error) {
      console.error('❌ Error disconnecting hardware wallet:', error);
      toast.error('Failed to disconnect hardware wallet');
    }
  };

  const handleSignWithHardwareWallet = async (transactionXdr, amount, destination, memo) => {
    if (!hardwareWallet.connected) {
      toast.error('No hardware wallet connected');
      return null;
    }

    try {
      toast.loading('Please confirm transaction on your hardware wallet...');
      
      const request = {
        transactionXdr,
        networkPassphrase: hardwareWalletService.networkPassphrase,
        accountPath: "44'/148'/0'",
        amount,
        destination,
        memo,
        assetCode: 'XLM'
      };

      const result = await hardwareWalletService.signStellarTransaction(request);

      if (result.success) {
        toast.success('Transaction signed successfully!');
        return result.signedTransaction;
      } else if (result.userCancelled) {
        toast.info('Transaction cancelled by user');
        return null;
      } else {
        toast.error(`Signing failed: ${result.error}`);
        return null;
      }

    } catch (error) {
      console.error('❌ Hardware wallet signing failed:', error);
      toast.error(`Hardware signing failed: ${error.message}`);
      return null;
    }
  };


  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="glass rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-4">
          <Shield className="w-6 h-6 text-purple-400" />
          Enterprise Security
        </h2>
        <p className="text-white/60 text-sm">
          Advanced security features for organizations and high-value accounts
        </p>
      </div>

      {/* Multi-Signature Wallets */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Multi-Signature Wallets</h3>
          </div>
          <button
            onClick={handleMultiSigToggle}
            className={`w-12 h-6 rounded-full transition-colors ${
              multiSigConfig.enabled ? 'bg-blue-500' : 'bg-white/20'
            }`}
          >
            <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
              multiSigConfig.enabled ? 'translate-x-6' : 'translate-x-0.5'
            }`} />
          </button>
        </div>

        {multiSigConfig.enabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Required Signatures
                </label>
                <select
                  value={multiSigConfig.requiredSignatures}
                  onChange={(e) => setMultiSigConfig(prev => ({
                    ...prev,
                    requiredSignatures: parseInt(e.target.value)
                  }))}
                  className="w-full p-2 glass rounded-lg text-white"
                >
                  <option value={1} className="bg-gray-900">1 of N</option>
                  <option value={2} className="bg-gray-900">2 of N</option>
                  <option value={3} className="bg-gray-900">3 of N</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Total Signers
                </label>
                <select
                  value={multiSigConfig.totalSigners}
                  onChange={(e) => setMultiSigConfig(prev => ({
                    ...prev,
                    totalSigners: parseInt(e.target.value)
                  }))}
                  className="w-full p-2 glass rounded-lg text-white"
                >
                  <option value={2} className="bg-gray-900">2 Signers</option>
                  <option value={3} className="bg-gray-900">3 Signers</option>
                  <option value={5} className="bg-gray-900">5 Signers</option>
                </select>
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <div className="text-sm text-blue-400 mb-2">
                Configuration: {multiSigConfig.requiredSignatures} of {multiSigConfig.totalSigners} signatures required
              </div>
              <div className="text-xs text-white/60">
                Transactions will require {multiSigConfig.requiredSignatures} authorized signatures to execute
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-white">Authorized Signers</h4>
                <button
                  onClick={() => setNewSignerForm(prev => ({ ...prev, show: true }))}
                  className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-3 py-1 rounded-lg text-sm transition-colors flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add Signer
                </button>
              </div>

              {multiSigConfig.signers.length === 0 ? (
                <div className="text-center py-4 text-white/60">
                  No signers added yet
                </div>
              ) : (
                <div className="space-y-2">
                  {multiSigConfig.signers.map((signer) => (
                    <div key={signer.id} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                      <div>
                        <div className="font-medium text-white">{signer.name}</div>
                        <div className="text-xs text-white/60">{signer.publicKey}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {signer.verified ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-yellow-400" />
                        )}
                        <button
                          onClick={() => handleRemoveSigner(signer.id)}
                          className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pending Transactions Section */}
            {selectedWallet && pendingTransactions.length > 0 && (
              <div className="mt-6">
                <h4 className="font-medium text-white mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-yellow-400" />
                  Pending Transactions ({pendingTransactions.length})
                </h4>
                <div className="space-y-3">
                  {pendingTransactions.map((tx) => (
                    <div key={tx.id} className="bg-white/5 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-green-400" />
                          <span className="font-medium text-white">
                            {tx.amount} {tx.assetCode}
                          </span>
                        </div>
                        <div className="text-xs text-white/60">
                          {tx.signatures.length}/{tx.requiredSignatures} signatures
                        </div>
                      </div>
                      <div className="text-sm text-white/80 mb-2">
                        To: {tx.destinationAddress.substring(0, 20)}...
                      </div>
                      {tx.memo && (
                        <div className="text-xs text-white/60 mb-3">
                          Memo: {tx.memo}
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-white/60">
                          Expires: {new Date(tx.expiresAt).toLocaleDateString()}
                        </div>
                        <button
                          onClick={() => handleSignTransaction(tx.id)}
                          disabled={tx.signatures.some(s => s.signerId === userId)}
                          className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-3 py-1 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {tx.signatures.some(s => s.signerId === userId) ? 'Signed' : 'Sign'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add New Signer Modal */}
            {newSignerForm.show && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                onClick={() => setNewSignerForm(prev => ({ ...prev, show: false }))}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-gray-900 rounded-2xl p-6 w-full max-w-md mx-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-lg font-semibold text-white mb-4">Add New Signer</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        User ID
                      </label>
                      <input
                        type="text"
                        value={newSignerForm.userId}
                        onChange={(e) => setNewSignerForm(prev => ({ ...prev, userId: e.target.value }))}
                        className="w-full p-2 glass rounded-lg text-white"
                        placeholder="Enter user ID"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        value={newSignerForm.userEmail}
                        onChange={(e) => setNewSignerForm(prev => ({ ...prev, userEmail: e.target.value }))}
                        className="w-full p-2 glass rounded-lg text-white"
                        placeholder="Enter email address"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Name
                      </label>
                      <input
                        type="text"
                        value={newSignerForm.userName}
                        onChange={(e) => setNewSignerForm(prev => ({ ...prev, userName: e.target.value }))}
                        className="w-full p-2 glass rounded-lg text-white"
                        placeholder="Enter full name"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Stellar Public Key
                      </label>
                      <input
                        type="text"
                        value={newSignerForm.stellarPublicKey}
                        onChange={(e) => setNewSignerForm(prev => ({ ...prev, stellarPublicKey: e.target.value }))}
                        className="w-full p-2 glass rounded-lg text-white"
                        placeholder="G..."
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Role
                      </label>
                      <select
                        value={newSignerForm.role}
                        onChange={(e) => setNewSignerForm(prev => ({ ...prev, role: e.target.value }))}
                        className="w-full p-2 glass rounded-lg text-white"
                      >
                        <option value="signer" className="bg-gray-900">Signer</option>
                        <option value="observer" className="bg-gray-900">Observer</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Max Transaction Amount
                      </label>
                      <input
                        type="number"
                        value={newSignerForm.permissions.maxTransactionAmount || ''}
                        onChange={(e) => setNewSignerForm(prev => ({ 
                          ...prev, 
                          permissions: { 
                            ...prev.permissions, 
                            maxTransactionAmount: parseFloat(e.target.value) || null 
                          }
                        }))}
                        className="w-full p-2 glass rounded-lg text-white"
                        placeholder="0 (unlimited)"
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => setNewSignerForm(prev => ({ ...prev, show: false }))}
                      className="flex-1 p-2 glass rounded-lg text-white hover:bg-white/10"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddSigner}
                      className="flex-1 p-2 bg-blue-500 rounded-lg text-white hover:bg-blue-600"
                    >
                      Add Signer
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>

      {/* Hardware Wallet Integration */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <Usb className="w-5 h-5 text-green-400" />
          <h3 className="text-lg font-semibold text-white">Hardware Wallet Integration</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => handleHardwareWalletConnect('Ledger')}
            disabled={hardwareWallet.connected}
            className="p-4 glass rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Key className="w-6 h-6 text-blue-400" />
              </div>
              <div className="font-medium text-white">Ledger</div>
              <div className="text-xs text-white/60">Hardware Security</div>
            </div>
          </button>

          <button
            onClick={() => handleHardwareWalletConnect('Trezor')}
            disabled={hardwareWallet.connected}
            className="p-4 glass rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <div className="text-center">
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                <Lock className="w-6 h-6 text-green-400" />
              </div>
              <div className="font-medium text-white">Trezor</div>
              <div className="text-xs text-white/60">Cold Storage</div>
            </div>
          </button>
        </div>

        {/* Available Devices Display */}
        {availableDevices.length > 0 && !hardwareWallet.connected && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-white mb-2">Available Devices:</h4>
            <div className="space-y-2">
              {availableDevices.map((device, index) => (
                <div key={index} className="bg-white/5 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white capitalize">{device.type}</div>
                    <div className="text-xs text-white/60">
                      Firmware: {device.firmwareVersion} | Stellar: {device.stellarSupported ? 'Yes' : 'No'}
                    </div>
                  </div>
                  <button
                    onClick={() => handleHardwareWalletConnect(device.type)}
                    disabled={loading}
                    className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-3 py-1 rounded text-sm disabled:opacity-50"
                  >
                    Connect
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {hardwareWallet.connected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green-500/10 border border-green-500/20 rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="font-medium text-green-400 capitalize">
                  {hardwareWallet.type} Connected
                </span>
              </div>
              <button
                onClick={handleHardwareWalletDisconnect}
                className="text-red-400 hover:text-red-300 text-sm"
              >
                Disconnect
              </button>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/60">Device ID:</span>
                <span className="text-white/80">{hardwareWallet.deviceId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Firmware:</span>
                <span className="text-white/80">{hardwareWallet.firmwareVersion}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Stellar Support:</span>
                <span className="text-green-400">✓ Active</span>
              </div>
              {hardwareWallet.publicKey && (
                <div className="flex justify-between">
                  <span className="text-white/60">Public Key:</span>
                  <span className="text-white/80 font-mono">
                    {hardwareWallet.publicKey.substring(0, 8)}...
                  </span>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-green-500/20">
              <div className="text-xs text-white/60">
                Hardware wallet is ready for secure transaction signing
              </div>
            </div>
          </motion.div>
        )}

        {/* Refresh/Scan Button */}
        <div className="mt-4">
          <button
            onClick={detectHardwareDevices}
            disabled={loading}
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Scanning...' : '🔄 Scan for Devices'}
          </button>
        </div>
      </div>

      {/* Advanced Security Settings */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-yellow-400" />
          <h3 className="text-lg font-semibold text-white">Advanced Security</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-white">Transaction Delays</div>
              <div className="text-sm text-white/60">Add time delays for large transactions</div>
            </div>
            <button className="w-12 h-6 rounded-full bg-white/20">
              <div className="w-5 h-5 bg-white rounded-full translate-x-0.5" />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-white">Recovery Phrase Splitting</div>
              <div className="text-sm text-white/60">Split recovery phrase across multiple secure locations</div>
            </div>
            <button className="w-12 h-6 rounded-full bg-white/20">
              <div className="w-5 h-5 bg-white rounded-full translate-x-0.5" />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-white">Enhanced Audit Logging</div>
              <div className="text-sm text-white/60">Detailed logging for enterprise compliance</div>
            </div>
            <button className="w-12 h-6 rounded-full bg-yellow-500">
              <div className="w-5 h-5 bg-white rounded-full translate-x-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnterpriseSecurityFeatures;