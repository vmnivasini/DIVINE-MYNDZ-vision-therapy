import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Home from './pages/Home';
import Register from './pages/Register';
import AdminRegister from './pages/AdminRegister';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdminLogin from './pages/AdminLogin';
import SuperAdminLogin from './pages/SuperAdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import { BRAND_CONFIG } from './config/branding';

function AppRoutes() {
  const [currentPath, setCurrentPath] = useState(() => {
    const hash = window.location.hash.replace(/^#/, '');
    return hash || '/';
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#/, '');
      setCurrentPath(hash || '/');
      window.scrollTo(0, 0);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (path) => {
    window.location.hash = path;
    setCurrentPath(path);
  };

  return (
    <div className="app-container">
      {/* Main Navbar */}
      <Navbar currentPath={currentPath} navigate={navigate} />

      {/* Main Content Router */}
      <main className="main-content">
        {currentPath === '/' && <Home navigate={navigate} />}
        {currentPath === '/register' && <Register navigate={navigate} />}
        {currentPath === '/admin-register' && <AdminRegister navigate={navigate} />}
        {currentPath === '/login' && <Login navigate={navigate} />}
        {currentPath === '/admin-login' && <AdminLogin navigate={navigate} />}
        {currentPath === '/superadmin-login' && <SuperAdminLogin navigate={navigate} />}

        {currentPath === '/dashboard' && (
          <ProtectedRoute requireUser={true} navigate={navigate}>
            <Dashboard navigate={navigate} />
          </ProtectedRoute>
        )}

        {(currentPath === '/admin-dashboard' || currentPath === '/superadmin-dashboard') && (
          <ProtectedRoute requireAdmin={true} navigate={navigate}>
            <AdminDashboard navigate={navigate} />
          </ProtectedRoute>
        )}
      </main>

      {/* Secondary Page Footer (Home page has full clinical footer) */}
      {currentPath !== '/' && (
        <footer className="footer" style={{ borderTop: '1px solid var(--border-color)', backgroundColor: '#FFFFFF', padding: '18px 0' }}>
          <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <strong>{BRAND_CONFIG.organizationName}</strong> • Clinical Portal & Visual Rehabilitation
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Role-Based Access Control • Secure Healthcare Infrastructure
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
