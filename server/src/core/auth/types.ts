export enum RoleCode {
  SUPER_ADMIN = 'SUPER_ADMIN',
  COMPANY_ADMIN = 'COMPANY_ADMIN',
  GROWTH_OFFICER = 'GROWTH_OFFICER',
  HR_MANAGER = 'HR_MANAGER',
  HR_EXEC = 'HR_EXEC',
  BRANCH_MANAGER = 'BRANCH_MANAGER',
  OPS_MANAGER = 'OPS_MANAGER',
  BDM = 'BDM',
  BDE = 'BDE',
  SDE1 = 'SDE1',
  SDE2 = 'SDE2',
  ENGINEERING_LEAD = 'ENGINEERING_LEAD',
  INTERN = 'INTERN',
  EMPLOYEE = 'EMPLOYEE'
}

export enum Scope {
  OWN = 'OWN',
  TEAM = 'TEAM',
  DEPARTMENT = 'DEPARTMENT',
  BRANCH = 'BRANCH',
  COMPANY = 'COMPANY',
  PLATFORM = 'PLATFORM'
}

export interface UserContext {
  userId: string;
  email: string;
  fullName: string;
  tenantId: string;
  membershipId: string;
  employeeId?: string;
  roles: RoleCode[];
  departmentId?: string;
  branchId?: string;
  managerEmployeeId?: string;
  allowedTabs?: string[];
  isAccessRestricted?: boolean;
}

export interface AuthContext {
  user: UserContext;
  requestId: string;
}
