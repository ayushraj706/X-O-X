// games/chess/ui/ChessGame.js
import { useEffect, useState } from "react";
import { Chess } from "chess.js";
import { useRouter } from "next/router";
import Board from "./Board";
import VoiceControls from "../../../src/components/voice/VoiceControls";
import { useAuth } from "../../../src/context/AuthContext";
import { subscribeToRoom, joinRoomAsPlayer, joinRoomAsSpectator, commitMove, rematch } from "../backend/roomService";
import { playSound } from "../../../src/lib/sound";
import { SOUNDS } from "./sounds";

export default function ChessGame({ roomId }) {
  const { user, loginWithGoogle } = useAuth();
  const router = useRouter();
  const [room, setRoom] = useState(null);
  const [role, setRole] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [prevHistLen, setPrevHistLen] = useState(0);

  useEffect(() => {
    if (!roomId) return;
    return subscribeToRoom(roomId, setRoom);
  }, [roomId]);

  useEffect(() => {
    if (!room || !user) return;
    if (room.players.white?.uid === user.uid) setRole("white");
    else if (room.players.black?.uid === user.uid) setRole("black");
    else setRole("spectator");
  }, [room, user]);

  useEffect(() => {
    if (!user || !roomId || !room) return;
    const alreadyIn = room.players.white?.uid === user.uid || room.players.black?.uid === user.uid || room.spectators?.some((s) => s.uid === user.uid);
    if (alreadyIn) return;

    if (!room.players.black) {
      joinRoomAsPlayer(roomId, { uid: user.uid, name: user.displayName || "Player", photoURL: user.photoURL });
    } else {
      joinRoomAsSpectator(roomId, { uid: user.uid, name: user.displayName || "Spectator", photoURL: user.photoURL });
    }
  }, [user, roomId, room?.id]);

  if (!user) return <div className="text-center p-8"><button onClick={loginWithGoogle} className="px-6 py-3 rounded-2xl bg-whatsapp-teal font-bold shadow-lg">Sign in with Google</button></div>;
  if (!room) return <p className="text-center text-gray-400 p-8">Loading...</p>;

  const isSpectator = role === "spectator";
  const myColorCode = role === "white" ? "w" : role === "black" ? "b" : null;
  const isMyTurn = room.game && ((room.game.turn === "white" && myColorCode === "w") || (room.game.turn === "black" && myColorCode === "b"));

  function handleSelectSquare(square) {
    if (isSpectator || !isMyTurn) return;
    const chess = new Chess(room.game.fen);
    setLegalMoves(chess.moves({ square, verbose: true }).map((m) => m.to));
  }

  async function handleMove(from, to) {
    if (isSpectator || !isMyTurn) return;
    const result = await commitMove(roomId, { fen: room.game.fen, from, to, promotion: "q" });
    setLegalMoves([]);
    if (result.invalid) playSound(SOUNDS.invalid);
  }

  return (
    <div className="flex flex-col items-center gap-6 p-4">
      {/* Premium Header */}
      <div className="flex justify-between w-full max-w-[320px]">
        <button onClick={() => router.push('/games')} className="px-4 py-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-sm font-semibold transition">← Exit</button>
        <div className="text-xs text-gray-500 font-mono">ROOM: {roomId.slice(-6)}</div>
      </div>

      <div className="flex gap-2 w-full max-w-[320px]">
        <PlayerTag label="White" info={room.players.white} active={room.game?.turn === "white"} />
        <PlayerTag label="Black" info={room.players.black} active={room.game?.turn === "black"} />
      </div>

      <Board
        board={room.game?.board}
        orientation={role === "black" ? "black" : "white"}
        legalMovesForSquare={legalMoves}
        onSelectSquare={handleSelectSquare}
        onMove={handleMove}
        lastMove={lastMove}
        disabled={isSpectator || !isMyTurn || room.game?.isGameOver}
      />

      {room.game?.isGameOver && (
        <button onClick={() => rematch(roomId)} className="px-8 py-3 rounded-2xl bg-whatsapp-teal font-bold shadow-xl shadow-whatsapp-teal/20">Play Rematch</button>
      )}
      
      <VoiceControls roomId={roomId} uid={user.uid} />
    </div>
  );
}

function PlayerTag({ label, info, active }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-2xl flex-1 ${active ? "bg-whatsapp-teal/20 border border-whatsapp-teal" : "bg-white/5"}`}>
      <img src={info?.photoURL || "/avatar.png"} className="w-10 h-10 rounded-full" />
      <div className="flex flex-col">
        <span className="text-[10px] text-gray-400 uppercase">{label}</span>
        <span className="font-bold text-sm">{info?.name || "Waiting..."}</span>
      </div>
    </div>
  );
}
