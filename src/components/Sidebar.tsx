import React from 'react';
import {
  BarChart3,
  Calendar,
  CheckSquare,
  Clock,
  Database,
  History,
  Home,
  LogOut,
  Mail,
  Moon,
  Plus,
  Radio,
  Settings,
  ShieldCheck,
  Sun,
  User,
} from 'lucide-react';
import { Organization, User as UserType } from '../types.ts';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: UserType | null;
  currentOrg: Organization | null;
  isDemoSandbox: boolean;
  onExitDemo: () => void;
  onLogout: () => void;
  onNewMeeting: () => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  currentOrg,
  isDemoSandbox,
  onExitDemo,
  onLogout,
  onNewMeeting,
  darkMode,
  setDarkMode,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'meetings', label: 'Meetings', icon: Clock },
    { id: 'tasks', label: 'Tasks & Actions', icon: CheckSquare },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'memory', label: 'Memory & Retrieval', icon: Database },
    { id: 'gmail', label: 'Gmail', icon: Mail },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'integrations', label: 'Integrations', icon: Radio },
    { id: 'audit-log', label: 'Audit Log', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between transition-colors z-40 select-none">
      <div className="flex flex-col h-full">
        {/* Organization / Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-white font-bold text-base shadow-xs">
              A
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                  ASTRA<span className="text-teal-600 dark:text-teal-400">_V1</span>
                </span>
                <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 text-[9px] font-semibold text-slate-600 dark:text-slate-400">
                  SaaS
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {currentOrg?.name || 'Workspace'}
              </div>
            </div>
          </div>

          {/* Prominent Demo Mode Indicator */}
          {isDemoSandbox && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 dark:border-amber-900/60 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-xs space-y-1">
              <div className="font-bold flex items-center justify-between">
                <span>SIMULATED DEMO MODE</span>
                <button
                  onClick={onExitDemo}
                  className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold underline cursor-pointer"
                >
                  Exit Demo
                </button>
              </div>
              <p className="text-[10px] text-amber-800/90 dark:text-amber-300/80">
                All data displayed is simulated for presentation purposes.
              </p>
            </div>
          )}

          {/* Quick Create Button */}
          <button
            onClick={onNewMeeting}
            className="w-full mt-1 flex items-center justify-center space-x-1.5 rounded-lg bg-teal-600 py-2 text-xs font-semibold text-white shadow-xs hover:bg-teal-700 transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Meeting</span>
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                  isActive
                    ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Footer Profile & Settings */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
          {/* Day & Night Theme Switcher */}
          <div className="rounded-lg bg-slate-100 p-1 dark:bg-slate-800/80 flex items-center text-xs">
            <button
              type="button"
              onClick={() => setDarkMode(false)}
              className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded-md font-semibold transition-all cursor-pointer ${
                !darkMode
                  ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-900 dark:text-teal-300'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Sun className={`h-3.5 w-3.5 ${!darkMode ? 'text-amber-500' : ''}`} />
              <span>Day</span>
            </button>
            <button
              type="button"
              onClick={() => setDarkMode(true)}
              className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded-md font-semibold transition-all cursor-pointer ${
                darkMode
                  ? 'bg-white text-teal-700 shadow-2xs dark:bg-slate-900 dark:text-teal-300'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Moon className={`h-3.5 w-3.5 ${darkMode ? 'text-indigo-400' : ''}`} />
              <span>Night</span>
            </button>
          </div>

          {/* User badge */}
          {currentUser && (
            <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center space-x-2 min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 text-xs font-bold">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {currentUser.name}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {currentUser.role}
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={onLogout}
            className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-700 dark:text-slate-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
