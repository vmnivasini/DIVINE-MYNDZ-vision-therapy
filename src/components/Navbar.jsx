import React, { useState } from 'react';
import {
  LogOut,
  User
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import BrandLogo from './BrandLogo';
import ProfileModal from './ProfileModal';

export default function Navbar({ currentPath, navigate }) {
  const { currentUser, isSuperAdmin, isAdmin, isUser, logout } = useAuth();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileModalTab, setProfileModalTab] = useState('profile');

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleScrollTo = (elementId) => {
    if (currentPath !== '/') {
      navigate('/');
      setTimeout(() => {
        const el = document.getElementById(elementId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const el = document.getElementById(elementId);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        {/* Organization Brand Logo */}
        <a
          href="#/"
          className="navbar-brand"
          onClick={(e) => {
            e.preventDefault();
            navigate('/');
          }}
          aria-label="Home"
        >
          <BrandLogo variant="navbar" size="md" showText={true} showTagline={false} />
        </a>

        {/* Center / Desktop Editorial Navigation */}
        <nav className="navbar-nav" style={{ display: 'flex', alignItems: 'center' }}>
          <a
            href="#/"
            className={`editorial-nav-link ${currentPath === '/' ? 'active' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              navigate('/');
            }}
          >
            Home
          </a>

          <a
            href="#about"
            className="editorial-nav-link"
            onClick={(e) => {
              e.preventDefault();
              handleScrollTo('about-platform');
            }}
          >
            About
          </a>

          <a
            href="#services"
            className="editorial-nav-link"
            onClick={(e) => {
              e.preventDefault();
              handleScrollTo('services-section');
            }}
          >
            Services
          </a>

          <a
            href="#contact"
            className="editorial-nav-link"
            onClick={(e) => {
              e.preventDefault();
              handleScrollTo('contact-section');
            }}
          >
            Contact Us
          </a>
        </nav>

        {/* Right Action / Authentication Portals */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {currentUser && (() => {
            const userRoleBadge = isSuperAdmin ? '⚡ Admin' : isAdmin ? '🩺 Ophthalmologist' : 'Patient';
            const userRoleBg = isSuperAdmin ? '#1E2B25' : '#496B5D';
            const displayName = currentUser.name || currentUser.username || currentUser.email?.split('@')[0] || 'User';
            const isOnDashboard = currentPath === '/dashboard' || currentPath === '/admin-dashboard' || currentPath === '/superadmin-dashboard';
            const targetDashboardPath = isSuperAdmin ? '/admin-dashboard' : isAdmin ? '/admin-dashboard' : '/dashboard';

            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Quick Dashboard Return button only if away from dashboard */}
                {!isOnDashboard && (
                  <a
                    href={`#${targetDashboardPath}`}
                    className="btn btn-sm btn-primary"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(targetDashboardPath);
                    }}
                    style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                  >
                    Dashboard →
                  </a>
                )}

                {/* Unified User Capsule */}
                <div
                  className="user-pill"
                  onClick={() => {
                    setProfileModalTab('profile');
                    setIsProfileModalOpen(true);
                  }}
                  title="Click to view & edit your profile"
                  style={{
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '5px 12px',
                    backgroundColor: '#FFFFFF',
                    borderColor: 'var(--border-color)'
                  }}
                >
                  <span className="badge" style={{ background: userRoleBg, color: '#FAF8F4', fontWeight: 600, fontSize: '0.72rem', padding: '2px 8px' }}>
                    {userRoleBadge}
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.84rem', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {displayName}
                  </span>
                </div>

                {/* Logout Button */}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="btn btn-sm btn-outline"
                  title="Log out"
                  style={{ padding: '6px 12px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                >
                  <LogOut size={13} />
                  <span>Logout</span>
                </button>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Global Profile & Security Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        initialTab={profileModalTab}
      />
    </header>
  );
}
