import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface TopBarProps {
  title?: string;
  searchPlaceholder?: string;
  children?: React.ReactNode;
  onMenuToggle?: () => void;
}

const TopBar: React.FC<TopBarProps> = ({
  title,
  searchPlaceholder = 'Search flows, users...',
  children,
  onMenuToggle,
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="flex justify-between items-center w-full h-14 sm:h-16 px-4 sm:px-6 lg:px-8 sticky top-0 z-40 bg-white/80 backdrop-blur-md shadow-sm">
      <div className="flex items-center gap-3 sm:gap-6 flex-1 min-w-0">
        {/* Hamburger menu - mobile only */}
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="p-2 -ml-2 text-slate-500 hover:text-primary transition-colors rounded-lg hover:bg-surface-container lg:hidden flex-shrink-0"
            aria-label="Toggle menu"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
        )}
        {title && (
          <h1 className="text-base sm:text-xl font-extrabold tracking-tight text-slate-900 font-headline truncate">
            {title}
          </h1>
        )}
        <div className="relative w-full max-w-md hidden md:block">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">
            search
          </span>
          <input
            className="w-full pl-10 pr-4 py-2 bg-surface-container-low border-none rounded-lg focus:ring-2 focus:ring-primary/40 text-sm outline-none"
            placeholder={searchPlaceholder}
            type="text"
          />
        </div>
        {children}
      </div>

      <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
        {/* Notifications */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button className="p-1.5 sm:p-2 text-slate-500 hover:text-primary transition-colors rounded-full hover:bg-surface-container">
            <span className="material-symbols-outlined text-xl sm:text-2xl">notifications</span>
          </button>
          <button className="p-1.5 sm:p-2 text-slate-500 hover:text-primary transition-colors rounded-full hover:bg-surface-container hidden sm:block">
            <span className="material-symbols-outlined">help_outline</span>
          </button>
        </div>

        {/* Separator */}
        <div className="h-8 w-px bg-surface-container-high hidden sm:block" />

        {/* User Info */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden md:block text-right">
            <p className="text-sm font-semibold text-on-surface truncate max-w-[140px]">
              {user?.full_name || user?.email}
            </p>
            <p className="text-xs text-outline capitalize">
              {user?.subscription_tier || 'Free'} Plan
            </p>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {(user?.full_name || user?.email || 'U')[0].toUpperCase()}
          </div>
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-slate-500 hover:text-red-500 transition-colors hidden sm:block"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
