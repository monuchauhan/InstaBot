import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import TopBar from '../components/TopBar';
import { instagramApi, automationApi } from '../services/api';
import { InstagramAccount, InstagramPost, AutomationSettings } from '../types';
import { useSidebar } from '../App';

const PAGE_SIZE = 12;

const Posts: React.FC = () => {
  const { toggleSidebar } = useSidebar();
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [automations, setAutomations] = useState<AutomationSettings[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const [accts, autos] = await Promise.all([
          instagramApi.getAccounts(),
          automationApi.getAll(),
        ]);
        setAccounts(accts);
        setAutomations(autos);
        if (accts.length > 0) {
          setSelectedAccountId(accts[0].id);
        }
      } catch (err) {
        console.error('Failed to init posts page:', err);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const fetchPosts = useCallback(async () => {
    if (!selectedAccountId) return;
    setSyncing(true);
    try {
      const data = await instagramApi.getPosts(selectedAccountId, 100);
      setPosts(data);
      setCurrentPage(1);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    } finally {
      setSyncing(false);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    if (selectedAccountId) {
      fetchPosts();
    }
  }, [selectedAccountId, fetchPosts]);

  const getPostAutomations = (postId: string) =>
    automations.filter((a) => a.target_post_id === postId);

  const toggleAutomation = async (automationId: number) => {
    try {
      const updated = await automationApi.toggle(automationId);
      setAutomations((prev) =>
        prev.map((a) => (a.id === updated.id ? updated : a))
      );
    } catch (err) {
      console.error('Failed to toggle automation:', err);
    }
  };

  const totalPages = Math.ceil(posts.length / PAGE_SIZE);
  const paginatedPosts = posts.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const formatDate = (ts: string) =>
    new Date(ts).toLocaleDateString('en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="loading-spinner" />
        <p className="mt-4 text-on-surface-variant">Loading posts...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Posts" searchPlaceholder="Search by caption or date..." onMenuToggle={toggleSidebar} />
      <main className="p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-56px)] sm:min-h-[calc(100vh-64px)]">
        {/* Header */}
        <div className="mb-8 sm:mb-12 flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6">
          <div>
            <p className="text-primary font-bold tracking-widest text-xs uppercase mb-2">
              Content Library
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-headline tracking-tight text-on-background">
              Post Automations
            </h1>
            <p className="text-on-surface-variant mt-2 max-w-xl">
              Manage individual post triggers, AI comment replies, and DM
              sequences directly from your visual grid.
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {accounts.length > 1 && (
              <select
                value={selectedAccountId ?? ''}
                onChange={(e) => setSelectedAccountId(Number(e.target.value))}
                className="bg-surface-container-highest border-none rounded-lg px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/40 outline-none"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    @{a.instagram_username || a.instagram_user_id}
                  </option>
                ))}
              </select>
            )}
            <Link
              to="/automations"
              className="bg-primary hover:opacity-90 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary/20 transition-all active:scale-95"
            >
              <span className="material-symbols-outlined">add_circle</span>
              New Automation
            </Link>
          </div>
        </div>

        {/* No accounts */}
        {accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="material-symbols-outlined text-5xl text-outline mb-4">
              link_off
            </span>
            <h2 className="text-xl font-headline font-bold mb-2">
              No Instagram Account
            </h2>
            <p className="text-sm text-on-surface-variant mb-6 max-w-md">
              Connect an Instagram account first to sync and view your posts
              here.
            </p>
            <Link
              to="/settings"
              className="bg-primary text-white px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-all"
            >
              Connect Instagram
            </Link>
          </div>
        ) : (
          <>
            {/* Post Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {paginatedPosts.map((post) => {
                const postAutos = getPostAutomations(post.id);
                const hasActive = postAutos.some((a) => a.is_enabled);
                const imgSrc =
                  post.media_type === 'VIDEO'
                    ? post.thumbnail_url || post.media_url
                    : post.media_url;

                return (
                  <div
                    key={post.id}
                    className="group relative bg-surface-container-lowest rounded-xl overflow-hidden flex flex-col transition-all hover:-translate-y-1"
                  >
                    {/* Image */}
                    <div className="relative aspect-square overflow-hidden bg-slate-200">
                      {imgSrc ? (
                        <img
                          src={imgSrc}
                          alt={post.caption?.slice(0, 50) || 'Instagram post'}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-surface-container text-outline">
                          <span className="material-symbols-outlined text-4xl">
                            image
                          </span>
                        </div>
                      )}

                      {/* Automation Badge */}
                      {postAutos.length > 0 && (
                        <div className="absolute top-3 left-3 flex gap-2">
                            <div className="bg-primary/90 backdrop-blur-md text-white p-1.5 rounded-lg shadow-sm">
                              <span
                                className="material-symbols-outlined text-sm block"
                                style={{
                                  fontVariationSettings: "'FILL' 1",
                                }}
                              >
                                smart_toy
                              </span>
                            </div>
                        </div>
                      )}

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-primary/20 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center p-6">
                        <Link
                          to="/automations"
                          className="bg-white text-primary font-bold px-4 py-2 rounded-lg shadow-xl text-sm hover:bg-primary-container hover:text-white transition-all"
                        >
                          {postAutos.length > 0
                            ? 'Edit Automation'
                            : 'Create Automation'}
                        </Link>
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="p-4 flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <p className="text-xs text-outline font-medium">
                          {formatDate(post.timestamp)}
                        </p>
                        {postAutos.length > 0 && (
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={hasActive}
                              onChange={() => {
                                const mainAuto = postAutos[0];
                                if (mainAuto) toggleAutomation(mainAuto.id);
                              }}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
                          </label>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-on-surface line-clamp-2">
                        {post.caption || 'No caption'}
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* Sync / Add card */}
              <div
                onClick={fetchPosts}
                className="group border-2 border-dashed border-outline-variant rounded-xl flex flex-col items-center justify-center p-8 text-center hover:bg-surface-container-low transition-colors cursor-pointer min-h-[320px]"
              >
                {syncing ? (
                  <div className="loading-spinner mb-4" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-surface-variant flex items-center justify-center text-outline mb-4">
                    <span className="material-symbols-outlined">add</span>
                  </div>
                )}
                <p className="text-sm font-bold text-on-surface">
                  {syncing ? 'Syncing...' : 'Sync New Posts'}
                </p>
                <p className="text-xs text-outline mt-1">
                  Refresh your Instagram feed to see latest content.
                </p>
              </div>
            </div>

            {/* Pagination */}
            {posts.length > PAGE_SIZE && (
              <div className="mt-8 sm:mt-16 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-outline-variant/20 pt-4 sm:pt-8">
                <p className="text-sm text-on-surface-variant">
                  Showing{' '}
                  <span className="font-bold">
                    {Math.min(paginatedPosts.length, PAGE_SIZE)}
                  </span>{' '}
                  of <span className="font-bold">{posts.length}</span> posts
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg hover:bg-surface-container-low text-outline disabled:opacity-30"
                  >
                    <span className="material-symbols-outlined">
                      chevron_left
                    </span>
                  </button>
                  {Array.from(
                    { length: Math.min(totalPages, 5) },
                    (_, i) => i + 1
                  ).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded-lg font-bold text-xs ${
                        currentPage === page
                          ? 'bg-primary text-white'
                          : 'hover:bg-surface-container-low text-on-surface'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(p + 1, totalPages))
                    }
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg hover:bg-surface-container-low text-outline disabled:opacity-30"
                  >
                    <span className="material-symbols-outlined">
                      chevron_right
                    </span>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Floating Action Button */}
      <Link
        to="/automations"
        className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 w-12 h-12 sm:w-14 sm:h-14 bg-primary text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-30"
      >
        <span
          className="material-symbols-outlined"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          bolt
        </span>
      </Link>
    </div>
  );
};

export default Posts;
