let argon2;
try {
  argon2 = require('@node-rs/argon2');
} catch (e) {
  argon2 = null;
}
const bcrypt = require('bcryptjs');

async function hashPassword(plainText) {
  if (argon2) {
    try {
      return await argon2.hash(plainText, {
        memoryCost: 19456,
        timeCost: 2,
        outputLen: 32,
        parallelism: 1
      });
    } catch (err) {
      console.warn('[Password] Argon2 failed, falling back to bcryptjs:', err.message);
    }
  }
  const salt = await bcrypt.genSalt(12);
  return await bcrypt.hash(plainText, salt);
}

async function verifyPassword(plainText, hash) {
  if (!hash || !plainText) return false;
  
  if (hash.startsWith('$argon2') && argon2) {
    try {
      return await argon2.verify(hash, plainText);
    } catch (err) {
      console.warn('[Password] Argon2 verify error:', err.message);
      return false;
    }
  }
  
  // Bcrypt verification
  try {
    return await bcrypt.compare(plainText, hash);
  } catch (err) {
    return false;
  }
}

module.exports = {
  hashPassword,
  verifyPassword
};
