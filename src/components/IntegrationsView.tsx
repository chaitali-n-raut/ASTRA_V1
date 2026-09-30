import React, { useEffect, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  ExternalLink,
  Info,
  Link,
  Mail,
  Radio,
  RefreshCw,
  ShieldCheck,
  Unlink,
  Video,
} from 'lucide-react';
import { Integration } from '../types.ts';
import { connectIntegration, disconnectIntegration, fetchIntegrations } from '../api.ts';
import { getGoogleAccessToken, googleSignIn, googleSignOut } from '../services/googleAuth.ts';

export const IntegrationsView: React.FC = () => {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<{
    type: 'connect' | 'disconnect';
    provider: string;
    providerName: string;
  } | null>(null);
  const [modalEmail, setModalEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadIntegrations = async () => {
    setLoading(true);
    try {
      const data = await fetchIntegrations();
      setIntegrations(data);
    } catch (err) {
      console.error('Failed to load integrations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIntegrations();
  }, []);

  const openConnectModal = async (provider: string, name: string) => {
    setErrorMessage(null);
    if (provider === 'gmail') {
      setActionLoading('gmail');
      try {
        const result = await googleSignIn();
        if (result) {
          await connectIntegration('gmail', result.user.email || 'Google Workspace Account');
          await loadIntegrations();
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Google authentication failed.');
      } finally {
        setActionLoading(null);
      }
      return;
    }
    setModalEmail('');
    setActiveModal({ type: 'connect', provider, providerName: name });
  };

  const openDisconnectModal = (provider: string, name: string) => {
    setErrorMessage(null);
    setActiveModal({ type: 'disconnect', provider, providerName: name });
  };

  const handleConfirmConnect = async () => {
    if (!activeModal) return;
    const provider = activeModal.provider;
    if (!modalEmail.trim()) {
      setErrorMessage('Please enter an account email to link.');
      return;
    }

    setActionLoading(provider);
    try {
      await connectIntegration(provider, modalEmail.trim());
      await loadIntegrations();
      setActiveModal(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Integration connection failed.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmDisconnect = async () => {
    if (!activeModal) return;
    const provider = activeModal.provider;
    setActionLoading(provider);
    try {
      if (provider === 'gmail') {
        await googleSignOut();
      }
      await disconnectIntegration(provider);
      await loadIntegrations();
      setActiveModal(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to disconnect integration.');
    } finally {
      setActionLoading(null);
    }
  };

  const categories = [
    { id: 'email', title: 'Email & Workspace Communications', icon: Mail },
    { id: 'calendar', title: 'Calendar & Availability Providers', icon: Calendar },
    { id: 'video', title: 'Video Conferencing Services', icon: Video },
    { id: 'task', title: 'Task & Issue Trackers', icon: Radio },
  ];

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">
                Connected Systems & Integrations
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-xs text-slate-500">Zero Simulated Synchronization</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Enterprise Integrations
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
              Connect your organizational tools. When not connected, ASTRA strictly displays <strong>Not Connected</strong> and avoids fabricating synchronization states.
            </p>
          </div>

          <button
            onClick={loadIntegrations}
            className="flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer self-start sm:self-center"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Check Status</span>
          </button>
        </div>
      </div>

      {/* Categories */}
      {categories.map((cat) => {
        const items = integrations.filter((i) => i.category === cat.id);
        const Icon = cat.icon;
        return (
          <section key={cat.id} className="space-y-3">
            <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-200 font-semibold text-sm">
              <Icon className="h-4 w-4 text-teal-600" />
              <h2>{cat.title}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between">
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                        {item.name}
                      </h3>
                      {item.status === 'CONNECTED' ? (
                        <span className="inline-flex items-center space-x-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          <span>CONNECTED</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          NOT CONNECTED
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {item.category === 'calendar'
                        ? 'Enables real conflict verification and autonomous calendar booking.'
                        : item.category === 'video'
                        ? 'Generates real authenticated meeting URLs and attendee links.'
                        : 'Synchronizes meeting action items directly into your project backlogs.'}
                    </p>

                    {item.status === 'CONNECTED' && (
                      <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/60 text-xs space-y-1">
                        <div className="text-[11px] text-slate-600 dark:text-slate-300">
                          Authorized Account: <strong>{item.connectedAccount}</strong>
                        </div>
                        {item.lastSyncedAt && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            Last active: {new Date(item.lastSyncedAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                    {item.status === 'CONNECTED' ? (
                      <button
                        onClick={() => openDisconnectModal(item.provider, item.name)}
                        disabled={actionLoading === item.provider}
                        className="flex items-center space-x-1 text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 cursor-pointer"
                      >
                        <Unlink className="h-3 w-3" />
                        <span>Disconnect</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => openConnectModal(item.provider, item.name)}
                        disabled={actionLoading === item.provider}
                        className="flex items-center space-x-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 cursor-pointer shadow-2xs"
                      >
                        <Link className="h-3 w-3" />
                        <span>Connect {item.name}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {/* Confirmation & Connection Modal */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {activeModal.type === 'connect'
                ? `Connect ${activeModal.providerName}`
                : `Disconnect ${activeModal.providerName}`}
            </h3>

            {errorMessage && (
              <div className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                {errorMessage}
              </div>
            )}

            {activeModal.type === 'connect' ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Enter the organizational account email associated with {activeModal.providerName} to authorize automated sync.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Account Email
                  </label>
                  <input
                    type="email"
                    value={modalEmail}
                    onChange={(e) => setModalEmail(e.target.value)}
                    placeholder="user@enterprise.com"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Are you sure you want to disconnect {activeModal.providerName}? Autonomous synchronization for this service will be stopped.
              </p>
            )}

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setActiveModal(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              {activeModal.type === 'connect' ? (
                <button
                  onClick={handleConfirmConnect}
                  disabled={actionLoading !== null}
                  className="px-4 py-1.5 rounded-lg bg-teal-600 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50 cursor-pointer shadow-2xs"
                >
                  {actionLoading ? 'Connecting...' : 'Authorize & Connect'}
                </button>
              ) : (
                <button
                  onClick={handleConfirmDisconnect}
                  disabled={actionLoading !== null}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer shadow-2xs"
                >
                  {actionLoading ? 'Disconnecting...' : 'Disconnect'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
