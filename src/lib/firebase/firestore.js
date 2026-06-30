// src/lib/firebase/firestore.js
// Generic Firestore helpers shared across home page + all games.

import {
  collection,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
} from 'firebase/firestore';
import { db } from './config';

/** Create or join a generic "room" document used by any game. */
export async function upsertRoom(gameId, roomCode, data) {
  const roomRef = doc(db, 'games', gameId, 'rooms', roomCode);
  await setDoc(
    roomRef,
    {
      ...data,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return roomRef;
}

export async function getRoom(gameId, roomCode) {
  const roomRef = doc(db, 'games', gameId, 'rooms', roomCode);
  const snap = await getDoc(roomRef);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export function watchRoom(gameId, roomCode, callback) {
  const roomRef = doc(db, 'games', gameId, 'rooms', roomCode);
  return onSnapshot(roomRef, (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

export async function deleteRoom(gameId, roomCode) {
  await deleteDoc(doc(db, 'games', gameId, 'rooms', roomCode));
}

export function watchActiveRoomsCount(gameId, callback) {
  const roomsRef = collection(db, 'games', gameId, 'rooms');
  const q = query(roomsRef, where('status', '==', 'active'));
  return onSnapshot(q, (snap) => callback(snap.size));
}
