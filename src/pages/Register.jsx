import React, { useState } from 'react';
import { User, Mail, Phone, Calendar, CheckCircle2, AlertCircle, ArrowLeft, Send } from 'lucide-react';
import { validateRegistrationForm, GENDER_OPTIONS, validateName, validateAge, validateGender, validatePhone, validateGmail } from '../utils/validation';
import { submitRegistration } from '../services/registrationService';

export default function Register({ navigate }) {
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: 'Male',
    phone: '',
    email: ''
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear specific field error as user types
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: '' }));
    }
    if (generalError) setGeneralError('');
  };

  const handleBlur = (field) => {
    let result = { isValid: true };
    if (field === 'name') result = validateName(formData.name);
    else if (field === 'age') result = validateAge(formData.age);
    else if (field === 'gender') result = validateGender(formData.gender);
    else if (field === 'phone') result = validatePhone(formData.phone);
    else if (field === 'email') result = validateGmail(formData.email);

    if (!result.isValid) {
      setFieldErrors(prev => ({ ...prev, [field]: result.error }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');

    // Comprehensive validation
    const validation = validateRegistrationForm(formData);
    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      return;
    }

    setSubmitting(true);
    try {
      await submitRegistration(validation.sanitized);
      setRegisteredEmail(validation.sanitized.email);
      setIsSuccess(true);
    } catch (err) {
      setGeneralError(err.message || 'Something went wrong while submitting your registration. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="container page-wrapper">
        <div className="card" style={{ maxWidth: 560, margin: '20px auto', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', padding: 16, borderRadius: '50%', background: 'var(--success-bg)', marginBottom: 20 }}>
            <CheckCircle2 size={48} color="#16a34a" />
          </div>

          <h2 style={{ fontSize: '1.6rem', marginBottom: 12 }}>Registration Submitted</h2>

          <div className="alert alert-success" style={{ textAlign: 'left', margin: '20px 0' }}>
            <CheckCircle2 size={20} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>Confirmation:</strong> Registration submitted successfully. Your application is waiting for ophthalmologist approval.
            </div>
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: 28 }}>
            We have recorded your application for <strong>{registeredEmail}</strong>. An ophthalmologist will review your clinical details.
            Once approved, you will receive your unique system username and temporary credentials to log into the portal.
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
              onClick={() => {
                setFormData({
                  name: '',
                  age: '',
                  gender: 'Male',
                  phone: '',
                  email: ''
                });
                setIsSuccess(false);
              }}
            >
              Register Another Person
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container page-wrapper">
      <div className="card" style={{ maxWidth: 580, margin: '0 auto' }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => navigate('/')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
            >
              <ArrowLeft size={18} />
              <span style={{ fontSize: '0.85rem', marginLeft: 4 }}>Back</span>
            </button>
          </div>
          <h2 className="card-title">Patient & Visitor Registration</h2>
          <p className="card-subtitle">
            Please enter your accurate details below. Your submission will be routed to the administration for verification.
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
            <label className="form-label" htmlFor="reg-name">
              Full Name <span className="required">*</span>
            </label>
            <input
              id="reg-name"
              type="text"
              name="name"
              className={`form-control ${fieldErrors.name ? 'error' : ''}`}
              placeholder="e.g. Ramesh Kumar"
              value={formData.name}
              onChange={handleChange}
              onBlur={() => handleBlur('name')}
              disabled={submitting}
              autoComplete="off"
            />
            {fieldErrors.name && (
              <div className="form-error">
                <AlertCircle size={14} />
                <span>{fieldErrors.name}</span>
              </div>
            )}
          </div>

          {/* Age & Gender in 2 columns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Age */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-age">
                Age <span className="required">*</span>
              </label>
              <input
                id="reg-age"
                type="number"
                name="age"
                min="1"
                max="120"
                className={`form-control ${fieldErrors.age ? 'error' : ''}`}
                placeholder="e.g. 35"
                value={formData.age}
                onChange={handleChange}
                onBlur={() => handleBlur('age')}
                disabled={submitting}
                autoComplete="off"
              />
              {fieldErrors.age && (
                <div className="form-error">
                  <AlertCircle size={14} />
                  <span>{fieldErrors.age}</span>
                </div>
              )}
            </div>

            {/* Gender */}
            <div className="form-group">
              <label className="form-label" htmlFor="reg-gender">
                Gender <span className="required">*</span>
              </label>
              <select
                id="reg-gender"
                name="gender"
                className={`form-select ${fieldErrors.gender ? 'error' : ''}`}
                value={formData.gender}
                onChange={handleChange}
                onBlur={() => handleBlur('gender')}
                disabled={submitting}
              >
                {GENDER_OPTIONS.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              {fieldErrors.gender && (
                <div className="form-error">
                  <AlertCircle size={14} />
                  <span>{fieldErrors.gender}</span>
                </div>
              )}
            </div>
          </div>

          {/* Phone Number */}
          <div className="form-group">
            <label className="form-label" htmlFor="reg-phone">
              Phone Number (India) <span className="required">*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="reg-phone"
                type="tel"
                name="phone"
                className={`form-control ${fieldErrors.phone ? 'error' : ''}`}
                placeholder="10-digit mobile number (e.g. 9876543210)"
                value={formData.phone}
                onChange={handleChange}
                onBlur={() => handleBlur('phone')}
                disabled={submitting}
                maxLength={13}
                autoComplete="off"
              />
            </div>
            {fieldErrors.phone ? (
              <div className="form-error">
                <AlertCircle size={14} />
                <span>{fieldErrors.phone}</span>
              </div>
            ) : (
              <p className="form-hint">Accepts standard 10-digit Indian mobile numbers starting with 6, 7, 8, or 9.</p>
            )}
          </div>

          {/* Gmail Address */}
          <div className="form-group">
            <label className="form-label" htmlFor="reg-email">
              Gmail Address <span className="required">*</span>
            </label>
            <input
              id="reg-email"
              type="email"
              name="email"
              className={`form-control ${fieldErrors.email ? 'error' : ''}`}
              placeholder="username@gmail.com"
              value={formData.email}
              onChange={handleChange}
              onBlur={() => handleBlur('email')}
              disabled={submitting}
              autoComplete="off"
            />
            {fieldErrors.email ? (
              <div className="form-error">
                <AlertCircle size={14} />
                <span>{fieldErrors.email}</span>
              </div>
            ) : (
              <p className="form-hint">Must strictly end with <strong>@gmail.com</strong>. Other providers will be rejected.</p>
            )}
          </div>

          {/* Submit Button */}
          <div style={{ marginTop: 28 }}>
            <button
              type="submit"
              className="btn btn-primary btn-block btn-lg"
              disabled={submitting}
            >
              <Send size={18} />
              <span>{submitting ? 'Submitting Registration...' : 'Submit Registration'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
