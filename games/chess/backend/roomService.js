// games/chess/backend/roomService.js
// Firestore path: games/chess/rooms/{roomId}
// The board itself is stored as FEN — tiny, canonical, and trivially
// re-hydrated by chess.js on any client (host, guest, or spectator).
import {
  doc, setDoc, getDoc, updateDoc, onSnapshot, serverTimestamp, arrayUnion, collection
} from "firebase/firestore";
import { db } from "../../../src/lib/firebase";
import { createInitialGameState, attemptMove } from "./logic";

const roomsCol = () => collection(db, "games", "chess", "rooms");

export async function createRoom({ hostUid, hostName }) {
  const roomRef = doc(roomsCol());
  await setDoc(roomRef, {
    status: "waiting",
    createdAt: serverTimestamp(),
    players: {
      white: { uid: hostUid, name: hostName },
      black: null
    },
    spectators: [],
    game: createInitialGameState()
  });
  return roomRef.id;
}

export async function joinRoomAsPlayer(roomId, { uid, name }) {
  const roomRef = doc(roomsCol(), roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) throw new Error("Room not found");
  const data = snap.data();
  if (data.players.black && data.players.black.uid !== uid) {
    throw new Error("Room already full");
  }
  await updateDoc(roomRef, { "players.black": { uid, name }, status: "active" });
}

export async function joinRoomAsSpectator(roomId, { uid, name }) {
  const roomRef = doc(roomsCol(), roomId);
  await updateDoc(roomRef, { spectators: arrayUnion({ uid, name, joinedAt: Date.now() }) });
}

export function subscribeToRoom(roomId, callback) {
  const roomRef = doc(roomsCol(), roomId);
  return onSnapshot(roomRef, (snap) => {
    if (!snap.exists()) return callback(null);
    callback({ id: snap.id, ...snap.data() });
  });
}

export async function commitMove(roomId, { fen, from, to, promotion }) {
  const result = attemptMove(fen, { from, to, promotion });
  if (result.invalid) return result;

  const roomRef = doc(roomsCol(), roomId);
  await updateDoc(roomRef, {
    game: result.state,
    status: result.state.isGameOver ? "finished" : "active"
  });
  return result;
}

export async function rematch(roomId) {
  const roomRef = doc(roomsCol(), roomId);
  await updateDoc(roomRef, { game: createInitialGameState(), status: "active" });
}
