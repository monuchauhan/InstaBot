import React, { useState, useEffect } from 'react';
import { automationApi, instagramApi } from '../services/api';
import { AutomationSettings, AutomationType, InstagramAccount } from '../types';
import './Automations.css';

const Automations: React.FC = () => {
  const [automations, setAutomations] = useState<AutomationSettings[]>([]);
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<AutomationSettings | null>(null);
  const [error, setError] = useState('');

  // Form state
  const [formType, setFormType] = useState<AutomationType>('auto_reply_comment');
  const [formAccountId, setFormAccountId] = useState<number | undefined>();
  const [formTemplate, setFormTemplate] = useState('');
  const [formKeywords, setFormKeywords] = useState('');
  const [formEnabled, setFormEnabled] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [automationsData, accountsData] = await Promise.all([
        automationApi.getAll(),
        instagramApi.getAccounts(),
      ]);
      setAutomations(automationsData);
      setAccounts(accountsData);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormType('auto_reply_comment');
    setFormAccountId(accounts[0]?.id);
    setFormTemplate('');
    setFormKeywords('');
    setFormEnabled(false);
    setEditingAutomation(null);
  };

  const openCreateModal = () => {
    resetForm();
    setFormAccountId(accounts[0]?.id);
    setShowModal(true);
  };

  const openEditModal = (automation: AutomationSettings) => {
    setEditingAutomation(automation);
    setFormType(automation.automation_type);
    setFormAccountId(automation.instagram_account_id || undefined);
    setFormTemplate(automation.template_message || '');
    setFormKeywords(automation.trigger_keywords?.join(', ') || '');
    setFormEnabled(automation.is_enabled);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const keywords = formKeywords
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    try {
      if (editingAutomation) {
        const updated = await automationApi.update(editingAutomation.id, {
          is_enabled: formEnabled,
          template_message: formTemplate,
          trigger_keywords: keywords.length > 0 ? keywords : undefined,
        });
        setAutomations(
          automations.map((a) => (a.id === updated.id ? updated : a))
        );
      } else {
        const created = await automationApi.create({
          automation_type: formType,
          instagram_account_id: formAccountId,
          is_enabled: formEnabled,
          template_message: formTemplate,
          trigger_keywords: keywords.length > 0 ? keywords : undefined,
        });
        setAutomations([...automations, created]);
      }
      setShowModal(false);
      resetForm();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save automation');
    }
  };

  const handleToggle = async (automation: AutomationSettings) => {
    try {
      const updated = await automationApi.toggle(automation.id);
      setAutomations(
        automations.map((a) => (a.id === updated.id ? updated : a))
      );
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to toggle automation');
    }
  };

  const handleDelete = async (automationId: number) => {
    if (!window.confirm('Are you sure you want to delete this automation?')) {
      return;
    }

    try {
      await automationApi.delete(automationId);
      setAutomations(automations.filter((a) => a.id !== automationId));
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete automation');
    }
  };

  const getAutomationLabel = (type: AutomationType) => {
    switch (type) {
      case 'auto_reply_comment':
        return 'Auto-Reply to Comments';
      case 'send_dm':
        return 'Send DM';
      default:
        return type;
    }
  };

  const getAutomationIcon = (type: AutomationType) => {
    switch (type) {
      case 'auto_reply_comment':
        return '💬';
      case 'send_dm':
        return '✉️';
      default:
        return '🤖';
    }
  };

  const getAccountUsername = (accountId: number | null) => {
    if (!accountId) return 'All Accounts';
    const account = accounts.find((a) => a.id === accountId);
    return account ? `@${account.instagram_username || account.instagram_user_id}` : 'Unknown';
  };

  if (isLoading) {
    return (
      <div className="automations-loading">
        <div className="loading-spinner"></div>
        <p>Loading automations...</p>
      </div>
    );
  }

  return (
    <div className="automations-page">
      <div className="automations-header">
        <div>
          <h1>Automations</h1>
          <p>Configure auto-reply and DM automations for your Instagram accounts</p>
        </div>
        <button
          className="create-button"
          onClick={openCreateModal}
          disabled={accounts.length === 0}
        >
          + Create Automation
        </button>
      </div>

      {error && <div className="automations-error">{error}</div>}

      {accounts.length === 0 && (
        <div className="automations-warning">
          <p>
            You need to connect an Instagram account before creating automations.
            <a href="/accounts"> Connect an account →</a>
          </p>
        </div>
      )}

      <div className="automations-content">
        {automations.length === 0 ? (
          <div className="automations-empty">
            <div className="empty-icon">🤖</div>
            <h2>No automations yet</h2>
            <p>
              Create your first automation to start auto-replying to comments or
              sending DMs automatically.
            </p>
          </div>
        ) : (
          <div className="automations-grid">
            {automations.map((automation) => (
              <div key={automation.id} className="automation-card">
                <div className="automation-card-header">
                  <div className="automation-icon">
                    {getAutomationIcon(automation.automation_type)}
                  </div>
                  <div className="automation-title">
                    <h3>{getAutomationLabel(automation.automation_type)}</h3>
                    <span className="automation-account">
                      {getAccountUsername(automation.instagram_account_id)}
                    </span>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={automation.is_enabled}
                      onChange={() => handleToggle(automation)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="automation-card-body">
                  <div className="automation-field">
                    <span className="field-label">Template Message</span>
                    <span className="field-value">
                      {automation.template_message || 'No template set'}
                    </span>
                  </div>
                  {automation.trigger_keywords && automation.trigger_keywords.length > 0 && (
                    <div className="automation-field">
                      <span className="field-label">Trigger Keywords</span>
                      <div className="keyword-tags">
                        {(typeof automation.trigger_keywords === 'string'
                          ? JSON.parse(automation.trigger_keywords)
                          : automation.trigger_keywords
                        ).map((keyword: string, index: number) => (
                          <span key={index} className="keyword-tag">
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="automation-card-footer">
                  <button
                    className="edit-button"
                    onClick={() => openEditModal(automation)}
                  >
                    Edit
                  </button>
                  <button
                    className="delete-button"
                    onClick={() => handleDelete(automation.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingAutomation ? 'Edit Automation' : 'Create Automation'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              {!editingAutomation && (
                <>
                  <div className="form-group">
                    <label>Automation Type</label>
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value as AutomationType)}
                    >
                      <option value="auto_reply_comment">Auto-Reply to Comments</option>
                      <option value="send_dm">Send DM</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Instagram Account</label>
                    <select
                      value={formAccountId}
                      onChange={(e) => setFormAccountId(Number(e.target.value))}
                    >
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          @{account.instagram_username || account.instagram_user_id}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="form-group">
                <label>Template Message</label>
                <textarea
                  value={formTemplate}
                  onChange={(e) => setFormTemplate(e.target.value)}
                  placeholder="Enter the message template..."
                  rows={4}
                />
              </div>

              <div className="form-group">
                <label>Trigger Keywords (comma-separated, optional)</label>
                <input
                  type="text"
                  value={formKeywords}
                  onChange={(e) => setFormKeywords(e.target.value)}
                  placeholder="e.g., price, info, help"
                />
                <span className="form-hint">
                  Leave empty to trigger on all comments
                </span>
              </div>

              <div className="form-group form-checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={formEnabled}
                    onChange={(e) => setFormEnabled(e.target.checked)}
                  />
                  Enable automation
                </label>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="save-button">
                  {editingAutomation ? 'Save Changes' : 'Create Automation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Automations;
