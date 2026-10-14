/**
 * Role Definitions and Display Mappings
 *
 * CRITICAL SPECIFICATION:
 * - Internal system roles (preserved for Firebase Auth & Firestore security):
 *   - 'superadmin': Master authority
 *   - 'admin': Ophthalmologist & hospital staff
 *   - 'user': Registered patient
 *
 * - User-Facing Role Terminology:
 *   - Former 'Admin' -> Presented to users as "Ophthalmologist"
 *   - Former 'Super Admin' -> Presented to users as "Admin"
 *   - 'Patient' / 'User' -> Presented to users as "Patient"
 */

export const INTERNAL_ROLES = {
  SUPER_ADMIN: 'superadmin',
  ADMIN: 'admin',
  USER: 'user'
};

export const ROLE_DISPLAY_NAMES = {
  superadmin: 'Admin',
  admin: 'Ophthalmologist',
  user: 'Patient'
};

export const ROLE_BADGE_LABELS = {
  superadmin: '⚡ Admin',
  admin: '🩺 Ophthalmologist',
  user: 'Patient'
};

export const ROLE_PORTAL_NAMES = {
  superadmin: 'Admin Portal',
  admin: 'Ophthalmologist Portal',
  user: 'Patient Portal'
};

/**
 * Returns the official user-facing display label for any role identifier.
 * @param {string} role - Internal role string ('admin', 'superadmin', 'user')
 * @returns {string} - "Ophthalmologist", "Admin", or "Patient"
 */
export function getRoleDisplayName(role) {
  if (!role) return '';
  const r = String(role).trim().toLowerCase();
  if (r === 'superadmin' || r === 'super_admin' || r === 'super admin') {
    return 'Admin';
  }
  if (r === 'admin') {
    return 'Ophthalmologist';
  }
  if (r === 'user' || r === 'patient') {
    return 'Patient';
  }
  return role;
}

/**
 * Returns the badge formatted label for a given role identifier.
 * @param {string} role
 * @returns {string}
 */
export function getRoleBadgeLabel(role) {
  if (!role) return '';
  const r = String(role).trim().toLowerCase();
  if (r === 'superadmin' || r === 'super_admin' || r === 'super admin') {
    return '⚡ Admin';
  }
  if (r === 'admin') {
    return '🩺 Ophthalmologist';
  }
  if (r === 'user' || r === 'patient') {
    return 'Patient';
  }
  return role;
}

/**
 * Returns portal title for role.
 * @param {string} role
 * @returns {string}
 */
export function getRolePortalName(role) {
  if (!role) return '';
  const r = String(role).trim().toLowerCase();
  if (r === 'superadmin' || r === 'super_admin' || r === 'super admin') {
    return 'Admin Portal';
  }
  if (r === 'admin') {
    return 'Ophthalmologist Portal';
  }
  if (r === 'user' || r === 'patient') {
    return 'Patient Portal';
  }
  return 'Portal';
}
