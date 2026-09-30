import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Cpu,
  FileText,
  ListTodo,
  Plus,
  RefreshCw,
  Sparkles,
  Users,
} from 'lucide-react';
import { DashboardStats, Meeting, Task, User } from '../types.ts';

interface DashboardViewProps {
  stats: DashboardStats | null;
  upcomingMeetings: Meeting[];
  recentMeetings: Meeting[];
  myTasks: Task[];
  openQuestions: any[];
  recentDecisions: any[];
  recurringIssues: any[];
  currentUser: User | null;
  onNewMeeting: () => void;
  onSelectMeeting: (id: string, tab?: string) => void;
  onGoToTab: (tab: string) => void;
  onRefresh: () => void;
  loading: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  upcomingMeetings,
  recentMeetings,
  myTasks,
  openQuestions,
  recentDecisions,
  recurringIssues,
  currentUser,
  onNewMeeting,
  onSelectMeeting,
  onGoToTab,
  onRefresh,
  loading,
}) => {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const isBrandNewWorkspace =
    !stats || (stats.totalMeetings === 0 && stats.openActionItems === 0);

  return (
    <div className="space-y-6 pb-16">
      {/* Header Greeting */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {getGreeting()}, {currentUser?.name || 'Operator'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Your meeting intelligence workspace is ready.
            </p>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={onNewMeeting}
              className="flex items-center space-x-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-teal-700 cursor-pointer transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Create Meeting</span>
            </button>
            <button
              onClick={onRefresh}
              title="Refresh dashboard metrics"
              className="p-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Primary Verified Metrics Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Meetings</span>
            <Clock className="h-4 w-4 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {stats?.totalMeetings ?? 0}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {stats && stats.totalMeetings > 0 ? 'Total created' : '0 created'}
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Upcoming</span>
            <Calendar className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {stats?.upcomingMeetings ?? 0}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Scheduled slots
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Open Tasks</span>
            <ListTodo className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {stats?.openActionItems ?? 0}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Pending closure
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Open Questions</span>
            <CheckCircle2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {stats?.openQuestionsCount ?? 0}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Unresolved inquiries
          </span>
        </div>
      </div>

      {/* Fresh Workspace Guidance if empty */}
      {isBrandNewWorkspace && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-300">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Welcome to ASTRA_V1
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Create your first meeting to get started. ASTRA will assist with participant availability, scheduling, agenda generation, transcript NLU, and task resolution.
            </p>
          </div>
          <div>
            <button
              onClick={onNewMeeting}
              className="inline-flex items-center space-x-1.5 rounded-lg bg-teal-600 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-teal-700 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Create Your First Meeting</span>
            </button>
          </div>
        </div>
      )}

      {/* Active Recurring Issues Alert if any exist in real records */}
      {recurringIssues.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/60 dark:bg-amber-950/20 text-xs text-amber-900 dark:text-amber-200 space-y-1">
          <div className="flex items-center justify-between font-bold">
            <span className="flex items-center space-x-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span>{recurringIssues.length} Recurring Issue(s) Detected in Organizational Memory</span>
            </span>
            <button
              onClick={() => onGoToTab('memory')}
              className="text-amber-800 dark:text-amber-300 underline font-semibold cursor-pointer"
            >
              Inspect Memory
            </button>
          </div>
          <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
            Issues reoccurring across multiple meetings have been flagged for resolution.
          </p>
        </div>
      )}

      {/* Main Grid: Upcoming Meetings, Recent Meetings & Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Meetings Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
              <Calendar className="h-4 w-4 text-teal-600" />
              <span>Upcoming Meetings</span>
            </h2>
            <button
              onClick={() => onGoToTab('meetings')}
              className="text-xs text-teal-600 hover:text-teal-700 dark:text-teal-400 font-semibold cursor-pointer"
            >
              View all
            </button>
          </div>

          {upcomingMeetings.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center dark:border-slate-800 space-y-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No upcoming meetings.
              </p>
              <button
                onClick={onNewMeeting}
                className="inline-flex items-center space-x-1 text-xs font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                <span>Create Meeting</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingMeetings.map((m) => (
                <div
                  key={m.id}
                  onClick={() => onSelectMeeting(m.id, 'workflow')}
                  className="p-3 rounded-lg border border-slate-100 hover:border-slate-200 dark:border-slate-800 dark:hover:border-slate-700 cursor-pointer transition-colors space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-slate-900 dark:text-white">
                      {m.title}
                    </span>
                    <span className="text-[10px] rounded bg-sky-50 px-2 py-0.5 font-bold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                      {m.status}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3 text-[11px] text-slate-500">
                    <span>{m.selectedSlot ? `${m.selectedSlot.day} • ${m.selectedSlot.startTime}` : m.preferredDate}</span>
                    <span>•</span>
                    <span>{m.participants.length} attendees</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Completed Meetings Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
              <Clock className="h-4 w-4 text-teal-600" />
              <span>Recent Meetings</span>
            </h2>
            <button
              onClick={() => onGoToTab('meetings')}
              className="text-xs text-teal-600 hover:text-teal-700 dark:text-teal-400 font-semibold cursor-pointer"
            >
              View all
            </button>
          </div>

          {recentMeetings.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center dark:border-slate-800 space-y-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No meetings have been completed yet.
              </p>
              <button
                onClick={onNewMeeting}
                className="inline-flex items-center space-x-1 text-xs font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                <span>Create Your First Meeting</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {recentMeetings.map((m) => (
                <div
                  key={m.id}
                  onClick={() => onSelectMeeting(m.id, 'minutes')}
                  className="p-3 rounded-lg border border-slate-100 hover:border-slate-200 dark:border-slate-800 dark:hover:border-slate-700 cursor-pointer transition-colors space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-slate-900 dark:text-white">
                      {m.title}
                    </span>
                    <span className="text-[10px] rounded bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      ✓ Complete
                    </span>
                  </div>
                  <div className="flex items-center space-x-3 text-[11px] text-slate-500">
                    <span>{m.selectedSlot?.day || m.preferredDate}</span>
                    <span>•</span>
                    <span>{m.decisions.length} decisions • {m.actionItems.length} actions</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* My Tasks Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
              <ListTodo className="h-4 w-4 text-teal-600" />
              <span>Pending Tasks & Action Items</span>
            </h2>
            <button
              onClick={() => onGoToTab('tasks')}
              className="text-xs text-teal-600 hover:text-teal-700 dark:text-teal-400 font-semibold cursor-pointer"
            >
              View all tasks
            </button>
          </div>

          {myTasks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center dark:border-slate-800 space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No tasks assigned to you.
              </p>
              <p className="text-[11px] text-slate-400">
                Action items extracted from completed meeting transcripts will automatically appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {myTasks.map((t) => (
                <div
                  key={t.id}
                  className="p-3 rounded-lg border border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/40 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-slate-900 dark:text-white line-clamp-1">
                      {t.title}
                    </span>
                    <span className="text-[9px] rounded bg-slate-200 px-1.5 py-0.2 font-bold dark:bg-slate-700">
                      {t.priority}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Owner: <strong>{t.owner}</strong></span>
                    <span>Due: {t.deadline}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
