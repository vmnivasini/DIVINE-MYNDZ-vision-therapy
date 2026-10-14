import React, { useState } from 'react';
import { Stethoscope, Mail, Phone, User, CheckCircle2, AlertCircle, ArrowLeft, Hospital, Briefcase, FileBadge } from 'lucide-react';
import { submitAdminRegistration } from '../services/adminRegistrationService';

const DEPARTMENTS = [
  'Vision Therapy & Rehabilitation',
  'Pediatric Ophthalmology',
  'Clinical Optometry',
  'Strabismus & Binocular Vision',
  'General Ophthalmology & Refraction',
  'Clinical Operations & Vision Science'
];

export default function AdminRegister({ navigate }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    department: DEPARTMENTS[0],
    staffId: '',
    specialization: '',
    note: ''
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: '' }));
    }
    if (generalError) setGeneralError('');
  };

  const validate = () => {
    const errors = {};
    if (!formData.name.trim() || formData.name.trim().length < 3) {
      errors.name = 'Full name is required (minimum 3 characters).';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim() || !emailRegex.test(formData.email.trim())) {
      errors.email = 'A valid staff or medical email address is required.';
    }

    const phoneClean = formData.phone.replace(/[\s-]/g, '');
    if (!phoneClean || !/^[6-9]\d{9}$/.test(phoneClean)) {
      errors.phone = 'Valid 10-digit Indian mobile number is required (starts with 6-9).';
    }

    if (!formData.staffId.trim()) {
      errors.staffId = 'Staff / Employee ID or Medical Registration number is required.';
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitAdminRegistration(formData);
      setSubmittedData({ ...formData, id: res.id });
      setIsSuccess(true);
    } catch (err) {
      setGeneralError(err.message || 'Failed to submit ophthalmologist application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isSuccess && submittedData) {
    return (
      <div className="container page-wrapper">
        <div className="card" style={{ maxWidth: 560, margin: '20px auto', textAlign: 'center', padding: '36px 32px', backgroundColor: '#FFFFFF' }}>
          <div style={{
            display: 'inline-flex',
            padding: 18,
            borderRadius: '50%',
            background: 'var(--primary-light)',
            color: 'var(--primary)',
            marginBottom: 20,
            boxShadow: '0 4px 14px rgba(73, 107, 93, 0.2)'
          }}>
            <Stethoscope size={44} />
          </div>

          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--secondary)', marginBottom: 12 }}>
            Ophthalmologist Application Submitted
          </h2>

          <div className="alert alert-success" style={{ textAlign: 'left', margin: '20px 0' }}>
            <CheckCircle2 size={20} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>Admin Queue:</strong> Your registration request for <strong>{submittedData.name}</strong> has been logged and is pending Admin approval.
            </div>
          </div>

          <div style={{
            background: 'var(--card-bg-alt)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: 16,
            textAlign: 'left',
            fontSize: '0.88rem',
            marginBottom: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}>
            <div><span style={{ color: 'var(--text-muted)' }}>Registered Email:</span> <strong>{submittedData.email}</strong></div>
            <div><span style={{ color: 'var(--text-muted)' }}>Department:</span> <strong>{submittedData.department}</strong></div>
            <div><span style={{ color: 'var(--text-muted)' }}>Staff / License ID:</span> <strong>{submittedData.staffId}</strong></div>
            <div><span style={{ color: 'var(--text-muted)' }}>Approval Status:</span> <span className="badge badge-admin">Pending Admin Review</span></div>
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: 28 }}>
            Once the <strong>Admin</strong> approves your registration, your unique <strong>Ophthalmologist Username</strong> and secure temporary password will be generated for system access.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => navigate('/')}
            >
              Back to Home
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate('/admin-login')}
            >
              Go to Ophthalmologist Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container page-wrapper">
      <div className="card" style={{ maxWidth: 640, margin: '20px auto', backgroundColor: '#FFFFFF' }}>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: '12px',
              background: 'var(--primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)'
            }}>
              <Stethoscope size={24} />
            </div>
            <div>
              <h2 className="card-title" style={{ margin: 0 }}>Ophthalmologist Registration</h2>
              <span style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600 }}>Staff & Doctor Portal Verification</span>
            </div>
          </div>

          <p className="card-subtitle">
            Register as an Ophthalmologist, Clinical Optometrist, or Vision Therapist. All applications require Admin approval before login credentials are created.
          </p>
        </div>

        {generalError && (
          <div className="alert alert-error">
            <AlertCircle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>{generalError}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate autoComplete="off">
          {/* Full Name */}
          <div className="form-group">
            <label className="form-label" htmlFor="admin-name">
              Full Name (with Title) <span className="required">*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="admin-name"
                name="name"
                type="text"
                className={`form-control ${fieldErrors.name ? 'is-invalid' : ''}`}
                placeholder="e.g. Dr. Rajesh Kumar, MS"
                value={formData.name}
                onChange={handleChange}
                disabled={submitting}
                autoComplete="off"
                autoFocus
              />
            </div>
            {fieldErrors.name && <p className="form-error">{fieldErrors.name}</p>}
          </div>

          {/* Email & Phone */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="admin-reg-email">
                Hospital / Official Email <span className="required">*</span>
              </label>
              <input
                id="admin-reg-email"
                name="email"
                type="email"
                className={`form-control ${fieldErrors.email ? 'is-invalid' : ''}`}
                placeholder="doctor@clinic.com"
                value={formData.email}
                onChange={handleChange}
                disabled={submitting}
                autoComplete="off"
              />
              {fieldErrors.email && <p className="form-error">{fieldErrors.email}</p>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="admin-reg-phone">
                Mobile Number <span className="required">*</span>
              </label>
              <input
                id="admin-reg-phone"
                name="phone"
                type="tel"
                maxLength={10}
                className={`form-control ${fieldErrors.phone ? 'is-invalid' : ''}`}
                placeholder="9876543210"
                value={formData.phone}
                onChange={handleChange}
                disabled={submitting}
                autoComplete="off"
              />
              {fieldErrors.phone && <p className="form-error">{fieldErrors.phone}</p>}
            </div>
          </div>

          {/* Department & Staff ID */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="admin-dept">
                Department / Specialization <span className="required">*</span>
              </label>
              <select
                id="admin-dept"
                name="department"
                className="form-control"
                value={formData.department}
                onChange={handleChange}
                disabled={submitting}
              >
                {DEPARTMENTS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="admin-staff-id">
                Staff ID / Medical License <span className="required">*</span>
              </label>
              <input
                id="admin-staff-id"
                name="staffId"
                type="text"
                className={`form-control ${fieldErrors.staffId ? 'is-invalid' : ''}`}
                placeholder="e.g. MED-5920 or EMP-1049"
                value={formData.staffId}
                onChange={handleChange}
                disabled={submitting}
                autoComplete="off"
              />
              {fieldErrors.staffId && <p className="form-error">{fieldErrors.staffId}</p>}
            </div>
          </div>

          {/* Specialization Details */}
          <div className="form-group">
            <label className="form-label" htmlFor="admin-spec">
              Designation / Professional Title (Optional)
            </label>
            <input
              id="admin-spec"
              name="specialization"
              type="text"
              className="form-control"
              placeholder="e.g. Senior Pediatric Ophthalmologist & Squint Specialist"
              value={formData.specialization}
              onChange={handleChange}
              disabled={submitting}
              autoComplete="off"
            />
          </div>

          {/* Clinical Justification / Notes */}
          <div className="form-group">
            <label className="form-label" htmlFor="admin-note">
              Clinical Access Justification (Optional)
            </label>
            <textarea
              id="admin-note"
              name="note"
              className="form-control"
              rows={2}
              placeholder="Brief note for the Admin regarding your clinic role and patients..."
              value={formData.note}
              onChange={handleChange}
              disabled={submitting}
            />
          </div>

          <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              type="submit"
              className="btn btn-primary btn-block btn-lg"
              disabled={submitting}
            >
              <Stethoscope size={18} />
              <span>{submitting ? 'Submitting Application...' : 'Submit Ophthalmologist Application'}</span>
            </button>

            <div style={{ textAlign: 'center', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              Already registered as an Ophthalmologist?{' '}
              <a
                href="#/admin-login"
                onClick={(e) => { e.preventDefault(); navigate('/admin-login'); }}
                style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}
              >
                Log In Here
              </a>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
