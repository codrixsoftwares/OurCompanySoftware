import argon2 from 'argon2';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

/**
 * OWASP Recommended Argon2id parameters:
 * - type: argon2id (resistant to side-channel and GPU cracking attacks)
 * - memoryCost: 65536 KiB (64 MiB)
 * - timeCost: 3 iterations
 * - parallelism: 4 threads
 * - saltLength: 16 bytes (cryptographically secure random)
 */
export const ARGON2_OPTIONS: any = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3,       // 3 iterations
  parallelism: 4,    // 4 threads
  hashLength: 32,
  saltLength: 16
};

/**
 * Hashes a plaintext password using Argon2id with unique cryptographically random salt.
 * Never stores or logs plaintext passwords.
 */
export async function hashPassword(plain: string): Promise<string> {
  if (!plain || typeof plain !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  const result = await argon2.hash(plain, ARGON2_OPTIONS);
  return typeof result === 'string' ? result : (result as Buffer).toString('utf-8');
}

/**
 * Verifies a plaintext password against a stored password hash.
 * Supports transparent upgrade from legacy bcrypt hashes to Argon2id.
 *
 * @returns {Promise<{ valid: boolean; needsRehash: boolean }>}
 */
export async function verifyPassword(
  plain: string,
  storedHash: string
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (!plain || !storedHash) {
    return { valid: false, needsRehash: false };
  }

  // 1. Check if stored hash is Argon2 ($argon2id$ or $argon2i$ or $argon2d$)
  if (storedHash.startsWith('$argon2')) {
    try {
      const valid = await argon2.verify(storedHash, plain);
      const needsRehash = argon2.needsRehash(storedHash, ARGON2_OPTIONS);
      return { valid, needsRehash };
    } catch (err) {
      console.error('[PasswordSecurity] Argon2 verify error:', err);
      return { valid: false, needsRehash: false };
    }
  }

  // 2. Legacy bcrypt compatibility ($2a$, $2b$, $2y$)
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
    try {
      const valid = await bcrypt.compare(plain, storedHash);
      return { valid, needsRehash: valid }; // If valid, flag for transparent rehash to Argon2id
    } catch (err) {
      console.error('[PasswordSecurity] Bcrypt verify error:', err);
      return { valid: false, needsRehash: false };
    }
  }

  return { valid: false, needsRehash: false };
}

/**
 * Generates a cryptographically secure random token (e.g. for single-use password resets).
 */
export function generateSecureRandomToken(byteLength = 32): string {
  return crypto.randomBytes(byteLength).toString('hex');
}

/**
 * Creates a SHA-256 hash of a sensitive reset token for secure single-use database storage.
 * The database never stores raw tokens; only the hash is stored.
 */
export function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Validates password strength according to modern OWASP security standards:
 * - At least 8 characters (recommended 10+)
 * - Contains at least one uppercase letter
 * - Contains at least one lowercase letter
 * - Contains at least one digit
 * - Contains at least one special symbol
 */
export function validatePasswordStrength(password: string): { isValid: boolean; message?: string } {
  if (!password || typeof password !== 'string') {
    return { isValid: false, message: 'Password is required' };
  }
  if (password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long' };
  }
  if (password.length > 128) {
    return { isValid: false, message: 'Password must not exceed 128 characters' };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one number' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one special character' };
  }
  return { isValid: true };
}

/**
 * Normalizes email address consistently across database and auth APIs.
 */
export function normalizeEmail(email: string): string {
  if (!email || typeof email !== 'string') return '';
  return email.toLowerCase().trim();
}
