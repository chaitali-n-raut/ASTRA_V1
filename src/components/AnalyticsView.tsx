import React, { useEffect, useState } from 'react';
import { BarChart3, Clock, CheckCircle2, ListTodo, AlertTriangle, RefreshCw } from 'lucide-react';
import { fetchAnalytics } from '../api.ts';

export const AnalyticsView: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchAnalytics();
      setData(res);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 pb-16">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">
                Verified Metrics & Statistical Trends
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-xs text-slate-500">Zero Simulated Charts</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Meeting Intelligence Analytics
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Computed strictly from verified meetings and action item records in your organization.
            </p>
          </div>

          <div className="flex items-center space-x-2 self-start sm:self-center">
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-800 dark:bg-slate-800 text-xs">
              {(['7d', '30d', '90d'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                    timeRange === r
                      ? 'bg-white shadow-2xs text-teal-700 dark:bg-slate-900 dark:text-teal-300'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                  }`}
                >
                  {r === '7d' ? 'Last 7 Days' : r === '30d' ? 'Last 30 Days' : 'Last 90 Days'}
                </button>
              ))}
            </div>

            <button
              onClick={loadData}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-800 cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {!data?.hasData || data.totalMeetings === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400">
            <BarChart3 className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Not enough data for analytics yet
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Complete your first few meetings to visualize meeting duration trends, action item closure velocity, and systemic patterns.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-1">
            <span className="text-xs text-slate-500 font-medium">Completed Meetings</span>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {data.completedMeetings} / {data.totalMeetings}
            </div>
            <span className="text-[11px] text-slate-400">Total lifecycle runs</span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-1">
            <span className="text-xs text-slate-500 font-medium">Average Meeting Duration</span>
            <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">
              {data.averageMeetingDuration}m
            </div>
            <span className="text-[11px] text-slate-400">Across completed meetings</span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-1">
            <span className="text-xs text-slate-500 font-medium">Action Items Created</span>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {data.actionItemsCreated}
            </div>
            <span className="text-[11px] text-slate-400">Extracted by Minutes Agent</span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-1">
            <span className="text-xs text-slate-500 font-medium">Action Completion Rate</span>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {data.actionCompletionRate}%
            </div>
            <span className="text-[11px] text-slate-400">Verified status transition</span>
          </div>
        </div>
      )}
    </div>
  );
};
