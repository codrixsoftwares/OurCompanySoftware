import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { getCollections } from '../../core/mongodb.js';
import { requireAuth, requirePermission, requireLakshaySuperAdmin } from '../../core/auth/middleware.js';
import { AuditService } from '../../core/audit/auditService.js';
import { RoleCode } from '../../core/auth/types.js';
import { SocketService } from '../../core/socket/socketService.js';

const router = Router();

// Helper to determine review hierarchy tier: Core Team vs BDM vs BDE
export function getReviewerTier(user: { email?: string; fullName?: string; roles?: RoleCode[] | string[] }): {
  isReviewer: boolean;
  tier: 'CORE_TEAM' | 'BDM' | null;
  isCoreTeam: boolean;
  isBdm: boolean;
} {
  const email = (user.email || '').toLowerCase().trim();
  const name = (user.fullName || '').toLowerCase().trim();
  const roles = (user.roles || []) as string[];

  // Core Team Leadership:
  // Lakshay (Founder & Overall Superadmin)
  // Parth Sharma (Technology & Architecture)
  // Diya Maheshwari (Operations & Execution)
  // Ishita Malhotra (Corporate Governance & Oversight)
  // Anshuman (Head of People & HR)
  const coreLeaderEmails = [
    'lakshay@codrix.co.in',
    'parth@codrix.co.in',
    'diya@codrix.co.in',
    'ishita@codrix.co.in',
    'anshuman@codrix.co.in'
  ];

  const isCoreLeaderEmail = coreLeaderEmails.some((e) => email === e || email.startsWith(e.split('@')[0] + '@'));
  const isCoreLeaderName = ['lakshay', 'parth', 'diya', 'ishita', 'anshuman'].some((n) => name.includes(n));
  const isCoreLeaderRole = roles.some((r) =>
    [
      RoleCode.COMPANY_ADMIN,
      RoleCode.SUPER_ADMIN,
      RoleCode.ENGINEERING_LEAD,
      RoleCode.OPS_MANAGER,
      RoleCode.BRANCH_MANAGER,
      RoleCode.HR_MANAGER
    ].includes(r as any)
  );

  const isCoreTeam = isCoreLeaderEmail || isCoreLeaderName || isCoreLeaderRole;
  const isBdm = roles.includes(RoleCode.BDM as any) || name.includes('bdm') || email.includes('suryansh');

  if (isCoreTeam) {
    return { isReviewer: true, tier: 'CORE_TEAM', isCoreTeam: true, isBdm: Boolean(isBdm) };
  }
  if (isBdm) {
    return { isReviewer: true, tier: 'BDM', isCoreTeam: false, isBdm: true };
  }

  return { isReviewer: false, tier: null, isCoreTeam: false, isBdm: false };
}

// GET /api/v1/crm/bdes (Fetch all active BDEs for lead assignment)
router.get('/bdes', requireAuth, async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    const bdeEmployees = await cols.employees.find({
      tenantId,
      $or: [
        { roleCode: 'BDE' },
        { jobTitle: { $regex: /bde|business development/i } },
        { department: { $regex: /growth|sales|partnerships/i } }
      ]
    }).toArray();

    const bdeMemberships = await cols.memberships.find({
      tenantId,
      roles: { $in: ['BDE', RoleCode.BDE] }
    }).toArray();
    const bdeUserIds = bdeMemberships.map((m) => m.userId).filter(Boolean);

    const bdeUsers = await cols.users.find({
      tenantId,
      _id: { $in: bdeUserIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id)) }
    }).toArray();

    const map = new Map<string, any>();
    for (const e of bdeEmployees) {
      if (e.email) {
        map.set(e.email.toLowerCase().trim(), {
          id: e._id.toString(),
          employeeCode: e.employeeCode || 'CDX-BDE',
          fullName: e.fullName,
          email: e.email,
          phone: e.phone || '',
          jobTitle: e.jobTitle || 'Business Development Executive (BDE)'
        });
      }
    }
    for (const u of bdeUsers) {
      const email = (u.primaryEmail || '').toLowerCase().trim();
      if (email && !map.has(email)) {
        map.set(email, {
          id: u._id.toString(),
          employeeCode: 'CDX-BDE',
          fullName: u.fullName,
          email: u.primaryEmail,
          phone: u.phone || '',
          jobTitle: 'Business Development Executive (BDE)'
        });
      }
    }

    res.json({ data: Array.from(map.values()) });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/v1/crm/leads (Strict BDE Isolation: BDEs only see their added/assigned leads)
router.get('/leads', requireAuth, requirePermission('crm', 'leads', 'view_own'), async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;
    const userRoles = req.auth!.user.roles;
    const userEmail = (req.auth!.user.email || '').toLowerCase().trim();
    const userName = (req.auth!.user.fullName || '').trim();

    const { isCoreTeam, isBdm } = getReviewerTier(req.auth!.user);
    const isTopAdmin = userRoles.some((r) =>
      [RoleCode.COMPANY_ADMIN, RoleCode.SUPER_ADMIN].includes(r)
    ) || userEmail === 'lakshay@codrix.co.in';

    const filter: any = { tenantId };

    if (isTopAdmin || isCoreTeam || isBdm) {
      // Full visibility across all leads for Founder, Core Team & BDM
    } else {
      // Strict Data Isolation for BDEs:
      // BDE can ONLY see leads that they added or that were assigned to them!
      const orConditions: any[] = [
        { createdByEmail: { $regex: new RegExp(`^${userEmail}$`, 'i') } },
        { assignedBdeEmail: { $regex: new RegExp(`^${userEmail}$`, 'i') } }
      ];
      if (userName) {
        orConditions.push({ createdByName: { $regex: new RegExp(`^${userName}$`, 'i') } });
        orConditions.push({ assignedBdeName: { $regex: new RegExp(`^${userName}$`, 'i') } });
      }
      if (req.auth!.user.employeeId) {
        orConditions.push({ ownerEmployeeId: req.auth!.user.employeeId });
        orConditions.push({ assignedBdeId: req.auth!.user.employeeId });
      }
      if (req.auth!.user.userId) {
        orConditions.push({ createdByUserId: req.auth!.user.userId });
      }
      filter.$or = orConditions;
    }

    const leads = await cols.leads.find(filter).sort({ updatedAt: -1 }).toArray();
    const leadIds = leads.map((l) => l._id.toString());
    const activities = await cols.callActivities.find({ leadId: { $in: leadIds } }).sort({ createdAt: -1 }).toArray();

    const enriched = leads.map((l) => {
      const lId = l._id.toString();
      return {
        ...l,
        id: lId,
        activities: activities.filter((a) => a.leadId === lId).map((a) => ({ ...a, id: a._id.toString() }))
      };
    });

    res.json({ data: enriched });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/crm/leads
router.post('/leads', requireAuth, requirePermission('crm', 'leads', 'create'), async (req: Request, res: Response) => {
  try {
    const {
      companyName,
      contactName,
      email,
      phone,
      source,
      serviceInterest,
      needSummary,
      priority,
      clientNeeds,
      codrixSolution,
      proofLinks,
      researchPoints,
      assignedBdeEmail,
      assignedBdeName,
      assignedBdeId
    } = req.body;
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    const { isCoreTeam, isBdm } = getReviewerTier(req.auth!.user);
    const isTopAdmin = req.auth!.user.roles.some((r) =>
      [RoleCode.COMPANY_ADMIN, RoleCode.SUPER_ADMIN].includes(r)
    ) || (req.auth!.user.email || '').toLowerCase() === 'lakshay@codrix.co.in';

    // If Admin, Core Team, or BDM assigned a specific BDE, resolve BDE info
    let finalAssignedEmail = (assignedBdeEmail || '').toLowerCase().trim();
    let finalAssignedName = (assignedBdeName || '').trim();
    let finalAssignedId = assignedBdeId || null;

    if (!isTopAdmin && !isCoreTeam && !isBdm) {
      // User is BDE: automatically assigned to themselves
      finalAssignedEmail = (req.auth!.user.email || '').toLowerCase().trim();
      finalAssignedName = req.auth!.user.fullName;
      finalAssignedId = req.auth!.user.employeeId || null;
    } else if (finalAssignedEmail && (!finalAssignedName || !finalAssignedId)) {
      const matchedEmp = await cols.employees.findOne({ tenantId, email: finalAssignedEmail });
      if (matchedEmp) {
        finalAssignedName = matchedEmp.fullName;
        finalAssignedId = matchedEmp._id.toString();
      }
    }

    const now = new Date();
    const leadDoc = {
      tenantId,
      companyName,
      contactName: contactName || 'Primary Contact',
      email: email || '',
      phone: phone || '',
      source: source || 'WEBSITE',
      serviceInterest: serviceInterest || 'Enterprise Workspace',
      needSummary: needSummary || clientNeeds || '',
      priority: priority || 'MEDIUM',
      // BDE Survey & Research Intelligence
      clientNeeds: clientNeeds || '',
      codrixSolution: codrixSolution || '',
      proofLinks: proofLinks || '',
      researchPoints: researchPoints || '',
      // Quality Gatekeeping: Defaults to PENDING review
      flagStatus: 'PENDING',
      flagRemarks: '',
      flaggedBy: null,
      flaggedByEmail: null,
      flaggedByRole: null,
      flagTier: null,
      flaggedAt: null,
      createdByName: req.auth!.user.fullName,
      createdByEmail: req.auth!.user.email,
      createdByRole: req.auth!.user.roles[0] || 'BDE',
      createdByUserId: req.auth!.user.userId,
      assignedBdeEmail: finalAssignedEmail || req.auth!.user.email,
      assignedBdeName: finalAssignedName || req.auth!.user.fullName,
      assignedBdeId: finalAssignedId || req.auth!.user.employeeId,
      ownerEmployeeId: finalAssignedId || req.auth!.user.employeeId,
      stage: 'NEW',
      stageHistory: [
        {
          fromStage: 'CREATED',
          toStage: 'NEW',
          notes: `Lead added to CRM by ${req.auth!.user.fullName} (${req.auth!.user.roles[0] || 'Team'})` + (finalAssignedName ? ` • Assigned to BDE: ${finalAssignedName}` : ''),
          updatedBy: req.auth!.user.fullName,
          updatedByEmail: req.auth!.user.email,
          updatedByRole: req.auth!.user.roles[0] || 'Team',
          updatedAt: now
        }
      ],
      lastStageNote: `Lead registered in pipeline. Awaiting survey intel verification.`,
      lastStageUpdateBy: req.auth!.user.fullName,
      lastStageUpdatedAt: now,
      createdAt: now,
      updatedAt: now
    };

    const resLead = await cols.leads.insertOne(leadDoc);
    const lead = { ...leadDoc, id: resLead.insertedId.toString() };

    await AuditService.log({
      user: req.auth!.user,
      action: 'LEAD_CREATE',
      resourceType: 'LEAD',
      resourceId: lead.id,
      details: { companyName, contactName, assignedBdeEmail: finalAssignedEmail, hasSurveyIntelligence: Boolean(clientNeeds || proofLinks) }
    });

    SocketService.emitToTenant(tenantId, 'crm:lead_new', { lead });

    res.status(201).json({ data: lead });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/crm/leads/bulk-import (Excel / CSV bulk import with BDE assignment)
router.post('/leads/bulk-import', requireAuth, async (req: Request, res: Response) => {
  try {
    const { isCoreTeam, isBdm } = getReviewerTier(req.auth!.user);
    const isTopAdmin = req.auth!.user.roles.some((r) =>
      [RoleCode.COMPANY_ADMIN, RoleCode.SUPER_ADMIN].includes(r)
    ) || (req.auth!.user.email || '').toLowerCase() === 'lakshay@codrix.co.in';

    // Only Admin, BDM, and Core Team are authorized to bulk import and assign leads via Excel/CSV
    if (!isTopAdmin && !isCoreTeam && !isBdm) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Permission Denied: Only Admin, BDM, and Core Team members can bulk import and assign leads via Excel/CSV.'
        }
      });
      return;
    }

    const { leads, defaultBdeEmail, defaultBdeName } = req.body;
    if (!Array.isArray(leads) || leads.length === 0) {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'leads array is required and must not be empty' } });
      return;
    }

    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    // Cache employees to map emails to names & IDs
    const allEmployees = await cols.employees.find({ tenantId }).toArray();
    const empByEmail = new Map<string, any>();
    for (const emp of allEmployees) {
      if (emp.email) empByEmail.set(emp.email.toLowerCase().trim(), emp);
    }

    const validLeadsToInsert: any[] = [];
    const now = new Date();

    for (const item of leads) {
      const companyName = (item.companyName || item['Company Name'] || '').trim();
      const contactName = (item.contactName || item['Contact Name'] || item['Contact Person'] || '').trim();

      if (!companyName) continue;

      const targetBdeEmail = (item.assignedBdeEmail || item['Assigned BDE Email'] || defaultBdeEmail || '').toLowerCase().trim();
      const matchedEmp = targetBdeEmail ? empByEmail.get(targetBdeEmail) : null;
      const targetBdeName = (item.assignedBdeName || item['Assigned BDE Name'] || matchedEmp?.fullName || defaultBdeName || '').trim();

      const leadDoc = {
        tenantId,
        companyName,
        contactName: contactName || 'Primary Contact',
        email: (item.email || item['Contact Email'] || item['Email'] || '').trim(),
        phone: (item.phone || item['Contact Phone'] || item['Phone'] || '').trim(),
        source: (item.source || item['Source'] || 'EXCEL_IMPORT').trim(),
        serviceInterest: (item.serviceInterest || item['Service Interest'] || 'Enterprise Software & Development').trim(),
        priority: (item.priority || item['Priority'] || 'MEDIUM').toUpperCase().trim(),
        clientNeeds: (item.clientNeeds || item['Client Needs & Survey Intel'] || item['Client Needs'] || item.needSummary || '').trim(),
        codrixSolution: (item.codrixSolution || item['Codrix Solution Proposal'] || item['Codrix Solution'] || '').trim(),
        proofLinks: (item.proofLinks || item['Proof & Reference Links'] || item['Proof Links'] || '').trim(),
        researchPoints: (item.researchPoints || item['Research Points'] || '').trim(),
        flagStatus: 'PENDING',
        flagRemarks: '',
        flaggedBy: null,
        flaggedByEmail: null,
        flaggedByRole: null,
        flagTier: null,
        flaggedAt: null,
        createdByName: req.auth!.user.fullName,
        createdByEmail: req.auth!.user.email,
        createdByRole: req.auth!.user.roles[0] || 'ADMIN',
        createdByUserId: req.auth!.user.userId,
        assignedBdeEmail: targetBdeEmail || null,
        assignedBdeName: targetBdeName || null,
        assignedBdeId: matchedEmp ? matchedEmp._id.toString() : null,
        ownerEmployeeId: matchedEmp ? matchedEmp._id.toString() : null,
        stage: 'NEW',
        stageHistory: [
          {
            fromStage: 'IMPORT',
            toStage: 'NEW',
            notes: `Bulk imported via Excel by ${req.auth!.user.fullName} (${req.auth!.user.roles[0] || 'Admin'})` + (targetBdeName ? ` • Assigned to BDE: ${targetBdeName} (${targetBdeEmail})` : ''),
            updatedBy: req.auth!.user.fullName,
            updatedByEmail: req.auth!.user.email,
            updatedByRole: req.auth!.user.roles[0] || 'ADMIN',
            updatedAt: now
          }
        ],
        lastStageNote: `Lead imported from Excel and assigned to ${targetBdeName || 'BDE Pipeline'}`,
        lastStageUpdateBy: req.auth!.user.fullName,
        lastStageUpdatedAt: now,
        createdAt: now,
        updatedAt: now
      };

      validLeadsToInsert.push(leadDoc);
    }

    if (validLeadsToInsert.length === 0) {
      res.status(400).json({ error: { code: 'NO_VALID_LEADS', message: 'No valid leads with Company Name found in uploaded data.' } });
      return;
    }

    const insertResult = await cols.leads.insertMany(validLeadsToInsert);
    const insertedLeads = validLeadsToInsert.map((l, idx) => ({
      ...l,
      id: insertResult.insertedIds[idx].toString()
    }));

    await AuditService.log({
      tenantId,
      user: req.auth!.user,
      action: 'LEADS_BULK_IMPORT',
      resourceType: 'LEAD',
      resourceId: 'bulk',
      details: { count: insertedLeads.length, defaultBdeEmail }
    });

    SocketService.emitToTenant(tenantId, 'crm:leads_bulk_imported', {
      count: insertedLeads.length,
      importedBy: req.auth!.user.fullName
    });

    res.status(201).json({
      data: {
        count: insertedLeads.length,
        message: `Successfully imported and assigned ${insertedLeads.length} leads into the database.`,
        leads: insertedLeads
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/v1/crm/leads/:id/360 (Unified 360 profile for any lead)
router.get('/leads/:id/360', requireAuth, async (req: Request, res: Response) => {
  try {
    const leadId = req.params.id;
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    if (!ObjectId.isValid(leadId)) {
      res.status(400).json({ error: { code: 'INVALID_ID', message: 'Invalid lead ID format' } });
      return;
    }

    const lead = await cols.leads.findOne({ _id: new ObjectId(leadId), tenantId });
    if (!lead) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Lead not found in database' } });
      return;
    }

    // Check BDE isolation
    const { isCoreTeam, isBdm } = getReviewerTier(req.auth!.user);
    const isTopAdmin = req.auth!.user.roles.some((r) =>
      [RoleCode.COMPANY_ADMIN, RoleCode.SUPER_ADMIN].includes(r)
    ) || (req.auth!.user.email || '').toLowerCase() === 'lakshay@codrix.co.in';

    if (!isTopAdmin && !isCoreTeam && !isBdm) {
      const userEmail = (req.auth!.user.email || '').toLowerCase().trim();
      const userName = (req.auth!.user.fullName || '').toLowerCase().trim();
      const isCreator = (lead.createdByEmail || '').toLowerCase() === userEmail || (lead.createdByName || '').toLowerCase() === userName;
      const isAssigned = (lead.assignedBdeEmail || '').toLowerCase() === userEmail || (lead.assignedBdeName || '').toLowerCase() === userName;
      const isOwner = lead.ownerEmployeeId === req.auth!.user.employeeId;

      if (!isCreator && !isAssigned && !isOwner) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Access Restricted: You are only permitted to view 360 details for your own added or assigned leads.'
          }
        });
        return;
      }
    }

    // Fetch call activities
    const activities = await cols.callActivities.find({ leadId }).sort({ createdAt: -1 }).toArray();

    // Fetch linked customer if exists
    const customer = await cols.customers.findOne({ leadId });
    let projects: any[] = [];
    if (customer) {
      projects = await cols.projects.find({ customerId: customer._id.toString() }).toArray();
    }

    res.json({
      data: {
        lead: {
          ...lead,
          id: lead._id.toString(),
          activities: activities.map((a) => ({ ...a, id: a._id.toString() }))
        },
        customer: customer ? { ...customer, id: customer._id.toString() } : null,
        projects: projects.map((p) => ({ ...p, id: p._id.toString() }))
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// PATCH /api/v1/crm/leads/:id/flag (Core Team / BDM Red or Green flag quality verification)
router.patch('/leads/:id/flag', requireAuth, async (req: Request, res: Response) => {
  try {
    const leadId = req.params.id;
    const { flagStatus, flagRemarks } = req.body;
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    if (!['PENDING', 'GREEN_FLAG', 'RED_FLAG'].includes(flagStatus)) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: "flagStatus must be 'PENDING', 'GREEN_FLAG', or 'RED_FLAG'" } });
      return;
    }

    const { isReviewer, tier, isCoreTeam } = getReviewerTier(req.auth!.user);
    if (!isReviewer) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Permission Denied: Only Core Team members (Lakshay, Parth, Diya, Suryansh, Ishita, Anshuman) or BDMs are authorized to flag and review leads.'
        }
      });
      return;
    }

    const lead = await cols.leads.findOne({ _id: new ObjectId(leadId), tenantId });
    if (!lead) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Lead not found in database' } });
      return;
    }

    // STRICT HIERARCHY RULE:
    // Core team can update/override the decision of BDM.
    // BUT BDM cannot override or update a decision made by a Core Team member!
    if (lead.flagTier === 'CORE_TEAM' && !isCoreTeam) {
      res.status(403).json({
        error: {
          code: 'HIERARCHY_LOCKED',
          message: `Hierarchy Restriction: This lead was reviewed and flagged by Core Team member '${lead.flaggedBy || 'Core Leadership'}'. A BDM is not permitted to override or modify a Core Team decision.`
        }
      });
      return;
    }

    const updateFields = {
      flagStatus,
      flagRemarks: flagRemarks || '',
      flaggedBy: req.auth!.user.fullName,
      flaggedByEmail: req.auth!.user.email,
      flaggedByRole: req.auth!.user.roles[0] || (isCoreTeam ? 'CORE_TEAM' : 'BDM'),
      flagTier: isCoreTeam ? ('CORE_TEAM' as const) : ('BDM' as const),
      flaggedAt: new Date(),
      updatedAt: new Date()
    };

    await cols.leads.updateOne({ _id: new ObjectId(leadId) }, { $set: updateFields });

    await AuditService.log({
      tenantId,
      user: req.auth!.user,
      action: 'LEAD_FLAG_EVALUATION',
      resourceType: 'LEAD',
      resourceId: leadId,
      details: {
        flagStatus,
        flagRemarks: updateFields.flagRemarks,
        reviewerTier: updateFields.flagTier,
        reviewerName: req.auth!.user.fullName,
        leadCompany: lead.companyName
      }
    });

    SocketService.emitToTenant(tenantId, 'crm:lead_flag_updated', {
      leadId,
      ...updateFields
    });

    res.json({
      data: {
        id: leadId,
        ...updateFields,
        message: `Lead flagged as ${flagStatus} by ${req.auth!.user.fullName} (${isCoreTeam ? 'Core Team' : 'BDM'})`
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// PATCH /api/v1/crm/leads/:id/stage (Update lead stage with mandatory progression notes)
router.patch('/leads/:id/stage', requireAuth, async (req: Request, res: Response) => {
  try {
    const { stage, notes, stageNotes } = req.body;
    const leadId = req.params.id;
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    const lead = await cols.leads.findOne({ _id: new ObjectId(leadId), tenantId });
    if (!lead) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Lead not found in database' } });
      return;
    }

    const cleanNotes = (stageNotes || notes || '').trim();
    if (!cleanNotes) {
      res.status(400).json({
        error: {
          code: 'STAGE_NOTES_REQUIRED',
          message: 'Mandatory Stage Notes: You must provide detailed progress notes explaining the discussion, client feedback, or justification for updating this lead stage.'
        }
      });
      return;
    }

    // Check BDE Gatekeeping rule on closing stages:
    const { isCoreTeam, isBdm } = getReviewerTier(req.auth!.user);
    if (!isCoreTeam && !isBdm && ['PROPOSAL', 'NEGOTIATION', 'WON'].includes(stage)) {
      if (lead.flagStatus !== 'GREEN_FLAG') {
        res.status(403).json({
          error: {
            code: 'LEAD_NOT_CLEARED',
            message: `Closing Pipeline Blocked: Cannot advance lead '${lead.companyName}' to stage '${stage}' without a verified GREEN FLAG from Core Team or BDM.`
          }
        });
        return;
      }
    }

    const previousStage = lead.stage || 'NEW';
    const stageHistoryEntry = {
      fromStage: previousStage,
      toStage: stage,
      notes: cleanNotes,
      updatedBy: req.auth!.user.fullName,
      updatedByEmail: req.auth!.user.email,
      updatedByRole: req.auth!.user.roles[0] || (isCoreTeam ? 'CORE_TEAM' : isBdm ? 'BDM' : 'BDE'),
      updatedAt: new Date()
    };

    await cols.leads.updateOne(
      { _id: new ObjectId(leadId) },
      {
        $set: {
          stage,
          lastStageNote: cleanNotes,
          lastStageUpdateBy: req.auth!.user.fullName,
          lastStageUpdatedAt: new Date(),
          updatedAt: new Date()
        },
        $push: {
          stageHistory: stageHistoryEntry
        } as any
      }
    );

    // Record an activity entry in callActivities for 360 timeline & historical search
    await cols.callActivities.insertOne({
      tenantId,
      leadId,
      actorUserId: req.auth!.user.fullName,
      outcome: 'STAGE_PROGRESSION',
      summary: `[Stage Advanced: ${previousStage} ➔ ${stage}] ${cleanNotes}`,
      pitchFeedback: `Stage progression recorded by ${req.auth!.user.fullName} (${req.auth!.user.roles[0] || 'Team'})`,
      durationSeconds: 0,
      createdAt: new Date()
    });

    // If WON, auto create/convert Customer 360 record in MongoDB
    if (stage === 'WON') {
      const existing = await cols.customers.findOne({ leadId });
      if (!existing) {
        await cols.customers.insertOne({
          tenantId: lead.tenantId,
          leadId,
          companyName: lead.companyName,
          primaryContactName: lead.contactName,
          email: lead.email,
          phone: lead.phone,
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    await AuditService.log({
      tenantId,
      user: req.auth!.user,
      action: 'LEAD_STAGE_PROGRESSION',
      resourceType: 'LEAD',
      resourceId: leadId,
      details: {
        fromStage: previousStage,
        toStage: stage,
        notes: cleanNotes,
        updatedBy: req.auth!.user.fullName,
        leadCompany: lead.companyName
      }
    });

    SocketService.emitToTenant(tenantId, 'crm:lead_stage_changed', {
      leadId,
      stage,
      stageHistoryEntry
    });

    res.json({
      data: {
        id: leadId,
        stage,
        stageHistoryEntry,
        message: `Stage successfully updated from ${previousStage} to ${stage}`
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/crm/leads/:id/calls
router.post('/leads/:id/calls', requireAuth, requirePermission('crm', 'activities', 'create'), async (req: Request, res: Response) => {
  try {
    const { outcome, summary, pitchFeedback, durationSeconds, nextFollowUpAt } = req.body;
    const leadId = req.params.id;
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    // Check BDE Gatekeeping rule:
    // Non-Core Team & Non-BDM users (BDE, BDE Intern) must have a verified GREEN_FLAG before contacting / calling leads
    const { isCoreTeam, isBdm } = getReviewerTier(req.auth!.user);
    if (!isCoreTeam && !isBdm) {
      const lead = await cols.leads.findOne({ _id: new ObjectId(leadId), tenantId });
      if (!lead || lead.flagStatus !== 'GREEN_FLAG') {
        res.status(403).json({
          error: {
            code: 'LEAD_NOT_CLEARED',
            message: `Outreach Blocked: Lead '${lead?.companyName || leadId}' is currently ${lead?.flagStatus || 'PENDING'}. A Core Team member or BDM must verify the survey research and grant a GREEN FLAG before BDE outreach/calls can begin.`
          }
        });
        return;
      }
    }

    const actDoc = {
      tenantId,
      leadId,
      actorUserId: req.auth!.user.fullName,
      outcome: outcome || 'CONNECTED',
      summary,
      pitchFeedback,
      durationSeconds: Number(durationSeconds) || 120,
      createdAt: new Date()
    };
    const actRes = await cols.callActivities.insertOne(actDoc);

    if (nextFollowUpAt) {
      await cols.followUps.insertOne({
        tenantId,
        leadId,
        ownerEmployeeId: req.auth!.user.employeeId,
        dueAt: new Date(nextFollowUpAt),
        channel: 'CALL',
        status: 'PENDING',
        createdAt: new Date()
      });
    }

    await cols.leads.updateOne({ _id: new ObjectId(leadId) }, { $set: { updatedAt: new Date() } });

    const activityData = { ...actDoc, id: actRes.insertedId.toString() };
    SocketService.emitToTenant(tenantId, 'crm:activity_logged', { leadId, activity: activityData });

    res.status(201).json({ data: activityData });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/crm/leads/:id/notes (Add internal note / record management note to lead)
router.post('/leads/:id/notes', requireAuth, async (req: Request, res: Response) => {
  try {
    const { note } = req.body;
    const leadId = req.params.id;
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    if (!note || !note.trim()) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Note content is required' } });
      return;
    }

    const actDoc = {
      tenantId,
      leadId,
      actorUserId: req.auth!.user.fullName,
      outcome: 'NOTE_RECORD',
      summary: note,
      pitchFeedback: `Record Note created by ${req.auth!.user.fullName} (${req.auth!.user.roles[0] || 'Team'})`,
      durationSeconds: 0,
      createdAt: new Date()
    };
    const actRes = await cols.callActivities.insertOne(actDoc);
    await cols.leads.updateOne({ _id: new ObjectId(leadId) }, { $set: { updatedAt: new Date() } });

    const activityData = { ...actDoc, id: actRes.insertedId.toString() };
    SocketService.emitToTenant(tenantId, 'crm:activity_logged', { leadId, activity: activityData });

    res.status(201).json({ data: activityData });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/v1/crm/customers
router.get('/customers', requireAuth, async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const customers = await cols.customers.find({ tenantId: req.auth!.user.tenantId }).sort({ createdAt: -1 }).toArray();
    res.json({ data: customers.map((c) => ({ ...c, id: c._id.toString() })) });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/v1/crm/customers/:id/360
router.get('/customers/:id/360', requireAuth, async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const customer = await cols.customers.findOne({ _id: new ObjectId(req.params.id) });
    if (!customer) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Customer not found' } });
      return;
    }

    const lead = customer.leadId ? await cols.leads.findOne({ _id: new ObjectId(customer.leadId) }) : null;
    const activities = customer.leadId ? await cols.callActivities.find({ leadId: customer.leadId }).sort({ createdAt: -1 }).toArray() : [];
    const projects = await cols.projects.find({ customerId: req.params.id }).toArray();

    res.json({
      data: {
        ...customer,
        id: customer._id.toString(),
        lead: lead ? { ...lead, id: lead._id.toString(), activities } : null,
        projects: projects.map((p) => ({ ...p, id: p._id.toString() }))
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// DELETE /api/v1/crm/leads/:id (Lakshay Founder & Superadmin Single Delete)
router.delete('/leads/:id', requireAuth, requireLakshaySuperAdmin, async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;
    const leadId = req.params.id;

    if (!ObjectId.isValid(leadId)) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid lead ID format' } });
      return;
    }

    const lead = await cols.leads.findOne({ _id: new ObjectId(leadId), tenantId });
    if (!lead) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Lead not found' } });
      return;
    }

    await cols.leads.deleteOne({ _id: new ObjectId(leadId), tenantId });
    await cols.callActivities.deleteMany({ leadId, tenantId });

    await AuditService.log({
      tenantId,
      user: req.auth!.user,
      action: 'DELETE',
      resourceType: 'crm_lead',
      resourceId: leadId,
      ipAddress: req.ip || '127.0.0.1',
      details: { companyName: lead.companyName, contactName: lead.contactName }
    });

    SocketService.emitToTenant(tenantId, 'crm:lead_deleted', { leadId });

    res.json({ data: { success: true, message: `Lead '${lead.companyName}' deleted successfully` } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/crm/leads/batch-delete (Lakshay Founder & Superadmin Batch Delete)
router.post('/leads/batch-delete', requireAuth, requireLakshaySuperAdmin, async (req: Request, res: Response) => {
  try {
    const { leadIds } = req.body;
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'leadIds array is required' } });
      return;
    }

    const validObjectIds = leadIds.filter((id: string) => ObjectId.isValid(id)).map((id: string) => new ObjectId(id));
    if (validObjectIds.length === 0) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'No valid lead IDs provided' } });
      return;
    }

    const deleted = await cols.leads.deleteMany({ _id: { $in: validObjectIds }, tenantId });
    await cols.callActivities.deleteMany({ leadId: { $in: leadIds }, tenantId });

    await AuditService.log({
      tenantId,
      user: req.auth!.user,
      action: 'BATCH_DELETE',
      resourceType: 'crm_leads',
      resourceId: 'batch',
      ipAddress: req.ip || '127.0.0.1',
      details: { deletedCount: deleted.deletedCount, leadIds }
    });

    SocketService.emitToTenant(tenantId, 'crm:lead_deleted', { leadIds });

    res.json({ data: { success: true, count: deleted.deletedCount } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// DELETE /api/v1/crm/customers/:id (Lakshay Founder & Superadmin Customer Delete)
router.delete('/customers/:id', requireAuth, requireLakshaySuperAdmin, async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;
    const customerId = req.params.id;

    if (!ObjectId.isValid(customerId)) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid customer ID format' } });
      return;
    }

    const cust = await cols.customers.findOne({ _id: new ObjectId(customerId), tenantId });
    if (!cust) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Customer not found' } });
      return;
    }

    await cols.customers.deleteOne({ _id: new ObjectId(customerId), tenantId });

    await AuditService.log({
      tenantId,
      user: req.auth!.user,
      action: 'DELETE',
      resourceType: 'crm_customer',
      resourceId: customerId,
      ipAddress: req.ip || '127.0.0.1',
      details: { companyName: cust.companyName }
    });

    SocketService.emitToTenant(tenantId, 'crm:customer_deleted', { customerId });

    res.json({ data: { success: true, message: `Customer '${cust.companyName}' deleted successfully` } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

export default router;
