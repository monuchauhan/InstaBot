import React, { useState, useEffect } from 'react';
import { instagramApi } from '../services/api';
import { InstagramAccount } from '../types';
import './Accounts.css';

const Accounts: React.FC = () => {
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const data = await instagramApi.getAccounts();
      setAccounts(data);
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectInstagram = async () => {
    setIsConnecting(true);
    setError('');

    try {
      const { oauth_url } = await instagramApi.getConnectUrl();
      window.location.href = oauth_url;
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to start Instagram connection');
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async (accountId: number) => {
    if (!window.confirm('Are you sure you want to disconnect this account?')) {
      return;
    }

    try {
      await instagramApi.disconnectAccount(accountId);
      setAccounts(accounts.filter((a) => a.id !== accountId));
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to disconnect account');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="accounts-loading">
        <div className="loading-spinner"></div>
        <p>Loading accounts...</p>
      </div>
    );
  }

  return (
    <div className="accounts-page">
      <div className="accounts-header">
        <div>
          <h1>Instagram Accounts</h1>
          <p>Manage your connected Instagram Professional accounts</p>
        </div>
        <button
          className="connect-button"
          onClick={handleConnectInstagram}
          disabled={isConnecting}
        >
          {isConnecting ? 'Connecting...' : '+ Connect Instagram'}
        </button>
      </div>

      {error && <div className="accounts-error">{error}</div>}

      <div className="accounts-content">
        {accounts.length === 0 ? (
          <div className="accounts-empty">
            <div className="empty-icon">📱</div>
            <h2>No accounts connected</h2>
            <p>
              Connect your Instagram Professional account to start automating
              your comments and DMs.
            </p>
            <button
              className="connect-button-large"
              onClick={handleConnectInstagram}
              disabled={isConnecting}
            >
              Connect Instagram Account
            </button>
          </div>
        ) : (
          <div className="accounts-grid">
            {accounts.map((account) => (
              <div key={account.id} className="account-card">
                <div className="account-card-header">
                  <div className="account-avatar">
                    {(account.instagram_username || 'U')[0].toUpperCase()}
                  </div>
                  <div className="account-info">
                    <h3>@{account.instagram_username || account.instagram_user_id}</h3>
                    <span
                      className={`account-badge ${
                        account.is_active ? 'active' : 'inactive'
                      }`}
                    >
                      {account.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                <div className="account-card-body">
                  <div className="account-detail">
                    <span className="detail-label">Instagram ID</span>
                    <span className="detail-value">{account.instagram_user_id}</span>
                  </div>
                  <div className="account-detail">
                    <span className="detail-label">Connected</span>
                    <span className="detail-value">
                      {formatDate(account.connected_at)}
                    </span>
                  </div>
                </div>

                <div className="account-card-footer">
                  <button
                    className="disconnect-button"
                    onClick={() => handleDisconnect(account.id)}
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Accounts;
