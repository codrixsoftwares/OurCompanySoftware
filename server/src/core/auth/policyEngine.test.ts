import { describe, it, expect } from 'vitest';
import { PolicyEngine } from './policyEngine.js';
import { RoleCode } from './types.js';

describe('Codrix PolicyEngine (RBAC + ABAC)', () => {
  const tenantA = 'tenant-uuid-aaa';
  const tenantB = 'tenant-uuid-bbb';

  const bdeUser = {
    userId: 'user-bde-1',
    email: 'bde@codrix.co.in',
    fullName: 'Karan Malhotra',
    tenantId: tenantA,
    membershipId: 'mem-1',
    employeeId: 'emp-bde-1',
    roles: [RoleCode.BDE],
    departmentId: 'dept-sales'
  };

  const hrUser = {
    userId: 'user-hr-1',
    email: 'hr@codrix.co.in',
    fullName: 'Pooja Sharma',
    tenantId: tenantA,
    membershipId: 'mem-2',
    employeeId: 'emp-hr-1',
    roles: [RoleCode.HR_MANAGER],
    departmentId: 'dept-hr'
  };

  it('rejects cross-tenant access attempts', () => {
    const res = PolicyEngine.authorize(bdeUser, {
      module: 'crm',
      resource: 'leads',
      action: 'view_own',
      record: { tenantId: tenantB, ownerEmployeeId: bdeUser.employeeId }
    });
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain('Cross-tenant');
  });

  it('allows BDE to view own assigned leads', () => {
    const res = PolicyEngine.authorize(bdeUser, {
      module: 'crm',
      resource: 'leads',
      action: 'view_own',
      record: { tenantId: tenantA, ownerEmployeeId: bdeUser.employeeId }
    });
    expect(res.allowed).toBe(true);
  });

  it('prohibits BDE from accessing HR compensation or job closing', () => {
    const res = PolicyEngine.authorize(bdeUser, {
      module: 'recruitment',
      resource: 'jobs',
      action: 'close'
    });
    expect(res.allowed).toBe(false);
  });

  it('allows HR Manager to manage recruitment pipeline and approve offers', () => {
    const res = PolicyEngine.authorize(hrUser, {
      module: 'recruitment',
      resource: 'jobs',
      action: 'close',
      record: { tenantId: tenantA }
    });
    expect(res.allowed).toBe(true);
  });
});
