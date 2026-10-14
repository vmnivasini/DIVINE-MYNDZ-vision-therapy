/**
 * Centralized Branding Configuration
 *
 * When the final organization logo file is provided:
 * 1. Place the logo asset in /public/ (e.g. /public/logo.png or /public/logo.svg)
 *    or /src/assets/
 * 2. Set `logoPath` below to the asset URL (e.g. '/logo.png').
 *
 * All navigation bars, dashboards, footers, login screens, and headers
 * will automatically update to render the exact asset.
 */

export const BRAND_CONFIG = {
  // Path to the organization logo image
  logoPath: '/logo.png',

  // Fallback clinical text / alternative description for accessibility
  organizationName: 'DIVINE MYNDZ by Swahithi',
  shortName: 'DIVINE MYNDZ by Swahithi',
  tagline: 'Personalized Visual Assessment & Clinical Care',

  // Clinical landing page contact & operational details (not fabricated medical claims)
  clinicalSubtitle: 'Vision Assessment & Rehabilitation Platform',
  supportEmail: 'contact@divinemyndz.in',
  portalVersion: '2.4.0 Clinical Edition'
};
