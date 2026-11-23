import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { apiRequest } from '../../api/client.js';
import { getSocket } from '../../core/socket.js';
import {
  Mail,
  ShieldCheck,
  Zap,
  Globe,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Building2,
  Save,
  Key,
  Layers,
  Sparkles
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { isLakshay } = useAuth();
  const [config, setConfig] = useState<any>(null);
  const [mailboxes, setMailboxes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'org' | 'resend' | 'mailboxes' | 'test'>('org');

  // Organization Profile State
  const [legalName, setLegalName] = useState('CODRIX PRIVATE LIMITED');
  const [tradeName, setTradeName] = useState('CodRix');
  const [website, setWebsite] = useState('https://codrix.co.in');
  const [supportEmail, setSupportEmail] = useState('connect@codrix.co.in');
  const [phone, setPhone] = useState('+91 8295886832');
  const [timezone, setTimezone] = useState('Asia/Kolkata (IST)');
  const [currency, setCurrency] = useState('INR (₹)');
  const [domain, setDomain] = useState('codrix.co.in');

  // Resend Email Engine State
  const [resendApiKey, setResendApiKey] = useState('');
  const [resendFromName, setResendFromName] = useState('Codrix Private Limited');
  const [resendFromEmail, setResendFromEmail] = useState('connect@codrix.co.in');
  const [showApiKey, setShowApiKey] = useState(false);
  const [resendSaving, setResendSaving] = useState(false);
  const [resendFeedback, setResendFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [verifyingKey, setVerifyingKey] = useState(false);

  // Channel Sync State
  const [syncingChannels, setSyncingChannels] = useState(false);
  const [channelsFeedback, setChannelsFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Diagnostics & Test Send
  const [testSendEmail, setTestSendEmail] = useState('lakshayb057@gmail.com');
  const [sendResult, setSendResult] = useState<{ type: 'success' | 'error' | 'loading' | null; message?: string; details?: any }>({ type: null });

  // Add Mailbox Modal
  const [newMailboxModal, setNewMailboxModal] = useState(false);
  const [newMailboxAddr, setNewMailboxAddr] = useState('');
  const [newMailboxName, setNewMailboxName] = useState('');

  const loadSettings = async () => {
    try {
      setLoading(true);
      const [emailData, mbData, orgData] = await Promise.all([
        apiRequest<any>('/settings/email'),
        apiRequest<any>('/mailboxes'),
        apiRequest<any>('/settings/organization').catch(() => null)
      ]);

      if (orgData) {
        setLegalName(orgData.legalName || 'CODRIX PRIVATE LIMITED');
        setTradeName(orgData.tradeName || 'CodRix');
        setWebsite(orgData.website || 'https://codrix.co.in');
        setSupportEmail(orgData.supportEmail || 'connect@codrix.co.in');
        setPhone(orgData.phone || '+91 8295886832');
        setTimezone(orgData.timezone || 'Asia/Kolkata (IST)');
        setCurrency(orgData.currency || 'INR (₹)');
        if (orgData.domain) setDomain(orgData.domain);
      }

      const c = emailData;
      setConfig(c);
      if (c.domain) setDomain(c.domain);

      // Populate Resend config
      const resendConfig = c.resend || c.transactional || {};
      setResendApiKey(resendConfig.apiKey || '');
      setResendFromName(resendConfig.fromName || 'Codrix Private Limited');
      setResendFromEmail(resendConfig.fromEmail || 'connect@codrix.co.in');

      setMailboxes(mbData || []);
    } catch (err: any) {
      console.error('Failed loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();

    const socket = getSocket();
    const handleSettingsSync = () => {
      loadSettings();
    };

    socket.on('settings:updated', handleSettingsSync);
    socket.on('mailbox:synced', handleSettingsSync);

    return () => {
      socket.off('settings:updated', handleSettingsSync);
      socket.off('mailbox:synced', handleSettingsSync);
    };
  }, []);

  const handleSaveOrganization = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSaveSuccessMsg(null);
    try {
      await apiRequest('/settings/organization', {
        method: 'POST',
        body: JSON.stringify({
          legalName,
          tradeName,
          website,
          domain,
          supportEmail,
          phone,
          timezone,
          currency
        })
      });
      setSaveSuccessMsg('Organization profile and company domain saved to MongoDB Atlas!');
      setTimeout(() => setSaveSuccessMsg(null), 5000);
      loadSettings();
    } catch (err: any) {
      alert(err.message || 'Error saving organization settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveResend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setResendSaving(true);
    setResendFeedback(null);
    try {
      const res: any = await apiRequest('/settings/email', {
        method: 'POST',
        body: JSON.stringify({
          domain,
          resend: {
            apiKey: resendApiKey,
            fromName: resendFromName,
            fromEmail: resendFromEmail
          }
        })
      });
      setResendFeedback({
        type: 'success',
        message: res?.message || 'Resend Enterprise Email Engine credentials saved and synchronized!'
      });
      await loadSettings();
      setTimeout(() => setResendFeedback(null), 6000);
    } catch (err: any) {
      setResendFeedback({
        type: 'error',
        message: err.message || 'Failed saving Resend settings.'
      });
    } finally {
      setResendSaving(false);
    }
  };

  const handleVerifyResendKey = async () => {
    setVerifyingKey(true);
    setResendFeedback(null);
    try {
      const res: any = await apiRequest('/settings/email/verify-resend', {
        method: 'POST',
        body: JSON.stringify({ apiKey: resendApiKey })
      });
      setResendFeedback({
        type: 'success',
        message: res?.message || 'Resend API Key verified successfully! Connection active.'
      });
    } catch (err: any) {
      setResendFeedback({
        type: 'error',
        message: err.message || 'Resend API Key verification failed.'
      });
    } finally {
      setVerifyingKey(false);
    }
  };

  const handleSyncAllChannels = async () => {
    setSyncingChannels(true);
    setChannelsFeedback(null);
    try {
      const res: any = await apiRequest('/settings/email/sync-channels', { method: 'POST' });
      setChannelsFeedback({
        type: 'success',
        message: res?.message || 'All company channels synchronized with MongoDB Atlas!'
      });
      await loadSettings();
      setTimeout(() => setChannelsFeedback(null), 6000);
    } catch (err: any) {
      setChannelsFeedback({
        type: 'error',
        message: err.message || 'Failed syncing company channels.'
      });
    } finally {
      setSyncingChannels(false);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendResult({ type: 'loading', message: `Dispatching live test email via Resend to ${testSendEmail}...` });
    try {
      const res: any = await apiRequest('/settings/email/test-send', {
        method: 'POST',
        body: JSON.stringify({ targetEmail: testSendEmail })
      });
      setSendResult({
        type: 'success',
        message: res.message || 'Live test email dispatched successfully via Resend HTTPS API!',
        details: res
      });
    } catch (err: any) {
      setSendResult({ type: 'error', message: err.message || 'Failed to dispatch test email.' });
    }
  };

  const handleAddMailbox = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/settings/mailboxes', {
        method: 'POST',
        body: JSON.stringify({
          mailboxAddress: newMailboxAddr,
          displayName: newMailboxName
        })
      });
      setNewMailboxModal(false);
      setNewMailboxAddr('');
      setNewMailboxName('');
      loadSettings();
    } catch (err: any) {
      alert(err.message || 'Failed adding mailbox');
    }
  };

  const handleDeleteMailbox = async (id: string) => {
    if (!isLakshay) {
      alert('Security Violation: Only Lakshay the founder is authorized to delete or disconnect mailbox channels.');
      return;
    }
    if (!confirm('Are you sure you want to disconnect this mailbox?')) return;
    try {
      await apiRequest(`/settings/mailboxes/${id}`, { method: 'DELETE' });
      loadSettings();
    } catch (err: any) {
      alert(err.message || 'Failed deleting mailbox');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#585172]">
        <RefreshCw className="w-6 h-6 animate-spin text-[#7C2CF5]" />
        <span className="ml-2 text-xs font-semibold">Loading enterprise configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold tracking-wider uppercase bg-[#EDE4FF] text-[#7C2CF5] border border-[#E7E0FB]">
              Superadmin Only
            </span>
            <span className="text-xs text-[#585172]">Role: COMPANY_ADMIN</span>
          </div>
          <h2 className="text-xl font-extrabold text-[#120E24] mt-1 flex items-center gap-2">
            <span>Company Domain & Email Integration</span>
            <span className="w-2 h-2 rounded-full bg-[#7C2CF5]"></span>
          </h2>
          <p className="text-xs text-[#585172]">
            Official domain email delivery powered exclusively by <strong className="text-[#7C2CF5]">Resend HTTPS Engine (Port 443)</strong>. 100% white-labeled deliverability, zero cloud port blocks.
          </p>
        </div>

        <button
          onClick={() => {
            if (activeTab === 'org') handleSaveOrganization();
            else if (activeTab === 'resend') handleSaveResend();
          }}
          disabled={saving || resendSaving}
          className="px-5 py-2.5 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl text-xs font-bold shadow-md shadow-[#7C2CF5]/25 transition flex items-center gap-2"
        >
          {(saving || resendSaving) ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{(saving || resendSaving) ? 'Saving to Database...' : 'Save Current Settings'}</span>
        </button>
      </div>

      {/* Success Notification Banner */}
      {saveSuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-2 text-xs font-bold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Enterprise Active Engine Status Bar */}
      <div className="bg-gradient-to-r from-[#F7F5FE] via-white to-[#F7F5FE] border border-[#E7E0FB] rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#7C2CF5] text-white rounded-xl shadow-md shadow-[#7C2CF5]/20">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-[#120E24]">Resend Enterprise Email Engine</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  ● ACTIVE (Port 443 HTTPS)
                </span>
              </div>
              <p className="text-[11px] text-[#585172] mt-0.5">
                Exclusively dispatches all ATS candidate emails, stage alerts, onboarding invites, and official replies with 0ms port blocks.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="bg-white px-3.5 py-2 rounded-xl border border-[#E7E0FB]">
              <span className="text-[10px] uppercase font-bold text-[#585172] block">Verified Domain</span>
              <span className="font-bold text-[#7C2CF5] font-mono">codrix.co.in</span>
            </div>
            <div className="bg-white px-3.5 py-2 rounded-xl border border-[#E7E0FB]">
              <span className="text-[10px] uppercase font-bold text-[#585172] block">Sender Address</span>
              <span className="font-bold text-[#120E24] font-mono">connect@codrix.co.in</span>
            </div>
            <div className="bg-white px-3.5 py-2 rounded-xl border border-[#E7E0FB]">
              <span className="text-[10px] uppercase font-bold text-[#585172] block">Deliverability</span>
              <span className="font-bold text-emerald-700">100% White-Labeled</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-[#E7E0FB] gap-6 text-xs font-bold overflow-x-auto pb-1">
        {[
          { id: 'org', label: '1. Organization & Domain', icon: Building2 },
          { id: 'resend', label: '2. Resend Email Engine', icon: Zap },
          { id: 'mailboxes', label: `3. Connected Channels (${mailboxes.length})`, icon: Layers },
          { id: 'test', label: '4. Live Diagnostics & Test Send', icon: Send }
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-3 flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
                active
                  ? 'border-[#7C2CF5] text-[#7C2CF5]'
                  : 'border-transparent text-[#585172] hover:text-[#120E24]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Organization & Domain Setup */}
      {activeTab === 'org' && (
        <div className="bg-white border border-[#E7E0FB] rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex justify-between items-center pb-3 border-b border-[#E7E0FB]">
            <div>
              <h3 className="text-sm font-bold text-[#120E24] flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#7C2CF5]" />
                <span>Organization Identity & Domain Connectivity</span>
              </h3>
              <p className="text-xs text-[#585172]">
                Configure core company legal information, domain routing, and tenant identifiers stored in MongoDB Atlas.
              </p>
            </div>
            <span className="px-2.5 py-1 bg-[#F0ECFC] text-[#7C2CF5] text-[10px] font-bold rounded-lg border border-[#E7E0FB]">
              TENANT: CODRIX
            </span>
          </div>

          <form onSubmit={handleSaveOrganization} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-[#120E24] mb-1">Company Legal Entity Name</label>
              <input
                type="text"
                required
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3.5 py-2.5 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                placeholder="CODRIX PRIVATE LIMITED"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#120E24] mb-1">Brand / Trade Name</label>
              <input
                type="text"
                required
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
                className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3.5 py-2.5 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                placeholder="CodRix"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#120E24] mb-1">Official Company Website</label>
              <input
                type="url"
                required
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3.5 py-2.5 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                placeholder="https://codrix.co.in"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#120E24] mb-1">Company Domain</label>
              <input
                type="text"
                required
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3.5 py-2.5 text-xs text-[#120E24] font-bold text-[#7C2CF5] focus:border-[#7C2CF5] focus:outline-none"
                placeholder="codrix.co.in"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#120E24] mb-1">Primary Support Email</label>
              <input
                type="email"
                required
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3.5 py-2.5 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                placeholder="connect@codrix.co.in"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#120E24] mb-1">Corporate Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3.5 py-2.5 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                placeholder="+91 8295886832"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#120E24] mb-1">Default Operating Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
              >
                <option value="Asia/Kolkata (IST)">Asia/Kolkata (IST - UTC+05:30)</option>
                <option value="UTC">UTC (Universal Coordinated Time)</option>
                <option value="America/New_York (EST)">America/New_York (EST)</option>
                <option value="Europe/London (GMT)">Europe/London (GMT)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#120E24] mb-1">Reporting Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
              >
                <option value="INR (₹)">INR (₹ - Indian Rupee)</option>
                <option value="USD ($)">USD ($ - US Dollar)</option>
                <option value="EUR (€)">EUR (€ - Euro)</option>
                <option value="GBP (£)">GBP (£ - British Pound)</option>
              </select>
            </div>

            <div className="col-span-1 md:col-span-2 pt-4 border-t border-[#E7E0FB] flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl text-xs font-bold shadow-md shadow-[#7C2CF5]/25 transition flex items-center gap-2"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>Save Organization Profile</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: Resend Enterprise Email Engine */}
      {activeTab === 'resend' && (
        <div className="space-y-6">
          {/* Domain Verification Status Card */}
          <div className="bg-white border border-[#E7E0FB] rounded-2xl p-6 shadow-xs">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-[#E7E0FB]">
              <div>
                <h3 className="text-sm font-bold text-[#120E24] flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <span>Domain Verification & Deliverability Status</span>
                </h3>
                <p className="text-xs text-[#585172]">
                  Resend manages authenticated cryptographic DKIM & SPF signing for maximum inbox delivery.
                </p>
              </div>

              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Verified Domain: codrix.co.in</span>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 text-xs">
              <div className="p-3.5 rounded-xl bg-[#FBFBFE] border border-[#E7E0FB]">
                <span className="text-[10px] uppercase font-bold text-[#585172]">Cryptographic DKIM</span>
                <div className="text-xs font-bold text-[#120E24] flex items-center gap-1.5 mt-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>resend._domainkey.codrix.co.in</span>
                </div>
                <p className="text-[11px] text-[#585172] mt-1">Status: Active & Verified</p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#FBFBFE] border border-[#E7E0FB]">
                <span className="text-[10px] uppercase font-bold text-[#585172]">Sender Policy Framework (SPF)</span>
                <div className="text-xs font-bold text-[#120E24] flex items-center gap-1.5 mt-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>send.codrix.co.in</span>
                </div>
                <p className="text-[11px] text-[#585172] mt-1">Status: Active & Verified</p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#FBFBFE] border border-[#E7E0FB]">
                <span className="text-[10px] uppercase font-bold text-[#585172]">Brand Watermark Policy</span>
                <div className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 mt-1">
                  <Sparkles className="w-4 h-4 text-[#7C2CF5]" />
                  <span>Zero Watermarks (100% White-Labeled)</span>
                </div>
                <p className="text-[11px] text-[#585172] mt-1">No promotional footers or badges</p>
              </div>
            </div>
          </div>

          {/* Resend Engine Configuration Form */}
          <div className="bg-white border border-[#E7E0FB] rounded-2xl p-6 shadow-xs space-y-5">
            <div>
              <h3 className="text-sm font-bold text-[#120E24] flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#7C2CF5]" />
                <span>Resend API Configuration</span>
              </h3>
              <p className="text-xs text-[#585172]">
                Secure HTTPS REST API credentials stored in MongoDB Atlas and environment variables.
              </p>
            </div>

            <form onSubmit={handleSaveResend} className="space-y-4 max-w-xl text-xs">
              <div>
                <label className="block font-semibold text-[#120E24] mb-1">Resend API Key</label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={resendApiKey}
                    onChange={(e) => setResendApiKey(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl pl-3 pr-10 py-2.5 text-xs text-[#120E24] font-mono focus:border-[#7C2CF5] focus:outline-none"
                    placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxxxx"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-2.5 text-[#585172] hover:text-[#7C2CF5]"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-[#585172] mt-1">
                  Uses port 443 HTTPS REST API, permanently avoiding cloud firewall SMTP timeout issues.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#120E24] mb-1">Sender Display Name</label>
                  <input
                    type="text"
                    value={resendFromName}
                    onChange={(e) => setResendFromName(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                    placeholder="Codrix Private Limited"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#120E24] mb-1">Sender Email Address</label>
                  <input
                    type="email"
                    value={resendFromEmail}
                    onChange={(e) => setResendFromEmail(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-xs text-[#120E24] font-bold text-[#7C2CF5] focus:border-[#7C2CF5] focus:outline-none"
                    placeholder="connect@codrix.co.in"
                  />
                </div>
              </div>

              {resendFeedback && (
                <div className={`p-3 rounded-xl text-xs font-semibold border ${
                  resendFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  <div className="flex items-center gap-2">
                    {resendFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                    <span>{resendFeedback.message}</span>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-[#E7E0FB] flex flex-wrap gap-2 justify-between items-center">
                <button
                  type="button"
                  onClick={handleVerifyResendKey}
                  disabled={verifyingKey}
                  className="px-3.5 py-2 bg-[#F0ECFC] hover:bg-[#EDE4FF] text-[#7C2CF5] border border-[#E7E0FB] rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${verifyingKey ? 'animate-spin' : ''}`} />
                  <span>Verify API Key Handshake</span>
                </button>
                <button
                  type="submit"
                  disabled={resendSaving}
                  className="px-4 py-2 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl text-xs font-bold shadow-md shadow-[#7C2CF5]/25 transition flex items-center gap-1.5"
                >
                  {resendSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Save Resend Engine Settings</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: Connected Channels */}
      {activeTab === 'mailboxes' && (
        <div className="bg-white border border-[#E7E0FB] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-[#E7E0FB]">
            <div>
              <h3 className="text-sm font-bold text-[#120E24]">Authorized Company Channels</h3>
              <p className="text-xs text-[#585172]">Official brand mailboxes connected to the Resend dispatch engine in MongoDB Atlas</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSyncAllChannels}
                disabled={syncingChannels}
                className="px-3.5 py-2 bg-[#F0ECFC] hover:bg-[#EDE4FF] text-[#7C2CF5] border border-[#E7E0FB] rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingChannels ? 'animate-spin' : ''}`} />
                <span>Sync All Channels with DB</span>
              </button>
              <button
                onClick={() => setNewMailboxModal(true)}
                className="px-4 py-2 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Add Channel</span>
              </button>
            </div>
          </div>

          {channelsFeedback && (
            <div className={`p-3 rounded-xl text-xs font-semibold border ${
              channelsFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}>
              <div className="flex items-center gap-2">
                {channelsFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                <span>{channelsFeedback.message}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {mailboxes.map((mb) => (
              <div
                key={mb.id}
                className="p-4 rounded-xl border border-[#E7E0FB] bg-[#FBFBFE] flex items-center justify-between hover:border-[#7C2CF5]/40 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-[#F0ECFC] text-[#7C2CF5]">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-[#120E24]">{mb.displayName}</div>
                    <div className="text-[11px] font-mono text-[#7C2CF5]">{mb.mailboxAddress}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">
                        ● {mb.connectionStatus}
                      </span>
                      <span className="text-[10px] text-[#585172] font-semibold">
                        (Provider: Resend)
                      </span>
                    </div>
                  </div>
                </div>

                {isLakshay && (
                  <button
                    onClick={() => handleDeleteMailbox(mb.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="Remove channel"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: Live Diagnostics & Test Send */}
      {activeTab === 'test' && (
        <div className="bg-white border border-[#E7E0FB] rounded-2xl p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-sm font-bold text-[#120E24]">Live Resend Email Delivery Diagnostic</h3>
            <p className="text-xs text-[#585172]">
              Send an instant live email through the verified Resend HTTPS engine to confirm delivery directly to any mailbox.
            </p>
          </div>

          <form onSubmit={handleSendTestEmail} className="space-y-4 max-w-lg">
            <div>
              <label className="block text-xs font-semibold text-[#120E24] mb-1">Target Recipient Address</label>
              <input
                type="email"
                required
                value={testSendEmail}
                onChange={(e) => setTestSendEmail(e.target.value)}
                className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3.5 py-2.5 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                placeholder="lakshayb057@gmail.com"
              />
            </div>

            <button
              type="submit"
              disabled={sendResult.type === 'loading'}
              className="px-5 py-2.5 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl text-xs font-bold shadow-md shadow-[#7C2CF5]/25 transition flex items-center gap-2"
            >
              {sendResult.type === 'loading' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>Send Live Test Verification Email via Resend</span>
            </button>
          </form>

          {sendResult.type && (
            <div className={`p-4 rounded-xl border flex flex-col gap-2 text-xs font-semibold max-w-lg ${
              sendResult.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : sendResult.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-[#F0ECFC] border-[#E7E0FB] text-[#7C2CF5]'
            }`}>
              <div className="flex items-center gap-2">
                {sendResult.type === 'loading' && <RefreshCw className="w-4 h-4 animate-spin" />}
                {sendResult.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                {sendResult.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600" />}
                <span>{sendResult.message}</span>
              </div>
              {sendResult.details && (
                <pre className="text-[10px] font-mono bg-white/80 p-2.5 rounded-lg border border-emerald-200 text-emerald-950 overflow-x-auto">
                  {JSON.stringify(sendResult.details, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add Mailbox Modal */}
      {newMailboxModal && (
        <div className="fixed inset-0 bg-[#120E24]/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E7E0FB]">
            <h3 className="font-bold text-[#120E24] text-sm mb-1">Add Company Mailbox Channel</h3>
            <p className="text-xs text-[#585172] mb-4">Register an official domain mailbox for unified team monitoring</p>

            <form onSubmit={handleAddMailbox} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#120E24] mb-1">Mailbox Address</label>
                <input
                  type="email"
                  required
                  value={newMailboxAddr}
                  onChange={(e) => setNewMailboxAddr(e.target.value)}
                  className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3 py-2 text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                  placeholder="billing@codrix.co.in"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#120E24] mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={newMailboxName}
                  onChange={(e) => setNewMailboxName(e.target.value)}
                  className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3 py-2 text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                  placeholder="Enterprise Billing & Accounts"
                />
              </div>

              <div className="pt-3 border-t border-[#E7E0FB] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNewMailboxModal(false)}
                  className="px-4 py-2 border border-[#E7E0FB] rounded-xl text-[#585172] hover:bg-[#F7F5FE] font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl font-bold shadow-md shadow-[#7C2CF5]/25"
                >
                  Register Mailbox
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
