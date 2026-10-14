import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Key,
  Lock,
  Eye,
  EyeOff,
  Check,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Stethoscope,
  Crown,
  Edit3,
  Mail,
  Phone,
  Building,
  Calendar,
  Sparkles,
  IdCard,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  fetchFullProfile,
  updateAccountUsername,
  updateAccountPassword
} from '../services/authService';
import StatusBadge from './StatusBadge';

export default function ProfileModal({
  isOpen,
  onClose,
  initialTab = 'profile',
  onProfileUpdated
}) {
  const { currentUser, updateUserSession } = useAuth();

  const [activeTab, setActiveTab] = useState(initialTab); // 'profile' | 'username' | 'password'
  const [profileData, setProfileData] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Username form state
  const [newUsername, setNewUsername] = useState('');
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [usernameSuccess, setUsernameSuccess] = useState('');

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Reset & load profile whenever modal opens
  useEffect(() => {
    if (isOpen && currentUser) {
      setActiveTab(initialTab || 'profile');
      setUsernameError('');
      setUsernameSuccess('');
      setPasswordError('');
      setPasswordSuccess('');
      setNewUsername('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      loadProfile();
    }
  }, [isOpen, currentUser, initialTab]);

  const loadProfile = async () => {
    setLoadingProfile(true);
    try {
      const data = await fetchFullProfile(currentUser);
      setProfileData(data || currentUser);
      if (data?.username) {
        setNewUsername(data.username);
      }
    } catch (e) {
      console.warn('Failed to load profile in modal:', e);
      setProfileData(currentUser);
    } finally {
      setLoadingProfile(false);
    }
  };

  if (!isOpen || !currentUser) return null;

  const role = currentUser.role || 'user';
  const isAdmin = role === 'admin' || role === 'superadmin';
  const isSuperAdmin = role === 'superadmin';

  // Handle Username Update
  const handleSaveUsername = async (e) => {
    e.preventDefault();
    setUsernameError('');
    setUsernameSuccess('');

    const cleanNew = newUsername.trim().toLowerCase();
    const cleanOld = (profileData?.username || currentUser?.username || '').trim().toLowerCase();

    if (!cleanNew) {
      setUsernameError('Please enter a new username.');
      return;
    }
    if (cleanNew.length < 3 || cleanNew.length > 50) {
      setUsernameError('Username must be between 3 and 50 characters.');
      return;
    }
    if (!/^[a-z0-9_.@+-]+$/i.test(cleanNew)) {
      setUsernameError('Username can only contain letters, numbers, underscores, dots, @, + and hyphens.');
      return;
    }
    if (cleanNew === cleanOld) {
      setUsernameError('New username is the same as your current username.');
      return;
    }

    setUsernameLoading(true);
    try {
      const res = await updateAccountUsername({
        oldUsername: cleanOld,
        newUsername: cleanNew,
        role: currentUser.role,
        registrationId: profileData?.registrationId || currentUser.registrationId || profileData?.id,
        adminRegistrationId: profileData?.adminRegistrationId || currentUser.adminRegistrationId,
        uid: currentUser.uid,
        email: profileData?.email || currentUser.email
      });

      setUsernameSuccess(`Username successfully changed to "${res.newUsername}"! You can now use this username to log in.`);
      
      // Update session and local profile
      updateUserSession({ username: res.newUsername });
      setProfileData(prev => ({ ...prev, username: res.newUsername }));

      if (onProfileUpdated) {
        onProfileUpdated({ username: res.newUsername });
      }
    } catch (err) {
      console.error('Username update failed:', err);
      setUsernameError(err.message || 'Failed to update username. Please try again.');
    } finally {
      setUsernameLoading(false);
    }
  };

  // Handle Password Update
  const handleSavePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword) {
      setPasswordError('Please enter your current password to verify your identity.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match. Please verify and re-type.');
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError('New password must be different from your current password.');
      return;
    }

    setPasswordLoading(true);
    try {
      await updateAccountPassword(currentPassword, newPassword);
      setPasswordSuccess('Password updated successfully! Your account credentials have been securely updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error('Password update failed:', err);
      setPasswordError(err.message || 'Failed to update password. Please check your current password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const formatDate = (val) => {
    if (!val) return '—';
    try {
      const dateObj = typeof val?.toDate === 'function' ? val.toDate() : new Date(val);
      return isNaN(dateObj.getTime())
        ? String(val)
        : dateObj.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return String(val);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div
        className="modal-dialog"
        style={{
          maxWidth: 620,
          borderRadius: '16px',
          boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px',
          background: isAdmin
            ? 'linear-gradient(135deg, #0369a1 0%, #0284c7 100%)'
            : 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.18)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}>
              {isSuperAdmin ? (
                <Crown size={24} />
              ) : isAdmin ? (
                <Stethoscope size={24} />
              ) : (
                <User size={24} />
              )}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#ffffff' }}>
                  {profileData?.name || currentUser?.name || 'Account Profile'}
                </h3>
                <span style={{
                  fontSize: '0.72rem',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  fontWeight: 600,
                  background: 'rgba(255, 255, 255, 0.22)',
                  color: '#ffffff',
                  letterSpacing: '0.3px',
                  textTransform: 'uppercase'
                }}>
                  {isSuperAdmin ? 'Admin' : isAdmin ? 'Ophthalmologist' : 'Patient'}
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.85)' }}>
                {isAdmin
                  ? `${profileData?.department || 'Ophthalmology Department'} • Staff Profile`
                  : 'Verified Patient Care Record'}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            style={{
              color: 'rgba(255, 255, 255, 0.8)',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '50%',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          background: '#f8fafc',
          padding: '4px 16px 0 16px',
          gap: 6
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            style={{
              padding: '10px 16px',
              border: 'none',
              background: 'transparent',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              color: activeTab === 'profile' ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeTab === 'profile' ? '2px solid var(--primary)' : '2px solid transparent',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              transition: 'all 0.15s ease'
            }}
          >
            <IdCard size={16} />
            <span>Profile Details</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('username');
              setUsernameError('');
              setUsernameSuccess('');
              setNewUsername(profileData?.username || currentUser?.username || '');
            }}
            style={{
              padding: '10px 16px',
              border: 'none',
              background: 'transparent',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              color: activeTab === 'username' ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeTab === 'username' ? '2px solid var(--primary)' : '2px solid transparent',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              transition: 'all 0.15s ease'
            }}
          >
            <Edit3 size={16} />
            <span>Edit Username</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('password');
              setPasswordError('');
              setPasswordSuccess('');
            }}
            style={{
              padding: '10px 16px',
              border: 'none',
              background: 'transparent',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              color: activeTab === 'password' ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeTab === 'password' ? '2px solid var(--primary)' : '2px solid transparent',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              transition: 'all 0.15s ease'
            }}
          >
            <Key size={16} />
            <span>Edit Password</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto', padding: '24px' }}>
          {/* TAB 1: VIEW PROFILE */}
          {activeTab === 'profile' && (
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 18,
                flexWrap: 'wrap',
                gap: 10
              }}>
                <div>
                  <h4 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 700, color: 'var(--text-main)' }}>
                    Official Registry Information
                  </h4>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Your identity has been verified in the hospital database.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={loadProfile}
                    disabled={loadingProfile}
                    title="Reload latest record from server"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.8rem' }}
                  >
                    <RefreshCw size={13} className={loadingProfile ? 'animate-spin' : ''} />
                    <span>Sync</span>
                  </button>
                  <StatusBadge status={profileData?.status || 'approved'} />
                </div>
              </div>

              {/* Profile Details Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 14,
                marginBottom: 20
              }}>
                {/* Full Name */}
                <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 2 }}>
                    Full Legal Name
                  </span>
                  <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>
                    {profileData?.name || '—'}
                  </strong>
                </div>

                {/* Assigned Username */}
                <div style={{ background: '#eff6ff', padding: '12px 16px', borderRadius: '10px', border: '1px solid #bfdbfe', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#1e40af', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 2 }}>
                      Login Username
                    </span>
                    <strong style={{ fontSize: '1.05rem', fontFamily: 'monospace', color: '#1d4ed8' }}>
                      {profileData?.username || currentUser?.username || '—'}
                    </strong>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => {
                      setActiveTab('username');
                      setNewUsername(profileData?.username || currentUser?.username || '');
                    }}
                    style={{ padding: '4px 10px', fontSize: '0.78rem', borderColor: 'var(--primary)', color: 'var(--primary)' }}
                  >
                    <Edit3 size={13} />
                    <span>Change</span>
                  </button>
                </div>

                {/* Email Address */}
                <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 2 }}>
                    Registered Email
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.92rem', color: 'var(--text-main)', wordBreak: 'break-all' }}>
                    <Mail size={15} color="#64748b" style={{ flexShrink: 0 }} />
                    <span>{profileData?.email || currentUser?.email || '—'}</span>
                  </div>
                </div>

                {/* Phone Number */}
                <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 2 }}>
                    Contact Phone
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                    <Phone size={15} color="#64748b" />
                    <span>{profileData?.phone ? `+91 ${profileData.phone}` : '—'}</span>
                  </div>
                </div>

                {/* Role Specific Fields */}
                {isAdmin ? (
                  <>
                    <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 2 }}>
                        Department
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                        <Building size={15} color="#64748b" />
                        <span>{profileData?.department || 'Ophthalmology'}</span>
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 2 }}>
                        Staff ID / License
                      </span>
                      <strong style={{ fontSize: '0.92rem', color: 'var(--text-main)' }}>
                        {profileData?.staffId || 'MED-STAFF'}
                      </strong>
                    </div>

                    {profileData?.specialization && (
                      <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-color)', gridColumn: '1 / -1' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 2 }}>
                          Clinical Specialization
                        </span>
                        <strong style={{ fontSize: '0.92rem', color: 'var(--text-main)' }}>
                          {profileData.specialization}
                        </strong>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 2 }}>
                        Age & Gender
                      </span>
                      <strong style={{ fontSize: '0.92rem', color: 'var(--text-main)' }}>
                        {profileData?.age ? `${profileData.age} years` : '—'} • {profileData?.gender || '—'}
                      </strong>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 2 }}>
                        Hospital Registry ID
                      </span>
                      <strong style={{ fontSize: '0.88rem', fontFamily: 'monospace', color: 'var(--text-main)' }}>
                        {profileData?.registrationId || profileData?.id || currentUser?.registrationId || '—'}
                      </strong>
                    </div>
                  </>
                )}

                {/* Account Security Password Status */}
                <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gridColumn: '1 / -1' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 2 }}>
                      Account Password
                    </span>
                    <span style={{ letterSpacing: '2px', fontSize: '1rem', color: 'var(--text-main)' }}>
                      ••••••••••••
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => setActiveTab('password')}
                    style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                  >
                    <Key size={13} />
                    <span>Change Password</span>
                  </button>
                </div>

                {/* Timestamps */}
                <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 2 }}>
                    Approved On
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                    <Calendar size={14} color="#64748b" />
                    <span>{formatDate(profileData?.approvedAt || profileData?.createdAt)}</span>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 2 }}>
                    Authentication Status
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.88rem', color: '#16a34a', fontWeight: 600 }}>
                    <ShieldCheck size={16} />
                    <span>Active & Verified</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions Footer */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setActiveTab('username');
                    setNewUsername(profileData?.username || currentUser?.username || '');
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.88rem' }}
                >
                  <Edit3 size={15} />
                  <span>Edit Username</span>
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setActiveTab('password')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.88rem' }}
                >
                  <Key size={15} />
                  <span>Edit Password</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: EDIT USERNAME */}
          {activeTab === 'username' && (
            <form onSubmit={handleSaveUsername}>
              <div style={{ marginBottom: 18 }}>
                <h4 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 700, color: 'var(--text-main)' }}>
                  Change Username
                </h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Your username is used to log into the portal. By default it is your Gmail address. You can change it to any unique value.
                </p>
              </div>

              {usernameSuccess && (
                <div className="alert alert-success" style={{ marginBottom: 16, fontSize: '0.88rem', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>{usernameSuccess}</div>
                </div>
              )}

              {usernameError && (
                <div className="alert alert-danger" style={{ marginBottom: 16, fontSize: '0.88rem', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>{usernameError}</div>
                </div>
              )}

              {/* Current Username Box */}
              <div style={{
                background: '#f8fafc',
                padding: '12px 16px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                marginBottom: 16
              }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 2 }}>
                  Current Username
                </span>
                <strong style={{ fontSize: '1.05rem', fontFamily: 'monospace', color: 'var(--text-main)' }}>
                  {profileData?.username || currentUser?.username || '—'}
                </strong>
              </div>

              {/* New Username Input */}
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label" htmlFor="newUsernameInput" style={{ fontWeight: 600 }}>
                  Enter New Username <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="newUsernameInput"
                    type="text"
                    className="form-control"
                    placeholder="e.g. john@gmail.com or my_username"
                    value={newUsername}
                    onChange={(e) => {
                      setNewUsername(e.target.value);
                      setUsernameError('');
                    }}
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '1rem',
                      fontWeight: 600,
                      letterSpacing: '0.3px'
                    }}
                    maxLength={50}
                    required
                  />
                </div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  Rules: 3 to 50 characters. Allowed: Letters, numbers, underscores, dots, @, + and hyphens. Must be unique.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 10, borderTop: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setActiveTab('profile')}
                >
                  Back to Profile
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={usernameLoading || !newUsername.trim()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: '140px', justifyContent: 'center' }}
                >
                  {usernameLoading ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>Save Username</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: EDIT PASSWORD */}
          {activeTab === 'password' && (
            <form onSubmit={handleSavePassword}>
              <div style={{ marginBottom: 18 }}>
                <h4 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 700, color: 'var(--text-main)' }}>
                  Change Password
                </h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Update your confidential password. For security, please enter your current password first.
                </p>
              </div>

              {passwordSuccess && (
                <div className="alert alert-success" style={{ marginBottom: 16, fontSize: '0.88rem', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>{passwordSuccess}</div>
                </div>
              )}

              {passwordError && (
                <div className="alert alert-danger" style={{ marginBottom: 16, fontSize: '0.88rem', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>{passwordError}</div>
                </div>
              )}

              {/* Current Password Field */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" htmlFor="currentPassInput" style={{ fontWeight: 600 }}>
                  Current Password <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="currentPassInput"
                    type={showCurrentPass ? 'text' : 'password'}
                    className="form-control"
                    placeholder="Enter your current password"
                    value={currentPassword}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value);
                      setPasswordError('');
                    }}
                    style={{ paddingRight: 42 }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
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
                  >
                    {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* New Password Field */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" htmlFor="newPassInput" style={{ fontWeight: 600 }}>
                  New Password <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="newPassInput"
                    type={showNewPass ? 'text' : 'password'}
                    className="form-control"
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setPasswordError('');
                    }}
                    style={{ paddingRight: 42 }}
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
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
                  >
                    {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  Must be at least 6 characters long.
                </span>
              </div>

              {/* Confirm New Password Field */}
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label" htmlFor="confirmPassInput" style={{ fontWeight: 600 }}>
                  Confirm New Password <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="confirmPassInput"
                    type={showConfirmPass ? 'text' : 'password'}
                    className="form-control"
                    placeholder="Re-type your new password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setPasswordError('');
                    }}
                    style={{ paddingRight: 42 }}
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
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
                  >
                    {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 10, borderTop: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setActiveTab('profile')}
                >
                  Back to Profile
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={passwordLoading || !newPassword || !confirmPassword || !currentPassword}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: '150px', justifyContent: 'center' }}
                >
                  {passwordLoading ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <Lock size={16} />
                      <span>Update Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <ShieldCheck size={14} color="#16a34a" />
            <span>End-to-End Encrypted & Authenticated</span>
          </div>

          <button
            type="button"
            className="btn btn-outline"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
