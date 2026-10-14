import React, { useState } from 'react';
import { CheckCircle2, Copy, Check, ShieldAlert, X } from 'lucide-react';

export default function CredentialModal({
  isOpen,
  onClose,
  data
}) {
  const [copiedUsername, setCopiedUsername] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  if (!isOpen || !data) return null;

  const handleCopyUsername = () => {
    navigator.clipboard.writeText(data.username);
    setCopiedUsername(true);
    setTimeout(() => setCopiedUsername(false), 2000);
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(data.temporaryPassword);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  const handleCopyAll = () => {
    const roleLabel = data.role === 'admin' ? 'Ophthalmologist' : 'Patient';
    const loginPath = data.role === 'admin' ? 'admin-login' : 'login';
    const text = `Vision Therapy Portal ${roleLabel} Credentials\nUsername: ${data.username}\nTemporary Password: ${data.temporaryPassword}\nRegistered Name: ${data.applicantName || ''}\nLogin URL: ${window.location.origin}/#/${loginPath}`;
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-dialog">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle2 color="#16a34a" size={24} />
            <h3 className="modal-title">{data.role === 'admin' ? 'Ophthalmologist Approved & Created' : 'Registration Approved'}</h3>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '0.92rem', color: 'var(--text-muted)', marginBottom: 16 }}>
            {data.role === 'admin' ? (
              <>Ophthalmologist <strong>{data.applicantName}</strong> has been successfully approved. Ophthalmologist login credentials have been created:</>
            ) : (
              <>The applicant <strong>{data.applicantName}</strong> has been successfully approved. Login credentials have been generated:</>
            )}
          </p>

          <div className="credentials-box">
            <div className="credential-item">
              <span className="credential-label">Username (Email)</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="credential-value">{data.username}</span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={handleCopyUsername}
                  title="Copy Username"
                >
                  {copiedUsername ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            <div className="credential-item">
              <span className="credential-label">Temporary Password</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="credential-value">{data.temporaryPassword}</span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={handleCopyPassword}
                  title="Copy Password"
                >
                  {copiedPassword ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>

          <div className="alert alert-warning" style={{ margin: '18px 0 0 0', fontSize: '0.85rem' }}>
            <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>Security Notice:</strong> Please securely provide these credentials to the user.
              For security, passwords are encrypted in Firebase and will <strong>never</strong> be displayed again after closing this screen.
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-outline"
            onClick={handleCopyAll}
          >
            {copiedAll ? <Check size={16} color="#16a34a" /> : <Copy size={16} />}
            <span>{copiedAll ? 'Credentials Copied!' : 'Copy Credentials'}</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onClose}
          >
            Done & Close
          </button>
        </div>
      </div>
    </div>
  );
}
