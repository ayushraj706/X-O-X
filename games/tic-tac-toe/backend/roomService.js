// games/tic-tac-toe/backend/roomService.js
// All Firestore interactions for Tic-Tac-Toe rooms live here, isolated from UI.

import {
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../../../src/lib/firebase/config';
import { EMPTY_BOARD, getGameStatus, isValidMove, applyMove, nextTurn } from './gameLogic';

const GAME_ID = 'tic-tac-toe';

function roomRef(roomCode) {
  return doc(db, 'games', GAME_ID, 'rooms', roomCode);
}

/** Generates a short, human-shareable room code, e.g. "TTT-7G2K" */
export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `TTT-${code}`;
}

/**
 * Creates a new room. The creator becomes Player "X".
 */
export async function createRoom({ roomCode, uid, name, photoURL }) {
  const ref = roomRef(roomCode);
  await setDoc(ref, {
    roomCode,
    status: 'active',
    board: EMPTY_BOARD,
    turn: 'X',
    winner: null,
    winLine: null,
    players: {
      X: { uid, name, photoURL },
      O: null,
    },
    spectators: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return roomCode;
}

/**
 * Joins an existing room. Auto-assigns "O" if free, otherwise joins as Spectator.
 * `desiredRole` is a hint ('player' | 'spectator') — if 'player' is requested
 * but both slots are full, falls back to spectator.
 */
export async function joinRoom({ roomCode, uid, name, photoURL, desiredRole }, currentRoomData) {
  const ref = roomRef(roomCode);

  if (!currentRoomData) throw new Error('ROOM_NOT_FOUND');

  const { players } = currentRoomData;
  const alreadyX = players?.X?.uid === uid;
  const alreadyO = players?.O?.uid === uid;

  if (alreadyX || alreadyO) {
    return { role: 'player', symbol: alreadyX ? 'X' : 'O' };
  }

  if (desiredRole === 'player' && !players?.O) {
    await updateDoc(ref, {
      'players.O': { uid, name, photoURL },
      updatedAt: serverTimestamp(),
    });
    return { role: 'player', symbol: 'O' };
  }

  // Join as spectator
  await updateDoc(ref, {
    spectators: arrayUnion({ uid, name, photoURL }),
    updatedAt: serverTimestamp(),
  });
  return { role: 'spectator', symbol: null };
}

export function watchRoom(roomCode, callback) {
  return onSnapshot(roomRef(roomCode), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}

/** Makes a move with full server-side-style validation (run on client, Firestore rules double-enforce) */
export async function makeMove({ roomCode, index, symbol, currentRoomData }) {
  const { board, turn } = currentRoomData;
  if (!isValidMove(board, index, turn, symbol)) {
    throw new Error('INVALID_MOVE');
  }
  const newBoard = applyMove(board, index, symbol);
  const status = getGameStatus(newBoard);

  await updateDoc(roomRef(roomCode), {
    board: newBoard,
    turn: status.winner ? turn : nextTurn(turn),
    winner: status.winner,
    winLine: status.line,
    updatedAt: serverTimestamp(),
  });
}

export async function resetBoard(roomCode) {
  await updateDoc(roomRef(roomCode), {
    board: EMPTY_BOARD,
    turn: 'X',
    winner: null,
    winLine: null,
    updatedAt: serverTimestamp(),
  });
}

/** Leaving: remove player slot or spectator entry; delete room if empty */
export async function leaveRoom({ roomCode, uid, currentRoomData }) {
  if (!currentRoomData) return;
  const ref = roomRef(roomCode);
  const { players, spectators } = currentRoomData;

  const updates = { updatedAt: serverTimestamp() };
  let stillOccupied = false;

  if (players?.X?.uid === uid) {
    updates['players.X'] = null;
  } else if (players?.O?.uid === uid) {
    updates['players.O'] = null;
  } else {
    updates.spectators = (spectators || []).filter((s) => s.uid !== uid);
  }

  stillOccupied =
    (players?.X?.uid !== uid && players?.X) ||
    (players?.O?.uid !== uid && players?.O) ||
    (spectators || []).some((s) => s.uid !== uid);

  if (!stillOccupied) {
    await deleteDoc(ref);
  } else {
    await updateDoc(ref, updates);
  }
}
