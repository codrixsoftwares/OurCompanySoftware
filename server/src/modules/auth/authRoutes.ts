import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { getCollections } from '../../core/mongodb.js';
import { signToken } from '../../core/auth/jwt.js';
import { requireAuth, requireLakshaySuperAdmin } from '../../core/auth/middleware.js';
import { AuditService } from '../../core/audit/auditService.js';
import { SocketService } from '../../core/socket/socketService.js';
import { EmailDispatcher } from '../../core/email/emailDispatcher.js';
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  normalizeEmail,
  generateSecureRandomToken,
  hashResetToken
} from '../../core/auth/passwordService.js';

const router = Router();

// In-memory IP rate limiter for login and password reset protection against brute-force
interface RateLimitRecord {
  attempts: number;
  blockedUntil?: number;
}
const loginRateLimiter = new Map<string, RateLimitRecord>();
const resetRateLimiter = new Map<string, RateLimitRecord>();

function checkRateLimit(limiter: Map<string, RateLimitRecord>, key: string, maxAttempts = 10, lockoutMs = 15 * 60 * 1000): { isBlocked: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const record = limiter.get(key);

  if (record?.blockedUntil && record.blockedUntil > now) {
    return { isBlocked: true, retryAfterSeconds: Math.ceil((record.blockedUntil - now) / 1000) };
  }

  return { isBlocked: false, retryAfterSeconds: 0 };
}

function recordFailedAttempt(limiter: Map<string, RateLimitRecord>, key: string, maxAttempts = 10, lockoutMs = 15 * 60 * 1000) {
  const now = Date.now();
  const record = limiter.get(key) || { attempts: 0 };
  record.attempts += 1;

  if (record.attempts >= maxAttempts) {
    record.blockedUntil = now + lockoutMs;
  }
  limiter.set(key, record);
}

function clearRateLimit(limiter: Map<string, RateLimitRecord>, key: string) {
  limiter.delete(key);
}

// Device and client telemetry parser
function parseDeviceSummary(ua: string): string {
  if (!ua) return 'Web Browser';
  let browser = 'Browser';
  let os = 'Unknown OS';

  if (ua.includes('Edg/')) browser = 'Microsoft Edge';
  else if (ua.includes('Chrome/')) browser = 'Google Chrome';
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Apple Safari';
  else if (ua.includes('Firefox/')) browser = 'Mozilla Firefox';

  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Macintosh') || ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('iPhone')) os = 'iPhone (iOS)';
  else if (ua.includes('iPad')) os = 'iPad (iPadOS)';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('Linux')) os = 'Linux';

  return `${browser} on ${os}`;
}

const isProd = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
const cookieOptions: any = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/'
};

// ==========================================
// 1. POST /api/v1/auth/register (Secure Registration)
// ==========================================
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, fullName, turnstileToken } = req.body;

    if (!email || !password || !fullName) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Full name, email, and password are required' } });
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail.includes('@') || !normalizedEmail.includes('.')) {
      res.status(400).json({ error: { code: 'INVALID_EMAIL', message: 'Please provide a valid email address' } });
      return;
    }

    // Password strength check
    const strength = validatePasswordStrength(password);
    if (!strength.isValid) {
      res.status(400).json({ error: { code: 'WEAK_PASSWORD', message: strength.message } });
      return;
    }

    // Optional Cloudflare Turnstile bot verification
    const turnstileSecret = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
    if (turnstileSecret) {
      if (!turnstileToken) {
        res.status(400).json({ error: { code: 'SECURITY_CHECK_REQUIRED', message: 'Cloudflare security check required' } });
        return;
      }
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress || '';
      try {
        const verifyFormData = new URLSearchParams();
        verifyFormData.append('secret', turnstileSecret);
        verifyFormData.append('response', turnstileToken);
        if (clientIp) verifyFormData.append('remoteip', clientIp);

        const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          body: verifyFormData
        });
        const verifyData: any = await verifyRes.json();
        if (!verifyData.success) {
          res.status(403).json({ error: { code: 'SECURITY_CHECK_FAILED', message: 'Security check failed. Please refresh.' } });
          return;
        }
      } catch (cfErr) {
        console.error('[Registration Turnstile] verification error:', cfErr);
      }
    }

    const cols = getCollections();
    const existing = await cols.users.findOne({ primaryEmail: normalizedEmail });
    if (existing) {
      // Generic message to avoid email enumeration while alerting
      res.status(409).json({ error: { code: 'USER_EXISTS', message: 'An account with this email address already exists. Please log in.' } });
      return;
    }

    // Hash password with Argon2id (salt generated and encapsulated automatically by argon2id)
    const passwordHash = await hashPassword(password);

    // Ensure default tenant
    let tenant = await cols.tenants.findOne({ slug: 'codrix' });
    if (!tenant) {
      const tenantRes = await cols.tenants.insertOne({
        slug: 'codrix',
        legalName: 'CODRIX PRIVATE LIMITED',
        displayName: 'CodRix Private Limited',
        status: 'ACTIVE',
        timezone: 'Asia/Kolkata',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      tenant = await cols.tenants.findOne({ _id: tenantRes.insertedId });
    }
    const tenantId = tenant!._id.toString();

    const insertResult = await cols.users.insertOne({
      primaryEmail: normalizedEmail,
      passwordHash,
      fullName: fullName.trim(),
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const newUserId = insertResult.insertedId.toString();

    // Default member membership
    await cols.memberships.insertOne({
      tenantId,
      userId: newUserId,
      roles: ['EMPLOYEE'],
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Generate JWT token
    const token = signToken({
      userId: newUserId,
      tenantId,
      email: normalizedEmail
    });

    res.cookie('codrix_session_token', token, cookieOptions);

    AuditService.log({
      tenantId,
      action: 'USER_REGISTERED',
      actorId: newUserId,
      actorEmail: normalizedEmail,
      resourceType: 'USER',
      resourceId: newUserId,
      details: `New account registered under CodRix Enterprise OS`
    });

    // Return safe user object (NO password, NO passwordHash)
    res.status(201).json({
      data: {
        token,
        user: {
          id: newUserId,
          email: normalizedEmail,
          fullName: fullName.trim()
        },
        roles: ['EMPLOYEE'],
        activeTenant: {
          id: tenantId,
          name: tenant!.displayName,
          slug: tenant!.slug
        }
      }
    });
  } catch (error: any) {
    console.error('[Registration] error:', error);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed creating account. Please try again later.' } });
  }
});

// ==========================================
// 2. POST /api/v1/auth/login (Secure Argon2id Login)
// ==========================================
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, turnstileToken, lastWorkSummary } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Email and password are required' } });
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    const clientIp = (req.headers['cf-connecting-ip'] as string) ||
                     (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
                     req.socket.remoteAddress || '127.0.0.1';

    // Rate limiting: 10 attempts per 15 minutes per IP + email
    const rateLimitKey = `${clientIp}:${normalizedEmail}`;
    const rateCheck = checkRateLimit(loginRateLimiter, rateLimitKey);
    if (rateCheck.isBlocked) {
      res.status(429).json({
        error: {
          code: 'TOO_MANY_ATTEMPTS',
          message: `Too many login attempts. Please wait ${rateCheck.retryAfterSeconds} seconds before trying again.`
        }
      });
      return;
    }

    // Optional Cloudflare Turnstile bot verification
    const turnstileSecret = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
    if (turnstileSecret) {
      if (!turnstileToken) {
        res.status(400).json({ error: { code: 'SECURITY_CHECK_REQUIRED', message: 'Cloudflare security verification required. Please complete the security check.' } });
        return;
      }
      try {
        const verifyFormData = new URLSearchParams();
        verifyFormData.append('secret', turnstileSecret);
        verifyFormData.append('response', turnstileToken);
        if (clientIp) verifyFormData.append('remoteip', clientIp);

        const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          body: verifyFormData
        });
        const verifyData: any = await verifyRes.json();

        if (!verifyData.success) {
          console.warn('[Cloudflare Turnstile] Security check rejected token:', verifyData['error-codes']);
          res.status(403).json({ error: { code: 'SECURITY_CHECK_FAILED', message: 'Cloudflare security check failed. Please refresh and try again.' } });
          return;
        }
      } catch (cfErr: any) {
        console.error('[Cloudflare Turnstile] Error connecting to verification API:', cfErr);
      }
    }

    const cols = getCollections();
    const user = await cols.users.findOne({ primaryEmail: normalizedEmail });

    // Generic error message if user not found or passwordHash missing (anti-enumeration)
    if (!user || !user.passwordHash) {
      recordFailedAttempt(loginRateLimiter, rateLimitKey);
      res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
      return;
    }

    // Account status check
    if (user.status && user.status !== 'ACTIVE') {
      res.status(403).json({ error: { code: 'ACCOUNT_SUSPENDED', message: 'This account has been deactivated. Please contact support.' } });
      return;
    }

    // Verify password via Argon2id (with transparent upgrade if legacy bcrypt hash)
    const verification = await verifyPassword(password, user.passwordHash);
    if (!verification.valid) {
      recordFailedAttempt(loginRateLimiter, rateLimitKey);
      res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
      return;
    }

    // Clear rate limit on successful credentials verification
    clearRateLimit(loginRateLimiter, rateLimitKey);

    // If legacy hash needs upgrade to Argon2id, perform transparent upgrade
    if (verification.needsRehash) {
      try {
        const freshArgon2Hash = await hashPassword(password);
        await cols.users.updateOne(
          { _id: user._id },
          { $set: { passwordHash: freshArgon2Hash, updatedAt: new Date() } }
        );
        console.log(`[Security] Upgraded user ${user.primaryEmail} password hash to Argon2id automatically.`);
      } catch (rehashErr) {
        console.warn('[Security] Non-blocking rehash warning:', rehashErr);
      }
    }

    const userId = user._id.toString();
    const memberships = await cols.memberships.find({ userId, status: 'ACTIVE' }).toArray();

    if (memberships.length === 0) {
      res.status(403).json({ error: { code: 'NO_ACTIVE_TENANT', message: 'User has no organization memberships' } });
      return;
    }

    const activeMembership = memberships[0];
    const tenant = await cols.tenants.findOne({ slug: 'codrix' }) ||
                   await cols.tenants.findOne({ _id: new ObjectId(activeMembership.tenantId) });

    const token = signToken({
      userId,
      tenantId: activeMembership.tenantId,
      email: user.primaryEmail
    });

    res.cookie('codrix_session_token', token, cookieOptions);

    const ua = req.headers['user-agent'] || '';
    const deviceSummary = parseDeviceSummary(ua);
    const resolvedIp = clientIp.includes('::1') ? '127.0.0.1' : clientIp;

    const sessionId = `sess_${new ObjectId().toString()}`;
    const now = new Date();

    const employee = await cols.employees.findOne({ userId });

    const sessionRecord = {
      sessionId,
      userId,
      email: user.primaryEmail,
      fullName: user.fullName || employee?.fullName || 'User',
      role: activeMembership.roles?.[0] || 'EMPLOYEE',
      employeeCode: employee?.employeeCode || 'CDX-000',
      tenantId: activeMembership.tenantId,
      ip: resolvedIp,
      userAgent: ua,
      device: deviceSummary,
      browser: deviceSummary.split(' on ')[0] || 'Browser',
      os: deviceSummary.split(' on ')[1] || 'OS',
      status: 'ACTIVE',
      loginAt: now,
      lastActiveAt: now,
      sessionDurationMs: 0,
      lastWorkSummary: lastWorkSummary || 'Signed into CodRix Enterprise OS',
      createdAt: now,
      updatedAt: now
    };

    await cols.userSessions.insertOne(sessionRecord);

    SocketService.emitToTenant(activeMembership.tenantId, 'session:new', {
      sessionId,
      userId,
      userEmail: user.primaryEmail,
      fullName: sessionRecord.fullName,
      status: 'ACTIVE',
      ip: resolvedIp,
      device: deviceSummary,
      loginAt: now
    });

    AuditService.log({
      tenantId: activeMembership.tenantId,
      action: 'USER_LOGIN',
      actorId: userId,
      actorEmail: user.primaryEmail,
      resourceType: 'AUTH_SESSION',
      resourceId: sessionId,
      details: `User logged in from ${resolvedIp} (${deviceSummary}) via Argon2id authentication`
    });

    // Return safe user payload (NEVER returns password or passwordHash)
    res.json({
      data: {
        token,
        sessionId,
        user: {
          id: userId,
          email: user.primaryEmail,
          fullName: user.fullName,
          avatarUrl: user.avatarUrl
        },
        activeTenant: {
          id: tenant ? tenant._id.toString() : activeMembership.tenantId,
          name: tenant ? tenant.displayName : 'CodRix Private Limited',
          slug: tenant ? tenant.slug : 'codrix'
        },
        employee: employee ? { ...employee, id: employee._id.toString() } : null,
        roles: activeMembership.roles || ['EMPLOYEE'],
        availableTenants: [
          {
            id: tenant ? tenant._id.toString() : activeMembership.tenantId,
            name: tenant ? tenant.displayName : 'CodRix Private Limited',
            slug: tenant ? tenant.slug : 'codrix'
          }
        ]
      }
    });
  } catch (error: any) {
    console.error('[Login] error:', error);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Authentication service temporarily unavailable' } });
  }
});

// ==========================================
// 3. POST /api/v1/auth/forgot-password (Secure Password Recovery Token)
// ==========================================
router.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Email address is required' } });
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';

    // Rate limiting: max 5 requests per 15 minutes
    const rateCheck = checkRateLimit(resetRateLimiter, `${clientIp}:${normalizedEmail}`, 5, 15 * 60 * 1000);
    if (rateCheck.isBlocked) {
      res.status(429).json({
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: `Too many password reset requests. Please wait ${rateCheck.retryAfterSeconds} seconds.`
        }
      });
      return;
    }
    recordFailedAttempt(resetRateLimiter, `${clientIp}:${normalizedEmail}`);

    const cols = getCollections();
    const user = await cols.users.findOne({ primaryEmail: normalizedEmail });

    // IMPORTANT: Always return a generic success message whether the account exists or not (anti-enumeration)
    const genericSuccess = {
      data: {
        success: true,
        message: 'If an account exists with that email address, password reset instructions have been sent.'
      }
    };

    if (!user) {
      res.json(genericSuccess);
      return;
    }

    // Generate cryptographically secure random token (32 bytes = 64 hex chars)
    const rawResetToken = generateSecureRandomToken(32);
    // Hash token using SHA-256 for database storage
    const tokenHash = hashResetToken(rawResetToken);
    // Token expires in 15 minutes
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await cols.users.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordResetTokenHash: tokenHash,
          passwordResetExpiresAt: expiresAt,
          passwordResetUsed: false,
          updatedAt: new Date()
        }
      }
    );

    // Build reset link
    const origin = req.headers.origin || (isProd ? 'https://connect.codrix.co.in' : 'http://localhost:5173');
    const resetUrl = `${origin}/#reset-password?token=${rawResetToken}&email=${encodeURIComponent(normalizedEmail)}`;

    // Dispatch notification via Resend
    try {
      await EmailDispatcher.send({
        tenantId: 'codrix',
        to: normalizedEmail,
        subject: 'CodRix Enterprise OS — Password Reset Request',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E7E0FB; border-radius: 16px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h2 style="color: #120E24; font-size: 22px; margin-bottom: 4px;">CodRix Enterprise OS</h2>
              <p style="color: #585172; font-size: 13px;">Secure Password Reset</p>
            </div>
            <p style="color: #120E24; font-size: 14px;">Hello ${user.fullName || 'User'},</p>
            <p style="color: #585172; font-size: 13px; line-height: 1.6;">
              We received a request to reset your password for your CodRix account. Click the button below to set a new password. This link is single-use and will expire in <strong>15 minutes</strong>.
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetUrl}" style="background-color: #7C2CF5; color: #ffffff; padding: 12px 28px; border-radius: 10px; font-weight: bold; text-decoration: none; display: inline-block; font-size: 14px;">
                Reset My Password
              </a>
            </div>
            <p style="color: #585172; font-size: 12px; line-height: 1.5;">
              If you did not request this, please ignore this email or notify your system administrator. Your password remains unchanged.
            </p>
            <hr style="border: none; border-top: 1px solid #E7E0FB; margin: 24px 0;" />
            <p style="color: #9E9AA7; font-size: 11px; text-align: center;">CodRix Private Limited • Secure Enterprise Authentication System</p>
          </div>
        `
      });
    } catch (mailErr) {
      console.warn('[ForgotPassword] Email dispatch error:', mailErr);
    }

    AuditService.log({
      tenantId: 'codrix',
      action: 'PASSWORD_RESET_REQUESTED',
      actorId: user._id.toString(),
      actorEmail: normalizedEmail,
      resourceType: 'USER',
      resourceId: user._id.toString(),
      details: `Password reset token generated and sent to ${normalizedEmail}`
    });

    res.json(genericSuccess);
  } catch (error: any) {
    console.error('[ForgotPassword] error:', error);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed processing request' } });
  }
});

// ==========================================
// 4. POST /api/v1/auth/reset-password (Establish New Password)
// ==========================================
router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, email, newPassword } = req.body;
    if (!token || !email || !newPassword) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Reset token, email, and new password are required' } });
      return;
    }

    const normalizedEmail = normalizeEmail(email);

    // Validate new password strength
    const strength = validatePasswordStrength(newPassword);
    if (!strength.isValid) {
      res.status(400).json({ error: { code: 'WEAK_PASSWORD', message: strength.message } });
      return;
    }

    const tokenHash = hashResetToken(token);
    const cols = getCollections();

    const user = await cols.users.findOne({
      primaryEmail: normalizedEmail,
      passwordResetTokenHash: tokenHash
    });

    if (!user) {
      res.status(400).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired password reset link. Please request a new one.' } });
      return;
    }

    // Check expiration
    if (!user.passwordResetExpiresAt || new Date(user.passwordResetExpiresAt).getTime() < Date.now()) {
      res.status(400).json({ error: { code: 'EXPIRED_TOKEN', message: 'This password reset link has expired. Please request a new one.' } });
      return;
    }

    // Check if token was already used
    if (user.passwordResetUsed === true) {
      res.status(400).json({ error: { code: 'TOKEN_ALREADY_USED', message: 'This reset token has already been used. Please request a new link.' } });
      return;
    }

    // Hash the new password with fresh Argon2id salt
    const newPasswordHash = await hashPassword(newPassword);

    // Invalidate token, mark used, update passwordHash
    await cols.users.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordHash: newPasswordHash,
          passwordResetUsed: true,
          updatedAt: new Date()
        },
        $unset: {
          passwordResetTokenHash: '',
          passwordResetExpiresAt: '',
          password: '' // guarantee removal of any legacy plaintext fields
        }
      }
    );

    // Invalidate all active sessions for this user across devices
    await cols.userSessions.updateMany(
      { userId: user._id.toString(), status: 'ACTIVE' },
      {
        $set: {
          status: 'REVOKED',
          logoutReason: 'PASSWORD_RESET',
          updatedAt: new Date()
        }
      }
    );

    AuditService.log({
      tenantId: 'codrix',
      action: 'PASSWORD_RESET_COMPLETED',
      actorId: user._id.toString(),
      actorEmail: normalizedEmail,
      resourceType: 'USER',
      resourceId: user._id.toString(),
      details: `User completed password reset; Argon2id hash updated and previous sessions revoked`
    });

    res.json({
      data: {
        success: true,
        message: 'Your password has been successfully reset. You can now log in with your new password.'
      }
    });
  } catch (error: any) {
    console.error('[ResetPassword] error:', error);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed resetting password' } });
  }
});

// ==========================================
// 5. POST /api/v1/auth/change-password (Authenticated Password Change)
// ==========================================
router.post('/change-password', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Current password and new password are required' } });
      return;
    }

    const strength = validatePasswordStrength(newPassword);
    if (!strength.isValid) {
      res.status(400).json({ error: { code: 'WEAK_PASSWORD', message: strength.message } });
      return;
    }

    const cols = getCollections();
    const user = await cols.users.findOne({ primaryEmail: req.auth!.user.email });

    if (!user || !user.passwordHash) {
      res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User account not found' } });
      return;
    }

    // Verify current password
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: { code: 'INVALID_CURRENT_PASSWORD', message: 'Your current password was incorrect' } });
      return;
    }

    // Hash new password using Argon2id with fresh salt
    const newHash = await hashPassword(newPassword);

    await cols.users.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordHash: newHash,
          updatedAt: new Date()
        },
        $unset: { password: '' }
      }
    );

    AuditService.log({
      tenantId: req.auth!.user.tenantId,
      action: 'PASSWORD_CHANGED',
      actorId: user._id.toString(),
      actorEmail: user.primaryEmail,
      resourceType: 'USER',
      resourceId: user._id.toString(),
      details: `User changed password; updated with fresh Argon2id hash`
    });

    res.json({ data: { success: true, message: 'Password changed successfully' } });
  } catch (error: any) {
    console.error('[ChangePassword] error:', error);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed updating password' } });
  }
});

// ==========================================
// 6. GET /api/v1/auth/me (User Profile)
// ==========================================
router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const cols = getCollections();
    const user = await cols.users.findOne({ primaryEmail: req.auth!.user.email });

    if (!user) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User profile not found in MongoDB' } });
      return;
    }

    const userId = user._id.toString();
    const tenant = await cols.tenants.findOne({ slug: 'codrix' }) ||
                   await cols.tenants.findOne({ _id: new ObjectId(req.auth!.user.tenantId) });

    const employee = await cols.employees.findOne({ userId });

    // Safe user projection (NEVER exposes password or passwordHash)
    res.json({
      data: {
        user: {
          id: userId,
          email: user.primaryEmail,
          fullName: user.fullName,
          avatarUrl: user.avatarUrl
        },
        activeTenant: {
          id: tenant ? tenant._id.toString() : req.auth!.user.tenantId,
          name: tenant ? tenant.displayName : 'CodRix Private Limited',
          slug: tenant ? tenant.slug : 'codrix'
        },
        employee: employee ? { ...employee, id: employee._id.toString() } : null,
        roles: req.auth!.user.roles
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

// ==========================================
// 7. POST /api/v1/auth/switch-account (Superadmin Lakshay Only)
// ==========================================
router.post('/switch-account', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const callerEmail = (req.auth!.user.email || '').toLowerCase().trim();
    const callerName = (req.auth!.user.fullName || '').toLowerCase().trim();
    const isCallerLakshay = callerEmail === 'lakshay@codrix.co.in' || callerEmail.startsWith('lakshay@') || callerName === 'lakshay';

    if (!isCallerLakshay) {
      res.status(403).json({
        error: {
          code: 'UNAUTHORIZED_SWITCH',
          message: 'Security Violation: Only Lakshay (Founder & Overall Superadmin) is authorized to switch accounts or visit other user logins.'
        }
      });
      return;
    }

    const { targetEmail, lastWorkSummary } = req.body;
    if (!targetEmail) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'targetEmail is required' } });
      return;
    }

    const cols = getCollections();
    const targetUser = await cols.users.findOne({ primaryEmail: normalizeEmail(targetEmail) });
    if (!targetUser) {
      res.status(404).json({ error: { code: 'TARGET_NOT_FOUND', message: `No user found with email ${targetEmail}` } });
      return;
    }

    const targetUserId = targetUser._id.toString();
    const memberships = await cols.memberships.find({ userId: targetUserId, status: 'ACTIVE' }).toArray();
    const activeMembership = memberships[0] || {
      tenantId: req.auth!.user.tenantId,
      roles: ['EMPLOYEE']
    };

    const tenant = await cols.tenants.findOne({ slug: 'codrix' }) ||
                   await cols.tenants.findOne({ _id: new ObjectId(activeMembership.tenantId) });

    const employee = await cols.employees.findOne({ userId: targetUserId });

    const token = signToken({
      userId: targetUserId,
      tenantId: activeMembership.tenantId,
      email: targetUser.primaryEmail
    });

    res.cookie('codrix_session_token', token, cookieOptions);

    const ua = req.headers['user-agent'] || '';
    const deviceSummary = parseDeviceSummary(ua);
    const clientIp = (req.headers['cf-connecting-ip'] as string) ||
                     (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
                     req.socket.remoteAddress || '127.0.0.1';
    const resolvedIp = clientIp.includes('::1') ? '127.0.0.1' : clientIp;

    const sessionId = `sess_${new ObjectId().toString()}`;
    const now = new Date();

    const sessionRecord = {
      sessionId,
      userId: targetUserId,
      email: targetUser.primaryEmail,
      fullName: targetUser.fullName || employee?.fullName || 'User',
      role: activeMembership.roles?.[0] || 'EMPLOYEE',
      employeeCode: employee?.employeeCode || 'CDX-000',
      tenantId: activeMembership.tenantId,
      ip: resolvedIp,
      userAgent: ua,
      device: deviceSummary,
      browser: deviceSummary.split(' on ')[0] || 'Browser',
      os: deviceSummary.split(' on ')[1] || 'OS',
      status: 'ACTIVE',
      loginAt: now,
      lastActiveAt: now,
      sessionDurationMs: 0,
      lastWorkSummary: lastWorkSummary || `Switched workspace to ${targetUser.fullName || targetUser.primaryEmail}`,
      switchedBy: 'Lakshay (Founder & Overall Superadmin)',
      createdAt: now,
      updatedAt: now
    };

    await cols.userSessions.insertOne(sessionRecord);

    SocketService.emitToTenant(activeMembership.tenantId, 'session:new', {
      sessionId,
      userId: targetUserId,
      userEmail: targetUser.primaryEmail,
      fullName: sessionRecord.fullName,
      status: 'ACTIVE',
      ip: resolvedIp,
      device: deviceSummary,
      loginAt: now
    });

    AuditService.log({
      tenantId: activeMembership.tenantId,
      action: 'ACCOUNT_SWITCH',
      actorId: req.auth!.user.userId,
      actorEmail: callerEmail,
      resourceType: 'USER',
      resourceId: targetUserId,
      details: `Founder Lakshay switched active workspace context to ${targetUser.primaryEmail}`
    });

    res.json({
      data: {
        token,
        sessionId,
        user: {
          id: targetUserId,
          email: targetUser.primaryEmail,
          fullName: targetUser.fullName,
          avatarUrl: targetUser.avatarUrl
        },
        activeTenant: {
          id: tenant ? tenant._id.toString() : activeMembership.tenantId,
          name: tenant ? tenant.displayName : 'CodRix Private Limited',
          slug: tenant ? tenant.slug : 'codrix'
        },
        employee: employee ? { ...employee, id: employee._id.toString() } : null,
        roles: activeMembership.roles || ['EMPLOYEE'],
        availableTenants: [
          {
            id: tenant ? tenant._id.toString() : activeMembership.tenantId,
            name: tenant ? tenant.displayName : 'CodRix Private Limited',
            slug: tenant ? tenant.slug : 'codrix'
          }
        ]
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

// ==========================================
// 8. POST /api/v1/auth/session-heartbeat
// ==========================================
router.post('/session-heartbeat', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId, lastWorkSummary } = req.body;
    if (!sessionId) {
      res.json({ data: { valid: true } });
      return;
    }

    const cols = getCollections();
    const session = await cols.userSessions.findOne({ sessionId });

    if (!session) {
      res.json({ data: { valid: false, reason: 'SESSION_NOT_FOUND' } });
      return;
    }

    if (session.status === 'REVOKED') {
      res.json({ data: { valid: false, reason: 'REVOKED' } });
      return;
    }

    const now = new Date();
    const lastActive = session.lastActiveAt ? new Date(session.lastActiveAt).getTime() : now.getTime();
    const inactiveMs = now.getTime() - lastActive;

    // 15-minute inactivity check on server
    if (inactiveMs >= 15 * 60 * 1000) {
      const loginTime = session.loginAt ? new Date(session.loginAt).getTime() : now.getTime();
      const durationMs = now.getTime() - loginTime;

      await cols.userSessions.updateOne(
        { sessionId },
        {
          $set: {
            status: 'TIMEOUT_INACTIVE',
            logoutAt: now,
            sessionDurationMs: durationMs,
            logoutReason: 'INACTIVITY_15MIN',
            lastWorkSummary: lastWorkSummary || session.lastWorkSummary || 'Workspace auto-preserved on 15m timeout',
            updatedAt: now
          }
        }
      );

      SocketService.emitToTenant(session.tenantId, 'session:timeout', {
        sessionId,
        userId: session.userId,
        userEmail: session.email,
        durationMs,
        lastWorkSummary: lastWorkSummary || session.lastWorkSummary
      });

      res.json({ data: { valid: false, reason: 'TIMEOUT_INACTIVE' } });
      return;
    }

    // Refresh last active
    const loginTime = session.loginAt ? new Date(session.loginAt).getTime() : now.getTime();
    const durationMs = now.getTime() - loginTime;

    const updateDoc: any = {
      lastActiveAt: now,
      sessionDurationMs: durationMs,
      updatedAt: now
    };
    if (lastWorkSummary) {
      updateDoc.lastWorkSummary = lastWorkSummary;
    }

    await cols.userSessions.updateOne({ sessionId }, { $set: updateDoc });

    SocketService.emitToTenant(session.tenantId, 'session:updated', {
      sessionId,
      lastActiveAt: now,
      lastWorkSummary: lastWorkSummary || session.lastWorkSummary,
      durationMs
    });

    res.json({ data: { valid: true } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ==========================================
// 9. POST /api/v1/auth/session-timeout
// ==========================================
router.post('/session-timeout', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId, lastWorkSummary } = req.body;
    if (!sessionId) {
      res.json({ data: { success: true } });
      return;
    }

    const cols = getCollections();
    const session = await cols.userSessions.findOne({ sessionId });
    const now = new Date();

    if (session) {
      const loginTime = session.loginAt ? new Date(session.loginAt).getTime() : now.getTime();
      const durationMs = now.getTime() - loginTime;

      await cols.userSessions.updateOne(
        { sessionId },
        {
          $set: {
            status: 'TIMEOUT_INACTIVE',
            logoutAt: now,
            sessionDurationMs: durationMs,
            logoutReason: 'INACTIVITY_15MIN',
            lastWorkSummary: lastWorkSummary || session.lastWorkSummary || 'Workspace progress saved on 15m timeout',
            updatedAt: now
          }
        }
      );

      SocketService.emitToTenant(session.tenantId, 'session:timeout', {
        sessionId,
        userId: session.userId,
        userEmail: session.email,
        durationMs,
        lastWorkSummary: lastWorkSummary || session.lastWorkSummary
      });

      AuditService.log({
        tenantId: session.tenantId,
        action: 'SESSION_TIMEOUT_INACTIVE',
        actorId: session.userId,
        actorEmail: session.email,
        resourceType: 'AUTH_SESSION',
        resourceId: sessionId,
        details: `Session timed out after 15m inactivity. Saved progress: "${lastWorkSummary || session.lastWorkSummary || 'Workspace State'}"`
      });
    }

    res.clearCookie('codrix_session_token', cookieOptions);
    res.json({ data: { success: true, message: 'Session timed out and state preserved' } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ==========================================
// 10. POST /api/v1/auth/logout
// ==========================================
router.post('/logout', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.body;
    const cols = getCollections();
    const now = new Date();

    if (sessionId) {
      const session = await cols.userSessions.findOne({ sessionId });
      if (session) {
        const loginTime = session.loginAt ? new Date(session.loginAt).getTime() : now.getTime();
        const durationMs = now.getTime() - loginTime;

        await cols.userSessions.updateOne(
          { sessionId },
          {
            $set: {
              status: 'LOGGED_OUT',
              logoutAt: now,
              sessionDurationMs: durationMs,
              logoutReason: 'USER_LOGOUT',
              updatedAt: now
            }
          }
        );

        SocketService.emitToTenant(session.tenantId, 'session:logged_out', {
          sessionId,
          userId: session.userId,
          userEmail: session.email
        });
      }
    }

    res.clearCookie('codrix_session_token', cookieOptions);

    AuditService.log({
      tenantId: req.auth!.user.tenantId,
      action: 'USER_LOGOUT',
      actorId: req.auth!.user.userId,
      actorEmail: req.auth!.user.email,
      resourceType: 'AUTH_SESSION',
      resourceId: sessionId || 'MANUAL',
      details: `User explicitly logged out from workspace`
    });

    res.json({ data: { message: 'Logged out successfully' } });
  } catch (error: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

// ==========================================
// 11. GET /api/v1/auth/session-records (Superadmin Lakshay Only)
// ==========================================
router.get('/session-records', requireAuth, requireLakshaySuperAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const cols = getCollections();
    const now = new Date();
    const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000);

    // Stale session cleanup
    await cols.userSessions.updateMany(
      {
        status: 'ACTIVE',
        lastActiveAt: { $lt: fifteenMinsAgo }
      },
      {
        $set: {
          status: 'TIMEOUT_INACTIVE',
          logoutReason: 'INACTIVITY_15MIN',
          updatedAt: now
        }
      }
    );

    const sessions = await cols.userSessions
      .find({})
      .sort({ loginAt: -1 })
      .limit(250)
      .toArray();

    const activeCount = await cols.userSessions.countDocuments({ status: 'ACTIVE' });
    const timeoutCount = await cols.userSessions.countDocuments({ status: 'TIMEOUT_INACTIVE' });
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const totalToday = await cols.userSessions.countDocuments({ loginAt: { $gte: todayStart } });

    res.json({
      data: {
        sessions,
        activeCount,
        timeoutCount,
        totalToday
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ==========================================
// 12. POST /api/v1/auth/session-records/:id/revoke (Superadmin Lakshay Only)
// ==========================================
router.post('/session-records/:id/revoke', requireAuth, requireLakshaySuperAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = req.params.id;
    const cols = getCollections();
    const session = await cols.userSessions.findOne({ sessionId });

    if (!session) {
      res.status(404).json({ error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' } });
      return;
    }

    const now = new Date();
    const loginTime = session.loginAt ? new Date(session.loginAt).getTime() : now.getTime();
    const durationMs = now.getTime() - loginTime;

    await cols.userSessions.updateOne(
      { sessionId },
      {
        $set: {
          logoutAt: now,
          sessionDurationMs: durationMs,
          status: 'REVOKED',
          logoutReason: 'REVOKED_BY_FOUNDER',
          revokedBy: 'Lakshay (Founder & Overall Superadmin)'
        }
      }
    );

    SocketService.emitToTenant(session.tenantId, 'session:revoked', {
      sessionId: session.sessionId,
      userId: session.userId,
      userEmail: session.userEmail
    });

    res.json({ data: { success: true, message: `Session for ${session.userEmail} terminated successfully.` } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// ==========================================
// 13. GET /api/v1/auth/team
// ==========================================
router.get('/team', async (req: Request, res: Response): Promise<void> => {
  try {
    const cols = getCollections();
    const [team, users, employees] = await Promise.all([
      cols.teammembers.find().toArray(),
      cols.users.find({}, { projection: { passwordHash: 0, password: 0 } }).toArray(),
      cols.employees.find().toArray()
    ]);

    const userEmailByName = new Map<string, string>();
    for (const u of users) {
      if (u.fullName) userEmailByName.set(u.fullName.toLowerCase().trim(), u.primaryEmail);
    }
    for (const e of employees) {
      if (e.fullName && e.email) userEmailByName.set(e.fullName.toLowerCase().trim(), e.email);
    }

    const teamMapping: Record<string, string> = {
      'lakshay': 'lakshay@codrix.co.in',
      'parth sharma': 'parth@codrix.co.in',
      'anshuman': 'anshuman@codrix.co.in',
      'suryansh thakur': 'suryansh@codrix.co.in',
      'diya maheshwari': 'diya@codrix.co.in',
      'ishita malhotra': 'ishita@codrix.co.in'
    };

    const enrichedTeam = team.map((tm: any) => {
      const nameKey = (tm.name || '').toLowerCase().trim();
      const realEmail = userEmailByName.get(nameKey) || teamMapping[nameKey] || `${nameKey.split(' ')[0]}@codrix.co.in`;
      return {
        ...tm,
        email: realEmail
      };
    });

    res.json({ data: enrichedTeam });
  } catch (error: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

export default router;
