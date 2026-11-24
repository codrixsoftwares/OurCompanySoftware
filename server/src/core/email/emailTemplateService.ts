import { ObjectId } from 'mongodb';
import { getCollections } from '../mongodb.js';

export interface EmailTemplate {
  _id?: any;
  id?: string;
  tenantId: string;
  templateKey: string;
  name: string;
  category: 'RECRUITMENT' | 'HRMS' | 'CRM' | 'PROJECTS' | 'ENGINEERING' | 'GENERAL';
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
  // ==========================================
  // 1. RECRUITMENT STAGE PIPELINE (All 7 Stages)
  // ==========================================
  {
    templateKey: 'ATS_STAGE_SOURCED',
    name: 'Recruitment: Stage 1 — Sourced / Application Received',
    category: 'RECRUITMENT',
    description: 'Triggered when a candidate applies or is sourced into the ATS pipeline.',
    variables: ['candidateName', 'jobTitle', 'requisitionCode', 'portalUrl', 'companyName'],
    subject: 'Application Received: {{jobTitle}} at {{companyName}} (Ref: {{requisitionCode}})',
    htmlBody: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 620px; margin: auto; padding: 28px; border: 1px solid #E7E0FB; border-radius: 20px; background-color: #FBFBFE;">
  <div style="background: linear-gradient(135deg, #7C2CF5 0%, #4F12B5 100%); padding: 24px; border-radius: 14px; text-align: center; color: #ffffff; margin-bottom: 24px;">
    <h2 style="margin: 0; font-size: 20px;">CodRix Careers & Talent Acquisition</h2>
    <span style="font-size: 12px; opacity: 0.9;">Application Acknowledgment & Review</span>
  </div>
  <p style="font-size: 14px; color: #120E24; line-height: 1.6;">
    Dear <strong>{{candidateName}}</strong>,<br><br>
    Thank you for applying for the <strong>{{jobTitle}}</strong> position at <strong>{{companyName}}</strong> (Reference: <code>{{requisitionCode}}</code>).
  </p>
  <div style="background: #FAF9FE; border: 1px solid #E7E0FB; border-radius: 12px; padding: 16px; margin: 20px 0; font-size: 13px; color: #585172;">
    <strong>What to expect next:</strong><br>
    Our recruitment team is reviewing your background and portfolio. If your experience aligns with our requirements, we will invite you to our preliminary screening round.
  </div>
  <p style="font-size: 13px; color: #585172;">
    Warm regards,<br>
    <strong>Talent Acquisition Team</strong><br>
    {{companyName}} &bull; <a href="{{portalUrl}}" style="color: #7C2CF5;">connect.codrix.co.in</a>
  </p>
</div>`,
    textBody: `Dear {{candidateName}},\n\nThank you for applying for {{jobTitle}} at {{companyName}} (Ref: {{requisitionCode}}). Your application has been received and is under review.\n\nBest regards,\nTalent Acquisition Team\n{{companyName}}`
  },
  {
    templateKey: 'ATS_STAGE_SCREENED',
    name: 'Recruitment: Stage 2 — Preliminary Screening Shortlisted',
    category: 'RECRUITMENT',
    description: 'Triggered when candidate passes initial CV review and is moved to Screened stage.',
    variables: ['candidateName', 'jobTitle', 'requisitionCode', 'portalUrl', 'companyName'],
    subject: 'Application Update: Shortlisted for {{jobTitle}} at {{companyName}}',
    htmlBody: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 620px; margin: auto; padding: 28px; border: 1px solid #E7E0FB; border-radius: 20px; background-color: #FBFBFE;">
  <div style="background: linear-gradient(135deg, #7C2CF5 0%, #4F12B5 100%); padding: 24px; border-radius: 14px; text-align: center; color: #ffffff; margin-bottom: 24px;">
    <h2 style="margin: 0; font-size: 20px;">Profile Shortlisted</h2>
    <span style="font-size: 12px; opacity: 0.9;">Preliminary Screening Round</span>
  </div>
  <p style="font-size: 14px; color: #120E24; line-height: 1.6;">
    Dear <strong>{{candidateName}}</strong>,<br><br>
    Great news! We have completed our initial assessment for <strong>{{jobTitle}}</strong> (Ref: <code>{{requisitionCode}}</code>) and are delighted to inform you that your profile has been <strong>shortlisted</strong>.
  </p>
  <p style="font-size: 13px; color: #585172; line-height: 1.6;">
    Our talent team will connect with you shortly regarding scheduling an introductory conversation about your career aspirations and cultural fit.
  </p>
  <p style="font-size: 13px; color: #585172;">
    Best regards,<br>
    <strong>People & Talent Team</strong><br>
    {{companyName}}
  </p>
</div>`,
    textBody: `Dear {{candidateName}},\n\nYour profile has been shortlisted for {{jobTitle}} (Ref: {{requisitionCode}}) at {{companyName}}. Our team will reach out shortly for next steps.\n\nBest regards,\n{{companyName}}`
  },
  {
    templateKey: 'ATS_STAGE_TECHNICAL_INTERVIEW',
    name: 'Recruitment: Stage 3 — Technical & Architecture Interview',
    category: 'RECRUITMENT',
    description: 'Triggered when candidate advances to hands-on Technical Interview.',
    variables: ['candidateName', 'jobTitle', 'requisitionCode', 'portalUrl', 'companyName'],
    subject: 'Interview Invitation: Technical Evaluation for {{jobTitle}} at {{companyName}}',
    htmlBody: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 620px; margin: auto; padding: 28px; border: 1px solid #E7E0FB; border-radius: 20px; background-color: #FBFBFE;">
  <div style="background: linear-gradient(135deg, #7C2CF5 0%, #2563EB 100%); padding: 24px; border-radius: 14px; text-align: center; color: #ffffff; margin-bottom: 24px;">
    <h2 style="margin: 0; font-size: 20px;">Technical Assessment Round</h2>
    <span style="font-size: 12px; opacity: 0.9;">Architecture & Coding Evaluation</span>
  </div>
  <p style="font-size: 14px; color: #120E24; line-height: 1.6;">
    Dear <strong>{{candidateName}}</strong>,<br><br>
    Congratulations on qualifying for the <strong>Technical Evaluation Round</strong> for the <strong>{{jobTitle}}</strong> opportunity at {{companyName}}.
  </p>
  <div style="background: #FAF9FE; border: 1px solid #E7E0FB; border-radius: 12px; padding: 16px; margin: 20px 0; font-size: 13px; color: #585172;">
    <strong>What to prepare:</strong><br>
    This round will evaluate architectural fundamentals, hands-on engineering principles, and real-time problem-solving with our technical leads.
  </div>
  <p style="font-size: 13px; color: #585172;">
    Sincerely,<br>
    <strong>Technical Hiring Panel</strong><br>
    {{companyName}}
  </p>
</div>`,
    textBody: `Dear {{candidateName}},\n\nYou have advanced to the Technical Assessment Round for {{jobTitle}} at {{companyName}}. Please look out for calendar invite details.\n\nBest regards,\nTechnical Hiring Team`
  },
  {
    templateKey: 'ATS_STAGE_EXECUTIVE_REVIEW',
    name: 'Recruitment: Stage 4 — Executive Review & Founder Interview',
    category: 'RECRUITMENT',
    description: 'Triggered when candidate advances to Executive Review with founder and leadership.',
    variables: ['candidateName', 'jobTitle', 'requisitionCode', 'portalUrl', 'companyName'],
    subject: 'Executive Discussion: Next Steps for {{jobTitle}} at {{companyName}}',
    htmlBody: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 620px; margin: auto; padding: 28px; border: 1px solid #E7E0FB; border-radius: 20px; background-color: #FBFBFE;">
  <div style="background: linear-gradient(135deg, #120E24 0%, #7C2CF5 100%); padding: 24px; border-radius: 14px; text-align: center; color: #ffffff; margin-bottom: 24px;">
    <h2 style="margin: 0; font-size: 20px;">Executive Review Round</h2>
    <span style="font-size: 12px; opacity: 0.9;">Strategic Alignment & Leadership Conversation</span>
  </div>
  <p style="font-size: 14px; color: #120E24; line-height: 1.6;">
    Dear <strong>{{candidateName}}</strong>,<br><br>
    You have successfully advanced to the <strong>Executive Review</strong> stage for the <strong>{{jobTitle}}</strong> position at {{companyName}}.
  </p>
  <p style="font-size: 13px; color: #585172; line-height: 1.6;">
    In this stage, you will connect directly with our Executive Leadership to discuss high-impact initiatives, team synergy, and our long-term roadmap.
  </p>
  <p style="font-size: 13px; color: #585172;">
    Warm regards,<br>
    <strong>Executive Leadership</strong><br>
    {{companyName}}
  </p>
</div>`,
    textBody: `Dear {{candidateName}},\n\nYou have advanced to Executive Review for {{jobTitle}} at {{companyName}}. Our executive team will connect with you shortly.\n\nBest regards,\nExecutive Leadership`
  },
  {
    templateKey: 'ATS_STAGE_INTERNSHIP',
    name: 'Recruitment: Stage 5 — Internship Program Invitation',
    category: 'RECRUITMENT',
    description: 'Triggered when a candidate is selected for the CodRix Internship Program.',
    variables: ['candidateName', 'jobTitle', 'requisitionCode', 'portalUrl', 'companyName'],
    subject: 'Internship Program Invitation: {{jobTitle}} at {{companyName}}',
    htmlBody: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 620px; margin: auto; padding: 28px; border: 1px solid #E7E0FB; border-radius: 20px; background-color: #FBFBFE;">
  <div style="background: linear-gradient(135deg, #7C2CF5 0%, #059669 100%); padding: 24px; border-radius: 14px; text-align: center; color: #ffffff; margin-bottom: 24px;">
    <h2 style="margin: 0; font-size: 20px;">Congratulations!</h2>
    <span style="font-size: 12px; opacity: 0.9;">CodRix Internship Program Invitation</span>
  </div>
  <p style="font-size: 14px; color: #120E24; line-height: 1.6;">
    Dear <strong>{{candidateName}}</strong>,<br><br>
    We are excited to invite you to join the <strong>{{companyName}} Internship Program</strong> for the <strong>{{jobTitle}}</strong> track!
  </p>
  <p style="font-size: 13px; color: #585172; line-height: 1.6;">
    You will work directly on production cloud applications, receive dedicated mentorship, and gain hands-on architectural experience. Your program curriculum and onboarding package will follow.
  </p>
  <p style="font-size: 13px; color: #585172;">
    Welcome aboard!<br>
    <strong>People & Culture Team</strong><br>
    {{companyName}}
  </p>
</div>`,
    textBody: `Dear {{candidateName}},\n\nCongratulations! You have been selected for the {{companyName}} Internship Program for {{jobTitle}}.\n\nBest regards,\nPeople & Culture Team`
  },
  {
    templateKey: 'ATS_STAGE_OFFER_EXTENDED',
    name: 'Recruitment: Stage 6 — Formal Offer Extended',
    category: 'RECRUITMENT',
    description: 'Triggered when formal employment or internship offer letter is issued to candidate.',
    variables: ['candidateName', 'jobTitle', 'requisitionCode', 'portalUrl', 'companyName'],
    subject: 'Formal Offer: Welcome to {{companyName}} - {{jobTitle}}',
    htmlBody: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 620px; margin: auto; padding: 28px; border: 1px solid #E7E0FB; border-radius: 20px; background-color: #FBFBFE;">
  <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 24px; border-radius: 14px; text-align: center; color: #ffffff; margin-bottom: 24px;">
    <h2 style="margin: 0; font-size: 20px;">Offer of Employment</h2>
    <span style="font-size: 12px; opacity: 0.9;">{{companyName}} Formal Offer</span>
  </div>
  <p style="font-size: 14px; color: #120E24; line-height: 1.6;">
    Dear <strong>{{candidateName}}</strong>,<br><br>
    On behalf of <strong>{{companyName}}</strong>, we are thrilled to formally extend an offer of employment for the position of <strong>{{jobTitle}}</strong>!
  </p>
  <p style="font-size: 13px; color: #585172; line-height: 1.6;">
    Your performance throughout our recruitment rounds demonstrated the craftsmanship, energy, and values we cherish. Your formal offer letter detailing compensation, benefits, and joining formalities is attached/linked.
  </p>
  <p style="font-size: 13px; color: #585172;">
    Sincerely,<br>
    <strong>Founder & Executive Team</strong><br>
    {{companyName}}
  </p>
</div>`,
    textBody: `Dear {{candidateName}},\n\nWe are pleased to extend a formal offer of employment for {{jobTitle}} at {{companyName}}! Details are available in your portal.\n\nSincerely,\nExecutive Management`
  },
  {
    templateKey: 'ATS_STAGE_HIRED',
    name: 'Recruitment: Stage 7 — Official Welcome & Hired',
    category: 'RECRUITMENT',
    description: 'Triggered when candidate signs offer and is formally transitioned to Hired.',
    variables: ['candidateName', 'jobTitle', 'portalUrl', 'companyName'],
    subject: '🎉 Welcome to the {{companyName}} Family, {{candidateName}}!',
    htmlBody: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 620px; margin: auto; padding: 28px; border: 1px solid #E7E0FB; border-radius: 20px; background-color: #FBFBFE;">
  <div style="background: linear-gradient(135deg, #7C2CF5 0%, #4F12B5 100%); padding: 24px; border-radius: 14px; text-align: center; color: #ffffff; margin-bottom: 24px;">
    <h2 style="margin: 0; font-size: 20px;">Welcome to CodRix!</h2>
    <span style="font-size: 12px; opacity: 0.9;">Official Team Onboarding Complete</span>
  </div>
  <p style="font-size: 14px; color: #120E24; line-height: 1.6;">
    Dear <strong>{{candidateName}}</strong>,<br><br>
    Welcome to <strong>{{companyName}}</strong>! Your official employee transition is complete. We are delighted to have you embark on this journey building high-performance enterprise cloud software with us.
  </p>
  <p style="font-size: 13px; color: #585172;">
    Best wishes,<br>
    <strong>People Operations Team</strong><br>
    {{companyName}}
  </p>
</div>`,
    textBody: `Dear {{candidateName}},\n\nWelcome to {{companyName}}! Your official transition to active Employee status is complete.\n\nWarm regards,\nPeople Operations Team`
  },
  {
    templateKey: 'ATS_WELCOME_CREDENTIALS',
    name: 'Recruitment: Onboarding & Portal Credentials Provisioning',
    category: 'RECRUITMENT',
    description: 'Dispatched to hired employees and interns containing their system login credentials, employee code, and access scope.',
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
      Your official onboarding is complete. Your system credentials and role permissions have been activated on CodRix Enterprise OS.
    </p>
  </div>
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
    <tr style="border-bottom: 1px solid #E7E0FB;"><td style="padding: 10px 0; color: #585172; font-weight: 600;">Software Access URL:</td><td style="padding: 10px 0; color: #7C2CF5; font-weight: bold;"><a href="{{portalUrl}}" target="_blank" style="color: #7C2CF5;">{{portalUrl}}</a></td></tr>
    <tr style="border-bottom: 1px solid #E7E0FB;"><td style="padding: 10px 0; color: #585172; font-weight: 600;">Employee Code:</td><td style="padding: 10px 0; color: #120E24; font-weight: bold; font-family: monospace;">{{employeeCode}}</td></tr>
    <tr style="border-bottom: 1px solid #E7E0FB;"><td style="padding: 10px 0; color: #585172; font-weight: 600;">Designation:</td><td style="padding: 10px 0; color: #7C2CF5; font-weight: bold;">{{designation}}</td></tr>
    <tr style="border-bottom: 1px solid #E7E0FB;"><td style="padding: 10px 0; color: #585172; font-weight: 600;">Department:</td><td style="padding: 10px 0; color: #120E24;">{{department}}</td></tr>
    <tr style="border-bottom: 1px solid #E7E0FB;"><td style="padding: 10px 0; color: #585172; font-weight: 600;">Reporting Supervisor:</td><td style="padding: 10px 0; color: #120E24; font-weight: 600;">{{reportingManagerName}}</td></tr>
    <tr style="border-bottom: 1px solid #E7E0FB;"><td style="padding: 10px 0; color: #585172; font-weight: 600;">Portal Login Email:</td><td style="padding: 10px 0; color: #120E24; font-weight: bold;">{{emailToUse}}</td></tr>
    <tr style="border-bottom: 1px solid #E7E0FB;"><td style="padding: 10px 0; color: #585172; font-weight: 600;">Temporary Password:</td><td style="padding: 10px 0; color: #D97706; font-weight: bold; font-family: monospace; font-size: 14px;">{{rawPassword}}</td></tr>
  </table>
  <div style="background-color: #F7F5FE; padding: 14px 16px; border-radius: 12px; border: 1px solid #E7E0FB; margin-bottom: 24px;">
    <strong style="color: #120E24; font-size: 12px; display: block; margin-bottom: 4px;">Assigned Access Scope ({{roleCode}}):</strong>
    <p style="color: #585172; font-size: 12px; margin: 0; line-height: 1.5;">{{roleScopeDescription}}</p>
  </div>
  <p style="font-size: 12px; color: #585172;">Best regards,<br><strong>People & Culture Team</strong><br>CodRix Private Limited</p>
</div>`,
    textBody: `Welcome {{candidateName}}!\n\nSoftware Access URL: {{portalUrl}}\nLogin Email: {{emailToUse}}\nTemporary Password: {{rawPassword}}\nRole Access: {{roleCode}}\nEmployee Code: {{employeeCode}}\n\nBest regards,\nCodRix People Operations`
  },

  // ==========================================
  // 2. HRMS SECTION (Leaves, Updates, Credentials)
  // ==========================================
  {
    templateKey: 'HRMS_CREDENTIALS_UPDATE',
    name: 'HRMS: Employee Credentials & Security Update',
    category: 'HRMS',
    description: 'Triggered when an administrator resets employee credentials or updates role access.',
    variables: ['employeeName', 'employeeCode', 'emailToUse', 'rawPassword', 'portalUrl', 'updatedBy'],
    subject: 'Security Notice: CodRix Enterprise OS Credentials Updated',
    htmlBody: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: auto; padding: 28px; border: 1px solid #E7E0FB; border-radius: 20px; background-color: #FBFBFE;">
  <h3 style="color: #120E24; margin: 0 0 8px 0; font-size: 18px;">Security Notice: Access Credentials Updated</h3>
  <p style="font-size: 13px; color: #585172; line-height: 1.5;">
    Hello <strong>{{employeeName}}</strong> ({{employeeCode}}),<br>
    Your login credentials for CodRix Enterprise OS have been updated by <strong>{{updatedBy}}</strong>.
  </p>
  <div style="background: #FFFFFF; border: 1px solid #E7E0FB; border-radius: 12px; padding: 16px; margin: 20px 0; font-size: 13px;">
    <div><strong>Login Email:</strong> <span style="font-mono; color: #7C2CF5;">{{emailToUse}}</span></div>
    <div style="margin-top: 8px;"><strong>New Temporary Password:</strong> <code style="color: #D97706; font-weight: bold;">{{rawPassword}}</code></div>
  </div>
  <a href="{{portalUrl}}" target="_blank" style="background: #7C2CF5; color: #ffffff !important; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 12px; display: inline-block;">
    Log In to Portal &rarr;
  </a>
</div>`,
    textBody: `Hello {{employeeName}},\n\nYour credentials have been updated.\nEmail: {{emailToUse}}\nNew Password: {{rawPassword}}\nLogin URL: {{portalUrl}}\n\nCodRix Security Team`
  },
  {
    templateKey: 'HRMS_LEAVE_STATUS_UPDATE',
    name: 'HRMS: Leave Request Approval / Status Notice',
    category: 'HRMS',
    description: 'Notification dispatched when an employee leave application is Approved, Rejected, or Reviewed.',
    variables: ['employeeName', 'leaveType', 'startDate', 'endDate', 'status', 'reviewerComments', 'portalUrl'],
    subject: 'Leave Application Status: {{status}} ({{leaveType}})',
    htmlBody: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: auto; padding: 28px; border: 1px solid #E7E0FB; border-radius: 20px; background-color: #FBFBFE;">
  <h3 style="color: #120E24; margin: 0 0 12px 0; font-size: 18px;">Leave Request {{status}}</h3>
  <p style="font-size: 13px; color: #585172; line-height: 1.6;">
    Dear <strong>{{employeeName}}</strong>,<br><br>
    Your leave application for <strong>{{leaveType}}</strong> from <strong>{{startDate}}</strong> to <strong>{{endDate}}</strong> has been marked as <strong>{{status}}</strong>.
  </p>
  <div style="background: #FFFFFF; border: 1px solid #E7E0FB; border-radius: 12px; padding: 14px; margin: 18px 0; font-size: 13px;">
    <strong>Manager / HR Remarks:</strong><br>
    <span style="color: #585172;">{{reviewerComments}}</span>
  </div>
  <p style="font-size: 13px; color: #585172;">
    Best regards,<br>
    <strong>HR & People Operations</strong><br>
    CodRix Private Limited
  </p>
</div>`,
    textBody: `Dear {{employeeName}},\n\nYour leave application for {{leaveType}} ({{startDate}} to {{endDate}}) is {{status}}.\nRemarks: {{reviewerComments}}\n\nHR & People Operations`
  },

  // ==========================================
  // 3. CRM & BDE OUTREACH SECTION
  // ==========================================
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
</div>`,
    textBody: `Dear {{contactName}},\n\nI am writing from CodRix Private Limited to explore how our enterprise software engineering services can accelerate {{companyName}}.\n\nWarm regards,\n{{senderName}}\nCodRix Private Limited`
  },
  {
    templateKey: 'CRM_PROPOSAL_DISPATCH',
    name: 'CRM: Enterprise Proposal & Statement of Work Submission',
    category: 'CRM',
    description: 'Formal proposal and commercial quotation dispatch to green-flagged enterprise prospect.',
    variables: ['contactName', 'companyName', 'proposalTitle', 'projectTimeline', 'senderName', 'portalUrl'],
    subject: 'Commercial Proposal & SOW: {{proposalTitle}} for {{companyName}}',
    htmlBody: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: auto; padding: 28px; border: 1px solid #E7E0FB; border-radius: 20px; background-color: #FBFBFE;">
  <h3 style="color: #120E24; margin: 0 0 10px 0; font-size: 18px;">Commercial Proposal & Scope of Work</h3>
  <p style="font-size: 13px; color: #585172; line-height: 1.6;">
    Dear <strong>{{contactName}}</strong>,<br><br>
    Following our exploratory discussions, we are pleased to deliver our comprehensive technical proposal and milestone roadmap for <strong>{{proposalTitle}}</strong> at <strong>{{companyName}}</strong>.
  </p>
  <div style="background: #FAF9FE; border: 1px solid #E7E0FB; border-radius: 12px; padding: 16px; margin: 20px 0; font-size: 13px;">
    <div><strong>Project Scope:</strong> {{proposalTitle}}</div>
    <div style="margin-top: 6px;"><strong>Target Timeline:</strong> {{projectTimeline}}</div>
  </div>
  <p style="font-size: 13px; color: #585172;">
    Sincerely,<br>
    <strong>{{senderName}}</strong><br>
    Business Development & Enterprise Solutions<br>
    CodRix Private Limited
  </p>
</div>`,
    textBody: `Dear {{contactName}},\n\nPlease find our formal proposal for {{proposalTitle}} at {{companyName}}.\n\nBest regards,\n{{senderName}}\nCodRix Private Limited`
  },

  // ==========================================
  // 4. PROJECTS & DELIVERY SECTION
  // ==========================================
  {
    templateKey: 'PROJECTS_MILESTONE_COMPLETED',
    name: 'Projects: Project Milestone Completion Notice',
    category: 'PROJECTS',
    description: 'Notification to client or internal stakeholders when a project milestone is delivered.',
    variables: ['clientName', 'projectName', 'milestoneName', 'deliveredDate', 'portalUrl'],
    subject: 'Milestone Completed: {{milestoneName}} on {{projectName}}',
    htmlBody: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: auto; padding: 28px; border: 1px solid #E7E0FB; border-radius: 20px; background-color: #FBFBFE;">
  <h3 style="color: #120E24; margin: 0 0 10px 0; font-size: 18px;">Project Milestone Completed</h3>
  <p style="font-size: 13px; color: #585172; line-height: 1.6;">
    Dear <strong>{{clientName}}</strong>,<br><br>
    We are pleased to notify you that milestone <strong>{{milestoneName}}</strong> for <strong>{{projectName}}</strong> has been successfully completed and deployed to staging/production on <strong>{{deliveredDate}}</strong>.
  </p>
  <div style="text-align: center; margin: 24px 0;">
    <a href="{{portalUrl}}" target="_blank" style="background: #7C2CF5; color: #ffffff !important; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 13px; display: inline-block;">
      Review Project Deliverables
    </a>
  </div>
  <p style="font-size: 13px; color: #585172;">
    Warm regards,<br>
    <strong>Projects & Engineering Delivery Office</strong><br>
    CodRix Private Limited
  </p>
</div>`,
    textBody: `Dear {{clientName}},\n\nMilestone {{milestoneName}} on {{projectName}} has been successfully completed.\n\nCodRix Project Delivery`
  },

  // ==========================================
  // 5. ENGINEERING SPRINT SECTION
  // ==========================================
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
    <div style="font-family: monospace; font-weight: bold; color: #7C2CF5; font-size: 12px; margin-bottom: 4px;">{{taskCode}}</div>
    <div style="font-weight: bold; color: #120E24; font-size: 14px; margin-bottom: 8px;">{{taskTitle}}</div>
    <div style="font-size: 12px; color: #585172;">Priority: <strong style="color: #D97706;">{{priority}}</strong></div>
  </div>
  <a href="{{portalUrl}}" target="_blank" style="background: #7C2CF5; color: #ffffff !important; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 12px; display: inline-block;">
    Open Task on Sprint Board &rarr;
  </a>
</div>`,
    textBody: `Hello {{assigneeName}},\n\nYou have been assigned task [{{taskCode}}] {{taskTitle}} (Priority: {{priority}}).\nView at {{portalUrl}}\n\nCodRix Engineering`
  },

  // ==========================================
  // 6. GENERAL & SECURITY SECTION
  // ==========================================
  {
    templateKey: 'SECURITY_PASSWORD_RESET',
    name: 'General: Account Password Reset Link',
    category: 'GENERAL',
    description: 'Triggered when a user requests a single-use password recovery token.',
    variables: ['fullName', 'resetUrl', 'expirationMinutes', 'companyName'],
    subject: '{{companyName}} Enterprise OS — Password Reset Request',
    htmlBody: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: auto; padding: 28px; border: 1px solid #E7E0FB; border-radius: 20px; background-color: #FBFBFE;">
  <h3 style="color: #120E24; margin: 0 0 10px 0; font-size: 18px;">Password Reset Request</h3>
  <p style="font-size: 13px; color: #585172; line-height: 1.6;">
    Hello <strong>{{fullName}}</strong>,<br><br>
    We received a request to reset your password for your {{companyName}} account. Click the button below to set a new password. This link expires in <strong>{{expirationMinutes}} minutes</strong>.
  </p>
  <div style="text-align: center; margin: 28px 0;">
    <a href="{{resetUrl}}" target="_blank" style="background: #7C2CF5; color: #ffffff !important; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 13px; display: inline-block;">
      Reset My Password
    </a>
  </div>
  <p style="font-size: 12px; color: #8A859E;">
    If you did not request this change, please ignore this email. Your credentials remain safe.
  </p>
</div>`,
    textBody: `Hello {{fullName}},\n\nUse this link to reset your password: {{resetUrl}}\nExpires in {{expirationMinutes}} minutes.\n\nCodRix Security`
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
