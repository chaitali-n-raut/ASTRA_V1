import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle,
  Clock,
  FileText,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { Meeting, MeetingSlot, Participant, ParticipantAvailability, TaskPriority } from '../types.ts';
import { computeClientSchedule, formatTimeAMPM } from '../utils/scheduler.ts';

interface NewMeetingWizardProps {
  participants: Participant[];
  onCancel: () => void;
  onSubmit: (meetingData: Partial<Meeting>, customTranscript?: string) => Promise<void>;
}

export const NewMeetingWizard: React.FC<NewMeetingWizardProps> = ({
  participants: defaultParticipants,
  onCancel,
  onSubmit,
}) => {
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);

  // Form State
  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [priority, setPriority] = useState<TaskPriority>('HIGH');
  const [preferredDate, setPreferredDate] = useState('2026-09-29');

  // Focus Window State
  const [userPreferredTimeRange, setUserPreferredTimeRange] = useState('');
  const [hasCustomFocusWindow, setHasCustomFocusWindow] = useState(false);

  // User-selected Slot
  const [selectedSlot, setSelectedSlot] = useState<MeetingSlot | null>(null);

  // Constraints State
  const [constraints, setConstraints] = useState<string[]>(['Working hours only (09:00-18:00)']);
  const [newConstraint, setNewConstraint] = useState('');

  // Participants State
  const [selectedParticipants, setSelectedParticipants] = useState<Participant[]>(
    defaultParticipants.slice(0, 4)
  );
  const [newParticipantName, setNewParticipantName] = useState('');
  const [newParticipantEmail, setNewParticipantEmail] = useState('');
  const [newParticipantRole, setNewParticipantRole] = useState('');

  // Availability State
  const [availabilities, setAvailabilities] = useState<ParticipantAvailability[]>(() => {
    return defaultParticipants.slice(0, 4).map((p) => ({
      participantId: p.id,
      participantName: p.name,
      source: 'MANUAL' as const,
      intervals: [
        { day: '2026-09-29', startTime: '09:00', endTime: '12:30' },
        { day: '2026-09-29', startTime: '13:30', endTime: '17:00' },
      ],
    }));
  });

  // Transcript Input
  const [customTranscript, setCustomTranscript] = useState('');
  const [useSampleTranscript, setUseSampleTranscript] = useState(true);

  // Compute live client-side scheduling & intersection in real-time
  const schedulingResult = useMemo(() => {
    return computeClientSchedule(
      durationMinutes,
      priority,
      preferredDate,
      hasCustomFocusWindow ? userPreferredTimeRange : '',
      availabilities
    );
  }, [durationMinutes, priority, preferredDate, userPreferredTimeRange, hasCustomFocusWindow, availabilities]);

  // Derived common overlap text
  const commonOverlapStr = useMemo(() => {
    if (!schedulingResult.intersectionWindows || schedulingResult.intersectionWindows.length === 0) {
      return '';
    }
    return schedulingResult.intersectionWindows
      .map((w) => `${w.startTime} - ${w.endTime}`)
      .join(', ');
  }, [schedulingResult.intersectionWindows]);

  // Effective preferred focus window: custom entry if entered, otherwise defaults to common overlap
  const effectiveTimeRange = useMemo(() => {
    if (hasCustomFocusWindow && userPreferredTimeRange.trim()) {
      return userPreferredTimeRange.trim();
    }
    return commonOverlapStr || '10:00 - 12:00';
  }, [hasCustomFocusWindow, userPreferredTimeRange, commonOverlapStr]);

  // Active meeting slot: user manually selected slot (if still valid in candidate slots), or top candidate slot
  const activeSlot: MeetingSlot | null = useMemo(() => {
    if (selectedSlot) {
      const match = schedulingResult.candidateSlots.find(
        (c) =>
          c.day === selectedSlot.day &&
          c.startTime === selectedSlot.startTime &&
          c.endTime === selectedSlot.endTime
      );
      if (match) return match;
    }
    return schedulingResult.selectedSlot;
  }, [selectedSlot, schedulingResult]);

  // Quick Prefill for College / Project Demo
  const handlePrefillDemo = () => {
    setTitle('Autonomous Meeting Agent Architecture Review');
    setPurpose('Finalize project architecture, validate constraint scheduling, and assign remaining tasks.');
    setDescription('Comprehensive evaluation of multi-agent orchestration state transitions, discrete interval intersection algorithms, and cross-meeting TF-IDF memory.');
    setDurationMinutes(30);
    setPriority('CRITICAL');
    setPreferredDate('2026-09-29');
    setSelectedParticipants(defaultParticipants.slice(0, 4));
    setUseSampleTranscript(true);
    setHasCustomFocusWindow(false);
    setUserPreferredTimeRange('');
    setSelectedSlot(null);
  };

  const handleToggleParticipant = (p: Participant) => {
    const exists = selectedParticipants.some((x) => x.id === p.id);
    if (exists) {
      setSelectedParticipants((prev) => prev.filter((x) => x.id !== p.id));
      setAvailabilities((prev) => prev.filter((a) => a.participantId !== p.id));
    } else {
      setSelectedParticipants((prev) => [...prev, p]);
      setAvailabilities((prev) => [
        ...prev,
        {
          participantId: p.id,
          participantName: p.name,
          source: 'MANUAL',
          intervals: [
            { day: preferredDate, startTime: '10:00', endTime: '13:00' },
            { day: preferredDate, startTime: '14:00', endTime: '17:00' },
          ],
        },
      ]);
    }
  };

  const handleAddCustomParticipant = () => {
    if (!newParticipantName.trim()) return;
    const newP: Participant = {
      id: `p-${Date.now()}`,
      name: newParticipantName.trim(),
      email:
        newParticipantEmail.trim() ||
        `${newParticipantName.toLowerCase().replace(/\s+/g, '')}@astra.ai`,
      role: newParticipantRole.trim() || 'Contributor',
    };
    setSelectedParticipants((prev) => [...prev, newP]);
    setAvailabilities((prev) => [
      ...prev,
      {
        participantId: newP.id,
        participantName: newP.name,
        source: 'MANUAL',
        intervals: [{ day: preferredDate, startTime: '10:00', endTime: '17:00' }],
      },
    ]);
    setNewParticipantName('');
    setNewParticipantEmail('');
    setNewParticipantRole('');
  };

  const handleAddInterval = (participantId: string) => {
    setAvailabilities((prev) =>
      prev.map((a) => {
        if (a.participantId === participantId) {
          return {
            ...a,
            intervals: [
              ...a.intervals,
              { day: preferredDate, startTime: '10:00', endTime: '15:00' },
            ],
          };
        }
        return a;
      })
    );
  };

  const handleRemoveInterval = (participantId: string, index: number) => {
    setAvailabilities((prev) =>
      prev.map((a) => {
        if (a.participantId === participantId) {
          return {
            ...a,
            intervals: a.intervals.filter((_, idx) => idx !== index),
          };
        }
        return a;
      })
    );
  };

  const handleIntervalChange = (
    participantId: string,
    index: number,
    field: 'day' | 'startTime' | 'endTime',
    value: string
  ) => {
    setAvailabilities((prev) =>
      prev.map((a) => {
        if (a.participantId === participantId) {
          const next = [...a.intervals];
          next[index] = { ...next[index], [field]: value };
          return { ...a, intervals: next };
        }
        return a;
      })
    );
  };

  const handleAddConstraint = () => {
    if (!newConstraint.trim()) return;
    setConstraints([...constraints, newConstraint.trim()]);
    setNewConstraint('');
  };

  const handleRemoveConstraint = (idx: number) => {
    setConstraints(constraints.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload: Partial<Meeting> = {
        title: title || 'Autonomous Meeting Intelligence Review',
        purpose:
          purpose || 'Coordinate technical milestones and resolve architectural action items.',
        description: description || purpose,
        durationMinutes,
        priority,
        preferredDate,
        preferredTimeRange: effectiveTimeRange,
        constraints,
        participants: selectedParticipants,
        availabilities,
        selectedSlot: activeSlot || undefined,
        candidateSlots: schedulingResult.candidateSlots,
        alternativeSlots: schedulingResult.alternativeSlots,
        intersectionWindows: schedulingResult.intersectionWindows,
      };

      const finalTranscript = useSampleTranscript
        ? undefined
        : customTranscript.trim().length > 0
        ? customTranscript
        : undefined;

      await onSubmit(payload, finalTranscript);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { number: 1, title: 'Details' },
    { number: 2, title: 'Participants' },
    { number: 3, title: 'Availability' },
    { number: 4, title: 'Preferences' },
    { number: 5, title: 'Review & Launch' },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      {/* Wizard Progress Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">
              Initialize New Meeting Request
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Provide constraints, participant intervals, and parameters for the Scheduler and NLU agents.
            </p>
          </div>

          <button
            onClick={handlePrefillDemo}
            className="flex items-center space-x-1 rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950/60 dark:text-teal-300 transition-colors cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Prefill Demo Data</span>
          </button>
        </div>

        {/* Step Badges */}
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
          {steps.map((s, idx) => (
            <div key={s.number} className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setStep(s.number)}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors cursor-pointer ${
                  step === s.number
                    ? 'bg-teal-600 text-white shadow-sm ring-2 ring-teal-300 dark:ring-teal-700'
                    : step > s.number
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {step > s.number ? <Check className="h-3.5 w-3.5" /> : s.number}
              </button>
              <span
                onClick={() => setStep(s.number)}
                className={`hidden sm:inline text-xs font-medium cursor-pointer ${
                  step === s.number
                    ? 'text-slate-900 font-semibold dark:text-white'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {s.title}
              </span>
              {idx < steps.length - 1 && (
                <div className="hidden md:block h-0.5 w-8 bg-slate-200 dark:bg-slate-800" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* STEP 1: MEETING DETAILS */}
      {step === 1 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
            <span>Step 1: Meeting Objective & Duration</span>
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Meeting Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Autonomous Meeting Agent Architecture Review"
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Primary Purpose / Objective <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g. Finalize project architecture, validate constraint scheduling, and assign remaining tasks."
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Detailed Scope / Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide technical context, constraints, and background details for the Agenda and NLU agents..."
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Target Duration
                </label>
                <div className="mt-1 grid grid-cols-4 gap-2">
                  {[15, 30, 45, 60].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDurationMinutes(d)}
                      className={`py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                        durationMinutes === d
                          ? 'border-teal-600 bg-teal-50 text-teal-700 dark:border-teal-500 dark:bg-teal-950/60 dark:text-teal-300'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {d} mins
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Meeting Priority
                </label>
                <div className="mt-1 grid grid-cols-5 gap-1.5">
                  {(['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL'] as TaskPriority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`py-2 text-[11px] font-semibold rounded-lg border transition-colors cursor-pointer ${
                        priority === p
                          ? 'border-teal-600 bg-teal-50 text-teal-700 dark:border-teal-500 dark:bg-teal-950/60 dark:text-teal-300'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: PARTICIPANTS */}
      {step === 2 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Step 2: Assign Meeting Participants
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Select participants from your project team directory or register a new attendee.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {defaultParticipants.map((p) => {
              const isSelected = selectedParticipants.some((x) => x.id === p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => handleToggleParticipant(p)}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-teal-600 bg-teal-50/60 dark:border-teal-500 dark:bg-teal-950/40'
                      : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                      {p.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">{p.name}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{p.role}</div>
                    </div>
                  </div>
                  <div
                    className={`h-5 w-5 rounded-md border flex items-center justify-center ${
                      isSelected
                        ? 'border-teal-600 bg-teal-600 text-white'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add custom participant */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60 space-y-3">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Add Additional Participant
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Full Name"
                value={newParticipantName}
                onChange={(e) => setNewParticipantName(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
              <input
                type="email"
                placeholder="Email Address"
                value={newParticipantEmail}
                onChange={(e) => setNewParticipantEmail(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Role (e.g. Evaluator)"
                  value={newParticipantRole}
                  onChange={(e) => setNewParticipantRole(e.target.value)}
                  className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleAddCustomParticipant}
                  className="rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: AVAILABILITY MATRIX */}
      {step === 3 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Step 3: Participant Availability Windows
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Interval intersection discovers common overlapping windows across all registered attendees in real time.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-medium text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950 px-2.5 py-1 rounded-full border border-teal-200 dark:border-teal-800">
                Target Date: {preferredDate}
              </span>
            </div>
          </div>

          {/* Real-time Overlap Status Banner */}
          {commonOverlapStr ? (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50/80 p-3.5 dark:border-emerald-800 dark:bg-emerald-950/40 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
              <div className="flex items-center space-x-2 font-bold text-emerald-800 dark:text-emerald-300">
                <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Mutual Availability Overlap Discovered:</span>
                <span className="font-mono text-sm underline decoration-emerald-500 underline-offset-2">
                  {commonOverlapStr}
                </span>
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300/90 pl-6">
                All {availabilities.length} attendees are mutually free during this window. Identified{' '}
                <strong className="font-semibold text-emerald-900 dark:text-emerald-100">
                  {schedulingResult.candidateSlots.length} valid candidate slot(s)
                </strong>{' '}
                for requested {durationMinutes}-minute duration.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-300 bg-amber-50/80 p-3.5 dark:border-amber-800 dark:bg-amber-950/40 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <div className="flex items-center space-x-2 font-bold text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span>No Complete Overlap for All {availabilities.length} Attendees</span>
              </div>
              <p className="text-[11px] text-amber-700 dark:text-amber-300/90 pl-6">
                The current participant windows do not mutually intersect. The Scheduler Agent will evaluate partial quorum alternatives or you can adjust attendee intervals below.
              </p>
            </div>
          )}

          <div className="space-y-4">
            {availabilities.map((avail) => (
              <div
                key={avail.participantId}
                className="rounded-lg border border-slate-200 p-4 dark:border-slate-800 space-y-2.5 bg-slate-50/40 dark:bg-slate-900/50"
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                    <span>{avail.participantName}</span>
                    <span className="text-[11px] font-normal text-slate-500">
                      ({avail.intervals.length} available window{avail.intervals.length !== 1 ? 's' : ''})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddInterval(avail.participantId)}
                    className="flex items-center space-x-1 text-xs text-teal-600 hover:text-teal-700 dark:text-teal-400 font-semibold cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Window</span>
                  </button>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  {avail.intervals.map((interval, idx) => (
                    <div
                      key={idx}
                      className="flex items-center space-x-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 shadow-2xs"
                    >
                      <input
                        type="date"
                        value={interval.day}
                        onChange={(e) =>
                          handleIntervalChange(avail.participantId, idx, 'day', e.target.value)
                        }
                        className="w-28 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                      />
                      <input
                        type="time"
                        value={interval.startTime}
                        onChange={(e) =>
                          handleIntervalChange(avail.participantId, idx, 'startTime', e.target.value)
                        }
                        className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs font-mono dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                      />
                      <span className="text-slate-400 font-medium">to</span>
                      <input
                        type="time"
                        value={interval.endTime}
                        onChange={(e) =>
                          handleIntervalChange(avail.participantId, idx, 'endTime', e.target.value)
                        }
                        className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs font-mono dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveInterval(avail.participantId, idx)}
                        className="text-slate-400 hover:text-rose-500 cursor-pointer ml-1"
                        title="Remove window"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 4: PREFERENCES & CONSTRAINTS */}
      {step === 4 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Step 4: Scheduling Heuristics & Preferences
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Participant availability intersection has been determined. Review candidate slots or specify ranking focus.
              </p>
            </div>
            {commonOverlapStr && (
              <span className="rounded-full bg-teal-50 dark:bg-teal-950 px-3 py-1 text-xs font-bold text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                Mutual Overlap: {commonOverlapStr}
              </span>
            )}
          </div>

          {/* Computed Intersection Summary */}
          <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-4 dark:border-teal-900/60 dark:bg-teal-950/20 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-teal-900 dark:text-teal-200">
                Discovered Common Availability Window:
              </span>
              <span className="font-mono font-bold text-teal-800 dark:text-teal-300">
                {commonOverlapStr || 'No 100% intersection found'}
              </span>
            </div>
            <p className="text-[11px] text-teal-800/80 dark:text-teal-300/80">
              The scheduler agent uses this mutual window as the source of truth to extract candidate slots of length {durationMinutes} minutes.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Target Date
              </label>
              <input
                type="date"
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Preferred Focus Window
                </label>
                {hasCustomFocusWindow && commonOverlapStr && (
                  <button
                    type="button"
                    onClick={() => {
                      setHasCustomFocusWindow(false);
                      setUserPreferredTimeRange('');
                    }}
                    className="flex items-center space-x-1 text-[11px] font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400 cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset to Overlap</span>
                  </button>
                )}
              </div>
              <input
                type="text"
                value={effectiveTimeRange}
                onChange={(e) => {
                  setUserPreferredTimeRange(e.target.value);
                  setHasCustomFocusWindow(true);
                }}
                placeholder={commonOverlapStr || 'e.g. 12:00 - 12:45'}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                {hasCustomFocusWindow
                  ? 'Custom focus window applied for scoring.'
                  : 'Automatically synchronized with Step 3 common availability overlap.'}
              </span>
            </div>
          </div>

          {/* Valid Candidate Slots Grid */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Generated Candidate Slots ({durationMinutes} Minutes Duration)
              </label>
              <span className="text-xs text-slate-500">
                {schedulingResult.candidateSlots.length} slot{schedulingResult.candidateSlots.length !== 1 ? 's' : ''} available
              </span>
            </div>

            {schedulingResult.candidateSlots.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {schedulingResult.candidateSlots.map((slot, idx) => {
                  const isSelected =
                    activeSlot?.startTime === slot.startTime &&
                    activeSlot?.endTime === slot.endTime &&
                    activeSlot?.day === slot.day;

                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedSlot(slot)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-teal-600 bg-teal-50/70 dark:border-teal-500 dark:bg-teal-950/50 shadow-xs ring-1 ring-teal-500'
                          : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-850'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Clock className={`h-4 w-4 ${isSelected ? 'text-teal-600' : 'text-slate-400'}`} />
                          <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                            {slot.startTime} – {slot.endTime}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            slot.score >= 90
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
                          }`}
                        >
                          Score: {slot.score}/100
                        </span>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 dark:text-slate-400">
                          {slot.conflictParticipantIds.length === 0 ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center space-x-1">
                              <Check className="h-3 w-3" />
                              <span>All {slot.availableParticipantIds.length} Available</span>
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold">
                              {slot.availableParticipantIds.length} of {selectedParticipants.length} Available
                            </span>
                          )}
                        </span>
                        {isSelected && (
                          <span className="text-teal-700 dark:text-teal-300 font-bold flex items-center space-x-1">
                            <CheckCircle className="h-3.5 w-3.5" />
                            <span>Target Slot</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500 dark:border-slate-700">
                No candidate slots fit {durationMinutes} minutes within current participant windows. Reduce meeting duration or widen Step 3 availability.
              </div>
            )}
          </div>

          {/* Constraints */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Hard & Soft Constraints
            </label>
            <div className="space-y-1.5">
              {constraints.map((c, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <span>• {c}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveConstraint(i)}
                    className="text-slate-400 hover:text-rose-500 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex space-x-2 pt-1">
              <input
                type="text"
                value={newConstraint}
                onChange={(e) => setNewConstraint(e.target.value)}
                placeholder="Add constraint (e.g. Quorum requires at least 3 participants)"
                className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={handleAddConstraint}
                className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 cursor-pointer"
              >
                Add Constraint
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: REVIEW & TRANSCRIPT LAUNCH */}
      {step === 5 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Step 5: Review & Autonomous Execution
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verify input parameters before triggering the six-agent autonomous meeting lifecycle.
              </p>
            </div>
            <span className="rounded bg-teal-100 px-2.5 py-1 text-xs font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-300">
              Ready to Run
            </span>
          </div>

          {/* Configuration Summary Card */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400 font-medium">Title</span>
              <div className="font-semibold text-slate-900 dark:text-white mt-0.5 line-clamp-1">
                {title || 'Untitled Meeting'}
              </div>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 font-medium">Duration</span>
              <div className="font-semibold text-slate-900 dark:text-white mt-0.5">
                {durationMinutes} Minutes ({priority} Prio)
              </div>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 font-medium">Focus Window</span>
              <div className="font-semibold text-slate-900 dark:text-white mt-0.5 font-mono">
                {effectiveTimeRange}
              </div>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 font-medium">Attendees</span>
              <div className="font-semibold text-slate-900 dark:text-white mt-0.5">
                {selectedParticipants.length} Registered
              </div>
            </div>
          </div>

          {/* Confirmed Candidate Slot Card */}
          {activeSlot && (
            <div className="rounded-lg border border-teal-200 bg-teal-50/70 p-4 dark:border-teal-900/60 dark:bg-teal-950/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-900 dark:text-teal-200 flex items-center space-x-1.5">
                  <CheckCircle className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  <span>Scheduled Target Slot (Score: {activeSlot.score}/100)</span>
                </span>
                <span className="text-[11px] font-mono text-teal-800 dark:text-teal-300">
                  {activeSlot.durationMinutes} Minutes
                </span>
              </div>
              <div className="text-base font-bold font-mono text-teal-950 dark:text-teal-100">
                {activeSlot.day} • {activeSlot.startTime} – {activeSlot.endTime}
              </div>
              <p className="text-xs text-teal-800/90 dark:text-teal-300/90">
                {activeSlot.reasoning ||
                  `Unanimous agreement across all ${activeSlot.availableParticipantIds.length} participants with zero conflicts.`}
              </p>
            </div>
          )}

          {/* Candidate Alternatives */}
          {schedulingResult.alternativeSlots.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Alternative Feasible Slots:
              </span>
              <div className="flex flex-wrap gap-2">
                {schedulingResult.alternativeSlots.map((alt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedSlot(alt)}
                    className="flex items-center space-x-2 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-mono text-slate-700 hover:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                  >
                    <span>
                      {alt.startTime} – {alt.endTime}
                    </span>
                    <span className="text-[10px] text-teal-600 font-bold">({alt.score} pts)</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Transcript Selection Toggle */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Transcript Ingestion Mode
              </label>
              <div className="flex items-center space-x-2 text-xs">
                <button
                  type="button"
                  onClick={() => setUseSampleTranscript(true)}
                  className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    useSampleTranscript
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  Contextual Demo Dialogue
                </button>
                <button
                  type="button"
                  onClick={() => setUseSampleTranscript(false)}
                  className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    !useSampleTranscript
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  Custom Transcript
                </button>
              </div>
            </div>

            {useSampleTranscript ? (
              <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-4 text-xs text-teal-900 dark:border-teal-900/60 dark:bg-teal-950/20 dark:text-teal-200">
                <p className="font-semibold">Contextual Multi-Speaker Dialogue Mode Active</p>
                <p className="mt-1 text-[11px] text-teal-800/80 dark:text-teal-300/80">
                  ASTRA will synthesize a realistic conversation matching your title, purpose, and attendees with clear decisions, open questions, and deadline-bound action items.
                </p>
              </div>
            ) : (
              <div>
                <textarea
                  rows={5}
                  value={customTranscript}
                  onChange={(e) => setCustomTranscript(e.target.value)}
                  placeholder="Paste meeting transcript text, VTT, or SRT here...&#10;Example:&#10;Chaitali: We decided to adopt the constraint scheduler.&#10;Vaishnavi: Vaishnavi will finish the API by Friday."
                  className="block w-full rounded-lg border border-slate-300 bg-white p-3 text-xs font-mono text-slate-900 focus:outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => {
            if (step === 1) onCancel();
            else setStep(step - 1);
          }}
          className="flex items-center space-x-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{step === 1 ? 'Cancel' : 'Previous'}</span>
        </button>

        {step < 5 ? (
          <button
            type="button"
            onClick={() => setStep(step + 1)}
            className="flex items-center space-x-1.5 rounded-lg bg-teal-600 px-5 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-teal-700 transition-colors cursor-pointer"
          >
            <span>Next Step</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={loading}
            onClick={handleSubmit}
            className="flex items-center space-x-2 rounded-lg bg-teal-600 px-6 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-teal-700 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Sparkles className="h-4 w-4" />
            <span>{loading ? 'Running ASTRA Engine...' : 'Run ASTRA Multi-Agent Pipeline'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
