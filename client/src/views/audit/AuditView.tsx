import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { getSocket } from '../../core/socket.js';
import {
  ShieldCheck,
  User,
  Clock,
  CheckCircle2,
  Lock,
  Activity,
  Globe,
  Monitor,
  AlertTriangle,
  RotateCcw,
  LogOut,
  PowerOff,
  Filter,
  Search,
  Sparkles,
  FileText,
  X
} from 'lucide-react';

interface UserSessionRecord {
  _id: string;
  sessionId: string;
  userId: string;
  email: string;
  fullName: string;
  role: string;
  employeeCode?: string;
  ip: string;
  userAgent: string;
  device: string;
  browser: string;
  os: string;
  loginAt: string;
  lastActiveAt: string;
  status: 'ACTIVE' | 'TIMEOUT_INACTIVE' | 'LOGGED_OUT' | 'REVOKED';
  logoutReason?: string;
  sessionDurationMs?: number;
  lastWorkSummary?: string;
  todayWorkBrief?: string;
  logoutAt?: string;
}

export const AuditView: React.FC = () => {
  const { isLakshay } = useAuth();
  const [activeTab, setActiveTab] = useState<'audit' | 'sessions'>(isLakshay ? 'sessions' : 'audit');

  // Audit logs state
  const [logs, setLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);

  // Session records state (Lakshay Exclusive)
  const [sessions, setSessions] = useState<UserSessionRecord[]>([]);
  const [sessionMeta, setSessionMeta] = useState<{ activeCount: number; timeoutCount: number; totalToday: number }>({
    activeCount: 0,
    timeoutCount: 0,
    totalToday: 0
  });
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionSearch, setSessionSearch] = useState('');
  const [sessionFilterStatus, setSessionFilterStatus] = useState<string>('ALL');
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [selectedSessionBrief, setSelectedSessionBrief] = useState<UserSessionRecord | null>(null);

  const loadAuditLogs = () => {
    setAuditLoading(true);
    apiRequest<any[]>('/reports/audit-logs')
      .then((data) => setLogs(data))
      .catch((err) => console.error(err))
      .finally(() => setAuditLoading(false));
  };

  const loadSessionRecords = () => {
    if (!isLakshay) return;
    setSessionsLoading(true);
    apiRequest<{ sessions: UserSessionRecord[]; activeCount: number; timeoutCount: number; totalToday: number }>('/auth/session-records')
      .then((res) => {
        setSessions(res.sessions || []);
        setSessionMeta({
          activeCount: res.activeCount || 0,
          timeoutCount: res.timeoutCount || 0,
          totalToday: res.totalToday || 0
        });
      })
      .catch((err) => console.error('Failed to load session records:', err))
      .finally(() => setSessionsLoading(false));
  };

  useEffect(() => {
    loadAuditLogs();
    if (isLakshay) {
      loadSessionRecords();

      // Real-time socket sync for session changes
      const socket = getSocket();
      const onSessionUpdate = () => {
        loadSessionRecords();
      };

      socket.on('session:new', onSessionUpdate);
      socket.on('session:updated', onSessionUpdate);
      socket.on('session:timeout', onSessionUpdate);
      socket.on('session:logged_out', onSessionUpdate);
      socket.on('session:revoked', onSessionUpdate);

      // Refresh every 30s as fallback
      const interval = setInterval(loadSessionRecords, 30000);

      return () => {
        socket.off('session:new', onSessionUpdate);
        socket.off('session:updated', onSessionUpdate);
        socket.off('session:timeout', onSessionUpdate);
        socket.off('session:logged_out', onSessionUpdate);
        socket.off('session:revoked', onSessionUpdate);
        clearInterval(interval);
      };
    }
  }, [isLakshay]);

  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to forcibly terminate and revoke this user session immediately?')) {
      return;
    }
    setRevokingId(sessionId);
    try {
      await apiRequest(`/auth/session-records/${sessionId}/revoke`, { method: 'POST' });
      loadSessionRecords();
    } catch (err: any) {
      alert(err.message || 'Failed to revoke session');
    } finally {
      setRevokingId(null);
    }
  };

  const formatDuration = (ms?: number, loginAt?: string, lastActiveAt?: string) => {
    const totalMs = ms || (loginAt && lastActiveAt ? new Date(lastActiveAt).getTime() - new Date(loginAt).getTime() : 0);
    if (!totalMs || totalMs < 1000) return '< 1m';
    const minutes = Math.floor(totalMs / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  // Filtered sessions
  const filteredSessions = sessions.filter((s) => {
    if (sessionFilterStatus !== 'ALL' && s.status !== sessionFilterStatus) return false;
    if (!sessionSearch.trim()) return true;
    const q = sessionSearch.toLowerCase();
    return (
      (s.fullName || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.ip || '').toLowerCase().includes(q) ||
      (s.device || '').toLowerCase().includes(q) ||
      (s.lastWorkSummary || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#120E24] flex items-center gap-2">
            <span>Security, Audit & Governance Trail</span>
            {isLakshay && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#7C2CF5]/10 text-[#7C2CF5] border border-[#7C2CF5]/20">
                Founder Superadmin Mode
              </span>
            )}
          </h2>
          <p className="text-xs text-[#585172]">
            Immutable record of operations, active user sessions, 15-minute inactivity timeouts, and work preservation
          </p>
        </div>

        {/* Tab switcher: only show Session Telemetry tab to Lakshay */}
        <div className="flex items-center gap-2 bg-[#F6F3FF] p-1 rounded-2xl border border-[#E7E0FB]">
          {isLakshay && (
            <button
              onClick={() => setActiveTab('sessions')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'sessions'
                  ? 'bg-white text-[#7C2CF5] shadow-xs border border-[#E7E0FB]'
                  : 'text-[#585172] hover:text-[#120E24]'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-[#7C2CF5]" />
              <span>Live User Sessions ({sessionMeta.activeCount})</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-white text-[#7C2CF5] shadow-xs border border-[#E7E0FB]'
                : 'text-[#585172] hover:text-[#120E24]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Audit Trail & Logs</span>
          </button>
        </div>
      </div>

      {/* LAKSHAY EXCLUSIVE: Live User Login Records & Sessions Tab */}
      {isLakshay && activeTab === 'sessions' && (
        <div className="space-y-4">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-[#E7E0FB] shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-[#585172] uppercase tracking-wider">Active Logged In</span>
                <h3 className="text-2xl font-black text-emerald-600 mt-1">{sessionMeta.activeCount}</h3>
                <span className="text-[10px] text-emerald-700 font-medium">Real-time Heartbeat Connected</span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                <span className="relative flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                </span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#E7E0FB] shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-[#585172] uppercase tracking-wider">15m Inactivity Timeouts</span>
                <h3 className="text-2xl font-black text-amber-600 mt-1">{sessionMeta.timeoutCount}</h3>
                <span className="text-[10px] text-amber-700 font-medium">Auto-Logged Out (Work Saved)</span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <Clock className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#E7E0FB] shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-[#585172] uppercase tracking-wider">Total Sessions Today</span>
                <h3 className="text-2xl font-black text-[#7C2CF5] mt-1">{sessionMeta.totalToday}</h3>
                <span className="text-[10px] text-[#7C2CF5] font-medium">Enterprise OS Audit Telemetry</span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[#F6F3FF] border border-[#E7E0FB] flex items-center justify-center text-[#7C2CF5]">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-3.5 rounded-2xl border border-[#E7E0FB] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full sm:w-auto">
              <Search className="w-4 h-4 text-[#7C2CF5] absolute left-3 top-2.5" />
              <input
                type="text"
                value={sessionSearch}
                onChange={(e) => setSessionSearch(e.target.value)}
                placeholder="Search user, email, IP, device, or work activity..."
                className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl pl-9 pr-3.5 py-2 text-xs text-[#120E24] placeholder-slate-400 focus:outline-none focus:border-[#7C2CF5]"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <select
                value={sessionFilterStatus}
                onChange={(e) => setSessionFilterStatus(e.target.value)}
                className="bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-xs text-[#120E24] font-medium focus:outline-none focus:border-[#7C2CF5]"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Logins</option>
                <option value="TIMEOUT_INACTIVE">15-Min Inactive Timeouts</option>
                <option value="LOGGED_OUT">User Logouts</option>
                <option value="REVOKED">Forced Revoked</option>
              </select>

              <button
                type="button"
                onClick={loadSessionRecords}
                title="Refresh sessions"
                className="p-2 border border-[#E7E0FB] rounded-xl hover:bg-[#F6F3FF] text-[#585172] hover:text-[#7C2CF5] transition cursor-pointer"
              >
                <RotateCcw className={`w-4 h-4 ${sessionsLoading ? 'animate-spin text-[#7C2CF5]' : ''}`} />
              </button>
            </div>
          </div>

          {/* Sessions Table */}
          <div className="bg-white rounded-2xl border border-[#E7E0FB] shadow-xs overflow-hidden">
            <div className="p-4 border-b border-[#E7E0FB] bg-[#F7F5FE]/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs uppercase tracking-wider text-[#120E24]">
                  User Login Records ({filteredSessions.length})
                </span>
                <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Lock className="w-3 h-3 text-amber-600" />
                  <span>Confidential • Superadmin Lakshay Only</span>
                </span>
              </div>
              <span className="text-[11px] text-[#585172]">Auto-expires at 15m inactivity</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F5FE] text-[#585172] font-semibold border-b border-[#E7E0FB]">
                  <tr>
                    <th className="py-3 px-4">User / Account</th>
                    <th className="py-3 px-4">Live Status</th>
                    <th className="py-3 px-4">IP & Network</th>
                    <th className="py-3 px-4">Device & Client</th>
                    <th className="py-3 px-4">Login & Duration</th>
                    <th className="py-3 px-4">Today's Working Tasks / Shift Brief</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E0FB]/60">
                  {filteredSessions.map((s) => {
                    const isSessionActive = s.status === 'ACTIVE';
                    const isTimedOut = s.status === 'TIMEOUT_INACTIVE';
                    return (
                      <tr key={s._id || s.sessionId} className="hover:bg-[#F6F3FF]/60 transition">
                        {/* User Identity */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#7C2CF5]/10 border border-[#7C2CF5]/20 flex items-center justify-center text-[#7C2CF5] font-bold text-xs shrink-0">
                              {(s.fullName || s.email || 'U').substring(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-[#120E24] text-xs truncate">{s.fullName || 'User'}</div>
                              <div className="text-[11px] text-[#585172] truncate">{s.email}</div>
                              <div className="text-[10px] text-[#7C2CF5] font-medium">
                                {s.role || 'MEMBER'} {s.employeeCode ? `• ${s.employeeCode}` : ''}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {isSessionActive && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                              </span>
                              <span>ACTIVE</span>
                            </span>
                          )}
                          {isTimedOut && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>TIMEOUT (15m)</span>
                            </span>
                          )}
                          {s.status === 'LOGGED_OUT' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              <LogOut className="w-3 h-3 text-slate-500" />
                              <span>LOGGED OUT</span>
                            </span>
                          )}
                          {s.status === 'REVOKED' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <PowerOff className="w-3 h-3 text-rose-600" />
                              <span>REVOKED</span>
                            </span>
                          )}
                        </td>

                        {/* IP & Location */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-[#120E24]">
                            <Globe className="w-3.5 h-3.5 text-[#7C2CF5]" />
                            <span>{s.ip || '127.0.0.1'}</span>
                          </div>
                        </td>

                        {/* Device / Client */}
                        <td className="py-3 px-4">
                          <div className="text-xs font-semibold text-[#120E24] flex items-center gap-1.5">
                            <Monitor className="w-3.5 h-3.5 text-[#585172]" />
                            <span>{s.device || 'Desktop'}</span>
                          </div>
                          <div className="text-[10px] text-[#585172] truncate max-w-[140px]">
                            {s.browser || 'Browser'} • {s.os || 'OS'}
                          </div>
                        </td>

                        {/* Login Time & Duration */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="text-xs text-[#120E24] font-medium">
                            {new Date(s.loginAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="text-[10px] text-[#585172]">
                            Duration: {formatDuration(s.sessionDurationMs, s.loginAt, s.lastActiveAt)}
                          </div>
                        </td>

                        {/* Today's Working Tasks / Shift Brief */}
                        <td className="py-3 px-4">
                          <div className="max-w-sm">
                            {s.status === 'LOGGED_OUT' && (
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-purple-50 text-[#7C2CF5] border border-purple-200">
                                  <FileText className="w-2.5 h-2.5" />
                                  <span>MANUAL LOGOUT BRIEF</span>
                                </span>
                              </div>
                            )}
                            {s.status === 'TIMEOUT_INACTIVE' && (
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
                                  <Clock className="w-2.5 h-2.5" />
                                  <span>AUTO-PRESERVED (15M TIMEOUT)</span>
                                </span>
                              </div>
                            )}
                            {s.status === 'ACTIVE' && (
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  <Activity className="w-2.5 h-2.5" />
                                  <span>IN PROGRESS</span>
                                </span>
                              </div>
                            )}

                            <p
                              onClick={() => setSelectedSessionBrief(s)}
                              title="Click to inspect full today's working brief"
                              className="text-xs font-semibold text-[#120E24] line-clamp-2 cursor-pointer hover:text-[#7C2CF5] transition"
                            >
                              {s.todayWorkBrief || s.lastWorkSummary || 'Workspace session without notes'}
                            </p>

                            <button
                              type="button"
                              onClick={() => setSelectedSessionBrief(s)}
                              className="text-[10px] text-[#7C2CF5] hover:underline font-bold mt-1 flex items-center gap-1 cursor-pointer"
                            >
                              <FileText className="w-3 h-3" />
                              <span>Inspect full brief</span>
                              <span>&rarr;</span>
                            </button>
                          </div>
                        </td>

                        {/* Action buttons */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {isSessionActive ? (
                            <button
                              type="button"
                              onClick={() => handleRevokeSession(s.sessionId)}
                              disabled={revokingId === s.sessionId}
                              className="px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 rounded-lg transition cursor-pointer disabled:opacity-50"
                            >
                              {revokingId === s.sessionId ? 'Revoking...' : 'Force Revoke'}
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {filteredSessions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#585172] text-xs">
                        No session records matching filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* General Security & Governance Audit Stream */}
      {(!isLakshay || activeTab === 'audit') && (
        <div className="bg-white rounded-2xl border border-[#E7E0FB] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#E7E0FB] bg-[#F7F5FE]/60 flex items-center justify-between">
            <span className="font-bold text-xs uppercase tracking-wider text-[#120E24]">Audit Stream ({logs.length})</span>
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Append-Only Retention Active</span>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F5FE] text-[#585172] font-semibold border-b border-[#E7E0FB]">
                <tr>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Resource Target</th>
                  <th className="py-3 px-4">Details</th>
                  <th className="py-3 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E0FB]/60">
                {logs.map((log) => (
                  <tr key={log.id || log._id} className="hover:bg-[#F6F3FF]/60 transition">
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-[#7C2CF5] bg-[#F0ECFC] border border-[#E7E0FB] px-2 py-0.5 rounded-lg text-[11px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-[#120E24]">
                      {log.actorEmail || 'System Service'}
                    </td>
                    <td className="py-3 px-4 text-[#585172]">
                      <span className="font-semibold text-[#120E24]">{log.resourceType}</span>{' '}
                      {log.resourceId ? `(${String(log.resourceId).substring(0, 8)}...)` : ''}
                    </td>
                    <td className="py-3 px-4 text-[#585172] font-mono text-[10px] max-w-xs truncate">
                      {log.details || '—'}
                    </td>
                    <td className="py-3 px-4 text-[#585172]/70 text-right">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Modal: Superadmin Lakshay Exclusive Daily Working Brief & Task Inspector */}
      {selectedSessionBrief && (
        <div className="fixed inset-0 bg-[#120E24]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-[#E7E0FB]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E0FB] mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-[#7C2CF5]">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#120E24] text-sm">
                    Today's Working Tasks & Shift Audit
                  </h3>
                  <p className="text-[11px] text-[#585172]">
                    Superadmin Governance Telemetry &bull; Confidential to Lakshay
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSessionBrief(null)}
                className="text-[#585172] hover:text-[#120E24] p-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Employee Summary Card */}
              <div className="p-3.5 bg-[#F7F5FE] rounded-2xl border border-[#E7E0FB] grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-[#585172] font-semibold uppercase">Employee</span>
                  <div className="font-bold text-[#120E24] text-xs mt-0.5">{selectedSessionBrief.fullName || 'User'}</div>
                  <div className="text-[11px] text-[#585172]">{selectedSessionBrief.email}</div>
                  <div className="text-[10px] text-[#7C2CF5] font-semibold mt-0.5">
                    {selectedSessionBrief.role} {selectedSessionBrief.employeeCode ? `• ${selectedSessionBrief.employeeCode}` : ''}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-[#585172] font-semibold uppercase">Session Details</span>
                  <div className="text-[11px] text-[#120E24] font-medium mt-0.5">
                    Login: {new Date(selectedSessionBrief.loginAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="text-[11px] text-[#585172]">
                    Duration: {formatDuration(selectedSessionBrief.sessionDurationMs, selectedSessionBrief.loginAt, selectedSessionBrief.lastActiveAt)}
                  </div>
                  <div className="text-[10px] font-mono text-[#585172] mt-0.5">
                    IP: {selectedSessionBrief.ip || '127.0.0.1'} &bull; {selectedSessionBrief.device || 'Desktop'}
                  </div>
                </div>
              </div>

              {/* Status / Submission Mode */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-[#120E24]">Telemetry Source:</span>
                {selectedSessionBrief.status === 'LOGGED_OUT' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-[#7C2CF5] border border-purple-200">
                    <FileText className="w-3 h-3" />
                    <span>Submitted Manually via Logout Button Brief</span>
                  </span>
                )}
                {selectedSessionBrief.status === 'TIMEOUT_INACTIVE' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    <Clock className="w-3 h-3 text-amber-700" />
                    <span>Auto-Captured by 15-Minute Inactivity Defense</span>
                  </span>
                )}
                {selectedSessionBrief.status === 'ACTIVE' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <Activity className="w-3 h-3 text-emerald-700" />
                    <span>Currently Active Session</span>
                  </span>
                )}
              </div>

              {/* Today's Working Brief Text */}
              <div>
                <label className="block font-bold text-[#120E24] mb-1.5 text-xs">
                  Today's Working Tasks & Activities
                </label>
                <div className="p-4 bg-[#FBFBFE] border border-[#E7E0FB] rounded-2xl text-xs text-[#120E24] leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto font-medium">
                  {selectedSessionBrief.todayWorkBrief || selectedSessionBrief.lastWorkSummary || 'No specific task brief submitted.'}
                </div>
              </div>

              <div className="pt-3 border-t border-[#E7E0FB] flex items-center justify-between">
                <span className="text-[11px] text-[#585172] font-mono">
                  Session ID: {selectedSessionBrief.sessionId}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedSessionBrief(null)}
                  className="px-4 py-2 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl font-bold shadow-xs transition cursor-pointer"
                >
                  Close Inspection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
