import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { getCollections } from '../../core/mongodb.js';
import { requireAuth, requireEmailTemplatesAccess } from '../../core/auth/middleware.js';
import { EmailDispatcher } from '../../core/email/emailDispatcher.js';
import { EmailTemplateService, SYSTEM_DEFAULT_TEMPLATES } from '../../core/email/emailTemplateService.js';
import { SocketService } from '../../core/socket/socketService.js';
import { AuditService } from '../../core/audit/auditService.js';

const router = Router();

// Apply auth and authorized leadership check to all template endpoints
// (Allowed: Lakshay, Diya, Parth, Anshuman, Ishita)
router.use(requireAuth, requireEmailTemplatesAccess);

// GET /api/v1/email-templates (List all system & custom templates)
router.get('/', async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    // Ensure default templates exist
    await EmailTemplateService.seedDefaultTemplates(tenantId);

    const templates = await cols.emailTemplates.find({ tenantId }).sort({ category: 1, name: 1 }).toArray();

    const formatted = templates.map((t) => ({
      ...t,
      id: t._id.toString(),
      htmlBody: t.htmlBody || '',
      bodyHtml: t.htmlBody || '',
      isDefault: t.isSystemDefault ?? true
    }));

    res.json({ data: formatted });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/v1/email-templates/:id (Fetch single template)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;
    const { id } = req.params;

    let query: any = { tenantId };
    try {
      query._id = new ObjectId(id);
    } catch {
      query.templateKey = id;
    }

    const template = await cols.emailTemplates.findOne(query);
    if (!template) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Email template not found' } });
      return;
    }

    res.json({ data: { ...template, id: template._id.toString() } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// PUT /api/v1/email-templates/:id (Modify template subject & bodies)
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;
    const { id } = req.params;
    const { subject, htmlBody, bodyHtml, textBody, name, description, variables } = req.body;

    let query: any = { tenantId };
    try {
      query._id = new ObjectId(id);
    } catch {
      query.templateKey = id;
    }

    const existing = await cols.emailTemplates.findOne(query);
    if (!existing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Email template not found' } });
      return;
    }

    const effectiveHtml = htmlBody !== undefined ? htmlBody : bodyHtml;

    const updateFields: any = {
      updatedAt: new Date(),
      updatedBy: req.auth!.user.fullName || req.auth!.user.email,
      isSystemDefault: false
    };

    if (subject !== undefined) updateFields.subject = subject.trim();
    if (effectiveHtml !== undefined) updateFields.htmlBody = effectiveHtml;
    if (textBody !== undefined) updateFields.textBody = textBody;
    if (name !== undefined) updateFields.name = name.trim();
    if (description !== undefined) updateFields.description = description.trim();
    if (variables !== undefined && Array.isArray(variables)) updateFields.variables = variables;

    await cols.emailTemplates.updateOne({ _id: existing._id }, { $set: updateFields });

    const updated = await cols.emailTemplates.findOne({ _id: existing._id });
    const resultData = {
      ...updated,
      id: updated?._id?.toString(),
      htmlBody: updated?.htmlBody || '',
      bodyHtml: updated?.htmlBody || '',
      isDefault: updated?.isSystemDefault ?? false
    };

    await AuditService.log({
      user: req.auth!.user,
      action: 'UPDATE_EMAIL_TEMPLATE',
      resourceType: 'EMAIL_TEMPLATE',
      resourceId: existing._id.toString(),
      details: {
        templateKey: existing.templateKey,
        name: existing.name,
        updatedFields: Object.keys(updateFields)
      }
    });

    SocketService.emitToTenant(tenantId, 'template:updated', { template: resultData });

    res.json({ data: resultData, message: 'Email template successfully updated and synchronized across CodRix OS.' });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/email-templates (Create custom email template)
router.post('/', async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;
    const { templateKey, name, category, subject, htmlBody, textBody, variables, description } = req.body;

    if (!templateKey || !name || !subject || !htmlBody) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'templateKey, name, subject, and htmlBody are required.' } });
      return;
    }

    const safeKey = templateKey.toUpperCase().trim().replace(/[^A-Z0-9_]/g, '_');

    const existing = await cols.emailTemplates.findOne({ tenantId, templateKey: safeKey });
    if (existing) {
      res.status(409).json({ error: { code: 'CONFLICT', message: `Template key "${safeKey}" already exists.` } });
      return;
    }

    const doc = {
      tenantId,
      templateKey: safeKey,
      name: name.trim(),
      category: category || 'GENERAL',
      description: description?.trim() || '',
      subject: subject.trim(),
      htmlBody,
      textBody: textBody || '',
      variables: Array.isArray(variables) ? variables : ['candidateName', 'portalUrl'],
      isSystemDefault: false,
      updatedBy: req.auth!.user.fullName || req.auth!.user.email,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const insertRes = await cols.emailTemplates.insertOne(doc);
    const createdData = { ...doc, id: insertRes.insertedId.toString() };

    SocketService.emitToTenant(tenantId, 'template:created', { template: createdData });

    res.status(201).json({ data: createdData });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/email-templates/:id/reset (Reset template back to master system default)
router.post('/:id/reset', async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;
    const { id } = req.params;

    let query: any = { tenantId };
    try {
      query._id = new ObjectId(id);
    } catch {
      query.templateKey = id;
    }

    const existing = await cols.emailTemplates.findOne(query);
    if (!existing) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Template not found' } });
      return;
    }

    const sysDefault = SYSTEM_DEFAULT_TEMPLATES.find((t) => t.templateKey === existing.templateKey);
    if (!sysDefault) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'No system default exists for this custom template.' } });
      return;
    }

    await cols.emailTemplates.updateOne(
      { _id: existing._id },
      {
        $set: {
          subject: sysDefault.subject,
          htmlBody: sysDefault.htmlBody,
          textBody: sysDefault.textBody,
          name: sysDefault.name,
          description: sysDefault.description,
          variables: sysDefault.variables,
          isSystemDefault: true,
          updatedBy: `${req.auth!.user.fullName} (Reset to Default)`,
          updatedAt: new Date()
        }
      }
    );

    const resetDoc = await cols.emailTemplates.findOne({ _id: existing._id });
    const resultData = { ...resetDoc, id: resetDoc?._id?.toString() };

    SocketService.emitToTenant(tenantId, 'template:updated', { template: resultData });

    res.json({ data: resultData, message: 'Template reset to system default.' });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/email-templates/:id/send-test (Dispatch a test email to verify formatting live)
router.post('/:id/send-test', async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;
    const { id } = req.params;
    const { targetEmail, customVariables } = req.body;

    const recipient = targetEmail?.trim() || req.auth!.user.email;
    if (!recipient) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Recipient email address is required.' } });
      return;
    }

    let query: any = { tenantId };
    try {
      query._id = new ObjectId(id);
    } catch {
      query.templateKey = id;
    }

    const template = await cols.emailTemplates.findOne(query);
    if (!template) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Template not found' } });
      return;
    }

    // Comprehensive sample variables for realistic live rendering
    const sampleVariables: Record<string, string> = {
      candidateName: 'Arshmeet Kaur',
      fullName: 'Lakshay',
      portalUrl: 'https://connect.codrix.co.in',
      emailToUse: 'arshmeet.kaur@codrix.co.in',
      loginEmail: 'arshmeet.kaur@codrix.co.in',
      rawPassword: 'CodRix#2026Secure!',
      password: 'CodRix#2026Secure!',
      employeeCode: 'CDX-007',
      designation: 'BDE Intern',
      jobTitle: 'Business Development Executive',
      department: 'Growth & Partnerships',
      reportingManagerName: 'Lakshay (Founder & MD)',
      roleCode: 'BDE',
      roleScopeDescription: 'Record Management System: Create, manage, and log notes/calls for your assigned leads, client accounts, and pipeline records.',
      contactName: 'Rahul Verma',
      companyName: 'Acme Enterprises',
      senderName: req.auth!.user.fullName || 'Lakshay',
      senderTitle: 'Founder & Managing Director',
      taskCode: 'ENG-204',
      taskTitle: 'Integrate Webhook Delivery Pipeline',
      priority: 'HIGH',
      ...customVariables
    };

    const rendered = EmailTemplateService.render(template as any, sampleVariables);

    const dispatchResult = await EmailDispatcher.send({
      tenantId,
      to: recipient,
      subject: `[TEST PREVIEW] ${rendered.subject}`,
      html: rendered.html,
      text: rendered.text
    });

    if (!dispatchResult.success) {
      res.status(400).json({
        error: {
          code: 'EMAIL_DISPATCH_FAILED',
          message: dispatchResult.error || 'Failed sending email. Please check your SMTP configuration.'
        }
      });
      return;
    }

    res.json({
      success: true,
      message: `Test email successfully dispatched to ${recipient}`,
      recipient,
      deliveryMethod: dispatchResult.deliveryMethod,
      info: dispatchResult.info
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

export default router;
