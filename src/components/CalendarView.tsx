import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar as CalendarIcon,
  CalendarDays,
  Check,
  CheckCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  ExternalLink,
  Filter,
  List,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Users,
  X,
} from 'lucide-react';
import {
  CalendarEvent,
  Meeting,
  Task,
  TaskPriority,
  TaskStatus,
  User,
} from '../types.ts';
import {
  createTask,
  fetchCalendarEvents,
  fetchMeetings,
  fetchOrganizationUsers,
  fetchTasks,
  updateTaskStatus,
} from '../api.ts';

interface CalendarViewProps {
  meetings?: Meeting[];
  currentUser?: User | null;
  onSelectMeeting?: (meetingId: string) => void;
  onNewMeeting?: (prefillDate?: string) => void;
  onGoToIntegrations?: () => void;
  onGoToTasks?: () => void;
}

type ViewMode = 'month' | 'week' | 'agenda';
type FilterOption = 'ALL' | 'MEETINGS' | 'TASKS' | 'PENDING_TASKS' | 'MY_ITEMS';

export const CalendarView: React.FC<CalendarViewProps> = ({
  meetings: propMeetings,
  currentUser,
  onSelectMeeting,
  onNewMeeting,
  onGoToIntegrations,
  onGoToTasks,
}) => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>(propMeetings || []);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isCalendarConnected, setIsCalendarConnected] = useState<boolean>(false);
  const [connectedProvider, setConnectedProvider] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Active Date (defaults to current date)
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [filterOption, setFilterOption] = useState<FilterOption>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Day for Detail View / Inspector
  const [selectedDayStr, setSelectedDayStr] = useState<string | null>(null);

  // Add Task Modal State
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskFormTitle, setTaskFormTitle] = useState('');
  const [taskFormDescription, setTaskFormDescription] = useState('');
  const [taskFormAssigneeId, setTaskFormAssigneeId] = useState<string>('unassigned');
  const [taskFormDueDate, setTaskFormDueDate] = useState<string>('');
  const [taskFormPriority, setTaskFormPriority] = useState<TaskPriority>('MEDIUM');
  const [taskFormStatus, setTaskFormStatus] = useState<TaskStatus>('TODO');
  const [taskFormMeetingId, setTaskFormMeetingId] = useState<string>('unlinked');
  const [taskFormSubmitting, setTaskFormSubmitting] = useState(false);
  const [taskFormError, setTaskFormError] = useState<string | null>(null);

  // Helper date format: YYYY-MM-DD
  const formatDateKey = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isSameDay = (d1: Date, d2: Date): boolean => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [calData, taskList, userList, meetingList] = await Promise.all([
        fetchCalendarEvents().catch(() => ({
          events: [],
          meetings: [],
          tasks: [],
          users: [],
          isCalendarConnected: false,
          connectedProvider: null,
        })),
        fetchTasks().catch(() => []),
        fetchOrganizationUsers().catch(() => []),
        propMeetings && propMeetings.length > 0
          ? Promise.resolve(propMeetings)
          : fetchMeetings().catch(() => []),
      ]);

      setEvents(calData.events || []);
      setIsCalendarConnected(calData.isCalendarConnected || false);
      setConnectedProvider(calData.connectedProvider || null);
      setTasks(taskList || []);
      setUsers(userList || []);
      setMeetings(calData.meetings && calData.meetings.length > 0 ? calData.meetings : meetingList || []);
    } catch (err) {
      console.error('Failed to load calendar data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [propMeetings]);

  // Navigation handlers
  const handlePrev = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (viewMode === 'month') {
        next.setMonth(next.getMonth() - 1);
      } else if (viewMode === 'week') {
        next.setDate(next.getDate() - 7);
      } else {
        next.setMonth(next.getMonth() - 1);
      }
      return next;
    });
  };

  const handleNext = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (viewMode === 'month') {
        next.setMonth(next.getMonth() + 1);
      } else if (viewMode === 'week') {
        next.setDate(next.getDate() + 7);
      } else {
        next.setMonth(next.getMonth() + 1);
      }
      return next;
    });
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDayStr(formatDateKey(today));
  };

  // Open Task Modal with specific prefilled date
  const handleOpenAddTask = (prefillDate?: string) => {
    const targetDate = prefillDate || selectedDayStr || formatDateKey(currentDate);
    setTaskFormDueDate(targetDate);
    setTaskFormTitle('');
    setTaskFormDescription('');
    setTaskFormAssigneeId(currentUser?.id || 'unassigned');
    setTaskFormPriority('MEDIUM');
    setTaskFormStatus('TODO');
    setTaskFormMeetingId('unlinked');
    setTaskFormError(null);
    setIsTaskModalOpen(true);
  };

  // Submit task creation
  const handleCreateTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskFormTitle.trim()) {
      setTaskFormError('Task title is required.');
      return;
    }

    setTaskFormSubmitting(true);
    setTaskFormError(null);
    try {
      const created = await createTask({
        title: taskFormTitle.trim(),
        description: taskFormDescription.trim(),
        assigneeId: taskFormAssigneeId === 'unassigned' ? undefined : taskFormAssigneeId,
        dueDate: taskFormDueDate || undefined,
        priority: taskFormPriority,
        status: taskFormStatus,
        meetingId: taskFormMeetingId === 'unlinked' ? undefined : taskFormMeetingId,
      });

      setTasks((prev) => [created, ...prev]);
      setIsTaskModalOpen(false);
    } catch (err: any) {
      setTaskFormError(err.message || 'Failed to create task.');
    } finally {
      setTaskFormSubmitting(false);
    }
  };

  // Toggle task completion directly from calendar
  const handleToggleTaskStatus = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus: TaskStatus = task.status === 'COMPLETED' ? 'TODO' : 'COMPLETED';
    try {
      const updated = await updateTaskStatus(task.id, nextStatus);
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    } catch (err) {
      console.error('Failed to update task status:', err);
    }
  };

  // Group items by date string "YYYY-MM-DD"
  const itemsByDate = useMemo(() => {
    const map = new Map<
      string,
      {
        meetings: Meeting[];
        events: CalendarEvent[];
        tasks: Task[];
      }
    >();

    const getBucket = (key: string) => {
      if (!map.has(key)) {
        map.set(key, { meetings: [], events: [], tasks: [] });
      }
      return map.get(key)!;
    };

    // Index Meetings
    for (const m of meetings) {
      const day = m.selectedSlot?.day || m.preferredDate;
      if (day) {
        getBucket(day).meetings.push(m);
      }
    }

    // Index Calendar Events (if not already mapped by meeting)
    for (const evt of events) {
      const day = evt.startTime.split('T')[0];
      if (day) {
        // avoid duplicating meeting
        const bucket = getBucket(day);
        const hasMeeting = evt.meetingId && bucket.meetings.some((m) => m.id === evt.meetingId);
        if (!hasMeeting) {
          bucket.events.push(evt);
        }
      }
    }

    // Index Tasks
    for (const t of tasks) {
      const day = t.dueDate || t.deadline;
      if (day) {
        const cleanDay = day.split('T')[0];
        getBucket(cleanDay).tasks.push(t);
      }
    }

    return map;
  }, [meetings, events, tasks]);

  // Month Grid Calculation
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days = [];

    // Leading days from previous month
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const d = new Date(year, month - 1, dayNum);
      days.push({
        date: d,
        dateStr: formatDateKey(d),
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: isSameDay(d, new Date()),
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      days.push({
        date: d,
        dateStr: formatDateKey(d),
        dayNumber: i,
        isCurrentMonth: true,
        isToday: isSameDay(d, new Date()),
      });
    }

    // Trailing days from next month
    const totalSoFar = days.length;
    const targetTotal = totalSoFar > 35 ? 42 : 35;
    const remaining = targetTotal - totalSoFar;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({
        date: d,
        dateStr: formatDateKey(d),
        dayNumber: i,
        isCurrentMonth: false,
        isToday: isSameDay(d, new Date()),
      });
    }

    return days;
  }, [currentDate]);

  // Week Grid Calculation
  const weekDays = useMemo(() => {
    const d = new Date(currentDate);
    const day = d.getDay();
    const diff = d.getDate() - day; // Start on Sunday
    const startOfWeek = new Date(d.setDate(diff));

    const days = [];
    for (let i = 0; i < 7; i++) {
      const weekDate = new Date(startOfWeek);
      weekDate.setDate(startOfWeek.getDate() + i);
      days.push({
        date: weekDate,
        dateStr: formatDateKey(weekDate),
        dayNumber: weekDate.getDate(),
        isCurrentMonth: weekDate.getMonth() === currentDate.getMonth(),
        isToday: isSameDay(weekDate, new Date()),
      });
    }
    return days;
  }, [currentDate]);

  // Filtered Day Items helper
  const filterDayItems = (dateStr: string) => {
    const bucket = itemsByDate.get(dateStr) || { meetings: [], events: [], tasks: [] };

    let filteredMeetings = bucket.meetings;
    let filteredEvents = bucket.events;
    let filteredTasks = bucket.tasks;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filteredMeetings = filteredMeetings.filter(
        (m) => m.title.toLowerCase().includes(q) || m.purpose.toLowerCase().includes(q)
      );
      filteredEvents = filteredEvents.filter((e) => e.title.toLowerCase().includes(q));
      filteredTasks = filteredTasks.filter(
        (t) => t.title.toLowerCase().includes(q) || t.owner.toLowerCase().includes(q)
      );
    }

    if (filterOption === 'MEETINGS') {
      filteredTasks = [];
    } else if (filterOption === 'TASKS') {
      filteredMeetings = [];
      filteredEvents = [];
    } else if (filterOption === 'PENDING_TASKS') {
      filteredMeetings = [];
      filteredEvents = [];
      filteredTasks = filteredTasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
    } else if (filterOption === 'MY_ITEMS') {
      if (currentUser) {
        filteredMeetings = filteredMeetings.filter((m) =>
          m.participants.some((p) => p.email === currentUser.email || p.userId === currentUser.id)
        );
        filteredTasks = filteredTasks.filter(
          (t) => t.assigneeId === currentUser.id || t.createdById === currentUser.id
        );
      }
    }

    return {
      meetings: filteredMeetings,
      events: filteredEvents,
      tasks: filteredTasks,
      totalCount: filteredMeetings.length + filteredEvents.length + filteredTasks.length,
    };
  };

  // Selected Day Items for Drawer / Inspector
  const activeSelectedDay = selectedDayStr || formatDateKey(currentDate);
  const selectedDayItems = useMemo(() => {
    return filterDayItems(activeSelectedDay);
  }, [activeSelectedDay, itemsByDate, filterOption, searchQuery, currentUser]);

  // Agenda List Items (all items sorted by date)
  const agendaList = useMemo(() => {
    const dateKeys = Array.from(itemsByDate.keys()).sort();
    return dateKeys
      .map((key) => {
        const items = filterDayItems(key);
        return {
          dateStr: key,
          ...items,
        };
      })
      .filter((day) => day.totalCount > 0);
  }, [itemsByDate, filterOption, searchQuery]);

  const priorityColor = (p: TaskPriority) => {
    switch (p) {
      case 'CRITICAL':
      case 'URGENT':
        return 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300';
      case 'HIGH':
        return 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300';
      case 'MEDIUM':
        return 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300';
      default:
        return 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">
                Workspace Calendar & Tasks
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-xs text-slate-500">
                {isCalendarConnected
                  ? `Synced with ${connectedProvider}`
                  : 'ASTRA Local Calendar Engine'}
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center space-x-2.5">
              <span>Calendar</span>
              <span className="text-sm font-normal text-slate-400">
                ({currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })})
              </span>
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Interactive timeline of scheduled meetings, deadlines, and assigned action items.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleOpenAddTask()}
              className="flex items-center space-x-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-teal-700 transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add Task</span>
            </button>

            {onNewMeeting && (
              <button
                onClick={() => onNewMeeting(selectedDayStr || formatDateKey(currentDate))}
                className="flex items-center space-x-1.5 rounded-lg border border-teal-600 bg-teal-50 px-3.5 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-100 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800 transition-colors cursor-pointer"
              >
                <CalendarIcon className="h-4 w-4" />
                <span>Schedule Meeting</span>
              </button>
            )}

            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
              title="Refresh calendar"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Toolbar: Navigation + View Mode + Filter + Search */}
        <div className="mt-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-t border-slate-100 pt-4 dark:border-slate-800">
          {/* Month/Week Navigation */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrev}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              title="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handleToday}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
            >
              Today
            </button>
            <button
              onClick={handleNext}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              title="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200 pl-2">
              {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </span>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center space-x-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-800/60 self-start md:self-auto">
            <button
              onClick={() => setViewMode('month')}
              className={`flex items-center space-x-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                viewMode === 'month'
                  ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span>Month</span>
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`flex items-center space-x-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                viewMode === 'week'
                  ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Week</span>
            </button>
            <button
              onClick={() => setViewMode('agenda')}
              className={`flex items-center space-x-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                viewMode === 'agenda'
                  ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span>Agenda</span>
            </button>
          </div>
        </div>

        {/* Filters and Search Row */}
        <div className="mt-3 flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            {(
              [
                { id: 'ALL', label: 'All Items' },
                { id: 'MEETINGS', label: '🗓️ Meetings' },
                { id: 'TASKS', label: '✓ Tasks' },
                { id: 'PENDING_TASKS', label: 'Pending Tasks' },
                { id: 'MY_ITEMS', label: 'Assigned to Me' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterOption(f.id)}
                className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  filterOption === f.id
                    ? 'bg-teal-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[200px] sm:w-64">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search meetings & tasks..."
              className="w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Main Calendar Area: Grid + Side Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Calendar Grid Container (3 cols on large screens) */}
        <div className="lg:col-span-3 rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          {/* MONTH VIEW */}
          {viewMode === 'month' && (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {/* Weekday Headers */}
              <div className="grid grid-cols-7 bg-slate-50/80 text-center text-xs font-bold text-slate-600 dark:bg-slate-800/60 dark:text-slate-300 py-2.5 border-b border-slate-200 dark:border-slate-800">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>

              {/* Month Grid Cells */}
              <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800">
                {calendarDays.map((day) => {
                  const { meetings: dayMeetings, tasks: dayTasks } = filterDayItems(day.dateStr);
                  const isSelected = selectedDayStr === day.dateStr;

                  return (
                    <div
                      key={day.dateStr}
                      onClick={() => setSelectedDayStr(day.dateStr)}
                      className={`group relative min-h-[110px] p-2 transition-colors cursor-pointer flex flex-col justify-between ${
                        !day.isCurrentMonth
                          ? 'bg-slate-50/40 text-slate-400 dark:bg-slate-950/30 dark:text-slate-600'
                          : 'bg-white text-slate-800 hover:bg-slate-50/70 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-850'
                      } ${isSelected ? 'ring-2 ring-teal-500 z-10' : ''}`}
                    >
                      {/* Day Header Row */}
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-xs font-semibold h-6 w-6 flex items-center justify-center rounded-full ${
                            day.isToday
                              ? 'bg-teal-600 text-white font-bold'
                              : isSelected
                              ? 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {day.dayNumber}
                        </span>

                        {/* Quick Add Button on Hover */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenAddTask(day.dateStr);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-opacity p-0.5 rounded cursor-pointer"
                          title="Add task on this date"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Day Events / Items Stack */}
                      <div className="space-y-1 flex-1 overflow-hidden">
                        {/* Meetings */}
                        {dayMeetings.slice(0, 2).map((m) => (
                          <div
                            key={m.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onSelectMeeting) onSelectMeeting(m.id);
                            }}
                            className="rounded px-1.5 py-0.5 text-[11px] font-medium bg-teal-50 text-teal-800 border border-teal-200 dark:bg-teal-950/70 dark:text-teal-200 dark:border-teal-800 truncate flex items-center space-x-1 cursor-pointer hover:bg-teal-100 dark:hover:bg-teal-900 transition-colors"
                            title={`${m.title} (${m.selectedSlot?.startTime || 'TBD'})`}
                          >
                            <span className="font-mono text-[9px] text-teal-600 dark:text-teal-400 shrink-0">
                              {m.selectedSlot?.startTime || '•'}
                            </span>
                            <span className="truncate">{m.title}</span>
                          </div>
                        ))}

                        {/* Tasks */}
                        {dayTasks.slice(0, 2).map((t) => (
                          <div
                            key={t.id}
                            onClick={(e) => handleToggleTaskStatus(t, e)}
                            className={`rounded px-1.5 py-0.5 text-[11px] font-medium border truncate flex items-center space-x-1 cursor-pointer transition-colors ${priorityColor(
                              t.priority
                            )} ${t.status === 'COMPLETED' ? 'line-through opacity-60' : ''}`}
                            title={`Task: ${t.title} (${t.status})`}
                          >
                            <span className="shrink-0">
                              {t.status === 'COMPLETED' ? (
                                <Check className="h-2.5 w-2.5 text-emerald-600" />
                              ) : (
                                <Circle className="h-2.5 w-2.5 text-slate-400" />
                              )}
                            </span>
                            <span className="truncate">{t.title}</span>
                          </div>
                        ))}

                        {/* More indicator */}
                        {dayMeetings.length + dayTasks.length > 4 && (
                          <div className="text-[10px] text-slate-400 font-semibold pl-1">
                            +{dayMeetings.length + dayTasks.length - 4} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* WEEK VIEW */}
          {viewMode === 'week' && (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              <div className="grid grid-cols-7 bg-slate-50/80 text-center py-2 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                {weekDays.map((w) => (
                  <div key={w.dateStr}>
                    <div className="text-[11px] text-slate-500 font-normal">
                      {w.date.toLocaleString('default', { weekday: 'short' })}
                    </div>
                    <div
                      className={`inline-block mt-0.5 px-2 py-0.5 rounded-full ${
                        w.isToday ? 'bg-teal-600 text-white font-bold' : ''
                      }`}
                    >
                      {w.dayNumber}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 divide-x divide-slate-100 dark:divide-slate-800 min-h-[380px]">
                {weekDays.map((w) => {
                  const { meetings: wMeetings, tasks: wTasks } = filterDayItems(w.dateStr);
                  const isSelected = selectedDayStr === w.dateStr;

                  return (
                    <div
                      key={w.dateStr}
                      onClick={() => setSelectedDayStr(w.dateStr)}
                      className={`p-2.5 space-y-2 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-teal-50/30 dark:bg-teal-950/20 ring-1 ring-teal-500'
                          : 'bg-white hover:bg-slate-50/60 dark:bg-slate-900 dark:hover:bg-slate-850'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>
                          {wMeetings.length + wTasks.length} item{wMeetings.length + wTasks.length !== 1 ? 's' : ''}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenAddTask(w.dateStr);
                          }}
                          className="hover:text-teal-600 p-0.5 rounded"
                          title="Add task"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        {wMeetings.map((m) => (
                          <div
                            key={m.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onSelectMeeting) onSelectMeeting(m.id);
                            }}
                            className="p-2 rounded-lg bg-teal-50 text-teal-900 border border-teal-200 dark:bg-teal-950/60 dark:text-teal-200 dark:border-teal-800 text-xs space-y-1 shadow-2xs cursor-pointer hover:bg-teal-100"
                          >
                            <div className="font-bold flex items-center justify-between">
                              <span className="truncate">{m.title}</span>
                              <span className="font-mono text-[10px] text-teal-700 dark:text-teal-300">
                                {m.selectedSlot?.startTime || 'TBD'}
                              </span>
                            </div>
                            <div className="text-[10px] text-teal-700 dark:text-teal-300 flex items-center space-x-1">
                              <Users className="h-3 w-3" />
                              <span>{m.participants.length} attendees</span>
                            </div>
                          </div>
                        ))}

                        {wTasks.map((t) => (
                          <div
                            key={t.id}
                            onClick={(e) => handleToggleTaskStatus(t, e)}
                            className={`p-2 rounded-lg border text-xs space-y-1 shadow-2xs cursor-pointer ${priorityColor(
                              t.priority
                            )} ${t.status === 'COMPLETED' ? 'line-through opacity-60' : ''}`}
                          >
                            <div className="flex items-start space-x-1.5">
                              {t.status === 'COMPLETED' ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                              ) : (
                                <Circle className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                              )}
                              <span className="font-semibold line-clamp-2">{t.title}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 pl-5">
                              {t.owner || 'Unassigned'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AGENDA / LIST VIEW */}
          {viewMode === 'agenda' && (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 p-4 space-y-4">
              {agendaList.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-500">
                  No upcoming meetings or tasks found. Click <strong>Add Task</strong> or{' '}
                  <strong>Schedule Meeting</strong> to populate the calendar.
                </div>
              ) : (
                agendaList.map((day) => (
                  <div key={day.dateStr} className="space-y-3 pt-3 first:pt-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md">
                        {new Date(`${day.dateStr}T00:00:00`).toLocaleDateString('default', {
                          weekday: 'long',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                      <span className="text-xs text-slate-400">
                        {day.totalCount} scheduled item{day.totalCount !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-2">
                      {/* Meetings */}
                      {day.meetings.map((m) => (
                        <div
                          key={m.id}
                          onClick={() => onSelectMeeting && onSelectMeeting(m.id)}
                          className="rounded-lg border border-teal-200 bg-teal-50/70 p-3 text-xs text-teal-950 dark:border-teal-900/60 dark:bg-teal-950/30 dark:text-teal-200 space-y-2 cursor-pointer hover:bg-teal-100"
                        >
                          <div className="flex items-center justify-between font-bold">
                            <span className="line-clamp-1">{m.title}</span>
                            <span className="font-mono text-teal-700 dark:text-teal-300">
                              {m.selectedSlot?.startTime || '10:00'} – {m.selectedSlot?.endTime || '10:30'}
                            </span>
                          </div>
                          <p className="text-[11px] text-teal-800/80 dark:text-teal-300/80 line-clamp-1">
                            {m.purpose}
                          </p>
                          <div className="flex items-center justify-between pt-1 border-t border-teal-200/60 text-[10px]">
                            <span>{m.participants.length} attendees</span>
                            <span className="font-semibold text-teal-600 flex items-center">
                              <span>Open Minutes</span>
                              <ExternalLink className="h-2.5 w-2.5 ml-1" />
                            </span>
                          </div>
                        </div>
                      ))}

                      {/* Tasks */}
                      {day.tasks.map((t) => (
                        <div
                          key={t.id}
                          onClick={(e) => handleToggleTaskStatus(t, e)}
                          className={`rounded-lg border p-3 text-xs space-y-2 cursor-pointer ${priorityColor(
                            t.priority
                          )} ${t.status === 'COMPLETED' ? 'line-through opacity-60' : ''}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-2">
                              {t.status === 'COMPLETED' ? (
                                <Check className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <Circle className="h-4 w-4 text-slate-400" />
                              )}
                              <span className="font-bold line-clamp-1">{t.title}</span>
                            </div>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/60 dark:bg-slate-900/60">
                              {t.priority}
                            </span>
                          </div>
                          {t.description && (
                            <p className="text-[11px] opacity-80 line-clamp-1 pl-6">
                              {t.description}
                            </p>
                          )}
                          <div className="flex items-center justify-between text-[10px] pl-6 pt-1 opacity-75">
                            <span>Assignee: {t.owner || 'Unassigned'}</span>
                            <span>Status: {t.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Side Inspector: Selected Day Details & Quick Add */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Selected Day Agenda
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {new Date(`${activeSelectedDay}T00:00:00`).toLocaleDateString('default', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </h3>
            </div>
            <button
              onClick={() => handleOpenAddTask(activeSelectedDay)}
              className="flex items-center space-x-1 rounded bg-teal-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-teal-700 cursor-pointer"
            >
              <Plus className="h-3 w-3" />
              <span>Add Task</span>
            </button>
          </div>

          {/* Quick Schedule Button for this Day */}
          {onNewMeeting && (
            <button
              onClick={() => onNewMeeting(activeSelectedDay)}
              className="w-full flex items-center justify-center space-x-1.5 rounded-lg border border-teal-200 bg-teal-50/60 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-100 dark:border-teal-900/60 dark:bg-teal-950/30 dark:text-teal-300 transition-colors cursor-pointer"
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              <span>Schedule Meeting on this Day</span>
            </button>
          )}

          {/* Items for selected date */}
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {selectedDayItems.totalCount === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400 dark:border-slate-800 space-y-2">
                <CalendarDays className="h-6 w-6 mx-auto text-slate-300 dark:text-slate-700" />
                <p>No meetings or tasks scheduled for this day.</p>
                <p className="text-[11px] text-slate-500">
                  Click "+ Add Task" or "Schedule Meeting" to populate this date.
                </p>
              </div>
            ) : (
              <>
                {/* Meetings on Selected Day */}
                {selectedDayItems.meetings.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                      <CalendarIcon className="h-3.5 w-3.5 text-teal-600" />
                      <span>Meetings ({selectedDayItems.meetings.length})</span>
                    </span>
                    {selectedDayItems.meetings.map((m) => (
                      <div
                        key={m.id}
                        className="rounded-lg border border-teal-200 bg-teal-50/50 p-3 text-xs dark:border-teal-900/60 dark:bg-teal-950/20 space-y-1.5"
                      >
                        <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                          <span className="line-clamp-1">{m.title}</span>
                          <span className="font-mono text-[10px] text-teal-700 dark:text-teal-300 bg-teal-100 dark:bg-teal-900/60 px-1.5 py-0.5 rounded">
                            {m.selectedSlot?.startTime || '10:00'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                          {m.purpose}
                        </p>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-800 text-[10px]">
                          <span className="text-slate-500">{m.participants.length} attendees</span>
                          {onSelectMeeting && (
                            <button
                              onClick={() => onSelectMeeting(m.id)}
                              className="font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 flex items-center cursor-pointer"
                            >
                              <span>View Workflow</span>
                              <ExternalLink className="h-2.5 w-2.5 ml-1" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tasks on Selected Day */}
                {selectedDayItems.tasks.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                      <CheckCircle className="h-3.5 w-3.5 text-indigo-600" />
                      <span>Due Tasks ({selectedDayItems.tasks.length})</span>
                    </span>
                    {selectedDayItems.tasks.map((t) => (
                      <div
                        key={t.id}
                        className={`rounded-lg border p-3 text-xs space-y-1.5 ${priorityColor(
                          t.priority
                        )} ${t.status === 'COMPLETED' ? 'opacity-60 line-through' : ''}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={(e) => handleToggleTaskStatus(t, e)}
                              className="cursor-pointer"
                            >
                              {t.status === 'COMPLETED' ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <Circle className="h-3.5 w-3.5 text-slate-400 hover:text-teal-600" />
                              )}
                            </button>
                            <span className="font-semibold line-clamp-1">{t.title}</span>
                          </div>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-white/70 dark:bg-slate-900/70">
                            {t.priority}
                          </span>
                        </div>
                        {t.description && (
                          <p className="text-[11px] opacity-80 line-clamp-2 pl-5">
                            {t.description}
                          </p>
                        )}
                        <div className="flex items-center justify-between text-[10px] pl-5 pt-1 opacity-75">
                          <span>Owner: {t.owner || 'Unassigned'}</span>
                          <span>{t.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* CREATE TASK MODAL */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <CheckCircle2 className="h-4 w-4 text-teal-600" />
                  <span>Create Task on Calendar</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Assign action item with scheduled due date and organizational tracking.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsTaskModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {taskFormError && (
              <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900">
                {taskFormError}
              </div>
            )}

            <form onSubmit={handleCreateTaskSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Task Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={taskFormTitle}
                  onChange={(e) => setTaskFormTitle(e.target.value)}
                  placeholder="e.g. Prepare project demo slides"
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={taskFormDescription}
                  onChange={(e) => setTaskFormDescription(e.target.value)}
                  placeholder="Additional context or technical deliverables..."
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Assignee
                  </label>
                  <select
                    value={taskFormAssigneeId}
                    onChange={(e) => setTaskFormAssigneeId(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="unassigned">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={taskFormDueDate}
                    onChange={(e) => setTaskFormDueDate(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Priority
                  </label>
                  <select
                    value={taskFormPriority}
                    onChange={(e) => setTaskFormPriority(e.target.value as TaskPriority)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Initial Status
                  </label>
                  <select
                    value={taskFormStatus}
                    onChange={(e) => setTaskFormStatus(e.target.value as TaskStatus)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="TODO">TODO</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="BLOCKED">BLOCKED</option>
                    <option value="COMPLETED">COMPLETED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Related Meeting (Optional)
                </label>
                <select
                  value={taskFormMeetingId}
                  onChange={(e) => setTaskFormMeetingId(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="unlinked">No Meeting / Unlinked</option>
                  {meetings.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({m.selectedSlot?.day || m.preferredDate})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={taskFormSubmitting}
                  className="flex items-center space-x-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-teal-700 disabled:opacity-50 cursor-pointer"
                >
                  {taskFormSubmitting ? (
                    <span>Creating...</span>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5" />
                      <span>Create Task</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
