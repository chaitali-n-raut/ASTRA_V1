import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  Eye,
  Filter,
  ListTodo,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  User as UserIcon,
  X,
  Sparkles,
  Link as LinkIcon,
} from 'lucide-react';
import { Meeting, Task, TaskPriority, TaskSource, TaskStatus, User } from '../types.ts';
import {
  createTask,
  deleteTask,
  fetchMeetings,
  fetchOrganizationUsers,
  fetchTasks,
  updateTask,
  updateTaskStatus,
} from '../api.ts';

interface TasksViewProps {
  currentUser?: User | null;
  meetings?: Meeting[];
  onSelectMeeting?: (meetingId: string) => void;
}

type FilterTab =
  | 'ALL'
  | 'TODO'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'MY_TASKS'
  | 'OVERDUE';

export const TasksView: React.FC<TasksViewProps> = ({
  currentUser,
  meetings: propMeetings,
  onSelectMeeting,
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>(propMeetings || []);
  const [loading, setLoading] = useState(true);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  // Filters & Search
  const [activeFilter, setActiveFilter] = useState<FilterTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);

  // Form State (used for both Create & Edit)
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAssigneeId, setFormAssigneeId] = useState<string>('unassigned');
  const [formDueDate, setFormDueDate] = useState('');
  const [formPriority, setFormPriority] = useState<TaskPriority>('MEDIUM');
  const [formStatus, setFormStatus] = useState<TaskStatus>('TODO');
  const [formMeetingId, setFormMeetingId] = useState<string>('unlinked');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Load Tasks, Users, and Meetings
  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedTasks, fetchedUsers, fetchedMeetings] = await Promise.all([
        fetchTasks(),
        fetchOrganizationUsers().catch(() => []),
        propMeetings && propMeetings.length > 0 ? Promise.resolve(propMeetings) : fetchMeetings().catch(() => []),
      ]);
      setTasks(fetchedTasks);
      setUsers(fetchedUsers);
      setMeetings(fetchedMeetings);
    } catch (err) {
      console.error('Failed to load tasks data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Helper: check if a task is overdue
  const isTaskOverdue = (task: Task): boolean => {
    if (task.status === 'COMPLETED' || task.status === 'CANCELLED') return false;
    const dateStr = task.dueDate || (task.deadline && task.deadline !== 'Not specified' ? task.deadline : null);
    if (!dateStr) return false;
    const due = new Date(dateStr);
    if (isNaN(due.getTime())) return false;

    // Compare date parts
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // If string was just YYYY-MM-DD, parsing in local creates local midnight
    const compareDue = new Date(due);
    if (!dateStr.includes('T')) {
      compareDue.setHours(23, 59, 59, 999);
    }
    return compareDue.getTime() < Date.now();
  };

  // Open Create Modal
  const openCreateModal = () => {
    setFormTitle('');
    setFormDescription('');
    setFormAssigneeId('unassigned');
    setFormDueDate('');
    setFormPriority('MEDIUM');
    setFormStatus('TODO');
    setFormMeetingId('unlinked');
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormDescription(task.description || '');
    setFormAssigneeId(task.assigneeId || 'unassigned');
    setFormDueDate(task.dueDate || (task.deadline !== 'Not specified' ? task.deadline : ''));
    setFormPriority(task.priority);
    setFormStatus(task.status);
    setFormMeetingId(task.meetingId || 'unlinked');
    setFormError(null);
  };

  // Handle Form Submit (Create)
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('Task title is required.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      const created = await createTask({
        title: formTitle.trim(),
        description: formDescription.trim(),
        assigneeId: formAssigneeId !== 'unassigned' ? formAssigneeId : undefined,
        dueDate: formDueDate ? formDueDate : undefined,
        priority: formPriority,
        status: formStatus,
        meetingId: formMeetingId !== 'unlinked' ? formMeetingId : undefined,
        source: 'MANUAL',
      });

      setTasks((prev) => [created, ...prev]);
      setIsCreateModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create task');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle Form Submit (Edit)
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;

    if (!formTitle.trim()) {
      setFormError('Task title is required.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      const updated = await updateTask(editingTask.id, {
        title: formTitle.trim(),
        description: formDescription.trim(),
        assigneeId: formAssigneeId !== 'unassigned' ? formAssigneeId : undefined,
        dueDate: formDueDate ? formDueDate : undefined,
        priority: formPriority,
        status: formStatus,
        meetingId: formMeetingId !== 'unlinked' ? formMeetingId : undefined,
      });

      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      if (viewingTask?.id === updated.id) {
        setViewingTask(updated);
      }
      setEditingTask(null);
    } catch (err: any) {
      setFormError(err.message || 'Failed to update task');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle Quick Status Change
  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    setUpdatingTaskId(taskId);
    try {
      const updated = await updateTaskStatus(taskId, newStatus);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      if (viewingTask?.id === taskId) {
        setViewingTask(updated);
      }
    } catch (err) {
      console.error('Failed to update task status:', err);
    } finally {
      setUpdatingTaskId(null);
    }
  };

  // Handle Quick Complete / Reopen
  const handleToggleComplete = async (task: Task) => {
    const newStatus: TaskStatus = task.status === 'COMPLETED' ? 'TODO' : 'COMPLETED';
    await handleStatusChange(task.id, newStatus);
  };

  // Handle Delete Confirmation
  const confirmDelete = async () => {
    if (!deletingTask) return;
    setUpdatingTaskId(deletingTask.id);
    try {
      await deleteTask(deletingTask.id);
      setTasks((prev) => prev.filter((t) => t.id !== deletingTask.id));
      if (viewingTask?.id === deletingTask.id) {
        setViewingTask(null);
      }
      setDeletingTask(null);
    } catch (err) {
      console.error('Failed to delete task:', err);
    } finally {
      setUpdatingTaskId(null);
    }
  };

  // Filter & Search Logic
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Filter tab
      if (activeFilter === 'TODO' && task.status !== 'TODO') return false;
      if (activeFilter === 'IN_PROGRESS' && task.status !== 'IN_PROGRESS') return false;
      if (activeFilter === 'BLOCKED' && task.status !== 'BLOCKED') return false;
      if (activeFilter === 'COMPLETED' && task.status !== 'COMPLETED') return false;
      if (activeFilter === 'CANCELLED' && task.status !== 'CANCELLED') return false;
      if (activeFilter === 'OVERDUE' && !isTaskOverdue(task)) return false;
      if (activeFilter === 'MY_TASKS') {
        const isAssignedToMe =
          (currentUser?.id && task.assigneeId === currentUser.id) ||
          (currentUser?.name && task.owner.toLowerCase() === currentUser.name.toLowerCase()) ||
          (currentUser?.email && task.owner.toLowerCase() === currentUser.email.toLowerCase());
        if (!isAssignedToMe) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesDesc = (task.description || '').toLowerCase().includes(q);
        const matchesAssignee = (task.owner || '').toLowerCase().includes(q);
        const matchesMeeting = (task.meetingTitle || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesAssignee && !matchesMeeting) {
          return false;
        }
      }

      return true;
    });
  }, [tasks, activeFilter, searchQuery, currentUser]);

  const filterTabs: Array<{ id: FilterTab; label: string; count?: number }> = [
    { id: 'ALL', label: 'All Tasks', count: tasks.length },
    { id: 'TODO', label: 'To Do', count: tasks.filter((t) => t.status === 'TODO').length },
    { id: 'IN_PROGRESS', label: 'In Progress', count: tasks.filter((t) => t.status === 'IN_PROGRESS').length },
    { id: 'BLOCKED', label: 'Blocked', count: tasks.filter((t) => t.status === 'BLOCKED').length },
    { id: 'COMPLETED', label: 'Completed', count: tasks.filter((t) => t.status === 'COMPLETED').length },
    { id: 'CANCELLED', label: 'Cancelled', count: tasks.filter((t) => t.status === 'CANCELLED').length },
    {
      id: 'MY_TASKS',
      label: 'My Tasks',
      count: tasks.filter(
        (t) =>
          (currentUser?.id && t.assigneeId === currentUser.id) ||
          (currentUser?.name && t.owner.toLowerCase() === currentUser.name.toLowerCase()) ||
          (currentUser?.email && t.owner.toLowerCase() === currentUser.email.toLowerCase())
      ).length,
    },
    { id: 'OVERDUE', label: 'Overdue', count: tasks.filter((t) => isTaskOverdue(t)).length },
  ];

  const getPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case 'URGENT':
      case 'CRITICAL':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900';
      case 'HIGH':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900';
      case 'MEDIUM':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900';
      case 'LOW':
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
    }
  };

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
      case 'IN_PROGRESS':
        return 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800';
      case 'BLOCKED':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';
      case 'CANCELLED':
        return 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
      case 'TODO':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">
                Action Items & Task Tracker
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-xs text-slate-500">Database Persisted</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Tasks & Actions
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Manage action items created manually or extracted from meetings.
            </p>
          </div>

          <div className="flex items-center space-x-2.5 self-start sm:self-center">
            <button
              onClick={loadData}
              disabled={loading}
              title="Refresh tasks from server"
              className="flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={openCreateModal}
              className="flex items-center space-x-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer transition-all active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              <span>+ New Task</span>
            </button>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="mt-6 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  activeFilter === tab.id
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span
                    className={`text-[10px] rounded-full px-1.5 py-0.2 font-mono ${
                      activeFilter === tab.id
                        ? 'bg-teal-700 text-white'
                        : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-72">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search title, assignee, meeting..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 focus:outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Task List / Empty State */}
      {tasks.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400">
            <ListTodo className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              No tasks yet
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Create your first task or analyze a meeting transcript to automatically generate action items.
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center space-x-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-teal-700 cursor-pointer transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>+ New Task</span>
          </button>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
          <Filter className="mx-auto h-8 w-8 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            No matching tasks found
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No tasks match the selected filter &ldquo;{activeFilter}&rdquo;{searchQuery ? ` and query "${searchQuery}"` : ''}.
          </p>
          <button
            onClick={() => {
              setActiveFilter('ALL');
              setSearchQuery('');
            }}
            className="text-xs font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 cursor-pointer"
          >
            Clear filters
          </button>
        </div>
      ) : (
        /* Real Task Table / List */
        <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400 font-semibold">
                  <th className="py-3 px-4 w-10">Done</th>
                  <th className="py-3 px-4 min-w-[220px]">Task</th>
                  <th className="py-3 px-4 min-w-[130px]">Assignee</th>
                  <th className="py-3 px-4 min-w-[110px]">Due Date</th>
                  <th className="py-3 px-4 min-w-[90px]">Priority</th>
                  <th className="py-3 px-4 min-w-[130px]">Status</th>
                  <th className="py-3 px-4 min-w-[100px]">Source</th>
                  <th className="py-3 px-4 min-w-[150px]">Related Meeting</th>
                  <th className="py-3 px-4 text-right min-w-[120px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredTasks.map((task) => {
                  const overdue = isTaskOverdue(task);
                  const isCompleted = task.status === 'COMPLETED';

                  return (
                    <tr
                      key={task.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                        isCompleted ? 'bg-slate-50/30 dark:bg-slate-900/30 opacity-80' : ''
                      }`}
                    >
                      {/* Checkbox / Complete Toggle */}
                      <td className="py-3 px-4 align-top pt-3.5">
                        <button
                          onClick={() => handleToggleComplete(task)}
                          disabled={updatingTaskId === task.id}
                          title={isCompleted ? 'Reopen task' : 'Mark task completed'}
                          className={`rounded p-0.5 transition-colors cursor-pointer ${
                            isCompleted
                              ? 'text-emerald-600 hover:text-slate-400 dark:text-emerald-400'
                              : 'text-slate-400 hover:text-emerald-600 dark:text-slate-500 dark:hover:text-emerald-400'
                          }`}
                        >
                          <CheckCircle2
                            className={`h-4 w-4 ${isCompleted ? 'fill-emerald-100 dark:fill-emerald-950/60' : ''}`}
                          />
                        </button>
                      </td>

                      {/* Task Title & Description */}
                      <td className="py-3 px-4 align-top">
                        <div className="space-y-1">
                          <button
                            onClick={() => setViewingTask(task)}
                            className={`font-semibold text-left text-slate-900 hover:text-teal-600 dark:text-white dark:hover:text-teal-400 cursor-pointer block ${
                              isCompleted ? 'line-through text-slate-400 dark:text-slate-500' : ''
                            }`}
                          >
                            {task.title}
                          </button>
                          {task.description && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 max-w-sm">
                              {task.description}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Assignee */}
                      <td className="py-3 px-4 align-top whitespace-nowrap">
                        <div className="flex items-center space-x-1.5 text-slate-700 dark:text-slate-300">
                          <div className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            <UserIcon className="h-3 w-3" />
                          </div>
                          <span className={task.owner === 'Unassigned' ? 'text-slate-400 italic' : 'font-medium'}>
                            {task.owner}
                          </span>
                        </div>
                      </td>

                      {/* Due Date */}
                      <td className="py-3 px-4 align-top whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <Clock
                            className={`h-3.5 w-3.5 ${
                              overdue
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-slate-400 dark:text-slate-500'
                            }`}
                          />
                          <span
                            className={
                              overdue
                                ? 'font-bold text-rose-600 dark:text-rose-400'
                                : 'text-slate-600 dark:text-slate-300'
                            }
                          >
                            {task.dueDate || task.deadline || 'Not specified'}
                          </span>
                          {overdue && (
                            <span className="text-[9px] font-bold uppercase rounded bg-rose-100 text-rose-700 px-1 py-0.2 dark:bg-rose-950 dark:text-rose-300">
                              Overdue
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Priority */}
                      <td className="py-3 px-4 align-top whitespace-nowrap">
                        <span
                          className={`inline-block text-[10px] font-bold rounded-md border px-2 py-0.5 uppercase tracking-wider ${getPriorityBadge(
                            task.priority
                          )}`}
                        >
                          {task.priority}
                        </span>
                      </td>

                      {/* Status Dropdown */}
                      <td className="py-3 px-4 align-top whitespace-nowrap">
                        <select
                          value={task.status}
                          disabled={updatingTaskId === task.id}
                          onChange={(e) => handleStatusChange(task.id, e.target.value as TaskStatus)}
                          className={`text-[11px] font-semibold rounded-md border px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer ${getStatusBadge(
                            task.status
                          )}`}
                        >
                          <option value="TODO">To Do</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="BLOCKED">Blocked</option>
                          <option value="COMPLETED">Completed</option>
                          <option value="CANCELLED">Cancelled</option>
                        </select>
                      </td>

                      {/* Source */}
                      <td className="py-3 px-4 align-top whitespace-nowrap">
                        {task.source === 'MEETING_ACTION_ITEM' ? (
                          <span className="inline-flex items-center space-x-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 text-[10px] font-semibold dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800">
                            <Sparkles className="h-2.5 w-2.5" />
                            <span>From Meeting</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                            Manual
                          </span>
                        )}
                      </td>

                      {/* Related Meeting */}
                      <td className="py-3 px-4 align-top">
                        {task.meetingId ? (
                          <button
                            onClick={() => onSelectMeeting?.(task.meetingId!)}
                            title={`Go to meeting: ${task.meetingTitle || task.meetingId}`}
                            className="inline-flex items-center space-x-1 text-teal-600 hover:text-teal-700 dark:text-teal-400 hover:underline max-w-[160px] truncate text-left cursor-pointer"
                          >
                            <LinkIcon className="h-3 w-3 shrink-0" />
                            <span className="truncate">{task.meetingTitle || `#${task.meetingId}`}</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 italic">Unlinked</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 align-top text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => setViewingTask(task)}
                            title="View Details"
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => openEditModal(task)}
                            title="Edit Task"
                            className="p-1 rounded text-slate-400 hover:text-teal-600 hover:bg-slate-100 dark:hover:text-teal-400 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingTask(task)}
                            title="Delete Task"
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:text-rose-400 dark:hover:bg-rose-950/40 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CREATE TASK MODAL */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400">
                  <Plus className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Create New Task
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Add a manual action item to your organization task list.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900 flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4 text-xs">
              {/* Task Title */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Task Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Prepare project presentation slides"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Detailed notes, requirements, or acceptance criteria..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Assignee & Due Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Assignee */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Assignee
                  </label>
                  <select
                    value={formAssigneeId}
                    onChange={(e) => setFormAssigneeId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white cursor-pointer"
                  >
                    <option value="unassigned">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Due Date */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white cursor-pointer"
                  />
                </div>
              </div>

              {/* Priority & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Priority */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as TaskPriority)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white cursor-pointer"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as TaskStatus)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white cursor-pointer"
                  >
                    <option value="TODO">TODO</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="BLOCKED">BLOCKED</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
              </div>

              {/* Related Meeting */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Related Meeting <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <select
                  value={formMeetingId}
                  onChange={(e) => setFormMeetingId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white cursor-pointer"
                >
                  <option value="unlinked">No meeting / Unlinked</option>
                  {meetings.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({m.preferredDate || new Date(m.createdAt).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="rounded-lg bg-teal-600 px-5 py-2 font-semibold text-white shadow-xs hover:bg-teal-700 focus:outline-none cursor-pointer flex items-center space-x-1.5"
                >
                  {formSubmitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>Create Task</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT TASK MODAL */}
      {/* ========================================================================= */}
      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400">
                  <Edit3 className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Edit Task
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Update task parameters, ownership, or status.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingTask(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900 flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-4 text-xs">
              {/* Task Title */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Task Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Assignee & Due Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Assignee */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Assignee
                  </label>
                  <select
                    value={formAssigneeId}
                    onChange={(e) => setFormAssigneeId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white cursor-pointer"
                  >
                    <option value="unassigned">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Due Date */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white cursor-pointer"
                  />
                </div>
              </div>

              {/* Priority & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Priority */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as TaskPriority)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white cursor-pointer"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as TaskStatus)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white cursor-pointer"
                  >
                    <option value="TODO">TODO</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="BLOCKED">BLOCKED</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
              </div>

              {/* Related Meeting */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Related Meeting
                </label>
                <select
                  value={formMeetingId}
                  onChange={(e) => setFormMeetingId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white cursor-pointer"
                >
                  <option value="unlinked">No meeting / Unlinked</option>
                  {meetings.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({m.preferredDate || new Date(m.createdAt).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="rounded-lg bg-teal-600 px-5 py-2 font-semibold text-white shadow-xs hover:bg-teal-700 focus:outline-none cursor-pointer flex items-center space-x-1.5"
                >
                  {formSubmitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW TASK MODAL */}
      {/* ========================================================================= */}
      {viewingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span
                    className={`text-[10px] font-bold rounded-md border px-2 py-0.5 uppercase tracking-wider ${getPriorityBadge(
                      viewingTask.priority
                    )}`}
                  >
                    {viewingTask.priority}
                  </span>
                  <span
                    className={`text-[10px] font-semibold rounded-md border px-2 py-0.5 ${getStatusBadge(
                      viewingTask.status
                    )}`}
                  >
                    {viewingTask.status}
                  </span>
                  {viewingTask.source === 'MEETING_ACTION_ITEM' ? (
                    <span className="text-[10px] font-semibold rounded-md bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800">
                      From Meeting
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold rounded-md bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                      Manual
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white pt-1">
                  {viewingTask.title}
                </h2>
              </div>
              <button
                onClick={() => setViewingTask(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {viewingTask.description ? (
              <div className="rounded-lg bg-slate-50 p-3.5 text-xs text-slate-700 dark:bg-slate-800/60 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                {viewingTask.description}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No description provided.</p>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs border-t border-slate-100 pt-3 dark:border-slate-800">
              <div>
                <span className="text-slate-400 block text-[11px]">Assignee</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {viewingTask.owner}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Due Date</span>
                <span
                  className={`font-semibold ${
                    isTaskOverdue(viewingTask)
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-800 dark:text-slate-200'
                  }`}
                >
                  {viewingTask.dueDate || viewingTask.deadline || 'Not specified'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Related Meeting</span>
                {viewingTask.meetingId ? (
                  <button
                    onClick={() => {
                      setViewingTask(null);
                      onSelectMeeting?.(viewingTask.meetingId!);
                    }}
                    className="text-teal-600 hover:underline font-semibold dark:text-teal-400 flex items-center space-x-1"
                  >
                    <span>{viewingTask.meetingTitle || viewingTask.meetingId}</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>
                ) : (
                  <span className="text-slate-500 italic">None</span>
                )}
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Created</span>
                <span className="text-slate-600 dark:text-slate-400">
                  {new Date(viewingTask.createdAt).toLocaleString()}
                </span>
              </div>
              {viewingTask.completedAt && (
                <div>
                  <span className="text-slate-400 block text-[11px]">Completed At</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    {new Date(viewingTask.completedAt).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => {
                  const taskToDelete = viewingTask;
                  setViewingTask(null);
                  setDeletingTask(taskToDelete);
                }}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 cursor-pointer flex items-center space-x-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Task</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleToggleComplete(viewingTask)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    viewingTask.status === 'COMPLETED'
                      ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {viewingTask.status === 'COMPLETED' ? 'Reopen Task' : 'Mark Completed'}
                </button>
                <button
                  onClick={() => {
                    const taskToEdit = viewingTask;
                    setViewingTask(null);
                    openEditModal(taskToEdit);
                  }}
                  className="rounded-lg bg-teal-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 cursor-pointer"
                >
                  Edit Task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {deletingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600 dark:text-rose-400">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950/50">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Delete this task?
                </h3>
                <p className="text-[11px] text-slate-500">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Are you sure you want to permanently delete{' '}
              <strong className="text-slate-900 dark:text-white">&ldquo;{deletingTask.title}&rdquo;</strong>?
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingTask(null)}
                className="rounded-lg border border-slate-300 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={updatingTaskId === deletingTask.id}
                className="rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 cursor-pointer flex items-center space-x-1"
              >
                {updatingTaskId === deletingTask.id && (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                )}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
