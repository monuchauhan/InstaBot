import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { instagramApi, automationApi, logsApi } from '../services/api';
import { InstagramAccount, AutomationSettings, ActionLog } from '../types';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [automations, setAutomations] = useState<AutomationSettings[]>([]);
  const [recentLogs, setRecentLogs] = useState<ActionLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [accountsData, automationsData, logsData] = await Promise.all([
          instagramApi.getAccounts(),
          automationApi.getAll(),
          logsApi.getAll(1, 5),
        ]);
        setAccounts(accountsData);
        setAutomations(automationsData);
        setRecentLogs(logsData.logs);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const getActiveAutomationsCount = () => {
    return automations.filter((a) => a.is_enabled).length;
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Welcome back, {user?.full_name || user?.email}!</h1>
        <p>Here's an overview of your Instagram automation</p>
      </div>

      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-icon">📱</div>
          <div className="stat-content">
            <h3>{accounts.length}</h3>
            <p>Connected Accounts</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">⚡</div>
          <div className="stat-content">
            <h3>{getActiveAutomationsCount()}</h3>
            <p>Active Automations</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🤖</div>
          <div className="stat-content">
            <h3>{automations.length}</h3>
            <p>Total Automations</p>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-section">
          <div className="section-header">
            <h2>Connected Accounts</h2>
          </div>
          <div className="section-content">
            {accounts.length === 0 ? (
              <div className="empty-state">
                <p>No Instagram accounts connected yet.</p>
                <a href="/accounts" className="action-link">
                  Connect an account →
                </a>
              </div>
            ) : (
              <ul className="account-list">
                {accounts.map((account) => (
                  <li key={account.id} className="account-item">
                    <span className="account-username">
                      @{account.instagram_username || account.instagram_user_id}
                    </span>
                    <span
                      className={`account-status ${
                        account.is_active ? 'active' : 'inactive'
                      }`}
                    >
                      {account.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="dashboard-section">
          <div className="section-header">
            <h2>Recent Activity</h2>
          </div>
          <div className="section-content">
            {recentLogs.length === 0 ? (
              <div className="empty-state">
                <p>No recent activity.</p>
              </div>
            ) : (
              <ul className="log-list">
                {recentLogs.map((log) => (
                  <li key={log.id} className="log-item">
                    <span className="log-icon">{getStatusIcon(log.status)}</span>
                    <div className="log-content">
                      <span className="log-type">
                        {log.action_type.replace('_', ' ')}
                      </span>
                      <span className="log-time">{formatDate(log.created_at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
