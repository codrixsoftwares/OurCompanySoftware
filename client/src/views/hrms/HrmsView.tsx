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
  DollarSign,
  UserPlus,
  ChevronRight,
  Sparkles,
  Key,
  Layers,
  MapPin,
  Clock4
} from 'lucide-react';

export const HrmsView: React.FC = () => {
  const { hasRole, isLakshay } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [attendanceToday, setAttendanceToday] = useState<AttendanceRecord | null>(null);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
  const [addManager, setAddManager] = useState('Lakshay (Founder & MD)');
  const [addSalary, setAddSalary] = useState('₹10,50,000 / yr');
  const [addShift, setAddShift] = useState('Hybrid Shift • IST');
  const [addStatus, setAddStatus] = useState('ACTIVE');
  const [addPassword, setAddPassword] = useState('Codrix@2026');
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

    const handleHrmsEvent = () => {
      loadData();
    };

    socket.on('hrms:attendance_punched', handleHrmsEvent);
    socket.on('hrms:leave_applied', handleHrmsEvent);
    socket.on('hrms:leave_approved', handleHrmsEvent);
    socket.on('hrms:employee_created', handleHrmsEvent);
    socket.on('hrms:employee_updated', handleHrmsEvent);
    socket.on('hrms:employee_deleted', handleHrmsEvent);
    socket.on('hrms:employees_batch_deleted', handleHrmsEvent);
    socket.on('hrms:leave_deleted', handleHrmsEvent);

    return () => {
      socket.off('hrms:attendance_punched', handleHrmsEvent);
      socket.off('hrms:leave_applied', handleHrmsEvent);
      socket.off('hrms:leave_approved', handleHrmsEvent);
      socket.off('hrms:employee_created', handleHrmsEvent);
      socket.off('hrms:employee_updated', handleHrmsEvent);
      socket.off('hrms:employee_deleted', handleHrmsEvent);
      socket.off('hrms:employees_batch_deleted', handleHrmsEvent);
      socket.off('hrms:leave_deleted', handleHrmsEvent);
    };
  }, []);

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

  // Delete Handlers
  const handleDeleteEmployee = async (id: string, name: string) => {
    if (!isLakshay) {
      alert('Security Violation: Only Lakshay (Founder & SuperAdmin) is authorized to delete staff records.');
      return;
    }
    if (!window.confirm(`Are you sure you want to permanently delete employee "${name}"? This action removes database records and linked credentials.`)) return;
    try {
      await apiRequest(`/hrms/employees/${id}`, { method: 'DELETE' });
      setSelectedEmployeeIds((prev) => prev.filter((x) => x !== id));
      if (staff360Employee?.id === id) setStaff360Employee(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error deleting employee');
    }
  };

  const handleBatchDeleteEmployees = async () => {
    if (!isLakshay || selectedEmployeeIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete ${selectedEmployeeIds.length} selected employee profile(s)?`)) return;
    try {
      await apiRequest('/hrms/employees/batch-delete', {
        method: 'POST',
        body: JSON.stringify({ employeeIds: selectedEmployeeIds })
      });
      setSelectedEmployeeIds([]);
      if (staff360Employee && selectedEmployeeIds.includes(staff360Employee.id)) {
        setStaff360Employee(null);
      }
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error deleting selected employees');
    }
  };

  const handleDeleteLeaveRequest = async (id: string) => {
    if (!isLakshay) return;
    if (!window.confirm('Are you sure you want to delete this leave request?')) return;
    try {
      await apiRequest(`/hrms/leave/requests/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error deleting leave request');
    }
  };

  // Clock in/out
  const handleClockIn = async () => {
    try {
      const rec = await apiRequest('/hrms/attendance/clock-in', { method: 'POST' });
      setAttendanceToday(rec);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error clocking in');
    }
  };

  const handleClockOut = async () => {
    try {
      const rec = await apiRequest('/hrms/attendance/clock-out', { method: 'POST' });
      setAttendanceToday(rec);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error clocking out');
    }
  };

  // Leave Handlers
  const handleRequestLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/hrms/leave/requests', {
        method: 'POST',
        body: JSON.stringify({
          leaveTypeId: selectedLeaveTypeId,
          startDate,
          endDate,
          daysCount: Number(daysCount),
          reason: leaveReason
        })
      });
      setLeaveModalOpen(false);
      setLeaveReason('');
      setStartDate('');
      setEndDate('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error requesting leave');
    }
  };

  const handleApproveLeave = async (requestId: string) => {
    try {
      await apiRequest(`/hrms/leave/requests/${requestId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ notes: 'Approved by authorized manager' })
      });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Approval error');
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
    setEditManager(emp.reportingManagerName || 'Lakshay (Founder & MD)');
    setEditSalary(emp.salary || '₹10,00,000 / yr');
    setEditShift(emp.shift || 'Hybrid Shift • IST');
    setEditStatus(emp.employmentStatus || 'ACTIVE');
    setEditPassword('');
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
      await apiRequest('/hrms/employees', {
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
          password: addPassword.trim() || 'Codrix@2026'
        })
      });
      setAddStaffModalOpen(false);
      // Reset form
      setAddFullName('');
      setAddEmail('');
      setAddPersonalEmail('');
      setAddPhone('');
      setAddJobTitle('');
      setAddEmpCode('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error creating staff profile');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Edit Staff Submission
  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    setIsSubmittingEdit(true);
    try {
      const res: any = await apiRequest(`/hrms/employees/${editingEmployee.id}`, {
        method: 'PUT',
        body: JSON.stringify({
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
          employmentStatus: editStatus,
          password: editPassword.trim() || undefined
        })
      });
      setEditingEmployee(null);
      if (staff360Employee?.id === editingEmployee.id) {
        setStaff360Employee(res.data);
      }
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error updating staff profile');
    } finally {
      setIsSubmittingEdit(false);
    }
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
                          <span>{emp.shift || 'Hybrid Shift • IST'}</span>
                        </div>
                        <div className="text-[10px] text-[#585172] mt-0.5">
                          Mgr: {emp.reportingManagerName || 'Lakshay (Founder & MD)'}
                        </div>
                      </td>

                      {/* Salary / Comp */}
                      <td className="py-3 px-4 font-mono font-bold text-[#120E24]">
                        {emp.salary || '₹8,50,000 / yr'}
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
                    <span className="font-medium text-[#120E24]">{staff360Employee.reportingManagerName || 'Lakshay (Founder & MD)'}</span>
                  </div>
                  <div>
                    <span className="text-[#585172] font-semibold block text-[11px]">Date of Joining</span>
                    <span className="font-medium text-[#120E24]">
                      {staff360Employee.joinedOn ? new Date(staff360Employee.joinedOn).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Nov 2026'}
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
                    <span className="font-bold text-[#120E24]">{staff360Employee.shift || 'Hybrid Shift • IST'}</span>
                  </div>
                  <div>
                    <span className="text-[#585172] font-semibold block text-[11px]">Annual CTC / Compensation</span>
                    <span className="font-mono font-extrabold text-emerald-700">{staff360Employee.salary || '₹8,50,000 / yr'}</span>
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
                    placeholder="Lakshay (Founder & MD)"
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Salary / Compensation</label>
                  <input
                    type="text"
                    value={addSalary}
                    onChange={(e) => setAddSalary(e.target.value)}
                    placeholder="₹12,00,000 / yr"
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] font-semibold focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Shift Schedule</label>
                  <input
                    type="text"
                    value={addShift}
                    onChange={(e) => setAddShift(e.target.value)}
                    placeholder="Hybrid Shift • IST"
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
                    placeholder="Codrix@2026"
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
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Salary / Compensation</label>
                  <input
                    type="text"
                    value={editSalary}
                    onChange={(e) => setEditSalary(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] font-semibold focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Shift Schedule</label>
                  <input
                    type="text"
                    value={editShift}
                    onChange={(e) => setEditShift(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Reset Portal Password (Optional)</label>
                  <input
                    type="text"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Leave blank to keep existing password"
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] font-mono focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
              </div>

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
