// games/chess/ui/LocalGame.js — offline pass & play, pure client-side chess.js instance
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
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-gray-400">Local Pass & Play — no internet needed</p>
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
        <button onClick={reset} className="px-4 py-2 rounded-full bg-whatsapp-teal">
          Play Again
        </button>
      )}
    </div>
  );
}

function StatusBar({ state }) {
  if (state.isCheckmate) return <p className="font-semibold text-whatsapp-teal">🏆 Checkmate — {state.turn === "white" ? "Black" : "White"} wins!</p>;
  if (state.isStalemate) return <p className="font-semibold text-amber-400">🤝 Stalemate</p>;
  if (state.isDraw) return <p className="font-semibold text-amber-400">🤝 Draw</p>;
  if (state.isCheck) return <p className="font-semibold text-red-400">⚠️ Check! {state.turn}'s turn</p>;
  return <p className="text-gray-300">Turn: <span className="font-bold capitalize">{state.turn}</span></p>;
}
