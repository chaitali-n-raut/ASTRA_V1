import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Inbox,
  LogOut,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react';
import {
  fetchGmailMessageDetail,
  fetchGmailMessages,
  fetchGmailProfile,
  GmailMessageDetail,
  GmailMessageSummary,
  GmailProfile,
  sendGmailMessage,
} from '../services/gmailApi.ts';
import {
  getGoogleAccessToken,
  googleSignIn,
  googleSignOut,
  initGoogleAuth,
  setGoogleAccessToken,
} from '../services/googleAuth.ts';
import { Meeting } from '../types.ts';
import { User as FirebaseUser } from 'firebase/auth';

interface GmailViewProps {
  recentMeetings?: Meeting[];
  onSelectMeeting?: (id: string) => void;
}

export const GmailView: React.FC<GmailViewProps> = ({ recentMeetings = [], onSelectMeeting }) => {
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(getGoogleAccessToken());
  const [profile, setProfile] = useState<GmailProfile | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // Messages state
  const [messages, setMessages] = useState<GmailMessageSummary[]>([]);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMessage, setSelectedMessage] = useState<GmailMessageDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Compose State
  const [isComposing, setIsComposing] = useState<boolean>(false);
  const [composeTo, setComposeTo] = useState<string>('');
  const [composeSubject, setComposeSubject] = useState<string>('');
  const [composeBody, setComposeBody] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);

  // Mandatory Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    to: string;
    subject: string;
    body: string;
  } | null>(null);

  // Toast / Status messages
  const [statusNotice, setStatusNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showStatus = (type: 'success' | 'error', message: string) => {
    setStatusNotice({ type, message });
    setTimeout(() => setStatusNotice(null), 5000);
  };

  // Initialize auth listener
  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (user, token) => {
        setGoogleUser(user);
        setAccessToken(token);
        setGoogleAccessToken(token);
        loadProfile(token);
        loadInbox(token);
      },
      () => {
        setGoogleUser(null);
        setAccessToken(null);
        setProfile(null);
        setMessages([]);
      }
    );

    // If token already present in memory on mount
    const existing = getGoogleAccessToken();
    if (existing) {
      setAccessToken(existing);
      loadProfile(existing);
      loadInbox(existing);
    }

    return () => unsubscribe();
  }, []);

  const loadProfile = async (token: string) => {
    try {
      const p = await fetchGmailProfile(token);
      setProfile(p);
    } catch (err) {
      console.warn('Could not load Gmail profile:', err);
    }
  };

  const loadInbox = async (token = accessToken, query = searchQuery) => {
    if (!token) return;
    setLoadingMessages(true);
    try {
      const data = await fetchGmailMessages(token, { query: query.trim() || undefined, maxResults: 15 });
      setMessages(data.messages);
    } catch (err: any) {
      console.error('Failed to load Gmail messages:', err);
      showStatus('error', err.message || 'Failed to load inbox messages');
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setAccessToken(result.accessToken);
        showStatus('success', `Connected to Gmail as ${result.user.email}`);
        await loadProfile(result.accessToken);
        await loadInbox(result.accessToken);
      }
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
      showStatus('error', err.message || 'Google Sign-In failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await googleSignOut();
      setGoogleUser(null);
      setAccessToken(null);
      setProfile(null);
      setMessages([]);
      setSelectedMessage(null);
      showStatus('success', 'Disconnected from Gmail.');
    } catch (err: any) {
      showStatus('error', err.message || 'Disconnect failed');
    }
  };

  const handleSelectMessage = async (summary: GmailMessageSummary) => {
    if (!accessToken) return;
    setLoadingDetail(true);
    try {
      const full = await fetchGmailMessageDetail(accessToken, summary.id);
      setSelectedMessage(full);
    } catch (err: any) {
      showStatus('error', err.message || 'Failed to load email details');
    } finally {
      setLoadingDetail(false);
    }
  };

  // Opens Mandatory Confirmation Modal
  const handleInitiateSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeTo.trim()) {
      showStatus('error', 'Recipient email is required.');
      return;
    }
    if (!composeSubject.trim()) {
      showStatus('error', 'Email subject is required.');
      return;
    }

    setConfirmDialog({
      isOpen: true,
      to: composeTo.trim(),
      subject: composeSubject.trim(),
      body: composeBody.trim(),
    });
  };

  // Executes after explicit user confirmation
  const handleConfirmSend = async () => {
    if (!confirmDialog || !accessToken) return;

    setSending(true);
    const { to, subject, body } = confirmDialog;
    setConfirmDialog(null);

    try {
      await sendGmailMessage(accessToken, {
        to,
        subject,
        bodyText: body,
      });

      showStatus('success', `Email sent successfully to ${to}`);
      setIsComposing(false);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
      await loadInbox(accessToken);
    } catch (err: any) {
      console.error('Failed to send email:', err);
      showStatus('error', err.message || 'Failed to send email via Gmail.');
    } finally {
      setSending(false);
    }
  };

  // Pre-fill meeting template into compose form
  const handleUseMeetingTemplate = (meeting: Meeting) => {
    setIsComposing(true);
    const recipients = meeting.participants.map((p) => p.email).filter(Boolean).join(', ');
    setComposeTo(recipients);
    setComposeSubject(`[ASTRA] Meeting Minutes & Resolution: ${meeting.title}`);

    const decisionsText =
      meeting.decisions && meeting.decisions.length > 0
        ? meeting.decisions.map((d, i) => `${i + 1}. ${d.text} (Confidence: ${Math.round(d.confidence * 100)}%)`).join('\n')
        : 'None recorded.';

    const actionsText =
      meeting.actionItems && meeting.actionItems.length > 0
        ? meeting.actionItems
            .map((a, i) => `${i + 1}. [${a.status}] ${a.text} — Assigned to: ${a.owner} (Due: ${a.deadline})`)
            .join('\n')
        : 'None recorded.';

    setComposeBody(
      `Hello Team,\n\nHere are the official meeting minutes and autonomous action items recorded by ASTRA for "${meeting.title}":\n\n` +
        `Date: ${meeting.preferredDate || new Date().toISOString().split('T')[0]}\n` +
        `Status: ${meeting.status}\n\n` +
        `--- KEY DECISIONS ---\n${decisionsText}\n\n` +
        `--- ACTION ITEMS & DELIVERABLES ---\n${actionsText}\n\n` +
        `Best regards,\nASTRA Autonomous Meeting Intelligence`
    );
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">
                Google Workspace Integration
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-xs text-slate-500">Official Gmail API</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center space-x-2.5">
              <Mail className="h-6 w-6 text-teal-600 dark:text-teal-400" />
              <span>Gmail Workspace Hub</span>
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
              Connect your authorized Google Workspace Gmail account to read messages, compose and dispatch meeting minutes, and coordinate action items directly with meeting participants.
            </p>
          </div>

          {/* Connect / Disconnect Button */}
          {accessToken ? (
            <div className="flex items-center space-x-3 self-start sm:self-center">
              <button
                type="button"
                onClick={() => setIsComposing(true)}
                className="flex items-center space-x-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-teal-700 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Compose Email</span>
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                className="flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Disconnect</span>
              </button>
            </div>
          ) : (
            <div className="self-start sm:self-center">
              {/* Official Google Sign-In Button */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className="flex items-center space-x-2.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer disabled:opacity-50 transition-colors"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 48 48">
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
                <span>{isLoggingIn ? 'Connecting to Google...' : 'Sign in with Google (Gmail)'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Account Info Banner if Connected */}
        {accessToken && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2.5">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-slate-600 dark:text-slate-400">
                Connected Account: <strong className="text-slate-900 dark:text-white">{profile?.emailAddress || googleUser?.email}</strong>
              </span>
            </div>
            {profile && (
              <div className="flex items-center space-x-3 text-slate-500 dark:text-slate-400">
                <span>Total Messages: <strong>{profile.messagesTotal.toLocaleString()}</strong></span>
                <span>•</span>
                <span>Threads: <strong>{profile.threadsTotal.toLocaleString()}</strong></span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status Notice Toast */}
      {statusNotice && (
        <div
          className={`rounded-xl border p-4 text-xs font-semibold flex items-center space-x-2.5 ${
            statusNotice.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300'
              : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300'
          }`}
        >
          {statusNotice.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          )}
          <span>{statusNotice.message}</span>
        </div>
      )}

      {/* Main Gmail View Content */}
      {!accessToken ? (
        /* Unconnected Promotional & Instructions Card */
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400">
            <Mail className="h-7 w-7" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Connect Gmail to Supercharge Meeting Collaboration
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Link your Gmail inbox to autonomously review meeting invitations, email minutes, and dispatch task reminders directly from ASTRA.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              className="inline-flex items-center space-x-2.5 rounded-lg bg-teal-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-teal-700 cursor-pointer"
            >
              <span>{isLoggingIn ? 'Connecting...' : 'Authorize Gmail Access'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Connected Layout: Inbox + Message View + Quick Templates */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Quick Meeting Dispatcher (3 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
              <h2 className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                <Send className="h-3.5 w-3.5 text-teal-600" />
                <span>Dispatch Meeting Minutes via Gmail</span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Select a meeting to pre-fill attendees and autonomous minutes into a Gmail draft ready to send.
              </p>

              {recentMeetings.length === 0 ? (
                <div className="rounded-lg bg-slate-50 p-3 text-[11px] text-slate-500 dark:bg-slate-800/50 text-center">
                  No meeting records available yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {recentMeetings.slice(0, 4).map((m) => (
                    <div
                      key={m.id}
                      className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:border-teal-400 dark:hover:border-teal-600 transition-colors space-y-1.5"
                    >
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {m.title}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {m.participants.length} participant(s) • {m.actionItems?.length || 0} action item(s)
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUseMeetingTemplate(m)}
                        className="w-full flex items-center justify-center space-x-1 rounded bg-white dark:bg-slate-900 py-1.5 text-[11px] font-semibold text-teal-700 dark:text-teal-300 border border-slate-200 dark:border-slate-700 hover:bg-teal-50 dark:hover:bg-teal-950/40 cursor-pointer shadow-2xs"
                      >
                        <Mail className="h-3 w-3" />
                        <span>Load Template</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Gmail Messages & Viewer (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {/* Search & Refresh Bar */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  loadInbox(accessToken, searchQuery);
                }}
                className="relative w-full sm:w-80"
              >
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search Gmail messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:border-teal-500"
                />
              </form>

              <div className="flex items-center space-x-2 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => loadInbox(accessToken, searchQuery)}
                  disabled={loadingMessages}
                  className="flex items-center space-x-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                >
                  <RefreshCw className={`h-3 w-3 ${loadingMessages ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Email Message Detail Overlay / Panel if selected */}
            {selectedMessage ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
                <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {selectedMessage.subject}
                    </h3>
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-2">
                      <span>From: <strong>{selectedMessage.from}</strong></span>
                      <span>•</span>
                      <span>To: <strong>{selectedMessage.to}</strong></span>
                      <span>•</span>
                      <span>{selectedMessage.date}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedMessage(null)}
                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Email Body */}
                <div className="text-xs text-slate-700 dark:text-slate-200 font-sans whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  {selectedMessage.bodyText || selectedMessage.snippet}
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsComposing(true);
                      setComposeTo(selectedMessage.from || '');
                      setComposeSubject(`Re: ${selectedMessage.subject}`);
                      setSelectedMessage(null);
                    }}
                    className="flex items-center space-x-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700 cursor-pointer"
                  >
                    <Send className="h-3 w-3" />
                    <span>Reply via Gmail</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Messages List */
              <div className="rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-2">
                    <Inbox className="h-4 w-4 text-teal-600" />
                    <span>Recent Gmail Inbox Messages</span>
                  </h3>
                  <span className="text-[10px] text-slate-400">
                    {messages.length} message(s) loaded
                  </span>
                </div>

                {loadingMessages ? (
                  <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto text-teal-600" />
                    <p>Loading messages from Gmail API...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                    <Mail className="h-6 w-6 mx-auto text-slate-300" />
                    <p>No messages found matching your criteria.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => handleSelectMessage(m)}
                        className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors space-y-1"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-900 dark:text-white truncate max-w-xs">
                            {m.from || 'Unknown Sender'}
                          </span>
                          <span className="text-[10px] text-slate-400">{m.date}</span>
                        </div>
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {m.subject}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                          {m.snippet}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compose Email Modal */}
      {isComposing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Send className="h-4 w-4 text-teal-600" />
                <span>Compose Email via Gmail API</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsComposing(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleInitiateSend} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Recipient Email(s)
                </label>
                <input
                  type="text"
                  required
                  placeholder="recipient@example.com"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  required
                  placeholder="Subject line"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Message Body
                </label>
                <textarea
                  rows={8}
                  required
                  placeholder="Type your message..."
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:border-teal-500 font-sans"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsComposing(false)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="flex items-center space-x-1.5 rounded-lg bg-teal-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-50 cursor-pointer shadow-2xs"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Send Email</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANDATORY USER CONFIRMATION DIALOG (per Workspace Integration Skill) */}
      {confirmDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-teal-200 bg-white p-6 shadow-2xl dark:border-teal-900 dark:bg-slate-900 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-3 text-teal-800 dark:text-teal-200">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950 border border-teal-200 dark:border-teal-800">
                <Send className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Confirm Email Dispatch via Gmail
                </h3>
                <p className="text-[11px] text-slate-500">
                  This action will send an email from your authorized Gmail account.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60 text-xs space-y-1.5">
              <div>
                <span className="font-semibold text-slate-600 dark:text-slate-400">Recipient: </span>
                <strong className="text-slate-900 dark:text-white">{confirmDialog.to}</strong>
              </div>
              <div>
                <span className="font-semibold text-slate-600 dark:text-slate-400">Subject: </span>
                <strong className="text-slate-900 dark:text-white">{confirmDialog.subject}</strong>
              </div>
              <div className="pt-1 border-t border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 line-clamp-3 italic">
                "{confirmDialog.body}"
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSend}
                disabled={sending}
                className="flex items-center space-x-1.5 rounded-lg bg-teal-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-teal-700 cursor-pointer shadow-sm"
              >
                <span>{sending ? 'Sending...' : 'Confirm & Send Email'}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
