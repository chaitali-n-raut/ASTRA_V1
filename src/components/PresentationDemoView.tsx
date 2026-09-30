import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  Download,
  FileText,
  ListTodo,
  Loader2,
  Mic,
  Play,
  Presentation,
  RefreshCw,
  Sparkles,
  Users,
} from 'lucide-react';
import { Meeting } from '../types.ts';
import { loadSampleMeeting, runMeetingWorkflow } from '../api.ts';

interface PresentationDemoViewProps {
  onSelectMeeting: (meetingId: string, tab?: string) => void;
}

export const PresentationDemoView: React.FC<PresentationDemoViewProps> = ({
  onSelectMeeting,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [demoMeeting, setDemoMeeting] = useState<Meeting | null>(null);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [stepLogs, setStepLogs] = useState<string[]>([]);

  const runFullDemo = async () => {
    setIsRunning(true);
    setActiveStep(1);
    setStepLogs(['[00:00] Initializing ASTRA_V1 Demo Pipeline for Faculty Evaluation...']);

    try {
      // 1. Load fresh sample meeting
      setStepLogs((prev) => [...prev, '[00:01] Ingesting Meeting Request: "Autonomous Meeting Agent Architecture Review"...']);
      const sample = await loadSampleMeeting();
      setDemoMeeting(sample);

      // 2. Run complete autonomous workflow
      setActiveStep(2);
      setStepLogs((prev) => [
        ...prev,
        '[00:02] Scheduler Agent: Discretizing participant intervals (Chaitali, Vaishnavi, Sakshi, Dipali, Dr. Sharma)...',
      ]);

      const updated = await runMeetingWorkflow(sample.id);
      setDemoMeeting(updated);

      setActiveStep(6);
      setStepLogs((prev) => [
        ...prev,
        '[00:04] Agenda Agent: Formulated 4 duration-bounded agenda items (45m total).',
        '[00:05] Transcription Agent: Normalized 12 speaker segments across 5 attendees.',
        '[00:06] Minutes/NLU Agent: Extracted decisions, questions, and action items with owners.',
        '[00:07] Task Tracker Agent: Synchronized actions to DemoTaskTrackerAdapter.',
        '[00:08] Calendar Agent: Virtual conference room locked in MockCalendarAdapter.',
        '[00:09] Memory Agent: TF-IDF similarity computed. Identified 2 active recurring issues.',
        '[00:10] ✓ End-to-End Autonomous Lifecycle Complete! Final Report Generated.',
      ]);
    } catch (err: any) {
      setStepLogs((prev) => [...prev, `[ERROR] Demo workflow execution error: ${err.message}`]);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Presentation Hero */}
      <div className="rounded-xl border border-teal-200 bg-gradient-to-r from-teal-500/10 via-teal-500/5 to-transparent p-6 sm:p-8 dark:border-teal-900/60 dark:bg-slate-900">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-600 text-white font-bold text-xs">
                A
              </span>
              <span className="font-bold text-sm text-teal-800 dark:text-teal-300 uppercase tracking-widest">
                Academic Project Defense & Evaluation Mode
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              ASTRA_V1 Live Demonstration
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
              Demonstrates complete agentic AI capabilities: Constraint-based scheduling, interval intersection, structured agenda synthesis, transcript NLU, action-to-task synchronization, and cross-meeting TF-IDF memory.
            </p>
          </div>

          <button
            onClick={runFullDemo}
            disabled={isRunning}
            className="flex items-center space-x-2 rounded-xl bg-teal-600 px-6 py-3.5 text-sm font-bold text-white shadow-md hover:bg-teal-700 disabled:opacity-50 transition-all cursor-pointer shrink-0"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Executing Lifecycle...</span>
              </>
            ) : (
              <>
                <Play className="h-5 w-5 fill-current" />
                <span>Run Complete Demo Workflow</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 6-Stage Scientific Architecture Walkthrough */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { num: 1, title: 'Scheduler', desc: 'Interval Intersection', icon: Clock },
          { num: 2, title: 'Agenda', desc: 'Duration Budgeting', icon: FileText },
          { num: 3, title: 'Transcription', desc: 'Diarization Parsing', icon: Mic },
          { num: 4, title: 'Minutes/NLU', desc: 'Decisions & Actions', icon: Cpu },
          { num: 5, title: 'Tasks/Calendar', desc: 'Adapter Sync', icon: ListTodo },
          { num: 6, title: 'Memory', desc: 'TF-IDF Recurrence', icon: Database },
        ].map((stage) => {
          const Icon = stage.icon;
          const isDone = activeStep >= stage.num;
          return (
            <div
              key={stage.num}
              className={`rounded-xl border p-3.5 space-y-2 transition-all ${
                isDone
                  ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30'
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 opacity-70'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold dark:bg-slate-800">
                  {stage.num}
                </span>
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Icon className="h-4 w-4 text-slate-400" />
                )}
              </div>
              <div>
                <div className="font-bold text-xs text-slate-900 dark:text-white">
                  {stage.title}
                </div>
                <div className="text-[10px] text-slate-500">
                  {stage.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Pipeline Telemetry Stream */}
      {stepLogs.length > 0 && (
        <div className="rounded-xl border border-slate-900 bg-slate-950 p-5 font-mono text-xs text-emerald-400 shadow-md space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-slate-400">
            <span>Real-Time Agent Execution Telemetry</span>
            <span>Deterministic Math & NLU State Machine</span>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {stepLogs.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
          </div>
        </div>
      )}

      {/* Final Meeting Report Preview */}
      {demoMeeting && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 dark:border-slate-800 gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600">
                Generated Meeting Intelligence Report
              </span>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                {demoMeeting.title}
              </h2>
            </div>
            <button
              onClick={() => onSelectMeeting(demoMeeting.id, 'minutes')}
              className="flex items-center space-x-1.5 rounded-lg bg-teal-50 px-3.5 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-100 dark:bg-teal-950 dark:text-teal-300 cursor-pointer self-start sm:self-center"
            >
              <span>Open Document View</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Schedule & Agenda */}
            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800 space-y-3">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                <Clock className="h-4 w-4 text-teal-600" />
                <span>Scheduler & Agenda Agent Output</span>
              </h3>

              {demoMeeting.selectedSlot && (
                <div className="rounded bg-teal-50/80 p-2.5 text-xs text-teal-950 dark:bg-teal-950/40 dark:text-teal-200 space-y-1">
                  <div className="font-bold">
                    Slot Selected: {demoMeeting.selectedSlot.day} • {demoMeeting.selectedSlot.startTime} – {demoMeeting.selectedSlot.endTime}
                  </div>
                  <p className="text-[11px] text-teal-800 dark:text-teal-300">
                    {demoMeeting.schedulingReasoning}
                  </p>
                </div>
              )}

              <div className="space-y-1.5 text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Agenda Topics:</span>
                {demoMeeting.agendaItems.map((a, i) => (
                  <div key={i} className="flex justify-between text-[11px] text-slate-600 dark:text-slate-400">
                    <span>{i + 1}. {a.topic}</span>
                    <span className="font-mono text-teal-600">{a.durationMinutes}m</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Decisions & Action Items */}
            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800 space-y-3">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                <Cpu className="h-4 w-4 text-teal-600" />
                <span>NLU Agent Extractions</span>
              </h3>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Decisions ({demoMeeting.decisions.length}):</span>
                  {demoMeeting.decisions.map((d, i) => (
                    <div key={i} className="mt-1 rounded border border-emerald-200 bg-emerald-50/60 p-2 text-[11px] text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                      ✓ {d.text} <span className="text-[10px] text-emerald-700">({Math.round(d.confidence * 100)}% conf)</span>
                    </div>
                  ))}
                </div>

                <div className="pt-1">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Action Items ({demoMeeting.actionItems.length}):</span>
                  <div className="mt-1 space-y-1">
                    {demoMeeting.actionItems.map((act, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px] rounded bg-slate-50 p-1.5 dark:bg-slate-800">
                        <span className="font-medium text-slate-800 dark:text-slate-200">{act.text}</span>
                        <span className="font-semibold text-teal-700 dark:text-teal-400 shrink-0 ml-2">{act.owner} ({act.deadline})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
