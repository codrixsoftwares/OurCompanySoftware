import { RoleCode, Scope, UserContext } from './types.js';

export interface AuthorizeOptions {
  module: string;
  resource: string;
  action: string;
  record?: {
    tenantId?: string;
    ownerEmployeeId?: string;
    assigneeEmployeeId?: string;
    departmentId?: string;
    branchId?: string;
    authorId?: string;
  };
}

// Baseline permissions map based on Document 03 Role-Permission Matrix
export const ROLE_PERMISSIONS_MAP: Record<RoleCode, Record<string, string[]>> = {
  [RoleCode.SUPER_ADMIN]: {
    'platform:*': ['*'],
    'tenant:*': ['*'],
    'audit:*': ['*'],
    '*': ['*']
  },
  [RoleCode.COMPANY_ADMIN]: {
    'company:*': ['*'],
    'users:*': ['create', 'view', 'edit', 'deactivate', 'assign_role'],
    'recruitment:*': ['create', 'view', 'edit', 'delete', 'close', 'approve', 'shortlist', '*'],
    'mailbox:*': ['create', 'view', 'edit', 'assign', 'read', 'send', '*'],
    'crm:*': ['create', 'view', 'view_own', 'view_all', 'edit', 'reassign', 'archive', '*'],
    'engineering:*': ['create', 'view', 'edit', 'delete', '*'],
    'hrms:*': ['create', 'view', 'edit', 'approve', '*'],
    'reports:*': ['view', 'export', '*'],
    'audit:*': ['view', 'export', '*'],
    '*': ['*']
  },
  [RoleCode.HR_MANAGER]: {
    'recruitment:*': ['create', 'view', 'edit', 'delete', 'close', 'approve_offer', 'shortlist', '*'],
    'hrms:*': ['view', 'edit', 'approve_leave', 'onboard', 'offboard', 'approve', '*'],
    'mailbox:*': ['read', 'send', 'assign', 'view', '*'],
    'crm:*': ['view', 'view_own', 'view_all', 'read'],
    'engineering:*': ['view', 'read'],
    'reports:*': ['view', 'export'],
    'audit:*': ['view']
  },
  [RoleCode.HR_EXEC]: {
    'recruitment:*': ['create', 'view', 'edit', 'shortlist', '*'],
    'recruitment:jobs': ['view', 'create', 'edit'],
    'recruitment:candidates': ['create', 'view', 'edit', 'shortlist'],
    'recruitment:interviews': ['schedule', 'reschedule', 'cancel'],
    'recruitment:offers': ['draft'],
    'hrms:*': ['view', 'edit'],
    'hrms:onboarding': ['create', 'view', 'edit'],
    'crm:*': ['view', 'view_own', 'view_all', 'read'],
    'engineering:*': ['view', 'read'],
    'mailbox:*': ['read', 'send', 'view']
  },
  [RoleCode.GROWTH_OFFICER]: {
    'crm:*': ['create', 'view', 'view_own', 'view_team', 'view_all', 'reassign', 'archive', 'edit', '*'],
    'crm:leads': ['*'],
    'crm:activities': ['*'],
    'crm:opportunities': ['*'],
    'recruitment:*': ['view', 'read'],
    'engineering:*': ['view', 'read'],
    'hrms:*': ['view', 'read'],
    'reports:*': ['view', 'export'],
    'mailbox:*': ['read', 'send', 'assign', 'view', '*']
  },
  [RoleCode.BDM]: {
    'crm:*': ['create', 'view', 'view_own', 'view_team', 'view_all', 'reassign', 'edit', '*'],
    'crm:leads': ['create', 'view', 'view_own', 'view_team', 'view_all', 'reassign', 'edit'],
    'crm:activities': ['create', 'view', 'view_team', 'view_own'],
    'crm:opportunities': ['create', 'view', 'view_team', 'view_own', 'edit'],
    'recruitment:*': ['view', 'read'],
    'engineering:*': ['view', 'read'],
    'hrms:*': ['view', 'read'],
    'reports:*': ['view', 'export'],
    'mailbox:*': ['read', 'send', 'assign', 'view']
  },
  [RoleCode.BDE]: {
    'crm:*': ['create', 'view', 'view_own', 'view_team', 'view_all', 'edit_own', 'edit'],
    'crm:leads': ['create', 'view', 'view_own', 'view_team', 'view_all', 'edit_own', 'edit'],
    'crm:activities': ['create', 'view', 'view_own'],
    'crm:followups': ['create', 'view', 'view_own', 'complete_own'],
    'crm:opportunities': ['create', 'view', 'view_own'],
    'recruitment:*': ['view', 'read'],
    'engineering:*': ['view', 'read'],
    'hrms:*': ['view', 'read'],
    'mailbox:*': ['read', 'send', 'view']
  },
  [RoleCode.ENGINEERING_LEAD]: {
    'engineering:*': ['create', 'view', 'edit', 'assign', 'review', 'close', '*'],
    'engineering:projects': ['view', 'edit', 'create'],
    'engineering:sprints': ['create', 'view', 'edit', 'close'],
    'engineering:tasks': ['create', 'view', 'edit', 'assign', 'review'],
    'engineering:bugs': ['create', 'view', 'edit', 'close'],
    'recruitment:*': ['view', 'shortlist', 'read'],
    'crm:*': ['view', 'view_own', 'view_all', 'read'],
    'hrms:*': ['view', 'read'],
    'mailbox:*': ['read', 'send', 'assign', 'view', '*'],
    'reports:*': ['view', 'export']
  },
  [RoleCode.SDE2]: {
    'engineering:*': ['create', 'view', 'view_assigned', 'edit_assigned', 'review', 'edit'],
    'engineering:projects': ['view'],
    'engineering:tasks': ['view', 'view_assigned', 'edit_assigned', 'review', 'edit'],
    'engineering:bugs': ['create', 'view', 'edit'],
    'engineering:daily_updates': ['create', 'view_team', 'view_own'],
    'recruitment:*': ['view', 'read'],
    'crm:*': ['view', 'view_own', 'view_all', 'read'],
    'hrms:*': ['view', 'read'],
    'mailbox:*': ['read', 'send', 'view']
  },
  [RoleCode.SDE1]: {
    'engineering:*': ['create', 'view', 'view_assigned', 'edit_assigned', 'edit'],
    'engineering:projects': ['view'],
    'engineering:tasks': ['view', 'view_assigned', 'edit_assigned'],
    'engineering:bugs': ['create', 'view', 'edit'],
    'engineering:daily_updates': ['create', 'view_own'],
    'recruitment:*': ['view', 'read'],
    'crm:*': ['view', 'view_own', 'view_all', 'read'],
    'hrms:*': ['view', 'read'],
    'mailbox:*': ['read', 'send', 'view']
  },
  [RoleCode.INTERN]: {
    'engineering:*': ['view', 'view_assigned', 'edit_assigned', 'create'],
    'engineering:tasks': ['view', 'view_assigned', 'edit_assigned'],
    'engineering:daily_updates': ['create', 'view_own'],
    'recruitment:*': ['view', 'read'],
    'crm:*': ['view', 'view_own', 'view_all', 'read'],
    'hrms:*': ['view', 'view_own'],
    'hrms:learning': ['view_own'],
    'mailbox:*': ['read', 'send', 'view']
  },
  [RoleCode.BRANCH_MANAGER]: {
    'branch:*': ['view', 'manage', '*'],
    'crm:*': ['create', 'view', 'view_own', 'view_all', 'edit'],
    'hrms:attendance': ['view', 'view_branch', 'approve'],
    'hrms:leave': ['view', 'view_branch', 'approve'],
    'hrms:*': ['view', 'approve'],
    'recruitment:*': ['view', 'read'],
    'engineering:*': ['view', 'read'],
    'mailbox:*': ['read', 'send', 'view', '*'],
    'reports:*': ['view', 'export']
  },
  [RoleCode.OPS_MANAGER]: {
    'ops:*': ['view', 'manage', '*'],
    'crm:*': ['create', 'view', 'view_own', 'view_all', 'edit'],
    'hrms:attendance': ['view', 'view_department', 'approve'],
    'hrms:leave': ['view', 'view_department', 'approve'],
    'hrms:*': ['view', 'approve'],
    'recruitment:*': ['view', 'read'],
    'engineering:*': ['view', 'read'],
    'mailbox:*': ['read', 'send', 'view', '*'],
    'reports:*': ['view', 'export']
  },
  [RoleCode.EMPLOYEE]: {
    'hrms:self': ['view', 'update_profile'],
    'hrms:attendance': ['clock_in', 'clock_out', 'view_own', 'view'],
    'hrms:leave': ['request', 'view_own', 'view'],
    'hrms:*': ['view', 'view_own'],
    'crm:*': ['view', 'view_own', 'view_all', 'read'],
    'recruitment:*': ['view', 'read'],
    'engineering:*': ['view', 'read'],
    'mailbox:*': ['read', 'send', 'view']
  }
};

export class PolicyEngine {
  static authorize(user: UserContext, options: AuthorizeOptions): { allowed: boolean; reason?: string } {
    // 1. Tenant boundary enforcement: resource must match user active tenant
    if (options.record?.tenantId && options.record.tenantId !== user.tenantId) {
      return { allowed: false, reason: 'Cross-tenant access prohibited' };
    }

    // Strict founder rule: ONLY Lakshay is authorized to delete data across all modules and pages
    if (options.action.toLowerCase() === 'delete') {
      const email = (user.email || '').toLowerCase().trim();
      const name = (user.fullName || '').toLowerCase().trim();
      const isLakshay = email === 'lakshay@codrix.co.in' || email.startsWith('lakshay@') || name === 'lakshay';
      if (!isLakshay) {
        return { allowed: false, reason: 'Only Lakshay (Founder & Overall Superadmin) is authorized to delete records from CodRix OS.' };
      }
    }

    // 2. Company Admin and Super Admin overrides within appropriate boundaries
    if (user.roles.includes(RoleCode.SUPER_ADMIN)) {
      return { allowed: true };
    }
    if (user.roles.includes(RoleCode.COMPANY_ADMIN)) {
      return { allowed: true };
    }

    // 2b. Universal View / Read access across all workspace modules for authenticated company team members
    // Guarantees all roles (Engineers, HR, Operations, Sales, Executives, Employees) can freely view and navigate
    // modules (CRM, ATS, Sprints, HRMS, Mailbox, Reports) without encountering 403 Forbidden errors.
    const isViewAction = ['view', 'view_own', 'view_all', 'view_team', 'read', 'list', 'inspect'].includes(options.action.toLowerCase());
    if (isViewAction) {
      return { allowed: true };
    }

    // 3. Evaluate matching permissions for user's assigned roles
    let hasActionGrant = false;
    const reqPerm = `${options.module}:${options.resource}`;

    for (const role of user.roles) {
      const perms = ROLE_PERMISSIONS_MAP[role];
      if (!perms) continue;

      for (const [permKey, actions] of Object.entries(perms)) {
        const [permMod, permRes] = permKey.split(':');
        const modMatch = permMod === '*' || permMod === options.module;
        const resMatch = permRes === '*' || permRes === options.resource;

        if (modMatch && resMatch) {
          if (actions.includes('*') || actions.includes(options.action)) {
            hasActionGrant = true;
            break;
          }
        }
      }
      if (hasActionGrant) break;
    }

    if (!hasActionGrant) {
      return { allowed: false, reason: `Action '${options.action}' not granted on '${reqPerm}'` };
    }

    // 4. ABAC Scoped verification if record provided
    if (options.record) {
      const isOwner =
        (options.record.ownerEmployeeId && options.record.ownerEmployeeId === user.employeeId) ||
        (options.record.assigneeEmployeeId && options.record.assigneeEmployeeId === user.employeeId) ||
        (options.record.authorId && options.record.authorId === user.userId);

      const isDept = options.record.departmentId && options.record.departmentId === user.departmentId;

      // If user is a general employee, intern, BDE, or SDE, scope defaults to OWN unless team/dept manager
      const isManager = user.roles.some((r) =>
        [RoleCode.BDM, RoleCode.HR_MANAGER, RoleCode.ENGINEERING_LEAD, RoleCode.BRANCH_MANAGER, RoleCode.OPS_MANAGER].includes(r)
      );

      if (!isManager && !isOwner && !isDept) {
        // Record is outside user's individual scope
        return { allowed: false, reason: 'Record is outside user data scope' };
      }
    }

    return { allowed: true };
  }
}
