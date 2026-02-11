import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Navbar.css';

const Navbar: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  if (!isAuthenticated) {
    return null;
  }

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/dashboard" className="navbar-logo">
          📸 InstaBot
        </Link>
      </div>

      <div className="navbar-menu">
        <Link
          to="/dashboard"
          className={`navbar-item ${isActive('/dashboard') ? 'active' : ''}`}
        >
          Dashboard
        </Link>
        <Link
          to="/accounts"
          className={`navbar-item ${isActive('/accounts') ? 'active' : ''}`}
        >
          Accounts
        </Link>
        <Link
          to="/automations"
          className={`navbar-item ${isActive('/automations') ? 'active' : ''}`}
        >
          Automations
        </Link>
        <Link
          to="/logs"
          className={`navbar-item ${isActive('/logs') ? 'active' : ''}`}
        >
          Logs
        </Link>
        <Link
          to="/pricing"
          className={`navbar-item ${isActive('/pricing') ? 'active' : ''}`}
        >
          Upgrade
        </Link>
      </div>

      <div className="navbar-end">
        <span className="navbar-user">
          {user?.email}
          {user?.subscription_tier && user.subscription_tier !== 'free' && (
            <span className="subscription-badge">{user.subscription_tier.toUpperCase()}</span>
          )}
        </span>
        <button onClick={handleLogout} className="navbar-logout">
          Logout
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
