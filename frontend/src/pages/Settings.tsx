import React, { useState, useEffect } from 'react';
import TopBar from '../components/TopBar';
import { useAuth } from '../contexts/AuthContext';
import { instagramApi } from '../services/api';
import { InstagramAccount } from '../types';

const Settings: React.FC = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');

  useEffect(() => {
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
    fetchAccounts();
  }, []);

  const handleConnectInstagram = async () => {
    try {
      const { oauth_url } = await instagramApi.getConnectUrl();
      window.location.href = oauth_url;
    } catch (err: any) {
      console.error('Failed to start connection:', err);
    }
  };

  const handleDisconnect = async (accountId: number) => {
    if (!window.confirm('Disconnect this account?')) return;
    try {
      await instagramApi.disconnectAccount(accountId);
      setAccounts(accounts.filter((a) => a.id !== accountId));
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Settings" />
      <main className="p-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-7 flex flex-col gap-8">
            {/* Account Info */}
            <section className="bg-surface-container-lowest rounded-xl p-8 shadow-sm">
              <div className="mb-8">
                <h2 className="text-2xl font-extrabold text-on-surface mb-2 font-headline">
                  Account Info
                </h2>
                <p className="text-on-surface-variant text-sm">
                  Update your personal details and account security settings.
                </p>
              </div>
              <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-outline">
                      Full Name
                    </label>
                    <input
                      className="bg-surface-container-highest border-none rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/40 transition-all outline-none"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your name"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-outline">
                      Email Address
                    </label>
                    <input
                      className="bg-surface-container-highest border-none rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/40 transition-all outline-none"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-outline">
                    New Password
                  </label>
                  <input
                    className="bg-surface-container-highest border-none rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary/40 transition-all outline-none"
                    type="password"
                    placeholder="••••••••••••"
                  />
                  <p className="text-[10px] text-outline mt-1 italic">
                    Leave blank to keep current password.
                  </p>
                </div>
                <div className="pt-4 flex justify-end">
                  <button className="bg-gradient-to-br from-primary to-primary-container text-on-primary px-8 py-3 rounded-xl font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all active:scale-95">
                    Save Changes
                  </button>
                </div>
              </form>
            </section>

            {/* Connected Accounts */}
            <section className="bg-surface-container-lowest rounded-xl p-8 shadow-sm">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-2xl font-extrabold text-on-surface mb-2 font-headline">
                    Connected Instagram Accounts
                  </h2>
                  <p className="text-on-surface-variant text-sm">
                    Manage your linked professional profiles.
                  </p>
                </div>
                <button
                  onClick={handleConnectInstagram}
                  className="flex items-center gap-2 text-primary font-bold hover:bg-primary/5 px-4 py-2 rounded-lg transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  <span>Add New</span>
                </button>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="loading-spinner" />
                </div>
              ) : accounts.length === 0 ? (
                <div className="text-center py-8">
                  <span className="material-symbols-outlined text-4xl text-outline mb-2 block">
                    link_off
                  </span>
                  <p className="text-sm text-on-surface-variant">
                    No accounts connected yet.
                  </p>
                  <button
                    onClick={handleConnectInstagram}
                    className="mt-4 text-primary font-bold text-sm hover:underline"
                  >
                    Connect your first account →
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {accounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl group transition-all hover:bg-surface-container"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full ring-2 ring-primary/20 bg-primary flex items-center justify-center text-white font-bold">
                          {(account.instagram_username || 'U')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-on-surface">
                            @{account.instagram_username || account.instagram_user_id}
                          </p>
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                account.is_active ? 'bg-emerald-500' : 'bg-tertiary'
                              }`}
                            />
                            <span
                              className={`text-xs font-semibold uppercase tracking-tighter ${
                                account.is_active
                                  ? 'text-emerald-600'
                                  : 'text-tertiary'
                              }`}
                            >
                              {account.is_active ? 'Connected' : 'Action Required'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDisconnect(account.id)}
                        className="text-error font-bold text-sm opacity-0 group-hover:opacity-100 transition-opacity hover:underline"
                      >
                        Disconnect
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-5 flex flex-col gap-8">
            {/* Billing */}
            <section className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 text-white relative overflow-hidden shadow-xl">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/20 rounded-full blur-3xl" />
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-10">
                  <div>
                    <h2 className="text-xl font-extrabold mb-1 font-headline">
                      Billing
                    </h2>
                    <p className="text-slate-400 text-xs">
                      Managed via Stripe
                    </p>
                  </div>
                  <span className="bg-white/10 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                    Active Plan
                  </span>
                </div>
                <div className="mb-8">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">
                    Monthly Subscription
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-white">
                      {user?.subscription_tier === 'enterprise'
                        ? '$299'
                        : user?.subscription_tier === 'pro'
                        ? '$49'
                        : '$0'}
                    </span>
                    <span className="text-slate-400 font-medium">/mo</span>
                  </div>
                </div>
                <div className="space-y-4 mb-8">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Current Plan</span>
                    <span className="font-bold capitalize">
                      {user?.subscription_tier || 'Free'}
                    </span>
                  </div>
                  {user?.subscription_expires_at && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Next Invoice</span>
                      <span className="font-bold">
                        {new Date(user.subscription_expires_at).toLocaleDateString(
                          'en',
                          { month: 'short', day: 'numeric', year: 'numeric' }
                        )}
                      </span>
                    </div>
                  )}
                </div>
                <button className="w-full bg-white text-slate-900 py-3 rounded-xl font-bold hover:bg-slate-100 transition-colors flex items-center justify-center gap-2">
                  Manage Subscription
                  <span className="material-symbols-outlined text-sm">
                    open_in_new
                  </span>
                </button>
              </div>
            </section>

            {/* Security Checklist */}
            <section className="bg-surface-container-low rounded-xl p-8">
              <h3 className="text-sm font-bold uppercase tracking-widest text-outline mb-4">
                Security Checklist
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span
                    className="material-symbols-outlined text-emerald-500 text-sm"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                  <span className="text-xs font-medium text-on-surface-variant">
                    Email verified
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className="material-symbols-outlined text-emerald-500 text-sm"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                  <span className="text-xs font-medium text-on-surface-variant">
                    Strong password
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-tertiary text-sm">
                    circle
                  </span>
                  <span className="text-xs font-medium text-on-surface-variant">
                    Two-factor authentication
                  </span>
                  <button className="ml-auto text-[10px] font-bold text-primary hover:underline">
                    Enable
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Settings;
