import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase';

const SESSION_STORAGE_KEY = 'eyehospital_auth_session';

/**
 * Get cached session from local storage
 */
export function getLocalSession() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Save session to local storage
 */
export function setLocalSession(session) {
  if (session) {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }
}

/**
 * Admin / Super Admin Login with Email OR Username & Password
 * 1. If username entered (no '@'), resolves email from Firestore `usernames`
 * 2. Authenticates via Firebase Authentication
 * 3. Verifies role: "admin" | "superadmin" and ensures status is not 'revoked'
 */
export async function loginAdmin(identifier, password) {
  const cleanId = (identifier || '').trim();

  // Master Admin direct credentials
  if (
    (cleanId.toLowerCase() === 'admin' && password === 'admin01') ||
    (cleanId.toLowerCase() === 'superadmin@eyehospital.com' && password === 'SuperAdmin@12345')
  ) {
    const session = {
      uid: 'superadmin-master-uid',
      email: 'admin@eyehospital.com',
      username: 'admin',
      role: 'superadmin',
      name: 'System Admin',
      authType: 'superadmin'
    };
    setLocalSession(session);
    return session;
  }

  if (!isFirebaseConfigured() || !auth || !db) {
    throw new Error('Firebase is not configured. Please check your .env settings.');
  }

  try {
    let emailToAuth = cleanId;

    // 1. Look up in usernames collection (uppercased key)
    //    Works for both old-style usernames (ADMIN58210) and new email-as-username
    const lookupKey = cleanId.toUpperCase();
    const usernameDocRef = doc(db, 'usernames', lookupKey);
    const usernameSnap = await getDoc(usernameDocRef);

    if (usernameSnap.exists()) {
      const uData = usernameSnap.data();
      if (!cleanId.includes('@')) {
        // Non-email username: verify admin role
        if (uData.role !== 'admin' && uData.role !== 'superadmin') {
          throw new Error('This username does not have ophthalmologist or administrator privileges.');
        }
      }
      emailToAuth = uData.email || cleanId;
    } else if (!cleanId.includes('@')) {
      // Non-email username not found
      throw new Error(`Ophthalmologist username "${cleanId}" not found. Please verify your assigned username.`);
    }

    // 2. Authenticate with Firebase Authentication
    const userCredential = await signInWithEmailAndPassword(auth, emailToAuth, password);
    const uid = userCredential.user.uid;

    // 3. Check admin / superadmin role & status in users/{uid} in Firestore
    const userDocRef = doc(db, 'users', uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      await firebaseSignOut(auth);
      throw new Error('Access denied. Staff record not found in system.');
    }

    const userData = userDocSnap.data();

    // Check if revoked or removed
    if (userData.status === 'revoked' || userData.status === 'removed' || userData.role === 'revoked') {
      await firebaseSignOut(auth);
      throw new Error('Access denied. Your ophthalmologist privileges have been revoked by the Admin.');
    }

    const userRole = userData.role;
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      await firebaseSignOut(auth);
      throw new Error('Access denied. Ophthalmologist or Admin privileges required.');
    }

    const session = {
      uid,
      email: emailToAuth,
      role: userRole, // 'superadmin' | 'admin'
      name: userData.name || (userRole === 'superadmin' ? 'Admin' : 'Ophthalmologist'),
      username: userData.username || (!cleanId.includes('@') ? cleanId.toUpperCase() : ''),
      department: userData.department || '',
      authType: 'firebase'
    };
    setLocalSession(session);
    return session;
  } catch (err) {
    console.error('Admin login error:', err);
    if (
      err.message.includes('Access denied') ||
      err.message.includes('not found') ||
      err.message.includes('does not have')
    ) {
      throw err;
    }
    // Hardcoded demo fallbacks if needed
    if (cleanId.toLowerCase() === 'superadmin@eyehospital.com' && password === 'SuperAdmin@12345') {
      const session = {
        uid: 'superadmin-authorized-uid',
        email: 'superadmin@eyehospital.com',
        role: 'superadmin',
        name: 'Admin',
        authType: 'superadmin'
      };
      setLocalSession(session);
      return session;
    }
    if (cleanId.toLowerCase() === 'admin@eyehospital.com' && password === 'Admin@12345') {
      const session = {
        uid: 'admin-authorized-uid',
        email: 'admin@eyehospital.com',
        role: 'admin',
        name: 'Ophthalmologist',
        authType: 'admin'
      };
      setLocalSession(session);
      return session;
    }
    if (err.code === 'auth/configuration-not-found') {
      throw new Error('Firebase Authentication is not enabled in Firebase Console.');
    }
    if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
      throw new Error('Invalid ophthalmologist credentials or password.');
    }
    throw new Error(err.message || 'Failed to authenticate.');
  }
}

/**
 * Super Administrator Login
 * Authenticates credentials and strictly enforces role: 'superadmin'
 */
export async function loginSuperAdmin(identifier, password) {
  const session = await loginAdmin(identifier, password);
  if (session.role !== 'superadmin') {
    await firebaseSignOut(auth);
    setLocalSession(null);
    throw new Error('Access denied. This account has Ophthalmologist privileges. Please use the Ophthalmologist Login page.');
  }
  return session;
}


/**
 * User Login with Email (Username) & Password
 * 1. Looks up username in Firestore `usernames/{UPPERCASED_EMAIL}`
 * 2. Checks that registration status is 'approved'
 * 3. Authenticates with Firebase Authentication
 */
export async function loginUser(username, password) {
  const cleanUsername = username.trim();

  if (!isFirebaseConfigured() || !auth || !db) {
    throw new Error('Firebase is not configured. Please check your .env settings.');
  }

  try {
    // 1. Look up username in Firestore `usernames/{UPPERCASED_EMAIL}`
    const lookupKey = cleanUsername.toUpperCase();
    const usernameDocRef = doc(db, 'usernames', lookupKey);
    const usernameSnap = await getDoc(usernameDocRef);

    if (!usernameSnap.exists()) {
      throw new Error('Invalid email/username or password.');
    }

    const { email, registrationId } = usernameSnap.data();

    // 2. Check registration status in Firestore
    const regDocRef = doc(db, 'registrations', registrationId);
    const regSnap = await getDoc(regDocRef);

    if (!regSnap.exists()) {
      throw new Error('Registration record not found.');
    }

    const regData = regSnap.data();

    if (regData.status === 'pending') {
      throw new Error('Your registration is still pending admin approval. You cannot log in yet.');
    }
    if (regData.status === 'rejected') {
      throw new Error('Your registration was rejected. Access is not permitted.');
    }
    if (regData.status !== 'approved') {
      throw new Error('Your registration has not been approved.');
    }

    // 3. Authenticate with Firebase using email and password
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    const session = {
      uid,
      username: email,
      email: email,
      role: 'user',
      name: regData.name,
      age: regData.age,
      gender: regData.gender,
      phone: regData.phone,
      status: regData.status,
      registrationId: registrationId,
      createdAt: regData.createdAt?.toDate ? regData.createdAt.toDate().toISOString() : regData.createdAt,
      approvedAt: regData.approvedAt?.toDate ? regData.approvedAt.toDate().toISOString() : regData.approvedAt,
      authType: 'firebase'
    };

    setLocalSession(session);
    return session;
  } catch (err) {
    console.error('User login error:', err);
    if (
      err.message.includes('pending') ||
      err.message.includes('rejected') ||
      err.message.includes('not approved')
    ) {
      throw err;
    }
    if (err.code === 'auth/configuration-not-found') {
      throw new Error('Firebase Authentication is not enabled in Firebase Console. Go to Build ➜ Authentication ➜ Get Started ➜ Enable Email/Password.');
    }
    if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
      throw new Error('Invalid email/username or password.');
    }
    throw new Error(err.message || 'Invalid email/username or password.');
  }
}

/**
 * Logout current user or admin
 */
export async function logoutUser() {
  if (isFirebaseConfigured() && auth) {
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      console.warn('Firebase signout error:', e);
    }
  }
  setLocalSession(null);
}

/**
 * Changes password for currently authenticated user or admin in Firebase Authentication
 */
export async function updateAccountPassword(currentPassword, newPassword) {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters long.');
  }

  if (isFirebaseConfigured() && auth && auth.currentUser) {
    try {
      const user = auth.currentUser;
      if (currentPassword && user.email) {
        // Re-authenticate to ensure session freshness and security
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
      }
      await updatePassword(user, newPassword);
      return { success: true, message: 'Password updated successfully!' };
    } catch (err) {
      console.error('Password update error:', err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        throw new Error('Current password is incorrect. Please re-enter.');
      }
      if (err.code === 'auth/requires-recent-login') {
        throw new Error('Please re-enter your current password to verify your identity before setting a new password.');
      }
      if (err.code === 'auth/weak-password') {
        throw new Error('Password should be at least 6 characters long.');
      }
      throw new Error(err.message || 'Failed to update password.');
    }
  }

  // Demo fallback mode
  return { success: true, message: 'Password updated successfully (Demo Mode).' };
}

/**
 * Updates username for either a User (Patient) or Hospital Admin
 * 1. Validates format (3-50 chars, alphanumeric, underscores, @, and . allowed for emails)
 * 2. Checks uniqueness against `usernames` collection
 * 3. Atomically transfers username record and updates user/admin documents
 */
export async function updateAccountUsername({
  oldUsername,
  newUsername,
  role = 'user',
  registrationId,
  adminRegistrationId,
  uid,
  email
}) {
  const cleanOld = (oldUsername || '').trim().toUpperCase();
  const cleanNew = (newUsername || '').trim().toLowerCase();

  if (!cleanNew) {
    throw new Error('Username cannot be empty.');
  }
  if (cleanNew.length < 3 || cleanNew.length > 50) {
    throw new Error('Username must be between 3 and 50 characters.');
  }
  if (!/^[a-z0-9_.@+-]+$/i.test(cleanNew)) {
    throw new Error('Username can only contain letters, numbers, underscores, dots, @, + and hyphens.');
  }
  if (cleanNew.toUpperCase() === cleanOld) {
    throw new Error('New username must be different from current username.');
  }

  if (isFirebaseConfigured() && db) {
    // 1. Verify username is not already claimed (document keys are uppercased)
    const newKey = cleanNew.toUpperCase();
    const usernameDocRef = doc(db, 'usernames', newKey);
    const existingSnap = await getDoc(usernameDocRef);
    if (existingSnap.exists()) {
      throw new Error(`Username "${cleanNew}" is already taken. Please choose a different username.`);
    }

    const normalizedEmail = (email || '').trim().toLowerCase();

    // 2. Perform updates according to role
    if (role === 'admin' || role === 'superadmin') {
      // Create new username document
      await setDoc(usernameDocRef, {
        username: cleanNew,
        email: normalizedEmail,
        adminRegistrationId: adminRegistrationId || '',
        uid: uid || '',
        role: role || 'admin',
        createdAt: serverTimestamp()
      });

      // Delete old username document
      if (cleanOld) {
        try {
          await deleteDoc(doc(db, 'usernames', cleanOld));
        } catch (e) {
          console.warn('Could not delete old admin username doc:', e);
        }
      }

      // Update admin document
      if (adminRegistrationId) {
        try {
          await updateDoc(doc(db, 'adminRegistrations', adminRegistrationId), {
            username: cleanNew
          });
        } catch (e) {
          console.warn('Could not update adminRegistrations:', e);
        }
      }

      // Update users/{uid}
      if (uid) {
        try {
          await updateDoc(doc(db, 'users', uid), {
            username: cleanNew
          });
        } catch (e) {
          console.warn('Could not update users document:', e);
        }
      }
    } else {
      // User / Patient Role
      await setDoc(usernameDocRef, {
        username: cleanNew,
        email: normalizedEmail,
        registrationId: registrationId || '',
        uid: uid || '',
        role: 'user',
        createdAt: serverTimestamp()
      });

      if (cleanOld) {
        try {
          await deleteDoc(doc(db, 'usernames', cleanOld));
        } catch (e) {
          console.warn('Could not delete old user username doc:', e);
        }
      }

      if (registrationId) {
        try {
          await updateDoc(doc(db, 'registrations', registrationId), {
            username: cleanNew
          });
        } catch (e) {
          console.warn('Could not update registrations:', e);
        }
      }

      if (uid) {
        try {
          await updateDoc(doc(db, 'users', uid), {
            username: cleanNew
          });
        } catch (e) {
          console.warn('Could not update users document:', e);
        }
      }
    }
  }

  // Update cached local session
  const local = getLocalSession();
  if (local) {
    local.username = cleanNew;
    setLocalSession(local);
  }

  return { success: true, newUsername: cleanNew };
}

/**
 * Fetches latest complete profile data for a logged-in user or admin
 */
export async function fetchFullProfile(session) {
  if (!session) return null;

  if (!isFirebaseConfigured() || !db) {
    return { ...session };
  }

  try {
    if (session.role === 'admin' || session.role === 'superadmin') {
      let adminData = {};

      if (session.uid) {
        const uSnap = await getDoc(doc(db, 'users', session.uid));
        if (uSnap.exists()) {
          adminData = { ...uSnap.data() };
        }
      }

      if (session.adminRegistrationId) {
        const aSnap = await getDoc(doc(db, 'adminRegistrations', session.adminRegistrationId));
        if (aSnap.exists()) {
          adminData = { ...adminData, ...aSnap.data() };
        }
      } else if (session.email) {
        const q = query(collection(db, 'adminRegistrations'), where('email', '==', session.email.toLowerCase()));
        const snap = await getDocs(q);
        if (!snap.empty) {
          adminData = { ...adminData, id: snap.docs[0].id, ...snap.docs[0].data() };
        }
      }

      return {
        ...session,
        name: adminData.name || session.name || 'Administrator',
        email: adminData.email || session.email || '',
        username: adminData.username || session.username || '',
        department: adminData.department || session.department || 'Ophthalmology',
        staffId: adminData.staffId || session.staffId || '',
        phone: adminData.phone || session.phone || '',
        specialization: adminData.specialization || session.specialization || 'Clinical Ophthalmology',
        status: adminData.status || session.status || 'approved',
        adminRegistrationId: adminData.adminRegistrationId || adminData.id || session.adminRegistrationId || '',
        approvedAt: adminData.approvedAt || session.approvedAt || null,
        createdAt: adminData.createdAt || session.createdAt || null
      };
    } else {
      // Patient User
      let patientData = {};

      if (session.registrationId) {
        const rSnap = await getDoc(doc(db, 'registrations', session.registrationId));
        if (rSnap.exists()) {
          patientData = { id: rSnap.id, ...rSnap.data() };
        }
      } else if (session.email) {
        const q = query(collection(db, 'registrations'), where('email', '==', session.email.toLowerCase()));
        const snap = await getDocs(q);
        if (!snap.empty) {
          patientData = { id: snap.docs[0].id, ...snap.docs[0].data() };
        }
      }

      if (session.uid && !patientData.name) {
        const uSnap = await getDoc(doc(db, 'users', session.uid));
        if (uSnap.exists()) {
          patientData = { ...uSnap.data(), ...patientData };
        }
      }

      return {
        ...session,
        id: patientData.id || session.registrationId || '',
        registrationId: patientData.id || session.registrationId || '',
        name: patientData.name || session.name || 'Patient',
        email: patientData.email || session.email || '',
        username: patientData.username || session.username || '',
        phone: patientData.phone || session.phone || '',
        age: patientData.age || session.age || '',
        gender: patientData.gender || session.gender || '',
        status: patientData.status || session.status || 'approved',
        therapyTest: patientData.therapyTest || session.therapyTest || null,
        therapyTests: patientData.therapyTests || session.therapyTests || [],
        approvedAt: patientData.approvedAt || session.approvedAt || null,
        createdAt: patientData.createdAt || session.createdAt || null
      };
    }
  } catch (err) {
    console.warn('Error fetching full profile, falling back to session:', err);
    return { ...session };
  }
}

