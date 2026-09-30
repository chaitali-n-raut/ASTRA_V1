import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  FileText,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { Meeting } from '../types.ts';

interface MeetingsListViewProps {
  meetings: Meeting[];
  onSelectMeeting: (id: string, tab?: string) => void;
  onNewMeeting: () => void;
  onDeleteMeeting: (id: string) => Promise<void>;
}

export const MeetingsListView: React.FC<MeetingsListViewProps> = ({
  meetings,
  onSelectMeeting,
  onNewMeeting,
  onDeleteMeeting,
}) => {
  const [filter, setFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  const filtered = meetings.filter((m) => {
    const matchesFilter = filter === 'ALL' || m.status === filter;
    const matchesSearch =
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      m.purpose.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            ✓ Complete
          </span>
        );
      case 'SCHEDULED':
        return (
          <span className="rounded bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:bg-sky-950 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
            🗓️ Scheduled
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            In Progress
          </span>
        );
      default:
        return (
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Meeting Repository
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Complete history of meetings, agendas, transcripts, and verified minutes.
            </p>
          </div>

          <button
            onClick={onNewMeeting}
            className="flex items-center space-x-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-teal-700 transition-colors cursor-pointer self-start sm:self-center"
          >
            <Plus className="h-4 w-4" />
            <span>Create Meeting</span>
          </button>
        </div>

        {/* Filter bar */}
        {meetings.length > 0 && (
          <div className="mt-6 flex flex-col md:flex-row md:items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <div className="flex items-center space-x-1 overflow-x-auto pb-1 scrollbar-none">
              {['ALL', 'COMPLETED', 'SCHEDULED', 'DRAFT'].map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    filter === s
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {s === 'ALL' ? 'All Meetings' : s}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search meeting titles..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 focus:outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* Meetings List / Empty State */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
          <Clock className="mx-auto h-8 w-8 text-slate-400" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            No meetings yet
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Create your first meeting and ASTRA will help you schedule, prepare, analyze, and follow up.
          </p>
          <div className="pt-2">
            <button
              onClick={onNewMeeting}
              className="inline-flex items-center space-x-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-teal-700 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Create Meeting</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((meeting) => (
            <div
              key={meeting.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 transition-colors"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <h3
                      onClick={() => onSelectMeeting(meeting.id, 'minutes')}
                      className="font-bold text-sm sm:text-base text-slate-900 dark:text-white hover:text-teal-600 dark:hover:text-teal-400 cursor-pointer"
                    >
                      {meeting.title}
                    </h3>
                    {getStatusBadge(meeting.status)}
                    <span className="text-[10px] rounded bg-slate-100 px-1.5 py-0.2 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {meeting.meetingType}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl">
                    {meeting.purpose}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 pt-1">
                    <span className="flex items-center space-x-1">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span>
                        {meeting.selectedSlot ? `${meeting.selectedSlot.day} • ${meeting.selectedSlot.startTime}` : meeting.preferredDate}
                      </span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span>{meeting.durationMinutes}m</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      <span>{meeting.participants.length} Attendees</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <FileText className="h-3.5 w-3.5 text-slate-400" />
                      <span>{meeting.decisions?.length || 0} Decisions • {meeting.actionItems?.length || 0} Actions</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0 self-end md:self-center">
                  <button
                    onClick={() => onSelectMeeting(meeting.id, 'workflow')}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                  >
                    Workflow
                  </button>
                  <button
                    onClick={() => onSelectMeeting(meeting.id, 'minutes')}
                    className="rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-100 dark:bg-teal-950 dark:text-teal-300 cursor-pointer"
                  >
                    Minutes
                  </button>
                  <button
                    onClick={() => onDeleteMeeting(meeting.id)}
                    title="Delete meeting"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
