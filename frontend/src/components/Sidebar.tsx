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

const Sidebar: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <aside className="fixed left-0 top-0 h-screen flex flex-col py-6 px-4 bg-slate-100 w-20 lg:w-64 z-50">
      {/* Brand */}
      <div className="mb-10 px-4">
        <Link to="/dashboard">
          <span className="text-2xl font-black text-blue-600 font-headline hidden lg:block">
            Digital Architect
          </span>
          <span className="text-2xl font-black text-blue-600 font-headline lg:hidden block text-center">
            DA
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
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
            <span
              className={`hidden lg:block ${
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
        {/* Current Plan Card - desktop */}
        <div className="bg-gradient-to-br from-primary to-primary-container rounded-xl p-4 text-white hidden lg:block">
          <p className="text-xs font-bold uppercase tracking-wider opacity-80 mb-2">
            Current Plan
          </p>
          <p className="text-sm font-headline font-bold mb-4 capitalize">
            {user?.subscription_tier || 'Free'}
          </p>
          <Link
            to="/flows"
            className="w-full py-2 bg-white text-primary font-bold rounded-lg text-xs shadow-md block text-center hover:bg-slate-50 transition-colors"
          >
            New Automation
          </Link>
        </div>

        {/* Mobile: compact CTA */}
        <div className="lg:hidden flex justify-center">
          <Link
            to="/flows"
            className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center shadow-lg hover:brightness-110 transition-all"
          >
            <span className="material-symbols-outlined">add</span>
          </Link>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
