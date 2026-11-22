import { Router, Request, Response } from 'express';
import { getCollections } from '../../core/mongodb.js';
import { requireAuth } from '../../core/auth/middleware.js';

const router = Router();

// GET /api/v1/reports/overview
router.get('/overview', requireAuth, async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    const [
      employeeCount,
      openJobsCount,
      activeLeadsCount,
      activeProjectsCount,
      pendingLeaveRequests,
      unreadEmailsCount,
      auditLogs
    ] = await Promise.all([
      cols.employees.countDocuments({ tenantId, employmentStatus: 'ACTIVE' }),
      cols.jobOpenings.countDocuments({ tenantId, status: 'OPEN' }),
      cols.leads.countDocuments({ tenantId, stage: { $nin: ['WON', 'LOST'] } }),
      cols.projects.countDocuments({ tenantId, status: 'ACTIVE' }),
      cols.leaveRequests.countDocuments({ tenantId, status: 'PENDING' }),
      cols.emailThreads.countDocuments({ tenantId, unread: true }),
      cols.auditLogs.find({ tenantId }).sort({ createdAt: -1 }).limit(10).toArray()
    ]);

    res.json({
      data: {
        kpis: {
          employeeCount,
          openJobsCount,
          activeLeadsCount,
          activeProjectsCount,
          pendingLeaveRequests,
          unreadEmailsCount
        },
        recentAuditLogs: auditLogs.map((l) => ({ ...l, id: l._id.toString() }))
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/v1/reports/audit-logs
router.get('/audit-logs', requireAuth, async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const logs = await cols.auditLogs.find({ tenantId: req.auth!.user.tenantId }).sort({ createdAt: -1 }).limit(50).toArray();
    res.json({ data: logs.map((l) => ({ ...l, id: l._id.toString() })) });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

export default router;
