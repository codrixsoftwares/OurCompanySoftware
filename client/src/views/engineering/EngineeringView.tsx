import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { apiRequest } from '../../api/client.js';
import { Task } from '../../types.js';
import { getSocket } from '../../core/socket.js';
import {
  Code2,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  MessageSquare,
  Sparkles,
  X,
  Send,
  User,
  Users,
  Calendar,
  Filter,
  Trash2,
  FolderKanban,
  Check,
  ChevronDown,
  ArrowRight,
  ShieldCheck,
  Tag,
  Flag,
  Search,
  Briefcase,
  Layers
} from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  employeeCode?: string;
  designation?: string;
  department?: string;
  email?: string;
}

interface EngineeringViewProps {
  onNavigate?: (tab: string) => void;
  initialProjectId?: string;
}

export const EngineeringView: React.FC<EngineeringViewProps> = ({ onNavigate, initialProjectId }) => {
  const { session, isLakshay } = useAuth();
  const currentUserName = session?.user?.fullName || '';
  const currentUserEmpId = session?.employee?.id || '';

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // View Scope: Defaults to 'my' for all assignees, 'all' for Lakshay / Founder
  const [viewScope, setViewScope] = useState<'my' | 'all'>(isLakshay ? 'all' : 'my');

  // Modals
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [standupModalOpen, setStandupModalOpen] = useState(false);

  // Filters
  const [selectedAssigneeFilter, setSelectedAssigneeFilter] = useState('ALL');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState(initialProjectId || 'ALL');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // New Task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskProjectId, setTaskProjectId] = useState(initialProjectId || '');
  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [taskPriority, setTaskPriority] = useState('MEDIUM');
  const [taskType, setTaskType] = useState('FEATURE');
  const [taskEstimate, setTaskEstimate] = useState('4');
  const [taskSprint, setTaskSprint] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');

  // Daily Standup state
  const [standupProjectId, setStandupProjectId] = useState('');
  const [todayUpdateSubmitted, setTodayUpdateSubmitted] = useState<boolean>(false);
  const [completedItems, setCompletedItems] = useState('');
  const [inProgressItems, setInProgressItems] = useState('');
  const [blockers, setBlockers] = useState('');
  const [nextDayPlan, setNextDayPlan] = useState('');

  const loadData = async () => {
    try {
      const [tasksRes, projectsRes, teamRes, todayRes] = await Promise.allSettled([
        apiRequest<Task[]>('/engineering/tasks'),
        apiRequest<any[]>('/engineering/projects'),
        apiRequest<TeamMember[]>('/engineering/team'),
        apiRequest<{ submitted: boolean; update: any }>('/engineering/daily-updates/today')
      ]);

      const tasksData = tasksRes.status === 'fulfilled' && Array.isArray(tasksRes.value) ? tasksRes.value : [];
      const projectsData = projectsRes.status === 'fulfilled' && Array.isArray(projectsRes.value) ? projectsRes.value : [];
      const teamData = teamRes.status === 'fulfilled' && Array.isArray(teamRes.value) ? teamRes.value : [];
      const todayData = todayRes.status === 'fulfilled' && todayRes.value ? todayRes.value : null;

      setTasks(tasksData);
      setProjects(projectsData);
      setTeam(teamData);
      if (todayData) {
        setTodayUpdateSubmitted(Boolean(todayData.submitted));
      }

      if (projectsData.length > 0 && !taskProjectId) {
        setTaskProjectId(projectsData[0].id || projectsData[0]._id);
      }
      if (projectsData.length > 0 && !standupProjectId) {
        setStandupProjectId(projectsData[0].id || projectsData[0]._id);
      }
      if (teamData.length > 0 && !taskAssigneeId) {
        setTaskAssigneeId(teamData[0].id || (teamData[0] as any)._id);
      }
    } catch (err) {
      console.error('Failed loading engineering data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const socket = getSocket();
    socket.emit('join_engineering');

    const handleEngineeringEvent = () => {
      loadData();
    };

    socket.on('engineering:task_created', handleEngineeringEvent);
    socket.on('engineering:task_reassigned', handleEngineeringEvent);
    socket.on('engineering:task_status_changed', handleEngineeringEvent);
    socket.on('engineering:task_deleted', handleEngineeringEvent);
    socket.on('engineering:project_created', handleEngineeringEvent);
    socket.on('engineering:standup_logged', handleEngineeringEvent);

    return () => {
      socket.off('engineering:task_created', handleEngineeringEvent);
      socket.off('engineering:task_reassigned', handleEngineeringEvent);
      socket.off('engineering:task_status_changed', handleEngineeringEvent);
      socket.off('engineering:task_deleted', handleEngineeringEvent);
      socket.off('engineering:project_created', handleEngineeringEvent);
      socket.off('engineering:standup_logged', handleEngineeringEvent);
    };
  }, []);

  const handleStatusChange = async (taskId: string, status: string) => {
    try {
      await apiRequest(`/engineering/tasks/${taskId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReassignTask = async (taskId: string, newAssigneeId: string) => {
    try {
      const selectedMember = team.find((m) => m.id === newAssigneeId);
      await apiRequest(`/engineering/tasks/${taskId}/assignee`, {
        method: 'PATCH',
        body: JSON.stringify({
          assigneeEmployeeId: newAssigneeId,
          assigneeName: selectedMember?.name || newAssigneeId
        })
      });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error reassigning task');
    }
  };

  const handleDeleteTask = async (taskId: string, taskCode: string) => {
    if (!isLakshay) {
      alert('Security Violation: Only Lakshay (Founder & Overall Superadmin) is authorized to delete engineering tasks.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete task ${taskCode}?`)) return;
    try {
      await apiRequest(`/engineering/tasks/${taskId}`, {
        method: 'DELETE'
      });
      setSelectedTaskIds((prev) => prev.filter((id) => id !== taskId));
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error deleting task');
    }
  };

  const handleToggleSelectTask = (taskId: string) => {
    setSelectedTaskIds((prev) => (prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]));
  };

  const handleBatchDeleteTasks = async () => {
    if (!isLakshay || selectedTaskIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete ${selectedTaskIds.length} selected task(s)?`)) return;
    try {
      await apiRequest('/engineering/tasks/batch-delete', {
        method: 'POST',
        body: JSON.stringify({ taskIds: selectedTaskIds })
      });
      setSelectedTaskIds([]);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error deleting selected tasks');
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    try {
      await apiRequest('/engineering/tasks', {
        method: 'POST',
        body: JSON.stringify({
          projectId: taskProjectId || projects[0]?.id || '',
          title: taskTitle.trim(),
          description: taskDesc.trim(),
          priority: taskPriority,
          estimateHours: Number(taskEstimate) || 4,
          assigneeEmployeeId: taskAssigneeId,
          sprintName: taskSprint,
          dueDate: taskDueDate || undefined,
          taskType
        })
      });
      setCreateTaskOpen(false);
      setTaskTitle('');
      setTaskDesc('');
      setTaskEstimate('4');
      setTaskDueDate('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error creating task');
    }
  };

  const handleSubmitStandup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const selectedProj = projects.find((p) => (p.id || p._id) === standupProjectId);
      await apiRequest('/engineering/daily-updates', {
        method: 'POST',
        body: JSON.stringify({
          projectId: standupProjectId,
          projectName: selectedProj?.name || 'General Project Work',
          completedItems,
          inProgressItems,
          blockers,
          nextDayPlan
        })
      });
      setStandupModalOpen(false);
      setTodayUpdateSubmitted(true);
      setCompletedItems('');
      setInProgressItems('');
      setBlockers('');
      setNextDayPlan('');
      alert('Daily project update submitted successfully!');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error submitting standup');
    }
  };

  const columns = [
    { id: 'TODO', label: 'To Do', color: 'border-slate-300' },
    { id: 'IN_PROGRESS', label: 'In Progress', color: 'border-blue-400' },
    { id: 'IN_REVIEW', label: 'In Review', color: 'border-amber-400' },
    { id: 'DONE', label: 'Done', color: 'border-emerald-400' }
  ];

  // Specific Assigned Tasks and Projects for the Current User
  const myTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchName = currentUserName && t.assigneeName?.toLowerCase().includes(currentUserName.toLowerCase());
      const matchId = currentUserEmpId && t.assigneeEmployeeId === currentUserEmpId;
      return matchName || matchId;
    });
  }, [tasks, currentUserName, currentUserEmpId]);

  const myProjectIds = useMemo(() => {
    return new Set(myTasks.map((t) => t.project?.id || t.projectId).filter(Boolean));
  }, [myTasks]);

  const myProjects = useMemo(() => {
    return projects.filter((p) => {
      const pId = p.id || p._id;
      return myProjectIds.has(pId) || (currentUserEmpId && p.managerEmployeeId === currentUserEmpId);
    });
  }, [projects, myProjectIds, currentUserEmpId]);

  // Filtering
  const filteredTasks = tasks.filter((task) => {
    if (viewScope === 'my') {
      const matchName = currentUserName && task.assigneeName?.toLowerCase().includes(currentUserName.toLowerCase());
      const matchId = currentUserEmpId && task.assigneeEmployeeId === currentUserEmpId;
      if (!matchName && !matchId) return false;
    }
    if (selectedAssigneeFilter !== 'ALL') {
      const matchName = task.assigneeName?.toLowerCase() === selectedAssigneeFilter.toLowerCase();
      const matchId = task.assigneeEmployeeId === selectedAssigneeFilter;
      if (!matchName && !matchId) return false;
    }
    if (selectedProjectFilter !== 'ALL') {
      if (task.project?.id !== selectedProjectFilter && task.projectId !== selectedProjectFilter && task.project?.name !== selectedProjectFilter) {
        return false;
      }
    }
    if (selectedPriorityFilter !== 'ALL') {
      if (task.priority !== selectedPriorityFilter) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesTitle = task.title.toLowerCase().includes(q);
      const matchesCode = task.taskCode.toLowerCase().includes(q);
      const matchesAssignee = (task.assigneeName || '').toLowerCase().includes(q);
      if (!matchesTitle && !matchesCode && !matchesAssignee) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* 1. Header Card (Aligned with Single-Header Design & Zero Clutter) */}
      <div className="bg-white rounded-2xl border border-[#E7E0FB] p-5 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-extrabold text-[#120E24] tracking-tight">
              Engineering & Sprints Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EDE4FF] text-[#7C2CF5] border border-[#DDD0FE]">
              {viewScope === 'my'
                ? `${myTasks.length} Assigned Tasks • ${myProjects.length} Assigned Projects`
                : `${tasks.length} Total Tasks • ${projects.length} Active Projects`}
            </span>

            {/* Scope Switcher: Person-specific Assigned items vs Full Board */}
            <div className="flex items-center gap-1 p-1 bg-[#F7F5FE] rounded-xl border border-[#E7E0FB]">
              <button
                type="button"
                onClick={() => setViewScope('my')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  viewScope === 'my'
                    ? 'bg-white text-[#7C2CF5] shadow-xs'
                    : 'text-[#585172] hover:text-[#120E24]'
                }`}
                title="View projects and tasks assigned specifically to you"
              >
                <User className="w-3.5 h-3.5" />
                <span>Assigned to Me ({myTasks.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setViewScope('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  viewScope === 'all'
                    ? 'bg-white text-[#7C2CF5] shadow-xs'
                    : 'text-[#585172] hover:text-[#120E24]'
                }`}
                title="View full organization engineering sprint board"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>All Board ({tasks.length})</span>
              </button>
            </div>
          </div>
          <p className="text-xs text-[#585172] mt-1">
            {viewScope === 'my'
              ? `Displaying assigned tasks & active initiatives for ${currentUserName || 'you'} • Record daily updates before end of shift`
              : 'Enterprise sprint board across engineering, architecture, operations & growth teams'}
          </p>
        </div>

        {/* Action Controls & Daily Update Indicator */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Daily Standup Status Pill */}
          {todayUpdateSubmitted ? (
            <div className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Today's Update Logged</span>
            </div>
          ) : (
            <button
              onClick={() => setStandupModalOpen(true)}
              className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-2xs animate-pulse"
              title="Submit your mandatory daily project update before logging out"
            >
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Daily Update Pending • Submit</span>
            </button>
          )}

          {onNavigate && (
            <button
              onClick={() => onNavigate('projects')}
              className="px-3.5 py-2 bg-[#F7F5FE] hover:bg-[#F0ECFC] text-[#585172] hover:text-[#7C2CF5] border border-[#E7E0FB] rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              title="Open Projects Hub to manage initiatives"
            >
              <FolderKanban className="w-3.5 h-3.5 text-[#7C2CF5]" />
              <span>Projects Hub</span>
            </button>
          )}

          <button
            onClick={() => setStandupModalOpen(true)}
            className="px-3.5 py-2 bg-[#F0ECFC] hover:bg-[#EDE4FF] text-[#7C2CF5] rounded-xl text-xs font-bold border border-[#E7E0FB] transition flex items-center gap-1.5"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Daily Standup</span>
          </button>

          <button
            onClick={() => setCreateTaskOpen(true)}
            className="px-4 py-2 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl text-xs font-bold shadow-md shadow-[#7C2CF5]/25 transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Assign Work / Create Task</span>
          </button>
        </div>
      </div>

      {/* 2. Filter & Assignment Quick Control Bar */}
      <div className="bg-white rounded-2xl border border-[#E7E0FB] p-4 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Search */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-[#585172] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by code, title or assignee..."
              className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
            />
          </div>

          {/* Assignee Filter (Founder can view everyone's workload) */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#585172]">Assignee:</span>
            <select
              value={selectedAssigneeFilter}
              onChange={(e) => setSelectedAssigneeFilter(e.target.value)}
              className="bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-2.5 py-1.5 font-bold text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
            >
              <option value="ALL">All Team Members ({team.length})</option>
              {team.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name} ({m.designation || 'Team'})
                </option>
              ))}
            </select>
          </div>

          {/* Project Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#585172]">Project:</span>
            <select
              value={selectedProjectFilter}
              onChange={(e) => setSelectedProjectFilter(e.target.value)}
              className="bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-2.5 py-1.5 font-bold text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
            >
              <option value="ALL">All Projects ({projects.length})</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectCode} &bull; {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#585172]">Priority:</span>
            <select
              value={selectedPriorityFilter}
              onChange={(e) => setSelectedPriorityFilter(e.target.value)}
              className="bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-2.5 py-1.5 font-bold text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </div>

        <div className="text-[11px] text-[#585172] font-medium">
          Showing <strong>{filteredTasks.length}</strong> of {tasks.length} tasks
        </div>
      </div>

      {/* Batch Action Floating Bar for Lakshay */}
      {isLakshay && selectedTaskIds.length > 0 && (
        <div className="bg-[#120E24] text-white px-5 py-3 rounded-2xl shadow-xl flex items-center justify-between border border-[#302B47] animate-in fade-in">
          <div className="flex items-center gap-3">
            <span className="bg-[#7C2CF5] text-white text-xs font-bold px-2.5 py-1 rounded-lg">
              {selectedTaskIds.length} Tasks Selected
            </span>
            <span className="text-xs text-[#A29DB8]">
              Select sprint tasks for bulk management or deletion.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedTaskIds([])}
              className="text-xs text-[#A29DB8] hover:text-white px-3 py-1.5 rounded-lg transition"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleBatchDeleteTasks}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-600/30 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected ({selectedTaskIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Kanban Board with Interactive Assignment Controls */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {columns.map((col) => {
          const colTasks = filteredTasks.filter((t) => t.status === col.id);
          return (
            <div
              key={col.id}
              className="bg-[#F7F5FE] rounded-2xl p-3.5 border border-[#E7E0FB] flex flex-col min-h-[65vh]"
            >
              <div className="flex items-center justify-between px-2 py-1.5 mb-2 border-b border-[#E7E0FB] pb-2">
                <span className="text-xs font-extrabold text-[#120E24] uppercase tracking-wider">
                  {col.label}
                </span>
                <span className="px-2 py-0.5 bg-[#EDE4FF] text-[#7C2CF5] rounded-full text-[11px] font-bold">
                  {colTasks.length}
                </span>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto">
                {colTasks.length === 0 ? (
                  <div className="h-28 border border-dashed border-[#DDD0FE] rounded-xl flex items-center justify-center text-xs text-[#585172]">
                    No tasks in {col.label}
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <div
                      key={task.id}
                      className="bg-white p-4 rounded-xl border border-[#E7E0FB] shadow-xs space-y-2.5 hover:border-[#7C2CF5] transition group relative"
                    >
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5">
                          {isLakshay && (
                            <input
                              type="checkbox"
                              checked={selectedTaskIds.includes(task.id)}
                              onChange={() => handleToggleSelectTask(task.id)}
                              className="w-3.5 h-3.5 rounded text-[#7C2CF5] accent-[#7C2CF5] cursor-pointer"
                              title="Select task"
                            />
                          )}
                          <span className="text-[10px] font-mono font-bold text-[#7C2CF5] bg-[#EDE4FF] px-2 py-0.5 rounded-md">
                            {task.taskCode}
                          </span>
                          <span className="text-[9px] font-bold text-[#585172] bg-[#F7F5FE] px-1.5 py-0.5 rounded border border-[#E7E0FB]">
                            {task.project?.name || 'Platform'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              task.priority === 'URGENT'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : task.priority === 'HIGH'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-[#F0ECFC] text-[#585172]'
                            }`}
                          >
                            {task.priority}
                          </span>
                          {isLakshay && (
                            <button
                              type="button"
                              onClick={() => handleDeleteTask(task.id, task.taskCode)}
                              title="Delete Task (Founder Only)"
                              className="text-slate-300 hover:text-rose-600 p-0.5 rounded transition opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Title & Desc */}
                      <div>
                        <div className="font-bold text-[#120E24] text-xs leading-snug">{task.title}</div>
                        {task.description && (
                          <p className="text-[11px] text-[#585172] line-clamp-2 mt-1 leading-relaxed">
                            {task.description}
                          </p>
                        )}
                      </div>

                      {/* Assignee & Delegation Badge (Founder can reassign anytime) */}
                      <div className="p-2 bg-[#F9F7FE] border border-[#E7E0FB] rounded-xl flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-lg bg-[#EDE4FF] text-[#7C2CF5] border border-[#DDD0FE] flex items-center justify-center font-extrabold text-[10px] shrink-0">
                            {(task.assigneeName || 'U')[0]}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-[11px] text-[#120E24] block truncate">
                              {task.assigneeName || 'Unassigned'}
                            </span>
                            <span className="text-[9px] text-[#585172] block truncate">
                              {task.assigneeRole || 'Team Member'}
                            </span>
                          </div>
                        </div>

                        {/* Quick Reassign Dropdown for Founder / Lead */}
                        <select
                          value={task.assigneeEmployeeId || ''}
                          onChange={(e) => handleReassignTask(task.id, e.target.value)}
                          title="Reassign to another team member"
                          className="text-[10px] font-bold text-[#7C2CF5] bg-white border border-[#DDD0FE] rounded-lg px-2 py-1 outline-none hover:border-[#7C2CF5] transition cursor-pointer max-w-[100px] truncate"
                        >
                          <option value="" disabled>Reassign...</option>
                          {team.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Assigned By note & Sprint tag */}
                      <div className="flex items-center justify-between text-[10px] text-[#585172]">
                        <span className="italic truncate max-w-[140px]">
                          By: {task.assignedBy || 'Lakshay (Founder)'}
                        </span>
                        <span>{task.estimateHours || 4}h est.</span>
                      </div>

                      {/* Move Column Status Selector */}
                      <div className="pt-2 border-t border-[#E7E0FB] flex items-center justify-between text-[11px]">
                        <span className="text-[10px] text-[#585172] font-semibold">Move Stage:</span>
                        <select
                          value={task.status}
                          onChange={(e) => handleStatusChange(task.id, e.target.value)}
                          className="text-[10px] font-bold bg-[#F7F5FE] border border-[#E7E0FB] rounded-lg px-2 py-1 text-[#120E24] hover:border-[#7C2CF5] transition"
                        >
                          {columns.map((c) => (
                            <option key={c.id} value={c.id}>
                              &rarr; {c.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Assign Work / Create Task Modal */}
      {createTaskOpen && (
        <div className="fixed inset-0 bg-[#120E24]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#E7E0FB] max-h-[90vh] overflow-y-auto font-['Plus_Jakarta_Sans',sans-serif]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E0FB] mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#7C2CF5] to-[#6D25D9] text-white flex items-center justify-center shadow-md shadow-[#7C2CF5]/20">
                  <Code2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#120E24] text-base">
                    Assign Work / Create Engineering Task
                  </h3>
                  <p className="text-[11px] text-[#585172]">
                    Lakshay (Founder) & Leads: Assign deliverables to anyone across the company
                  </p>
                </div>
              </div>
              <button onClick={() => setCreateTaskOpen(false)} className="text-[#585172] hover:text-[#120E24] p-1.5 rounded-xl hover:bg-[#F7F5FE]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#120E24] mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3.5 py-2.5 text-[#120E24] font-semibold focus:outline-none focus:border-[#7C2CF5]"
                  placeholder="e.g. Build client project record drawer & real-time webhook ingestion"
                />
              </div>

              {/* Assignee Selection (Founder can assign to ANYONE!) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-[#120E24] flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#7C2CF5]" />
                    <span>Assign Work To Team Member *</span>
                  </label>
                  <span className="text-[10px] text-[#7C2CF5] font-bold">
                    {team.length} Active Members Available
                  </span>
                </div>
                <select
                  required
                  value={taskAssigneeId}
                  onChange={(e) => setTaskAssigneeId(e.target.value)}
                  className="w-full bg-[#F5F0FF] border border-[#DDD0FE] rounded-xl px-3.5 py-2.5 text-[#120E24] font-bold focus:outline-none focus:border-[#7C2CF5]"
                >
                  <option value="" disabled>-- Select Assignee --</option>
                  {team.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} &bull; {m.designation || m.department || 'Team Member'} ({m.employeeCode || 'CDX'})
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-[#585172] mt-0.5 block">
                  Select Parth Sharma, Anshuman, Diya, Suryansh, Ishita, or any SDE/Intern.
                </span>
              </div>

              {/* Project & Sprint */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Target Project / Module</label>
                  <select
                    value={taskProjectId}
                    onChange={(e) => setTaskProjectId(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] font-semibold focus:outline-none focus:border-[#7C2CF5]"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.projectCode} &bull; {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Sprint / Milestone</label>
                  <input
                    type="text"
                    value={taskSprint}
                    onChange={(e) => setTaskSprint(e.target.value)}
                    placeholder="e.g. Current Sprint"
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] font-semibold focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
              </div>

              {/* Priority, Type & Estimate */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] font-bold focus:outline-none focus:border-[#7C2CF5]"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent 🔥</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Task Type</label>
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] font-bold focus:outline-none focus:border-[#7C2CF5]"
                  >
                    <option value="FEATURE">Feature</option>
                    <option value="BUG">Bug Fix</option>
                    <option value="ARCHITECTURE">Architecture</option>
                    <option value="OPTIMIZATION">Optimization</option>
                    <option value="INFRASTRUCTURE">Infrastructure</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Est. Hours</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={taskEstimate}
                    onChange={(e) => setTaskEstimate(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] font-bold focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label className="block font-bold text-[#120E24] mb-1">Deadline / Target Due Date (Optional)</label>
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3.5 py-2 text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                />
              </div>

              {/* Detailed Technical Description */}
              <div>
                <label className="block font-bold text-[#120E24] mb-1">Technical Scope & Acceptance Criteria</label>
                <textarea
                  rows={3}
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3.5 py-2 text-[#120E24] focus:outline-none focus:border-[#7C2CF5] leading-relaxed"
                  placeholder="Outline expected deliverables, architecture guidelines, test coverage, and edge cases..."
                />
              </div>

              <div className="pt-3 border-t border-[#E7E0FB] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateTaskOpen(false)}
                  className="px-4 py-2 border border-[#E7E0FB] rounded-xl text-[#585172] hover:bg-[#F7F5FE] font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-[#7C2CF5] to-[#6D25D9] hover:from-[#6D25D9] hover:to-[#5B1EB7] text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow-md shadow-[#7C2CF5]/25"
                >
                  <Check className="w-4 h-4" />
                  <span>Assign & Publish Task</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* 6. Daily Standup Modal */}
      {standupModalOpen && (
        <div className="fixed inset-0 bg-[#120E24]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#E7E0FB]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E0FB] mb-4">
              <div>
                <h3 className="font-extrabold text-[#120E24] text-base">Submit Daily Standup Update</h3>
                <p className="text-[11px] text-[#585172]">Record engineering progress and surface any blockers for leadership</p>
              </div>
              <button onClick={() => setStandupModalOpen(false)} className="text-[#585172] hover:text-[#120E24]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitStandup} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-[#120E24] mb-1">Active Project Working On *</label>
                <select
                  value={standupProjectId}
                  onChange={(e) => setStandupProjectId(e.target.value)}
                  className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3.5 py-2 text-[#120E24] font-bold focus:border-[#7C2CF5] focus:outline-none"
                >
                  {projects.map((p) => (
                    <option key={p.id || p._id} value={p.id || p._id}>
                      {p.projectCode} &bull; {p.name}
                    </option>
                  ))}
                  {projects.length === 0 && (
                    <option value="">General Project Work</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#120E24] mb-1">What did you complete today? *</label>
                <textarea
                  required
                  rows={2}
                  value={completedItems}
                  onChange={(e) => setCompletedItems(e.target.value)}
                  className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3.5 py-2 text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                  placeholder="e.g. Completed candidate serial number routing & SMTP configuration"
                />
              </div>

              <div>
                <label className="block font-bold text-[#120E24] mb-1">What are you working on next?</label>
                <textarea
                  required
                  rows={2}
                  value={inProgressItems}
                  onChange={(e) => setInProgressItems(e.target.value)}
                  className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3.5 py-2 text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                  placeholder="e.g. Integrating engineering workload dashboard for Lakshay"
                />
              </div>

              <div>
                <label className="block font-bold text-[#120E24] mb-1">Any blockers?</label>
                <input
                  type="text"
                  value={blockers}
                  onChange={(e) => setBlockers(e.target.value)}
                  className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3.5 py-2 text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                  placeholder="e.g. None or waiting on Google OAuth Client Secret"
                />
              </div>

              <div>
                <label className="block font-bold text-[#120E24] mb-1">Tomorrow's Planned Outcomes</label>
                <input
                  type="text"
                  value={nextDayPlan}
                  onChange={(e) => setNextDayPlan(e.target.value)}
                  className="w-full border border-[#E7E0FB] bg-[#FBFBFE] rounded-xl px-3.5 py-2 text-[#120E24] focus:border-[#7C2CF5] focus:outline-none"
                  placeholder="e.g. Deploy Sprint 14 updates to staging"
                />
              </div>

              <div className="pt-3 border-t border-[#E7E0FB] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStandupModalOpen(false)}
                  className="px-4 py-2 border border-[#E7E0FB] rounded-xl text-[#585172] hover:bg-[#F7F5FE] font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl font-bold shadow-md shadow-[#7C2CF5]/25 transition"
                >
                  Submit Standup
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
