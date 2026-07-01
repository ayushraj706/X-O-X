// games/ludo/ui/LudoGame.js — Firestore-synced online multiplayer (2-4) + spectators
import { useEffect, useState } from "react";
import Board from "./Board";
import VoiceControls from "../../../src/components/voice/VoiceControls";
import { useAuth } from "../../../src/context/AuthContext";
import {
  subscribeToRoom, joinRoomAsPlayer, joinRoomAsSpectator, commitRoll, commitMove, rematch
} from "../backend/roomService";
import { getMovableTokens, currentPlayer } from "../backend/logic";
import { playSound } from "../../../src/lib/sound";
import { SOUNDS, PLAYER_TONE } from "./sounds";

export default function LudoGame({ roomId }) {
  const { user, loginWithGoogle } = useAuth();
  const [room, setRoom] = useState(null);
  const [myColor, setMyColor] = useState(null); // null while resolving -> "spectator" if none
  const [prevMoveCount, setPrevMoveCount] = useState(0);

  useEffect(() => {
    if (!roomId) return;
    return subscribeToRoom(roomId, setRoom);
  }, [roomId]);

  useEffect(() => {
    if (!room || !user) return;
    const mine = Object.entries(room.players).find(([, p]) => p?.uid === user.uid);
    setMyColor(mine ? mine[0] : "spectator");
  }, [room, user]);

  useEffect(() => {
    if (!user || !roomId || !room) return;
    const alreadyIn =
      Object.values(room.players).some((p) => p?.uid === user.uid) ||
      room.spectators?.some((s) => s.uid === user.uid);
    if (alreadyIn) return;

    const hasOpenSlot = Object.values(room.players).some((p) => !p);
    if (hasOpenSlot) {
      joinRoomAsPlayer(roomId, { uid: user.uid, name: user.displayName || "Player" });
    } else {
      joinRoomAsSpectator(roomId, { uid: user.uid, name: user.displayName || "Spectator" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, roomId, room?.id]);

  useEffect(() => {
    if (!room?.game) return;
    if (room.game.moveCount === prevMoveCount) return;
    setPrevMoveCount(room.game.moveCount);
    const evt = room.game.lastEvent;
    if (!evt) return;
    if (evt.type === "move") {
      playSound(PLAYER_TONE[evt.color]);
      setTimeout(() => playSound(SOUNDS.tokenStep), 100);
    } else if (evt.type === "capture") {
      playSound(SOUNDS.capture);
    } else if (evt.type === "home") {
      playSound(SOUNDS.home);
    }
    if (room.game.status === "finished") setTimeout(() => playSound(SOUNDS.win), 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.game?.moveCount]);

  if (!user) {
    return (
      <div className="text-center">
        <p className="mb-3 text-gray-400">Sign in to join this room</p>
        <button onClick={loginWithGoogle} className="px-4 py-2 rounded-full bg-whatsapp-teal">Sign in with Google</button>
      </div>
    );
  }
  if (!room || myColor === null) return <p className="text-center text-gray-400">Loading room...</p>;

  const isSpectator = myColor === "spectator";
  const activeColor = room.game ? currentPlayer(room.game) : null;
  const isMyTurn = !isSpectator && activeColor === myColor;
  const movable = isMyTurn && room.game?.diceValue ? getMovableTokens(room.game, myColor) : [];

  async function handleRoll() {
    if (!isMyTurn || room.game.diceRolledThisTurn) return;
    playSound(SOUNDS.diceRoll);
    await commitRoll(roomId, room.game);
  }

  async function handleTokenClick(clickColor, tokenId) {
    if (!isMyTurn || clickColor !== myColor) return;
    const result = await commitMove(roomId, room.game, myColor, tokenId);
    if (result.invalid) playSound(SOUNDS.invalid);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center justify-between w-80 text-xs text-gray-400">
        <span>Room: <span className="font-mono text-whatsapp-teal">{roomId}</span></span>
        <span>👀 {room.spectators?.length || 0} watching</span>
      </div>

      <div className="flex gap-3 text-xs flex-wrap justify-center">
        {room.game?.activeColors.map((c) => (
          <span key={c} className={`px-2 py-1 rounded-full capitalize ${c === activeColor ? "bg-whatsapp-teal/40 font-bold" : "bg-white/5"}`}>
            {c}: {room.players[c]?.name || "waiting..."}
          </span>
        ))}
      </div>

      {isSpectator && (
        <span className="text-xs px-3 py-1 rounded-full bg-amber-500/20 text-amber-400">
          👁️ Spectator mode — you're watching live
        </span>
      )}

      <Board
        tokens={room.game?.tokens || {}}
        activeColors={room.game?.activeColors || []}
        movableTokenIds={movable}
        onTokenClick={handleTokenClick}
        diceValue={room.game?.diceValue}
        currentColor={activeColor}
      />

      {!isSpectator && room.game?.status === "playing" && (
        <button
          onClick={handleRoll}
          disabled={!isMyTurn || room.game?.diceRolledThisTurn}
          className="px-5 py-2 rounded-full bg-whatsapp-teal disabled:opacity-40"
        >
          🎲 Roll Dice {isMyTurn ? `(${myColor})` : ""}
        </button>
      )}

      {room.game?.status === "finished" && (
        <>
          <p className="font-semibold text-whatsapp-teal capitalize">🏆 {room.game.winner} wins!</p>
          {!isSpectator && (
            <button onClick={() => rematch(roomId, room.game.activeColors)} className="px-4 py-2 rounded-full bg-whatsapp-teal">
              Rematch
            </button>
          )}
        </>
      )}

      <VoiceControls roomId={roomId} uid={user.uid} />
    </div>
  );
}
