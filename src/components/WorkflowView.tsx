import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Cpu,
  Database,
  FileText,
  ListTodo,
  Loader2,
  Mic,
  Play,
  RefreshCw,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { AgentRunLog, Meeting } from '../types.ts';
import { runIndividualAgent, runMeetingWorkflow } from '../api.ts';

interface WorkflowViewProps {
  meeting: Meeting;
  onRefreshMeeting: () => Promise<void>;
  onGoToMinutes: () => void;
  onBack: () => void;
}

interface AgentCardConfig {
  name: string;
  key: 'Scheduler' | 'Agenda' | 'Transcription' | 'Minutes_NLU' | 'TaskTracker' | 'Memory';
  icon: any;
  title: string;
  role: string;
  algorithmSummary: string;
}

export const WorkflowView: React.FC<WorkflowViewProps> = ({
  meeting,
  onRefreshMeeting,
  onGoToMinutes,
  onBack,
}) => {
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [runningAgentKey, setRunningAgentKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pipeline' | 'logs'>('pipeline');
  const [expandedAgent, setExpandedAgent] = useState<string | null>('Scheduler');
  const [liveLogs, setLiveLogs] = useState<string[]>([]);

  // Agent configuration cards
  const agentConfigs: AgentCardConfig[] = [
    {
      name: 'Scheduler',
      key: 'Scheduler',
      icon: Clock,
      title: 'Scheduler Agent',
      role: 'Discretizes participant availability intervals, discovers common intersections, detects conflicts, and applies multi-factor constraint scoring.',
      algorithmSummary: 'Constraint Satisfaction & Interval Intersection (Discrete 30-min Grid)',
    },
    {
      name: 'Agenda',
      key: 'Agenda',
      icon: FileText,
      title: 'Agenda Agent',
      role: 'Formulates structured meeting objectives and partitions time allocations, validating that total topic duration does not exceed the meeting limit.',
      algorithmSummary: 'Objective Synthesis & Time-Budget Allocation (Gemini 3.8 Flash / Offline Template)',
    },
    {
      name: 'Transcription',
      key: 'Transcription',
      icon: Mic,
      title: 'Transcription Agent',
      role: 'Normalizes raw transcript text, WebVTT, SRT, or JSON payloads into speaker-attributed utterance segments for downstream NLU.',
      algorithmSummary: 'Speaker Diarization Parser & Utterance Normalization',
    },
    {
      name: 'Minutes_NLU',
      key: 'Minutes_NLU',
      icon: Cpu,
      title: 'Minutes / NLU Agent',
      role: 'Extracts formal decisions, open/unresolved questions, and action items with owners and deadlines. Computes confidence metrics for academic rigor.',
      algorithmSummary: 'Hybrid Syntactic Regex Automata + Gemini Structured JSON NLU',
    },
    {
      name: 'TaskTracker',
      key: 'TaskTracker',
      icon: ListTodo,
      title: 'Task Tracker & Calendar Agent',
      role: 'Maps extracted action items to structured tasks in MockTaskTrackerAdapter and books the confirmed time slot in MockCalendarAdapter.',
      algorithmSummary: 'Adapter Layer Sync (MockTaskTrackerAdapter + MockCalendarAdapter)',
    },
    {
      name: 'Memory',
      key: 'Memory',
      icon: Database,
      title: 'Memory Agent',
      role: 'Projects meeting text into TF-IDF vector space, evaluates historical cosine similarity, detects recurring unresolved issues, and recommends follow-up sessions.',
      algorithmSummary: 'TF-IDF Vector Space Model & Cross-Meeting Recurrence Clustering',
    },
  ];

  // Helper to determine agent status from meeting state or agentRuns
  const getAgentStatus = (agentKey: string): 'WAITING' | 'RUNNING' | 'COMPLETED' | 'FAILED' => {
    if (runningAgentKey === agentKey) return 'RUNNING';

    const log = meeting.agentRuns?.find((r) => r.agentName === agentKey);
    if (log) return log.status;

    // Fallback based on meeting state
    switch (agentKey) {
      case 'Scheduler':
        return meeting.selectedSlot ? 'COMPLETED' : meeting.status === 'SCHEDULING' ? 'RUNNING' : 'WAITING';
      case 'Agenda':
        return meeting.agendaItems && meeting.agendaItems.length > 0 ? 'COMPLETED' : 'WAITING';
      case 'Transcription':
        return meeting.transcriptSegments && meeting.transcriptSegments.length > 0 ? 'COMPLETED' : 'WAITING';
      case 'Minutes_NLU':
        return meeting.decisions && meeting.decisions.length > 0 ? 'COMPLETED' : 'WAITING';
      case 'TaskTracker':
        return meeting.calendarEventId ? 'COMPLETED' : 'WAITING';
      case 'Memory':
        return meeting.recurringIssuesDetected && meeting.recurringIssuesDetected.length > 0
          ? 'COMPLETED'
          : meeting.status === 'COMPLETED'
          ? 'COMPLETED'
          : 'WAITING';
      default:
        return 'WAITING';
    }
  };

  // Connect to SSE stream for live updates
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`/api/meetings/${meeting.id}/run/stream`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.message) {
            setLiveLogs((prev) => [
              `[${new Date().toLocaleTimeString()}] ${data.agent || 'ASTRA'}: ${data.message}`,
              ...prev.slice(0, 49),
            ]);
          }
          if (data.event === 'workflow.completed') {
            setIsRunningAll(false);
            setRunningAgentKey(null);
            onRefreshMeeting();
          }
        } catch {}
      };

      eventSource.onerror = () => {
        // SSE closed
        eventSource?.close();
      };
    } catch {}

    return () => {
      eventSource?.close();
    };
  }, [meeting.id]);

  const handleRunAll = async () => {
    setIsRunningAll(true);
    setLiveLogs((prev) => [
      `[${new Date().toLocaleTimeString()}] Orchestrator: Starting full 6-agent autonomous pipeline...`,
      ...prev,
    ]);
    try {
      await runMeetingWorkflow(meeting.id);
      await onRefreshMeeting();
    } catch (err: any) {
      setLiveLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] ERROR: Workflow failed: ${err.message}`,
        ...prev,
      ]);
    } finally {
      setIsRunningAll(false);
      setRunningAgentKey(null);
    }
  };

  const handleRunSingleAgent = async (agentKey: string) => {
    setRunningAgentKey(agentKey);
    setLiveLogs((prev) => [
      `[${new Date().toLocaleTimeString()}] Orchestrator: Manually executing ${agentKey} Agent...`,
      ...prev,
    ]);
    try {
      await runIndividualAgent(meeting.id, agentKey);
      await onRefreshMeeting();
    } catch (err: any) {
      setLiveLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] ERROR: ${agentKey} execution failed: ${err.message}`,
        ...prev,
      ]);
    } finally {
      setRunningAgentKey(null);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <button
                onClick={onBack}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                ← Back to Meetings
              </button>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">
                Meeting #{meeting.id}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {meeting.title}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl line-clamp-1">
              {meeting.purpose}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleRunAll}
              disabled={isRunningAll}
              className="flex items-center space-x-2 rounded-lg bg-teal-600 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isRunningAll ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Pipeline Executing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Run Full Workflow</span>
                </>
              )}
            </button>

            {meeting.status === 'COMPLETED' || meeting.decisions.length > 0 ? (
              <button
                onClick={onGoToMinutes}
                className="flex items-center space-x-1.5 rounded-lg border border-teal-600 bg-teal-50 px-3.5 py-2 text-xs sm:text-sm font-semibold text-teal-700 hover:bg-teal-100 dark:border-teal-500 dark:bg-teal-950/60 dark:text-teal-300 transition-colors cursor-pointer"
              >
                <FileText className="h-4 w-4" />
                <span>View Minutes</span>
              </button>
            ) : null}

            <button
              onClick={onRefreshMeeting}
              title="Refresh meeting state"
              className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Status Bar */}
        <div className="mt-4 flex flex-wrap items-center justify-between border-t border-slate-100 pt-3 text-xs dark:border-slate-800 gap-2">
          <div className="flex items-center space-x-4 text-slate-500 dark:text-slate-400">
            <span>
              Lifecycle State:{' '}
              <strong className="text-slate-800 dark:text-slate-200">
                {meeting.status}
              </strong>
            </span>
            <span>•</span>
            <span>
              Duration: <strong>{meeting.durationMinutes}m</strong>
            </span>
            <span>•</span>
            <span>
              Attendees: <strong>{meeting.participants.length}</strong>
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('pipeline')}
              className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                activeTab === 'pipeline'
                  ? 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              Agent Cards
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                activeTab === 'logs'
                  ? 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              <Terminal className="h-3 w-3" />
              <span>Live Console ({liveLogs.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* PIPELINE VIEW */}
      {activeTab === 'pipeline' && (
        <div className="space-y-4">
          {agentConfigs.map((agent, index) => {
            const status = getAgentStatus(agent.key);
            const isExpanded = expandedAgent === agent.key;
            const runLog = meeting.agentRuns?.find((r) => r.agentName === agent.key);
            const Icon = agent.icon;

            return (
              <div
                key={agent.key}
                className={`rounded-xl border transition-all ${
                  status === 'RUNNING'
                    ? 'border-teal-500 bg-teal-50/20 shadow-md ring-1 ring-teal-500/40 dark:border-teal-400 dark:bg-teal-950/20'
                    : status === 'COMPLETED'
                    ? 'border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900'
                    : 'border-slate-200/70 bg-slate-50/60 opacity-80 dark:border-slate-800/60 dark:bg-slate-900/40'
                }`}
              >
                {/* Agent Card Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 gap-3">
                  <div className="flex items-start space-x-3.5">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                        status === 'RUNNING'
                          ? 'bg-teal-600 text-white animate-pulse'
                          : status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider">
                          Agent #{index + 1}
                        </span>
                        <span className="text-slate-300 dark:text-slate-700">•</span>
                        <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                          {agent.title}
                        </h3>
                        {status === 'RUNNING' && (
                          <span className="inline-flex items-center space-x-1 rounded bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-300 animate-pulse">
                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            <span>Processing</span>
                          </span>
                        )}
                        {status === 'COMPLETED' && (
                          <span className="inline-flex items-center space-x-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            <span>Completed</span>
                          </span>
                        )}
                        {status === 'WAITING' && (
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            Waiting
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        {agent.role}
                      </p>

                      <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono pt-0.5">
                        Algorithm: {agent.algorithmSummary}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Timing */}
                  <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                    {runLog?.durationMs && (
                      <span className="text-[11px] text-slate-500 font-mono">
                        {runLog.durationMs}ms
                      </span>
                    )}

                    <button
                      onClick={() => handleRunSingleAgent(agent.key)}
                      disabled={runningAgentKey !== null || isRunningAll}
                      className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                      {status === 'COMPLETED' ? 'Re-run' : 'Execute'}
                    </button>

                    <button
                      onClick={() => setExpandedAgent(isExpanded ? null : agent.key)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Inspection Section */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900/60 space-y-4 text-xs">
                    {/* Agent Specific Result Highlights */}
                    {agent.key === 'Scheduler' && meeting.selectedSlot && (
                      <div className="space-y-3">
                        <div className="rounded-lg border border-teal-200 bg-teal-50/60 p-3.5 dark:border-teal-900/60 dark:bg-teal-950/30 space-y-1.5">
                          <div className="font-semibold text-teal-900 dark:text-teal-200 flex items-center justify-between">
                            <span>Selected Meeting Slot (Score: {meeting.selectedSlot.score}/100)</span>
                            <span className="font-mono text-[11px] text-teal-800 dark:text-teal-300">
                              {meeting.selectedSlot.durationMinutes} mins
                            </span>
                          </div>
                          <div className="text-sm font-bold text-teal-950 dark:text-teal-100">
                            {meeting.selectedSlot.day} • {meeting.selectedSlot.startTime} – {meeting.selectedSlot.endTime}
                          </div>
                          <p className="text-xs text-teal-800/90 dark:text-teal-300/90">
                            {meeting.schedulingReasoning || meeting.selectedSlot.reasoning}
                          </p>
                        </div>

                        {meeting.intersectionWindows && meeting.intersectionWindows.length > 0 && (
                          <div className="rounded-md border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-800/70 text-xs">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">
                              Discovered Mutual Participant Overlap:
                            </span>{' '}
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                              {meeting.intersectionWindows.map((w) => `${w.startTime} – ${w.endTime}`).join(', ')}
                            </span>
                          </div>
                        )}

                        {meeting.alternativeSlots && meeting.alternativeSlots.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                              Evaluated Alternative Candidate Slots:
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {meeting.alternativeSlots.map((alt, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center space-x-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                >
                                  <span>
                                    {alt.startTime} – {alt.endTime}
                                  </span>
                                  <span className="text-[10px] text-teal-600 font-bold">
                                    ({alt.score} pts)
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {agent.key === 'Agenda' && meeting.agendaItems && meeting.agendaItems.length > 0 && (
                      <div className="space-y-2">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          Allocated Agenda Items ({meeting.agendaItems.length})
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {meeting.agendaItems.map((item, idx) => (
                            <div
                              key={item.id}
                              className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {idx + 1}. {item.topic}
                                </span>
                                <span className="text-[10px] font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950 px-1.5 py-0.5 rounded">
                                  {item.durationMinutes}m
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                {item.description}
                              </p>
                              <span className="text-[10px] text-slate-400">
                                Facilitator: {item.owner || 'Team'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {agent.key === 'Transcription' && (
                      <div className="space-y-1.5">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                          <span>
                            Diarized Speaker Segments ({meeting.transcriptSegments?.length || 0})
                          </span>
                          <span className="text-slate-400 text-[11px]">Format: {meeting.transcriptFormat || 'TXT'}</span>
                        </div>
                        <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2.5 font-mono text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 space-y-1">
                          {meeting.transcriptSegments && meeting.transcriptSegments.length > 0 ? (
                            meeting.transcriptSegments.slice(0, 8).map((s) => (
                              <div key={s.id}>
                                <strong className="text-teal-700 dark:text-teal-400">
                                  [{s.startTime || '00:00'}] {s.speaker}:
                                </strong>{' '}
                                {s.text}
                              </div>
                            ))
                          ) : (
                            <div className="text-slate-400 italic">No transcript segments ingested yet.</div>
                          )}
                        </div>
                      </div>
                    )}

                    {agent.key === 'Minutes_NLU' && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800">
                            <span className="text-[11px] text-slate-500 font-medium">Decisions Extracted</span>
                            <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                              {meeting.decisions?.length || 0}
                            </div>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800">
                            <span className="text-[11px] text-slate-500 font-medium">Open Questions</span>
                            <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                              {meeting.openQuestions?.length || 0}
                            </div>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800">
                            <span className="text-[11px] text-slate-500 font-medium">Action Items</span>
                            <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                              {meeting.actionItems?.length || 0}
                            </div>
                          </div>
                        </div>

                        {meeting.decisions && meeting.decisions.length > 0 && (
                          <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800 space-y-1.5">
                            <span className="font-semibold text-slate-900 dark:text-white">Sample Extracted Decision</span>
                            <p className="text-slate-700 dark:text-slate-300">
                              "{meeting.decisions[0].text}"
                            </p>
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                              Confidence: {Math.round(meeting.decisions[0].confidence * 100)}% • {meeting.decisions[0].rationale}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {agent.key === 'TaskTracker' && (
                      <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900 dark:text-white">Adapter Status</span>
                          <span className="text-emerald-600 text-[11px] font-semibold">Synchronized</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300">
                          {meeting.actionItems?.length || 0} action items dispatched to <strong>DemoTaskTrackerAdapter</strong>. Calendar event <strong>{meeting.calendarEventId || 'cal-sync-01'}</strong> locked in <strong>MockCalendarAdapter</strong>.
                        </p>
                      </div>
                    )}

                    {agent.key === 'Memory' && (
                      <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900 dark:text-white">Cross-Meeting Memory Findings</span>
                          <span className="text-teal-700 dark:text-teal-300 font-mono text-[11px]">TF-IDF Active</span>
                        </div>
                        {meeting.recurringIssuesDetected && meeting.recurringIssuesDetected.length > 0 ? (
                          <div className="space-y-1">
                            <span className="text-amber-600 font-semibold text-[11px]">
                              ⚠️ Linked to Recurring Issues:
                            </span>
                            <ul className="list-disc pl-4 text-slate-600 dark:text-slate-400 space-y-0.5">
                              {meeting.recurringIssuesDetected.map((issue, idx) => (
                                <li key={idx}>{issue}</li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <p className="text-slate-500">Historical similarity index calculated. No critical anomalies.</p>
                        )}

                        {meeting.followUpRecommendation && (
                          <div className="mt-2 rounded bg-amber-50 p-2 text-[11px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                            <strong>Recommended Follow-up:</strong> {meeting.followUpRecommendation.recommendedTitle}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Execution Logs from Agent Run */}
                    {runLog?.logs && runLog.logs.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Agent Log Output:</span>
                        <div className="rounded bg-slate-100 p-2 font-mono text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300 space-y-0.5">
                          {runLog.logs.map((log, i) => (
                            <div key={i}>• {log}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* LOGS TAB */}
      {activeTab === 'logs' && (
        <div className="rounded-xl border border-slate-900 bg-slate-950 p-5 font-mono text-xs text-emerald-400 shadow-md space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-slate-400">
            <span className="flex items-center space-x-1.5">
              <Terminal className="h-4 w-4" />
              <span>ASTRA Multi-Agent Telemetry Stream</span>
            </span>
            <span className="text-[11px]">Server-Sent Events (SSE) Active</span>
          </div>

          <div className="h-96 overflow-y-auto space-y-1.5 scrollbar-thin pt-2">
            {liveLogs.length > 0 ? (
              liveLogs.map((log, i) => (
                <div key={i} className="leading-relaxed">
                  {log}
                </div>
              ))
            ) : (
              <div className="text-slate-500 italic">
                Awaiting agent execution events. Click "Run Full Workflow" above to begin.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
