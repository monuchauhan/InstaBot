import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import TopBar from '../components/TopBar';
import { automationApi } from '../services/api';
import { AutomationSettings } from '../types';

const Flows: React.FC = () => {
  const [automations, setAutomations] = useState<AutomationSettings[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await automationApi.getAll();
        setAutomations(data);
      } catch (err) {
        console.error('Failed to fetch automations:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const getBorderColor = (index: number) => {
    const colors = ['border-primary', 'border-secondary', 'border-tertiary'];
    return colors[index % colors.length];
  };

  const getStatusLabel = (enabled: boolean) =>
    enabled ? (
      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-[10px] font-black uppercase">
        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        Running
      </div>
    ) : (
      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px] font-black uppercase">
        <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        Paused
      </div>
    );

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Flows" searchPlaceholder="Search automations..." />
      <main className="p-8 min-h-[calc(100vh-64px)]">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div>
            <p className="text-primary font-bold tracking-widest text-xs uppercase mb-2">
              Automation Flows
            </p>
            <h1 className="text-4xl lg:text-5xl font-extrabold font-headline tracking-tight text-on-background">
              Your Flows
            </h1>
            <p className="text-on-surface-variant mt-2 max-w-xl">
              Create and manage automation sequences for comments, DMs, and more.
            </p>
          </div>
          <Link
            to="/automations"
            className="bg-gradient-to-br from-primary to-primary-container text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined">bolt</span>
            New Automation
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="loading-spinner" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {automations.map((automation, index) => (
              <Link
                key={automation.id}
                to="/automations"
                className={`bg-surface-container-lowest p-6 rounded-2xl shadow-sm border-l-4 ${getBorderColor(
                  index
                )} hover:shadow-md transition-all`}
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="w-10 h-10 bg-surface-container rounded-lg flex items-center justify-center">
                    <span className="material-symbols-outlined">
                      {automation.automation_type === 'auto_reply_comment'
                        ? 'question_answer'
                        : 'send'}
                    </span>
                  </div>
                  {getStatusLabel(automation.is_enabled)}
                </div>
                <h4 className="font-bold text-on-surface mb-2">
                  {automation.automation_type === 'auto_reply_comment'
                    ? 'Comment Auto-Reply'
                    : 'DM Automation'}
                </h4>
                <p className="text-xs text-slate-500 mb-6 line-clamp-2">
                  {automation.template_message || 'No message template set'}
                </p>
                <div className="flex items-center justify-between pt-4 border-t border-surface-container">
                  <span className="text-[10px] font-bold text-slate-400">
                    {automation.trigger_keywords?.join(', ') || 'No keywords'}
                  </span>
                  <span className="material-symbols-outlined text-outline hover:text-primary cursor-pointer">
                    more_horiz
                  </span>
                </div>
              </Link>
            ))}

            {/* Create new card */}
            <Link
              to="/automations"
              className="bg-primary/5 border-2 border-dashed border-primary/30 p-6 rounded-2xl flex flex-col items-center justify-center group cursor-pointer hover:bg-primary/10 transition-colors min-h-[200px]"
            >
              <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center mb-4 shadow-md group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined">add</span>
              </div>
              <p className="font-bold text-primary">Create Flow</p>
              <p className="text-[10px] font-medium text-primary/60">
                Using {automations.length} automation{automations.length !== 1 ? 's' : ''}
              </p>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
};

export default Flows;
