import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { getCollections } from '../../core/mongodb.js';
import { requireAuth, requireLakshaySuperAdmin } from '../../core/auth/middleware.js';
import { AuditService } from '../../core/audit/auditService.js';
import { RoleCode } from '../../core/auth/types.js';
import { SocketService } from '../../core/socket/socketService.js';
import { getReviewerTier } from '../crm/crmRoutes.js';

const router = Router();

// Helper to check if user is Core Team or Admin
function isUserCoreTeamOrAdmin(user: any): boolean {
  const { isCoreTeam, isBdm } = getReviewerTier(user);
  const isTopAdmin =
    (user.roles || []).some((r: string) => [RoleCode.COMPANY_ADMIN, RoleCode.SUPER_ADMIN].includes(r as any)) ||
    (user.email || '').toLowerCase() === 'lakshay@codrix.co.in';

  return Boolean(isTopAdmin || isCoreTeam || isBdm);
}

// GET /api/v1/projects (Core Team & Superadmin Only)
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.auth!.user;
    if (!isUserCoreTeamOrAdmin(user)) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Access Restricted: The Projects portfolio is restricted to Core Team leadership and Superadmin.'
        }
      });
      return;
    }

    const cols = getCollections();
    const tenantId = user.tenantId;

    const [projects, tasks, employees, customers] = await Promise.all([
      cols.projects.find({ tenantId }).sort({ createdAt: -1 }).toArray(),
      cols.tasks.find({ tenantId }).toArray(),
      cols.employees.find({ tenantId }).toArray(),
      cols.customers.find({ tenantId }).toArray()
    ]);

    const employeeMap = new Map<string, any>();
    for (const e of employees) {
      employeeMap.set(e._id.toString(), e);
      if (e.fullName) employeeMap.set(e.fullName.toLowerCase(), e);
    }

    const customerMap = new Map<string, any>();
    for (const c of customers) {
      customerMap.set(c._id.toString(), c);
      if (c.leadId) customerMap.set(c.leadId.toString(), c);
    }

    // Aggregate tasks by project ID
    const tasksByProject = new Map<string, any[]>();
    for (const t of tasks) {
      const pId = t.projectId?.toString();
      if (pId) {
        if (!tasksByProject.has(pId)) tasksByProject.set(pId, []);
        tasksByProject.get(pId)!.push(t);
      }
    }

    const enriched = projects.map((p) => {
      const pId = p._id.toString();
      const pTasks = tasksByProject.get(pId) || [];
      const totalTasks = pTasks.length;
      const completedTasks = pTasks.filter((t) => t.status === 'DONE').length;
      const inProgressTasks = pTasks.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'REVIEW').length;
      const openBugs = pTasks.filter((t) => t.type === 'BUG' && t.status !== 'DONE').length;
      const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      const matchedCust = p.customerId ? customerMap.get(p.customerId.toString()) : null;
      const matchedLead = p.leadEngineerId ? employeeMap.get(p.leadEngineerId.toString()) : null;

      return {
        ...p,
        id: pId,
        customerName: p.customerName || matchedCust?.companyName || '',
        customerContact: matchedCust?.primaryContactName || null,
        leadEngineerName: p.leadEngineerName || matchedLead?.fullName || '',
        totalTasks,
        completedTasks,
        inProgressTasks,
        openBugs,
        progressPercent,
        taskStats: {
          total: totalTasks,
          completed: completedTasks,
          inProgress: inProgressTasks,
          openBugs,
          progressPercentage: progressPercent
        },
        repositoryUrl: p.repoUrl || p.repositoryUrl || '',
        techStack: Array.isArray(p.techStack)
          ? p.techStack
          : typeof p.techStack === 'string' && p.techStack.trim()
          ? p.techStack.split(',').map((s: string) => s.trim())
          : [],
        budget: p.budget || '',
        status: p.status || 'ACTIVE',
        priority: p.priority || 'MEDIUM'
      };
    });

    res.json({ data: enriched });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/v1/projects/:id (Project 360 View)
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.auth!.user;
    if (!isUserCoreTeamOrAdmin(user)) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Access Restricted: The Projects portfolio is restricted to Core Team leadership and Superadmin.'
        }
      });
      return;
    }

    const projectId = req.params.id;
    const cols = getCollections();
    const tenantId = user.tenantId;

    let query: any = { tenantId };
    try {
      query._id = new ObjectId(projectId);
    } catch {
      query.projectCode = projectId;
    }

    const project = await cols.projects.findOne(query);
    if (!project) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found' } });
      return;
    }

    const pId = project._id.toString();
    const [tasks, customer] = await Promise.all([
      cols.tasks.find({ tenantId, projectId: pId }).sort({ updatedAt: -1 }).toArray(),
      project.customerId ? cols.customers.findOne({ _id: new ObjectId(project.customerId) }) : null
    ]);

    res.json({
      data: {
        ...project,
        id: pId,
        customer: customer ? { ...customer, id: customer._id.toString() } : null,
        tasks: tasks.map((t) => ({ ...t, id: t._id.toString() }))
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/projects (Create New Project)
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.auth!.user;
    if (!isUserCoreTeamOrAdmin(user)) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Permission Denied: Only Core Team members and Superadmin can create projects.'
        }
      });
      return;
    }

    const {
      name,
      projectCode,
      customerId,
      customerName,
      description,
      status,
      priority,
      leadEngineerId,
      leadEngineerName,
      techStack,
      repoUrl,
      liveUrl,
      budget,
      startDate,
      targetEndDate
    } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Project Name is required.' } });
      return;
    }

    const cols = getCollections();
    const tenantId = user.tenantId;

    let finalProjectCode = (projectCode || '').trim().toUpperCase();
    if (!finalProjectCode) {
      const count = await cols.projects.countDocuments({ tenantId });
      finalProjectCode = `CDX-PRJ-${(count + 1).toString().padStart(3, '0')}`;
    }

    const now = new Date();
    const prjDoc = {
      tenantId,
      projectCode: finalProjectCode,
      name: name.trim(),
      customerId: customerId || null,
      customerName: customerName?.trim() || '',
      description: description?.trim() || '',
      status: status || 'ACTIVE',
      priority: priority || 'MEDIUM',
      leadEngineerId: leadEngineerId || null,
      leadEngineerName: leadEngineerName?.trim() || '',
      techStack: Array.isArray(techStack)
        ? techStack
        : typeof techStack === 'string' && techStack.trim()
        ? techStack.split(',').map((s: string) => s.trim())
        : [],
      repoUrl: (repoUrl || (req.body as any).repositoryUrl)?.toString().trim() || '',
      liveUrl: liveUrl?.toString().trim() || '',
      budget: budget !== undefined && budget !== null && String(budget).trim() !== '' ? String(budget).trim() : '',
      startDate: startDate ? new Date(startDate) : now,
      targetEndDate: targetEndDate ? new Date(targetEndDate) : undefined,
      createdBy: user.fullName,
      createdByEmail: user.email,
      createdAt: now,
      updatedAt: now
    };

    const insertRes = await cols.projects.insertOne(prjDoc);
    const newProject = { ...prjDoc, id: insertRes.insertedId.toString() };

    await AuditService.log({
      tenantId,
      user,
      action: 'PROJECT_CREATE',
      resourceType: 'PROJECT',
      resourceId: newProject.id,
      details: { projectCode: finalProjectCode, name: prjDoc.name }
    });

    SocketService.emitToTenant(tenantId, 'projects:project_created', { project: newProject });
    SocketService.emitToTenant(tenantId, 'engineering:project_created', { project: newProject });

    res.status(201).json({ data: newProject });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// PUT /api/v1/projects/:id (Superadmin & Core Team Update Project)
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.auth!.user;
    if (!isUserCoreTeamOrAdmin(user)) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Permission Denied: Only Core Team members and Superadmin can modify projects.'
        }
      });
      return;
    }

    const projectId = req.params.id;
    const cols = getCollections();
    const tenantId = user.tenantId;

    let query: any = { tenantId };
    try {
      query._id = new ObjectId(projectId);
    } catch {
      query.projectCode = projectId;
    }

    const existing = await cols.projects.findOne(query);
    if (!existing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found.' } });
      return;
    }

    const {
      name,
      projectCode,
      customerId,
      customerName,
      description,
      status,
      priority,
      leadEngineerId,
      leadEngineerName,
      techStack,
      repoUrl,
      liveUrl,
      budget,
      startDate,
      targetEndDate
    } = req.body;

    const updateFields: any = {
      updatedAt: new Date()
    };
    if (name) updateFields.name = name.trim();
    if (projectCode) updateFields.projectCode = projectCode.trim().toUpperCase();
    if (customerId !== undefined) updateFields.customerId = customerId;
    if (customerName !== undefined) updateFields.customerName = customerName.trim();
    if (description !== undefined) updateFields.description = description.trim();
    if (status) updateFields.status = status;
    if (priority) updateFields.priority = priority;
    if (leadEngineerId !== undefined) updateFields.leadEngineerId = leadEngineerId;
    if (leadEngineerName !== undefined) updateFields.leadEngineerName = leadEngineerName.trim();
    if (techStack !== undefined) {
      updateFields.techStack = Array.isArray(techStack)
        ? techStack
        : typeof techStack === 'string'
        ? techStack.split(',').map((s: string) => s.trim())
        : existing.techStack;
    }
    const gitUrl = repoUrl !== undefined ? repoUrl : (req.body as any).repositoryUrl;
    if (gitUrl !== undefined) updateFields.repoUrl = String(gitUrl).trim();
    if (liveUrl !== undefined) updateFields.liveUrl = String(liveUrl).trim();
    if (budget !== undefined) updateFields.budget = String(budget).trim();
    if (startDate) updateFields.startDate = new Date(startDate);
    if (targetEndDate) updateFields.targetEndDate = new Date(targetEndDate);

    await cols.projects.updateOne({ _id: existing._id }, { $set: updateFields });

    await AuditService.log({
      tenantId,
      user,
      action: 'PROJECT_UPDATE',
      resourceType: 'PROJECT',
      resourceId: existing._id.toString(),
      details: { projectCode: existing.projectCode, updatedFields: Object.keys(updateFields) }
    });

    const updated = await cols.projects.findOne({ _id: existing._id });
    const formatted = { ...updated, id: updated?._id?.toString() };

    SocketService.emitToTenant(tenantId, 'projects:project_updated', { project: formatted });
    SocketService.emitToTenant(tenantId, 'engineering:project_updated', { project: formatted });

    res.json({ data: formatted });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// DELETE /api/v1/projects/:id (Superadmin Lakshay Only Delete)
router.delete('/:id', requireAuth, requireLakshaySuperAdmin, async (req: Request, res: Response) => {
  try {
    const projectId = req.params.id;
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    let query: any = { tenantId };
    try {
      query._id = new ObjectId(projectId);
    } catch {
      query.projectCode = projectId;
    }

    const prj = await cols.projects.findOne(query);
    if (!prj) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found' } });
      return;
    }

    await cols.projects.deleteOne({ _id: prj._id });
    // Also clean up linked tasks
    await cols.tasks.deleteMany({ projectId: prj._id.toString(), tenantId });

    await AuditService.log({
      tenantId,
      user: req.auth!.user,
      action: 'PROJECT_DELETE',
      resourceType: 'PROJECT',
      resourceId: prj._id.toString(),
      details: { projectCode: prj.projectCode, name: prj.name }
    });

    SocketService.emitToTenant(tenantId, 'projects:project_deleted', { projectId: prj._id.toString() });
    SocketService.emitToTenant(tenantId, 'engineering:project_deleted', { projectId: prj._id.toString() });

    res.json({ data: { success: true, message: `Project '${prj.name}' deleted successfully.` } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/projects/batch-delete (Superadmin Lakshay Batch Delete)
router.post('/batch-delete', requireAuth, requireLakshaySuperAdmin, async (req: Request, res: Response) => {
  try {
    const { projectIds } = req.body;
    if (!Array.isArray(projectIds) || projectIds.length === 0) {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'projectIds array is required' } });
      return;
    }

    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    const objectIds = projectIds
      .map((id: string) => {
        try {
          return new ObjectId(id);
        } catch {
          return null;
        }
      })
      .filter((id): id is ObjectId => id !== null);

    const deleted = await cols.projects.deleteMany({
      tenantId,
      _id: { $in: objectIds }
    });

    // Clean up tasks
    await cols.tasks.deleteMany({
      tenantId,
      projectId: { $in: projectIds }
    });

    await AuditService.log({
      tenantId,
      user: req.auth!.user,
      action: 'PROJECTS_BATCH_DELETE',
      resourceType: 'PROJECT',
      resourceId: 'batch',
      details: { count: deleted.deletedCount, projectIds }
    });

    SocketService.emitToTenant(tenantId, 'projects:batch_deleted', { projectIds });
    SocketService.emitToTenant(tenantId, 'engineering:project_deleted', { projectIds });

    res.json({ data: { success: true, count: deleted.deletedCount } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

export default router;
