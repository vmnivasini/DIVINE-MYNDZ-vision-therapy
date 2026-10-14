import React from 'react';
import { BRAND_CONFIG } from '../config/branding';

/**
 * Reusable Centralized Brand Logo Component
 *
 * Automatically displays the organization logo image when configured in BRAND_CONFIG.logoPath.
 * Until the user supplies the final logo file, renders a clean, professional, neutral clinical placeholder.
 */
export default function BrandLogo({
  variant = 'navbar', // 'navbar' | 'footer' | 'card' | 'inline' | 'auth'
  size = 'md',        // 'sm' | 'md' | 'lg'
  showText = true,
  showTagline = false,
  className = '',
  onClick = null
}) {
  const { logoPath, organizationName, shortName, tagline } = BRAND_CONFIG;

  const heights = {
    sm: 34,
    md: 46,
    lg: 58
  };
  const targetHeight = heights[size] || heights.md;
  const isFooter = variant === 'footer';

  const content = (
    <div
      className={`brand-logo-container brand-logo-${variant} ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
        textDecoration: 'none',
        cursor: onClick ? 'pointer' : 'inherit'
      }}
      onClick={onClick}
    >
      {logoPath ? (
        <img
          src={logoPath}
          alt={organizationName}
          style={{
            height: targetHeight,
            width: targetHeight,
            minWidth: targetHeight,
            objectFit: 'contain',
            borderRadius: 8,
            backgroundColor: '#FFFFFF',
            boxShadow: '0 2px 8px rgba(30, 43, 37, 0.08)',
            border: '1px solid rgba(73, 107, 93, 0.15)',
            padding: 2,
            display: 'block'
          }}
        />
      ) : (
        /* Neutral Clinical Emblem Placeholder */
        <div
          className="brand-logo-placeholder"
          role="img"
          aria-label={organizationName}
          style={{
            height: targetHeight,
            width: targetHeight,
            minWidth: targetHeight,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #496B5D 0%, #1E2B25 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FAF8F4',
            boxShadow: '0 2px 8px rgba(30, 43, 37, 0.15)',
            position: 'relative'
          }}
        >
          <svg
            width={targetHeight * 0.58}
            height={targetHeight * 0.58}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
            <circle cx="12" cy="12" r="1" fill="currentColor" />
          </svg>
        </div>
      )}

      {showText && (
        <div className="brand-logo-text-group" style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
          <span
            className="brand-logo-title"
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: size === 'sm' ? '1.12rem' : size === 'lg' ? '1.55rem' : '1.35rem',
              fontWeight: 600,
              color: isFooter ? '#FAF8F4' : '#1E2B25',
              letterSpacing: '0.02em',
              lineHeight: 1.15,
              display: 'inline-flex',
              alignItems: 'baseline',
              flexWrap: 'nowrap',
              whiteSpace: 'nowrap',
              gap: '6px'
            }}
          >
            {shortName.includes('by Swahithi') ? (
              <>
                <span>DIVINE MYNDZ</span>
                <span
                  style={{
                    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                    fontSize: '0.74em',
                    fontWeight: 600,
                    color: isFooter ? '#C2C9C5' : '#496B5D',
                    letterSpacing: '0.02em'
                  }}
                >
                  by Swahithi
                </span>
              </>
            ) : (
              shortName
            )}
          </span>
          {showTagline && (
            <span
              className="brand-logo-subtitle"
              style={{
                fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                fontSize: size === 'sm' ? '0.68rem' : '0.74rem',
                color: isFooter ? '#C2C9C5' : '#5F665F',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                fontWeight: 600,
                marginTop: 2
              }}
            >
              {tagline}
            </span>
          )}
        </div>
      )}
    </div>
  );

  return content;
}
