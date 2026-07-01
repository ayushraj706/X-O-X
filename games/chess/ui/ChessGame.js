// games/chess/ui/ChessGame.js
import { useEffect, useState } from "react";
import { Chess } from "chess.js";
import Board from "./Board";
import VoiceControls from "../../../src/components/voice/VoiceControls";
import { useAuth } from "../../../src/context/AuthContext";
import {
  subscribeToRoom, joinRoomAsPlayer, joinRoomAsSpectator, commitMove, rematch
} from "../backend/roomService";
import { playSound } from "../../../src/lib/sound";
import { SOUNDS } from "./sounds";
import { useRouter } from "next/router";

export default function ChessGame({ roomId }) {
  const { user, loginWithGoogle } = useAuth();
  const router = useRouter();
  const [room, setRoom] = useState(null);
  const [role, setRole] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [prevHistLen, setPrevHistLen] = useState(0);

  // Exit Room Handler
  const handleExit = () => router.push('/games/chess');

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
    const alreadyIn =
      room.players.white?.uid === user.uid ||
      room.players.black?.uid === user.uid ||
      room.spectators?.some((s) => s.uid === user.uid);
    if (alreadyIn) return;

    if (!room.players.black) {
      joinRoomAsPlayer(roomId, { uid: user.uid, name: user.displayName || "Player", photoURL: user.photoURL });
    } else {
      joinRoomAsSpectator(roomId, { uid: user.uid, name: user.displayName || "Spectator", photoURL: user.photoURL });
    }
  }, [user, roomId, room?.id]);

  useEffect(() => {
    if (!room?.game) return;
    const hist = room.game.history || [];
    if (hist.length === prevHistLen) return;
    setPrevHistLen(hist.length);
    const last = hist[hist.length - 1];
    if (!last) return;
    setLastMove({ from: last.from, to: last.to });

    if (room.game.isCheckmate) playSound(SOUNDS.checkmate);
    else if (room.game.isCheck) playSound(SOUNDS.check);
    else if (last.captured) playSound(SOUNDS.capture);
    else playSound(SOUNDS.move);
  }, [room?.game?.history?.length]);

  if (!user) return <div className="text-center p-10"><button onClick={loginWithGoogle} className="px-6 py-3 rounded-xl bg-wa-green text-white font-bold">Sign in with Google</button></div>;
  if (!room) return <p className="text-center text-gray-400 p-10">Loading game room...</p>;

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
    <div className="flex flex-col items-center gap-6 pb-20">
      {/* Top Header */}
      <div className="flex items-center justify-between w-full max-w-sm px-4">
        <button onClick={handleExit} className="text-xs px-3 py-1 rounded-full bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition">Exit Room</button>
        <span className="font-mono text-xs text-whatsapp-teal">{roomId.slice(0, 8)}...</span>
      </div>

      {/* Players Section with Avatars */}
      <div className="flex gap-4 w-full max-w-sm px-4">
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

      <VoiceControls roomId={roomId} uid={user.uid} />
    </div>
  );
}

function PlayerTag({ label, info, active }) {
  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-xl flex-1 ${active ? "bg-whatsapp-teal/20 border border-whatsapp-teal/50" : "bg-white/5"}`}>
      <img src={info?.photoURL || "/avatar.png"} className="w-8 h-8 rounded-full border border-white/10" alt="avatar" />
      <div className="flex flex-col overflow-hidden">
        <span className="text-[9px] uppercase tracking-widest text-gray-500">{label}</span>
        <span className="text-sm font-bold truncate">{info?.name || "Waiting..."}</span>
      </div>
    </div>
  );
}
