import {
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
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

/**
 * Submits a new hospital staff / ophthalmologist admin registration application.
 * Status defaults to 'pending' until Super Admin reviews and approves it.
 */
export async function submitAdminRegistration(formData) {
  const normalizedEmail = formData.email.trim().toLowerCase();

  if (!isFirebaseConfigured() || !db) {
    throw new Error('Firebase Firestore is not configured. Please check your .env settings.');
  }

  // Check for duplicate in adminRegistrations
  try {
    const adminRegRef = collection(db, 'adminRegistrations');
    const q = query(adminRegRef, where('email', '==', normalizedEmail));
    const snap = await getDocs(q);
    const existingActive = snap.docs.find(d => d.data().status === 'pending' || d.data().status === 'approved');
    if (existingActive) {
      throw new Error('An ophthalmologist application with this email address already exists.');
    }
  } catch (err) {
    if (err.message.includes('already exists')) {
      throw err;
    }
  }

  try {
    const adminRegRef = collection(db, 'adminRegistrations');
    const newDoc = {
      name: formData.name.trim(),
      email: normalizedEmail,
      phone: (formData.phone || '').trim(),
      department: (formData.department || 'Ophthalmology').trim(),
      staffId: (formData.staffId || '').trim(),
      specialization: (formData.specialization || '').trim(),
      note: (formData.note || '').trim(),
      status: 'pending',
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(adminRegRef, newDoc);
    return {
      success: true,
      id: docRef.id,
      ...newDoc
    };
  } catch (err) {
    console.error('Error submitting ophthalmologist registration:', err);
    throw new Error(`Failed to submit ophthalmologist application: ${err.message}`);
  }
}

/**
 * Fetches all administrator registration applications for Super Admin review.
 */
export async function getAllAdminRegistrations() {
  if (!isFirebaseConfigured() || !db) {
    return [];
  }

  try {
    const adminRegRef = collection(db, 'adminRegistrations');
    let q;
    try {
      q = query(adminRegRef, orderBy('createdAt', 'desc'));
    } catch {
      q = adminRegRef;
    }

    const querySnapshot = await getDocs(q);
    const list = [];
    querySnapshot.forEach(docSnap => {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
        approvedAt: data.approvedAt?.toDate ? data.approvedAt.toDate().toISOString() : data.approvedAt,
        rejectedAt: data.rejectedAt?.toDate ? data.rejectedAt.toDate().toISOString() : data.rejectedAt,
        revokedAt: data.revokedAt?.toDate ? data.revokedAt.toDate().toISOString() : data.revokedAt
      });
    });

    // In-memory sort fallback
    list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return list;
  } catch (err) {
    console.error('Error fetching admin registrations:', err);
    throw new Error('Failed to retrieve administrator applications.');
  }
}

/**
 * Approves an administrator registration:
 * 1. Uses admin's email as their username (default)
 * 2. Generates secure temporary password
 * 3. Creates Firebase Auth user account without disrupting current Super Admin session
 * 4. Stores admin profile in users/{uid} with role: 'admin' and status: 'approved'
 * 5. Stores username in usernames/{username} for username-based login
 * 6. Updates adminRegistrations/{id} with status: 'approved'
 * 7. Returns generated credentials to show to Super Admin once
 */
export async function approveAdminRegistration(adminRegId, adminData) {
  // Use admin's email as their default username
  const adminUsername = adminData.email.trim().toLowerCase();
  const temporaryPassword = generateSecurePassword(11);
  const normalizedEmail = adminData.email.trim().toLowerCase();

  if (!isFirebaseConfigured() || !db || !auth) {
    throw new Error('Firebase is not configured.');
  }

  let secondaryApp = null;
  try {
    // 1. Create admin in Firebase Auth using a secondary app instance
    const appName = `sec_admin_auth_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    secondaryApp = initSecondaryApp(firebaseConfig, appName);
    const secondaryAuth = getSecondaryAuth(secondaryApp);

    let adminUid = null;
    try {
      const userCred = await createUserWithEmailAndPassword(
        secondaryAuth,
        normalizedEmail,
        temporaryPassword
      );
      adminUid = userCred.user.uid;
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

    // 2. Update adminRegistrations document in Firestore
    const adminRegDocRef = doc(db, 'adminRegistrations', adminRegId);
    await updateDoc(adminRegDocRef, {
      status: 'approved',
      username: adminUsername,
      uid: adminUid || '',
      approvedAt: serverTimestamp()
    });

    // 3. Store admin username mapping in `usernames/{uppercasedEmail}`
    const usernameKey = adminUsername.toUpperCase();
    await setDoc(doc(db, 'usernames', usernameKey), {
      username: adminUsername,
      email: normalizedEmail,
      adminRegistrationId: adminRegId,
      uid: adminUid || '',
      role: 'admin',
      createdAt: serverTimestamp()
    });

    // 4. Store admin user profile in `users/{uid}`
    if (adminUid) {
      await setDoc(doc(db, 'users', adminUid), {
        uid: adminUid,
        name: adminData.name,
        email: normalizedEmail,
        phone: adminData.phone || '',
        department: adminData.department || 'Ophthalmology',
        staffId: adminData.staffId || '',
        username: adminUsername,
        role: 'admin',
        status: 'approved',
        adminRegistrationId: adminRegId,
        createdAt: serverTimestamp(),
        approvedAt: serverTimestamp()
      });
    }

    return {
      success: true,
      username: adminUsername,
      temporaryPassword,
      applicantName: adminData.name,
      email: normalizedEmail
    };
  } catch (err) {
    if (secondaryApp) {
      try { await deleteApp(secondaryApp); } catch (_) {}
    }
    console.error('Error approving admin registration:', err);
    throw new Error(`Failed to approve administrator: ${err.message}`);
  }
}

/**
 * Rejects a pending administrator registration
 */
export async function rejectAdminRegistration(adminRegId) {
  if (!isFirebaseConfigured() || !db) {
    throw new Error('Firebase is not configured.');
  }

  try {
    const adminRegDocRef = doc(db, 'adminRegistrations', adminRegId);
    await updateDoc(adminRegDocRef, {
      status: 'rejected',
      rejectedAt: serverTimestamp()
    });
    return { success: true };
  } catch (err) {
    console.error('Error rejecting admin registration:', err);
    throw new Error(`Failed to reject administrator application: ${err.message}`);
  }
}

/**
 * Super Admin removes an administrator:
 * - Revokes access in users/{uid}
 * - Updates adminRegistrations to 'revoked'
 * - Deletes username mapping in usernames/{username}
 */
export async function removeAdmin({ adminRegId, uid, username }) {
  if (!isFirebaseConfigured() || !db) {
    throw new Error('Firebase is not configured.');
  }

  try {
    // 1. Mark user profile as revoked in users/{uid}
    if (uid) {
      const userDocRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        await updateDoc(userDocRef, {
          role: 'revoked',
          status: 'revoked',
          revokedAt: serverTimestamp()
        });
      }
    }

    // 2. Mark application as revoked in adminRegistrations
    if (adminRegId) {
      const regDocRef = doc(db, 'adminRegistrations', adminRegId);
      const regSnap = await getDoc(regDocRef);
      if (regSnap.exists()) {
        await updateDoc(regDocRef, {
          status: 'revoked',
          revokedAt: serverTimestamp()
        });
      }
    }

    // 3. Remove username entry so login with this username is blocked
    if (username) {
      try {
        await deleteDoc(doc(db, 'usernames', username.toUpperCase()));
      } catch (e) {
        console.warn('Could not remove username document:', e);
      }
    }

    return { success: true };
  } catch (err) {
    console.error('Error removing admin:', err);
    throw new Error(`Failed to remove administrator: ${err.message}`);
  }
}

/**
 * Fetches all active approved administrators from Firestore users collection
 */
export async function getActiveAdminsList() {
  if (!isFirebaseConfigured() || !db) {
    return [];
  }

  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('role', '==', 'admin'));
    const snap = await getDocs(q);
    const admins = [];
    snap.forEach(d => {
      const data = d.data();
      if (data.status !== 'revoked' && data.status !== 'removed') {
        admins.push({
          id: d.id,
          uid: d.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
          approvedAt: data.approvedAt?.toDate ? data.approvedAt.toDate().toISOString() : data.approvedAt
        });
      }
    });
    return admins;
  } catch (err) {
    console.error('Error fetching active admins:', err);
    return [];
  }
}
