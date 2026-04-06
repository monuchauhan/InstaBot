import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { analyticsApi, automationApi } from '../services/api';
import { AutomationSettings, DashboardAnalytics } from '../types';
import TopBar from '../components/TopBar';
import { useSidebar } from '../App';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { toggleSidebar } = useSidebar();
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [automations, setAutomations] = useState<AutomationSettings[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState<7 | 30>(7);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [analyticsData, automationsData] = await Promise.all([
          analyticsApi.getDashboard(chartPeriod),
          automationApi.getAll(),
        ]);
        setAnalytics(analyticsData);
        setAutomations(automationsData);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [chartPeriod]);

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
      <TopBar searchPlaceholder="Search flows, users..." onMenuToggle={toggleSidebar} />
      <main className="p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-56px)] sm:min-h-[calc(100vh-64px)]">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 sm:mb-12 gap-4 sm:gap-6">
          <div>
            <p className="text-xs sm:text-sm font-bold text-primary mb-1 uppercase tracking-widest">
              Dashboard Overview
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-headline font-extrabold tracking-tight text-on-surface">
              Digital Architect.
            </h1>
          </div>
          <div className="flex gap-2 sm:gap-3 flex-wrap">
            <Link
              to="/settings"
              className="px-4 py-2.5 sm:px-6 sm:py-3 bg-white text-on-surface font-bold rounded-xl shadow-sm flex items-center gap-2 hover:bg-surface-container-low transition-all text-sm sm:text-base"
            >
              <span className="material-symbols-outlined text-lg sm:text-xl">link</span>
              <span className="hidden sm:inline">Connect</span> Instagram
            </Link>
            <Link
              to="/automations"
              className="px-4 py-2.5 sm:px-6 sm:py-3 bg-gradient-to-br from-primary to-primary-container text-white font-bold rounded-xl shadow-lg flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all text-sm sm:text-base"
            >
              <span className="material-symbols-outlined text-lg sm:text-xl">bolt</span>
              New Automation
            </Link>
          </div>
        </div>

        {/* Top Metrics (Bento Style) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12">
          <div className="bg-surface-container-lowest p-5 sm:p-8 rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
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
            <p className="text-slate-500 font-medium mb-1 text-sm sm:text-base">Comments Replied</p>
            <p className="text-2xl sm:text-4xl font-headline font-extrabold text-on-surface">
              {(analytics?.total_comments_replied ?? 0).toLocaleString()}
            </p>
          </div>

          <div className="bg-surface-container-lowest p-5 sm:p-8 rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center">
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
            <p className="text-slate-500 font-medium mb-1 text-sm sm:text-base">DMs Sent</p>
            <p className="text-2xl sm:text-4xl font-headline font-extrabold text-on-surface">
              {(analytics?.total_dms_sent ?? 0).toLocaleString()}
            </p>
          </div>

          <div className="bg-surface-container-lowest p-5 sm:p-8 rounded-xl shadow-sm sm:col-span-2 md:col-span-1">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center">
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
            <p className="text-slate-500 font-medium mb-1 text-sm sm:text-base">Total Actions</p>
            <p className="text-2xl sm:text-4xl font-headline font-extrabold text-on-surface">
              {(analytics?.total_actions ?? 0).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Performance Chart */}
        <div className="grid grid-cols-1 gap-6 sm:gap-8 mb-8 sm:mb-12">
          {/* Performance Graph */}
          <div className="bg-surface-container-lowest rounded-xl p-4 sm:p-8 shadow-sm">
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
        </div>

        {/* Active Automations */}
        <div>
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <h3 className="text-xl sm:text-2xl font-headline font-extrabold">
              Active Automations
            </h3>
            <Link to="/automations" className="text-primary font-bold text-sm">
              Manage Automations →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
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
                        smart_toy
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
                    Comment Reply + DM
                  </h4>
                  <p className="text-xs text-slate-500 mb-6 line-clamp-2">
                    {a.template_messages && a.template_messages.length > 0
                      ? `${a.template_messages.length} reply template${a.template_messages.length > 1 ? 's' : ''}`
                      : 'No reply templates'}
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
              <p className="font-bold text-primary">Create Automation</p>
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
