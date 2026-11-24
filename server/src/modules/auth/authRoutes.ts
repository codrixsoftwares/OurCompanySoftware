import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { getCollections } from '../../core/mongodb.js';
import { comparePassword, signToken } from '../../core/auth/jwt.js';
import { requireAuth, requireLakshaySuperAdmin } from '../../core/auth/middleware.js';
import { AuditService } from '../../core/audit/auditService.js';
import { SocketService } from '../../core/socket/socketService.js';
import { RoleCode } from '../../core/auth/types.js';

const router = Router();

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

// POST /api/v1/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, turnstileToken } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Email and password are required' } });
      return;
    }

    // Optional Cloudflare Turnstile bot verification (if secret key is configured)
    const turnstileSecret = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
    if (turnstileSecret) {
      if (!turnstileToken) {
        res.status(400).json({ error: { code: 'SECURITY_CHECK_REQUIRED', message: 'Cloudflare security verification required. Please complete the security check.' } });
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
          console.warn('[Cloudflare Turnstile] Security check rejected token:', verifyData['error-codes']);
          res.status(403).json({ error: { code: 'SECURITY_CHECK_FAILED', message: 'Cloudflare security check failed. Please refresh and try again.' } });
          return;
        }
      } catch (cfErr: any) {
        console.error('[Cloudflare Turnstile] Error connecting to verification API:', cfErr);
      }
    }

    const cols = getCollections();
    const user = await cols.users.findOne({ primaryEmail: email.toLowerCase().trim() });

    if (!user || !user.passwordHash) {
      res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
      return;
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
      return;
    }

    const userId = user._id.toString();
    const memberships = await cols.memberships.find({ userId, status: 'ACTIVE' }).toArray();

    if (memberships.length === 0) {
      res.status(403).json({ error: { code: 'NO_ACTIVE_TENANT', message: 'User has no organization memberships' } });
      return;
    }

    const activeMembership = memberships[0];
    const tenant = await cols.tenants.findOne({ _id: new ObjectId(activeMembership.tenantId) }) ||
                   await cols.tenants.findOne({ slug: 'codrix' });

    const employee = await cols.employees.findOne({ userId });

    const token = signToken({
      userId,
      tenantId: activeMembership.tenantId,
      email: user.primaryEmail
    });

    // Record login session with IP, device, and timestamps for EMS Superadmin telemetry
    const ip = (req.headers['cf-connecting-ip'] as string) ||
               (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
               req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown Device';
    const deviceSummary = parseDeviceSummary(userAgent);
    const sessionId = new ObjectId().toString();

    await cols.userSessions.insertOne({
      sessionId,
      userId,
      tenantId: activeMembership.tenantId,
      userEmail: user.primaryEmail,
      fullName: user.fullName || 'Team Member',
      role: activeMembership.roles[0] || 'EMPLOYEE',
      employeeCode: employee?.employeeCode || 'N/A',
      ipAddress: ip,
      userAgent,
      deviceSummary,
      loginAt: new Date(),
      logoutAt: null,
      lastActiveAt: new Date(),
      status: 'ACTIVE',
      lastWorkSummary: 'Signed into CodRix Enterprise OS',
      logoutReason: null
    });

    SocketService.emitToTenant(activeMembership.tenantId, 'session:new', {
      sessionId,
      userId,
      userEmail: user.primaryEmail,
      fullName: user.fullName,
      role: activeMembership.roles[0] || 'EMPLOYEE',
      deviceSummary,
      ipAddress: ip,
      loginAt: new Date()
    });

    // Set secure HTTP-only session cookie
    res.cookie('codrix_session_token', token, cookieOptions);

    await AuditService.log({
      tenantId: activeMembership.tenantId,
      user: {
        userId,
        email: user.primaryEmail,
        fullName: user.fullName,
        tenantId: activeMembership.tenantId,
        membershipId: activeMembership._id.toString(),
        roles: activeMembership.roles as RoleCode[]
      },
      action: 'AUTH_LOGIN',
      resourceType: 'SESSION',
      resourceId: userId
    });

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
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

// GET /api/v1/auth/me
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

// POST /api/v1/auth/switch-account (Exclusively for Lakshay to visit other team logins)
router.post('/switch-account', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const callerEmail = (req.auth!.user.email || '').toLowerCase().trim();
    const callerName = (req.auth!.user.fullName || '').toLowerCase().trim();
    const isCallerLakshay = callerEmail === 'lakshay@codrix.co.in' || callerEmail.startsWith('lakshay@') || callerName === 'lakshay';

    if (!isCallerLakshay) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Security Violation: Only Lakshay the founder and overall superadmin is authorized to visit or switch to other user logins.'
        }
      });
      return;
    }

    const { targetEmail } = req.body;
    if (!targetEmail) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Target email is required' } });
      return;
    }

    const cols = getCollections();
    const cleanEmail = targetEmail.toLowerCase().trim();
    const firstName = cleanEmail.split('@')[0].split('.')[0];

    let targetUser = await cols.users.findOne({
      $or: [
        { primaryEmail: cleanEmail },
        { primaryEmail: `${firstName}@codrix.co.in` },
        { fullName: new RegExp(`^${firstName}`, 'i') }
      ]
    });

    if (!targetUser) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: `Target user ${targetEmail} not found` } });
      return;
    }

    const userId = targetUser._id.toString();
    const memberships = await cols.memberships.find({ userId, status: 'ACTIVE' }).toArray();
    const activeMembership = memberships[0] || { tenantId: req.auth!.user.tenantId, roles: ['EMPLOYEE'] };
    const employee = await cols.employees.findOne({ userId });
    const tenant = (await cols.tenants.findOne({ slug: 'codrix' })) || (await cols.tenants.findOne({ _id: new ObjectId(activeMembership.tenantId) }));

    const token = signToken({
      userId,
      tenantId: activeMembership.tenantId,
      email: targetUser.primaryEmail
    });

    // Record Founder account visit session
    const ip = (req.headers['cf-connecting-ip'] as string) ||
               (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
               req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown Device';
    const deviceSummary = parseDeviceSummary(userAgent);
    const sessionId = new ObjectId().toString();

    await cols.userSessions.insertOne({
      sessionId,
      userId,
      tenantId: activeMembership.tenantId,
      userEmail: targetUser.primaryEmail,
      fullName: targetUser.fullName || 'Team Member',
      role: activeMembership.roles[0] || 'EMPLOYEE',
      employeeCode: employee?.employeeCode || 'N/A',
      ipAddress: ip,
      userAgent,
      deviceSummary: `${deviceSummary} (Founder Visited)`,
      loginAt: new Date(),
      logoutAt: null,
      lastActiveAt: new Date(),
      status: 'ACTIVE',
      lastWorkSummary: 'Founder Lakshay Account Visit',
      logoutReason: null
    });

    SocketService.emitToTenant(activeMembership.tenantId, 'session:new', {
      sessionId,
      userId,
      userEmail: targetUser.primaryEmail,
      fullName: targetUser.fullName,
      role: activeMembership.roles[0] || 'EMPLOYEE',
      deviceSummary: `${deviceSummary} (Founder Visited)`,
      ipAddress: ip,
      loginAt: new Date()
    });

    res.cookie('codrix_session_token', token, cookieOptions);

    await AuditService.log({
      tenantId: activeMembership.tenantId,
      user: req.auth!.user,
      action: 'FOUNDER_ACCOUNT_VISIT',
      resourceType: 'SESSION',
      resourceId: userId,
      details: { targetEmail, targetName: targetUser.fullName }
    });

    res.json({
      data: {
        token,
        sessionId,
        user: {
          id: userId,
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
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/auth/session-heartbeat - Extends active session, verifies 15-min timeout, and updates live work status
router.post('/session-heartbeat', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const cols = getCollections();
    const userId = req.auth!.user.userId;
    const tenantId = req.auth!.user.tenantId;
    const { sessionId, lastWorkSummary } = req.body;
    const now = new Date();

    const query: any = { userId, status: 'ACTIVE' };
    if (sessionId) {
      query.sessionId = sessionId;
    }

    const session = await cols.userSessions.findOne(query);

    if (session) {
      // Check if session has exceeded 15 minutes of inactivity
      const lastActive = session.lastActiveAt ? new Date(session.lastActiveAt).getTime() : new Date(session.loginAt).getTime();
      const inactiveMs = now.getTime() - lastActive;

      if (inactiveMs > 15 * 60 * 1000) {
        const loginTime = session.loginAt ? new Date(session.loginAt).getTime() : now.getTime();
        await cols.userSessions.updateOne(
          { _id: session._id },
          {
            $set: {
              status: 'TIMEOUT_INACTIVE',
              logoutAt: now,
              logoutReason: 'INACTIVITY_15MIN',
              sessionDurationMs: now.getTime() - loginTime,
              lastWorkSummary: lastWorkSummary || session.lastWorkSummary || 'Session timed out after 15 minutes of inactivity'
            }
          }
        );

        SocketService.emitToTenant(tenantId, 'session:timeout', {
          sessionId: session.sessionId,
          userId,
          userEmail: session.userEmail
        });

        res.json({
          data: {
            active: false,
            timedOut: true,
            message: 'Session expired due to 15 minutes of inactivity'
          }
        });
        return;
      }

      // Update active heartbeat and last work summary
      await cols.userSessions.updateOne(
        { _id: session._id },
        {
          $set: {
            lastActiveAt: now,
            ...(lastWorkSummary ? { lastWorkSummary } : {})
          }
        }
      );

      SocketService.emitToTenant(tenantId, 'session:updated', {
        sessionId: session.sessionId,
        userId,
        lastActiveAt: now,
        lastWorkSummary: lastWorkSummary || session.lastWorkSummary
      });
    }

    res.json({ data: { active: true, lastActiveAt: now } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/auth/session-timeout - Explicitly saves work state and logs out user after 15 minutes inactivity
router.post('/session-timeout', async (req: Request, res: Response): Promise<void> => {
  try {
    const cols = getCollections();
    const { sessionId, lastWorkSummary } = req.body;
    const now = new Date();

    let session = null;
    if (sessionId) {
      session = await cols.userSessions.findOne({ sessionId });
    }

    if (!session && req.auth?.user) {
      session = await cols.userSessions.findOne({ userId: req.auth.user.userId, status: 'ACTIVE' });
    }

    if (session) {
      const loginTime = session.loginAt ? new Date(session.loginAt).getTime() : now.getTime();
      const durationMs = now.getTime() - loginTime;

      await cols.userSessions.updateOne(
        { _id: session._id },
        {
          $set: {
            logoutAt: now,
            sessionDurationMs: durationMs,
            status: 'TIMEOUT_INACTIVE',
            logoutReason: 'INACTIVITY_15MIN',
            lastWorkSummary: lastWorkSummary || session.lastWorkSummary || 'Session timed out after 15 minutes of inactivity'
          }
        }
      );

      SocketService.emitToTenant(session.tenantId, 'session:timeout', {
        sessionId: session.sessionId,
        userId: session.userId,
        userEmail: session.userEmail,
        lastWorkSummary: lastWorkSummary || session.lastWorkSummary
      });

      if (req.auth?.user) {
        await AuditService.log({
          tenantId: session.tenantId,
          user: req.auth.user,
          action: 'AUTH_SESSION_TIMEOUT',
          resourceType: 'SESSION',
          resourceId: session.userId,
          details: {
            reason: 'INACTIVITY_15MIN',
            durationMs,
            lastWorkSummary: lastWorkSummary || session.lastWorkSummary
          }
        });
      }
    }

    res.clearCookie('codrix_session_token', { path: '/' });
    res.clearCookie('codrix_token', { path: '/' });

    res.json({ data: { success: true, message: 'Session logged out due to 15 minutes of inactivity. Work saved.' } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/auth/logout - Terminates active session and records user logout
router.post('/logout', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const cols = getCollections();
    const userId = req.auth!.user.userId;
    const now = new Date();

    const activeSessions = await cols.userSessions.find({ userId, status: 'ACTIVE' }).toArray();
    for (const s of activeSessions) {
      const durationMs = s.loginAt ? (now.getTime() - new Date(s.loginAt).getTime()) : 0;
      await cols.userSessions.updateOne(
        { _id: s._id },
        {
          $set: {
            logoutAt: now,
            sessionDurationMs: durationMs,
            status: 'LOGGED_OUT',
            logoutReason: 'USER_LOGOUT'
          }
        }
      );

      SocketService.emitToTenant(s.tenantId, 'session:logged_out', {
        sessionId: s.sessionId,
        userId: s.userId,
        userEmail: s.userEmail
      });
    }

    res.clearCookie('codrix_session_token', { path: '/' });
    res.clearCookie('codrix_token', { path: '/' });

    await AuditService.log({
      tenantId: req.auth!.user.tenantId,
      user: req.auth!.user,
      action: 'AUTH_LOGOUT',
      resourceType: 'SESSION',
      resourceId: userId
    });

    res.json({ data: { success: true, message: 'Session logged out and cleared successfully' } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/v1/auth/session-records - Strictly for Founder & Superadmin Lakshay Only
router.get('/session-records', requireAuth, requireLakshaySuperAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;
    const now = new Date();

    // Auto-timeout any stale ACTIVE sessions whose lastActiveAt is older than 15 minutes
    const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000);
    const staleSessions = await cols.userSessions.find({
      tenantId,
      status: 'ACTIVE',
      lastActiveAt: { $lt: fifteenMinsAgo }
    }).toArray();

    for (const stale of staleSessions) {
      const loginTime = stale.loginAt ? new Date(stale.loginAt).getTime() : now.getTime();
      await cols.userSessions.updateOne(
        { _id: stale._id },
        {
          $set: {
            status: 'TIMEOUT_INACTIVE',
            logoutAt: stale.lastActiveAt || now,
            logoutReason: 'INACTIVITY_15MIN',
            sessionDurationMs: stale.lastActiveAt ? new Date(stale.lastActiveAt).getTime() - loginTime : 0
          }
        }
      );
    }

    const [sessions, activeCount, timeoutCount, totalToday] = await Promise.all([
      cols.userSessions
        .find({ tenantId })
        .sort({ loginAt: -1 })
        .limit(250)
        .toArray(),
      cols.userSessions.countDocuments({ tenantId, status: 'ACTIVE' }),
      cols.userSessions.countDocuments({ tenantId, status: 'TIMEOUT_INACTIVE' }),
      cols.userSessions.countDocuments({
        tenantId,
        loginAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      })
    ]);

    res.json({
      data: {
        activeCount,
        timeoutCount,
        totalToday,
        sessions: sessions.map((s) => ({
          ...s,
          id: s._id.toString()
        }))
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/auth/session-records/:id/revoke - Strictly Founder Lakshay Force Revoke Session
router.post('/session-records/:id/revoke', requireAuth, requireLakshaySuperAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const cols = getCollections();
    const { id } = req.params;
    const now = new Date();

    const session = await cols.userSessions.findOne({ _id: new ObjectId(id) });
    if (!session) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Session not found' } });
      return;
    }

    const durationMs = session.loginAt ? now.getTime() - new Date(session.loginAt).getTime() : 0;
    await cols.userSessions.updateOne(
      { _id: new ObjectId(id) },
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

// GET /api/v1/auth/team - Fetches the live team from MongoDB enriched with emails
router.get('/team', async (req: Request, res: Response): Promise<void> => {
  try {
    const cols = getCollections();
    const [team, users, employees] = await Promise.all([
      cols.teammembers.find().toArray(),
      cols.users.find().toArray(),
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
