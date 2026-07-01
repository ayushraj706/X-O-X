// games/carrom/ui/CarromGame.js — Firestore-synced online multiplayer + spectators
import { useEffect, useState } from "react";
import Board from "./Board";
import VoiceControls from "../../../src/components/voice/VoiceControls";
import { useAuth } from "../../../src/context/AuthContext";
import {
  subscribeToRoom, joinRoomAsPlayer, joinRoomAsSpectator, commitShot, rematch
} from "../backend/roomService";
import { playSound } from "../../../src/lib/sound";
import { SOUNDS } from "./sounds";

export default function CarromGame({ roomId }) {
  const { user, loginWithGoogle } = useAuth();
  const [room, setRoom] = useState(null);
  const [role, setRole] = useState(null); // "player1" | "player2" | "spectator"
  const [animFrame, setAnimFrame] = useState(null);
  const [prevMoveCount, setPrevMoveCount] = useState(0);

  useEffect(() => {
    if (!roomId) return;
    return subscribeToRoom(roomId, setRoom);
  }, [roomId]);

  useEffect(() => {
    if (!room || !user) return;
    if (room.players.player1?.uid === user.uid) setRole("player1");
    else if (room.players.player2?.uid === user.uid) setRole("player2");
    else setRole("spectator");
  }, [room, user]);

  useEffect(() => {
    if (!user || !roomId || !room) return;
    const alreadyIn =
      room.players.player1?.uid === user.uid ||
      room.players.player2?.uid === user.uid ||
      room.spectators?.some((s) => s.uid === user.uid);
    if (alreadyIn) return;
    if (!room.players.player2) {
      joinRoomAsPlayer(roomId, { uid: user.uid, name: user.displayName || "Player 2" });
    } else {
      joinRoomAsSpectator(roomId, { uid: user.uid, name: user.displayName || "Spectator" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, roomId, room?.id]);

  // Every client (shooter, opponent, spectators) replays the deterministic
  // shot animation locally the moment Firestore delivers the new state.
  useEffect(() => {
    if (!room?.game?.lastShot) return;
    if (room.game.moveCount === prevMoveCount) return;
    setPrevMoveCount(room.game.moveCount);

    playSound(SOUNDS.strike);
    const frames = room.game.lastShot.frames || [];
    let i = 0;
    const tick = () => {
      if (i >= frames.length) {
        setAnimFrame(null);
        if (room.game.foul) playSound(SOUNDS.foul);
        else if (room.game.pocketedThisShot?.length) playSound(SOUNDS.pocket);
        if (room.game.status === "finished") setTimeout(() => playSound(SOUNDS.win), 200);
        return;
      }
      setAnimFrame(frames[i]);
      i++;
      requestAnimationFrame(() => setTimeout(tick, 16));
    };
    tick();
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
  if (!room) return <p className="text-center text-gray-400">Loading room...</p>;

  const isSpectator = role === "spectator";
  const isMyTurn = room.game?.turn === role;

  async function handleShoot({ angle, power }) {
    if (isSpectator || !isMyTurn) return;
    if (room.game.status !== "playing") return;
    await commitShot(roomId, { state: room.game, angle, power, shooter: role });
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center justify-between w-80 text-xs text-gray-400">
        <span>Room: <span className="font-mono text-whatsapp-teal">{roomId}</span></span>
        <span>👀 {room.spectators?.length || 0} watching</span>
      </div>

      <div className="flex justify-between w-80 text-sm">
        <PlayerTag label="Player 1" info={room.players.player1} score={room.game?.scores.player1} active={room.game?.turn === "player1"} />
        <PlayerTag label="Player 2" info={room.players.player2} score={room.game?.scores.player2} active={room.game?.turn === "player2"} />
      </div>

      {isSpectator && (
        <span className="text-xs px-3 py-1 rounded-full bg-amber-500/20 text-amber-400">
          👁️ Spectator mode — you're watching live
        </span>
      )}
      {room.game?.foul && <p className="text-red-400 text-sm">⚠️ Foul on last shot!</p>}

      <Board
        coins={room.game?.coins || []}
        striker={room.game?.striker}
        disabled={isSpectator || !isMyTurn || room.game?.status !== "playing" || !!animFrame}
        onShoot={handleShoot}
        animFrame={animFrame}
      />

      {room.game?.status === "finished" && (
        <>
          <p className="font-semibold text-whatsapp-teal">
            🏆 {room.game.scores.player1 > room.game.scores.player2 ? "Player 1" : "Player 2"} wins!
          </p>
          {!isSpectator && (
            <button onClick={() => rematch(roomId)} className="px-4 py-2 rounded-full bg-whatsapp-teal">Rematch</button>
          )}
        </>
      )}

      <VoiceControls roomId={roomId} uid={user.uid} />
    </div>
  );
}

function PlayerTag({ label, info, score, active }) {
  return (
    <div className={`px-3 py-1 rounded-lg ${active ? "bg-whatsapp-teal/30" : "bg-white/5"}`}>
      <span className="font-bold">{label}</span> — {info?.name || "waiting..."} ({score ?? 0})
    </div>
  );
}
