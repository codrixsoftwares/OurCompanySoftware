import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { apiRequest } from '../../api/client.js';
import { getSocket } from '../../core/socket.js';
import {
  FolderKanban,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Trash2,
  Edit3,
  ExternalLink,
  Code2,
  DollarSign,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  Check,
  Bug,
  Globe,
  GitBranch,
  RefreshCw,
  Briefcase
} from 'lucide-react';

interface Project {
  id: string;
  _id?: string;
  projectCode: string;
  name: string;
  description?: string;
  customerId?: string;
  customerName?: string;
  customerCompany?: string;
  customerEmail?: string;
  status: 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'ON_HOLD' | 'ARCHIVED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  managerEmployeeId?: string;
  leadEngineerName?: string;
  techStack?: string[];
  budget?: number;
  currency?: string;
  repositoryUrl?: string;
  startDate?: string;
  targetEndDate?: string;
  actualEndDate?: string;
  taskStats?: {
    total: number;
    completed: number;
    inProgress: number;
    openBugs: number;
    progressPercentage: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

interface ProjectsViewProps {
  onNavigate?: (tab: string, context?: any) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({ onNavigate }) => {
  const { isCoreTeam, isLakshay, session } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  // Selection & Batch Delete (Superadmin Lakshay)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals & Drawers
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [drawerProject, setDrawerProject] = useState<Project | null>(null);
  const [drawerTasks, setDrawerTasks] = useState<any[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Form State (Create / Edit)
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formCustomerCompany, setFormCustomerCompany] = useState('');
  const [formCustomerEmail, setFormCustomerEmail] = useState('');
  const [formStatus, setFormStatus] = useState<Project['status']>('ACTIVE');
  const [formPriority, setFormPriority] = useState<Project['priority']>('HIGH');
  const [formLeadEngineer, setFormLeadEngineer] = useState('');
  const [formTechStack, setFormTechStack] = useState('');
  const [formBudget, setFormBudget] = useState('');
  const [formRepoUrl, setFormRepoUrl] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formTargetEndDate, setFormTargetEndDate] = useState('');

  // CRM Leads / Customers for association
  const [crmCustomers, setCrmCustomers] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [projsRes, crmRes, teamRes] = await Promise.allSettled([
        apiRequest<Project[]>('/projects'),
        apiRequest<any[]>('/crm/leads'),
        apiRequest<any[]>('/hrms/employees')
      ]);

      if (projsRes.status === 'fulfilled' && Array.isArray(projsRes.value)) {
        setProjects(projsRes.value);
      }
      if (crmRes.status === 'fulfilled' && Array.isArray(crmRes.value)) {
        setCrmCustomers(crmRes.value);
      }
      if (teamRes.status === 'fulfilled' && Array.isArray(teamRes.value)) {
        setTeamMembers(teamRes.value);
      }
    } catch (err: any) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const socket = getSocket();
    const handleUpdate = () => loadData();

    socket.on('projects:project_created', handleUpdate);
    socket.on('projects:project_updated', handleUpdate);
    socket.on('projects:project_deleted', handleUpdate);
    socket.on('projects:projects_batch_deleted', handleUpdate);
    socket.on('engineering:project_created', handleUpdate);
    socket.on('engineering:project_deleted', handleUpdate);
    socket.on('engineering:task_created', handleUpdate);
    socket.on('engineering:task_updated', handleUpdate);
    socket.on('engineering:task_deleted', handleUpdate);

    return () => {
      socket.off('projects:project_created', handleUpdate);
      socket.off('projects:project_updated', handleUpdate);
      socket.off('projects:project_deleted', handleUpdate);
      socket.off('projects:projects_batch_deleted', handleUpdate);
      socket.off('engineering:project_created', handleUpdate);
      socket.off('engineering:project_deleted', handleUpdate);
      socket.off('engineering:task_created', handleUpdate);
      socket.off('engineering:task_updated', handleUpdate);
      socket.off('engineering:task_deleted', handleUpdate);
    };
  }, []);

  // Filtered Projects
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.projectCode.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.customerName && p.customerName.toLowerCase().includes(q)) ||
        (p.customerCompany && p.customerCompany.toLowerCase().includes(q)) ||
        (p.leadEngineerName && p.leadEngineerName.toLowerCase().includes(q));

      const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
      const matchesPriority = priorityFilter === 'ALL' || p.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [projects, searchQuery, statusFilter, priorityFilter]);

  // Project Stats
  const stats = useMemo(() => {
    const total = projects.length;
    const active = projects.filter((p) => p.status === 'ACTIVE').length;
    const planning = projects.filter((p) => p.status === 'PLANNING').length;
    const completed = projects.filter((p) => p.status === 'COMPLETED').length;
    const totalBudget = projects.reduce((acc, p) => acc + (Number(p.budget) || 0), 0);
    const totalTasks = projects.reduce((acc, p) => acc + (p.taskStats?.total || 0), 0);
    return { total, active, planning, completed, totalBudget, totalTasks };
  }, [projects]);

  // Open Create Modal
  const openCreateModal = () => {
    setFormName('');
    setFormCode('');
    setFormDescription('');
    setFormCustomerName('');
    setFormCustomerCompany('');
    setFormCustomerEmail('');
    setFormStatus('ACTIVE');
    setFormPriority('HIGH');
    setFormLeadEngineer('');
    setFormTechStack('');
    setFormBudget('');
    setFormRepoUrl('');
    setFormStartDate(new Date().toISOString().split('T')[0]);
    setFormTargetEndDate('');
    setCreateModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (p: Project) => {
    setEditingProject(p);
    setFormName(p.name);
    setFormCode(p.projectCode);
    setFormDescription(p.description || '');
    setFormCustomerName(p.customerName || '');
    setFormCustomerCompany(p.customerCompany || '');
    setFormCustomerEmail(p.customerEmail || '');
    setFormStatus(p.status || 'ACTIVE');
    setFormPriority(p.priority || 'MEDIUM');
    setFormLeadEngineer(p.leadEngineerName || '');
    setFormTechStack((p.techStack || []).join(', '));
    setFormBudget(p.budget ? String(p.budget) : '');
    setFormRepoUrl(p.repositoryUrl || '');
    setFormStartDate(p.startDate ? p.startDate.split('T')[0] : '');
    setFormTargetEndDate(p.targetEndDate ? p.targetEndDate.split('T')[0] : '');
    setEditModalOpen(true);
  };

  // Open 360 Drawer
  const openProject360 = async (p: Project) => {
    setDrawerProject(p);
    setDrawerTasks([]);
    setDrawerLoading(true);
    try {
      const details = await apiRequest<any>(`/projects/${p.id || (p as any)._id}`);
      if (details && details.tasks) {
        setDrawerTasks(details.tasks);
      }
    } catch (err) {
      console.error('Error fetching project 360 details:', err);
    } finally {
      setDrawerLoading(false);
    }
  };

  // Submit Create Project
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert('Please enter a project name.');
      return;
    }

    const techArray = formTechStack
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      await apiRequest('/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: formName.trim(),
          projectCode: formCode.trim() || undefined,
          description: formDescription.trim(),
          customerName: formCustomerName.trim() || undefined,
          customerCompany: formCustomerCompany.trim() || undefined,
          customerEmail: formCustomerEmail.trim() || undefined,
          status: formStatus,
          priority: formPriority,
          leadEngineerName: formLeadEngineer.trim() || undefined,
          techStack: techArray,
          budget: formBudget ? Number(formBudget) : undefined,
          repositoryUrl: formRepoUrl.trim() || undefined,
          startDate: formStartDate || undefined,
          targetEndDate: formTargetEndDate || undefined
        })
      });
      setCreateModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error creating project');
    }
  };

  // Submit Edit Project
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;

    const techArray = formTechStack
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      await apiRequest(`/projects/${editingProject.id || (editingProject as any)._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: formName.trim(),
          projectCode: formCode.trim() || undefined,
          description: formDescription.trim(),
          customerName: formCustomerName.trim() || undefined,
          customerCompany: formCustomerCompany.trim() || undefined,
          customerEmail: formCustomerEmail.trim() || undefined,
          status: formStatus,
          priority: formPriority,
          leadEngineerName: formLeadEngineer.trim() || undefined,
          techStack: techArray,
          budget: formBudget ? Number(formBudget) : undefined,
          repositoryUrl: formRepoUrl.trim() || undefined,
          startDate: formStartDate || undefined,
          targetEndDate: formTargetEndDate || undefined
        })
      });
      setEditModalOpen(false);
      setEditingProject(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error updating project');
    }
  };

  // Single Delete (Superadmin Lakshay Only)
  const handleDelete = async (p: Project) => {
    if (!isLakshay) {
      alert('Security Restriction: Only Lakshay (Founder & Overall Superadmin) is authorized to delete projects.');
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to permanently delete project "${p.name}" (${p.projectCode})?\n\nThis will also remove associated tasks and update the engineering board.`
      )
    ) {
      return;
    }

    try {
      await apiRequest(`/projects/${p.id || (p as any)._id}`, {
        method: 'DELETE'
      });
      setSelectedIds((prev) => prev.filter((id) => id !== p.id));
      if (drawerProject?.id === p.id) {
        setDrawerProject(null);
      }
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error deleting project');
    }
  };

  // Batch Delete (Superadmin Lakshay Only)
  const handleBatchDelete = async () => {
    if (!isLakshay) {
      alert('Security Restriction: Only Lakshay (Founder & Overall Superadmin) is authorized to perform batch deletion.');
      return;
    }

    if (selectedIds.length === 0) return;

    if (
      !window.confirm(
        `Founder Action Required:\n\nAre you sure you want to permanently delete ${selectedIds.length} selected projects?\nThis action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await apiRequest('/projects/batch-delete', {
        method: 'POST',
        body: JSON.stringify({ projectIds: selectedIds })
      });
      setSelectedIds([]);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Error batch deleting projects');
    }
  };

  // Toggle selection
  const toggleSelectAll = () => {
    if (selectedIds.length === filteredProjects.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProjects.map((p) => p.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Restrict to Core Team only
  if (!isCoreTeam && !isLakshay) {
    return (
      <div className="p-12 text-center text-[#585172] bg-white rounded-3xl border border-[#E7E0FB] m-6 font-['Plus_Jakarta_Sans',sans-serif]">
        <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-200">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-extrabold text-[#120E24]">Core Leadership Access Only</h2>
        <p className="text-xs text-[#585172] mt-2 max-w-md mx-auto leading-relaxed">
          The CodRix Projects Hub provides enterprise-level database visibility and management for active client initiatives and internal roadmaps. Restricted to Core Team leaders (Lakshay, Parth, Diya, Suryansh, Ishita, and Anshuman).
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-['Plus_Jakarta_Sans',sans-serif]">
      {/* 1. Header & Live Indicator */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-[#7C2CF5] text-white shadow-md shadow-[#7C2CF5]/25">
              <FolderKanban className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold text-[#120E24] tracking-tight">
                  Projects & Enterprise Initiatives
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#EDE4FF] text-[#7C2CF5] border border-[#DDD0FE]">
                  Core Team Only
                </span>
                {isLakshay && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Superadmin Full CRUD
                  </span>
                )}
              </div>
              <p className="text-xs text-[#585172] font-medium mt-0.5">
                Centralized database for all active software builds, client contracts, budgets, and sprint alignment.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => loadData()}
            className="p-2 text-[#585172] hover:text-[#7C2CF5] hover:bg-[#F0ECFC] border border-[#E7E0FB] rounded-xl transition"
            title="Refresh database records"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {onNavigate && (
            <button
              onClick={() => onNavigate('engineering')}
              className="px-3.5 py-2 bg-[#F7F5FE] hover:bg-[#F0ECFC] text-[#585172] hover:text-[#7C2CF5] border border-[#E7E0FB] rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <Code2 className="w-3.5 h-3.5 text-[#7C2CF5]" />
              <span>Sprint Backlog</span>
            </button>
          )}

          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl text-xs font-bold shadow-md shadow-[#7C2CF5]/25 transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>+ New Project</span>
          </button>
        </div>
      </div>

      {/* 2. Top Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="p-4 bg-white rounded-2xl border border-[#E7E0FB] shadow-xs">
          <div className="text-[11px] font-bold text-[#585172]">Total Projects</div>
          <div className="text-2xl font-black text-[#120E24] mt-1">{stats.total}</div>
          <div className="text-[10px] text-[#7C2CF5] font-semibold mt-0.5">Active portfolio</div>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-[#E7E0FB] shadow-xs">
          <div className="text-[11px] font-bold text-[#585172]">Active Builds</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{stats.active}</div>
          <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">In active development</div>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-[#E7E0FB] shadow-xs">
          <div className="text-[11px] font-bold text-[#585172]">In Planning</div>
          <div className="text-2xl font-black text-sky-600 mt-1">{stats.planning}</div>
          <div className="text-[10px] text-sky-700 font-semibold mt-0.5">Architecture & design</div>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-[#E7E0FB] shadow-xs">
          <div className="text-[11px] font-bold text-[#585172]">Completed</div>
          <div className="text-2xl font-black text-indigo-600 mt-1">{stats.completed}</div>
          <div className="text-[10px] text-indigo-700 font-semibold mt-0.5">Delivered & closed</div>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-[#E7E0FB] shadow-xs">
          <div className="text-[11px] font-bold text-[#585172]">Total Portfolio Value</div>
          <div className="text-2xl font-black text-[#7C2CF5] mt-1">
            ₹{stats.totalBudget.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-[#585172] font-semibold mt-0.5">Combined contract value</div>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-[#E7E0FB] shadow-xs">
          <div className="text-[11px] font-bold text-[#585172]">Linked Sprints</div>
          <div className="text-2xl font-black text-[#120E24] mt-1">{stats.totalTasks}</div>
          <div className="text-[10px] text-[#585172] font-semibold mt-0.5">Total sprint tasks</div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="p-3.5 bg-white rounded-2xl border border-[#E7E0FB] shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#585172]" />
          <input
            type="text"
            placeholder="Search by code, title, client, tech stack, or lead..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl text-xs text-[#120E24] placeholder:text-[#585172] font-medium focus:outline-none focus:border-[#7C2CF5]"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-[#585172]">
            <Filter className="w-3.5 h-3.5" />
            <span className="font-bold">Status:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl text-xs font-bold text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active (In Dev)</option>
            <option value="PLANNING">Planning / Architecture</option>
            <option value="COMPLETED">Completed</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="ARCHIVED">Archived</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-1.5 bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl text-xs font-bold text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      {/* 4. Projects Table */}
      <div className="bg-white rounded-3xl border border-[#E7E0FB] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FBFBFE] border-b border-[#E7E0FB] text-[11px] font-extrabold text-[#585172] uppercase tracking-wider">
                {isLakshay && (
                  <th className="py-3.5 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredProjects.length > 0 &&
                        selectedIds.length === filteredProjects.length
                      }
                      onChange={toggleSelectAll}
                      className="rounded border-[#E7E0FB] text-[#7C2CF5] focus:ring-[#7C2CF5]"
                      title="Select all projects for founder actions"
                    />
                  </th>
                )}
                <th className="py-3.5 px-4">Code & Project</th>
                <th className="py-3.5 px-4">Client / Enterprise</th>
                <th className="py-3.5 px-4">Status & Priority</th>
                <th className="py-3.5 px-4">Lead & Team</th>
                <th className="py-3.5 px-4">Tech Stack</th>
                <th className="py-3.5 px-4">Sprint Progress</th>
                <th className="py-3.5 px-4">Budget</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E0FB] text-xs">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={isLakshay ? 9 : 8} className="py-12 text-center text-[#585172]">
                    <div className="max-w-xs mx-auto space-y-2">
                      <FolderKanban className="w-8 h-8 text-[#585172]/40 mx-auto" />
                      <div className="font-bold text-[#120E24]">No projects found</div>
                      <p className="text-[11px]">
                        {searchQuery
                          ? 'No project matched your filter criteria. Try adjusting your search query.'
                          : 'No projects registered in the database yet. Click "+ New Project" above to create one.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProjects.map((p) => {
                  const isSelected = selectedIds.includes(p.id);
                  const progress = p.taskStats?.progressPercentage || 0;
                  const totalTasks = p.taskStats?.total || 0;
                  const completedTasks = p.taskStats?.completed || 0;
                  const bugs = p.taskStats?.openBugs || 0;

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-[#F9F7FE]/60 transition ${
                        isSelected ? 'bg-[#F0ECFC]/40' : ''
                      }`}
                    >
                      {/* Checkbox (Founder Only) */}
                      {isLakshay && (
                        <td className="py-4 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(p.id)}
                            className="rounded border-[#E7E0FB] text-[#7C2CF5] focus:ring-[#7C2CF5]"
                          />
                        </td>
                      )}

                      {/* Code & Project Name */}
                      <td className="py-4 px-4">
                        <div className="flex items-start gap-2.5">
                          <div className="p-2 rounded-xl bg-[#F0ECFC] text-[#7C2CF5] shrink-0 mt-0.5">
                            <Layers className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[10px] font-bold text-[#7C2CF5] bg-[#EDE4FF] px-1.5 py-0.5 rounded">
                                {p.projectCode}
                              </span>
                              <span className="font-extrabold text-[#120E24] hover:text-[#7C2CF5] cursor-pointer"
                                onClick={() => openProject360(p)}
                              >
                                {p.name}
                              </span>
                            </div>
                            {p.description && (
                              <p className="text-[11px] text-[#585172] line-clamp-1 mt-0.5 max-w-xs">
                                {p.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Client / Enterprise */}
                      <td className="py-4 px-4">
                        {p.customerCompany || p.customerName ? (
                          <div>
                            <div className="font-bold text-[#120E24]">
                              {p.customerCompany || p.customerName}
                            </div>
                            {p.customerCompany && p.customerName && (
                              <div className="text-[10px] text-[#585172]">
                                Contact: {p.customerName}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#585172] italic">
                            —
                          </span>
                        )}
                      </td>

                      {/* Status & Priority */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              p.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : p.status === 'PLANNING'
                                ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                : p.status === 'COMPLETED'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {p.status}
                          </span>
                          {p.priority && (
                            <div className="text-[10px] font-bold text-[#585172]">
                              Priority: <span className="text-[#120E24]">{p.priority}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Lead Engineer */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-[#120E24]">
                          {p.leadEngineerName || '—'}
                        </div>
                        <div className="text-[10px] text-[#585172]">
                          Lead Technical Owner
                        </div>
                      </td>

                      {/* Tech Stack Pills */}
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {p.techStack && p.techStack.length > 0 ? (
                            p.techStack.slice(0, 3).map((t, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded bg-[#F7F5FE] text-[#7C2CF5] text-[10px] font-bold border border-[#E7E0FB]"
                              >
                                {t}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-[#585172] italic">None</span>
                          )}
                          {p.techStack && p.techStack.length > 3 && (
                            <span className="text-[9px] text-[#585172] font-semibold self-center">
                              +{p.techStack.length - 3} more
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Sprint Progress Bar */}
                      <td className="py-4 px-4">
                        <div className="w-28 space-y-1">
                          <div className="flex justify-between text-[10px] font-bold">
                            <span className="text-[#120E24]">{progress}%</span>
                            <span className="text-[#585172]">
                              {completedTasks}/{totalTasks} tasks
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-[#E7E0FB] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          {bugs > 0 && (
                            <div className="text-[9px] text-rose-600 font-bold flex items-center gap-1">
                              <Bug className="w-3 h-3" />
                              <span>{bugs} Open Bug{bugs > 1 ? 's' : ''}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Budget */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-[#120E24]">
                          {p.budget ? `₹${Number(p.budget).toLocaleString('en-IN')}` : '—'}
                        </div>
                        <div className="text-[10px] text-[#585172]">
                          {p.currency || 'INR'}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openProject360(p)}
                            className="px-2.5 py-1.5 bg-[#F0ECFC] hover:bg-[#EDE4FF] text-[#7C2CF5] font-bold text-[11px] rounded-lg transition"
                            title="View Project 360 overview"
                          >
                            View 360
                          </button>

                          {onNavigate && (
                            <button
                              onClick={() => {
                                onNavigate('engineering');
                              }}
                              className="p-1.5 text-[#585172] hover:text-[#7C2CF5] hover:bg-[#F0ECFC] rounded-lg transition"
                              title="Open in Engineering Sprints"
                            >
                              <Code2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1.5 text-[#585172] hover:text-[#120E24] hover:bg-[#F7F5FE] rounded-lg transition"
                            title="Edit Project Details"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {isLakshay && (
                            <button
                              onClick={() => handleDelete(p)}
                              className="p-1.5 text-[#585172] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Delete Project (Founder & Superadmin Only)"
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
      </div>

      {/* Floating Batch Actions Bar for Founder Lakshay */}
      {isLakshay && selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#120E24] text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-3 border border-white/10">
          <div className="text-xs font-bold">
            <span className="text-[#7C2CF5] bg-white px-2 py-0.5 rounded-full font-black mr-2 text-[11px]">
              {selectedIds.length}
            </span>
            Projects Selected
          </div>
          <div className="h-4 w-px bg-white/20" />
          <button
            onClick={handleBatchDelete}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Batch Delete Projects</span>
          </button>
          <button
            onClick={() => setSelectedIds([])}
            className="text-xs text-white/70 hover:text-white underline cursor-pointer"
          >
            Deselect
          </button>
        </div>
      )}

      {/* 5. Create Project Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-[#120E24]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-[#E7E0FB] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#E7E0FB] mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#F0ECFC] text-[#7C2CF5] rounded-xl">
                  <FolderKanban className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#120E24] text-base">
                    Create New Enterprise Project
                  </h3>
                  <p className="text-[11px] text-[#585172]">
                    Register a new client or internal engineering initiative with complete budget & timeline.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-[#585172] hover:text-[#120E24] p-1.5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Project Name *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. MedTech Tele-Health Portal"
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3.5 py-2 text-[#120E24] font-bold focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">
                    Project Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="Auto-generated if blank (e.g. CDX-PRJ-004)"
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3.5 py-2 text-[#120E24] font-mono focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#120E24] mb-1">Scope & Specifications</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Summary of deliverables, goals, architecture requirements..."
                  className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3.5 py-2 text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                />
              </div>

              {/* Client Details */}
              <div className="p-3.5 bg-[#F9F7FE] rounded-2xl border border-[#E7E0FB] space-y-3">
                <div className="text-[11px] font-extrabold text-[#7C2CF5] flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Client / Organization Information</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block font-semibold text-[#585172] mb-1">Company / Organization</label>
                    <input
                      type="text"
                      value={formCustomerCompany}
                      onChange={(e) => setFormCustomerCompany(e.target.value)}
                      placeholder="e.g. Apex Health Systems"
                      className="w-full bg-white border border-[#E7E0FB] rounded-xl px-3 py-1.5 text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#585172] mb-1">Contact Person</label>
                    <input
                      type="text"
                      value={formCustomerName}
                      onChange={(e) => setFormCustomerName(e.target.value)}
                      placeholder="e.g. Dr. Rajesh Verma"
                      className="w-full bg-white border border-[#E7E0FB] rounded-xl px-3 py-1.5 text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#585172] mb-1">Contact Email</label>
                    <input
                      type="email"
                      value={formCustomerEmail}
                      onChange={(e) => setFormCustomerEmail(e.target.value)}
                      placeholder="rajesh@apexhealth.com"
                      className="w-full bg-white border border-[#E7E0FB] rounded-xl px-3 py-1.5 text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] font-bold focus:outline-none focus:border-[#7C2CF5]"
                  >
                    <option value="ACTIVE">ACTIVE (In Development)</option>
                    <option value="PLANNING">PLANNING (Architecture)</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="ON_HOLD">ON HOLD</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Priority</label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as any)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] font-bold focus:outline-none focus:border-[#7C2CF5]"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Lead Engineer / PM</label>
                  <input
                    type="text"
                    value={formLeadEngineer}
                    onChange={(e) => setFormLeadEngineer(e.target.value)}
                    placeholder="e.g. Parth Sharma"
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Tech Stack (Comma-separated)</label>
                  <input
                    type="text"
                    value={formTechStack}
                    onChange={(e) => setFormTechStack(e.target.value)}
                    placeholder="React, Node.js, MongoDB, TypeScript, AWS"
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Project Budget (₹)</label>
                  <input
                    type="number"
                    value={formBudget}
                    onChange={(e) => setFormBudget(e.target.value)}
                    placeholder="e.g. 500000"
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] font-bold focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Start Date</label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Target Delivery Date</label>
                  <input
                    type="date"
                    value={formTargetEndDate}
                    onChange={(e) => setFormTargetEndDate(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Git Repository URL</label>
                  <input
                    type="url"
                    value={formRepoUrl}
                    onChange={(e) => setFormRepoUrl(e.target.value)}
                    placeholder="https://github.com/..."
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-[#E7E0FB] flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 border border-[#E7E0FB] rounded-xl text-[#585172] hover:bg-[#F7F5FE] font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl font-bold shadow-md shadow-[#7C2CF5]/25 transition"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Edit Project Modal */}
      {editModalOpen && editingProject && (
        <div className="fixed inset-0 bg-[#120E24]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-[#E7E0FB] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#E7E0FB] mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#F0ECFC] text-[#7C2CF5] rounded-xl">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#120E24] text-base">
                    Edit Project: {editingProject.projectCode}
                  </h3>
                  <p className="text-[11px] text-[#585172]">
                    Update specifications, assigned leads, timeline, or commercial budget.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-[#585172] hover:text-[#120E24] p-1.5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Project Name *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3.5 py-2 text-[#120E24] font-bold focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Project Code</label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3.5 py-2 text-[#120E24] font-mono focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#120E24] mb-1">Scope & Specifications</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3.5 py-2 text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                />
              </div>

              {/* Client Info */}
              <div className="p-3.5 bg-[#F9F7FE] rounded-2xl border border-[#E7E0FB] space-y-3">
                <div className="text-[11px] font-extrabold text-[#7C2CF5] flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Client / Organization Information</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block font-semibold text-[#585172] mb-1">Company / Organization</label>
                    <input
                      type="text"
                      value={formCustomerCompany}
                      onChange={(e) => setFormCustomerCompany(e.target.value)}
                      className="w-full bg-white border border-[#E7E0FB] rounded-xl px-3 py-1.5 text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#585172] mb-1">Contact Person</label>
                    <input
                      type="text"
                      value={formCustomerName}
                      onChange={(e) => setFormCustomerName(e.target.value)}
                      className="w-full bg-white border border-[#E7E0FB] rounded-xl px-3 py-1.5 text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#585172] mb-1">Contact Email</label>
                    <input
                      type="email"
                      value={formCustomerEmail}
                      onChange={(e) => setFormCustomerEmail(e.target.value)}
                      className="w-full bg-white border border-[#E7E0FB] rounded-xl px-3 py-1.5 text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] font-bold focus:outline-none focus:border-[#7C2CF5]"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="PLANNING">PLANNING</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="ON_HOLD">ON HOLD</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Priority</label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as any)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] font-bold focus:outline-none focus:border-[#7C2CF5]"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Lead Engineer / PM</label>
                  <input
                    type="text"
                    value={formLeadEngineer}
                    onChange={(e) => setFormLeadEngineer(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Tech Stack</label>
                  <input
                    type="text"
                    value={formTechStack}
                    onChange={(e) => setFormTechStack(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Budget (₹)</label>
                  <input
                    type="number"
                    value={formBudget}
                    onChange={(e) => setFormBudget(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] font-bold focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Start Date</label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Target End Date</label>
                  <input
                    type="date"
                    value={formTargetEndDate}
                    onChange={(e) => setFormTargetEndDate(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#120E24] mb-1">Git Repository URL</label>
                  <input
                    type="url"
                    value={formRepoUrl}
                    onChange={(e) => setFormRepoUrl(e.target.value)}
                    className="w-full bg-[#FBFBFE] border border-[#E7E0FB] rounded-xl px-3 py-2 text-[#120E24] focus:outline-none focus:border-[#7C2CF5]"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-[#E7E0FB] flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 border border-[#E7E0FB] rounded-xl text-[#585172] hover:bg-[#F7F5FE] font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl font-bold shadow-md shadow-[#7C2CF5]/25 transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Project 360 Full Drawer */}
      {drawerProject && (
        <div className="fixed inset-0 bg-[#120E24]/60 backdrop-blur-xs flex justify-end z-50 animate-in fade-in">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl border-l border-[#E7E0FB] p-6 overflow-y-auto space-y-6 flex flex-col justify-between">
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-start justify-between pb-4 border-b border-[#E7E0FB]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#7C2CF5] bg-[#EDE4FF] px-2 py-0.5 rounded">
                      {drawerProject.projectCode}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        drawerProject.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : drawerProject.status === 'PLANNING'
                          ? 'bg-sky-50 text-sky-700 border border-sky-200'
                          : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      }`}
                    >
                      {drawerProject.status}
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-[#120E24] mt-1.5">
                    {drawerProject.name}
                  </h2>
                  {drawerProject.description && (
                    <p className="text-xs text-[#585172] mt-1 leading-relaxed">
                      {drawerProject.description}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => setDrawerProject(null)}
                  className="p-2 text-[#585172] hover:text-[#120E24] hover:bg-[#F7F5FE] rounded-xl transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* High-level Metric Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-[#F9F7FE] rounded-2xl border border-[#E7E0FB]">
                  <div className="text-[10px] font-bold text-[#585172]">Sprint Progress</div>
                  <div className="text-lg font-black text-emerald-600 mt-0.5">
                    {drawerProject.taskStats?.progressPercentage || 0}%
                  </div>
                  <div className="text-[10px] text-[#585172]">
                    {drawerProject.taskStats?.completed || 0}/{drawerProject.taskStats?.total || 0} tasks done
                  </div>
                </div>

                <div className="p-3 bg-[#F9F7FE] rounded-2xl border border-[#E7E0FB]">
                  <div className="text-[10px] font-bold text-[#585172]">Contract Budget</div>
                  <div className="text-lg font-black text-[#7C2CF5] mt-0.5">
                    {drawerProject.budget ? `₹${Number(drawerProject.budget).toLocaleString('en-IN')}` : '—'}
                  </div>
                  <div className="text-[10px] text-[#585172]">{drawerProject.currency || 'INR'}</div>
                </div>

                <div className="p-3 bg-[#F9F7FE] rounded-2xl border border-[#E7E0FB]">
                  <div className="text-[10px] font-bold text-[#585172]">Open Bugs</div>
                  <div className="text-lg font-black text-rose-600 mt-0.5">
                    {drawerProject.taskStats?.openBugs || 0}
                  </div>
                  <div className="text-[10px] text-[#585172]">Active defect tickets</div>
                </div>
              </div>

              {/* Client & Commercial Details */}
              <div className="p-4 bg-white rounded-2xl border border-[#E7E0FB] space-y-3">
                <h4 className="text-xs font-black text-[#120E24] uppercase tracking-wider flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-[#7C2CF5]" />
                  <span>Enterprise Client & Lead</span>
                </h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[#585172] font-semibold block text-[11px]">Client Organization:</span>
                    <span className="font-bold text-[#120E24]">
                      {drawerProject.customerCompany || drawerProject.customerName || 'Internal Initiative'}
                    </span>
                    {drawerProject.customerEmail && (
                      <span className="block text-[11px] text-[#585172]">{drawerProject.customerEmail}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[#585172] font-semibold block text-[11px]">Lead Engineer:</span>
                    <span className="font-bold text-[#120E24]">
                      {drawerProject.leadEngineerName || 'Unassigned Lead'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#585172] font-semibold block text-[11px]">Target Delivery:</span>
                    <span className="font-bold text-[#120E24]">
                      {drawerProject.targetEndDate
                        ? new Date(drawerProject.targetEndDate).toLocaleDateString()
                        : 'Flexible'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#585172] font-semibold block text-[11px]">Repository:</span>
                    {drawerProject.repositoryUrl ? (
                      <a
                        href={drawerProject.repositoryUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#7C2CF5] font-bold underline flex items-center gap-1 text-[11px]"
                      >
                        <GitBranch className="w-3 h-3" />
                        <span>Source Code</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-[#585172] italic text-[11px]">Not configured</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Tech Stack Badges */}
              {drawerProject.techStack && drawerProject.techStack.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-[#120E24] uppercase tracking-wider">
                    Technologies & Frameworks
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {drawerProject.techStack.map((tech, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-xl bg-[#F0ECFC] text-[#7C2CF5] font-bold text-xs border border-[#DDD0FE]"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Linked Engineering Tasks */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-[#120E24] uppercase tracking-wider flex items-center gap-1.5">
                    <Code2 className="w-4 h-4 text-[#7C2CF5]" />
                    <span>Linked Sprint Tasks ({drawerTasks.length})</span>
                  </h4>
                  {onNavigate && (
                    <button
                      onClick={() => {
                        setDrawerProject(null);
                        onNavigate('engineering');
                      }}
                      className="text-xs font-bold text-[#7C2CF5] hover:underline flex items-center gap-1"
                    >
                      <span>Open in Sprints Board</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {drawerLoading ? (
                  <div className="p-6 text-center text-xs text-[#585172]">
                    <div className="w-5 h-5 border-2 border-[#7C2CF5] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading sprint tasks from database...
                  </div>
                ) : drawerTasks.length === 0 ? (
                  <div className="p-6 bg-[#FBFBFE] rounded-2xl border border-[#E7E0FB] text-center text-xs text-[#585172]">
                    No sprint tasks currently linked to this project.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {drawerTasks.map((t: any) => (
                      <div
                        key={t.id || t._id}
                        className="p-3 bg-[#FBFBFE] rounded-xl border border-[#E7E0FB] flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-[#120E24]">{t.title}</div>
                          <div className="text-[10px] text-[#585172] flex items-center gap-2 mt-0.5">
                            <span className="font-mono">{t.taskType || 'FEATURE'}</span>
                            <span>&bull;</span>
                            <span>{t.priority}</span>
                            {t.estimateHours && (
                              <>
                                <span>&bull;</span>
                                <span>{t.estimateHours} hrs</span>
                              </>
                            )}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            t.status === 'DONE'
                              ? 'bg-emerald-50 text-emerald-700'
                              : t.status === 'IN_PROGRESS'
                              ? 'bg-sky-50 text-sky-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {t.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="pt-4 border-t border-[#E7E0FB] flex items-center justify-between">
              <div>
                {isLakshay && (
                  <button
                    onClick={() => handleDelete(drawerProject)}
                    className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Project</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const p = drawerProject;
                    setDrawerProject(null);
                    openEditModal(p);
                  }}
                  className="px-4 py-2 border border-[#E7E0FB] hover:bg-[#F7F5FE] text-[#120E24] rounded-xl text-xs font-bold transition"
                >
                  Edit Project
                </button>
                {onNavigate && (
                  <button
                    onClick={() => {
                      setDrawerProject(null);
                      onNavigate('engineering');
                    }}
                    className="px-4 py-2 bg-[#7C2CF5] hover:bg-[#6D25D9] text-white rounded-xl text-xs font-bold shadow-md shadow-[#7C2CF5]/25 transition flex items-center gap-1.5"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>Go to Sprint Tasks</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectsView;
