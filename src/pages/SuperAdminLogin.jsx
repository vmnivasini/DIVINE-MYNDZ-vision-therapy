import React, { useState } from 'react';
import { Sparkles, AlertCircle, LogIn, ArrowLeft, Crown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function SuperAdminLogin({ navigate }) {
  const { loginSuperAdmin } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!identifier.trim()) {
      setError('Please enter your Admin username or email.');
      return;
    }
    if (!password) {
      setError('Please enter your admin password.');
      return;
    }

    setLoading(true);
    try {
      await loginSuperAdmin(identifier, password);
      navigate('/admin-dashboard');
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify your Admin credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container page-wrapper">
      <div
        className="card"
        style={{
          maxWidth: 490,
          margin: '20px auto',
          borderTop: '4px solid var(--secondary)',
          boxShadow: 'var(--shadow-md)',
          backgroundColor: '#FFFFFF'
        }}
      >
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => navigate('/')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: '0.85rem'
              }}
            >
              <ArrowLeft size={16} />
              <span>Back to Home</span>
            </button>

            <span
              className="badge"
              style={{
                background: 'var(--secondary)',
                color: '#FAF8F4',
                fontWeight: 700,
                fontSize: '0.75rem',
                padding: '4px 10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <Sparkles size={12} />
              <span>System Authority</span>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-md)',
                background: 'var(--card-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--secondary)'
              }}
            >
              <Crown size={22} />
            </div>
            <div>
              <h2 className="card-title" style={{ margin: 0, color: 'var(--secondary)', fontSize: '1.4rem' }}>
                Admin Portal Login
              </h2>
              <span style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600 }}>
                System Oversight & Clinical Staff Governance
              </span>
            </div>
          </div>

          <p className="card-subtitle" style={{ fontSize: '0.88rem', lineHeight: 1.5, marginTop: 4 }}>
            Control console for reviewing and approving Ophthalmologists, configuring system testing protocols, and managing clinical records.
          </p>
        </div>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate autoComplete="off">
          <div className="form-group">
            <label className="form-label" htmlFor="superadmin-identifier">
              Admin Email or Master Username <span className="required">*</span>
            </label>
            <input
              id="superadmin-identifier"
              type="text"
              className="form-control"
              placeholder="e.g. admin"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                if (error) setError('');
              }}
              disabled={loading}
              autoComplete="off"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="superadmin-password">
              Admin Password <span className="required">*</span>
            </label>
            <input
              id="superadmin-password"
              type="password"
              className="form-control"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError('');
              }}
              disabled={loading}
              autoComplete="off"
            />
          </div>

          <div style={{ marginTop: 24 }}>
            <button
              type="submit"
              className="btn btn-dark btn-block btn-lg"
              disabled={loading}
            >
              <LogIn size={18} />
              <span>{loading ? 'Authenticating...' : 'Sign In as Admin'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
