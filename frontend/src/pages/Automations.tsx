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
import TopBar from '../components/TopBar';

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
    <div key={step.id} className="border-l-2 border-outline-variant/30 pl-4 py-2" style={{ marginLeft: depth * 16 }}>
      <div className="flex items-center gap-3 mb-1">
        <span className="text-xs font-bold text-primary">
          {step.payload_trigger ? `▸ "${step.payload_trigger.replace('_', ' ')}"` : '▸ Root Step'}
        </span>
        {step.is_end_step && <span className="text-[9px] font-bold text-white bg-slate-500 px-1.5 py-0.5 rounded-full">End</span>}
        <div className="flex items-center gap-1 ml-auto">
          <button className="w-6 h-6 text-xs hover:bg-surface-container rounded" onClick={() => openEditStep(step)}>✏️</button>
          <button className="w-6 h-6 text-xs hover:bg-surface-container rounded" onClick={() => openAddStep(step.id)} title="Add child step">➕</button>
          <button className="w-6 h-6 text-xs hover:bg-error-container/40 rounded" onClick={() => handleDeleteStep(step.id)}>🗑️</button>
        </div>
      </div>
      <p className="text-sm text-on-surface-variant mb-1">{step.message_text}</p>
      {step.quick_replies && step.quick_replies.length > 0 && (
        <div className="flex gap-1 mt-1">
          {step.quick_replies.map((qr, i) => (
            <span key={i} className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">{qr.title}</span>
          ))}
        </div>
      )}
      {getChildSteps(step.id).map((child) => renderStep(child, depth + 1))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-headline font-bold mb-1">💬 Conversation Flow</h3>
        <p className="text-xs text-on-surface-variant">
          Use <code className="bg-surface-container-high px-1.5 py-0.5 rounded text-[11px] font-mono">{'{username}'}</code> in messages to personalize.
        </p>
      </div>

      {error && <div className="bg-error-container text-on-error-container px-4 py-3 rounded-lg text-sm font-medium">{error}</div>}

      <div className="space-y-4">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-outline">Flow Name</label>
          <input
            type="text"
            value={flowName}
            onChange={(e) => setFlowName(e.target.value)}
            placeholder="e.g., Welcome Flow"
            className="bg-surface-container-highest border-none rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/40 transition-all outline-none text-sm"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-outline">Description (optional)</label>
          <input
            type="text"
            value={flowDescription}
            onChange={(e) => setFlowDescription(e.target.value)}
            placeholder="Brief description..."
            className="bg-surface-container-highest border-none rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/40 transition-all outline-none text-sm"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-outline">Initial DM Message</label>
          <textarea
            value={initialMessage}
            onChange={(e) => setInitialMessage(e.target.value)}
            placeholder="Hi {username}, thanks for your comment!"
            rows={3}
            className="bg-surface-container-highest border-none rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/40 transition-all outline-none text-sm resize-y"
          />
        </div>

        <button
          className="px-6 py-2.5 text-sm font-bold bg-gradient-to-br from-primary to-primary-container text-white rounded-xl shadow-md hover:opacity-90 transition-all disabled:opacity-40"
          onClick={handleSaveFlow}
          disabled={saving}
        >
          {saving ? 'Saving...' : flow ? 'Update Flow' : 'Create Flow'}
        </button>
      </div>

      {flow && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-on-surface">Conversation Steps</h4>
            <button
              className="text-xs font-bold text-primary hover:bg-primary/5 px-3 py-1.5 rounded-lg transition-colors"
              onClick={() => openAddStep(null)}
            >
              + Add Root Step
            </button>
          </div>

          <div className="bg-surface-container-low rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-outline-variant/20">
              <span className="text-xs font-bold text-primary">📩 Initial:</span>
              <span className="text-xs text-on-surface-variant">{initialMessage}</span>
            </div>
            {rootSteps.length === 0 ? (
              <p className="text-xs text-on-surface-variant text-center py-4">
                No steps yet. Add root steps to create reply options.
              </p>
            ) : (
              <div>
                {rootSteps.sort((a, b) => a.step_order - b.step_order).map((s) => renderStep(s))}
              </div>
            )}
          </div>

          {/* Add/Edit Step Form */}
          {showAddStep && (
            <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-6 space-y-4">
              <h4 className="font-bold text-on-surface">{editingStep ? 'Edit Step' : 'Add Step'}</h4>
              {parentStepId && !editingStep && (
                <p className="text-xs text-on-surface-variant">Parent: Step #{parentStepId}</p>
              )}

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-outline">Trigger Payload</label>
                <input
                  type="text"
                  value={stepForm.payload_trigger}
                  onChange={(e) =>
                    setStepForm({ ...stepForm, payload_trigger: e.target.value.toUpperCase().replace(/\s+/g, '_') })
                  }
                  placeholder="e.g., GET_LINK (auto-uppercase)"
                  className="bg-surface-container-highest border-none rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/40 transition-all outline-none text-sm"
                />
                <p className="text-[10px] text-outline italic">Used as the quick reply button trigger.</p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-outline">Response Message</label>
                <textarea
                  value={stepForm.message_text}
                  onChange={(e) => setStepForm({ ...stepForm, message_text: e.target.value })}
                  placeholder="The message to send when triggered..."
                  rows={3}
                  className="bg-surface-container-highest border-none rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/40 transition-all outline-none text-sm resize-y"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-outline">Quick Reply Buttons (max 3)</label>
                {stepForm.quick_replies.map((qr, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={qr.title}
                      onChange={(e) => updateQuickReply(i, 'title', e.target.value)}
                      placeholder="Button label (max 20 chars)"
                      maxLength={20}
                      className="flex-1 bg-surface-container-highest border-none rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/40 outline-none text-sm"
                    />
                    <input
                      type="text"
                      value={qr.payload}
                      onChange={(e) => updateQuickReply(i, 'payload', e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                      placeholder="Payload"
                      className="flex-1 bg-surface-container-highest border-none rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/40 outline-none text-sm"
                    />
                    <button className="text-error text-sm hover:bg-error-container/30 px-2 rounded" onClick={() => removeQuickReply(i)}>✕</button>
                  </div>
                ))}
                {stepForm.quick_replies.length < 3 && (
                  <button className="text-xs font-bold text-primary hover:underline self-start" onClick={addQuickReply}>
                    + Add Button
                  </button>
                )}
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={stepForm.is_end_step}
                  onChange={(e) => setStepForm({ ...stepForm, is_end_step: e.target.checked })}
                  className="w-4 h-4 text-primary rounded focus:ring-primary/40"
                />
                <span className="text-sm font-medium text-on-surface">End step (conversation ends here)</span>
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button className="px-5 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-container rounded-xl transition-colors" onClick={resetStepForm}>
                  Cancel
                </button>
                <button
                  className="px-5 py-2 text-sm font-bold bg-primary text-white rounded-xl hover:opacity-90 transition-all"
                  onClick={editingStep ? handleUpdateStep : handleAddStep}
                >
                  {editingStep ? 'Update Step' : 'Add Step'}
                </button>
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
      <div className="flex flex-col min-h-screen">
        <TopBar title="Automations" />
        <div className="flex flex-col items-center justify-center flex-1">
          <div className="loading-spinner"></div>
          <p className="mt-4 text-on-surface-variant">Loading automations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Automations" />
      <div className="p-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-headline font-extrabold text-on-surface">Automations</h1>
          <p className="text-on-surface-variant text-sm mt-1">Configure auto-reply and DM automations for your Instagram accounts</p>
        </div>
        <button
          className="bg-gradient-to-br from-primary to-primary-container text-white px-6 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
          onClick={openCreateModal}
          disabled={accounts.length === 0}
        >
          <span className="material-symbols-outlined">add</span>
          Create Automation
        </button>
      </div>

      {error && <div className="bg-error-container text-on-error-container px-4 py-3 rounded-lg text-sm font-medium mb-4">{error}</div>}

      {accounts.length === 0 && (
        <div className="bg-tertiary-fixed/30 border border-tertiary/20 rounded-xl p-4 mb-6">
          <p className="text-sm text-on-surface">
            You need to connect an Instagram account before creating automations.
            <a href="/settings" className="text-primary font-bold ml-1 hover:underline">Connect an account →</a>
          </p>
        </div>
      )}

      <div>
        {automations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-5xl mb-4">🤖</span>
            <h2 className="text-xl font-headline font-bold mb-2">No automations yet</h2>
            <p className="text-sm text-on-surface-variant max-w-md">
              Create your first automation to start auto-replying to comments or
              sending DMs automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {automations.map((automation) => (
              <div key={automation.id} className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden border border-outline-variant/10 hover:shadow-md transition-all">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-lg">
                        {getAutomationIcon(automation.automation_type)}
                      </div>
                      <div>
                        <h3 className="font-bold text-on-surface text-sm">{getAutomationLabel(automation.automation_type)}</h3>
                        <p className="text-xs text-slate-500">{getAccountUsername(automation.instagram_account_id)}</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={automation.is_enabled}
                        onChange={() => handleToggle(automation)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
                    </label>
                  </div>

                  {automation.target_post_id ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/5 px-2 py-1 rounded mb-3">
                      📌 Post-specific
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded mb-3">
                      🌐 All posts
                    </span>
                  )}

                  <div className="space-y-3 mt-3">
                    {automation.target_post_id && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Post</p>
                        <p className="text-xs text-on-surface truncate">📋 {automation.target_post_id}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Template</p>
                      <p className="text-xs text-on-surface-variant line-clamp-2">
                        {automation.template_message || 'No template set'}
                      </p>
                    </div>
                    {automation.automation_type === 'send_dm' && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Flow</p>
                        {flows[automation.id] ? (
                          <p className="text-xs text-green-600 font-medium">
                            ✅ {flows[automation.id].name} ({flows[automation.id].steps.length} steps)
                          </p>
                        ) : (
                          <p className="text-xs text-tertiary font-medium">
                            ⚠️ No flow — simple DM only
                          </p>
                        )}
                      </div>
                    )}
                    {automation.trigger_keywords && automation.trigger_keywords.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Keywords</p>
                        <div className="flex flex-wrap gap-1">
                          {(typeof automation.trigger_keywords === 'string'
                            ? JSON.parse(automation.trigger_keywords)
                            : automation.trigger_keywords
                          ).map((keyword: string, index: number) => (
                            <span key={index} className="bg-primary/5 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center border-t border-outline-variant/10 divide-x divide-outline-variant/10">
                  {automation.automation_type === 'send_dm' && (
                    <button
                      className="flex-1 py-3 text-xs font-bold text-primary hover:bg-primary/5 transition-colors"
                      onClick={() => openFlowEditor(automation.id)}
                    >
                      {flows[automation.id] ? '⚙️ Edit Flow' : '🔗 Add Flow'}
                    </button>
                  )}
                  <button
                    className="flex-1 py-3 text-xs font-bold text-on-surface-variant hover:bg-surface-container-low transition-colors"
                    onClick={() => openEditModal(automation)}
                  >
                    Edit
                  </button>
                  <button
                    className="flex-1 py-3 text-xs font-bold text-error hover:bg-error-container/30 transition-colors"
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
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setShowModal(false); resetForm(); }}>
          <div className={`bg-surface-container-lowest rounded-2xl shadow-2xl w-full ${!editingAutomation && createStep === 'select-post' ? 'max-w-4xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-outline-variant/10 sticky top-0 bg-surface-container-lowest z-10">
              <h2 className="text-xl font-headline font-extrabold">
                {editingAutomation
                  ? 'Edit Automation'
                  : createStep === 'select-post'
                  ? 'Select a Post'
                  : 'Configure Automation'}
              </h2>
              <button className="w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center text-on-surface-variant" onClick={() => { setShowModal(false); resetForm(); }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Step 1: Post Selection (only for new automations) */}
            {!editingAutomation && createStep === 'select-post' && (
              <div className="p-6 space-y-6">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-outline">Instagram Account</label>
                  <select
                    value={formAccountId}
                    onChange={(e) => handleAccountChange(Number(e.target.value))}
                    className="bg-surface-container-highest border-none rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/40 transition-all outline-none text-sm"
                  >
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        @{account.instagram_username || account.instagram_user_id}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <p className="text-sm text-on-surface-variant mb-4">
                    Select a post to create a post-specific automation, or skip to apply to all posts.
                  </p>

                  {loadingPosts ? (
                    <div className="flex flex-col items-center py-12">
                      <div className="loading-spinner" />
                      <p className="mt-4 text-sm text-on-surface-variant">Loading your posts...</p>
                    </div>
                  ) : posts.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-sm text-on-surface-variant">No posts found for this account.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[50vh] overflow-y-auto">
                      {posts.map((post) => (
                        <div
                          key={post.id}
                          className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                            selectedPost?.id === post.id
                              ? 'border-primary ring-2 ring-primary/20'
                              : 'border-transparent hover:border-outline-variant'
                          }`}
                          onClick={() => handlePostSelect(post)}
                        >
                          <img
                            src={post.media_type === 'VIDEO' ? (post.thumbnail_url || post.media_url || '') : (post.media_url || '')}
                            alt={post.caption || 'Instagram post'}
                            className="w-full h-full object-cover"
                          />
                          {post.media_type === 'VIDEO' && (
                            <span className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">▶</span>
                          )}
                          {post.media_type === 'CAROUSEL_ALBUM' && (
                            <span className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">❐</span>
                          )}
                          {selectedPost?.id === post.id && (
                            <div className="absolute inset-0 bg-primary/30 flex items-center justify-center">
                              <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold">✓</div>
                            </div>
                          )}
                          {post.caption && (
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                              <p className="text-[10px] text-white line-clamp-1">{post.caption}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant/10">
                  <button
                    type="button"
                    className="px-5 py-2.5 text-sm font-bold text-on-surface-variant hover:bg-surface-container rounded-xl transition-colors"
                    onClick={() => { setShowModal(false); resetForm(); }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="px-5 py-2.5 text-sm font-bold text-secondary hover:bg-secondary/5 rounded-xl transition-colors"
                    onClick={() => {
                      setSelectedPost(null);
                      handleProceedToConfigure();
                    }}
                  >
                    Skip (All Posts)
                  </button>
                  <button
                    type="button"
                    className="px-5 py-2.5 text-sm font-bold bg-primary text-white rounded-xl hover:opacity-90 transition-all disabled:opacity-40"
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
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Show linked post when editing */}
                {editingAutomation && editingAutomation.target_post_id && (
                  <div className="flex items-center gap-4 p-4 bg-surface-container-low rounded-xl">
                    {loadingEditPost ? (
                      <p className="text-sm text-on-surface-variant">Loading post...</p>
                    ) : editingPost ? (
                      <>
                        <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0">
                          <img
                            src={editingPost.media_type === 'VIDEO'
                              ? (editingPost.thumbnail_url || editingPost.media_url || '')
                              : (editingPost.media_url || '')}
                            alt="Linked post"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Linked Post</p>
                          <p className="text-sm text-on-surface line-clamp-2">
                            {editingPost.caption
                              ? (editingPost.caption.substring(0, 80) + (editingPost.caption.length > 80 ? '…' : ''))
                              : 'No caption'}
                          </p>
                        </div>
                      </>
                    ) : (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">📌 Post-specific</p>
                        <p className="text-xs text-on-surface-variant">ID: {editingAutomation.target_post_id}</p>
                      </div>
                    )}
                  </div>
                )}

                {editingAutomation && !editingAutomation.target_post_id && (
                  <div className="flex items-center gap-2 p-3 bg-surface-container-low rounded-xl text-sm">
                    <span>🌐</span> This automation applies to <strong>all posts</strong>.
                  </div>
                )}

                {/* Show linked post when creating */}
                {!editingAutomation && selectedPost && (
                  <div className="flex items-center gap-4 p-4 bg-surface-container-low rounded-xl">
                    <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0">
                      <img
                        src={selectedPost.media_type === 'VIDEO'
                          ? (selectedPost.thumbnail_url || selectedPost.media_url || '')
                          : (selectedPost.media_url || '')}
                        alt="Selected post"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Linked Post</p>
                      <p className="text-sm text-on-surface line-clamp-2">
                        {selectedPost.caption
                          ? (selectedPost.caption.substring(0, 80) + (selectedPost.caption.length > 80 ? '…' : ''))
                          : 'No caption'}
                      </p>
                    </div>
                    <button type="button" className="text-xs font-bold text-primary hover:underline shrink-0" onClick={handleBackToPostSelect}>
                      Change
                    </button>
                  </div>
                )}

                {!editingAutomation && !selectedPost && (
                  <div className="flex items-center justify-between p-3 bg-surface-container-low rounded-xl text-sm">
                    <span>🌐 This automation will apply to <strong>all posts</strong>.</span>
                    <button type="button" className="text-xs font-bold text-primary hover:underline" onClick={handleBackToPostSelect}>
                      Select a post
                    </button>
                  </div>
                )}

                {!editingAutomation && (
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-outline">Automation Type</label>
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value as AutomationType)}
                      className="bg-surface-container-highest border-none rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/40 transition-all outline-none text-sm"
                    >
                      <option value="auto_reply_comment">Auto-Reply to Comments</option>
                      <option value="send_dm">Send DM</option>
                    </select>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-outline">Template Message</label>
                  <textarea
                    value={formTemplate}
                    onChange={(e) => setFormTemplate(e.target.value)}
                    placeholder="Enter the message template..."
                    rows={4}
                    className="bg-surface-container-highest border-none rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/40 transition-all outline-none text-sm resize-y"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-outline">Trigger Keywords (comma-separated)</label>
                  <input
                    type="text"
                    value={formKeywords}
                    onChange={(e) => setFormKeywords(e.target.value)}
                    placeholder="e.g., price, info, help"
                    className="bg-surface-container-highest border-none rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/40 transition-all outline-none text-sm"
                  />
                  <p className="text-[10px] text-outline italic">
                    Leave empty to trigger on all comments
                  </p>
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formEnabled}
                    onChange={(e) => setFormEnabled(e.target.checked)}
                    className="w-4 h-4 text-primary rounded focus:ring-primary/40"
                  />
                  <span className="text-sm font-medium text-on-surface">Enable automation</span>
                </label>

                {error && <div className="bg-error-container text-on-error-container px-4 py-3 rounded-lg text-sm font-medium">{error}</div>}

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant/10">
                  {!editingAutomation && (
                    <button
                      type="button"
                      className="px-5 py-2.5 text-sm font-bold text-on-surface-variant hover:bg-surface-container rounded-xl transition-colors"
                      onClick={handleBackToPostSelect}
                    >
                      ← Back
                    </button>
                  )}
                  <button
                    type="button"
                    className="px-5 py-2.5 text-sm font-bold text-on-surface-variant hover:bg-surface-container rounded-xl transition-colors"
                    onClick={() => { setShowModal(false); resetForm(); }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="px-6 py-2.5 text-sm font-bold bg-gradient-to-br from-primary to-primary-container text-white rounded-xl shadow-md hover:opacity-90 transition-all">
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
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowFlowEditor(false)}>
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-outline-variant/10 sticky top-0 bg-surface-container-lowest z-10">
              <h2 className="text-xl font-headline font-extrabold">Conversation Flow</h2>
              <button className="w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center text-on-surface-variant" onClick={() => setShowFlowEditor(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6">
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
    </div>
  );
};

export default Automations;
