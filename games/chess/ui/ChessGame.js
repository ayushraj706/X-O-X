// games/chess/ui/OnlineGame.js — Firestore-synced multiplayer + spectators
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

export default function ChessGame({ roomId }) {
  const { user, loginWithGoogle } = useAuth();
  const [room, setRoom] = useState(null);
  const [role, setRole] = useState(null); // "white" | "black" | "spectator"
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
    const alreadyIn =
      room.players.white?.uid === user.uid ||
      room.players.black?.uid === user.uid ||
      room.spectators?.some((s) => s.uid === user.uid);
    if (alreadyIn) return;

    if (!room.players.black) {
      joinRoomAsPlayer(roomId, { uid: user.uid, name: user.displayName || "Black" });
    } else {
      joinRoomAsSpectator(roomId, { uid: user.uid, name: user.displayName || "Spectator" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    if (room.game.isDraw) setTimeout(() => playSound(SOUNDS.draw), 200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.game?.history?.length]);

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
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center justify-between w-80 text-xs text-gray-400">
        <span>Room: <span className="font-mono text-whatsapp-teal">{roomId}</span></span>
        <span>👀 {room.spectators?.length || 0} watching</span>
      </div>

      <div className="flex justify-between w-80 text-sm">
        <PlayerTag label="White" info={room.players.white} active={room.game?.turn === "white"} />
        <PlayerTag label="Black" info={room.players.black} active={room.game?.turn === "black"} />
      </div>

      {isSpectator && (
        <span className="text-xs px-3 py-1 rounded-full bg-amber-500/20 text-amber-400">
          👁️ Spectator mode — you're watching live
        </span>
      )}
      {room.game?.isCheck && !room.game?.isCheckmate && (
        <span className="text-xs px-3 py-1 rounded-full bg-red-500/20 text-red-400">⚠️ Check!</span>
      )}

      <Board
        board={room.game?.board}
        orientation={role === "black" ? "black" : "white"}
        legalMovesForSquare={legalMoves}
        onSelectSquare={handleSelectSquare}
        onMove={handleMove}
        lastMove={lastMove}
        disabled={isSpectator || !isMyTurn || room.game?.isGameOver}
      />

      {room.game?.isCheckmate && (
        <p className="font-semibold text-whatsapp-teal">🏆 Checkmate — {room.game.turn === "white" ? "Black" : "White"} wins!</p>
      )}
      {(room.game?.isStalemate || room.game?.isDraw) && !room.game?.isCheckmate && (
        <p className="font-semibold text-amber-400">🤝 Draw</p>
      )}

      {!isSpectator && room.game?.isGameOver && (
        <button onClick={() => rematch(roomId)} className="px-4 py-2 rounded-full bg-whatsapp-teal">Rematch</button>
      )}

      <VoiceControls roomId={roomId} uid={user.uid} />
    </div>
  );
}

function PlayerTag({ label, info, active }) {
  return (
    <div className={`px-3 py-1 rounded-lg ${active ? "bg-whatsapp-teal/30" : "bg-white/5"}`}>
      <span className="font-bold">{label}</span> — {info?.name || "waiting..."}
    </div>
  );
}
