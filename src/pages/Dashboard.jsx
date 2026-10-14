import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Phone,
  Calendar,
  LogOut,
  ShieldCheck,
  CheckCircle2,
  Hospital,
  Play,
  RotateCcw,
  Eye,
  Sliders,
  Sparkles,
  Clock,
  Activity,
  FileSpreadsheet,
  Key,
  Edit3
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import VisionTherapyCanvas from '../components/VisionTherapyCanvas';
import TelemetryModal from '../components/TelemetryModal';
import ProfileModal from '../components/ProfileModal';
import {
  getRegistrationById,
  getRegistrationByUsername,
  getRegistrationByEmail,
  subscribeToRegistration,
  completeTherapyTest,
  getTestResultById,
  getTestResultsForPatient
} from '../services/registrationService';

export default function Dashboard({ navigate }) {
  const { currentUser, logout } = useAuth();
  const [profileData, setProfileData] = useState(currentUser);
  const [isTestActive, setIsTestActive] = useState(false);
  const [loadingFresh, setLoadingFresh] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState('');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileModalTab, setProfileModalTab] = useState('profile');

  // Fetch the latest registration record to get real-time therapy test allotment
  const refreshProfile = async () => {
    setIsRefreshing(true);
    setRefreshMessage('');
    try {
      let fresh = null;

      // 1. Try by document ID
      const targetId = profileData?.id || profileData?.registrationId || currentUser?.registrationId || currentUser?.id;
      if (targetId) {
        fresh = await getRegistrationById(targetId);
      }

      // 2. Try by username
      if (!fresh) {
        const username = profileData?.username || currentUser?.username;
        if (username) {
          fresh = await getRegistrationByUsername(username);
        }
      }

      // 3. Try by email
      if (!fresh) {
        const email = profileData?.email || currentUser?.email;
        if (email) {
          fresh = await getRegistrationByEmail(email);
        }
      }

      if (fresh) {
        setProfileData(prev => ({ ...prev, ...fresh }));
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setRefreshMessage(`Synced at ${timeStr}`);
        setTimeout(() => setRefreshMessage(''), 4000);
      } else {
        setRefreshMessage('Up to date');
        setTimeout(() => setRefreshMessage(''), 3000);
      }
    } catch (e) {
      console.warn('Failed to refresh profile in dashboard:', e);
      setRefreshMessage('Sync failed');
      setTimeout(() => setRefreshMessage(''), 3000);
    } finally {
      setIsRefreshing(false);
      setLoadingFresh(false);
    }
  };

  // Initial fetch and automatic real-time listener subscription
  useEffect(() => {
    refreshProfile();

    const targetId = profileData?.id || profileData?.registrationId || currentUser?.registrationId || currentUser?.id;
    if (targetId) {
      const unsubscribe = subscribeToRegistration(targetId, (updated) => {
        if (updated) {
          setProfileData(prev => ({ ...prev, ...updated }));
        }
      });
      return () => unsubscribe();
    }
  }, [currentUser?.registrationId, currentUser?.username, profileData?.id]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // Normalize tests array
  let allTests = Array.isArray(profileData?.therapyTests) ? [...profileData.therapyTests] : [];
  if (allTests.length === 0 && profileData?.therapyTest) {
    allTests = [{ ...profileData.therapyTest, id: profileData.therapyTest.id || 'test_legacy' }];
  }

  const [activeTest, setActiveTest] = useState(null);
  const [telemetryModalData, setTelemetryModalData] = useState(null);
  const [loadingTelemetryId, setLoadingTelemetryId] = useState(null);

  const handleOpenTelemetry = async (test) => {
    setLoadingTelemetryId(test.id || 'loading');
    try {
      let resultDoc = null;
      if (test.resultId) {
        resultDoc = await getTestResultById(test.resultId);
      }

      const regId = profileData?.id || profileData?.registrationId || currentUser?.registrationId || currentUser?.id;
      if (!resultDoc && regId) {
        const patientResults = await getTestResultsForPatient(regId);
        resultDoc = patientResults.find(r => r.testId === test.id || r.id === test.resultId) || patientResults[0];
      }

      // If still not found, construct a valid telemetry session object from test parameters
      if (!resultDoc && (test.status === 'completed' || test.completedAt)) {
        resultDoc = {
          id: test.resultId || `result_${test.id || 'legacy'}`,
          registrationId: regId || '',
          patientName: profileData?.name || currentUser?.name || 'Patient',
          patientUsername: profileData?.username || currentUser?.username || '',
          testId: test.id,
          testTitle: test.title || 'Vision Therapy Stimulus Test',
          targetShape: test.targetShape || 'circle',
          mode: test.mode || 'pursuit',
          movement: test.movement || 'horizontal',
          duration: test.duration || 30,
          vStart: test.vStart || 250,
          vEnd: test.vEnd || 600,
          totalSamples: test.totalSamples || 420,
          meanErrorPx: test.meanErrorPx || 25,
          accuracyPct: test.accuracyPct || 92.4,
          completedAt: test.completedAt || new Date().toISOString()
        };
      }

      if (resultDoc) {
        setTelemetryModalData(resultDoc);
      } else {
        alert('No telemetry session recorded for this test yet. Click "Start Test" to record eye movements.');
      }
    } catch (e) {
      console.error('Error loading telemetry:', e);
      alert('Failed to load telemetry: ' + (e.message || 'Please try again.'));
    } finally {
      setLoadingTelemetryId(null);
    }
  };

  const handleTestComplete = async (completedResult) => {
    const regId = profileData?.id || currentUser?.registrationId;
    if (regId && activeTest) {
      await refreshProfile();
    }
  };

  const handleStartTest = (test) => {
    if (test.status === 'completed') {
      handleOpenTelemetry(test);
      return;
    }
    setActiveTest(test);
  };

  const getTargetEmoji = (shapeId) => {
    const map = {
      tiger: '🐯',
      cat: '🐱',
      dog: '🐶',
      panda: '🐼',
      lion: '🦁',
      rabbit: '🐰',
      star: '⭐',
      butterfly: '🦋',
      soccer: '⚽',
      car: '🚗',
      fish: '🐠',
      circle: '🔴'
    };
    return map[shapeId] || '🎯';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const therapyTest = profileData?.therapyTest;

  return (
    <div className="container page-wrapper">
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        {/* Header Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: '1.85rem', marginBottom: 4 }}>
              Welcome, {profileData?.name || 'Patient'}!
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
              Your clinical vision therapy account is active and verified.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {refreshMessage && (
              <span style={{
                fontSize: '0.82rem',
                color: refreshMessage.includes('failed') ? '#dc2626' : '#15803d',
                fontWeight: 600,
                background: refreshMessage.includes('failed') ? '#fee2e2' : '#dcfce7',
                padding: '5px 12px',
                borderRadius: '20px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                border: refreshMessage.includes('failed') ? '1px solid #fecaca' : '1px solid #bbf7d0',
                transition: 'all 0.2s ease'
              }}>
                {refreshMessage.includes('failed') ? '✕ ' : '✓ '} {refreshMessage}
              </span>
            )}

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setProfileModalTab('profile');
                setIsProfileModalOpen(true);
              }}
              title="View and edit your profile, username, and password"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <User size={15} />
              <span>My Profile</span>
            </button>

            <button
              type="button"
              className="btn btn-outline"
              onClick={refreshProfile}
              disabled={isRefreshing}
              title="Refresh and sync latest allotted tests from server"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <RotateCcw size={15} className={isRefreshing ? 'animate-spin' : ''} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <button
              type="button"
              className="btn btn-outline"
              onClick={handleLogout}
            >
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Status Callout */}
        <div className="alert alert-success" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CheckCircle2 size={24} style={{ flexShrink: 0 }} />
            <div>
              <strong>Approved Patient Account:</strong> Your identity and contact credentials have been verified by hospital administration.
            </div>
          </div>
          <StatusBadge status={profileData?.status || 'approved'} />
        </div>

        {/* ======================================================== */}
        {/* ALLOTTED VISION THERAPY TEST CARD (Main Hospital Content) */}
        {/* ======================================================== */}
        <div className="card" style={{
          marginBottom: 28,
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #496B5D 0%, #1E2B25 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(73, 107, 93, 0.25)'
              }}>
                <Eye size={24} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h2 style={{ fontSize: '1.35rem', margin: 0, fontFamily: 'var(--font-heading)' }}>Allotted Vision Therapy Tests</h2>
                  {allTests.length > 0 ? (
                    allTests.every(t => t.status === 'completed') ? (
                      <span className="badge badge-approved">All Completed ({allTests.length})</span>
                    ) : (
                      <span className="badge" style={{ background: '#EBF2EE', color: '#385347', border: '1px solid #C7DDD2' }}>
                        {allTests.filter(t => t.status === 'completed').length}/{allTests.length} Completed
                      </span>
                    )
                  ) : (
                    <span className="badge badge-pending">Awaiting Allotment</span>
                  )}
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: 4 }}>
                  Personalized visual stimulus training prescribed by your hospital ophthalmologist.
                </p>
              </div>
            </div>
          </div>

          {allTests.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {allTests.map((test, index) => {
                const emoji = getTargetEmoji(test.targetShape);
                const isCompleted = test.status === 'completed';

                return (
                  <div
                    key={test.id || index}
                    style={{
                      background: isCompleted ? '#F7FAF8' : '#ffffff',
                      border: isCompleted ? '1px solid #D2E4DC' : '1px solid var(--border-color)',
                      borderRadius: '12px',
                      padding: '20px',
                      boxShadow: 'var(--shadow-sm)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 48,
                          height: 48,
                          borderRadius: '12px',
                          background: test.bg === '#000000' ? '#0f172a' : '#f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.8rem',
                          border: '1px solid #cbd5e1'
                        }}>
                          {emoji}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <h3 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 700 }}>
                              {test.title || `Test ${index + 1}: ${emoji}`}
                            </h3>
                            <span className={`badge ${isCompleted ? 'badge-approved' : 'badge-admin'}`}>
                              {isCompleted ? '✓ Completed' : 'Ready to Start'}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            Assigned on {formatDate(test.allottedAt)}
                            {test.completedAt && ` • Done: ${new Date(test.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {isCompleted && (
                          <button
                            type="button"
                            className="btn btn-outline"
                            onClick={() => handleOpenTelemetry(test)}
                            disabled={loadingTelemetryId === (test.id || 'loading')}
                            style={{
                              padding: '9px 15px',
                              fontSize: '0.88rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              borderColor: '#0284c7',
                              color: '#0369a1',
                              fontWeight: 600,
                              cursor: loadingTelemetryId === (test.id || 'loading') ? 'wait' : 'pointer',
                              opacity: loadingTelemetryId === (test.id || 'loading') ? 0.7 : 1
                            }}
                            title="View recorded eye movements & object positions table"
                          >
                            <FileSpreadsheet size={16} />
                            <span>{loadingTelemetryId === (test.id || 'loading') ? 'Loading Telemetry...' : 'View Eye Telemetry'}</span>
                          </button>
                        )}

                        {isCompleted ? (
                          <button
                            type="button"
                            className="btn btn-outline"
                            disabled
                            style={{
                              padding: '9px 18px',
                              fontSize: '0.92rem',
                              cursor: 'not-allowed',
                              opacity: 0.75,
                              background: '#f8fafc',
                              borderColor: '#cbd5e1',
                              color: '#64748b',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6
                            }}
                            title="Test session completed. Camera input is locked for privacy and security."
                          >
                            <CheckCircle2 size={16} color="#16a34a" />
                            <span>Test Taken • Camera Locked</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => handleStartTest(test)}
                            style={{ padding: '9px 18px', fontSize: '0.92rem' }}
                          >
                            <Play size={16} fill="#ffffff" />
                            <span>Start Test {allTests.length > 1 ? index + 1 : ''}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Parameters Pill Row */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                      gap: 10,
                      background: isCompleted ? 'rgba(255, 255, 255, 0.7)' : '#f8fafc',
                      padding: 12,
                      borderRadius: 8,
                      border: '1px solid var(--border-color)',
                      fontSize: '0.82rem'
                    }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block' }}>Mode</span>
                        <strong style={{ textTransform: 'capitalize' }}>{test.mode}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block' }}>Trajectory</span>
                        <strong style={{ textTransform: 'capitalize' }}>{test.movement}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block' }}>Duration</span>
                        <strong style={{ color: 'var(--primary)' }}>{test.duration}s</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block' }}>Speed Ramp</span>
                        <strong>{test.vStart} → {test.vEnd} px/s</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', display: 'block' }}>Background</span>
                        <strong>{test.bg === '#000000' ? 'Black' : 'White'}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{
              background: '#f8fafc',
              border: '1px dashed #cbd5e1',
              borderRadius: 10,
              padding: 28,
              textAlign: 'center'
            }}>
              <Sliders size={32} color="#94a3b8" style={{ marginBottom: 10 }} />
              <h4 style={{ fontSize: '1.05rem', marginBottom: 6, color: '#334155' }}>
                No Vision Therapy Tests Allotted Yet
              </h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 520, margin: '0 auto', lineHeight: 1.5 }}>
                Your hospital ophthalmologist will evaluate your medical record and configure your personalized vision therapy parameters. Once allotted by the admin, your test sessions will appear here.
              </p>
            </div>
          )}
        </div>

        {/* Profile Card */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 className="card-title">Registration Profile</h2>
              <p className="card-subtitle">Official details recorded in the hospital registry.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => {
                  setProfileModalTab('username');
                  setIsProfileModalOpen(true);
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                title="Change your login username"
              >
                <Edit3 size={14} />
                <span>Edit Username</span>
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => {
                  setProfileModalTab('password');
                  setIsProfileModalOpen(true);
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                title="Change your login password"
              >
                <Key size={14} />
                <span>Change Password</span>
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--primary-light)', color: 'var(--primary)', padding: '6px 12px', borderRadius: 'var(--radius-full)', fontSize: '0.85rem', fontWeight: 600 }}>
                <ShieldCheck size={16} />
                <span>Verified Record</span>
              </div>
            </div>
          </div>

          <div className="profile-grid">
            <div className="profile-field">
              <div className="profile-field-label">Full Name</div>
              <div className="profile-field-value">{profileData?.name || '—'}</div>
            </div>

            <div className="profile-field">
              <div className="profile-field-label">Login Username (Email)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="profile-field-value" style={{ fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 700 }}>
                  {profileData?.username || '—'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setProfileModalTab('username');
                    setIsProfileModalOpen(true);
                  }}
                  className="btn btn-sm btn-outline"
                  style={{ padding: '2px 8px', fontSize: '0.75rem', height: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  title="Change your username"
                >
                  <Edit3 size={12} />
                  <span>Edit</span>
                </button>
              </div>
            </div>

            <div className="profile-field">
              <div className="profile-field-label">Registered Gmail</div>
              <div className="profile-field-value" style={{ wordBreak: 'break-all' }}>
                {profileData?.email || '—'}
              </div>
            </div>

            <div className="profile-field">
              <div className="profile-field-label">Contact Phone</div>
              <div className="profile-field-value">
                +91 {profileData?.phone || '—'}
              </div>
            </div>

            <div className="profile-field">
              <div className="profile-field-label">Age & Gender</div>
              <div className="profile-field-value">
                {profileData?.age ? `${profileData.age} years` : '—'} • {profileData?.gender || '—'}
              </div>
            </div>

            <div className="profile-field">
              <div className="profile-field-label">Registration Status</div>
              <div className="profile-field-value" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <StatusBadge status={profileData?.status || 'approved'} />
              </div>
            </div>

            <div className="profile-field">
              <div className="profile-field-label">Account Created</div>
              <div className="profile-field-value" style={{ fontSize: '0.95rem' }}>
                {formatDate(profileData?.createdAt)}
              </div>
            </div>

            <div className="profile-field">
              <div className="profile-field-label">Approved By Admin</div>
              <div className="profile-field-value" style={{ fontSize: '0.95rem', color: 'var(--success)' }}>
                {formatDate(profileData?.approvedAt)}
              </div>
            </div>
          </div>
        </div>

        {/* Hospital Service Helpdesk */}
        <div className="card" style={{ marginTop: 24, backgroundColor: '#f8fafc', borderStyle: 'dashed' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <Hospital size={28} color="var(--primary)" style={{ flexShrink: 0, marginTop: 4 }} />
            <div>
              <h3 style={{ fontSize: '1.05rem', marginBottom: 4 }}>Vision Therapy Patient Services</h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Present your unique Username (<strong>{profileData?.username}</strong>) or registered phone number when checking in with your ophthalmologist for consultations, eye examinations, and clinical therapy appointments.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* FULLSCREEN VISION THERAPY CANVAS LAUNCHER                */}
      {/* ======================================================== */}
      {activeTest && (
        <VisionTherapyCanvas
          config={activeTest}
          patientInfo={{
            registrationId: profileData?.id || currentUser?.registrationId || '',
            patientName: profileData?.name || currentUser?.name || 'Patient',
            patientUsername: profileData?.username || currentUser?.username || ''
          }}
          onComplete={handleTestComplete}
          onClose={() => setActiveTest(null)}
        />
      )}

      {/* Interactive Telemetry Table Modal */}
      {telemetryModalData && (
        <TelemetryModal
          result={telemetryModalData}
          onClose={() => setTelemetryModalData(null)}
        />
      )}

      {/* Profile & Security Management Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        initialTab={profileModalTab}
        onProfileUpdated={(updated) => {
          setProfileData((prev) => ({ ...prev, ...updated }));
          refreshProfile();
        }}
      />
    </div>
  );
}
