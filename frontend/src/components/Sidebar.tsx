import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'Home', icon: 'home' },
  { path: '/flows', label: 'Flows', icon: 'account_tree' },
  { path: '/posts', label: 'Posts', icon: 'grid_view' },
  { path: '/inbox', label: 'Inbox', icon: 'chat_bubble' },
  { path: '/settings', label: 'Settings', icon: 'settings' },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const location = useLocation();
  const { user } = useAuth();

  const isActive = (path: string) => location.pathname.startsWith(path);

  const handleNavClick = () => {
    // Close sidebar on mobile when navigating
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen flex flex-col py-6 px-4 bg-slate-100 z-50 transition-transform duration-300 ease-in-out
          w-64
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:w-20 xl:w-64
        `}
      >
        {/* Close button - mobile only */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg hover:bg-white/60 flex items-center justify-center text-slate-500 lg:hidden"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>

        {/* Brand */}
        <div className="mb-10 px-4">
          <Link to="/dashboard" onClick={handleNavClick}>
            <span className="text-2xl font-black text-blue-600 font-headline hidden xl:block">
              Digital Architect
            </span>
            <span className="text-2xl font-black text-blue-600 font-headline xl:hidden hidden lg:block text-center">
              DA
            </span>
            {/* Mobile drawer: show full name */}
            <span className="text-2xl font-black text-blue-600 font-headline lg:hidden block">
              Digital Architect
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={handleNavClick}
              className={`flex items-center gap-3 px-4 py-3 transition-all duration-200 ${
                isActive(item.path)
                  ? 'bg-white text-blue-600 rounded-xl shadow-sm'
                  : 'text-slate-500 hover:text-blue-500 hover:bg-white/50'
              }`}
            >
              <span
                className="material-symbols-outlined"
                style={
                  isActive(item.path)
                    ? { fontVariationSettings: "'FILL' 1" }
                    : undefined
                }
              >
                {item.icon}
              </span>
              {/* Show label in mobile drawer + xl desktop */}
              <span
                className={`xl:block lg:hidden block ${
                  isActive(item.path) ? 'font-bold' : 'font-medium'
                }`}
              >
                {item.label}
              </span>
            </Link>
          ))}
        </nav>

        {/* Bottom Section */}
        <div className="mt-auto px-2">
          {/* Current Plan Card - desktop xl + mobile drawer */}
          <div className="bg-gradient-to-br from-primary to-primary-container rounded-xl p-4 text-white xl:block lg:hidden block">
            <p className="text-xs font-bold uppercase tracking-wider opacity-80 mb-2">
              Current Plan
            </p>
            <p className="text-sm font-headline font-bold mb-4 capitalize">
              {user?.subscription_tier || 'Free'}
            </p>
            <Link
              to="/flows"
              onClick={handleNavClick}
              className="w-full py-2 bg-white text-primary font-bold rounded-lg text-xs shadow-md block text-center hover:bg-slate-50 transition-colors"
            >
              New Automation
            </Link>
          </div>

          {/* lg (collapsed) only: compact CTA */}
          <div className="hidden lg:flex xl:hidden justify-center">
            <Link
              to="/flows"
              className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center shadow-lg hover:brightness-110 transition-all"
            >
              <span className="material-symbols-outlined">add</span>
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
