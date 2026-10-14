/**
 * Utilities for generating unique usernames and secure temporary passwords
 */

/**
 * Generates a clean, unique username formatted as USER followed by 5 random digits
 * Example: USER12345, USER94821
 * @param {string} [prefix='USER']
 * @returns {string}
 */
export function generateUsername(prefix = 'USER') {
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `${prefix}${randomNum}`;
}

/**
 * Generates a secure, temporary password containing uppercase, lowercase, digits, and special characters
 * Example: X7kP92mL, W3r#K9xQ
 * @param {number} [length=10]
 * @returns {string}
 */
export function generateSecurePassword(length = 10) {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude ambiguous chars like I, O
  const lowercase = 'abcdefghijkmnpqrstuvwxyz'; // Exclude ambiguous chars like l, o
  const numbers = '23456789'; // Exclude 0, 1
  const symbols = '!@#$%&*';

  const allChars = uppercase + lowercase + numbers + symbols;

  // Ensure at least one character of each category
  const passwordArray = [
    uppercase[Math.floor(Math.random() * uppercase.length)],
    lowercase[Math.floor(Math.random() * lowercase.length)],
    numbers[Math.floor(Math.random() * numbers.length)],
    symbols[Math.floor(Math.random() * symbols.length)]
  ];

  // Fill remainder of length
  for (let i = passwordArray.length; i < length; i++) {
    passwordArray.push(allChars[Math.floor(Math.random() * allChars.length)]);
  }

  // Shuffle array using Fisher-Yates
  for (let i = passwordArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [passwordArray[i], passwordArray[j]] = [passwordArray[j], passwordArray[i]];
  }

  return passwordArray.join('');
}
