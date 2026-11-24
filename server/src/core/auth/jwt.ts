import jwt, { SignOptions } from 'jsonwebtoken';
import { hashPassword as argon2Hash, verifyPassword as argon2Verify } from './passwordService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'codrix_jwt_dev_secret_2026';

export interface TokenPayload {
  userId: string;
  tenantId: string;
  email: string;
}

export function signToken(payload: TokenPayload, expiresIn: SignOptions['expiresIn'] = '7d'): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as SignOptions);
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Backward-compatible wrapper delegating to modern Argon2id implementation
 */
export async function hashPassword(plain: string): Promise<string> {
  return argon2Hash(plain);
}

/**
 * Backward-compatible wrapper delegating to modern Argon2id verification
 */
export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  const result = await argon2Verify(plain, hash);
  return result.valid;
}
