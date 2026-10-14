import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Clock,
  CheckCircle,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Eye,
  Check,
  X,
  RotateCw,
  AlertCircle,
  Sliders,
  Shield,
  UserCheck,
  UserX,
  UserPlus,
  Trash2,
  Building,
  Activity,
  FileSpreadsheet,
  Award,
  Sparkles,
  User,
  Key,
  Edit3
} from 'lucide-react';
import { getAllRegistrations, approveRegistration, rejectRegistration } from '../services/registrationService';
import {
  getAllAdminRegistrations,
  approveAdminRegistration,
  rejectAdminRegistration,
  removeAdmin,
  getActiveAdminsList
} from '../services/adminRegistrationService';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import ConfirmModal from '../components/ConfirmModal';
import CredentialModal from '../components/CredentialModal';
import ViewDetailsModal from '../components/ViewDetailsModal';
import AllotTestModal from '../components/AllotTestModal';
import VisionTherapyCanvas from '../components/VisionTherapyCanvas';
import ProfileModal from '../components/ProfileModal';

const formatDateSafe = (d) => {
  if (!d) return 'Recent';
  try {
    const dateObj = typeof d?.toDate === 'function' ? d.toDate() : new Date(d);
    return isNaN(dateObj.getTime()) ? 'Recent' : dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return 'Recent';
  }
};

export default function AdminDashboard({ navigate: _navigate }) {
  const { currentUser: _currentUser, isSuperAdmin, isAdmin: _isAdmin } = useAuth();

  // Profile modal state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileModalTab, setProfileModalTab] = useState('profile');

  // Active Tab for Super Admin: 'patients' | 'admins' | 'overview'
  const [activeTab, setActiveTab] = useState('patients');

  // ==========================================
  // PATIENTS STATE
  // ==========================================
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Search & Filter State for Patients
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals for Patients
  const [approveConfirmTarget, setApproveConfirmTarget] = useState(null);
  const [rejectConfirmTarget, setRejectConfirmTarget] = useState(null);
  const [credentialModalData, setCredentialModalData] = useState(null);
  const [viewDetailsTarget, setViewDetailsTarget] = useState(null);
  const [allotTestTarget, setAllotTestTarget] = useState(null);
  const [previewConfig, setPreviewConfig] = useState(null);

  // ==========================================
  // ADMIN MANAGEMENT STATE (FOR SUPER ADMIN)
  // ==========================================
  const [adminRegistrations, setAdminRegistrations] = useState([]);
  const [activeAdmins, setActiveAdmins] = useState([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [adminSearchTerm, setAdminSearchTerm] = useState('');
  const [adminSection, setAdminSection] = useState('pending'); // 'pending' | 'active'

  // Modals for Admin Management
  const [approveAdminConfirmTarget, setApproveAdminConfirmTarget] = useState(null);
  const [rejectAdminConfirmTarget, setRejectAdminConfirmTarget] = useState(null);
  const [removeAdminConfirmTarget, setRemoveAdminConfirmTarget] = useState(null);

  // Fetch Patients
  const fetchRegistrations = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAllRegistrations();
      setRegistrations(data);
    } catch (err) {
      setError(err.message || 'Failed to load registrations.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Admin applications and active admins (Super Admin only)
  const fetchAdminData = async () => {
    if (!isSuperAdmin) return;
    setLoadingAdmins(true);
    try {
      const [applications, adminsList] = await Promise.all([
        getAllAdminRegistrations(),
        getActiveAdminsList()
      ]);
      setAdminRegistrations(applications);
      setActiveAdmins(adminsList);
    } catch (err) {
      console.error('Failed to load admin management data:', err);
    } finally {
      setLoadingAdmins(false);
    }
  };

  useEffect(() => {
    fetchRegistrations();
    if (isSuperAdmin) {
      fetchAdminData();
    }
  }, [isSuperAdmin]);

  // Compute Patient Statistics
  const patientStats = useMemo(() => {
    const total = registrations.length;
    const pending = registrations.filter(r => r.status === 'pending').length;
    const approved = registrations.filter(r => r.status === 'approved').length;
    const rejected = registrations.filter(r => r.status === 'rejected').length;
    return { total, pending, approved, rejected };
  }, [registrations]);

  // Compute Admin Statistics
  const adminStats = useMemo(() => {
    const pending = adminRegistrations.filter(a => a.status === 'pending').length;
    const totalApplications = adminRegistrations.length;
    const active = activeAdmins.length;
    return { pending, totalApplications, active };
  }, [adminRegistrations, activeAdmins]);

  // Filtered Patients
  const filteredRegistrations = useMemo(() => {
    return registrations.filter(reg => {
      if (statusFilter !== 'all' && reg.status !== statusFilter) {
        return false;
      }
      if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase().trim();
        const matchesName = reg.name?.toLowerCase().includes(query);
        const matchesEmail = reg.email?.toLowerCase().includes(query);
        const matchesPhone = reg.phone?.includes(query);
        const matchesUsername = reg.username?.toLowerCase().includes(query);
        return matchesName || matchesEmail || matchesPhone || matchesUsername;
      }
      return true;
    });
  }, [registrations, statusFilter, searchTerm]);

  // Filtered Pending Admin Applications
  const pendingAdminApplications = useMemo(() => {
    return adminRegistrations.filter(app => {
      if (app.status !== 'pending') return false;
      if (adminSearchTerm.trim() !== '') {
        const q = adminSearchTerm.toLowerCase().trim();
        return (
          app.name?.toLowerCase().includes(q) ||
          app.email?.toLowerCase().includes(q) ||
          app.department?.toLowerCase().includes(q) ||
          app.staffId?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [adminRegistrations, adminSearchTerm]);

  // Filtered Active Admins
  const filteredActiveAdmins = useMemo(() => {
    return activeAdmins.filter(adm => {
      if (adminSearchTerm.trim() !== '') {
        const q = adminSearchTerm.toLowerCase().trim();
        return (
          adm.name?.toLowerCase().includes(q) ||
          adm.email?.toLowerCase().includes(q) ||
          adm.username?.toLowerCase().includes(q) ||
          adm.department?.toLowerCase().includes(q) ||
          adm.staffId?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [activeAdmins, adminSearchTerm]);

  // ==========================================
  // PATIENT ACTIONS
  // ==========================================
  const handleConfirmApprovePatient = async () => {
    if (!approveConfirmTarget) return;
    setActionLoading(true);
    setError('');

    try {
      const result = await approveRegistration(approveConfirmTarget.id, approveConfirmTarget);
      const targetName = approveConfirmTarget.name;
      setApproveConfirmTarget(null);
      await fetchRegistrations();

      setCredentialModalData({
        username: result.username,
        temporaryPassword: result.temporaryPassword,
        applicantName: targetName,
        role: 'user'
      });
    } catch (err) {
      setError(err.message || 'Failed to approve patient registration.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmRejectPatient = async () => {
    if (!rejectConfirmTarget) return;
    setActionLoading(true);
    setError('');

    try {
      await rejectRegistration(rejectConfirmTarget.id);
      setRejectConfirmTarget(null);
      await fetchRegistrations();
    } catch (err) {
      setError(err.message || 'Failed to reject registration.');
    } finally {
      setActionLoading(false);
    }
  };

  // ==========================================
  // SUPER ADMIN ACTIONS: ADMIN APPROVAL & REMOVAL
  // ==========================================
  const handleConfirmApproveAdmin = async () => {
    if (!approveAdminConfirmTarget) return;
    setActionLoading(true);
    setError('');

    try {
      const result = await approveAdminRegistration(approveAdminConfirmTarget.id, approveAdminConfirmTarget);
      setApproveAdminConfirmTarget(null);
      await fetchAdminData();

      setSuccessMsg(`Administrator ${result.applicantName} approved successfully!`);
      setTimeout(() => setSuccessMsg(''), 5000);

      // Display newly generated admin credentials
      setCredentialModalData({
        username: result.username,
        temporaryPassword: result.temporaryPassword,
        applicantName: result.applicantName,
        role: 'admin'
      });
    } catch (err) {
      setError(err.message || 'Failed to approve administrator.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmRejectAdmin = async () => {
    if (!rejectAdminConfirmTarget) return;
    setActionLoading(true);
    setError('');

    try {
      await rejectAdminRegistration(rejectAdminConfirmTarget.id);
      const name = rejectAdminConfirmTarget.name;
      setRejectAdminConfirmTarget(null);
      await fetchAdminData();
      setSuccessMsg(`Application for ${name} rejected.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to reject administrator application.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmRemoveAdmin = async () => {
    if (!removeAdminConfirmTarget) return;
    setActionLoading(true);
    setError('');

    try {
      await removeAdmin({
        adminRegId: removeAdminConfirmTarget.adminRegistrationId || removeAdminConfirmTarget.id,
        uid: removeAdminConfirmTarget.uid || removeAdminConfirmTarget.id,
        username: removeAdminConfirmTarget.username
      });
      const name = removeAdminConfirmTarget.name;
      setRemoveAdminConfirmTarget(null);
      await fetchAdminData();
      setSuccessMsg(`Administrator ${name} has been removed and deactivated from system.`);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setError(err.message || 'Failed to remove administrator.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="container page-wrapper">
      {/* Header Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: '1.85rem', margin: 0 }}>
              {isSuperAdmin ? 'Admin Portal' : 'Ophthalmologist Dashboard'}
            </h1>
            <span
              className="badge"
              style={{
                background: isSuperAdmin ? 'var(--secondary)' : 'var(--primary-light)',
                color: isSuperAdmin ? '#FAF8F4' : 'var(--primary)',
                padding: '4px 10px',
                fontSize: '0.8rem',
                fontWeight: 700
              }}
            >
              {isSuperAdmin ? '⚡ Admin Authority' : '🩺 Ophthalmologist'}
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: 4 }}>
            {isSuperAdmin
              ? 'Complete system control: Manage Ophthalmologist approvals & removals, User Accounts, and Vision Therapy Tests.'
              : 'Review patient applications, allocate vision therapy tests, and inspect ocular telemetry logs.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setProfileModalTab('profile');
              setIsProfileModalOpen(true);
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            title="View and edit your profile, username, and password"
          >
            <User size={16} />
            <span>{isSuperAdmin ? 'My Admin Profile' : 'My Ophthalmologist Profile'}</span>
          </button>

          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              fetchRegistrations();
              if (isSuperAdmin) fetchAdminData();
            }}
            disabled={loading || loadingAdmins}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <RotateCw size={16} className={(loading || loadingAdmins) ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 18 }}>
          <AlertCircle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>{error}</div>
        </div>
      )}

      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: 18 }}>
          <CheckCircle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>{successMsg}</div>
        </div>
      )}

      {/* SUPER ADMIN TOP LEVEL NAVIGATION TABS */}
      {isSuperAdmin && (
        <div style={{
          display: 'flex',
          gap: 12,
          borderBottom: '2px solid #e2e8f0',
          marginBottom: 24,
          paddingBottom: 2,
          flexWrap: 'wrap'
        }}>
          <button
            type="button"
            className={`btn ${activeTab === 'patients' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('patients')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <Users size={16} />
            <span>Patients & Vision Therapy ({registrations.length})</span>
          </button>

          <button
            type="button"
            className={`btn ${activeTab === 'admins' ? 'btn-secondary' : 'btn-outline'}`}
            onClick={() => setActiveTab('admins')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              position: 'relative',
              borderColor: activeTab === 'admins' ? 'transparent' : 'var(--primary)',
              color: activeTab === 'admins' ? '#ffffff' : 'var(--primary)'
            }}
          >
            <Shield size={16} />
            <span>Ophthalmologist Staff Management</span>
            {adminStats.pending > 0 && (
              <span style={{
                background: '#ef4444',
                color: '#ffffff',
                fontSize: '0.72rem',
                padding: '2px 7px',
                borderRadius: '10px',
                fontWeight: 700
              }}>
                {adminStats.pending} New
              </span>
            )}
          </button>

          <button
            type="button"
            className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('overview')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <Activity size={16} />
            <span>Platform Overview</span>
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 1: PATIENTS & VISION THERAPY TESTS (ADMIN & SUPER)   */}
      {/* ======================================================== */}
      {activeTab === 'patients' && (
        <div>
          {/* Metric Cards */}
          <div className="stats-grid">
            <div className="stat-card" onClick={() => setStatusFilter('all')} style={{ cursor: 'pointer' }}>
              <div className="stat-icon stat-icon-all">
                <Users size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-value">{patientStats.total}</span>
                <span className="stat-label">Total Patients</span>
              </div>
            </div>

            <div className="stat-card" onClick={() => setStatusFilter('pending')} style={{ cursor: 'pointer' }}>
              <div className="stat-icon stat-icon-pending">
                <Clock size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-value">{patientStats.pending}</span>
                <span className="stat-label">Pending Approval</span>
              </div>
            </div>

            <div className="stat-card" onClick={() => setStatusFilter('approved')} style={{ cursor: 'pointer' }}>
              <div className="stat-icon stat-icon-approved">
                <CheckCircle size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-value">{patientStats.approved}</span>
                <span className="stat-label">Approved Accounts</span>
              </div>
            </div>

            <div className="stat-card" onClick={() => setStatusFilter('rejected')} style={{ cursor: 'pointer' }}>
              <div className="stat-icon stat-icon-rejected">
                <XCircle size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-value">{patientStats.rejected}</span>
                <span className="stat-label">Rejected Applications</span>
              </div>
            </div>
          </div>

          {/* Filter and Search Bar */}
          <div className="filter-bar">
            <div className="search-input-wrapper">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="Search patient name, Gmail, phone, or username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="filter-group">
              <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Status:
              </span>
              <button
                type="button"
                className={`btn btn-sm ${statusFilter === 'all' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setStatusFilter('all')}
              >
                All ({patientStats.total})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${statusFilter === 'pending' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setStatusFilter('pending')}
              >
                Pending ({patientStats.pending})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${statusFilter === 'approved' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setStatusFilter('approved')}
              >
                Approved ({patientStats.approved})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${statusFilter === 'rejected' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setStatusFilter('rejected')}
              >
                Rejected ({patientStats.rejected})
              </button>
            </div>
          </div>

          {/* Registrations Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Patient Name</th>
                    <th>Email Address</th>
                    <th>Phone</th>
                    <th>Age</th>
                    <th>Gender</th>
                    <th>Status</th>
                    <th>Vision Therapy Tests</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                        Loading registrations...
                      </td>
                    </tr>
                  ) : filteredRegistrations.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                        No registrations match the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredRegistrations.map((reg) => (
                      <tr key={reg.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{reg.name}</div>
                          {reg.username && (
                            <span style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600, fontFamily: 'monospace' }}>
                              {reg.username}
                            </span>
                          )}
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>{reg.email}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>+91 {reg.phone}</td>
                        <td>{reg.age}</td>
                        <td>{reg.gender}</td>
                        <td>
                          <StatusBadge status={reg.status} />
                        </td>
                        <td>
                          {reg.therapyTests && reg.therapyTests.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              <span className="badge badge-admin">
                                {reg.therapyTests.length} {reg.therapyTests.length === 1 ? 'Test' : 'Tests'} Allotted
                              </span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {reg.therapyTests.filter(t => t.status === 'completed').length} / {reg.therapyTests.length} Completed
                              </span>
                            </div>
                          ) : reg.therapyTest ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              <span className={`badge ${reg.therapyTest.status === 'completed' ? 'badge-approved' : 'badge-admin'}`}>
                                {reg.therapyTest.status === 'completed' ? '1 Test Done' : '1 Test Allotted'}
                              </span>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-light)', fontSize: '0.82rem', fontStyle: 'italic' }}>
                              Not Allotted
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="table-actions" style={{ justifyContent: 'flex-end' }}>
                            {reg.status === 'pending' && (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-success"
                                  onClick={() => setApproveConfirmTarget(reg)}
                                  title="Approve registration"
                                >
                                  <Check size={14} />
                                  <span>Approve</span>
                                </button>

                                <button
                                  type="button"
                                  className="btn btn-sm btn-danger-outline"
                                  onClick={() => setRejectConfirmTarget(reg)}
                                  title="Reject registration"
                                >
                                  <X size={14} />
                                  <span>Reject</span>
                                </button>
                              </>
                            )}

                            {/* Allot / Manage Therapy Tests button */}
                            <button
                              type="button"
                              className={`btn btn-sm ${(reg.therapyTests?.length > 0 || reg.therapyTest) ? 'btn-outline' : 'btn-primary'}`}
                              onClick={() => setAllotTestTarget(reg)}
                              title="Manage Vision Therapy Tests"
                            >
                              <Sliders size={14} />
                              <span>{(reg.therapyTests?.length > 0 || reg.therapyTest) ? 'Manage Tests' : 'Allot Test'}</span>
                            </button>

                            <button
                              type="button"
                              className="btn btn-sm btn-outline"
                              onClick={() => setViewDetailsTarget(reg)}
                              title="View Details"
                            >
                              <Eye size={14} />
                              <span>Details</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: ADMINISTRATOR STAFF MANAGEMENT (SUPER ADMIN ONLY) */}
      {/* ======================================================== */}
      {isSuperAdmin && activeTab === 'admins' && (
        <div>
          {/* Admin Stats Row */}
          <div className="stats-grid" style={{ marginBottom: 20 }}>
            <div className="stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
              <div className="stat-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                <Clock size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-value">{adminStats.pending}</span>
                <span className="stat-label">Pending Ophthalmologist Approvals</span>
              </div>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid var(--success)' }}>
              <div className="stat-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
                <UserCheck size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-value">{adminStats.active}</span>
                <span className="stat-label">Active Approved Ophthalmologists</span>
              </div>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid var(--secondary)' }}>
              <div className="stat-icon" style={{ background: 'var(--card-bg-alt)', color: 'var(--secondary)' }}>
                <Building size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-value">{adminStats.totalApplications}</span>
                <span className="stat-label">Total Applications</span>
              </div>
            </div>
          </div>

          {/* Sub-navigation buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className={`btn btn-sm ${adminSection === 'pending' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setAdminSection('pending')}
              >
                <span>Pending Approvals ({adminStats.pending})</span>
              </button>

              <button
                type="button"
                className={`btn btn-sm ${adminSection === 'active' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setAdminSection('active')}
              >
                <span>Active Ophthalmologists ({adminStats.active})</span>
              </button>
            </div>

            <div style={{ position: 'relative', width: 280, maxWidth: '100%' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                className="form-control"
                placeholder="Search staff, email, dept..."
                value={adminSearchTerm}
                onChange={(e) => setAdminSearchTerm(e.target.value)}
                style={{ paddingLeft: 36, fontSize: '0.88rem' }}
              />
            </div>
          </div>

          {/* VIEW A: PENDING ADMINISTRATOR APPLICATIONS */}
          {adminSection === 'pending' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', background: '#faf5ff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Shield size={18} color="#7c3aed" />
                  <strong style={{ color: '#581c87', fontSize: '0.95rem' }}>Pending Administrator Registration Queue</strong>
                </div>
                <span style={{ fontSize: '0.82rem', color: '#6d28d9' }}>
                  Requires Super Admin Approval to generate credentials
                </span>
              </div>

              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Applicant Name</th>
                      <th>Email & Phone</th>
                      <th>Department & Staff ID</th>
                      <th>Specialization / Role</th>
                      <th>Submitted Date</th>
                      <th style={{ textAlign: 'right' }}>Super Admin Decision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingAdmins ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
                          Loading pending ophthalmologist requests...
                        </td>
                      </tr>
                    ) : pendingAdminApplications.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                          <CheckCircle2 size={32} color="#16a34a" style={{ margin: '0 auto 8px', display: 'block' }} />
                          All ophthalmologist requests have been reviewed! No pending applications in queue.
                        </td>
                      </tr>
                    ) : (
                      pendingAdminApplications.map((app) => (
                        <tr key={app.id}>
                          <td>
                            <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{app.name || 'Staff Member'}</strong>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>ID: {app.id ? String(app.id).substring(0, 8) : '—'}...</div>
                          </td>
                          <td>
                            <div>{app.email || '—'}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{app.phone ? `+91 ${app.phone}` : '—'}</div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: '#334155' }}>{app.department || 'Ophthalmology'}</div>
                            <span className="badge" style={{ background: '#f1f5f9', color: '#475569', fontSize: '0.75rem' }}>
                              {app.staffId || 'Staff Member'}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontSize: '0.85rem' }}>{app.specialization || 'Ophthalmologist'}</div>
                            {app.note && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', maxWidth: 220 }}>
                                "{app.note}"
                              </div>
                            )}
                          </td>
                          <td style={{ fontSize: '0.84rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {formatDateSafe(app.createdAt)}
                          </td>
                          <td>
                            <div className="table-actions" style={{ justifyContent: 'flex-end', gap: 6 }}>
                              <button
                                type="button"
                                className="btn btn-sm btn-success"
                                onClick={() => setApproveAdminConfirmTarget(app)}
                                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                                title="Approve Ophthalmologist and generate credentials"
                              >
                                <Check size={14} />
                                <span>Approve Ophthalmologist</span>
                              </button>

                              <button
                                type="button"
                                className="btn btn-sm btn-danger-outline"
                                onClick={() => setRejectAdminConfirmTarget(app)}
                                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                                title="Reject Ophthalmologist application"
                              >
                                <X size={14} />
                                <span>Reject</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW B: ACTIVE & ENROLLED OPHTHALMOLOGISTS */}
          {adminSection === 'active' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <UserCheck size={18} color="var(--success)" />
                  <strong style={{ color: 'var(--success)', fontSize: '0.95rem' }}>Enrolled Ophthalmologists</strong>
                </div>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Admin can manage and revoke ophthalmologist access
                </span>
              </div>

              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Ophthalmologist Name</th>
                      <th>Username</th>
                      <th>Official Email</th>
                      <th>Department & Staff ID</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Admin Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingAdmins ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
                          Loading active ophthalmologists...
                        </td>
                      </tr>
                    ) : filteredActiveAdmins.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                          No active ophthalmologists found matching your search.
                        </td>
                      </tr>
                    ) : (
                      filteredActiveAdmins.map((adm) => (
                        <tr key={adm.id}>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{adm.name}</div>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{adm.specialization || 'Ophthalmologist'}</span>
                          </td>
                          <td>
                            <span style={{
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              color: 'var(--primary)',
                              background: 'var(--primary-light)',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '0.85rem'
                            }}>
                              {adm.username || 'OPHTH'}
                            </span>
                          </td>
                          <td style={{ color: 'var(--text-muted)' }}>{adm.email}</td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{adm.department || 'Ophthalmology'}</div>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{adm.staffId || 'Verified Staff'}</span>
                          </td>
                          <td>
                            <span className="badge badge-approved" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <CheckCircle2 size={12} />
                              <span>Active Ophthalmologist</span>
                            </span>
                          </td>
                          <td>
                            <div className="table-actions" style={{ justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                className="btn btn-sm btn-danger-outline"
                                onClick={() => setRemoveAdminConfirmTarget(adm)}
                                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                                title="Remove and revoke ophthalmologist access"
                              >
                                <Trash2 size={14} />
                                <span>Revoke Access</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: PLATFORM OVERVIEW (SUPER ADMIN ONLY)              */}
      {/* ======================================================== */}
      {isSuperAdmin && activeTab === 'overview' && (
        <div>
          <div style={{
            background: 'var(--card-bg-alt)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: 24,
            marginBottom: 24
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <Sparkles size={24} color="var(--primary)" />
              <h2 style={{ fontSize: '1.35rem', margin: 0, fontWeight: 700, color: 'var(--secondary)' }}>
                Vision Therapy System Architecture Overview
              </h2>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', maxWidth: 750, margin: 0, lineHeight: 1.5 }}>
              Hierarchical 3-tier Role-Based Access Control (RBAC):
              Admin manages system operations, reviews and manages ophthalmologist staff.
              Ophthalmologists allocate and monitor Vision Therapy stimulus tests for patients.
              Patients take prescribed ocular tests and review recorded eye tracking telemetry.
            </p>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ background: 'var(--card-bg-alt)', color: 'var(--secondary)' }}>
                <Shield size={24} />
              </div>
              <h3 className="feature-title">Admin Authority</h3>
              <p className="feature-text">
                Full privileges: approves staff applications, generates and revokes ophthalmologist credentials, monitors clinical therapy, and manages the entire system.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                <Sliders size={24} />
              </div>
              <h3 className="feature-title">Ophthalmologist Role</h3>
              <p className="feature-text">
                Ophthalmologists and clinical optometrists who register and are verified by the Admin. They configure visual stimulus trajectories, velocity ramps, and review pupil metrics.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                <FileSpreadsheet size={24} />
              </div>
              <h3 className="feature-title">Patient Vision Therapy</h3>
              <p className="feature-text">
                Patients authenticate using their email credentials, perform visual stimulus training with live 20Hz WebCam gaze tracking, and inspect tabular telemetry logs.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODALS                                                   */}
      {/* ======================================================== */}

      {/* 1. Confirmation Modal for Patient Approval */}
      <ConfirmModal
        isOpen={Boolean(approveConfirmTarget)}
        title="Approve Patient Registration"
        message={`Are you sure you want to approve patient "${approveConfirmTarget?.name}" (${approveConfirmTarget?.email})? This will generate their official username and temporary password.`}
        confirmText="Yes, Approve Patient"
        confirmVariant="success"
        isLoading={actionLoading}
        onConfirm={handleConfirmApprovePatient}
        onClose={() => setApproveConfirmTarget(null)}
      />

      {/* 2. Confirmation Modal for Patient Rejection */}
      <ConfirmModal
        isOpen={Boolean(rejectConfirmTarget)}
        title="Reject Patient Registration"
        message={`Are you sure you want to reject this registration for "${rejectConfirmTarget?.name}" (${rejectConfirmTarget?.email})?`}
        confirmText="Yes, Reject Application"
        confirmVariant="danger"
        isLoading={actionLoading}
        onConfirm={handleConfirmRejectPatient}
        onClose={() => setRejectConfirmTarget(null)}
      />

      {/* 3. Confirmation Modal for Ophthalmologist Approval (Admin) */}
      <ConfirmModal
        isOpen={Boolean(approveAdminConfirmTarget)}
        title="Approve Ophthalmologist Application"
        message={`Are you sure you want to approve "${approveAdminConfirmTarget?.name}" (${approveAdminConfirmTarget?.email}, ${approveAdminConfirmTarget?.department}) as an Ophthalmologist? An official Ophthalmologist Username and secure password will be generated immediately.`}
        confirmText="Approve & Generate Ophthalmologist Credentials"
        confirmVariant="secondary"
        isLoading={actionLoading}
        onConfirm={handleConfirmApproveAdmin}
        onClose={() => setApproveAdminConfirmTarget(null)}
      />

      {/* 4. Confirmation Modal for Ophthalmologist Rejection (Admin) */}
      <ConfirmModal
        isOpen={Boolean(rejectAdminConfirmTarget)}
        title="Reject Ophthalmologist Application"
        message={`Are you sure you want to reject the ophthalmologist registration for "${rejectAdminConfirmTarget?.name}"?`}
        confirmText="Yes, Reject Request"
        confirmVariant="danger"
        isLoading={actionLoading}
        onConfirm={handleConfirmRejectAdmin}
        onClose={() => setRejectAdminConfirmTarget(null)}
      />

      {/* 5. Confirmation Modal for Ophthalmologist Removal / Revocation (Admin) */}
      <ConfirmModal
        isOpen={Boolean(removeAdminConfirmTarget)}
        title="Revoke Ophthalmologist Access"
        message={`Are you sure you want to REMOVE and REVOKE ophthalmologist privileges for "${removeAdminConfirmTarget?.name}" (${removeAdminConfirmTarget?.username || removeAdminConfirmTarget?.email})? They will immediately lose access and will not be able to log in.`}
        confirmText="Yes, Remove Ophthalmologist"
        confirmVariant="danger"
        isLoading={actionLoading}
        onConfirm={handleConfirmRemoveAdmin}
        onClose={() => setRemoveAdminConfirmTarget(null)}
      />

      {/* 6. Credential Modal (Shown once after approval) */}
      <CredentialModal
        isOpen={Boolean(credentialModalData)}
        data={credentialModalData}
        onClose={() => setCredentialModalData(null)}
      />

      {/* 7. View Details Modal */}
      <ViewDetailsModal
        isOpen={Boolean(viewDetailsTarget)}
        registration={viewDetailsTarget}
        onClose={() => setViewDetailsTarget(null)}
      />

      {/* 8. Allot Vision Therapy Test Modal */}
      <AllotTestModal
        isOpen={Boolean(allotTestTarget)}
        registration={allotTestTarget}
        onClose={() => setAllotTestTarget(null)}
        onSaveSuccess={(config) => {
          setSuccessMsg(`Vision Therapy test successfully allotted to ${allotTestTarget?.name}!`);
          setTimeout(() => setSuccessMsg(''), 4500);
          fetchRegistrations();
        }}
        onPreview={(config) => {
          setPreviewConfig(config);
        }}
      />

      {/* 9. Fullscreen Stimulus Preview Canvas */}
      {previewConfig && (
        <VisionTherapyCanvas
          config={previewConfig}
          onClose={() => setPreviewConfig(null)}
        />
      )}

      {/* 10. Administrator Profile & Security Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        initialTab={profileModalTab}
        onProfileUpdated={(_updated) => {
          setSuccessMsg('Your administrator profile was updated successfully.');
          setTimeout(() => setSuccessMsg(''), 4000);
        }}
      />
    </div>
  );
}
