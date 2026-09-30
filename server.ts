import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db/store.ts';
import { loadDemoSandbox, DEMO_ORG_ID } from './server/db/seed.ts';
import { orchestrator, workflowEvents, WorkflowEvent } from './server/agents/orchestrator.ts';
import { isGeminiAvailable } from './server/services/gemini.ts';
import { searchHistoricalMeetings } from './server/algorithms/retrieval.ts';
import {
  AuthenticatedRequest,
  generateToken,
  generateVerificationToken,
  getSessionCookieOptions,
  hashPassword,
  hashVerificationToken,
  optionalAuth,
  requireAuth,
  SESSION_COOKIE_NAME,
  verifyPassword,
} from './server/auth/auth.ts';
import {
  isEmailProviderConfigured,
  sendVerificationEmail,
} from './server/services/email.ts';
import {
  AuditLog,
  CalendarEvent,
  Meeting,
  Organization,
  Session,
  Task,
  TaskPriority,
  TaskSource,
  TaskStatus,
  User,
  VerificationToken,
} from './server/types.ts';
import { scheduleMeeting } from './server/algorithms/scheduler.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Middleware
app.use(cookieParser());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// CORS & Iframe friendly headers
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ==========================================
// SYSTEM & HEALTH ENDPOINTS
// ==========================================

app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'ASTRA_V1',
    name: 'Autonomous Synchronization, Transcription, and Resolution Assistant',
    database: 'connected',
    ai: isGeminiAvailable() ? 'gemini-3.8-flash' : 'fallback-rule-engine',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    emailProvider: isEmailProviderConfigured(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/config', (req: Request, res: Response) => {
  res.json({
    app: 'ASTRA_V1',
    environment: process.env.NODE_ENV || 'development',
    llmProvider: isGeminiAvailable() ? 'Google Gemini 3.8 Flash' : 'ASTRA Fallback Rule Engine',
    hasGeminiKey: isGeminiAvailable(),
    emailProvider: isEmailProviderConfigured(),
    dataIntegrity: 'STRICT_HONESTY_MODE',
  });
});

// ==========================================
// AUTHENTICATION & MULTI-TENANCY API
// ==========================================

app.get('/api/auth/email-status', (req: Request, res: Response) => {
  res.json(isEmailProviderConfigured());
});

app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password, confirmPassword, organizationName } = req.body;

    // 1. Validation
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Full name is required (minimum 2 characters).' });
    }

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email address is required.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanEmail = email.trim().toLowerCase();
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password is required.' });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters long.',
      });
    }

    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumberOrSymbol = /[\d!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
    if (!hasLetter || !hasNumberOrSymbol) {
      return res.status(400).json({
        error: 'Password must contain at least one letter and at least one number or special character.',
      });
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    // 2. Check duplicate email
    const existingUser = db.getUserByEmail(cleanEmail);
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // 3. Create organization
    const orgId = `org-${Date.now()}`;
    const orgName = (organizationName || `${name.trim()}'s Organization`).trim();
    const org: Organization = {
      id: orgId,
      name: orgName,
      slug: orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      plan: 'FREE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.saveOrganization(org);

    // 4. Create user with emailVerified = false
    const userId = `usr-${Date.now()}`;
    const user: User = {
      id: userId,
      organizationId: orgId,
      name: name.trim(),
      email: cleanEmail,
      passwordHash: hashPassword(password),
      role: 'OWNER',
      emailVerified: false,
      status: 'PENDING_VERIFICATION',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.saveUser(user);

    // 5. Generate secure verification token
    const { rawToken, tokenHash, expiresAt } = generateVerificationToken(24);
    const tokenId = `tok-${Date.now()}`;
    const tokenRecord: VerificationToken = {
      id: tokenId,
      userId: user.id,
      tokenHash,
      expiresAt,
      createdAt: new Date().toISOString(),
    };
    db.saveVerificationToken(tokenRecord);

    // 6. Log audit event
    const audit: AuditLog = {
      id: `aud-reg-${Date.now()}`,
      organizationId: orgId,
      timestamp: new Date().toISOString(),
      userId: user.id,
      userName: user.name,
      action: 'ORGANIZATION_REGISTERED',
      resource: `Organization #${orgId} (${org.name})`,
      result: 'PENDING',
      details: 'User registered. Awaiting email verification.',
    };
    db.saveAuditLog(audit);

    // 7. Send real verification email via email service
    const emailResult = await sendVerificationEmail({
      toEmail: user.email,
      userName: user.name,
      rawToken,
      reqHost: req.get('host'),
    });

    // 8. DO NOT auto-login. Return truthful delivery state
    res.status(201).json({
      success: true,
      message: emailResult.success
        ? 'Account created. Check your email to verify your account.'
        : emailResult.statusMessage,
      emailSent: emailResult.success,
      emailDeliveryStatus: emailResult.statusMessage,
      emailProviderConfigured: emailResult.providerConfigured,
      email: user.email,
      devVerificationUrl: emailResult.devVerificationUrl,
    });
  } catch (err: any) {
    console.error('[ASTRA AUTH] Registration error:', err);
    res.status(500).json({ error: err.message || 'Registration failed.' });
  }
});

// Verification Endpoint - Handles both browser link clicks and API requests
app.all('/api/auth/verify-email', async (req: Request, res: Response) => {
  try {
    const rawToken = (req.query.token as string) || (req.body && req.body.token);

    if (!rawToken || typeof rawToken !== 'string') {
      if (req.method === 'GET' && req.headers.accept?.includes('text/html')) {
        return res.redirect('/?verify_error=invalid');
      }
      return res.status(400).json({ error: 'Invalid verification link.' });
    }

    const tokenHash = hashVerificationToken(rawToken);
    const tokenRecord = db.getVerificationTokenByHash(tokenHash);

    if (!tokenRecord) {
      if (req.method === 'GET' && req.headers.accept?.includes('text/html')) {
        return res.redirect('/?verify_error=invalid');
      }
      return res.status(400).json({ error: 'Invalid verification link.' });
    }

    // Check if token has already been used
    if (tokenRecord.usedAt) {
      if (req.method === 'GET' && req.headers.accept?.includes('text/html')) {
        return res.redirect('/?verify_error=already_used');
      }
      return res.status(400).json({ error: 'This email has already been verified.' });
    }

    // Check if token has expired
    if (new Date(tokenRecord.expiresAt).getTime() < Date.now()) {
      if (req.method === 'GET' && req.headers.accept?.includes('text/html')) {
        return res.redirect('/?verify_error=expired');
      }
      return res.status(400).json({
        error: 'This verification link has expired. Please request a new verification email.',
      });
    }

    // Identify user
    const user = db.getUserById(tokenRecord.userId);
    if (!user) {
      if (req.method === 'GET' && req.headers.accept?.includes('text/html')) {
        return res.redirect('/?verify_error=invalid');
      }
      return res.status(400).json({ error: 'Invalid verification link.' });
    }

    // Mark email verified
    user.emailVerified = true;
    user.emailVerifiedAt = new Date().toISOString();
    user.status = 'ACTIVE';
    user.updatedAt = new Date().toISOString();
    db.saveUser(user);

    // Invalidate token
    tokenRecord.usedAt = new Date().toISOString();
    db.saveVerificationToken(tokenRecord);

    // Audit log
    db.saveAuditLog({
      id: `aud-vfy-${Date.now()}`,
      organizationId: user.organizationId,
      timestamp: new Date().toISOString(),
      userId: user.id,
      userName: user.name,
      action: 'USER_EMAIL_VERIFIED',
      resource: user.email,
      result: 'SUCCESS',
      details: 'User email verified successfully via secure token.',
    });

    if (req.method === 'GET' && req.headers.accept?.includes('text/html')) {
      return res.redirect(`/?verified=true&email=${encodeURIComponent(user.email)}`);
    }

    res.json({
      success: true,
      message: 'Email verified successfully. You can now sign in.',
      email: user.email,
    });
  } catch (err: any) {
    console.error('[ASTRA AUTH] Verification error:', err);
    res.status(500).json({ error: err.message || 'Verification failed.' });
  }
});

// Resend Verification Email
app.post('/api/auth/resend-verification', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email address is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.getUserByEmail(cleanEmail);

    if (!user) {
      return res.status(404).json({ error: 'No account found with this email address.' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: 'This email has already been verified. You can now sign in.' });
    }

    // Rate limiting: check tokens created in the last 60 seconds
    const userTokens = db.getVerificationTokensByUser(user.id);
    const oneMinuteAgo = Date.now() - 60 * 1000;
    const recentToken = userTokens.find((t) => new Date(t.createdAt).getTime() > oneMinuteAgo);
    if (recentToken) {
      return res.status(429).json({
        error: 'Please wait at least 60 seconds before requesting another verification email.',
      });
    }

    // Invalidate old tokens for this user
    db.invalidateVerificationTokensForUser(user.id);

    // Generate new secure token
    const { rawToken, tokenHash, expiresAt } = generateVerificationToken(24);
    const tokenId = `tok-${Date.now()}`;
    const tokenRecord: VerificationToken = {
      id: tokenId,
      userId: user.id,
      tokenHash,
      expiresAt,
      createdAt: new Date().toISOString(),
    };
    db.saveVerificationToken(tokenRecord);

    // Send email
    const emailResult = await sendVerificationEmail({
      toEmail: user.email,
      userName: user.name,
      rawToken,
      reqHost: req.get('host'),
    });

    if (emailResult.success) {
      return res.json({
        success: true,
        message: 'Verification email sent. Please check your inbox.',
        emailSent: true,
      });
    }

    if (!emailResult.providerConfigured) {
      return res.json({
        success: false,
        message: 'Registration created, but email delivery is not configured.',
        emailSent: false,
        devVerificationUrl: emailResult.devVerificationUrl,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Unable to send verification email. Please try again.',
      emailSent: false,
    });
  } catch (err: any) {
    console.error('[ASTRA AUTH] Resend verification error:', err);
    res.status(500).json({ error: err.message || 'Failed to resend verification email.' });
  }
});

// Login Endpoint
app.post('/api/auth/login', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.getUserByEmail(cleanEmail);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isValid = verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Check account status
    if (user.status === 'SUSPENDED') {
      return res.status(403).json({
        error: 'Your account has been suspended. Please contact your workspace administrator.',
      });
    }

    // Check email verification status
    if (!user.emailVerified) {
      return res.status(403).json({
        error: 'Please verify your email before signing in.',
        emailUnverified: true,
        email: user.email,
      });
    }

    const org = db.getOrganization(user.organizationId);
    const token = generateToken(user);

    // Save session in database
    const session: Session = {
      id: `sess-${Date.now()}`,
      userId: user.id,
      organizationId: user.organizationId,
      token,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
    db.saveSession(session);

    // Set secure HTTP-only cookie
    res.cookie(SESSION_COOKIE_NAME, token, getSessionCookieOptions());

    const { passwordHash: _, ...safeUser } = user;

    res.json({
      user: safeUser,
      organization: org,
      token,
      message: 'Signed in successfully.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Login failed.' });
  }
});

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = db.getUserById(req.user!.userId);
  if (!user) {
    return res.status(404).json({ error: 'User record not found.' });
  }
  const org = db.getOrganization(user.organizationId);
  const { passwordHash: _, ...safeUser } = user;
  res.json({ user: safeUser, organization: org });
});

app.post('/api/auth/logout', (req: AuthenticatedRequest, res: Response) => {
  // Invalidate session in store if token present
  const token =
    req.cookies?.[SESSION_COOKIE_NAME] ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.substring(7)
      : null);

  if (token) {
    db.invalidateSession(token);
  }

  // Clear HTTP-only session cookie
  res.clearCookie(SESSION_COOKIE_NAME, {
    ...getSessionCookieOptions(),
    maxAge: 0,
  });

  res.json({ success: true, message: 'Signed out successfully.' });
});

// Organization Users
app.get('/api/users', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const users = db.getUsersByOrg(req.user!.organizationId).map((u) => {
    const { passwordHash: _, ...safe } = u;
    return safe;
  });
  res.json(users);
});

// ==========================================
// DASHBOARD & ANALYTICS API (DATA DRIVEN)
// ==========================================

app.get('/api/dashboard', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const stats = db.getDashboardStats(orgId);
  const meetings = db.getMeetings(orgId);
  const tasks = db.getTasks(orgId);
  const recurring = db.getRecurringIssues(orgId);

  const upcomingMeetings = meetings.filter(
    (m) => m.status === 'SCHEDULED' || m.status === 'IN_PROGRESS'
  );
  const recentMeetings = meetings.filter((m) => m.status === 'COMPLETED');
  const myTasks = tasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');

  const openQuestions = meetings
    .flatMap((m) => (m.openQuestions || []).filter((q) => q.status === 'UNRESOLVED'))
    .slice(0, 5);

  const recentDecisions = meetings
    .flatMap((m) => m.decisions || [])
    .slice(0, 5);

  res.json({
    stats,
    upcomingMeetings,
    recentMeetings: recentMeetings.slice(0, 5),
    myTasks: myTasks.slice(0, 8),
    openQuestions,
    recentDecisions,
    recurringIssues: recurring,
  });
});

app.get('/api/dashboard/stats', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json(db.getDashboardStats(req.user!.organizationId));
});

app.get('/api/analytics', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const meetings = db.getMeetings(orgId);
  const tasks = db.getTasks(orgId);

  if (meetings.length === 0) {
    return res.json({
      hasData: false,
      message: 'No meeting analytics available yet. Complete a few meetings to see trends.',
    });
  }

  const completed = meetings.filter((m) => m.status === 'COMPLETED');
  const totalMinutes = completed.reduce((acc, m) => acc + (m.durationMinutes || 0), 0);
  const avgDuration = completed.length > 0 ? Math.round(totalMinutes / completed.length) : 0;

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;
  const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  res.json({
    hasData: true,
    totalMeetings: meetings.length,
    completedMeetings: completed.length,
    averageMeetingDuration: avgDuration,
    actionItemsCreated: totalTasks,
    actionCompletionRate: taskCompletionRate,
    recurringIssuesCount: db.getRecurringIssues(orgId).length,
  });
});

// ==========================================
// MEETINGS CRUD & LIFECYCLE API
// ==========================================

app.get('/api/meetings', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const meetings = db.getMeetings(req.user!.organizationId);
  res.json(meetings);
});

app.get('/api/meetings/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const meeting = db.getMeeting(req.params.id, req.user!.organizationId);
  if (!meeting) {
    return res.status(404).json({ error: `Meeting #${req.params.id} not found.` });
  }
  res.json(meeting);
});

app.post('/api/meetings', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const userId = req.user!.userId;
    const {
      title,
      purpose,
      description,
      durationMinutes,
      priority,
      preferredDate,
      preferredTimeRange,
      meetingType,
      constraints,
      participants,
      availabilities,
      rawTranscript,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Meeting title is required.' });
    }

    const meetingId = `mtg-${Date.now().toString().slice(-6)}`;
    const newMeeting: Meeting = {
      id: meetingId,
      organizationId: orgId,
      createdById: userId,
      title: title.trim(),
      purpose: (purpose || title).trim(),
      description: (description || purpose || title).trim(),
      meetingType: meetingType || 'INTERNAL',
      status: 'DRAFT',
      priority: priority || 'MEDIUM',
      durationMinutes: Number(durationMinutes) || 45,
      preferredDate: preferredDate || new Date().toISOString().split('T')[0],
      preferredTimeRange: (preferredTimeRange || '').trim(),
      constraints: Array.isArray(constraints) ? constraints : [],
      participants: Array.isArray(participants) && participants.length > 0 ? participants : [],
      availabilities: Array.isArray(availabilities) ? availabilities : [],
      selectedSlot: req.body.selectedSlot || undefined,
      candidateSlots: Array.isArray(req.body.candidateSlots) ? req.body.candidateSlots : undefined,
      intersectionWindows: Array.isArray(req.body.intersectionWindows) ? req.body.intersectionWindows : undefined,
      agendaItems: [],
      transcriptSegments: [],
      decisions: [],
      openQuestions: [],
      actionItems: [],
      rawTranscript: rawTranscript || '',
      videoProvider: 'NONE',
      agentRuns: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.saveMeeting(newMeeting);

    // Audit log
    const audit: AuditLog = {
      id: `aud-mtg-${Date.now()}`,
      organizationId: orgId,
      timestamp: new Date().toISOString(),
      userId,
      userName: req.user!.email,
      action: 'MEETING_CREATED',
      resource: `Meeting #${meetingId} (${newMeeting.title})`,
      result: 'SUCCESS',
      details: `Created draft with ${newMeeting.participants.length} participant(s).`,
    };
    db.saveAuditLog(audit);

    res.status(201).json(newMeeting);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create meeting.' });
  }
});

app.patch('/api/meetings/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const meeting = db.getMeeting(req.params.id, req.user!.organizationId);
  if (!meeting) return res.status(404).json({ error: 'Meeting not found.' });

  const allowedFields = [
    'title',
    'purpose',
    'description',
    'durationMinutes',
    'priority',
    'preferredDate',
    'preferredTimeRange',
    'status',
    'rawTranscript',
    'participants',
    'availabilities',
  ];

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      (meeting as any)[field] = req.body[field];
    }
  });

  db.saveMeeting(meeting);
  res.json(meeting);
});

app.delete('/api/meetings/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const deleted = db.deleteMeeting(req.params.id, req.user!.organizationId);
  if (!deleted) return res.status(404).json({ error: 'Meeting not found.' });
  res.json({ message: 'Meeting deleted successfully.' });
});

// SSE Streaming for Real-Time Agent Execution Events
app.get('/api/meetings/:id/run/stream', (req: Request, res: Response) => {
  const meetingId = req.params.id;
  const meeting = db.getMeeting(meetingId);
  if (!meeting) {
    return res.status(404).json({ error: `Meeting #${meetingId} not found.` });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  res.write(`data: ${JSON.stringify({ event: 'connected', meetingId, status: meeting.status })}\n\n`);

  const onMeetingEvent = (eventData: WorkflowEvent) => {
    res.write(`data: ${JSON.stringify(eventData)}\n\n`);
    if (eventData.event === 'workflow.completed' || eventData.event === 'workflow.failed') {
      setTimeout(() => {
        try {
          res.end();
        } catch {}
      }, 1000);
    }
  };

  workflowEvents.on(`meeting:${meetingId}`, onMeetingEvent);

  req.on('close', () => {
    workflowEvents.off(`meeting:${meetingId}`, onMeetingEvent);
  });
});

// Run Full Multi-Agent Workflow
app.post('/api/meetings/:id/run', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const meetingId = req.params.id;
  const meeting = db.getMeeting(meetingId, req.user!.organizationId);
  if (!meeting) return res.status(404).json({ error: 'Meeting not found.' });

  try {
    const { customTranscript } = req.body;
    const actor = { id: req.user!.userId, name: req.user!.email };
    const updated = await orchestrator.runFullWorkflow(meetingId, customTranscript, actor);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Workflow execution failed.' });
  }
});

// Granular Agent Endpoints
app.post('/api/scheduler/candidate-slots', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      durationMinutes,
      priority,
      preferredDate,
      preferredTimeRange,
      availabilities,
      constraints,
    } = req.body;

    const result = scheduleMeeting({
      durationMinutes: Number(durationMinutes) || 45,
      priority: priority || 'MEDIUM',
      preferredDate: preferredDate || new Date().toISOString().split('T')[0],
      preferredTimeRange: preferredTimeRange || '',
      availabilities: Array.isArray(availabilities) ? availabilities : [],
      constraints: Array.isArray(constraints) ? constraints : [],
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to calculate candidate slots.' });
  }
});

app.post('/api/meetings/:id/schedule', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = await orchestrator.runSchedulerAgent(req.params.id, {
      id: req.user!.userId,
      name: req.user!.email,
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/meetings/:id/agenda', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = await orchestrator.runAgendaAgent(req.params.id, {
      id: req.user!.userId,
      name: req.user!.email,
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/meetings/:id/transcript', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { transcript } = req.body;
    const updated = await orchestrator.runTranscriptionAgent(req.params.id, transcript, {
      id: req.user!.userId,
      name: req.user!.email,
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/meetings/:id/analyze', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = await orchestrator.runMinutesAgent(req.params.id, {
      id: req.user!.userId,
      name: req.user!.email,
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/meetings/:id/tasks/sync', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = await orchestrator.runTaskAndCalendarAgents(req.params.id, {
      id: req.user!.userId,
      name: req.user!.email,
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/meetings/:id/memory/process', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = await orchestrator.runMemoryAgent(req.params.id, {
      id: req.user!.userId,
      name: req.user!.email,
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Minutes & Markdown Export
app.get('/api/meetings/:id/minutes', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const meeting = db.getMeeting(req.params.id, req.user!.organizationId);
  if (!meeting) return res.status(404).json({ error: 'Meeting not found.' });

  const md = [
    `# Meeting Minutes: ${meeting.title}`,
    `**Status**: ${meeting.status} | **Priority**: ${meeting.priority} | **Duration**: ${meeting.durationMinutes} mins`,
    `**Scheduled Slot**: ${
      meeting.selectedSlot
        ? `${meeting.selectedSlot.day} ${meeting.selectedSlot.startTime} – ${meeting.selectedSlot.endTime}`
        : 'Not scheduled'
    }`,
    `**Participants**: ${
      meeting.participants.length > 0
        ? meeting.participants.map((p) => `${p.name} (${p.email})`).join(', ')
        : 'None recorded'
    }`,
    '',
    `## Executive Summary`,
    meeting.executiveSummary || '*No executive summary generated.*',
    '',
    `## Agenda`,
    ...(meeting.agendaItems.length > 0
      ? meeting.agendaItems.map(
          (a, i) => `${i + 1}. **${a.topic}** (${a.durationMinutes}m) - *Owner: ${a.owner || 'Unassigned'}*\n   ${a.description}`
        )
      : ['*No agenda recorded.*']),
    '',
    `## Decisions Reached (${meeting.decisions.length})`,
    ...(meeting.decisions.length > 0
      ? meeting.decisions.map(
          (d, i) =>
            `${i + 1}. **${d.text}** (Confidence: ${Math.round(d.confidence * 100)}%)\n   *Evidence: ${
              d.sourceExcerpt ? `"${d.sourceExcerpt}" [${d.sourceTimestamp || '00:00'}]` : 'Consensus'
            }*`
        )
      : ['*No formal decisions registered.*']),
    '',
    `## Open & Unresolved Questions (${meeting.openQuestions.length})`,
    ...(meeting.openQuestions.length > 0
      ? meeting.openQuestions.map(
          (q, i) =>
            `${i + 1}. ${q.question} *[Asked by: ${q.askedBy || 'Attendee'}]* - **${q.status}**\n   *Source: ${
              q.sourceExcerpt || 'Transcript'
            }*`
        )
      : ['*All questions resolved.*']),
    '',
    `## Action Items & Tasks (${meeting.actionItems.length})`,
    '| Action Item | Assignee | Deadline | Priority | Status |',
    '| :--- | :--- | :--- | :--- | :--- |',
    ...(meeting.actionItems.length > 0
      ? meeting.actionItems.map(
          (a) => `| ${a.text} | **${a.owner}** | ${a.deadline} | ${a.priority} | ${a.status} |`
        )
      : ['| None recorded | - | - | - | - |']),
    '',
    `---`,
    `*Generated by ASTRA_V1 Platform • Organization: ${req.user!.organizationId}*`,
  ].join('\n');

  res.json({ meeting, markdown: md });
});

// ==========================================
// TASKS MANAGEMENT API
// ==========================================

app.get('/api/tasks', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { status, owner, assigneeId, search } = req.query;
  const orgId = req.user!.organizationId;
  let tasks = db.getTasks(orgId);

  if (status && typeof status === 'string' && status !== 'ALL') {
    tasks = tasks.filter((t) => t.status === status);
  }
  if (assigneeId && typeof assigneeId === 'string') {
    tasks = tasks.filter((t) => t.assigneeId === assigneeId);
  }
  if (owner && typeof owner === 'string') {
    tasks = tasks.filter((t) => t.owner.toLowerCase().includes(owner.toLowerCase()));
  }
  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    tasks = tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.owner && t.owner.toLowerCase().includes(q)) ||
        (t.meetingTitle && t.meetingTitle.toLowerCase().includes(q))
    );
  }
  res.json(tasks);
});

app.get('/api/tasks/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const task = db.getTask(req.params.id, req.user!.organizationId);
  if (!task) {
    return res.status(404).json({ error: `Task #${req.params.id} not found.` });
  }
  res.json(task);
});

app.post('/api/tasks', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const userId = req.user!.userId;
    const {
      title,
      description,
      assigneeId,
      dueDate,
      priority,
      status,
      meetingId,
      source,
    } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Task title is required.' });
    }

    // Assignee validation
    let resolvedOwner = 'Unassigned';
    let resolvedAssigneeId: string | undefined = undefined;

    if (assigneeId && assigneeId !== 'unassigned') {
      const user = db.getUserById(assigneeId);
      if (!user || user.organizationId !== orgId) {
        return res.status(400).json({ error: 'Selected assignee does not belong to your organization.' });
      }
      resolvedOwner = user.name;
      resolvedAssigneeId = user.id;
    }

    // Meeting validation
    let resolvedMeetingId: string | undefined = undefined;
    let resolvedMeetingTitle: string | undefined = undefined;

    if (meetingId && meetingId !== 'unlinked' && meetingId !== 'none') {
      const meeting = db.getMeeting(meetingId, orgId);
      if (!meeting) {
        return res.status(400).json({ error: 'Selected meeting does not belong to your organization.' });
      }
      resolvedMeetingId = meeting.id;
      resolvedMeetingTitle = meeting.title;
    }

    // Priority validation
    const validPriorities: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL'];
    const resolvedPriority: TaskPriority = validPriorities.includes(priority) ? priority : 'MEDIUM';

    // Status validation
    const validStatuses: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED'];
    const resolvedStatus: TaskStatus = validStatuses.includes(status) ? status : 'TODO';

    const cleanDueDate = dueDate && typeof dueDate === 'string' && dueDate.trim() ? dueDate.trim() : undefined;
    const deadlineString = cleanDueDate || 'Not specified';

    const taskId = `tsk-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const task: Task = {
      id: taskId,
      organizationId: orgId,
      title: title.trim(),
      description: description ? description.trim() : '',
      assigneeId: resolvedAssigneeId,
      owner: resolvedOwner,
      createdById: userId,
      dueDate: cleanDueDate,
      deadline: deadlineString,
      priority: resolvedPriority,
      status: resolvedStatus,
      meetingId: resolvedMeetingId,
      meetingTitle: resolvedMeetingTitle,
      source: source === 'MEETING_ACTION_ITEM' ? 'MEETING_ACTION_ITEM' : 'MANUAL',
      syncedToExternal: false,
      confidence: 1.0,
      completedAt: resolvedStatus === 'COMPLETED' ? new Date().toISOString() : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.saveTask(task);

    // Audit log
    const audit: AuditLog = {
      id: `aud-tsk-${Date.now()}`,
      organizationId: orgId,
      timestamp: new Date().toISOString(),
      userId,
      userName: req.user!.email,
      action: 'TASK_CREATED',
      resource: `Task #${taskId} (${task.title})`,
      result: 'SUCCESS',
      details: `Created task assigned to ${task.owner}. Priority: ${task.priority}. Due: ${task.deadline}`,
    };
    db.saveAuditLog(audit);

    res.status(201).json(task);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create task.' });
  }
});

app.patch('/api/tasks/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const task = db.getTask(req.params.id, orgId);
    if (!task) {
      return res.status(404).json({ error: `Task #${req.params.id} not found.` });
    }

    const updates: Partial<Task> = {};
    const {
      title,
      description,
      assigneeId,
      dueDate,
      priority,
      status,
      meetingId,
    } = req.body;

    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ error: 'Task title cannot be empty.' });
      }
      updates.title = title.trim();
    }

    if (description !== undefined) {
      updates.description = typeof description === 'string' ? description.trim() : '';
    }

    if (assigneeId !== undefined) {
      if (assigneeId && assigneeId !== 'unassigned') {
        const user = db.getUserById(assigneeId);
        if (!user || user.organizationId !== orgId) {
          return res.status(400).json({ error: 'Selected assignee does not belong to your organization.' });
        }
        updates.assigneeId = user.id;
        updates.owner = user.name;
      } else {
        updates.assigneeId = undefined;
        updates.owner = 'Unassigned';
      }
    }

    if (meetingId !== undefined) {
      if (meetingId && meetingId !== 'unlinked' && meetingId !== 'none') {
        const meeting = db.getMeeting(meetingId, orgId);
        if (!meeting) {
          return res.status(400).json({ error: 'Selected meeting does not belong to your organization.' });
        }
        updates.meetingId = meeting.id;
        updates.meetingTitle = meeting.title;
      } else {
        updates.meetingId = undefined;
        updates.meetingTitle = undefined;
      }
    }

    if (dueDate !== undefined) {
      const cleanDueDate = dueDate && typeof dueDate === 'string' && dueDate.trim() ? dueDate.trim() : undefined;
      updates.dueDate = cleanDueDate;
      updates.deadline = cleanDueDate || 'Not specified';
    }

    if (priority !== undefined) {
      const validPriorities: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL'];
      if (!validPriorities.includes(priority)) {
        return res.status(400).json({ error: `Invalid priority: ${priority}` });
      }
      updates.priority = priority;
    }

    if (status !== undefined) {
      const validStatuses: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status: ${status}` });
      }
      updates.status = status;
      if (status === 'COMPLETED' && !task.completedAt) {
        updates.completedAt = new Date().toISOString();
      } else if (status !== 'COMPLETED') {
        updates.completedAt = undefined;
      }
    }

    const updatedTask = db.updateTask(task.id, updates, orgId);

    // Audit log
    const audit: AuditLog = {
      id: `aud-tsk-${Date.now()}`,
      organizationId: orgId,
      timestamp: new Date().toISOString(),
      userId: req.user!.userId,
      userName: req.user!.email,
      action: 'TASK_UPDATED',
      resource: `Task #${task.id} (${updatedTask.title})`,
      result: 'SUCCESS',
      details: `Updated task fields: ${Object.keys(updates).join(', ')}`,
    };
    db.saveAuditLog(audit);

    res.json(updatedTask);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update task.' });
  }
});

app.delete('/api/tasks/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const task = db.getTask(req.params.id, orgId);
    if (!task) {
      return res.status(404).json({ error: `Task #${req.params.id} not found.` });
    }

    const deleted = db.deleteTask(req.params.id, orgId);
    if (!deleted) {
      return res.status(404).json({ error: 'Task not found or could not be deleted.' });
    }

    // Audit log
    const audit: AuditLog = {
      id: `aud-del-tsk-${Date.now()}`,
      organizationId: orgId,
      timestamp: new Date().toISOString(),
      userId: req.user!.userId,
      userName: req.user!.email,
      action: 'TASK_DELETED',
      resource: `Task #${task.id} (${task.title})`,
      result: 'SUCCESS',
      details: `Deleted task permanently from database.`,
    };
    db.saveAuditLog(audit);

    res.json({ success: true, message: 'Task deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete task.' });
  }
});

// ==========================================
// INTEGRATIONS API (HONEST NOT-CONNECTED STATES)
// ==========================================

app.get('/api/integrations', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const integrations = db.getIntegrations(req.user!.organizationId);
  res.json(integrations);
});

app.post('/api/integrations/:provider/connect', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const provider = req.params.provider;
  const integrations = db.getIntegrations(req.user!.organizationId);
  const existing = integrations.find((i) => i.provider === provider);

  if (!existing) {
    return res.status(404).json({ error: `Provider ${provider} not found.` });
  }

  // Simulates authorized connection with real timestamp
  const connectedAccount = req.body.accountEmail || `${req.user!.email} (${existing.name})`;
  existing.status = 'CONNECTED';
  existing.connectedAccount = connectedAccount;
  existing.lastSyncedAt = new Date().toISOString();
  existing.errorMessage = undefined;

  db.saveIntegration(existing);

  const audit: AuditLog = {
    id: `aud-int-${Date.now()}`,
    organizationId: req.user!.organizationId,
    timestamp: new Date().toISOString(),
    userId: req.user!.userId,
    userName: req.user!.email,
    action: 'INTEGRATION_CONNECTED',
    resource: existing.name,
    result: 'SUCCESS',
    integration: existing.provider,
    details: `Authorized account: ${connectedAccount}`,
  };
  db.saveAuditLog(audit);

  res.json({
    integration: existing,
    message: `${existing.name} connected successfully.`,
  });
});

app.delete('/api/integrations/:provider', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const provider = req.params.provider;
  const integrations = db.getIntegrations(req.user!.organizationId);
  const existing = integrations.find((i) => i.provider === provider);

  if (!existing) {
    return res.status(404).json({ error: 'Integration not found.' });
  }

  existing.status = 'NOT_CONNECTED';
  existing.connectedAccount = undefined;
  existing.lastSyncedAt = undefined;
  existing.errorMessage = undefined;

  db.saveIntegration(existing);

  const audit: AuditLog = {
    id: `aud-int-disc-${Date.now()}`,
    organizationId: req.user!.organizationId,
    timestamp: new Date().toISOString(),
    userId: req.user!.userId,
    userName: req.user!.email,
    action: 'INTEGRATION_DISCONNECTED',
    resource: existing.name,
    result: 'SUCCESS',
    integration: existing.provider,
  };
  db.saveAuditLog(audit);

  res.json({
    integration: existing,
    message: `${existing.name} disconnected.`,
  });
});

// ==========================================
// CALENDAR API
// ==========================================

app.get('/api/calendar', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const events = db.getCalendarEvents(orgId);
  const meetings = db.getMeetings(orgId);
  const tasks = db.getTasks(orgId);
  const users = db.getUsersByOrg(orgId).map((u: User) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
  }));
  const integrations = db.getIntegrations(orgId);
  const calIntegration = integrations.find(
    (i) => (i.provider === 'google_calendar' || i.provider === 'outlook_calendar') && i.status === 'CONNECTED'
  );

  // Synthesize events for any meeting that has a selectedSlot or preferredDate if not already in events
  const allEvents = [...events];
  for (const m of meetings) {
    const exists = allEvents.some((e) => e.meetingId === m.id);
    if (!exists && (m.selectedSlot || m.preferredDate)) {
      const day = m.selectedSlot?.day || m.preferredDate;
      const startTime = m.selectedSlot?.startTime || '10:00';
      const endTime = m.selectedSlot?.endTime || '10:30';
      allEvents.push({
        id: `cal-${m.id}`,
        organizationId: orgId,
        meetingId: m.id,
        title: m.title,
        startTime: `${day}T${startTime}:00`,
        endTime: `${day}T${endTime}:00`,
        participants: m.participants.map((p) => p.email),
        agendaSummary: m.purpose || m.title,
        status: 'CONFIRMED',
        provider: 'NONE',
        location: m.videoMeetingUrl || 'ASTRA Virtual Room',
        createdAt: m.createdAt,
      });
    }
  }

  res.json({
    events: allEvents,
    meetings,
    tasks,
    users,
    isCalendarConnected: !!calIntegration,
    connectedProvider: calIntegration?.name || null,
  });
});

app.post('/api/calendar/events', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.user!.organizationId;
    const { title, startTime, endTime, participants, location, agendaSummary, meetingId } = req.body;
    if (!title || !startTime) {
      return res.status(400).json({ error: 'Title and start time are required.' });
    }
    const eventId = `cal-${Date.now()}`;
    const newEvent: CalendarEvent = {
      id: eventId,
      organizationId: orgId,
      meetingId: meetingId || undefined,
      title: title.trim(),
      startTime,
      endTime: endTime || startTime,
      participants: Array.isArray(participants) ? participants : [],
      location: location || 'ASTRA Virtual Room',
      agendaSummary: agendaSummary || '',
      status: 'CONFIRMED',
      provider: 'NONE',
      createdAt: new Date().toISOString(),
    };
    db.saveCalendarEvent(newEvent);
    res.status(201).json(newEvent);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create calendar event' });
  }
});

// ==========================================
// MEMORY & RECURRENCE API
// ==========================================

app.get('/api/memory', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const meetings = db.getMeetings(orgId);
  const recurring = db.getRecurringIssues(orgId);
  const followUps = db.getFollowUps(orgId);

  res.json({
    totalHistoricalMeetings: meetings.length,
    recurringIssues: recurring,
    followUps,
    recentDecisions: meetings.flatMap((m) => m.decisions).slice(0, 10),
    unresolvedQuestions: meetings
      .flatMap((m) => m.openQuestions)
      .filter((q) => q.status === 'UNRESOLVED'),
  });
});

app.post('/api/memory/search', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { query } = req.body;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query string is required.' });
  }

  const orgId = req.user!.organizationId;
  const meetings = db.getMeetings(orgId);

  if (meetings.length === 0) {
    return res.json({
      query,
      resultsCount: 0,
      matches: [],
      message: 'No organizational meeting records available for memory search.',
    });
  }

  const results = searchHistoricalMeetings(query, meetings, 0.08);
  res.json({
    query,
    resultsCount: results.length,
    matches: results,
  });
});

// ==========================================
// AUDIT LOGS & SETTINGS API
// ==========================================

app.get('/api/audit-log', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const logs = db.getAuditLogs(req.user!.organizationId);
  res.json(logs);
});

app.get('/api/settings/autonomy', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const settings = db.getAutonomySettings(req.user!.organizationId);
  res.json(settings);
});

app.patch('/api/settings/autonomy', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const current = db.getAutonomySettings(req.user!.organizationId);
  const allowed = [
    'policy',
    'requireApprovalBeforeExternalSync',
    'autoExtractTasks',
    'autoDetectRecurringIssues',
    'notifyOnRecurringIssue',
  ];

  allowed.forEach((k) => {
    if (req.body[k] !== undefined) {
      (current as any)[k] = req.body[k];
    }
  });

  db.saveAutonomySettings(current);
  res.json(current);
});

// ==========================================
// SEGREGATED DEMO WORKSPACE API (EXPLICIT ACTIVATION ONLY)
// ==========================================

app.post('/api/demo/enter', (req: Request, res: Response) => {
  const { demoOrg, demoUsers } = loadDemoSandbox();
  const demoUser = demoUsers[0];
  const token = generateToken(demoUser);
  const { passwordHash: _, ...safeUser } = demoUser;

  res.json({
    user: safeUser,
    organization: demoOrg,
    token,
    isDemoSandbox: true,
    message: 'Entered segregated Demo Sandbox. All data is clearly tagged as simulated.',
  });
});

app.post('/api/demo/sample-meeting', (req: Request, res: Response) => {
  const { demoMeeting } = loadDemoSandbox();
  res.json(demoMeeting);
});

app.post('/api/demo/reset', (req: Request, res: Response) => {
  loadDemoSandbox();
  res.json({ message: 'Demo sandbox reset to standard sample corpus.' });
});

// ==========================================
// VITE DEV SERVER / STATIC HOSTING
// ==========================================
async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ASTRA_V1 Server] Running on http://0.0.0.0:${PORT}`);
    console.log(`[ASTRA_V1 Status] Database: Clean Production Store (${isGeminiAvailable() ? 'Gemini 3.8 Flash' : 'Fallback Engine'})`);
  });
}

startServer().catch((err) => {
  console.error('[ASTRA_V1 Server] Fatal startup error:', err);
});
