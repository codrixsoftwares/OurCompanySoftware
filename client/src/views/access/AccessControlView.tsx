import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { apiRequest } from '../../api/client.js';
import {
  ShieldAlert,
  ShieldCheck,
  User,
  Users,
  Search,
  Check,
  X,
  Lock,
  Unlock,
  KeyRound,
  LayoutDashboard,
  Briefcase,
  Mail,
  Target,
  FolderKanban,
  Code2,
  CalendarCheck,
  MailCheck,
  Shield,
  Settings,
  Sparkles,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Sliders,
  Filter
} from 'lucide-react';

interface ManagedUserAccess {
  id: string;
  email: string;
  fullName: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  roles: string[];
  employeeCode: string;
  designation: string;
  allowedTabs: string[] | null;
  isAccessRestricted: boolean;
}

// All discrete functional workspaces across CodRix Enterprise OS
const ALL_SYSTEM_TABS = [
  { id: 'dashboard', label: 'Command Center', icon: LayoutDashboard, description: 'Executive KPIs, daily analytics, and overview' },
  { id: 'recruitment', label: 'Recruitment (ATS)', icon: Briefcase, description: 'Candidate intake, pipeline stages, offer letters, hiring' },
  { id: 'crm', label: 'Record Management (CRM)', icon: Target, description: 'Leads, BDE client surveys, cold outreach, call logs' },
  { id: 'mailbox', label: 'Mailbox Workspace', icon: Mail, description: 'Company inboxes, live Resend/IMAP synced email conversations' },
  { id: 'projects', label: 'Projects Database', icon: FolderKanban, description: 'Enterprise client projects, milestone delivery tracking' },
  { id: 'engineering', label: 'Engineering & Sprints', icon: Code2, description: 'Sprint tickets, agile tasks, code reviews, daily updates' },
  { id: 'hrms', label: 'HRMS & Attendance', icon: CalendarCheck, description: 'Employee directories, clock-in/out, leave applications' },
  { id: 'email-templates', label: 'Email Templates Studio', icon: MailCheck, description: 'ATS stage templates, marketing, and security notifications' },
  { id: 'audit', label: 'Audit & Governance', icon: ShieldCheck, description: 'Immutable action trail and live user sessions telemetry' },
  { id: 'settings', label: 'Domain & Settings', icon: Settings, description: 'Resend API key, domain configuration, company channels' }
];

const AVAILABLE_ROLES = [
  'COMPANY_ADMIN',
  'ENGINEERING_LEAD',
  'HR_MANAGER',
  'HR_EXEC',
  'OPS_MANAGER',
  'BRANCH_MANAGER',
  'GROWTH_OFFICER',
  'BDM',
  'BDE',
  'SDE2',
  'SDE1',
  'INTERN',
  'EMPLOYEE'
];

export const AccessControlView: React.FC = () => {
  const { isLakshay } = useAuth();
  const [users, setUsers] = useState<ManagedUserAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<ManagedUserAccess | null>(null);

  // Edit Access State
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedTabs, setSelectedTabs] = useState<string[]>([]);
  const [isRestricted, setIsRestricted] = useState(false);
  const [userStatus, setUserStatus] = useState<'ACTIVE' | 'SUSPENDED'>('ACTIVE');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<ManagedUserAccess[]>('/auth/access-control/users');
      setUsers(res || []);
      if (selectedUser) {
        const refreshed = (res || []).find((u) => u.id === selectedUser.id);
        if (refreshed) {
          loadUserIntoEditor(refreshed);
        }
      } else if (res && res.length > 0) {
        loadUserIntoEditor(res[0]);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed loading user access list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLakshay) {
      fetchUsers();
    }
  }, [isLakshay]);

  const loadUserIntoEditor = (user: ManagedUserAccess) => {
    setSelectedUser(user);
    setSelectedRoles(user.roles || ['EMPLOYEE']);
    setUserStatus(user.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE');
    setIsRestricted(user.isAccessRestricted);

    if (user.allowedTabs && user.allowedTabs.length > 0) {
      setSelectedTabs(user.allowedTabs);
    } else {
      // By default if unrestricted, grant standard tabs based on roles
      setSelectedTabs(ALL_SYSTEM_TABS.map((t) => t.id));
    }
  };

  const handleToggleTab = (tabId: string) => {
    setSelectedTabs((prev) => {
      if (prev.includes(tabId)) {
        return prev.filter((id) => id !== tabId);
      } else {
        return [...prev, tabId];
      }
    });
  };

  const handleToggleRole = (role: string) => {
    if (selectedUser?.email === 'lakshay@codrix.co.in' && role === 'COMPANY_ADMIN') {
      alert('Superadmin protection: COMPANY_ADMIN role cannot be removed from Founder Lakshay.');
      return;
    }
    setSelectedRoles((prev) => {
      if (prev.includes(role)) {
        if (prev.length === 1) {
          alert('A user must have at least one assigned role.');
          return prev;
        }
        return prev.filter((r) => r !== role);
      } else {
        return [...prev, role];
      }
    });
  };

  const handleSelectAllTabs = () => {
    setSelectedTabs(ALL_SYSTEM_TABS.map((t) => t.id));
  };

  const handleClearAllTabs = () => {
    setSelectedTabs(['dashboard']); // Always keep at least dashboard
  };

  const handleSaveAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (selectedTabs.length === 0) {
      alert('User must have access to at least 1 workspace tab.');
      return;
    }

    setSaving(true);
    try {
      await apiRequest(`/auth/access-control/users/${selectedUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          roles: selectedRoles,
          allowedTabs: selectedTabs,
          isAccessRestricted: isRestricted,
          status: userStatus
        })
      });

      showToast('success', `Access permissions for ${selectedUser.fullName || selectedUser.email} saved successfully!`);
      await fetchUsers();
    } catch (err: any) {
      showToast('error', err.message || 'Failed updating user permissions');
    } finally {
      setSaving(false);
    }
  };

  if (!isLakshay) {
    return (
      <div className="p-12 text-center text-[#585172] bg-white rounded-3xl border border-[#E7E0FB] m-6">
        <ShieldAlert className="w-12 h-12 text-rose-600 mx-auto mb-3" />
        <h2 className="text-base font-extrabold text-[#120E24]">Superadmin Restricted Area</h2>
        <p className="text-xs mt-1.5 max-w-md mx-auto">
          The User Access Control & Permissions Engine is strictly reserved for Superadmin Founder Lakshay.
        </p>
      </div>
    );
  }

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      (u.fullName || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.employeeCode || '').toLowerCase().includes(q) ||
      (u.designation || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold animate-in fade-in ${
          toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold tracking-wider uppercase bg-[#EDE4FF] text-[#7C2CF5] border border-[#E7E0FB]">
              Founder Superadmin Center
            </span>
            <span className="text-xs text-[#585172] font-semibold">Real-Time Permission Controller</span>
          </div>
          <h2 className="text-xl font-extrabold text-[#120E24] mt-1 flex items-center gap-2">
            <span>Granular User Access Control & Security Matrix</span>
            <span className="w-2 h-2 rounded-full bg-[#7C2CF5]"></span>
          </h2>
          <p className="text-xs text-[#585172]">
            Control exact visible workspaces, allowed sections, assigned roles, and account status for every team member.
          </p>
        </div>

        <button
          onClick={fetchUsers}
          disabled={loading}
          className="px-4 py-2 bg-white hover:bg-[#F6F3FF] text-[#7C2CF5] border border-[#E7E0FB] rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Users ({users.length})</span>
        </button>
      </div>

      {/* Main 2-Column Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: User Selector List (4 Cols) */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-[#E7E0FB] shadow-xs p-4 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#E7E0FB]">
            <span className="text-xs font-bold uppercase tracking-wider text-[#120E24]">
              Team Members ({filteredUsers.length})
            </span>
            <span className="text-[10px] text-[#585172]">Select to configure</span>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#7C2CF5] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by name, email, role, code..."
              className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl pl-8 pr-3 py-2 text-xs text-[#120E24] placeholder-slate-400 focus:outline-none focus:border-[#7C2CF5]"
            />
          </div>

          {/* Users List */}
          <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
            {filteredUsers.map((u) => {
              const isSelected = selectedUser?.id === u.id;
              const isFounder = u.email === 'lakshay@codrix.co.in';

              return (
                <div
                  key={u.id}
                  onClick={() => loadUserIntoEditor(u)}
                  className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-[#F6F3FF] border-[#7C2CF5] shadow-xs'
                      : 'bg-white border-[#E7E0FB] hover:border-[#7C2CF5]/40 hover:bg-[#FBFBFE]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-[#7C2CF5]/10 border border-[#7C2CF5]/20 flex items-center justify-center text-[#7C2CF5] font-bold text-xs shrink-0">
                      {(u.fullName || u.email || 'U').substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-[#120E24] truncate">{u.fullName || 'User'}</span>
                        {isFounder && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-[#7C2CF5] text-white">
                            FOUNDER
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#585172] truncate">{u.email}</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] font-semibold text-[#7C2CF5] bg-[#F0ECFC] px-1.5 py-0.5 rounded">
                          {u.roles[0] || 'EMPLOYEE'}
                        </span>
                        <span className="text-[10px] text-[#585172]">&bull; {u.employeeCode}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {u.status === 'SUSPENDED' ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-100 text-rose-700">
                        SUSPENDED
                      </span>
                    ) : u.isAccessRestricted ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800">
                        LIMITED
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800">
                        FULL
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredUsers.length === 0 && (
              <div className="p-8 text-center text-xs text-[#585172]">
                No users found matching query.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Permission & Workspace Access Editor (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-[#E7E0FB] shadow-xs p-6 space-y-6">
          {selectedUser ? (
            <form onSubmit={handleSaveAccess} className="space-y-6">
              {/* User Summary Header */}
              <div className="flex items-start justify-between pb-4 border-b border-[#E7E0FB]">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-[#120E24]">
                      {selectedUser.fullName || selectedUser.email}
                    </h3>
                    <span className="text-[10px] font-mono font-bold text-[#7C2CF5] bg-[#F6F3FF] px-2 py-0.5 rounded-md border border-[#E7E0FB]">
                      {selectedUser.employeeCode}
                    </span>
                  </div>
                  <p className="text-xs text-[#585172] mt-0.5">
                    {selectedUser.email} &bull; {selectedUser.designation}
                  </p>
                </div>

                {/* Account Status Toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#120E24]">Status:</span>
                  <select
                    value={userStatus}
                    onChange={(e) => setUserStatus(e.target.value as any)}
                    className="bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-2.5 py-1 text-xs text-[#120E24] font-bold focus:outline-none focus:border-[#7C2CF5]"
                  >
                    <option value="ACTIVE">ACTIVE (Can Log In)</option>
                    <option value="SUSPENDED">SUSPENDED (Block Login)</option>
                  </select>
                </div>
              </div>

              {/* SECTION 1: Explicit Workspace Access (Tabs) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#120E24] flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-[#7C2CF5]" />
                      <span>Allowed Software Workspaces ({selectedTabs.length} / {ALL_SYSTEM_TABS.length})</span>
                    </h4>
                    <p className="text-[11px] text-[#585172]">
                      Toggle exactly which tabs and workspaces appear in this user's sidebar.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={handleSelectAllTabs}
                      className="text-[#7C2CF5] font-bold hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={handleClearAllTabs}
                      className="text-[#585172] font-semibold hover:text-[#120E24]"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {/* Tabs Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {ALL_SYSTEM_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isAllowed = selectedTabs.includes(tab.id);

                    return (
                      <div
                        key={tab.id}
                        onClick={() => handleToggleTab(tab.id)}
                        className={`p-3 rounded-2xl border transition cursor-pointer flex items-start gap-2.5 ${
                          isAllowed
                            ? 'bg-[#F6F3FF] border-[#7C2CF5]/70 shadow-xs'
                            : 'bg-[#FBFBFE] border-[#E7E0FB] opacity-60 hover:opacity-100'
                        }`}
                      >
                        <div className={`p-1.5 rounded-xl shrink-0 mt-0.5 ${
                          isAllowed ? 'bg-[#7C2CF5] text-white' : 'bg-slate-200 text-slate-500'
                        }`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-[#120E24]">{tab.label}</span>
                            <span className={`w-4 h-4 rounded-md border flex items-center justify-center text-[10px] ${
                              isAllowed
                                ? 'bg-[#7C2CF5] border-[#7C2CF5] text-white'
                                : 'border-slate-300 bg-white'
                            }`}>
                              {isAllowed && <Check className="w-3 h-3 stroke-[3]" />}
                            </span>
                          </div>
                          <p className="text-[10px] text-[#585172] mt-0.5 leading-snug line-clamp-1">
                            {tab.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 2: Role Assignment */}
              <div className="space-y-3 pt-2 border-t border-[#E7E0FB]">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#120E24] flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-[#7C2CF5]" />
                    <span>Assigned System Roles</span>
                  </h4>
                  <p className="text-[11px] text-[#585172]">
                    Select one or more backend security roles governing data access and action permissions.
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {AVAILABLE_ROLES.map((role) => {
                    const isAssigned = selectedRoles.includes(role);
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => handleToggleRole(role)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                          isAssigned
                            ? 'bg-[#7C2CF5] border-[#7C2CF5] text-white shadow-xs'
                            : 'bg-[#FBFBFE] border-[#E7E0FB] text-[#585172] hover:bg-[#F6F3FF]'
                        }`}
                      >
                        <span>{role}</span>
                        {isAssigned && <Check className="w-3 h-3" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 3: Explicit Custom Restriction Flag */}
              <div className="p-3.5 bg-[#FAF9FE] border border-[#E7E0FB] rounded-2xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-[#120E24] block">Enforce Custom Limited Access</span>
                  <p className="text-[10px] text-[#585172] mt-0.5">
                    When enabled, this user is explicitly restricted only to the selected workspaces above, overriding default role visibility.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={isRestricted}
                  onChange={(e) => setIsRestricted(e.target.checked)}
                  className="w-4 h-4 text-[#7C2CF5] rounded border-[#E7E0FB] focus:ring-[#7C2CF5] cursor-pointer"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-[#E7E0FB] flex items-center justify-between">
                <div className="text-[11px] text-[#585172]">
                  Changes are saved directly to MongoDB Atlas and broadcast in real-time.
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white font-bold text-xs rounded-xl shadow-md shadow-[#7C2CF5]/30 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>{saving ? 'Applying Access Matrix...' : 'Save & Enforce Permissions'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="p-16 text-center text-[#585172]">
              <Users className="w-10 h-10 text-[#585172]/40 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-[#120E24]">No User Selected</h3>
              <p className="text-xs mt-1">Please select a user from the left list to manage their software access.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
