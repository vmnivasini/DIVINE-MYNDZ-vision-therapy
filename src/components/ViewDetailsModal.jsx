import React from 'react';
import { X, User, Mail, Phone, Calendar, ShieldCheck, Hash } from 'lucide-react';
import StatusBadge from './StatusBadge';

export default function ViewDetailsModal({ isOpen, onClose, registration }) {
  if (!isOpen || !registration) return null;

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    try {
      return new Date(dateString).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Registration Details</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h4 style={{ fontSize: '1.25rem', marginBottom: 4 }}>{registration.name}</h4>
              <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>ID: {registration.id}</span>
            </div>
            <StatusBadge status={registration.status} />
          </div>

          <div className="profile-grid" style={{ marginTop: 0 }}>
            <div className="profile-field">
              <div className="profile-field-label">Gmail Address</div>
              <div className="profile-field-value" style={{ wordBreak: 'break-all', fontSize: '0.95rem' }}>
                {registration.email}
              </div>
            </div>

            <div className="profile-field">
              <div className="profile-field-label">Phone Number</div>
              <div className="profile-field-value" style={{ fontSize: '0.95rem' }}>
                +91 {registration.phone}
              </div>
            </div>

            <div className="profile-field">
              <div className="profile-field-label">Age & Gender</div>
              <div className="profile-field-value" style={{ fontSize: '0.95rem' }}>
                {registration.age} years old • {registration.gender}
              </div>
            </div>

            <div className="profile-field">
              <div className="profile-field-label">Assigned Username</div>
              <div className="profile-field-value" style={{ fontSize: '0.95rem', fontFamily: 'monospace' }}>
                {registration.username || 'Not assigned (Pending)'}
              </div>
            </div>

            <div className="profile-field">
              <div className="profile-field-label">Submitted On</div>
              <div className="profile-field-value" style={{ fontSize: '0.88rem' }}>
                {formatDate(registration.createdAt)}
              </div>
            </div>

            {registration.status === 'approved' && (
              <div className="profile-field">
                <div className="profile-field-label">Approved On</div>
                <div className="profile-field-value" style={{ fontSize: '0.88rem', color: 'var(--success)' }}>
                  {formatDate(registration.approvedAt)}
                </div>
              </div>
            )}

            {registration.status === 'rejected' && (
              <div className="profile-field">
                <div className="profile-field-label">Rejected On</div>
                <div className="profile-field-value" style={{ fontSize: '0.88rem', color: 'var(--danger)' }}>
                  {formatDate(registration.rejectedAt)}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
