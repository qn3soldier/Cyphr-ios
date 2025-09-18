// Simple test component to check imports
import React from 'react';

const TestImports = () => {
  React.useEffect(() => {
    console.log('🧪 Testing imports...');
    
    // Test HDWallet import
    import('../api/crypto/hdWallet').then(module => {
      console.log('✅ HDWallet imported:', module.default);
      console.log('Available methods:', Object.getOwnPropertyNames(module.default));
    }).catch(error => {
      console.error('❌ HDWallet import failed:', error);
    });

    // Test EncryptedWalletStorage import
    import('../api/crypto/encryptedWalletStorage').then(module => {
      console.log('✅ EncryptedWalletStorage imported:', module.default);
      console.log('Available methods:', Object.getOwnPropertyNames(module.default));
    }).catch(error => {
      console.error('❌ EncryptedWalletStorage import failed:', error);
    });

  }, []);

  return (
    <div style={{ padding: '20px', color: 'white', background: '#1a1a1a' }}>
      <h1>Import Test</h1>
      <p>Check console for import results</p>
    </div>
  );
};

export default TestImports;