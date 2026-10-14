import {
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  setDoc,
  onSnapshot
} from 'firebase/firestore';
import { initializeApp as initSecondaryApp, deleteApp } from 'firebase/app';
import {
  getAuth as getSecondaryAuth,
  createUserWithEmailAndPassword,
  signOut as signOutSecondary
} from 'firebase/auth';
import { db, auth, firebaseConfig, isFirebaseConfigured } from './firebase';
import { generateSecurePassword } from '../utils/credentialGenerator';

// Clear any old mock cache from previous sessions
try {
  localStorage.removeItem('eyehospital_registrations_mock');
  localStorage.removeItem('eyehospital_users_mock');
} catch (_) {}

/**
 * Submits a new registration to Cloud Firestore.
 * Checks for duplicate Gmail before submitting.
 * Stores status as 'pending'.
 */
export async function submitRegistration(formData) {
  const normalizedEmail = formData.email.trim().toLowerCase();

  if (!isFirebaseConfigured() || !db) {
    throw new Error('Firebase Firestore is not configured. Please check your .env settings.');
  }

  // 1. Try checking for duplicate email in registrations collection
  try {
    const regRef = collection(db, 'registrations');
    const q = query(regRef, where('email', '==', normalizedEmail));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      throw new Error('This Gmail address has already been registered.');
    }
  } catch (checkErr) {
    if (checkErr.message.includes('already been registered')) {
      throw checkErr;
    }
    // If public read is restricted by security rules, proceed with creation
  }

  // 2. Add document with 'pending' status
  try {
    const regRef = collection(db, 'registrations');
    const newDoc = {
      name: formData.name.trim(),
      age: Number(formData.age),
      gender: formData.gender,
      phone: formData.phone.trim(),
      email: normalizedEmail,
      status: 'pending',
      username: null,
      createdAt: serverTimestamp(),
      approvedAt: null,
      rejectedAt: null
    };

    const docRef = await addDoc(regRef, newDoc);
    return { success: true, id: docRef.id };
  } catch (err) {
    console.error('Firestore submission error:', err);
    if (err.code === 'permission-denied' || err.message.includes('insufficient permissions')) {
      throw new Error('Firestore Security Rules have not been published in your Firebase Console. Please go to Firebase Console ➜ Firestore Database ➜ Rules tab and update the rules.');
    }
    throw new Error(err.message || 'Something went wrong while submitting your registration. Please try again.');
  }
}

/**
 * Fetches all registrations directly from Cloud Firestore.
 * Returns empty array [] if Firestore is empty.
 */
export async function getAllRegistrations() {
  if (!isFirebaseConfigured() || !db) {
    return [];
  }

  try {
    const regRef = collection(db, 'registrations');
    // Fetch without Firestore-side orderBy to prevent index or null timestamp issues
    const snapshot = await getDocs(regRef);
    const list = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || ''),
        approvedAt: data.approvedAt?.toDate ? data.approvedAt.toDate().toISOString() : data.approvedAt,
        rejectedAt: data.rejectedAt?.toDate ? data.rejectedAt.toDate().toISOString() : data.rejectedAt,
      });
    });

    // Sort descending by creation date in memory
    list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return list;
  } catch (err) {
    console.error('Firestore fetch error in getAllRegistrations:', err);
    if (err.code === 'permission-denied' || err.message.includes('insufficient permissions')) {
      throw new Error('Firestore permission denied: Your Firebase Rules are blocking read access. Please update Firestore Rules to allow read.');
    }
    throw new Error(err.message || 'Failed to retrieve registrations from Firestore.');
  }
}

/**
 * Approves a pending registration:
 * 1. Changes status to 'approved'
 * 2. Uses the user's registered email as their username (default)
 * 3. Generates secure temporary password
 * 4. Creates Firebase Auth user account without disrupting current admin session
 * 5. Updates registration record & user mapping in Firestore
 * 6. Returns generated credentials to display to admin once
 */
export async function approveRegistration(registrationId, registrationData) {
  // Use the user's email as their default username
  const username = registrationData.email.trim().toLowerCase();
  const temporaryPassword = generateSecurePassword();

  if (!isFirebaseConfigured() || !db || !auth) {
    throw new Error('Firebase is not configured.');
  }

  let secondaryApp = null;
  try {
    // 1. Create user in Firebase Authentication using secondary app
    // This prevents the current Admin from being automatically logged out
    const appName = `sec_auth_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    secondaryApp = initSecondaryApp(firebaseConfig, appName);
    const secondaryAuth = getSecondaryAuth(secondaryApp);

    let userUid = null;
    try {
      const userCred = await createUserWithEmailAndPassword(
        secondaryAuth,
        registrationData.email,
        temporaryPassword
      );
      userUid = userCred.user.uid;
    } catch (authErr) {
      if (authErr.code === 'auth/email-already-in-use') {
        console.warn('Firebase Auth user already exists for this email.');
      } else {
        throw authErr;
      }
    } finally {
      await signOutSecondary(secondaryAuth);
      await deleteApp(secondaryApp);
      secondaryApp = null;
    }

    // 2. Update registration document in Firestore
    const regDocRef = doc(db, 'registrations', registrationId);
    await updateDoc(regDocRef, {
      status: 'approved',
      username: username,
      approvedAt: serverTimestamp()
    });

    // 3. Store username mapping in `usernames/{username}` for user login
    //    Using the email as the document key (uppercased for consistency)
    const usernameKey = username.toUpperCase();
    await setDoc(doc(db, 'usernames', usernameKey), {
      username: username,
      email: registrationData.email.toLowerCase(),
      registrationId: registrationId,
      uid: userUid || '',
      createdAt: serverTimestamp()
    });

    // 4. Store user profile in `users/{uid}` if available
    if (userUid) {
      await setDoc(doc(db, 'users', userUid), {
        uid: userUid,
        name: registrationData.name,
        email: registrationData.email.toLowerCase(),
        username: username,
        role: 'user',
        status: 'approved',
        registrationId: registrationId,
        createdAt: serverTimestamp()
      });
    }

    return {
      success: true,
      username,
      temporaryPassword
    };
  } catch (err) {
    if (secondaryApp) {
      try { await deleteApp(secondaryApp); } catch (_) {}
    }
    console.error('Error approving registration in Firebase:', err);
    throw new Error(`Failed to approve registration: ${err.message}`);
  }
}

/**
 * Rejects a registration:
 * Changes status to 'rejected' and records rejectedAt timestamp in Firestore.
 */
export async function rejectRegistration(registrationId) {
  if (!isFirebaseConfigured() || !db) {
    throw new Error('Firebase is not configured.');
  }

  try {
    const regDocRef = doc(db, 'registrations', registrationId);
    await updateDoc(regDocRef, {
      status: 'rejected',
      rejectedAt: serverTimestamp()
    });
    return { success: true };
  } catch (err) {
    console.error('Error rejecting registration in Firebase:', err);
    throw new Error(`Failed to reject registration: ${err.message}`);
  }
}

/**
 * Look up registration record by username in Cloud Firestore.
 * Performs multi-strategy lookup (usernames doc in exact/upper/lower case, and registrations query fallback).
 */
export async function getRegistrationByUsername(username) {
  if (!isFirebaseConfigured() || !db || !username) {
    return null;
  }

  const raw = String(username).trim();

  try {
    // 1. Check usernames collection by exact, uppercase, lowercase key
    const variations = [raw, raw.toUpperCase(), raw.toLowerCase()];
    for (const key of variations) {
      const usernameDoc = await getDoc(doc(db, 'usernames', key));
      if (usernameDoc.exists()) {
        const uData = usernameDoc.data();
        if (uData.registrationId) {
          const regDoc = await getDoc(doc(db, 'registrations', uData.registrationId));
          if (regDoc.exists()) {
            return { id: regDoc.id, ...regDoc.data() };
          }
        }
      }
    }

    // 2. Direct fallback: query registrations collection where username matches
    for (const key of variations) {
      const q = query(collection(db, 'registrations'), where('username', '==', key));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const d = snap.docs[0];
        return { id: d.id, ...d.data() };
      }
    }

    return null;
  } catch (err) {
    console.error('Error looking up registration by username:', err);
    return null;
  }
}

/**
 * Look up registration record by user email in Cloud Firestore.
 */
export async function getRegistrationByEmail(email) {
  if (!isFirebaseConfigured() || !db || !email) {
    return null;
  }

  try {
    const cleanEmail = String(email).trim().toLowerCase();
    const q = query(collection(db, 'registrations'), where('email', '==', cleanEmail));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0];
      return { id: d.id, ...d.data() };
    }
    return null;
  } catch (err) {
    console.error('Error looking up registration by email:', err);
    return null;
  }
}

/**
 * Get registration by document ID
 */
export async function getRegistrationById(registrationId) {
  if (!isFirebaseConfigured() || !db || !registrationId) {
    return null;
  }

  try {
    const regDoc = await getDoc(doc(db, 'registrations', registrationId));
    if (regDoc.exists()) {
      return { id: regDoc.id, ...regDoc.data() };
    }
    return null;
  } catch (err) {
    console.error('Error fetching registration by ID:', err);
    return null;
  }
}

/**
 * Real-time listener for registration updates.
 * Updates immediately when admin allots new tests, changes parameters, or deletes tests.
 */
export function subscribeToRegistration(registrationId, onUpdate, onError) {
  if (!isFirebaseConfigured() || !db || !registrationId) {
    return () => {};
  }

  try {
    const unsubscribe = onSnapshot(
      doc(db, 'registrations', registrationId),
      (docSnap) => {
        if (docSnap.exists()) {
          onUpdate({ id: docSnap.id, ...docSnap.data() });
        }
      },
      (err) => {
        console.warn('Real-time subscription error for registration:', err);
        if (onError) onError(err);
      }
    );
    return unsubscribe;
  } catch (err) {
    console.error('Failed to set up real-time listener:', err);
    return () => {};
  }
}

export const TARGET_OBJECTS = [
  { id: 'circle', name: 'Classic Ball', emoji: '🔴', isShape: true },
  { id: 'tiger', name: 'Tiger Face', emoji: '🐯' },
  { id: 'cat', name: 'Cat Face', emoji: '🐱' },
  { id: 'dog', name: 'Dog Face', emoji: '🐶' },
  { id: 'panda', name: 'Panda Face', emoji: '🐼' },
  { id: 'lion', name: 'Lion Face', emoji: '🦁' },
  { id: 'rabbit', name: 'Bunny Face', emoji: '🐰' },
  { id: 'star', name: 'Golden Star', emoji: '⭐' },
  { id: 'butterfly', name: 'Butterfly', emoji: '🦋' },
  { id: 'soccer', name: 'Soccer Ball', emoji: '⚽' },
  { id: 'car', name: 'Little Car', emoji: '🚗' },
  { id: 'fish', name: 'Little Fish', emoji: '🐠' }
];

/**
 * Assigns or updates Vision Therapy Test parameters for a registered user.
 * Supports multiple tests by appending to the therapyTests array.
 */
export async function assignTherapyTest(registrationId, testConfig) {
  if (!isFirebaseConfigured() || !db) {
    throw new Error('Firebase is not configured.');
  }

  try {
    const regDocRef = doc(db, 'registrations', registrationId);
    const regSnap = await getDoc(regDocRef);
    const existingData = regSnap.exists() ? regSnap.data() : {};
    
    // Normalize existing tests array
    let currentTests = Array.isArray(existingData.therapyTests) ? [...existingData.therapyTests] : [];
    if (currentTests.length === 0 && existingData.therapyTest) {
      currentTests.push({ ...existingData.therapyTest, id: existingData.therapyTest.id || 'test_legacy' });
    }

    const testId = testConfig.id || `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const targetObj = TARGET_OBJECTS.find(o => o.id === (testConfig.targetShape || 'circle')) || TARGET_OBJECTS[0];

    const therapyPayload = {
      id: testId,
      title: testConfig.title || `${targetObj.emoji} ${targetObj.name} - ${testConfig.mode === 'pursuit' ? 'Pursuit' : 'Saccade'}`,
      targetShape: testConfig.targetShape || 'circle',
      mode: testConfig.mode || 'pursuit',
      movement: testConfig.movement || 'horizontal',
      lanePlacement: testConfig.lanePlacement || 'dynamic',
      bg: testConfig.bg || '#000000',
      color: testConfig.color || '#FF0000',
      size: parseFloat(testConfig.size) || (testConfig.targetShape && testConfig.targetShape !== 'circle' ? 50 : 40),
      vStart: parseFloat(testConfig.vStart) || 250,
      vEnd: parseFloat(testConfig.vEnd) || 600,
      duration: parseFloat(testConfig.duration) || 30,
      dwellMs: parseFloat(testConfig.dwellMs) || 1000,
      isiMs: parseFloat(testConfig.isiMs) || 300,
      jitterPct: parseFloat(testConfig.jitterPct) || 20,
      status: testConfig.status || 'allotted',
      allottedAt: testConfig.allottedAt || new Date().toISOString(),
      completedAt: testConfig.completedAt || null
    };

    // If updating an existing test in the array
    const existingIndex = currentTests.findIndex(t => t.id === testId);
    if (existingIndex >= 0) {
      currentTests[existingIndex] = { ...currentTests[existingIndex], ...therapyPayload };
    } else {
      currentTests.push(therapyPayload);
    }

    await updateDoc(regDocRef, {
      therapyTests: currentTests,
      // Keep therapyTest as latest for backward compatibility
      therapyTest: therapyPayload
    });

    return { success: true, therapyTests: currentTests, therapyTest: therapyPayload };
  } catch (err) {
    console.error('Error assigning therapy test in Firebase:', err);
    throw new Error(`Failed to assign therapy test: ${err.message}`);
  }
}

/**
 * Deletes a specific therapy test from a user's test list
 */
export async function deleteTherapyTest(registrationId, testId) {
  if (!isFirebaseConfigured() || !db) {
    throw new Error('Firebase is not configured.');
  }

  try {
    const regDocRef = doc(db, 'registrations', registrationId);
    const regSnap = await getDoc(regDocRef);
    if (!regSnap.exists()) return { success: false };

    const data = regSnap.data();
    let currentTests = Array.isArray(data.therapyTests) ? [...data.therapyTests] : [];
    if (currentTests.length === 0 && data.therapyTest) {
      currentTests.push({ ...data.therapyTest, id: data.therapyTest.id || 'test_legacy' });
    }

    const updated = currentTests.filter(t => t.id !== testId);
    await updateDoc(regDocRef, {
      therapyTests: updated,
      therapyTest: updated.length > 0 ? updated[updated.length - 1] : null
    });

    return { success: true, therapyTests: updated };
  } catch (err) {
    console.error('Error deleting therapy test in Firebase:', err);
    throw new Error(`Failed to delete therapy test: ${err.message}`);
  }
}

/**
 * Marks a specific Vision Therapy Test as completed
 */
export async function completeTherapyTest(registrationId, testId) {
  if (!isFirebaseConfigured() || !db) {
    return { success: false };
  }

  try {
    const regDocRef = doc(db, 'registrations', registrationId);
    const regSnap = await getDoc(regDocRef);
    if (!regSnap.exists()) return { success: false };

    const data = regSnap.data();
    let currentTests = Array.isArray(data.therapyTests) ? [...data.therapyTests] : [];
    if (currentTests.length === 0 && data.therapyTest) {
      currentTests.push({ ...data.therapyTest, id: data.therapyTest.id || 'test_legacy' });
    }

    const updated = currentTests.map(test => {
      if (!testId || test.id === testId) {
        return {
          ...test,
          status: 'completed',
          completedAt: new Date().toISOString()
        };
      }
      return test;
    });

    await updateDoc(regDocRef, {
      therapyTests: updated,
      'therapyTest.status': 'completed',
      'therapyTest.completedAt': new Date().toISOString()
    });

    return { success: true, therapyTests: updated };
  } catch (err) {
    console.error('Error completing therapy test in Firebase:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Saves recorded eye movement and object telemetry to Cloud Firestore
 * in the `testResults` collection and marks the test as completed.
 */
export async function saveTestTelemetryResult({
  registrationId,
  patientName,
  patientUsername,
  testId,
  testTitle,
  targetShape,
  mode,
  movement,
  duration,
  vStart,
  vEnd,
  totalSamples,
  meanErrorPx,
  accuracyPct,
  telemetry = []
}) {
  if (!isFirebaseConfigured() || !db) {
    throw new Error('Firebase is not configured.');
  }

  try {
    const resultId = `result_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const resultDocRef = doc(db, 'testResults', resultId);

    const resultPayload = {
      id: resultId,
      registrationId: registrationId || '',
      patientName: patientName || 'Patient',
      patientUsername: patientUsername || '',
      testId: testId || '',
      testTitle: testTitle || 'Vision Therapy Stimulus Test',
      targetShape: targetShape || 'circle',
      mode: mode || 'pursuit',
      movement: movement || 'horizontal',
      duration: Number(duration) || 30,
      vStart: Number(vStart) || 250,
      vEnd: Number(vEnd) || 600,
      totalSamples: Number(totalSamples) || telemetry.length,
      meanErrorPx: Number(meanErrorPx) || 0,
      accuracyPct: Number(accuracyPct) || 100,
      telemetry: telemetry, // Array of numerical data points
      completedAt: new Date().toISOString()
    };

    await setDoc(resultDocRef, resultPayload);

    // Also update the test in registrations collection
    if (registrationId) {
      const regDocRef = doc(db, 'registrations', registrationId);
      const regSnap = await getDoc(regDocRef);
      if (regSnap.exists()) {
        const data = regSnap.data();
        let currentTests = Array.isArray(data.therapyTests) ? [...data.therapyTests] : [];
        if (currentTests.length === 0 && data.therapyTest) {
          currentTests.push({ ...data.therapyTest, id: data.therapyTest.id || 'test_legacy' });
        }

        const updated = currentTests.map(test => {
          if (!testId || test.id === testId) {
            return {
              ...test,
              status: 'completed',
              completedAt: resultPayload.completedAt,
              resultId: resultId,
              accuracyPct: resultPayload.accuracyPct,
              meanErrorPx: resultPayload.meanErrorPx,
              totalSamples: resultPayload.totalSamples
            };
          }
          return test;
        });

        await updateDoc(regDocRef, {
          therapyTests: updated,
          'therapyTest.status': 'completed',
          'therapyTest.completedAt': resultPayload.completedAt,
          'therapyTest.resultId': resultId
        });
      }
    }

    return { success: true, resultId, result: resultPayload };
  } catch (err) {
    console.error('Error saving eye tracking telemetry in Firestore:', err);
    throw new Error(`Failed to save telemetry: ${err.message}`);
  }
}

/**
 * Fetches recorded test telemetry result by its document ID
 */
export async function getTestResultById(resultId) {
  if (!isFirebaseConfigured() || !db || !resultId) {
    return null;
  }

  try {
    const docSnap = await getDoc(doc(db, 'testResults', resultId));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (err) {
    console.error('Error fetching test result:', err);
    return null;
  }
}

/**
 * Fetches all test results for a given patient registration ID
 */
export async function getTestResultsForPatient(registrationId) {
  if (!isFirebaseConfigured() || !db || !registrationId) {
    return [];
  }

  try {
    const q = query(collection(db, 'testResults'), where('registrationId', '==', registrationId));
    const snap = await getDocs(q);
    const results = [];
    snap.forEach(d => results.push({ id: d.id, ...d.data() }));
    // Sort descending by completion time
    results.sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));
    return results;
  } catch (err) {
    console.error('Error fetching patient test results:', err);
    return [];
  }
}
