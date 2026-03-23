import React, { useState, useEffect } from 'react';
import { logsApi } from '../services/api';
import { ActionLog, ActionType } from '../types';
import TopBar from '../components/TopBar';
import { useSidebar } from '../App';

const Logs: React.FC = () => {
  const { toggleSidebar } = useSidebar();
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterType, setFilterType] = useState<ActionType | ''>('');
  const [filterStatus, setFilterStatus] = useState('');
  const pageSize = 20;

  useEffect(() => {
    fetchLogs();
  }, [page, filterType, filterStatus]);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const data = await logsApi.getAll(
        page,
        pageSize,
        filterType || undefined,
        filterStatus || undefined
      );
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return 'check_circle';
      case 'failed':
        return 'error';
      case 'pending':
        return 'schedule';
      case 'skipped':
        return 'skip_next';
      default:
        return 'info';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-emerald-600 bg-emerald-50';
      case 'failed':
        return 'text-red-600 bg-red-50';
      case 'pending':
        return 'text-yellow-600 bg-yellow-50';
      case 'skipped':
        return 'text-slate-600 bg-slate-50';
      default:
        return 'text-slate-600 bg-slate-50';
    }
  };

  const getActionIcon = (type: ActionType) => {
    switch (type) {
      case 'comment_reply':
        return 'chat';
      case 'dm_sent':
        return 'send';
      case 'webhook_received':
        return 'webhook';
      case 'error':
        return 'warning';
      default:
        return 'smart_toy';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatActionType = (type: ActionType) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Activity Logs" onMenuToggle={toggleSidebar} />
      <main className="p-4 sm:p-6 lg:p-8">
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold uppercase tracking-wider text-outline">
              Action Type
            </label>
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value as ActionType | '');
                setPage(1);
              }}
              className="bg-surface-container-highest border-none rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">All Types</option>
              <option value="comment_reply">Comment Reply</option>
              <option value="dm_sent">DM Sent</option>
              <option value="webhook_received">Webhook Received</option>
              <option value="error">Error</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold uppercase tracking-wider text-outline">
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
              className="bg-surface-container-highest border-none rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">All Statuses</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
              <option value="skipped">Skipped</option>
            </select>
          </div>

          <button
            onClick={fetchLogs}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface-container-lowest rounded-lg shadow-sm text-sm font-bold text-on-surface hover:bg-surface-container-low transition-colors"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Refresh
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="loading-spinner" />
            <p className="mt-4 text-on-surface-variant text-sm">Loading logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="material-symbols-outlined text-5xl text-outline mb-4">
              description
            </span>
            <h2 className="text-xl font-bold text-on-surface mb-2 font-headline">
              No logs found
            </h2>
            <p className="text-sm text-on-surface-variant">
              {filterType || filterStatus
                ? 'Try adjusting your filters'
                : 'Activity logs will appear here when automations run'}
            </p>
          </div>
        ) : (
          <>
            <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="bg-surface-container-low">
                    <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-outline">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-outline">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-outline">
                      Message
                    </th>
                    <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-outline">
                      Details
                    </th>
                    <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-outline">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-low">
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-surface-container-low/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${getStatusColor(
                            log.status
                          )}`}
                        >
                          <span
                            className="material-symbols-outlined text-xs"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            {getStatusIcon(log.status)}
                          </span>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-2 text-sm font-medium text-on-surface">
                          <span className="material-symbols-outlined text-sm text-primary">
                            {getActionIcon(log.action_type)}
                          </span>
                          {formatActionType(log.action_type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant max-w-xs truncate">
                        {log.message_sent || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant max-w-xs truncate">
                        {log.error_message ? (
                          <span className="text-error">{log.error_message}</span>
                        ) : log.comment_id ? (
                          <span>Comment: {log.comment_id.substring(0, 12)}...</span>
                        ) : log.recipient_id ? (
                          <span>To: {log.recipient_id}</span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-outline whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>

            {/* Pagination */}
            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-outline-variant/20 pt-4 sm:pt-6">
              <p className="text-sm text-on-surface-variant">
                Showing <span className="font-bold">{(page - 1) * pageSize + 1}</span> -{' '}
                <span className="font-bold">{Math.min(page * pageSize, total)}</span> of{' '}
                <span className="font-bold">{total}</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="p-2 rounded-lg hover:bg-surface-container-low text-outline disabled:opacity-30 transition-colors"
                >
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                <span className="w-8 h-8 rounded-lg bg-primary text-white font-bold text-xs flex items-center justify-center">
                  {page}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages}
                  className="p-2 rounded-lg hover:bg-surface-container-low text-outline disabled:opacity-30 transition-colors"
                >
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Logs;
