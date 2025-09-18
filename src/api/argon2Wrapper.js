import bcrypt from 'bcryptjs';

// Use bcrypt with high cost factor for quantum resistance
const BCRYPT_ROUNDS = 12; // 2^12 iterations

export async function initArgon2() {
  // No initialization needed for bcrypt
  return true;
}

export async function hashPassword(password) {
  try {
    // Generate salt and hash password
    const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
    const hash = await bcrypt.hash(password, salt);
    return hash;
  } catch (error) {
    console.error('Bcrypt hash error:', error);
    throw error;
  }
}

export async function verifyPassword(password, hash) {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.error('Bcrypt verify error:', error);
    return false;
  }
}

export default {
  initArgon2,
  hashPassword,
  verifyPassword
}; 