import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { getCollections } from '../../core/mongodb.js';
import { requireAuth, requirePermission, requireLakshaySuperAdmin } from '../../core/auth/middleware.js';
import { AuditService } from '../../core/audit/auditService.js';
import { RoleCode } from '../../core/auth/types.js';
import { SocketService } from '../../core/socket/socketService.js';

const router = Router();

// GET /api/v1/hrms/employees (Enriched with all database fields, roles, shifts, today's attendance)
router.get('/employees', requireAuth, async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;
    const employees = await cols.employees.find({ tenantId }).sort({ employeeCode: 1 }).toArray();

    // Fetch users, memberships, and today's attendance records to enrich staff profile
    const todayDate = new Date().toISOString().split('T')[0];
    const [users, memberships, todayAttendance] = await Promise.all([
      cols.users.find({ tenantId }).toArray(),
      cols.memberships.find({ tenantId }).toArray(),
      cols.attendanceRecords.find({ tenantId, date: todayDate }).toArray()
    ]);

    const userMap = new Map<string, any>();
    for (const u of users) {
      userMap.set(u._id.toString(), u);
    }

    const membershipMap = new Map<string, any>();
    for (const m of memberships) {
      if (m.userId) membershipMap.set(m.userId.toString(), m);
      membershipMap.set(m._id.toString(), m);
    }

    const attendanceMap = new Map<string, any>();
    for (const a of todayAttendance) {
      attendanceMap.set(a.employeeId?.toString(), a);
    }

    const enriched = employees.map((e) => {
      const u = e.userId ? userMap.get(e.userId.toString()) : null;
      const mem =
        (e.userId ? membershipMap.get(e.userId.toString()) : null) ||
        (e.membershipId ? membershipMap.get(e.membershipId.toString()) : null);
      const att = attendanceMap.get(e._id.toString());

      const fullName = e.fullName || u?.fullName || 'Staff Member';
      const email = e.email || u?.primaryEmail || '';
      const phone = e.phone || u?.phone || '';
      const roleCode = e.roleCode || (mem?.roles && mem.roles[0]) || 'EMPLOYEE';
      const department =
        e.department ||
        (roleCode === 'COMPANY_ADMIN'
          ? 'Executive & Strategy'
          : roleCode === 'HR_MANAGER' || roleCode === 'HR_EXEC'
          ? 'People & HR'
          : roleCode === 'GROWTH_OFFICER' || roleCode === 'BDM' || roleCode === 'BDE'
          ? 'Growth & Partnerships'
          : roleCode === 'SDE1' || roleCode === 'SDE2' || roleCode === 'ENGINEERING_LEAD'
          ? 'Engineering & Tech'
          : roleCode === 'BRANCH_MANAGER' || roleCode === 'OPS_MANAGER'
          ? 'Operations & Governance'
          : 'General Operations');
      const shift = e.shift || 'Hybrid Shift • IST';
      const salary =
        e.salary ||
        (roleCode === 'COMPANY_ADMIN'
          ? '₹36,00,000 / yr'
          : roleCode === 'GROWTH_OFFICER' || roleCode === 'ENGINEERING_LEAD'
          ? '₹24,00,000 / yr'
          : roleCode === 'HR_MANAGER' || roleCode === 'BDM' || roleCode === 'SDE2'
          ? '₹18,00,000 / yr'
          : roleCode === 'SDE1' || roleCode === 'BDE'
          ? '₹9,50,000 / yr'
          : '₹6,00,000 / yr');

      return {
        ...e,
        id: e._id.toString(),
        fullName,
        email,
        phone,
        department,
        roleCode,
        shift,
        salary,
        reportingManagerName: e.reportingManagerName || 'Lakshay (Founder & MD)',
        todayAttendance: att
          ? {
              status: att.status || 'PRESENT',
              checkInTime: att.checkInTime,
              checkOutTime: att.checkOutTime
            }
          : null,
        membership: {
          roles: mem?.roles || [roleCode],
          user: {
            fullName,
            primaryEmail: email,
            phone
          }
        }
      };
    });

    res.json({ data: enriched });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/v1/hrms/employees/:id (Detailed 360 View of a Staff Member)
router.get('/employees/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const employeeId = req.params.id;
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    let query: any = { tenantId };
    try {
      query._id = new ObjectId(employeeId);
    } catch {
      query.employeeCode = employeeId;
    }

    const employee = await cols.employees.findOne(query);
    if (!employee) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Employee not found' } });
      return;
    }

    const [user, membership, recentAttendance, balances] = await Promise.all([
      employee.userId ? cols.users.findOne({ _id: new ObjectId(employee.userId) }) : null,
      employee.userId ? cols.memberships.findOne({ userId: employee.userId }) : null,
      cols.attendanceRecords.find({ employeeId: employee._id.toString() }).sort({ date: -1 }).limit(10).toArray(),
      cols.leaveBalances.find({ employeeId: employee._id.toString() }).toArray()
    ]);

    res.json({
      data: {
        ...employee,
        id: employee._id.toString(),
        user: user ? { ...user, id: user._id.toString(), passwordHash: undefined } : null,
        membership: membership ? { ...membership, id: membership._id.toString() } : null,
        recentAttendance: recentAttendance.map((a: any) => ({ ...a, id: a._id.toString() })),
        leaveBalances: balances.map((b: any) => ({ ...b, id: b._id.toString() }))
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/hrms/employees (Founder Lakshay Creates New Staff Member)
router.post('/employees', requireAuth, requireLakshaySuperAdmin, async (req: Request, res: Response) => {
  try {
    const {
      fullName,
      email,
      personalEmail,
      phone,
      jobTitle,
      department,
      roleCode,
      employeeCode,
      reportingManagerName,
      salary,
      shift,
      employmentStatus,
      password
    } = req.body;

    if (!fullName || !email) {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Full name and email are required.' } });
      return;
    }

    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    // Check existing email
    const existingUser = await cols.users.findOne({ tenantId, primaryEmail: email.toLowerCase().trim() });
    if (existingUser) {
      res.status(409).json({ error: { code: 'USER_EXISTS', message: `User with email ${email} already exists.` } });
      return;
    }

    // Auto-generate employee code if missing
    let finalEmpCode = employeeCode?.trim();
    if (!finalEmpCode) {
      const count = await cols.employees.countDocuments({ tenantId });
      finalEmpCode = `CDX-${(count + 1).toString().padStart(3, '0')}`;
    }

    const rawPassword = password?.trim() || 'Codrix@2026';
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    // 1. Create User
    const userRes = await cols.users.insertOne({
      tenantId,
      primaryEmail: email.toLowerCase().trim(),
      fullName: fullName.trim(),
      phone: phone?.trim() || '',
      passwordHash,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const userId = userRes.insertedId.toString();

    // 2. Create Membership
    const memRes = await cols.memberships.insertOne({
      tenantId,
      userId,
      roles: [roleCode || 'EMPLOYEE'],
      status: 'ACTIVE',
      joinedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const membershipId = memRes.insertedId.toString();

    // 3. Create Employee document
    const empDoc = {
      tenantId,
      userId,
      membershipId,
      employeeCode: finalEmpCode,
      fullName: fullName.trim(),
      email: email.toLowerCase().trim(),
      personalEmail: personalEmail?.trim() || '',
      phone: phone?.trim() || '',
      jobTitle: jobTitle?.trim() || 'Team Member',
      department: department?.trim() || 'General Operations',
      roleCode: roleCode || 'EMPLOYEE',
      reportingManagerName: reportingManagerName?.trim() || 'Lakshay (Founder & MD)',
      salary: salary?.trim() || '₹8,50,000 / yr',
      shift: shift?.trim() || 'Hybrid Shift • IST',
      employmentStatus: employmentStatus || 'ACTIVE',
      joinedOn: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const empRes = await cols.employees.insertOne(empDoc);
    const employeeId = empRes.insertedId.toString();

    // 4. Provision default leave balances
    const leaveTypes = await cols.leaveTypes.find({ tenantId }).toArray();
    for (const lt of leaveTypes) {
      await cols.leaveBalances.insertOne({
        tenantId,
        employeeId,
        leaveTypeId: lt._id.toString(),
        year: new Date().getFullYear(),
        totalDays: lt.daysAllowed || 12,
        usedDays: 0,
        pendingDays: 0,
        createdAt: new Date()
      });
    }

    await AuditService.log({
      user: req.auth!.user,
      action: 'EMPLOYEE_CREATE',
      resourceType: 'EMPLOYEE',
      resourceId: employeeId,
      details: { employeeCode: finalEmpCode, fullName, email, roleCode }
    });

    const newEmpData = {
      ...empDoc,
      id: employeeId,
      membership: { user: { fullName, primaryEmail: email } }
    };
    SocketService.emitToTenant(tenantId, 'hrms:employee_created', { employee: newEmpData });

    res.status(201).json({ data: newEmpData });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// PUT /api/v1/hrms/employees/:id (Founder Lakshay Updates / Modifies Staff Member)
router.put('/employees/:id', requireAuth, requireLakshaySuperAdmin, async (req: Request, res: Response) => {
  try {
    const employeeId = req.params.id;
    const {
      fullName,
      email,
      personalEmail,
      phone,
      jobTitle,
      department,
      roleCode,
      employeeCode,
      reportingManagerName,
      salary,
      shift,
      employmentStatus,
      password
    } = req.body;

    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    let query: any = { tenantId };
    try {
      query._id = new ObjectId(employeeId);
    } catch {
      query.employeeCode = employeeId;
    }

    const existingEmp = await cols.employees.findOne(query);
    if (!existingEmp) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Employee not found.' } });
      return;
    }

    const updateFields: any = {
      updatedAt: new Date()
    };
    if (fullName) updateFields.fullName = fullName.trim();
    if (email) updateFields.email = email.toLowerCase().trim();
    if (personalEmail !== undefined) updateFields.personalEmail = personalEmail?.trim() || '';
    if (phone !== undefined) updateFields.phone = phone?.trim() || '';
    if (jobTitle) updateFields.jobTitle = jobTitle.trim();
    if (department) updateFields.department = department.trim();
    if (roleCode) updateFields.roleCode = roleCode;
    if (employeeCode) updateFields.employeeCode = employeeCode.trim();
    if (reportingManagerName !== undefined) updateFields.reportingManagerName = reportingManagerName.trim();
    if (salary !== undefined) updateFields.salary = salary.trim();
    if (shift !== undefined) updateFields.shift = shift.trim();
    if (employmentStatus) updateFields.employmentStatus = employmentStatus;

    await cols.employees.updateOne({ _id: existingEmp._id }, { $set: updateFields });

    // Update linked user if userId exists
    if (existingEmp.userId) {
      const userUpdate: any = { updatedAt: new Date() };
      if (fullName) userUpdate.fullName = fullName.trim();
      if (email) userUpdate.primaryEmail = email.toLowerCase().trim();
      if (phone !== undefined) userUpdate.phone = phone.trim();
      if (password && password.trim()) {
        userUpdate.passwordHash = await bcrypt.hash(password.trim(), 10);
      }
      try {
        await cols.users.updateOne({ _id: new ObjectId(existingEmp.userId) }, { $set: userUpdate });
      } catch {}

      // Update membership roles if roleCode specified
      if (roleCode) {
        try {
          await cols.memberships.updateOne(
            { tenantId, userId: existingEmp.userId },
            { $set: { roles: [roleCode], updatedAt: new Date() } }
          );
        } catch {}
      }
    }

    await AuditService.log({
      user: req.auth!.user,
      action: 'EMPLOYEE_UPDATE',
      resourceType: 'EMPLOYEE',
      resourceId: existingEmp._id.toString(),
      details: { employeeCode: existingEmp.employeeCode, updatedFields: Object.keys(updateFields) }
    });

    const updatedEmp = await cols.employees.findOne({ _id: existingEmp._id });
    const resultData = { ...updatedEmp, id: updatedEmp?._id?.toString() };

    SocketService.emitToTenant(tenantId, 'hrms:employee_updated', { employee: resultData });

    res.json({ data: resultData });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/v1/hrms/attendance/today
router.get('/attendance/today', requireAuth, async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;
    const employeeId = req.auth!.user.employeeId;

    if (!employeeId) {
      res.json({ data: null });
      return;
    }

    const todayDate = new Date().toISOString().split('T')[0];
    const record = await cols.attendanceRecords.findOne({ tenantId, employeeId, date: todayDate });
    res.json({ data: record ? { ...record, id: record._id.toString() } : null });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/hrms/attendance/clock-in
router.post('/attendance/clock-in', requireAuth, async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;
    const employeeId = req.auth!.user.employeeId;

    if (!employeeId) {
      res.status(400).json({ error: { code: 'NO_EMPLOYEE', message: 'Employee profile not associated' } });
      return;
    }

    const todayDate = new Date().toISOString().split('T')[0];
    const now = new Date();

    const result = await cols.attendanceRecords.findOneAndUpdate(
      { tenantId, employeeId, date: todayDate },
      {
        $set: {
          checkInTime: now,
          status: now.getHours() > 10 ? 'LATE' : 'PRESENT',
          source: 'WEB_APP',
          updatedAt: now
        },
        $setOnInsert: {
          tenantId,
          employeeId,
          date: todayDate,
          createdAt: now
        }
      },
      { upsert: true, returnDocument: 'after' }
    );

    const attendanceData = { ...result, id: result?._id?.toString() };
    SocketService.emitToTenant(tenantId, 'hrms:attendance_punched', { type: 'IN', record: attendanceData });

    res.status(201).json({ data: attendanceData });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/hrms/attendance/clock-out
router.post('/attendance/clock-out', requireAuth, async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;
    const employeeId = req.auth!.user.employeeId;

    const todayDate = new Date().toISOString().split('T')[0];
    const now = new Date();

    const result = await cols.attendanceRecords.findOneAndUpdate(
      { tenantId, employeeId, date: todayDate },
      { $set: { checkOutTime: now, updatedAt: now } },
      { returnDocument: 'after' }
    );

    const attendanceData = { ...result, id: result?._id?.toString() };
    SocketService.emitToTenant(tenantId, 'hrms:attendance_punched', { type: 'OUT', record: attendanceData });

    res.json({ data: attendanceData });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/v1/hrms/leave/balances
router.get('/leave/balances', requireAuth, async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;
    const employeeId = req.auth!.user.employeeId;

    const types = await cols.leaveTypes.find({ tenantId }).toArray();
    const balances = await cols.leaveBalances.find({ tenantId, employeeId }).toArray();

    const result = types.map((t) => {
      const tId = t._id.toString();
      const bal = balances.find((b) => b.leaveTypeId === tId);
      return {
        id: bal ? bal._id.toString() : tId,
        leaveTypeId: tId,
        totalDays: bal?.totalDays || t.defaultDaysPerYear || 12,
        usedDays: bal?.usedDays || 0,
        pendingDays: bal?.pendingDays || 0,
        leaveType: {
          name: t.name,
          code: t.code
        }
      };
    });

    res.json({ data: result });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET & POST /api/v1/hrms/leave/requests
router.get('/leave/requests', requireAuth, async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    const requests = await cols.leaveRequests.find({ tenantId }).sort({ createdAt: -1 }).toArray();
    const types = await cols.leaveTypes.find({ tenantId }).toArray();
    const employees = await cols.employees.find({ tenantId }).toArray();

    const typeMap = new Map(types.map((t) => [t._id.toString(), t]));
    const empMap = new Map(employees.map((e) => [e._id.toString(), e]));

    const enriched = requests.map((r) => {
      const t = typeMap.get(r.leaveTypeId);
      const e = empMap.get(r.employeeId);
      return {
        ...r,
        id: r._id.toString(),
        leaveType: { name: t?.name || 'Leave', code: t?.code || 'LV' },
        employee: {
          membership: { user: { fullName: e?.fullName || 'Staff Member' } }
        }
      };
    });

    res.json({ data: enriched });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/leave/requests', requireAuth, async (req: Request, res: Response) => {
  try {
    const { leaveTypeId, startDate, endDate, daysCount, reason } = req.body;
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;
    const employeeId = req.auth!.user.employeeId;

    const reqDoc = {
      tenantId,
      employeeId,
      leaveTypeId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      daysCount: Number(daysCount) || 1,
      reason: reason || 'Personal Leave',
      status: 'PENDING',
      createdAt: new Date()
    };
    const resReq = await cols.leaveRequests.insertOne(reqDoc);
    const leaveData = { ...reqDoc, id: resReq.insertedId.toString() };

    SocketService.emitToTenant(tenantId, 'hrms:leave_applied', { leave: leaveData });

    res.status(201).json({ data: leaveData });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/hrms/leave/requests/:id/approve
router.post('/leave/requests/:id/approve', requireAuth, requirePermission('hrms', 'leave', 'approve'), async (req: Request, res: Response) => {
  try {
    const requestId = req.params.id;
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    await cols.leaveRequests.updateOne(
      { _id: new ObjectId(requestId) },
      { $set: { status: 'APPROVED', reviewedAt: new Date() } }
    );

    SocketService.emitToTenant(tenantId, 'hrms:leave_approved', { requestId, status: 'APPROVED' });

    res.json({ data: { id: requestId, status: 'APPROVED' } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// DELETE /api/v1/hrms/employees/:id (Founder & Superadmin Delete Employee Only)
router.delete('/employees/:id', requireAuth, requireLakshaySuperAdmin, async (req: Request, res: Response) => {
  try {
    const employeeId = req.params.id;
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    let query: any = { tenantId };
    try {
      query._id = new ObjectId(employeeId);
    } catch {
      query.employeeCode = employeeId;
    }

    const emp = await cols.employees.findOne(query);
    if (!emp) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Employee not found.' } });
      return;
    }

    await cols.employees.deleteOne({ _id: emp._id });
    if (emp.userId) {
      try {
        await cols.users.deleteOne({ _id: new ObjectId(emp.userId) });
      } catch {}
    }

    await AuditService.log({
      user: req.auth!.user,
      action: 'EMPLOYEE_DELETE',
      resourceType: 'EMPLOYEE',
      resourceId: emp._id.toString(),
      details: { employeeCode: emp.employeeCode, fullName: emp.fullName }
    });

    SocketService.emitToTenant(tenantId, 'hrms:employee_deleted', { employeeId: emp._id.toString() });

    res.json({ data: { success: true, message: 'Employee record deleted permanently.' } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/hrms/employees/batch-delete (Founder & Superadmin Batch Delete Employees)
router.post('/employees/batch-delete', requireAuth, requireLakshaySuperAdmin, async (req: Request, res: Response) => {
  try {
    const { employeeIds } = req.body;
    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'employeeIds array is required' } });
      return;
    }

    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    const objectIds = employeeIds
      .map((id: string) => {
        try {
          return new ObjectId(id);
        } catch {
          return null;
        }
      })
      .filter((id): id is ObjectId => id !== null);

    const deleteFilter: any = {
      tenantId,
      $or: [
        { _id: { $in: objectIds } },
        { employeeCode: { $in: employeeIds } }
      ]
    };

    const targetEmps = await cols.employees.find(deleteFilter).toArray();
    const userIds = targetEmps.map(e => e.userId).filter(Boolean);

    await cols.employees.deleteMany(deleteFilter);
    if (userIds.length > 0) {
      const userObjIds = userIds.map((uid: string) => {
        try {
          return new ObjectId(uid);
        } catch {
          return null;
        }
      }).filter((id): id is ObjectId => id !== null);
      if (userObjIds.length > 0) {
        await cols.users.deleteMany({ _id: { $in: userObjIds } });
      }
    }

    await AuditService.log({
      user: req.auth!.user,
      action: 'EMPLOYEE_BATCH_DELETE',
      resourceType: 'EMPLOYEE',
      resourceId: 'BATCH',
      details: { count: targetEmps.length, employeeIds }
    });

    SocketService.emitToTenant(tenantId, 'hrms:employees_batch_deleted', { employeeIds });

    res.json({ data: { success: true, count: targetEmps.length } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// DELETE /api/v1/hrms/leave/requests/:id (Founder & Superadmin Delete Leave Request Only)
router.delete('/leave/requests/:id', requireAuth, requireLakshaySuperAdmin, async (req: Request, res: Response) => {
  try {
    const requestId = req.params.id;
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    await cols.leaveRequests.deleteOne({ _id: new ObjectId(requestId), tenantId });
    SocketService.emitToTenant(tenantId, 'hrms:leave_deleted', { requestId });

    res.json({ data: { success: true, message: 'Leave request deleted.' } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

export default router;
