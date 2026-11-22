import { ObjectId } from 'mongodb';
import { getCollections } from '../mongodb.js';

export interface EmailTemplate {
  _id?: any;
  id?: string;
  tenantId: string;
  templateKey: string;
  name: string;
  category: 'RECRUITMENT' | 'HRMS' | 'CRM' | 'ENGINEERING' | 'GENERAL';
  subject: string;
  htmlBody: string;
  textBody?: string;
  variables: string[];
  description: string;
  isSystemDefault?: boolean;
  updatedBy?: string;
  updatedAt?: Date;
  createdAt?: Date;
}

export const SYSTEM_DEFAULT_TEMPLATES: Omit<EmailTemplate, 'tenantId'>[] = [
  {
    templateKey: 'ATS_WELCOME_CREDENTIALS',
    name: 'Recruitment: Onboarding & Portal Access Credentials',
    category: 'RECRUITMENT',
    description: 'Dispatched to hired candidates and interns containing their login credentials, assigned role, and platform link.',
    variables: ['candidateName', 'portalUrl', 'emailToUse', 'rawPassword', 'employeeCode', 'designation', 'department', 'reportingManagerName', 'roleCode', 'roleScopeDescription'],
    subject: '🎓 Welcome to CodRix — Your Official Portal Credentials & Role Access ({{designation}})',
    htmlBody: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 620px; margin: auto; padding: 28px; border: 1px solid #E7E0FB; border-radius: 20px; background-color: #FBFBFE;">
  <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
    <div style="background-color: #7C2CF5; color: white; width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px;">C</div>
    <div>
      <h2 style="color: #120E24; margin: 0; font-size: 18px;">CodRix Enterprise OS</h2>
      <span style="color: #7C2CF5; font-size: 11px; font-weight: bold; text-transform: uppercase;">Official Onboarding & Credential Provisioning</span>
    </div>
  </div>

  <div style="background: linear-gradient(135deg, #EDE4FF 0%, #F5F0FF 100%); padding: 18px 20px; border-radius: 14px; border: 1px solid #DDD0FE; margin-bottom: 20px;">
    <h3 style="color: #120E24; margin: 0 0 6px 0; font-size: 16px;">Welcome aboard, {{candidateName}}!</h3>
    <p style="color: #585172; font-size: 13px; margin: 0; line-height: 1.5;">
      Your official candidate-to-team member onboarding is complete. Your system credentials and role-based permissions have been activated on the CodRix platform.
    </p>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
    <tr style="border-bottom: 1px solid #E7E0FB;">
      <td style="padding: 10px 0; color: #585172; font-weight: 600;">Software Access URL:</td>
      <td style="padding: 10px 0; color: #7C2CF5; font-weight: bold;"><a href="{{portalUrl}}" target="_blank" style="color: #7C2CF5; text-decoration: underline;">{{portalUrl}}</a></td>
    </tr>
    <tr style="border-bottom: 1px solid #E7E0FB;">
      <td style="padding: 10px 0; color: #585172; font-weight: 600;">Employee Code:</td>
      <td style="padding: 10px 0; color: #120E24; font-weight: bold; font-family: monospace;">{{employeeCode}}</td>
    </tr>
    <tr style="border-bottom: 1px solid #E7E0FB;">
      <td style="padding: 10px 0; color: #585172; font-weight: 600;">Designation:</td>
      <td style="padding: 10px 0; color: #7C2CF5; font-weight: bold;">{{designation}}</td>
    </tr>
    <tr style="border-bottom: 1px solid #E7E0FB;">
      <td style="padding: 10px 0; color: #585172; font-weight: 600;">Department:</td>
      <td style="padding: 10px 0; color: #120E24;">{{department}}</td>
    </tr>
    <tr style="border-bottom: 1px solid #E7E0FB;">
      <td style="padding: 10px 0; color: #585172; font-weight: 600;">Reporting Supervisor:</td>
      <td style="padding: 10px 0; color: #120E24; font-weight: 600;">{{reportingManagerName}}</td>
    </tr>
    <tr style="border-bottom: 1px solid #E7E0FB;">
      <td style="padding: 10px 0; color: #585172; font-weight: 600;">Portal Login Email:</td>
      <td style="padding: 10px 0; color: #120E24; font-weight: bold;">{{emailToUse}}</td>
    </tr>
    <tr style="border-bottom: 1px solid #E7E0FB;">
      <td style="padding: 10px 0; color: #585172; font-weight: 600;">Temporary Password:</td>
      <td style="padding: 10px 0; color: #D97706; font-weight: bold; font-family: monospace; font-size: 14px;">{{rawPassword}}</td>
    </tr>
  </table>

  <div style="background-color: #F7F5FE; padding: 14px 16px; border-radius: 12px; border: 1px solid #E7E0FB; margin-bottom: 24px;">
    <strong style="color: #120E24; font-size: 12px; display: block; margin-bottom: 4px;">Assigned Access Scope ({{roleCode}}):</strong>
    <p style="color: #585172; font-size: 12px; margin: 0; line-height: 1.5;">{{roleScopeDescription}}</p>
  </div>

  <div style="text-align: center; margin-bottom: 24px;">
    <a href="{{portalUrl}}" target="_blank" style="background-color: #7C2CF5; color: white !important; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 15px rgba(124, 44, 245, 0.35);">
      Log In to CodRix OS Portal &rarr;
    </a>
  </div>

  <hr style="border: none; border-top: 1px solid #E7E0FB; margin: 20px 0;" />
  <p style="color: #585172; font-size: 11px; text-align: center; margin: 0;">
    CodRix Private Limited &bull; <a href="{{portalUrl}}" style="color: #7C2CF5; text-decoration: none;">connect.codrix.co.in</a> &bull; Confidential Transmission
  </p>
</div>
`,
    textBody: `Dear {{candidateName}},\n\nCongratulations on joining the CodRix team! Your official login credentials and system access have been provisioned.\n\nSoftware Access Login URL: {{portalUrl}}\nUsername / Login Email: {{emailToUse}}\nTemporary Password: {{rawPassword}}\nDesignation: {{designation}}\nRole Access: {{roleCode}}\nReporting Manager: {{reportingManagerName}}\n\nAccess Scope: {{roleScopeDescription}}\n\nPlease log in at {{portalUrl}}, review your dashboard, and keep these credentials secure.\n\nBest regards,\nPeople & Culture Team\nCodRix Private Limited`
  },
  {
    templateKey: 'HRMS_CREDENTIALS_UPDATE',
    name: 'HRMS: Staff Login Credentials Update Notification',
    category: 'HRMS',
    description: 'Dispatched to existing staff when their login email, password, or security credentials are updated by Superadmin.',
    variables: ['fullName', 'loginEmail', 'password', 'employeeCode', 'jobTitle', 'roleCode', 'portalUrl'],
    subject: '🔐 CodRix Enterprise OS — Your Login Credentials [{{fullName}}]',
    htmlBody: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #F8F7FC; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #E7E0FB; box-shadow: 0 10px 25px rgba(124, 44, 245, 0.08);">
    <div style="background: linear-gradient(135deg, #7C2CF5 0%, #4F12B5 100%); padding: 32px 28px; text-align: center; color: #ffffff;">
      <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 800;">CodRix Enterprise OS</h1>
      <p style="margin: 0; font-size: 13px; opacity: 0.9;">Official Platform Access Credentials</p>
    </div>
    <div style="padding: 32px 28px;">
      <p style="font-size: 15px; line-height: 1.6; color: #37324B; margin-bottom: 24px;">
        Hello <strong>{{fullName}}</strong>,<br><br>
        Your login credentials and account access for the <strong>CodRix Enterprise OS</strong> platform have been updated by Founder & Superadmin <strong>Lakshay</strong>.
      </p>

      <div style="background: #FAF9FE; border: 1px solid #E7E0FB; border-radius: 14px; padding: 20px; margin-bottom: 24px;">
        <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #7C2CF5; margin-bottom: 12px;">Employee & Role Profile</div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px;"><span style="color: #585172;">Staff Member:</span><span style="font-weight: 700;">{{fullName}}</span></div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px;"><span style="color: #585172;">Employee ID:</span><span style="font-weight: 700; font-family: monospace;">{{employeeCode}}</span></div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px;"><span style="color: #585172;">Designation:</span><span style="font-weight: 700;">{{jobTitle}}</span></div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px;"><span style="color: #585172;">System Role Access:</span><span style="font-weight: 700; color: #7C2CF5;">{{roleCode}}</span></div>
        <div style="display: flex; justify-content: space-between; font-size: 13px;"><span style="color: #585172;">Official Login ID:</span><span style="font-weight: 700;">{{loginEmail}}</span></div>
      </div>

      <div style="background: #120E24; color: #ffffff; border-radius: 14px; padding: 20px; margin: 24px 0; text-align: center;">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #9C8EF7; margin-bottom: 8px;">Your Portal Login Password</div>
        <div style="font-family: monospace; font-size: 20px; font-weight: bold; letter-spacing: 2px; color: #22C55E; background: rgba(255,255,255,0.08); padding: 8px 16px; border-radius: 8px; display: inline-block;">{{password}}</div>
        <div style="font-size: 11px; color: #9C8EF7; margin-top: 10px;">Please login and update your password if desired.</div>
      </div>

      <div style="text-align: center; margin: 28px 0;">
        <a href="{{portalUrl}}" target="_blank" style="background: #7C2CF5; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 700; font-size: 14px; display: inline-block; box-shadow: 0 4px 15px rgba(124, 44, 245, 0.35);">Access CodRix Enterprise OS</a>
      </div>

      <p style="font-size: 12px; color: #585172; line-height: 1.5;">
        <strong>Security Notice:</strong> Keep these credentials confidential. If you did not request this update or experience any difficulty logging in, contact <strong>lakshay@codrix.co.in</strong> immediately.
      </p>
    </div>
    <div style="text-align: center; padding: 20px 28px; background: #FAF9FE; border-top: 1px solid #E7E0FB; font-size: 11px; color: #7D7595;">
      CodRix Private Limited &bull; connect.codrix.co.in &bull; Confidential Enterprise Transmission
    </div>
  </div>
</div>
`,
    textBody: `Hello {{fullName}},\n\nYour CodRix Enterprise OS login credentials have been updated.\nPortal URL: {{portalUrl}}\nOfficial Login ID: {{loginEmail}}\nPassword: {{password}}\nPlease login to continue.\n\nCodRix Private Limited`
  },
  {
    templateKey: 'ATS_STAGE_SOURCED',
    name: 'Recruitment: Stage 1 — Application Received & Sourced',
    category: 'RECRUITMENT',
    description: 'Triggered when a candidate submits an application or is moved to Sourced stage.',
    variables: ['candidateName', 'jobTitle', 'portalUrl', 'companyName'],
    subject: 'Application Received: {{jobTitle}} at CodRix Private Limited',
    htmlBody: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: auto; padding: 28px; border: 1px solid #E7E0FB; border-radius: 20px; background-color: #FBFBFE;">
  <div style="background: linear-gradient(135deg, #7C2CF5 0%, #4F12B5 100%); padding: 24px; border-radius: 14px; text-align: center; color: #ffffff; margin-bottom: 24px;">
    <h2 style="margin: 0; font-size: 20px;">CodRix Careers & Talent Acquisition</h2>
  </div>
  <p style="font-size: 14px; color: #120E24; line-height: 1.6;">
    Dear <strong>{{candidateName}}</strong>,<br><br>
    Thank you for your interest in joining <strong>CodRix Private Limited</strong>. We have received your application for the <strong>{{jobTitle}}</strong> position and our recruitment leadership is actively reviewing your portfolio.
  </p>
  <div style="background: #FAF9FE; border: 1px solid #E7E0FB; border-radius: 12px; padding: 16px; margin: 20px 0; font-size: 13px; color: #585172;">
    <strong>What happens next?</strong><br>
    Our team reviews candidate submissions on a rolling basis. If your profile aligns with our current engineering and business roadmap, you will receive an invitation to our preliminary screening round.
  </div>
  <p style="font-size: 13px; color: #585172;">
    Best regards,<br>
    <strong>Talent Acquisition & People Team</strong><br>
    CodRix Private Limited &bull; <a href="{{portalUrl}}" style="color: #7C2CF5;">connect.codrix.co.in</a>
  </p>
</div>
`,
    textBody: `Dear {{candidateName}},\n\nThank you for applying for the {{jobTitle}} position at CodRix Private Limited. Your application is under review.\n\nBest regards,\nTalent Acquisition Team\nCodRix Private Limited`
  },
  {
    templateKey: 'ATS_STAGE_SCREENING',
    name: 'Recruitment: Stage 2 — Screening Round Invitation',
    category: 'RECRUITMENT',
    description: 'Dispatched to candidates advancing to the Preliminary Screening interview round.',
    variables: ['candidateName', 'jobTitle', 'portalUrl', 'senderName'],
    subject: 'Next Steps: Preliminary Screening for {{jobTitle}} at CodRix',
    htmlBody: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: auto; padding: 28px; border: 1px solid #E7E0FB; border-radius: 20px; background-color: #FBFBFE;">
  <div style="background: linear-gradient(135deg, #7C2CF5 0%, #4F12B5 100%); padding: 24px; border-radius: 14px; text-align: center; color: #ffffff; margin-bottom: 24px;">
    <h2 style="margin: 0; font-size: 20px;">Preliminary Screening Round</h2>
    <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">CodRix Recruitment Pipeline</p>
  </div>
  <p style="font-size: 14px; color: #120E24; line-height: 1.6;">
    Dear <strong>{{candidateName}}</strong>,<br><br>
    Congratulations! Following our initial review of your profile, we are pleased to invite you to a preliminary screening discussion for the <strong>{{jobTitle}}</strong> opportunity at CodRix.
  </p>
  <p style="font-size: 13px; color: #585172; line-height: 1.6;">
    This conversation will explore your technical background, career goals, and day-to-day alignment with our core engineering and operations stack. Please reply directly to coordinate your availability for this week.
  </p>
  <div style="text-align: center; margin: 24px 0;">
    <a href="{{portalUrl}}" target="_blank" style="background: #7C2CF5; color: #ffffff !important; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 13px; display: inline-block;">
      View CodRix Platform Overview
    </a>
  </div>
  <p style="font-size: 13px; color: #585172;">
    Best regards,<br>
    <strong>People & Culture Team</strong><br>
    CodRix Private Limited
  </p>
</div>
`,
    textBody: `Dear {{candidateName}},\n\nWe are pleased to invite you to a preliminary screening for the {{jobTitle}} role at CodRix Private Limited.\n\nPlease reply with your availability.\n\nBest regards,\nCodRix People Team`
  },
  {
    templateKey: 'ATS_STAGE_TECHNICAL_INTERVIEW',
    name: 'Recruitment: Stage 3 — Technical & Architecture Interview',
    category: 'RECRUITMENT',
    description: 'Dispatched to candidates advancing to hands-on technical problem-solving and coding interview.',
    variables: ['candidateName', 'jobTitle', 'portalUrl'],
    subject: 'Technical Evaluation Round: {{jobTitle}} at CodRix',
    htmlBody: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: auto; padding: 28px; border: 1px solid #E7E0FB; border-radius: 20px; background-color: #FBFBFE;">
  <div style="background: linear-gradient(135deg, #7C2CF5 0%, #3B82F6 100%); padding: 24px; border-radius: 14px; text-align: center; color: #ffffff; margin-bottom: 24px;">
    <h2 style="margin: 0; font-size: 20px;">Technical Architecture & Coding Round</h2>
  </div>
  <p style="font-size: 14px; color: #120E24; line-height: 1.6;">
    Dear <strong>{{candidateName}}</strong>,<br><br>
    You have successfully qualified for the <strong>Technical Evaluation Round</strong> for the <strong>{{jobTitle}}</strong> position at CodRix.
  </p>
  <div style="background: #FAF9FE; border: 1px solid #E7E0FB; border-radius: 12px; padding: 18px; margin: 20px 0;">
    <strong style="color: #7C2CF5; font-size: 13px;">Round Details:</strong>
    <ul style="color: #585172; font-size: 13px; margin: 8px 0 0 0; padding-left: 20px; line-height: 1.6;">
      <li>Hands-on code walkthrough & architectural discussions</li>
      <li>Real-time problem solving with our Engineering Leads</li>
      <li>System design & clean code principles</li>
    </ul>
  </div>
  <p style="font-size: 13px; color: #585172;">
    Best regards,<br>
    <strong>Engineering Leadership</strong><br>
    CodRix Private Limited &bull; <a href="{{portalUrl}}" style="color: #7C2CF5;">connect.codrix.co.in</a>
  </p>
</div>
`,
    textBody: `Dear {{candidateName}},\n\nYou have advanced to the Technical Evaluation Round for {{jobTitle}} at CodRix. Our team will coordinate the meeting link.\n\nBest regards,\nEngineering Leadership\nCodRix Private Limited`
  },
  {
    templateKey: 'CRM_LEAD_INTRO',
    name: 'CRM: Client Enterprise Introduction & Capabilities Pitch',
    category: 'CRM',
    description: 'Outbound business development template introducing CodRix engineering and digital acceleration solutions.',
    variables: ['contactName', 'companyName', 'senderName', 'senderTitle', 'portalUrl'],
    subject: 'Transforming Enterprise Digital Capabilities — CodRix x {{companyName}}',
    htmlBody: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: auto; padding: 28px; border: 1px solid #E7E0FB; border-radius: 20px; background-color: #FBFBFE;">
  <div style="background: linear-gradient(135deg, #120E24 0%, #7C2CF5 100%); padding: 24px; border-radius: 14px; text-align: center; color: #ffffff; margin-bottom: 24px;">
    <h2 style="margin: 0; font-size: 20px;">CodRix Software Solutions</h2>
    <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">Enterprise Engineering & Digital Transformation</p>
  </div>
  <p style="font-size: 14px; color: #120E24; line-height: 1.6;">
    Dear <strong>{{contactName}}</strong>,<br><br>
    I am writing from <strong>CodRix Private Limited</strong>. We specialize in high-performance cloud architectures, custom ERP/CRM ecosystems, and AI-powered operational software for high-growth enterprises like <strong>{{companyName}}</strong>.
  </p>
  <p style="font-size: 13px; color: #585172; line-height: 1.6;">
    We would welcome 15 minutes this week to share relevant case studies and explore how our dedicated development sprints can accelerate your product roadmap with zero overhead.
  </p>
  <div style="text-align: center; margin: 24px 0;">
    <a href="https://codrix.co.in" target="_blank" style="background: #7C2CF5; color: #ffffff !important; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 13px; display: inline-block;">
      Explore CodRix Enterprise Solutions
    </a>
  </div>
  <p style="font-size: 13px; color: #585172;">
    Warm regards,<br>
    <strong>{{senderName}}</strong><br>
    {{senderTitle}}<br>
    CodRix Private Limited &bull; <a href="{{portalUrl}}" style="color: #7C2CF5;">connect.codrix.co.in</a>
  </p>
</div>
`,
    textBody: `Dear {{contactName}},\n\nI am writing from CodRix Private Limited to explore how our enterprise software engineering services can accelerate {{companyName}}.\n\nWarm regards,\n{{senderName}}\nCodRix Private Limited`
  },
  {
    templateKey: 'PROJECT_TASK_ASSIGNED',
    name: 'Engineering: Sprint Task Assignment Alert',
    category: 'ENGINEERING',
    description: 'Notification triggered when a sprint ticket, bug, or feature task is assigned to an engineer.',
    variables: ['assigneeName', 'taskCode', 'taskTitle', 'priority', 'portalUrl'],
    subject: 'Sprint Task Assigned: [{{taskCode}}] {{taskTitle}}',
    htmlBody: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #E7E0FB; border-radius: 20px; background-color: #FBFBFE;">
  <h3 style="color: #120E24; margin: 0 0 12px 0; font-size: 16px;">New Sprint Task Assigned</h3>
  <p style="font-size: 13px; color: #585172; margin-bottom: 16px;">
    Hello <strong>{{assigneeName}}</strong>, a new task has been assigned to you on the CodRix Engineering board.
  </p>
  <div style="background: #FFFFFF; border: 1px solid #E7E0FB; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
    <div style="font-mono; font-weight: bold; color: #7C2CF5; font-size: 12px; margin-bottom: 4px;">{{taskCode}}</div>
    <div style="font-weight: bold; color: #120E24; font-size: 14px; margin-bottom: 8px;">{{taskTitle}}</div>
    <div style="font-size: 12px; color: #585172;">Priority: <strong style="color: #D97706;">{{priority}}</strong></div>
  </div>
  <a href="{{portalUrl}}" target="_blank" style="background: #7C2CF5; color: #ffffff !important; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 12px; display: inline-block;">
    Open Task on Sprint Board &rarr;
  </a>
</div>
`,
    textBody: `Hello {{assigneeName}},\n\nYou have been assigned task [{{taskCode}}] {{taskTitle}} (Priority: {{priority}}).\nView at {{portalUrl}}\n\nCodRix Engineering`
  }
];

export class EmailTemplateService {
  /**
   * Fetch an email template by key, falling back to system default
   */
  static async getTemplate(tenantId: string, templateKey: string): Promise<EmailTemplate | null> {
    const cols = getCollections();
    const custom = await cols.emailTemplates.findOne({ tenantId, templateKey });
    if (custom) {
      return {
        ...custom,
        id: custom._id.toString()
      } as EmailTemplate;
    }

    const sysDefault = SYSTEM_DEFAULT_TEMPLATES.find((t) => t.templateKey === templateKey);
    if (sysDefault) {
      return {
        ...sysDefault,
        tenantId,
        isSystemDefault: true
      } as EmailTemplate;
    }

    return null;
  }

  /**
   * Render dynamic variables into template subject, html, and text
   */
  static render(
    template: { subject: string; htmlBody: string; textBody?: string },
    variables: Record<string, string | number | undefined | null>
  ): { subject: string; html: string; text: string } {
    let subject = template.subject || '';
    let html = template.htmlBody || '';
    let text = template.textBody || '';

    for (const [key, val] of Object.entries(variables)) {
      const safeVal = val !== undefined && val !== null ? String(val) : '';
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      subject = subject.replace(regex, safeVal);
      html = html.replace(regex, safeVal);
      text = text.replace(regex, safeVal);
    }

    return { subject, html, text };
  }

  /**
   * Seeds default system templates into tenant database if not already present
   */
  static async seedDefaultTemplates(tenantId: string): Promise<void> {
    const cols = getCollections();
    for (const def of SYSTEM_DEFAULT_TEMPLATES) {
      const existing = await cols.emailTemplates.findOne({ tenantId, templateKey: def.templateKey });
      if (!existing) {
        await cols.emailTemplates.insertOne({
          ...def,
          tenantId,
          isSystemDefault: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }
  }
}
