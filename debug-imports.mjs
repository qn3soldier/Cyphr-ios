/**
 * Debug Import Test - Check if modules can be imported correctly
 */

console.log('🔍 Testing imports that might be causing white screen...');

// Test basic React components first
try {
  console.log('1️⃣ Testing basic imports...');
  
  // This would work in a browser environment with the @ alias
  console.log('✅ Basic test complete - will need browser environment for full test');
  
  // Let's check if files exist
  console.log('2️⃣ Checking file existence...');
  
  import fs from 'fs';
  import path from 'path';
  
  const filesToCheck = [
    'src/App.jsx',
    'src/components/ThemeProvider.jsx',
    'src/components/EnhancedAvatar.jsx',
    'src/components/AvatarProvider.jsx',
    'src/api/crypto/secureChaCha20.ts',
    'src/api/crypto/secureRNG.ts',
    'src/api/authService.js',
    'src/api/socketService.js',
    'src/lib/utils.ts',
    'src/ui/button.tsx',
    'src/ui/input.tsx'
  ];
  
  let missingFiles = [];
  let existingFiles = [];
  
  filesToCheck.forEach(file => {
    const fullPath = path.resolve(file);
    if (fs.existsSync(fullPath)) {
      existingFiles.push(file);
    } else {
      missingFiles.push(file);
    }
  });
  
  console.log(`✅ Found ${existingFiles.length} files:`);
  existingFiles.forEach(file => console.log(`   ✓ ${file}`));
  
  if (missingFiles.length > 0) {
    console.log(`❌ Missing ${missingFiles.length} files:`);
    missingFiles.forEach(file => console.log(`   ✗ ${file}`));
  }
  
  // Check for potential import issues
  console.log('3️⃣ Checking for potential syntax issues...');
  
  // Check if utils file exists (commonly imported)
  const utilsFiles = [
    'src/lib/utils.ts',
    'src/lib/utils.js', 
    'src/utils.ts',
    'src/utils.js'
  ];
  
  let foundUtils = false;
  utilsFiles.forEach(file => {
    if (fs.existsSync(path.resolve(file))) {
      console.log(`✅ Found utils file: ${file}`);
      foundUtils = true;
    }
  });
  
  if (!foundUtils) {
    console.log('❌ No utils file found - this could cause import errors');
  }
  
} catch (error) {
  console.error('❌ Import test failed:', error.message);
}

console.log('\n🔧 Recommendations:');
console.log('1. Check browser console for detailed error messages');
console.log('2. Verify all imported files exist and export correctly');
console.log('3. Check that @ alias is working in Vite');
console.log('4. Ensure TypeScript files are being processed correctly');