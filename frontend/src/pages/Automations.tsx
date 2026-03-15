import React, { useState, useEffect } from 'react';
import { automationApi, instagramApi, conversationFlowApi } from '../services/api';
import {
  AutomationSettings,
  AutomationType,
  InstagramAccount,
  InstagramPost,
  ConversationFlow,
  ConversationStep,
  ConversationStepCreate,
  QuickReplyOption,
} from '../types';
import './Automations.css';

/** Extract a renderable error string from API error responses.
 *  Backend subscription checks return detail as {error, message, upgrade_url}. */
const extractError = (err: any, fallback: string): string => {
  const detail = err?.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (typeof detail === 'object' && detail.message) return detail.message;
  return fallback;
};

// ============= Conversation Flow Editor Component =============

interface FlowEditorProps {
  automationId: number;
  flow: ConversationFlow | null;
  onFlowSaved: (flow: ConversationFlow) => void;
}

interface StepFormData {
  payload_trigger: string;
  message_text: string;
  quick_replies: QuickReplyOption[];
  is_end_step: boolean;
}

const FlowEditor: React.FC<FlowEditorProps> = ({ automationId, flow, onFlowSaved }) => {
  const [flowName, setFlowName] = useState(flow?.name || 'DM Conversation');
  const [flowDescription, setFlowDescription] = useState(flow?.description || '');
  const [initialMessage, setInitialMessage] = useState(
    flow?.initial_message || 'Hi {username}, thanks for your comment! 🎉'
  );
  const [steps, setSteps] = useState<ConversationStep[]>(flow?.steps || []);
  const [showAddStep, setShowAddStep] = useState(false);
  const [editingStep, setEditingStep] = useState<ConversationStep | null>(null);
  const [parentStepId, setParentStepId] = useState<number | null>(null);
  const [stepForm, setStepForm] = useState<StepFormData>({
    payload_trigger: '',
    message_text: '',
    quick_replies: [],
    is_end_step: false,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const resetStepForm = () => {
    setStepForm({
      payload_trigger: '',
      message_text: '',
      quick_replies: [],
      is_end_step: false,
    });
    setParentStepId(null);
    setEditingStep(null);
    setShowAddStep(false);
  };

  const handleSaveFlow = async () => {
    setSaving(true);
    setError('');
    try {
      if (flow) {
        const updated = await conversationFlowApi.update(flow.id, {
          name: flowName,
          description: flowDescription || undefined,
          initial_message: initialMessage,
        });
        onFlowSaved(updated);
      } else {
        const created = await conversationFlowApi.create({
          automation_id: automationId,
          name: flowName,
          description: flowDescription || undefined,
          initial_message: initialMessage,
        });
        onFlowSaved(created);
      }
    } catch (err: any) {
      setError(extractError(err, 'Failed to save flow'));
    } finally {
      setSaving(false);
    }
  };

  const handleAddStep = async () => {
    if (!flow) {
      setError('Save the flow first before adding steps');
      return;
    }
    setError('');
    try {
      const stepData: ConversationStepCreate = {
        parent_step_id: parentStepId,
        step_order: steps.filter((s) => s.parent_step_id === parentStepId).length,
        payload_trigger: stepForm.payload_trigger || undefined,
        message_text: stepForm.message_text,
        quick_replies: stepForm.quick_replies.length > 0 ? stepForm.quick_replies : undefined,
        is_end_step: stepForm.is_end_step,
      };
      const newStep = await conversationFlowApi.addStep(flow.id, stepData);
      setSteps([...steps, newStep]);
      resetStepForm();
    } catch (err: any) {
      setError(extractError(err, 'Failed to add step'));
    }
  };

  const handleUpdateStep = async () => {
    if (!flow || !editingStep) return;
    setError('');
    try {
      const updated = await conversationFlowApi.updateStep(flow.id, editingStep.id, {
        payload_trigger: stepForm.payload_trigger || undefined,
        message_text: stepForm.message_text,
        quick_replies: stepForm.quick_replies.length > 0 ? stepForm.quick_replies : undefined,
        is_end_step: stepForm.is_end_step,
      });
      setSteps(steps.map((s) => (s.id === updated.id ? updated : s)));
      resetStepForm();
    } catch (err: any) {
      setError(extractError(err, 'Failed to update step'));
    }
  };

  const handleDeleteStep = async (stepId: number) => {
    if (!flow || !window.confirm('Delete this step and all its children?')) return;
    try {
      await conversationFlowApi.deleteStep(flow.id, stepId);
      setSteps(steps.filter((s) => s.id !== stepId && s.parent_step_id !== stepId));
    } catch (err: any) {
      setError(extractError(err, 'Failed to delete step'));
    }
  };

  const openAddStep = (parentId: number | null) => {
    resetStepForm();
    setParentStepId(parentId);
    setShowAddStep(true);
  };

  const openEditStep = (step: ConversationStep) => {
    setEditingStep(step);
    setStepForm({
      payload_trigger: step.payload_trigger || '',
      message_text: step.message_text,
      quick_replies: step.quick_replies || [],
      is_end_step: step.is_end_step,
    });
    setShowAddStep(true);
  };

  const addQuickReply = () => {
    if (stepForm.quick_replies.length >= 3) return; // Instagram limits to 3
    setStepForm({
      ...stepForm,
      quick_replies: [...stepForm.quick_replies, { title: '', payload: '' }],
    });
  };

  const updateQuickReply = (index: number, field: 'title' | 'payload', value: string) => {
    const updated = [...stepForm.quick_replies];
    updated[index] = { ...updated[index], [field]: value };
    setStepForm({ ...stepForm, quick_replies: updated });
  };

  const removeQuickReply = (index: number) => {
    setStepForm({
      ...stepForm,
      quick_replies: stepForm.quick_replies.filter((_, i) => i !== index),
    });
  };

  // Build tree structure for display
  const rootSteps = steps.filter((s) => s.parent_step_id === null);

  const getChildSteps = (parentId: number): ConversationStep[] => {
    return steps
      .filter((s) => s.parent_step_id === parentId)
      .sort((a, b) => a.step_order - b.step_order);
  };

  const renderStep = (step: ConversationStep, depth: number = 0) => (
    <div key={step.id} className="flow-step" style={{ marginLeft: depth * 24 }}>
      <div className="flow-step-header">
        <span className="step-trigger">
          {step.payload_trigger ? `▸ "${step.payload_trigger.replace('_', ' ')}"` : '▸ Root Step'}
        </span>
        {step.is_end_step && <span className="step-badge end-badge">End</span>}
        <div className="step-actions">
          <button className="step-btn edit" onClick={() => openEditStep(step)}>✏️</button>
          <button className="step-btn add" onClick={() => openAddStep(step.id)} title="Add child step">➕</button>
          <button className="step-btn delete" onClick={() => handleDeleteStep(step.id)}>🗑️</button>
        </div>
      </div>
      <div className="step-message">{step.message_text}</div>
      {step.quick_replies && step.quick_replies.length > 0 && (
        <div className="step-quick-replies">
          {step.quick_replies.map((qr, i) => (
            <span key={i} className="qr-preview">{qr.title}</span>
          ))}
        </div>
      )}
      {getChildSteps(step.id).map((child) => renderStep(child, depth + 1))}
    </div>
  );

  return (
    <div className="flow-editor">
      <h3>💬 Conversation Flow</h3>
      <p className="flow-hint">
        Use <code>{'{username}'}</code> in messages to personalize with the commenter's name.
      </p>

      {error && <div className="flow-error">{error}</div>}

      <div className="flow-fields">
        <div className="form-group">
          <label>Flow Name</label>
          <input
            type="text"
            value={flowName}
            onChange={(e) => setFlowName(e.target.value)}
            placeholder="e.g., Welcome Flow"
          />
        </div>

        <div className="form-group">
          <label>Description (optional)</label>
          <input
            type="text"
            value={flowDescription}
            onChange={(e) => setFlowDescription(e.target.value)}
            placeholder="Brief description..."
          />
        </div>

        <div className="form-group">
          <label>Initial DM Message</label>
          <textarea
            value={initialMessage}
            onChange={(e) => setInitialMessage(e.target.value)}
            placeholder="Hi {username}, thanks for your comment!"
            rows={3}
          />
        </div>

        <button className="save-flow-btn" onClick={handleSaveFlow} disabled={saving}>
          {saving ? 'Saving...' : flow ? 'Update Flow' : 'Create Flow'}
        </button>
      </div>

      {flow && (
        <div className="flow-steps-section">
          <div className="flow-steps-header">
            <h4>Conversation Steps</h4>
            <button className="add-step-btn" onClick={() => openAddStep(null)}>
              + Add Root Step
            </button>
          </div>

          <div className="flow-preview">
            <div className="flow-initial-msg">
              <span className="msg-label">📩 Initial Message:</span>
              <span className="msg-preview">{initialMessage}</span>
            </div>
            {rootSteps.length === 0 ? (
              <div className="no-steps">
                No steps yet. Add root steps to create reply options for the initial message.
              </div>
            ) : (
              <div className="steps-tree">
                {rootSteps.sort((a, b) => a.step_order - b.step_order).map((s) => renderStep(s))}
              </div>
            )}
          </div>

          {/* Add/Edit Step Form */}
          {showAddStep && (
            <div className="step-form-overlay">
              <div className="step-form">
                <h4>{editingStep ? 'Edit Step' : 'Add Step'}</h4>
                {parentStepId && !editingStep && (
                  <p className="step-parent-info">
                    Parent: Step #{parentStepId}
                  </p>
                )}

                <div className="form-group">
                  <label>Trigger Payload</label>
                  <input
                    type="text"
                    value={stepForm.payload_trigger}
                    onChange={(e) =>
                      setStepForm({ ...stepForm, payload_trigger: e.target.value.toUpperCase().replace(/\s+/g, '_') })
                    }
                    placeholder="e.g., GET_LINK (auto-uppercase)"
                  />
                  <span className="form-hint">
                    The button payload that triggers this step. Used as the quick reply button label.
                  </span>
                </div>

                <div className="form-group">
                  <label>Response Message</label>
                  <textarea
                    value={stepForm.message_text}
                    onChange={(e) => setStepForm({ ...stepForm, message_text: e.target.value })}
                    placeholder="The message to send when this step is triggered..."
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label>Quick Reply Buttons (max 3)</label>
                  {stepForm.quick_replies.map((qr, i) => (
                    <div key={i} className="qr-row">
                      <input
                        type="text"
                        value={qr.title}
                        onChange={(e) => updateQuickReply(i, 'title', e.target.value)}
                        placeholder="Button label (max 20 chars)"
                        maxLength={20}
                      />
                      <input
                        type="text"
                        value={qr.payload}
                        onChange={(e) => updateQuickReply(i, 'payload', e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                        placeholder="Payload (e.g., OPTION_1)"
                      />
                      <button className="remove-qr-btn" onClick={() => removeQuickReply(i)}>✕</button>
                    </div>
                  ))}
                  {stepForm.quick_replies.length < 3 && (
                    <button className="add-qr-btn" onClick={addQuickReply}>
                      + Add Button
                    </button>
                  )}
                </div>

                <div className="form-group form-checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={stepForm.is_end_step}
                      onChange={(e) => setStepForm({ ...stepForm, is_end_step: e.target.checked })}
                    />
                    End step (conversation ends after this message)
                  </label>
                </div>

                <div className="step-form-actions">
                  <button className="cancel-button" onClick={resetStepForm}>
                    Cancel
                  </button>
                  <button
                    className="save-button"
                    onClick={editingStep ? handleUpdateStep : handleAddStep}
                  >
                    {editingStep ? 'Update Step' : 'Add Step'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============= Main Automations Component =============

const Automations: React.FC = () => {
  const [automations, setAutomations] = useState<AutomationSettings[]>([]);
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<AutomationSettings | null>(null);
  const [error, setError] = useState('');

  // Conversation flow state
  const [showFlowEditor, setShowFlowEditor] = useState(false);
  const [flowEditorAutomationId, setFlowEditorAutomationId] = useState<number | null>(null);
  const [flows, setFlows] = useState<Record<number, ConversationFlow>>({});  // keyed by automation_id

  // Post selection state
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [selectedPost, setSelectedPost] = useState<InstagramPost | null>(null);
  const [editingPost, setEditingPost] = useState<InstagramPost | null>(null); // Post loaded when editing
  const [loadingEditPost, setLoadingEditPost] = useState(false);
  const [createStep, setCreateStep] = useState<'select-post' | 'configure'>('select-post');

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
      const [automationsResult, accountsResult, flowsResult] = await Promise.allSettled([
        automationApi.getAll(),
        instagramApi.getAccounts(),
        conversationFlowApi.getAll(),
      ]);

      if (accountsResult.status === 'fulfilled') {
        setAccounts(accountsResult.value);
      } else {
        console.error('Failed to fetch accounts:', accountsResult.reason);
      }

      if (automationsResult.status === 'fulfilled') {
        setAutomations(automationsResult.value);
      } else {
        console.error('Failed to fetch automations:', automationsResult.reason);
      }

      if (flowsResult.status === 'fulfilled') {
        const flowMap: Record<number, ConversationFlow> = {};
        flowsResult.value.forEach((f) => { flowMap[f.automation_id] = f; });
        setFlows(flowMap);
      } else {
        console.error('Failed to fetch flows:', flowsResult.reason);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPostsForAccount = async (accountId: number) => {
    setLoadingPosts(true);
    setPosts([]);
    try {
      const media = await instagramApi.getPosts(accountId);
      setPosts(media);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
      setError('Failed to load posts from Instagram. Please try again.');
    } finally {
      setLoadingPosts(false);
    }
  };

  const openFlowEditor = (automationId: number) => {
    setFlowEditorAutomationId(automationId);
    setShowFlowEditor(true);
  };

  const handleFlowSaved = (flow: ConversationFlow) => {
    setFlows({ ...flows, [flow.automation_id]: flow });
  };

  const resetForm = () => {
    setFormType('auto_reply_comment');
    setFormAccountId(accounts[0]?.id);
    setFormTemplate('');
    setFormKeywords('');
    setFormEnabled(false);
    setEditingAutomation(null);
    setSelectedPost(null);
    setEditingPost(null);
    setPosts([]);
    setCreateStep('select-post');
  };

  const openCreateModal = () => {
    resetForm();
    setFormAccountId(accounts[0]?.id);
    setCreateStep('select-post');
    setShowModal(true);
    // Fetch posts for the default account
    if (accounts.length > 0) {
      fetchPostsForAccount(accounts[0].id);
    }
  };

  const openEditModal = async (automation: AutomationSettings) => {
    setEditingAutomation(automation);
    setFormType(automation.automation_type);
    setFormAccountId(automation.instagram_account_id || undefined);
    setFormTemplate(automation.template_message || '');
    setFormKeywords(automation.trigger_keywords?.join(', ') || '');
    setFormEnabled(automation.is_enabled);
    setSelectedPost(null);
    setEditingPost(null);
    setCreateStep('configure'); // Skip post selection when editing
    setShowModal(true);

    // Fetch the linked post details if automation is post-specific
    if (automation.target_post_id && automation.instagram_account_id) {
      setLoadingEditPost(true);
      try {
        const media = await instagramApi.getPosts(automation.instagram_account_id);
        const matched = media.find((p) => p.id === automation.target_post_id) || null;
        setEditingPost(matched);
      } catch (err) {
        console.error('Failed to fetch post for editing:', err);
      } finally {
        setLoadingEditPost(false);
      }
    }
  };

  const handleAccountChange = (accountId: number) => {
    setFormAccountId(accountId);
    setSelectedPost(null);
    fetchPostsForAccount(accountId);
  };

  const handlePostSelect = (post: InstagramPost) => {
    setSelectedPost(post);
  };

  const handleProceedToConfigure = () => {
    setCreateStep('configure');
  };

  const handleBackToPostSelect = () => {
    setCreateStep('select-post');
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
          target_post_id: selectedPost?.id,
        });
        setAutomations([...automations, created]);
      }
      setShowModal(false);
      resetForm();
    } catch (err: any) {
      setError(extractError(err, 'Failed to save automation'));
    }
  };

  const handleToggle = async (automation: AutomationSettings) => {
    try {
      const updated = await automationApi.toggle(automation.id);
      setAutomations(
        automations.map((a) => (a.id === updated.id ? updated : a))
      );
    } catch (err: any) {
      setError(extractError(err, 'Failed to toggle automation'));
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
      setError(extractError(err, 'Failed to delete automation'));
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
                    {automation.target_post_id ? (
                      <span className="automation-post-badge">
                        📌 Post-specific
                      </span>
                    ) : (
                      <span className="automation-post-badge automation-post-all">
                        🌐 All posts
                      </span>
                    )}
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
                  {automation.target_post_id && (
                    <div className="automation-field">
                      <span className="field-label">Target Post</span>
                      <span className="field-value post-id-value">
                        📋 {automation.target_post_id}
                      </span>
                    </div>
                  )}
                  <div className="automation-field">
                    <span className="field-label">Template Message</span>
                    <span className="field-value">
                      {automation.template_message || 'No template set'}
                    </span>
                  </div>
                  {automation.automation_type === 'send_dm' && (
                    <div className="automation-field">
                      <span className="field-label">Conversation Flow</span>
                      {flows[automation.id] ? (
                        <span className="field-value flow-status flow-active">
                          ✅ {flows[automation.id].name} ({flows[automation.id].steps.length} steps)
                        </span>
                      ) : (
                        <span className="field-value flow-status flow-inactive">
                          ⚠️ No flow configured — only simple DM will be sent
                        </span>
                      )}
                    </div>
                  )}
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
                  {automation.automation_type === 'send_dm' && (
                    <button
                      className="flow-button"
                      onClick={() => openFlowEditor(automation.id)}
                    >
                      {flows[automation.id] ? '⚙️ Edit Flow' : '🔗 Configure Flow'}
                    </button>
                  )}
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
        <div className="modal-overlay" onClick={() => { setShowModal(false); resetForm(); }}>
          <div className={`modal ${!editingAutomation && createStep === 'select-post' ? 'modal-wide' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {editingAutomation
                  ? 'Edit Automation'
                  : createStep === 'select-post'
                  ? 'Select a Post'
                  : 'Configure Automation'}
              </h2>
              <button className="modal-close" onClick={() => { setShowModal(false); resetForm(); }}>
                ×
              </button>
            </div>

            {/* Step 1: Post Selection (only for new automations) */}
            {!editingAutomation && createStep === 'select-post' && (
              <div className="modal-form">
                <div className="form-group">
                  <label>Instagram Account</label>
                  <select
                    value={formAccountId}
                    onChange={(e) => handleAccountChange(Number(e.target.value))}
                  >
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        @{account.instagram_username || account.instagram_user_id}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="post-selection-section">
                  <p className="post-selection-hint">
                    Select a post to create a post-specific automation, or skip to create an automation that applies to all posts.
                  </p>

                  {loadingPosts ? (
                    <div className="posts-loading">
                      <div className="loading-spinner"></div>
                      <p>Loading your posts...</p>
                    </div>
                  ) : posts.length === 0 ? (
                    <div className="posts-empty">
                      <p>No posts found for this account.</p>
                    </div>
                  ) : (
                    <div className="posts-grid">
                      {posts.map((post) => (
                        <div
                          key={post.id}
                          className={`post-grid-item ${selectedPost?.id === post.id ? 'post-selected' : ''}`}
                          onClick={() => handlePostSelect(post)}
                        >
                          <div className="post-grid-image-wrapper">
                            {post.media_type === 'VIDEO' ? (
                              <img
                                src={post.thumbnail_url || post.media_url || ''}
                                alt={post.caption || 'Instagram post'}
                                className="post-grid-image"
                              />
                            ) : (
                              <img
                                src={post.media_url || ''}
                                alt={post.caption || 'Instagram post'}
                                className="post-grid-image"
                              />
                            )}
                            {post.media_type === 'VIDEO' && (
                              <span className="post-type-badge">▶</span>
                            )}
                            {post.media_type === 'CAROUSEL_ALBUM' && (
                              <span className="post-type-badge">❐</span>
                            )}
                            {selectedPost?.id === post.id && (
                              <div className="post-selected-overlay">
                                <span className="post-check">✓</span>
                              </div>
                            )}
                          </div>
                          {post.caption && (
                            <div className="post-grid-caption">
                              {post.caption.substring(0, 60)}{post.caption.length > 60 ? '…' : ''}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="cancel-button"
                    onClick={() => { setShowModal(false); resetForm(); }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="skip-button"
                    onClick={() => {
                      setSelectedPost(null);
                      handleProceedToConfigure();
                    }}
                  >
                    Skip (All Posts)
                  </button>
                  <button
                    type="button"
                    className="save-button"
                    onClick={handleProceedToConfigure}
                    disabled={!selectedPost}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Configure automation (or Edit mode) */}
            {(editingAutomation || createStep === 'configure') && (
              <form onSubmit={handleSubmit} className="modal-form">
                {/* Show linked post when editing */}
                {editingAutomation && editingAutomation.target_post_id && (
                  <div className="selected-post-preview">
                    {loadingEditPost ? (
                      <div className="selected-post-loading">Loading post...</div>
                    ) : editingPost ? (
                      <>
                        <div className="selected-post-thumb">
                          <img
                            src={editingPost.media_type === 'VIDEO'
                              ? (editingPost.thumbnail_url || editingPost.media_url || '')
                              : (editingPost.media_url || '')}
                            alt="Linked post"
                          />
                        </div>
                        <div className="selected-post-info">
                          <span className="selected-post-label">Automation for this post:</span>
                          <span className="selected-post-caption">
                            {editingPost.caption
                              ? (editingPost.caption.substring(0, 80) + (editingPost.caption.length > 80 ? '…' : ''))
                              : 'No caption'}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="selected-post-info">
                        <span className="selected-post-label">📌 Post-specific automation</span>
                        <span className="selected-post-caption">Post ID: {editingAutomation.target_post_id}</span>
                      </div>
                    )}
                  </div>
                )}

                {editingAutomation && !editingAutomation.target_post_id && (
                  <div className="all-posts-notice">
                    <span>🌐 This automation applies to <strong>all posts</strong>.</span>
                  </div>
                )}

                {/* Show linked post when creating */}
                {!editingAutomation && selectedPost && (
                  <div className="selected-post-preview">
                    <div className="selected-post-thumb">
                      <img
                        src={selectedPost.media_type === 'VIDEO'
                          ? (selectedPost.thumbnail_url || selectedPost.media_url || '')
                          : (selectedPost.media_url || '')}
                        alt="Selected post"
                      />
                    </div>
                    <div className="selected-post-info">
                      <span className="selected-post-label">Automation for this post:</span>
                      <span className="selected-post-caption">
                        {selectedPost.caption
                          ? (selectedPost.caption.substring(0, 80) + (selectedPost.caption.length > 80 ? '…' : ''))
                          : 'No caption'}
                      </span>
                    </div>
                    <button type="button" className="change-post-btn" onClick={handleBackToPostSelect}>
                      Change
                    </button>
                  </div>
                )}

                {!editingAutomation && !selectedPost && (
                  <div className="all-posts-notice">
                    <span>🌐 This automation will apply to <strong>all posts</strong>.</span>
                    <button type="button" className="change-post-btn" onClick={handleBackToPostSelect}>
                      Select a post
                    </button>
                  </div>
                )}

                {!editingAutomation && (
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

                {error && <div className="automations-error">{error}</div>}

                <div className="modal-actions">
                  {!editingAutomation && (
                    <button
                      type="button"
                      className="cancel-button"
                      onClick={handleBackToPostSelect}
                    >
                      ← Back
                    </button>
                  )}
                  <button
                    type="button"
                    className="cancel-button"
                    onClick={() => { setShowModal(false); resetForm(); }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="save-button">
                    {editingAutomation ? 'Save Changes' : 'Create Automation'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Conversation Flow Editor Modal */}
      {showFlowEditor && flowEditorAutomationId && (
        <div className="modal-overlay" onClick={() => setShowFlowEditor(false)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Conversation Flow</h2>
              <button className="modal-close" onClick={() => setShowFlowEditor(false)}>
                ×
              </button>
            </div>
            <div className="modal-form">
              <FlowEditor
                automationId={flowEditorAutomationId}
                flow={flows[flowEditorAutomationId] || null}
                onFlowSaved={handleFlowSaved}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Automations;
