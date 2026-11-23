import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { apiRequest } from '../../api/client.js';
import { getSocket, onSocketStatusChange } from '../../core/socket.js';
import {
  LayoutDashboard,
  Briefcase,
  Mail,
  Target,
  Code2,
  CalendarCheck,
  ShieldCheck,
  LogOut,
  ChevronDown,
  Building2,
  Settings,
  CheckCircle2,
  AlertCircle,
  X,
  MessageSquare,
  FolderPlus,
  FolderKanban,
  MailCheck
} from 'lucide-react';

interface AppShellProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ currentTab, onSelectTab, children }) => {
  const { session, logout, quickSwitchRole, hasRole, isCoreTeam, isLakshay, canAccessEmailTemplates } = useAuth();
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false);
  const [team, setTeam] = useState<any[]>([]);
  const [socketOnline, setSocketOnline] = useState(false);
  const [latency, setLatency] = useState(0);

  // Mandatory Pre-Logout Daily Update State
  const [preLogoutModalOpen, setPreLogoutModalOpen] = useState(false);
  const [logoutProjects, setLogoutProjects] = useState<any[]>([]);
  const [logoutSelectedProjectId, setLogoutSelectedProjectId] = useState<string>('');
  const [logoutCompleted, setLogoutCompleted] = useState<string>('');
  const [logoutInProgress, setLogoutInProgress] = useState<string>('');
  const [logoutBlockers, setLogoutBlockers] = useState<string>('');
  const [logoutNextDay, setLogoutNextDay] = useState<string>('');
  const [logoutSubmitting, setLogoutSubmitting] = useState(false);

  useEffect(() => {
    getSocket();
    const unsubscribe = onSocketStatusChange((connected, lat) => {
      setSocketOnline(connected);
      setLatency(lat);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    apiRequest<any[]>('/auth/team')
      .then((data) => setTeam(data))
      .catch(() => {});
  }, []);

  const primaryRole = session?.roles[0] || 'EMPLOYEE';
  const isSalesOnly = ['BDE', 'BDM'].includes(primaryRole) && !hasRole('COMPANY_ADMIN');

  useEffect(() => {
    if (isSalesOnly && currentTab === 'dashboard') {
      onSelectTab('crm');
    }
    if (!isCoreTeam && currentTab === 'mailbox') {
      onSelectTab(isSalesOnly ? 'crm' : 'dashboard');
    }
    if (!canAccessEmailTemplates && currentTab === 'email-templates') {
      onSelectTab(isSalesOnly ? 'crm' : 'dashboard');
    }
  }, [isSalesOnly, isCoreTeam, canAccessEmailTemplates, currentTab, onSelectTab]);

  const navItems = [
    { id: 'dashboard', label: 'Command Center', icon: LayoutDashboard, visible: !isSalesOnly },
    { id: 'recruitment', label: 'Recruitment (ATS)', icon: Briefcase, visible: hasRole('COMPANY_ADMIN', 'HR_MANAGER', 'HR_EXEC') },
    { id: 'crm', label: 'Record Management (CRM)', icon: Target, visible: hasRole('COMPANY_ADMIN', 'GROWTH_OFFICER', 'BDM', 'BDE', 'OPS_MANAGER') },
    { id: 'mailbox', label: 'Mailbox Workspace', icon: Mail, visible: isCoreTeam },
    { id: 'projects', label: 'Projects', icon: FolderKanban, visible: isCoreTeam || isLakshay },
    { id: 'engineering', label: 'Engineering & Sprints', icon: Code2, visible: hasRole('COMPANY_ADMIN', 'ENGINEERING_LEAD', 'SDE2', 'SDE1', 'INTERN') },
    { id: 'hrms', label: 'HRMS & Attendance', icon: CalendarCheck, visible: !isSalesOnly || hasRole('COMPANY_ADMIN') },
    { id: 'email-templates', label: 'Email Templates', icon: MailCheck, visible: canAccessEmailTemplates },
    { id: 'audit', label: 'Audit & Governance', icon: ShieldCheck, visible: hasRole('COMPANY_ADMIN', 'SUPER_ADMIN', 'BRANCH_MANAGER') },
    { id: 'settings', label: 'Domain & Settings', icon: Settings, visible: hasRole('COMPANY_ADMIN', 'SUPER_ADMIN') }
  ];

  const handleLogoutClick = async () => {
    if (isLakshay) {
      if (window.confirm('Founder Session: Confirm log out from CodRix Enterprise OS?')) {
        logout();
      }
      return;
    }

    try {
      const res = await apiRequest<{ submitted: boolean; update: any }>('/engineering/daily-updates/today');
      if (res && res.submitted) {
        if (window.confirm("Today's daily project update has been recorded. Proceed to log out?")) {
          logout();
        }
      } else {
        const projs = await apiRequest<any[]>('/engineering/projects');
        setLogoutProjects(projs || []);
        if (projs && projs.length > 0) {
          setLogoutSelectedProjectId(projs[0].id || projs[0]._id);
        }
        setPreLogoutModalOpen(true);
      }
    } catch {
      try {
        const projs = await apiRequest<any[]>('/engineering/projects');
        setLogoutProjects(projs || []);
        if (projs && projs.length > 0) {
          setLogoutSelectedProjectId(projs[0].id || projs[0]._id);
        }
      } catch {}
      setPreLogoutModalOpen(true);
    }
  };

  const handlePreLogoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logoutCompleted.trim() || !logoutInProgress.trim()) {
      alert('Please summarize what you completed today and what is currently in progress.');
      return;
    }
    setLogoutSubmitting(true);
    try {
      const selectedProj = logoutProjects.find((p) => (p.id || p._id) === logoutSelectedProjectId);
      await apiRequest('/engineering/daily-updates', {
        method: 'POST',
        body: JSON.stringify({
          projectId: logoutSelectedProjectId,
          projectName: selectedProj?.name || 'General Project Work',
          completedItems: logoutCompleted,
          inProgressItems: logoutInProgress,
          blockers: logoutBlockers || 'None',
          nextDayPlan: logoutNextDay || 'Continue active milestones'
        })
      });
      alert('Daily project update submitted successfully! Logging out...');
      setPreLogoutModalOpen(false);
      logout();
    } catch (err: any) {
      alert(err.message || 'Error submitting daily update.');
    } finally {
      setLogoutSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#FBFBFE] text-[#120E24] overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Light Mode Sidebar Navigation matching codrix.co.in */}
      <aside className="w-64 bg-[#F7F5FE] text-[#120E24] flex flex-col border-r border-[#E7E0FB] shadow-sm">
        {/* Brand Header with Official Logo */}
        <div className="h-18 flex items-center px-5 gap-3 border-b border-[#E7E0FB] bg-white">
          <img
            src="/logo-icon.png"
            alt="CodRix Logo"
            className="w-9 h-9 object-contain drop-shadow-xs rounded-xl"
          />
          <div>
            <div className="font-bold text-[#120E24] tracking-tight text-base flex items-center gap-1.5">
              <span>CodRix</span>
              <span className="w-2 h-2 rounded-full bg-[#7C2CF5]"></span>
            </div>
            <div className="text-[10px] text-[#585172] font-semibold tracking-wider uppercase">
              Enterprise OS
            </div>
          </div>
        </div>

        {/* Tenant Indicator */}
        <div className="px-4 py-3 bg-[#F0ECFC] border-b border-[#E7E0FB] flex items-center gap-2 text-xs">
          <Building2 className="w-4 h-4 text-[#7C2CF5]" />
          <span className="font-bold text-[#120E24] truncate">{session?.activeTenant.name}</span>
          <span className="ml-auto px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300">
            ACTIVE
          </span>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {navItems.filter((i) => i.visible).map((item) => {
            const Icon = item.icon;
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  active
                    ? 'bg-[#7C2CF5] text-white shadow-md shadow-[#7C2CF5]/25'
                    : 'text-[#585172] hover:bg-[#F0ECFC] hover:text-[#120E24]'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-[#7C2CF5]'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Card with Hover-Activated Dropdown */}
        <div
          className="p-4 border-t border-[#E7E0FB] bg-white flex items-center gap-3 relative group"
          onMouseEnter={() => isLakshay && setRoleSwitcherOpen(true)}
          onMouseLeave={() => isLakshay && setRoleSwitcherOpen(false)}
        >
          <div className="w-9 h-9 rounded-xl bg-[#F0ECFC] border border-[#DDD0FE] flex items-center justify-center font-bold text-[#7C2CF5]">
            {session?.user.fullName[0]}
          </div>
          <div
            className={`flex-1 min-w-0 ${isLakshay ? 'cursor-pointer group' : ''}`}
            onClick={() => isLakshay && setRoleSwitcherOpen(!roleSwitcherOpen)}
            title={isLakshay ? 'Switch Team Profile (Founder Override)' : session?.user.fullName}
          >
            <div className="flex items-center gap-1">
              <p className="text-xs font-bold text-[#120E24] truncate group-hover:text-[#7C2CF5] transition">{session?.user.fullName}</p>
              {isLakshay && <ChevronDown className="w-3 h-3 text-[#585172]" />}
            </div>
            <p className="text-[11px] text-[#585172] font-medium truncate">{primaryRole}</p>
          </div>
          <button
            onClick={handleLogoutClick}
            title="Log Out (Submit Daily Update)"
            className="p-1.5 text-[#585172] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
          >
            <LogOut className="w-4 h-4" />
          </button>

          {isLakshay && roleSwitcherOpen && (
            <div className="absolute bottom-16 left-3 w-60 bg-white rounded-2xl shadow-2xl border border-[#DDD0FE] py-2 z-50 animate-in fade-in zoom-in-95">
              <div className="px-3.5 py-1.5 text-[10px] font-bold text-[#7C2CF5] uppercase tracking-wider flex items-center justify-between">
                <span>Switch Team Profile</span>
                <span className="text-[9px] bg-purple-100 text-[#7C2CF5] px-1.5 py-0.5 rounded-md font-bold">Founder</span>
              </div>
              {team.map((member) => {
                const teamEmailMap: Record<string, string> = {
                  'lakshay': 'lakshay@codrix.co.in',
                  'parth sharma': 'parth@codrix.co.in',
                  'anshuman': 'anshuman@codrix.co.in',
                  'suryansh thakur': 'suryansh@codrix.co.in',
                  'diya maheshwari': 'diya@codrix.co.in',
                  'ishita malhotra': 'ishita@codrix.co.in'
                };
                const memberNameKey = (member.name || '').toLowerCase().trim();
                const memberEmail = member.email || teamEmailMap[memberNameKey] || `${memberNameKey.split(' ')[0]}@codrix.co.in`;
                return (
                  <button
                    key={member.name}
                    onClick={() => {
                      quickSwitchRole(memberEmail);
                      setRoleSwitcherOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 text-xs flex flex-col hover:bg-[#F5F0FF] transition ${
                      session?.user.email === memberEmail ? 'bg-[#EDE4FF] font-bold text-[#7C2CF5]' : 'text-[#120E24]'
                    }`}
                  >
                    <span className="font-semibold">{member.name}</span>
                    <span className="text-[10px] text-[#585172]">{member.role || member.designation}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* Main App Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#FBFBFE]">
        {/* Dynamic Main Body */}
        <main className="flex-1 overflow-y-auto p-8 bg-[#FBFBFE]">
          {children}
        </main>
      </div>

      {/* Mandatory Pre-Logout Daily Project Update Modal */}
      {preLogoutModalOpen && (
        <div className="fixed inset-0 bg-[#120E24]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#E7E0FB]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E0FB] mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#120E24] text-sm">Daily Project Update Required</h3>
                  <p className="text-[11px] text-[#585172]">
                    Please submit your daily progress update before logging out for today.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreLogoutModalOpen(false)}
                className="text-[#585172] hover:text-[#120E24] p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePreLogoutSubmit} className="space-y-3.5 text-xs">
              {/* Project Selection */}
              <div>
                <label className="block font-bold text-[#120E24] mb-1">Active Project Working On</label>
                <select
                  value={logoutSelectedProjectId}
                  onChange={(e) => setLogoutSelectedProjectId(e.target.value)}
                  className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3.5 py-2 text-[#120E24] font-semibold focus:border-[#7C2CF5] focus:outline-none"
                >
                  {logoutProjects.map((p) => (
                    <option key={p.id || p._id} value={p.id || p._id}>
                      {p.projectCode} &bull; {p.name}
                    </option>
                  ))}
                  {logoutProjects.length === 0 && (
                    <option value="">General Project Deliverables</option>
                  )}
                </select>
              </div>

              {/* Completed today */}
              <div>
                <label className="block font-bold text-[#120E24] mb-1">
                  1. What did you complete on this project today? <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={logoutCompleted}
                  onChange={(e) => setLogoutCompleted(e.target.value)}
                  className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3.5 py-2 text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                  placeholder="e.g. Completed lead qualification drawer and synced database records"
                />
              </div>

              {/* In Progress */}
              <div>
                <label className="block font-bold text-[#120E24] mb-1">
                  2. What is currently in progress? <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={logoutInProgress}
                  onChange={(e) => setLogoutInProgress(e.target.value)}
                  className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3.5 py-2 text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                  placeholder="e.g. Unit tests for real-time WebSocket connection pool"
                />
              </div>

              {/* Blockers */}
              <div>
                <label className="block font-bold text-[#120E24] mb-1">
                  3. Any blockers or dependencies?
                </label>
                <input
                  type="text"
                  value={logoutBlockers}
                  onChange={(e) => setLogoutBlockers(e.target.value)}
                  className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3.5 py-2 text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                  placeholder="e.g. None or waiting on PR approval from Parth"
                />
              </div>

              {/* Tomorrow's plan */}
              <div>
                <label className="block font-bold text-[#120E24] mb-1">
                  4. Planned outcomes for tomorrow
                </label>
                <input
                  type="text"
                  value={logoutNextDay}
                  onChange={(e) => setLogoutNextDay(e.target.value)}
                  className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3.5 py-2 text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                  placeholder="e.g. Finalize sprint deployment and review test suite"
                />
              </div>

              <div className="pt-3 border-t border-[#E7E0FB] flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setPreLogoutModalOpen(false)}
                  className="px-4 py-2 border border-[#E7E0FB] rounded-xl text-[#585172] hover:bg-[#F7F5FE] font-bold transition"
                >
                  Cancel & Return
                </button>
                <button
                  type="submit"
                  disabled={logoutSubmitting}
                  className="px-4 py-2 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl font-bold shadow-md shadow-[#7C2CF5]/25 transition flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{logoutSubmitting ? 'Recording & Logging Out...' : 'Submit Update & Log Out'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};