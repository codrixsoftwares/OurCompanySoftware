import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../api/client.js';
import { getSocket } from '../../core/socket.js';
import { useAuth } from '../../context/AuthContext.js';
import { Lead } from '../../types.js';
import { workStateManager } from '../../core/workStateManager.js';
import {
  Target,
  Plus,
  PhoneCall,
  Calendar,
  Building,
  User,
  ArrowRight,
  Clock,
  CheckCircle,
  X,
  Eye,
  FileText,
  StickyNote,
  Trash2,
  CheckSquare,
  Square,
  Flag,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  ExternalLink,
  Lock,
  Unlock,
  Sparkles,
  Search,
  Check,
  AlertCircle,
  MessageSquare,
  History,
  FileSpreadsheet,
  Upload,
  Download,
  Table,
  UserCheck
} from 'lucide-react';

// Robust CSV/TSV Parser function supporting quoted cells, multi-line values, and Excel paste
function parseCsvOrTsv(text: string): any[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  // Detect delimiter: tab (Excel copy/paste) or comma
  const firstLine = lines[0];
  const isTsv = firstLine.includes('\t') && firstLine.split('\t').length >= firstLine.split(',').length;
  const delimiter = isTsv ? '\t' : ',';

  const parseRow = (rowStr: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < rowStr.length; i++) {
      const char = rowStr[i];
      if (char === '"' || char === "'") {
        if (inQuotes && rowStr[i + 1] === char) {
          current += char;
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  };

  const headers = parseRow(lines[0]).map((h) =>
    h.replace(/^["'\uFEFF]+|["']+$/g, '').trim().toLowerCase()
  );

  const results: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const rawCols = parseRow(lines[i]);
    if (rawCols.every((c) => !c)) continue;

    const rowObj: any = {};
    headers.forEach((header, colIdx) => {
      rowObj[header] = rawCols[colIdx] || '';
    });

    const companyName =
      rowObj['company name'] ||
      rowObj['company'] ||
      rowObj['business name'] ||
      rowObj['organization'] ||
      rowObj['client'] ||
      rawCols[0] ||
      '';
    const contactName =
      rowObj['contact person'] ||
      rowObj['contact name'] ||
      rowObj['contact'] ||
      rowObj['name'] ||
      rawCols[1] ||
      '';
    const email = rowObj['contact email'] || rowObj['email'] || rowObj['email address'] || rawCols[2] || '';
    const phone = rowObj['contact phone'] || rowObj['phone'] || rowObj['mobile'] || rowObj['contact number'] || rawCols[3] || '';
    const serviceInterest =
      rowObj['service interest'] || rowObj['service'] || rowObj['interest'] || rawCols[4] || 'Enterprise Software';
    const priority = (rowObj['priority'] || rawCols[5] || 'MEDIUM').toUpperCase();
    const clientNeeds =
      rowObj['client needs & survey intel'] ||
      rowObj['client needs'] ||
      rowObj['survey intel'] ||
      rowObj['needs'] ||
      rawCols[6] ||
      '';
    const codrixSolution =
      rowObj['codrix solution proposal'] ||
      rowObj['codrix solution'] ||
      rowObj['solution'] ||
      rawCols[7] ||
      '';
    const proofLinks =
      rowObj['proof & reference links'] || rowObj['proof links'] || rowObj['links'] || rawCols[8] || '';
    const researchPoints =
      rowObj['research points'] || rowObj['research notes'] || rowObj['notes'] || rawCols[9] || '';
    const assignedBdeEmail =
      rowObj['assigned bde email'] || rowObj['bde email'] || rowObj['assigned email'] || rawCols[10] || '';
    const assignedBdeName =
      rowObj['assigned bde name'] || rowObj['bde name'] || rowObj['assigned bde'] || rawCols[11] || '';

    if (companyName) {
      results.push({
        companyName,
        contactName: contactName || 'Primary Contact',
        email,
        phone,
        serviceInterest,
        priority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(priority) ? priority : 'MEDIUM',
        clientNeeds,
        codrixSolution,
        proofLinks,
        researchPoints,
        assignedBdeEmail,
        assignedBdeName
      });
    }
  }

  return results;
}

export const CrmView: React.FC = () => {
  const { session, isLakshay, isCoreTeam } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [callModalLead, setCallModalLead] = useState<Lead | null>(null);
  const [noteModalLead, setNoteModalLead] = useState<Lead | null>(null);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [customer360, setCustomer360] = useState<any | null>(null);

  // Available BDEs for assignment
  const [bdeList, setBdeList] = useState<any[]>([]);
  const [assignedBdeEmail, setAssignedBdeEmail] = useState('');
  const [assignedBdeName, setAssignedBdeName] = useState('');
  const [assignedBdeId, setAssignedBdeId] = useState('');

  // Excel / CSV Bulk Upload & Import State
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadTab, setUploadTab] = useState<'FILE' | 'PASTE'>('FILE');
  const [pasteText, setPasteText] = useState('');
  const [parsedUploadLeads, setParsedUploadLeads] = useState<any[]>([]);
  const [defaultUploadBde, setDefaultUploadBde] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Unified Lead 360 View State (accessible on each lead action)
  const [lead360ModalData, setLead360ModalData] = useState<any | null>(null);
  const [isLoading360, setIsLoading360] = useState(false);

  // Lead Quality Review & Flagging State
  const [inspectingLead, setInspectingLead] = useState<Lead | null>(null);
  const [flagRemarks, setFlagRemarks] = useState('');
  const [isSubmittingFlag, setIsSubmittingFlag] = useState(false);

  // Mandatory Stage Update Notes State
  const [stageModalLead, setStageModalLead] = useState<Lead | null>(null);
  const [targetStage, setTargetStage] = useState('NEW');
  const [stageNotesInput, setStageNotesInput] = useState('');
  const [isSubmittingStage, setIsSubmittingStage] = useState(false);

  // New Lead Survey & Research State
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [serviceInterest, setServiceInterest] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [clientNeeds, setClientNeeds] = useState('');
  const [codrixSolution, setCodrixSolution] = useState('');
  const [proofLinks, setProofLinks] = useState('');
  const [researchPoints, setResearchPoints] = useState('');

  // Restore any saved Lead & BDE Survey draft on mount
  useEffect(() => {
    const savedDraft = workStateManager.getLeadDraft();
    if (savedDraft) {
      if (savedDraft.companyName) setCompanyName(savedDraft.companyName);
      if (savedDraft.contactName) setContactName(savedDraft.contactName);
      if (savedDraft.email) setEmail(savedDraft.email);
      if (savedDraft.phone) setPhone(savedDraft.phone);
      if (savedDraft.serviceInterest) setServiceInterest(savedDraft.serviceInterest);
      if (savedDraft.priority) setPriority(savedDraft.priority);
      if (savedDraft.clientNeeds) setClientNeeds(savedDraft.clientNeeds);
      if (savedDraft.codrixSolution) setCodrixSolution(savedDraft.codrixSolution);
      if (savedDraft.proofLinks) setProofLinks(savedDraft.proofLinks);
      if (savedDraft.researchPoints) setResearchPoints(savedDraft.researchPoints);
      if (savedDraft.assignedBdeEmail) setAssignedBdeEmail(savedDraft.assignedBdeEmail);
    }
  }, []);

  // Auto-sync Lead & BDE Survey draft changes to workStateManager
  useEffect(() => {
    if (companyName || clientNeeds || codrixSolution || contactName || researchPoints) {
      workStateManager.saveLeadDraft({
        companyName,
        contactName,
        email,
        phone,
        serviceInterest,
        priority,
        clientNeeds,
        codrixSolution,
        proofLinks,
        researchPoints,
        assignedBdeEmail,
        updatedAt: new Date().toISOString()
      });
    }
  }, [companyName, contactName, email, phone, serviceInterest, priority, clientNeeds, codrixSolution, proofLinks, researchPoints, assignedBdeEmail]);

  // Log Call State
  const [callOutcome, setCallOutcome] = useState('CONNECTED');
  const [callSummary, setCallSummary] = useState('');
  const [pitchFeedback, setPitchFeedback] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');

  // Determine reviewer tier
  const isBdm = Boolean(
    session?.roles.includes('BDM') ||
      (session?.employee?.jobTitle || '').toLowerCase().includes('bdm') ||
      (session?.user?.fullName || '').toLowerCase().includes('bdm')
  );
  const isReviewer = isCoreTeam || isBdm;
  const isBde = !isCoreTeam && !isBdm;

  const loadData = async () => {
    try {
      const [leadsData, customersData, bdesData] = await Promise.all([
        apiRequest<Lead[]>('/crm/leads'),
        apiRequest<any[]>('/crm/customers'),
        apiRequest<any[]>('/crm/bdes').catch(() => [])
      ]);
      setLeads(leadsData);
      setCustomers(customersData);
      setBdeList(bdesData || []);
      if (bdesData && bdesData.length > 0) {
        if (!defaultUploadBde) setDefaultUploadBde(bdesData[0].email);
        if (!assignedBdeEmail) {
          setAssignedBdeEmail(bdesData[0].email);
          setAssignedBdeName(bdesData[0].fullName);
          setAssignedBdeId(bdesData[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const socket = getSocket();
    socket.emit('join_crm');

    const handleCrmUpdate = () => {
      loadData();
    };

    socket.on('crm:lead_new', handleCrmUpdate);
    socket.on('crm:lead_stage_changed', handleCrmUpdate);
    socket.on('crm:activity_logged', handleCrmUpdate);
    socket.on('crm:lead_flag_updated', handleCrmUpdate);
    socket.on('crm:lead_deleted', handleCrmUpdate);
    socket.on('crm:leads_batch_deleted', handleCrmUpdate);
    socket.on('crm:leads_bulk_imported', handleCrmUpdate);
    socket.on('crm:customer_deleted', handleCrmUpdate);

    return () => {
      socket.off('crm:lead_new', handleCrmUpdate);
      socket.off('crm:lead_stage_changed', handleCrmUpdate);
      socket.off('crm:activity_logged', handleCrmUpdate);
      socket.off('crm:lead_flag_updated', handleCrmUpdate);
      socket.off('crm:lead_deleted', handleCrmUpdate);
      socket.off('crm:leads_batch_deleted', handleCrmUpdate);
      socket.off('crm:leads_bulk_imported', handleCrmUpdate);
      socket.off('crm:customer_deleted', handleCrmUpdate);
    };
  }, []);

  const handleToggleSelectAllLeads = () => {
    if (selectedLeadIds.length === leads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(leads.map((l) => l.id));
    }
  };

  const handleToggleSelectOneLead = (id: string) => {
    setSelectedLeadIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleDeleteLead = async (id: string, name: string) => {
    if (!isLakshay) return;
    if (!window.confirm(`Are you sure you want to delete lead "${name}"? This action cannot be undone.`)) return;
    try {
      await apiRequest(`/crm/leads/${id}`, { method: 'DELETE' });
      setSelectedLeadIds((prev) => prev.filter((x) => x !== id));
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete lead');
    }
  };

  const handleBatchDeleteLeads = async () => {
    if (!isLakshay || selectedLeadIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete ${selectedLeadIds.length} selected lead(s)?`)) return;
    try {
      await apiRequest('/crm/leads/batch-delete', {
        method: 'POST',
        body: JSON.stringify({ leadIds: selectedLeadIds })
      });
      setSelectedLeadIds([]);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete selected leads');
    }
  };

  const handleDeleteCustomer = async (id: string, company: string) => {
    if (!isLakshay) return;
    if (!window.confirm(`Are you sure you want to delete enterprise customer "${company}"?`)) return;
    try {
      await apiRequest(`/crm/customers/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete customer');
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    const tempId = `temp_${Date.now()}`;
    const optimisticLead: any = {
      id: tempId,
      _id: tempId,
      companyName,
      contactName,
      email,
      phone,
      serviceInterest,
      priority,
      clientNeeds,
      codrixSolution,
      proofLinks,
      researchPoints,
      assignedBdeEmail,
      assignedBdeName,
      assignedBdeId,
      stage: 'IDENTIFIED',
      score: 50,
      createdAt: new Date().toISOString()
    };

    // 0ms instant UI close & render
    setLeads((prev) => [optimisticLead, ...prev]);
    setAddLeadOpen(false);
    workStateManager.clearLeadDraft();
    setCompanyName('');
    setContactName('');
    setEmail('');
    setPhone('');
    setServiceInterest('');
    setPriority('MEDIUM');
    setClientNeeds('');
    setCodrixSolution('');
    setProofLinks('');
    setResearchPoints('');

    try {
      const res: any = await apiRequest('/crm/leads', {
        method: 'POST',
        body: JSON.stringify({
          companyName: optimisticLead.companyName,
          contactName: optimisticLead.contactName,
          email: optimisticLead.email,
          phone: optimisticLead.phone,
          serviceInterest: optimisticLead.serviceInterest,
          priority: optimisticLead.priority,
          clientNeeds: optimisticLead.clientNeeds,
          codrixSolution: optimisticLead.codrixSolution,
          proofLinks: optimisticLead.proofLinks,
          researchPoints: optimisticLead.researchPoints,
          assignedBdeEmail: optimisticLead.assignedBdeEmail,
          assignedBdeName: optimisticLead.assignedBdeName,
          assignedBdeId: optimisticLead.assignedBdeId
        })
      });
      if (res?.data) {
        setLeads((prev) => prev.map((l) => (l.id === tempId ? { ...l, ...res.data, id: res.data.id || res.data._id } : l)));
      }
    } catch (err: any) {
      setLeads((prev) => prev.filter((l) => l.id !== tempId));
      alert(err.message || 'Error creating lead');
    }
  };

  const handlePromptStageChange = (lead: Lead, newStage: string) => {
    if (newStage === lead.stage) return;

    // BDE gatekeeping: Must be green flagged to advance to proposal or closing stages
    if (isBde && lead.flagStatus !== 'GREEN_FLAG' && ['PROPOSAL', 'NEGOTIATION', 'WON'].includes(newStage)) {
      alert(`Action Blocked: Lead "${lead.companyName}" is currently ${lead.flagStatus || 'PENDING'}.\n\nA Core Team member (Lakshay, Parth, Diya, Suryansh, Ishita, Anshuman) or BDM must verify the research points and grant a GREEN FLAG before advancing to ${newStage}.`);
      return;
    }

    setStageModalLead(lead);
    setTargetStage(newStage);
    setStageNotesInput('');
  };

  const handleConfirmStageChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stageModalLead) return;
    if (!stageNotesInput.trim()) {
      alert('Mandatory Stage Notes: Please mention detailed progression notes explaining the discussion, client feedback, or justification for updating this lead stage.');
      return;
    }

    setIsSubmittingStage(true);
    try {
      await apiRequest(`/crm/leads/${stageModalLead.id}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({
          stage: targetStage,
          stageNotes: stageNotesInput.trim()
        })
      });
      setStageModalLead(null);
      setStageNotesInput('');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update stage');
    } finally {
      setIsSubmittingStage(false);
    }
  };

  const handleSaveFlagDecision = async (status: 'GREEN_FLAG' | 'RED_FLAG' | 'PENDING') => {
    if (!inspectingLead) return;
    setIsSubmittingFlag(true);
    try {
      await apiRequest(`/crm/leads/${inspectingLead.id}/flag`, {
        method: 'PATCH',
        body: JSON.stringify({
          flagStatus: status,
          flagRemarks
        })
      });
      await loadData();
      // Update local inspectingLead state
      setInspectingLead((prev) =>
        prev
          ? {
              ...prev,
              flagStatus: status,
              flagRemarks,
              flaggedBy: session?.user.fullName || 'Reviewer',
              flagTier: isCoreTeam ? 'CORE_TEAM' : 'BDM',
              flaggedAt: new Date().toISOString()
            }
          : null
      );
    } catch (err: any) {
      alert(err.message || 'Failed to save flag decision');
    } finally {
      setIsSubmittingFlag(false);
    }
  };

  const handleOpenInspect = (lead: Lead) => {
    setInspectingLead(lead);
    setFlagRemarks(lead.flagRemarks || '');
  };

  const handleAttemptLogCall = (lead: Lead) => {
    if (isBde && lead.flagStatus !== 'GREEN_FLAG') {
      alert(`Outreach Blocked: Lead "${lead.companyName}" has not received a Green Flag.\n\nA Core Team member (Lakshay, Parth, Diya, Suryansh, Ishita, Anshuman) or BDM must examine the survey research points and mark this lead as GREEN FLAG before you can initiate calls or client outreach.`);
      return;
    }
    setCallModalLead(lead);
  };

  const handleLogCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!callModalLead) return;
    try {
      await apiRequest(`/crm/leads/${callModalLead.id}/calls`, {
        method: 'POST',
        body: JSON.stringify({
          outcome: callOutcome,
          summary: callSummary,
          pitchFeedback,
          nextFollowUpAt: nextFollowUpDate || undefined
        })
      });
      setCallModalLead(null);
      setCallSummary('');
      setPitchFeedback('');
      setNextFollowUpDate('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error logging call');
    }
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteModalLead || !newNoteContent.trim()) return;
    setIsSubmittingNote(true);
    try {
      await apiRequest(`/crm/leads/${noteModalLead.id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ note: newNoteContent })
      });
      setNewNoteContent('');
      await loadData();
      const updated = leads.find((l) => l.id === noteModalLead.id);
      if (updated) {
        setNoteModalLead(updated);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save note');
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const openCustomer360 = async (customerId: string) => {
    try {
      const data = await apiRequest(`/crm/customers/${customerId}/360`);
      setCustomer360(data);
    } catch (err: any) {
      alert(err.message || 'Failed loading 360 profile');
    }
  };

  const openLead360 = async (lead: Lead) => {
    setIsLoading360(true);
    try {
      const res = await apiRequest<any>(`/crm/leads/${lead.id}/360`);
      setLead360ModalData(res);
    } catch (err: any) {
      setLead360ModalData({
        lead: {
          ...lead,
          activities: lead.activities || []
        },
        customer: null,
        projects: []
      });
    } finally {
      setIsLoading360(false);
    }
  };

  const handleDownloadTemplate = () => {
    const headers = [
      'Company Name',
      'Contact Person',
      'Contact Email',
      'Contact Phone',
      'Service Interest',
      'Priority',
      'Client Needs & Survey Intel',
      'Codrix Solution Proposal',
      'Proof & Reference Links',
      'Research Points',
      'Assigned BDE Email',
      'Assigned BDE Name'
    ];

    const sampleRows = [
      [
        'Nexus Cloud Systems',
        'Raghav Singhania',
        'raghav@nexuscloud.io',
        '+91 98765 12345',
        'Full-Stack Enterprise Portal & Microservices',
        'HIGH',
        'Legacy monolithic stack failing during peak enterprise usage. Requires high-concurrency Node.js backend and responsive React dashboard.',
        'CodRix High-Speed Socket Event Bus & Enterprise Multi-Tenant Architecture with automated CI/CD pipeline.',
        'https://nexuscloud.io\nhttps://linkedin.com/company/nexuscloud',
        '150 employees, Series A funded, needs delivery in 60 days.',
        bdeList[0]?.email || '',
        bdeList[0]?.fullName || ''
      ],
      [
        'Medix Global Health',
        'Dr. Ananya Sen',
        'ananya@medixglobal.org',
        '+91 98111 99887',
        'HIPAA Telemedicine & Real-Time Patient App',
        'URGENT',
        'Needs patient record encryption, real-time doctor appointment queue, and video consultation workflow.',
        'CodRix Secure Healthcare Suite with end-to-end audit trails and live consultation video integration.',
        'https://medixglobal.org',
        'Operating in 3 cities. Looking for immediate development partnership.',
        bdeList[0]?.email || '',
        bdeList[0]?.fullName || ''
      ]
    ];

    const csvRows = [
      headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','),
      ...sampleRows.map((row) => row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ];

    const csvContent = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Codrix_CRM_Leads_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsed = parseCsvOrTsv(content);
      setParsedUploadLeads(parsed);
    };
    reader.readAsText(file);
  };

  const handlePasteChange = (text: string) => {
    setPasteText(text);
    const parsed = parseCsvOrTsv(text);
    setParsedUploadLeads(parsed);
  };

  const handleSubmitBulkImport = async () => {
    if (parsedUploadLeads.length === 0) {
      alert('Please upload or paste valid CSV/Excel leads data with Company Name.');
      return;
    }
    setIsUploading(true);
    try {
      const matchedBde = bdeList.find((b) => b.email === defaultUploadBde);
      const res = await apiRequest<any>('/crm/leads/bulk-import', {
        method: 'POST',
        body: JSON.stringify({
          leads: parsedUploadLeads,
          defaultBdeEmail: defaultUploadBde,
          defaultBdeName: matchedBde?.fullName || 'Assigned BDE'
        })
      });
      alert(`Success: ${res.data?.count || parsedUploadLeads.length} leads successfully imported and assigned to BDEs!`);
      setUploadModalOpen(false);
      setParsedUploadLeads([]);
      setPasteText('');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Bulk import failed');
    } finally {
      setIsUploading(false);
    }
  };

  // Inspecting modal hierarchy locks
  const isLockedByCoreTeam = Boolean(inspectingLead?.flagTier === 'CORE_TEAM');
  const canModifyFlag = isCoreTeam || (isBdm && !isLockedByCoreTeam);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#120E24]">CRM, Leads & Customer 360</h2>
            <span className="bg-[#EDE4FF] text-[#7C2CF5] border border-[#DDD0FE] text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#7C2CF5]" />
              Quality Gatekeeping Active
            </span>
          </div>
          <p className="text-xs text-[#585172]">
            Track client relationships, BDE survey intelligence, Core Team / BDM Red-Green flags, and enterprise accounts
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Download Excel / CSV Template */}
          <button
            onClick={handleDownloadTemplate}
            className="px-3.5 py-2 bg-white hover:bg-[#F7F5FE] text-[#120E24] border border-[#E7E0FB] rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="Download Excel / CSV Template for CRM Leads"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Download Template</span>
          </button>

          {/* Upload Excel / CSV (Admin, BDM & Core Team) */}
          {(isLakshay || isCoreTeam || isBdm) && (
            <button
              onClick={() => {
                setUploadModalOpen(true);
                setParsedUploadLeads([]);
                setPasteText('');
              }}
              className="px-3.5 py-2 bg-[#F0ECFC] hover:bg-[#EDE4FF] text-[#7C2CF5] border border-[#DDD0FE] rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Upload leads in bulk using Excel / CSV and assign to BDEs"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Leads (Excel / CSV)</span>
            </button>
          )}

          {/* Add New Lead & Survey */}
          <button
            onClick={() => {
              if (bdeList.length > 0 && !assignedBdeEmail) {
                setAssignedBdeEmail(bdeList[0].email);
                setAssignedBdeName(bdeList[0].fullName);
                setAssignedBdeId(bdeList[0].id);
              }
              setAddLeadOpen(true);
            }}
            className="px-4 py-2 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl text-xs font-bold shadow-md shadow-[#7C2CF5]/25 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Lead & Survey</span>
          </button>
        </div>
      </div>

      {/* Role & Reviewer Explanatory Banner */}
      <div className="bg-gradient-to-r from-[#F7F5FE] via-white to-[#F7F5FE] p-4 rounded-2xl border border-[#E7E0FB] flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#EDE4FF] text-[#7C2CF5] flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-[#120E24] flex items-center gap-2">
              <span>BDE Quality Gatekeeping Workflow</span>
              {isCoreTeam ? (
                <span className="bg-purple-100 text-[#7C2CF5] px-2 py-0.5 rounded-md text-[10px] font-extrabold">
                  Core Team Authority (Final Decision)
                </span>
              ) : isBdm ? (
                <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md text-[10px] font-extrabold">
                  BDM Evaluator (Core Team May Override)
                </span>
              ) : (
                <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md text-[10px] font-extrabold">
                  BDE / Intern Mode (Awaiting Green Flag)
                </span>
              )}
            </div>
            <p className="text-[#585172] text-[11px] mt-0.5">
              BDEs list leads with survey points, links and proofs. Core Team (Lakshay, Parth, Diya, Suryansh, Ishita, Anshuman) or BDM examine data and issue a Green/Red flag before outreach can proceed.
            </p>
          </div>
        </div>
      </div>

      {/* Batch Action Floating Bar for Lakshay */}
      {isLakshay && selectedLeadIds.length > 0 && (
        <div className="bg-[#120E24] text-white px-5 py-3 rounded-2xl shadow-xl flex items-center justify-between border border-[#302B47] animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <span className="bg-[#7C2CF5] text-white text-xs font-bold px-2.5 py-1 rounded-lg">
              {selectedLeadIds.length} Selected
            </span>
            <span className="text-xs text-[#A29DB8]">
              Select leads to perform bulk management or delete permanently.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedLeadIds([])}
              className="text-xs text-[#A29DB8] hover:text-white px-3 py-1.5 rounded-lg transition"
            >
              Clear
            </button>
            <button
              onClick={handleBatchDeleteLeads}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-600/30 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected ({selectedLeadIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Leads Table */}
      <div className="bg-white rounded-2xl border border-[#E7E0FB] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#E7E0FB] bg-[#F7F5FE]/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs uppercase tracking-wider text-[#120E24]">Active Sales Leads ({leads.length})</span>
            {isLakshay && leads.length > 0 && (
              <span className="text-[11px] text-[#7C2CF5] font-semibold bg-[#F0ECFC] px-2 py-0.5 rounded-full">
                Founder Delete Enabled
              </span>
            )}
          </div>
          <span className="text-xs text-[#585172]">Green flag required for BDE outreach & calls</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F7F5FE] text-[#585172] font-semibold border-b border-[#E7E0FB]">
              <tr>
                {isLakshay && (
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={leads.length > 0 && selectedLeadIds.length === leads.length}
                      onChange={handleToggleSelectAllLeads}
                      className="w-4 h-4 rounded text-[#7C2CF5] accent-[#7C2CF5] cursor-pointer"
                      title="Select all leads"
                    />
                  </th>
                )}
                <th className="py-3 px-4">Company & Prospect</th>
                <th className="py-3 px-4">Quality Verification Flag</th>
                <th className="py-3 px-4">Survey & Needs Intel</th>
                <th className="py-3 px-4">Stage</th>
                <th className="py-3 px-4">Owner / BDE</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E0FB]/60">
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={isLakshay ? 7 : 6} className="py-8 text-center text-[#585172]">
                    No leads in pipeline. Create one with your research survey to get started!
                  </td>
                </tr>
              ) : (
                leads.map((lead) => {
                  const isGreen = lead.flagStatus === 'GREEN_FLAG';
                  const isRed = lead.flagStatus === 'RED_FLAG';
                  const isPending = !isGreen && !isRed;

                  return (
                    <tr key={lead.id} className="hover:bg-[#F6F3FF]/60 transition">
                      {isLakshay && (
                        <td className="py-3.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedLeadIds.includes(lead.id)}
                            onChange={() => handleToggleSelectOneLead(lead.id)}
                            className="w-4 h-4 rounded text-[#7C2CF5] accent-[#7C2CF5] cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#120E24] text-[13px]">{lead.companyName}</div>
                        <div className="text-[11px] text-[#585172] flex items-center gap-1 mt-0.5">
                          <span>{lead.contactName}</span>
                          <span>&bull;</span>
                          <span className="text-[#7C2CF5] font-medium">{lead.email}</span>
                        </div>
                        {lead.phone && <div className="text-[10px] text-slate-400 mt-0.5">{lead.phone}</div>}
                      </td>

                      {/* Flag Column */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {isGreen ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>GREEN FLAG</span>
                            </span>
                          ) : isRed ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                              <XCircle className="w-3.5 h-3.5 text-rose-600" />
                              <span>RED FLAG</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              <span>AWAITING FLAG</span>
                            </span>
                          )}

                          <div className="text-[10px] text-[#585172]">
                            {lead.flaggedBy ? (
                              <span>
                                by <strong className="text-[#120E24]">{lead.flaggedBy}</strong> (
                                {lead.flagTier === 'CORE_TEAM' ? 'Core Team' : 'BDM'})
                              </span>
                            ) : (
                              <span className="text-amber-700 font-medium italic">Pending Verification</span>
                            )}
                          </div>
                          {lead.flagRemarks && (
                            <div className="text-[10px] text-slate-600 bg-slate-50 p-1.5 rounded-md border border-slate-200/60 max-w-[200px] truncate" title={lead.flagRemarks}>
                              &ldquo;{lead.flagRemarks}&rdquo;
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Survey & Needs Intel */}
                      <td className="py-3.5 px-4 max-w-[220px]">
                        <div className="text-[#120E24] font-medium truncate" title={lead.clientNeeds || lead.serviceInterest || 'Needs assessment'}>
                          {lead.clientNeeds || lead.serviceInterest || '—'}
                        </div>
                        {lead.codrixSolution && (
                          <div className="text-[10px] text-[#7C2CF5] truncate mt-0.5" title={lead.codrixSolution}>
                            &rarr; Solution: {lead.codrixSolution}
                          </div>
                        )}
                        {lead.proofLinks && (
                          <div className="text-[10px] text-indigo-600 flex items-center gap-1 mt-0.5 truncate" title={lead.proofLinks}>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            <span>Proof / Links attached</span>
                          </div>
                        )}
                      </td>

                      {/* Stage Column */}
                      <td className="py-3.5 px-4">
                        <select
                          value={lead.stage}
                          onChange={(e) => handlePromptStageChange(lead, e.target.value)}
                          className={`text-[11px] font-semibold rounded-lg px-2 py-1 border outline-none transition cursor-pointer ${
                            lead.stage === 'WON'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : lead.stage === 'LOST'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-[#F0ECFC] text-[#7C2CF5] border-[#E7E0FB]'
                          }`}
                        >
                          {['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'].map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        {lead.lastStageNote && (
                          <div
                            onClick={() => handleOpenInspect(lead)}
                            className="text-[10px] text-[#585172] max-w-[170px] truncate mt-1.5 flex items-center gap-1 cursor-pointer hover:text-[#7C2CF5] group transition"
                            title={`Stage Note by ${lead.lastStageUpdateBy || 'Team'}: ${lead.lastStageNote} (Click to inspect history)`}
                          >
                            <MessageSquare className="w-3 h-3 text-[#7C2CF5] shrink-0" />
                            <span className="truncate group-hover:underline">{lead.lastStageNote}</span>
                          </div>
                        )}
                      </td>

                      {/* Owner / Assigned BDE Column */}
                      <td className="py-3.5 px-4 text-[#120E24]">
                        <div className="font-bold text-xs">
                          {lead.assignedBdeName || lead.createdByName || lead.ownerEmployee?.membership.user.fullName || 'Unassigned'}
                        </div>
                        <div className="text-[10px] text-[#585172] flex items-center gap-1 mt-0.5">
                          <span className="text-[#7C2CF5] font-semibold">{lead.assignedBdeEmail || lead.createdByEmail || 'BDE Pipeline'}</span>
                        </div>
                      </td>

                      {/* Actions Column */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View 360 Unified Profile Button (On Each Lead) */}
                          <button
                            onClick={() => openLead360(lead)}
                            className="px-2.5 py-1.5 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white font-bold rounded-lg text-[11px] inline-flex items-center gap-1 transition cursor-pointer shadow-xs"
                            title="View Unified 360 Profile for this Lead"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View 360</span>
                          </button>

                          {/* Survey Intel & Review Modal */}
                          <button
                            onClick={() => handleOpenInspect(lead)}
                            className="px-2.5 py-1.5 bg-[#EDE4FF] hover:bg-[#E0D2FE] text-[#7C2CF5] border border-[#DDD0FE] font-bold rounded-lg text-[11px] inline-flex items-center gap-1 transition cursor-pointer shadow-2xs"
                            title="Inspect Survey Intelligence & Set Red/Green Flag"
                          >
                            <Flag className="w-3.5 h-3.5" />
                            <span>{isReviewer ? 'Inspect & Flag' : 'Survey Intel'}</span>
                          </button>

                          {/* Record Notes */}
                          <button
                            onClick={() => setNoteModalLead(lead)}
                            className="px-2 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold rounded-lg text-[11px] inline-flex items-center gap-1 transition cursor-pointer"
                            title="Record notes and project specs"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Notes</span>
                          </button>

                          {/* Log Call (Gatekept for BDE) */}
                          <button
                            onClick={() => handleAttemptLogCall(lead)}
                            className={`px-2.5 py-1.5 font-bold rounded-lg text-[11px] inline-flex items-center gap-1 transition cursor-pointer border ${
                              isGreen
                                ? 'bg-[#F0ECFC] hover:bg-[#EDE4FF] text-[#7C2CF5] border-[#E7E0FB]'
                                : isBde
                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-500 border-slate-200'
                                : 'bg-[#F0ECFC] hover:bg-[#EDE4FF] text-[#7C2CF5] border-[#E7E0FB]'
                            }`}
                            title={isBde && !isGreen ? 'Locked: Awaiting Green Flag' : 'Log client call'}
                          >
                            {isBde && !isGreen ? <Lock className="w-3.5 h-3.5 text-slate-400" /> : <PhoneCall className="w-3.5 h-3.5" />}
                            <span>Log Call</span>
                          </button>

                          {/* Founder Delete */}
                          {isLakshay && (
                            <button
                              onClick={() => handleDeleteLead(lead.id, lead.companyName)}
                              className="px-2 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold rounded-lg text-[11px] inline-flex items-center gap-1 transition cursor-pointer"
                              title="Delete Lead (Founder Only)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
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
      </div>

      {/* Converted Customers & Customer 360 Section */}
      <div className="bg-white rounded-2xl border border-[#E7E0FB] shadow-xs p-5 space-y-4">
        <h3 className="font-bold text-sm text-[#120E24] flex items-center gap-2">
          <Building className="w-4 h-4 text-[#7C2CF5]" />
          <span>Active Enterprise Accounts & Customer 360</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {customers.length === 0 ? (
            <div className="col-span-3 py-6 text-center text-xs text-[#585172]">
              Convert a lead to WON to automatically provision a Customer 360 account profile!
            </div>
          ) : (
            customers.map((c) => (
              <div key={c.id} className="p-4 rounded-xl border border-[#E7E0FB] bg-[#FBFBFE] hover:border-[#7C2CF5]/40 transition flex justify-between items-center">
                <div>
                  <h4 className="font-semibold text-[#120E24] text-sm">{c.companyName}</h4>
                  <p className="text-xs text-[#585172]">{c.primaryContactName} &bull; {c.email}</p>
                  <span className="text-[10px] text-emerald-600 font-semibold">Status: ACTIVE</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openCustomer360(c.id)}
                    className="px-3 py-1.5 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View 360</span>
                  </button>
                  {isLakshay && (
                    <button
                      onClick={() => handleDeleteCustomer(c.id, c.companyName)}
                      className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg text-xs transition border border-transparent hover:border-rose-200 cursor-pointer"
                      title="Delete Customer Account (Founder Only)"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* INSPECT SURVEY & FLAG DECISION MODAL */}
      {inspectingLead && (
        <div className="fixed inset-0 bg-[#120E24]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-[#E7E0FB] max-h-[90vh] overflow-y-auto space-y-5">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-[#E7E0FB]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#EDE4FF] text-[#7C2CF5]">
                    Lead Survey & Quality Review
                  </span>
                  {inspectingLead.flagStatus === 'GREEN_FLAG' ? (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-700" /> Green Flagged
                    </span>
                  ) : inspectingLead.flagStatus === 'RED_FLAG' ? (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 flex items-center gap-1">
                      <XCircle className="w-3 h-3 text-rose-700" /> Red Flagged
                    </span>
                  ) : (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-700" /> Awaiting Flag
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-lg text-[#120E24] mt-1">{inspectingLead.companyName}</h3>
                <p className="text-xs text-[#585172]">
                  Contact: <strong className="text-[#120E24]">{inspectingLead.contactName}</strong> &bull; {inspectingLead.email}
                  {inspectingLead.phone && ` &bull; ${inspectingLead.phone}`}
                </p>
              </div>
              <button onClick={() => setInspectingLead(null)} className="text-[#585172] hover:text-[#120E24] p-1 rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Hierarchy Lock Warning Banner */}
            {isLockedByCoreTeam && isBdm && !isCoreTeam && (
              <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-2xl flex items-start gap-3">
                <Lock className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                <div className="text-xs text-purple-900 leading-relaxed">
                  <strong>Decision Locked by Core Team:</strong> This lead was reviewed and flagged by{' '}
                  <strong className="text-purple-950">{inspectingLead.flaggedBy}</strong> (Core Team). Per hierarchy protocol, a BDM cannot override a Core Team decision. Only Core Team members (Lakshay, Parth, Diya, Suryansh, Ishita, Anshuman) can modify this flag.
                </div>
              </div>
            )}

            {inspectingLead.flagTier === 'BDM' && isCoreTeam && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-2.5 text-xs text-blue-900">
                <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <div>
                  <strong>BDM Review Logged:</strong> Currently flagged by BDM{' '}
                  <strong className="text-blue-950">{inspectingLead.flaggedBy}</strong>. As a Core Team member, you have full authority to update or override this decision.
                </div>
              </div>
            )}

            {/* Survey Intelligence Details */}
            <div className="space-y-4 text-xs">
              {/* 1. What they need */}
              <div className="p-4 bg-[#FBFBFE] rounded-2xl border border-[#E7E0FB] space-y-1.5">
                <div className="flex items-center gap-1.5 text-[#120E24] font-bold text-xs uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-[#7C2CF5]"></span>
                  <span>1. What They Need (Client Pain Points & Requirements)</span>
                </div>
                <p className="text-[#36314D] whitespace-pre-wrap leading-relaxed text-xs">
                  {inspectingLead.clientNeeds || inspectingLead.needSummary || 'No specific pain points detailed by BDE.'}
                </p>
              </div>

              {/* 2. How CodRix can help */}
              <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-100 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[#7C2CF5] font-bold text-xs uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>2. How CodRix Can Help (Solution & Pitch Strategy)</span>
                </div>
                <p className="text-[#36314D] whitespace-pre-wrap leading-relaxed text-xs">
                  {inspectingLead.codrixSolution || inspectingLead.serviceInterest || 'No custom solution pitch detailed by BDE.'}
                </p>
              </div>

              {/* 3. Proof, Links & Survey Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5">
                  <div className="font-bold text-[#120E24] flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                    <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Proof & Research Links</span>
                  </div>
                  <div className="text-[#36314D] whitespace-pre-wrap text-xs break-all">
                    {inspectingLead.proofLinks ? (
                      inspectingLead.proofLinks.split('\n').map((line, i) => {
                        const isUrl = line.trim().startsWith('http://') || line.trim().startsWith('https://');
                        return isUrl ? (
                          <div key={i} className="my-1">
                            <a href={line.trim()} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline font-semibold flex items-center gap-1 hover:text-indigo-800">
                              <span>{line.trim()}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        ) : (
                          <div key={i}>{line}</div>
                        );
                      })
                    ) : (
                      <span className="text-slate-400 italic">No links or proof attached</span>
                    )}
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5">
                  <div className="font-bold text-[#120E24] flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                    <FileText className="w-3.5 h-3.5 text-amber-600" />
                    <span>Survey & Research Notes</span>
                  </div>
                  <p className="text-[#36314D] whitespace-pre-wrap text-xs">
                    {inspectingLead.researchPoints || 'No additional survey notes.'}
                  </p>
                </div>
              </div>

              {/* 3. Stage Progression & Transition Notes History */}
              <div className="p-4 bg-white rounded-2xl border border-[#E7E0FB] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-[#120E24]">
                    <History className="w-4 h-4 text-[#7C2CF5]" />
                    <span>Stage Progression & Transition Notes History ({inspectingLead.stageHistory?.length || 0})</span>
                  </div>
                  <span className="text-[10px] text-[#7C2CF5] font-semibold bg-[#F0ECFC] px-2 py-0.5 rounded-full">
                    Visible to Core Team & BDM
                  </span>
                </div>

                {inspectingLead.stageHistory && inspectingLead.stageHistory.length > 0 ? (
                  <div className="space-y-3 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-[#DDD0FE] pl-1">
                    {inspectingLead.stageHistory.map((sh, idx) => (
                      <div key={idx} className="relative pl-6 space-y-1.5">
                        <div className="absolute left-1 top-1.5 w-4 h-4 rounded-full bg-[#7C2CF5] border-2 border-white shadow-xs"></div>
                        <div className="flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5 font-bold text-[#120E24]">
                            <span className="px-2 py-0.5 bg-[#F0ECFC] text-[#7C2CF5] rounded-md border border-[#DDD0FE]">
                              {sh.fromStage}
                            </span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <span className="px-2 py-0.5 bg-purple-100 text-[#7C2CF5] rounded-md font-extrabold border border-purple-200">
                              {sh.toStage}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500">
                            {new Date(sh.updatedAt).toLocaleString()}
                          </span>
                        </div>

                        <div className="p-3 bg-[#FBFBFE] rounded-xl border border-[#E7E0FB] text-xs space-y-1">
                          <p className="text-[#36314D] whitespace-pre-wrap leading-relaxed">
                            {sh.notes}
                          </p>
                          <div className="text-[10px] text-[#7C2CF5] font-semibold pt-1 border-t border-[#E7E0FB]/60 flex items-center justify-between">
                            <span>Recorded by: <strong>{sh.updatedBy}</strong> ({sh.updatedByRole || 'Team'})</span>
                            <span className="text-slate-400 font-normal">{sh.updatedByEmail}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 text-center text-xs text-slate-400 bg-[#FBFBFE] border border-dashed border-[#E7E0FB] rounded-xl">
                    Current stage: <strong className="text-[#120E24]">{inspectingLead.stage}</strong>. No transition notes recorded yet.
                  </div>
                )}
              </div>

              {/* Review History / Remarks */}
              {inspectingLead.flaggedBy && (
                <div className="p-3.5 bg-[#F7F5FE] rounded-2xl border border-[#E7E0FB] space-y-1">
                  <div className="text-[11px] font-bold text-[#120E24] flex items-center justify-between">
                    <span>Previous Reviewer Feedback</span>
                    <span className="text-[10px] text-slate-500">{new Date(inspectingLead.flaggedAt || '').toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-[#585172] italic">&ldquo;{inspectingLead.flagRemarks || 'No written remarks'}&rdquo;</p>
                  <div className="text-[10px] font-semibold text-[#7C2CF5]">
                    Evaluator: {inspectingLead.flaggedBy} ({inspectingLead.flagTier === 'CORE_TEAM' ? 'Core Team Member' : 'BDM'})
                  </div>
                </div>
              )}
            </div>

            {/* Decision Submission for Reviewers */}
            {isReviewer ? (
              <div className="pt-4 border-t border-[#E7E0FB] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-xs text-[#120E24]">
                    Reviewer Guidance & Feedback Remarks
                  </label>
                  <span className="text-[10px] text-slate-500">
                    Logged to audit & visible to BDE
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={flagRemarks}
                  onChange={(e) => setFlagRemarks(e.target.value)}
                  disabled={!canModifyFlag}
                  placeholder={
                    canModifyFlag
                      ? 'Add instructions e.g. "Approved to initiate call. Pitch the Growth Tier" or "Website link is dead, please re-verify"...'
                      : 'Locked: Only Core Team members can modify this decision.'
                  }
                  className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3 py-2 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                />

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setInspectingLead(null)}
                    className="w-full sm:w-auto px-4 py-2 border border-[#E7E0FB] rounded-xl text-[#585172] hover:bg-[#F7F5FE] font-bold text-xs transition cursor-pointer"
                  >
                    Close
                  </button>

                  {canModifyFlag ? (
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <button
                        type="button"
                        disabled={isSubmittingFlag}
                        onClick={() => handleSaveFlagDecision('RED_FLAG')}
                        className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4 text-rose-600" />
                        <span>Stage RED FLAG (Do Not Contact)</span>
                      </button>

                      <button
                        type="button"
                        disabled={isSubmittingFlag}
                        onClick={() => handleSaveFlagDecision('GREEN_FLAG')}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Stage GREEN FLAG (Allow Outreach)</span>
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] font-bold text-purple-900 bg-purple-100 px-3 py-1.5 rounded-xl">
                      🔒 Core Team Decision Locked
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="pt-4 border-t border-[#E7E0FB] flex items-center justify-between">
                <div className="text-xs text-[#585172]">
                  {inspectingLead.flagStatus === 'GREEN_FLAG' ? (
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Cleared by Leadership. You can proceed to log calls and advance to closing!
                    </span>
                  ) : (
                    <span className="text-amber-800 font-semibold flex items-center gap-1">
                      <Clock className="w-4 h-4 text-amber-600" /> Awaiting Core Team (Lakshay, Parth, Diya, Suryansh, Ishita, Anshuman) or BDM Green Flag.
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setInspectingLead(null)}
                  className="px-4 py-2 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white font-bold rounded-xl text-xs transition"
                >
                  Understood
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stage Update Progression Notes Modal */}
      {stageModalLead && (
        <div className="fixed inset-0 bg-[#120E24]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#E7E0FB] space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-[#E7E0FB]">
              <div>
                <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#7C2CF5]">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Pipeline Stage Progression</span>
                </div>
                <h3 className="font-bold text-base text-[#120E24] mt-0.5">{stageModalLead.companyName}</h3>
                <p className="text-xs text-[#585172]">Prospect: {stageModalLead.contactName} &bull; {stageModalLead.email}</p>
              </div>
              <button onClick={() => setStageModalLead(null)} className="text-[#585172] hover:text-[#120E24] p-1 rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Visual Transition Badge */}
            <div className="p-3.5 bg-[#F7F5FE] rounded-2xl border border-[#E7E0FB] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Current:</span>
                <span className="text-xs font-bold text-[#120E24] px-2.5 py-1 bg-white rounded-lg border border-[#DDD0FE]">
                  {stageModalLead.stage}
                </span>
              </div>
              <ArrowRight className="w-4 h-4 text-[#7C2CF5]" />
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-[#7C2CF5] uppercase">Moving To:</span>
                <select
                  value={targetStage}
                  onChange={(e) => setTargetStage(e.target.value)}
                  className="text-xs font-bold text-[#7C2CF5] px-2.5 py-1 bg-purple-50 rounded-lg border border-purple-200 outline-none cursor-pointer"
                >
                  {['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Stage Notes Form */}
            <form onSubmit={handleConfirmStageChange} className="space-y-3.5 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-[#120E24]">
                    Stage Transition Notes & Justification *
                  </label>
                  <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                    Mandatory
                  </span>
                </div>
                <textarea
                  required
                  rows={4}
                  value={stageNotesInput}
                  onChange={(e) => setStageNotesInput(e.target.value)}
                  placeholder={
                    targetStage === 'CONTACTED'
                      ? 'Describe outreach made (LinkedIn message, initial call, email intro) and client reaction...'
                      : targetStage === 'QUALIFIED'
                      ? 'Describe pain points confirmed, technical requirements, team size, and budget verification...'
                      : targetStage === 'PROPOSAL'
                      ? 'Summarize customized scope presented, pricing tier, deliverables, and client review date...'
                      : targetStage === 'NEGOTIATION'
                      ? 'Detail contract redlines discussed, commercial terms, discounts, and closing target...'
                      : targetStage === 'WON'
                      ? 'Summarize final contract value, signed agreement confirmation, and kickoff timeline...'
                      : targetStage === 'LOST'
                      ? 'Explain the exact reason for loss (e.g. competitor, budget frozen, timing)...'
                      : 'Detail the client discussion and reason for advancing this stage...'
                  }
                  className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-2xl p-3 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none leading-relaxed"
                />
                <p className="text-[10px] text-[#585172] mt-1 leading-normal">
                  These notes are permanently logged in MongoDB and instantly visible to <strong>Core Team members (Lakshay, Parth, Diya, Suryansh, Ishita, Anshuman)</strong> and <strong>BDMs</strong> in real-time.
                </p>
              </div>

              <div className="pt-2 border-t border-[#E7E0FB] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStageModalLead(null)}
                  className="px-4 py-2 border border-[#E7E0FB] rounded-xl text-[#585172] hover:bg-[#F7F5FE] font-bold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingStage || !stageNotesInput.trim()}
                  className="px-5 py-2 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl font-bold text-xs shadow-md shadow-[#7C2CF5]/25 transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmittingStage ? 'Recording...' : 'Save & Update Stage'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Call Modal */}
      {callModalLead && (
        <div className="fixed inset-0 bg-[#120E24]/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E7E0FB]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E0FB] mb-4">
              <div>
                <h3 className="font-bold text-[#120E24] text-sm">Log Sales Call Activity</h3>
                <p className="text-[11px] text-[#585172]">{callModalLead.companyName} &bull; {callModalLead.contactName}</p>
              </div>
              <button onClick={() => setCallModalLead(null)} className="text-[#585172] hover:text-[#120E24]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLogCall} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#120E24] mb-1">Call Outcome</label>
                <select
                  value={callOutcome}
                  onChange={(e) => setCallOutcome(e.target.value)}
                  className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3 py-2 text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                >
                  <option value="CONNECTED">Connected & Pitched</option>
                  <option value="BUSY">Line Busy</option>
                  <option value="VOICEMAIL">Left Voicemail</option>
                  <option value="CALLBACK_REQUESTED">Callback Requested</option>
                  <option value="WRONG_NUMBER">Wrong Number</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#120E24] mb-1">Call Summary & Notes</label>
                <textarea
                  required
                  rows={3}
                  value={callSummary}
                  onChange={(e) => setCallSummary(e.target.value)}
                  className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3 py-2 text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                  placeholder="Discussed requirements, team size, budget..."
                />
              </div>

              <div>
                <label className="block font-semibold text-[#120E24] mb-1">Schedule Follow-up Date (Optional)</label>
                <input
                  type="datetime-local"
                  value={nextFollowUpDate}
                  onChange={(e) => setNextFollowUpDate(e.target.value)}
                  className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3 py-2 text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-[#E7E0FB] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCallModalLead(null)}
                  className="px-4 py-2 border border-[#E7E0FB] rounded-xl text-[#585172] hover:bg-[#F7F5FE] font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl font-bold shadow-md shadow-[#7C2CF5]/25 transition"
                >
                  Save Call Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Management & Notes Modal */}
      {noteModalLead && (
        <div className="fixed inset-0 bg-[#120E24]/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#E7E0FB] max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E0FB] mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700">
                  <StickyNote className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-[#120E24] text-sm">Record Management & Internal Notes</h3>
                  <p className="text-[11px] text-[#585172]">{noteModalLead.companyName} &bull; {noteModalLead.contactName}</p>
                </div>
              </div>
              <button onClick={() => setNoteModalLead(null)} className="text-[#585172] hover:text-[#120E24]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs mb-4">
              <div className="font-bold text-[#120E24] uppercase text-[10px] tracking-wider text-slate-500">
                Recorded Notes & History
              </div>
              {noteModalLead.activities && noteModalLead.activities.length > 0 ? (
                noteModalLead.activities.map((act: any, idx: number) => (
                  <div key={idx} className="p-3 bg-[#F7F5FE] border border-[#E7E0FB] rounded-xl space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-[#7C2CF5]">{act.actorUserId || 'Team Member'}</span>
                      <span className="text-[10px] text-[#585172]">{new Date(act.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-[#120E24] whitespace-pre-wrap">{act.summary}</p>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-[#585172] bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                  No notes recorded yet. Add your first client note below!
                </div>
              )}
            </div>

            <form onSubmit={handleCreateNote} className="space-y-3 pt-3 border-t border-[#E7E0FB]">
              <div>
                <label className="block font-semibold text-[#120E24] text-xs mb-1">
                  Add New Record Note / Meeting Spec
                </label>
                <textarea
                  required
                  rows={3}
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="Record client conversation, project budget requirements, deliverable scope, or follow-up note..."
                  className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3 py-2 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNoteModalLead(null)}
                  className="px-4 py-2 border border-[#E7E0FB] rounded-xl text-[#585172] hover:bg-[#F7F5FE] font-bold text-xs transition"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNote}
                  className="px-4 py-2 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl font-bold text-xs shadow-md shadow-[#7C2CF5]/25 transition disabled:opacity-50"
                >
                  {isSubmittingNote ? 'Saving...' : 'Save Note to Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer 360 Modal */}
      {customer360 && (
        <div className="fixed inset-0 bg-[#120E24]/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-[#E7E0FB] max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E0FB] mb-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#7C2CF5] tracking-wider">Customer 360 Unified Profile</span>
                <h3 className="font-bold text-lg text-[#120E24]">{customer360.companyName}</h3>
                <p className="text-xs text-[#585172]">Contact: {customer360.primaryContactName} ({customer360.email})</p>
              </div>
              <button onClick={() => setCustomer360(null)} className="text-[#585172] hover:text-[#120E24]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5 text-xs">
              {/* Linked Projects */}
              <div>
                <h4 className="font-bold text-[#120E24] mb-2">Linked Engineering Projects</h4>
                {customer360.projects && customer360.projects.length > 0 ? (
                  customer360.projects.map((p: any) => (
                    <div key={p.id} className="p-3 bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl mb-2">
                      <div className="font-semibold text-[#120E24]">{p.name} ({p.projectCode})</div>
                      <div className="text-[#585172] mt-0.5">{p.description}</div>
                    </div>
                  ))
                ) : (
                  <p className="text-[#585172] italic">No engineering projects linked yet.</p>
                )}
              </div>

              {/* Call Activities History */}
              <div>
                <h4 className="font-bold text-[#120E24] mb-2">Sales Activity Timeline</h4>
                {customer360.lead?.activities && customer360.lead.activities.length > 0 ? (
                  <div className="space-y-2">
                    {customer360.lead.activities.map((a: any) => (
                      <div key={a.id} className="p-2.5 bg-[#F0ECFC] border border-[#E7E0FB] rounded-xl">
                        <div className="flex justify-between font-semibold text-[#120E24]">
                          <span>{a.actorUserId} logged {a.outcome}</span>
                          <span className="text-[#585172] text-[10px]">{new Date(a.createdAt).toLocaleString()}</span>
                        </div>
                        <div className="text-[#585172] mt-1">{a.summary}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[#585172] italic">No call activities logged.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Lead & Survey Intelligence Modal */}
      {addLeadOpen && (
        <div className="fixed inset-0 bg-[#120E24]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-[#E7E0FB] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E0FB] mb-4">
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-[#120E24] text-base">Add New Lead & Survey Intelligence</h3>
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                    Awaits Review Flag
                  </span>
                </div>
                <p className="text-xs text-[#585172]">
                  Fill out prospect data, pain point analysis, proof links, and solution approach for Core Team / BDM review
                </p>
              </div>
              <button onClick={() => setAddLeadOpen(false)} className="text-[#585172] hover:text-[#120E24]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-4 text-xs">
              {/* Section 1: Basic Prospect Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Company Name *</label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3 py-2 text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                    placeholder="e.g. Apex Global Systems"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Contact Person Name *</label>
                  <input
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3 py-2 text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                    placeholder="e.g. Sunil Roy (CTO / Director)"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3 py-2 text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                    placeholder="sunil@apex.com"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3 py-2 text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                    placeholder="+91 9988776655"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Service Interest</label>
                  <input
                    type="text"
                    value={serviceInterest}
                    onChange={(e) => setServiceInterest(e.target.value)}
                    className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3 py-2 text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                    placeholder="e.g. Enterprise Cloud ERP, Web Application, AI"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3 py-2 text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                  >
                    <option value="HIGH">HIGH (Urgent need / Budget ready)</option>
                    <option value="MEDIUM">MEDIUM (Standard evaluation)</option>
                    <option value="LOW">LOW (Early exploration)</option>
                  </select>
                </div>

                {/* BDE Assignment Field */}
                <div className="col-span-1 sm:col-span-2">
                  <label className="block font-bold text-[#120E24] mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-[#7C2CF5]" />
                      <span>Assign To BDE *</span>
                    </span>
                    <span className="text-[10px] text-[#7C2CF5] font-semibold">
                      {isReviewer || isLakshay ? 'Assign this lead to a specific BDE' : 'Assigned to your pipeline'}
                    </span>
                  </label>
                  {isReviewer || isLakshay ? (
                    <select
                      value={assignedBdeEmail}
                      onChange={(e) => {
                        const selectedEmail = e.target.value;
                        setAssignedBdeEmail(selectedEmail);
                        const bde = bdeList.find((b) => b.email === selectedEmail);
                        if (bde) {
                          setAssignedBdeName(bde.fullName);
                          setAssignedBdeId(bde.id);
                        }
                      }}
                      className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3 py-2 text-[#120E24] focus:border-[#7C2CF5] focus:outline-none font-semibold text-xs"
                    >
                      {bdeList.map((b) => (
                        <option key={b.email} value={b.email}>
                          {b.fullName} &bull; {b.email} ({b.jobTitle || 'BDE'})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-2.5 bg-[#F7F5FE] border border-[#E7E0FB] rounded-xl flex items-center justify-between">
                      <span className="font-bold text-[#120E24]">{session?.user?.fullName || 'Current User'} ({session?.user?.email})</span>
                      <span className="text-[10px] text-[#7C2CF5] font-semibold bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                        Self-Assigned
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 2: BDE Survey Intelligence */}
              <div className="pt-2 border-t border-[#E7E0FB] space-y-3">
                <div className="flex items-center gap-1.5 font-bold text-[#7C2CF5] text-xs uppercase tracking-wider">
                  <Sparkles className="w-4 h-4" />
                  <span>Survey Intelligence, Proofs & Needs Analysis</span>
                </div>

                <div>
                  <label className="block font-bold text-[#120E24] mb-1">
                    What They Need (Client Pain Points & Requirement Survey) *
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={clientNeeds}
                    onChange={(e) => setClientNeeds(e.target.value)}
                    className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3 py-2 text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                    placeholder="Describe specific problems they face (e.g. Current legacy web app is slow, drops orders, lacks real-time inventory and modern security)..."
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#120E24] mb-1">
                    How CodRix Can Help (Proposed Solution & Value Pitch) *
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={codrixSolution}
                    onChange={(e) => setCodrixSolution(e.target.value)}
                    className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3 py-2 text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                    placeholder="State how CodRix delivers value (e.g. Build modern Next.js + Socket.IO microservice stack, automated deployment, estimated 4 weeks)..."
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#120E24] mb-1">
                    Proof & Research Links (Website, LinkedIn, References, Survey URLs)
                  </label>
                  <textarea
                    rows={2}
                    value={proofLinks}
                    onChange={(e) => setProofLinks(e.target.value)}
                    className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3 py-2 text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                    placeholder="Provide URLs (e.g. https://apex.com, https://linkedin.com/in/sunilroy, https://twitter.com/...)..."
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#120E24] mb-1">
                    Survey & Research Notes (Additional observations, budget signals)
                  </label>
                  <textarea
                    rows={2}
                    value={researchPoints}
                    onChange={(e) => setResearchPoints(e.target.value)}
                    className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3 py-2 text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                    placeholder="e.g. Verified on LinkedIn that they expanded operations to 3 new cities and raised seed funding..."
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#E7E0FB] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddLeadOpen(false)}
                  className="px-4 py-2 border border-[#E7E0FB] rounded-xl text-[#585172] hover:bg-[#F7F5FE] font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl font-bold shadow-md shadow-[#7C2CF5]/25 transition cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Submit Lead for Quality Review</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Unified Lead & Customer 360 Modal (Opened from View 360 Action on Any Lead) */}
      {lead360ModalData && (
        <div className="fixed inset-0 bg-[#120E24]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-[#E7E0FB] max-h-[90vh] overflow-y-auto space-y-5">
            {/* 360 Header */}
            <div className="flex items-start justify-between pb-4 border-b border-[#E7E0FB]">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#7C2CF5] to-[#9D54FF] text-white flex items-center justify-center font-bold">
                    <Building className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#7C2CF5] tracking-wider">
                      Unified 360 Profile & Intelligence
                    </span>
                    <h3 className="font-extrabold text-lg text-[#120E24] leading-tight">
                      {lead360ModalData.lead?.companyName || 'Enterprise Lead'}
                    </h3>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-[#585172]">
                  <span>Contact: <strong>{lead360ModalData.lead?.contactName}</strong></span>
                  <span>&bull;</span>
                  <span>Email: <strong className="text-[#7C2CF5]">{lead360ModalData.lead?.email}</strong></span>
                  {lead360ModalData.lead?.phone && (
                    <>
                      <span>&bull;</span>
                      <span>Phone: <strong>{lead360ModalData.lead?.phone}</strong></span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                  lead360ModalData.lead?.flagStatus === 'GREEN_FLAG'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : lead360ModalData.lead?.flagStatus === 'RED_FLAG'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}>
                  {lead360ModalData.lead?.flagStatus || 'AWAITING FLAG'}
                </span>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                  lead360ModalData.lead?.stage === 'WON'
                    ? 'bg-emerald-100 text-emerald-800'
                    : lead360ModalData.lead?.stage === 'LOST'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-[#F0ECFC] text-[#7C2CF5]'
                }`}>
                  STAGE: {lead360ModalData.lead?.stage || 'NEW'}
                </span>
                <button
                  onClick={() => setLead360ModalData(null)}
                  className="p-1 text-[#585172] hover:text-[#120E24] rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 3 Overview Quick Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 bg-[#FBFBFE] rounded-2xl border border-[#E7E0FB] space-y-1">
                <div className="font-bold text-[10px] uppercase text-[#7C2CF5] tracking-wider flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Assigned BDE & Owner</span>
                </div>
                <div className="font-bold text-[#120E24] text-sm">
                  {lead360ModalData.lead?.assignedBdeName || lead360ModalData.lead?.createdByName || '—'}
                </div>
                <div className="text-[11px] text-[#585172]">
                  {lead360ModalData.lead?.assignedBdeEmail || lead360ModalData.lead?.createdByEmail || '—'}
                </div>
                <div className="text-[10px] text-slate-400">
                  Added on {new Date(lead360ModalData.lead?.createdAt || Date.now()).toLocaleDateString()}
                </div>
              </div>

              <div className="p-3.5 bg-[#FBFBFE] rounded-2xl border border-[#E7E0FB] space-y-1">
                <div className="font-bold text-[10px] uppercase text-[#7C2CF5] tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Quality Review & Flag</span>
                </div>
                <div className="font-bold text-[#120E24] text-sm">
                  {lead360ModalData.lead?.flagStatus || 'PENDING EVALUATION'}
                </div>
                <div className="text-[11px] text-[#585172]">
                  {lead360ModalData.lead?.flaggedBy ? (
                    <span>Evaluator: <strong>{lead360ModalData.lead.flaggedBy}</strong> ({lead360ModalData.lead.flagTier === 'CORE_TEAM' ? 'Core Team' : 'BDM'})</span>
                  ) : (
                    <span>Awaiting Core Team / BDM review</span>
                  )}
                </div>
                {lead360ModalData.lead?.flagRemarks && (
                  <div className="text-[10px] text-slate-600 italic truncate" title={lead360ModalData.lead.flagRemarks}>
                    &ldquo;{lead360ModalData.lead.flagRemarks}&rdquo;
                  </div>
                )}
              </div>

              <div className="p-3.5 bg-[#FBFBFE] rounded-2xl border border-[#E7E0FB] space-y-1">
                <div className="font-bold text-[10px] uppercase text-[#7C2CF5] tracking-wider flex items-center gap-1">
                  <Target className="w-3.5 h-3.5" />
                  <span>Pipeline & Priority</span>
                </div>
                <div className="font-bold text-[#120E24] text-sm">
                  {lead360ModalData.lead?.priority || 'MEDIUM'} Priority
                </div>
                <div className="text-[11px] text-[#585172]">
                  Source: <strong>{lead360ModalData.lead?.source || 'EXCEL_IMPORT'}</strong>
                </div>
                <div className="text-[10px] text-slate-400">
                  Service: {lead360ModalData.lead?.serviceInterest || 'Enterprise Software'}
                </div>
              </div>
            </div>

            {/* Survey Needs & CodRix Solution Box */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3 text-xs">
              <div className="font-bold text-[#120E24] flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <Target className="w-3.5 h-3.5 text-[#7C2CF5]" />
                <span>Survey Intelligence & Proposed Technical Solution</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                  <div className="text-[10px] font-bold text-rose-600 uppercase">Client Need / Pain Point</div>
                  <p className="text-[#36314D] leading-relaxed whitespace-pre-wrap">
                    {lead360ModalData.lead?.clientNeeds || lead360ModalData.lead?.needSummary || 'No specific needs recorded.'}
                  </p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                  <div className="text-[10px] font-bold text-emerald-600 uppercase">CodRix Solution & Pitch</div>
                  <p className="text-[#36314D] leading-relaxed whitespace-pre-wrap">
                    {lead360ModalData.lead?.codrixSolution || 'Standard Enterprise Modernization & High-Speed Software Suite.'}
                  </p>
                </div>
              </div>

              {/* Proof links */}
              {lead360ModalData.lead?.proofLinks && (
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                  <div className="text-[10px] font-bold text-indigo-600 uppercase flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" />
                    <span>Proof & Reference Links</span>
                  </div>
                  <div className="text-indigo-600 text-[11px] break-all space-y-0.5">
                    {lead360ModalData.lead.proofLinks.split('\n').map((line: string, i: number) => {
                      const isUrl = line.trim().startsWith('http://') || line.trim().startsWith('https://');
                      return isUrl ? (
                        <div key={i}>
                          <a href={line.trim()} target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-800 flex items-center gap-1">
                            <span>{line.trim()}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      ) : (
                        <div key={i} className="text-slate-600">{line}</div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Stage Progression & Mandatory Notes History */}
            <div className="p-4 bg-white rounded-2xl border border-[#E7E0FB] space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[#120E24] text-[11px]">
                  <History className="w-4 h-4 text-[#7C2CF5]" />
                  <span>Stage Progression & Mandatory Notes History ({lead360ModalData.lead?.stageHistory?.length || 0})</span>
                </div>
                <span className="text-[10px] text-[#7C2CF5] font-semibold bg-[#F0ECFC] px-2 py-0.5 rounded-full">
                  Recorded in MongoDB
                </span>
              </div>

              {lead360ModalData.lead?.stageHistory && lead360ModalData.lead.stageHistory.length > 0 ? (
                <div className="space-y-3 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-[#DDD0FE] pl-1">
                  {lead360ModalData.lead.stageHistory.map((sh: any, idx: number) => (
                    <div key={idx} className="relative pl-6 space-y-1">
                      <div className="absolute left-1 top-1.5 w-4 h-4 rounded-full bg-[#7C2CF5] border-2 border-white shadow-xs"></div>
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5 font-bold text-[#120E24]">
                          <span className="px-2 py-0.5 bg-[#F0ECFC] text-[#7C2CF5] rounded-md border border-[#DDD0FE]">
                            {sh.fromStage}
                          </span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span className="px-2 py-0.5 bg-purple-100 text-[#7C2CF5] rounded-md font-extrabold border border-purple-200">
                            {sh.toStage}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {new Date(sh.updatedAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="p-2.5 bg-[#FBFBFE] rounded-xl border border-[#E7E0FB] space-y-1">
                        <p className="text-[#36314D] leading-relaxed whitespace-pre-wrap">{sh.notes}</p>
                        <div className="text-[10px] text-[#7C2CF5] font-semibold pt-1 border-t border-[#E7E0FB]/60 flex items-center justify-between">
                          <span>Updated by: <strong>{sh.updatedBy}</strong> ({sh.updatedByRole || 'Team'})</span>
                          <span className="text-slate-400 font-normal">{sh.updatedByEmail}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 text-center text-slate-400 italic bg-[#FBFBFE] rounded-xl border border-dashed border-[#E7E0FB]">
                  No stage updates recorded yet.
                </div>
              )}
            </div>

            {/* Sales Call Activity Timeline */}
            <div className="p-4 bg-white rounded-2xl border border-[#E7E0FB] space-y-3 text-xs">
              <div className="font-bold text-[#120E24] flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
                <span>Sales Outreach & Call Activity Timeline ({lead360ModalData.lead?.activities?.length || 0})</span>
              </div>
              {lead360ModalData.lead?.activities && lead360ModalData.lead.activities.length > 0 ? (
                <div className="space-y-2">
                  {lead360ModalData.lead.activities.map((a: any) => (
                    <div key={a.id} className="p-3 bg-[#F0ECFC]/70 border border-[#E7E0FB] rounded-xl space-y-1">
                      <div className="flex justify-between items-center font-bold text-[#120E24]">
                        <span className="text-[#7C2CF5]">{a.actorUserId} logged {a.outcome}</span>
                        <span className="text-[10px] text-[#585172]">{new Date(a.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-[#36314D]">{a.summary}</p>
                      {a.pitchFeedback && (
                        <div className="text-[10px] text-slate-500 italic border-t border-[#DDD0FE] pt-1">
                          Feedback: &ldquo;{a.pitchFeedback}&rdquo;
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 text-center text-slate-400 italic bg-[#FBFBFE] rounded-xl border border-dashed border-[#E7E0FB]">
                  No calls or pitch activities logged yet.
                </div>
              )}
            </div>

            {/* Converted Account & Linked Engineering Projects (Customer 360) */}
            {lead360ModalData.customer && (
              <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200 space-y-3 text-xs">
                <div className="font-bold text-emerald-800 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>Converted Enterprise Customer & Engineering Projects</span>
                </div>
                <div className="text-emerald-900 font-semibold">
                  Account: {lead360ModalData.customer.companyName} &bull; Primary: {lead360ModalData.customer.primaryContactName}
                </div>
                {lead360ModalData.projects && lead360ModalData.projects.length > 0 ? (
                  <div className="space-y-2">
                    {lead360ModalData.projects.map((p: any) => (
                      <div key={p.id} className="p-3 bg-white rounded-xl border border-emerald-200">
                        <div className="font-bold text-[#120E24]">{p.name} ({p.projectCode})</div>
                        <div className="text-slate-600 text-[11px] mt-0.5">{p.description}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-emerald-700 italic">No engineering sprints linked to this account yet.</p>
                )}
              </div>
            )}

            <div className="pt-3 border-t border-[#E7E0FB] flex justify-end">
              <button
                type="button"
                onClick={() => setLead360ModalData(null)}
                className="px-5 py-2 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl font-bold transition cursor-pointer text-xs"
              >
                Close 360 Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Excel / CSV Modal (Admin, BDM & Core Team Only) */}
      {uploadModalOpen && (
        <div className="fixed inset-0 bg-[#120E24]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-[#E7E0FB] max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E0FB]">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#120E24] text-base">Bulk Import Leads via Excel / CSV</h3>
                    <p className="text-xs text-[#585172]">
                      Upload or paste multiple leads from spreadsheet and assign them to specific BDEs in bulk
                    </p>
                  </div>
                </div>
              </div>
              <button onClick={() => setUploadModalOpen(false)} className="text-[#585172] hover:text-[#120E24]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Tabs */}
            <div className="flex items-center gap-2 border-b border-[#E7E0FB] pb-2 text-xs">
              <button
                type="button"
                onClick={() => setUploadTab('FILE')}
                className={`px-4 py-2 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  uploadTab === 'FILE'
                    ? 'bg-[#7C2CF5] text-white shadow-xs'
                    : 'bg-[#F7F5FE] text-[#585172] hover:bg-[#EDE4FF]'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload CSV / Spreadsheet File</span>
              </button>
              <button
                type="button"
                onClick={() => setUploadTab('PASTE')}
                className={`px-4 py-2 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  uploadTab === 'PASTE'
                    ? 'bg-[#7C2CF5] text-white shadow-xs'
                    : 'bg-[#F7F5FE] text-[#585172] hover:bg-[#EDE4FF]'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>Paste Directly from Excel / Google Sheets</span>
              </button>

              <div className="ml-auto">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Blank Template</span>
                </button>
              </div>
            </div>

            {/* Default BDE Assignment Selector */}
            <div className="p-3.5 bg-[#F7F5FE] rounded-2xl border border-[#E7E0FB] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <label className="block font-bold text-[#120E24]">
                  Default Assign To BDE (Fallback for rows without assigned BDE)
                </label>
                <p className="text-[11px] text-[#585172]">
                  If the Excel row has no &quot;Assigned BDE Email&quot;, the lead will automatically belong to this BDE
                </p>
              </div>
              <select
                value={defaultUploadBde}
                onChange={(e) => setDefaultUploadBde(e.target.value)}
                className="bg-white border border-[#E7E0FB] rounded-xl px-3 py-1.5 text-xs text-[#120E24] font-semibold focus:outline-none focus:border-[#7C2CF5] min-w-[240px]"
              >
                {bdeList.map((b) => (
                  <option key={b.email} value={b.email}>
                    {b.fullName} &bull; {b.email} ({b.jobTitle || 'BDE'})
                  </option>
                ))}
              </select>
            </div>

            {/* Input based on Tab */}
            {uploadTab === 'FILE' ? (
              <div className="p-6 border-2 border-dashed border-[#DDD0FE] rounded-2xl bg-[#FBFBFE] text-center space-y-2">
                <Upload className="w-8 h-8 text-[#7C2CF5] mx-auto" />
                <div className="text-sm font-bold text-[#120E24]">Choose a CSV or Excel-exported file</div>
                <p className="text-xs text-[#585172]">
                  Supports .csv, .tsv, and comma/tab-separated files downloaded from Excel
                </p>
                <input
                  type="file"
                  accept=".csv,.tsv,.txt"
                  onChange={handleFileUpload}
                  className="block mx-auto text-xs text-[#585172] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#EDE4FF] file:text-[#7C2CF5] hover:file:bg-[#DDD0FE] cursor-pointer"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="block font-bold text-xs text-[#120E24]">
                  Paste Excel rows (Headers + Data rows copied directly from Excel table)
                </label>
                <textarea
                  rows={6}
                  value={pasteText}
                  onChange={(e) => handlePasteChange(e.target.value)}
                  placeholder="Paste directly here (Ctrl+V) from Excel or Google Sheets. The parser will automatically map all columns..."
                  className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl p-3 text-xs font-mono text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                />
              </div>
            )}

            {/* Live Interactive Preview Table */}
            {parsedUploadLeads.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xs text-[#120E24] flex items-center gap-1.5">
                    <Table className="w-4 h-4 text-[#7C2CF5]" />
                    <span>Parsed Leads Preview ({parsedUploadLeads.length} detected)</span>
                  </div>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold">
                    Ready to Import
                  </span>
                </div>

                <div className="border border-[#E7E0FB] rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-[#F7F5FE] text-[#585172] font-bold border-b border-[#E7E0FB] sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Company Name</th>
                        <th className="py-2.5 px-3">Contact Person</th>
                        <th className="py-2.5 px-3">Email & Phone</th>
                        <th className="py-2.5 px-3">Needs & Solution</th>
                        <th className="py-2.5 px-3">Assigned BDE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E7E0FB]/60">
                      {parsedUploadLeads.map((row, idx) => (
                        <tr key={idx} className="hover:bg-[#F6F3FF]/40">
                          <td className="py-2 px-3 font-mono text-slate-400">{idx + 1}</td>
                          <td className="py-2 px-3 font-bold text-[#120E24]">{row.companyName}</td>
                          <td className="py-2 px-3">{row.contactName}</td>
                          <td className="py-2 px-3">
                            <div className="text-[#7C2CF5]">{row.email || '—'}</div>
                            <div className="text-slate-400 text-[10px]">{row.phone || ''}</div>
                          </td>
                          <td className="py-2 px-3 max-w-[200px] truncate" title={row.clientNeeds}>
                            {row.clientNeeds || row.serviceInterest || '—'}
                          </td>
                          <td className="py-2 px-3">
                            <span className="px-2 py-0.5 rounded-md bg-[#EDE4FF] text-[#7C2CF5] font-bold text-[10px]">
                              {row.assignedBdeName || row.assignedBdeEmail || defaultUploadBde || 'Assigned BDE'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="pt-3 border-t border-[#E7E0FB] flex items-center justify-between">
              <span className="text-xs text-[#585172]">
                {parsedUploadLeads.length > 0 ? `${parsedUploadLeads.length} leads ready for import.` : 'No leads parsed yet.'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="px-4 py-2 border border-[#E7E0FB] rounded-xl text-[#585172] hover:bg-[#F7F5FE] font-bold transition cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={parsedUploadLeads.length === 0 || isUploading}
                  onClick={handleSubmitBulkImport}
                  className="px-5 py-2 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl font-bold shadow-md shadow-[#7C2CF5]/25 transition cursor-pointer text-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  <span>{isUploading ? 'Importing...' : `Import ${parsedUploadLeads.length} Leads to CRM`}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
