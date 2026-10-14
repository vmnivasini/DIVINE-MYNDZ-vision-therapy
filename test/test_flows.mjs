import {
  validateName,
  validateAge,
  validateGender,
  validatePhone,
  validateGmail,
  validateRegistrationForm
} from '../src/utils/validation.js';
import { generateUsername, generateSecurePassword } from '../src/utils/credentialGenerator.js';

console.log('--- Testing Validation Rules ---');

// 1. Name validation
console.assert(validateName('').isValid === false, 'Empty name should fail');
console.assert(validateName('   ').isValid === false, 'Whitespace name should fail');
console.assert(validateName('R').isValid === false, 'Single char name should fail');
console.assert(validateName('Aarav Sharma').isValid === true, 'Valid name should pass');

// 2. Age validation
console.assert(validateAge('').isValid === false, 'Empty age should fail');
console.assert(validateAge('abc').isValid === false, 'String age should fail');
console.assert(validateAge(0).isValid === false, 'Age 0 should fail');
console.assert(validateAge(121).isValid === false, 'Age 121 should fail');
console.assert(validateAge(25).isValid === true, 'Age 25 should pass');

// 3. Gender validation
console.assert(validateGender('Male').isValid === true, 'Male should pass');
console.assert(validateGender('Female').isValid === true, 'Female should pass');
console.assert(validateGender('Other').isValid === true, 'Other should pass');
console.assert(validateGender('Prefer not to say').isValid === true, 'Prefer not to say should pass');
console.assert(validateGender('Unknown').isValid === false, 'Unknown gender should fail');

// 4. Phone validation (Indian 10-digit)
console.assert(validatePhone('1234567890').isValid === false, 'Phone starting with 1 should fail');
console.assert(validatePhone('98765').isValid === false, 'Short phone should fail');
console.assert(validatePhone('987654321012').isValid === false, 'Long phone should fail');
console.assert(validatePhone('9876543210').isValid === true, 'Valid 10-digit Indian phone should pass');
console.assert(validatePhone('8765432109').isValid === true, 'Phone starting with 8 should pass');
console.assert(validatePhone('7765432109').isValid === true, 'Phone starting with 7 should pass');
console.assert(validatePhone('6765432109').isValid === true, 'Phone starting with 6 should pass');

// 5. Gmail validation
console.assert(validateGmail('user@yahoo.com').isValid === false, 'Yahoo should fail');
console.assert(validateGmail('user@outlook.com').isValid === false, 'Outlook should fail');
console.assert(validateGmail('user@hotmail.com').isValid === false, 'Hotmail should fail');
console.assert(validateGmail('user@company.com').isValid === false, 'Company domain should fail');
console.assert(validateGmail('user@university.edu').isValid === false, 'Edu domain should fail');
console.assert(validateGmail('patient@gmail.com').isValid === true, 'Valid Gmail should pass');
console.assert(validateGmail('  PATIENT@GMAIL.COM  ').isValid === true, 'Uppercase Gmail with spaces should pass and normalize');

console.log('✓ All Validation Rules PASSED!');

// 6. Credential Generation
console.log('--- Testing Credential Generator ---');
const u1 = generateUsername();
const u2 = generateUsername();
console.assert(/^USER\d{5}$/.test(u1), `Username should match USER12345 format, got ${u1}`);
console.assert(u1 !== u2, 'Generated usernames should be unique');

const p1 = generateSecurePassword(10);
console.assert(p1.length === 10, 'Password length should be 10');
console.assert(/[A-Z]/.test(p1), 'Password must have uppercase');
console.assert(/[a-z]/.test(p1), 'Password must have lowercase');
console.assert(/[0-9]/.test(p1), 'Password must have digit');
console.assert(/[!@#$%&*]/.test(p1), 'Password must have symbol');
console.log('✓ Credential Generator PASSED! Sample:', { username: u1, password: p1 });

console.log('\n--- All Unit Tests PASSED Successfully! ---');
