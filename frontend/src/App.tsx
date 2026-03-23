import React, { useState, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Flows from './pages/Flows';
import Automations from './pages/Automations';
import Posts from './pages/Posts';
import Inbox from './pages/Inbox';
import Settings from './pages/Settings';
import Logs from './pages/Logs';
import Pricing from './pages/Pricing';
import InstagramCallback from './pages/InstagramCallback';
import './App.css';

// Sidebar context to share toggle state with child pages
interface SidebarContextType {
  toggleSidebar: () => void;
}
const SidebarContext = createContext<SidebarContextType>({ toggleSidebar: () => {} });
export const useSidebar = () => useContext(SidebarContext);

const AppLayout: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Pages that don't show the sidebar
  const noSidebarRoutes = ['/login', '/register', '/pricing'];
  const showSidebar = isAuthenticated && !noSidebarRoutes.includes(location.pathname);

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <SidebarContext.Provider value={{ toggleSidebar }}>
      <div className="app">
        {showSidebar && <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />}
        <main className={showSidebar ? 'main-content' : 'flex-1'}>
          <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/pricing" element={<Pricing />} />

          {/* Instagram OAuth callback */}
          <Route
            path="/auth/instagram/callback"
            element={
              <ProtectedRoute>
                <InstagramCallback />
              </ProtectedRoute>
            }
          />

          {/* Protected routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/flows"
            element={
              <ProtectedRoute>
                <Flows />
              </ProtectedRoute>
            }
          />
          <Route
            path="/automations"
            element={
              <ProtectedRoute>
                <Automations />
              </ProtectedRoute>
            }
          />
          <Route
            path="/posts"
            element={
              <ProtectedRoute>
                <Posts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inbox"
            element={
              <ProtectedRoute>
                <Inbox />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/logs"
            element={
              <ProtectedRoute>
                <Logs />
              </ProtectedRoute>
            }
          />

          {/* Legacy redirects */}
          <Route path="/accounts" element={<Navigate to="/settings" replace />} />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
    </SidebarContext.Provider>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <AppLayout />
      </Router>
    </AuthProvider>
  );
};

export default App;
