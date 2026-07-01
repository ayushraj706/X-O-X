// games/chess/ui/LocalGame.js
import { useState } from "react";
import { Chess } from "chess.js";
import Board from "./Board";
import { serialize } from "../backend/logic";
import { playSound } from "../../../src/lib/sound";
import { SOUNDS } from "./sounds";

export default function LocalGame() {
  const [chess] = useState(() => new Chess());
  const [state, setState] = useState(() => serialize(chess));
  const [legalMoves, setLegalMoves] = useState([]);
  const [lastMove, setLastMove] = useState(null);

  function handleSelectSquare(square) {
    setLegalMoves(chess.moves({ square, verbose: true }).map((m) => m.to));
  }

  function handleMove(from, to) {
    const move = chess.move({ from, to, promotion: "q" });
    if (!move) {
      playSound(SOUNDS.invalid);
      return;
    }
    setLastMove({ from, to });
    setLegalMoves([]);
    const next = serialize(chess);
    setState(next);

    // Sounds
    if (next.isCheckmate) playSound(SOUNDS.checkmate);
    else if (next.isCheck) playSound(SOUNDS.check);
    else if (move.captured) playSound(SOUNDS.capture);
    else playSound(SOUNDS.move);

    if (next.isDraw) setTimeout(() => playSound(SOUNDS.draw), 200);
  }

  function reset() {
    chess.reset();
    setState(serialize(chess));
    setLastMove(null);
    setLegalMoves([]);
  }

  return (
    <div className="flex flex-col items-center gap-6 p-4">
      <div className="text-center">
        <h2 className="text-xl font-bold text-white">Local Chess</h2>
        <p className="text-xs text-gray-500 uppercase tracking-widest">Offline Pass & Play</p>
      </div>
      
      <StatusBar state={state} />
      
      <Board
        board={state.board}
        legalMovesForSquare={legalMoves}
        onSelectSquare={handleSelectSquare}
        onMove={handleMove}
        lastMove={lastMove}
        disabled={state.isGameOver}
      />
      
      {state.isGameOver && (
        <button onClick={reset} className="px-8 py-3 rounded-2xl bg-whatsapp-teal font-bold shadow-lg transition hover:scale-105">
          Play Again
        </button>
      )}
    </div>
  );
}

function StatusBar({ state }) {
  const getStatusContent = () => {
    if (state.isCheckmate) return { text: `Checkmate — ${state.turn === "white" ? "Black" : "White"} wins!`, color: "text-whatsapp-teal" };
    if (state.isStalemate || state.isDraw) return { text: "Draw / Stalemate", color: "text-amber-400" };
    if (state.isCheck) return { text: "⚠️ Check!", color: "text-red-400" };
    return { text: `Turn: ${state.turn.toUpperCase()}`, color: "text-white" };
  };

  const { text, color } = getStatusContent();
  return (
    <div className={`px-4 py-2 rounded-xl bg-white/5 font-mono text-sm ${color}`}>
      {text}
    </div>
  );
}
