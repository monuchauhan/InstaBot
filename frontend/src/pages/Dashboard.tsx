import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { analyticsApi, automationApi, logsApi } from '../services/api';
import { AutomationSettings, ActionLog, DashboardAnalytics } from '../types';
import TopBar from '../components/TopBar';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [automations, setAutomations] = useState<AutomationSettings[]>([]);
  const [recentLogs, setRecentLogs] = useState<ActionLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState<7 | 30>(7);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [analyticsData, automationsData, logsData] = await Promise.all([
          analyticsApi.getDashboard(chartPeriod),
          automationApi.getAll(),
          logsApi.getAll(1, 5),
        ]);
        setAnalytics(analyticsData);
        setAutomations(automationsData);
        setRecentLogs(logsData.logs);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [chartPeriod]);

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
        return 'text-green-500';
      case 'failed':
        return 'text-red-500';
      case 'pending':
        return 'text-yellow-500';
      default:
        return 'text-slate-500';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} mins ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  const formatChangePct = (pct: number | null) => {
    if (pct === null || pct === 0) return null;
    const sign = pct > 0 ? '+' : '';
    return `${sign}${pct}%`;
  };

  // Get max value for chart bar scaling
  const chartMax = analytics
    ? Math.max(...analytics.daily_stats.map((d) => d.total), 1)
    : 1;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="loading-spinner" />
        <p className="mt-4 text-on-surface-variant">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar searchPlaceholder="Search flows, users..." />
      <main className="p-8 min-h-[calc(100vh-64px)]">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div>
            <p className="text-sm font-bold text-primary mb-1 uppercase tracking-widest">
              Dashboard Overview
            </p>
            <h1 className="text-5xl font-headline font-extrabold tracking-tight text-on-surface">
              Digital Architect.
            </h1>
          </div>
          <div className="flex gap-3">
            <Link
              to="/settings"
              className="px-6 py-3 bg-white text-on-surface font-bold rounded-xl shadow-sm flex items-center gap-2 hover:bg-surface-container-low transition-all"
            >
              <span className="material-symbols-outlined text-xl">link</span>
              Connect Instagram
            </Link>
            <Link
              to="/automations"
              className="px-6 py-3 bg-gradient-to-br from-primary to-primary-container text-white font-bold rounded-xl shadow-lg flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-xl">bolt</span>
              New Automation
            </Link>
          </div>
        </div>

        {/* Top Metrics (Bento Style) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-surface-container-lowest p-8 rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined">comment</span>
              </div>
              {formatChangePct(analytics?.comments_change_pct ?? null) && (
                <span
                  className={`text-xs font-bold px-2 py-1 rounded ${
                    (analytics?.comments_change_pct ?? 0) >= 0
                      ? 'text-green-600 bg-green-50'
                      : 'text-red-600 bg-red-50'
                  }`}
                >
                  {formatChangePct(analytics?.comments_change_pct ?? null)}
                </span>
              )}
            </div>
            <p className="text-slate-500 font-medium mb-1">Comments Replied</p>
            <p className="text-4xl font-headline font-extrabold text-on-surface">
              {(analytics?.total_comments_replied ?? 0).toLocaleString()}
            </p>
          </div>

          <div className="bg-surface-container-lowest p-8 rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined">send</span>
              </div>
              {formatChangePct(analytics?.dms_change_pct ?? null) && (
                <span
                  className={`text-xs font-bold px-2 py-1 rounded ${
                    (analytics?.dms_change_pct ?? 0) >= 0
                      ? 'text-green-600 bg-green-50'
                      : 'text-red-600 bg-red-50'
                  }`}
                >
                  {formatChangePct(analytics?.dms_change_pct ?? null)}
                </span>
              )}
            </div>
            <p className="text-slate-500 font-medium mb-1">DMs Sent</p>
            <p className="text-4xl font-headline font-extrabold text-on-surface">
              {(analytics?.total_dms_sent ?? 0).toLocaleString()}
            </p>
          </div>

          <div className="bg-surface-container-lowest p-8 rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined">insights</span>
              </div>
              {formatChangePct(analytics?.actions_change_pct ?? null) && (
                <span
                  className={`text-xs font-bold px-2 py-1 rounded ${
                    (analytics?.actions_change_pct ?? 0) >= 0
                      ? 'text-green-600 bg-green-50'
                      : 'text-red-600 bg-red-50'
                  }`}
                >
                  {formatChangePct(analytics?.actions_change_pct ?? null)}
                </span>
              )}
            </div>
            <p className="text-slate-500 font-medium mb-1">Total Actions</p>
            <p className="text-4xl font-headline font-extrabold text-on-surface">
              {(analytics?.total_actions ?? 0).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Performance Chart + Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Performance Graph */}
          <div className="lg:col-span-2 bg-surface-container-lowest rounded-xl p-8 shadow-sm">
            <div className="flex items-center justify-between mb-10">
              <h3 className="text-xl font-headline font-bold">
                Performance History
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setChartPeriod(7)}
                  className={`px-3 py-1 text-xs font-bold rounded-full ${
                    chartPeriod === 7
                      ? 'bg-surface-container-high text-on-surface'
                      : 'text-slate-400 hover:text-on-surface'
                  }`}
                >
                  7D
                </button>
                <button
                  onClick={() => setChartPeriod(30)}
                  className={`px-3 py-1 text-xs font-bold rounded-full ${
                    chartPeriod === 30
                      ? 'bg-surface-container-high text-on-surface'
                      : 'text-slate-400 hover:text-on-surface'
                  }`}
                >
                  30D
                </button>
              </div>
            </div>
            {analytics && analytics.daily_stats.length > 0 ? (
              <>
                <div className="h-64 flex items-end justify-between gap-1">
                  {analytics.daily_stats.map((day, i) => {
                    const height = Math.max((day.total / chartMax) * 100, 4);
                    return (
                      <div
                        key={i}
                        className="flex-1 bg-primary/10 rounded-t-lg relative group cursor-pointer"
                        style={{ height: `${height}%` }}
                        title={`${day.date}: ${day.total} actions (${day.comments} comments, ${day.dms} DMs)`}
                      >
                        <div
                          className="absolute bottom-0 w-full bg-primary/20 rounded-t-lg transition-all group-hover:bg-primary/40"
                          style={{ height: '100%' }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-4 text-xs font-bold text-slate-400 overflow-hidden">
                  {analytics.daily_stats.map((day, i) => {
                    // Show labels for first, last, and every few in between
                    const showLabel =
                      i === 0 ||
                      i === analytics.daily_stats.length - 1 ||
                      (chartPeriod === 30 && i % 7 === 0) ||
                      (chartPeriod === 7);
                    return (
                      <span key={i} className={showLabel ? '' : 'hidden sm:inline'}>
                        {showLabel
                          ? new Date(day.date).toLocaleDateString('en', {
                              month: 'short',
                              day: 'numeric',
                            })
                          : ''}
                      </span>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="h-64 flex items-center justify-center text-on-surface-variant">
                <div className="text-center">
                  <span className="material-symbols-outlined text-4xl text-outline mb-2 block">
                    bar_chart
                  </span>
                  <p className="text-sm">No data for this period yet.</p>
                  <p className="text-xs text-outline mt-1">
                    Actions will appear here as automations run.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-surface-container-low rounded-xl p-8">
            <h3 className="text-xl font-headline font-bold mb-6">
              Recent Activity
            </h3>
            {recentLogs.length === 0 ? (
              <p className="text-sm text-on-surface-variant text-center py-4">
                No recent activity.
              </p>
            ) : (
              <div className="space-y-6">
                {recentLogs.map((log) => (
                  <div key={log.id} className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0">
                      <span
                        className={`material-symbols-outlined text-sm ${getStatusColor(
                          log.status
                        )}`}
                      >
                        {getStatusIcon(log.status)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-bold">
                        {log.action_type.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-slate-500 line-clamp-1">
                        {log.message_sent || log.error_message || 'No details'}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-tight">
                        {formatDate(log.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
                <Link
                  to="/logs"
                  className="block w-full py-3 text-xs font-bold text-primary border-t border-outline-variant/20 mt-4 hover:underline text-center"
                >
                  View All Logs
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Active Automations */}
        <div>
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-headline font-extrabold">
              Active Automations
            </h3>
            <Link to="/flows" className="text-primary font-bold text-sm">
              Manage Flows →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {automations.slice(0, 3).map((a, i) => {
              const borderColors = [
                'border-primary',
                'border-secondary',
                'border-tertiary',
              ];
              return (
                <div
                  key={a.id}
                  className={`bg-surface-container-lowest p-6 rounded-2xl shadow-sm border-l-4 ${borderColors[i % 3]}`}
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-10 h-10 bg-surface-container rounded-lg flex items-center justify-center">
                      <span className="material-symbols-outlined">
                        {a.automation_type === 'auto_reply_comment'
                          ? 'question_answer'
                          : 'send'}
                      </span>
                    </div>
                    {a.is_enabled ? (
                      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-[10px] font-black uppercase">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        Running
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px] font-black uppercase">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        Paused
                      </div>
                    )}
                  </div>
                  <h4 className="font-bold text-on-surface mb-2">
                    {a.automation_type === 'auto_reply_comment'
                      ? 'Comment Auto-Reply'
                      : 'DM Automation'}
                  </h4>
                  <p className="text-xs text-slate-500 mb-6 line-clamp-2">
                    {a.template_message || 'No message set'}
                  </p>
                  <div className="flex items-center justify-between pt-4 border-t border-surface-container">
                    <span className="text-[10px] font-bold text-slate-400">
                      {a.trigger_keywords?.join(', ') || 'All comments'}
                    </span>
                  </div>
                </div>
              );
            })}
            {/* Add new card */}
            <Link
              to="/automations"
              className="bg-primary/5 border-2 border-dashed border-primary/30 p-6 rounded-2xl flex flex-col items-center justify-center group cursor-pointer hover:bg-primary/10 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center mb-4 shadow-md group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined">add</span>
              </div>
              <p className="font-bold text-primary">Create Flow</p>
              <p className="text-[10px] font-medium text-primary/60">
                {analytics?.total_automations ?? automations.length} automation
                {(analytics?.total_automations ?? automations.length) !== 1
                  ? 's'
                  : ''}{' '}
                total
              </p>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
