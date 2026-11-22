import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { getCollections } from '../../core/mongodb.js';
import { requireAuth, requirePermission, requireLakshaySuperAdmin } from '../../core/auth/middleware.js';
import { AuditService } from '../../core/audit/auditService.js';
import { RoleCode } from '../../core/auth/types.js';
import { SocketService } from '../../core/socket/socketService.js';
import { EmailDispatcher } from '../../core/email/emailDispatcher.js';

// Helper function to dispatch stylized login credentials email
async function sendCredentialsEmailNotification(params: {
  tenantId: string;
  recipientEmails: string[];
  fullName: string;
  loginEmail: string;
  password?: string;
  employeeCode?: string;
  jobTitle?: string;
  roleCode?: string;
}) {
  const { tenantId, recipientEmails, fullName, loginEmail, password, employeeCode, jobTitle, roleCode } = params;
  const validRecipients = Array.from(new Set(recipientEmails.filter((e) => e && e.includes('@'))));
  if (!validRecipients.length) return null;

  const portalUrl = 'https://connect.codrix.co.in';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F7FC; margin: 0; padding: 24px; color: #120E24; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #E7E0FB; box-shadow: 0 10px 25px rgba(124, 44, 245, 0.08); }
    .header { background: linear-gradient(135deg, #7C2CF5 0%, #4F12B5 100%); padding: 32px 28px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0 0 8px 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { margin: 0; font-size: 13px; opacity: 0.9; }
    .content { padding: 32px 28px; }
    .welcome-text { font-size: 15px; line-height: 1.6; color: #37324B; margin-bottom: 24px; }
    .card { background: #FAF9FE; border: 1px solid #E7E0FB; border-radius: 14px; padding: 20px; margin-bottom: 24px; }
    .card-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #7C2CF5; margin-bottom: 12px; }
    .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
    .row:last-child { margin-bottom: 0; }
    .label { color: #585172; font-weight: 500; }
    .val { color: #120E24; font-weight: 700; }
    .cred-box { background: #120E24; color: #ffffff; border-radius: 14px; padding: 20px; margin: 24px 0; text-align: center; }
    .cred-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #9C8EF7; margin-bottom: 8px; }
    .cred-value { font-family: monospace; font-size: 20px; font-weight: bold; letter-spacing: 2px; color: #22C55E; background: rgba(255,255,255,0.08); padding: 8px 16px; border-radius: 8px; display: inline-block; }
    .btn-container { text-align: center; margin: 28px 0; }
    .btn { background: #7C2CF5; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 700; font-size: 14px; display: inline-block; box-shadow: 0 4px 15px rgba(124, 44, 245, 0.35); }
    .footer { text-align: center; padding: 20px 28px; background: #FAF9FE; border-top: 1px solid #E7E0FB; font-size: 11px; color: #7D7595; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CodRix Enterprise OS</h1>
      <p>Official Platform Access Credentials</p>
    </div>
    <div class="content">
      <p class="welcome-text">
        Hello <strong>${fullName}</strong>,<br><br>
        Your login credentials and account access for the <strong>CodRix Enterprise OS</strong> platform have been updated by Founder & Superadmin <strong>Lakshay</strong>.
      </p>

      <div class="card">
        <div class="card-title">Employee & Role Profile</div>
        <div class="row"><span class="label">Staff Member:</span><span class="val">${fullName}</span></div>
        ${employeeCode ? `<div class="row"><span class="label">Employee ID:</span><span class="val">${employeeCode}</span></div>` : ''}
        ${jobTitle ? `<div class="row"><span class="label">Designation:</span><span class="val">${jobTitle}</span></div>` : ''}
        ${roleCode ? `<div class="row"><span class="label">System Role Access:</span><span class="val">${roleCode}</span></div>` : ''}
        <div class="row"><span class="label">Official Login ID:</span><span class="val">${loginEmail}</span></div>
      </div>

      ${password ? `
      <div class="cred-box">
        <div class="cred-title">Your Portal Login Password</div>
        <div class="cred-value">${password}</div>
        <div style="font-size: 11px; color: #9C8EF7; margin-top: 10px;">Please login and update your password if desired.</div>
      </div>
      ` : ''}

      <div class="btn-container">
        <a href="${portalUrl}" class="btn" target="_blank">Access CodRix Enterprise OS</a>
      </div>

      <p style="font-size: 12px; color: #585172; line-height: 1.5;">
        <strong>Security Notice:</strong> Keep these credentials confidential. If you did not request this update or experience any difficulty logging in, contact <strong>lakshay@codrix.co.in</strong> immediately.
      </p>
    </div>
    <div class="footer">
      CodRix Private Limited • connect.codrix.co.in • Confidential Enterprise Transmission
    </div>
  </div>
</body>
</html>
  `;

  return await EmailDispatcher.send({
    tenantId,
    to: validRecipients,
    subject: `🔐 CodRix Enterprise OS — Your Login Credentials [${fullName}]`,
    html,
    text: `Hello ${fullName},\n\nYour CodRix Enterprise OS login credentials have been updated.\nPortal URL: ${portalUrl}\nOfficial Login ID: ${loginEmail}\n${password ? `Password: ${password}\n` : ''}\nPlease login to continue.\n\nCodRix Private Limited`
  });
}

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
      const shift = e.shift || '';
      const salary = e.salary || '';

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
        reportingManagerName: e.reportingManagerName || '',
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
      reportingManagerName: reportingManagerName?.trim() || '',
      salary: salary?.trim() || '',
      shift: shift?.trim() || '',
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
      password,
      sendCredentialsEmail
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

    // Optional dispatch of updated credentials email to staff member
    let emailDispatchResult: any = null;
    if (sendCredentialsEmail) {
      const recipientEmails = [
        email || existingEmp.email,
        personalEmail !== undefined ? personalEmail : existingEmp.personalEmail
      ].filter(Boolean);

      try {
        emailDispatchResult = await sendCredentialsEmailNotification({
          tenantId,
          recipientEmails,
          fullName: fullName || existingEmp.fullName,
          loginEmail: email || existingEmp.email,
          password: password && password.trim() ? password.trim() : undefined,
          employeeCode: employeeCode || existingEmp.employeeCode,
          jobTitle: jobTitle || existingEmp.jobTitle,
          roleCode: roleCode || existingEmp.roleCode
        });
      } catch (err: any) {
        console.error('Email dispatch error on staff update:', err);
      }
    }

    await AuditService.log({
      user: req.auth!.user,
      action: 'EMPLOYEE_UPDATE',
      resourceType: 'EMPLOYEE',
      resourceId: existingEmp._id.toString(),
      details: {
        employeeCode: existingEmp.employeeCode,
        updatedFields: Object.keys(updateFields),
        emailDispatched: Boolean(emailDispatchResult?.success)
      }
    });

    const updatedEmp = await cols.employees.findOne({ _id: existingEmp._id });
    const resultData = { ...updatedEmp, id: updatedEmp?._id?.toString() };

    SocketService.emitToTenant(tenantId, 'hrms:employee_updated', { employee: resultData });

    res.json({
      data: resultData,
      emailDispatched: Boolean(emailDispatchResult?.success),
      emailDeliveryMethod: emailDispatchResult?.deliveryMethod
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/hrms/employees/:id/dispatch-credentials (Founder Lakshay Dispatches Login Credentials to Staff Email)
router.post('/employees/:id/dispatch-credentials', requireAuth, requireLakshaySuperAdmin, async (req: Request, res: Response) => {
  try {
    const employeeId = req.params.id;
    const { password } = req.body;
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
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Staff member not found.' } });
      return;
    }

    // If a new password is provided, immediately hash and sync it to the linked user account
    if (password && password.trim() && emp.userId) {
      const passwordHash = await bcrypt.hash(password.trim(), 10);
      try {
        await cols.users.updateOne(
          { _id: new ObjectId(emp.userId) },
          { $set: { passwordHash, updatedAt: new Date() } }
        );
      } catch {}
    }

    const recipientEmails = [emp.email, emp.personalEmail].filter(Boolean);
    if (!recipientEmails.length) {
      res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'No official or personal email address found for this staff member.'
        }
      });
      return;
    }

    const dispatchRes = await sendCredentialsEmailNotification({
      tenantId,
      recipientEmails,
      fullName: emp.fullName,
      loginEmail: emp.email,
      password: password && password.trim() ? password.trim() : undefined,
      employeeCode: emp.employeeCode,
      jobTitle: emp.jobTitle,
      roleCode: emp.roleCode
    });

    await AuditService.log({
      user: req.auth!.user,
      action: 'DISPATCH_CREDENTIALS',
      resourceType: 'EMPLOYEE',
      resourceId: emp._id.toString(),
      details: {
        employeeCode: emp.employeeCode,
        fullName: emp.fullName,
        recipientEmails,
        deliveryMethod: dispatchRes?.deliveryMethod
      }
    });

    res.json({
      success: true,
      message: `Login credentials dispatched successfully to ${recipientEmails.join(' & ')}`,
      recipients: recipientEmails,
      deliveryMethod: dispatchRes?.deliveryMethod,
      info: dispatchRes?.info
    });
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
