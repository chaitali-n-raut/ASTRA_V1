export type UserRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: 'FREE' | 'ENTERPRISE';
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: UserRole;
  emailVerified?: boolean;
  emailVerifiedAt?: string;
  status?: 'ACTIVE' | 'PENDING_VERIFICATION' | 'SUSPENDED';
  avatar?: string;
  title?: string;
  department?: string;
  createdAt: string;
  updatedAt: string;
}

export type MeetingStatus =
  | 'DRAFT'
  | 'SCHEDULING'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | 'CRITICAL';
export type TaskSource = 'MANUAL' | 'MEETING_ACTION_ITEM';
export type MeetingType = 'INTERNAL' | 'CLIENT' | 'INTERVIEW' | 'PROJECT' | 'REVIEW' | 'PLANNING' | 'OTHER';

export interface Participant {
  id: string;
  userId?: string;
  name: string;
  email: string;
  role: string;
  isOrganizer?: boolean;
  avatar?: string;
}

export interface TimeInterval {
  day: string;
  startTime: string;
  endTime: string;
}

export interface ParticipantAvailability {
  participantId: string;
  participantName: string;
  intervals: TimeInterval[];
  source: 'MANUAL' | 'CALENDAR_SYNC';
}

export interface MeetingSlot {
  day: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  availableParticipantIds: string[];
  conflictParticipantIds: string[];
  score: number;
  reasoning: string;
}

export interface AgendaItem {
  id: string;
  meetingId: string;
  topic: string;
  description: string;
  durationMinutes: number;
  owner?: string;
}

export interface TranscriptSegment {
  id: string;
  meetingId: string;
  speaker: string;
  startTime?: string;
  endTime?: string;
  text: string;
}

export interface Decision {
  id: string;
  meetingId: string;
  text: string;
  context?: string;
  confidence: number;
  rationale?: string;
  sourceTimestamp?: string;
  sourceExcerpt?: string;
}

export interface OpenQuestion {
  id: string;
  meetingId: string;
  question: string;
  askedBy?: string;
  addressedTo?: string;
  status: 'UNRESOLVED' | 'RESOLVED';
  confidence: number;
  sourceTimestamp?: string;
  sourceExcerpt?: string;
}

export interface ActionItem {
  id: string;
  meetingId: string;
  text: string;
  owner: string;
  deadline: string;
  priority: TaskPriority;
  confidence: number;
  status: TaskStatus;
  sourceTimestamp?: string;
  sourceExcerpt?: string;
}

export interface Task {
  id: string;
  organizationId: string;
  meetingId?: string;
  meetingTitle?: string;
  actionItemId?: string;
  title: string;
  description: string;
  assigneeId?: string;
  owner: string;
  createdById?: string;
  dueDate?: string;
  deadline: string;
  priority: TaskPriority;
  status: TaskStatus;
  source: TaskSource;
  syncedToExternal: boolean;
  externalProvider?: 'JIRA' | 'ASANA' | 'LINEAR';
  externalTaskId?: string;
  confidence: number;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEvent {
  id: string;
  organizationId: string;
  meetingId: string;
  title: string;
  startTime: string;
  endTime: string;
  participants: string[];
  agendaSummary: string;
  status: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
  provider: 'NONE' | 'GOOGLE_CALENDAR' | 'OUTLOOK';
  externalEventId?: string;
  location?: string;
  createdAt: string;
}

export interface Integration {
  id: string;
  organizationId: string;
  provider:
    | 'google_calendar'
    | 'outlook_calendar'
    | 'zoom'
    | 'google_meet'
    | 'teams'
    | 'jira'
    | 'asana'
    | 'linear'
    | 'gmail';
  name: string;
  category: 'calendar' | 'video' | 'task' | 'email';
  status: 'NOT_CONNECTED' | 'CONNECTED' | 'ERROR';
  connectedAccount?: string;
  lastSyncedAt?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  organizationId: string;
  timestamp: string;
  userId?: string;
  userName: string;
  action: string;
  resource: string;
  result: 'SUCCESS' | 'FAILED' | 'PENDING';
  integration?: string;
  details?: string;
}

export interface AutonomySettings {
  organizationId: string;
  policy: 'MANUAL_APPROVAL' | 'APPROVAL_FOR_EXTERNAL' | 'FULLY_AUTONOMOUS';
  requireApprovalBeforeExternalSync: boolean;
  autoExtractTasks: boolean;
  autoDetectRecurringIssues: boolean;
  notifyOnRecurringIssue: boolean;
}

export interface RecurringIssue {
  id: string;
  organizationId: string;
  topic: string;
  description: string;
  occurrenceCount: number;
  meetingIds: string[];
  firstDetected: string;
  lastDetected: string;
  status: 'ACTIVE_UNRESOLVED' | 'MITIGATED' | 'RESOLVED';
  severity: 'MEDIUM' | 'HIGH' | 'CRITICAL';
  suggestedAction: string;
}

export interface FollowUpRecommendation {
  id: string;
  organizationId: string;
  sourceMeetingId: string;
  recommendedTitle: string;
  reason: string;
  proposedParticipants: string[];
  proposedTopics: string[];
  status: 'PENDING' | 'ACCEPTED' | 'DISMISSED';
}

export interface AgentRunLog {
  id: string;
  meetingId: string;
  agentName: 'Orchestrator' | 'Scheduler' | 'Agenda' | 'Transcription' | 'Minutes_NLU' | 'TaskTracker' | 'Memory';
  status: 'WAITING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  executionEngine: 'GEMINI_AI' | 'FALLBACK_RULE_ENGINE';
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  inputSummary?: string;
  outputSummary?: string;
  logs: string[];
}

export interface Meeting {
  id: string;
  organizationId: string;
  createdById?: string;
  title: string;
  purpose: string;
  description: string;
  meetingType: MeetingType;
  status: MeetingStatus;
  priority: TaskPriority;
  durationMinutes: number;
  preferredDate: string;
  preferredTimeRange: string;
  constraints?: string[];
  participants: Participant[];
  availabilities: ParticipantAvailability[];
  selectedSlot?: MeetingSlot;
  alternativeSlots?: MeetingSlot[];
  candidateSlots?: MeetingSlot[];
  intersectionWindows?: TimeInterval[];
  schedulingReasoning?: string;
  agendaItems: AgendaItem[];
  rawTranscript?: string;
  transcriptFormat?: 'TXT' | 'VTT' | 'SRT' | 'JSON';
  transcriptSegments: TranscriptSegment[];
  decisions: Decision[];
  openQuestions: OpenQuestion[];
  actionItems: ActionItem[];
  executiveSummary?: string;
  keyDiscussionPoints?: string[];
  videoProvider: 'NONE' | 'ZOOM' | 'GOOGLE_MEET' | 'TEAMS';
  videoMeetingUrl?: string;
  videoMeetingId?: string;
  calendarEventId?: string;
  tasksCount?: number;
  recurringIssuesDetected?: string[];
  followUpRecommendation?: FollowUpRecommendation;
  agentRuns: AgentRunLog[];
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalMeetings: number;
  upcomingMeetings: number;
  completedMeetings: number;
  openActionItems: number;
  completedTasks: number;
  recurringIssuesCount: number;
  openQuestionsCount: number;
  connectedIntegrationsCount: number;
  averageExtractionConfidence: number;
  engineMode: 'OFFLINE_NLP' | 'GEMINI_LLM';
}
