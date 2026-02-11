import React, { useState, useEffect } from 'react';
import { logsApi } from '../services/api';
import { ActionLog, ActionType } from '../types';
import './Logs.css';

const Logs: React.FC = () => {
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
        return '✅';
      case 'failed':
        return '❌';
      case 'pending':
        return '⏳';
      case 'skipped':
        return '⏭️';
      default:
        return '📋';
    }
  };

  const getActionIcon = (type: ActionType) => {
    switch (type) {
      case 'comment_reply':
        return '💬';
      case 'dm_sent':
        return '✉️';
      case 'webhook_received':
        return '📥';
      case 'error':
        return '⚠️';
      default:
        return '🤖';
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
    <div className="logs-page">
      <div className="logs-header">
        <div>
          <h1>Activity Logs</h1>
          <p>View all automation activities and events</p>
        </div>
      </div>

      <div className="logs-filters">
        <div className="filter-group">
          <label>Action Type</label>
          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value as ActionType | '');
              setPage(1);
            }}
          >
            <option value="">All Types</option>
            <option value="comment_reply">Comment Reply</option>
            <option value="dm_sent">DM Sent</option>
            <option value="webhook_received">Webhook Received</option>
            <option value="error">Error</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Status</label>
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
            <option value="skipped">Skipped</option>
          </select>
        </div>

        <button className="refresh-button" onClick={fetchLogs}>
          🔄 Refresh
        </button>
      </div>

      <div className="logs-content">
        {isLoading ? (
          <div className="logs-loading">
            <div className="loading-spinner"></div>
            <p>Loading logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="logs-empty">
            <div className="empty-icon">📋</div>
            <h2>No logs found</h2>
            <p>
              {filterType || filterStatus
                ? 'Try adjusting your filters'
                : 'Activity logs will appear here when automations run'}
            </p>
          </div>
        ) : (
          <>
            <div className="logs-table-wrapper">
              <table className="logs-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Type</th>
                    <th>Message</th>
                    <th>Details</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <span className={`status-badge ${log.status}`}>
                          {getStatusIcon(log.status)} {log.status}
                        </span>
                      </td>
                      <td>
                        <span className="action-type">
                          {getActionIcon(log.action_type)}{' '}
                          {formatActionType(log.action_type)}
                        </span>
                      </td>
                      <td className="message-cell">
                        {log.message_sent || '-'}
                      </td>
                      <td className="details-cell">
                        {log.error_message ? (
                          <span className="error-text">{log.error_message}</span>
                        ) : log.comment_id ? (
                          <span>Comment: {log.comment_id.substring(0, 12)}...</span>
                        ) : log.recipient_id ? (
                          <span>To: {log.recipient_id}</span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="date-cell">{formatDate(log.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="logs-pagination">
              <span className="pagination-info">
                Showing {(page - 1) * pageSize + 1} -{' '}
                {Math.min(page * pageSize, total)} of {total}
              </span>
              <div className="pagination-buttons">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="pagination-button"
                >
                  ← Previous
                </button>
                <span className="page-number">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages}
                  className="pagination-button"
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Logs;
