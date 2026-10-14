import React, { useState } from 'react';
import { ArrowLeft, AlertCircle, LogIn, UserPlus, Sparkles, Stethoscope } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import BrandLogo from '../components/BrandLogo';

export default function AdminLogin({ navigate }) {
  const { loginAdmin } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!identifier.trim()) {
      setError('Please enter your Ophthalmologist Username or registered email.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      await loginAdmin(identifier, password);
      navigate('/admin-dashboard');
    } catch (err) {
      setError(err.message || 'Invalid ophthalmologist credentials or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container page-wrapper">
      <div
        className="card"
        style={{
          maxWidth: 480,
          margin: '20px auto',
          borderTop: '4px solid var(--primary)',
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
                background: 'var(--primary-light)',
                color: 'var(--primary)',
                fontWeight: 700,
                fontSize: '0.75rem',
                padding: '4px 10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <Stethoscope size={12} />
              <span>Clinical Staff</span>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-md)',
                background: 'var(--primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)'
              }}
            >
              <Stethoscope size={22} />
            </div>
            <div>
              <h2 className="card-title" style={{ margin: 0, fontSize: '1.35rem' }}>
                Ophthalmologist Login
              </h2>
              <span style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600 }}>
                Ophthalmologists, Optometrists & Clinical Staff
              </span>
            </div>
          </div>
          <p className="card-subtitle" style={{ fontSize: '0.88rem', lineHeight: 1.5, marginTop: 4 }}>
            Access clinical patient management: Allocate vision therapy exercises, calibrate visual stimulus parameters, and inspect eye tracking telemetry.
          </p>
        </div>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate autoComplete="off">
          {/* Ophthalmologist Identifier */}
          <div className="form-group">
            <label className="form-label" htmlFor="admin-identifier">
              Ophthalmologist Username or Email <span className="required">*</span>
            </label>
            <input
              id="admin-identifier"
              type="text"
              className="form-control"
              placeholder="e.g. doctor@eyehospital.com"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                if (error) setError('');
              }}
              disabled={loading}
              autoComplete="off"
              autoFocus
            />
            <p className="form-hint">Enter your registered email address or assigned doctor username.</p>
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="admin-password">
              Password <span className="required">*</span>
            </label>
            <input
              id="admin-password"
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

          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              type="submit"
              className="btn btn-primary btn-block btn-lg"
              disabled={loading}
            >
              <LogIn size={18} />
              <span>{loading ? 'Authenticating...' : 'Sign In as Ophthalmologist'}</span>
            </button>

            <button
              type="button"
              className="btn btn-outline btn-block"
              onClick={() => navigate('/admin-register')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontWeight: 600,
                fontSize: '0.88rem'
              }}
            >
              <UserPlus size={16} />
              <span>New Staff? Register for Ophthalmologist Access</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
