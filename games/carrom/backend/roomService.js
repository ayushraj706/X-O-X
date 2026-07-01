// games/carrom/backend/roomService.js
// Firestore path: games/carrom/rooms/{roomId}
// Only compact shot params + resulting authoritative state are synced.
// Every client (including spectators) deterministically replays the same
// simulateShot() locally for smooth animation using games/carrom/backend/logic.js.
import {
  doc, setDoc, getDoc, updateDoc, onSnapshot, serverTimestamp, arrayUnion, collection
} from "firebase/firestore";
import { db } from "../../../src/lib/firebase";
import { createInitialGameState, applyShot } from "./logic";

const roomsCol = () => collection(db, "games", "carrom", "rooms");

export async function createRoom({ hostUid, hostName }) {
  const roomRef = doc(roomsCol());
  await setDoc(roomRef, {
    status: "waiting",
    createdAt: serverTimestamp(),
    players: { player1: { uid: hostUid, name: hostName }, player2: null },
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
  if (data.players.player2 && data.players.player2.uid !== uid) throw new Error("Room already full");
  await updateDoc(roomRef, { "players.player2": { uid, name }, status: "active" });
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

export async function commitShot(roomId, { state, angle, power, shooter }) {
  const nextState = applyShot(state, { angle, power, shooter });
  const roomRef = doc(roomsCol(), roomId);
  await updateDoc(roomRef, {
    game: nextState,
    status: nextState.status === "playing" ? "active" : "finished"
  });
  return nextState;
}

export async function rematch(roomId) {
  const roomRef = doc(roomsCol(), roomId);
  await updateDoc(roomRef, { game: createInitialGameState(), status: "active" });
}
