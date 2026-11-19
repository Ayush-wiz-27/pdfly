import crypto from 'crypto';

export function hashPassword(password) {
  if (!password) {
    throw new Error('Password payload is required for hashing.');
  }
  const salt = process.env.JWT_SECRET;
  return crypto.createHmac('sha256', salt).update(password).digest('hex');
}
