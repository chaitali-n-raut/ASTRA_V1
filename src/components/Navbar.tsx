import React from 'react';
import {
  Calendar,
  CheckSquare,
  Clock,
  Cpu,
  Database,
  FileText,
  Home,
  Moon,
  PlusCircle,
  Presentation,
  Sun,
} from 'lucide-react';
import { DashboardStats } from '../types.ts';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  stats: DashboardStats | null;
  onNewMeetingClick: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  darkMode,
  setDarkMode,
  stats,
  onNewMeetingClick,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'meetings', label: 'Meetings', icon: Clock },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare, badge: stats?.openActionItems },
    { id: 'memory', label: 'Memory & RAG', icon: Database, badge: stats?.recurringIssuesCount },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'demo', label: 'Presentation Defense', icon: Presentation, highlight: true },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90 transition-colors">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand / Logo */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-600 text-white shadow-sm font-semibold tracking-wider text-lg">
            A
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold tracking-tight text-slate-900 dark:text-white text-lg">
                ASTRA<span className="text-teal-600 dark:text-teal-400">_V1</span>
              </span>
              <span className="hidden sm:inline-block rounded bg-teal-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200/50 dark:border-teal-800/50">
                v1.0 Academic Edition
              </span>
            </div>
            <p className="hidden md:block text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Autonomous Synchronization, Transcription & Resolution Assistant
            </p>
          </div>
        </div>

        {/* Center Navigation Links */}
        <nav className="hidden lg:flex items-center space-x-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300'
                    : item.highlight
                    ? 'text-teal-600 hover:bg-teal-50/50 dark:text-teal-400 dark:hover:bg-slate-800'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-teal-600 dark:text-teal-400' : ''}`} />
                <span>{item.label}</span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span className="ml-1 rounded-full bg-slate-200 px-1.5 py-0.2 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Action & Status Controls */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Engine Status Badge */}
          <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px]">
              {stats?.engineMode === 'GEMINI_LLM' ? 'Gemini 3.8 Flash' : 'Deterministic AI (Offline)'}
            </span>
          </div>

          {/* New Meeting CTA */}
          <button
            onClick={onNewMeetingClick}
            className="flex items-center space-x-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs sm:text-sm font-medium text-white shadow-sm hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-all cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            <span className="hidden sm:inline">New Meeting</span>
            <span className="sm:hidden">New</span>
          </button>

          {/* Dark Mode Toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode for Focus'}
            aria-label="Toggle dark mode"
          >
            {darkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Subnav */}
      <div className="flex lg:hidden overflow-x-auto border-t border-slate-200 px-2 py-1.5 dark:border-slate-800 scrollbar-none bg-slate-50/50 dark:bg-slate-900/50">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex shrink-0 items-center space-x-1 px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-teal-600 text-white font-semibold'
                  : 'text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{item.label}</span>
              {typeof item.badge === 'number' && item.badge > 0 && (
                <span className={`ml-0.5 rounded-full px-1 text-[9px] ${isActive ? 'bg-white text-teal-800 font-bold' : 'bg-slate-200 dark:bg-slate-700'}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
};
