// src/lib/firebase/admin.js
// Server-side Firebase Admin SDK (used inside pages/api/* only — NEVER import in client components)

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function formatPrivateKey(key) {
  return key ? key.replace(/\\n/g, '\n') : key;
}

const adminConfig = {
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: formatPrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY),
  }),
};

const adminApp = getApps().length ? getApps()[0] : initializeApp(adminConfig);

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);

/**
 * Verifies a Firebase ID token sent from the client and also checks
 * our own Firestore "sessions" collection so that "Logout All Devices"
 * can be enforced even though Firebase ID tokens themselves stay valid
 * for up to 1 hour.
 */
export async function verifySessionToken(idToken) {
  const decoded = await adminAuth.verifyIdToken(idToken, true);
  const userDoc = await adminDb.collection('users').doc(decoded.uid).get();

  if (!userDoc.exists) {
    throw new Error('User not found');
  }

  const userData = userDoc.data();
  const sessionVersionInToken = decoded.sessionVersion ?? 0;
  const currentSessionVersion = userData.sessionVersion ?? 0;

  // If admin incremented sessionVersion (Logout All Devices), reject older tokens
  if (sessionVersionInToken < currentSessionVersion) {
    throw new Error('SESSION_REVOKED');
  }

  return { uid: decoded.uid, ...userData };
}
