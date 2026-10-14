import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, requireAdmin = false, requireUser = false, navigate }) {
  const { currentUser, loading, isAdmin, isUser } = useAuth();

  if (loading) {
    return (
      <div className="container" style={{ padding: '80px 20px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading session...</p>
      </div>
    );
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div className="container page-wrapper">
        <div className="card" style={{ maxWidth: 480, margin: '40px auto', textAlign: 'center' }}>
          <h3 style={{ marginBottom: 12 }}>Admin Access Required</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
            You need to be logged in as an administrator to view this page.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/admin-login')}>
            Go to Admin Login
          </button>
        </div>
      </div>
    );
  }

  if (requireUser && !isUser && !isAdmin) {
    return (
      <div className="container page-wrapper">
        <div className="card" style={{ maxWidth: 480, margin: '40px auto', textAlign: 'center' }}>
          <h3 style={{ marginBottom: 12 }}>Login Required</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
            Please log in with your assigned username and password to view your dashboard.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/login')}>
            Go to User Login
          </button>
        </div>
      </div>
    );
  }

  return children;
}
