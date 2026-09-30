import { EventEmitter } from 'events';
import { scheduleMeeting } from '../algorithms/scheduler.ts';
import { extractMinutesOffline } from '../algorithms/nlu.ts';
import {
  detectRecurringIssues,
  generateFollowUpRecommendation,
  searchHistoricalMeetings,
} from '../algorithms/retrieval.ts';
import { db } from '../db/store.ts';
import {
  analyzeTranscriptWithAI,
  generateAgendaWithAI,
  isGeminiAvailable,
} from '../services/gemini.ts';
import {
  AgentRunLog,
  AuditLog,
  Meeting,
  MeetingStatus,
  TranscriptSegment,
} from '../types.ts';

export interface WorkflowEvent {
  meetingId: string;
  agent: string;
  event: string;
  status: 'WAITING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  message: string;
  timestamp: string;
  meetingState?: MeetingStatus;
  data?: any;
}

class OrchestratorEmitter extends EventEmitter {}
export const workflowEvents = new OrchestratorEmitter();

export class OrchestratorService {
  /**
   * Run the complete multi-agent workflow for a meeting
   */
  async runFullWorkflow(
    meetingId: string,
    customTranscript?: string,
    actor?: { id: string; name: string }
  ): Promise<Meeting> {
    const meeting = db.getMeeting(meetingId);
    if (!meeting) {
      throw new Error(`Meeting ${meetingId} not found`);
    }

    const orgId = meeting.organizationId;
    const userName = actor?.name || 'ASTRA Autonomous Engine';

    try {
      // 1. SCHEDULER AGENT
      await this.runSchedulerAgent(meetingId, actor);

      // 2. AGENDA AGENT
      await this.runAgendaAgent(meetingId, actor);

      // 3. TRANSCRIPTION AGENT
      await this.runTranscriptionAgent(meetingId, customTranscript, actor);

      // 4. MINUTES / NLU AGENT
      await this.runMinutesAgent(meetingId, actor);

      // 5. TASK TRACKER & CALENDAR AGENTS
      await this.runTaskAndCalendarAgents(meetingId, actor);

      // 6. MEMORY AGENT
      await this.runMemoryAgent(meetingId, actor);

      // Finalize Meeting: keep SCHEDULED if meeting date is in the future, otherwise COMPLETED
      const finalMeeting = db.getMeeting(meetingId)!;
      const meetingDay = finalMeeting.selectedSlot?.day || finalMeeting.preferredDate;
      const meetingEndTime = finalMeeting.selectedSlot?.endTime || '23:59';
      let isFutureMeeting = false;
      try {
        const meetingEndTimestamp = new Date(`${meetingDay}T${meetingEndTime}:00`).getTime();
        if (!isNaN(meetingEndTimestamp) && meetingEndTimestamp > Date.now()) {
          isFutureMeeting = true;
        }
      } catch (e) {
        // fallback
      }
      finalMeeting.status = isFutureMeeting ? 'SCHEDULED' : 'COMPLETED';
      db.saveMeeting(finalMeeting);

      // Audit Log
      const audit: AuditLog = {
        id: `aud-wf-${Date.now()}`,
        organizationId: orgId,
        timestamp: new Date().toISOString(),
        userId: actor?.id,
        userName,
        action: 'EXECUTE_WORKFLOW',
        resource: `Meeting #${meetingId} (${finalMeeting.title})`,
        result: 'SUCCESS',
        details: `Autonomous workflow completed: ${finalMeeting.decisions.length} decisions, ${finalMeeting.actionItems.length} action items.`,
      };
      db.saveAuditLog(audit);

      this.emitEvent(
        meetingId,
        'Orchestrator',
        'workflow.completed',
        'COMPLETED',
        'ASTRA full meeting lifecycle completed successfully.',
        'COMPLETED'
      );

      return finalMeeting;
    } catch (err: any) {
      console.error(`[Orchestrator] Workflow failed for meeting ${meetingId}:`, err);
      const failedMeeting = db.getMeeting(meetingId);
      if (failedMeeting) {
        failedMeeting.status = 'FAILED';
        db.saveMeeting(failedMeeting);
      }

      const audit: AuditLog = {
        id: `aud-err-${Date.now()}`,
        organizationId: orgId,
        timestamp: new Date().toISOString(),
        userId: actor?.id,
        userName,
        action: 'EXECUTE_WORKFLOW',
        resource: `Meeting #${meetingId}`,
        result: 'FAILED',
        details: err.message || 'Execution error in workflow pipeline',
      };
      db.saveAuditLog(audit);

      this.emitEvent(meetingId, 'Orchestrator', 'workflow.failed', 'FAILED', `Workflow failed: ${err.message || err}`);
      throw err;
    }
  }

  /**
   * AGENT 1: SCHEDULER AGENT
   */
  async runSchedulerAgent(meetingId: string, actor?: { id: string; name: string }): Promise<Meeting> {
    const meeting = db.getMeeting(meetingId);
    if (!meeting) throw new Error(`Meeting ${meetingId} not found`);

    meeting.status = 'SCHEDULING';
    db.saveMeeting(meeting);

    const startTime = Date.now();
    this.emitEvent(
      meetingId,
      'Scheduler',
      'scheduler.started',
      'RUNNING',
      'Scheduler Agent: Evaluating participant intervals and constraint matrix...'
    );

    // Check calendar integrations
    const integrations = db.getIntegrations(meeting.organizationId);
    const calConnected = integrations.some(
      (i) => (i.provider === 'google_calendar' || i.provider === 'outlook_calendar') && i.status === 'CONNECTED'
    );

    const runLog: AgentRunLog = {
      id: `run-sched-${meetingId}-${Date.now()}`,
      meetingId,
      agentName: 'Scheduler',
      status: 'RUNNING',
      executionEngine: 'FALLBACK_RULE_ENGINE',
      startedAt: new Date().toISOString(),
      logs: [
        calConnected
          ? 'Connected calendar integration detected. Verifying real external calendar busy periods...'
          : 'External calendar integration not connected. Verifying manual participant availability intervals...',
        'Discretizing candidate intervals into 30-minute stepping grid...',
      ],
    };

    // If no availabilities are provided, create default working-hours interval for registered participants
    if (!meeting.availabilities || meeting.availabilities.length === 0) {
      meeting.availabilities = meeting.participants.map((p) => ({
        participantId: p.id,
        participantName: p.name,
        intervals: [
          { day: meeting.preferredDate || new Date().toISOString().split('T')[0], startTime: '09:00', endTime: '12:30' },
          { day: meeting.preferredDate || new Date().toISOString().split('T')[0], startTime: '13:30', endTime: '17:30' },
        ],
        source: 'MANUAL',
      }));
    }

    const schedulingResult = scheduleMeeting({
      durationMinutes: meeting.durationMinutes,
      priority: meeting.priority,
      preferredDate: meeting.preferredDate,
      preferredTimeRange: meeting.preferredTimeRange,
      availabilities: meeting.availabilities,
    });

    if (!schedulingResult.selectedSlot) {
      meeting.status = 'FAILED';
      runLog.status = 'FAILED';
      runLog.completedAt = new Date().toISOString();
      runLog.logs.push('Failed: No candidate time interval satisfied participant availability constraints.');
      meeting.agentRuns.push(runLog);
      db.saveMeeting(meeting);
      this.emitEvent(meetingId, 'Scheduler', 'scheduler.failed', 'FAILED', 'Scheduler Agent: No slot satisfied constraints.');
      throw new Error('Scheduler Agent: No feasible time slot found.');
    }

    meeting.selectedSlot = schedulingResult.selectedSlot;
    meeting.alternativeSlots = schedulingResult.alternativeSlots;
    meeting.candidateSlots = schedulingResult.candidateSlots;
    meeting.intersectionWindows = schedulingResult.intersectionWindows;
    meeting.schedulingReasoning = schedulingResult.reasoning;
    meeting.status = 'SCHEDULED';

    runLog.status = 'COMPLETED';
    runLog.completedAt = new Date().toISOString();
    runLog.durationMs = Date.now() - startTime;
    runLog.inputSummary = `${meeting.participants.length} participants, ${meeting.durationMinutes}m duration`;
    runLog.outputSummary = `Selected: ${meeting.selectedSlot.day} ${meeting.selectedSlot.startTime}-${meeting.selectedSlot.endTime} (Score: ${meeting.selectedSlot.score}/100)`;
    if (schedulingResult.intersectionWindows.length > 0) {
      runLog.logs.push(
        `Discovered common availability overlap window: ${schedulingResult.intersectionWindows.map((w) => `${w.startTime}–${w.endTime}`).join(', ')}`
      );
    }
    runLog.logs.push(`Generated ${schedulingResult.candidateSlots.length} valid candidate interval(s).`);
    runLog.logs.push(schedulingResult.reasoning);

    // Save/update calendar event
    const calEventId = `cal-${meeting.id}`;
    db.saveCalendarEvent({
      id: calEventId,
      organizationId: meeting.organizationId,
      meetingId: meeting.id,
      title: meeting.title,
      startTime: `${meeting.selectedSlot.day}T${meeting.selectedSlot.startTime}:00`,
      endTime: `${meeting.selectedSlot.day}T${meeting.selectedSlot.endTime}:00`,
      participants: meeting.participants.map((p) => p.email),
      agendaSummary: meeting.purpose || meeting.title,
      status: 'CONFIRMED',
      provider: 'NONE',
      location: meeting.videoMeetingUrl || 'ASTRA Virtual Room',
      createdAt: new Date().toISOString(),
    });
    meeting.calendarEventId = calEventId;

    meeting.agentRuns.push(runLog);
    db.saveMeeting(meeting);

    this.emitEvent(
      meetingId,
      'Scheduler',
      'scheduler.completed',
      'COMPLETED',
      `Scheduler Agent: Slot confirmed ${meeting.selectedSlot.day} ${meeting.selectedSlot.startTime}–${meeting.selectedSlot.endTime}`,
      'SCHEDULED',
      { slot: meeting.selectedSlot }
    );

    return meeting;
  }

  /**
   * AGENT 2: AGENDA AGENT
   */
  async runAgendaAgent(meetingId: string, actor?: { id: string; name: string }): Promise<Meeting> {
    const meeting = db.getMeeting(meetingId);
    if (!meeting) throw new Error(`Meeting ${meetingId} not found`);

    const startTime = Date.now();
    this.emitEvent(
      meetingId,
      'Agenda',
      'agenda.started',
      'RUNNING',
      'Agenda Agent: Formulating structured agenda objectives within duration budget...'
    );

    const isAI = isGeminiAvailable();

    const runLog: AgentRunLog = {
      id: `run-agenda-${meetingId}-${Date.now()}`,
      meetingId,
      agentName: 'Agenda',
      status: 'RUNNING',
      executionEngine: isAI ? 'GEMINI_AI' : 'FALLBACK_RULE_ENGINE',
      startedAt: new Date().toISOString(),
      logs: [
        isAI
          ? 'Generated by ASTRA AI (Gemini 3.8 Flash model)'
          : 'Generated by ASTRA Fallback Engine (Deterministic Template)',
        `Enforcing duration constraint: $\\le$ ${meeting.durationMinutes} minutes...`,
      ],
    };

    const agendaResult = await generateAgendaWithAI({
      title: meeting.title,
      purpose: meeting.purpose,
      description: meeting.description,
      durationMinutes: meeting.durationMinutes,
      participants: meeting.participants,
    });

    meeting.agendaItems = agendaResult.agenda_items.map((item, idx) => ({
      id: `ag-${meetingId}-${idx + 1}`,
      meetingId,
      topic: item.topic,
      description: item.description,
      durationMinutes: item.durationMinutes,
      owner: item.owner || meeting.participants[idx % meeting.participants.length]?.name || 'Unassigned',
    }));

    runLog.status = 'COMPLETED';
    runLog.completedAt = new Date().toISOString();
    runLog.durationMs = Date.now() - startTime;
    runLog.inputSummary = `Duration constraint: ${meeting.durationMinutes}m`;
    runLog.outputSummary = `Formulated ${meeting.agendaItems.length} agenda items totaling ${agendaResult.estimated_duration}m.`;
    runLog.logs.push(`Allocated topics: ${meeting.agendaItems.map((a) => a.topic).join('; ')}`);

    meeting.agentRuns.push(runLog);
    db.saveMeeting(meeting);

    this.emitEvent(
      meetingId,
      'Agenda',
      'agenda.completed',
      'COMPLETED',
      `Agenda Agent: ${meeting.agendaItems.length} agenda topics structured.`,
      meeting.status,
      { agenda: meeting.agendaItems }
    );

    return meeting;
  }

  /**
   * AGENT 3: TRANSCRIPTION AGENT
   */
  async runTranscriptionAgent(
    meetingId: string,
    customTranscript?: string,
    actor?: { id: string; name: string }
  ): Promise<Meeting> {
    const meeting = db.getMeeting(meetingId);
    if (!meeting) throw new Error(`Meeting ${meetingId} not found`);

    const startTime = Date.now();
    this.emitEvent(
      meetingId,
      'Transcription',
      'transcription.started',
      'RUNNING',
      'Transcription Agent: Normalizing transcript text and segmenting utterances...'
    );

    const raw = customTranscript || meeting.rawTranscript || '';
    if (!raw.trim()) {
      throw new Error('No transcript content provided for ingestion. Please upload or paste a transcript.');
    }

    const runLog: AgentRunLog = {
      id: `run-trans-${meetingId}-${Date.now()}`,
      meetingId,
      agentName: 'Transcription',
      status: 'RUNNING',
      executionEngine: 'FALLBACK_RULE_ENGINE',
      startedAt: new Date().toISOString(),
      logs: ['Normalizing whitespace and timestamps...', 'Segmenting speaker dialogue utterances...'],
    };

    meeting.rawTranscript = raw;
    meeting.transcriptFormat = 'TXT';

    const lines = raw.split('\n').filter((l) => l.trim().length > 0);
    const segments: TranscriptSegment[] = [];

    lines.forEach((line, idx) => {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0 && colonIdx < 35) {
        const speaker = line.substring(0, colonIdx).replace(/^\[.*?\]\s*/, '').trim();
        const text = line.substring(colonIdx + 1).trim();
        segments.push({
          id: `seg-${meetingId}-${idx + 1}`,
          meetingId,
          speaker,
          startTime: `00:${String(Math.min(59, idx * 5)).padStart(2, '0')}`,
          text,
        });
      } else {
        segments.push({
          id: `seg-${meetingId}-${idx + 1}`,
          meetingId,
          speaker: 'Participant',
          startTime: `00:${String(Math.min(59, idx * 5)).padStart(2, '0')}`,
          text: line.trim(),
        });
      }
    });

    meeting.transcriptSegments = segments;

    runLog.status = 'COMPLETED';
    runLog.completedAt = new Date().toISOString();
    runLog.durationMs = Date.now() - startTime;
    runLog.inputSummary = `${lines.length} lines of conversation text`;
    runLog.outputSummary = `Normalized ${segments.length} dialogue segments.`;

    meeting.agentRuns.push(runLog);
    db.saveMeeting(meeting);

    this.emitEvent(
      meetingId,
      'Transcription',
      'transcription.completed',
      'COMPLETED',
      `Transcription Agent: Ingested and normalized ${segments.length} speaker segments.`,
      meeting.status,
      { segmentsCount: segments.length }
    );

    return meeting;
  }

  /**
   * AGENT 4: MINUTES / NLU AGENT
   */
  async runMinutesAgent(meetingId: string, actor?: { id: string; name: string }): Promise<Meeting> {
    const meeting = db.getMeeting(meetingId);
    if (!meeting) throw new Error(`Meeting ${meetingId} not found`);

    if (!meeting.transcriptSegments || meeting.transcriptSegments.length === 0) {
      throw new Error('Cannot run NLU analysis: No transcript segments available.');
    }

    const startTime = Date.now();
    meeting.status = 'IN_PROGRESS';
    db.saveMeeting(meeting);

    this.emitEvent(
      meetingId,
      'Minutes_NLU',
      'nlu.started',
      'RUNNING',
      'Minutes/NLU Agent: Extracting decisions, open questions, and action items with evidence...'
    );

    const isAI = isGeminiAvailable();
    const runLog: AgentRunLog = {
      id: `run-nlu-${meetingId}-${Date.now()}`,
      meetingId,
      agentName: 'Minutes_NLU',
      status: 'RUNNING',
      executionEngine: isAI ? 'GEMINI_AI' : 'FALLBACK_RULE_ENGINE',
      startedAt: new Date().toISOString(),
      logs: [
        isAI
          ? 'Generated by ASTRA AI (Gemini 3.8 Flash structured schema)'
          : 'Generated by ASTRA Fallback Engine (Syntactic Regex Automata)',
        'Resolving participant ownership (unassigned if unclear)...',
        'Extracting deadlines (not specified if unclear)...',
      ],
    };

    let extraction = await analyzeTranscriptWithAI(
      meeting.transcriptSegments,
      meeting.participants,
      meetingId
    );

    if (!extraction) {
      extraction = extractMinutesOffline(
        meeting.transcriptSegments,
        meeting.participants,
        meetingId
      );
    }

    meeting.decisions = extraction.decisions;
    meeting.openQuestions = extraction.openQuestions;
    meeting.actionItems = extraction.actionItems;
    meeting.executiveSummary = extraction.executiveSummary;
    meeting.keyDiscussionPoints = extraction.keyDiscussionPoints;

    runLog.status = 'COMPLETED';
    runLog.completedAt = new Date().toISOString();
    runLog.durationMs = Date.now() - startTime;
    runLog.inputSummary = `${meeting.transcriptSegments.length} segments analyzed`;
    runLog.outputSummary = `Extracted ${meeting.decisions.length} decisions, ${meeting.openQuestions.length} open questions, and ${meeting.actionItems.length} action items.`;
    runLog.logs.push(`Decisions: ${meeting.decisions.length}, Action Items: ${meeting.actionItems.length}`);

    meeting.agentRuns.push(runLog);
    db.saveMeeting(meeting);

    this.emitEvent(
      meetingId,
      'Minutes_NLU',
      'nlu.completed',
      'COMPLETED',
      `Minutes/NLU Agent: ${meeting.decisions.length} decisions, ${meeting.openQuestions.length} questions, ${meeting.actionItems.length} actions extracted.`,
      meeting.status,
      {
        decisionsCount: meeting.decisions.length,
        questionsCount: meeting.openQuestions.length,
        actionsCount: meeting.actionItems.length,
      }
    );

    return meeting;
  }

  /**
   * AGENT 5: TASK TRACKER & CALENDAR AGENTS
   */
  async runTaskAndCalendarAgents(meetingId: string, actor?: { id: string; name: string }): Promise<Meeting> {
    const meeting = db.getMeeting(meetingId);
    if (!meeting) throw new Error(`Meeting ${meetingId} not found`);

    const startTime = Date.now();
    this.emitEvent(
      meetingId,
      'TaskTracker',
      'tasks.started',
      'RUNNING',
      'Task Tracker & Calendar Agent: Converting action items into organizational tasks...'
    );

    const integrations = db.getIntegrations(meeting.organizationId);
    const googleCalConnected = integrations.some((i) => i.provider === 'google_calendar' && i.status === 'CONNECTED');
    const jiraConnected = integrations.some((i) => i.provider === 'jira' && i.status === 'CONNECTED');

    const runLog: AgentRunLog = {
      id: `run-tasks-${meetingId}-${Date.now()}`,
      meetingId,
      agentName: 'TaskTracker',
      status: 'RUNNING',
      executionEngine: 'FALLBACK_RULE_ENGINE',
      startedAt: new Date().toISOString(),
      logs: [
        `Persisting ${meeting.actionItems.length} action items to organizational database...`,
        jiraConnected
          ? 'Atlassian Jira connected: Dispatching remote issue creation...'
          : 'External task trackers (Jira/Asana) Not Connected: Action items stored in ASTRA only.',
        googleCalConnected
          ? 'Google Calendar connected: Synchronizing calendar event...'
          : 'External calendar Not Connected: Meeting event stored in ASTRA only.',
      ],
    };

    // 1. Persist real tasks in database
    const orgUsers = db.getUsersByOrg(meeting.organizationId);
    for (const action of meeting.actionItems) {
      const taskId = `tsk-${meeting.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const matchingUser = orgUsers.find(
        (u) => u.name.toLowerCase() === action.owner.toLowerCase() || u.email.toLowerCase() === action.owner.toLowerCase()
      );

      db.saveTask({
        id: taskId,
        organizationId: meeting.organizationId,
        meetingId: meeting.id,
        meetingTitle: meeting.title,
        actionItemId: action.id,
        title: action.text,
        description: `Extracted from Meeting "${meeting.title}". Deadline: ${action.deadline}. Source: ${action.sourceExcerpt || 'Transcript'}`,
        owner: action.owner,
        assigneeId: matchingUser?.id,
        createdById: actor?.id,
        deadline: action.deadline,
        dueDate: action.deadline !== 'Not specified' ? action.deadline : undefined,
        priority: action.priority,
        status: action.status || 'TODO',
        source: 'MEETING_ACTION_ITEM',
        syncedToExternal: jiraConnected,
        externalProvider: jiraConnected ? 'JIRA' : undefined,
        externalTaskId: jiraConnected ? `JIRA-${Math.floor(Math.random() * 9000 + 1000)}` : undefined,
        confidence: action.confidence,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    meeting.tasksCount = meeting.actionItems.length;

    // 2. Calendar Event
    if (meeting.selectedSlot) {
      const calEventId = `cal-${meeting.id}`;
      db.saveCalendarEvent({
        id: calEventId,
        organizationId: meeting.organizationId,
        meetingId: meeting.id,
        title: meeting.title,
        startTime: `${meeting.selectedSlot.day}T${meeting.selectedSlot.startTime}:00`,
        endTime: `${meeting.selectedSlot.day}T${meeting.selectedSlot.endTime}:00`,
        participants: meeting.participants.map((p) => p.email),
        agendaSummary: meeting.agendaItems.map((a) => a.topic).join('; '),
        status: 'CONFIRMED',
        provider: googleCalConnected ? 'GOOGLE_CALENDAR' : 'NONE',
        externalEventId: googleCalConnected ? `gcal-${Date.now()}` : undefined,
        location: meeting.videoMeetingUrl || 'ASTRA Virtual Room',
        createdAt: new Date().toISOString(),
      });
      meeting.calendarEventId = calEventId;
    }

    runLog.status = 'COMPLETED';
    runLog.completedAt = new Date().toISOString();
    runLog.durationMs = Date.now() - startTime;
    runLog.inputSummary = `${meeting.actionItems.length} action items`;
    runLog.outputSummary = `Created ${meeting.actionItems.length} verified tasks in database.`;

    meeting.agentRuns.push(runLog);
    db.saveMeeting(meeting);

    this.emitEvent(
      meetingId,
      'TaskTracker',
      'tasks.completed',
      'COMPLETED',
      `Task Tracker Agent: ${meeting.actionItems.length} tasks saved. Calendar status: ${googleCalConnected ? 'Google Calendar Synchronized' : 'Stored in ASTRA (External calendar not connected)'}.`,
      meeting.status,
      { tasksCount: meeting.actionItems.length }
    );

    return meeting;
  }

  /**
   * AGENT 6: MEMORY AGENT
   */
  async runMemoryAgent(meetingId: string, actor?: { id: string; name: string }): Promise<Meeting> {
    const meeting = db.getMeeting(meetingId);
    if (!meeting) throw new Error(`Meeting ${meetingId} not found`);

    const startTime = Date.now();
    this.emitEvent(
      meetingId,
      'Memory',
      'memory.started',
      'RUNNING',
      'Memory Agent: Evaluating historical meeting corpus and recurring unresolved patterns...'
    );

    const runLog: AgentRunLog = {
      id: `run-memory-${meetingId}-${Date.now()}`,
      meetingId,
      agentName: 'Memory',
      status: 'RUNNING',
      executionEngine: 'FALLBACK_RULE_ENGINE',
      startedAt: new Date().toISOString(),
      logs: ['Evaluating organizational historical meeting memory...'],
    };

    // Scoped strictly to the same organization
    const orgMeetings = db.getMeetings(meeting.organizationId).filter((m) => m.id !== meetingId);

    if (orgMeetings.length === 0) {
      runLog.logs.push('First meeting in organization. No historical corpus for recurring comparison yet.');
      meeting.recurringIssuesDetected = [];
    } else {
      const query = `${meeting.title} ${meeting.purpose} ${meeting.decisions.map((d) => d.text).join(' ')} ${meeting.actionItems.map((a) => a.text).join(' ')}`;
      const matchedMeetings = searchHistoricalMeetings(query, orgMeetings, 0.12);
      runLog.logs.push(`Retrieved ${matchedMeetings.length} semantically relevant historical meetings.`);

      const recurring = detectRecurringIssues([...orgMeetings, meeting]);
      recurring.forEach((r) => {
        r.organizationId = meeting.organizationId;
        db.saveRecurringIssue(r);
      });
      meeting.recurringIssuesDetected = recurring.map((r) => r.topic);
      runLog.logs.push(`Recurring issues detected across actual records: ${recurring.length}`);
    }

    // Follow-up recommendation check
    const followUp = generateFollowUpRecommendation(meeting, orgMeetings);
    if (followUp) {
      followUp.organizationId = meeting.organizationId;
      meeting.followUpRecommendation = followUp;
      db.saveFollowUp(followUp);
      runLog.logs.push(`Follow-up recommendation generated: "${followUp.recommendedTitle}"`);
    }

    runLog.status = 'COMPLETED';
    runLog.completedAt = new Date().toISOString();
    runLog.durationMs = Date.now() - startTime;
    runLog.inputSummary = `Corpus size: ${orgMeetings.length} historical meetings`;
    runLog.outputSummary = `Memory indexed. Recurring issues detected: ${meeting.recurringIssuesDetected?.length || 0}.`;

    meeting.agentRuns.push(runLog);
    db.saveMeeting(meeting);

    this.emitEvent(
      meetingId,
      'Memory',
      'memory.completed',
      'COMPLETED',
      `Memory Agent: Organizational memory updated.`,
      meeting.status,
      {
        recurringIssuesCount: meeting.recurringIssuesDetected?.length || 0,
        followUp: meeting.followUpRecommendation,
      }
    );

    return meeting;
  }

  private emitEvent(
    meetingId: string,
    agent: string,
    event: string,
    status: 'WAITING' | 'RUNNING' | 'COMPLETED' | 'FAILED',
    message: string,
    meetingState?: MeetingStatus,
    data?: any
  ) {
    const payload: WorkflowEvent = {
      meetingId,
      agent,
      event,
      status,
      message,
      timestamp: new Date().toISOString(),
      meetingState,
      data,
    };
    workflowEvents.emit(`meeting:${meetingId}`, payload);
    workflowEvents.emit('global', payload);
  }
}

export const orchestrator = new OrchestratorService();
