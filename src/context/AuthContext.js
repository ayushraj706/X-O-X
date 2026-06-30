// src/context/AuthContext.js
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import {
  signInWithGoogle,
  logoutCurrentDevice,
  logoutAllDevices,
  watchAuthState,
  watchSessionValidity,
} from '../lib/firebase/auth';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // Firebase auth user
  const [profile, setProfile] = useState(null); // Firestore profile doc
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubProfile = () => {};
    let unsubSession = () => {};

    const unsubAuth = watchAuthState((firebaseUser) => {
      unsubProfile();
      unsubSession();
      setUser(firebaseUser);

      if (firebaseUser) {
        // Live profile data
        unsubProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), (snap) => {
          setProfile(snap.exists() ? snap.data() : null);
        });

        // Force logout if another device triggers "Logout All Devices"
        unsubSession = watchSessionValidity(firebaseUser.uid, () => {
          toast.error('You were logged out from all devices.');
          setUser(null);
          setProfile(null);
        });
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      unsubAuth();
      unsubProfile();
      unsubSession();
    };
  }, []);

  const login = useCallback(async () => {
    try {
      await signInWithGoogle();
      toast.success('Welcome!');
    } catch (err) {
      console.error(err);
      toast.error('Google sign-in failed');
    }
  }, []);

  const logout = useCallback(async () => {
    await logoutCurrentDevice();
    toast.success('Logged out');
  }, []);

  const logoutAll = useCallback(async () => {
    if (!user) return;
    await logoutAllDevices(user.uid);
    toast.success('Logged out from all devices');
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout, logoutAll }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
