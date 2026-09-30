import {
  AuditLog,
  AutonomySettings,
  CalendarEvent,
  DashboardStats,
  Integration,
  Meeting,
  MeetingSlot,
  Organization,
  ParticipantAvailability,
  Task,
  TaskPriority,
  TaskStatus,
  TimeInterval,
  User,
} from './types.ts';

const API_BASE = '/api';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('astra_auth_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export interface AuthResponse {
  user: User;
  organization: Organization;
  token?: string;
  isDemoSandbox?: boolean;
  message?: string;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  emailSent: boolean;
  emailDeliveryStatus: string;
  emailProviderConfigured: boolean;
  email: string;
  devVerificationUrl?: string;
}

// --- AUTHENTICATION ---

export async function registerUser(payload: {
  name: string;
  email: string;
  password: string;
  confirmPassword?: string;
  organizationName?: string;
}): Promise<RegisterResponse> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Registration failed');
  return data;
}

export async function verifyEmail(token: string): Promise<{ success: boolean; message: string; email?: string }> {
  const res = await fetch(`${API_BASE}/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ token }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Verification failed');
  return data;
}

export async function resendVerificationEmail(email: string): Promise<{
  success: boolean;
  message: string;
  emailSent: boolean;
  devVerificationUrl?: string;
}> {
  const res = await fetch(`${API_BASE}/auth/resend-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to resend verification email');
  return data;
}

export async function loginUser(payload: { email: string; password: string }): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    const error: any = new Error(data.error || 'Login failed');
    error.emailUnverified = data.emailUnverified;
    error.email = data.email;
    throw error;
  }
  if (data.token) {
    localStorage.setItem('astra_auth_token', data.token);
  }
  return data;
}

export async function fetchCurrentUser(): Promise<{ user: User; organization: Organization }> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Not authenticated');
  return res.json();
}

export async function logoutUser(): Promise<void> {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
    });
  } catch (err) {
    console.warn('Logout API error:', err);
  } finally {
    localStorage.removeItem('astra_auth_token');
  }
}

export async function enterDemoSandbox(): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/demo/enter`, {
    method: 'POST',
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to enter demo sandbox');
  if (data.token) {
    localStorage.setItem('astra_auth_token', data.token);
  }
  return data;
}

// --- SYSTEM & DASHBOARD ---

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

export async function fetchDashboardData(): Promise<{
  stats: DashboardStats;
  upcomingMeetings: Meeting[];
  recentMeetings: Meeting[];
  myTasks: Task[];
  openQuestions: any[];
  recentDecisions: any[];
  recurringIssues: any[];
}> {
  const res = await fetch(`${API_BASE}/dashboard`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch dashboard data');
  return res.json();
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await fetch(`${API_BASE}/dashboard/stats`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch dashboard stats');
  return res.json();
}

export async function fetchAnalytics(): Promise<{
  hasData: boolean;
  message?: string;
  totalMeetings?: number;
  completedMeetings?: number;
  averageMeetingDuration?: number;
  actionItemsCreated?: number;
  actionCompletionRate?: number;
  recurringIssuesCount?: number;
}> {
  const res = await fetch(`${API_BASE}/analytics`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch analytics');
  return res.json();
}

// --- USERS & PARTICIPANTS ---

export async function fetchOrganizationUsers(): Promise<User[]> {
  const res = await fetch(`${API_BASE}/users`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch organization users');
  return res.json();
}

export async function fetchParticipants(): Promise<{ id: string; userId?: string; name: string; email: string; role: string }[]> {
  try {
    const users = await fetchOrganizationUsers();
    return users.map((u) => ({
      id: u.id,
      userId: u.id,
      name: u.name,
      email: u.email,
      role: u.role || 'Member',
    }));
  } catch {
    return [];
  }
}

// --- MEETINGS ---

export async function fetchMeetings(): Promise<Meeting[]> {
  const res = await fetch(`${API_BASE}/meetings`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch meetings');
  return res.json();
}

export async function fetchMeeting(id: string): Promise<Meeting> {
  const res = await fetch(`${API_BASE}/meetings/${id}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Meeting #${id} not found`);
  return res.json();
}

export async function createMeeting(payload: Partial<Meeting>): Promise<Meeting> {
  const res = await fetch(`${API_BASE}/meetings`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create meeting');
  return data;
}

export async function fetchCandidateSlots(payload: {
  durationMinutes: number;
  priority: TaskPriority;
  preferredDate: string;
  preferredTimeRange?: string;
  availabilities: ParticipantAvailability[];
  constraints?: string[];
}): Promise<{
  selectedSlot: MeetingSlot | null;
  candidateSlots: MeetingSlot[];
  alternativeSlots: MeetingSlot[];
  intersectionWindows: TimeInterval[];
  reasoning: string;
  hasConflicts: boolean;
}> {
  const res = await fetch(`${API_BASE}/scheduler/candidate-slots`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch candidate slots');
  return data;
}

export async function deleteMeeting(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/meetings/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete meeting');
}

export async function runMeetingWorkflow(meetingId: string, customTranscript?: string): Promise<Meeting> {
  const res = await fetch(`${API_BASE}/meetings/${meetingId}/run`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ customTranscript }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Workflow execution failed');
  return data;
}

export async function runIndividualAgent(meetingId: string, agentKey: string): Promise<Meeting> {
  const endpointMap: Record<string, string> = {
    Scheduler: 'schedule',
    Agenda: 'agenda',
    Transcription: 'transcript',
    Minutes_NLU: 'analyze',
    TaskTracker: 'tasks/sync',
    Memory: 'memory/process',
  };
  const sub = endpointMap[agentKey] || 'schedule';
  const res = await fetch(`${API_BASE}/meetings/${meetingId}/${sub}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Agent ${agentKey} execution failed`);
  }
  return res.json();
}

export async function loadSampleMeeting(): Promise<Meeting> {
  const res = await fetch(`${API_BASE}/demo/sample-meeting`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to load sample demo meeting');
  }
  return res.json();
}

export async function resetDemoData(): Promise<void> {
  const res = await fetch(`${API_BASE}/demo/reset`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to reset demo data');
  }
}

export async function fetchMinutesMarkdown(meetingId: string): Promise<{ meeting: Meeting; markdown: string }> {
  const res = await fetch(`${API_BASE}/meetings/${meetingId}/minutes`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch minutes markdown');
  return res.json();
}

// --- TASKS ---

export async function fetchTasks(
  filtersOrStatus?: string | { status?: string; owner?: string; assigneeId?: string; search?: string },
  legacyOwner?: string
): Promise<Task[]> {
  const params = new URLSearchParams();

  if (typeof filtersOrStatus === 'string') {
    if (filtersOrStatus && filtersOrStatus !== 'ALL') params.append('status', filtersOrStatus);
    if (legacyOwner) params.append('owner', legacyOwner);
  } else if (filtersOrStatus && typeof filtersOrStatus === 'object') {
    if (filtersOrStatus.status && filtersOrStatus.status !== 'ALL') params.append('status', filtersOrStatus.status);
    if (filtersOrStatus.owner) params.append('owner', filtersOrStatus.owner);
    if (filtersOrStatus.assigneeId) params.append('assigneeId', filtersOrStatus.assigneeId);
    if (filtersOrStatus.search) params.append('search', filtersOrStatus.search);
  }

  const query = params.toString();
  const url = query ? `${API_BASE}/tasks?${query}` : `${API_BASE}/tasks`;
  const res = await fetch(url, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch tasks');
  return res.json();
}

export async function fetchTask(taskId: string): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Task #${taskId} not found`);
  return res.json();
}

export async function createTask(payload: {
  title: string;
  description?: string;
  assigneeId?: string;
  dueDate?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  meetingId?: string;
  source?: 'MANUAL' | 'MEETING_ACTION_ITEM';
}): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create task');
  return data;
}

export async function updateTask(taskId: string, payload: Partial<Task>): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update task');
  return data;
}

export async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<Task> {
  return updateTask(taskId, { status });
}

export async function deleteTask(taskId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete task');
}

// --- INTEGRATIONS ---

export async function fetchIntegrations(): Promise<Integration[]> {
  const res = await fetch(`${API_BASE}/integrations`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch integrations');
  return res.json();
}

export async function connectIntegration(provider: string, accountEmail?: string): Promise<Integration> {
  const res = await fetch(`${API_BASE}/integrations/${provider}/connect`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ accountEmail }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to connect integration');
  return data.integration;
}

export async function disconnectIntegration(provider: string): Promise<Integration> {
  const res = await fetch(`${API_BASE}/integrations/${provider}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to disconnect integration');
  return data.integration;
}

// --- CALENDAR ---

export async function fetchCalendarEvents(): Promise<{
  events: CalendarEvent[];
  meetings?: Meeting[];
  tasks?: Task[];
  users?: { id: string; name: string; email: string; role: string }[];
  isCalendarConnected: boolean;
  connectedProvider: string | null;
}> {
  const res = await fetch(`${API_BASE}/calendar`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch calendar');
  return res.json();
}

export async function createCalendarEvent(payload: Partial<CalendarEvent>): Promise<CalendarEvent> {
  const res = await fetch(`${API_BASE}/calendar/events`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create calendar event');
  return data;
}

// --- MEMORY ---

export async function fetchMemory(): Promise<{
  totalHistoricalMeetings: number;
  recurringIssues: any[];
  followUps: any[];
  recentDecisions: any[];
  unresolvedQuestions: any[];
}> {
  const res = await fetch(`${API_BASE}/memory`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch memory');
  return res.json();
}

export async function searchMemory(query: string): Promise<{
  query: string;
  resultsCount: number;
  matches: Array<{ meeting: Meeting; similarityScore: number; matchedKeywords: string[] }>;
  message?: string;
}> {
  const res = await fetch(`${API_BASE}/memory/search`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error('Failed to search memory');
  return res.json();
}

// --- AUDIT LOGS & SETTINGS ---

export async function fetchAuditLogs(): Promise<AuditLog[]> {
  const res = await fetch(`${API_BASE}/audit-log`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch audit log');
  return res.json();
}

export async function fetchAutonomySettings(): Promise<AutonomySettings> {
  const res = await fetch(`${API_BASE}/settings/autonomy`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch autonomy settings');
  return res.json();
}

export async function updateAutonomySettings(payload: Partial<AutonomySettings>): Promise<AutonomySettings> {
  const res = await fetch(`${API_BASE}/settings/autonomy`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update autonomy settings');
  return res.json();
}
