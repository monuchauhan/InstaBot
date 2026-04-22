import React, { useState, useEffect } from 'react';
import { automationApi, instagramApi } from '../services/api';
import {
  AutomationSettings,
  InstagramAccount,
  InstagramPost,
} from '../types';
import TopBar from '../components/TopBar';
import { useSidebar } from '../App';

/** Extract a renderable error string from API error responses.
 *  Backend subscription checks return detail as {error, message, upgrade_url}. */
const extractError = (err: any, fallback: string): string => {
  const detail = err?.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (typeof detail === 'object' && detail.message) return detail.message;
  return fallback;
};

// ============= Main Automations Component =============

const Automations: React.FC = () => {
  const { toggleSidebar } = useSidebar();
  const [automations, setAutomations] = useState<AutomationSettings[]>([]);
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<AutomationSettings | null>(null);
  const [error, setError] = useState('');

  // Post selection state
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [selectedPost, setSelectedPost] = useState<InstagramPost | null>(null);
  const [editingPost, setEditingPost] = useState<InstagramPost | null>(null); // Post loaded when editing
  const [loadingEditPost, setLoadingEditPost] = useState(false);
  const [createStep, setCreateStep] = useState<'select-post' | 'configure'>('select-post');
  const [postLookup, setPostLookup] = useState<Record<string, InstagramPost>>({});

  // Form state
  const [formAccountId, setFormAccountId] = useState<number | undefined>();
  const [formTemplates, setFormTemplates] = useState<string[]>(['']);
  const [formDmGreeting, setFormDmGreeting] = useState('');
  const [formDmLinks, setFormDmLinks] = useState<string[]>([]);
  const [formKeywords, setFormKeywords] = useState<string[]>([]);
  const [formKeywordInput, setFormKeywordInput] = useState('');
  const [formEnabled, setFormEnabled] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [automationsResult, accountsResult] = await Promise.allSettled([
        automationApi.getAll(),
        instagramApi.getAccounts(),
      ]);

      if (accountsResult.status === 'fulfilled') {
        setAccounts(accountsResult.value);
      } else {
        console.error('Failed to fetch accounts:', accountsResult.reason);
      }

      if (automationsResult.status === 'fulfilled') {
        setAutomations(automationsResult.value);

        // Fetch post thumbnails for automation cards
        const fetchedAccounts = accountsResult.status === 'fulfilled' ? accountsResult.value : [];
        const autoList = automationsResult.value;
        const accountIds = [...new Set(
          autoList
            .filter((a: AutomationSettings) => a.target_post_id && a.instagram_account_id)
            .map((a: AutomationSettings) => a.instagram_account_id as number)
        )];
        if (accountIds.length > 0) {
          const postResults = await Promise.allSettled(
            accountIds.map((id) => instagramApi.getPosts(id))
          );
          const lookup: Record<string, InstagramPost> = {};
          postResults.forEach((r) => {
            if (r.status === 'fulfilled') {
              r.value.forEach((p: InstagramPost) => { lookup[p.id] = p; });
            }
          });
          setPostLookup(lookup);
        }
      } else {
        console.error('Failed to fetch automations:', automationsResult.reason);
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

  const resetForm = () => {
    setFormAccountId(accounts[0]?.id);
    setFormTemplates(['']);
    setFormDmGreeting('');
    setFormDmLinks([]);
    setFormKeywords([]);
    setFormKeywordInput('');
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
    setFormAccountId(automation.instagram_account_id || undefined);
    setFormTemplates(
      automation.template_messages && automation.template_messages.length > 0
        ? [...automation.template_messages]
        : ['']
    );
    setFormDmGreeting(automation.dm_greeting || '');
    setFormDmLinks(automation.dm_links ? [...automation.dm_links] : []);
    setFormKeywords(automation.trigger_keywords ? [...automation.trigger_keywords] : []);
    setFormKeywordInput('');
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

    const templates = formTemplates.filter((t) => t.trim().length > 0);
    const links = formDmLinks.filter((l) => l.trim().length > 0);

    try {
      if (editingAutomation) {
        const updated = await automationApi.update(editingAutomation.id, {
          is_enabled: formEnabled,
          template_messages: templates.length > 0 ? templates : undefined,
          dm_greeting: formDmGreeting || undefined,
          dm_links: links.length > 0 ? links : undefined,
          trigger_keywords: formKeywords.length > 0 ? formKeywords : undefined,
        });
        setAutomations(
          automations.map((a) => (a.id === updated.id ? updated : a))
        );
      } else {
        const created = await automationApi.create({
          instagram_account_id: formAccountId,
          is_enabled: formEnabled,
          template_messages: templates.length > 0 ? templates : undefined,
          dm_greeting: formDmGreeting || undefined,
          dm_links: links.length > 0 ? links : undefined,
          trigger_keywords: formKeywords.length > 0 ? formKeywords : undefined,
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

  const getAccountUsername = (accountId: number | null) => {
    if (!accountId) return 'All Accounts';
    const account = accounts.find((a) => a.id === accountId);
    return account ? `@${account.instagram_username || account.instagram_user_id}` : 'Unknown';
  };

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <TopBar title="Automations" onMenuToggle={toggleSidebar} />
        <div className="flex flex-col items-center justify-center flex-1 p-4">
          <div className="loading-spinner"></div>
          <p className="mt-4 text-on-surface-variant">Loading automations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Automations" onMenuToggle={toggleSidebar} />
      <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 sm:mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-headline font-extrabold text-on-surface">Automations</h1>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {automations.map((automation) => (
              <div key={automation.id} className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden border border-outline-variant/10 hover:shadow-md transition-all">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-lg">
                        🤖
                      </div>
                      <div>
                        <h3 className="font-bold text-on-surface text-sm">Comment Reply + DM</h3>
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
                        {postLookup[automation.target_post_id] ? (
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                              <img
                                src={
                                  postLookup[automation.target_post_id].media_type === 'VIDEO'
                                    ? (postLookup[automation.target_post_id].thumbnail_url || postLookup[automation.target_post_id].media_url || '')
                                    : (postLookup[automation.target_post_id].media_url || '')
                                }
                                alt="Target post"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <p className="text-xs text-on-surface-variant line-clamp-2 flex-1">
                              {postLookup[automation.target_post_id].caption
                                ? postLookup[automation.target_post_id].caption!.substring(0, 60) + (postLookup[automation.target_post_id].caption!.length > 60 ? '…' : '')
                                : 'No caption'}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-on-surface truncate">📋 {automation.target_post_id}</p>
                        )}
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Comment Replies</p>
                      <p className="text-xs text-on-surface-variant line-clamp-2">
                        {automation.template_messages && automation.template_messages.length > 0
                          ? `${automation.template_messages.length} template${automation.template_messages.length > 1 ? 's' : ''}`
                          : 'Not set'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">DM</p>
                      <p className="text-xs text-on-surface-variant line-clamp-2">
                        {automation.dm_greeting
                          ? `Greeting${automation.dm_links && automation.dm_links.length > 0 ? ` + ${automation.dm_links.length} link${automation.dm_links.length > 1 ? 's' : ''}` : ''}`
                          : 'Not set'}
                      </p>
                    </div>
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
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4" onClick={() => { setShowModal(false); resetForm(); }}>
          <div className={`bg-surface-container-lowest rounded-2xl shadow-2xl w-full ${!editingAutomation && createStep === 'select-post' ? 'max-w-4xl' : 'max-w-5xl'} max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[50vh] overflow-y-auto">
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

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left column: Form fields */}
                  <div className="space-y-6">
                    {/* Trigger Keywords (Bubbles) */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-outline">Trigger Keywords</label>
                      <div className="flex flex-wrap gap-2 mb-1">
                        {formKeywords.map((kw, i) => (
                          <span key={i} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-sm font-bold px-3 py-1 rounded-full">
                            {kw}
                            <button type="button" onClick={() => setFormKeywords(formKeywords.filter((_, j) => j !== i))} className="hover:text-error ml-0.5">
                              <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                          </span>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={formKeywordInput}
                        onChange={(e) => setFormKeywordInput(e.target.value)}
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === ',') && formKeywordInput.trim()) {
                            e.preventDefault();
                            const kw = formKeywordInput.trim().replace(/,$/,'');
                            if (kw && !formKeywords.includes(kw)) {
                              setFormKeywords([...formKeywords, kw]);
                            }
                            setFormKeywordInput('');
                          }
                        }}
                        placeholder="Type a keyword and press Enter"
                        className="bg-surface-container-highest border-none rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/40 transition-all outline-none text-sm"
                      />
                      <p className="text-[10px] text-outline italic">
                        Leave empty to trigger on all comments
                      </p>
                    </div>

                    {/* Comment Reply Templates (Multiple) */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-outline">Comment Reply Templates</label>
                      <p className="text-[10px] text-outline italic mb-1">
                        One of these will be chosen randomly when replying to a comment
                      </p>
                      <div className="space-y-3">
                        {formTemplates.map((tpl, i) => (
                          <div key={i} className="flex gap-2">
                            <textarea
                              value={tpl}
                              onChange={(e) => {
                                const updated = [...formTemplates];
                                updated[i] = e.target.value;
                                setFormTemplates(updated);
                              }}
                              placeholder={`Reply template ${i + 1}...`}
                              rows={2}
                              className="flex-1 bg-surface-container-highest border-none rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/40 transition-all outline-none text-sm resize-y"
                            />
                            {formTemplates.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setFormTemplates(formTemplates.filter((_, j) => j !== i))}
                                className="self-start mt-2 text-on-surface-variant hover:text-error"
                              >
                                <span className="material-symbols-outlined text-lg">delete</span>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormTemplates([...formTemplates, ''])}
                        className="text-xs font-bold text-primary hover:underline self-start mt-1 flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-sm">add</span>
                        Add Template
                      </button>
                    </div>

                    {/* DM Greeting */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-outline">DM Greeting Message</label>
                      <textarea
                        value={formDmGreeting}
                        onChange={(e) => setFormDmGreeting(e.target.value)}
                        placeholder="Hi {username}, thanks for your comment! Here are some links for you 👇"
                        rows={3}
                        className="bg-surface-container-highest border-none rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/40 transition-all outline-none text-sm resize-y"
                      />
                      <p className="text-[10px] text-outline italic">
                        Sent as the first DM. Use {'{username}'} to personalize. Leave empty to skip DMs.
                      </p>
                    </div>

                    {/* DM Links */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-outline">DM Links</label>
                      <p className="text-[10px] text-outline italic mb-1">
                        Sent as a follow-up message after the greeting
                      </p>
                      <div className="space-y-2">
                        {formDmLinks.map((link, i) => (
                          <div key={i} className="flex gap-2">
                            <input
                              type="url"
                              value={link}
                              onChange={(e) => {
                                const updated = [...formDmLinks];
                                updated[i] = e.target.value;
                                setFormDmLinks(updated);
                              }}
                              placeholder="https://example.com"
                              className="flex-1 bg-surface-container-highest border-none rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/40 transition-all outline-none text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => setFormDmLinks(formDmLinks.filter((_, j) => j !== i))}
                              className="text-on-surface-variant hover:text-error"
                            >
                              <span className="material-symbols-outlined text-lg">delete</span>
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormDmLinks([...formDmLinks, ''])}
                        className="text-xs font-bold text-primary hover:underline self-start mt-1 flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-sm">add</span>
                        Add Link
                      </button>
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
                  </div>

                  {/* Right column: DM Preview */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-outline">DM Preview</label>
                    <div className="bg-surface-container-highest rounded-2xl overflow-hidden border border-outline-variant/20 shadow-sm">
                      {/* Instagram DM header */}
                      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-outline-variant/10">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center text-white text-xs font-bold">IG</div>
                        <div>
                          <p className="text-sm font-bold text-on-surface">John</p>
                          <p className="text-[10px] text-slate-400">Instagram</p>
                        </div>
                      </div>
                      {/* Chat area */}
                      <div className="p-4 space-y-3 min-h-[240px] bg-white">
                        {/* Example incoming message */}
                        <div className="flex justify-start">
                          <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-2.5 max-w-[80%]">
                            <p className="text-sm text-gray-800">Hey! I commented on your post 💬</p>
                          </div>
                        </div>

                        {/* Greeting bubble */}
                        {formDmGreeting ? (
                          <div className="flex justify-end">
                            <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl rounded-br-md px-4 py-2.5 max-w-[80%]">
                              <p className="text-sm text-white whitespace-pre-wrap">
                                {formDmGreeting.replace(/\{username\}/g, 'johndoe')}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-end">
                            <div className="border-2 border-dashed border-outline-variant/30 rounded-2xl rounded-br-md px-4 py-2.5 max-w-[80%]">
                              <p className="text-sm text-slate-300 italic">Greeting message...</p>
                            </div>
                          </div>
                        )}

                        {/* Links carousel */}
                        {formDmLinks.filter(l => l.trim()).length > 0 && (
                          <div className="flex justify-end">
                            <div className="max-w-[85%] flex gap-2 overflow-x-auto pb-1">
                              {formDmLinks.filter(l => l.trim()).map((link, i) => {
                                let domain = '';
                                try { domain = new URL(link).hostname.replace('www.', ''); } catch { domain = link; }
                                return (
                                  <div key={i} className="shrink-0 w-44 rounded-xl overflow-hidden border border-outline-variant/20 bg-white shadow-sm">
                                    <div className="h-24 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                                      <span className="material-symbols-outlined text-3xl text-slate-400">link</span>
                                    </div>
                                    <div className="px-3 py-2">
                                      <p className="text-[11px] font-bold text-on-surface truncate">{domain}</p>
                                      <p className="text-[10px] text-slate-400 truncate">{link}</p>
                                    </div>
                                    <div className="border-t border-outline-variant/10 px-3 py-1.5">
                                      <p className="text-[10px] font-bold text-blue-500 text-center">Open Link</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Empty state for links */}
                        {formDmLinks.filter(l => l.trim()).length === 0 && formDmGreeting && (
                          <div className="flex justify-end">
                            <div className="border-2 border-dashed border-outline-variant/30 rounded-2xl rounded-br-md px-4 py-2.5 max-w-[80%]">
                              <p className="text-sm text-slate-300 italic">Links will appear here...</p>
                            </div>
                          </div>
                        )}
                      </div>
                      {/* Input bar fake */}
                      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-outline-variant/10 bg-white">
                        <div className="flex-1 bg-gray-100 rounded-full px-4 py-2">
                          <p className="text-xs text-slate-300">Message...</p>
                        </div>
                        <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center">
                          <span className="material-symbols-outlined text-white text-sm">send</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

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
    </div>
    </div>
  );
};

export default Automations;
