// src/lib/firebase/auth.js
// Handles Google Sign-In, Firestore profile sync, and multi-device session tracking.
//
// "Logout All Devices" strategy:
// Each user doc (users/{uid}) has a `sessionVersion` number.
// On every login we store the CURRENT sessionVersion in localStorage on that device.
// We open a realtime onSnapshot listener on the user doc on every device.
// "Logout All Devices" bumps sessionVersion in Firestore (+1).
// Every listening device sees the new sessionVersion != local stored value -> force signOut.

import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { auth, db, googleProvider } from './config';

const LOCAL_SESSION_KEY = 'gp_session_version';
const LOCAL_DEVICE_ID_KEY = 'gp_device_id';

function getOrCreateDeviceId() {
  if (typeof window === 'undefined') return 'server';
  let id = localStorage.getItem(LOCAL_DEVICE_ID_KEY);
  if (!id) {
    id = `dev_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    localStorage.setItem(LOCAL_DEVICE_ID_KEY, id);
  }
  return id;
}

/**
 * Continue with Google — extracts ALL available profile fields and
 * upserts them into Firestore `users/{uid}`.
 */
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const deviceId = getOrCreateDeviceId();

    const userRef = doc(db, 'users', user.uid);
    const existingSnap = await getDoc(userRef);
    const existingData = existingSnap.exists() ? existingSnap.data() : null;

    const profileData = {
      uid: user.uid,
      name: user.displayName || '',
      email: user.email || '',
      photoURL: user.photoURL || '',
      emailVerified: user.emailVerified,
      phoneNumber: user.phoneNumber || null,
      providerId: user.providerData?.[0]?.providerId || 'google.com',
      lastLoginAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (!existingData) {
      profileData.createdAt = serverTimestamp();
      profileData.sessionVersion = 0;
    }

    await setDoc(userRef, profileData, { merge: true });

    // Track this device under an "activeSessions" subcollection (for display / admin tools)
    await setDoc(
      doc(db, 'users', user.uid, 'sessions', deviceId),
      {
        deviceId,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        loginAt: serverTimestamp(),
        active: true,
      },
      { merge: true }
    );

    const finalSnap = await getDoc(userRef);
    const finalData = finalSnap.data();
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_SESSION_KEY, String(finalData.sessionVersion ?? 0));
    }

    return { uid: user.uid, ...finalData };

  } catch (error) {
    // YAHA ERROR PAKAD ME AAYEGA AUR SCREEN PAR DIKHEGA
    console.error("🔥 FIREBASE ERROR DETAILS:", error.code, error.message);
    alert(`Asli Error: ${error.message}\nError Code: ${error.code}`);
    throw error;
  }
}

/** Logout current device only */
export async function logoutCurrentDevice() {
  const deviceId = getOrCreateDeviceId();
  const user = auth.currentUser;
  if (user) {
    try {
      await updateDoc(doc(db, 'users', user.uid, 'sessions', deviceId), {
        active: false,
        loggedOutAt: serverTimestamp(),
      });
    } catch (e) {
      // session doc might not exist yet — non-fatal
    }
  }
  await signOut(auth);
  if (typeof window !== 'undefined') {
    localStorage.removeItem(LOCAL_SESSION_KEY);
  }
}

/** Logout ALL devices — bumps sessionVersion, every device's listener force-signs-out */
export async function logoutAllDevices(uid) {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    sessionVersion: increment(1),
    loggedOutAllAt: serverTimestamp(),
  });
  // This device will also be force-logged-out by the listener below, but
  // we sign out explicitly too for immediate feedback.
  await signOut(auth);
  if (typeof window !== 'undefined') {
    localStorage.removeItem(LOCAL_SESSION_KEY);
  }
}

/**
 * Subscribes to the user's Firestore doc. If sessionVersion on the server
 * differs from what THIS device stored at login time, force sign-out.
 * Call this once in AuthContext after a user logs in.
 */
export function watchSessionValidity(uid, onForceLogout) {
  const userRef = doc(db, 'users', uid);
  return onSnapshot(userRef, (snap) => {
    if (!snap.exists()) return;
    const serverVersion = snap.data().sessionVersion ?? 0;
    const localVersion = Number(localStorage.getItem(LOCAL_SESSION_KEY) ?? 0);
    if (serverVersion > localVersion) {
      signOut(auth).finally(() => {
        localStorage.removeItem(LOCAL_SESSION_KEY);
        onForceLogout?.();
      });
    }
  });
}

export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

export { getOrCreateDeviceId };
