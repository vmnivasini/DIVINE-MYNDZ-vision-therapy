import React from 'react';
import {
  UserPlus,
  LogIn,
  CheckCircle2,
  ArrowRight,
  Stethoscope,
  Crown,
  Eye,
  Activity,
  Sparkles,
  FileSpreadsheet,
  Camera,
  ShieldCheck,
  Check,
  ChevronRight,
  Mail,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import BrandLogo from '../components/BrandLogo';
import { BRAND_CONFIG } from '../config/branding';

export default function Home({ navigate }) {
  const { currentUser, isSuperAdmin, isAdmin, isUser } = useAuth();

  const handleScrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="home-page-container">
      {/* ======================================================== */}
      {/* HERO SECTION — MINIMAL, ABSTRACT & ROLE-BASED ACCESS     */}
      {/* ======================================================== */}
      <section className="hero-minimal-section" id="hero-access">
        {/* Subtle Abstract Optical Focus & Tracking Visual Element */}
        <div className="hero-abstract-visual" aria-hidden="true">
          <svg
            viewBox="0 0 600 600"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="abstract-focus-svg"
          >
            {/* Concentric visual focus rings */}
            <circle cx="300" cy="300" r="260" stroke="#496B5D" strokeWidth="1" strokeOpacity="0.08" strokeDasharray="6 6" />
            <circle cx="300" cy="300" r="195" stroke="#496B5D" strokeWidth="1.2" strokeOpacity="0.14" />
            <circle cx="300" cy="300" r="135" stroke="#1E2B25" strokeWidth="1" strokeOpacity="0.1" strokeDasharray="4 4" />
            <circle cx="300" cy="300" r="75" stroke="#496B5D" strokeWidth="1.6" strokeOpacity="0.2" />
            <circle cx="300" cy="300" r="24" stroke="#496B5D" strokeWidth="1.8" strokeOpacity="0.3" fill="#DCE6DE" fillOpacity="0.25" />
            <circle cx="300" cy="300" r="4" fill="#496B5D" fillOpacity="0.6" />

            {/* Fine ocular axis coordinates */}
            <line x1="40" y1="300" x2="560" y2="300" stroke="#496B5D" strokeWidth="0.8" strokeOpacity="0.12" strokeDasharray="4 4" />
            <line x1="300" y1="40" x2="300" y2="560" stroke="#496B5D" strokeWidth="0.8" strokeOpacity="0.12" strokeDasharray="4 4" />

            {/* Subtle orbital tracking curves (simulating calibrated eye pursuit) */}
            <path
              d="M120 380 C 180 220, 420 220, 480 380"
              stroke="#496B5D"
              strokeWidth="1.4"
              strokeOpacity="0.18"
              fill="none"
            />
            <circle cx="210" cy="275" r="3.5" fill="#496B5D" fillOpacity="0.4" />
            <circle cx="300" cy="245" r="4" fill="#496B5D" fillOpacity="0.5" />
            <circle cx="390" cy="275" r="3.5" fill="#496B5D" fillOpacity="0.4" />
          </svg>
        </div>

        <div className="container">
          <div className="hero-minimal-grid">
            {/* Left Section — Brand and Short Introduction */}
            <div className="hero-brand-block">
              <span className="hero-eyebrow-minimal">
                VISION ASSESSMENT & THERAPY
              </span>

              {/* Organization Logo */}
              <div style={{ marginBottom: 18 }}>
                <BrandLogo variant="inline" size="lg" showText={true} showTagline={false} />
              </div>

              {/* Headline */}
              <h1 className="hero-headline-minimal">
                Vision Therapy.<br />
                <span className="hero-headline-accent">Simplified.</span>
              </h1>

              {/* Supporting Text */}
              <p className="hero-supporting-text">
                An integrated platform for visual assessment, guided therapy, and clinical care.
              </p>

              {/* Active Session Indicator (when authenticated) */}
              {currentUser && (
                <div className="hero-active-session-pill">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="session-status-dot"></span>
                    <span style={{ fontSize: '0.88rem', color: '#1E2B25' }}>
                      Active: <strong>{currentUser.name || currentUser.username || currentUser.email}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => navigate(isSuperAdmin ? '/admin-dashboard' : isAdmin ? '/admin-dashboard' : '/dashboard')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <span>Go to Dashboard</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Right Section — Direct Role Access Panel */}
            <div className="hero-access-panel-col">
              <div className="access-panel-card">
                <div className="access-panel-header">
                  <h2 className="access-panel-title">Direct Portal Access</h2>
                  <p className="access-panel-subtitle">Select your role to sign in or register</p>
                </div>

                <div className="access-panel-roles">
                  {/* Role 1: Patient */}
                  <div className="role-access-item">
                    <div className="role-info">
                      <div className="role-icon-box bg-sage">
                        <Eye size={18} color="#496B5D" />
                      </div>
                      <div>
                        <div className="role-title">Patient</div>
                        <div className="role-desc">Visual assessment & therapy exercises</div>
                      </div>
                    </div>
                    <div className="role-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-primary action-btn"
                        onClick={() => navigate('/login')}
                        aria-label="Patient Login"
                      >
                        <LogIn size={14} />
                        <span>Patient Login</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline action-btn"
                        onClick={() => navigate('/register')}
                        aria-label="Patient Registration"
                      >
                        <UserPlus size={14} />
                        <span>Patient Registration</span>
                      </button>
                    </div>
                  </div>

                  {/* Role 2: Ophthalmologist */}
                  <div className="role-access-item">
                    <div className="role-info">
                      <div className="role-icon-box bg-sage">
                        <Stethoscope size={18} color="#496B5D" />
                      </div>
                      <div>
                        <div className="role-title">Ophthalmologist</div>
                        <div className="role-desc">Clinical staff & telemetry review</div>
                      </div>
                    </div>
                    <div className="role-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-dark action-btn"
                        onClick={() => navigate('/admin-login')}
                        aria-label="Ophthalmologist Login"
                      >
                        <LogIn size={14} />
                        <span>Ophthalmologist Login</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline action-btn"
                        onClick={() => navigate('/admin-register')}
                        aria-label="Ophthalmologist Registration"
                      >
                        <UserPlus size={14} />
                        <span>Ophthalmologist Registration</span>
                      </button>
                    </div>
                  </div>

                  {/* Role 3: Admin */}
                  <div className="role-access-item">
                    <div className="role-info">
                      <div className="role-icon-box bg-charcoal">
                        <Crown size={18} color="#FAF8F4" />
                      </div>
                      <div>
                        <div className="role-title">Admin</div>
                        <div className="role-desc">System authority & clinical governance</div>
                      </div>
                    </div>
                    <div className="role-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-dark action-btn"
                        onClick={() => navigate('/superadmin-login')}
                        aria-label="Admin Login"
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        <Sparkles size={14} />
                        <span>Admin Login</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* SECTION A — CLINICAL PHILOSOPHY (Full-Width Green Banner) */}
      {/* ======================================================== */}
      <section className="clinical-philosophy-section" id="clinical-approach">
        <div className="container">
          <span className="philosophy-eyebrow">Clinical Philosophy</span>
          <h2 className="philosophy-headline">
            Assessment Meets Personalized Care
          </h2>
          <p className="philosophy-text">
            “Bringing visual assessment, structured therapy, and clinician-guided care together in a coordinated approach to understanding visual performance.”
          </p>
        </div>
      </section>

      {/* ======================================================== */}
      {/* SECTION B — VISION THERAPY SERVICES (3 Clean Cards)      */}
      {/* ======================================================== */}
      <section className="services-section" id="services-section">
        <div className="container">
          <div className="section-header-centered">
            <span className="section-eyebrow">Clinical Capabilities</span>
            <h2 className="section-headline">
              Explore Our Services
            </h2>
            <p className="section-description">
              Structured visual assessments and therapy pathways designed to support clinicians and patients throughout the vision therapy process.
            </p>
          </div>

          <div className="pathways-grid">
            {/* Card 1: Visual Assessment */}
            <div className="pathway-card">
              <div>
                <span className="pathway-category">Diagnostic & Screening</span>
                <h3 className="pathway-title">Visual Assessment</h3>
                <p className="pathway-desc">
                  Standardized screen-based evaluations designed to measure ocular motility and tracking accuracy.
                </p>

                <ul className="pathway-list">
                  <li className="pathway-list-item">
                    <span className="pathway-list-item-bullet">•</span>
                    <span>Screen-based assessments</span>
                  </li>
                  <li className="pathway-list-item">
                    <span className="pathway-list-item-bullet">•</span>
                    <span>Smooth pursuit testing</span>
                  </li>
                  <li className="pathway-list-item">
                    <span className="pathway-list-item-bullet">•</span>
                    <span>Saccadic eye movement assessment</span>
                  </li>
                  <li className="pathway-list-item">
                    <span className="pathway-list-item-bullet">•</span>
                    <span>Eye movement tracking, where supported</span>
                  </li>
                </ul>
              </div>

              <div>
                <button
                  type="button"
                  className="btn btn-outline btn-block"
                  onClick={() => handleScrollTo('hero-access')}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <span>Access Assessment</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {/* Card 2: Guided Vision Therapy */}
            <div className="pathway-card">
              <div>
                <span className="pathway-category">Targeted Stimulation</span>
                <h3 className="pathway-title">Guided Vision Therapy</h3>
                <p className="pathway-desc">
                  Clinician-prescribed visual exercises with customizable velocity ramps and engaging stimuli.
                </p>

                <ul className="pathway-list">
                  <li className="pathway-list-item">
                    <span className="pathway-list-item-bullet">•</span>
                    <span>Structured visual exercises</span>
                  </li>
                  <li className="pathway-list-item">
                    <span className="pathway-list-item-bullet">•</span>
                    <span>Guided testing sessions</span>
                  </li>
                  <li className="pathway-list-item">
                    <span className="pathway-list-item-bullet">•</span>
                    <span>Existing patient-specific workflows</span>
                  </li>
                  <li className="pathway-list-item">
                    <span className="pathway-list-item-bullet">•</span>
                    <span>Calibrated motion patterns</span>
                  </li>
                </ul>
              </div>

              <div>
                <button
                  type="button"
                  className="btn btn-outline btn-block"
                  onClick={() => handleScrollTo('hero-access')}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <span>Explore Exercises</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {/* Card 3: Clinical Monitoring */}
            <div className="pathway-card">
              <div>
                <span className="pathway-category">Telemetry & Records</span>
                <h3 className="pathway-title">Clinical Monitoring</h3>
                <p className="pathway-desc">
                  Objective ocular telemetry allowing ophthalmologists to review tracking fidelity and session progress.
                </p>

                <ul className="pathway-list">
                  <li className="pathway-list-item">
                    <span className="pathway-list-item-bullet">•</span>
                    <span>Assessment history</span>
                  </li>
                  <li className="pathway-list-item">
                    <span className="pathway-list-item-bullet">•</span>
                    <span>Recorded test results</span>
                  </li>
                  <li className="pathway-list-item">
                    <span className="pathway-list-item-bullet">•</span>
                    <span>Clinician review and reporting, where supported</span>
                  </li>
                  <li className="pathway-list-item">
                    <span className="pathway-list-item-bullet">•</span>
                    <span>Secure ocular session data</span>
                  </li>
                </ul>
              </div>

              <div>
                <button
                  type="button"
                  className="btn btn-outline btn-block"
                  onClick={() => handleScrollTo('hero-access')}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <span>Review Monitoring</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* SECTION C — HOW IT WORKS (Simple 3-Step Protocol)        */}
      {/* ======================================================== */}
      <section style={{ padding: '70px 0 80px', backgroundColor: '#F3F1EC' }} id="how-it-works">
        <div className="container">
          <div className="section-header-centered" style={{ marginBottom: 44 }}>
            <span className="section-eyebrow">Structured Protocol</span>
            <h2 className="section-headline">
              How It Works
            </h2>
            <p className="section-description">
              A clear, coordinated workflow connecting intake, assessment, and longitudinal review.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
            {/* Step 1 */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: 'var(--radius-lg)',
              padding: '32px 26px',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-xs)'
            }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '1.1rem',
                marginBottom: 18
              }}>
                1
              </div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: 10, color: 'var(--secondary)' }}>
                Select the appropriate portal
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Patients, ophthalmologists, or administrators select their role from the direct access panel to log in or register.
              </p>
            </div>

            {/* Step 2 */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: 'var(--radius-lg)',
              padding: '32px 26px',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-xs)'
            }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '1.1rem',
                marginBottom: 18
              }}>
                2
              </div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: 10, color: 'var(--secondary)' }}>
                Access assessment or clinical dashboard
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Open your allotted visual therapy exercises, configure test parameters, or manage ophthalmologist verifications.
              </p>
            </div>

            {/* Step 3 */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: 'var(--radius-lg)',
              padding: '32px 26px',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-xs)'
            }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '1.1rem',
                marginBottom: 18
              }}>
                3
              </div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: 10, color: 'var(--secondary)' }}>
                Complete workflow and review available results
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Perform calibrated optical tracking exercises, log ocular telemetry, and inspect longitudinal performance records.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* SECTION: ABOUT THE PLATFORM (Anchored for Navigation)    */}
      {/* ======================================================== */}
      <section style={{ padding: '60px 0 80px', backgroundColor: '#FAF8F4' }} id="about-platform">
        <div className="container">
          <div style={{
            background: '#FFFFFF',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-xl)',
            padding: '48px 40px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ maxWidth: 840 }}>
              <span className="section-eyebrow">About the Platform</span>
              <h2 style={{ fontSize: '2.1rem', marginBottom: 16, color: 'var(--secondary)' }}>
                Modernizing Screen-Based Vision Assessment
              </h2>
              <p style={{ fontSize: '1.02rem', color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 24 }}>
                Our platform provides a secure environment for eye care professionals to prescribe structured visual stimulus protocols and assess oculomotor responses. By integrating 9-point optical calibration with real-time target coordinate recording, clinicians gain objective session metrics without cumbersome specialized hardware.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
                <div style={{ padding: 16, background: '#FAF8F4', borderRadius: 'var(--radius-md)' }}>
                  <h4 style={{ fontSize: '1rem', color: 'var(--primary)', marginBottom: 6 }}>WebCam Calibrated</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Utilizes browser-based facial landmark geometry for rapid 9-point setup.</p>
                </div>
                <div style={{ padding: 16, background: '#FAF8F4', borderRadius: 'var(--radius-md)' }}>
                  <h4 style={{ fontSize: '1rem', color: 'var(--primary)', marginBottom: 6 }}>Role Governance</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Multi-tier separation ensuring patient privacy and clinician data isolation.</p>
                </div>
                <div style={{ padding: 16, background: '#FAF8F4', borderRadius: 'var(--radius-md)' }}>
                  <h4 style={{ fontSize: '1rem', color: 'var(--primary)', marginBottom: 6 }}>Telemetry Export</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Detailed CSV and tabular telemetry exports for longitudinal tracking.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* SECTION: CLINICAL CONTACT & INQUIRIES (Navigation Anchor)*/}
      {/* ======================================================== */}
      <section style={{ padding: '60px 0 80px', backgroundColor: '#F3F1EC' }} id="contact-section">
        <div className="container">
          <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
            <span className="section-eyebrow">Inquiries & Support</span>
            <h2 style={{ fontSize: '2.2rem', marginBottom: 14, color: 'var(--secondary)' }}>
              Connect With Our Clinical Team
            </h2>
            <p style={{ fontSize: '1.02rem', color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 28, maxWidth: 620, margin: '0 auto 28px' }}>
              For technical support, clinician registration inquiries, or assistance with active vision therapy sessions, our clinical portal support team is available.
            </p>
            <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 24px',
                backgroundColor: '#FFFFFF',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-xs)'
              }}>
                <Mail size={18} color="#496B5D" />
                <a
                  href={`mailto:${BRAND_CONFIG.supportEmail}`}
                  style={{
                    fontSize: '1.05rem',
                    color: 'var(--primary)',
                    fontWeight: 600,
                    textDecoration: 'none',
                    letterSpacing: '0.01em'
                  }}
                >
                  {BRAND_CONFIG.supportEmail}
                </a>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                <ShieldCheck size={16} color="#496B5D" />
                <span>Encrypted Telemetry & Protected Health Records</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* SECTION D — CLINICAL FOOTER                              */}
      {/* ======================================================== */}
      <footer className="clinical-footer">
        <div className="container">
          <div className="clinical-footer-grid">
            <div>
              <BrandLogo variant="footer" size="md" showText={true} showTagline={true} />
              <p style={{
                fontSize: '0.88rem',
                color: '#B5C0BA',
                lineHeight: 1.6,
                marginTop: 16,
                maxWidth: 320
              }}>
                Structured visual assessments and personalized vision therapy workflows designed for clinicians and patients.
              </p>
            </div>

            <div>
              <h4 className="footer-col-title">Services</h4>
              <ul className="footer-links">
                <li><a href="#services-section" className="footer-link" onClick={() => handleScrollTo('services-section')}>Visual Assessment</a></li>
                <li><a href="#services-section" className="footer-link" onClick={() => handleScrollTo('services-section')}>Guided Vision Therapy</a></li>
                <li><a href="#services-section" className="footer-link" onClick={() => handleScrollTo('services-section')}>Clinical Monitoring</a></li>
                <li><a href="#how-it-works" className="footer-link" onClick={() => handleScrollTo('how-it-works')}>How It Works</a></li>
              </ul>
            </div>

            <div>
              <h4 className="footer-col-title">Portals</h4>
              <ul className="footer-links">
                <li><a href="#/login" className="footer-link" onClick={(e) => { e.preventDefault(); navigate('/login'); }}>Patient Login</a></li>
                <li><a href="#/register" className="footer-link" onClick={(e) => { e.preventDefault(); navigate('/register'); }}>Patient Registration</a></li>
                <li><a href="#/admin-login" className="footer-link" onClick={(e) => { e.preventDefault(); navigate('/admin-login'); }}>Ophthalmologist Login</a></li>
                <li><a href="#/admin-register" className="footer-link" onClick={(e) => { e.preventDefault(); navigate('/admin-register'); }}>Ophthalmologist Registration</a></li>
                <li><a href="#/superadmin-login" className="footer-link" onClick={(e) => { e.preventDefault(); navigate('/superadmin-login'); }}>Admin Login</a></li>
              </ul>
            </div>

            <div>
              <h4 className="footer-col-title">Clinical Notice</h4>
              <p style={{ fontSize: '0.82rem', color: '#9AA7A0', lineHeight: 1.55 }}>
                Screen-based vision therapy exercises are intended to support clinician-guided visual rehabilitation and assessment. Consult your ophthalmologist for medical diagnosis and treatment plans.
              </p>
            </div>
          </div>

          <div className="footer-bottom-bar" style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ fontSize: '0.8rem', color: '#7E8B84' }}>
              {BRAND_CONFIG.portalVersion} • Role-Based Healthcare System
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

