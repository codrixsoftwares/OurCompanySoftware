import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { getCollections } from '../../core/mongodb.js';
import { requireAuth, requirePermission, requireLakshaySuperAdmin } from '../../core/auth/middleware.js';
import { AuditService } from '../../core/audit/auditService.js';
import { uploadToCloudinary } from '../../core/cloudinary.js';
import { EmailDispatcher } from '../../core/email/emailDispatcher.js';
import { SocketService } from '../../core/socket/socketService.js';
import { EmailTemplateService } from '../../core/email/emailTemplateService.js';

const router = Router();

export const DEFAULT_STAGE_EMAIL_TEMPLATES: Record<string, { subject: string; body: string; enabled: boolean }> = {
  'Sourced': {
    enabled: true,
    subject: 'Application Received: {{jobTitle}} at {{companyName}}',
    body: `Dear {{candidateName}},

Thank you for your interest in joining {{companyName}}! We have successfully received your application for the {{jobTitle}} position (Ref: {{requisitionCode}}).

Our recruitment team is reviewing your profile and qualifications against the role requirements. If your background is a strong match, we will reach out regarding next steps.

Best regards,
Talent Acquisition Team
{{companyName}}
connect@codrix.co.in`
  },
  'Screened': {
    enabled: true,
    subject: 'Application Update: You have been shortlisted for {{jobTitle}} at {{companyName}}',
    body: `Dear {{candidateName}},

Great news! We have reviewed your application for {{jobTitle}} (Ref: {{requisitionCode}}) and are pleased to inform you that your profile has been shortlisted.

Our team will contact you shortly to coordinate an initial introductory discussion.

Warm regards,
Talent Team
{{companyName}}`
  },
  'Technical Interview': {
    enabled: true,
    subject: 'Interview Invitation: Technical Assessment for {{jobTitle}} at {{companyName}}',
    body: `Dear {{candidateName}},

Congratulations on progressing to the Technical Interview stage for the {{jobTitle}} position at {{companyName}}.

We would like to invite you for a technical assessment and problem-solving session with our engineering and architecture team. Please keep an eye on your inbox for the calendar invite and meeting link.

Best regards,
Technical Hiring Team
{{companyName}}`
  },
  'Executive Review': {
    enabled: true,
    subject: 'Executive Discussion: Next Steps for {{jobTitle}} at {{companyName}}',
    body: `Dear {{candidateName}},

You have successfully advanced to the Executive Review stage for {{jobTitle}} at {{companyName}}.

In this final evaluation stage, our executive leadership will connect with you to discuss organizational culture, long-term alignment, and strategic impact.

Warm regards,
Executive Leadership Team
{{companyName}}`
  },
  'Internship': {
    enabled: true,
    subject: 'Internship Program Invitation: {{jobTitle}} at {{companyName}}',
    body: `Dear {{candidateName}},

Congratulations! Based on your performance across our evaluation stages, we are excited to invite you to join the {{companyName}} Internship Program for the {{jobTitle}} role.

Our HR team will reach out with your project scope, mentor assignment, and onboarding schedule.

Welcome aboard!
People & Culture Team
{{companyName}}`
  },
  'Offer Extended': {
    enabled: true,
    subject: 'Formal Offer: Welcome to {{companyName}} - {{jobTitle}}',
    body: `Dear {{candidateName}},

On behalf of {{companyName}}, we are delighted to extend a formal offer of employment for the position of {{jobTitle}}!

Your compensation package, benefits overview, and start date details are being prepared and will be shared with you shortly.

Congratulations on this milestone!

Sincerely,
Founder & Executive Management
{{companyName}}`
  },
  'Hired': {
    enabled: true,
    subject: 'Welcome to the {{companyName}} Family!',
    body: `Dear {{candidateName}},

Welcome to {{companyName}}! Your official transition to active Employee status is now complete.

We are thrilled to have you with us on our mission to build cutting-edge enterprise cloud software.

Best wishes for a rewarding journey ahead!

Warm regards,
People Operations Team
{{companyName}}`
  }
};

/**
 * Triggers automated candidate journey email for a specific pipeline stage
 */
export async function triggerStageJourneyEmail(applicationId: string, stageName: string, cols: any, tenantId: string) {
  try {
    const app = await cols.applications.findOne({ _id: new ObjectId(applicationId) });
    if (!app) return;

    const [candidate, job] = await Promise.all([
      cols.candidates.findOne({ _id: new ObjectId(app.candidateId) }),
      cols.jobOpenings.findOne({ _id: new ObjectId(app.jobOpeningId) })
    ]);

    if (!candidate || !candidate.emailNormalized) return;

    // Check templates on job opening or fallback to defaults
    const templateConfig = job?.emailTemplates?.[stageName] || DEFAULT_STAGE_EMAIL_TEMPLATES[stageName];
    if (!templateConfig || templateConfig.enabled === false) return;

    // Respected Candidate Serial & Unique Request Number
    let serialNo = candidate.serialNo || app.serialNo;
    if (!serialNo) {
      const allCandidates = await cols.candidates.find({ tenantId }).sort({ createdAt: 1, _id: 1 }).toArray();
      const idx = allCandidates.findIndex((c: any) => c._id.toString() === candidate._id.toString());
      serialNo = idx >= 0 ? idx + 1 : 1;
      await cols.candidates.updateOne({ _id: candidate._id }, { $set: { serialNo } });
      await cols.applications.updateOne({ _id: app._id }, { $set: { serialNo } });
    }

    const candidateSerialFormatted = serialNo.toString().padStart(3, '0');
    // Unique Request Number matching the respected candidate serial number (e.g. REQ-0001 for #1, REQ-0002 for #2)
    const requestNo = candidate.requestNo || app.requestNo || `REQ-${serialNo.toString().padStart(4, '0')}`;
    const requisitionCode = requestNo; // Overwrite requisitionCode token so all templates get the distinct candidate request number!

    const candidateName = candidate.fullName || 'Candidate';
    const jobTitle = job?.title || 'Open Position';
    const companyName = 'CodRix Private Limited';

    const subject = (templateConfig.subject || `Application Update: ${stageName}`)
      .replace(/{{candidateName}}/g, candidateName)
      .replace(/{{jobTitle}}/g, jobTitle)
      .replace(/{{requestNo}}/g, requestNo)
      .replace(/{{requisitionCode}}/g, requestNo)
      .replace(/{{candidateSerialNo}}/g, candidateSerialFormatted)
      .replace(/{{serialNo}}/g, serialNo.toString())
      .replace(/{{companyName}}/g, companyName)
      .replace(/{{stageName}}/g, stageName);

    const bodyText = (templateConfig.body || `Hello ${candidateName}, your application for ${jobTitle} has moved to stage: ${stageName}.`)
      .replace(/{{candidateName}}/g, candidateName)
      .replace(/{{jobTitle}}/g, jobTitle)
      .replace(/{{requestNo}}/g, requestNo)
      .replace(/{{requisitionCode}}/g, requestNo)
      .replace(/{{candidateSerialNo}}/g, candidateSerialFormatted)
      .replace(/{{serialNo}}/g, serialNo.toString())
      .replace(/{{companyName}}/g, companyName)
      .replace(/{{stageName}}/g, stageName);

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #E7E0FB; border-radius: 16px; background-color: #FBFBFE;">
        <div style="margin-bottom: 20px; border-bottom: 1px solid #E7E0FB; padding-bottom: 14px;">
          <h2 style="color: #120E24; margin: 0; font-size: 20px;">CodRix Careers</h2>
          <span style="color: #7C2CF5; font-size: 12px; font-weight: bold;">${jobTitle} • Request Ref: ${requestNo} (Candidate #${serialNo})</span>
        </div>
        <div style="color: #120E24; font-size: 14px; line-height: 1.7; white-space: pre-line;">
          ${bodyText}
        </div>
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #E7E0FB; font-size: 11px; color: #585172;">
          © ${new Date().getFullYear()} ${companyName}. Official Applicant Communication.
        </div>
      </div>
    `;

    const fromSenderEmail = job?.senderEmail || 'careers@codrix.co.in';
    const fromSenderName = job?.senderName || 'CodRix Careers';
    const fromAddress = `"${fromSenderName}" <${fromSenderEmail}>`;
    const replyToAddress = job?.replyToEmail || fromSenderEmail;

    const dispatchResult = await EmailDispatcher.send({
      tenantId,
      from: fromAddress,
      to: candidate.emailNormalized,
      subject,
      text: bodyText,
      html: htmlBody,
      replyTo: replyToAddress,
      channelEmail: fromSenderEmail
    });

    const journeyLog = {
      stageName,
      sentAt: new Date(),
      subject,
      sender: fromSenderEmail,
      deliveryMethod: dispatchResult.deliveryMethod,
      messageId: dispatchResult.messageId,
      success: dispatchResult.success,
      error: dispatchResult.error
    };

    // Append to candidate journey log
    await cols.candidates.updateOne(
      { _id: candidate._id },
      {
        $push: { journeyEmailsSent: journeyLog } as any,
        $set: { updatedAt: new Date() }
      }
    );

    // Also register in emailMessages
    await cols.emailMessages.insertOne({
      tenantId,
      providerMessageId: dispatchResult.messageId || `journey_${Date.now()}`,
      direction: 'OUTBOUND',
      sender: fromSenderEmail,
      recipients: [candidate.emailNormalized],
      subject,
      snippet: bodyText.slice(0, 100),
      bodyText,
      bodyHtml: htmlBody,
      receivedAt: new Date(),
      stageName,
      candidateId: candidate._id.toString()
    });

    // Notify via real-time Socket.IO
    SocketService.emitToTenant(tenantId, 'journey:email_sent', {
      candidateId: candidate._id.toString(),
      stageName,
      journeyLog
    });

    console.log(`✉️ Automated Journey Email dispatched from ${fromSenderEmail} to ${candidate.emailNormalized} for [${stageName}] via ${dispatchResult.deliveryMethod}`);
  } catch (err: any) {
    console.error(`Failed dispatching journey email for stage ${stageName}:`, err.message);
  }
}

// GET /api/v1/recruitment/jobs
router.get('/jobs', requireAuth, requirePermission('recruitment', 'jobs', 'view'), async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;
    const jobs = await cols.jobOpenings.find({ tenantId }).sort({ createdAt: -1 }).toArray();

    // Attach applicant count per job
    const applications = await cols.applications.find({ tenantId }).toArray();
    const appCountByJob: Record<string, number> = {};
    for (const app of applications) {
      if (app.jobOpeningId) {
        appCountByJob[app.jobOpeningId] = (appCountByJob[app.jobOpeningId] || 0) + 1;
      }
    }

    res.json({
      data: jobs.map((j) => ({
        ...j,
        id: j._id.toString(),
        applicantCount: appCountByJob[j._id.toString()] || 0
      }))
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/v1/recruitment/jobs/:id
router.get('/jobs/:id', requireAuth, requirePermission('recruitment', 'jobs', 'view'), async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const job = await cols.jobOpenings.findOne({ _id: new ObjectId(req.params.id) });
    if (!job) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Job opening not found' } });
      return;
    }
    const applicantCount = await cols.applications.countDocuments({ jobOpeningId: req.params.id });
    res.json({ data: { ...job, id: job._id.toString(), applicantCount } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/recruitment/jobs (Industry-standard creation + Journey Email Builder)
router.post('/jobs', requireAuth, requirePermission('recruitment', 'jobs', 'create'), async (req: Request, res: Response) => {
  try {
    const {
      title,
      departmentId,
      openingType,
      workplaceMode,
      experienceLevel,
      headcount,
      description,
      skills,
      salaryMin,
      salaryMax,
      location,
      emailTemplates,
      senderEmail,
      senderName,
      replyToEmail,
      emailProvider,
      status
    } = req.body;

    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;
    const count = await cols.jobOpenings.countDocuments({ tenantId });
    const requisitionCode = `REQ-${(count + 1).toString().padStart(4, '0')}`;

    const newJob = {
      tenantId,
      requisitionCode,
      title: title.trim(),
      departmentId: departmentId || 'Engineering',
      openingType: openingType || 'Full-time',
      workplaceMode: workplaceMode || 'Hybrid',
      experienceLevel: experienceLevel || '1-3 Years',
      headcount: Number(headcount) || 1,
      description: description || `${title} at CodRix Private Limited`,
      skills: skills || '',
      salaryMin: Number(salaryMin) || 0,
      salaryMax: Number(salaryMax) || 0,
      location: location || 'Bangalore (Hybrid)',
      emailTemplates: emailTemplates || DEFAULT_STAGE_EMAIL_TEMPLATES,
      senderEmail: senderEmail || 'careers@codrix.co.in',
      senderName: senderName || 'CodRix Careers',
      replyToEmail: replyToEmail || senderEmail || 'careers@codrix.co.in',
      emailProvider: emailProvider || 'GOOGLE_WORKSPACE',
      status: status || 'OPEN',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await cols.jobOpenings.insertOne(newJob);
    const job = { ...newJob, id: result.insertedId.toString(), applicantCount: 0 };

    await AuditService.log({
      user: req.auth!.user,
      action: 'JOB_OPENING_CREATE',
      resourceType: 'JOB_OPENING',
      resourceId: job.id,
      details: { title, requisitionCode, openingType: newJob.openingType }
    });

    SocketService.emitToTenant(tenantId, 'recruitment:job_created', { job });

    res.status(201).json({ data: job });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// PUT /api/v1/recruitment/jobs/:id (Superadmin Edit Job Opening + Journey Email Templates)
router.put('/jobs/:id', requireAuth, requirePermission('recruitment', 'jobs', 'create'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const {
      title,
      departmentId,
      openingType,
      workplaceMode,
      experienceLevel,
      headcount,
      description,
      skills,
      salaryMin,
      salaryMax,
      location,
      emailTemplates,
      senderEmail,
      senderName,
      replyToEmail,
      emailProvider,
      status
    } = req.body;

    const cols = getCollections();
    const updateFields: any = {
      updatedAt: new Date()
    };

    if (title) updateFields.title = title.trim();
    if (departmentId) updateFields.departmentId = departmentId;
    if (openingType) updateFields.openingType = openingType;
    if (workplaceMode) updateFields.workplaceMode = workplaceMode;
    if (experienceLevel) updateFields.experienceLevel = experienceLevel;
    if (headcount !== undefined) updateFields.headcount = Number(headcount);
    if (description !== undefined) updateFields.description = description;
    if (skills !== undefined) updateFields.skills = skills;
    if (salaryMin !== undefined) updateFields.salaryMin = Number(salaryMin);
    if (salaryMax !== undefined) updateFields.salaryMax = Number(salaryMax);
    if (location !== undefined) updateFields.location = location;
    if (emailTemplates !== undefined) updateFields.emailTemplates = emailTemplates;
    if (senderEmail !== undefined) updateFields.senderEmail = senderEmail;
    if (senderName !== undefined) updateFields.senderName = senderName;
    if (replyToEmail !== undefined) updateFields.replyToEmail = replyToEmail;
    if (emailProvider !== undefined) updateFields.emailProvider = emailProvider;
    if (status !== undefined) updateFields.status = status;

    await cols.jobOpenings.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    const updated = await cols.jobOpenings.findOne({ _id: new ObjectId(id) });
    const applicantCount = await cols.applications.countDocuments({ jobOpeningId: id });

    await AuditService.log({
      user: req.auth!.user,
      action: 'JOB_OPENING_UPDATE',
      resourceType: 'JOB_OPENING',
      resourceId: id,
      details: updateFields
    });

    const tenantId = req.auth!.user.tenantId;
    SocketService.emitToTenant(tenantId, 'recruitment:job_updated', { job: updated });

    res.json({ data: { ...updated, id: updated!._id.toString(), applicantCount } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/recruitment/jobs/:id/test-journey-email (Send Test Stage Email)
router.post('/jobs/:id/test-journey-email', requireAuth, requirePermission('recruitment', 'jobs', 'create'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { stageName, targetEmail, customSubject, customBody, senderEmail, senderName, replyToEmail } = req.body;
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    const job = await cols.jobOpenings.findOne({ _id: new ObjectId(id) });
    if (!job) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Job opening not found' } });
      return;
    }

    const templateConfig = job?.emailTemplates?.[stageName] || DEFAULT_STAGE_EMAIL_TEMPLATES[stageName] || {};
    const candidateName = req.auth!.user.fullName || 'Lakshay (Candidate Preview)';
    const jobTitle = job.title;
    const serialNo = 1;
    const requestNo = `REQ-${serialNo.toString().padStart(4, '0')}`;
    const candidateSerialFormatted = serialNo.toString().padStart(3, '0');
    const companyName = 'CodRix Private Limited';

    const subject = (customSubject || templateConfig.subject || `Application Update: ${stageName}`)
      .replace(/{{candidateName}}/g, candidateName)
      .replace(/{{jobTitle}}/g, jobTitle)
      .replace(/{{requestNo}}/g, requestNo)
      .replace(/{{requisitionCode}}/g, requestNo)
      .replace(/{{candidateSerialNo}}/g, candidateSerialFormatted)
      .replace(/{{serialNo}}/g, serialNo.toString())
      .replace(/{{companyName}}/g, companyName)
      .replace(/{{stageName}}/g, stageName);

    const bodyText = (customBody || templateConfig.body || `Hello ${candidateName}, your application for ${jobTitle} has moved to stage: ${stageName}.`)
      .replace(/{{candidateName}}/g, candidateName)
      .replace(/{{jobTitle}}/g, jobTitle)
      .replace(/{{requestNo}}/g, requestNo)
      .replace(/{{requisitionCode}}/g, requestNo)
      .replace(/{{candidateSerialNo}}/g, candidateSerialFormatted)
      .replace(/{{serialNo}}/g, serialNo.toString())
      .replace(/{{companyName}}/g, companyName)
      .replace(/{{stageName}}/g, stageName);

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #E7E0FB; border-radius: 16px; background-color: #FBFBFE;">
        <div style="margin-bottom: 20px; border-bottom: 1px solid #E7E0FB; padding-bottom: 14px;">
          <h2 style="color: #120E24; margin: 0; font-size: 20px;">CodRix Careers [TEST PREVIEW]</h2>
          <span style="color: #7C2CF5; font-size: 12px; font-weight: bold;">${jobTitle} • Request Ref: ${requestNo} (Candidate #${serialNo}) • Stage: ${stageName}</span>
        </div>
        <div style="background-color: #EDE4FF; padding: 10px 14px; border-radius: 8px; color: #7C2CF5; font-size: 11px; margin-bottom: 16px;">
          🧪 <strong>Test Delivery Verification:</strong> This is a live preview test for the <strong>${stageName}</strong> stage email. Dispatched to <strong>${targetEmail || req.auth!.user.email}</strong>.
        </div>
        <div style="color: #120E24; font-size: 14px; line-height: 1.7; white-space: pre-line;">
          ${bodyText}
        </div>
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #E7E0FB; font-size: 11px; color: #585172;">
          © ${new Date().getFullYear()} ${companyName}. Official Candidate Communication Preview.
        </div>
      </div>
    `;

    const outSenderEmail = senderEmail || job.senderEmail || 'careers@codrix.co.in';
    const outSenderName = senderName || job.senderName || 'CodRix Careers';
    const outReplyTo = replyToEmail || job.replyToEmail || outSenderEmail;

    const result = await EmailDispatcher.send({
      tenantId,
      from: `"${outSenderName}" <${outSenderEmail}>`,
      to: targetEmail || req.auth!.user.email,
      subject: `[TEST PREVIEW] ${subject}`,
      text: bodyText,
      html: htmlBody,
      replyTo: outReplyTo,
      channelEmail: outSenderEmail
    });

    if (result.success) {
      res.json({
        data: {
          success: true,
          deliveryMethod: result.deliveryMethod,
          messageId: result.messageId,
          message: `Live test email successfully dispatched to ${targetEmail || req.auth!.user.email} via ${result.deliveryMethod}!`
        }
      });
    } else {
      res.status(400).json({
        error: {
          code: 'SEND_FAILED',
          message: result.error || 'Failed to dispatch test journey email'
        }
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// DELETE /api/v1/recruitment/jobs/:id (Founder & Superadmin Delete Job Opening Only)
router.delete('/jobs/:id', requireAuth, requireLakshaySuperAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const cols = getCollections();
    const job = await cols.jobOpenings.findOne({ _id: new ObjectId(id) });
    if (!job) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Job opening not found' } });
      return;
    }

    await cols.jobOpenings.deleteOne({ _id: new ObjectId(id) });

    await AuditService.log({
      user: req.auth!.user,
      action: 'JOB_OPENING_DELETE',
      resourceType: 'JOB_OPENING',
      resourceId: id,
      details: { title: job.title, requisitionCode: job.requisitionCode }
    });

    const tenantId = req.auth!.user.tenantId;
    SocketService.emitToTenant(tenantId, 'recruitment:job_deleted', { id, requisitionCode: job.requisitionCode });

    res.json({ data: { success: true, message: `Job opening ${job.requisitionCode} deleted successfully` } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/v1/recruitment/pipeline
router.get('/pipeline', requireAuth, requirePermission('recruitment', 'candidates', 'view'), async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    const stages = await cols.pipelineStages.find({ tenantId }).sort({ stageOrder: 1 }).toArray();
    const applications = await cols.applications.find({ tenantId }).toArray();
    const candidates = await cols.candidates.find({ tenantId }).toArray();
    const jobs = await cols.jobOpenings.find({ tenantId }).toArray();

    const candidateMap = new Map(candidates.map((c) => [c._id.toString(), c]));
    const jobMap = new Map(jobs.map((j) => [j._id.toString(), j]));

    const enrichedStages = stages.map((stage) => {
      const stageId = stage._id.toString();
      const stageApps = applications
        .filter((app) => app.stageId === stageId)
        .map((app: any) => {
          const cand: any = candidateMap.get(app.candidateId) || {};
          const job: any = jobMap.get(app.jobOpeningId) || {};
          const serialNo = cand.serialNo || app.serialNo;
          const requestNo = cand.requestNo || app.requestNo || (serialNo ? `REQ-${serialNo.toString().padStart(4, '0')}` : undefined);
          return {
            id: app._id.toString(),
            candidateId: app.candidateId,
            serialNo,
            requestNo,
            jobOpeningId: app.jobOpeningId,
            stageId: app.stageId,
            status: app.status || 'ACTIVE',
            appliedAt: app.appliedAt,
            candidate: {
              id: app.candidateId,
              serialNo,
              requestNo,
              fullName: cand.fullName || 'Candidate',
              emailNormalized: cand.emailNormalized || '',
              phoneNormalized: cand.phoneNormalized || '',
              source: cand.source || 'CAREERS_PAGE',
              resumeUrl: cand.resumeUrl,
              notes: cand.notes,
              credentials: cand.credentials || app.credentials || null,
              journeyEmailsSent: cand.journeyEmailsSent || []
            },
            jobOpening: {
              id: app.jobOpeningId,
              title: job.title || 'Role',
              requisitionCode: requestNo || job.requisitionCode || 'REQ',
              jobRequisitionCode: job.requisitionCode || 'REQ',
              openingType: job.openingType || 'Full-time',
              departmentId: job.departmentId || 'General'
            }
          };
        });

      return {
        id: stageId,
        name: stage.name,
        stageOrder: stage.stageOrder,
        applications: stageApps
      };
    });

    res.json({ data: enrichedStages });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/v1/recruitment/candidates/:id (Candidate 360 Full Profile)
router.get('/candidates/:id', requireAuth, requirePermission('recruitment', 'candidates', 'view'), async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const candidateId = req.params.id;
    const candidate = await cols.candidates.findOne({ _id: new ObjectId(candidateId) });
    if (!candidate) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Candidate not found' } });
      return;
    }

    const application = await cols.applications.findOne({ candidateId });
    let job = null;
    let stage = null;
    if (application) {
      if (application.jobOpeningId) {
        job = await cols.jobOpenings.findOne({ _id: new ObjectId(application.jobOpeningId) });
      }
      if (application.stageId) {
        stage = await cols.pipelineStages.findOne({ _id: new ObjectId(application.stageId) });
      }
    }

    const emails = await cols.emailMessages.find({
      $or: [
        { candidateId },
        { recipients: candidate.emailNormalized },
        { sender: candidate.emailNormalized }
      ]
    }).sort({ receivedAt: -1 }).toArray();

    res.json({
      data: {
        id: candidate._id.toString(),
        serialNo: candidate.serialNo || application?.serialNo,
        requestNo: candidate.requestNo || application?.requestNo,
        fullName: candidate.fullName,
        emailNormalized: candidate.emailNormalized,
        phoneNormalized: candidate.phoneNormalized,
        source: candidate.source,
        resumeUrl: candidate.resumeUrl,
        notes: candidate.notes,
        credentials: candidate.credentials || application?.credentials || null,
        journeyEmailsSent: candidate.journeyEmailsSent || [],
        createdAt: candidate.createdAt,
        application: application ? {
          id: application._id.toString(),
          serialNo: application.serialNo || candidate.serialNo,
          requestNo: application.requestNo || candidate.requestNo,
          stageId: application.stageId,
          stageName: stage?.name || 'Sourced',
          jobOpeningId: application.jobOpeningId,
          jobTitle: job?.title || 'Open Position',
          requisitionCode: application.requestNo || candidate.requestNo || job?.requisitionCode || 'REQ',
          jobRequisitionCode: job?.requisitionCode || 'REQ',
          appliedAt: application.appliedAt,
          status: application.status
        } : null,
        emails: emails.map(e => ({ ...e, id: e._id.toString() }))
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// PUT /api/v1/recruitment/candidates/:id (Full CRUD Update Candidate Profile & Requisition)
router.put('/candidates/:id', requireAuth, requirePermission('recruitment', 'candidates', 'edit'), async (req: Request, res: Response) => {
  try {
    const candidateId = req.params.id;
    const { fullName, email, phone, notes, resumeUrl, source, jobOpeningId, stageId, status } = req.body;
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    const candidate = await cols.candidates.findOne({ _id: new ObjectId(candidateId) });
    if (!candidate) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Candidate not found.' } });
      return;
    }

    const candUpdates: any = { updatedAt: new Date() };
    if (fullName) candUpdates.fullName = fullName.trim();
    if (email) candUpdates.emailNormalized = email.toLowerCase().trim();
    if (phone !== undefined) candUpdates.phoneNormalized = phone.trim();
    if (notes !== undefined) candUpdates.notes = notes;
    if (resumeUrl !== undefined) candUpdates.resumeUrl = resumeUrl;
    if (source !== undefined) candUpdates.source = source;

    await cols.candidates.updateOne(
      { _id: new ObjectId(candidateId) },
      { $set: candUpdates }
    );

    // Update Application if associated
    const appUpdates: any = { updatedAt: new Date() };
    if (jobOpeningId) appUpdates.jobOpeningId = jobOpeningId;
    if (status) appUpdates.status = status;

    let stageChanged = false;
    let targetStageName = '';
    if (stageId) {
      const stage = await cols.pipelineStages.findOne({ _id: new ObjectId(stageId) });
      if (stage) {
        appUpdates.stageId = stageId;
        stageChanged = true;
        targetStageName = stage.name;
      }
    }

    const application = await cols.applications.findOne({ candidateId });
    if (application) {
      await cols.applications.updateOne(
        { _id: application._id },
        { $set: appUpdates }
      );

      // If stage changed via edit, trigger journey email automatically
      if (stageChanged && targetStageName) {
        await triggerStageJourneyEmail(application._id.toString(), targetStageName, cols, tenantId);
      }
    }

    await AuditService.log({
      user: req.auth!.user,
      action: 'CANDIDATE_UPDATE',
      resourceType: 'CANDIDATE',
      resourceId: candidateId,
      details: { ...candUpdates, appUpdates }
    });

    SocketService.emitToTenant(tenantId, 'recruitment:candidate_updated', { candidateId });

    res.json({
      data: {
        success: true,
        message: 'Candidate profile updated successfully',
        candidateId
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// DELETE /api/v1/recruitment/candidates/:id (Founder & Superadmin Delete Candidate Only)
router.delete('/candidates/:id', requireAuth, requireLakshaySuperAdmin, async (req: Request, res: Response) => {
  try {
    const candidateId = req.params.id;
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    const candidate = await cols.candidates.findOne({ _id: new ObjectId(candidateId) });
    if (!candidate) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Candidate not found.' } });
      return;
    }

    // Delete candidate record
    await cols.candidates.deleteOne({ _id: new ObjectId(candidateId) });

    // Delete all linked applications
    await cols.applications.deleteMany({ candidateId });

    // Delete related email notes or candidate-specific messages if desired
    await cols.emailNotes.deleteMany({ candidateId });

    await AuditService.log({
      user: req.auth!.user,
      action: 'CANDIDATE_DELETE',
      resourceType: 'CANDIDATE',
      resourceId: candidateId,
      details: { fullName: candidate.fullName, email: candidate.emailNormalized }
    });

    SocketService.emitToTenant(tenantId, 'recruitment:candidate_deleted', { candidateId });

    res.json({
      data: {
        success: true,
        message: `Candidate ${candidate.fullName} and linked applications deleted successfully.`
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/recruitment/candidates/batch-delete (Founder & Superadmin Batch Delete Candidates)
router.post('/candidates/batch-delete', requireAuth, requireLakshaySuperAdmin, async (req: Request, res: Response) => {
  try {
    const { candidateIds } = req.body;
    if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'candidateIds array is required' } });
      return;
    }

    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    const objectIds = candidateIds
      .map((id: string) => {
        try {
          return new ObjectId(id);
        } catch {
          return null;
        }
      })
      .filter((id): id is ObjectId => id !== null);

    // Delete candidate documents
    await cols.candidates.deleteMany({ _id: { $in: objectIds } });

    // Delete associated applications and email notes
    await cols.applications.deleteMany({
      $or: [
        { candidateId: { $in: candidateIds } },
        { candidateId: { $in: objectIds } }
      ]
    });
    await cols.emailNotes.deleteMany({
      $or: [
        { candidateId: { $in: candidateIds } },
        { candidateId: { $in: objectIds } }
      ]
    });

    await AuditService.log({
      user: req.auth!.user,
      action: 'CANDIDATE_BATCH_DELETE',
      resourceType: 'CANDIDATE',
      resourceId: 'BATCH',
      details: { count: candidateIds.length, candidateIds }
    });

    SocketService.emitToTenant(tenantId, 'recruitment:candidates_batch_deleted', { candidateIds });

    res.json({ data: { success: true, count: candidateIds.length } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/recruitment/candidates/:id/notes (Add Internal Evaluation Note)
router.post('/candidates/:id/notes', requireAuth, requirePermission('recruitment', 'candidates', 'edit'), async (req: Request, res: Response) => {
  try {
    const candidateId = req.params.id;
    const { noteText } = req.body;
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    if (!noteText || !noteText.trim()) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Note text cannot be empty.' } });
      return;
    }

    const candidate = await cols.candidates.findOne({ _id: new ObjectId(candidateId) });
    if (!candidate) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Candidate not found.' } });
      return;
    }

    const timestamp = new Date().toLocaleString();
    const author = req.auth!.user.fullName || 'Admin/HR';
    const noteEntry = `[${timestamp} - ${author}]: ${noteText.trim()}`;

    const existingNotes = candidate.notes ? `${candidate.notes}\n\n${noteEntry}` : noteEntry;

    await cols.candidates.updateOne(
      { _id: new ObjectId(candidateId) },
      { $set: { notes: existingNotes, updatedAt: new Date() } }
    );

    SocketService.emitToTenant(tenantId, 'recruitment:candidate_updated', { candidateId, notes: existingNotes });

    res.json({ data: { success: true, notes: existingNotes } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/recruitment/candidates (Candidate Intake + Auto Journey Email Dispatch)
router.post('/candidates', requireAuth, requirePermission('recruitment', 'candidates', 'create'), async (req: Request, res: Response) => {
  try {
    const { fullName, email, phone, source, resumeBase64, resumeUrl: directResumeUrl, notes, jobOpeningId } = req.body;
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    if (!fullName || !fullName.trim()) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Candidate full name is required.' } });
      return;
    }

    if (!email || !email.trim()) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Candidate email address is required.' } });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    let uploadedResumeUrl = directResumeUrl;
    if (resumeBase64) {
      uploadedResumeUrl = await uploadToCloudinary(resumeBase64, 'resumes');
    }

    let candidate = await cols.candidates.findOne({ tenantId, emailNormalized: normalizedEmail });
    let isDuplicate = false;

    if (!candidate) {
      const existingCount = await cols.candidates.countDocuments({ tenantId });
      const serialNo = existingCount + 1;
      const requestNo = `REQ-${serialNo.toString().padStart(4, '0')}`;

      const candDoc = {
        tenantId,
        serialNo,
        requestNo,
        fullName: fullName.trim(),
        emailNormalized: normalizedEmail,
        phoneNormalized: phone ? phone.trim() : '',
        source: source || 'CAREERS_PAGE',
        resumeUrl: uploadedResumeUrl,
        notes,
        journeyEmailsSent: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const candRes = await cols.candidates.insertOne(candDoc);
      candidate = { ...candDoc, _id: candRes.insertedId };
    } else {
      isDuplicate = true;
    }

    const candidateId = candidate._id.toString();
    let application: any = null;

    let targetJobId = jobOpeningId;
    if (!targetJobId) {
      const firstJob = await cols.jobOpenings.findOne({ tenantId });
      if (firstJob) {
        targetJobId = firstJob._id.toString();
      }
    }

    if (targetJobId) {
      let defaultStage = await cols.pipelineStages.findOne({ tenantId }, { sort: { stageOrder: 1 } });
      if (!defaultStage) {
        const stageRes = await cols.pipelineStages.insertOne({
          tenantId,
          name: 'Sourced',
          stageOrder: 1,
          isSystem: true,
          createdAt: new Date()
        });
        defaultStage = { _id: stageRes.insertedId, name: 'Sourced' } as any;
      }

      const serialNo = candidate.serialNo || (await cols.candidates.countDocuments({ tenantId }));
      const requestNo = candidate.requestNo || `REQ-${serialNo.toString().padStart(4, '0')}`;

      const appDoc = {
        tenantId,
        candidateId,
        serialNo,
        requestNo,
        jobOpeningId: targetJobId,
        stageId: defaultStage!._id.toString(),
        status: 'ACTIVE',
        appliedAt: new Date(),
        updatedAt: new Date()
      };
      const appRes = await cols.applications.insertOne(appDoc);
      application = { ...appDoc, id: appRes.insertedId.toString() };

      // Dispatch automated Sourced journey email!
      await triggerStageJourneyEmail(application.id, defaultStage!.name || 'Sourced', cols, tenantId);
    }

    await AuditService.log({
      user: req.auth!.user,
      action: 'CANDIDATE_INTAKE',
      resourceType: 'CANDIDATE',
      resourceId: candidateId,
      details: { fullName, email: normalizedEmail, jobOpeningId: targetJobId, isDuplicate }
    });

    SocketService.emitToTenant(tenantId, 'recruitment:candidate_new', { candidateId, application });

    res.status(201).json({
      data: {
        candidate: { ...candidate, id: candidateId },
        application,
        isDuplicate
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// PATCH /api/v1/recruitment/applications/:id/stage (Stage Advance + Auto Journey Email Dispatch)
router.patch('/applications/:id/stage', requireAuth, requirePermission('recruitment', 'candidates', 'shortlist'), async (req: Request, res: Response) => {
  try {
    const { stageId } = req.body;
    const applicationId = req.params.id;
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    const targetStage = await cols.pipelineStages.findOne({ _id: new ObjectId(stageId) });
    if (!targetStage) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Target stage not found' } });
      return;
    }

    await cols.applications.updateOne(
      { _id: new ObjectId(applicationId) },
      { $set: { stageId, updatedAt: new Date() } }
    );

    // Trigger automated Journey Email for this newly reached stage!
    await triggerStageJourneyEmail(applicationId, targetStage.name, cols, tenantId);

    await AuditService.log({
      user: req.auth!.user,
      action: 'APPLICATION_STAGE_TRANSITION',
      resourceType: 'APPLICATION',
      resourceId: applicationId,
      details: { stageId, stageName: targetStage.name }
    });

    SocketService.emitToTenant(tenantId, 'recruitment:stage_changed', { applicationId, stageId, stageName: targetStage.name });

    res.json({ data: { id: applicationId, stageId, stageName: targetStage.name } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/recruitment/applications/:id/convert-to-employee
router.post('/applications/:id/convert-to-employee', requireAuth, requirePermission('recruitment', 'offers', 'draft'), async (req: Request, res: Response) => {
  try {
    const applicationId = req.params.id;
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    const application = await cols.applications.findOne({ _id: new ObjectId(applicationId) });
    if (!application) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found' } });
      return;
    }

    const candidate = await cols.candidates.findOne({ _id: new ObjectId(application.candidateId) });
    const job = await cols.jobOpenings.findOne({ _id: new ObjectId(application.jobOpeningId) });
    const empCount = await cols.employees.countDocuments({ tenantId });
    const employeeCode = `CDX-${(empCount + 101).toString()}`;

    // Create Employee in MongoDB Atlas
    const empDoc = {
      tenantId,
      employeeCode,
      jobTitle: job?.title || 'Software Engineer',
      fullName: candidate?.fullName || 'New Hire',
      email: candidate?.emailNormalized,
      employmentStatus: 'ACTIVE',
      joinedOn: new Date()
    };
    const empRes = await cols.employees.insertOne(empDoc);

    // Update Application status
    await cols.applications.updateOne(
      { _id: new ObjectId(applicationId) },
      { $set: { status: 'HIRED', updatedAt: new Date() } }
    );

    // Trigger Hired journey email
    await triggerStageJourneyEmail(applicationId, 'Hired', cols, tenantId);

    res.status(201).json({ data: { ...empDoc, id: empRes.insertedId.toString() } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/recruitment/candidates/:id/provision-credentials
// Admin & HR: Provisions login credentials, employee ID, role-based scope, and dispatches credentials email
router.post('/candidates/:id/provision-credentials', requireAuth, async (req: Request, res: Response) => {
  try {
    const candidateId = req.params.id;
    const {
      applicationId,
      loginEmail,
      password: inputPassword,
      designation = 'Business Development Executive (BDE)',
      roleCode = 'BDE',
      department = 'Sales & Growth',
      reportingManagerId,
      reportingManagerName = 'Suryansh Thakur (Growth Officer)',
      sendEmail = true
    } = req.body;

    const callerRoles = req.auth!.user.roles;
    const isAuthorized = callerRoles.some((r) =>
      ['COMPANY_ADMIN', 'SUPER_ADMIN', 'HR_MANAGER', 'HR_EXEC'].includes(r)
    );
    if (!isAuthorized) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only Admin and HR are authorized to provision employee credentials' } });
      return;
    }

    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    const candidate = await cols.candidates.findOne({ _id: new ObjectId(candidateId) });
    if (!candidate) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Candidate not found in MongoDB' } });
      return;
    }

    // Auto-generate strong password if not supplied
    const rawPassword = inputPassword?.trim() || `CodRix@${Math.floor(1000 + Math.random() * 9000)}!`;
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const emailToUse = (loginEmail || candidate.emailNormalized || '').toLowerCase().trim();
    if (!emailToUse) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Valid login email is required' } });
      return;
    }

    // Generate unique employee code CDX-XXX
    const empCount = await cols.employees.countDocuments({ tenantId });
    const employeeCode = `CDX-${(empCount + 101).toString()}`;

    // 1. Create / Update User record in MongoDB Atlas
    let user = await cols.users.findOne({ primaryEmail: emailToUse });
    if (!user) {
      const userRes = await cols.users.insertOne({
        primaryEmail: emailToUse,
        passwordHash,
        fullName: candidate.fullName,
        phone: candidate.phoneNormalized,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      user = await cols.users.findOne({ _id: userRes.insertedId });
    } else {
      await cols.users.updateOne(
        { _id: user._id },
        {
          $set: {
            passwordHash,
            fullName: candidate.fullName,
            phone: candidate.phoneNormalized,
            status: 'ACTIVE',
            updatedAt: new Date()
          }
        }
      );
    }
    const userId = user!._id.toString();

    // 2. Create / Update Employee record in MongoDB Atlas
    let employee = await cols.employees.findOne({ tenantId, userId });
    const employeePayload = {
      tenantId,
      userId,
      employeeCode: employee?.employeeCode || employeeCode,
      fullName: candidate.fullName,
      email: emailToUse,
      personalEmail: candidate.emailNormalized,
      phone: candidate.phoneNormalized,
      jobTitle: designation,
      roleCode,
      department,
      reportingManagerId: reportingManagerId || '',
      reportingManagerName: reportingManagerName || 'Suryansh Thakur (Growth Officer)',
      employmentStatus: 'ACTIVE',
      isIntern: roleCode === 'INTERN' || designation.toLowerCase().includes('intern'),
      joinedOn: employee?.joinedOn || new Date(),
      updatedAt: new Date()
    };

    if (!employee) {
      const empRes = await cols.employees.insertOne(employeePayload);
      employee = { ...employeePayload, _id: empRes.insertedId } as any;
    } else {
      await cols.employees.updateOne({ _id: employee._id }, { $set: employeePayload });
    }

    // 3. Upsert Membership with designated role
    await cols.memberships.updateOne(
      { tenantId, userId },
      {
        $set: {
          roles: [roleCode],
          status: 'ACTIVE',
          updatedAt: new Date()
        },
        $setOnInsert: {
          tenantId,
          userId,
          joinedAt: new Date()
        }
      },
      { upsert: true }
    );

    // 4. Update Candidate and Application with Credentials Metadata
    const credentialsMeta = {
      generated: true,
      employeeCode: employeePayload.employeeCode,
      loginEmail: emailToUse,
      roleCode,
      designation,
      reportingManagerName,
      generatedAt: new Date(),
      generatedBy: req.auth!.user.fullName
    };

    await cols.candidates.updateOne(
      { _id: new ObjectId(candidateId) },
      { $set: { credentials: credentialsMeta, updatedAt: new Date() } }
    );

    if (applicationId) {
      await cols.applications.updateOne(
        { _id: new ObjectId(applicationId) },
        { $set: { credentials: credentialsMeta, updatedAt: new Date() } }
      );
    } else {
      await cols.applications.updateMany(
        { candidateId },
        { $set: { credentials: credentialsMeta, updatedAt: new Date() } }
      );
    }

    // 5. Send Welcome & Credentials Email to Candidate's Personal Email
    let emailDispatched = false;
    let emailError: string | undefined;

    if (sendEmail && candidate.emailNormalized) {
      try {
        const portalUrl = process.env.APP_URL || 'https://connect.codrix.co.in';
        const roleScopeDescription =
          roleCode === 'BDE'
            ? 'Record Management System: Create, manage, and log notes/calls for your assigned leads, client accounts, and pipeline records.'
            : roleCode === 'BDM'
            ? 'Record Management System & Team Oversight: Full access to manage your own pipeline plus all Business Development Executives (BDEs) under your leadership.'
            : roleCode === 'GROWTH_OFFICER'
            ? 'Growth Leadership System: Complete oversight across all BDMs, BDEs, client accounts, and enterprise business expansion.'
            : roleCode === 'SDE1' || roleCode === 'SDE2' || roleCode === 'INTERN'
            ? 'Engineering & Sprints System: Sprint boards, architecture tasks, bug reporting, code reviews, and daily updates.'
            : 'Enterprise Operations System: Access aligned with your corporate role specifications.';

        // Look up customized email template from MongoDB Atlas
        const customTemplate = await EmailTemplateService.getTemplate(tenantId, 'ATS_WELCOME_CREDENTIALS');
        const templateVariables = {
          candidateName: candidate.fullName,
          portalUrl,
          emailToUse,
          rawPassword,
          employeeCode: employeePayload.employeeCode,
          designation,
          department,
          reportingManagerName,
          roleCode,
          roleScopeDescription
        };

        let emailSubject = `🎓 Welcome to CodRix — Your Official Portal Credentials & Role Access (${designation})`;
        let emailText = `Dear ${candidate.fullName},\n\nCongratulations on joining the CodRix team! Your official login credentials and system access have been provisioned.\n\nSoftware Access Login URL: ${portalUrl}\nUsername / Login Email: ${emailToUse}\nTemporary Password: ${rawPassword}\nDesignation: ${designation}\nRole Access: ${roleCode}\nReporting Manager: ${reportingManagerName}\n\nAccess Scope: ${roleScopeDescription}\n\nPlease log in at ${portalUrl}, review your dashboard, and keep these credentials secure.\n\nBest regards,\nPeople & Culture Team\nCodRix Private Limited`;
        let emailHtml = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 620px; margin: auto; padding: 28px; border: 1px solid #E7E0FB; border-radius: 20px; background-color: #FBFBFE;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                <div style="background-color: #7C2CF5; color: white; width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px;">C</div>
                <div>
                  <h2 style="color: #120E24; margin: 0; font-size: 18px;">CodRix Enterprise OS</h2>
                  <span style="color: #7C2CF5; font-size: 11px; font-weight: bold; text-transform: uppercase;">Official Onboarding & Credential Provisioning</span>
                </div>
              </div>

              <div style="background: linear-gradient(135deg, #EDE4FF 0%, #F5F0FF 100%); padding: 18px 20px; border-radius: 14px; border: 1px solid #DDD0FE; margin-bottom: 20px;">
                <h3 style="color: #120E24; margin: 0 0 6px 0; font-size: 16px;">Welcome aboard, ${candidate.fullName}!</h3>
                <p style="color: #585172; font-size: 13px; margin: 0; line-height: 1.5;">
                  Your official candidate-to-team member onboarding is complete. Your system credentials and role-based permissions have been activated on the CodRix platform.
                </p>
              </div>

              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
                <tr style="border-bottom: 1px solid #E7E0FB;">
                  <td style="padding: 10px 0; color: #585172; font-weight: 600;">Software Access URL:</td>
                  <td style="padding: 10px 0; color: #7C2CF5; font-weight: bold;"><a href="${portalUrl}" target="_blank" style="color: #7C2CF5; text-decoration: underline;">${portalUrl}</a></td>
                </tr>
                <tr style="border-bottom: 1px solid #E7E0FB;">
                  <td style="padding: 10px 0; color: #585172; font-weight: 600;">Employee Code:</td>
                  <td style="padding: 10px 0; color: #120E24; font-weight: bold; font-family: monospace;">${employeePayload.employeeCode}</td>
                </tr>
                <tr style="border-bottom: 1px solid #E7E0FB;">
                  <td style="padding: 10px 0; color: #585172; font-weight: 600;">Designation:</td>
                  <td style="padding: 10px 0; color: #7C2CF5; font-weight: bold;">${designation}</td>
                </tr>
                <tr style="border-bottom: 1px solid #E7E0FB;">
                  <td style="padding: 10px 0; color: #585172; font-weight: 600;">Department / Unit:</td>
                  <td style="padding: 10px 0; color: #120E24;">${department}</td>
                </tr>
                <tr style="border-bottom: 1px solid #E7E0FB;">
                  <td style="padding: 10px 0; color: #585172; font-weight: 600;">Reporting Supervisor:</td>
                  <td style="padding: 10px 0; color: #120E24; font-weight: 600;">${reportingManagerName}</td>
                </tr>
                <tr style="border-bottom: 1px solid #E7E0FB;">
                  <td style="padding: 10px 0; color: #585172; font-weight: 600;">Portal Login Email:</td>
                  <td style="padding: 10px 0; color: #120E24; font-weight: bold;">${emailToUse}</td>
                </tr>
                <tr style="border-bottom: 1px solid #E7E0FB;">
                  <td style="padding: 10px 0; color: #585172; font-weight: 600;">Temporary Password:</td>
                  <td style="padding: 10px 0; color: #D97706; font-weight: bold; font-family: monospace; font-size: 14px;">${rawPassword}</td>
                </tr>
              </table>

              <div style="background-color: #F7F5FE; padding: 14px 16px; border-radius: 12px; border: 1px solid #E7E0FB; margin-bottom: 24px;">
                <strong style="color: #120E24; font-size: 12px; display: block; margin-bottom: 4px;">Assigned Access Scope (${roleCode}):</strong>
                <p style="color: #585172; font-size: 12px; margin: 0; line-height: 1.5;">${roleScopeDescription}</p>
              </div>

              <div style="text-align: center; margin-bottom: 24px;">
                <a href="${portalUrl}" target="_blank" style="background-color: #7C2CF5; color: white !important; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 15px rgba(124, 44, 245, 0.35);">
                  Log In to CodRix OS Portal &rarr;
                </a>
              </div>

              <hr style="border: none; border-top: 1px solid #E7E0FB; margin: 20px 0;" />
              <p style="color: #585172; font-size: 11px; text-align: center; margin: 0;">
                Provisioned by <strong>${req.auth!.user.fullName}</strong> (${req.auth!.user.roles[0]}) &bull; CodRix Private Limited &bull; <a href="${portalUrl}" style="color: #7C2CF5; text-decoration: none;">connect.codrix.co.in</a>
              </p>
            </div>
          `;

        if (customTemplate) {
          const rendered = EmailTemplateService.render(customTemplate, templateVariables);
          emailSubject = rendered.subject;
          emailText = rendered.text;
          emailHtml = rendered.html;
        }

        const emailResult = await EmailDispatcher.send({
          tenantId,
          to: candidate.emailNormalized,
          subject: emailSubject,
          text: emailText,
          html: emailHtml
        });
        emailDispatched = emailResult.success;
        if (!emailResult.success) emailError = emailResult.error;
      } catch (e: any) {
        emailError = e.message;
      }
    }

    // 6. Audit Logging
    await AuditService.log({
      user: req.auth!.user,
      action: 'CANDIDATE_ONBOARD_CREDENTIALS',
      resourceType: 'EMPLOYEE',
      resourceId: employee!._id.toString(),
      details: {
        candidateId,
        candidateName: candidate.fullName,
        employeeCode: employeePayload.employeeCode,
        loginEmail: emailToUse,
        roleCode,
        designation,
        reportingManagerName,
        emailDispatched
      }
    });

    // 7. Socket.IO Real-time broadcasts
    SocketService.emitToTenant(tenantId, 'recruitment:candidate_updated', {
      candidateId,
      credentials: credentialsMeta
    });
    SocketService.emitToTenant(tenantId, 'hrms:employee_created', {
      employee: { ...employeePayload, id: employee!._id.toString() }
    });

    res.status(201).json({
      data: {
        success: true,
        credentials: {
          employeeCode: employeePayload.employeeCode,
          loginEmail: emailToUse,
          password: rawPassword,
          roleCode,
          designation,
          department,
          reportingManagerName,
          emailDispatched,
          emailError
        }
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

export default router;
