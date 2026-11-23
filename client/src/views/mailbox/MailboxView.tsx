import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { apiRequest } from '../../api/client.js';
import { getSocket } from '../../core/socket.js';
import { MailboxConnection, EmailThread } from '../../types.js';
import {
  Mail,
  Inbox,
  Send,
  FileText,
  Star,
  Clock,
  Trash2,
  Archive,
  AlertOctagon,
  RefreshCw,
  Search,
  CheckSquare,
  Square,
  MinusSquare,
  CheckCircle2,
  AlertCircle,
  Tag,
  Paperclip,
  MoreVertical,
  CornerUpLeft,
  CornerUpRight,
  Maximize2,
  Minimize2,
  X,
  Plus,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Users,
  Info,
  Layers,
  Sparkles,
  Lock,
  Download,
  Eye,
  Edit3,
  MessageSquare,
  FolderInput,
  MailCheck,
  MailQuestion
} from 'lucide-react';

export const MailboxView: React.FC = () => {
  const { isLakshay } = useAuth();

  // Core Mailbox & Thread State
  const [mailboxes, setMailboxes] = useState<MailboxConnection[]>([]);
  const [activeMailboxId, setActiveMailboxId] = useState<string>('');
  const [activeFolder, setActiveFolder] = useState<string>('INBOX');
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'PRIMARY' | 'PROMOTIONS' | 'SOCIAL' | 'UPDATES'>('ALL');
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [activeThreadDetail, setActiveThreadDetail] = useState<EmailThread | null>(null);
  const [loadingThreads, setLoadingThreads] = useState<boolean>(true);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterUnreadOnly, setFilterUnreadOnly] = useState<boolean>(false);
  const [filterStarredOnly, setFilterStarredOnly] = useState<boolean>(false);
  const [filterAttachmentsOnly, setFilterAttachmentsOnly] = useState<boolean>(false);

  // Selection & Batch Actions
  const [selectedThreadIds, setSelectedThreadIds] = useState<string[]>([]);

  // Folder & Category Counts
  const [folderCounts, setFolderCounts] = useState<Record<string, { total: number; unread: number }>>({});
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);

  // Reply & Note in Reading Pane
  const [replyOpen, setReplyOpen] = useState<boolean>(false);
  const [replyBody, setReplyBody] = useState<string>('');
  const [sendingReply, setSendingReply] = useState<boolean>(false);
  const [noteContent, setNoteContent] = useState<string>('');
  const [addingNote, setAddingNote] = useState<boolean>(false);
  const [showSecurityDetails, setShowSecurityDetails] = useState<boolean>(false);

  // Gmail Floating Bottom-Right Compose Modal
  const [composeOpen, setComposeOpen] = useState<boolean>(false);
  const [composeMinimized, setComposeMinimized] = useState<boolean>(false);
  const [composeMaximized, setComposeMaximized] = useState<boolean>(false);
  const [composeTo, setComposeTo] = useState<string>('');
  const [composeCc, setComposeCc] = useState<string>('');
  const [showCc, setShowCc] = useState<boolean>(false);
  const [composeSubject, setComposeSubject] = useState<string>('');
  const [composeBody, setComposeBody] = useState<string>('');
  const [sendingNewMail, setSendingNewMail] = useState<boolean>(false);
  const [composeFeedback, setComposeFeedback] = useState<string | null>(null);

  // 1. Initial Load of Mailboxes
  const loadMailboxes = async () => {
    try {
      const data = await apiRequest<MailboxConnection[]>('/mailboxes');
      setMailboxes(data);
      if (data.length > 0 && !activeMailboxId) {
        setActiveMailboxId(data[0].id);
      }
    } catch (err) {
      console.error('Failed fetching mailboxes:', err);
    }
  };

  // 2. Load Folder Counts
  const loadFolderCounts = async (mbId: string) => {
    if (!mbId) return;
    try {
      const counts = await apiRequest<Record<string, { total: number; unread: number }>>(`/mailboxes/${mbId}/counts`);
      setFolderCounts(counts || {});
    } catch (err) {
      console.error('Failed fetching folder counts:', err);
    }
  };

  // 3. Load Thread List with Filters
  const loadThreads = async (mbId: string, folder: string, category?: string, label?: string | null, search?: string) => {
    if (!mbId) return;
    try {
      setLoadingThreads(true);
      const params = new URLSearchParams();
      params.append('folder', folder);
      // Only apply category filter when viewing INBOX
      if (folder === 'INBOX' && category && category !== 'ALL') params.append('category', category);
      if (label) params.append('label', label);
      if (search && search.trim()) params.append('search', search.trim());

      const data = await apiRequest<EmailThread[]>(`/mailboxes/${mbId}/threads?${params.toString()}`);
      setThreads(data || []);
      setSelectedThreadIds([]);
    } catch (err) {
      console.error('Failed fetching threads:', err);
    } finally {
      setLoadingThreads(false);
    }
  };

  // 4. Load Thread Detail
  const loadThreadDetail = async (threadId: string) => {
    try {
      setLoadingDetail(true);
      const thread = await apiRequest<EmailThread>(`/mailboxes/threads/${threadId}`);
      setActiveThreadDetail(thread);

      // Optimistically update read status locally & in list
      setThreads((prev) =>
        prev.map((t) => (t.id === threadId ? { ...t, unread: false } : t))
      );
      if (activeMailboxId) loadFolderCounts(activeMailboxId);
    } catch (err) {
      console.error('Failed fetching thread details:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    loadMailboxes();
  }, []);

  useEffect(() => {
    if (activeMailboxId) {
      loadThreads(activeMailboxId, activeFolder, activeCategory, selectedLabel, searchQuery);
      loadFolderCounts(activeMailboxId);
    }
  }, [activeMailboxId, activeFolder, activeCategory, selectedLabel]);

  // Handle Thread selection
  const handleSelectThread = (thread: EmailThread) => {
    setSelectedThreadId(thread.id);
    loadThreadDetail(thread.id);
    setReplyOpen(false);
    setReplyBody('');
  };

  // Real-time Socket.IO Sync across all folders & events
  useEffect(() => {
    const socket = getSocket();
    setSocketConnected(socket.connected);

    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);

    const handleSync = (payload?: any) => {
      if (activeMailboxId) {
        loadThreads(activeMailboxId, activeFolder, activeCategory, selectedLabel, searchQuery);
        loadFolderCounts(activeMailboxId);
        if (selectedThreadId && (payload?.threadId === selectedThreadId || payload?.threadIds?.includes(selectedThreadId))) {
          loadThreadDetail(selectedThreadId);
        }
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('email:new', handleSync);
    socket.on('mailbox:new_message', handleSync);
    socket.on('email:thread_updated', handleSync);
    socket.on('mailbox:thread_updated', handleSync);
    socket.on('mailbox:message_sent', handleSync);
    socket.on('mailbox:synced', handleSync);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('email:new', handleSync);
      socket.off('mailbox:new_message', handleSync);
      socket.off('email:thread_updated', handleSync);
      socket.off('mailbox:thread_updated', handleSync);
      socket.off('mailbox:message_sent', handleSync);
      socket.off('mailbox:synced', handleSync);
    };
  }, [activeMailboxId, activeFolder, activeCategory, selectedLabel, searchQuery, selectedThreadId]);

  // Resend Real-Time Sync
  const handleSyncMailbox = async () => {
    if (!activeMailboxId) return;
    setSyncing(true);
    setSyncFeedback(null);
    try {
      const res: any = await apiRequest(`/mailboxes/${activeMailboxId}/sync`, { method: 'POST' });
      setSyncFeedback({
        type: res?.success ? 'success' : 'error',
        message: res?.message || 'Mailbox sync completed.'
      });
      await loadThreads(activeMailboxId, activeFolder, activeCategory, selectedLabel, searchQuery);
      await loadFolderCounts(activeMailboxId);
      setTimeout(() => setSyncFeedback(null), 5000);
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        message: err.message || 'Resend sync failed. Verify API Key in Domain & Settings.'
      });
      setTimeout(() => setSyncFeedback(null), 6000);
    } finally {
      setSyncing(false);
    }
  };

  // Toggle Star Status (Single)
  const handleToggleStar = async (e: React.MouseEvent, threadId: string, currentStarred: boolean) => {
    e.stopPropagation();
    const newStatus = !currentStarred;
    // Optimistic UI update
    setThreads((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, starred: newStatus } : t))
    );
    if (activeThreadDetail && activeThreadDetail.id === threadId) {
      setActiveThreadDetail((prev) => prev ? { ...prev, starred: newStatus } : null);
    }

    try {
      await apiRequest(`/mailboxes/threads/${threadId}/star`, {
        method: 'PATCH',
        body: JSON.stringify({ starred: newStatus })
      });
      if (activeMailboxId) loadFolderCounts(activeMailboxId);
    } catch (err) {
      console.error('Failed toggling star:', err);
    }
  };

  // Toggle Read / Unread Status (Single)
  const handleToggleUnread = async (e: React.MouseEvent, threadId: string, currentUnread: boolean) => {
    e.stopPropagation();
    const newStatus = !currentUnread;
    setThreads((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, unread: newStatus } : t))
    );
    try {
      await apiRequest(`/mailboxes/threads/${threadId}/unread`, {
        method: 'PATCH',
        body: JSON.stringify({ unread: newStatus })
      });
      if (activeMailboxId) loadFolderCounts(activeMailboxId);
    } catch (err) {
      console.error('Failed toggling read state:', err);
    }
  };

  // Move Single Thread to Folder (e.g. TRASH, ARCHIVE, SPAM, INBOX)
  const handleMoveThread = async (e: React.MouseEvent | null, threadId: string, targetFolder: string) => {
    if (e) e.stopPropagation();
    try {
      await apiRequest(`/mailboxes/threads/${threadId}/folder`, {
        method: 'PATCH',
        body: JSON.stringify({ folder: targetFolder })
      });
      if (selectedThreadId === threadId) {
        setSelectedThreadId(null);
        setActiveThreadDetail(null);
      }
      if (activeMailboxId) {
        await loadThreads(activeMailboxId, activeFolder, activeCategory, selectedLabel, searchQuery);
        await loadFolderCounts(activeMailboxId);
      }
    } catch (err: any) {
      alert(err.message || 'Error moving thread');
    }
  };

  // Delete Single Thread
  const handleDeleteThread = async (e: React.MouseEvent | null, threadId: string) => {
    if (e) e.stopPropagation();
    if (!isLakshay) {
      alert('Security Violation: Only Lakshay the founder is authorized to delete email threads.');
      return;
    }
    try {
      await apiRequest(`/mailboxes/threads/${threadId}`, { method: 'DELETE' });
      if (selectedThreadId === threadId) {
        setSelectedThreadId(null);
        setActiveThreadDetail(null);
      }
      if (activeMailboxId) {
        await loadThreads(activeMailboxId, activeFolder, activeCategory, selectedLabel, searchQuery);
        await loadFolderCounts(activeMailboxId);
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting thread');
    }
  };

  // Batch Selection Helpers
  const isAllSelected = threads.length > 0 && selectedThreadIds.length === threads.length;
  const isPartiallySelected = selectedThreadIds.length > 0 && selectedThreadIds.length < threads.length;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedThreadIds([]);
    } else {
      setSelectedThreadIds(threads.map((t) => t.id));
    }
  };

  const handleToggleSelectOne = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedThreadIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Batch Execution
  const handleBatchAction = async (action: 'MARK_READ' | 'MARK_UNREAD' | 'STAR' | 'UNSTAR' | 'MOVE_FOLDER' | 'DELETE', folder?: string) => {
    if (selectedThreadIds.length === 0) return;
    if (action === 'DELETE' && !isLakshay) {
      alert('Security Violation: Only Lakshay the founder is authorized to delete email threads.');
      return;
    }
    try {
      await apiRequest('/mailboxes/threads/batch', {
        method: 'POST',
        body: JSON.stringify({
          threadIds: selectedThreadIds,
          action,
          folder
        })
      });
      setSelectedThreadIds([]);
      if (activeMailboxId) {
        await loadThreads(activeMailboxId, activeFolder, activeCategory, selectedLabel, searchQuery);
        await loadFolderCounts(activeMailboxId);
      }
    } catch (err: any) {
      alert(err.message || 'Batch action failed');
    }
  };

  // Filtered Threads Display
  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      if (filterUnreadOnly && !t.unread) return false;
      if (filterStarredOnly && !t.starred) return false;
      if (filterAttachmentsOnly) {
        const hasAttach = t.messages?.some((m: any) => m.attachments && m.attachments.length > 0);
        if (!hasAttach) return false;
      }
      return true;
    });
  }, [threads, filterUnreadOnly, filterStarredOnly, filterAttachmentsOnly]);

  // Reply Sender
  const handleSendReply = async () => {
    if (!replyBody.trim() || !activeThreadDetail || !activeMailboxId) return;
    setSendingReply(true);
    try {
      const firstMsg = activeThreadDetail.messages[0];
      const isOutbound = firstMsg?.direction === 'OUTBOUND';
      const targetTo = isOutbound
        ? (Array.isArray(firstMsg.recipients) ? firstMsg.recipients[0] : firstMsg.recipients)
        : firstMsg?.sender?.replace(/.*<([^>]+)>.*/, '$1') || firstMsg?.sender || '';

      await apiRequest('/mailboxes/send', {
        method: 'POST',
        body: JSON.stringify({
          mailboxConnectionId: activeMailboxId,
          threadId: activeThreadDetail.id,
          to: targetTo,
          subject: activeThreadDetail.subject.startsWith('Re:') ? activeThreadDetail.subject : `Re: ${activeThreadDetail.subject}`,
          body: replyBody,
          idempotencyKey: `reply_${Date.now()}`
        })
      });
      setReplyBody('');
      setReplyOpen(false);
      await loadThreadDetail(activeThreadDetail.id);
      await loadFolderCounts(activeMailboxId);
    } catch (err: any) {
      alert(err.message || 'Failed sending reply.');
    } finally {
      setSendingReply(false);
    }
  };

  // Internal Note Adder
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim() || !activeThreadDetail) return;
    setAddingNote(true);
    try {
      await apiRequest(`/mailboxes/threads/${activeThreadDetail.id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ content: noteContent })
      });
      setNoteContent('');
      await loadThreadDetail(activeThreadDetail.id);
    } catch (err: any) {
      alert(err.message || 'Failed adding note.');
    } finally {
      setAddingNote(false);
    }
  };

  // Floating Compose Sender
  const handleSendNewMail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMailboxId) return;
    setSendingNewMail(true);
    setComposeFeedback(null);
    try {
      await apiRequest('/mailboxes/send', {
        method: 'POST',
        body: JSON.stringify({
          mailboxConnectionId: activeMailboxId,
          to: composeTo,
          subject: composeSubject || 'No Subject',
          body: composeBody,
          idempotencyKey: `new_${Date.now()}`
        })
      });
      setComposeFeedback('Email dispatched live via Resend HTTPS (Port 443)!');
      setTimeout(() => {
        setComposeOpen(false);
        setComposeTo('');
        setComposeCc('');
        setComposeSubject('');
        setComposeBody('');
        setComposeFeedback(null);
      }, 1000);
      await loadFolderCounts(activeMailboxId);
      if (activeFolder === 'SENT') {
        await loadThreads(activeMailboxId, 'SENT');
      }
    } catch (err: any) {
      alert(err.message || 'Failed sending email.');
    } finally {
      setSendingNewMail(false);
    }
  };

  // Quick Template Injector
  const handleInsertTemplate = (type: 'candidate' | 'interview' | 'proposal') => {
    if (type === 'candidate') {
      setComposeSubject('Application Update — CodRix Career Opportunity');
      setComposeBody(`Dear Candidate,\n\nThank you for reaching out to CodRix Private Limited. We have received your profile and are currently reviewing your qualifications against our engineering benchmarks.\n\nOur talent team will follow up shortly.\n\nWarm regards,\nPeople Operations Team\nCodRix Private Limited\nhttps://codrix.co.in`);
    } else if (type === 'interview') {
      setComposeSubject('Invitation: Technical Architecture Discussion with CodRix Team');
      setComposeBody(`Dear Candidate,\n\nCongratulations on advancing through our initial evaluation! We would like to schedule a 45-minute technical discussion covering system architecture and engineering practices.\n\nPlease share your availability for this week or choose a suitable slot.\n\nBest regards,\nEngineering Leadership\nCodRix Private Limited`);
    } else if (type === 'proposal') {
      setComposeSubject('CodRix Enterprise OS — Solution Overview & Partnership Architecture');
      setComposeBody(`Dear Partner,\n\nFollowing our discussion regarding your enterprise infrastructure requirements, we are pleased to share the tailored specifications for CodRix Multi-Tenant OS.\n\nKey highlights include turnkey SSO, granular RBAC, sub-10ms real-time event streaming, and hybrid deployment.\n\nLooking forward to our alignment call.\n\nSincerely,\nLakshay\nFounder & Strategy\nCodRix Private Limited`);
    }
  };

  const activeMailbox = mailboxes.find((m) => m.id === activeMailboxId);

  // Standard Gmail Folders
  const folderList = [
    { id: 'INBOX', label: 'Inbox', icon: Inbox, badgeKey: 'INBOX' },
    { id: 'STARRED', label: 'Starred', icon: Star, badgeKey: 'STARRED' },
    { id: 'SNOOZED', label: 'Snoozed', icon: Clock, badgeKey: 'SNOOZED' },
    { id: 'SENT', label: 'Sent', icon: Send, badgeKey: 'SENT' },
    { id: 'DRAFTS', label: 'Drafts', icon: FileText, badgeKey: 'DRAFTS' },
    { id: 'ALL', label: 'All Mail', icon: Mail, badgeKey: 'ALL' },
    { id: 'SPAM', label: 'Spam', icon: AlertOctagon, badgeKey: 'SPAM' },
    { id: 'TRASH', label: 'Trash', icon: Trash2, badgeKey: 'TRASH' }
  ];

  // Custom Company Labels
  const labelList = [
    { name: 'Candidates', color: '#7C2CF5' },
    { name: 'Clients', color: '#059669' },
    { name: 'Engineering', color: '#2563EB' },
    { name: 'Security', color: '#E11D48' },
    { name: 'Urgent', color: '#D97706' }
  ];

  return (
    <div className="h-[calc(100vh-120px)] bg-[#FBFBFE] rounded-3xl border border-[#E7E0FB] shadow-xs flex overflow-hidden font-['Plus_Jakarta_Sans',sans-serif] relative select-none">
      {/* ======================================================== */}
      {/* 1. GMAIL LEFT COLLAPSIBLE NAVIGATION SIDEBAR              */}
      {/* ======================================================== */}
      <aside className="w-64 bg-white border-r border-[#E7E0FB] flex flex-col p-4 shrink-0 overflow-y-auto">
        {/* Floating Google-Style "+ Compose" Button in CodRix Signature Gradient */}
        <button
          onClick={() => {
            setComposeOpen(true);
            setComposeMinimized(false);
          }}
          className="w-full py-3.5 px-5 bg-gradient-to-r from-[#7C2CF5] to-[#6D25D9] hover:from-[#6D25D9] hover:to-[#5B1EB7] text-white rounded-2xl text-xs font-extrabold flex items-center gap-3 shadow-lg shadow-[#7C2CF5]/25 hover:shadow-xl hover:shadow-[#7C2CF5]/35 hover:-translate-y-0.5 transition-all mb-4"
        >
          <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
            <Edit3 className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm tracking-wide">Compose</span>
        </button>

        {/* Connected Channel Switcher Dropdown */}
        <div className="mb-4 p-2.5 bg-[#F7F5FE] rounded-2xl border border-[#E7E0FB]">
          <div className="flex items-center justify-between text-[10px] uppercase font-bold text-[#585172] tracking-wider mb-1.5 px-1">
            <span>Mail Account</span>
            <span className="inline-flex items-center gap-1 text-emerald-600 font-extrabold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Resend Active (Port 443)
            </span>
          </div>
          <select
            value={activeMailboxId}
            onChange={(e) => setActiveMailboxId(e.target.value)}
            className="w-full bg-white border border-[#E7E0FB] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#120E24] focus:outline-none focus:border-[#7C2CF5] truncate"
          >
            {mailboxes.map((mb) => (
              <option key={mb.id} value={mb.id}>
                {mb.mailboxAddress} ({mb.displayName || 'Official'})
              </option>
            ))}
          </select>

          {/* Quick Manual Resend Sync Button */}
          <button
            onClick={handleSyncMailbox}
            disabled={syncing}
            className="mt-2 w-full py-1.5 px-2 bg-white hover:bg-[#EDE4FF] border border-[#E7E0FB] text-[#7C2CF5] rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition"
            title="Fetch live messages and status via Resend REST API"
          >
            <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing Resend...' : 'Sync with Resend Engine'}</span>
          </button>
        </div>

        {/* Sync Toast Feedback */}
        {syncFeedback && (
          <div
            className={`p-2.5 rounded-xl text-[11px] font-semibold mb-3 border ${
              syncFeedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <div className="flex items-center gap-1.5">
              {syncFeedback.type === 'success' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              )}
              <span className="truncate">{syncFeedback.message}</span>
            </div>
          </div>
        )}

        {/* Standard Folders Navigation List */}
        <div className="space-y-1 flex-1">
          {folderList.map((folder) => {
            const Icon = folder.icon;
            const isActive = activeFolder === folder.id && !selectedLabel;
            const countObj = folderCounts[folder.badgeKey] || { total: 0, unread: 0 };
            const unreadCount = countObj.unread;
            const totalCount = countObj.total;

            return (
              <button
                key={folder.id}
                onClick={() => {
                  setActiveFolder(folder.id);
                  setActiveCategory('ALL');
                  setSelectedLabel(null);
                  setSelectedThreadId(null);
                  setActiveThreadDetail(null);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? 'bg-[#EDE4FF] text-[#7C2CF5] font-extrabold shadow-2xs'
                    : 'text-[#585172] hover:bg-[#F7F5FE] hover:text-[#120E24]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#7C2CF5]' : 'text-[#585172]'}`} />
                  <span>{folder.label}</span>
                </div>
                <div>
                  {unreadCount > 0 ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#7C2CF5] text-white">
                      {unreadCount}
                    </span>
                  ) : totalCount > 0 ? (
                    <span className="text-[10px] text-[#585172]/60 font-semibold">{totalCount}</span>
                  ) : null}
                </div>
              </button>
            );
          })}

          {/* Labels & Tags Section */}
          <div className="pt-4 mt-3 border-t border-[#E7E0FB]">
            <div className="text-[10px] uppercase font-bold text-[#585172] tracking-wider px-2 mb-2 flex items-center justify-between">
              <span>Categories & Labels</span>
              <Tag className="w-3 h-3 text-[#585172]" />
            </div>
            <div className="space-y-0.5">
              {labelList.map((l) => {
                const isSelected = selectedLabel === l.name;
                return (
                  <button
                    key={l.name}
                    onClick={() => {
                      if (selectedLabel === l.name) {
                        setSelectedLabel(null);
                      } else {
                        setSelectedLabel(l.name);
                        setSelectedThreadId(null);
                        setActiveThreadDetail(null);
                      }
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      isSelected
                        ? 'bg-[#EDE4FF] text-[#7C2CF5] font-extrabold'
                        : 'text-[#585172] hover:bg-[#F7F5FE] hover:text-[#120E24]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color }}></span>
                      <span>{l.name}</span>
                    </div>
                    {isSelected && <span className="text-[10px] text-[#7C2CF5] font-bold">• Active</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Live Socket Connection Badge at Bottom */}
        <div className="pt-3 mt-auto border-t border-[#E7E0FB] flex items-center justify-between text-[11px] text-[#585172]">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`}></span>
            <span className="font-semibold">{socketConnected ? 'Real-time WebSocket' : 'Connecting...'}</span>
          </div>
          <span className="text-[10px] font-bold text-[#7C2CF5]">CodRix OS</span>
        </div>
      </aside>

      {/* ======================================================== */}
      {/* 2. GMAIL MAIN EMAIL VIEW (TOOLBAR + TABS + ROWS / DETAIL) */}
      {/* ======================================================== */}
      <main className="flex-1 flex flex-col bg-white overflow-hidden">
        {/* Gmail Master Top Toolbar */}
        <header className="p-3 border-b border-[#E7E0FB] bg-white flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Left Actions: Checkbox, Refresh, Batch Buttons, Back Button */}
          <div className="flex items-center gap-1.5 w-full md:w-auto">
            {selectedThreadId && (
              <button
                onClick={() => {
                  setSelectedThreadId(null);
                  setActiveThreadDetail(null);
                }}
                className="p-2 hover:bg-[#F7F5FE] text-[#120E24] rounded-xl transition mr-1 flex items-center gap-1 text-xs font-bold"
                title="Back to conversation list"
              >
                <ChevronLeft className="w-4 h-4 text-[#7C2CF5]" />
                <span>Back</span>
              </button>
            )}

            {/* Checkbox (Select All / Deselect) */}
            {!selectedThreadId && (
              <button
                onClick={handleToggleSelectAll}
                className="p-2 hover:bg-[#F7F5FE] text-[#585172] hover:text-[#7C2CF5] rounded-xl transition"
                title={isAllSelected ? 'Deselect all' : 'Select all'}
              >
                {isAllSelected ? (
                  <CheckSquare className="w-4 h-4 text-[#7C2CF5]" />
                ) : isPartiallySelected ? (
                  <MinusSquare className="w-4 h-4 text-[#7C2CF5]" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
              </button>
            )}

            {/* Refresh / Check Mail Button */}
            <button
              onClick={() => {
                if (activeMailboxId) {
                  loadThreads(activeMailboxId, activeFolder, activeCategory, selectedLabel, searchQuery);
                  loadFolderCounts(activeMailboxId);
                }
              }}
              className="p-2 hover:bg-[#F7F5FE] text-[#585172] hover:text-[#7C2CF5] rounded-xl transition"
              title="Refresh messages"
            >
              <RefreshCw className={`w-4 h-4 ${loadingThreads ? 'animate-spin text-[#7C2CF5]' : ''}`} />
            </button>

            {/* Batch Action Buttons (Active when 1 or more rows selected) */}
            {selectedThreadIds.length > 0 && !selectedThreadId && (
              <div className="flex items-center gap-1 pl-2 border-l border-[#E7E0FB] animate-in fade-in">
                <span className="text-xs font-extrabold text-[#7C2CF5] mr-1">
                  {selectedThreadIds.length} selected
                </span>

                <button
                  onClick={() => handleBatchAction('MOVE_FOLDER', 'ARCHIVE')}
                  className="p-2 hover:bg-[#F7F5FE] text-[#585172] hover:text-[#7C2CF5] rounded-xl transition"
                  title="Archive selected"
                >
                  <Archive className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleBatchAction('MOVE_FOLDER', 'SPAM')}
                  className="p-2 hover:bg-amber-50 text-[#585172] hover:text-amber-600 rounded-xl transition"
                  title="Report spam"
                >
                  <AlertOctagon className="w-4 h-4" />
                </button>

                {isLakshay && (
                  <button
                    onClick={() => handleBatchAction('DELETE')}
                    className="p-2 hover:bg-rose-50 text-[#585172] hover:text-rose-600 rounded-xl transition"
                    title="Delete selected (Move to Trash)"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={() => handleBatchAction('MARK_READ')}
                  className="p-2 hover:bg-[#F7F5FE] text-[#585172] hover:text-[#7C2CF5] rounded-xl transition"
                  title="Mark as read"
                >
                  <MailCheck className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleBatchAction('MARK_UNREAD')}
                  className="p-2 hover:bg-[#F7F5FE] text-[#585172] hover:text-[#7C2CF5] rounded-xl transition"
                  title="Mark as unread"
                >
                  <Mail className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleBatchAction('STAR')}
                  className="p-2 hover:bg-amber-50 text-[#585172] hover:text-amber-500 rounded-xl transition"
                  title="Add star"
                >
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                </button>
              </div>
            )}
          </div>

          {/* Center / Search Bar with Google Style */}
          <div className="flex-1 max-w-xl mx-2">
            <div className="relative">
              <Search className="w-4 h-4 text-[#585172] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && activeMailboxId) {
                    loadThreads(activeMailboxId, activeFolder, activeCategory, selectedLabel, searchQuery);
                  }
                }}
                placeholder="Search mail by keyword, sender, or subject..."
                className="w-full pl-9 pr-9 py-2 bg-[#F7F5FE] focus:bg-white border border-[#E7E0FB] focus:border-[#7C2CF5] rounded-2xl text-xs text-[#120E24] focus:outline-none transition shadow-2xs"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    if (activeMailboxId) loadThreads(activeMailboxId, activeFolder, activeCategory, selectedLabel, '');
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#585172] hover:text-[#120E24]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Right Controls: Quick Filter Chips & Pagination */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Quick Unread Toggle */}
            <button
              onClick={() => setFilterUnreadOnly((prev) => !prev)}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition ${
                filterUnreadOnly
                  ? 'bg-[#7C2CF5] text-white border-[#7C2CF5]'
                  : 'bg-white text-[#585172] border-[#E7E0FB] hover:border-[#7C2CF5]'
              }`}
            >
              Unread
            </button>

            {/* Quick Starred Toggle */}
            <button
              onClick={() => setFilterStarredOnly((prev) => !prev)}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border flex items-center gap-1 transition ${
                filterStarredOnly
                  ? 'bg-amber-50 text-amber-700 border-amber-300'
                  : 'bg-white text-[#585172] border-[#E7E0FB] hover:border-amber-400'
              }`}
            >
              <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
              <span>Starred</span>
            </button>

            {/* Pagination count indicator */}
            <div className="text-xs text-[#585172] font-semibold pl-2">
              {filteredThreads.length} {filteredThreads.length === 1 ? 'thread' : 'threads'}
            </div>
          </div>
        </header>

        {/* ======================================================== */}
        {/* GMAIL INBOX CATEGORY TABS (Primary, Updates, Promotions, Social) */}
        {/* ======================================================== */}
        {activeFolder === 'INBOX' && !selectedThreadId && !selectedLabel && (
          <nav className="flex border-b border-[#E7E0FB] bg-white px-2">
            {[
              { id: 'ALL', label: 'All Primary', icon: Inbox, desc: 'Personal & company emails' },
              { id: 'PROMOTIONS', label: 'Promotions', icon: Tag, desc: 'Partner deals & subscriptions' },
              { id: 'SOCIAL', label: 'Social', icon: Users, desc: 'GitHub, mentions & networks' },
              { id: 'UPDATES', label: 'Updates', icon: Info, desc: 'Alerts, billing & system notifications' }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeCategory === tab.id;
              const catCounts = folderCounts[tab.id === 'ALL' ? 'PRIMARY' : tab.id] || { unread: 0, total: 0 };
              const unread = catCounts.unread;

              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveCategory(tab.id as any);
                    if (activeMailboxId) {
                      loadThreads(activeMailboxId, 'INBOX', tab.id);
                    }
                  }}
                  className={`flex items-center gap-2.5 px-6 py-3 text-xs font-bold transition relative border-b-2 ${
                    isActive
                      ? 'border-[#7C2CF5] text-[#7C2CF5] bg-[#F7F5FE]/60'
                      : 'border-transparent text-[#585172] hover:text-[#120E24] hover:bg-[#FBFBFE]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#7C2CF5]' : 'text-[#585172]'}`} />
                  <span>{tab.label}</span>
                  {unread > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-[#7C2CF5] text-white ml-0.5">
                      {unread}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        )}

        {/* ======================================================== */}
        {/* 3. EMAIL THREAD LIST / READING PANE                       */}
        {/* ======================================================== */}
        <div className="flex-1 overflow-y-auto bg-white">
          {/* VIEW A: Conversation Reader Pane */}
          {selectedThreadId && activeThreadDetail ? (
            <div className="p-6 max-w-5xl mx-auto space-y-6">
              {/* Thread Header: Subject + Labels + Action Toolbar */}
              <div className="flex items-start justify-between pb-4 border-b border-[#E7E0FB]">
                <div>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <h2 className="text-xl font-extrabold text-[#120E24] tracking-tight">
                      {activeThreadDetail.subject}
                    </h2>
                    {activeThreadDetail.labels?.map((lbl) => (
                      <span
                        key={lbl}
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#EDE4FF] text-[#7C2CF5]"
                      >
                        {lbl}
                      </span>
                    ))}
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#F7F5FE] text-[#585172] border border-[#E7E0FB]">
                      {activeThreadDetail.folder}
                    </span>
                  </div>
                  <div className="text-xs text-[#585172] flex items-center gap-2">
                    <span>Mailbox: <strong className="text-[#120E24]">{activeMailbox?.mailboxAddress}</strong></span>
                    <span>&bull;</span>
                    <span>{activeThreadDetail.messages.length} {activeThreadDetail.messages.length === 1 ? 'message' : 'messages'}</span>
                  </div>
                </div>

                {/* Single Thread Action Buttons */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => handleToggleStar(e, activeThreadDetail.id, Boolean(activeThreadDetail.starred))}
                    className="p-2 hover:bg-amber-50 rounded-xl transition text-[#585172]"
                    title="Star thread"
                  >
                    <Star
                      className={`w-4 h-4 ${
                        activeThreadDetail.starred
                          ? 'text-amber-500 fill-amber-500'
                          : 'text-[#585172] hover:text-amber-500'
                      }`}
                    />
                  </button>

                  <button
                    onClick={(e) => handleMoveThread(e, activeThreadDetail.id, 'INBOX')}
                    className="p-2 hover:bg-[#F7F5FE] text-[#585172] hover:text-[#7C2CF5] rounded-xl transition"
                    title="Move to Inbox"
                  >
                    <Inbox className="w-4 h-4" />
                  </button>

                  <button
                    onClick={(e) => handleMoveThread(e, activeThreadDetail.id, 'ARCHIVE')}
                    className="p-2 hover:bg-[#F7F5FE] text-[#585172] hover:text-[#7C2CF5] rounded-xl transition"
                    title="Archive"
                  >
                    <Archive className="w-4 h-4" />
                  </button>

                  <button
                    onClick={(e) => handleMoveThread(e, activeThreadDetail.id, 'SPAM')}
                    className="p-2 hover:bg-amber-50 text-[#585172] hover:text-amber-600 rounded-xl transition"
                    title="Mark as Spam"
                  >
                    <AlertOctagon className="w-4 h-4" />
                  </button>

                  {isLakshay && (
                    <button
                      onClick={(e) => handleDeleteThread(e, activeThreadDetail.id)}
                      className="p-2 hover:bg-rose-50 text-[#585172] hover:text-rose-600 rounded-xl transition"
                      title="Delete (Move to Trash)"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Messages Flow in Thread */}
              <div className="space-y-4">
                {activeThreadDetail.messages.map((msg, index) => {
                  const isOutbound = msg.direction === 'OUTBOUND';
                  const senderInitial = (msg.sender?.[0] || 'U').toUpperCase();

                  return (
                    <article
                      key={msg.id || index}
                      className={`rounded-2xl border p-5 transition ${
                        isOutbound
                          ? 'bg-[#F7F5FE] border-[#DDD0FE] shadow-2xs ml-6'
                          : 'bg-white border-[#E7E0FB] shadow-xs mr-6'
                      }`}
                    >
                      {/* Sender Info Line with Avatar, Address & TLS Security Pill */}
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-2xl flex items-center justify-center font-extrabold text-sm shadow-xs ${
                              isOutbound
                                ? 'bg-gradient-to-br from-[#7C2CF5] to-[#6D25D9] text-white'
                                : 'bg-gradient-to-br from-[#EDE4FF] to-[#DDD0FE] text-[#7C2CF5]'
                            }`}
                          >
                            {senderInitial}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-sm text-[#120E24]">
                                {msg.sender}
                              </span>
                              <span
                                className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                                  isOutbound
                                    ? 'bg-[#EDE4FF] text-[#7C2CF5]'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                {isOutbound ? 'Outbound Dispatch' : 'Inbound Recipient'}
                              </span>
                            </div>
                            <div className="text-[11px] text-[#585172] flex items-center gap-1.5 mt-0.5">
                              <span>
                                {isOutbound
                                  ? `to ${Array.isArray(msg.recipients) ? msg.recipients.join(', ') : msg.recipients || 'recipient'}`
                                  : `to ${activeMailbox?.mailboxAddress || 'me'}`}
                              </span>
                              <button
                                onClick={() => setShowSecurityDetails((prev) => !prev)}
                                className="text-[#7C2CF5] hover:underline flex items-center gap-0.5"
                              >
                                <span>details</span>
                                {showSecurityDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[11px] text-[#585172] font-semibold block">
                            {new Date(msg.sentAt).toLocaleString([], {
                              dateStyle: 'medium',
                              timeStyle: 'short'
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Expandable Google-style Security & Encryption Card */}
                      {showSecurityDetails && (
                        <div className="p-3 bg-white rounded-xl border border-[#E7E0FB] text-[11px] text-[#585172] space-y-1 mb-3 animate-in fade-in">
                          <div><strong>From:</strong> {msg.sender}</div>
                          <div><strong>To:</strong> {Array.isArray(msg.recipients) ? msg.recipients.join(', ') : msg.recipients || activeMailbox?.mailboxAddress}</div>
                          <div><strong>Date:</strong> {new Date(msg.sentAt).toUTCString()}</div>
                          <div><strong>Subject:</strong> {msg.subject}</div>
                          <div className="flex items-center gap-1 text-emerald-700 font-semibold pt-1">
                            <Lock className="w-3 h-3 text-emerald-600" />
                            <span>Security: Standard encryption (TLS 1.3 verified)</span>
                          </div>
                        </div>
                      )}

                      {/* Message Content Body */}
                      <div className="text-xs text-[#120E24] leading-relaxed whitespace-pre-line pl-12 pt-1 font-medium">
                        {msg.body}
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Private Collaborative Team Notes Section */}
              {activeThreadDetail.notes && activeThreadDetail.notes.length > 0 && (
                <div className="p-4 bg-amber-50/80 rounded-2xl border border-amber-200 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                    <MessageSquare className="w-4 h-4 text-amber-700" />
                    <span>Internal Team Notes (Private to CodRix Members)</span>
                  </div>
                  {activeThreadDetail.notes.map((note) => (
                    <div
                      key={note.id}
                      className="text-xs text-amber-950 border-l-2 border-amber-500 pl-3 py-1 bg-white/70 rounded-r-lg"
                    >
                      <div className="flex items-center justify-between text-[10px] text-amber-800 font-bold mb-0.5">
                        <span>{note.authorId}</span>
                        <span>{new Date(note.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <p>{note.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Note Form */}
              <form onSubmit={handleAddNote} className="flex gap-2">
                <input
                  type="text"
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Leave an internal note for teammates (collaborative & private)..."
                  className="flex-1 bg-[#F7F5FE] border border-[#E7E0FB] rounded-xl px-3.5 py-2 text-xs text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                />
                <button
                  type="submit"
                  disabled={!noteContent.trim() || addingNote}
                  className="px-4 py-2 bg-[#F0ECFC] hover:bg-[#EDE4FF] text-[#7C2CF5] rounded-xl text-xs font-bold transition disabled:opacity-50"
                >
                  {addingNote ? 'Saving...' : 'Add Note'}
                </button>
              </form>

              {/* Quick Reply & Action Buttons */}
              {!replyOpen ? (
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => setReplyOpen(true)}
                    className="px-5 py-2.5 bg-gradient-to-r from-[#7C2CF5] to-[#6D25D9] hover:from-[#6D25D9] hover:to-[#5B1EB7] text-white rounded-xl text-xs font-bold shadow-md shadow-[#7C2CF5]/25 flex items-center gap-2 transition"
                  >
                    <CornerUpLeft className="w-4 h-4" />
                    <span>Reply</span>
                  </button>
                  <button
                    onClick={() => setReplyOpen(true)}
                    className="px-4 py-2.5 bg-[#F7F5FE] hover:bg-[#EDE4FF] text-[#120E24] rounded-xl text-xs font-bold border border-[#E7E0FB] flex items-center gap-2 transition"
                  >
                    <CornerUpRight className="w-4 h-4 text-[#585172]" />
                    <span>Forward</span>
                  </button>
                </div>
              ) : (
                /* Google Gmail Inline Reply Box */
                <div className="p-4 bg-[#F7F5FE] rounded-2xl border border-[#DDD0FE] shadow-sm space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs text-[#585172]">
                    <div className="flex items-center gap-2">
                      <CornerUpLeft className="w-4 h-4 text-[#7C2CF5]" />
                      <span>
                        Replying as <strong>{activeMailbox?.mailboxAddress}</strong> to{' '}
                        <strong>
                          {activeThreadDetail.messages[0]?.direction === 'OUTBOUND'
                            ? (Array.isArray(activeThreadDetail.messages[0]?.recipients)
                                ? activeThreadDetail.messages[0].recipients.join(', ')
                                : activeThreadDetail.messages[0]?.recipients || 'Recipient')
                            : (activeThreadDetail.messages[0]?.sender || 'Participant')}
                        </strong>
                      </span>
                    </div>
                    <button
                      onClick={() => setReplyOpen(false)}
                      className="text-[#585172] hover:text-[#120E24]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <textarea
                    rows={5}
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="Write your reply here..."
                    className="w-full bg-white border border-[#E7E0FB] focus:border-[#7C2CF5] rounded-xl p-3 text-xs text-[#120E24] focus:outline-none leading-relaxed"
                  />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => handleInsertTemplate('proposal')}
                        className="px-2 py-1 bg-white hover:bg-[#EDE4FF] border border-[#E7E0FB] text-[#7C2CF5] rounded-lg text-[10px] font-bold"
                      >
                        Insert Solution Proposal
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertTemplate('interview')}
                        className="px-2 py-1 bg-white hover:bg-[#EDE4FF] border border-[#E7E0FB] text-[#7C2CF5] rounded-lg text-[10px] font-bold"
                      >
                        Insert Interview Slot
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setReplyOpen(false)}
                        className="px-3 py-1.5 text-xs text-[#585172] hover:text-[#120E24] font-semibold"
                      >
                        Discard
                      </button>
                      <button
                        onClick={handleSendReply}
                        disabled={!replyBody.trim() || sendingReply}
                        className="px-5 py-2 bg-gradient-to-r from-[#7C2CF5] to-[#6D25D9] text-white rounded-xl text-xs font-bold shadow-md shadow-[#7C2CF5]/25 flex items-center gap-1.5 transition disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{sendingReply ? 'Sending...' : 'Send Reply'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* VIEW B: Gmail Interactive Row List */
            <div className="divide-y divide-[#E7E0FB]/70">
              {filteredThreads.length === 0 ? (
                <div className="p-16 text-center text-xs text-[#585172]">
                  <Mail className="w-12 h-12 text-[#DDD0FE] mx-auto mb-3" />
                  <p className="font-bold text-[#120E24] text-sm">No messages in {activeFolder}</p>
                  <p className="text-xs text-[#585172] mt-1 max-w-sm mx-auto">
                    Your company inbox is synchronized. Click <strong>"Sync with Resend Engine"</strong> to refresh real-time mailbox messages.
                  </p>
                </div>
              ) : (
                filteredThreads.map((thread) => {
                  const isSelected = selectedThreadIds.includes(thread.id);
                  const isUnread = Boolean(thread.unread);
                  const isStarred = Boolean(thread.starred);
                  const isOutboundFolder = activeFolder === 'SENT' || activeFolder === 'DRAFTS';
                  const firstMsg = thread.messages?.[0];
                  let cleanSender = '';
                  if (isOutboundFolder) {
                    const recips = firstMsg?.recipients;
                    const toStr = Array.isArray(recips) ? recips.join(', ') : recips || '';
                    cleanSender = toStr ? `To: ${toStr.replace(/<.*?>/, '').trim()}` : 'To: (Draft)';
                  } else {
                    const senderDisplay = firstMsg?.sender || 'Official Sender';
                    cleanSender = senderDisplay.replace(/<.*?>/, '').trim() || senderDisplay;
                  }

                  return (
                    <div
                      key={thread.id}
                      onClick={() => handleSelectThread(thread)}
                      className={`group flex items-center px-4 py-3 cursor-pointer transition select-none relative ${
                        isUnread ? 'bg-white font-extrabold text-[#120E24]' : 'bg-[#FBFBFE]/70 text-[#585172]'
                      } ${isSelected ? 'bg-[#EDE4FF]/50' : 'hover:bg-[#F7F5FE] hover:shadow-2xs'}`}
                    >
                      {/* Left: Checkbox + Star */}
                      <div className="flex items-center gap-2.5 mr-3 shrink-0">
                        {/* Row Selection Checkbox */}
                        <button
                          type="button"
                          onClick={(e) => handleToggleSelectOne(e, thread.id)}
                          className="text-[#585172] hover:text-[#7C2CF5] p-0.5 rounded transition"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-[#7C2CF5]" />
                          ) : (
                            <Square className="w-4 h-4 text-[#585172]/50 group-hover:text-[#585172]" />
                          )}
                        </button>

                        {/* Interactive Star Icon */}
                        <button
                          type="button"
                          onClick={(e) => handleToggleStar(e, thread.id, isStarred)}
                          className="p-0.5 rounded transition"
                          title={isStarred ? 'Starred' : 'Not starred'}
                        >
                          <Star
                            className={`w-4 h-4 ${
                              isStarred
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-[#585172]/40 group-hover:text-amber-400'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Sender Name Column */}
                      <div className="w-48 truncate text-xs mr-4 shrink-0">
                        <span className={isUnread ? 'font-extrabold text-[#120E24]' : 'font-medium text-[#120E24]'}>
                          {cleanSender}
                        </span>
                      </div>

                      {/* Subject + Snippet Inline (Exact Gmail Style) */}
                      <div className="flex-1 min-w-0 flex items-center gap-2 text-xs truncate mr-4">
                        <span className={`truncate ${isUnread ? 'font-bold text-[#120E24]' : 'text-[#120E24]'}`}>
                          {thread.subject}
                        </span>
                        <span className="text-[#585172]/80 truncate font-normal">
                          &ndash; {thread.snippet || 'No message preview'}
                        </span>

                        {/* Label Badges */}
                        {thread.labels && thread.labels.length > 0 && (
                          <div className="flex items-center gap-1 shrink-0 ml-1">
                            {thread.labels.map((lbl) => (
                              <span
                                key={lbl}
                                className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#EDE4FF] text-[#7C2CF5]"
                              >
                                {lbl}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Right: Date OR Gmail Hover Action Buttons */}
                      <div className="shrink-0 flex items-center justify-end min-w-[110px] text-right">
                        {/* Default: Timestamp */}
                        <span className="text-[11px] text-[#585172] font-semibold group-hover:hidden">
                          {new Date(thread.lastMessageAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>

                        {/* Hover Actions (Exact Gmail Hover Toolbar) */}
                        <div className="hidden group-hover:flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => handleMoveThread(e, thread.id, 'ARCHIVE')}
                            className="p-1.5 hover:bg-white text-[#585172] hover:text-[#7C2CF5] rounded-lg transition"
                            title="Archive"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>

                          {isLakshay && (
                            <button
                              type="button"
                              onClick={(e) => handleDeleteThread(e, thread.id)}
                              className="p-1.5 hover:bg-white text-[#585172] hover:text-rose-600 rounded-lg transition"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => handleToggleUnread(e, thread.id, isUnread)}
                            className="p-1.5 hover:bg-white text-[#585172] hover:text-[#7C2CF5] rounded-lg transition"
                            title={isUnread ? 'Mark as read' : 'Mark as unread'}
                          >
                            {isUnread ? <MailCheck className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleMoveThread(e, thread.id, 'SNOOZED')}
                            className="p-1.5 hover:bg-white text-[#585172] hover:text-amber-600 rounded-lg transition"
                            title="Snooze"
                          >
                            <Clock className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </main>

      {/* ======================================================== */}
      {/* 4. GOOGLE GMAIL FLOATING BOTTOM-RIGHT COMPOSE WINDOW     */}
      {/* ======================================================== */}
      {composeOpen && (
        <div
          className={`fixed bottom-0 right-8 z-50 transition-all duration-200 bg-white shadow-2xl rounded-t-2xl border border-[#E7E0FB] overflow-hidden flex flex-col ${
            composeMinimized
              ? 'w-72 h-12'
              : composeMaximized
              ? 'inset-8 rounded-2xl w-auto h-auto'
              : 'w-[580px] h-[520px]'
          }`}
        >
          {/* Compose Header Bar */}
          <div className="bg-[#120E24] text-white px-4 py-2.5 flex items-center justify-between cursor-pointer select-none">
            <div
              className="flex items-center gap-2 font-bold text-xs"
              onClick={() => setComposeMinimized((prev) => !prev)}
            >
              <Edit3 className="w-3.5 h-3.5 text-[#7C2CF5]" />
              <span>New Message &bull; {activeMailbox?.mailboxAddress}</span>
            </div>

            {/* Window Controls: Minimize, Maximize, Close */}
            <div className="flex items-center gap-1.5 text-white/70">
              <button
                type="button"
                onClick={() => setComposeMinimized((prev) => !prev)}
                className="hover:text-white p-1 rounded"
                title="Minimize"
              >
                <Minimize2 className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setComposeMaximized((prev) => !prev);
                  setComposeMinimized(false);
                }}
                className="hover:text-white p-1 rounded"
                title="Maximize / Restore"
              >
                <Maximize2 className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setComposeOpen(false)}
                className="hover:text-white p-1 rounded"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Compose Form Body (Visible when not minimized) */}
          {!composeMinimized && (
            <form onSubmit={handleSendNewMail} className="flex-1 flex flex-col bg-white overflow-hidden text-xs">
              {/* From Selector Line */}
              <div className="px-4 py-2 border-b border-[#E7E0FB] flex items-center justify-between text-[#585172]">
                <div className="flex items-center gap-2 w-full">
                  <span className="font-semibold text-[#120E24]">From:</span>
                  <select
                    value={activeMailboxId}
                    onChange={(e) => setActiveMailboxId(e.target.value)}
                    className="flex-1 bg-transparent font-bold text-[#7C2CF5] focus:outline-none"
                  >
                    {mailboxes.map((mb) => (
                      <option key={mb.id} value={mb.id}>
                        {mb.mailboxAddress} ({mb.displayName || 'Official'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* To Line with Cc Toggle */}
              <div className="px-4 py-2 border-b border-[#E7E0FB] flex items-center gap-2 text-[#585172]">
                <span className="font-semibold text-[#120E24]">To:</span>
                <input
                  type="email"
                  required
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="Recipients (e.g. client@domain.com, applicant@gmail.com)"
                  className="flex-1 bg-transparent text-[#120E24] focus:outline-none"
                />
                {!showCc && (
                  <button
                    type="button"
                    onClick={() => setShowCc(true)}
                    className="text-[#7C2CF5] hover:underline text-[11px] font-bold"
                  >
                    Cc / Bcc
                  </button>
                )}
              </div>

              {/* Optional Cc Line */}
              {showCc && (
                <div className="px-4 py-2 border-b border-[#E7E0FB] flex items-center gap-2 text-[#585172]">
                  <span className="font-semibold text-[#120E24]">Cc:</span>
                  <input
                    type="text"
                    value={composeCc}
                    onChange={(e) => setComposeCc(e.target.value)}
                    placeholder="Carbon copy recipients..."
                    className="flex-1 bg-transparent text-[#120E24] focus:outline-none"
                  />
                </div>
              )}

              {/* Subject Line */}
              <div className="px-4 py-2 border-b border-[#E7E0FB] flex items-center gap-2">
                <input
                  type="text"
                  required
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Subject"
                  className="w-full bg-transparent font-bold text-[#120E24] focus:outline-none"
                />
              </div>

              {/* Message Body Editor */}
              <div className="flex-1 p-4 overflow-y-auto">
                <textarea
                  required
                  rows={composeMaximized ? 20 : 12}
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Compose your email here..."
                  className="w-full h-full bg-transparent resize-none text-xs text-[#120E24] focus:outline-none leading-relaxed"
                />
              </div>

              {/* Success Feedback Toast */}
              {composeFeedback && (
                <div className="mx-4 mb-2 p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{composeFeedback}</span>
                </div>
              )}

              {/* Bottom Gmail Action Toolbar: Send Button + Templates + Trash */}
              <div className="px-4 py-3 border-t border-[#E7E0FB] bg-[#FBFBFE] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* Purple Send Pill Button */}
                  <button
                    type="submit"
                    disabled={sendingNewMail}
                    className="px-6 py-2.5 bg-gradient-to-r from-[#7C2CF5] to-[#6D25D9] hover:from-[#6D25D9] hover:to-[#5B1EB7] text-white rounded-xl text-xs font-extrabold shadow-md shadow-[#7C2CF5]/25 flex items-center gap-2 transition disabled:opacity-50"
                  >
                    <Send className={`w-3.5 h-3.5 ${sendingNewMail ? 'animate-spin' : ''}`} />
                    <span>{sendingNewMail ? 'Sending...' : 'Send'}</span>
                  </button>

                  {/* Insert Template Dropdown Buttons */}
                  <div className="hidden sm:flex items-center gap-1.5 pl-2 border-l border-[#E7E0FB]">
                    <button
                      type="button"
                      onClick={() => handleInsertTemplate('candidate')}
                      className="px-2 py-1 bg-white hover:bg-[#EDE4FF] border border-[#E7E0FB] text-[#7C2CF5] rounded-lg text-[10px] font-bold"
                    >
                      + Candidate Template
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertTemplate('interview')}
                      className="px-2 py-1 bg-white hover:bg-[#EDE4FF] border border-[#E7E0FB] text-[#7C2CF5] rounded-lg text-[10px] font-bold"
                    >
                      + Interview Invite
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertTemplate('proposal')}
                      className="px-2 py-1 bg-white hover:bg-[#EDE4FF] border border-[#E7E0FB] text-[#7C2CF5] rounded-lg text-[10px] font-bold"
                    >
                      + Enterprise Proposal
                    </button>
                  </div>
                </div>

                {/* Discard Draft Button */}
                <button
                  type="button"
                  onClick={() => {
                    setComposeOpen(false);
                    setComposeTo('');
                    setComposeCc('');
                    setComposeSubject('');
                    setComposeBody('');
                  }}
                  className="p-2 text-[#585172] hover:text-rose-600 rounded-xl transition"
                  title="Discard draft"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
