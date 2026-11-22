import { MongoClient, Db, Collection } from 'mongodb';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb+srv://Lakshay:Lakshay123@ourcompany.fwhyx65.mongodb.net/codrix?compressors=zlib';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo(maxRetries = 5, retryDelayMs = 3000): Promise<Db> {
  if (db) return db;

  let lastError: any = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📡 Connecting to MongoDB Atlas (attempt ${attempt}/${maxRetries})...`);
      client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 30000,
        connectTimeoutMS: 30000
      });
      await client.connect();
      db = client.db('codrix');
      console.log('🍃 Connected to MongoDB Atlas cluster (db: codrix)');
      return db;
    } catch (err: any) {
      lastError = err;
      console.warn(`⚠️ MongoDB Atlas connection attempt ${attempt}/${maxRetries} failed:`, err?.message || err);
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  throw lastError || new Error('Failed to connect to MongoDB Atlas after multiple retries.');
}

export function getDb(): Db {
  if (!db) {
    throw new Error('Database not initialized. Call connectMongo() first.');
  }
  return db;
}

export interface Collections {
  tenants: Collection;
  users: Collection;
  memberships: Collection;
  employees: Collection;
  teammembers: Collection;
  teamMembers: Collection;
  roles: Collection;
  jobOpenings: Collection;
  candidates: Collection;
  applications: Collection;
  pipelineStages: Collection;
  mailboxConnections: Collection;
  emailThreads: Collection;
  emailMessages: Collection;
  emailNotes: Collection;
  leads: Collection;
  callActivities: Collection;
  followUps: Collection;
  customers: Collection;
  projects: Collection;
  tasks: Collection;
  taskStatusHistory: Collection;
  dailyUpdates: Collection;
  attendanceRecords: Collection;
  leaveTypes: Collection;
  leaveBalances: Collection;
  leaveRequests: Collection;
  auditLogs: Collection;
  tenantEmailConfigs: Collection;
  emailTemplates: Collection;
}

export function getCollections(): Collections {
  const database = getDb();
  return {
    tenants: database.collection('tenants'),
    users: database.collection('users'),
    memberships: database.collection('memberships'),
    employees: database.collection('employees'),
    teammembers: database.collection('teammembers'),
    teamMembers: database.collection('teammembers'),
    roles: database.collection('roles'),
    jobOpenings: database.collection('job_openings'),
    candidates: database.collection('candidates'),
    applications: database.collection('applications'),
    pipelineStages: database.collection('pipeline_stages'),
    mailboxConnections: database.collection('mailbox_connections'),
    emailThreads: database.collection('email_threads'),
    emailMessages: database.collection('email_messages'),
    emailNotes: database.collection('email_notes'),
    leads: database.collection('leads'),
    callActivities: database.collection('call_activities'),
    followUps: database.collection('follow_ups'),
    customers: database.collection('customers'),
    projects: database.collection('projects'),
    tasks: database.collection('tasks'),
    taskStatusHistory: database.collection('task_status_history'),
    dailyUpdates: database.collection('daily_updates'),
    attendanceRecords: database.collection('attendance_records'),
    leaveTypes: database.collection('leave_types'),
    leaveBalances: database.collection('leave_balances'),
    leaveRequests: database.collection('leave_requests'),
    auditLogs: database.collection('audit_logs'),
    tenantEmailConfigs: database.collection('tenant_email_configs'),
    emailTemplates: database.collection('email_templates')
  };
}

// Synchronize real team members and baseline organization structure
export async function syncMongoDatabase() {
  const cols = getCollections();

  // 1. Ensure Tenant exists in MongoDB
  let tenant = await cols.tenants.findOne({ slug: 'codrix' });
  if (!tenant) {
    const res = await cols.tenants.insertOne({
      slug: 'codrix',
      legalName: 'CODRIX PRIVATE LIMITED',
      displayName: 'CodRix Private Limited',
      status: 'ACTIVE',
      timezone: 'Asia/Kolkata',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    tenant = await cols.tenants.findOne({ _id: res.insertedId });
  }

  const tenantId = tenant!._id.toString();

  // 2. Fetch real team members from your existing `teammembers` collection
  const teamMembers = await cols.teammembers.find().toArray();
  const defaultPasswordHash = await bcrypt.hash('Lakshay123', 10);

  // Map real team members to email and system roles
  const teamMapping: Record<string, { email: string; role: string; title: string; code: string }> = {
    'Lakshay': { email: 'lakshay@codrix.co.in', role: 'COMPANY_ADMIN', title: 'Founder, Strategy & Tech', code: 'CDX-001' },
    'Parth Sharma': { email: 'parth@codrix.co.in', role: 'ENGINEERING_LEAD', title: 'Technology & Architecture', code: 'CDX-002' },
    'Anshuman': { email: 'anshuman@codrix.co.in', role: 'HR_MANAGER', title: 'Head of People & HR', code: 'CDX-003' },
    'Suryansh Thakur': { email: 'suryansh@codrix.co.in', role: 'BDM', title: 'Growth & Partnerships', code: 'CDX-004' },
    'Diya Maheshwari': { email: 'diya@codrix.co.in', role: 'OPS_MANAGER', title: 'Operations & Execution', code: 'CDX-005' },
    'Ishita Malhotra': { email: 'ishita@codrix.co.in', role: 'BRANCH_MANAGER', title: 'Corporate Governance & Oversight', code: 'CDX-006' }
  };

  for (const tm of teamMembers) {
    const mapping = teamMapping[tm.name] || {
      email: `${tm.name.toLowerCase().replace(/\s+/g, '.')}@codrix.co.in`,
      role: 'EMPLOYEE',
      title: tm.role || tm.designation || 'Team Member',
      code: `CDX-${Math.floor(100 + Math.random() * 900)}`
    };

    let user = await cols.users.findOne({ primaryEmail: mapping.email });
    if (!user) {
      const userRes = await cols.users.insertOne({
        primaryEmail: mapping.email,
        passwordHash: defaultPasswordHash,
        fullName: tm.name,
        avatarUrl: tm.avatar || tm.photo,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      user = await cols.users.findOne({ _id: userRes.insertedId });
    }

    const userId = user!._id.toString();

    let membership = await cols.memberships.findOne({ tenantId, userId });
    if (!membership) {
      const memRes = await cols.memberships.insertOne({
        tenantId,
        userId,
        roles: [mapping.role],
        status: 'ACTIVE',
        joinedAt: new Date()
      });
      membership = await cols.memberships.findOne({ _id: memRes.insertedId });
    }

    const membershipId = membership!._id.toString();

    let employee = await cols.employees.findOne({ membershipId });
    if (!employee) {
      await cols.employees.insertOne({
        tenantId,
        membershipId,
        userId,
        employeeCode: mapping.code,
        jobTitle: mapping.title,
        employmentStatus: 'ACTIVE',
        joinedOn: new Date(),
        fullName: tm.name,
        email: mapping.email
      });
    }
  }

  // 2b. Ensure dedicated BDE Intern exists for testing quality gatekeeping workflow
  const bdeUser = await cols.users.findOne({ primaryEmail: 'aryan@codrix.co.in' });
  if (!bdeUser) {
    const userRes = await cols.users.insertOne({
      primaryEmail: 'aryan@codrix.co.in',
      passwordHash: defaultPasswordHash,
      fullName: 'Aryan Kapoor',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const userId = userRes.insertedId.toString();
    const memRes = await cols.memberships.insertOne({
      tenantId,
      userId,
      roles: ['BDE'],
      status: 'ACTIVE',
      joinedAt: new Date()
    });
    await cols.employees.insertOne({
      tenantId,
      userId,
      membershipId: memRes.insertedId.toString(),
      employeeCode: 'CDX-007',
      name: 'Aryan Kapoor',
      fullName: 'Aryan Kapoor',
      email: 'aryan@codrix.co.in',
      jobTitle: 'Business Development Intern (BDE)',
      department: 'Growth',
      status: 'ACTIVE',
      joinedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const existingTm = await cols.teammembers.findOne({ name: 'Aryan Kapoor' });
    if (!existingTm) {
      await cols.teammembers.insertOne({
        name: 'Aryan Kapoor',
        email: 'aryan@codrix.co.in',
        role: 'Business Development Intern (BDE)',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'
      });
    }
  }

  // 3. Ensure Pipeline stages exist (including Internship after Executive Review)
  const defaultStages = [
    { name: 'Sourced', stageOrder: 1 },
    { name: 'Screened', stageOrder: 2 },
    { name: 'Technical Interview', stageOrder: 3 },
    { name: 'Executive Review', stageOrder: 4 },
    { name: 'Internship', stageOrder: 5 },
    { name: 'Offer Extended', stageOrder: 6 },
    { name: 'Hired', stageOrder: 7 }
  ];

  for (const s of defaultStages) {
    const existing = await cols.pipelineStages.findOne({ tenantId, name: s.name });
    if (!existing) {
      await cols.pipelineStages.insertOne({
        tenantId,
        name: s.name,
        stageOrder: s.stageOrder,
        isSystem: true,
        createdAt: new Date()
      });
    } else {
      await cols.pipelineStages.updateOne(
        { _id: existing._id },
        { $set: { stageOrder: s.stageOrder } }
      );
    }
  }

  // 4. Ensure Mailbox Connections exist in MongoDB
  const mbCount = await cols.mailboxConnections.countDocuments({ tenantId });
  let defaultMailboxId: string = '';
  if (mbCount === 0) {
    const mailboxes = [
      { mailboxAddress: 'connect@codrix.co.in', displayName: 'CodRix Connect & Support', mailboxType: 'SHARED' },
      { mailboxAddress: 'careers@codrix.co.in', displayName: 'CodRix Talent & Careers', mailboxType: 'SHARED' },
      { mailboxAddress: 'sales@codrix.co.in', displayName: 'Enterprise Sales & Partnerships', mailboxType: 'SHARED' },
      { mailboxAddress: 'hr@codrix.co.in', displayName: 'Human Resources Desk', mailboxType: 'SHARED' }
    ];
    for (let i = 0; i < mailboxes.length; i++) {
      const mb = mailboxes[i];
      const res = await cols.mailboxConnections.insertOne({
        tenantId,
        provider: 'GOOGLE',
        mailboxAddress: mb.mailboxAddress,
        displayName: mb.displayName,
        mailboxType: mb.mailboxType,
        connectionStatus: 'CONNECTED',
        createdAt: new Date()
      });
      if (i === 0) defaultMailboxId = res.insertedId.toString();
    }
  } else {
    const firstMb = await cols.mailboxConnections.findOne({ tenantId });
    if (firstMb) defaultMailboxId = firstMb._id.toString();
  }

  // No hardcoded or mock emails seeded: only authentic, live IMAP/SMTP synced messages are used.

  // 5. Ensure Leave Types exist in MongoDB
  const ltCount = await cols.leaveTypes.countDocuments({ tenantId });
  if (ltCount === 0) {
    await cols.leaveTypes.insertMany([
      { tenantId, name: 'Paid Leave', code: 'PL', defaultDaysPerYear: 18 },
      { tenantId, name: 'Casual Leave', code: 'CL', defaultDaysPerYear: 12 },
      { tenantId, name: 'Sick Leave', code: 'SL', defaultDaysPerYear: 10 }
    ]);
  }

  console.log('✅ MongoDB collections and CodRix team members synchronized successfully!');
}
