import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { apiRequest } from '../../api/client.js';
import { getSocket } from '../../core/socket.js';
import {
  Mail,
  MailCheck,
  Search,
  RefreshCw,
  Edit3,
  Eye,
  Send,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  X,
  Code,
  Sparkles,
  Shield,
  Layers,
  ChevronRight,
  ExternalLink,
  Smartphone,
  Monitor,
  Copy,
  Info
} from 'lucide-react';

interface EmailTemplate {
  _id?: string;
  id?: string;
  templateKey: string;
  category: 'RECRUITMENT' | 'HRMS' | 'CRM' | 'ENGINEERING' | 'GENERAL';
  name: string;
  description: string;
  subject: string;
  bodyHtml: string;
  variables: string[];
  sampleData?: Record<string, string>;
  isDefault: boolean;
  updatedBy?: string;
  updatedAt?: string;
}

export const EmailTemplatesView: React.FC = () => {
  const { session, canAccessEmailTemplates } = useAuth();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Editor Modal State
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBodyHtml, setEditBodyHtml] = useState('');
  const [previewMode, setPreviewMode] = useState<'sample' | 'raw'>('sample');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [saving, setSaving] = useState(false);

  // Test Email State
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testTargetTemplate, setTestTargetTemplate] = useState<EmailTemplate | null>(null);
  const [testRecipientEmail, setTestRecipientEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  // Feedback Notification
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Load templates from API
  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<EmailTemplate[]>('/email-templates');
      setTemplates(data || []);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to fetch email templates from server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();

    // Listen for real-time template updates via Socket.IO
    const socket = getSocket();
    const handleTemplateUpdated = (updated: EmailTemplate) => {
      setTemplates((prev) =>
        prev.map((t) => (t.templateKey === updated.templateKey ? { ...t, ...updated } : t))
      );
    };

    socket.on('template:updated', handleTemplateUpdated);
    return () => {
      socket.off('template:updated', handleTemplateUpdated);
    };
  }, []);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      const matchesCategory = selectedCategory === 'ALL' || tpl.category === selectedCategory;
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        tpl.name.toLowerCase().includes(query) ||
        tpl.templateKey.toLowerCase().includes(query) ||
        tpl.subject.toLowerCase().includes(query) ||
        tpl.description.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [templates, selectedCategory, searchQuery]);

  // Open Edit Modal
  const handleOpenEdit = (tpl: EmailTemplate) => {
    setEditingTemplate(tpl);
    setEditSubject(tpl.subject);
    setEditBodyHtml(tpl.bodyHtml);
  };

  // Insert Variable into HTML Body at cursor
  const handleInsertVariable = (variableName: string) => {
    const token = `{{${variableName}}}`;
    if (!textareaRef.current) {
      setEditBodyHtml((prev) => prev + token);
      return;
    }
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const nextText = editBodyHtml.substring(0, start) + token + editBodyHtml.substring(end);
    setEditBodyHtml(nextText);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + token.length;
        textareaRef.current.focus();
      }
    }, 50);
  };

  // Save Template
  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;
    setSaving(true);
    try {
      const templateId = editingTemplate.id || editingTemplate._id || editingTemplate.templateKey;
      const updated = await apiRequest<EmailTemplate>(`/email-templates/${templateId}`, {
        method: 'PUT',
        body: JSON.stringify({
          subject: editSubject,
          bodyHtml: editBodyHtml
        })
      });

      setTemplates((prev) =>
        prev.map((t) => (t.templateKey === editingTemplate.templateKey ? { ...t, ...updated } : t))
      );
      showToast('success', `Email template "${editingTemplate.name}" updated and synchronized across CodRix!`);
      setEditingTemplate(null);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to update template');
    } finally {
      setSaving(false);
    }
  };

  // Reset Template to System Default
  const handleResetTemplate = async (tpl: EmailTemplate) => {
    if (!window.confirm(`Reset "${tpl.name}" back to the official system default template?`)) {
      return;
    }
    try {
      const templateId = tpl.id || tpl._id || tpl.templateKey;
      const res = await apiRequest<{ success: boolean; template: EmailTemplate }>(
        `/email-templates/${templateId}/reset`,
        { method: 'POST' }
      );

      if (res.template) {
        setTemplates((prev) =>
          prev.map((t) => (t.templateKey === tpl.templateKey ? { ...t, ...res.template } : t))
        );
        if (editingTemplate?.templateKey === tpl.templateKey) {
          setEditSubject(res.template.subject);
          setEditBodyHtml(res.template.bodyHtml);
          setEditingTemplate(res.template);
        }
        showToast('success', `"${tpl.name}" has been restored to factory default.`);
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to reset template');
    }
  };

  // Open Test Modal
  const handleOpenTestModal = (tpl: EmailTemplate) => {
    setTestTargetTemplate(tpl);
    setTestRecipientEmail(session?.user?.email || 'lakshay@codrix.co.in');
    setTestModalOpen(true);
  };

  // Dispatch Test Email
  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testTargetTemplate || !testRecipientEmail.trim()) return;
    setSendingTest(true);
    try {
      const templateId = testTargetTemplate.id || testTargetTemplate._id || testTargetTemplate.templateKey;
      const res = await apiRequest<{ success: boolean; recipient: string; subject: string; messageId: string }>(
        `/email-templates/${templateId}/send-test`,
        {
          method: 'POST',
          body: JSON.stringify({ recipientEmail: testRecipientEmail.trim() })
        }
      );
      showToast('success', `Test email dispatched successfully to ${res.recipient}!`);
      setTestModalOpen(false);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to send test email');
    } finally {
      setSendingTest(false);
    }
  };

  // Render HTML preview with sample variables substituted
  const renderedHtmlPreview = useMemo(() => {
    if (!editingTemplate) return '';
    let html = editBodyHtml;
    const sample = editingTemplate.sampleData || {};
    Object.keys(sample).forEach((k) => {
      const reg = new RegExp(`{{${k}}}`, 'g');
      html = html.replace(reg, sample[k]);
    });
    return html;
  }, [editBodyHtml, editingTemplate]);

  if (!canAccessEmailTemplates) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-rose-200 shadow-sm max-w-xl mx-auto my-12">
        <Shield className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-xl font-extrabold text-[#120E24]">Restricted Executive Access</h2>
        <p className="text-sm text-[#585172] mt-2 leading-relaxed">
          The Email Templates control suite is strictly reserved for the Founder and authorized SuperAdmin Leadership
          (<strong>Lakshay, Diya, Parth, Anshuman, Ishita</strong>).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Toast Banner */}
      {toast && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold border transition flex items-center justify-between shadow-md animate-in fade-in ${
            toast.type === 'success'
              ? 'bg-[#EAFBF3] text-[#0A7E46] border-[#B6EAD0]'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
          <button onClick={() => setToast(null)} className="text-gray-400 hover:text-gray-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-[#DDD0FE] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#7C2CF5] to-[#9B51E0] text-white flex items-center justify-center shadow-md shadow-[#7C2CF5]/20">
              <MailCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-[#120E24]">Email Templates Studio</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#EDE4FF] text-[#7C2CF5] border border-[#DDD0FE]">
                  SuperAdmin Only
                </span>
              </div>
              <p className="text-xs text-[#585172] mt-0.5">
                Centralized control over all system emails (ATS Onboarding, HRMS Credentials, Recruitment Journey, CRM & Engineering)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Atlas MongoDB Sync Active</span>
          </div>
          <button
            onClick={fetchTemplates}
            disabled={loading}
            className="p-2.5 bg-[#FAF7FF] border border-[#DDD0FE] text-[#7C2CF5] hover:bg-[#EDE4FF] rounded-xl font-bold text-xs transition flex items-center gap-1.5"
            title="Refresh Templates"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search & Category Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-[#DDD0FE] shadow-xs">
        {/* Categories Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'ALL', label: 'All Templates' },
            { id: 'RECRUITMENT', label: 'Recruitment & ATS' },
            { id: 'HRMS', label: 'HRMS & Staff' },
            { id: 'CRM', label: 'CRM & Client' },
            { id: 'ENGINEERING', label: 'Engineering' }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'bg-[#7C2CF5] text-white shadow-xs'
                  : 'text-[#585172] hover:bg-[#FAF7FF] hover:text-[#120E24]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[280px]">
          <Search className="w-4 h-4 text-[#585172] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search template name, key, or subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#FAF7FF] border border-[#E7E0FB] rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
          />
        </div>
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="py-20 text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-[#7C2CF5] mx-auto mb-2" />
          <p className="text-xs font-bold text-[#585172]">Fetching live templates from MongoDB Atlas...</p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-[#DDD0FE] text-center max-w-lg mx-auto">
          <Mail className="w-10 h-10 text-[#585172]/40 mx-auto mb-3" />
          <h3 className="text-sm font-extrabold text-[#120E24]">No templates match your search</h3>
          <p className="text-xs text-[#585172] mt-1">Try clearing your search query or selecting another category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredTemplates.map((tpl) => (
            <div
              key={tpl.templateKey}
              className="bg-white rounded-3xl border border-[#DDD0FE] p-5 shadow-xs hover:border-[#7C2CF5]/50 transition flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#FAF7FF] text-[#7C2CF5] border border-[#DDD0FE]">
                        {tpl.category}
                      </span>
                      {tpl.isDefault ? (
                        <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          System Default
                        </span>
                      ) : (
                        <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>Customized</span>
                        </span>
                      )}
                    </div>
                    <h3 className="font-black text-sm text-[#120E24]">{tpl.name}</h3>
                    <p className="text-[11px] text-[#585172]">{tpl.description}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-mono text-gray-400 block">{tpl.templateKey}</span>
                  </div>
                </div>

                {/* Subject Preview */}
                <div className="p-3 bg-[#FAF7FF] rounded-2xl border border-[#E7E0FB] space-y-1">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#7C2CF5] block">
                    Email Subject
                  </span>
                  <div className="text-xs font-bold text-[#120E24] truncate">{tpl.subject}</div>
                </div>

                {/* Variables Pills */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-extrabold text-[#585172]">Dynamic Placeholders:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {tpl.variables.map((v) => (
                      <span
                        key={v}
                        className="px-2 py-0.5 bg-purple-50 text-[#7C2CF5] rounded-md font-mono text-[10px] font-semibold border border-purple-200"
                      >
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="mt-5 pt-4 border-t border-[#E7E0FB] flex items-center justify-between">
                <div className="text-[10px] text-[#585172]">
                  {tpl.updatedBy ? (
                    <span>
                      Updated by <strong className="text-[#120E24]">{tpl.updatedBy}</strong>
                    </span>
                  ) : (
                    <span>CodRix Official Baseline</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenTestModal(tpl)}
                    className="px-3 py-1.5 bg-[#FAF7FF] hover:bg-[#EDE4FF] text-[#7C2CF5] rounded-xl text-xs font-bold transition flex items-center gap-1"
                    title="Send real test email to check styling"
                  >
                    <Send className="w-3 h-3" />
                    <span>Send Test</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(tpl)}
                    className="px-3.5 py-1.5 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 shadow-sm shadow-[#7C2CF5]/20"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Modify Template</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 🛠️ LIVE DUAL-PANE TEMPLATE EDITOR MODAL */}
      {editingTemplate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl border border-[#DDD0FE] shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#E7E0FB] flex items-center justify-between bg-gradient-to-r from-[#FAF7FF] to-[#EDE4FF]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#7C2CF5] text-white flex items-center justify-center font-bold shadow-md">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-[#120E24] flex items-center gap-2">
                    <span>{editingTemplate.name}</span>
                    <span className="font-mono text-xs px-2 py-0.5 bg-white rounded-lg border border-[#DDD0FE] text-[#7C2CF5]">
                      {editingTemplate.templateKey}
                    </span>
                  </h3>
                  <p className="text-xs text-[#585172]">{editingTemplate.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleResetTemplate(editingTemplate)}
                  className="px-3 py-1.5 bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-bold transition flex items-center gap-1"
                  title="Revert back to default CodRix system template"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Default</span>
                </button>
                <button
                  onClick={() => setEditingTemplate(null)}
                  className="p-2 hover:bg-white rounded-xl text-gray-500 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body - 2 Columns */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#E7E0FB] overflow-y-auto">
              {/* Left Column: Form & Editor */}
              <div className="p-6 space-y-4 overflow-y-auto">
                {/* Subject Line */}
                <div>
                  <label className="block text-xs font-extrabold text-[#120E24] mb-1.5">
                    Email Subject Line <span className="text-[#7C2CF5]">*</span>
                  </label>
                  <input
                    type="text"
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    className="w-full bg-[#FAF7FF] border border-[#DDD0FE] rounded-2xl p-3 text-xs font-bold text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                    placeholder="e.g. Welcome to CodRix | Your Portal Login Credentials"
                  />
                </div>

                {/* Variable Inserter Bar */}
                <div className="p-3 bg-[#FAF7FF] border border-[#DDD0FE] rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-extrabold text-[#120E24] flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-[#7C2CF5]" />
                      <span>Click to Insert Placeholders</span>
                    </span>
                    <span className="text-[10px] text-[#585172]">Inserts at current cursor</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {editingTemplate.variables.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => handleInsertVariable(v)}
                        className="px-2 py-1 bg-white hover:bg-[#EDE4FF] text-[#7C2CF5] border border-[#DDD0FE] rounded-lg font-mono text-[10px] font-bold transition flex items-center gap-1 shadow-2xs"
                      >
                        <span>+ {`{{${v}}}`}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* HTML Source Editor */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-extrabold text-[#120E24] flex items-center gap-1.5">
                      <Code className="w-3.5 h-3.5 text-[#7C2CF5]" />
                      <span>HTML Email Template Source</span>
                    </label>
                    <span className="text-[10px] text-[#585172]">Standard inline CSS compatible with Outlook & Gmail</span>
                  </div>
                  <textarea
                    ref={textareaRef}
                    rows={16}
                    value={editBodyHtml}
                    onChange={(e) => setEditBodyHtml(e.target.value)}
                    className="w-full bg-[#120E24] text-[#E7E0FB] font-mono text-[11px] p-4 rounded-2xl border border-gray-800 focus:outline-none focus:ring-2 focus:ring-[#7C2CF5] leading-relaxed resize-none"
                    spellCheck={false}
                  />
                </div>
              </div>

              {/* Right Column: Live Visual Preview */}
              <div className="p-6 bg-[#FAF7FF]/50 flex flex-col justify-between overflow-y-auto space-y-4">
                <div>
                  {/* Preview Toolbar */}
                  <div className="flex items-center justify-between pb-3 border-b border-[#E7E0FB]">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-[#120E24] flex items-center gap-1.5">
                        <Eye className="w-4 h-4 text-[#7C2CF5]" />
                        <span>Live Visual Render</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Device switch */}
                      <div className="bg-white p-1 rounded-xl border border-[#DDD0FE] flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPreviewDevice('desktop')}
                          className={`p-1.5 rounded-lg transition ${
                            previewDevice === 'desktop' ? 'bg-[#EDE4FF] text-[#7C2CF5]' : 'text-gray-400'
                          }`}
                          title="Desktop View"
                        >
                          <Monitor className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewDevice('mobile')}
                          className={`p-1.5 rounded-lg transition ${
                            previewDevice === 'mobile' ? 'bg-[#EDE4FF] text-[#7C2CF5]' : 'text-gray-400'
                          }`}
                          title="Mobile View"
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Rendered View Box */}
                  <div className="mt-4 flex justify-center">
                    <div
                      className={`w-full bg-white rounded-2xl border border-[#DDD0FE] shadow-sm overflow-hidden transition-all duration-300 ${
                        previewDevice === 'mobile' ? 'max-w-sm' : 'max-w-xl'
                      }`}
                    >
                      {/* Fake email client header */}
                      <div className="bg-[#FAF7FF] p-3 border-b border-[#E7E0FB] space-y-1 text-xs">
                        <div className="text-[11px] text-[#585172] flex items-center gap-1">
                          <span className="font-bold text-[#120E24]">From:</span> CodRix Notifications &lt;careers@codrix.co.in&gt;
                        </div>
                        <div className="text-[11px] text-[#585172] flex items-center gap-1 truncate">
                          <span className="font-bold text-[#120E24]">Subject:</span>{' '}
                          <span className="text-[#120E24] font-semibold">{editSubject}</span>
                        </div>
                      </div>

                      {/* Rendered HTML */}
                      <div
                        className="p-4 max-h-[460px] overflow-y-auto text-xs"
                        dangerouslySetInnerHTML={{ __html: renderedHtmlPreview }}
                      />
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-2xl border border-[#DDD0FE] text-[11px] text-[#585172] flex items-center gap-2">
                  <Info className="w-4 h-4 text-[#7C2CF5] shrink-0" />
                  <span>
                    Official Portal URL configured to <strong>https://connect.codrix.co.in</strong>. Changes made here apply
                    immediately to all future email notifications across the platform.
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-[#E7E0FB] bg-[#FAF7FF] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setEditingTemplate(null)}
                className="px-5 py-2.5 border border-[#DDD0FE] bg-white rounded-2xl text-xs font-bold text-[#585172] hover:bg-gray-50 transition"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenTestModal(editingTemplate)}
                  className="px-4 py-2.5 bg-white border border-[#DDD0FE] hover:bg-[#EDE4FF] text-[#7C2CF5] rounded-2xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Test Email</span>
                </button>
                <button
                  type="button"
                  disabled={saving || !editSubject.trim() || !editBodyHtml.trim()}
                  onClick={handleSaveTemplate}
                  className="px-6 py-2.5 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-2xl text-xs font-black transition flex items-center gap-2 shadow-md shadow-[#7C2CF5]/25 disabled:opacity-50"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Save & Apply Across System</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 SEND TEST EMAIL MODAL */}
      {testModalOpen && testTargetTemplate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-[#DDD0FE] shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-[#7C2CF5] flex items-center justify-center font-bold">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-[#120E24]">Send Test Email</h3>
                  <p className="text-[11px] text-[#585172]">{testTargetTemplate.name}</p>
                </div>
              </div>
              <button onClick={() => setTestModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendTestEmail} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#120E24] mb-1">Send Preview To *</label>
                <input
                  type="email"
                  required
                  value={testRecipientEmail}
                  onChange={(e) => setTestRecipientEmail(e.target.value)}
                  placeholder="e.g. yourname@codrix.co.in"
                  className="w-full bg-[#FAF7FF] border border-[#DDD0FE] rounded-xl px-3.5 py-2.5 text-xs text-[#120E24] font-medium focus:outline-none focus:border-[#7C2CF5]"
                />
                <span className="text-[10px] text-[#585172] mt-1 block">
                  The test email will be rendered with realistic sample candidate and credential data.
                </span>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTestModalOpen(false)}
                  className="px-4 py-2 border border-[#DDD0FE] rounded-xl text-xs font-bold text-[#585172] hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingTest || !testRecipientEmail.trim()}
                  className="px-5 py-2 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-[#7C2CF5]/20 disabled:opacity-50"
                >
                  {sendingTest ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Dispatch Test</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
