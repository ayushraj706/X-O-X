// games/chess/ui/Board.js
// Click-to-select, click-to-move board (no drag-drop, keeps it simple & mobile-friendly).
import { useState } from "react";
import { pieceSymbol } from "./pieceSymbols";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

export default function Board({ board, orientation = "white", legalMovesForSquare, onSelectSquare, onMove, disabled, lastMove }) {
  const [selected, setSelected] = useState(null);

  const ranks = orientation === "white" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files = orientation === "white" ? FILES : [...FILES].reverse();

  function squareId(file, rank) {
    return `${file}${rank}`;
  }

  function handleClick(square) {
    if (disabled) return;
    if (selected && legalMovesForSquare?.includes(square)) {
      onMove(selected, square);
      setSelected(null);
      return;
    }
    setSelected(square);
    onSelectSquare(square);
  }

  return (
    <div className="grid grid-cols-8 w-80 h-80 mx-auto rounded-lg overflow-hidden border border-white/10">
      {ranks.map((rank) =>
        files.map((file) => {
          const square = squareId(file, rank);
          const rankIdx = 8 - rank;
          const fileIdx = FILES.indexOf(file);
          const piece = board?.[rankIdx]?.[fileIdx];
          const isDark = (FILES.indexOf(file) + rank) % 2 === 0;
          const isSelected = selected === square;
          const isLegal = legalMovesForSquare?.includes(square);
          const isLastMove = lastMove && (lastMove.from === square || lastMove.to === square);

          return (
            <button
              key={square}
              onClick={() => handleClick(square)}
              className={`relative flex items-center justify-center text-2xl
                ${isDark ? "bg-whatsapp-tealDark/40" : "bg-whatsapp-bubble"}
                ${isSelected ? "ring-2 ring-whatsapp-accent" : ""}
                ${isLastMove ? "bg-yellow-500/20" : ""}
              `}
            >
              {piece && <span className={piece.color === "w" ? "text-white drop-shadow" : "text-gray-900"}>{pieceSymbol(piece)}</span>}
              {isLegal && <span className="absolute w-3 h-3 rounded-full bg-whatsapp-accent/70" />}
            </button>
          );
        })
      )}
    </div>
  );
}
