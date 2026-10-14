import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff, LogIn, ArrowLeft, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login({ navigate }) {
  const { loginUser } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Please enter your assigned username.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      await loginUser(username, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container page-wrapper">
      <div className="card" style={{ maxWidth: 460, margin: '20px auto' }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => navigate('/')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
            >
              <ArrowLeft size={18} />
              <span style={{ fontSize: '0.85rem', marginLeft: 4 }}>Back to Home</span>
            </button>
          </div>
          <h2 className="card-title">Patient Login</h2>
          <p className="card-subtitle">
            Enter your registered Gmail address (username) and the temporary password provided to you upon registration approval.
          </p>
        </div>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate autoComplete="off">
          {/* Username */}
          <div className="form-group">
            <label className="form-label" htmlFor="user-username">
              Email (Username) <span className="required">*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="user-username"
                type="text"
                className="form-control"
                placeholder="e.g. john@gmail.com"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (error) setError('');
                }}
                disabled={loading}
                autoComplete="off"
                autoFocus
              />
            </div>
            <p className="form-hint">Your registered Gmail address is your login username.</p>
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="user-password">
              Password <span className="required">*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="user-password"
                type={showPassword ? 'text' : 'password'}
                className="form-control"
                placeholder="Enter password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                disabled={loading}
                autoComplete="off"
                style={{ paddingRight: 42 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div style={{ marginTop: 28 }}>
            <button
              type="submit"
              className="btn btn-primary btn-block btn-lg"
              disabled={loading}
            >
              <LogIn size={18} />
              <span>{loading ? 'Authenticating...' : 'Sign In to Patient Portal'}</span>
            </button>
          </div>
        </form>

        <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border-color)', textAlign: 'center', fontSize: '0.86rem', color: 'var(--text-muted)' }}>
          Haven't registered yet?{' '}
          <a
            href="#/register"
            onClick={(e) => {
              e.preventDefault();
              navigate('/register');
            }}
            style={{ fontWeight: 600 }}
          >
            Submit a registration request
          </a>
        </div>
      </div>
    </div>
  );
}
