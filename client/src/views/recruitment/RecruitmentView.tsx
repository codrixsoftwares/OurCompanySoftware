import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { apiRequest } from '../../api/client.js';
import { getSocket } from '../../core/socket.js';
import { PipelineStage, Application, JobOpening, CandidateDetail } from '../../types.js';
import {
  Briefcase,
  UserPlus,
  Plus,
  Calendar,
  CheckCircle,
  Clock,
  ArrowRight,
  Phone,
  Mail,
  X,
  FileCheck,
  Building,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Code,
  Copy,
  Check,
  Edit2,
  Trash2,
  ExternalLink,
  ChevronRight,
  Filter,
  Search,
  Table,
  Kanban,
  FileSpreadsheet,
  Send,
  Zap,
  UserCheck,
  GraduationCap,
  Layers,
  MapPin,
  DollarSign,
  Share2,
  CheckCircle2,
  Key,
  Eye,
  EyeOff,
  ShieldCheck
} from 'lucide-react';

const DEFAULT_TEMPLATES: Record<string, { subject: string; body: string; enabled: boolean }> = {
  'Sourced': {
    enabled: true,
    subject: 'Application Received: {{jobTitle}} at {{companyName}}',
    body: `Dear {{candidateName}},

Thank you for your interest in joining {{companyName}}! We have successfully received your application for the {{jobTitle}} position (Ref: {{requestNo}}).

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

Great news! We have reviewed your application for {{jobTitle}} (Ref: {{requestNo}}) and are pleased to inform you that your profile has been shortlisted.

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

export const RecruitmentView: React.FC = () => {
  const { isLakshay, session } = useAuth();
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [jobs, setJobs] = useState<JobOpening[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'excel' | 'kanban' | 'openings'>('excel');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterJobId, setFilterJobId] = useState('ALL');
  const [filterStageId, setFilterStageId] = useState('ALL');

  // Modals & Drawers
  const [candidateModalOpen, setCandidateModalOpen] = useState(false);
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobOpening | null>(null);
  const [webscriptModalJob, setWebscriptModalJob] = useState<JobOpening | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [candidateDetail, setCandidateDetail] = useState<CandidateDetail | null>(null);
  const [loadingCandidateDetail, setLoadingCandidateDetail] = useState(false);

  // Copy Feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // New Candidate Form State
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [candidatePhone, setCandidatePhone] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [candidateSubmitting, setCandidateSubmitting] = useState(false);
  const [candidateError, setCandidateError] = useState<string | null>(null);

  // Job Opening Form State (Industry Standard + Journey Email Builder)
  const [jobFormTab, setJobFormTab] = useState<'details' | 'emails'>('details');
  const [jobTitle, setJobTitle] = useState('');
  const [jobDepartment, setJobDepartment] = useState('Sales & Growth');
  const [jobOpeningType, setJobOpeningType] = useState('Full-time');
  const [jobWorkplaceMode, setJobWorkplaceMode] = useState('Hybrid');
  const [jobExperienceLevel, setJobExperienceLevel] = useState('1-3 Years');
  const [jobHeadcount, setJobHeadcount] = useState(1);
  const [jobLocation, setJobLocation] = useState('');
  const [jobSalaryMin, setJobSalaryMin] = useState<number | string>('');
  const [jobSalaryMax, setJobSalaryMax] = useState<number | string>('');
  const [jobSkills, setJobSkills] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [jobStatus, setJobStatus] = useState<'OPEN' | 'DRAFT' | 'CLOSED'>('OPEN');
  const [jobEmailTemplates, setJobEmailTemplates] = useState<Record<string, { subject: string; body: string; enabled: boolean }>>(DEFAULT_TEMPLATES);
  const [jobSenderEmail, setJobSenderEmail] = useState('careers@codrix.co.in');
  const [jobCustomSenderEmail, setJobCustomSenderEmail] = useState('');
  const [jobSenderName, setJobSenderName] = useState('CodRix Careers');
  const [jobReplyToEmail, setJobReplyToEmail] = useState('careers@codrix.co.in');
  const [jobEmailProvider, setJobEmailProvider] = useState<'GOOGLE_WORKSPACE' | 'ZOHO_MAIL' | 'MICROSOFT_365' | 'HOSTINGER_CPANEL' | 'TRANSACTIONAL_API'>('GOOGLE_WORKSPACE');
  const [testTargetEmail, setTestTargetEmail] = useState('');
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [jobSubmitting, setJobSubmitting] = useState(false);

  // Candidate Full CRUD & Edit Modal State
  const [editCandModalOpen, setEditCandModalOpen] = useState(false);
  const [editingCandidateId, setEditingCandidateId] = useState<string | null>(null);
  const [editCandName, setEditCandName] = useState('');
  const [editCandEmail, setEditCandEmail] = useState('');
  const [editCandPhone, setEditCandPhone] = useState('');
  const [editCandJobId, setEditCandJobId] = useState('');
  const [editCandStageId, setEditCandStageId] = useState('');
  const [editCandResumeUrl, setEditCandResumeUrl] = useState('');
  const [editCandNotes, setEditCandNotes] = useState('');
  const [editCandSubmitting, setEditCandSubmitting] = useState(false);

  // Quick evaluation note for Candidate 360
  const [quickNoteText, setQuickNoteText] = useState('');
  const [quickNoteSubmitting, setQuickNoteSubmitting] = useState(false);

  // Candidate Credentials Generation & Designation-Based Access Control Modal State
  const [credModalOpen, setCredModalOpen] = useState(false);
  const [selectedAppForCreds, setSelectedAppForCreds] = useState<Application | null>(null);
  const [credLoginEmail, setCredLoginEmail] = useState('');
  const [credPassword, setCredPassword] = useState('CodRix@2026!');
  const [showCredPassword, setShowCredPassword] = useState(false);
  const [credDesignation, setCredDesignation] = useState('Business Development Executive (BDE)');
  const [credRoleCode, setCredRoleCode] = useState<string>('BDE');
  const [credDepartment, setCredDepartment] = useState('Sales & Growth');
  const [credReportingManager, setCredReportingManager] = useState('Suryansh Thakur (Growth Officer)');
  const [credSendEmail, setCredSendEmail] = useState(true);
  const [credSubmitting, setCredSubmitting] = useState(false);
  const [credResult, setCredResult] = useState<any | null>(null);
  const [copiedCreds, setCopiedCreds] = useState(false);

  const handleGenerateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let pass = 'CodRix@';
    for (let i = 0; i < 4; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    pass += '!';
    setCredPassword(pass);
  };

  const handleOpenCredentialsModal = (app: Application) => {
    setSelectedAppForCreds(app);
    setCredResult(null);
    setCopiedCreds(false);

    // Auto-suggest login email under company domain @codrix.co.in
    const nameParts = app.candidate.fullName.trim().toLowerCase().split(/\s+/);
    const suggestedEmail = nameParts.length > 1
      ? `${nameParts[0]}.${nameParts[nameParts.length - 1]}@codrix.co.in`
      : `${nameParts[0]}@codrix.co.in`;
    setCredLoginEmail(app.candidate.credentials?.loginEmail || suggestedEmail);

    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    setCredPassword(`CodRix@${randomDigits}!`);

    const jobTitleLower = (app.jobOpening?.title || '').toLowerCase();
    if (jobTitleLower.includes('bde') || jobTitleLower.includes('business development') || jobTitleLower.includes('sales')) {
      setCredDesignation('Business Development Executive (BDE)');
      setCredRoleCode('BDE');
      setCredDepartment('Sales & Growth');
      setCredReportingManager('Suryansh Thakur (Growth Officer)');
    } else if (jobTitleLower.includes('bdm')) {
      setCredDesignation('Business Development Manager (BDM)');
      setCredRoleCode('BDM');
      setCredDepartment('Sales & Growth');
      setCredReportingManager('Suryansh Thakur (Growth Officer)');
    } else if (jobTitleLower.includes('growth')) {
      setCredDesignation('Growth Officer & Partnerships');
      setCredRoleCode('GROWTH_OFFICER');
      setCredDepartment('Sales & Growth');
      setCredReportingManager('Lakshay (Founder & MD)');
    } else if (jobTitleLower.includes('sde') || jobTitleLower.includes('engineer') || jobTitleLower.includes('developer')) {
      setCredDesignation('Software Development Engineer (SDE)');
      setCredRoleCode('SDE1');
      setCredDepartment('Engineering & Technology');
      setCredReportingManager('Parth Sharma (Engineering Lead)');
    } else if (jobTitleLower.includes('hr')) {
      setCredDesignation('Human Resources Executive');
      setCredRoleCode('HR_EXEC');
      setCredDepartment('People Operations & HR');
      setCredReportingManager('Anshuman (Head of People & HR)');
    } else if (jobTitleLower.includes('ops') || jobTitleLower.includes('operation')) {
      setCredDesignation('Operations Executive');
      setCredRoleCode('OPS_MANAGER');
      setCredDepartment('Operations & Execution');
      setCredReportingManager('Diya Maheshwari (Operations Lead)');
    } else {
      setCredDesignation(app.jobOpening?.title || 'Business Development Executive (BDE)');
      setCredRoleCode('BDE');
      setCredDepartment('Sales & Growth');
      setCredReportingManager('Suryansh Thakur (Growth Officer)');
    }

    setCredModalOpen(true);
  };

  const handleSubmitProvisionCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppForCreds) return;
    setCredSubmitting(true);
    setCredResult(null);

    try {
      const res: any = await apiRequest(`/recruitment/candidates/${selectedAppForCreds.candidateId}/provision-credentials`, {
        method: 'POST',
        body: JSON.stringify({
          applicationId: selectedAppForCreds.id,
          loginEmail: credLoginEmail,
          password: credPassword,
          designation: credDesignation,
          roleCode: credRoleCode,
          department: credDepartment,
          reportingManagerName: credReportingManager,
          sendEmail: credSendEmail
        })
      });

      const creds = res?.data?.credentials || res?.data || { success: true };
      setCredResult(creds);
      showFeedback('success', `🎓 Success! Login credentials generated for ${selectedAppForCreds.candidate.fullName}. Account active!`);
      await loadPipeline();
      if (selectedCandidateId === selectedAppForCreds.candidateId) {
        handleOpenCandidate(selectedCandidateId);
      }
    } catch (err: any) {
      alert(err.message || 'Failed provisioning credentials.');
    } finally {
      setCredSubmitting(false);
    }
  };

  const loadPipeline = async (preferredJobId?: string) => {
    try {
      setLoading(true);
      const [pipeData, jobData] = await Promise.all([
        apiRequest<PipelineStage[]>('/recruitment/pipeline'),
        apiRequest<JobOpening[]>('/recruitment/jobs')
      ]);
      setStages(pipeData);
      setJobs(jobData);
      if (preferredJobId) {
        setSelectedJobId(preferredJobId);
      } else if (jobData.length > 0 && !selectedJobId) {
        setSelectedJobId(jobData[0].id);
      }
    } catch (err) {
      console.error('Failed loading recruitment pipeline:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPipeline();

    const socket = getSocket();

    const onCandidateNew = () => {
      loadPipeline();
      showFeedback('success', '⚡ Real-time Sync: New candidate intake detected!');
    };

    const onStageChanged = (data: any) => {
      loadPipeline();
      if (selectedCandidateId && selectedCandidateId === data.candidateId) {
        handleOpenCandidate(selectedCandidateId);
      }
    };

    const onCandidateUpdated = (data: any) => {
      loadPipeline();
      if (selectedCandidateId && selectedCandidateId === data.candidateId) {
        handleOpenCandidate(selectedCandidateId);
      }
    };

    const onCandidateDeleted = (data: any) => {
      loadPipeline();
      if (selectedCandidateId && selectedCandidateId === data.candidateId) {
        setSelectedCandidateId(null);
        setCandidateDetail(null);
      }
    };

    const onJobEvent = () => {
      loadPipeline();
    };

    const onJourneyEmailSent = (data: any) => {
      if (selectedCandidateId && selectedCandidateId === data.candidateId) {
        handleOpenCandidate(selectedCandidateId);
      }
    };

    socket.on('recruitment:candidate_new', onCandidateNew);
    socket.on('recruitment:stage_changed', onStageChanged);
    socket.on('recruitment:candidate_updated', onCandidateUpdated);
    socket.on('recruitment:candidate_deleted', onCandidateDeleted);
    socket.on('recruitment:job_created', onJobEvent);
    socket.on('recruitment:job_updated', onJobEvent);
    socket.on('recruitment:job_deleted', onJobEvent);
    socket.on('journey:email_sent', onJourneyEmailSent);

    return () => {
      socket.off('recruitment:candidate_new', onCandidateNew);
      socket.off('recruitment:stage_changed', onStageChanged);
      socket.off('recruitment:candidate_updated', onCandidateUpdated);
      socket.off('recruitment:candidate_deleted', onCandidateDeleted);
      socket.off('recruitment:job_created', onJobEvent);
      socket.off('recruitment:job_updated', onJobEvent);
      socket.off('recruitment:job_deleted', onJobEvent);
      socket.off('journey:email_sent', onJourneyEmailSent);
    };
  }, [selectedCandidateId]);

  // Fetch Candidate 360 Full Profile
  const handleOpenCandidate = async (candidateId: string) => {
    setSelectedCandidateId(candidateId);
    setLoadingCandidateDetail(true);
    try {
      const data = await apiRequest<CandidateDetail>(`/recruitment/candidates/${candidateId}`);
      setCandidateDetail(data);
    } catch (err: any) {
      console.error('Failed loading candidate 360 profile:', err);
    } finally {
      setLoadingCandidateDetail(false);
    }
  };

  // Open Edit Candidate Modal
  const handleOpenEditCandidate = (cand: {
    id: string;
    fullName: string;
    emailNormalized: string;
    phoneNormalized?: string;
    resumeUrl?: string;
    notes?: string;
    jobOpeningId?: string;
    stageId?: string;
  }) => {
    setEditingCandidateId(cand.id);
    setEditCandName(cand.fullName || '');
    setEditCandEmail(cand.emailNormalized || '');
    setEditCandPhone(cand.phoneNormalized || '');
    setEditCandJobId(cand.jobOpeningId || (jobs[0]?.id || ''));
    setEditCandStageId(cand.stageId || (stages[0]?.id || ''));
    setEditCandResumeUrl(cand.resumeUrl || '');
    setEditCandNotes(cand.notes || '');
    setEditCandModalOpen(true);
  };

  // Save Candidate Profile & Application updates
  const handleSaveEditCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCandidateId || !editCandName.trim()) return;
    setEditCandSubmitting(true);
    try {
      await apiRequest(`/recruitment/candidates/${editingCandidateId}`, {
        method: 'PUT',
        body: JSON.stringify({
          fullName: editCandName.trim(),
          email: editCandEmail.trim(),
          phone: editCandPhone.trim(),
          jobOpeningId: editCandJobId,
          stageId: editCandStageId,
          resumeUrl: editCandResumeUrl.trim(),
          notes: editCandNotes
        })
      });
      showFeedback('success', `Candidate ${editCandName} updated successfully!`);
      setEditCandModalOpen(false);
      await loadPipeline();
      if (selectedCandidateId === editingCandidateId) {
        await handleOpenCandidate(editingCandidateId);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update candidate');
    } finally {
      setEditCandSubmitting(false);
    }
  };

  // Delete Candidate (Exclusively Founder & Overall Superadmin Lakshay)
  const handleDeleteCandidate = async (candidateId: string, candidateName: string) => {
    if (!isLakshay) {
      alert('Security Violation: Only Lakshay (Founder & Overall Superadmin) is authorized to delete candidates from CodRix OS.');
      return;
    }
    if (!confirm(`Are you sure you want to permanently delete candidate "${candidateName}"? This will delete all applications, notes, and recruitment records.`)) return;

    // Snapshot for rollback
    const prevStages = [...stages];

    // 0ms Optimistic UI removal from stages
    setStages((prev) =>
      prev.map((s) => ({
        ...s,
        applications: s.applications.filter((a) => a.candidateId !== candidateId)
      }))
    );
    if (selectedCandidateId === candidateId) {
      setSelectedCandidateId(null);
      setCandidateDetail(null);
    }
    setSelectedCandidateIds((prev) => prev.filter((id) => id !== candidateId));
    showFeedback('success', `Candidate ${candidateName} has been deleted.`);

    try {
      await apiRequest(`/recruitment/candidates/${candidateId}`, { method: 'DELETE' });
    } catch (err: any) {
      setStages(prevStages);
      showFeedback('error', err.message || 'Failed deleting candidate');
    }
  };

  const handleToggleSelectAllCandidates = () => {
    const allIds = filteredApplications.map((a) => a.candidateId);
    if (selectedCandidateIds.length === allIds.length && allIds.length > 0) {
      setSelectedCandidateIds([]);
    } else {
      setSelectedCandidateIds(allIds);
    }
  };

  const handleToggleSelectOneCandidate = (candidateId: string) => {
    setSelectedCandidateIds((prev) =>
      prev.includes(candidateId) ? prev.filter((id) => id !== candidateId) : [...prev, candidateId]
    );
  };

  const handleBatchDeleteCandidates = async () => {
    if (!isLakshay || selectedCandidateIds.length === 0) return;
    if (
      !confirm(
        `Are you sure you want to permanently delete ${selectedCandidateIds.length} selected candidate(s)? This will delete all applications and records.`
      )
    )
      return;
    try {
      await apiRequest('/recruitment/candidates/batch-delete', {
        method: 'POST',
        body: JSON.stringify({ candidateIds: selectedCandidateIds })
      });
      showFeedback('success', `${selectedCandidateIds.length} candidates deleted successfully.`);
      setSelectedCandidateIds([]);
      if (selectedCandidateId && selectedCandidateIds.includes(selectedCandidateId)) {
        setSelectedCandidateId(null);
        setCandidateDetail(null);
      }
      await loadPipeline();
    } catch (err: any) {
      alert(err.message || 'Failed deleting candidates');
    }
  };

  // Add Quick Evaluation Note in Candidate 360 Drawer
  const handleAddQuickNote = async () => {
    if (!selectedCandidateId || !quickNoteText.trim()) return;
    setQuickNoteSubmitting(true);
    try {
      const res: any = await apiRequest(`/recruitment/candidates/${selectedCandidateId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ noteText: quickNoteText.trim() })
      });
      showFeedback('success', 'Recruiter note added to candidate profile!');
      setQuickNoteText('');
      if (candidateDetail) {
        setCandidateDetail({ ...candidateDetail, notes: res.data?.notes });
      }
    } catch (err: any) {
      alert(err.message || 'Failed to add note');
    } finally {
      setQuickNoteSubmitting(false);
    }
  };

  // Open Create Job Opening Modal
  const handleOpenCreateJob = () => {
    setEditingJob(null);
    setJobFormTab('details');
    setJobTitle('');
    setJobDepartment('Sales & Growth');
    setJobOpeningType('Full-time');
    setJobWorkplaceMode('Hybrid');
    setJobExperienceLevel('1-3 Years');
    setJobHeadcount(1);
    setJobLocation('');
    setJobSalaryMin('');
    setJobSalaryMax('');
    setJobSkills('');
    setJobDescription('');
    setJobStatus('OPEN');
    setJobEmailTemplates(DEFAULT_TEMPLATES);
    setJobSenderEmail('careers@codrix.co.in');
    setJobCustomSenderEmail('');
    setJobSenderName('CodRix Careers');
    setJobReplyToEmail('careers@codrix.co.in');
    setJobEmailProvider('GOOGLE_WORKSPACE');
    setTestFeedback(null);
    setJobModalOpen(true);
  };

  // Open Edit Job Opening Modal
  const handleOpenEditJob = (job: JobOpening) => {
    setEditingJob(job);
    setJobFormTab('details');
    setJobTitle(job.title);
    setJobDepartment(job.departmentId || 'Sales & Growth');
    setJobOpeningType(job.openingType || 'Full-time');
    setJobWorkplaceMode(job.workplaceMode || 'Hybrid');
    setJobExperienceLevel(job.experienceLevel || '1-3 Years');
    setJobHeadcount(job.headcount || 1);
    setJobLocation(job.location || '');
    setJobSalaryMin(job.salaryMin || 0);
    setJobSalaryMax(job.salaryMax || 0);
    setJobSkills(job.skills || '');
    setJobDescription(job.description || '');
    setJobStatus(job.status || 'OPEN');
    setJobEmailTemplates(job.emailTemplates || DEFAULT_TEMPLATES);

    const sender = job.senderEmail || 'careers@codrix.co.in';
    const isStandardSender = ['careers@codrix.co.in', 'connect@codrix.co.in', 'hr@codrix.co.in', 'sales@codrix.co.in'].includes(sender);
    if (isStandardSender) {
      setJobSenderEmail(sender);
      setJobCustomSenderEmail('');
    } else {
      setJobSenderEmail('custom');
      setJobCustomSenderEmail(sender);
    }
    setJobSenderName(job.senderName || 'CodRix Careers');
    setJobReplyToEmail(job.replyToEmail || sender);
    setJobEmailProvider((job.emailProvider as any) || 'GOOGLE_WORKSPACE');
    setTestFeedback(null);
    setJobModalOpen(true);
  };

  // Dispatch Test Email for Stage
  const handleSendTestStageEmail = async (stageName: string) => {
    setTestEmailLoading(true);
    setTestFeedback(null);
    try {
      const activeJobId = editingJob?.id || jobs[0]?.id;
      if (!activeJobId) {
        setTestFeedback({ success: false, message: 'Please save the job opening first before sending a test.' });
        return;
      }
      const effectiveSender = jobSenderEmail === 'custom' ? jobCustomSenderEmail.trim() : jobSenderEmail;
      const target = testTargetEmail.trim() || session?.user?.email || '';
      const tmpl = jobEmailTemplates[stageName] || DEFAULT_TEMPLATES[stageName];

      const res: any = await apiRequest(`/recruitment/jobs/${activeJobId}/test-journey-email`, {
        method: 'POST',
        body: JSON.stringify({
          stageName,
          targetEmail: target,
          customSubject: tmpl.subject,
          customBody: tmpl.body,
          senderEmail: effectiveSender,
          senderName: jobSenderName,
          replyToEmail: jobReplyToEmail
        })
      });

      setTestFeedback({ success: true, message: res.data?.message || `Test email dispatched to ${target}!` });
    } catch (err: any) {
      setTestFeedback({ success: false, message: err.message || 'Failed to dispatch test email.' });
    } finally {
      setTestEmailLoading(false);
    }
  };

  // Save Job Opening (Create or Update)
  const handleSaveJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobTitle.trim()) return;
    setJobSubmitting(true);
    try {
      const effectiveSender = jobSenderEmail === 'custom' ? jobCustomSenderEmail.trim() : jobSenderEmail;
      const payload = {
        title: jobTitle.trim(),
        departmentId: jobDepartment,
        openingType: jobOpeningType,
        workplaceMode: jobWorkplaceMode,
        experienceLevel: jobExperienceLevel,
        headcount: Number(jobHeadcount) || 1,
        location: jobLocation,
        salaryMin: Number(jobSalaryMin) || 0,
        salaryMax: Number(jobSalaryMax) || 0,
        skills: jobSkills,
        description: jobDescription || `${jobTitle} at CodRix Private Limited`,
        emailTemplates: jobEmailTemplates,
        senderEmail: effectiveSender || 'careers@codrix.co.in',
        senderName: jobSenderName.trim() || 'CodRix Careers',
        replyToEmail: jobReplyToEmail.trim() || effectiveSender || 'careers@codrix.co.in',
        emailProvider: jobEmailProvider,
        status: jobStatus
      };

      if (editingJob) {
        await apiRequest(`/recruitment/jobs/${editingJob.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        showFeedback('success', `Job Opening ${editingJob.requisitionCode} updated successfully!`);
      } else {
        const created: any = await apiRequest('/recruitment/jobs', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showFeedback('success', `Job Opening ${created?.requisitionCode || ''} created & ready for live website registration!`);
      }

      setJobModalOpen(false);
      await loadPipeline();
    } catch (err: any) {
      alert(err.message || 'Failed to save job opening');
    } finally {
      setJobSubmitting(false);
    }
  };

  // Delete Job Opening (Exclusively Founder & Overall Superadmin Lakshay)
  const handleDeleteJob = async (jobId: string, reqCode: string) => {
    if (!isLakshay) {
      alert('Security Violation: Only Lakshay (Founder & Overall Superadmin) is authorized to delete job openings from CodRix OS.');
      return;
    }
    if (!confirm(`Are you sure you want to delete job opening ${reqCode}? This action cannot be undone.`)) return;
    try {
      await apiRequest(`/recruitment/jobs/${jobId}`, { method: 'DELETE' });
      showFeedback('success', `Job opening ${reqCode} deleted.`);
      await loadPipeline();
    } catch (err: any) {
      alert(err.message || 'Failed deleting job opening');
    }
  };

  // Advance Candidate Stage (Instant 0ms Optimistic UI)
  const handleStageChange = async (applicationId: string, targetStageId: string) => {
    const targetStage = stages.find((s) => s.id === targetStageId);
    const targetStageName = targetStage?.name || 'New Stage';

    // Snapshot previous state for rollback
    const prevStages = [...stages];
    const prevCandidateDetail = candidateDetail ? { ...candidateDetail } : null;

    // 0ms Optimistic move across stages state
    setStages((currentStages) => {
      let movedApp: Application | null = null;
      const strippedStages = currentStages.map((st) => {
        const found = st.applications.find((a) => a.id === applicationId);
        if (found) {
          movedApp = { ...found, stageId: targetStageId };
          return {
            ...st,
            applications: st.applications.filter((a) => a.id !== applicationId)
          };
        }
        return st;
      });

      if (movedApp) {
        return strippedStages.map((st) => {
          if (st.id === targetStageId) {
            return {
              ...st,
              applications: [movedApp!, ...st.applications]
            };
          }
          return st;
        });
      }
      return strippedStages;
    });

    // 0ms Optimistic update in open Candidate Drawer
    if (candidateDetail && candidateDetail.application && candidateDetail.application.id === applicationId) {
      setCandidateDetail({
        ...candidateDetail,
        application: {
          ...candidateDetail.application,
          stageId: targetStageId,
          stageName: targetStageName
        }
      });
    }

    showFeedback('success', `Candidate moved to ${targetStageName}. Automated journey email dispatched!`);

    try {
      await apiRequest(`/recruitment/applications/${applicationId}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({ stageId: targetStageId })
      });
    } catch (err: any) {
      // Rollback on network failure
      setStages(prevStages);
      if (prevCandidateDetail) setCandidateDetail(prevCandidateDetail);
      showFeedback('error', err.message || 'Failed updating candidate stage');
    }
  };

  // Create Candidate Intake (Instant 0ms Optimistic UI)
  const handleCreateCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCandidateError(null);
    const cleanName = candidateName.trim();
    const cleanEmail = candidateEmail.trim();
    const cleanPhone = candidatePhone.trim();

    if (!cleanName) {
      setCandidateError('Candidate full name is required.');
      return;
    }
    if (!cleanEmail) {
      setCandidateError('Candidate email address is required.');
      return;
    }

    const finalJobId = selectedJobId || (jobs.length > 0 ? jobs[0].id : '');
    const matchedJob = jobs.find((j) => j.id === finalJobId);
    const sourcedStage = stages.find((s) => s.stageOrder === 1) || stages[0];

    // Optimistic temporary item
    const tempId = `temp_${Date.now()}`;
    const nextSerialNo = allApplications.length + 1;
    const tempRequestNo = `REQ-${nextSerialNo.toString().padStart(4, '0')}`;

    const optimisticApp: any = {
      id: tempId,
      candidateId: tempId,
      serialNo: nextSerialNo,
      requestNo: tempRequestNo,
      jobOpeningId: finalJobId,
      stageId: sourcedStage?.id || 'stage_sourced',
      status: 'ACTIVE',
      appliedAt: new Date().toISOString(),
      candidate: {
        id: tempId,
        serialNo: nextSerialNo,
        requestNo: tempRequestNo,
        fullName: cleanName,
        emailNormalized: cleanEmail,
        phoneNormalized: cleanPhone,
        source: 'CAREERS_PAGE',
        notes: ''
      },
      jobOpening: matchedJob
    };

    // 0ms instant UI update & close modal immediately
    setStages((prev) =>
      prev.map((s) => {
        if (s.id === (sourcedStage?.id || prev[0]?.id)) {
          return {
            ...s,
            applications: [optimisticApp, ...s.applications]
          };
        }
        return s;
      })
    );

    setCandidateModalOpen(false);
    setCandidateName('');
    setCandidateEmail('');
    setCandidatePhone('');
    showFeedback('success', `Candidate ${cleanName} ingested into Sourced!`);

    try {
      await apiRequest('/recruitment/candidates', {
        method: 'POST',
        body: JSON.stringify({
          fullName: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          jobOpeningId: finalJobId
        })
      });
      loadPipeline();
    } catch (err: any) {
      showFeedback('error', err.message || 'Error creating candidate application.');
      loadPipeline();
    }
  };

  // Convert to Active Employee in HRMS
  const handleConvertToEmployee = async (appId: string) => {
    if (!confirm('Convert this candidate into an active Employee in HRMS? An employee record will be created in MongoDB Atlas.')) return;
    try {
      const res: any = await apiRequest(`/recruitment/applications/${appId}/convert-to-employee`, {
        method: 'POST'
      });
      showFeedback('success', `Candidate converted to Employee (${res?.employeeCode || 'CDX-EMP'}) in HRMS!`);
      await loadPipeline();
      if (selectedCandidateId) {
        await handleOpenCandidate(selectedCandidateId);
      }
    } catch (err: any) {
      alert(err.message || 'Failed converting candidate to employee');
    }
  };

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setActionFeedback({ type, message });
    setTimeout(() => setActionFeedback(null), 5000);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 3000);
  };

  // Flattened Candidates List for Excel Table
  const allApplications = useMemo(() => {
    const list: Array<Application & { stageName: string; stageOrder: number }> = [];
    stages.forEach((stage) => {
      stage.applications.forEach((app) => {
        list.push({
          ...app,
          stageName: stage.name,
          stageOrder: stage.stageOrder
        });
      });
    });
    return list;
  }, [stages]);

  // Filtered Applications for Excel View
  const filteredApplications = useMemo(() => {
    return allApplications.filter((app) => {
      const matchesSearch =
        !searchQuery.trim() ||
        app.candidate.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.candidate.emailNormalized.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (app.candidate.phoneNormalized && app.candidate.phoneNormalized.includes(searchQuery)) ||
        app.jobOpening.title.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesJob = filterJobId === 'ALL' || app.jobOpeningId === filterJobId;
      const matchesStage = filterStageId === 'ALL' || app.stageId === filterStageId;

      return matchesSearch && matchesJob && matchesStage;
    });
  }, [allApplications, searchQuery, filterJobId, filterStageId]);

  const apiBaseUrl = window.location.hostname === 'localhost' ? 'http://localhost:5000' : window.location.origin;

  return (
    <div className="space-y-4 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Action Toast Feedback */}
      {actionFeedback && (
        <div className={`p-3.5 rounded-2xl text-xs font-bold border transition flex items-center justify-between shadow-md animate-in fade-in ${actionFeedback.type === 'success'
            ? 'bg-[#EAFBF3] text-[#0A7E46] border-[#B6EAD0]'
            : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}>
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
            <span>{actionFeedback.message}</span>
          </div>
          <button onClick={() => setActionFeedback(null)} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-[#E7E0FB] p-5 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-extrabold text-[#120E24] tracking-tight">Recruitment & ATS Pipeline</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EDE4FF] text-[#7C2CF5] border border-[#DDD0FE]">
              {allApplications.length} Candidates • {jobs.length} Active Openings
            </span>
          </div>
          <p className="text-xs text-[#585172] mt-0.5">
            Manage candidate applications, automated journey email triggers, live website webscripts, and hiring transitions
          </p>
        </div>

        {/* Action Controls & Views */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Toggle Pill */}
          <div className="bg-[#F7F5FE] p-1 rounded-xl border border-[#E7E0FB] flex items-center gap-1">
            <button
              onClick={() => setActiveView('excel')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${activeView === 'excel'
                  ? 'bg-white text-[#7C2CF5] shadow-xs'
                  : 'text-[#585172] hover:text-[#120E24]'
                }`}
              title="Spreadsheet Excel Format View"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel Grid View</span>
            </button>

            <button
              onClick={() => setActiveView('kanban')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${activeView === 'kanban'
                  ? 'bg-white text-[#7C2CF5] shadow-xs'
                  : 'text-[#585172] hover:text-[#120E24]'
                }`}
              title="Kanban Board View (All 7 Stages)"
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Kanban Board</span>
            </button>

            <button
              onClick={() => setActiveView('openings')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${activeView === 'openings'
                  ? 'bg-white text-[#7C2CF5] shadow-xs'
                  : 'text-[#585172] hover:text-[#120E24]'
                }`}
              title="Manage Job Openings & Website Scripts"
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Job Openings ({jobs.length})</span>
            </button>
          </div>

          <button
            onClick={handleOpenCreateJob}
            className="px-3.5 py-2 bg-[#F0ECFC] hover:bg-[#EDE4FF] text-[#7C2CF5] border border-[#E7E0FB] rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            title="Post a new job requisition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Post Job Opening</span>
          </button>

          <button
            onClick={() => setCandidateModalOpen(true)}
            className="px-4 py-2 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl text-xs font-bold shadow-md shadow-[#7C2CF5]/25 transition flex items-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Candidate Intake</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: EXCEL GRID FORMAT (Requested Primary View) */}
      {activeView === 'excel' && (
        <div className="bg-white rounded-2xl border border-[#E7E0FB] shadow-xs overflow-hidden">
          {/* Filters Bar */}
          <div className="p-3.5 border-b border-[#E7E0FB] bg-[#FBFBFE] flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex flex-1 items-center gap-2 w-full md:max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-[#585172] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search candidate by name, email, phone or role..."
                  className="w-full bg-white border border-[#E7E0FB] rounded-xl pl-9 pr-3 py-2 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto">
              <div className="flex items-center gap-1.5 text-xs">
                <Filter className="w-3.5 h-3.5 text-[#585172]" />
                <span className="text-[#585172] font-semibold">Opening:</span>
                <select
                  value={filterJobId}
                  onChange={(e) => setFilterJobId(e.target.value)}
                  className="bg-white border border-[#E7E0FB] rounded-xl px-2.5 py-1.5 text-xs text-[#120E24] font-semibold focus:outline-none focus:border-[#7C2CF5]"
                >
                  <option value="ALL">All Openings ({jobs.length})</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title} ({j.requisitionCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[#585172] font-semibold">Stage:</span>
                <select
                  value={filterStageId}
                  onChange={(e) => setFilterStageId(e.target.value)}
                  className="bg-white border border-[#E7E0FB] rounded-xl px-2.5 py-1.5 text-xs text-[#120E24] font-semibold focus:outline-none focus:border-[#7C2CF5]"
                >
                  <option value="ALL">All Stages (7)</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Batch Action Floating Bar for Lakshay */}
          {isLakshay && selectedCandidateIds.length > 0 && (
            <div className="bg-[#120E24] text-white px-5 py-3 mx-3 my-2 rounded-2xl shadow-xl flex items-center justify-between border border-[#302B47] animate-in fade-in">
              <div className="flex items-center gap-3">
                <span className="bg-[#7C2CF5] text-white text-xs font-bold px-2.5 py-1 rounded-lg">
                  {selectedCandidateIds.length} Candidates Selected
                </span>
                <span className="text-xs text-[#A29DB8]">
                  Select candidates for bulk action or permanent deletion.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCandidateIds([])}
                  className="text-xs text-[#A29DB8] hover:text-white px-3 py-1.5 rounded-lg transition"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleBatchDeleteCandidates}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-600/30 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected ({selectedCandidateIds.length})</span>
                </button>
              </div>
            </div>
          )}

          {/* Excel Spreadsheet Table */}
          <div className="overflow-x-auto max-h-[calc(100vh-270px)]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#F7F5FE] text-[#120E24] font-bold sticky top-0 z-10 border-b border-[#E7E0FB]">
                <tr>
                  {isLakshay && (
                    <th className="py-3 px-2 border-r border-[#E7E0FB] w-10 text-center">
                      <input
                        type="checkbox"
                        checked={filteredApplications.length > 0 && selectedCandidateIds.length === filteredApplications.length}
                        onChange={handleToggleSelectAllCandidates}
                        className="w-4 h-4 rounded text-[#7C2CF5] accent-[#7C2CF5] cursor-pointer"
                        title="Select all candidates"
                      />
                    </th>
                  )}
                  <th className="py-3 px-3.5 border-r border-[#E7E0FB] w-12 text-center text-[#585172]">#</th>
                  <th className="py-3 px-4 border-r border-[#E7E0FB]">Candidate Name</th>
                  <th className="py-3 px-4 border-r border-[#E7E0FB]">Target Requisition</th>
                  <th className="py-3 px-4 border-r border-[#E7E0FB]">Email Address</th>
                  <th className="py-3 px-4 border-r border-[#E7E0FB]">Phone Number</th>
                  <th className="py-3 px-4 border-r border-[#E7E0FB]">Current Stage</th>
                  <th className="py-3 px-4 border-r border-[#E7E0FB]">Advance Stage (Journey Trigger)</th>
                  <th className="py-3 px-4 border-r border-[#E7E0FB]">Source</th>
                  <th className="py-3 px-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E0FB]/80">
                {filteredApplications.length === 0 ? (
                  <tr>
                    <td colSpan={isLakshay ? 10 : 9} className="py-12 text-center text-[#585172]">
                      <Briefcase className="w-8 h-8 text-[#DDD0FE] mx-auto mb-2" />
                      <p className="font-bold text-[#120E24]">No candidate records match your query</p>
                      <p className="text-[11px] mt-1">Click "Add Candidate Intake" or switch filters to view applicants.</p>
                    </td>
                  </tr>
                ) : (
                  filteredApplications.map((app, index) => {
                    const isSelected = selectedCandidateId === app.candidateId;
                    return (
                      <tr
                        key={app.id}
                        className={`hover:bg-[#F9F7FE] transition ${isSelected ? 'bg-[#F2EDFD]' : 'bg-white'}`}
                      >
                        {isLakshay && (
                          <td className="py-3 px-2 border-r border-[#E7E0FB] text-center">
                            <input
                              type="checkbox"
                              checked={selectedCandidateIds.includes(app.candidateId)}
                              onChange={() => handleToggleSelectOneCandidate(app.candidateId)}
                              className="w-4 h-4 rounded text-[#7C2CF5] accent-[#7C2CF5] cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="py-3 px-3.5 border-r border-[#E7E0FB] text-center text-[11px] font-mono text-[#585172]">
                          {app.serialNo || index + 1}
                        </td>

                        <td className="py-3 px-4 border-r border-[#E7E0FB]">
                          <button
                            type="button"
                            onClick={() => handleOpenCandidate(app.candidateId)}
                            className="text-left font-bold text-[#7C2CF5] hover:underline flex items-center gap-1.5"
                          >
                            <span>{app.candidate.fullName}</span>
                            <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-70" />
                          </button>
                        </td>

                        <td className="py-3 px-4 border-r border-[#E7E0FB]">
                          <div className="font-bold text-[#120E24] truncate max-w-[180px]">{app.jobOpening.title}</div>
                          <div className="text-[10px] font-mono text-[#7C2CF5] flex items-center gap-1.5">
                            <span className="font-bold">{app.requestNo || app.jobOpening.requisitionCode}</span>
                            <span className="text-[9px] text-[#585172] bg-[#EDE4FF] text-[#7C2CF5] px-1 py-0.2 rounded font-sans">
                              #{app.serialNo || index + 1}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4 border-r border-[#E7E0FB]">
                          <div className="flex items-center gap-1.5 text-[#120E24] font-medium truncate max-w-[190px]">
                            <Mail className="w-3.5 h-3.5 text-[#7C2CF5] shrink-0" />
                            <span>{app.candidate.emailNormalized}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4 border-r border-[#E7E0FB]">
                          <div className="flex items-center gap-1.5 text-[#585172] font-mono text-[11px]">
                            <Phone className="w-3.5 h-3.5 text-[#7C2CF5] shrink-0" />
                            <span>{app.candidate.phoneNormalized || '—'}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4 border-r border-[#E7E0FB]">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold ${app.stageName === 'Hired'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : app.stageName === 'Offer Extended'
                                ? 'bg-purple-50 text-purple-800 border border-purple-200'
                                : app.stageName === 'Internship'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-[#EDE4FF] text-[#7C2CF5] border border-[#DDD0FE]'
                            }`}>
                            {app.stageName === 'Internship' && <GraduationCap className="w-3 h-3 mr-1 text-amber-700" />}
                            {app.stageName}
                          </span>
                        </td>

                        <td className="py-3 px-4 border-r border-[#E7E0FB]">
                          <select
                            value={app.stageId}
                            onChange={(e) => handleStageChange(app.id, e.target.value)}
                            className="bg-[#F7F5FE] border border-[#E7E0FB] rounded-lg px-2.5 py-1 text-[11px] text-[#120E24] font-semibold focus:outline-none focus:border-[#7C2CF5] cursor-pointer"
                          >
                            {stages.map((s) => (
                              <option key={s.id} value={s.id}>
                                Move to: {s.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="py-3 px-4 border-r border-[#E7E0FB] text-[11px] text-[#585172]">
                          <span className="truncate block max-w-[120px]">{app.candidate.source || 'Website'}</span>
                        </td>

                        <td className="py-3 px-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {/* Prominent Intern & Hire Credential Generation Button */}
                            {['Internship', 'Offer Extended', 'Hired'].includes(app.stageName) && (
                              app.candidate.credentials?.generated ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenCredentialsModal(app)}
                                  className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[10px] font-extrabold inline-flex items-center gap-1 transition shadow-2xs"
                                  title={`Credentials Provisioned: ${app.candidate.credentials.loginEmail} (${app.candidate.credentials.employeeCode})`}
                                >
                                  <Key className="w-3 h-3 text-emerald-600" />
                                  <span>Active Creds</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenCredentialsModal(app)}
                                  className="px-2.5 py-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-lg text-[10px] font-extrabold inline-flex items-center gap-1 shadow-xs transition"
                                  title="Admin & HR: Provision Login Credentials & Access Control"
                                >
                                  <Key className="w-3 h-3" />
                                  <span>Generate Creds</span>
                                </button>
                              )
                            )}

                            <button
                              type="button"
                              onClick={() => handleOpenCandidate(app.candidateId)}
                              className="px-2 py-1 bg-[#F0ECFC] hover:bg-[#EDE4FF] text-[#7C2CF5] rounded-lg text-[11px] font-bold transition inline-flex items-center gap-1"
                              title="Inspect Candidate 360 Profile"
                            >
                              <span>Inspect</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditCandidate({
                                id: app.candidateId,
                                fullName: app.candidate.fullName,
                                emailNormalized: app.candidate.emailNormalized,
                                phoneNormalized: app.candidate.phoneNormalized,
                                resumeUrl: app.candidate.resumeUrl,
                                notes: app.candidate.notes,
                                jobOpeningId: app.jobOpeningId,
                                stageId: app.stageId
                              })}
                              className="p-1 text-[#585172] hover:text-[#7C2CF5] hover:bg-[#EDE4FF] rounded-lg transition"
                              title="Edit Candidate Profile"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {isLakshay && (
                              <button
                                type="button"
                                onClick={() => handleDeleteCandidate(app.candidateId, app.candidate.fullName)}
                                className="p-1 text-[#585172] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                title="Delete Candidate Application (Founder Only)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer Status */}
          <div className="p-3 border-t border-[#E7E0FB] bg-[#F7F5FE] flex items-center justify-between text-xs text-[#585172]">
            <span>Showing {filteredApplications.length} of {allApplications.length} candidate applications</span>
            <span className="font-semibold text-[#7C2CF5]">
              Real-time MongoDB Atlas ATS Grid • Auto Journey Emails Active
            </span>
          </div>
        </div>
      )}

      {/* VIEW 2: KANBAN BOARD (All 7 Stages including Internship) */}
      {activeView === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-6">
          {stages.map((stage) => (
            <div
              key={stage.id}
              className="w-80 shrink-0 bg-[#F7F5FE] rounded-2xl p-3.5 border border-[#E7E0FB] flex flex-col max-h-[calc(100vh-210px)]"
            >
              <div className="flex items-center justify-between px-2 py-1.5 mb-2 border-b border-[#E7E0FB] pb-2">
                <div className="flex items-center gap-1.5">
                  {stage.name === 'Internship' && <GraduationCap className="w-3.5 h-3.5 text-amber-600" />}
                  <span className="text-xs font-extrabold text-[#120E24] uppercase tracking-wider">{stage.name}</span>
                </div>
                <span className="px-2 py-0.5 bg-[#EDE4FF] text-[#7C2CF5] rounded-full text-[11px] font-bold">
                  {stage.applications.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {stage.applications.length === 0 ? (
                  <div className="h-28 border border-dashed border-[#DDD0FE] rounded-xl flex items-center justify-center text-xs text-[#585172]">
                    No candidates in {stage.name}
                  </div>
                ) : (
                  stage.applications.map((app) => (
                    <div
                      key={app.id}
                      onClick={() => handleOpenCandidate(app.candidateId)}
                      className="bg-white p-4 rounded-xl border border-[#E7E0FB] shadow-xs space-y-2.5 hover:border-[#7C2CF5] cursor-pointer transition"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <div className="font-bold text-[#120E24] text-sm hover:text-[#7C2CF5] transition">
                            {app.candidate.fullName}
                          </div>
                          <div className="text-xs text-[#7C2CF5] font-semibold truncate max-w-[170px]">
                            {app.jobOpening.title}
                          </div>
                        </div>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleOpenEditCandidate({
                              id: app.candidateId,
                              fullName: app.candidate.fullName,
                              emailNormalized: app.candidate.emailNormalized,
                              phoneNormalized: app.candidate.phoneNormalized,
                              resumeUrl: app.candidate.resumeUrl,
                              notes: app.candidate.notes,
                              jobOpeningId: app.jobOpeningId,
                              stageId: app.stageId
                            })}
                            className="p-1 text-[#585172] hover:text-[#7C2CF5] hover:bg-[#EDE4FF] rounded-md transition"
                            title="Edit Candidate Profile"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          {isLakshay && (
                            <button
                              type="button"
                              onClick={() => handleDeleteCandidate(app.candidateId, app.candidate.fullName)}
                              className="p-1 text-[#585172] hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                              title="Delete Candidate (Founder Only)"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="text-xs text-[#585172] space-y-1">
                        <div className="flex items-center gap-1.5 truncate">
                          <Mail className="w-3.5 h-3.5 text-[#7C2CF5] shrink-0" />
                          <span>{app.candidate.emailNormalized}</span>
                        </div>
                        {app.candidate.phoneNormalized && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-[#7C2CF5] shrink-0" />
                            <span>{app.candidate.phoneNormalized}</span>
                          </div>
                        )}
                      </div>

                      {/* Advance Stage Control */}
                      <div
                        className="pt-2 border-t border-[#E7E0FB] flex items-center justify-between gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <select
                          value={stage.id}
                          onChange={(e) => handleStageChange(app.id, e.target.value)}
                          className="text-[11px] bg-[#F7F5FE] border border-[#E7E0FB] rounded-lg px-2 py-1 text-[#120E24] font-semibold focus:outline-none"
                        >
                          {stages.map((s) => (
                            <option key={s.id} value={s.id}>
                              Move to: {s.name}
                            </option>
                          ))}
                        </select>

                        {stage.name === 'Hired' && (
                          <button
                            type="button"
                            onClick={() => handleConvertToEmployee(app.id)}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[10px] font-bold transition flex items-center gap-1 shadow-2xs"
                            title="Convert to HRMS Employee"
                          >
                            <UserCheck className="w-3 h-3" />
                            <span>To HRMS</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VIEW 3: JOB OPENINGS DIRECTORY & WEBSCRIPT MANAGER */}
      {activeView === 'openings' && (
        <div className="bg-white rounded-2xl border border-[#E7E0FB] shadow-xs p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E7E0FB]">
            <div>
              <h3 className="text-base font-bold text-[#120E24]">Live Company Job Openings & Website Integrations</h3>
              <p className="text-xs text-[#585172] mt-0.5">
                Manage requisitions, embed live forms on <strong>codrix.co.in</strong> via auto-generated webscripts, and configure stage email journeys.
              </p>
            </div>
            <button
              onClick={handleOpenCreateJob}
              className="px-4 py-2 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-[#7C2CF5]/25"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Opening</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="p-5 rounded-2xl border border-[#E7E0FB] bg-[#FBFBFE] hover:border-[#7C2CF5]/50 transition flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded-md bg-[#EDE4FF] text-[#7C2CF5] font-mono text-[10px] font-bold">
                      {job.requisitionCode}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${job.status === 'OPEN'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : job.status === 'DRAFT'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                      ● {job.status}
                    </span>
                  </div>

                  <h4 className="font-bold text-sm text-[#120E24] line-clamp-1">{job.title}</h4>
                  <div className="text-xs text-[#7C2CF5] font-semibold mt-0.5">{job.departmentId}</div>

                  <div className="mt-3 space-y-1.5 text-[11px] text-[#585172]">
                    <div className="flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-[#7C2CF5]" />
                      <span>{job.openingType || 'Full-time'} • {job.workplaceMode || 'Hybrid'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#7C2CF5]" />
                      <span>{job.location}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-[#7C2CF5]" />
                      <span>₹{(job.salaryMin || 0).toLocaleString()} - ₹{(job.salaryMax || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#E7E0FB] flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-[#120E24]">
                    <span className="text-[#7C2CF5]">{job.applicantCount ?? 0}</span> applicants
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setWebscriptModalJob(job)}
                      className="px-2.5 py-1.5 bg-[#EDE4FF] hover:bg-[#DDD0FE] text-[#7C2CF5] rounded-lg text-xs font-bold transition flex items-center gap-1"
                      title="Get auto-generated Webscript for codrix.co.in"
                    >
                      <Code className="w-3.5 h-3.5" />
                      <span>Webscript</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEditJob(job)}
                      className="p-1.5 hover:bg-[#F0ECFC] text-[#585172] hover:text-[#7C2CF5] rounded-lg transition"
                      title="Edit Job Opening"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {isLakshay && (
                      <button
                        type="button"
                        onClick={() => handleDeleteJob(job.id, job.requisitionCode)}
                        className="p-1.5 hover:bg-rose-50 text-[#585172] hover:text-rose-600 rounded-lg transition"
                        title="Delete Job Opening (Founder Only)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CANDIDATE 360 DRAWER / MODAL */}
      {selectedCandidateId && (
        <div className="fixed inset-0 bg-[#120E24]/40 backdrop-blur-xs flex items-center justify-end z-50 animate-in fade-in">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl border-l border-[#E7E0FB] flex flex-col p-6 overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#E7E0FB]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#7C2CF5]">
                  Candidate 360 Profile
                </span>
                <h3 className="font-bold text-lg text-[#120E24]">
                  {candidateDetail?.fullName || 'Candidate Profile'}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {candidateDetail && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleOpenEditCandidate({
                        id: candidateDetail.id,
                        fullName: candidateDetail.fullName,
                        emailNormalized: candidateDetail.emailNormalized,
                        phoneNormalized: candidateDetail.phoneNormalized,
                        resumeUrl: candidateDetail.resumeUrl,
                        notes: candidateDetail.notes,
                        jobOpeningId: candidateDetail.application?.jobOpeningId,
                        stageId: candidateDetail.application?.stageId
                      })}
                      className="px-2.5 py-1.5 bg-[#EDE4FF] hover:bg-[#DDD0FE] text-[#7C2CF5] rounded-xl font-bold text-xs flex items-center gap-1 transition"
                      title="Edit Candidate Profile"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    {isLakshay && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCandidate(candidateDetail.id, candidateDetail.fullName)}
                        className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl font-bold text-xs flex items-center gap-1 transition"
                        title="Delete Candidate (Founder Only)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    )}
                  </>
                )}
                <button
                  onClick={() => {
                    setSelectedCandidateId(null);
                    setCandidateDetail(null);
                  }}
                  className="p-1.5 text-[#585172] hover:text-[#120E24] hover:bg-[#F7F5FE] rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {loadingCandidateDetail ? (
              <div className="py-24 text-center text-xs text-[#585172]">
                <RefreshCw className="w-6 h-6 animate-spin text-[#7C2CF5] mx-auto mb-2" />
                <span>Loading Candidate 360 Information...</span>
              </div>
            ) : candidateDetail ? (
              <div className="py-4 space-y-6 text-xs">
                {/* Contact Card */}
                <div className="p-4 rounded-xl bg-[#F7F5FE] border border-[#E7E0FB] space-y-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#120E24]">
                    <span>{candidateDetail.fullName}</span>
                    <span className="text-xs font-mono text-[#7C2CF5]">
                      • {candidateDetail.requestNo || candidateDetail.application?.requisitionCode}
                      {candidateDetail.serialNo && ` (Candidate #${candidateDetail.serialNo})`}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[#585172]">
                    <div className="flex items-center gap-1.5 truncate">
                      <Mail className="w-3.5 h-3.5 text-[#7C2CF5]" />
                      <span>{candidateDetail.emailNormalized}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-[#7C2CF5]" />
                      <span>{candidateDetail.phoneNormalized || 'Not provided'}</span>
                    </div>
                  </div>
                  <div className="text-[11px] text-[#585172]">
                    Source: <span className="font-semibold text-[#120E24]">{candidateDetail.source}</span>
                  </div>
                </div>

                {/* 7-Stage Visual Journey Stepper */}
                <div>
                  <h4 className="font-bold text-[#120E24] mb-2 flex items-center justify-between">
                    <span>Recruitment Journey Progression</span>
                    <span className="text-[11px] text-[#7C2CF5] font-semibold">
                      Current: {candidateDetail.application?.stageName}
                    </span>
                  </h4>

                  <div className="grid grid-cols-7 gap-1 text-center">
                    {stages.map((stage, idx) => {
                      const isCurrent = candidateDetail.application?.stageId === stage.id;
                      const isPassed =
                        candidateDetail.application &&
                        stage.stageOrder <=
                        (stages.find((s) => s.id === candidateDetail.application?.stageId)?.stageOrder || 1);

                      return (
                        <div key={stage.id} className="space-y-1">
                          <div
                            className={`h-2 rounded-full transition ${isCurrent
                                ? 'bg-[#7C2CF5] ring-2 ring-[#7C2CF5]/40'
                                : isPassed
                                  ? 'bg-emerald-500'
                                  : 'bg-[#E7E0FB]'
                              }`}
                          />
                          <span className={`text-[9px] font-bold block truncate ${isCurrent ? 'text-[#7C2CF5]' : 'text-[#585172]'}`}>
                            {stage.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Move Stage Action Box */}
                {candidateDetail.application && (
                  <div className="p-4 rounded-xl border border-[#DDD0FE] bg-[#F8F5FF] space-y-2.5">
                    <div className="font-bold text-[#120E24] flex items-center justify-between">
                      <span>Advance Pipeline Stage</span>
                      <span className="text-[10px] text-[#7C2CF5] font-bold">Auto-Sends Stage Email</span>
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={candidateDetail.application.stageId}
                        onChange={(e) => handleStageChange(candidateDetail.application!.id, e.target.value)}
                        className="flex-1 bg-white border border-[#E7E0FB] rounded-xl px-3 py-2 font-bold text-xs text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                      >
                        {stages.map((s) => (
                          <option key={s.id} value={s.id}>
                            Move to: {s.name}
                          </option>
                        ))}
                      </select>

                      {candidateDetail.application.stageName === 'Hired' && (
                        <button
                          type="button"
                          onClick={() => handleConvertToEmployee(candidateDetail.application!.id)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition flex items-center gap-1.5"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Convert to Employee</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* 🎓 Onboarding & Role-Based Access Control (RBAC) Card */}
                <div className="p-4 rounded-2xl border border-[#DDD0FE] bg-gradient-to-br from-[#FAF7FF] via-[#F5EFFF] to-[#EDE4FF] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-[#7C2CF5] text-white flex items-center justify-center font-bold shadow-xs">
                        <Key className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-[#120E24] text-xs">
                          {candidateDetail.credentials?.generated ? 'Employee / Intern Credentials & Access Active' : 'Provision Login Credentials & Access Control'}
                        </h4>
                        <p className="text-[10px] text-[#585172]">
                          {candidateDetail.credentials?.generated
                            ? 'Account provisioned in MongoDB with designated role permissions'
                            : 'Admin & HR: Generate portal login & designation-based access'}
                        </p>
                      </div>
                    </div>
                    {candidateDetail.credentials?.generated && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Active</span>
                      </span>
                    )}
                  </div>

                  {candidateDetail.credentials?.generated ? (
                    <div className="p-3.5 bg-white rounded-xl border border-[#DDD0FE] space-y-1.5 text-[11px] shadow-2xs">
                      <div className="flex justify-between items-center">
                        <span className="text-[#585172]">Employee Code:</span>
                        <span className="font-mono font-extrabold text-[#7C2CF5]">{candidateDetail.credentials.employeeCode}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#585172]">Login Email:</span>
                        <span className="font-bold text-[#120E24]">{candidateDetail.credentials.loginEmail}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#585172]">Designation & Role:</span>
                        <span className="font-bold text-[#7C2CF5]">{candidateDetail.credentials.designation} ({candidateDetail.credentials.roleCode})</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#585172]">Reporting Manager:</span>
                        <span className="font-semibold text-[#120E24]">{candidateDetail.credentials.reportingManagerName}</span>
                      </div>
                      <div className="flex justify-between items-center pt-1.5 border-t border-[#E7E0FB]">
                        <span className="text-[#585172]">Provisioned By:</span>
                        <span className="text-[#585172] font-medium">{candidateDetail.credentials.generatedBy}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const matchedApp = allApplications.find(a => a.candidateId === candidateDetail.id);
                          if (matchedApp) handleOpenCredentialsModal(matchedApp);
                        }}
                        className="mt-2 w-full py-2 bg-[#F0ECFC] hover:bg-[#EDE4FF] text-[#7C2CF5] rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition"
                      >
                        <Key className="w-3.5 h-3.5" />
                        <span>Reset Password or Change Role Access</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const matchedApp = allApplications.find(a => a.candidateId === candidateDetail.id);
                        if (matchedApp) handleOpenCredentialsModal(matchedApp);
                      }}
                      className="w-full py-2.5 bg-gradient-to-r from-[#7C2CF5] to-[#6D25D9] hover:from-[#6D25D9] hover:to-[#5B1EB7] text-white rounded-xl font-extrabold text-xs shadow-md shadow-[#7C2CF5]/25 flex items-center justify-center gap-2 transition"
                    >
                      <Key className="w-4 h-4" />
                      <span>Generate Credentials & Assign Designation Access</span>
                    </button>
                  )}
                </div>

                {/* Resume Section */}
                {candidateDetail.resumeUrl && (
                  <div className="p-3 bg-white border border-[#E7E0FB] rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-[#7C2CF5]" />
                      <span className="font-bold text-[#120E24]">Attached Resume (Cloudinary)</span>
                    </div>
                    <a
                      href={candidateDetail.resumeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1 bg-[#EDE4FF] text-[#7C2CF5] font-bold rounded-lg hover:underline flex items-center gap-1"
                    >
                      <span>View Resume</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {/* HR & Recruiter Evaluation Notes & Internal Feedback */}
                <div className="p-4 rounded-xl border border-[#E7E0FB] bg-[#FBFBFE] space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-[#120E24] text-xs">Recruiter & HR Evaluation Notes</h4>
                    <span className="text-[10px] text-[#585172]">Logged with timestamp & author</span>
                  </div>

                  <div className="space-y-2">
                    <textarea
                      rows={2}
                      value={quickNoteText}
                      onChange={(e) => setQuickNoteText(e.target.value)}
                      placeholder="Add interview assessment, CTC expectations, or recruiter comments..."
                      className="w-full bg-white border border-[#E7E0FB] rounded-xl p-2.5 text-xs text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={quickNoteSubmitting || !quickNoteText.trim()}
                        onClick={handleAddQuickNote}
                        className="px-3 py-1.5 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl font-bold text-xs transition flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {quickNoteSubmitting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                        <span>Add Internal Note</span>
                      </button>
                    </div>
                  </div>

                  {candidateDetail.notes && (
                    <div className="p-3 bg-white border border-[#E7E0FB] rounded-xl text-[#585172] text-[11px] whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto font-mono">
                      {candidateDetail.notes}
                    </div>
                  )}
                </div>

                {/* Candidate Automated Journey Email Log */}
                <div>
                  <h4 className="font-bold text-[#120E24] mb-2 flex items-center justify-between">
                    <span>Automated Journey Communication Log</span>
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Live Delivery Engine
                    </span>
                  </h4>

                  {candidateDetail.journeyEmailsSent && candidateDetail.journeyEmailsSent.length > 0 ? (
                    <div className="space-y-2">
                      {candidateDetail.journeyEmailsSent.map((email, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-xl border border-[#E7E0FB] bg-[#FBFBFE] flex items-start justify-between gap-3 text-[11px]"
                        >
                          <div>
                            <div className="font-bold text-[#120E24]">{email.subject}</div>
                            <div className="text-[#585172] mt-0.5">
                              Stage: <strong>{email.stageName}</strong> • {new Date(email.sentAt).toLocaleString()}
                            </div>
                          </div>
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-md shrink-0">
                            ✓ {email.deliveryMethod || 'DELIVERED'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 border border-dashed border-[#DDD0FE] rounded-xl text-center text-[#585172]">
                      No journey emails recorded yet for this candidate.
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* INDUSTRY-STANDARD JOB OPENING MODAL (With Automated Journey Email Builder) */}
      {jobModalOpen && (
        <div className="fixed inset-0 bg-[#120E24]/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-[#E7E0FB] max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E0FB] mb-4">
              <div>
                <h3 className="font-bold text-[#120E24] text-base">
                  {editingJob ? `Edit Job Opening (${editingJob.requisitionCode})` : 'Post New Job Opening'}
                </h3>
                <p className="text-[11px] text-[#585172]">
                  Configures requisitions for live candidate registration on <strong>codrix.co.in</strong>
                </p>
              </div>
              <button onClick={() => setJobModalOpen(false)} className="text-[#585172] hover:text-[#120E24]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs: Requisition Details vs Journey Email Builder */}
            <div className="flex border-b border-[#E7E0FB] gap-4 mb-4 text-xs font-bold">
              <button
                type="button"
                onClick={() => setJobFormTab('details')}
                className={`pb-2 border-b-2 transition flex items-center gap-1.5 ${jobFormTab === 'details'
                    ? 'border-[#7C2CF5] text-[#7C2CF5]'
                    : 'border-transparent text-[#585172]'
                  }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>1. Requisition & Role Specifications</span>
              </button>

              <button
                type="button"
                onClick={() => setJobFormTab('emails')}
                className={`pb-2 border-b-2 transition flex items-center gap-1.5 ${jobFormTab === 'emails'
                    ? 'border-[#7C2CF5] text-[#7C2CF5]'
                    : 'border-transparent text-[#585172]'
                  }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>2. Automated Candidate Journey Emails</span>
              </button>
            </div>

            <form onSubmit={handleSaveJob} className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs">
              {jobFormTab === 'details' ? (
                <>
                  <div>
                    <label className="block font-semibold text-[#120E24] mb-1">Job Title / Designation *</label>
                    <input
                      type="text"
                      required
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3.5 py-2 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                      placeholder="e.g. Business Development Executive (BDE) / Senior Full-Stack Engineer"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-[#120E24] mb-1">Department</label>
                      <select
                        value={jobDepartment}
                        onChange={(e) => setJobDepartment(e.target.value)}
                        className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3 py-2 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                      >
                        <option value="Sales & Growth">Sales & Growth</option>
                        <option value="Engineering">Engineering</option>
                        <option value="Product & Design">Product & Design</option>
                        <option value="People & HR">People & HR</option>
                        <option value="Operations">Operations</option>
                        <option value="Finance & Legal">Finance & Legal</option>
                        <option value="Marketing & Content">Marketing & Content</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#120E24] mb-1">Opening Type</label>
                      <select
                        value={jobOpeningType}
                        onChange={(e) => setJobOpeningType(e.target.value)}
                        className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3 py-2 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                      >
                        <option value="Full-time">Full-time</option>
                        <option value="Internship">Internship</option>
                        <option value="Part-time">Part-time</option>
                        <option value="Contract">Contract</option>
                        <option value="Freelance">Freelance</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#120E24] mb-1">Workplace Mode</label>
                      <select
                        value={jobWorkplaceMode}
                        onChange={(e) => setJobWorkplaceMode(e.target.value)}
                        className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3 py-2 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                      >
                        <option value="Hybrid">Hybrid</option>
                        <option value="Remote">Remote</option>
                        <option value="On-site">On-site</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-[#120E24] mb-1">Experience Level</label>
                      <select
                        value={jobExperienceLevel}
                        onChange={(e) => setJobExperienceLevel(e.target.value)}
                        className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3 py-2 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                      >
                        <option value="Fresher / Intern">Fresher / Intern</option>
                        <option value="1-3 Years">1-3 Years (Junior)</option>
                        <option value="3-5 Years">3-5 Years (Mid-Level)</option>
                        <option value="5+ Years">5+ Years (Senior)</option>
                        <option value="Lead / Director">Lead / Director</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#120E24] mb-1">Headcount / Vacancies</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={jobHeadcount}
                        onChange={(e) => setJobHeadcount(Number(e.target.value))}
                        className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3 py-2 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-[#120E24] mb-1">Status</label>
                      <select
                        value={jobStatus}
                        onChange={(e) => setJobStatus(e.target.value as any)}
                        className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3 py-2 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none font-bold"
                      >
                        <option value="OPEN">OPEN (Accepting Applications)</option>
                        <option value="DRAFT">DRAFT (Internal Review)</option>
                        <option value="CLOSED">CLOSED (Filled)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-[#120E24] mb-1">Location</label>
                      <input
                        type="text"
                        value={jobLocation}
                        onChange={(e) => setJobLocation(e.target.value)}
                        className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3 py-2 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                        placeholder="Bangalore (Hybrid)"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-[#120E24] mb-1">Annual CTC Min (₹)</label>
                      <input
                        type="number"
                        value={jobSalaryMin}
                        onChange={(e) => setJobSalaryMin(e.target.value)}
                        className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3 py-2 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-[#120E24] mb-1">Annual CTC Max (₹)</label>
                      <input
                        type="number"
                        value={jobSalaryMax}
                        onChange={(e) => setJobSalaryMax(e.target.value)}
                        className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3 py-2 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#120E24] mb-1">Key Skills & Tech Stack</label>
                    <input
                      type="text"
                      value={jobSkills}
                      onChange={(e) => setJobSkills(e.target.value)}
                      className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3.5 py-2 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                      placeholder="e.g. B2B Sales, CRM, Cold Calling, Lead Qualification"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#120E24] mb-1">Job Description & Responsibilities</label>
                    <textarea
                      rows={4}
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3.5 py-2 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                      placeholder="Detailed responsibilities, expectations, and benefits..."
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  {/* OUTBOUND SENDER MAILBOX & PROVIDER ROUTING ARCHITECTURE */}
                  <div className="p-4 rounded-2xl border-2 border-[#7C2CF5]/20 bg-[#F7F5FE] space-y-3.5 shadow-sm">
                    <div className="flex items-center justify-between pb-2 border-b border-[#E7E0FB]">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[#7C2CF5] flex items-center justify-center text-white shadow-xs">
                          <Send className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-[#120E24] text-xs">
                            Outbound Dispatcher Mailbox & Email Engine
                          </h4>
                          <p className="text-[10px] text-[#585172]">
                            Select which company email address dispatches candidate stage notifications for this opening
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EDE4FF] text-[#7C2CF5] border border-[#7C2CF5]/30">
                        {jobEmailProvider.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-[#120E24] mb-1">
                          Sending Email Address (From) *
                        </label>
                        <select
                          value={jobSenderEmail}
                          onChange={(e) => setJobSenderEmail(e.target.value)}
                          className="w-full bg-white border border-[#E7E0FB] rounded-xl px-2.5 py-1.5 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none font-semibold"
                        >
                          <option value="careers@codrix.co.in">careers@codrix.co.in (Talent & Careers — Recommended)</option>
                          <option value="connect@codrix.co.in">connect@codrix.co.in (Primary Company Desk)</option>
                          <option value="hr@codrix.co.in">hr@codrix.co.in (People & HR Operations)</option>
                          <option value="sales@codrix.co.in">sales@codrix.co.in (Growth & Business Dev)</option>
                          <option value="custom">Custom Outbound Address...</option>
                        </select>
                        {jobSenderEmail === 'custom' && (
                          <input
                            type="email"
                            value={jobCustomSenderEmail}
                            onChange={(e) => setJobCustomSenderEmail(e.target.value)}
                            placeholder="e.g. talent@codrix.co.in"
                            className="mt-1.5 w-full bg-white border border-[#E7E0FB] rounded-xl px-2.5 py-1 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                          />
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#120E24] mb-1">
                          Sender Display Name
                        </label>
                        <input
                          type="text"
                          value={jobSenderName}
                          onChange={(e) => setJobSenderName(e.target.value)}
                          placeholder="e.g. CodRix Careers / Talent Acquisition"
                          className="w-full bg-white border border-[#E7E0FB] rounded-xl px-2.5 py-1.5 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#120E24] mb-1">
                          Reply-To Address
                        </label>
                        <input
                          type="email"
                          value={jobReplyToEmail}
                          onChange={(e) => setJobReplyToEmail(e.target.value)}
                          placeholder="careers@codrix.co.in"
                          className="w-full bg-white border border-[#E7E0FB] rounded-xl px-2.5 py-1.5 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none font-medium"
                        />
                      </div>
                    </div>

                    {/* Email Engine Architecture Selector */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#120E24] mb-1.5">
                        Active Email Provider Architecture
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        {[
                          { id: 'GOOGLE_WORKSPACE', name: 'Google Workspace', desc: 'smtp.gmail.com:587', color: 'border-emerald-300 text-emerald-800' },
                          { id: 'ZOHO_MAIL', name: 'Zoho Mail', desc: 'smtp.zoho.in:465', color: 'border-amber-300 text-amber-800' },
                          { id: 'MICROSOFT_365', name: 'Microsoft 365', desc: 'office365.com:587', color: 'border-sky-300 text-sky-800' },
                          { id: 'HOSTINGER_CPANEL', name: 'Hostinger / cPanel', desc: 'smtp.hostinger.com:465', color: 'border-purple-300 text-purple-800' },
                          { id: 'TRANSACTIONAL_API', name: 'Transactional API', desc: 'Resend / SendGrid / SES', color: 'border-indigo-300 text-indigo-800' }
                        ].map((prov) => {
                          const isSelected = jobEmailProvider === prov.id;
                          return (
                            <button
                              key={prov.id}
                              type="button"
                              onClick={() => setJobEmailProvider(prov.id as any)}
                              className={`p-2 rounded-xl text-left border transition ${isSelected
                                  ? 'bg-white border-[#7C2CF5] ring-2 ring-[#7C2CF5]/20 shadow-xs'
                                  : 'bg-white/60 border-[#E7E0FB] hover:border-[#7C2CF5]/50'
                                }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className={`font-bold text-[11px] ${isSelected ? 'text-[#7C2CF5]' : 'text-[#120E24]'}`}>
                                  {prov.name}
                                </span>
                                {isSelected && <Check className="w-3 h-3 text-[#7C2CF5]" />}
                              </div>
                              <span className="text-[9px] text-[#585172] block truncate">
                                {prov.desc}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Provider-specific intelligent tip banner */}
                      <div className="mt-2 text-[10px] text-[#585172] bg-white p-2 rounded-lg border border-[#E7E0FB]">
                        {jobEmailProvider === 'GOOGLE_WORKSPACE' && (
                          <span>💡 <strong>Google Workspace / Gmail Tip:</strong> Requires a 16-character App Password generated at <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-[#7C2CF5] underline font-bold">myaccount.google.com/apppasswords</a>. Set it once under Settings $\rightarrow$ SMTP.</span>
                        )}
                        {jobEmailProvider === 'ZOHO_MAIL' && (
                          <span>💡 <strong>Zoho Mail Tip:</strong> Uses <code>smtp.zoho.in</code> (port 465 SSL). Requires an Application-Specific Password from <a href="https://accounts.zoho.com" target="_blank" rel="noreferrer" className="text-[#7C2CF5] underline font-bold">accounts.zoho.com</a> $\rightarrow$ Security.</span>
                        )}
                        {jobEmailProvider === 'MICROSOFT_365' && (
                          <span>💡 <strong>Microsoft 365 Tip:</strong> Uses <code>smtp.office365.com</code> (port 587 STARTTLS). Ensure "Authenticated SMTP" is checked in your M365 Admin Center for this user.</span>
                        )}
                        {jobEmailProvider === 'HOSTINGER_CPANEL' && (
                          <span>💡 <strong>Hostinger / cPanel Tip:</strong> Uses <code>smtp.hostinger.com</code> or <code>mail.codrix.co.in</code> (port 465 SSL or 587 TLS) with full email as login.</span>
                        )}
                        {jobEmailProvider === 'TRANSACTIONAL_API' && (
                          <span>⚡ <strong>Transactional API Tip:</strong> Dispatches high-volume candidate notifications with maximum deliverability via Resend, SendGrid, Amazon SES, or Brevo.</span>
                        )}
                      </div>
                    </div>

                    {/* LIVE TEST VERIFICATION DISPATCH */}
                    <div className="pt-2.5 border-t border-[#E7E0FB] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2">
                      <div className="flex-1 flex items-center gap-2">
                        <label className="text-[11px] font-bold text-[#120E24] shrink-0">
                          Live Test Recipient:
                        </label>
                        <input
                          type="email"
                          value={testTargetEmail}
                          onChange={(e) => setTestTargetEmail(e.target.value)}
                          placeholder="candidate@example.com"
                          className="flex-1 bg-white border border-[#E7E0FB] rounded-lg px-2.5 py-1 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={testEmailLoading}
                          onClick={() => handleSendTestStageEmail('Sourced')}
                          className="px-3.5 py-1.5 bg-[#EDE4FF] hover:bg-[#DDD0FE] text-[#7C2CF5] font-bold text-xs rounded-xl border border-[#7C2CF5]/30 transition flex items-center gap-1.5 shrink-0"
                        >
                          {testEmailLoading ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Zap className="w-3.5 h-3.5" />
                          )}
                          <span>Send Test Journey Email</span>
                        </button>
                      </div>
                    </div>

                    {testFeedback && (
                      <div
                        className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${testFeedback.success
                            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                            : 'bg-rose-50 border border-rose-200 text-rose-800'
                          }`}
                      >
                        {testFeedback.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                        <span className="flex-1 leading-snug">{testFeedback.message}</span>
                        <button
                          type="button"
                          onClick={() => setTestFeedback(null)}
                          className="text-xs opacity-60 hover:opacity-100"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="font-bold text-[#120E24] text-xs">
                      2. Automated Candidate Stage Email Templates
                    </span>
                    <span className="text-[11px] text-[#585172]">
                      Available tokens: <code className="bg-[#EDE4FF] text-[#7C2CF5] px-1 py-0.5 rounded">{'{{candidateName}}'}</code>, <code className="bg-[#EDE4FF] text-[#7C2CF5] px-1 py-0.5 rounded">{'{{jobTitle}}'}</code>, <code className="bg-[#EDE4FF] text-[#7C2CF5] px-1 py-0.5 rounded">{'{{requestNo}}'}</code>, <code className="bg-[#EDE4FF] text-[#7C2CF5] px-1 py-0.5 rounded">{'{{candidateSerialNo}}'}</code>, <code className="bg-[#EDE4FF] text-[#7C2CF5] px-1 py-0.5 rounded">{'{{companyName}}'}</code>
                    </span>
                  </div>

                  {Object.keys(jobEmailTemplates).map((stageName) => {
                    const tmpl = jobEmailTemplates[stageName];
                    return (
                      <div key={stageName} className="p-3.5 rounded-xl border border-[#E7E0FB] bg-[#FBFBFE] space-y-2.5 transition hover:border-[#7C2CF5]/40">
                        <div className="flex items-center justify-between pb-1 border-b border-[#E7E0FB]/60">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#120E24] text-xs uppercase tracking-wider">
                              Stage: {stageName}
                            </span>
                            <span className="text-[9px] px-1.5 py-0.5 bg-[#EDE4FF] text-[#7C2CF5] font-bold rounded-md">
                              Auto Trigger
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleSendTestStageEmail(stageName)}
                              disabled={testEmailLoading}
                              className="text-[10px] text-[#7C2CF5] hover:text-[#6D25D9] font-bold flex items-center gap-1 hover:underline"
                            >
                              <Send className="w-2.5 h-2.5" />
                              <span>Test This Stage</span>
                            </button>
                            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-[#7C2CF5]">
                              <input
                                type="checkbox"
                                checked={tmpl.enabled}
                                onChange={(e) => {
                                  setJobEmailTemplates({
                                    ...jobEmailTemplates,
                                    [stageName]: { ...tmpl, enabled: e.target.checked }
                                  });
                                }}
                                className="rounded text-[#7C2CF5]"
                              />
                              <span>Auto-send on reach</span>
                            </label>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-[#585172] mb-0.5">Subject</label>
                          <input
                            type="text"
                            value={tmpl.subject}
                            onChange={(e) => {
                              setJobEmailTemplates({
                                ...jobEmailTemplates,
                                [stageName]: { ...tmpl, subject: e.target.value }
                              });
                            }}
                            className="w-full bg-white border border-[#E7E0FB] rounded-lg px-2.5 py-1.5 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none font-medium"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-[#585172] mb-0.5">Message Body</label>
                          <textarea
                            rows={3}
                            value={tmpl.body}
                            onChange={(e) => {
                              setJobEmailTemplates({
                                ...jobEmailTemplates,
                                [stageName]: { ...tmpl, body: e.target.value }
                              });
                            }}
                            className="w-full bg-white border border-[#E7E0FB] rounded-lg px-2.5 py-1.5 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none font-mono text-[11px]"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-3 border-t border-[#E7E0FB] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setJobModalOpen(false)}
                  className="px-4 py-2 border border-[#E7E0FB] rounded-xl text-[#585172] hover:bg-[#F7F5FE] font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={jobSubmitting}
                  className="px-5 py-2 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl font-bold shadow-md shadow-[#7C2CF5]/25 transition flex items-center gap-1.5"
                >
                  {jobSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{editingJob ? 'Save Requisition Updates' : 'Publish Job Opening'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. 🎓 CREDENTIALS & DESIGNATION-BASED ACCESS CONTROL PROVISIONING MODAL */}
      {credModalOpen && selectedAppForCreds && (
        <div className="fixed inset-0 bg-[#120E24]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-[#E7E0FB] max-h-[92vh] overflow-y-auto font-['Plus_Jakarta_Sans',sans-serif]">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E0FB] mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#7C2CF5] to-[#6D25D9] text-white flex items-center justify-center shadow-md shadow-[#7C2CF5]/20">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#120E24] text-base">
                    Provision Employee Credentials & Access Control
                  </h3>
                  <p className="text-[11px] text-[#585172]">
                    Admin & HR: Provisions login account, employee code, role scope & dispatches welcome credentials email.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCredModalOpen(false)}
                className="text-[#585172] hover:text-[#120E24] p-1.5 rounded-xl hover:bg-[#F7F5FE] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Candidate Summary Card */}
            <div className="p-3.5 bg-[#F7F5FE] rounded-2xl border border-[#E7E0FB] mb-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#7C2CF5] uppercase tracking-wider block">Candidate Intake</span>
                <span className="font-extrabold text-sm text-[#120E24]">{selectedAppForCreds.candidate.fullName}</span>
                <div className="text-[11px] text-[#585172] mt-0.5">
                  Personal Email: <strong>{selectedAppForCreds.candidate.emailNormalized}</strong> &bull; Requisition: <strong>{selectedAppForCreds.jobOpening?.title}</strong>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-[#EDE4FF] text-[#7C2CF5] border border-[#DDD0FE]">
                {stages.find((s) => s.id === selectedAppForCreds.stageId)?.name || 'Internship'}
              </span>
            </div>

            {/* Success Result Box */}
            {credResult && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl mb-4 text-xs space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between font-extrabold text-emerald-900">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Credentials Active & Successfully Generated!</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`CodRix Login Credentials:\nEmail: ${credResult.loginEmail}\nPassword: ${credResult.password}\nEmployee Code: ${credResult.employeeCode}\nRole: ${credResult.roleCode}\nPortal URL: https://connect.codrix.co.in`);
                      setCopiedCreds(true);
                      setTimeout(() => setCopiedCreds(false), 3000);
                    }}
                    className="px-2.5 py-1 bg-white border border-emerald-300 text-emerald-800 rounded-lg text-[10px] font-bold hover:bg-emerald-100 flex items-center gap-1 transition"
                  >
                    {copiedCreds ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCreds ? 'Copied!' : 'Copy Credentials'}</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-emerald-950 font-medium">
                  <div>Login Email: <strong className="font-bold">{credResult.loginEmail}</strong></div>
                  <div>Password: <strong className="font-bold font-mono">{credResult.password}</strong></div>
                  <div>Employee Code: <strong>{credResult.employeeCode}</strong></div>
                  <div>Assigned Role: <strong>{credResult.roleCode}</strong></div>
                  <div className="col-span-2 pt-1 border-t border-emerald-200/60">
                    Software Access URL: <a href="https://connect.codrix.co.in" target="_blank" rel="noreferrer" className="font-bold text-emerald-700 underline">https://connect.codrix.co.in</a>
                  </div>
                </div>
                {credResult.emailDispatched && (
                  <div className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 pt-1">
                    <Send className="w-3 h-3" />
                    <span>Official welcome credentials email dispatched to {selectedAppForCreds.candidate.emailNormalized}</span>
                  </div>
                )}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmitProvisionCredentials} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Official Company / Login Email */}
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">
                    System Login & Official Email
                  </label>
                  <input
                    type="email"
                    required
                    value={credLoginEmail}
                    onChange={(e) => setCredLoginEmail(e.target.value)}
                    placeholder="name@codrix.co.in"
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3.5 py-2 text-[#120E24] font-bold focus:outline-none focus:border-[#7C2CF5]"
                  />
                  <span className="text-[10px] text-[#585172] mt-0.5 block">Used by candidate to log into CodRix</span>
                </div>

                {/* Password with generator */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-[#120E24]">Initial Login Password</label>
                    <button
                      type="button"
                      onClick={handleGenerateRandomPassword}
                      className="text-[10px] text-[#7C2CF5] font-bold hover:underline"
                    >
                      🎲 Regenerate
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showCredPassword ? 'text' : 'password'}
                      required
                      value={credPassword}
                      onChange={(e) => setCredPassword(e.target.value)}
                      className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl pl-3.5 pr-9 py-2 text-[#120E24] font-mono font-bold focus:outline-none focus:border-[#7C2CF5]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCredPassword(!showCredPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#585172] hover:text-[#120E24]"
                    >
                      {showCredPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <span className="text-[10px] text-[#585172] mt-0.5 block">Hashed securely with bcrypt in MongoDB</span>
                </div>
              </div>

              {/* Designation & Role Selection with Scope Descriptions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">
                    Designation & Official Title
                  </label>
                  <input
                    type="text"
                    required
                    value={credDesignation}
                    onChange={(e) => setCredDesignation(e.target.value)}
                    placeholder="e.g. Business Development Executive (BDE)"
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3.5 py-2 text-[#120E24] font-semibold focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#120E24] mb-1">
                    System Role / Access Scope
                  </label>
                  <select
                    value={credRoleCode}
                    onChange={(e) => {
                      const selected = e.target.value;
                      setCredRoleCode(selected);
                      if (selected === 'BDE') {
                        setCredDepartment('Sales & Growth');
                        setCredReportingManager('Suryansh Thakur (Growth Officer)');
                      } else if (selected === 'BDM') {
                        setCredDepartment('Sales & Growth');
                        setCredReportingManager('Suryansh Thakur (Growth Officer)');
                      } else if (selected === 'GROWTH_OFFICER') {
                        setCredDepartment('Sales & Growth');
                        setCredReportingManager('Lakshay (Founder & MD)');
                      } else if (selected === 'SDE1' || selected === 'SDE2' || selected === 'INTERN') {
                        setCredDepartment('Engineering & Technology');
                        setCredReportingManager('Parth Sharma (Engineering Lead)');
                      } else if (selected === 'HR_EXEC' || selected === 'HR_MANAGER') {
                        setCredDepartment('People Operations & HR');
                        setCredReportingManager('Anshuman (Head of People & HR)');
                      }
                    }}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] font-bold focus:outline-none focus:border-[#7C2CF5]"
                  >
                    <option value="BDE">BDE — Record Management System (Own Leads & Notes only)</option>
                    <option value="BDM">BDM — Record Management + All Team BDEs Oversight</option>
                    <option value="GROWTH_OFFICER">GROWTH_OFFICER — Full Growth Leadership (All BDMs & BDEs)</option>
                    <option value="SDE1">SDE1 — Software Engineer (Engineering, Sprints & Tasks)</option>
                    <option value="SDE2">SDE2 — Senior Software Engineer (Core Architecture)</option>
                    <option value="INTERN">INTERN — Technical / Business Intern</option>
                    <option value="HR_EXEC">HR_EXEC — Human Resources Executive (ATS & Onboarding)</option>
                    <option value="OPS_MANAGER">OPS_MANAGER — Operations & Execution</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Scope Badge Explainer */}
              <div className="p-3 bg-[#EDE4FF]/70 border border-[#DDD0FE] rounded-xl text-[11px] text-[#585172] flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-[#7C2CF5] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#120E24] block">Hierarchy & Access Scope for {credRoleCode}:</strong>
                  {credRoleCode === 'BDE' && (
                    <span>
                      Access restricted to the <strong>Record Management System (CRM & Customer 360)</strong>. Can create and manage notes, call activities, and view <em>only their own assigned leads and client records</em>. Restricted from seeing peer BDEs, HRMS admin, or company settings.
                    </span>
                  )}
                  {credRoleCode === 'BDM' && (
                    <span>
                      Access to Record Management System with full oversight over <strong>all BDEs working under them</strong>. Can view, reassign, track team pipeline velocity, and log notes.
                    </span>
                  )}
                  {credRoleCode === 'GROWTH_OFFICER' && (
                    <span>
                      Strategic Growth Leadership. Has complete oversight across <strong>all BDMs and BDEs</strong> in the company, customer conversions, and partnership records under <strong>Suryansh Thakur</strong>.
                    </span>
                  )}
                  {(credRoleCode === 'SDE1' || credRoleCode === 'SDE2' || credRoleCode === 'INTERN') && (
                    <span>
                      Engineering & Sprints System. Can view assigned architecture tasks, log bugs, commit code updates, and submit daily standups under <strong>Parth Sharma (Engineering Lead)</strong>.
                    </span>
                  )}
                  {credRoleCode === 'HR_EXEC' && (
                    <span>
                      People & Talent Operations. Controls candidate pipelines across BDE, BDM, SDE, and Growth positions under <strong>Anshuman (Head of People & HR)</strong>.
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Department */}
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Department</label>
                  <select
                    value={credDepartment}
                    onChange={(e) => setCredDepartment(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] font-medium focus:outline-none focus:border-[#7C2CF5]"
                  >
                    <option value="Sales & Growth">Sales & Growth</option>
                    <option value="Engineering & Technology">Engineering & Technology</option>
                    <option value="People Operations & HR">People Operations & HR</option>
                    <option value="Operations & Execution">Operations & Execution</option>
                    <option value="Corporate Governance">Corporate Governance</option>
                  </select>
                </div>

                {/* Reporting Manager */}
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Reporting Supervisor</label>
                  <select
                    value={credReportingManager}
                    onChange={(e) => setCredReportingManager(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] font-bold focus:outline-none focus:border-[#7C2CF5]"
                  >
                    <option value="Suryansh Thakur (Growth Officer)">Suryansh Thakur (Growth Officer & Partnerships)</option>
                    <option value="Parth Sharma (Engineering Lead)">Parth Sharma (Engineering Lead)</option>
                    <option value="Anshuman (Head of People & HR)">Anshuman (Head of People & HR)</option>
                    <option value="Diya Maheshwari (Operations Lead)">Diya Maheshwari (Operations Lead)</option>
                    <option value="Ishita Malhotra (Corporate Governance)">Ishita Malhotra (Corporate Governance & Oversight)</option>
                    <option value="Lakshay (Founder & MD)">Lakshay (Founder & Managing Director)</option>
                  </select>
                </div>
              </div>

              {/* Email dispatch checkbox */}
              <div className="p-3 bg-[#F7F5FE] border border-[#E7E0FB] rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-[#120E24] block text-xs">Dispatch Official Welcome & Credentials Email</span>
                  <span className="text-[10px] text-[#585172]">
                    Sends credentials to candidate's personal email (<code>{selectedAppForCreds.candidate.emailNormalized}</code>) via your verified company SMTP
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={credSendEmail}
                  onChange={(e) => setCredSendEmail(e.target.checked)}
                  className="w-4 h-4 accent-[#7C2CF5] rounded cursor-pointer"
                />
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-[#E7E0FB] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCredModalOpen(false)}
                  className="px-4 py-2 border border-[#E7E0FB] rounded-xl text-[#585172] hover:bg-[#F7F5FE] font-bold transition"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={credSubmitting}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#7C2CF5] to-[#6D25D9] hover:from-[#6D25D9] hover:to-[#5B1EB7] text-white rounded-xl font-bold transition flex items-center gap-2 shadow-md shadow-[#7C2CF5]/25 disabled:opacity-50"
                >
                  {credSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                  <span>{credSubmitting ? 'Provisioning...' : 'Provision Login Access & Activate Account'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WEBSCRIPT & PUBLIC API INTEGRATION MODAL (For codrix.co.in) */}
      {webscriptModalJob && (
        <div className="fixed inset-0 bg-[#120E24]/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-[#E7E0FB] max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E0FB] mb-4">
              <div>
                <span className="text-[10px] font-bold text-[#7C2CF5] uppercase tracking-wider">
                  Website Public Integration
                </span>
                <h3 className="font-bold text-base text-[#120E24]">
                  Auto-Generated Webscript for {webscriptModalJob.title}
                </h3>
              </div>
              <button onClick={() => setWebscriptModalJob(null)} className="text-[#585172] hover:text-[#120E24]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 text-xs pr-1">
              <div className="p-3 bg-[#EDE4FF] border border-[#DDD0FE] rounded-xl text-[11px] text-[#585172]">
                🌐 <strong>Ready for codrix.co.in:</strong> Both your website and this software connect to the exact same MongoDB Atlas database. You can paste this script or API call into any page on <strong>codrix.co.in</strong> to register live candidates.
              </div>

              {/* 1. Embeddable JavaScript Widget */}
              <div className="p-4 rounded-xl border border-[#E7E0FB] bg-[#FBFBFE] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#120E24]">Method 1: 1-Line Embed Script Tag</span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        `<div id="codrix-careers-container" data-codrix-job="${webscriptModalJob.id}"></div>\n<script src="${apiBaseUrl}/api/v1/public/jobs/${webscriptModalJob.id}/embed.js" defer></script>`,
                        'script'
                      )
                    }
                    className="px-2.5 py-1 bg-[#F0ECFC] hover:bg-[#EDE4FF] text-[#7C2CF5] rounded-lg font-bold text-[11px] transition flex items-center gap-1"
                  >
                    {copiedKey === 'script' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'script' ? 'Copied!' : 'Copy Script Tag'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-[#120E24] text-[#E7E0FB] rounded-xl text-[11px] font-mono overflow-x-auto leading-relaxed">
                  {`<div id="codrix-careers-container" data-codrix-job="${webscriptModalJob.id}"></div>
<script src="${apiBaseUrl}/api/v1/public/jobs/${webscriptModalJob.id}/embed.js" defer></script>`}
                </pre>
              </div>

              {/* 2. Direct REST API Contract */}
              <div className="p-4 rounded-xl border border-[#E7E0FB] bg-[#FBFBFE] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#120E24]">Method 2: Public REST API Endpoint</span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        `fetch('${apiBaseUrl}/api/v1/public/jobs/${webscriptModalJob.id}/apply', {\n  method: 'POST',\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify({\n    fullName: 'Candidate Name',\n    email: 'candidate@gmail.com',\n    phone: '+91 9876543210',\n    coverLetter: 'I am interested in this role',\n    source: 'codrix.co.in'\n  })\n});`,
                        'api'
                      )
                    }
                    className="px-2.5 py-1 bg-[#F0ECFC] hover:bg-[#EDE4FF] text-[#7C2CF5] rounded-lg font-bold text-[11px] transition flex items-center gap-1"
                  >
                    {copiedKey === 'api' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'api' ? 'Copied!' : 'Copy Fetch Code'}</span>
                  </button>
                </div>
                <div className="text-[11px] text-[#585172]">
                  Endpoint: <code className="font-bold text-[#7C2CF5]">POST {apiBaseUrl}/api/v1/public/jobs/{webscriptModalJob.id}/apply</code>
                </div>
                <pre className="p-3 bg-[#120E24] text-[#E7E0FB] rounded-xl text-[11px] font-mono overflow-x-auto leading-relaxed">
                  {`fetch('${apiBaseUrl}/api/v1/public/jobs/${webscriptModalJob.id}/apply', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fullName: 'Candidate Full Name',
    email: 'candidate@example.com',
    phone: '+91 9876543210',
    coverLetter: 'Optional note...',
    source: 'codrix.co.in'
  })
});`}
                </pre>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E7E0FB] flex justify-end">
              <button
                type="button"
                onClick={() => setWebscriptModalJob(null)}
                className="px-4 py-2 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl font-bold text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANDIDATE INTAKE MODAL */}
      {candidateModalOpen && (
        <div className="fixed inset-0 bg-[#120E24]/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E7E0FB]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E0FB] mb-4">
              <div>
                <h3 className="font-bold text-[#120E24] text-sm">Add Candidate Application</h3>
                <p className="text-[11px] text-[#585172]">Ingest candidates directly into the Sourced pipeline stage</p>
              </div>
              <button onClick={() => setCandidateModalOpen(false)} className="text-[#585172] hover:text-[#120E24]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {candidateError && (
              <div className="mb-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{candidateError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCandidate} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#120E24] mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3.5 py-2.5 text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                  placeholder="e.g. Anshu / Lakshay"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#120E24] mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={candidateEmail}
                  onChange={(e) => setCandidateEmail(e.target.value)}
                  className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3.5 py-2.5 text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                  placeholder="candidate@gmail.com"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#120E24] mb-1">Phone Number</label>
                <input
                  type="text"
                  value={candidatePhone}
                  onChange={(e) => setCandidatePhone(e.target.value)}
                  className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3.5 py-2.5 text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                  placeholder="+91 8295886832"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block font-semibold text-[#120E24]">Target Opening *</label>
                  <button
                    type="button"
                    onClick={() => {
                      setCandidateModalOpen(false);
                      handleOpenCreateJob();
                    }}
                    className="text-[11px] text-[#7C2CF5] font-bold hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Create New Opening</span>
                  </button>
                </div>

                <select
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  className="w-full border border-[#E7E0FB] rounded-xl px-3.5 py-2.5 text-[#120E24] focus:outline-none focus:border-[#7C2CF5] font-medium text-xs bg-[#FBFBFE]"
                >
                  <option value="" disabled>-- Select Job Opening --</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title} ({job.requisitionCode} • {job.departmentId})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-[#E7E0FB] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCandidateModalOpen(false)}
                  className="px-4 py-2 border border-[#E7E0FB] rounded-xl text-[#585172] hover:bg-[#F7F5FE] font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={candidateSubmitting}
                  className="px-4 py-2 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl font-bold shadow-md shadow-[#7C2CF5]/25 transition flex items-center gap-1.5"
                >
                  {candidateSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Ingesting Candidate...</span>
                    </>
                  ) : (
                    <span>Save & Ingest</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CANDIDATE PROFILE MODAL */}
      {editCandModalOpen && (
        <div className="fixed inset-0 bg-[#120E24]/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#E7E0FB] max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E0FB] mb-4">
              <div>
                <span className="text-[10px] font-bold text-[#7C2CF5] uppercase tracking-wider">Candidate Management</span>
                <h3 className="font-bold text-base text-[#120E24]">Edit Candidate Profile & Application</h3>
              </div>
              <button onClick={() => setEditCandModalOpen(false)} className="text-[#585172] hover:text-[#120E24]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditCandidate} className="flex-1 overflow-y-auto space-y-3.5 text-xs pr-1">
              <div>
                <label className="block font-bold text-[#120E24] mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editCandName}
                  onChange={(e) => setEditCandName(e.target.value)}
                  className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3.5 py-2 text-[#120E24] focus:outline-none focus:border-[#7C2CF5] font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={editCandEmail}
                    onChange={(e) => setEditCandEmail(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3.5 py-2 text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={editCandPhone}
                    onChange={(e) => setEditCandPhone(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3.5 py-2 text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Target Job Opening</label>
                  <select
                    value={editCandJobId}
                    onChange={(e) => setEditCandJobId(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] font-medium focus:outline-none focus:border-[#7C2CF5]"
                  >
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title} ({job.requisitionCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Current Pipeline Stage</label>
                  <select
                    value={editCandStageId}
                    onChange={(e) => setEditCandStageId(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] font-bold focus:outline-none focus:border-[#7C2CF5]"
                  >
                    {stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name} (Stage {stage.stageOrder})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#120E24] mb-1">Resume Link (Cloudinary or Direct URL)</label>
                <input
                  type="text"
                  value={editCandResumeUrl}
                  onChange={(e) => setEditCandResumeUrl(e.target.value)}
                  placeholder="https://res.cloudinary.com/..."
                  className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3.5 py-2 text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#120E24] mb-1">Candidate Profile Notes & Background</label>
                <textarea
                  rows={4}
                  value={editCandNotes}
                  onChange={(e) => setEditCandNotes(e.target.value)}
                  className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3.5 py-2 text-[#120E24] focus:outline-none focus:border-[#7C2CF5] font-mono text-[11px]"
                  placeholder="Cover notes, portfolio links, interview remarks..."
                />
              </div>

              <div className="pt-3 border-t border-[#E7E0FB] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditCandModalOpen(false)}
                  className="px-4 py-2 border border-[#E7E0FB] rounded-xl text-[#585172] hover:bg-[#F7F5FE] font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editCandSubmitting}
                  className="px-5 py-2 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow-md shadow-[#7C2CF5]/25"
                >
                  {editCandSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Save Candidate Updates</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
