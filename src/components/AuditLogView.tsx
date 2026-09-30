import React, { useEffect, useState } from 'react';
import { History, RefreshCw, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { AuditLog } from '../types.ts';
import { fetchAuditLogs } from '../api.ts';

export const AuditLogView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await fetchAuditLogs();
      setLogs(data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <div className="space-y-6 pb-16">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">
                Security & Compliance
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-xs text-slate-500">Immutable Audit Trail</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              System Audit Logs
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Complete historical record of user interactions, autonomous agent executions, and external API requests.
            </p>
          </div>

          <button
            onClick={loadLogs}
            className="flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer self-start sm:self-center"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh Logs</span>
          </button>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
          <History className="mx-auto h-8 w-8 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            No audit records yet
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Audit entries will be logged automatically as your organization creates meetings, runs agent pipelines, or updates settings.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">Actor / User</th>
                <th className="p-3.5">Action</th>
                <th className="p-3.5">Resource</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="p-3.5 text-slate-500 font-mono whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}{' '}
                    <span className="text-[10px] text-slate-400">
                      {new Date(log.timestamp).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="p-3.5 font-semibold text-slate-900 dark:text-white">
                    {log.userName}
                  </td>
                  <td className="p-3.5 font-mono text-[11px] text-teal-700 dark:text-teal-400 font-semibold">
                    {log.action}
                  </td>
                  <td className="p-3.5 text-slate-700 dark:text-slate-300">
                    {log.resource}
                  </td>
                  <td className="p-3.5 whitespace-nowrap">
                    {log.result === 'SUCCESS' ? (
                      <span className="inline-flex items-center space-x-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        <span>SUCCESS</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 rounded bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800">
                        <AlertCircle className="h-2.5 w-2.5" />
                        <span>FAILED</span>
                      </span>
                    )}
                  </td>
                  <td className="p-3.5 text-slate-500 max-w-xs truncate">
                    {log.details || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
