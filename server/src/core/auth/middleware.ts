import { Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import { verifyToken } from './jwt.js';
import { getCollections } from '../mongodb.js';
import { RoleCode, UserContext } from './types.js';
import { PolicyEngine } from './policyEngine.js';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        user: UserContext;
        requestId: string;
      };
    }
  }
}

// Safe cookie parser helper
function extractCookieToken(req: Request): string | undefined {
  if (req.cookies?.codrix_session_token) return req.cookies.codrix_session_token;
  if (req.cookies?.codrix_token) return req.cookies.codrix_token;
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [name, ...value] = part.trim().split('=');
    if (name === 'codrix_session_token' || name === 'codrix_token') {
      return decodeURIComponent(value.join('='));
    }
  }
  return undefined;
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : extractCookieToken(req);

  if (!token) {
    next();
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    next();
    return;
  }

  try {
    const cols = getCollections();
    
    // Resolve user by id or string representation
    let userQuery: any = { primaryEmail: payload.email };
    try {
      userQuery = { $or: [{ _id: new ObjectId(payload.userId) }, { primaryEmail: payload.email }] };
    } catch {
      userQuery = { primaryEmail: payload.email };
    }

    const user = await cols.users.findOne(userQuery);
    if (!user) {
      next();
      return;
    }

    const userId = user._id.toString();
    const membership = await cols.memberships.findOne({ userId, tenantId: payload.tenantId, status: 'ACTIVE' }) ||
                       await cols.memberships.findOne({ userId, status: 'ACTIVE' });

    if (!membership) {
      next();
      return;
    }

    const membershipId = membership._id.toString();
    const employee = await cols.employees.findOne({ membershipId }) || await cols.employees.findOne({ userId });
    const roles = (membership.roles || [RoleCode.EMPLOYEE]) as RoleCode[];

    req.auth = {
      requestId: (req.headers['x-request-id'] as string) || `req_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      user: {
        userId,
        email: user.primaryEmail,
        fullName: user.fullName,
        tenantId: membership.tenantId,
        membershipId,
        employeeId: employee?._id ? employee._id.toString() : undefined,
        departmentId: employee?.departmentId,
        branchId: employee?.branchId,
        roles: roles.length > 0 ? roles : [RoleCode.EMPLOYEE],
        allowedTabs: membership.allowedTabs || user.allowedTabs,
        isAccessRestricted: Boolean(membership.isAccessRestricted || user.isAccessRestricted)
      }
    };

    next();
  } catch (error) {
    console.error('Auth middleware resolution error:', error);
    next();
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth?.user) {
    res.status(401).json({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication session required or expired.'
      }
    });
    return;
  }
  next();
}

export function requirePermission(module: string, resource: string, action: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth?.user) {
      res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } });
      return;
    }

    // Strict Founder override rule: Any delete action anywhere in the system is exclusively reserved for Lakshay
    if (action === 'delete') {
      const email = (req.auth.user.email || '').toLowerCase().trim();
      const name = (req.auth.user.fullName || '').toLowerCase().trim();
      const isLakshay = email === 'lakshay@codrix.co.in' || email.startsWith('lakshay@') || name === 'lakshay';
      if (!isLakshay) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Security Violation: Only Lakshay (Founder & Overall Superadmin) is authorized to delete data from CodRix OS.'
          }
        });
        return;
      }
    }

    const { allowed, reason } = PolicyEngine.authorize(req.auth.user, {
      module,
      resource,
      action
    });

    if (!allowed) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: reason || 'Access denied by policy engine'
        }
      });
      return;
    }

    next();
  };
}

export function requireLakshaySuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth?.user) {
    res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } });
    return;
  }

  const email = (req.auth.user.email || '').toLowerCase().trim();
  const name = (req.auth.user.fullName || '').toLowerCase().trim();
  const isLakshay = email === 'lakshay@codrix.co.in' || email.startsWith('lakshay@') || name === 'lakshay';

  if (!isLakshay) {
    res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Security Violation: Only Lakshay (Founder & Overall Superadmin) is authorized to delete data or perform administrative overrides.'
      }
    });
    return;
  }

  next();
}

/**
 * Access restricted exclusively to SuperAdmin Lakshay, Diya, Parth, Anshuman, and Ishita
 */
export function requireEmailTemplatesAccess(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth?.user) {
    res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' } });
    return;
  }

  const email = (req.auth.user.email || '').toLowerCase().trim();
  const name = (req.auth.user.fullName || '').toLowerCase().trim();
  const allowed = ['lakshay', 'diya', 'parth', 'anshuman', 'ishita'];
  const hasAccess = allowed.some((a) => email.includes(a) || name.includes(a));

  if (!hasAccess) {
    res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Access Restricted: Only SuperAdmin Lakshay, Diya, Parth, Anshuman, and Ishita are authorized to access and modify CodRix Email Templates.'
      }
    });
    return;
  }

  next();
}
