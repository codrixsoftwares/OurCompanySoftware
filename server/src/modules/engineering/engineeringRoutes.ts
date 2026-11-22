import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { getCollections } from '../../core/mongodb.js';
import { requireAuth, requirePermission, requireLakshaySuperAdmin } from '../../core/auth/middleware.js';
import { AuditService } from '../../core/audit/auditService.js';
import { SocketService } from '../../core/socket/socketService.js';

const router = Router();

// GET /api/v1/engineering/projects
router.get('/projects', requireAuth, async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;
    const projects = await cols.projects.find({ tenantId }).sort({ createdAt: 1 }).toArray();
    res.json({ data: projects.map((p) => ({ ...p, id: p._id.toString() })) });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/engineering/projects
router.post('/projects', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, customerId, description, startDate, targetEndDate } = req.body;
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    const count = await cols.projects.countDocuments({ tenantId });
    const projectCode = `PRJ-${(count + 1).toString().padStart(3, '0')}`;

    const prjDoc = {
      tenantId,
      projectCode,
      name,
      customerId,
      description,
      startDate: startDate ? new Date(startDate) : new Date(),
      targetEndDate: targetEndDate ? new Date(targetEndDate) : undefined,
      managerEmployeeId: req.auth!.user.employeeId,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const resPrj = await cols.projects.insertOne(prjDoc);
    const projectData = { ...prjDoc, id: resPrj.insertedId.toString() };

    SocketService.emitToTenant(tenantId, 'engineering:project_created', { project: projectData });

    res.status(201).json({ data: projectData });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/v1/engineering/team (List all assignable team members & employees)
router.get('/team', requireAuth, async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    // 1. Fetch employees
    const employees = await cols.employees.find({ tenantId }).toArray();
    // 2. Fetch users for email & display name resolution
    const users = await cols.users.find({ tenantId }).toArray();
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    // 3. Fallback team members if employees list is small
    const legacyTeam = await (cols.teamMembers || cols.teammembers)?.find({}).toArray() || [];

    const teamList: any[] = [];
    const seenNames = new Set<string>();

    for (const emp of employees) {
      const user = emp.userId ? userMap.get(emp.userId.toString()) : null;
      const name = emp.fullName || emp.name || user?.fullName || 'Employee';
      if (!seenNames.has(name.toLowerCase())) {
        seenNames.add(name.toLowerCase());
        teamList.push({
          id: emp._id.toString(),
          employeeCode: emp.employeeCode || 'CDX-EMP',
          name,
          email: user?.primaryEmail || `${name.toLowerCase().replace(/\s+/g, '.')}@codrix.co.in`,
          designation: emp.jobTitle || 'Team Member',
          department: emp.department || 'Engineering'
        });
      }
    }

    // Add any legacy team members not in employees
    for (const member of legacyTeam) {
      if (!seenNames.has(member.name.toLowerCase())) {
        seenNames.add(member.name.toLowerCase());
        teamList.push({
          id: member._id ? member._id.toString() : member.name,
          employeeCode: 'CDX-CORE',
          name: member.name,
          email: member.email || `${member.name.toLowerCase().replace(/\s+/g, '.')}@codrix.co.in`,
          designation: member.role || member.designation || 'Specialist',
          department: 'Core Leadership'
        });
      }
    }

    res.json({ data: teamList });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/v1/engineering/tasks
router.get('/tasks', requireAuth, async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    const [tasks, projects, employees] = await Promise.all([
      cols.tasks.find({ tenantId }).sort({ updatedAt: -1 }).toArray(),
      cols.projects.find({ tenantId }).toArray(),
      cols.employees.find({ tenantId }).toArray()
    ]);

    const projectMap = new Map(projects.map((p) => [p._id.toString(), p]));
    const employeeMap = new Map(employees.map((e) => [e._id.toString(), e]));

    const enrichedTasks = tasks.map((t: any) => {
      const prj = t.projectId ? projectMap.get(t.projectId.toString()) : null;
      const emp = t.assigneeEmployeeId ? employeeMap.get(t.assigneeEmployeeId.toString()) : null;

      const assigneeName = t.assigneeName || emp?.fullName || emp?.name || 'Unassigned';
      const assigneeRole = t.assigneeRole || emp?.jobTitle || 'Engineer';

      return {
        ...t,
        id: t._id.toString(),
        assigneeName,
        assigneeRole,
        assignedBy: t.assignedBy || '',
        sprintName: t.sprintName || '',
        taskType: t.taskType || 'FEATURE',
        project: {
          id: prj ? prj._id.toString() : t.projectId,
          name: prj?.name || '',
          projectCode: prj?.projectCode || ''
        },
        assigneeEmployee: {
          membership: {
            user: {
              fullName: assigneeName
            }
          }
        }
      };
    });

    res.json({ data: enrichedTasks });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/engineering/tasks (Lakshay / Founder assigns work to everyone)
router.post('/tasks', requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      projectId,
      title,
      description,
      priority,
      estimateHours,
      assigneeEmployeeId,
      sprintName,
      dueDate,
      taskType
    } = req.body;
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    const count = await cols.tasks.countDocuments({ tenantId });
    const taskCode = `TSK-${(count + 1).toString().padStart(4, '0')}`;

    // Resolve assignee information
    let targetAssigneeName = 'Unassigned';
    let targetAssigneeRole = 'Engineer';
    let targetAssigneeId = assigneeEmployeeId;

    if (assigneeEmployeeId) {
      // Check employee record
      let emp = null;
      try {
        emp = await cols.employees.findOne({ _id: new ObjectId(assigneeEmployeeId) });
      } catch {}
      if (!emp) {
        emp = await cols.employees.findOne({
          $or: [
            { employeeCode: assigneeEmployeeId },
            { fullName: new RegExp(`^${assigneeEmployeeId}$`, 'i') },
            { name: new RegExp(`^${assigneeEmployeeId}$`, 'i') }
          ]
        });
      }

      if (emp) {
        targetAssigneeName = emp.fullName || emp.name;
        targetAssigneeRole = emp.jobTitle || 'Engineer';
        targetAssigneeId = emp._id.toString();
      } else {
        // Fallback to legacy team member or direct name
        const orConditions: any[] = [
          { name: new RegExp(`^${assigneeEmployeeId}$`, 'i') }
        ];
        if (ObjectId.isValid(assigneeEmployeeId)) {
          orConditions.push({ _id: new ObjectId(assigneeEmployeeId) });
        }
        const member = await (cols.teamMembers || cols.teammembers)?.findOne({ $or: orConditions });
        if (member) {
          targetAssigneeName = member.name;
          targetAssigneeRole = member.role || member.designation || 'Specialist';
        } else {
          targetAssigneeName = assigneeEmployeeId;
        }
      }
    } else {
      // Default to the creator if not specified
      targetAssigneeId = req.auth!.user.employeeId;
      targetAssigneeName = req.auth!.user.fullName;
      targetAssigneeRole = req.auth!.user.roles[0] || 'Founder';
    }

    const taskDoc = {
      tenantId,
      projectId: projectId || '',
      taskCode,
      title,
      description: description || '',
      priority: priority || 'MEDIUM',
      estimateHours: Number(estimateHours) || 4,
      status: 'TODO',
      assigneeEmployeeId: targetAssigneeId,
      assigneeName: targetAssigneeName,
      assigneeRole: targetAssigneeRole,
      assignedBy: req.auth!.user.fullName || '',
      assignedById: req.auth!.user.userId,
      assignedByRole: req.auth!.user.roles[0] || 'COMPANY_ADMIN',
      sprintName: sprintName || '',
      taskType: taskType || 'FEATURE',
      dueDate: dueDate ? new Date(dueDate) : undefined,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const resTask = await cols.tasks.insertOne(taskDoc);
    const taskData = { ...taskDoc, id: resTask.insertedId.toString() };

    await AuditService.log({
      user: req.auth!.user,
      action: 'TASK_CREATE',
      resourceType: 'TASK',
      resourceId: taskData.id,
      details: { title, assigneeName: targetAssigneeName, priority }
    });

    SocketService.emitToTenant(tenantId, 'engineering:task_created', { task: taskData });

    res.status(201).json({ data: taskData });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// PATCH /api/v1/engineering/tasks/:id/assignee (Reassign task to any team member)
router.patch('/tasks/:id/assignee', requireAuth, async (req: Request, res: Response) => {
  try {
    const { assigneeEmployeeId, assigneeName } = req.body;
    const taskId = req.params.id;
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    let targetName = assigneeName;
    let targetRole = 'Engineer';

    if (assigneeEmployeeId) {
      let emp = null;
      try {
        emp = await cols.employees.findOne({ _id: new ObjectId(assigneeEmployeeId) });
      } catch {}
      if (!emp) {
        emp = await cols.employees.findOne({
          $or: [
            { employeeCode: assigneeEmployeeId },
            { fullName: new RegExp(`^${assigneeEmployeeId}$`, 'i') },
            { name: new RegExp(`^${assigneeEmployeeId}$`, 'i') }
          ]
        });
      }
      if (emp) {
        targetName = emp.fullName || emp.name;
        targetRole = emp.jobTitle || 'Engineer';
      }
    }

    await cols.tasks.updateOne(
      { _id: new ObjectId(taskId) },
      {
        $set: {
          assigneeEmployeeId,
          assigneeName: targetName,
          assigneeRole: targetRole,
          assignedBy: req.auth!.user.fullName,
          updatedAt: new Date()
        }
      }
    );

    SocketService.emitToTenant(tenantId, 'engineering:task_reassigned', {
      taskId,
      assigneeEmployeeId,
      assigneeName: targetName,
      assigneeRole: targetRole,
      assignedBy: req.auth!.user.fullName
    });

    res.json({
      data: {
        id: taskId,
        assigneeEmployeeId,
        assigneeName: targetName,
        assigneeRole: targetRole,
        assignedBy: req.auth!.user.fullName
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// PATCH /api/v1/engineering/tasks/:id/status
router.patch('/tasks/:id/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const taskId = req.params.id;
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    await cols.tasks.updateOne(
      { _id: new ObjectId(taskId) },
      { $set: { status, updatedAt: new Date() } }
    );

    await cols.taskStatusHistory.insertOne({
      taskId,
      status,
      actorUserId: req.auth!.user.fullName,
      timestamp: new Date()
    });

    SocketService.emitToTenant(tenantId, 'engineering:task_status_changed', { taskId, status });

    res.json({ data: { id: taskId, status } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// DELETE /api/v1/engineering/tasks/:id (Founder & Superadmin Delete Task Only)
router.delete('/tasks/:id', requireAuth, requireLakshaySuperAdmin, async (req: Request, res: Response) => {
  try {
    const taskId = req.params.id;
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    await cols.tasks.deleteOne({ _id: new ObjectId(taskId), tenantId });
    SocketService.emitToTenant(tenantId, 'engineering:task_deleted', { taskId });

    res.json({ data: { success: true, message: 'Task deleted successfully' } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/engineering/tasks/batch-delete (Founder & Superadmin Batch Delete Tasks)
router.post('/tasks/batch-delete', requireAuth, requireLakshaySuperAdmin, async (req: Request, res: Response) => {
  try {
    const { taskIds } = req.body;
    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'taskIds array is required' } });
      return;
    }

    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    const objectIds = taskIds
      .map((id: string) => {
        try {
          return new ObjectId(id);
        } catch {
          return null;
        }
      })
      .filter((id): id is ObjectId => id !== null);

    await cols.tasks.deleteMany({
      tenantId,
      $or: [
        { _id: { $in: objectIds } },
        { taskCode: { $in: taskIds } }
      ]
    });

    SocketService.emitToTenant(tenantId, 'engineering:tasks_batch_deleted', { taskIds });

    res.json({ data: { success: true, count: taskIds.length } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// DELETE /api/v1/engineering/projects/:id (Founder & Superadmin Delete Project)
router.delete('/projects/:id', requireAuth, requireLakshaySuperAdmin, async (req: Request, res: Response) => {
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
    // Also clean up or unassign tasks linked to this project
    await cols.tasks.deleteMany({ projectId: prj._id.toString(), tenantId });

    SocketService.emitToTenant(tenantId, 'engineering:project_deleted', { projectId: prj._id.toString() });

    res.json({ data: { success: true, message: 'Project and linked tasks deleted.' } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/v1/engineering/daily-updates/today (Check if logged-in user has submitted today's standup)
router.get('/daily-updates/today', requireAuth, async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;
    const fullName = req.auth!.user.fullName;
    const employeeId = req.auth!.user.employeeId;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const orClauses: any[] = [
      { employeeName: new RegExp(`^${fullName}$`, 'i') }
    ];
    if (employeeId) {
      orClauses.push({ employeeId });
    }

    const update = await cols.dailyUpdates.findOne({
      tenantId,
      $or: orClauses,
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    res.json({
      data: {
        submitted: !!update,
        update: update ? { ...update, id: update._id.toString() } : null
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET & POST /api/v1/engineering/daily-updates
router.get('/daily-updates', requireAuth, async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const updates = await cols.dailyUpdates.find({ tenantId: req.auth!.user.tenantId }).sort({ date: -1 }).toArray();
    res.json({ data: updates.map((u) => ({ ...u, id: u._id.toString() })) });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/daily-updates', requireAuth, async (req: Request, res: Response) => {
  try {
    const { completedItems, inProgressItems, blockers, nextDayPlan, projectId, projectName } = req.body;
    const cols = getCollections();

    let targetProjectName = projectName;
    if (projectId && !targetProjectName) {
      try {
        const proj = await cols.projects.findOne({ _id: new ObjectId(projectId) });
        if (proj) targetProjectName = proj.name;
      } catch {}
    }

    const updateDoc = {
      tenantId: req.auth!.user.tenantId,
      employeeId: req.auth!.user.employeeId,
      employeeName: req.auth!.user.fullName,
      projectId: projectId || null,
      projectName: targetProjectName || 'General Engineering Sprint',
      date: new Date(),
      completedItems,
      inProgressItems,
      blockers: blockers || '',
      nextDayPlan: nextDayPlan || '',
      createdAt: new Date()
    };
    const resUpd = await cols.dailyUpdates.insertOne(updateDoc);
    const updateData = { ...updateDoc, id: resUpd.insertedId.toString() };

    SocketService.emitToTenant(req.auth!.user.tenantId, 'engineering:standup_logged', { update: updateData });

    res.status(201).json({ data: updateData });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

export default router;
