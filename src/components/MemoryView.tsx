import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Database,
  HelpCircle,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import { Meeting, RecurringIssue } from '../types.ts';
import { fetchMemory, searchMemory } from '../api.ts';

interface MemoryViewProps {
  onScheduleFollowUp?: (issue: RecurringIssue) => void;
  onSelectMeeting?: (meetingId: string) => void;
}

export const MemoryView: React.FC<MemoryViewProps> = ({
  onScheduleFollowUp,
  onSelectMeeting,
}) => {
  const [memoryData, setMemoryData] = useState<{
    totalHistoricalMeetings: number;
    recurringIssues: RecurringIssue[];
    followUps: any[];
    recentDecisions: any[];
    unresolvedQuestions: any[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    Array<{ meeting: Meeting; similarityScore: number; matchedKeywords: string[] }>
  >([]);
  const [hasSearched, setHasSearched] = useState(false);

  const loadMemory = async () => {
    setLoading(true);
    try {
      const data = await fetchMemory();
      setMemoryData(data);
    } catch (err) {
      console.error('Failed to load memory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMemory();
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setHasSearched(true);
    try {
      const res = await searchMemory(searchQuery);
      setSearchResults(res.matches || []);
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const hasHistoricalMeetings = (memoryData?.totalHistoricalMeetings ?? 0) > 0;

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">
                Organizational Intelligence & Knowledge Graph
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-xs text-slate-500">TF-IDF Vector Space</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Meeting Memory & Retrieval
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Retrieves context across historical sessions and detects recurring unresolved blockers.
            </p>
          </div>

          <button
            onClick={loadMemory}
            className="flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer self-start sm:self-center"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Re-index</span>
          </button>
        </div>
      </div>

      {/* Fresh State Check */}
      {!hasHistoricalMeetings ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
          <Database className="mx-auto h-8 w-8 text-slate-400" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            No meeting memory yet
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Complete your first meeting to start building organizational memory. The Memory Agent will index summaries, decisions, and recurring patterns automatically.
          </p>
        </div>
      ) : (
        <>
          {/* SECTION 1: RECURRING ISSUES (HONEST DATA) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>Recurring Unresolved Issues</span>
              </h2>
              <span className="text-xs text-slate-400">
                Pattern scan across actual completed sessions
              </span>
            </div>

            {memoryData?.recurringIssues && memoryData.recurringIssues.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {memoryData.recurringIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className="rounded-xl border border-amber-200 bg-amber-50/40 p-5 dark:border-amber-900/60 dark:bg-amber-950/20 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                        {issue.topic}
                      </h3>
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        {issue.occurrenceCount} Occurrences
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {issue.description}
                    </p>

                    <div className="rounded bg-white/80 p-2.5 dark:bg-slate-900/80 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                      <strong className="text-teal-700 dark:text-teal-400">Suggested Action:</strong>
                      <p className="text-[11px]">{issue.suggestedAction}</p>
                    </div>

                    {onScheduleFollowUp && (
                      <button
                        onClick={() => onScheduleFollowUp(issue)}
                        className="w-full flex items-center justify-center space-x-1 rounded-lg bg-teal-600 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 cursor-pointer"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Schedule Follow-Up Session</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-800">
                <p className="text-xs text-slate-500">
                  No recurring issues detected yet across your organizational meetings.
                </p>
              </div>
            )}
          </section>

          {/* SECTION 2: VECTOR SEARCH */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Search className="h-4 w-4 text-teal-600" />
              <span>TF-IDF Historical Retrieval Query</span>
            </h2>

            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="Search across decisions, topics, and transcripts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <button
                onClick={handleSearch}
                className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 cursor-pointer"
              >
                Search Memory
              </button>
            </div>

            {hasSearched && (
              <div className="space-y-2 pt-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Matches found ({searchResults.length}):
                </span>
                {searchResults.length > 0 ? (
                  searchResults.map((res) => (
                    <div
                      key={res.meeting.id}
                      className="p-3 rounded-lg border border-slate-100 hover:border-slate-200 dark:border-slate-800 dark:hover:border-slate-700 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-xs text-slate-900 dark:text-white">
                          {res.meeting.title}
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-1">{res.meeting.purpose}</p>
                      </div>
                      <span className="font-mono text-xs text-teal-600 font-bold">
                        Score: {res.similarityScore}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    No past meetings matched the search query with sufficient relevance score.
                  </p>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};
