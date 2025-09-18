import * as StellarSdk from '@stellar/stellar-sdk';
import { supabase } from './awsClient';
import QuantumCryptoSecure from './crypto/quantumCryptoSecure';

// Use testnet for development
const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
const networkPassphrase = StellarSdk.Networks.TESTNET;

class StellarService {
  constructor() {
    this.server = server;
    this.networkPassphrase = networkPassphrase;
    this.quantum = QuantumCryptoSecure;
    this.userKeyPair = null; // Cached quantum key pair
  }

  // Инициализация квантовых ключей пользователя
  async initializeUserQuantumKeys(userId) {
    try {
      // Проверяем есть ли уже quantum keys у пользователя
      const { data: quantumKeys, error } = await supabase
        .from('quantum_keys')
        .select('public_key, secret_key')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (quantumKeys) {
        // Используем существующие ключи
        this.userKeyPair = {
          publicKey: quantumKeys.public_key,
          secretKey: quantumKeys.secret_key
        };
        console.log('✅ Quantum keys loaded from database');
        return this.userKeyPair;
      }

      // Генерируем новые quantum keys
      console.log('🔑 Generating new quantum key pair...');
      const keyPair = await this.quantum.generateKeyPair();
      
      // Сохраняем в базу данных
      const { error: insertError } = await supabase
        .from('quantum_keys')
        .insert({
          user_id: userId,
          public_key: keyPair.publicKey,
          secret_key: keyPair.secretKey,
          created_at: new Date().toISOString()
        });

      if (insertError) {
        throw insertError;
      }

      this.userKeyPair = keyPair;
      console.log('✅ Quantum keys generated and stored');
      return keyPair;
      
    } catch (error) {
      console.error('❌ Error initializing quantum keys:', error);
      throw error;
    }
  }

  // Реальная функция создания кошелька с квантовым шифрованием
  async createWallet() {
    try {
      const userId = sessionStorage.getItem('userId');
      if (!userId) {
        throw new Error('User not authenticated');
      }

      console.log('🔐 Creating quantum-encrypted wallet...');

      // Инициализируем quantum keys
      await this.initializeUserQuantumKeys(userId);

      // Генерируем Stellar keypair
      const keypair = StellarSdk.Keypair.random();
      const publicKey = keypair.publicKey();
      const secretKey = keypair.secret();

      // Шифруем приватный ключ квантовым шифрованием
      console.log('🔒 Encrypting private key with quantum crypto...');
      const encryptedSecretKey = await this.quantum.encryptMessage(
        secretKey,
        this.userKeyPair.publicKey,
        this.userKeyPair.secretKey
      );

      // Store wallet in Supabase с зашифрованным ключом
      const { data, error } = await supabase
        .from('wallets')
        .upsert({
          user_id: userId,
          public_key: publicKey,
          encrypted_secret_key: JSON.stringify(encryptedSecretKey),
          encryption_type: 'quantum_kyber1024_chacha20_secure',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Supabase error:', error);
        throw error;
      }

      console.log('✅ Quantum-encrypted wallet created successfully');

      // Store decrypted key securely in quantum storage (not sessionStorage!)
      await this.quantum.storePrivateKey(`stellar_${userId}`, secretKey, userId);

      // Fund testnet account
      try {
        console.log('💰 Funding testnet account...');
        const fundResponse = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
        if (fundResponse.ok) {
          console.log('✅ Testnet account funded');
        } else {
          console.warn('⚠️ Friendbot funding may have failed');
        }
      } catch (e) {
        console.warn('⚠️ Friendbot funding failed:', e);
      }

      return { publicKey, secretKey };
    } catch (error) {
      console.error('❌ Error creating quantum-encrypted wallet:', error);
      throw error;
    }
  }

  // Реальная функция получения кошелька с расшифровкой
  async getUserWallet() {
    try {
      const userId = sessionStorage.getItem('userId');
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Проверяем secure storage
      const cachedSecret = await this.quantum.retrievePrivateKey(`stellar_${userId}`, userId);
      
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No wallet found, create one
          console.log('📦 No wallet found, creating new quantum-encrypted wallet...');
          return await this.createWallet();
        }
        throw error;
      }

      if (cachedSecret) {
        console.log('✅ Using securely stored decrypted key');
        return {
          publicKey: data.public_key,
          secretKey: cachedSecret
        };
      }

      // Инициализируем quantum keys если нет
      if (!this.userKeyPair) {
        await this.initializeUserQuantumKeys(userId);
      }

      // Расшифровываем приватный ключ
      console.log('🔓 Decrypting private key with quantum crypto...');
      let decryptedSecretKey;
      
      if (data.encrypted_secret_key && data.encryption_type.includes('quantum_kyber1024_chacha20')) {
        const encryptedPackage = JSON.parse(data.encrypted_secret_key);
        decryptedSecretKey = await this.quantum.decryptMessage(
          encryptedPackage,
          this.userKeyPair.secretKey,
          this.userKeyPair.publicKey
        );
      } else {
        // Fallback для старых записей - пересоздаем кошелек
        console.log('🔄 Old wallet format detected, recreating with quantum encryption...');
        return await this.createWallet();
      }

      // Store decrypted key securely
      await this.quantum.storePrivateKey(`stellar_${userId}`, decryptedSecretKey, userId);

      console.log('✅ Quantum-encrypted wallet loaded and decrypted');

      return {
        publicKey: data.public_key,
        secretKey: decryptedSecretKey
      };
    } catch (error) {
      console.error('❌ Error getting quantum-encrypted wallet:', error);
      throw error;
    }
  }

  // Get account balance
  async getBalance(publicKey) {
    try {
      const account = await this.server.loadAccount(publicKey);
      const balance = account.balances.find(b => b.asset_type === 'native');
      return parseFloat(balance?.balance || '0');
    } catch (error) {
      if (error.response?.status === 404) {
        return 0;
      }
      console.error('❌ Error getting balance:', error);
      return 0;
    }
  }

  // Get transaction history
  async getTransactionHistory(publicKey, limit = 20) {
    try {
      const transactions = await this.server
        .transactions()
        .forAccount(publicKey)
        .order('desc')
        .limit(limit)
        .call();

      const history = [];
      
      for (const tx of transactions.records) {
        try {
          const operations = await tx.operations();
          
          const txData = {
            id: tx.id,
            hash: tx.hash,
            created_at: tx.created_at,
            fee_charged: parseFloat(tx.fee_charged) / 10000000, // Convert stroops to XLM
            successful: tx.successful,
            operations: []
          };

          operations.records.forEach(op => {
            if (op.type === 'payment') {
              txData.operations.push({
                type: 'payment',
                amount: parseFloat(op.amount),
                from: op.from,
                to: op.to,
                asset_code: op.asset_code || 'XLM',
                direction: op.to === publicKey ? 'received' : 'sent'
              });
            } else if (op.type === 'create_account') {
              txData.operations.push({
                type: 'create_account',
                amount: parseFloat(op.starting_balance),
                from: op.source_account,
                to: op.account,
                asset_code: 'XLM',
                direction: op.account === publicKey ? 'received' : 'sent'
              });
            }
          });

          if (txData.operations.length > 0) {
            history.push(txData);
          }
        } catch (opError) {
          console.warn('⚠️ Error processing transaction:', opError);
        }
      }

      return history;
    } catch (error) {
      if (error.response?.status === 404) {
        return [];
      }
      console.error('❌ Error getting transaction history:', error);
      return [];
    }
  }

  // Send payment
  async sendPayment(destinationId, amount, memo = '') {
    try {
      console.log('💸 Sending payment:', { destinationId, amount, memo });
      
      const { publicKey, secretKey } = await this.getUserWallet();
      const sourceKeypair = StellarSdk.Keypair.fromSecret(secretKey);

      // Load source account
      const sourceAccount = await this.server.loadAccount(publicKey);

      // Check balance
      const balance = await this.getBalance(publicKey);
      const totalCost = parseFloat(amount) + 0.00001; // Amount + fee
      
      if (balance < totalCost) {
        throw new Error(`Insufficient balance. Available: ${balance} XLM, Required: ${totalCost} XLM`);
      }

      // Build transaction
      const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: await this.server.fetchBaseFee(),
        networkPassphrase: this.networkPassphrase
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: destinationId,
            asset: StellarSdk.Asset.native(),
            amount: amount.toString()
          })
        );

      // Add memo if provided
      if (memo.trim()) {
        transaction.addMemo(StellarSdk.Memo.text(memo.trim()));
      }

      const builtTransaction = transaction.setTimeout(180).build();

      // Sign transaction
      builtTransaction.sign(sourceKeypair);

      // Submit transaction
      const result = await this.server.submitTransaction(builtTransaction);

      console.log('✅ Payment sent successfully:', result.hash);

      // Store transaction in database
      try {
        await supabase
          .from('transactions')
          .insert({
            user_id: sessionStorage.getItem('userId'),
            transaction_hash: result.hash,
            from_address: publicKey,
            to_address: destinationId,
            amount: parseFloat(amount),
            asset: 'XLM',
            memo: memo,
            status: 'completed',
            created_at: new Date().toISOString()
          });
      } catch (dbError) {
        console.warn('⚠️ Failed to store transaction in DB:', dbError);
      }

      return result;
    } catch (error) {
      console.error('❌ Error sending payment:', error);
      throw error;
    }
  }

  // Check if address is valid
  isValidAddress(address) {
    try {
      StellarSdk.Keypair.fromPublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  // Format amount for display
  formatAmount(amount) {
    return parseFloat(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 7
    });
  }

  // Get network info
  getNetworkInfo() {
    return {
      network: 'Testnet',
      horizon: 'https://horizon-testnet.stellar.org',
      explorer: 'https://stellar.expert/explorer/testnet'
    };
  }
}

export default new StellarService(); 