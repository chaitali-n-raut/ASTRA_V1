import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { User, UserRole } from '../types.ts';
import { db } from '../db/store.ts';

const SESSION_SECRET = process.env.SESSION_SECRET || 'astra_secure_enterprise_key_2026_super_secret';
export const SESSION_COOKIE_NAME = 'astra_session';

export function getSessionCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  };
}

/**
 * Secure password hashing using bcrypt with 12 salt rounds.
 */
export function hashPassword(password: string): string {
  const salt = bcrypt.genSaltSync(12);
  return bcrypt.hashSync(password, salt);
}

/**
 * Secure password verification supporting bcrypt and backward-compatible PBKDF2.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash) return false;

  // Standard bcrypt hash starts with $2a$ or $2b$
  if (storedHash.startsWith('$2')) {
    return bcrypt.compareSync(password, storedHash);
  }

  // Legacy PBKDF2 hash fallback
  if (storedHash.includes(':')) {
    const [salt, originalHash] = storedHash.split(':');
    if (!salt || !originalHash) return false;
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Cryptographically secure verification token generation.
 * Generates a 64-char random hex token and returns its SHA-256 hash for database storage.
 */
export function generateVerificationToken(expiryHours = 24): {
  rawToken: string;
  tokenHash: string;
  expiresAt: string;
} {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashVerificationToken(rawToken);
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();

  return { rawToken, tokenHash, expiresAt };
}

export function hashVerificationToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export interface TokenPayload {
  userId: string;
  organizationId: string;
  email: string;
  role: UserRole;
  exp: number;
}

export function generateToken(user: User): string {
  const payload: TokenPayload = {
    userId: user.id,
    organizationId: user.organizationId,
    email: user.email,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
  };

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');

  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;

    const expectedSignature = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const payload: TokenPayload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
  sessionToken?: string;
}

function extractToken(req: Request): string | null {
  // Check HTTP-only cookie first
  if (req.cookies && req.cookies[SESSION_COOKIE_NAME]) {
    return req.cookies[SESSION_COOKIE_NAME];
  }

  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  return null;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
  }

  // Check if session has been invalidated
  const sessionRecord = db.getSessionByToken(token);
  if (sessionRecord && sessionRecord.invalidatedAt) {
    return res.status(401).json({ error: 'Session has ended. Please sign in again.' });
  }

  // Verify user still exists, is active, and email is verified
  const user = db.getUserById(payload.userId);
  if (!user) {
    return res.status(401).json({ error: 'User account not found.' });
  }

  if (user.status === 'SUSPENDED') {
    return res.status(403).json({ error: 'Account has been suspended. Please contact administrator.' });
  }

  if (!user.emailVerified) {
    return res.status(403).json({
      error: 'Please verify your email before accessing workspace resources.',
      emailUnverified: true,
      email: user.email,
    });
  }

  req.user = payload;
  req.sessionToken = token;
  next();
}

export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      const sessionRecord = db.getSessionByToken(token);
      if (!sessionRecord || !sessionRecord.invalidatedAt) {
        const user = db.getUserById(payload.userId);
        if (user && user.emailVerified && user.status !== 'SUSPENDED') {
          req.user = payload;
          req.sessionToken = token;
        }
      }
    }
  }
  next();
}
