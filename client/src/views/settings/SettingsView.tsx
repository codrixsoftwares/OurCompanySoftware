import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { apiRequest } from '../../api/client.js';
import { getSocket } from '../../core/socket.js';
import {
  Mail,
  ShieldCheck,
  Server,
  Zap,
  Globe,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  Send,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  ExternalLink,
  Layers,
  Building2,
  Save,
  Key,
  HelpCircle,
  Link2
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { isLakshay } = useAuth();
  const [config, setConfig] = useState<any>(null);
  const [mailboxes, setMailboxes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'org' | 'smtp' | 'api' | 'webhook' | 'mailboxes' | 'test'>('org');

  // Organization Profile State
  const [legalName, setLegalName] = useState('CODRIX PRIVATE LIMITED');
  const [tradeName, setTradeName] = useState('CodRix');
  const [website, setWebsite] = useState('https://codrix.co.in');
  const [supportEmail, setSupportEmail] = useState('connect@codrix.co.in');
  const [phone, setPhone] = useState('+91 8295886832');
  const [timezone, setTimezone] = useState('Asia/Kolkata (IST)');
  const [currency, setCurrency] = useState('INR (₹)');

  // Email Integration State
  const [activeMethod, setActiveMethod] = useState<'SMTP_IMAP' | 'TRANSACTIONAL_API' | 'INBOUND_WEBHOOK'>('SMTP_IMAP');
  const [domain, setDomain] = useState('codrix.co.in');

  // SMTP State & Dedicated Save
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState('connect@codrix.co.in');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFromName, setSmtpFromName] = useState('CodRix Official');
  const [smtpFromEmail, setSmtpFromEmail] = useState('connect@codrix.co.in');
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpFeedback, setSmtpFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // IMAP State & Dedicated Save
  const [imapHost, setImapHost] = useState('imap.gmail.com');
  const [imapPort, setImapPort] = useState(993);
  const [imapSecure, setImapSecure] = useState(true);
  const [imapUser, setImapUser] = useState('connect@codrix.co.in');
  const [imapPass, setImapPass] = useState('');
  const [showImapPass, setShowImapPass] = useState(false);
  const [imapSaving, setImapSaving] = useState(false);
  const [imapFeedback, setImapFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Transactional API State & Dedicated Save
  const [transProvider, setTransProvider] = useState<'RESEND' | 'SENDGRID' | 'AWS_SES' | 'POSTMARK' | 'BREVO'>('RESEND');
  const [transApiKey, setTransApiKey] = useState('');
  const [transFromName, setTransFromName] = useState('CodRix Notifications');
  const [transFromEmail, setTransFromEmail] = useState('connect@codrix.co.in');
  const [showApiKey, setShowApiKey] = useState(false);
  const [transSaving, setTransSaving] = useState(false);
  const [transFeedback, setTransFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Inbound Webhook State & Dedicated Save
  const [webhookUrl, setWebhookUrl] = useState('');
  const [signingSecret, setSigningSecret] = useState('');
  const [webhookSaving, setWebhookSaving] = useState(false);
  const [webhookFeedback, setWebhookFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Channel Sync State
  const [syncingChannels, setSyncingChannels] = useState(false);
  const [channelsFeedback, setChannelsFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Diagnostics & Feedback
  const [testStatus, setTestStatus] = useState<{ type: 'success' | 'error' | 'loading' | null; message?: string }>({ type: null });
  const [testSendEmail, setTestSendEmail] = useState('lakshay@codrix.co.in');
  const [sendResult, setSendResult] = useState<{ type: 'success' | 'error' | 'loading' | null; message?: string; details?: any }>({ type: null });
  const [copied, setCopied] = useState<string | null>(null);

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
      setActiveMethod(c.activeMethod || 'SMTP_IMAP');
      if (c.domain) setDomain(c.domain);

      // SMTP
      setSmtpHost(c.smtp?.host || 'smtp.gmail.com');
      setSmtpPort(c.smtp?.port || 587);
      setSmtpSecure(Boolean(c.smtp?.secure));
      setSmtpUser(c.smtp?.username || 'connect@codrix.co.in');
      setSmtpPass(c.smtp?.password || '');
      setSmtpFromName(c.smtp?.fromName || 'CodRix Official');
      setSmtpFromEmail(c.smtp?.fromEmail || 'connect@codrix.co.in');

      // IMAP
      setImapHost(c.imap?.host || 'imap.gmail.com');
      setImapPort(c.imap?.port || 993);
      setImapSecure(Boolean(c.imap?.secure ?? true));
      setImapUser(c.imap?.username || 'connect@codrix.co.in');
      setImapPass(c.imap?.password || '');

      // Transactional
      setTransProvider(c.transactional?.provider || 'RESEND');
      setTransApiKey(c.transactional?.apiKey || '');
      setTransFromName(c.transactional?.fromName || 'CodRix Notifications');
      setTransFromEmail(c.transactional?.fromEmail || 'connect@codrix.co.in');

      // Webhook
      setWebhookUrl(c.webhook?.endpointUrl || `${window.location.origin}/api/v1/mailboxes/webhook/inbound`);
      setSigningSecret(c.webhook?.signingSecret || '');

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

  const handleApplyPreset = (preset: 'google' | 'zoho' | 'm365' | 'hostinger') => {
    if (preset === 'google') {
      setSmtpHost('smtp.gmail.com');
      setSmtpPort(587);
      setSmtpSecure(false);
      setImapHost('imap.gmail.com');
      setImapPort(993);
      setImapSecure(true);
    } else if (preset === 'zoho') {
      setSmtpHost('smtppro.zoho.in');
      setSmtpPort(465);
      setSmtpSecure(true);
      setImapHost('imappro.zoho.in');
      setImapPort(993);
      setImapSecure(true);
    } else if (preset === 'm365') {
      setSmtpHost('smtp.office365.com');
      setSmtpPort(587);
      setSmtpSecure(false);
      setImapHost('outlook.office365.com');
      setImapPort(993);
      setImapSecure(true);
    } else if (preset === 'hostinger') {
      setSmtpHost('smtp.hostinger.com');
      setSmtpPort(465);
      setSmtpSecure(true);
      setImapHost('imap.hostinger.com');
      setImapPort(993);
      setImapSecure(true);
    }
  };

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSaveSuccessMsg(null);
    try {
      await Promise.all([
        apiRequest('/settings/organization', {
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
        }),
        apiRequest('/settings/email', {
          method: 'POST',
          body: JSON.stringify({
            activeMethod,
            domain,
            smtp: {
              host: smtpHost,
              port: Number(smtpPort),
              secure: smtpSecure,
              username: smtpUser,
              password: smtpPass,
              fromName: smtpFromName,
              fromEmail: smtpFromEmail
            },
            imap: {
              host: imapHost,
              port: Number(imapPort),
              secure: imapSecure,
              username: imapUser,
              password: imapPass
            },
            transactional: {
              provider: transProvider,
              apiKey: transApiKey,
              fromName: transFromName,
              fromEmail: transFromEmail
            },
            webhook: {
              enabled: true,
              endpointUrl: webhookUrl,
              signingSecret
            }
          })
        })
      ]);
      setSaveSuccessMsg('All Superadmin updates saved to MongoDB Atlas! Domain, organization & email services are connected.');
      setTimeout(() => setSaveSuccessMsg(null), 5000);
      loadSettings();
    } catch (err: any) {
      alert(err.message || 'Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  // Dedicated Outbound SMTP Save & Auto-Channel Link
  const handleSaveSmtp = async () => {
    setSmtpSaving(true);
    setSmtpFeedback(null);
    try {
      const res: any = await apiRequest('/settings/email/smtp', {
        method: 'POST',
        body: JSON.stringify({
          host: smtpHost,
          port: Number(smtpPort),
          secure: smtpSecure,
          username: smtpUser,
          password: smtpPass,
          fromName: smtpFromName,
          fromEmail: smtpFromEmail
        })
      });
      setSmtpFeedback({
        type: 'success',
        message: res?.message || 'Outbound SMTP Server saved & linked directly to Authorized Company Channels!'
      });
      await loadSettings();
      setTimeout(() => setSmtpFeedback(null), 6000);
    } catch (err: any) {
      setSmtpFeedback({
        type: 'error',
        message: err.message || 'Failed saving Outbound SMTP Server.'
      });
    } finally {
      setSmtpSaving(false);
    }
  };

  // Dedicated Inbound IMAP Save & Sync
  const handleSaveImap = async () => {
    setImapSaving(true);
    setImapFeedback(null);
    try {
      const res: any = await apiRequest('/settings/email/imap', {
        method: 'POST',
        body: JSON.stringify({
          host: imapHost,
          port: Number(imapPort),
          secure: imapSecure,
          username: imapUser,
          password: imapPass
        })
      });
      setImapFeedback({
        type: 'success',
        message: res?.message || 'Inbound IMAP Server saved & synchronized with Authorized Channels!'
      });
      await loadSettings();
      setTimeout(() => setImapFeedback(null), 6000);
    } catch (err: any) {
      setImapFeedback({
        type: 'error',
        message: err.message || 'Failed saving Inbound IMAP Server.'
      });
    } finally {
      setImapSaving(false);
    }
  };

  const handleCopySmtpToImap = () => {
    setImapUser(smtpUser);
    setImapPass(smtpPass);
  };

  // Dedicated Transactional Gateway Save
  const handleSaveTransactional = async () => {
    setTransSaving(true);
    setTransFeedback(null);
    try {
      const res: any = await apiRequest('/settings/email/transactional', {
        method: 'POST',
        body: JSON.stringify({
          provider: transProvider,
          apiKey: transApiKey,
          fromName: transFromName,
          fromEmail: transFromEmail
        })
      });
      setTransFeedback({
        type: 'success',
        message: res?.message || 'Transactional Gateway saved & connected to Authorized Channels!'
      });
      await loadSettings();
      setTimeout(() => setTransFeedback(null), 6000);
    } catch (err: any) {
      setTransFeedback({
        type: 'error',
        message: err.message || 'Failed saving Transactional Gateway.'
      });
    } finally {
      setTransSaving(false);
    }
  };

  // Dedicated Inbound Webhook Save
  const handleSaveWebhook = async () => {
    setWebhookSaving(true);
    setWebhookFeedback(null);
    try {
      const res: any = await apiRequest('/settings/email/webhook', {
        method: 'POST',
        body: JSON.stringify({
          endpointUrl: webhookUrl,
          signingSecret
        })
      });
      setWebhookFeedback({
        type: 'success',
        message: res?.message || 'Inbound Webhook routing & DNS settings saved!'
      });
      await loadSettings();
      setTimeout(() => setWebhookFeedback(null), 6000);
    } catch (err: any) {
      setWebhookFeedback({
        type: 'error',
        message: err.message || 'Failed saving Webhook settings.'
      });
    } finally {
      setWebhookSaving(false);
    }
  };

  // Sync All Channels with MongoDB Atlas
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

  const handleVerifySmtp = async () => {
    setTestStatus({ type: 'loading', message: 'Testing SMTP connection & authentication handshake...' });
    try {
      const res: any = await apiRequest('/settings/email/verify-smtp', {
        method: 'POST',
        body: JSON.stringify({
          host: smtpHost,
          port: smtpPort,
          secure: smtpSecure,
          username: smtpUser,
          password: smtpPass
        })
      });
      setTestStatus({ type: 'success', message: res.message || 'SMTP Handshake verified successfully!' });
    } catch (err: any) {
      setTestStatus({ type: 'error', message: err.message || 'SMTP Verification failed. Check host, port, or app password.' });
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendResult({ type: 'loading', message: `Dispatching live test email to ${testSendEmail}...` });
    try {
      const res: any = await apiRequest('/settings/email/test-send', {
        method: 'POST',
        body: JSON.stringify({ targetEmail: testSendEmail })
      });
      setSendResult({
        type: 'success',
        message: res.message || 'Live test email dispatched successfully!',
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

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#585172]">
        <RefreshCw className="w-6 h-6 animate-spin text-[#7C2CF5]" />
        <span className="ml-2 text-xs font-semibold">Loading domain configuration...</span>
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
            Connect official domain emails (<code className="text-[#7C2CF5] font-bold">@{domain}</code>) for real-time outbound delivery, shared inbox ingestion, and applicant communications.
          </p>
        </div>

        <button
          onClick={() => handleSaveSettings()}
          disabled={saving}
          className="px-5 py-2.5 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl text-xs font-bold shadow-md shadow-[#7C2CF5]/25 transition flex items-center gap-2"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{saving ? 'Saving to Database...' : 'Save All Changes'}</span>
        </button>
      </div>

      {/* Success Notification Banner */}
      {saveSuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-2 text-xs font-bold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Active Primary Delivery Engine Switcher */}
      <div className="bg-white border border-[#E7E0FB] rounded-2xl p-5 shadow-xs">
        <label className="block text-xs font-bold text-[#120E24] uppercase tracking-wider mb-2">
          Active Outbound & Inbound Engine
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setActiveMethod('SMTP_IMAP')}
            className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 ${
              activeMethod === 'SMTP_IMAP'
                ? 'border-[#7C2CF5] bg-[#F7F5FE] ring-2 ring-[#7C2CF5]/20'
                : 'border-[#E7E0FB] bg-[#FBFBFE] hover:bg-white'
            }`}
          >
            <Server className={`w-5 h-5 shrink-0 mt-0.5 ${activeMethod === 'SMTP_IMAP' ? 'text-[#7C2CF5]' : 'text-[#585172]'}`} />
            <div>
              <div className="text-xs font-bold text-[#120E24] flex items-center gap-1.5">
                <span>Standard SMTP & IMAP</span>
                {activeMethod === 'SMTP_IMAP' && <span className="text-[10px] text-[#7C2CF5] font-bold">• Active</span>}
              </div>
              <p className="text-[11px] text-[#585172] mt-0.5">
                Google Workspace, Zoho, Microsoft 365, Hostinger, cPanel
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveMethod('TRANSACTIONAL_API')}
            className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 ${
              activeMethod === 'TRANSACTIONAL_API'
                ? 'border-[#7C2CF5] bg-[#F7F5FE] ring-2 ring-[#7C2CF5]/20'
                : 'border-[#E7E0FB] bg-[#FBFBFE] hover:bg-white'
            }`}
          >
            <Zap className={`w-5 h-5 shrink-0 mt-0.5 ${activeMethod === 'TRANSACTIONAL_API' ? 'text-[#7C2CF5]' : 'text-[#585172]'}`} />
            <div>
              <div className="text-xs font-bold text-[#120E24] flex items-center gap-1.5">
                <span>Transactional API Gateway</span>
                {activeMethod === 'TRANSACTIONAL_API' && <span className="text-[10px] text-[#7C2CF5] font-bold">• Active</span>}
              </div>
              <p className="text-[11px] text-[#585172] mt-0.5">
                Resend, SendGrid, Amazon SES, Postmark, Brevo
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveMethod('INBOUND_WEBHOOK')}
            className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 ${
              activeMethod === 'INBOUND_WEBHOOK'
                ? 'border-[#7C2CF5] bg-[#F7F5FE] ring-2 ring-[#7C2CF5]/20'
                : 'border-[#E7E0FB] bg-[#FBFBFE] hover:bg-white'
            }`}
          >
            <Globe className={`w-5 h-5 shrink-0 mt-0.5 ${activeMethod === 'INBOUND_WEBHOOK' ? 'text-[#7C2CF5]' : 'text-[#585172]'}`} />
            <div>
              <div className="text-xs font-bold text-[#120E24] flex items-center gap-1.5">
                <span>Inbound Email Webhook & DNS</span>
                {activeMethod === 'INBOUND_WEBHOOK' && <span className="text-[10px] text-[#7C2CF5] font-bold">• Active</span>}
              </div>
              <p className="text-[11px] text-[#585172] mt-0.5">
                Cloudflare Email Routing, SendGrid Inbound Parse
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-[#E7E0FB] gap-6 text-xs font-bold overflow-x-auto pb-1">
        {[
          { id: 'org', label: '1. Organization & Domain', icon: Building2 },
          { id: 'smtp', label: '2. SMTP & IMAP Credentials', icon: Server },
          { id: 'api', label: '3. Transactional API (Resend/SendGrid)', icon: Zap },
          { id: 'webhook', label: '4. Inbound Webhook & DNS Guide', icon: Globe },
          { id: 'mailboxes', label: `5. Connected Channels (${mailboxes.length})`, icon: Layers },
          { id: 'test', label: '6. Live Diagnostics & Test Send', icon: Send }
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

      {/* TAB 0: Organization & Domain Setup */}
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

          <form onSubmit={handleSaveSettings} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
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

      {/* TAB 1: SMTP & IMAP Setup */}
      {activeTab === 'smtp' && (
        <div className="space-y-6">
          {/* Quick Presets */}
          <div className="bg-[#F7F5FE] border border-[#E7E0FB] rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-[#120E24] block">Quick Autofill Presets:</span>
              <span className="text-[11px] text-[#585172]">Select your email hosting provider to autofill recommended hosts and ports</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleApplyPreset('google')}
                className="px-3 py-1.5 bg-white border border-[#E7E0FB] hover:border-[#7C2CF5] text-[#120E24] rounded-lg text-xs font-semibold transition"
              >
                Google Workspace
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('zoho')}
                className="px-3 py-1.5 bg-white border border-[#E7E0FB] hover:border-[#7C2CF5] text-[#120E24] rounded-lg text-xs font-semibold transition"
              >
                Zoho Mail
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('m365')}
                className="px-3 py-1.5 bg-white border border-[#E7E0FB] hover:border-[#7C2CF5] text-[#120E24] rounded-lg text-xs font-semibold transition"
              >
                Microsoft 365
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('hostinger')}
                className="px-3 py-1.5 bg-white border border-[#E7E0FB] hover:border-[#7C2CF5] text-[#120E24] rounded-lg text-xs font-semibold transition"
              >
                Hostinger / cPanel
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveSettings} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Outbound SMTP Card */}
            <div className="bg-white border border-[#E7E0FB] rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-[#E7E0FB]">
                <div>
                  <h3 className="text-sm font-bold text-[#120E24] flex items-center gap-1.5">
                    <Server className="w-4 h-4 text-[#7C2CF5]" />
                    <span>Outbound SMTP Server (Sending)</span>
                  </h3>
                  <p className="text-[11px] text-[#585172]">Delivers candidate offers, client emails, and shared mailbox replies</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  config?.smtp?.status === 'CONNECTED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-[#F0ECFC] text-[#7C2CF5]'
                }`}>
                  {config?.smtp?.status || 'CONFIGURED'}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#120E24] mb-1">SMTP Host</label>
                <input
                  type="text"
                  required
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                  placeholder="smtp.gmail.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#120E24] mb-1">Port</label>
                  <input
                    type="number"
                    required
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(Number(e.target.value))}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#120E24] mb-1">Encryption</label>
                  <select
                    value={smtpSecure ? 'ssl' : 'tls'}
                    onChange={(e) => setSmtpSecure(e.target.value === 'ssl')}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                  >
                    <option value="tls">STARTTLS (Port 587)</option>
                    <option value="ssl">SSL / TLS (Port 465)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#120E24] mb-1">Account Username / Email</label>
                <input
                  type="email"
                  required
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                  placeholder="connect@codrix.co.in"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#120E24] mb-1">Password or App Password</label>
                <div className="relative">
                  <input
                    type={showSmtpPass ? 'text' : 'password'}
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl pl-3 pr-10 py-2 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                    placeholder="Enter App Password from provider"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSmtpPass(!showSmtpPass)}
                    className="absolute right-3 top-2 text-[#585172] hover:text-[#7C2CF5]"
                  >
                    {showSmtpPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Google Workspace / Gmail App Password Helper */}
              <div className="p-3 bg-[#EDE4FF] border border-[#DDD0FE] rounded-xl text-[11px] text-[#585172] flex items-start gap-2">
                <Key className="w-4 h-4 text-[#7C2CF5] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-[#120E24]">Google Workspace / Gmail Tip:</span> Use a <strong>16-character App Password</strong> (e.g. <code>xxxx xxxx xxxx xxxx</code>), not your personal Google account password.
                  <a
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#7C2CF5] font-bold underline ml-1 inline-flex items-center gap-0.5"
                  >
                    <span>Generate App Password</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-[#120E24] mb-1">Sender Name</label>
                  <input
                    type="text"
                    value={smtpFromName}
                    onChange={(e) => setSmtpFromName(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                    placeholder="CodRix Official"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#120E24] mb-1">From Email Address</label>
                  <input
                    type="email"
                    value={smtpFromEmail}
                    onChange={(e) => setSmtpFromEmail(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                    placeholder="connect@codrix.co.in"
                  />
                </div>
              </div>

              {smtpFeedback && (
                <div className={`p-3 rounded-xl text-xs font-semibold border ${
                  smtpFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  <div className="flex items-center gap-2">
                    {smtpFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                    <span>{smtpFeedback.message}</span>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-[#E7E0FB] flex flex-wrap gap-2 justify-between items-center">
                <button
                  type="button"
                  onClick={handleVerifySmtp}
                  className="px-3.5 py-2 bg-[#F0ECFC] hover:bg-[#EDE4FF] text-[#7C2CF5] border border-[#E7E0FB] rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Test SMTP Handshake</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveSmtp}
                  disabled={smtpSaving}
                  className="px-4 py-2 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl text-xs font-bold shadow-md shadow-[#7C2CF5]/25 transition flex items-center gap-1.5"
                >
                  {smtpSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Save Outbound SMTP & Sync Channel</span>
                </button>
              </div>
            </div>

            {/* Inbound IMAP Card */}
            <div className="bg-white border border-[#E7E0FB] rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-[#E7E0FB]">
                <div>
                  <h3 className="text-sm font-bold text-[#120E24] flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-[#7C2CF5]" />
                    <span>Inbound IMAP Server (Receiving & Sync)</span>
                  </h3>
                  <p className="text-[11px] text-[#585172]">Syncs incoming emails automatically into the Unified Mailbox</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  IMAP ACTIVE
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#120E24] mb-1">IMAP Host</label>
                <input
                  type="text"
                  required
                  value={imapHost}
                  onChange={(e) => setImapHost(e.target.value)}
                  className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                  placeholder="imap.gmail.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#120E24] mb-1">Port</label>
                  <input
                    type="number"
                    required
                    value={imapPort}
                    onChange={(e) => setImapPort(Number(e.target.value))}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#120E24] mb-1">Security</label>
                  <select
                    value={imapSecure ? 'ssl' : 'plain'}
                    onChange={(e) => setImapSecure(e.target.value === 'ssl')}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                  >
                    <option value="ssl">SSL / TLS (Port 993)</option>
                    <option value="plain">STARTTLS (Port 143)</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-[#120E24]">IMAP Username</label>
                  <button
                    type="button"
                    onClick={handleCopySmtpToImap}
                    className="text-[11px] text-[#7C2CF5] font-bold hover:underline flex items-center gap-1"
                  >
                    <Link2 className="w-3 h-3" />
                    <span>Copy from SMTP</span>
                  </button>
                </div>
                <input
                  type="email"
                  required
                  value={imapUser}
                  onChange={(e) => setImapUser(e.target.value)}
                  className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                  placeholder="connect@codrix.co.in"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#120E24] mb-1">IMAP Password</label>
                <div className="relative">
                  <input
                    type={showImapPass ? 'text' : 'password'}
                    value={imapPass}
                    onChange={(e) => setImapPass(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl pl-3 pr-10 py-2 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                    placeholder="Enter App Password from provider"
                  />
                  <button
                    type="button"
                    onClick={() => setShowImapPass(!showImapPass)}
                    className="absolute right-3 top-2 text-[#585172] hover:text-[#7C2CF5]"
                  >
                    {showImapPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-[#F7F5FE] border border-[#E7E0FB] rounded-xl text-[11px] text-[#585172]">
                💡 <strong>Tip for Google Workspace / Gmail:</strong> Use the same 16-character App Password generated for SMTP.
              </div>

              {imapFeedback && (
                <div className={`p-3 rounded-xl text-xs font-semibold border ${
                  imapFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  <div className="flex items-center gap-2">
                    {imapFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                    <span>{imapFeedback.message}</span>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-[#E7E0FB] flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveImap}
                  disabled={imapSaving}
                  className="px-4 py-2 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl text-xs font-bold shadow-md shadow-[#7C2CF5]/25 transition flex items-center gap-1.5"
                >
                  {imapSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Save Inbound IMAP & Sync Channel</span>
                </button>
              </div>
            </div>

            {/* Status Alert Banner */}
            {testStatus.type && (
              <div className={`col-span-1 md:col-span-2 p-4 rounded-xl border flex items-center gap-3 text-xs font-semibold ${
                testStatus.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : testStatus.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-[#F0ECFC] border-[#E7E0FB] text-[#7C2CF5]'
              }`}>
                {testStatus.type === 'loading' && <RefreshCw className="w-4 h-4 animate-spin" />}
                {testStatus.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                {testStatus.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600" />}
                <span>{testStatus.message}</span>
              </div>
            )}
          </form>
        </div>
      )}

      {/* TAB 2: Transactional API Gateways */}
      {activeTab === 'api' && (
        <div className="bg-white border border-[#E7E0FB] rounded-2xl p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-sm font-bold text-[#120E24]">Transactional Email Gateways</h3>
            <p className="text-xs text-[#585172]">
              Use specialized developer delivery services with 99.9% inbox deliverability, DKIM signing, and zero rate limits.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { id: 'RESEND', name: 'Resend', desc: 'Modern & fast developer email' },
              { id: 'SENDGRID', name: 'SendGrid', desc: 'Twilio high-volume delivery' },
              { id: 'AWS_SES', name: 'Amazon SES', desc: 'AWS scalable cloud mail' },
              { id: 'POSTMARK', name: 'Postmark', desc: 'Sub-second transactional API' },
              { id: 'BREVO', name: 'Brevo', desc: 'Enterprise marketing & transactional' }
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setTransProvider(p.id as any)}
                className={`p-3 rounded-xl border text-left transition ${
                  transProvider === p.id
                    ? 'border-[#7C2CF5] bg-[#F7F5FE] ring-2 ring-[#7C2CF5]/20'
                    : 'border-[#E7E0FB] bg-[#FBFBFE] hover:bg-white'
                }`}
              >
                <div className="font-bold text-xs text-[#120E24]">{p.name}</div>
                <div className="text-[10px] text-[#585172] mt-0.5">{p.desc}</div>
              </button>
            ))}
          </div>

          <div className="space-y-4 max-w-xl">
            <div>
              <label className="block text-xs font-semibold text-[#120E24] mb-1">
                {transProvider} API Key
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={transApiKey}
                  onChange={(e) => setTransApiKey(e.target.value)}
                  className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl pl-3 pr-10 py-2.5 text-xs text-[#120E24] font-mono focus:border-[#7C2CF5] focus:outline-none"
                  placeholder={transProvider === 'RESEND' ? 're_123456789...' : 'SG.xxxxxxx...'}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-2.5 text-[#585172] hover:text-[#7C2CF5]"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#120E24] mb-1">Sender Name</label>
                <input
                  type="text"
                  value={transFromName}
                  onChange={(e) => setTransFromName(e.target.value)}
                  className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                  placeholder="CodRix Official"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#120E24] mb-1">Verified From Email</label>
                <input
                  type="email"
                  value={transFromEmail}
                  onChange={(e) => setTransFromEmail(e.target.value)}
                  className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-xs text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                  placeholder="connect@codrix.co.in"
                />
              </div>
            </div>

            {transFeedback && (
              <div className={`p-3 rounded-xl text-xs font-semibold border ${
                transFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}>
                <div className="flex items-center gap-2">
                  {transFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                  <span>{transFeedback.message}</span>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-[#E7E0FB] flex justify-end">
              <button
                type="button"
                onClick={handleSaveTransactional}
                disabled={transSaving}
                className="px-4 py-2 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl text-xs font-bold shadow-md shadow-[#7C2CF5]/25 transition flex items-center gap-1.5"
              >
                {transSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Save Transactional Gateway & Sync Channel</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Inbound Webhook & DNS Guide */}
      {activeTab === 'webhook' && (
        <div className="space-y-6">
          {/* Webhook Endpoint Card */}
          <div className="bg-white border border-[#E7E0FB] rounded-2xl p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-[#120E24]">Inbound Email Parsing Webhook</h3>
              <p className="text-xs text-[#585172]">
                Route incoming messages sent to any <code className="text-[#7C2CF5] font-bold">@codrix.co.in</code> address straight to this endpoint.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#120E24] mb-1">Ingestion Webhook URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="w-full bg-[#F7F5FE] border border-[#E7E0FB] rounded-xl px-3.5 py-2.5 text-xs text-[#120E24] font-mono"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(webhookUrl, 'url')}
                  className="px-4 py-2 bg-[#F0ECFC] hover:bg-[#EDE4FF] text-[#7C2CF5] border border-[#E7E0FB] rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  {copied === 'url' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  <span>{copied === 'url' ? 'Copied!' : 'Copy URL'}</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#120E24] mb-1">Webhook Signing Secret</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={signingSecret}
                  className="w-full bg-[#F7F5FE] border border-[#E7E0FB] rounded-xl px-3.5 py-2.5 text-xs text-[#120E24] font-mono"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(signingSecret, 'secret')}
                  className="px-4 py-2 bg-[#F0ECFC] hover:bg-[#EDE4FF] text-[#7C2CF5] border border-[#E7E0FB] rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  {copied === 'secret' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  <span>{copied === 'secret' ? 'Copied!' : 'Copy Secret'}</span>
                </button>
              </div>
            </div>

            {webhookFeedback && (
              <div className={`p-3 rounded-xl text-xs font-semibold border ${
                webhookFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}>
                <div className="flex items-center gap-2">
                  {webhookFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                  <span>{webhookFeedback.message}</span>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-[#E7E0FB] flex justify-end">
              <button
                type="button"
                onClick={handleSaveWebhook}
                disabled={webhookSaving}
                className="px-4 py-2 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl text-xs font-bold shadow-md shadow-[#7C2CF5]/25 transition flex items-center gap-1.5"
              >
                {webhookSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Save Inbound Webhook Settings</span>
              </button>
            </div>
          </div>

          {/* Recommended DNS Records for codrix.co.in */}
          <div className="bg-white border border-[#E7E0FB] rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-[#120E24]">Recommended DNS Records for codrix.co.in</h3>
            <p className="text-xs text-[#585172]">
              Add these DNS records in your domain registrar (e.g. GoDaddy, Cloudflare, Namecheap) to guarantee 100% email delivery and avoid the spam folder.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F5FE] text-[#585172] font-semibold border-b border-[#E7E0FB]">
                  <tr>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Name / Host</th>
                    <th className="py-2.5 px-3">Value / Target</th>
                    <th className="py-2.5 px-3">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E0FB]">
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-[#7C2CF5]">TXT</td>
                    <td className="py-2.5 px-3 font-mono">@</td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">v=spf1 include:_spf.google.com ~all</td>
                    <td className="py-2.5 px-3 text-[#585172]">SPF: Authorizes outbound sending IP</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-[#7C2CF5]">TXT</td>
                    <td className="py-2.5 px-3 font-mono">_dmarc</td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">v=DMARC1; p=none; rua=mailto:dmarc@codrix.co.in</td>
                    <td className="py-2.5 px-3 text-[#585172]">DMARC: Domain protection & policy</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-[#7C2CF5]">MX</td>
                    <td className="py-2.5 px-3 font-mono">@</td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">10 smtp.google.com (or provider MX)</td>
                    <td className="py-2.5 px-3 text-[#585172]">MX: Inbound mail routing</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Connected Channels */}
      {activeTab === 'mailboxes' && (
        <div className="bg-white border border-[#E7E0FB] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-[#E7E0FB]">
            <div>
              <h3 className="text-sm font-bold text-[#120E24]">Authorized Company Channels</h3>
              <p className="text-xs text-[#585172]">Mailboxes active in the unified team workspace and saved in MongoDB Atlas</p>
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
                    <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">
                      ● {mb.connectionStatus}
                    </span>
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

      {/* TAB 5: Live Test Send & Diagnostics */}
      {activeTab === 'test' && (
        <div className="bg-white border border-[#E7E0FB] rounded-2xl p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-sm font-bold text-[#120E24]">Live Email Delivery Diagnostic</h3>
            <p className="text-xs text-[#585172]">
              Send a real email immediately through your configured engine to verify that messages land in the recipient's inbox.
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
                placeholder="lakshay@codrix.co.in"
              />
            </div>

            <button
              type="submit"
              disabled={sendResult.type === 'loading'}
              className="px-5 py-2.5 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl text-xs font-bold shadow-md shadow-[#7C2CF5]/25 transition flex items-center gap-2"
            >
              {sendResult.type === 'loading' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>Send Live Test Verification Email</span>
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

          {/* Interactive Google App Password Resolver Alert */}
          {sendResult.type === 'error' && (sendResult.message?.includes('535') || sendResult.message?.includes('BadCredentials') || sendResult.message?.includes('Username and Password') || sendResult.message?.includes('Google')) && (
            <div className="p-4 bg-[#EDE4FF] border border-[#DDD0FE] rounded-2xl text-xs space-y-2 max-w-lg">
              <div className="flex items-center gap-2 font-bold text-[#120E24]">
                <Key className="w-4 h-4 text-[#7C2CF5]" />
                <span>How to Fix "535-5.7.8 Username and Password not accepted" (Google Workspace / Gmail):</span>
              </div>
              <p className="text-[#585172] text-[11px] leading-relaxed">
                Google blocks personal account passwords for third-party SMTP. You must generate a dedicated <strong>16-character Google App Password</strong>:
              </p>
              <ol className="list-decimal list-inside text-[11px] text-[#585172] space-y-1">
                <li>Make sure <strong>2-Step Verification</strong> is enabled on your Google account.</li>
                <li>
                  Go directly to <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-[#7C2CF5] font-bold underline inline-flex items-center gap-0.5">Google App Passwords <ExternalLink className="w-3 h-3" /></a>.
                </li>
                <li>Type App Name: <strong>CodRix</strong> and click <strong>Create</strong>.</li>
                <li>Copy the generated 16-letter password (e.g. <code>abcd efgh ijkl mnop</code>).</li>
                <li>
                  Click{' '}
                  <button
                    type="button"
                    onClick={() => setActiveTab('smtp')}
                    className="text-[#7C2CF5] font-bold underline hover:text-[#6D25D9]"
                  >
                    Tab 2: SMTP & IMAP Credentials
                  </button>
                  , paste it into <strong>Password or App Password</strong>, and click <strong>Save Outbound SMTP & Sync Channel</strong>!
                </li>
              </ol>
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
