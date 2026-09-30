import fs from 'fs';
import path from 'path';
import {
  AuditLog,
  AutonomySettings,
  CalendarEvent,
  DashboardStats,
  FollowUpRecommendation,
  Integration,
  Meeting,
  Organization,
  RecurringIssue,
  Session,
  Task,
  TaskStatus,
  User,
  VerificationToken,
} from '../types.ts';
import { isGeminiAvailable } from '../services/gemini.ts';

const DB_FILE = path.resolve(process.cwd(), 'astra_production_db.json');

export interface DatabaseState {
  organizations: Record<string, Organization>;
  users: Record<string, User>;
  verificationTokens: Record<string, VerificationToken>;
  sessions: Record<string, Session>;
  meetings: Record<string, Meeting>;
  tasks: Record<string, Task>;
  calendarEvents: Record<string, CalendarEvent>;
  integrations: Record<string, Integration>;
  auditLogs: Record<string, AuditLog>;
  autonomySettings: Record<string, AutonomySettings>;
  recurringIssues: Record<string, RecurringIssue>;
  followUps: Record<string, FollowUpRecommendation>;
}

class Store {
  private state: DatabaseState = {
    organizations: {},
    users: {},
    verificationTokens: {},
    sessions: {},
    meetings: {},
    tasks: {},
    calendarEvents: {},
    integrations: {},
    auditLogs: {},
    autonomySettings: {},
    recurringIssues: {},
    followUps: {},
  };

  constructor() {
    this.loadFromFile();
  }

  private loadFromFile() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.state = {
          organizations: parsed.organizations || {},
          users: parsed.users || {},
          verificationTokens: parsed.verificationTokens || {},
          sessions: parsed.sessions || {},
          meetings: parsed.meetings || {},
          tasks: parsed.tasks || {},
          calendarEvents: parsed.calendarEvents || {},
          integrations: parsed.integrations || {},
          auditLogs: parsed.auditLogs || {},
          autonomySettings: parsed.autonomySettings || {},
          recurringIssues: parsed.recurringIssues || {},
          followUps: parsed.followUps || {},
        };
      }
    } catch (err) {
      console.warn('[DB Store] Starting with clean empty production state:', err);
    }
  }

  saveToFile() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (err) {
      console.error('[DB Store] Error persisting to astra_production_db.json:', err);
    }
  }

  clear() {
    this.state = {
      organizations: {},
      users: {},
      verificationTokens: {},
      sessions: {},
      meetings: {},
      tasks: {},
      calendarEvents: {},
      integrations: {},
      auditLogs: {},
      autonomySettings: {},
      recurringIssues: {},
      followUps: {},
    };
    this.saveToFile();
  }

  // --- Organizations ---
  getOrganization(id: string): Organization | undefined {
    return this.state.organizations[id];
  }

  saveOrganization(org: Organization) {
    this.state.organizations[org.id] = org;
    this.saveToFile();
  }

  // --- Users ---
  getUserById(id: string): User | undefined {
    return this.state.users[id];
  }

  getUserByEmail(email: string): User | undefined {
    const clean = email.toLowerCase().trim();
    return Object.values(this.state.users).find((u) => u.email.toLowerCase().trim() === clean);
  }

  getUsersByOrg(orgId: string): User[] {
    return Object.values(this.state.users).filter((u) => u.organizationId === orgId);
  }

  saveUser(user: User) {
    this.state.users[user.id] = user;
    this.saveToFile();
  }

  // --- Verification Tokens ---
  saveVerificationToken(token: VerificationToken) {
    this.state.verificationTokens[token.id] = token;
    this.saveToFile();
  }

  getVerificationTokenByHash(tokenHash: string): VerificationToken | undefined {
    return Object.values(this.state.verificationTokens).find((t) => t.tokenHash === tokenHash);
  }

  getVerificationTokensByUser(userId: string): VerificationToken[] {
    return Object.values(this.state.verificationTokens).filter((t) => t.userId === userId);
  }

  invalidateVerificationTokensForUser(userId: string) {
    let changed = false;
    for (const token of Object.values(this.state.verificationTokens)) {
      if (token.userId === userId && !token.usedAt) {
        token.usedAt = new Date().toISOString();
        changed = true;
      }
    }
    if (changed) {
      this.saveToFile();
    }
  }

  // --- Sessions ---
  saveSession(session: Session) {
    this.state.sessions[session.id] = session;
    this.saveToFile();
  }

  getSessionByToken(token: string): Session | undefined {
    return Object.values(this.state.sessions).find((s) => s.token === token);
  }

  invalidateSession(token: string) {
    let changed = false;
    for (const s of Object.values(this.state.sessions)) {
      if (s.token === token && !s.invalidatedAt) {
        s.invalidatedAt = new Date().toISOString();
        changed = true;
      }
    }
    if (changed) {
      this.saveToFile();
    }
  }

  // --- Meetings ---
  getMeetings(orgId: string): Meeting[] {
    return Object.values(this.state.meetings)
      .filter((m) => m.organizationId === orgId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getMeeting(id: string, orgId?: string): Meeting | undefined {
    const meeting = this.state.meetings[id];
    if (!meeting) return undefined;
    if (orgId && meeting.organizationId !== orgId) return undefined;
    return meeting;
  }

  saveMeeting(meeting: Meeting) {
    meeting.updatedAt = new Date().toISOString();
    this.state.meetings[meeting.id] = meeting;
    this.saveToFile();
  }

  deleteMeeting(id: string, orgId?: string): boolean {
    const meeting = this.state.meetings[id];
    if (!meeting) return false;
    if (orgId && meeting.organizationId !== orgId) return false;
    delete this.state.meetings[id];
    this.saveToFile();
    return true;
  }

  // --- Tasks ---
  getTasks(orgId: string): Task[] {
    return Object.values(this.state.tasks)
      .filter((t) => t.organizationId === orgId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getTask(id: string, orgId?: string): Task | undefined {
    const task = this.state.tasks[id];
    if (!task) return undefined;
    if (orgId && task.organizationId !== orgId) return undefined;
    return task;
  }

  saveTask(task: Task) {
    this.state.tasks[task.id] = task;
    this.saveToFile();
  }

  updateTask(taskId: string, updates: Partial<Task>, orgId?: string): Task {
    const task = this.getTask(taskId, orgId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    const updated: Task = {
      ...task,
      ...updates,
      id: task.id,
      organizationId: task.organizationId,
      updatedAt: new Date().toISOString(),
    };

    if (updates.status === 'COMPLETED' && !task.completedAt) {
      updated.completedAt = new Date().toISOString();
    } else if (updates.status && updates.status !== 'COMPLETED') {
      updated.completedAt = undefined;
    }

    this.state.tasks[taskId] = updated;
    this.saveToFile();
    return updated;
  }

  updateTaskStatus(taskId: string, status: TaskStatus, orgId?: string): Task {
    return this.updateTask(taskId, { status }, orgId);
  }

  deleteTask(taskId: string, orgId?: string): boolean {
    const task = this.getTask(taskId, orgId);
    if (!task) return false;
    delete this.state.tasks[taskId];
    this.saveToFile();
    return true;
  }

  // --- Calendar Events ---
  getCalendarEvents(orgId: string): CalendarEvent[] {
    return Object.values(this.state.calendarEvents).filter((e) => e.organizationId === orgId);
  }

  saveCalendarEvent(event: CalendarEvent) {
    this.state.calendarEvents[event.id] = event;
    this.saveToFile();
  }

  // --- Integrations ---
  getIntegrations(orgId: string): Integration[] {
    const list = Object.values(this.state.integrations).filter((i) => i.organizationId === orgId);
    if (list.length === 0) {
      // Initialize default clean "NOT_CONNECTED" records
      const defaults: Array<Pick<Integration, 'provider' | 'name' | 'category'>> = [
        { provider: 'gmail', name: 'Google Gmail', category: 'email' },
        { provider: 'google_calendar', name: 'Google Calendar', category: 'calendar' },
        { provider: 'outlook_calendar', name: 'Microsoft Outlook Calendar', category: 'calendar' },
        { provider: 'zoom', name: 'Zoom Meetings', category: 'video' },
        { provider: 'google_meet', name: 'Google Meet', category: 'video' },
        { provider: 'teams', name: 'Microsoft Teams', category: 'video' },
        { provider: 'jira', name: 'Atlassian Jira', category: 'task' },
        { provider: 'asana', name: 'Asana', category: 'task' },
        { provider: 'linear', name: 'Linear', category: 'task' },
      ];

      defaults.forEach((def) => {
        const id = `int-${orgId}-${def.provider}`;
        const item: Integration = {
          id,
          organizationId: orgId,
          provider: def.provider,
          name: def.name,
          category: def.category,
          status: 'NOT_CONNECTED',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        this.state.integrations[id] = item;
      });
      this.saveToFile();
      return Object.values(this.state.integrations).filter((i) => i.organizationId === orgId);
    }
    return list;
  }

  saveIntegration(integration: Integration) {
    integration.updatedAt = new Date().toISOString();
    this.state.integrations[integration.id] = integration;
    this.saveToFile();
  }

  // --- Audit Logs ---
  getAuditLogs(orgId: string): AuditLog[] {
    return Object.values(this.state.auditLogs)
      .filter((a) => a.organizationId === orgId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  saveAuditLog(log: AuditLog) {
    this.state.auditLogs[log.id] = log;
    this.saveToFile();
  }

  // --- Autonomy Settings ---
  getAutonomySettings(orgId: string): AutonomySettings {
    const existing = this.state.autonomySettings[orgId];
    if (existing) return existing;

    const initial: AutonomySettings = {
      organizationId: orgId,
      policy: 'MANUAL_APPROVAL',
      requireApprovalBeforeExternalSync: true,
      autoExtractTasks: true,
      autoDetectRecurringIssues: true,
      notifyOnRecurringIssue: true,
    };
    this.state.autonomySettings[orgId] = initial;
    this.saveToFile();
    return initial;
  }

  saveAutonomySettings(settings: AutonomySettings) {
    this.state.autonomySettings[settings.organizationId] = settings;
    this.saveToFile();
  }

  // --- Recurring Issues ---
  getRecurringIssues(orgId: string): RecurringIssue[] {
    return Object.values(this.state.recurringIssues).filter((r) => r.organizationId === orgId);
  }

  saveRecurringIssue(issue: RecurringIssue) {
    this.state.recurringIssues[issue.id] = issue;
    this.saveToFile();
  }

  // --- Follow-ups ---
  getFollowUps(orgId: string): FollowUpRecommendation[] {
    return Object.values(this.state.followUps).filter((f) => f.organizationId === orgId);
  }

  saveFollowUp(rec: FollowUpRecommendation) {
    this.state.followUps[rec.id] = rec;
    this.saveToFile();
  }

  // --- Real Dynamic Dashboard Stats (NEVER FABRICATED) ---
  getDashboardStats(orgId: string): DashboardStats {
    const meetings = this.getMeetings(orgId);
    const tasks = this.getTasks(orgId);
    const recurring = this.getRecurringIssues(orgId);
    const integrations = this.getIntegrations(orgId);

    const upcomingMeetings = meetings.filter(
      (m) => m.status === 'SCHEDULED' || m.status === 'IN_PROGRESS'
    ).length;
    const completedMeetings = meetings.filter((m) => m.status === 'COMPLETED').length;
    const openActionItems = tasks.filter((t) => t.status === 'TODO' || t.status === 'IN_PROGRESS').length;
    const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;
    const connectedIntegrationsCount = integrations.filter((i) => i.status === 'CONNECTED').length;

    let openQuestionsCount = 0;
    let totalConfidence = 0;
    let confidenceCount = 0;

    meetings.forEach((m) => {
      openQuestionsCount += (m.openQuestions || []).filter((q) => q.status === 'UNRESOLVED').length;
      (m.decisions || []).forEach((d) => {
        totalConfidence += d.confidence;
        confidenceCount++;
      });
      (m.actionItems || []).forEach((a) => {
        totalConfidence += a.confidence;
        confidenceCount++;
      });
    });

    const averageExtractionConfidence =
      confidenceCount > 0 ? Math.round((totalConfidence / confidenceCount) * 100) : 0;

    return {
      totalMeetings: meetings.length,
      upcomingMeetings,
      completedMeetings,
      openActionItems,
      completedTasks,
      recurringIssuesCount: recurring.length,
      openQuestionsCount,
      connectedIntegrationsCount,
      averageExtractionConfidence,
      engineMode: isGeminiAvailable() ? 'GEMINI_LLM' : 'OFFLINE_NLP',
    };
  }
}

export const db = new Store();
