/**
 * Form and input validation utilities for Registration Portal
 */

export const GENDER_OPTIONS = [
  'Male',
  'Female',
  'Other',
  'Prefer not to say'
];

/**
 * Validates full name
 * @param {string} name 
 * @returns {{ isValid: boolean, error?: string }}
 */
export function validateName(name) {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return { isValid: false, error: 'Full Name is required and cannot be empty.' };
  }
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return { isValid: false, error: 'Full Name must be at least 2 characters.' };
  }
  if (!/^[a-zA-Z\s.'-]+$/.test(trimmed)) {
    return { isValid: false, error: 'Full Name can only contain letters, spaces, hyphens, and periods.' };
  }
  return { isValid: true };
}

/**
 * Validates age (1 - 120, numeric only)
 * @param {string|number} age 
 * @returns {{ isValid: boolean, error?: string }}
 */
export function validateAge(age) {
  if (age === undefined || age === null || String(age).trim() === '') {
    return { isValid: false, error: 'Age is required.' };
  }
  const num = Number(age);
  if (!Number.isInteger(num)) {
    return { isValid: false, error: 'Age must be a valid whole number.' };
  }
  if (num < 1 || num > 120) {
    return { isValid: false, error: 'Please enter a valid age between 1 and 120.' };
  }
  return { isValid: true };
}

/**
 * Validates gender selection
 * @param {string} gender 
 * @returns {{ isValid: boolean, error?: string }}
 */
export function validateGender(gender) {
  if (!gender || !GENDER_OPTIONS.includes(gender)) {
    return { isValid: false, error: 'Please select a valid gender option.' };
  }
  return { isValid: true };
}

/**
 * Validates Indian 10-digit mobile number
 * @param {string} phone 
 * @returns {{ isValid: boolean, error?: string }}
 */
export function validatePhone(phone) {
  if (!phone || typeof phone !== 'string' || phone.trim() === '') {
    return { isValid: false, error: 'Phone Number is required.' };
  }
  // Strip common non-digits like spaces or hyphens if entered
  const cleaned = phone.trim().replace(/[\s-]/g, '');
  // Also tolerate +91 prefix if entered
  const normalized = cleaned.startsWith('+91') ? cleaned.slice(3) : (cleaned.startsWith('0') ? cleaned.slice(1) : cleaned);
  
  const indianPhoneRegex = /^[6-9]\d{9}$/;
  if (!indianPhoneRegex.test(normalized)) {
    return { isValid: false, error: 'Please enter a valid 10-digit phone number (Indian mobile starting with 6, 7, 8, or 9).' };
  }
  return { isValid: true, sanitized: normalized };
}

/**
 * Validates that email is strictly a valid Gmail address ending with @gmail.com
 * @param {string} email 
 * @returns {{ isValid: boolean, error?: string }}
 */
export function validateGmail(email) {
  if (!email || typeof email !== 'string' || email.trim() === '') {
    return { isValid: false, error: 'Gmail ID is required.' };
  }
  const cleanEmail = email.trim().toLowerCase();

  // Basic RFC email format test
  const standardEmailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
  if (!standardEmailRegex.test(cleanEmail)) {
    return { isValid: false, error: 'Please enter a valid email format.' };
  }

  // Strictly check that it ends with @gmail.com
  if (!cleanEmail.endsWith('@gmail.com')) {
    return {
      isValid: false,
      error: 'Please enter a valid Gmail address ending with @gmail.com. Other domains (e.g., yahoo.com, outlook.com, hotmail.com, company/edu) are not accepted.'
    };
  }

  // Ensure there is a valid username portion before @gmail.com
  const userPart = cleanEmail.substring(0, cleanEmail.indexOf('@gmail.com'));
  if (userPart.length < 3) {
    return { isValid: false, error: 'Gmail username prefix must be at least 3 characters.' };
  }

  return { isValid: true, sanitized: cleanEmail };
}

/**
 * Validates the full registration form data
 * @param {object} formData 
 * @returns {{ isValid: boolean, errors: Record<string, string> }}
 */
export function validateRegistrationForm(formData) {
  const errors = {};

  const nameVal = validateName(formData.name);
  if (!nameVal.isValid) errors.name = nameVal.error;

  const ageVal = validateAge(formData.age);
  if (!ageVal.isValid) errors.age = ageVal.error;

  const genderVal = validateGender(formData.gender);
  if (!genderVal.isValid) errors.gender = genderVal.error;

  const phoneVal = validatePhone(formData.phone);
  if (!phoneVal.isValid) errors.phone = phoneVal.error;

  const emailVal = validateGmail(formData.email);
  if (!emailVal.isValid) errors.email = emailVal.error;

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitized: {
      name: formData.name ? formData.name.trim() : '',
      age: Number(formData.age),
      gender: formData.gender,
      phone: phoneVal.sanitized || formData.phone,
      email: emailVal.sanitized || (formData.email ? formData.email.trim().toLowerCase() : '')
    }
  };
}
