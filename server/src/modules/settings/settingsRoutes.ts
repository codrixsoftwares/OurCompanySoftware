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

// GET /api/v1/settings/email
router.get('/email', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    let config: any = await cols.tenantEmailConfigs.findOne({ tenantId });

    if (!config) {
      // Default initial config for CodRix
      const newConfig = {
        tenantId,
        activeMethod: 'SMTP_IMAP',
        domain: 'codrix.co.in',
        smtp: {
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          username: 'connect@codrix.co.in',
          password: '',
          fromName: 'CodRix Official',
          fromEmail: 'connect@codrix.co.in',
          status: 'NOT_CONFIGURED'
        },
        imap: {
          host: 'imap.gmail.com',
          port: 993,
          secure: true,
          username: 'connect@codrix.co.in',
          password: '',
          syncIntervalMinutes: 5,
          status: 'NOT_CONFIGURED'
        },
        transactional: {
          provider: 'RESEND',
          apiKey: '',
          fromName: 'CodRix Notifications',
          fromEmail: 'connect@codrix.co.in',
          status: 'NOT_CONFIGURED'
        },
        webhook: {
          enabled: true,
          endpointUrl: `http://localhost:5000/api/v1/mailboxes/webhook/inbound`,
          signingSecret: `cdx_sec_${Math.random().toString(36).substring(2, 12)}`
        },
        updatedAt: new Date(),
        updatedBy: req.auth!.user.fullName
      };
      const ins = await cols.tenantEmailConfigs.insertOne(newConfig as any);
      config = { ...newConfig, _id: ins.insertedId };
    }

    // Mask sensitive passwords before sending to client
    const safeConfig = {
      ...config,
      smtp: {
        ...config.smtp,
        hasPassword: Boolean(config.smtp?.password),
        password: config.smtp?.password ? '••••••••' : ''
      },
      imap: {
        ...config.imap,
        hasPassword: Boolean(config.imap?.password),
        password: config.imap?.password ? '••••••••' : ''
      },
      transactional: {
        ...config.transactional,
        hasApiKey: Boolean(config.transactional?.apiKey),
        apiKey: config.transactional?.apiKey ? '••••••••' : ''
      }
    };

    res.json({ data: safeConfig });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// Helper to sync channels into authorized mailbox connections
async function syncMailboxChannel(cols: any, tenantId: string, address: string, displayName: string, provider: string = 'CUSTOM_DOMAIN') {
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

// POST /api/v1/settings/email
router.post('/email', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;
    const body = req.body;

    const existing = await cols.tenantEmailConfigs.findOne({ tenantId });

    // Handle password masking: don't overwrite with '••••••••' if unchanged
    const smtpPassword = body.smtp?.password === '••••••••' || !body.smtp?.password
      ? existing?.smtp?.password || ''
      : body.smtp.password;

    const imapPassword = body.imap?.password === '••••••••' || !body.imap?.password
      ? existing?.imap?.password || ''
      : body.imap.password;

    const transactionalApiKey = body.transactional?.apiKey === '••••••••' || !body.transactional?.apiKey
      ? existing?.transactional?.apiKey || ''
      : body.transactional.apiKey;

    const updateDoc = {
      tenantId,
      activeMethod: body.activeMethod || existing?.activeMethod || 'SMTP_IMAP',
      domain: body.domain || existing?.domain || 'codrix.co.in',
      smtp: {
        host: body.smtp?.host || '',
        port: Number(body.smtp?.port) || 587,
        secure: Boolean(body.smtp?.secure),
        username: body.smtp?.username || '',
        password: smtpPassword,
        fromName: body.smtp?.fromName || 'CodRix Official',
        fromEmail: body.smtp?.fromEmail || body.smtp?.username || 'connect@codrix.co.in',
        status: smtpPassword ? 'CONNECTED' : 'NOT_CONFIGURED',
        lastTestedAt: body.smtp?.lastTestedAt || existing?.smtp?.lastTestedAt
      },
      imap: {
        host: body.imap?.host || '',
        port: Number(body.imap?.port) || 993,
        secure: Boolean(body.imap?.secure),
        username: body.imap?.username || '',
        password: imapPassword,
        syncIntervalMinutes: Number(body.imap?.syncIntervalMinutes) || 5,
        status: imapPassword ? 'CONNECTED' : 'NOT_CONFIGURED'
      },
      transactional: {
        provider: body.transactional?.provider || 'RESEND',
        apiKey: transactionalApiKey,
        fromName: body.transactional?.fromName || 'CodRix Notifications',
        fromEmail: body.transactional?.fromEmail || 'connect@codrix.co.in',
        status: transactionalApiKey ? 'CONNECTED' : 'NOT_CONFIGURED'
      },
      webhook: {
        enabled: Boolean(body.webhook?.enabled ?? true),
        endpointUrl: body.webhook?.endpointUrl || `http://localhost:5000/api/v1/mailboxes/webhook/inbound`,
        signingSecret: body.webhook?.signingSecret || existing?.webhook?.signingSecret || `cdx_sec_${Math.random().toString(36).substring(2, 12)}`
      },
      updatedAt: new Date(),
      updatedBy: req.auth!.user.fullName
    };

    await cols.tenantEmailConfigs.updateOne(
      { tenantId },
      { $set: updateDoc },
      { upsert: true }
    );

    // Synchronize company connected channels in MongoDB Atlas
    if (updateDoc.smtp.fromEmail || updateDoc.smtp.username) {
      await syncMailboxChannel(
        cols,
        tenantId,
        updateDoc.smtp.fromEmail || updateDoc.smtp.username,
        updateDoc.smtp.fromName || 'CodRix Official',
        'CUSTOM_DOMAIN'
      );
    }
    if (updateDoc.transactional.fromEmail) {
      await syncMailboxChannel(
        cols,
        tenantId,
        updateDoc.transactional.fromEmail,
        updateDoc.transactional.fromName || 'CodRix Notifications',
        updateDoc.transactional.provider
      );
    }

    await AuditService.log({
      user: req.auth!.user,
      action: 'EMAIL_CONFIG_UPDATE',
      resourceType: 'TENANT_SETTINGS',
      resourceId: tenantId,
      details: {
        activeMethod: updateDoc.activeMethod,
        domain: updateDoc.domain,
        smtpHost: updateDoc.smtp.host,
        smtpUser: updateDoc.smtp.username
      }
    });

    res.json({ data: { message: 'Company email settings saved and synchronized with Connected Channels in MongoDB Atlas!' } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/settings/email/smtp (Dedicated Outbound SMTP Save & Channel Sync)
router.post('/email/smtp', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;
    const { host, port, secure, username, password, fromName, fromEmail } = req.body;

    if (!host || !username) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'SMTP host and username are required.' } });
      return;
    }

    const existing = await cols.tenantEmailConfigs.findOne({ tenantId });
    const smtpPassword = (password === '••••••••' || !password)
      ? existing?.smtp?.password || ''
      : password;

    const smtpDoc = {
      host: host.trim(),
      port: Number(port) || 587,
      secure: Boolean(secure),
      username: username.trim(),
      password: smtpPassword,
      fromName: fromName ? fromName.trim() : 'CodRix Official',
      fromEmail: (fromEmail || username).trim(),
      status: smtpPassword ? 'CONNECTED' : 'NOT_CONFIGURED',
      updatedAt: new Date()
    };

    await cols.tenantEmailConfigs.updateOne(
      { tenantId },
      {
        $set: {
          smtp: smtpDoc,
          activeMethod: 'SMTP_IMAP',
          updatedAt: new Date(),
          updatedBy: req.auth!.user.fullName
        }
      },
      { upsert: true }
    );

    // Directly register and link this channel in Authorized Company Connected Channels (mailboxConnections)
    const channelAddress = await syncMailboxChannel(
      cols,
      tenantId,
      smtpDoc.fromEmail || smtpDoc.username,
      smtpDoc.fromName,
      'CUSTOM_DOMAIN'
    );

    await AuditService.log({
      user: req.auth!.user,
      action: 'SMTP_CONFIG_UPDATE',
      resourceType: 'TENANT_SETTINGS',
      resourceId: tenantId,
      details: { host: smtpDoc.host, username: smtpDoc.username, channelAddress }
    });

    res.json({
      data: {
        success: true,
        message: `Outbound SMTP Server saved & linked to Authorized Company Channels (${channelAddress})!`,
        channelAddress
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/settings/email/imap (Dedicated Inbound IMAP Save & Channel Sync)
router.post('/email/imap', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;
    const { host, port, secure, username, password, syncIntervalMinutes } = req.body;

    const existing = await cols.tenantEmailConfigs.findOne({ tenantId });
    const imapPassword = (password === '••••••••' || !password)
      ? existing?.imap?.password || ''
      : password;

    const imapDoc = {
      host: (host || 'imap.gmail.com').trim(),
      port: Number(port) || 993,
      secure: Boolean(secure ?? true),
      username: (username || '').trim(),
      password: imapPassword,
      syncIntervalMinutes: Number(syncIntervalMinutes) || 5,
      status: imapPassword ? 'CONNECTED' : 'NOT_CONFIGURED',
      updatedAt: new Date()
    };

    await cols.tenantEmailConfigs.updateOne(
      { tenantId },
      {
        $set: {
          imap: imapDoc,
          updatedAt: new Date(),
          updatedBy: req.auth!.user.fullName
        }
      },
      { upsert: true }
    );

    if (imapDoc.username) {
      await syncMailboxChannel(cols, tenantId, imapDoc.username, 'CodRix Inbox', 'CUSTOM_DOMAIN');
    }

    res.json({
      data: {
        success: true,
        message: 'Inbound IMAP Server settings saved & synchronized with Authorized Company Channels!'
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/settings/email/transactional (Dedicated Transactional Gateway Save & Channel Sync)
router.post('/email/transactional', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;
    const { provider, apiKey, fromName, fromEmail } = req.body;

    const existing = await cols.tenantEmailConfigs.findOne({ tenantId });
    const finalApiKey = (apiKey === '••••••••' || !apiKey)
      ? existing?.transactional?.apiKey || ''
      : apiKey;

    const transDoc = {
      provider: provider || 'RESEND',
      apiKey: finalApiKey,
      fromName: fromName || 'CodRix Notifications',
      fromEmail: fromEmail || 'connect@codrix.co.in',
      status: finalApiKey ? 'CONNECTED' : 'NOT_CONFIGURED',
      updatedAt: new Date()
    };

    await cols.tenantEmailConfigs.updateOne(
      { tenantId },
      {
        $set: {
          transactional: transDoc,
          activeMethod: 'TRANSACTIONAL_API',
          updatedAt: new Date(),
          updatedBy: req.auth!.user.fullName
        }
      },
      { upsert: true }
    );

    if (transDoc.fromEmail) {
      await syncMailboxChannel(cols, tenantId, transDoc.fromEmail, transDoc.fromName, transDoc.provider);
    }

    res.json({
      data: {
        success: true,
        message: `Transactional API Gateway (${transDoc.provider}) saved and connected to Authorized Channels!`
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/settings/email/webhook (Dedicated Inbound Webhook Save)
router.post('/email/webhook', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;
    const { endpointUrl, signingSecret } = req.body;

    await cols.tenantEmailConfigs.updateOne(
      { tenantId },
      {
        $set: {
          'webhook.endpointUrl': endpointUrl,
          'webhook.signingSecret': signingSecret,
          activeMethod: 'INBOUND_WEBHOOK',
          updatedAt: new Date(),
          updatedBy: req.auth!.user.fullName
        }
      },
      { upsert: true }
    );

    res.json({
      data: {
        success: true,
        message: 'Inbound Webhook routing & DNS settings saved successfully!'
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/settings/email/sync-channels (Sync all company channels)
router.post('/email/sync-channels', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    const config = await cols.tenantEmailConfigs.findOne({ tenantId });
    const synced: string[] = [];

    // Core company channels
    const defaults = [
      { addr: 'connect@codrix.co.in', name: 'CodRix Official (Connect)' },
      { addr: 'careers@codrix.co.in', name: 'CodRix Careers & Hiring' },
      { addr: 'sales@codrix.co.in', name: 'CodRix Enterprise Sales' },
      { addr: 'support@codrix.co.in', name: 'CodRix Client Support' }
    ];

    for (const d of defaults) {
      await syncMailboxChannel(cols, tenantId, d.addr, d.name, 'CUSTOM_DOMAIN');
      synced.push(d.addr);
    }

    if (config?.smtp?.fromEmail) {
      await syncMailboxChannel(cols, tenantId, config.smtp.fromEmail, config.smtp.fromName || 'CodRix Official', 'CUSTOM_DOMAIN');
      if (!synced.includes(config.smtp.fromEmail)) synced.push(config.smtp.fromEmail);
    }

    if (config?.transactional?.fromEmail) {
      await syncMailboxChannel(cols, tenantId, config.transactional.fromEmail, config.transactional.fromName || 'CodRix Notifications', config.transactional.provider);
      if (!synced.includes(config.transactional.fromEmail)) synced.push(config.transactional.fromEmail);
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

// POST /api/v1/settings/email/verify-smtp
router.post('/email/verify-smtp', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { host, port, secure, username, password } = req.body;
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    let testPassword = password;
    if (testPassword === '••••••••' || !testPassword) {
      const existing = await cols.tenantEmailConfigs.findOne({ tenantId });
      testPassword = existing?.smtp?.password || '';
    }

    if (!host || !username || !testPassword) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Host, username and password are required to test SMTP.' } });
      return;
    }

    const result = await EmailDispatcher.verifySmtp({
      host,
      port: Number(port) || 587,
      secure: Boolean(secure),
      username,
      password: testPassword
    });

    if (result.valid) {
      await cols.tenantEmailConfigs.updateOne(
        { tenantId },
        { $set: { 'smtp.status': 'CONNECTED', 'smtp.lastTestedAt': new Date() } }
      );
      res.json({ data: { success: true, message: result.message } });
    } else {
      await cols.tenantEmailConfigs.updateOne(
        { tenantId },
        { $set: { 'smtp.status': 'ERROR', 'smtp.lastError': result.message } }
      );
      res.status(400).json({ error: { code: 'SMTP_ERROR', message: result.message } });
    }
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
      subject: '✅ CodRix Enterprise OS — Company Domain Email Link Verified',
      text: `Hello,\n\nThis is a verification email from CodRix Multi-Tenant OS. Your company domain email routing and outbound dispatch have been connected successfully.\n\nTime: ${new Date().toLocaleString()}\nSender: ${req.auth!.user.fullName}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #E7E0FB; border-radius: 16px; background-color: #FBFBFE;">
          <h2 style="color: #120E24; margin-bottom: 8px;">CodRix Enterprise OS</h2>
          <div style="background-color: #EDE4FF; padding: 12px 16px; border-radius: 8px; color: #7C2CF5; font-weight: bold; margin-bottom: 16px;">
            ✅ Company Domain Email Linked Successfully
          </div>
          <p style="color: #585172; font-size: 14px; line-height: 1.6;">
            Your company domain email dispatch has been verified end-to-end. Outbound emails and unified shared mailboxes can now send and receive messages under your official brand domain.
          </p>
          <hr style="border: none; border-top: 1px solid #E7E0FB; margin: 20px 0;" />
          <p style="color: #585172; font-size: 12px;">Sent by <strong>${req.auth!.user.fullName}</strong> (${req.auth!.user.email}) at ${new Date().toLocaleString()}</p>
        </div>
      `
    });

    if (result.success) {
      res.json({ data: { success: true, message: `Test email dispatched via ${result.deliveryMethod}`, messageId: result.messageId } });
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
      provider: 'CUSTOM_DOMAIN',
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
