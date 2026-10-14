/**
 * Helper script to create an initial Administrator in Firebase
 * 
 * Usage:
 *   node scripts/createAdmin.js <email> <password> <name>
 * 
 * Example:
 *   node scripts/createAdmin.js admin@eyehospital.com Admin@12345 "Hospital SuperAdmin"
 */

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import * as dotenv from 'dotenv';
dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

async function createAdmin() {
  const args = process.argv.slice(2);
  const email = args[0] || 'admin@eyehospital.com';
  const password = args[1] || 'Admin@12345';
  const name = args[2] || 'System Administrator';

  if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes('YOUR_')) {
    console.error('Error: Please populate your real Firebase credentials in .env first.');
    process.exit(1);
  }

  console.log(`Connecting to Firebase project "${firebaseConfig.projectId}"...`);
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  try {
    let uid;
    try {
      console.log(`Creating Firebase Auth account for ${email}...`);
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      uid = userCred.user.uid;
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        console.log(`Account ${email} already exists in Firebase Auth. Signing in to retrieve UID...`);
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        uid = userCred.user.uid;
      } else {
        throw err;
      }
    }

    console.log(`Assigning role: "admin" in Firestore (users/${uid})...`);
    await setDoc(doc(db, 'users', uid), {
      uid,
      name,
      email,
      role: 'admin',
      createdAt: new Date().toISOString()
    });

    console.log('\n===============================================');
    console.log('✓ Administrator account created successfully!');
    console.log(`  UID:      ${uid}`);
    console.log(`  Email:    ${email}`);
    console.log(`  Role:     admin`);
    console.log('===============================================\n');
  } catch (err) {
    console.error('Failed to create admin:', err.message);
    process.exit(1);
  }
}

createAdmin();
