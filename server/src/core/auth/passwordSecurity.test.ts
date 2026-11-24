import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  normalizeEmail,
  generateSecureRandomToken,
  hashResetToken,
  ARGON2_OPTIONS
} from './passwordService.js';
import bcrypt from 'bcryptjs';

describe('Argon2id Password Security Implementation', () => {
  it('hashes passwords using Argon2id with unique cryptographically random salts', async () => {
    const password = 'SuperSecretPassword123!';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    // 1. Both must start with the standard Argon2id header
    expect(hash1.startsWith('$argon2id$')).toBe(true);
    expect(hash2.startsWith('$argon2id$')).toBe(true);

    // 2. Due to unique salts, identical plaintext passwords must produce different hashes
    expect(hash1).not.toBe(hash2);
  });

  it('verifies correct passwords and rejects incorrect passwords', async () => {
    const password = 'CorrectPassword123!';
    const hash = await hashPassword(password);

    const match = await verifyPassword(password, hash);
    expect(match.valid).toBe(true);

    const wrongMatch = await verifyPassword('WrongPassword123!', hash);
    expect(wrongMatch.valid).toBe(false);
  });

  it('transparently verifies legacy bcrypt hashes and flags for upgrade', async () => {
    const password = 'LegacyBcryptPassword123!';
    const bcryptHash = await bcrypt.hash(password, 10);

    expect(bcryptHash.startsWith('$2a$') || bcryptHash.startsWith('$2b$')).toBe(true);

    const result = await verifyPassword(password, bcryptHash);
    expect(result.valid).toBe(true);
    // Must flag needsRehash so user is transparently upgraded to Argon2id upon login
    expect(result.needsRehash).toBe(true);
  });

  it('enforces OWASP password complexity rules', () => {
    // Too short
    expect(validatePasswordStrength('Short1!').isValid).toBe(false);
    // Missing uppercase
    expect(validatePasswordStrength('lowercase123!').isValid).toBe(false);
    // Missing lowercase
    expect(validatePasswordStrength('UPPERCASE123!').isValid).toBe(false);
    // Missing digit
    expect(validatePasswordStrength('NoDigitsHere!').isValid).toBe(false);
    // Missing symbol
    expect(validatePasswordStrength('NoSymbols1234').isValid).toBe(false);
    // Valid strong password
    expect(validatePasswordStrength('ValidStrong123!').isValid).toBe(true);
  });

  it('generates secure random tokens and correctly hashes them for reset storage', () => {
    const token1 = generateSecureRandomToken(32);
    const token2 = generateSecureRandomToken(32);

    expect(token1).toHaveLength(64);
    expect(token2).toHaveLength(64);
    expect(token1).not.toBe(token2);

    const hash1 = hashResetToken(token1);
    const hash2 = hashResetToken(token1);

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(token1);
  });

  it('normalizes email addresses consistently', () => {
    expect(normalizeEmail('  User.Name@CodRix.Co.In  ')).toBe('user.name@codrix.co.in');
    expect(normalizeEmail('LAKSHAY@CODRIX.CO.IN')).toBe('lakshay@codrix.co.in');
  });
});
