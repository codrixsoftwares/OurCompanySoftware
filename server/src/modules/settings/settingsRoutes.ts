import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { getCollections } from '../../core/mongodb.js';
import { requireAuth, requireLakshaySuperAdmin } from '../../core/auth/middleware.js';
import { AuditService } from '../../core/audit/auditService.js';
import { EmailDispatcher } from '../../core/email/emailDispatcher.js';
import { SocketService } from '../../core/socket/socketService.js';

const router = Router();

// Middleware: restrict settings to Superadmin / Company Admin
const requireAdmin = (req: Request, res: Response, next: Function) => {
  const roles = (req.auth?.user.roles as string[]) || [];
  const isAdmin = roles.some((r) => ['COMPANY_ADMIN', 'SUPERADMIN', 'SUPER_ADMIN'].includes(r));
  if (!isAdmin) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only Superadmin and Company Admins can access domain email settings.' } });
    return;
  }
  next();
};

// Helper to sync channels into authorized mailbox connections
async function syncMailboxChannel(cols: any, tenantId: string, address: string, displayName: string, provider: string = 'RESEND') {
  if (!address || !address.includes('@')) return null;
  const normalized = address.toLowerCase().trim();
  await cols.mailboxConnections.updateOne(
    { tenantId, mailboxAddress: normalized },
    {
      $set: {
        tenantId,
        provider,
        mailboxAddress: normalized,
        displayName: displayName || normalized.split('@')[0],
        mailboxType: 'SHARED',
        connectionStatus: 'CONNECTED',
        updatedAt: new Date()
      },
      $setOnInsert: {
        createdAt: new Date()
      }
    },
    { upsert: true }
  );
  return normalized;
}

// GET /api/v1/settings/email
router.get('/email', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    let config: any = await cols.tenantEmailConfigs.findOne({ tenantId }) ||
                      await cols.tenantEmailConfigs.findOne({});

    const apiKey = process.env.RESEND_API_KEY || config?.transactional?.apiKey || config?.resend?.apiKey || '';

    const safeConfig = {
      tenantId,
      domain: config?.domain || 'codrix.co.in',
      activeMethod: 'RESEND',
      resend: {
        apiKey: apiKey ? '••••••••' : '',
        hasApiKey: Boolean(apiKey),
        fromName: config?.resend?.fromName || config?.transactional?.fromName || 'Codrix Private Limited',
        fromEmail: config?.resend?.fromEmail || config?.transactional?.fromEmail || 'connect@codrix.co.in',
        status: apiKey ? 'CONNECTED' : 'NOT_CONFIGURED',
        domain: config?.domain || 'codrix.co.in'
      },
      transactional: {
        provider: 'RESEND',
        apiKey: apiKey ? '••••••••' : '',
        hasApiKey: Boolean(apiKey),
        fromName: config?.transactional?.fromName || config?.resend?.fromName || 'Codrix Private Limited',
        fromEmail: config?.transactional?.fromEmail || config?.resend?.fromEmail || 'connect@codrix.co.in',
        status: apiKey ? 'CONNECTED' : 'NOT_CONFIGURED'
      },
      updatedAt: config?.updatedAt || new Date()
    };

    res.json({ data: safeConfig });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/settings/email
router.post('/email', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;
    const body = req.body;

    const existing = await cols.tenantEmailConfigs.findOne({ tenantId });

    const inputApiKey = body.resend?.apiKey || body.transactional?.apiKey || body.apiKey;
    const resolvedApiKey = (inputApiKey === '••••••••' || !inputApiKey)
      ? existing?.transactional?.apiKey || existing?.resend?.apiKey || process.env.RESEND_API_KEY || ''
      : inputApiKey;

    const fromName = body.resend?.fromName || body.transactional?.fromName || body.fromName || 'Codrix Private Limited';
    const fromEmail = body.resend?.fromEmail || body.transactional?.fromEmail || body.fromEmail || 'connect@codrix.co.in';
    const domain = body.domain || existing?.domain || 'codrix.co.in';

    const updateDoc = {
      tenantId,
      domain,
      activeMethod: 'RESEND',
      resend: {
        apiKey: resolvedApiKey,
        fromName,
        fromEmail,
        status: resolvedApiKey ? 'CONNECTED' : 'NOT_CONFIGURED',
        domain
      },
      transactional: {
        provider: 'RESEND',
        apiKey: resolvedApiKey,
        fromName,
        fromEmail,
        status: resolvedApiKey ? 'CONNECTED' : 'NOT_CONFIGURED'
      },
      updatedAt: new Date(),
      updatedBy: req.auth!.user.fullName
    };

    await cols.tenantEmailConfigs.updateOne(
      { tenantId },
      { $set: updateDoc },
      { upsert: true }
    );

    if (fromEmail) {
      await syncMailboxChannel(cols, tenantId, fromEmail, fromName, 'RESEND');
    }

    await AuditService.log({
      user: req.auth!.user,
      action: 'EMAIL_CONFIG_UPDATE',
      resourceType: 'TENANT_SETTINGS',
      resourceId: tenantId,
      details: {
        provider: 'RESEND',
        domain,
        fromEmail,
        fromName
      }
    });

    res.json({ data: { message: 'Resend Enterprise Email Engine settings saved and synchronized successfully!' } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/settings/email/verify-resend
router.post('/email/verify-resend', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.body;
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    let keyToTest = apiKey;
    if (keyToTest === '••••••••' || !keyToTest) {
      const existing = await cols.tenantEmailConfigs.findOne({ tenantId });
      keyToTest = existing?.transactional?.apiKey || existing?.resend?.apiKey || process.env.RESEND_API_KEY || '';
    }

    if (!keyToTest) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Resend API Key is required to verify.' } });
      return;
    }

    const result = await EmailDispatcher.verifyResend(keyToTest);
    if (result.valid) {
      res.json({ data: { success: true, message: result.message, domains: result.domains } });
    } else {
      res.status(400).json({ error: { code: 'VERIFICATION_FAILED', message: result.message } });
    }
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/settings/email/sync-channels (Sync all company channels)
router.post('/email/sync-channels', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    const config = await cols.tenantEmailConfigs.findOne({ tenantId }) ||
                   await cols.tenantEmailConfigs.findOne({});
    const synced: string[] = [];

    // Core company channels
    const defaults = [
      { addr: 'connect@codrix.co.in', name: 'Codrix Official (Connect)' },
      { addr: 'careers@codrix.co.in', name: 'Codrix Careers & Talent Acquisition' },
      { addr: 'sales@codrix.co.in', name: 'Codrix Enterprise Sales' },
      { addr: 'support@codrix.co.in', name: 'Codrix Client Support' }
    ];

    for (const d of defaults) {
      await syncMailboxChannel(cols, tenantId, d.addr, d.name, 'RESEND');
      synced.push(d.addr);
    }

    const fromEmail = config?.resend?.fromEmail || config?.transactional?.fromEmail;
    const fromName = config?.resend?.fromName || config?.transactional?.fromName || 'Codrix Private Limited';
    if (fromEmail) {
      await syncMailboxChannel(cols, tenantId, fromEmail, fromName, 'RESEND');
      if (!synced.includes(fromEmail)) synced.push(fromEmail);
    }

    const channels = await cols.mailboxConnections.find({ tenantId }).toArray();

    res.json({
      data: {
        success: true,
        message: `All ${channels.length} company channels synchronized with MongoDB Atlas!`,
        count: channels.length,
        channels: channels.map(c => ({ ...c, id: c._id.toString() }))
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/settings/email/test-send
router.post('/email/test-send', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { targetEmail } = req.body;
    const tenantId = req.auth!.user.tenantId;

    if (!targetEmail) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Target email is required.' } });
      return;
    }

    const result = await EmailDispatcher.send({
      tenantId,
      to: targetEmail,
      subject: '✅ Codrix Enterprise OS — Resend Email Engine Verified',
      text: `Hello,\n\nThis is a verification email from Codrix Enterprise OS.\n\nYour outbound email delivery via Resend HTTPS REST API (Port 443) on verified domain codrix.co.in is connected and operational.\n\nTime: ${new Date().toLocaleString()}\nSender: ${req.auth!.user.fullName}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: auto; padding: 28px; border: 1px solid #E7E0FB; border-radius: 16px; background-color: #FBFBFE;">
          <div style="display: flex; align-items: center; margin-bottom: 20px;">
            <h2 style="color: #120E24; margin: 0; font-size: 22px; font-weight: 800;">Codrix Enterprise OS</h2>
          </div>
          <div style="background: linear-gradient(135deg, #7C2CF5 0%, #4F1285 100%); padding: 16px 20px; border-radius: 12px; color: #FFFFFF; font-weight: bold; margin-bottom: 20px;">
            ✨ Official Domain Email Connected Successfully (Resend Engine)
          </div>
          <p style="color: #120E24; font-size: 14px; line-height: 1.6; font-weight: 600;">
            Outbound email dispatch has been verified end-to-end via Resend HTTPS REST API (Port 443).
          </p>
          <ul style="color: #585172; font-size: 13px; line-height: 1.8; padding-left: 20px;">
            <li><strong>Verified Domain:</strong> codrix.co.in (DKIM & SPF Active)</li>
            <li><strong>Authorized Sender:</strong> connect@codrix.co.in</li>
            <li><strong>Cloud Port Status:</strong> 100% Unblocked (Port 443 HTTPS)</li>
            <li><strong>Branding:</strong> 100% White-Labeled (Zero watermarks)</li>
          </ul>
          <hr style="border: none; border-top: 1px solid #E7E0FB; margin: 24px 0;" />
          <p style="color: #585172; font-size: 12px; margin: 0;">
            Dispatched by <strong>${req.auth!.user.fullName}</strong> (${req.auth!.user.email}) at ${new Date().toLocaleString()}
          </p>
        </div>
      `
    });

    if (result.success) {
      res.json({ data: { success: true, message: `Live test email dispatched successfully via ${result.deliveryMethod}!`, messageId: result.messageId } });
    } else {
      res.status(400).json({ error: { code: 'SEND_FAILED', message: result.error || 'Failed to dispatch test email.' } });
    }
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/settings/mailboxes (Add new shared mailbox)
router.post('/mailboxes', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { mailboxAddress, displayName, mailboxType = 'SHARED' } = req.body;
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    if (!mailboxAddress || !displayName) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Address and display name are required' } });
      return;
    }

    const doc = {
      tenantId,
      provider: 'RESEND',
      mailboxAddress,
      displayName,
      mailboxType,
      connectionStatus: 'CONNECTED',
      createdAt: new Date()
    };

    const inserted = await cols.mailboxConnections.insertOne(doc);
    res.status(201).json({ data: { ...doc, id: inserted.insertedId.toString() } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// DELETE /api/v1/settings/mailboxes/:id (Founder & Superadmin Delete Only)
router.delete('/mailboxes/:id', requireAuth, requireLakshaySuperAdmin, async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const id = req.params.id;
    await cols.mailboxConnections.deleteOne({ _id: new ObjectId(id) });
    res.json({ data: { success: true } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/v1/settings/organization
router.get('/organization', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    let tenant = await cols.tenants.findOne({ _id: new ObjectId(tenantId) });
    if (!tenant) {
      tenant = await cols.tenants.findOne({ slug: 'codrix' });
    }

    res.json({
      data: {
        id: tenant?._id.toString() || tenantId,
        legalName: tenant?.legalName || 'CODRIX PRIVATE LIMITED',
        tradeName: tenant?.tradeName || 'CodRix',
        slug: tenant?.slug || 'codrix',
        website: tenant?.website || 'https://codrix.co.in',
        domain: tenant?.domain || 'codrix.co.in',
        supportEmail: tenant?.supportEmail || 'connect@codrix.co.in',
        phone: tenant?.phone || '+91 8295886832',
        timezone: tenant?.timezone || 'Asia/Kolkata (IST)',
        currency: tenant?.currency || 'INR (₹)',
        country: tenant?.country || 'India',
        updatedAt: tenant?.updatedAt || new Date()
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/settings/organization
router.post('/organization', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;
    const { legalName, tradeName, website, domain, supportEmail, phone, timezone, currency } = req.body;

    const updateFields = {
      legalName,
      tradeName,
      website,
      domain,
      supportEmail,
      phone,
      timezone,
      currency,
      updatedAt: new Date(),
      updatedBy: req.auth!.user.fullName
    };

    let filter: any = { _id: new ObjectId(tenantId) };
    const exists = await cols.tenants.findOne(filter);
    if (!exists) {
      filter = { slug: 'codrix' };
    }

    await cols.tenants.updateOne(filter, { $set: updateFields }, { upsert: true });

    // Also update domain in tenantEmailConfigs if domain provided
    if (domain) {
      await cols.tenantEmailConfigs.updateOne(
        { tenantId },
        { $set: { domain, updatedAt: new Date(), updatedBy: req.auth!.user.fullName } }
      );
    }

    await AuditService.log({
      user: req.auth!.user,
      action: 'ORGANIZATION_SETTINGS_UPDATE',
      resourceType: 'TENANT',
      resourceId: tenantId,
      details: updateFields
    });

    res.json({ data: { message: 'Organization profile updated successfully in MongoDB Atlas!', ...updateFields } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

export default router;
