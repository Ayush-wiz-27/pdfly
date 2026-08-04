import crypto from 'crypto';

/**
 * Computes a secure HMAC-SHA256 hash for a password using JWT_SECRET as the salt key.
 * @param {string} password - Raw password.
 * @returns {string} - Hex encoded hashed password.
 */
export function hashPassword(password) {
  if (!password) {
    throw new Error('Password payload is required for hashing.');
  }
  const salt = process.env.JWT_SECRET;
  return crypto.createHmac('sha256', salt).update(password).digest('hex');
}
