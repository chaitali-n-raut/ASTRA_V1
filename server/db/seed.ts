import { db } from './store.ts';
import {
  Meeting,
  Organization,
  RecurringIssue,
  Task,
  User,
} from '../types.ts';
import { hashPassword } from '../auth/auth.ts';

export const DEMO_ORG_ID = 'org-demo-sandbox';

/**
 * Initializes a segregated demo sandbox workspace ONLY when explicitly requested by user.
 * Real production organizations NEVER load this automatically.
 */
export function loadDemoSandbox() {
  const demoOrg: Organization = {
    id: DEMO_ORG_ID,
    name: 'Acme Robotics (Simulated Demo Workspace)',
    slug: 'demo-sandbox',
    plan: 'ENTERPRISE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.saveOrganization(demoOrg);

  const demoUsers: User[] = [
    {
      id: 'usr-demo-1',
      organizationId: DEMO_ORG_ID,
      name: 'Elena Rostova (Demo)',
      email: 'elena.demo@acmerobotics.com',
      passwordHash: hashPassword('DemoPass123!'),
      role: 'OWNER',
      emailVerified: true,
      emailVerifiedAt: new Date().toISOString(),
      status: 'ACTIVE',
      title: 'VP of Autonomous Systems',
      department: 'Engineering',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'usr-demo-2',
      organizationId: DEMO_ORG_ID,
      name: 'Marcus Vance (Demo)',
      email: 'marcus.demo@acmerobotics.com',
      passwordHash: hashPassword('DemoPass123!'),
      role: 'ADMIN',
      emailVerified: true,
      emailVerifiedAt: new Date().toISOString(),
      status: 'ACTIVE',
      title: 'Principal Software Architect',
      department: 'Infrastructure',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'usr-demo-3',
      organizationId: DEMO_ORG_ID,
      name: 'Sarah Chen (Demo)',
      email: 'sarah.demo@acmerobotics.com',
      passwordHash: hashPassword('DemoPass123!'),
      role: 'MEMBER',
      emailVerified: true,
      emailVerifiedAt: new Date().toISOString(),
      status: 'ACTIVE',
      title: 'Staff ML Engineer',
      department: 'AI Research',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  demoUsers.forEach((u) => db.saveUser(u));

  const demoMeeting: Meeting = {
    id: 'mtg-demo-101',
    organizationId: DEMO_ORG_ID,
    createdById: 'usr-demo-1',
    title: '[SIMULATED DEMO] Q4 Autonomous Fleet Telemetry Architecture',
    purpose: 'Review telemetry latency constraints, decide on message broker, and assign firmware migration tasks.',
    description: 'Technical review with engineering leads covering gRPC vs WebSocket throughput and battery consumption.',
    meetingType: 'PROJECT',
    status: 'COMPLETED',
    priority: 'HIGH',
    durationMinutes: 45,
    preferredDate: '2026-10-02',
    preferredTimeRange: '10:00 - 11:30',
    participants: [
      { id: 'p1', userId: 'usr-demo-1', name: 'Elena Rostova (Demo)', email: 'elena.demo@acmerobotics.com', role: 'VP Engineering', isOrganizer: true },
      { id: 'p2', userId: 'usr-demo-2', name: 'Marcus Vance (Demo)', email: 'marcus.demo@acmerobotics.com', role: 'Principal Architect' },
      { id: 'p3', userId: 'usr-demo-3', name: 'Sarah Chen (Demo)', email: 'sarah.demo@acmerobotics.com', role: 'Staff ML Engineer' },
    ],
    availabilities: [
      {
        participantId: 'p1',
        participantName: 'Elena Rostova (Demo)',
        intervals: [{ day: '2026-10-02', startTime: '09:00', endTime: '12:00' }],
        source: 'MANUAL',
      },
      {
        participantId: 'p2',
        participantName: 'Marcus Vance (Demo)',
        intervals: [{ day: '2026-10-02', startTime: '10:00', endTime: '14:00' }],
        source: 'MANUAL',
      },
      {
        participantId: 'p3',
        participantName: 'Sarah Chen (Demo)',
        intervals: [{ day: '2026-10-02', startTime: '09:30', endTime: '11:30' }],
        source: 'MANUAL',
      },
    ],
    selectedSlot: {
      day: '2026-10-02',
      startTime: '10:00',
      endTime: '10:45',
      durationMinutes: 45,
      availableParticipantIds: ['p1', 'p2', 'p3'],
      conflictParticipantIds: [],
      score: 95,
      reasoning: 'Unanimous 3 of 3 participants available. Aligns with standard core working hours.',
    },
    agendaItems: [
      { id: 'ag-1', meetingId: 'mtg-demo-101', topic: 'Telemetry Latency Metrics', description: 'Review edge-to-cloud payload benchmarks', durationMinutes: 15, owner: 'Marcus Vance (Demo)' },
      { id: 'ag-2', meetingId: 'mtg-demo-101', topic: 'Broker Selection & Trade-offs', description: 'Evaluate MQTT vs gRPC streaming', durationMinutes: 20, owner: 'Sarah Chen (Demo)' },
      { id: 'ag-3', meetingId: 'mtg-demo-101', topic: 'Migration Timeline', description: 'Lock in sprint deliverables and owners', durationMinutes: 10, owner: 'Elena Rostova (Demo)' },
    ],
    rawTranscript: `Elena: Good morning everyone. We are here to finalize the telemetry architecture.
Marcus: Based on our testing, MQTT over TLS delivers 22ms median latency on 4G cellular links.
Sarah: We decided to adopt MQTT for all edge fleet devices and deploy bidirectional gRPC on regional gateway pods.
Elena: Excellent. What is our deadline for the firmware update package?
Marcus: Marcus will complete the telemetry proto specifications by Friday.
Sarah: Sarah will deploy the mock load generator on staging by next Tuesday.
Elena: Please ensure all unit tests verify zero buffer drops. Meeting adjourned.`,
    transcriptFormat: 'TXT',
    transcriptSegments: [
      { id: 'seg-1', meetingId: 'mtg-demo-101', speaker: 'Elena', startTime: '00:01', text: 'Good morning everyone. We are here to finalize the telemetry architecture.' },
      { id: 'seg-2', meetingId: 'mtg-demo-101', speaker: 'Marcus', startTime: '00:15', text: 'MQTT over TLS delivers 22ms median latency on 4G cellular links.' },
      { id: 'seg-3', meetingId: 'mtg-demo-101', speaker: 'Sarah', startTime: '01:05', text: 'We decided to adopt MQTT for all edge fleet devices and deploy bidirectional gRPC on regional gateway pods.' },
      { id: 'seg-4', meetingId: 'mtg-demo-101', speaker: 'Elena', startTime: '01:45', text: 'What is our deadline for the firmware update package?' },
      { id: 'seg-5', meetingId: 'mtg-demo-101', speaker: 'Marcus', startTime: '02:10', text: 'Marcus will complete the telemetry proto specifications by Friday.' },
      { id: 'seg-6', meetingId: 'mtg-demo-101', speaker: 'Sarah', startTime: '02:40', text: 'Sarah will deploy the mock load generator on staging by next Tuesday.' },
    ],
    decisions: [
      {
        id: 'dec-1',
        meetingId: 'mtg-demo-101',
        text: 'Adopt MQTT for edge fleet devices and deploy bidirectional gRPC on regional gateway pods',
        context: 'Decided after latency evaluation on 4G links',
        confidence: 0.96,
        sourceTimestamp: '01:05',
        sourceExcerpt: 'Sarah: We decided to adopt MQTT for all edge fleet devices...',
        rationale: 'Lowest battery consumption with verified 22ms latency envelope.',
      },
    ],
    openQuestions: [
      {
        id: 'q-1',
        meetingId: 'mtg-demo-101',
        question: 'What is the fallback retry policy if cellular handoff drops during firmware streaming?',
        askedBy: 'Elena',
        status: 'UNRESOLVED',
        confidence: 0.91,
        sourceTimestamp: '01:45',
        sourceExcerpt: 'Elena: What is our deadline for the firmware update package?',
      },
    ],
    actionItems: [
      {
        id: 'act-1',
        meetingId: 'mtg-demo-101',
        text: 'Complete telemetry proto specifications',
        owner: 'Marcus Vance (Demo)',
        deadline: 'By Friday',
        priority: 'HIGH',
        confidence: 0.94,
        status: 'TODO',
        sourceTimestamp: '02:10',
        sourceExcerpt: 'Marcus: Marcus will complete the telemetry proto specifications by Friday.',
      },
      {
        id: 'act-2',
        meetingId: 'mtg-demo-101',
        text: 'Deploy mock load generator on staging cluster',
        owner: 'Sarah Chen (Demo)',
        deadline: 'By Next Tuesday',
        priority: 'MEDIUM',
        confidence: 0.92,
        status: 'TODO',
        sourceTimestamp: '02:40',
        sourceExcerpt: 'Sarah: Sarah will deploy the mock load generator on staging by next Tuesday.',
      },
    ],
    executiveSummary: 'The team finalized edge telemetry architecture, selecting MQTT over TLS for vehicle firmware and regional gRPC gateways. Two key action items were assigned for specs and load testing.',
    videoProvider: 'NONE',
    agentRuns: [],
    createdAt: '2026-09-27T10:00:00Z',
    updatedAt: '2026-09-27T10:45:00Z',
  };

  db.saveMeeting(demoMeeting);

  const demoTasks: Task[] = [
    {
      id: 'tsk-demo-1',
      organizationId: DEMO_ORG_ID,
      meetingId: 'mtg-demo-101',
      actionItemId: 'act-1',
      title: 'Complete telemetry proto specifications',
      description: 'Defined during Q4 Telemetry Architecture review. Assigned to Marcus Vance.',
      owner: 'Marcus Vance (Demo)',
      deadline: 'By Friday',
      priority: 'HIGH',
      status: 'TODO',
      source: 'MEETING_ACTION_ITEM',
      syncedToExternal: false,
      confidence: 0.94,
      createdAt: '2026-09-27T10:45:00Z',
      updatedAt: '2026-09-27T10:45:00Z',
    },
    {
      id: 'tsk-demo-2',
      organizationId: DEMO_ORG_ID,
      meetingId: 'mtg-demo-101',
      actionItemId: 'act-2',
      title: 'Deploy mock load generator on staging cluster',
      description: 'Defined during Q4 Telemetry Architecture review. Assigned to Sarah Chen.',
      owner: 'Sarah Chen (Demo)',
      deadline: 'By Next Tuesday',
      priority: 'MEDIUM',
      status: 'IN_PROGRESS',
      source: 'MEETING_ACTION_ITEM',
      syncedToExternal: false,
      confidence: 0.92,
      createdAt: '2026-09-27T10:45:00Z',
      updatedAt: '2026-09-27T10:45:00Z',
    },
  ];

  demoTasks.forEach((t) => db.saveTask(t));

  return { demoOrg, demoUsers, demoMeeting, demoTasks };
}
