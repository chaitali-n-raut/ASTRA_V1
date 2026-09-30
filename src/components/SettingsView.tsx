import React, { useEffect, useState } from 'react';
import { Settings, ShieldCheck, User, Building, Cpu, Bell, CheckCircle2, Moon, Sun } from 'lucide-react';
import { AutonomySettings, Organization, User as UserType } from '../types.ts';
import { fetchAutonomySettings, updateAutonomySettings } from '../api.ts';

interface SettingsViewProps {
  currentUser: UserType | null;
  currentOrg: Organization | null;
  darkMode?: boolean;
  setDarkMode?: (val: boolean) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  currentOrg,
  darkMode = false,
  setDarkMode,
}) => {
  const [autonomy, setAutonomy] = useState<AutonomySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchAutonomySettings()
      .then((res) => {
        setAutonomy(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load autonomy settings:', err);
        setLoading(false);
      });
  }, []);

  const handleAutonomyChange = async (updates: Partial<AutonomySettings>) => {
    if (!autonomy) return;
    const updated = { ...autonomy, ...updates };
    setAutonomy(updated);
    try {
      await updateAutonomySettings(updates);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to update autonomy settings:', err);
    }
  };

  return (
    <div className="space-y-6 pb-16 max-w-4xl">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Workspace & Security Settings
        </h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Manage your organization profile, autonomous AI execution policies, and external confirmation guards.
        </p>
      </div>

      {saved && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 flex items-center space-x-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>Settings saved successfully.</span>
        </div>
      )}

      {/* Day and Night Theme Preferences */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold text-sm">
          {darkMode ? (
            <Moon className="h-5 w-5 text-indigo-400" />
          ) : (
            <Sun className="h-5 w-5 text-amber-500" />
          )}
          <h2>Day & Night Theme Preferences</h2>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Personalize your visual experience. Choose between a crisp Day mode optimized for bright ambient environments or an eye-friendly Night mode designed for high focus.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          {/* Day Theme Option */}
          <div
            onClick={() => setDarkMode?.(false)}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
              !darkMode
                ? 'border-teal-600 bg-teal-50/40 dark:border-teal-500 shadow-sm'
                : 'border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
                  <Sun className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Day Theme (Light)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Clean daylight corporate interface
                  </div>
                </div>
              </div>
              <div
                className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                  !darkMode
                    ? 'border-teal-600 bg-teal-600 text-white'
                    : 'border-slate-300 dark:border-slate-600'
                }`}
              >
                {!darkMode && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
              </div>
            </div>

            <div className="mt-3 p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-[10px] text-slate-600 space-y-1">
              <div className="font-semibold text-slate-800">Preview: Light Mode</div>
              <div className="flex space-x-1.5">
                <span className="h-2 w-8 rounded-full bg-teal-600" />
                <span className="h-2 w-12 rounded-full bg-slate-300" />
                <span className="h-2 w-6 rounded-full bg-slate-200" />
              </div>
            </div>
          </div>

          {/* Night Theme Option */}
          <div
            onClick={() => setDarkMode?.(true)}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
              darkMode
                ? 'border-teal-500 bg-teal-950/30 dark:border-teal-400 shadow-sm'
                : 'border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-lg bg-indigo-950 text-indigo-400 border border-indigo-800/60">
                  <Moon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Night Theme (Dark)
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    High focus, reduced glare & eye comfort
                  </div>
                </div>
              </div>
              <div
                className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                  darkMode
                    ? 'border-teal-500 bg-teal-500 text-white'
                    : 'border-slate-300 dark:border-slate-600'
                }`}
              >
                {darkMode && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
              </div>
            </div>

            <div className="mt-3 p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-[10px] text-slate-400 space-y-1">
              <div className="font-semibold text-slate-200">Preview: Dark Mode</div>
              <div className="flex space-x-1.5">
                <span className="h-2 w-8 rounded-full bg-teal-400" />
                <span className="h-2 w-12 rounded-full bg-slate-700" />
                <span className="h-2 w-6 rounded-full bg-slate-800" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Autonomy Policies */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold text-sm">
          <ShieldCheck className="h-5 w-5 text-teal-600" />
          <h2>AI Autonomy & External Execution Policy</h2>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Configure how ASTRA handles external actions (booking real Google Calendar events, dispatching Jira tickets, sending notifications).
        </p>

        <div className="space-y-3 pt-2">
          {[
            {
              id: 'MANUAL_APPROVAL',
              title: 'Manual Approval (Default & Recommended)',
              desc: 'AI analyzes transcripts, proposes agendas, and drafts action items. External booking and calendar updates require explicit user confirmation.',
            },
            {
              id: 'APPROVAL_FOR_EXTERNAL',
              title: 'Approval for External Actions Only',
              desc: 'Internal meeting scheduling and task generation run autonomously. Third-party calendar and ticketing APIs require review.',
            },
            {
              id: 'FULLY_AUTONOMOUS',
              title: 'Fully Autonomous Policy',
              desc: 'Agents automatically book confirmed slots and synchronize tasks upon transcript processing without intermediate prompts.',
            },
          ].map((policy) => (
            <label
              key={policy.id}
              className={`flex items-start space-x-3 p-3.5 rounded-lg border cursor-pointer transition-colors ${
                autonomy?.policy === policy.id
                  ? 'border-teal-600 bg-teal-50/50 dark:border-teal-500 dark:bg-teal-950/30'
                  : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40'
              }`}
            >
              <input
                type="radio"
                name="autonomyPolicy"
                value={policy.id}
                checked={autonomy?.policy === policy.id}
                onChange={() => handleAutonomyChange({ policy: policy.id as any })}
                className="mt-1 h-4 w-4 text-teal-600 focus:ring-teal-500"
              />
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  {policy.title}
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {policy.desc}
                </p>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Organization Profile */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
        <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold text-sm">
          <Building className="h-5 w-5 text-teal-600" />
          <h2>Organization Details</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
          <div>
            <span className="text-slate-500 font-medium">Organization Name</span>
            <div className="font-semibold text-slate-900 dark:text-white mt-1">
              {currentOrg?.name || 'My Organization'}
            </div>
          </div>
          <div>
            <span className="text-slate-500 font-medium">Subscription Tier</span>
            <div className="font-semibold text-slate-900 dark:text-white mt-1">
              {currentOrg?.plan || 'Free'} (Corporate Trial)
            </div>
          </div>
        </div>
      </section>

      {/* User Profile */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
        <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold text-sm">
          <User className="h-5 w-5 text-teal-600" />
          <h2>Current Operator Profile</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-1">
          <div>
            <span className="text-slate-500 font-medium">Name</span>
            <div className="font-semibold text-slate-900 dark:text-white mt-1">
              {currentUser?.name}
            </div>
          </div>
          <div>
            <span className="text-slate-500 font-medium">Email Address</span>
            <div className="font-semibold text-slate-900 dark:text-white mt-1">
              {currentUser?.email}
            </div>
          </div>
          <div>
            <span className="text-slate-500 font-medium">Role</span>
            <div className="font-semibold text-slate-900 dark:text-white mt-1">
              {currentUser?.role}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
