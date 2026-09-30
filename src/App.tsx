import React, { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar.tsx';
import { AuthView } from './components/AuthView.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { NewMeetingWizard } from './components/NewMeetingWizard.tsx';
import { WorkflowView } from './components/WorkflowView.tsx';
import { MinutesView } from './components/MinutesView.tsx';
import { TasksView } from './components/TasksView.tsx';
import { MemoryView } from './components/MemoryView.tsx';
import { CalendarView } from './components/CalendarView.tsx';
import { AnalyticsView } from './components/AnalyticsView.tsx';
import { IntegrationsView } from './components/IntegrationsView.tsx';
import { AuditLogView } from './components/AuditLogView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { PresentationDemoView } from './components/PresentationDemoView.tsx';
import { MeetingsListView } from './components/MeetingsListView.tsx';
import { GmailView } from './components/GmailView.tsx';
import {
  createMeeting,
  deleteMeeting,
  fetchCurrentUser,
  fetchDashboardData,
  fetchMeeting,
  fetchMeetings,
  fetchParticipants,
  logoutUser,
  runMeetingWorkflow,
} from './api.ts';
import {
  DashboardStats,
  Meeting,
  Organization,
  Participant,
  RecurringIssue,
  Task,
  User,
} from './types.ts';
import { AlertTriangle, Cpu, Database, Moon, Plus, Sparkles, Sun, User as UserIcon } from 'lucide-react';

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('astra_theme');
      if (stored) return stored === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [isDemoSandbox, setIsDemoSandbox] = useState<boolean>(false);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);

  // App Navigation & Data State
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [dashboardData, setDashboardData] = useState<{
    stats: DashboardStats;
    upcomingMeetings: Meeting[];
    recentMeetings: Meeting[];
    myTasks: Task[];
    openQuestions: any[];
    recentDecisions: any[];
    recurringIssues: any[];
  } | null>(null);

  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync dark mode class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('astra_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('astra_theme', 'light');
    }
  }, [darkMode]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Auth check on mount
  useEffect(() => {
    fetchCurrentUser()
      .then((res) => {
        setCurrentUser(res.user);
        setCurrentOrg(res.organization);
        setIsDemoSandbox(res.organization.id === 'org-demo-sandbox');
        loadAllWorkspaceData();
      })
      .catch((err) => {
        logoutUser();
        setCurrentUser(null);
        setCurrentOrg(null);
      })
      .finally(() => {
        setIsAuthChecking(false);
      });
  }, []);

  const loadAllWorkspaceData = async () => {
    setLoading(true);
    try {
      const [dash, meetingsList, participantsList] = await Promise.all([
        fetchDashboardData().catch(() => null),
        fetchMeetings().catch(() => []),
        fetchParticipants().catch(() => []),
      ]);

      if (dash) setDashboardData(dash);
      setMeetings(meetingsList);
      setParticipants(participantsList);

      if (meetingsList.length > 0 && !selectedMeetingId) {
        setSelectedMeetingId(meetingsList[0].id);
        setSelectedMeeting(meetingsList[0]);
      }
    } catch (err) {
      console.error('Failed to load workspace data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSuccess = (user: User, organization: Organization, isDemo = false) => {
    setCurrentUser(user);
    setCurrentOrg(organization);
    setIsDemoSandbox(isDemo);
    setActiveTab('dashboard');
    showToast(`Signed in to ${organization.name} as ${user.name}`);
    loadAllWorkspaceData();
  };

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null);
    setCurrentOrg(null);
    setIsDemoSandbox(false);
    setMeetings([]);
    setDashboardData(null);
    setSelectedMeetingId(null);
    setSelectedMeeting(null);
    setActiveTab('dashboard');
    showToast('Signed out of workspace.');
  };

  const handleExitDemo = () => {
    handleLogout();
  };

  const refreshSelectedMeeting = async (id = selectedMeetingId) => {
    if (!id) return;
    try {
      const data = await fetchMeeting(id);
      setSelectedMeeting(data);
      setMeetings((prev) => prev.map((m) => (m.id === id ? data : m)));
      const dash = await fetchDashboardData();
      setDashboardData(dash);
    } catch (err) {
      console.error('Failed to refresh meeting:', err);
    }
  };

  const handleSelectMeeting = async (id: string, targetTab = 'workflow') => {
    setSelectedMeetingId(id);
    await refreshSelectedMeeting(id);
    setActiveTab(targetTab);
  };

  const handleCreateMeeting = async (payload: Partial<Meeting>, customTranscript?: string) => {
    try {
      const created = await createMeeting(payload);
      showToast(`Meeting "${created.title}" registered in database. Launching multi-agent lifecycle...`);
      setSelectedMeetingId(created.id);
      setSelectedMeeting(created);
      setMeetings([created, ...meetings]);
      setActiveTab('workflow');

      // Auto-run autonomous pipeline
      runMeetingWorkflow(created.id, customTranscript)
        .then(async (updated) => {
          setSelectedMeeting(updated);
          setMeetings((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
          const dash = await fetchDashboardData();
          setDashboardData(dash);
          showToast(`✓ Autonomous pipeline complete for "${updated.title}"!`);
        })
        .catch((err) => {
          showToast(`Workflow paused: ${err.message}`);
        });
    } catch (err: any) {
      showToast(`Error creating meeting: ${err.message}`);
    }
  };

  const handleDeleteMeeting = async (id: string) => {
    try {
      await deleteMeeting(id);
      setMeetings((prev) => prev.filter((m) => m.id !== id));
      if (selectedMeetingId === id) {
        setSelectedMeetingId(null);
        setSelectedMeeting(null);
      }
      showToast('Meeting record deleted.');
      const dash = await fetchDashboardData();
      setDashboardData(dash);
    } catch (err: any) {
      showToast(`Error deleting meeting: ${err.message}`);
    }
  };

  const handleScheduleFollowUp = (issue: RecurringIssue) => {
    setActiveTab('new-meeting');
    showToast(`Pre-filling follow-up meeting for recurring issue: ${issue.topic}`);
  };

  // If checking authentication
  if (isAuthChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-500">
        <div className="flex flex-col items-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
          <p className="text-xs font-semibold">Initializing ASTRA_V1 Workspace...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, show corporate login/registration
  if (!currentUser || !currentOrg) {
    return (
      <AuthView
        onAuthSuccess={handleAuthSuccess}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 font-sans antialiased transition-colors">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center space-x-2.5 rounded-xl border border-teal-600 bg-teal-900 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-2xl animate-in fade-in slide-in-from-bottom-3">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Corporate Multi-Tenant Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        currentOrg={currentOrg}
        isDemoSandbox={isDemoSandbox}
        onExitDemo={handleExitDemo}
        onLogout={handleLogout}
        onNewMeeting={() => setActiveTab('new-meeting')}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Prominent Simulated Demo Mode Top Banner if in sandbox */}
        {isDemoSandbox && (
          <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-between shadow-xs sticky top-0 z-30">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4" />
              <span>
                DEMO MODE ACTIVE • You are viewing simulated demo data for Acme Robotics. Production database is isolated and clean.
              </span>
            </div>
            <button
              onClick={handleExitDemo}
              className="rounded bg-slate-900 px-2.5 py-1 text-[11px] text-white hover:bg-slate-800 cursor-pointer"
            >
              Exit Demo Mode
            </button>
          </div>
        )}

        {/* Top Workspace Header Bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 px-6 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90 transition-colors">
          <div className="flex items-center space-x-3 text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-300">
              {currentOrg.name}
            </span>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <span className="capitalize font-semibold text-teal-600 dark:text-teal-400">
              {activeTab.replace('-', ' ')}
            </span>
          </div>

          <div className="flex items-center space-x-3">
            {/* Day / Night Theme Quick Toggle */}
            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              className="flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer shadow-2xs"
              title={darkMode ? 'Switch to Day Mode (Light)' : 'Switch to Night Mode (Dark)'}
            >
              {darkMode ? (
                <>
                  <Sun className="h-3.5 w-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Day</span>
                </>
              ) : (
                <>
                  <Moon className="h-3.5 w-3.5 text-indigo-500" />
                  <span className="hidden sm:inline">Night</span>
                </>
              )}
            </button>

            {/* Engine Indicator */}
            <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px]">
                {dashboardData?.stats?.engineMode === 'GEMINI_LLM' ? 'Gemini 3.8 Flash' : 'ASTRA Offline NLU'}
              </span>
            </div>

            {/* User Role Chip */}
            <span className="hidden md:inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {currentUser.role}
            </span>

            {/* Quick Action Button */}
            <button
              onClick={() => setActiveTab('new-meeting')}
              className="flex items-center space-x-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-teal-700 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Meeting</span>
            </button>
          </div>
        </header>

        {/* Viewport Container */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              stats={dashboardData?.stats || null}
              upcomingMeetings={dashboardData?.upcomingMeetings || []}
              recentMeetings={dashboardData?.recentMeetings || []}
              myTasks={dashboardData?.myTasks || []}
              openQuestions={dashboardData?.openQuestions || []}
              recentDecisions={dashboardData?.recentDecisions || []}
              recurringIssues={dashboardData?.recurringIssues || []}
              currentUser={currentUser}
              onNewMeeting={() => setActiveTab('new-meeting')}
              onSelectMeeting={handleSelectMeeting}
              onGoToTab={setActiveTab}
              onRefresh={loadAllWorkspaceData}
              loading={loading}
            />
          )}

          {activeTab === 'meetings' && (
            <MeetingsListView
              meetings={meetings}
              onSelectMeeting={handleSelectMeeting}
              onNewMeeting={() => setActiveTab('new-meeting')}
              onDeleteMeeting={handleDeleteMeeting}
            />
          )}

          {activeTab === 'new-meeting' && (
            <NewMeetingWizard
              participants={participants}
              onCancel={() => setActiveTab('dashboard')}
              onSubmit={handleCreateMeeting}
            />
          )}

          {activeTab === 'workflow' && selectedMeeting && (
            <WorkflowView
              meeting={selectedMeeting}
              onRefreshMeeting={() => refreshSelectedMeeting(selectedMeeting.id)}
              onGoToMinutes={() => setActiveTab('minutes')}
              onBack={() => setActiveTab('meetings')}
            />
          )}

          {activeTab === 'minutes' && selectedMeeting && (
            <MinutesView
              meeting={selectedMeeting}
              onBack={() => setActiveTab('meetings')}
              onGoToWorkflow={() => setActiveTab('workflow')}
            />
          )}

          {activeTab === 'tasks' && (
            <TasksView
              currentUser={currentUser}
              meetings={meetings}
              onSelectMeeting={(id) => handleSelectMeeting(id, 'minutes')}
            />
          )}

          {activeTab === 'memory' && (
            <MemoryView
              onScheduleFollowUp={handleScheduleFollowUp}
              onSelectMeeting={(id) => handleSelectMeeting(id, 'minutes')}
            />
          )}

          {activeTab === 'gmail' && (
            <GmailView
              recentMeetings={meetings}
              onSelectMeeting={(id) => handleSelectMeeting(id, 'minutes')}
            />
          )}

          {activeTab === 'calendar' && (
            <CalendarView
              meetings={meetings}
              currentUser={currentUser}
              onSelectMeeting={(id) => handleSelectMeeting(id, 'minutes')}
              onNewMeeting={() => setActiveTab('new-meeting')}
              onGoToIntegrations={() => setActiveTab('integrations')}
              onGoToTasks={() => setActiveTab('tasks')}
            />
          )}

          {activeTab === 'analytics' && <AnalyticsView />}

          {activeTab === 'integrations' && <IntegrationsView />}

          {activeTab === 'audit-log' && <AuditLogView />}

          {activeTab === 'settings' && (
            <SettingsView
              currentUser={currentUser}
              currentOrg={currentOrg}
              darkMode={darkMode}
              setDarkMode={setDarkMode}
            />
          )}

          {activeTab === 'demo' && (
            <PresentationDemoView onSelectMeeting={handleSelectMeeting} />
          )}
        </main>

        {/* Professional Compact Footer */}
        <footer className="mt-auto border-t border-slate-200/60 bg-white/60 backdrop-blur-md px-4 py-2 sm:px-6 lg:px-8 dark:border-slate-800/60 dark:bg-slate-900/60 transition-colors">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-1.5 text-[11px] tracking-tight text-slate-400 dark:text-slate-500">
            <div className="flex items-center space-x-2">
              <span className="font-semibold tracking-wider text-slate-700 dark:text-slate-300">ASTRA</span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span>&copy; {new Date().getFullYear()} All rights reserved.</span>
            </div>
            <div className="flex items-center space-x-1">
              <span>Created by</span>
              <span className="font-medium text-slate-700 hover:text-teal-600 dark:text-slate-300 dark:hover:text-teal-400 transition-colors">
                Chaitali Raut &amp; Team
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
