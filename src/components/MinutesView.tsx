import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileCode,
  FileText,
  HelpCircle,
  ListTodo,
  Printer,
  Sparkles,
  Users,
} from 'lucide-react';
import { Meeting } from '../types.ts';
import { fetchMinutesMarkdown } from '../api.ts';

interface MinutesViewProps {
  meeting: Meeting;
  onBack: () => void;
  onGoToWorkflow: () => void;
}

export const MinutesView: React.FC<MinutesViewProps> = ({
  meeting,
  onBack,
  onGoToWorkflow,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'minutes' | 'transcript' | 'json'>('minutes');
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const data = await fetchMinutesMarkdown(meeting.id);
      await navigator.clipboard.writeText(data.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy markdown:', err);
    }
  };

  const handleDownloadMarkdown = async () => {
    try {
      const data = await fetchMinutesMarkdown(meeting.id);
      const blob = new Blob([data.markdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ASTRA_Minutes_${meeting.id}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download markdown:', err);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-20 print:p-0 print:space-y-4">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div className="flex items-center space-x-2">
          <button
            onClick={onBack}
            className="flex items-center space-x-1 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <button
            onClick={onGoToWorkflow}
            className="text-xs font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 cursor-pointer"
          >
            Inspect Agent Pipeline
          </button>
        </div>

        <div className="flex items-center space-x-2">
          {/* SubTab switcher */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-800 dark:bg-slate-900">
            <button
              onClick={() => setActiveSubTab('minutes')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                activeSubTab === 'minutes'
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Minutes Document
            </button>
            <button
              onClick={() => setActiveSubTab('transcript')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                activeSubTab === 'transcript'
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Transcript
            </button>
            <button
              onClick={() => setActiveSubTab('json')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                activeSubTab === 'json'
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              JSON
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center space-x-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <Copy className="h-3.5 w-3.5" />
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
          <button
            onClick={handleDownloadMarkdown}
            className="flex items-center space-x-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Markdown</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* DOCUMENT VIEW */}
      {activeSubTab === 'minutes' && (
        <article className="rounded-xl border border-slate-200 bg-white p-8 shadow-xs dark:border-slate-800 dark:bg-slate-900 print:border-none print:shadow-none space-y-8">
          {/* Header */}
          <div className="border-b border-slate-200 pb-6 dark:border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-teal-700 dark:text-teal-400 uppercase tracking-widest">
                ASTRA_V1 • Official Minutes of Resolution
              </span>
              <span className="text-xs text-slate-500 font-mono">
                Meeting Reference: #{meeting.id}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {meeting.title}
            </h1>

            {/* Metadata Chips */}
            <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-slate-600 dark:text-slate-300 pt-1">
              <div className="flex items-center space-x-1">
                <Calendar className="h-4 w-4 text-slate-400" />
                <span className="font-semibold">
                  {meeting.selectedSlot ? `${meeting.selectedSlot.day} • ${meeting.selectedSlot.startTime} – ${meeting.selectedSlot.endTime}` : meeting.preferredDate}
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="h-4 w-4 text-slate-400" />
                <span>{meeting.durationMinutes} Minutes</span>
              </div>
              <div className="flex items-center space-x-1">
                <Users className="h-4 w-4 text-slate-400" />
                <span>{meeting.participants.length} Attendees</span>
              </div>
              <span className="rounded bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                Priority: {meeting.priority}
              </span>
            </div>

            {/* Attendees List */}
            <div className="flex flex-wrap gap-1.5 pt-2">
              {meeting.participants.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  {p.name} <span className="text-slate-400 text-[10px] ml-1">({p.role})</span>
                </span>
              ))}
            </div>
          </div>

          {/* Section 1: Executive Summary */}
          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center space-x-2">
              <Sparkles className="h-4 w-4 text-teal-600" />
              <span>1. Executive Summary</span>
            </h2>
            <div className="rounded-lg border border-teal-100 bg-teal-50/40 p-4 text-sm leading-relaxed text-slate-800 dark:border-teal-900/40 dark:bg-teal-950/20 dark:text-slate-200">
              {meeting.executiveSummary ||
                'The autonomous meeting concluded with structured architectural alignment, verified decisions, and assigned action item ownership.'}
            </div>
          </section>

          {/* Section 2: Agenda Breakdown */}
          {meeting.agendaItems && meeting.agendaItems.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center space-x-2">
                <Clock className="h-4 w-4 text-teal-600" />
                <span>2. Agenda Structure & Time Budget ({meeting.durationMinutes}m)</span>
              </h2>
              <div className="space-y-2">
                {meeting.agendaItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 gap-2"
                  >
                    <div>
                      <div className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-white">
                        {idx + 1}. {item.topic}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {item.description}
                      </p>
                    </div>
                    <div className="flex items-center space-x-3 text-xs shrink-0 self-end sm:self-center">
                      <span className="font-semibold text-teal-700 dark:text-teal-300">
                        {item.durationMinutes} mins
                      </span>
                      <span className="text-slate-400">Owner: {item.owner || 'Team'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Section 3: Key Discussion Points */}
          {meeting.keyDiscussionPoints && meeting.keyDiscussionPoints.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                3. Key Discussion Points
              </h2>
              <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                {meeting.keyDiscussionPoints.map((point, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {point}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Section 4: Decisions Reached */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center space-x-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>4. Decisions Reached ({meeting.decisions.length})</span>
            </h2>
            {meeting.decisions.length > 0 ? (
              <div className="space-y-2.5">
                {meeting.decisions.map((decision, idx) => (
                  <div
                    key={decision.id}
                    className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3.5 dark:border-emerald-900/60 dark:bg-emerald-950/20 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs sm:text-sm text-emerald-950 dark:text-emerald-200">
                        D-{idx + 1}: {decision.text}
                      </span>
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                        Confidence {Math.round(decision.confidence * 100)}%
                      </span>
                    </div>
                    {decision.context && (
                      <p className="text-xs text-emerald-900/80 dark:text-emerald-300/80 italic">
                        {decision.context}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No formal decisions recorded.</p>
            )}
          </section>

          {/* Section 5: Open Questions */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center space-x-2">
              <HelpCircle className="h-4 w-4 text-sky-600" />
              <span>5. Open & Unresolved Questions ({meeting.openQuestions.length})</span>
            </h2>
            {meeting.openQuestions.length > 0 ? (
              <div className="space-y-2">
                {meeting.openQuestions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800"
                  >
                    <div className="space-y-0.5">
                      <span className="font-medium text-xs sm:text-sm text-slate-900 dark:text-white">
                        Q-{idx + 1}: {q.question}
                      </span>
                      {q.askedBy && (
                        <div className="text-[11px] text-slate-500">
                          Raised by: <strong>{q.askedBy}</strong>
                        </div>
                      )}
                    </div>
                    <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      {q.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">All questions resolved.</p>
            )}
          </section>

          {/* Section 6: Action Items & Owners Table */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center space-x-2">
              <ListTodo className="h-4 w-4 text-teal-600" />
              <span>6. Action Items & Resolution Tasks ({meeting.actionItems.length})</span>
            </h2>
            {meeting.actionItems.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
                    <tr>
                      <th className="p-3">Action Item</th>
                      <th className="p-3">Assignee</th>
                      <th className="p-3">Deadline</th>
                      <th className="p-3">Priority</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {meeting.actionItems.map((action) => (
                      <tr key={action.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-3 font-medium text-slate-900 dark:text-white">
                          {action.text}
                        </td>
                        <td className="p-3 font-semibold text-teal-700 dark:text-teal-400">
                          {action.owner}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">
                          {action.deadline}
                        </td>
                        <td className="p-3">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {action.priority}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="rounded bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                            {action.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No action items assigned.</p>
            )}
          </section>

          {/* Section 7: Autonomous Follow-Up Recommendation */}
          {meeting.followUpRecommendation && (
            <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-5 dark:border-amber-900/60 dark:bg-amber-950/20 space-y-2">
              <div className="flex items-center space-x-2 text-amber-900 dark:text-amber-200 font-semibold text-sm">
                <AlertTriangle className="h-4 w-4" />
                <span>Memory Agent Follow-Up Recommendation</span>
              </div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                {meeting.followUpRecommendation.recommendedTitle}
              </h3>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                {meeting.followUpRecommendation.reason}
              </p>
              {meeting.followUpRecommendation.proposedTopics && (
                <div className="pt-1">
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Proposed Agenda Topics:
                  </span>
                  <ul className="list-disc pl-5 text-xs text-slate-600 dark:text-slate-400 mt-0.5 space-y-0.5">
                    {meeting.followUpRecommendation.proposedTopics.map((topic, i) => (
                      <li key={i}>{topic}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* Footer Sign-off */}
          <div className="border-t border-slate-200 pt-6 text-center text-xs text-slate-400 dark:border-slate-800">
            Autonomous resolution certified by ASTRA_V1 Multi-Agent Engine • Generated at{' '}
            {new Date(meeting.updatedAt).toLocaleString()}
          </div>
        </article>
      )}

      {/* RAW TRANSCRIPT VIEW */}
      {activeSubTab === 'transcript' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <h2 className="font-bold text-slate-900 dark:text-white text-sm">
              Ingested Meeting Transcript
            </h2>
            <span className="text-xs text-slate-500 font-mono">
              {meeting.transcriptSegments?.length || 0} Utterances
            </span>
          </div>

          <div className="space-y-2 font-mono text-xs">
            {meeting.transcriptSegments && meeting.transcriptSegments.length > 0 ? (
              meeting.transcriptSegments.map((s) => (
                <div
                  key={s.id}
                  className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40"
                >
                  <div className="flex items-center justify-between text-[11px] text-teal-700 dark:text-teal-400 font-semibold mb-1">
                    <span>{s.speaker}</span>
                    <span className="text-slate-400">{s.startTime || '00:00'}</span>
                  </div>
                  <p className="text-slate-800 dark:text-slate-200">{s.text}</p>
                </div>
              ))
            ) : (
              <p className="text-slate-400 italic">No transcript recorded for this session.</p>
            )}
          </div>
        </div>
      )}

      {/* STRUCTURED JSON VIEW */}
      {activeSubTab === 'json' && (
        <div className="rounded-xl border border-slate-900 bg-slate-950 p-5 font-mono text-xs text-emerald-400 shadow-md">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-slate-400 mb-3">
            <span>ASTRA Verified Entity JSON</span>
            <span>Valid Pydantic Schema</span>
          </div>
          <pre className="overflow-x-auto max-h-[500px] leading-relaxed">
            {JSON.stringify(meeting, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
