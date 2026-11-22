import React, { useEffect, useState, useMemo } from 'react';
import { apiRequest } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { AttendanceRecord, LeaveBalance } from '../../types.js';
import { getSocket } from '../../core/socket.js';
import {
  Users,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  Plus,
  Briefcase,
  Building,
  Check,
  X,
  Trash2,
  Edit2,
  Eye,
  Search,
  Filter,
  Mail,
  Phone,
  Shield,
  ShieldCheck,
  Laptop,
  Globe,
  Smartphone,
  Power,
  DollarSign,
  UserPlus,
  ChevronRight,
  Sparkles,
  Key,
  Layers,
  MapPin,
  Clock4,
  Send,
  EyeOff,
  RefreshCw
} from 'lucide-react';

export const HrmsView: React.FC = () => {
  const { hasRole, isLakshay, session } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [attendanceToday, setAttendanceToday] = useState<AttendanceRecord | null>(null);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Lakshay Exclusive Session Audit Logs State
  const [sessionLogsView, setSessionLogsView] = useState<'directory' | 'sessions'>('directory');
  const [sessionLogs, setSessionLogs] = useState<any[]>([]);
  const [activeSessionCount, setActiveSessionCount] = useState<number>(0);
  const [totalLoginsToday, setTotalLoginsToday] = useState<number>(0);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionFilter, setSessionFilter] = useState<'ALL' | 'ACTIVE' | 'LOGGED_OUT'>('ALL');
  const [sessionSearch, setSessionSearch] = useState('');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Modals & Drawers
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [staff360Employee, setStaff360Employee] = useState<any | null>(null);
  const [addStaffModalOpen, setAddStaffModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);

  // Leave Form State
  const [selectedLeaveTypeId, setSelectedLeaveTypeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [daysCount, setDaysCount] = useState('1');
  const [leaveReason, setLeaveReason] = useState('');

  // Add Staff Member Form State
  const [addFullName, setAddFullName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPersonalEmail, setAddPersonalEmail] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addJobTitle, setAddJobTitle] = useState('');
  const [addDepartment, setAddDepartment] = useState('Engineering & Tech');
  const [addRoleCode, setAddRoleCode] = useState('SDE1');
  const [addEmpCode, setAddEmpCode] = useState('');
  const [addManager, setAddManager] = useState('');
  const [addSalary, setAddSalary] = useState('');
  const [addShift, setAddShift] = useState('');
  const [addStatus, setAddStatus] = useState('ACTIVE');
  const [addPassword, setAddPassword] = useState('');
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Edit Staff Member Form State
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPersonalEmail, setEditPersonalEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editJobTitle, setEditJobTitle] = useState('');
  const [editDepartment, setEditDepartment] = useState('Engineering & Tech');
  const [editRoleCode, setEditRoleCode] = useState('SDE1');
  const [editEmpCode, setEditEmpCode] = useState('');
  const [editManager, setEditManager] = useState('');
  const [editSalary, setEditSalary] = useState('');
  const [editShift, setEditShift] = useState('');
  const [editStatus, setEditStatus] = useState('ACTIVE');
  const [editPassword, setEditPassword] = useState('');
  const [editSendEmail, setEditSendEmail] = useState(true);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [isDispatchingCreds, setIsDispatchingCreds] = useState(false);
  const [credDispatchStatus, setCredDispatchStatus] = useState<string | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const loadData = async () => {
    try {
      const [empData, attData, balData, reqData] = await Promise.all([
        apiRequest<any[]>('/hrms/employees'),
        apiRequest<AttendanceRecord | null>('/hrms/attendance/today'),
        apiRequest<LeaveBalance[]>('/hrms/leave/balances'),
        apiRequest<any[]>('/hrms/leave/requests')
      ]);
      setEmployees(empData);
      setAttendanceToday(attData);
      setLeaveBalances(balData);
      setLeaveRequests(reqData);
      if (balData.length > 0 && !selectedLeaveTypeId) {
        setSelectedLeaveTypeId(balData[0].leaveTypeId);
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
    socket.emit('join_hrms');

    // High-speed granular real-time socket listeners for 0ms multi-client synchronization
    const onEmployeeUpdated = (payload: any) => {
      if (!payload?.employee) return;
      const updated = payload.employee;
      setEmployees((prev) =>
        prev.map((e) => (e.id === updated.id || e._id === updated.id ? { ...e, ...updated } : e))
      );
      setStaff360Employee((prev: any) =>
        prev && (prev.id === updated.id || prev._id === updated.id) ? { ...prev, ...updated } : prev
      );
    };

    const onEmployeeCreated = (payload: any) => {
      if (!payload?.employee) return;
      const created = payload.employee;
      setEmployees((prev) => {
        if (prev.some((e) => e.id === created.id || e._id === created.id)) return prev;
        return [created, ...prev];
      });
    };

    const onEmployeeDeleted = (payload: any) => {
      if (!payload?.employeeId) return;
      setEmployees((prev) => prev.filter((e) => e.id !== payload.employeeId && e._id !== payload.employeeId));
      setStaff360Employee((prev: any) => (prev?.id === payload.employeeId ? null : prev));
      setSelectedEmployeeIds((prev) => prev.filter((id) => id !== payload.employeeId));
    };

    const onEmployeesBatchDeleted = (payload: any) => {
      if (!payload?.employeeIds || !Array.isArray(payload.employeeIds)) return;
      setEmployees((prev) =>
        prev.filter((e) => !payload.employeeIds.includes(e.id) && !payload.employeeIds.includes(e._id))
      );
      setStaff360Employee((prev: any) => (payload.employeeIds.includes(prev?.id) ? null : prev));
      setSelectedEmployeeIds((prev) => prev.filter((id) => !payload.employeeIds.includes(id)));
    };

    const onAttendancePunched = (payload: any) => {
      if (!payload?.record) return;
      const rec = payload.record;
      // Update logged-in user attendance if it matches
      setAttendanceToday((prev) => {
        if (!prev) return rec;
        return { ...prev, ...rec };
      });
      // Update employee row in table in 0ms
      setEmployees((prev) =>
        prev.map((e) => {
          if (e.id === rec.employeeId || e._id === rec.employeeId) {
            return {
              ...e,
              todayAttendance: {
                status: rec.status,
                checkInTime: rec.checkInTime,
                checkOutTime: rec.checkOutTime
              }
            };
          }
          return e;
        })
      );
    };

    const onLeaveApplied = (payload: any) => {
      if (!payload?.leave) return;
      setLeaveRequests((prev) => [payload.leave, ...prev]);
    };

    const onLeaveApproved = (payload: any) => {
      if (!payload?.requestId) return;
      setLeaveRequests((prev) =>
        prev.map((l) => (l.id === payload.requestId || l._id === payload.requestId ? { ...l, status: payload.status } : l))
      );
    };

    const onLeaveDeleted = (payload: any) => {
      if (!payload?.requestId) return;
      setLeaveRequests((prev) =>
        prev.filter((l) => l.id !== payload.requestId && l._id !== payload.requestId)
      );
    };

    socket.on('hrms:attendance_punched', onAttendancePunched);
    socket.on('hrms:leave_applied', onLeaveApplied);
    socket.on('hrms:leave_approved', onLeaveApproved);
    socket.on('hrms:employee_created', onEmployeeCreated);
    socket.on('hrms:employee_updated', onEmployeeUpdated);
    socket.on('hrms:employee_deleted', onEmployeeDeleted);
    socket.on('hrms:employees_batch_deleted', onEmployeesBatchDeleted);
    socket.on('hrms:leave_deleted', onLeaveDeleted);

    return () => {
      socket.off('hrms:attendance_punched', onAttendancePunched);
      socket.off('hrms:leave_applied', onLeaveApplied);
      socket.off('hrms:leave_approved', onLeaveApproved);
      socket.off('hrms:employee_created', onEmployeeCreated);
      socket.off('hrms:employee_updated', onEmployeeUpdated);
      socket.off('hrms:employee_deleted', onEmployeeDeleted);
      socket.off('hrms:employees_batch_deleted', onEmployeesBatchDeleted);
      socket.off('hrms:leave_deleted', onLeaveDeleted);
    };
  }, []);

  // SuperAdmin Lakshay Session Logs Fetcher
  const loadSessionLogs = async () => {
    if (!isLakshay) return;
    setLoadingSessions(true);
    try {
      const res: any = await apiRequest('/hrms/session-audit-logs');
      if (res?.data) {
        setSessionLogs(res.data.sessions || []);
        setActiveSessionCount(res.data.activeCount || 0);
        setTotalLoginsToday(res.data.totalToday || 0);
      }
    } catch {
      // not authorized
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    if (isLakshay && sessionLogsView === 'sessions') {
      loadSessionLogs();
    }
  }, [isLakshay, sessionLogsView]);

  useEffect(() => {
    if (!isLakshay) return;
    const socket = getSocket();
    const handleSessionRefresh = () => {
      loadSessionLogs();
    };
    socket.on('session:revoked', handleSessionRefresh);
    socket.on('session:logged_out', handleSessionRefresh);
    return () => {
      socket.off('session:revoked', handleSessionRefresh);
      socket.off('session:logged_out', handleSessionRefresh);
    };
  }, [isLakshay]);

  const handleRevokeSession = async (sessionId: string, userEmail: string) => {
    if (!window.confirm(`Force terminate the active session for ${userEmail}? The employee will be immediately logged out.`)) return;

    // Optimistically update status to REVOKED in 0ms
    setSessionLogs((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, status: 'REVOKED', logoutAt: new Date().toISOString() } : s))
    );
    setActiveSessionCount((prev) => Math.max(0, prev - 1));

    try {
      await apiRequest(`/hrms/session-audit-logs/${sessionId}/revoke`, { method: 'POST' });
    } catch (err: any) {
      alert(err.message || 'Failed revoking session');
      loadSessionLogs();
    }
  };

  const formatDuration = (loginAtStr?: string, logoutAtStr?: string): string => {
    if (!loginAtStr) return 'N/A';
    const login = new Date(loginAtStr).getTime();
    const end = logoutAtStr ? new Date(logoutAtStr).getTime() : Date.now();
    const diffSec = Math.max(0, Math.floor((end - login) / 1000));
    if (diffSec < 60) return `${diffSec}s`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m`;
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    return `${hours}h ${mins}m`;
  };

  // Multi-Select Handlers
  const handleToggleSelectAllEmployees = () => {
    if (selectedEmployeeIds.length === filteredEmployees.length && filteredEmployees.length > 0) {
      setSelectedEmployeeIds([]);
    } else {
      setSelectedEmployeeIds(filteredEmployees.map((e) => e.id));
    }
  };

  const handleToggleSelectOneEmployee = (id: string) => {
    setSelectedEmployeeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // Delete Handlers with Optimistic Instant Execution
  const handleDeleteEmployee = async (id: string, name: string) => {
    if (!isLakshay) {
      alert('Security Violation: Only Lakshay (Founder & SuperAdmin) is authorized to delete staff records.');
      return;
    }
    if (!window.confirm(`Are you sure you want to permanently delete employee "${name}"? This action removes database records and linked credentials.`)) return;

    // Optimistically remove from state in 0ms
    setEmployees((prev) => prev.filter((x) => x.id !== id && x._id !== id));
    setSelectedEmployeeIds((prev) => prev.filter((x) => x !== id));
    if (staff360Employee?.id === id) setStaff360Employee(null);

    try {
      await apiRequest(`/hrms/employees/${id}`, { method: 'DELETE' });
    } catch (err: any) {
      alert(err.message || 'Error deleting employee');
      loadData(); // rollback
    }
  };

  const handleBatchDeleteEmployees = async () => {
    if (!isLakshay || selectedEmployeeIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete ${selectedEmployeeIds.length} selected employee profile(s)?`)) return;

    const toDelete = [...selectedEmployeeIds];
    // Optimistically remove from state in 0ms
    setEmployees((prev) => prev.filter((e) => !toDelete.includes(e.id) && !toDelete.includes(e._id)));
    setSelectedEmployeeIds([]);
    if (staff360Employee && toDelete.includes(staff360Employee.id)) {
      setStaff360Employee(null);
    }

    try {
      await apiRequest('/hrms/employees/batch-delete', {
        method: 'POST',
        body: JSON.stringify({ employeeIds: toDelete })
      });
    } catch (err: any) {
      alert(err.message || 'Error deleting selected employees');
      loadData(); // rollback
    }
  };

  const handleDeleteLeaveRequest = async (id: string) => {
    if (!isLakshay) return;
    if (!window.confirm('Are you sure you want to delete this leave request?')) return;

    // Optimistic deletion in 0ms
    setLeaveRequests((prev) => prev.filter((l) => l.id !== id && l._id !== id));

    try {
      await apiRequest(`/hrms/leave/requests/${id}`, { method: 'DELETE' });
    } catch (err: any) {
      alert(err.message || 'Error deleting leave request');
      loadData(); // rollback
    }
  };

  // Clock in/out with Optimistic Immediate Execution
  const handleClockIn = async () => {
    const nowIso = new Date().toISOString();
    const isLate = new Date().getHours() > 10;
    const optimisticAtt = {
      status: isLate ? 'LATE' : 'PRESENT',
      checkInTime: nowIso
    };
    // Optimistic instant state update in 0ms
    setAttendanceToday(optimisticAtt as any);
    const userEmail = (session?.user?.email || '').toLowerCase();
    if (userEmail) {
      setEmployees((prev) =>
        prev.map((e) => {
          if ((e.email || '').toLowerCase() === userEmail) {
            return { ...e, todayAttendance: optimisticAtt };
          }
          return e;
        })
      );
    }

    try {
      const rec = await apiRequest('/hrms/attendance/clock-in', { method: 'POST' });
      setAttendanceToday(rec);
    } catch (err: any) {
      alert(err.message || 'Error clocking in');
      loadData();
    }
  };

  const handleClockOut = async () => {
    const nowIso = new Date().toISOString();
    setAttendanceToday((prev) => (prev ? { ...prev, checkOutTime: nowIso } : null));

    try {
      const rec = await apiRequest('/hrms/attendance/clock-out', { method: 'POST' });
      setAttendanceToday(rec);
    } catch (err: any) {
      alert(err.message || 'Error clocking out');
      loadData();
    }
  };

  // Leave Handlers with Optimistic Updates
  const handleRequestLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    const newReqPayload = {
      leaveTypeId: selectedLeaveTypeId,
      startDate,
      endDate,
      daysCount: Number(daysCount),
      reason: leaveReason
    };
    setLeaveModalOpen(false);
    setLeaveReason('');
    setStartDate('');
    setEndDate('');

    try {
      const res: any = await apiRequest('/hrms/leave/requests', {
        method: 'POST',
        body: JSON.stringify(newReqPayload)
      });
      if (res?.data) {
        setLeaveRequests((prev) => [res.data, ...prev.filter((l) => l.id !== res.data.id)]);
      }
    } catch (err: any) {
      alert(err.message || 'Error requesting leave');
      loadData();
    }
  };

  const handleApproveLeave = async (requestId: string) => {
    setLeaveRequests((prev) =>
      prev.map((l) => (l.id === requestId || l._id === requestId ? { ...l, status: 'APPROVED' } : l))
    );
    try {
      await apiRequest(`/hrms/leave/requests/${requestId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ notes: 'Approved by authorized manager' })
      });
    } catch (err: any) {
      alert(err.message || 'Approval error');
      loadData();
    }
  };

  // Open Edit Modal with Pre-filled Data
  const openEditEmployeeModal = (emp: any) => {
    setEditingEmployee(emp);
    setEditFullName(emp.fullName || emp.membership?.user?.fullName || '');
    setEditEmail(emp.email || emp.membership?.user?.primaryEmail || '');
    setEditPersonalEmail(emp.personalEmail || '');
    setEditPhone(emp.phone || emp.membership?.user?.phone || '');
    setEditJobTitle(emp.jobTitle || '');
    setEditDepartment(emp.department || 'Engineering & Tech');
    setEditRoleCode(emp.roleCode || emp.membership?.roles?.[0] || 'EMPLOYEE');
    setEditEmpCode(emp.employeeCode || '');
    setEditManager(emp.reportingManagerName || '');
    setEditSalary(emp.salary || '');
    setEditShift(emp.shift || '');
    setEditStatus(emp.employmentStatus || 'ACTIVE');
    setEditPassword('');
    setEditSendEmail(true);
    setShowEditPassword(false);
    setCredDispatchStatus(null);
  };

  // Create Staff Submission
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addFullName.trim() || !addEmail.trim()) {
      alert('Full Name and Login Email are required.');
      return;
    }
    setIsSubmittingAdd(true);
    try {
      const res: any = await apiRequest('/hrms/employees', {
        method: 'POST',
        body: JSON.stringify({
          fullName: addFullName.trim(),
          email: addEmail.trim(),
          personalEmail: addPersonalEmail.trim(),
          phone: addPhone.trim(),
          jobTitle: addJobTitle.trim() || 'Team Member',
          department: addDepartment,
          roleCode: addRoleCode,
          employeeCode: addEmpCode.trim(),
          reportingManagerName: addManager.trim(),
          salary: addSalary.trim(),
          shift: addShift.trim(),
          employmentStatus: addStatus,
          password: addPassword.trim() || undefined
        })
      });
      setAddStaffModalOpen(false);
      if (res?.data) {
        setEmployees((prev) => [res.data, ...prev.filter((e) => e.id !== res.data.id && e._id !== res.data.id)]);
      }
      // Reset form
      setAddFullName('');
      setAddEmail('');
      setAddPersonalEmail('');
      setAddPhone('');
      setAddJobTitle('');
      setAddEmpCode('');
      setAddManager('');
      setAddSalary('');
      setAddShift('');
    } catch (err: any) {
      alert(err.message || 'Error creating staff profile');
      loadData();
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Edit Staff Submission with 0ms Optimistic UI
  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    const targetId = editingEmployee.id;
    const optimisticEmp = {
      fullName: editFullName.trim(),
      email: editEmail.trim(),
      personalEmail: editPersonalEmail.trim(),
      phone: editPhone.trim(),
      jobTitle: editJobTitle.trim(),
      department: editDepartment,
      roleCode: editRoleCode,
      employeeCode: editEmpCode.trim(),
      reportingManagerName: editManager.trim(),
      salary: editSalary.trim(),
      shift: editShift.trim(),
      employmentStatus: editStatus
    };

    // Instant local update (0ms response time)
    setEmployees((prev) =>
      prev.map((emp) => (emp.id === targetId || emp._id === targetId ? { ...emp, ...optimisticEmp } : emp))
    );
    if (staff360Employee?.id === targetId || staff360Employee?._id === targetId) {
      setStaff360Employee((prev: any) => ({ ...prev, ...optimisticEmp }));
    }

    const newPassword = editPassword.trim();
    const sendEmailFlag = editSendEmail && isLakshay;
    setEditingEmployee(null); // Instantly close modal

    try {
      const res: any = await apiRequest(`/hrms/employees/${targetId}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...optimisticEmp,
          password: newPassword || undefined,
          sendCredentialsEmail: sendEmailFlag
        })
      });
      if (res?.data) {
        setEmployees((prev) =>
          prev.map((emp) => (emp.id === targetId || emp._id === targetId ? { ...emp, ...res.data } : emp))
        );
      }
    } catch (err: any) {
      alert(err.message || 'Error updating staff profile');
      loadData(); // rollback
    }
  };

  // Direct dispatch credentials now via Superadmin action
  const handleDispatchCredentialsNow = async () => {
    if (!editingEmployee) return;
    if (!editEmail.trim() && !editPersonalEmail.trim()) {
      alert('Please provide an official or personal email address to dispatch credentials.');
      return;
    }
    setIsDispatchingCreds(true);
    setCredDispatchStatus(null);
    try {
      const res: any = await apiRequest(`/hrms/employees/${editingEmployee.id}/dispatch-credentials`, {
        method: 'POST',
        body: JSON.stringify({
          password: editPassword.trim() || undefined
        })
      });
      setCredDispatchStatus(res.message || 'Credentials successfully dispatched!');
      alert(res.message || 'Login credentials sent to employee via email!');
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch credentials email.');
      setCredDispatchStatus(`Error: ${err.message}`);
    } finally {
      setIsDispatchingCreds(false);
    }
  };

  const generateStrongPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let pwd = 'CodRix@';
    for (let i = 0; i < 6; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setEditPassword(pwd);
    setShowEditPassword(true);
  };

  // Filtered staff list
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const name = (emp.fullName || emp.membership?.user?.fullName || '').toLowerCase();
      const email = (emp.email || emp.membership?.user?.primaryEmail || '').toLowerCase();
      const code = (emp.employeeCode || '').toLowerCase();
      const job = (emp.jobTitle || '').toLowerCase();
      const dept = (emp.department || '').toLowerCase();

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          name.includes(q) || email.includes(q) || code.includes(q) || job.includes(q) || dept.includes(q);
        if (!matches) return false;
      }

      if (filterDepartment !== 'ALL') {
        if (emp.department !== filterDepartment) return false;
      }

      if (filterStatus !== 'ALL') {
        if (emp.employmentStatus !== filterStatus) return false;
      }

      return true;
    });
  }, [employees, searchQuery, filterDepartment, filterStatus]);

  // Filtered session logs for Lakshay exclusive view
  const filteredSessionLogs = useMemo(() => {
    return sessionLogs.filter((s) => {
      const matchesFilter =
        sessionFilter === 'ALL' ||
        (sessionFilter === 'ACTIVE' && s.status === 'ACTIVE') ||
        (sessionFilter === 'LOGGED_OUT' && (s.status === 'LOGGED_OUT' || s.status === 'REVOKED'));

      const query = sessionSearch.toLowerCase().trim();
      const matchesQuery =
        !query ||
        (s.fullName || '').toLowerCase().includes(query) ||
        (s.userEmail || '').toLowerCase().includes(query) ||
        (s.employeeCode || '').toLowerCase().includes(query) ||
        (s.ipAddress || '').toLowerCase().includes(query) ||
        (s.role || '').toLowerCase().includes(query);

      return matchesFilter && matchesQuery;
    });
  }, [sessionLogs, sessionFilter, sessionSearch]);

  // Unique departments for filter
  const departmentsList = [
    'Executive & Strategy',
    'People & HR',
    'Growth & Partnerships',
    'Engineering & Tech',
    'Operations & Governance',
    'General Operations'
  ];

  return (
    <div className="space-y-6 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-3xl border border-[#E7E0FB] shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-extrabold text-[#120E24] tracking-tight">
              HRMS, Attendance & Leave Management
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EDE4FF] text-[#7C2CF5] border border-[#DDD0FE]">
              {employees.length} Active Staff Members
            </span>
          </div>
          <p className="text-xs text-[#585172] mt-1">
            Complete Live Staff Directory, Attendance Records, and Leave Workflows • Synchronized with MongoDB Atlas
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* SuperAdmin Lakshay Exclusive View Switcher */}
          {isLakshay && (
            <div className="bg-[#F7F5FE] p-1 rounded-xl border border-[#E7E0FB] flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSessionLogsView('directory')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  sessionLogsView === 'directory'
                    ? 'bg-white text-[#7C2CF5] shadow-xs'
                    : 'text-[#585172] hover:text-[#120E24]'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Staff & Attendance</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSessionLogsView('sessions');
                  loadSessionLogs();
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  sessionLogsView === 'sessions'
                    ? 'bg-gradient-to-r from-[#7C2CF5] to-[#6D25D9] text-white shadow-xs'
                    : 'text-[#585172] hover:text-[#120E24]'
                }`}
                title="Superadmin Exclusive: View real-time staff login, logout, IP, device & session security telemetry"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Login & Session Audit</span>
                {activeSessionCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-emerald-400 text-emerald-950 font-black rounded-full text-[9px] animate-pulse">
                    {activeSessionCount} Active
                  </span>
                )}
              </button>
            </div>
          )}

          {isLakshay && (
            <button
              onClick={() => {
                const nextNum = employees.length + 1;
                setAddEmpCode(`CDX-${nextNum.toString().padStart(3, '0')}`);
                setAddStaffModalOpen(true);
              }}
              className="px-4 py-2 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-[#7C2CF5]/25 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Add Staff Member</span>
            </button>
          )}
        </div>
      </div>

      {sessionLogsView === 'directory' ? (
        <>
          {/* 2. Top Widgets: Attendance Clock & Leave Balances */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Punch Clock */}
        <div className="bg-white p-6 rounded-2xl border border-[#E7E0FB] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#585172]">
                Attendance Punch Clock
              </span>
              <Clock className="w-4 h-4 text-[#7C2CF5]" />
            </div>
            <div className="text-sm font-bold text-[#120E24] mb-1">
              Date: {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
            <div className="text-xs text-[#585172]">
              {attendanceToday?.checkInTime ? (
                <span className="text-emerald-600 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Clocked In at {new Date(attendanceToday.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              ) : (
                <span className="text-amber-600 font-semibold flex items-center gap-1">
                  <XCircle className="w-4 h-4" /> Not clocked in yet today
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={handleClockIn}
              disabled={!!attendanceToday?.checkInTime}
              className="flex-1 py-2 rounded-xl text-xs font-bold bg-[#7C2CF5] hover:bg-[#6D25D9] text-white disabled:opacity-50 transition shadow-xs cursor-pointer"
            >
              Punch Clock-In
            </button>
            <button
              onClick={handleClockOut}
              disabled={!attendanceToday?.checkInTime || !!attendanceToday?.checkOutTime}
              className="flex-1 py-2 rounded-xl text-xs font-bold bg-[#F0ECFC] hover:bg-[#EDE4FF] text-[#7C2CF5] border border-[#E7E0FB] disabled:opacity-50 transition cursor-pointer"
            >
              Punch Clock-Out
            </button>
          </div>
        </div>

        {/* Leave Balances */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-[#E7E0FB] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#7C2CF5]" />
              <span className="font-bold text-[#120E24] text-xs uppercase tracking-wider">Your Leave Balances</span>
            </div>
            <button
              onClick={() => setLeaveModalOpen(true)}
              className="px-3.5 py-1.5 bg-[#F5F0FF] hover:bg-[#EDE4FF] text-[#7C2CF5] border border-[#DDD0FE] rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Apply for Leave</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {leaveBalances.map((b) => (
              <div key={b.id} className="p-4 bg-[#F7F5FE] border border-[#E7E0FB] rounded-xl space-y-1">
                <div className="text-xs font-bold text-[#120E24]">{b.leaveType.name}</div>
                <div className="text-2xl font-extrabold text-[#120E24]">
                  {b.totalDays - b.usedDays - b.pendingDays} <span className="text-xs font-normal text-[#585172]">days left</span>
                </div>
                <div className="text-[10px] text-[#585172] font-semibold">
                  Used: {b.usedDays} &bull; Pending: {b.pendingDays}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Leave Requests Queue */}
      <div className="bg-white rounded-2xl border border-[#E7E0FB] shadow-xs p-5 space-y-3">
        <h3 className="font-bold text-xs uppercase tracking-wider text-[#120E24]">Leave Requests Queue</h3>

        <div className="divide-y divide-[#E7E0FB]/60">
          {leaveRequests.length === 0 ? (
            <div className="py-6 text-center text-xs text-[#585172]">No active leave requests in MongoDB.</div>
          ) : (
            leaveRequests.map((req) => (
              <div key={req.id} className="py-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-2 text-xs">
                <div>
                  <div className="font-bold text-[#120E24]">
                    {req.employee?.membership?.user?.fullName || req.employee?.fullName} &bull; <span className="text-[#7C2CF5]">{req.leaveType.name}</span> ({req.daysCount} days)
                  </div>
                  <div className="text-[#585172] text-[11px] mt-0.5">
                    From: {new Date(req.startDate).toLocaleDateString()} to {new Date(req.endDate).toLocaleDateString()} &bull; Reason: {req.reason}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      req.status === 'APPROVED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : req.status === 'REJECTED'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {req.status}
                  </span>

                  {req.status === 'PENDING' && hasRole('COMPANY_ADMIN', 'HR_MANAGER', 'BRANCH_MANAGER') && (
                    <button
                      onClick={() => handleApproveLeave(req.id)}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <Check className="w-3 h-3" />
                      <span>Approve</span>
                    </button>
                  )}

                  {isLakshay && (
                    <button
                      type="button"
                      onClick={() => handleDeleteLeaveRequest(req.id)}
                      className="p-1.5 text-[#585172] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      title="Delete Leave Request (Founder Only)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 4. Batch Action Floating Bar for Lakshay (Employee Deletion) */}
      {isLakshay && selectedEmployeeIds.length > 0 && (
        <div className="bg-[#120E24] text-white px-5 py-3 rounded-2xl shadow-xl flex items-center justify-between border border-[#302B47] animate-in fade-in">
          <div className="flex items-center gap-3">
            <span className="bg-[#7C2CF5] text-white text-xs font-bold px-2.5 py-1 rounded-lg">
              {selectedEmployeeIds.length} Staff Selected
            </span>
            <span className="text-xs text-[#A29DB8]">
              Select staff profiles for batch management or permanent deletion from MongoDB.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedEmployeeIds([])}
              className="text-xs text-[#A29DB8] hover:text-white px-3 py-1.5 rounded-lg transition cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleBatchDeleteEmployees}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-600/30 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected ({selectedEmployeeIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* 5. Comprehensive Live Staff Directory */}
      <div className="bg-white rounded-2xl border border-[#E7E0FB] shadow-xs overflow-hidden">
        {/* Directory Controls & Filters */}
        <div className="p-4 border-b border-[#E7E0FB] bg-[#F7F5FE]/70 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#7C2CF5]" />
              <span className="font-extrabold text-xs uppercase tracking-wider text-[#120E24]">
                Live Staff Directory ({filteredEmployees.length})
              </span>
            </div>
            {isLakshay && (
              <span className="text-[10px] text-[#7C2CF5] font-bold bg-[#EDE4FF] px-2.5 py-0.5 rounded-full border border-[#DDD0FE]">
                Founder Full CRUD Enabled
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-[#585172] absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search staff by name, email, code, role..."
                className="w-full bg-white border border-[#E7E0FB] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
              />
            </div>

            {/* Department Filter */}
            <div className="flex items-center gap-1 text-xs">
              <Filter className="w-3.5 h-3.5 text-[#585172]" />
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="bg-white border border-[#E7E0FB] rounded-xl px-2.5 py-1.5 text-xs text-[#120E24] font-semibold focus:outline-none focus:border-[#7C2CF5]"
              >
                <option value="ALL">All Departments</option>
                {departmentsList.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-white border border-[#E7E0FB] rounded-xl px-2.5 py-1.5 text-xs text-[#120E24] font-semibold focus:outline-none focus:border-[#7C2CF5]"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="PROBATION">PROBATION</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>
        </div>

        {/* Directory Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F7F5FE] text-[#585172] font-bold border-b border-[#E7E0FB]">
              <tr>
                {isLakshay && (
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={filteredEmployees.length > 0 && selectedEmployeeIds.length === filteredEmployees.length}
                      onChange={handleToggleSelectAllEmployees}
                      className="w-4 h-4 rounded text-[#7C2CF5] accent-[#7C2CF5] cursor-pointer"
                      title="Select all staff"
                    />
                  </th>
                )}
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Code & Role</th>
                <th className="py-3 px-4">Department & Job Title</th>
                <th className="py-3 px-4">Shift & Manager</th>
                <th className="py-3 px-4">Compensation</th>
                <th className="py-3 px-4">Attendance</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E0FB]/60">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={isLakshay ? 9 : 8} className="py-12 text-center text-[#585172]">
                    <Users className="w-8 h-8 text-[#DDD0FE] mx-auto mb-2" />
                    <p className="font-bold text-[#120E24]">No staff records match your query</p>
                    <p className="text-[11px] mt-1">Adjust your filters or add a new staff member to the directory.</p>
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => {
                  const fullName = emp.fullName || emp.membership?.user?.fullName || 'Staff Member';
                  const email = emp.email || emp.membership?.user?.primaryEmail || '';
                  const initials = fullName
                    .split(' ')
                    .map((n: string) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <tr key={emp.id} className="hover:bg-[#F7F5FE]/60 transition">
                      {isLakshay && (
                        <td className="py-3.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedEmployeeIds.includes(emp.id)}
                            onChange={() => handleToggleSelectOneEmployee(emp.id)}
                            className="w-4 h-4 rounded text-[#7C2CF5] accent-[#7C2CF5] cursor-pointer"
                          />
                        </td>
                      )}

                      {/* Staff Avatar & Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#7C2CF5] to-[#9D54FF] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                            {initials}
                          </div>
                          <div>
                            <button
                              onClick={() => setStaff360Employee(emp)}
                              className="font-bold text-[#120E24] hover:text-[#7C2CF5] text-left transition"
                            >
                              {fullName}
                            </button>
                            <div className="text-[11px] text-[#585172] flex items-center gap-1">
                              <span>{email}</span>
                              {emp.phone && <span>&bull; {emp.phone}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Code & Role Code */}
                      <td className="py-3 px-4">
                        <div className="font-mono font-extrabold text-[#7C2CF5] text-xs">{emp.employeeCode}</div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#EDE4FF] text-[#7C2CF5] inline-block mt-0.5">
                          {emp.roleCode || emp.membership?.roles?.[0] || 'EMPLOYEE'}
                        </span>
                      </td>

                      {/* Department & Job Title */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#120E24] text-xs">{emp.jobTitle}</div>
                        <div className="text-[11px] text-[#585172] font-medium">{emp.department}</div>
                      </td>

                      {/* Shift & Manager */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#120E24] text-[11px] flex items-center gap-1">
                          <Clock4 className="w-3 h-3 text-[#7C2CF5]" />
                          <span>{emp.shift || '—'}</span>
                        </div>
                        <div className="text-[10px] text-[#585172] mt-0.5">
                          Mgr: {emp.reportingManagerName || '—'}
                        </div>
                      </td>

                      {/* Salary / Comp */}
                      <td className="py-3 px-4 font-mono font-bold text-[#120E24]">
                        {emp.salary || '—'}
                      </td>

                      {/* Today Attendance */}
                      <td className="py-3 px-4">
                        {emp.todayAttendance ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200 flex items-center gap-1 w-fit">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>{emp.todayAttendance.status}</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-semibold w-fit">
                            Not Punched
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                          {emp.employmentStatus}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View 360 Drawer */}
                          <button
                            type="button"
                            onClick={() => setStaff360Employee(emp)}
                            className="px-2.5 py-1 bg-[#F0ECFC] hover:bg-[#EDE4FF] text-[#7C2CF5] border border-[#E7E0FB] font-bold rounded-lg text-[11px] inline-flex items-center gap-1 transition cursor-pointer"
                            title="View Full Profile & MongoDB Attributes"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View 360</span>
                          </button>

                          {/* Founder Edit */}
                          {isLakshay && (
                            <button
                              type="button"
                              onClick={() => openEditEmployeeModal(emp)}
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold rounded-lg text-[11px] inline-flex items-center gap-1 transition cursor-pointer"
                              title="Modify / Edit Employee Records (Founder Only)"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                          )}

                          {/* Founder Delete */}
                          {isLakshay && (
                            <button
                              type="button"
                              onClick={() => handleDeleteEmployee(emp.id, fullName)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold rounded-lg text-[11px] inline-flex items-center gap-1 transition cursor-pointer"
                              title="Permanently Delete Staff Record (Founder Only)"
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

        {/* Directory Footer */}
        <div className="p-3.5 border-t border-[#E7E0FB] bg-[#F7F5FE] flex items-center justify-between text-xs text-[#585172]">
          <span>
            Showing <strong>{filteredEmployees.length}</strong> of {employees.length} live employees
          </span>
          <span className="font-semibold text-[#7C2CF5]">
            Real-time MongoDB Atlas Directory Sync Active
          </span>
        </div>
      </div>
    </>
  ) : (
    <div className="space-y-6">
      {/* ============================================================== */}
      {/* SUPERADMIN LAKSHAY EXCLUSIVE: EMS LIVE SESSION & LOGIN AUDIT */}
      {/* ============================================================== */}

      {/* 1. Security Telemetry Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Staff */}
        <div className="bg-white p-5 rounded-2xl border border-[#E7E0FB] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#585172]">
              Active Logged-In Staff
            </span>
            <div className="text-2xl font-black text-[#120E24] mt-1 flex items-center gap-2">
              <span>{activeSessionCount}</span>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Live Now</span>
              </span>
            </div>
            <p className="text-[10px] text-[#585172] mt-1 font-medium">
              Currently authenticated with HTTP-only cookie
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Total Sessions Today */}
        <div className="bg-white p-5 rounded-2xl border border-[#E7E0FB] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#585172]">
              Total Logins Today
            </span>
            <div className="text-2xl font-black text-[#120E24] mt-1">
              {totalLoginsToday}
            </div>
            <p className="text-[10px] text-[#585172] mt-1 font-medium">
              Audited logins stored in MongoDB Atlas
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#F0ECFC] border border-[#D8C7F8] text-[#7C2CF5] flex items-center justify-center">
            <Clock4 className="w-6 h-6" />
          </div>
        </div>

        {/* Security Cookie Protocol */}
        <div className="bg-white p-5 rounded-2xl border border-[#E7E0FB] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#585172]">
              Cookie Protocol
            </span>
            <div className="text-sm font-black text-emerald-700 mt-1 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>HTTP-Only & Secure</span>
            </div>
            <p className="text-[10px] text-[#585172] mt-1 font-medium">
              Token protected against XSS & script theft
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
            <Key className="w-6 h-6" />
          </div>
        </div>

        {/* Real-time Telemetry Bus */}
        <div className="bg-white p-5 rounded-2xl border border-[#E7E0FB] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#585172]">
              Live Real-Time Bus
            </span>
            <div className="text-sm font-black text-[#7C2CF5] mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#7C2CF5] animate-ping"></span>
              <span>Socket.IO Sync Active</span>
            </div>
            <p className="text-[10px] text-[#585172] mt-1 font-medium">
              Instant revocation broadcast & telemetry
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#F7F5FE] border border-[#E7E0FB] text-[#7C2CF5] flex items-center justify-center">
            <Globe className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 2. Control Bar: Search & Status Filters */}
      <div className="bg-white p-4 rounded-2xl border border-[#E7E0FB] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#585172] absolute left-3.5 top-3" />
          <input
            type="text"
            value={sessionSearch}
            onChange={(e) => setSessionSearch(e.target.value)}
            placeholder="Search by staff name, official email, employee code, IP address or role..."
            className="w-full pl-9 pr-4 py-2 bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl text-xs text-[#120E24] placeholder-[#8B849E] focus:outline-none focus:border-[#7C2CF5]"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="bg-[#F7F5FE] p-1 rounded-xl border border-[#E7E0FB] flex items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => setSessionFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                sessionFilter === 'ALL'
                  ? 'bg-white text-[#7C2CF5] shadow-xs'
                  : 'text-[#585172] hover:text-[#120E24]'
              }`}
            >
              All Records ({sessionLogs.length})
            </button>
            <button
              type="button"
              onClick={() => setSessionFilter('ACTIVE')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                sessionFilter === 'ACTIVE'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-[#585172] hover:text-[#120E24]'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>Active ({activeSessionCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setSessionFilter('LOGGED_OUT')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                sessionFilter === 'LOGGED_OUT'
                  ? 'bg-white text-[#7C2CF5] shadow-xs'
                  : 'text-[#585172] hover:text-[#120E24]'
              }`}
            >
              Logged Out / Revoked
            </button>
          </div>

          <button
            type="button"
            onClick={loadSessionLogs}
            disabled={loadingSessions}
            className="p-2 border border-[#E7E0FB] hover:bg-[#F7F5FE] text-[#585172] rounded-xl transition cursor-pointer disabled:opacity-50"
            title="Refresh session telemetry"
          >
            <RefreshCw className={`w-4 h-4 ${loadingSessions ? 'animate-spin text-[#7C2CF5]' : ''}`} />
          </button>
        </div>
      </div>

      {/* 3. Session Audit Log Table */}
      <div className="bg-white rounded-2xl border border-[#E7E0FB] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#FAF9FE] border-b border-[#E7E0FB] text-[#585172] font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Staff Member & Employee Code</th>
                <th className="py-3 px-4">Role & Access</th>
                <th className="py-3 px-4">Device & Browser</th>
                <th className="py-3 px-4">Client IP Address</th>
                <th className="py-3 px-4">Login Timestamp</th>
                <th className="py-3 px-4">Session Duration</th>
                <th className="py-3 px-4">Status & Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E0FB]">
              {loadingSessions ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#585172]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 text-[#7C2CF5] animate-spin" />
                      <span className="font-semibold text-xs">Loading live session audit telemetry...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredSessionLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#585172]">
                    <ShieldCheck className="w-8 h-8 text-[#D8C7F8] mx-auto mb-2" />
                    <p className="font-bold text-[#120E24]">No login session logs found</p>
                    <p className="text-[11px] text-[#585172] mt-0.5">
                      Session records are captured automatically as staff log into the portal.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredSessionLogs.map((log) => {
                  const isActive = log.status === 'ACTIVE';
                  const isRevoked = log.status === 'REVOKED';

                  return (
                    <tr
                      key={log.id}
                      className={`hover:bg-[#FAF9FE] transition-colors ${
                        isActive ? 'bg-emerald-50/20' : ''
                      }`}
                    >
                      {/* Staff Member */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#7C2CF5] to-[#9D54FF] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
                            {(log.fullName || log.userEmail || 'U').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-[#120E24]">{log.fullName || 'User'}</div>
                            <div className="text-[11px] text-[#585172]">{log.userEmail}</div>
                            <div className="text-[10px] font-mono font-bold text-[#7C2CF5]">
                              {log.employeeCode || 'N/A'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-[#F0ECFC] text-[#7C2CF5] border border-[#D8C7F8]">
                          {log.role || 'EMPLOYEE'}
                        </span>
                      </td>

                      {/* Device & Browser */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 text-[#120E24]">
                          {log.deviceSummary?.toLowerCase().includes('mobile') ||
                          log.deviceSummary?.toLowerCase().includes('android') ||
                          log.deviceSummary?.toLowerCase().includes('ios') ? (
                            <Smartphone className="w-4 h-4 text-[#7C2CF5] shrink-0" />
                          ) : (
                            <Laptop className="w-4 h-4 text-[#7C2CF5] shrink-0" />
                          )}
                          <span className="font-medium truncate max-w-[170px]" title={log.deviceSummary || log.userAgent}>
                            {log.deviceSummary || 'Desktop Web'}
                          </span>
                        </div>
                      </td>

                      {/* IP Address */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#585172]">
                          <Globe className="w-3.5 h-3.5 text-[#8B849E]" />
                          <span>{log.ipAddress || '127.0.0.1'}</span>
                        </div>
                      </td>

                      {/* Login Timestamp */}
                      <td className="py-3 px-4">
                        <div className="text-[#120E24] font-medium">
                          {log.loginAt
                            ? new Date(log.loginAt).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })
                            : 'N/A'}
                        </div>
                        <div className="text-[10px] text-[#585172]">
                          {log.loginAt
                            ? new Date(log.loginAt).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                              })
                            : ''}
                        </div>
                      </td>

                      {/* Duration */}
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-[#120E24]">
                          {formatDuration(log.loginAt, log.logoutAt)}
                        </span>
                        {log.logoutAt && (
                          <div className="text-[10px] text-[#585172]">
                            Ended: {new Date(log.logoutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </td>

                      {/* Status & Terminate Action */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {isActive ? (
                            <>
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span>Active Now</span>
                              </span>

                              <button
                                type="button"
                                onClick={() => handleRevokeSession(log.id, log.userEmail)}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
                                title="Force terminate this staff session immediately"
                              >
                                <Power className="w-3 h-3" />
                                <span>Terminate</span>
                              </button>
                            </>
                          ) : isRevoked ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                              Revoked by Admin
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              Logged Out
                            </span>
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

        {/* Audit Table Footer */}
        <div className="p-3.5 border-t border-[#E7E0FB] bg-[#F7F5FE] flex items-center justify-between text-xs text-[#585172]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#7C2CF5]" />
            <span>
              SuperAdmin Lakshay Exclusive Audit Trail &bull; Showing <strong>{filteredSessionLogs.length}</strong> of {sessionLogs.length} session records
            </span>
          </div>
          <span className="font-semibold text-[#7C2CF5]">
            MongoDB Atlas <code className="font-mono text-[10px] bg-white px-1 py-0.5 rounded border border-[#E7E0FB]">user_sessions</code> Synced
          </span>
        </div>
      </div>
    </div>
  )}

      {/* ============================================================== */}
      {/* MODAL 1: STAFF 360 PROFILE DRAWER / VIEW MODAL */}
      {/* ============================================================== */}
      {staff360Employee && (
        <div className="fixed inset-0 bg-[#120E24]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-[#E7E0FB] max-h-[90vh] overflow-y-auto">
            {/* Drawer Header */}
            <div className="flex items-start justify-between pb-4 border-b border-[#E7E0FB] mb-5">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#7C2CF5] to-[#9D54FF] text-white flex items-center justify-center font-extrabold text-base shadow-md">
                  {(staff360Employee.fullName || staff360Employee.membership?.user?.fullName || 'S')
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-[#120E24] text-lg">
                      {staff360Employee.fullName || staff360Employee.membership?.user?.fullName}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                      {staff360Employee.employmentStatus || 'ACTIVE'}
                    </span>
                  </div>
                  <div className="text-xs text-[#7C2CF5] font-mono font-bold mt-0.5">
                    {staff360Employee.employeeCode} &bull; {staff360Employee.roleCode || staff360Employee.membership?.roles?.[0] || 'EMPLOYEE'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isLakshay && (
                  <button
                    onClick={() => {
                      const empToEdit = staff360Employee;
                      setStaff360Employee(null);
                      openEditEmployeeModal(empToEdit);
                    }}
                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Modify Profile</span>
                  </button>
                )}
                <button
                  onClick={() => setStaff360Employee(null)}
                  className="p-1.5 text-[#585172] hover:text-[#120E24] rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Profile Grid Details */}
            <div className="space-y-4 text-xs">
              {/* Section 1: Contact & Credentials */}
              <div className="bg-[#FBFBFE] p-4 rounded-2xl border border-[#E7E0FB]">
                <h4 className="font-extrabold text-[#120E24] text-xs mb-3 uppercase tracking-wider flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-[#7C2CF5]" />
                  <span>Contact & System Login Details</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <span className="text-[#585172] font-semibold block text-[11px]">Official Work Email</span>
                    <span className="font-bold text-[#120E24]">{staff360Employee.email || staff360Employee.membership?.user?.primaryEmail}</span>
                  </div>
                  <div>
                    <span className="text-[#585172] font-semibold block text-[11px]">Personal Email</span>
                    <span className="font-medium text-[#120E24]">{staff360Employee.personalEmail || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[#585172] font-semibold block text-[11px]">Mobile Phone</span>
                    <span className="font-medium text-[#120E24]">{staff360Employee.phone || staff360Employee.membership?.user?.phone || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[#585172] font-semibold block text-[11px]">System Role Access</span>
                    <span className="font-mono font-bold text-[#7C2CF5]">{staff360Employee.roleCode || staff360Employee.membership?.roles?.[0] || 'EMPLOYEE'}</span>
                  </div>
                </div>
              </div>

              {/* Section 2: Organizational Placement */}
              <div className="bg-[#FBFBFE] p-4 rounded-2xl border border-[#E7E0FB]">
                <h4 className="font-extrabold text-[#120E24] text-xs mb-3 uppercase tracking-wider flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-[#7C2CF5]" />
                  <span>Position & Organizational Hierarchy</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <span className="text-[#585172] font-semibold block text-[11px]">Job Title / Designation</span>
                    <span className="font-bold text-[#120E24]">{staff360Employee.jobTitle}</span>
                  </div>
                  <div>
                    <span className="text-[#585172] font-semibold block text-[11px]">Operating Department</span>
                    <span className="font-bold text-[#120E24]">{staff360Employee.department}</span>
                  </div>
                  <div>
                    <span className="text-[#585172] font-semibold block text-[11px]">Reporting Manager</span>
                    <span className="font-medium text-[#120E24]">{staff360Employee.reportingManagerName || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[#585172] font-semibold block text-[11px]">Date of Joining</span>
                    <span className="font-medium text-[#120E24]">
                      {staff360Employee.joinedOn ? new Date(staff360Employee.joinedOn).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 3: Shift & Compensation */}
              <div className="bg-[#FBFBFE] p-4 rounded-2xl border border-[#E7E0FB]">
                <h4 className="font-extrabold text-[#120E24] text-xs mb-3 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-[#7C2CF5]" />
                  <span>Workplace Shift & Compensation</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <span className="text-[#585172] font-semibold block text-[11px]">Assigned Shift & Timezone</span>
                    <span className="font-bold text-[#120E24]">{staff360Employee.shift || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[#585172] font-semibold block text-[11px]">Annual CTC / Compensation</span>
                    <span className="font-mono font-extrabold text-emerald-700">{staff360Employee.salary || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[#585172] font-semibold block text-[11px]">Today's Punch Status</span>
                    <span className="font-bold text-[#120E24]">
                      {staff360Employee.todayAttendance ? `${staff360Employee.todayAttendance.status} (Punch: ${new Date(staff360Employee.todayAttendance.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : 'No punch recorded today'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#585172] font-semibold block text-[11px]">Employment Classification</span>
                    <span className="font-bold text-[#7C2CF5]">{staff360Employee.employmentStatus || 'ACTIVE'}</span>
                  </div>
                </div>
              </div>

              {/* Section 4: Database IDs & Metadata */}
              <div className="bg-[#F7F5FE] p-4 rounded-2xl border border-[#E7E0FB] font-mono text-[11px] space-y-1">
                <div className="text-[10px] font-sans font-bold text-[#585172] uppercase tracking-wider mb-1">
                  MongoDB Cloud Identifiers
                </div>
                <div><span className="text-[#585172]">Document ID:</span> <span className="text-[#120E24]">{staff360Employee.id || staff360Employee._id}</span></div>
                <div><span className="text-[#585172]">User Account ID:</span> <span className="text-[#120E24]">{staff360Employee.userId || 'Linked to auth credentials'}</span></div>
                <div><span className="text-[#585172]">Tenant ID:</span> <span className="text-[#120E24]">{staff360Employee.tenantId || 'CodRix Private Limited'}</span></div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-[#E7E0FB] mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStaff360Employee(null)}
                className="px-4 py-2 border border-[#E7E0FB] rounded-xl text-[#585172] hover:bg-[#F7F5FE] font-bold transition text-xs cursor-pointer"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: ADD NEW STAFF MEMBER (FOUNDER FULL CRUD) */}
      {/* ============================================================== */}
      {addStaffModalOpen && (
        <div className="fixed inset-0 bg-[#120E24]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-[#E7E0FB] max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E0FB] mb-4">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#7C2CF5]" />
                <div>
                  <h3 className="font-extrabold text-[#120E24] text-base">Add New Staff Member</h3>
                  <p className="text-[11px] text-[#585172]">Creates employee profile, system user credentials & default leave balances in MongoDB</p>
                </div>
              </div>
              <button onClick={() => setAddStaffModalOpen(false)} className="text-[#585172] hover:text-[#120E24]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={addFullName}
                    onChange={(e) => setAddFullName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] font-semibold focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Official Login Email *</label>
                  <input
                    type="email"
                    required
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    placeholder="rahul.sharma@codrix.co.in"
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] font-semibold focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Personal Email</label>
                  <input
                    type="email"
                    value={addPersonalEmail}
                    onChange={(e) => setAddPersonalEmail(e.target.value)}
                    placeholder="rahul.personal@gmail.com"
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={addPhone}
                    onChange={(e) => setAddPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Employee Code</label>
                  <input
                    type="text"
                    value={addEmpCode}
                    onChange={(e) => setAddEmpCode(e.target.value)}
                    placeholder="CDX-008"
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] font-mono font-bold focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block font-bold text-[#120E24] mb-1">Designation / Job Title *</label>
                  <input
                    type="text"
                    required
                    value={addJobTitle}
                    onChange={(e) => setAddJobTitle(e.target.value)}
                    placeholder="e.g. Senior Software Development Engineer"
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] font-semibold focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Operating Department</label>
                  <select
                    value={addDepartment}
                    onChange={(e) => setAddDepartment(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] font-semibold focus:outline-none focus:border-[#7C2CF5]"
                  >
                    {departmentsList.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">System Role & Access</label>
                  <select
                    value={addRoleCode}
                    onChange={(e) => setAddRoleCode(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#7C2CF5] font-bold font-mono focus:outline-none focus:border-[#7C2CF5]"
                  >
                    <option value="SDE1">SDE1 (Engineering Member)</option>
                    <option value="SDE2">SDE2 (Senior Software Engineer)</option>
                    <option value="ENGINEERING_LEAD">ENGINEERING_LEAD (Tech Lead)</option>
                    <option value="BDE">BDE (Business Development Exec)</option>
                    <option value="BDM">BDM (Business Development Mgr)</option>
                    <option value="GROWTH_OFFICER">GROWTH_OFFICER (Growth Leader)</option>
                    <option value="HR_EXEC">HR_EXEC (People Operations)</option>
                    <option value="HR_MANAGER">HR_MANAGER (HR Lead)</option>
                    <option value="OPS_MANAGER">OPS_MANAGER (Operations Lead)</option>
                    <option value="BRANCH_MANAGER">BRANCH_MANAGER (Branch Lead)</option>
                    <option value="INTERN">INTERN (Software / Growth Intern)</option>
                    <option value="EMPLOYEE">EMPLOYEE (General Staff)</option>
                    <option value="COMPANY_ADMIN">COMPANY_ADMIN (Company Admin)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Reporting Manager</label>
                  <input
                    type="text"
                    value={addManager}
                    onChange={(e) => setAddManager(e.target.value)}
                    placeholder="e.g. Lakshay (Founder & MD)"
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Salary / Compensation</label>
                  <input
                    type="text"
                    value={addSalary}
                    onChange={(e) => setAddSalary(e.target.value)}
                    placeholder="e.g. ₹12,00,000 / yr"
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] font-semibold focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Shift Schedule</label>
                  <input
                    type="text"
                    value={addShift}
                    onChange={(e) => setAddShift(e.target.value)}
                    placeholder="e.g. Hybrid Shift • IST"
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Employment Status</label>
                  <select
                    value={addStatus}
                    onChange={(e) => setAddStatus(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] font-semibold focus:outline-none focus:border-[#7C2CF5]"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="PROBATION">PROBATION</option>
                    <option value="NOTICE_PERIOD">NOTICE_PERIOD</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Initial Portal Password</label>
                  <input
                    type="text"
                    value={addPassword}
                    onChange={(e) => setAddPassword(e.target.value)}
                    placeholder="Enter initial portal password"
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] font-mono focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#E7E0FB] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddStaffModalOpen(false)}
                  className="px-4 py-2 border border-[#E7E0FB] rounded-xl text-[#585172] hover:bg-[#F7F5FE] font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdd}
                  className="px-5 py-2 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl font-bold shadow-md shadow-[#7C2CF5]/25 transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingAdd ? 'Saving...' : 'Register Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: MODIFY / EDIT STAFF MEMBER (FOUNDER FULL CRUD) */}
      {/* ============================================================== */}
      {editingEmployee && (
        <div className="fixed inset-0 bg-[#120E24]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-[#E7E0FB] max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E0FB] mb-4">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-[#7C2CF5]" />
                <div>
                  <h3 className="font-extrabold text-[#120E24] text-base">
                    Modify Staff Details: {editingEmployee.fullName || editingEmployee.membership?.user?.fullName}
                  </h3>
                  <p className="text-[11px] text-[#585172]">
                    Founder SuperAdmin modification directly synchronized to MongoDB Atlas
                  </p>
                </div>
              </div>
              <button onClick={() => setEditingEmployee(null)} className="text-[#585172] hover:text-[#120E24]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateStaff} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] font-semibold focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Official Login Email *</label>
                  <input
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] font-semibold focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Personal Email</label>
                  <input
                    type="email"
                    value={editPersonalEmail}
                    onChange={(e) => setEditPersonalEmail(e.target.value)}
                    placeholder="personal@gmail.com"
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Employee Code</label>
                  <input
                    type="text"
                    value={editEmpCode}
                    onChange={(e) => setEditEmpCode(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] font-mono font-bold focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block font-bold text-[#120E24] mb-1">Designation / Job Title *</label>
                  <input
                    type="text"
                    required
                    value={editJobTitle}
                    onChange={(e) => setEditJobTitle(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] font-semibold focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Department</label>
                  <select
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] font-semibold focus:outline-none focus:border-[#7C2CF5]"
                  >
                    {departmentsList.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">System Role Access</label>
                  <select
                    value={editRoleCode}
                    onChange={(e) => setEditRoleCode(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#7C2CF5] font-bold font-mono focus:outline-none focus:border-[#7C2CF5]"
                  >
                    <option value="SDE1">SDE1 (Engineering Member)</option>
                    <option value="SDE2">SDE2 (Senior Software Engineer)</option>
                    <option value="ENGINEERING_LEAD">ENGINEERING_LEAD (Tech Lead)</option>
                    <option value="BDE">BDE (Business Development Exec)</option>
                    <option value="BDM">BDM (Business Development Mgr)</option>
                    <option value="GROWTH_OFFICER">GROWTH_OFFICER (Growth Leader)</option>
                    <option value="HR_EXEC">HR_EXEC (People Operations)</option>
                    <option value="HR_MANAGER">HR_MANAGER (HR Lead)</option>
                    <option value="OPS_MANAGER">OPS_MANAGER (Operations Lead)</option>
                    <option value="BRANCH_MANAGER">BRANCH_MANAGER (Branch Lead)</option>
                    <option value="INTERN">INTERN (Software / Growth Intern)</option>
                    <option value="EMPLOYEE">EMPLOYEE (General Staff)</option>
                    <option value="COMPANY_ADMIN">COMPANY_ADMIN (Company Admin)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Reporting Manager</label>
                  <input
                    type="text"
                    value={editManager}
                    onChange={(e) => setEditManager(e.target.value)}
                    placeholder="e.g. Lakshay (Founder & MD)"
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Salary / Compensation</label>
                  <input
                    type="text"
                    value={editSalary}
                    onChange={(e) => setEditSalary(e.target.value)}
                    placeholder="e.g. ₹12,00,000 / yr"
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] font-semibold focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Shift Schedule</label>
                  <input
                    type="text"
                    value={editShift}
                    onChange={(e) => setEditShift(e.target.value)}
                    placeholder="e.g. Hybrid Shift • IST"
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#120E24] mb-1">Employment Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] font-semibold focus:outline-none focus:border-[#7C2CF5]"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PROBATION">PROBATION</option>
                  <option value="NOTICE_PERIOD">NOTICE_PERIOD</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              {/* SuperAdmin Credentials Management & Email Dispatch */}
              {isLakshay ? (
                <div className="bg-[#FAF9FE] p-4 rounded-2xl border border-[#D8C7F8] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#7C2CF5]">
                      <Shield className="w-4 h-4 text-[#7C2CF5]" />
                      <span>SuperAdmin Credential Management & Email Dispatch</span>
                    </div>
                    <span className="text-[10px] bg-[#EDE4FF] text-[#7C2CF5] font-bold px-2.5 py-0.5 rounded-full border border-[#D8C7F8]">
                      Founder Lakshay Exclusive
                    </span>
                  </div>

                  <div>
                    <label className="block font-bold text-[#120E24] mb-1">
                      Reset / Set Portal Password
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showEditPassword ? 'text' : 'password'}
                          value={editPassword}
                          onChange={(e) => setEditPassword(e.target.value)}
                          placeholder="Enter new portal password (or leave blank to keep existing)"
                          className="w-full bg-white border border-[#E7E0FB] rounded-xl px-3 py-2 pr-10 text-[#120E24] font-mono focus:outline-none focus:border-[#7C2CF5]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowEditPassword(!showEditPassword)}
                          className="absolute right-3 top-2.5 text-[#585172] hover:text-[#7C2CF5] cursor-pointer"
                        >
                          {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={generateStrongPassword}
                        className="px-3 py-2 bg-[#EDE4FF] hover:bg-[#E2D4FD] text-[#7C2CF5] font-bold text-xs rounded-xl flex items-center gap-1 transition cursor-pointer shrink-0"
                        title="Generate strong random password"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Generate</span>
                      </button>
                    </div>
                  </div>

                  {/* Email dispatch controls */}
                  <div className="pt-2 border-t border-[#E7E0FB] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={editSendEmail}
                        onChange={(e) => setEditSendEmail(e.target.checked)}
                        className="w-4 h-4 text-[#7C2CF5] rounded border-[#E7E0FB] focus:ring-[#7C2CF5]"
                      />
                      <span className="text-[11px] font-semibold text-[#120E24]">
                        Send updated credentials to employee via email on save
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={handleDispatchCredentialsNow}
                      disabled={isDispatchingCreds}
                      className="px-3 py-1.5 bg-[#120E24] hover:bg-[#251D42] text-white text-[11px] font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 shrink-0 shadow-sm"
                      title="Send credentials email immediately to staff member"
                    >
                      <Send className="w-3 h-3 text-[#9C8EF7]" />
                      <span>{isDispatchingCreds ? 'Sending Email...' : 'Send Credentials Email Now'}</span>
                    </button>
                  </div>

                  {credDispatchStatus && (
                    <div className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{credDispatchStatus}</span>
                    </div>
                  )}

                  <div className="text-[10px] text-[#585172]">
                    Email Recipients: <span className="font-semibold text-[#120E24]">{editEmail || 'No official email'}</span>
                    {editPersonalEmail ? <span> & <span className="font-semibold text-[#120E24]">{editPersonalEmail}</span></span> : ''}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-slate-400" />
                  <span>Credential modifications and email dispatches are strictly reserved for Superadmin (Lakshay).</span>
                </div>
              )}

              <div className="pt-3 border-t border-[#E7E0FB] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className="px-4 py-2 border border-[#E7E0FB] rounded-xl text-[#585172] hover:bg-[#F7F5FE] font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-5 py-2 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl font-bold shadow-md shadow-[#7C2CF5]/25 transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingEdit ? 'Saving Updates...' : 'Save & Synchronize Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: LEAVE APPLICATION MODAL */}
      {/* ============================================================== */}
      {leaveModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-800 text-sm">Submit Leave Request</h3>
              <button onClick={() => setLeaveModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRequestLeave} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Leave Type</label>
                <select
                  value={selectedLeaveTypeId}
                  onChange={(e) => setSelectedLeaveTypeId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none"
                >
                  {leaveBalances.map((b) => (
                    <option key={b.leaveTypeId} value={b.leaveTypeId}>
                      {b.leaveType.name} (Remaining: {b.totalDays - b.usedDays - b.pendingDays} days)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Total Days</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  required
                  value={daysCount}
                  onChange={(e) => setDaysCount(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason</label>
                <textarea
                  required
                  rows={2}
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none"
                  placeholder="Reason for leave..."
                />
              </div>

              <div className="pt-3 border-t border-[#E7E0FB] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setLeaveModalOpen(false)}
                  className="px-4 py-2 border border-[#E7E0FB] rounded-xl text-[#585172] hover:bg-[#F7F5FE] font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl font-bold shadow-md shadow-[#7C2CF5]/25 transition cursor-pointer"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
