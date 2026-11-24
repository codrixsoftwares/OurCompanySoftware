export type RoleCode =
  | 'SUPER_ADMIN'
  | 'COMPANY_ADMIN'
  | 'GROWTH_OFFICER'
  | 'HR_MANAGER'
  | 'HR_EXEC'
  | 'BRANCH_MANAGER'
  | 'OPS_MANAGER'
  | 'BDM'
  | 'BDE'
  | 'ENGINEERING_LEAD'
  | 'SDE2'
  | 'SDE1'
  | 'INTERN'
  | 'EMPLOYEE';

export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
}

export interface Employee {
  id: string;
  employeeCode: string;
  jobTitle: string;
  departmentId?: string;
  branchId?: string;
}

export interface AuthSession {
  user: User;
  activeTenant: Tenant;
  employee?: Employee;
  roles: RoleCode[];
  availableTenants?: Tenant[];
  allowedTabs?: string[];
  isAccessRestricted?: boolean;
}

export interface PipelineStage {
  id: string;
  name: string;
  stageOrder: number;
  applications: Application[];
}

export interface CandidateJourneyEmail {
  stageName: string;
  sentAt: string;
  subject: string;
  deliveryMethod?: string;
  messageId?: string;
  success?: boolean;
  error?: string;
}

export interface JobOpening {
  id: string;
  requisitionCode: string;
  title: string;
  departmentId: string;
  openingType?: string;
  workplaceMode?: string;
  experienceLevel?: string;
  headcount: number;
  location: string;
  salaryMin?: number;
  salaryMax?: number;
  skills?: string;
  description?: string;
  senderEmail?: string;
  senderName?: string;
  replyToEmail?: string;
  emailProvider?: 'GOOGLE_WORKSPACE' | 'ZOHO_MAIL' | 'MICROSOFT_365' | 'HOSTINGER_CPANEL' | 'TRANSACTIONAL_API' | 'DEFAULT';
  emailTemplates?: Record<string, { subject: string; body: string; enabled: boolean }>;
  status: 'OPEN' | 'DRAFT' | 'CLOSED';
  applicantCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CandidateCredentials {
  generated: boolean;
  employeeCode?: string;
  loginEmail?: string;
  roleCode?: string;
  designation?: string;
  reportingManagerName?: string;
  generatedAt?: string;
  generatedBy?: string;
}

export interface CandidateDetail {
  id: string;
  serialNo?: number;
  requestNo?: string;
  fullName: string;
  emailNormalized: string;
  phoneNormalized?: string;
  source: string;
  resumeUrl?: string;
  notes?: string;
  credentials?: CandidateCredentials | null;
  journeyEmailsSent?: CandidateJourneyEmail[];
  createdAt?: string;
  application?: {
    id: string;
    serialNo?: number;
    requestNo?: string;
    stageId: string;
    stageName: string;
    jobOpeningId: string;
    jobTitle: string;
    requisitionCode: string;
    appliedAt: string;
    status: string;
  } | null;
  emails?: any[];
}

export interface Application {
  id: string;
  serialNo?: number;
  requestNo?: string;
  candidateId: string;
  jobOpeningId: string;
  stageId: string;
  status: string;
  appliedAt: string;
  credentials?: CandidateCredentials | null;
  candidate: {
    id: string;
    serialNo?: number;
    requestNo?: string;
    fullName: string;
    emailNormalized: string;
    phoneNormalized?: string;
    source: string;
    resumeUrl?: string;
    notes?: string;
    credentials?: CandidateCredentials | null;
    journeyEmailsSent?: CandidateJourneyEmail[];
  };
  jobOpening: {
    id: string;
    title: string;
    requisitionCode: string;
    jobRequisitionCode?: string;
    openingType?: string;
    departmentId?: string;
  };
  interviews?: any[];
  offers?: any[];
}

export interface MailboxConnection {
  id: string;
  mailboxAddress: string;
  mailboxType: string;
  displayName: string;
  connectionStatus: string;
  _count?: { threads: number };
}

export interface EmailThread {
  id: string;
  mailboxConnectionId: string;
  subject: string;
  snippet?: string;
  folder: string;
  category?: 'PRIMARY' | 'PROMOTIONS' | 'SOCIAL' | 'UPDATES' | string;
  starred?: boolean;
  labels?: string[];
  snoozedUntil?: string | null;
  unread: boolean;
  lastMessageAt: string;
  assignedEmployee?: {
    employeeCode: string;
    membership: { user: { fullName: string } };
  };
  messages: Array<{
    id: string;
    direction: string;
    sender: string;
    recipients?: string[] | string;
    subject: string;
    body: string;
    sentAt: string;
  }>;
  notes?: Array<{
    id: string;
    authorId: string;
    content: string;
    createdAt: string;
  }>;
}

export interface Lead {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  stage: string;
  priority: string;
  source: string;
  serviceInterest?: string;
  needSummary?: string;
  // BDE Survey & Research Fields:
  clientNeeds?: string;
  codrixSolution?: string;
  proofLinks?: string;
  researchPoints?: string;
  // Quality Review & Flagging Workflow:
  flagStatus?: 'PENDING' | 'GREEN_FLAG' | 'RED_FLAG';
  flagRemarks?: string;
  flaggedBy?: string;
  flaggedByEmail?: string;
  flaggedByRole?: string;
  flagTier?: 'CORE_TEAM' | 'BDM' | null;
  flaggedAt?: string;
  createdByName?: string;
  createdByEmail?: string;
  createdByRole?: string;
  assignedBdeEmail?: string;
  assignedBdeName?: string;
  assignedBdeId?: string;
  // Stage Transition & Note History:
  stageHistory?: Array<{
    fromStage: string;
    toStage: string;
    notes: string;
    updatedBy: string;
    updatedByEmail?: string;
    updatedByRole?: string;
    updatedAt: string;
  }>;
  lastStageNote?: string;
  lastStageUpdateBy?: string;
  lastStageUpdatedAt?: string;
  ownerEmployee?: {
    membership: { user: { fullName: string } };
  };
  activities?: Array<{
    id: string;
    outcome: string;
    summary: string;
    createdAt: string;
  }>;
  followUps?: Array<{
    id: string;
    dueAt: string;
    channel: string;
    priority: string;
  }>;
}

export interface Task {
  id: string;
  projectId?: string;
  taskCode: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  estimateHours?: number;
  dueAt?: string;
  dueDate?: string;
  sprintName?: string;
  taskType?: string;
  assigneeEmployeeId?: string;
  assigneeName?: string;
  assigneeRole?: string;
  assignedBy?: string;
  assignedAt?: string;
  project?: {
    id?: string;
    name: string;
    projectCode: string;
  };
  assigneeEmployee?: {
    membership: { user: { fullName: string } };
  };
}

export interface AttendanceRecord {
  id: string;
  date: string;
  checkInTime?: string;
  checkOutTime?: string;
  status: string;
}

export interface LeaveBalance {
  id: string;
  leaveTypeId: string;
  totalDays: number;
  usedDays: number;
  pendingDays: number;
  leaveType: {
    name: string;
    code: string;
  };
}
