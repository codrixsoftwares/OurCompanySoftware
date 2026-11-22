import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { apiRequest } from '../../api/client.js';
import { getSocket } from '../../core/socket.js';
import {
  Users,
  Briefcase,
  Target,
  Code2,
  Calendar,
  Mail,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

export const DashboardView: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  const { session, isCoreTeam } = useAuth();
  const [data, setData] = useState<any>(null);

  const loadOverview = () => {
    apiRequest('/reports/overview')
      .then((res) => setData(res))
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    loadOverview();

    const socket = getSocket();
    const handleSync = () => {
      loadOverview();
    };

    socket.on('recruitment:candidate_new', handleSync);
    socket.on('recruitment:stage_changed', handleSync);
    socket.on('recruitment:job_created', handleSync);
    socket.on('crm:lead_new', handleSync);
    socket.on('crm:lead_stage_changed', handleSync);
    socket.on('engineering:task_created', handleSync);
    socket.on('engineering:task_status_changed', handleSync);
    socket.on('hrms:attendance_punched', handleSync);
    socket.on('hrms:leave_applied', handleSync);
    socket.on('hrms:leave_approved', handleSync);
    socket.on('email:new', handleSync);

    return () => {
      socket.off('recruitment:candidate_new', handleSync);
      socket.off('recruitment:stage_changed', handleSync);
      socket.off('recruitment:job_created', handleSync);
      socket.off('crm:lead_new', handleSync);
      socket.off('crm:lead_stage_changed', handleSync);
      socket.off('engineering:task_created', handleSync);
      socket.off('engineering:task_status_changed', handleSync);
      socket.off('hrms:attendance_punched', handleSync);
      socket.off('hrms:leave_applied', handleSync);
      socket.off('hrms:leave_approved', handleSync);
      socket.off('email:new', handleSync);
    };
  }, []);

  const kpis = data?.kpis || {
    employeeCount: 0,
    openJobsCount: 0,
    activeLeadsCount: 0,
    activeProjectsCount: 0,
    pendingLeaveRequests: 0,
    unreadEmailsCount: 0
  };

  return (
    <div className="space-y-6 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Welcome Banner in Codrix signature light gradient */}
      <div className="bg-gradient-to-r from-[#F6F3FF] via-[#EDE4FF] to-[#DDD0FE] rounded-3xl p-7 text-[#120E24] shadow-sm border border-[#DDD0FE] flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <img src="/logo-icon.png" alt="CodRix Logo" className="w-6 h-6 object-contain" />
            <span className="text-[11px] uppercase tracking-wider font-extrabold text-[#7C2CF5]">
              {session?.activeTenant.name} &bull; Enterprise Operations
            </span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#120E24]">Welcome back, {session?.user.fullName}</h2>
          <p className="text-xs text-[#585172] mt-1 max-w-xl font-medium">
            Logged in as <strong className="text-[#7C2CF5] font-bold">{session?.roles[0]}</strong>. All multi-tenant domains are healthy and synchronized with MongoDB Atlas.
          </p>
        </div>
        {isCoreTeam && (
          <div className="flex gap-3 relative z-10 shrink-0">
            <button
              onClick={() => onNavigate('mailbox')}
              className="px-4 py-2.5 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl text-xs font-bold shadow-md shadow-[#7C2CF5]/25 transition flex items-center gap-2"
            >
              <Mail className="w-4 h-4" />
              <span>Open Mailbox Workspace</span>
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div
          onClick={() => onNavigate('hrms')}
          className="bg-white p-5 rounded-2xl border border-[#E7E0FB] shadow-xs hover:border-[#7C2CF5] hover:shadow-md cursor-pointer transition group"
        >
          <div className="flex items-center justify-between text-[#585172] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Staff</span>
            <Users className="w-4 h-4 text-[#7C2CF5]" />
          </div>
          <div className="text-2xl font-extrabold text-[#120E24]">{kpis.employeeCount}</div>
          <span className="text-[11px] text-emerald-600 font-semibold flex items-center mt-1">
            Live from MongoDB
          </span>
        </div>

        <div
          onClick={() => onNavigate('recruitment')}
          className="bg-white p-5 rounded-2xl border border-[#E7E0FB] shadow-xs hover:border-[#7C2CF5] hover:shadow-md cursor-pointer transition group"
        >
          <div className="flex items-center justify-between text-[#585172] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Open Jobs</span>
            <Briefcase className="w-4 h-4 text-[#7C2CF5]" />
          </div>
          <div className="text-2xl font-extrabold text-[#120E24]">{kpis.openJobsCount}</div>
          <span className="text-[11px] text-[#7C2CF5] font-semibold flex items-center mt-1">
            Requisitions Active
          </span>
        </div>

        <div
          onClick={() => onNavigate('crm')}
          className="bg-white p-5 rounded-2xl border border-[#E7E0FB] shadow-xs hover:border-[#7C2CF5] hover:shadow-md cursor-pointer transition group"
        >
          <div className="flex items-center justify-between text-[#585172] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Leads</span>
            <Target className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-[#120E24]">{kpis.activeLeadsCount}</div>
          <span className="text-[11px] text-emerald-600 font-semibold flex items-center mt-1">
            Pipeline Hot
          </span>
        </div>

        <div
          onClick={() => onNavigate('engineering')}
          className="bg-white p-5 rounded-2xl border border-[#E7E0FB] shadow-xs hover:border-[#7C2CF5] hover:shadow-md cursor-pointer transition group"
        >
          <div className="flex items-center justify-between text-[#585172] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Projects</span>
            <Code2 className="w-4 h-4 text-[#7C2CF5]" />
          </div>
          <div className="text-2xl font-extrabold text-[#120E24]">{kpis.activeProjectsCount}</div>
          <span className="text-[11px] text-[#7C2CF5] font-semibold flex items-center mt-1">
            Sprint In Progress
          </span>
        </div>

        <div
          onClick={() => onNavigate('hrms')}
          className="bg-white p-5 rounded-2xl border border-[#E7E0FB] shadow-xs hover:border-[#7C2CF5] hover:shadow-md cursor-pointer transition group"
        >
          <div className="flex items-center justify-between text-[#585172] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pending Leaves</span>
            <Calendar className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-[#120E24]">{kpis.pendingLeaveRequests}</div>
          <span className="text-[11px] text-amber-600 font-semibold flex items-center mt-1">
            Requires Approval
          </span>
        </div>

        {isCoreTeam && (
          <div
            onClick={() => onNavigate('mailbox')}
            className="bg-white p-5 rounded-2xl border border-[#E7E0FB] shadow-xs hover:border-[#7C2CF5] hover:shadow-md cursor-pointer transition group"
          >
            <div className="flex items-center justify-between text-[#585172] mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Unread Mails</span>
              <Mail className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-extrabold text-[#120E24]">{kpis.unreadEmailsCount}</div>
            <span className="text-[11px] text-rose-600 font-semibold flex items-center mt-1">
              Shared Inboxes
            </span>
          </div>
        )}
      </div>

      {/* Main Command Center Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Module Fast Links */}
        <div className="bg-white p-6 rounded-2xl border border-[#E7E0FB] shadow-xs space-y-4">
          <h3 className="font-bold text-[#120E24] text-xs uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#7C2CF5]" />
            <span>Operational Workspaces</span>
          </h3>
          <div className="space-y-2.5">
            <button
              onClick={() => onNavigate('recruitment')}
              className="w-full text-left p-3.5 rounded-xl border border-[#E7E0FB] hover:border-[#7C2CF5] hover:bg-[#F5F0FF]/60 transition flex items-center justify-between group"
            >
              <div>
                <div className="text-xs font-bold text-[#120E24] group-hover:text-[#7C2CF5] transition">Recruitment & ATS Pipeline</div>
                <div className="text-[11px] text-[#585172]">Kanban stages, candidate evaluation, offer letters</div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-[#7C2CF5] transition" />
            </button>

            {isCoreTeam && (
              <button
                onClick={() => onNavigate('mailbox')}
                className="w-full text-left p-3.5 rounded-xl border border-[#E7E0FB] hover:border-[#7C2CF5] hover:bg-[#F5F0FF]/60 transition flex items-center justify-between group"
              >
                <div>
                  <div className="text-xs font-bold text-[#120E24] group-hover:text-[#7C2CF5] transition">Unified Mailbox Workspace</div>
                  <div className="text-[11px] text-[#585172]">Shared addresses (careers@, sales@, connect@)</div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-[#7C2CF5] transition" />
              </button>
            )}

            <button
              onClick={() => onNavigate('crm')}
              className="w-full text-left p-3.5 rounded-xl border border-[#E7E0FB] hover:border-[#7C2CF5] hover:bg-[#F5F0FF]/60 transition flex items-center justify-between group"
            >
              <div>
                <div className="text-xs font-bold text-[#120E24] group-hover:text-[#7C2CF5] transition">CRM & Customer 360</div>
                <div className="text-[11px] text-[#585172]">Lead follow-ups, calls, and 360 profile timelines</div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-[#7C2CF5] transition" />
            </button>

            <button
              onClick={() => onNavigate('engineering')}
              className="w-full text-left p-3.5 rounded-xl border border-[#E7E0FB] hover:border-[#7C2CF5] hover:bg-[#F5F0FF]/60 transition flex items-center justify-between group"
            >
              <div>
                <div className="text-xs font-bold text-[#120E24] group-hover:text-[#7C2CF5] transition">Engineering Task Board</div>
                <div className="text-[11px] text-[#585172]">Sprint planning, tasks, and daily standups</div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-[#7C2CF5] transition" />
            </button>
          </div>
        </div>

        {/* Recent Audit & System Integrity Trail */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-[#E7E0FB] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-[#120E24] text-xs uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Multi-Tenancy & Security Audit Stream</span>
            </h3>
            <span className="text-[11px] text-[#585172] font-semibold">codrix.co.in &bull; MongoDB</span>
          </div>

          <div className="divide-y divide-[#E7E0FB]/60">
            {(data?.recentAuditLogs || []).length === 0 ? (
              <div className="py-6 text-center text-xs text-[#585172]">
                Audit stream active. All administrative and operational actions are logged to MongoDB.
              </div>
            ) : (
              data.recentAuditLogs.slice(0, 5).map((log: any) => (
                <div key={log.id} className="py-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-[#7C2CF5] shrink-0" />
                    <div>
                      <span className="font-bold text-[#120E24]">{log.action}</span>
                      <span className="text-slate-300 mx-2">&bull;</span>
                      <span className="text-[#585172] font-medium">{log.actorEmail || 'System'}</span>
                    </div>
                  </div>
                  <span className="text-[#585172] text-[11px]">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
