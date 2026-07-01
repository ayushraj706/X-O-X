// games/ludo/backend/roomService.js
// Firestore path: games/ludo/rooms/{roomId}
// Supports 2-4 players; any uid beyond the configured active colors joins as spectator.
import {
  doc, setDoc, getDoc, updateDoc, onSnapshot, serverTimestamp, arrayUnion, collection
} from "firebase/firestore";
import { db } from "../../../src/lib/firebase";
import { createInitialGameState, rollDice, moveToken, passTurn, getMovableTokens } from "./logic";

const roomsCol = () => collection(db, "games", "ludo", "rooms");

export async function createRoom({ hostUid, hostName, maxPlayers = 4 }) {
  const roomRef = doc(roomsCol());
  const allColors = ["red", "green", "yellow", "blue"];
  const activeColors = allColors.slice(0, maxPlayers);

  const players = {};
  activeColors.forEach((c, i) => {
    players[c] = i === 0 ? { uid: hostUid, name: hostName } : null;
  });

  await setDoc(roomRef, {
    status: "waiting",
    createdAt: serverTimestamp(),
    maxPlayers,
    players,
    spectators: [],
    game: createInitialGameState(activeColors)
  });
  return roomRef.id;
}

export async function joinRoomAsPlayer(roomId, { uid, name }) {
  const roomRef = doc(roomsCol(), roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) throw new Error("Room not found");
  const data = snap.data();
  const openColor = Object.keys(data.players).find((c) => !data.players[c]);
  if (!openColor) throw new Error("Room already full");

  await updateDoc(roomRef, {
    [`players.${openColor}`]: { uid, name },
    status: Object.values({ ...data.players, [openColor]: { uid, name } }).filter(Boolean).length >= 2 ? "active" : "waiting"
  });
  return openColor;
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

export async function commitRoll(roomId, currentState) {
  const next = rollDice(currentState);
  if (next.invalid) return { invalid: true };

  // auto-pass if no legal moves with this roll
  const color = next.activeColors[next.turnIndex];
  const movable = getMovableTokens(next, color);
  const finalState = movable.length === 0 ? passTurn(next) : next;

  const roomRef = doc(roomsCol(), roomId);
  await updateDoc(roomRef, { game: finalState });
  return { invalid: false, state: finalState, autoPassed: movable.length === 0 };
}

export async function commitMove(roomId, currentState, color, tokenId) {
  const next = moveToken(currentState, color, tokenId);
  if (next.invalid) return { invalid: true };

  const roomRef = doc(roomsCol(), roomId);
  await updateDoc(roomRef, {
    game: next,
    status: next.status === "finished" ? "finished" : "active"
  });
  return { invalid: false, state: next };
}

export async function rematch(roomId, activeColors) {
  const roomRef = doc(roomsCol(), roomId);
  await updateDoc(roomRef, { game: createInitialGameState(activeColors), status: "active" });
}
