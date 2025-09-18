// AUTO CYPHR_ID GENERATION SYSTEM
// Every user gets unique @cyphr_id regardless of auth method

const crypto = require('crypto');

// Generate unique Cyphr_ID from name/email/phone
function generateCyphrId(baseIdentifier) {
  // Clean base identifier (name, email local part, or phone)
  let base = '';
  
  if (baseIdentifier.includes('@')) {
    // Email: alice@gmail.com → alice
    base = baseIdentifier.split('@')[0];
  } else if (baseIdentifier.startsWith('+')) {
    // Phone: +19075388374 → user_5388374 (last 7 digits)
    base = 'user_' + baseIdentifier.slice(-7);
  } else {
    // Name: Alice Johnson → alice_johnson
    base = baseIdentifier.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }
  
  // Clean and limit base
  base = base.substring(0, 12).replace(/[^a-z0-9_]/g, '');
  if (base.length < 3) base = 'user';
  
  // Add random suffix for uniqueness: alice_q7x9k
  const randomSuffix = crypto.randomBytes(3).toString('hex').substring(0, 5);
  
  return `${base}_${randomSuffix}`;
}

// Check if Cyphr_ID is available in database
async function isCyphrIdAvailable(supabase, cyphrId) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('cyphr_id', cyphrId)
      .single();
    
    // If no user found, cyphr_id is available
    return !data;
  } catch (error) {
    // Error means no user found, so available
    return true;
  }
}

// Generate unique Cyphr_ID with collision handling
async function generateUniqueCyphrId(supabase, baseIdentifier, maxAttempts = 10) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const cyphrId = generateCyphrId(baseIdentifier);
    const isAvailable = await isCyphrIdAvailable(supabase, cyphrId);
    
    if (isAvailable) {
      console.log(`✅ Generated unique Cyphr ID: @${cyphrId}`);
      return cyphrId;
    }
    
    console.log(`⚠️ Cyphr ID @${cyphrId} taken, generating another...`);
  }
  
  // Fallback: use timestamp-based ID
  const fallbackId = `user_${Date.now().toString(36)}`;
  console.log(`🚨 Using fallback Cyphr ID: @${fallbackId}`);
  return fallbackId;
}

// Validate Cyphr_ID format
function isValidCyphrIdFormat(cyphrId) {
  // 3-20 characters, lowercase letters, numbers, underscores only
  const regex = /^[a-z0-9_]{3,20}$/;
  return regex.test(cyphrId);
}

// Create user profile suggestions based on auth method
function generateProfileSuggestions(authMethod, identifier) {
  const suggestions = {};
  
  if (authMethod === 'email') {
    const emailLocal = identifier.split('@')[0];
    suggestions.fullName = emailLocal.charAt(0).toUpperCase() + emailLocal.slice(1);
    suggestions.bio = 'I am using Cyphr Messenger';
  } else if (authMethod === 'phone') {
    suggestions.fullName = 'Cyphr User';
    suggestions.bio = 'Secure messaging with post-quantum encryption';
  }
  
  return suggestions;
}

module.exports = {
  generateCyphrId,
  generateUniqueCyphrId,
  isCyphrIdAvailable,
  isValidCyphrIdFormat,
  generateProfileSuggestions
};