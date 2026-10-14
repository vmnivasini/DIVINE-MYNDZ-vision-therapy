import React, { createContext, useContext, useState, useEffect } from 'react';
import { getLocalSession, setLocalSession, loginAdmin as apiLoginAdmin, loginSuperAdmin as apiLoginSuperAdmin, loginUser as apiLoginUser, logoutUser as apiLogoutUser } from '../services/authService';
import { isFirebaseConfigured, auth, db } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => getLocalSession());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If Firebase is configured, listen to real auth changes
    if (isFirebaseConfigured() && auth) {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          try {
            // Check if user has an entry in users/{uid}
            const userSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userSnap.exists()) {
              const uData = userSnap.data();
              setCurrentUser(prev => ({
                ...prev,
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                role: uData.role,
                name: uData.name,
                username: uData.username,
                status: uData.status,
                registrationId: uData.registrationId
              }));
            }
          } catch (e) {
            console.error('Error fetching auth user profile:', e);
          }
        }
        setLoading(false);
      });

      return () => unsubscribe();
    } else {
      // Mock mode loaded from storage
      setLoading(false);
    }
  }, []);

  const loginAdmin = async (email, password) => {
    const session = await apiLoginAdmin(email, password);
    setCurrentUser(session);
    return session;
  };

  const loginSuperAdmin = async (email, password) => {
    const session = await apiLoginSuperAdmin(email, password);
    setCurrentUser(session);
    return session;
  };

  const loginUser = async (username, password) => {
    const session = await apiLoginUser(username, password);
    setCurrentUser(session);
    return session;
  };

  const updateUserSession = (partialData) => {
    setCurrentUser(prev => {
      const updated = { ...prev, ...partialData };
      setLocalSession(updated);
      return updated;
    });
  };

  const logout = async () => {
    await apiLogoutUser();
    setCurrentUser(null);
  };

  const value = {
    currentUser,
    loading,
    isSuperAdmin: currentUser?.role === 'superadmin',
    isAdmin: currentUser?.role === 'admin' || currentUser?.role === 'superadmin',
    isUser: currentUser?.role === 'user',
    loginAdmin,
    loginSuperAdmin,
    loginUser,
    logout,
    updateUserSession
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
