// games/chess/ui/Board.js
import { useState } from "react";
import { ChessPiece } from "@chess-pieces/svg"; // Professional SVG library

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

export default function Board({ board, orientation = "white", legalMovesForSquare, onSelectSquare, onMove, disabled, lastMove }) {
  const [selected, setSelected] = useState(null);

  const ranks = orientation === "white" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files = orientation === "white" ? FILES : [...FILES].reverse();

  function handleClick(square) {
    if (disabled) return;
    
    // Move logic: agar pehle se selected hai aur move legal hai
    if (selected && legalMovesForSquare?.includes(square)) {
      onMove(selected, square);
      setSelected(null);
      return;
    }
    
    // Square select karna
    setSelected(square);
    onSelectSquare(square);
  }

  return (
    <div className="grid grid-cols-8 w-80 h-80 mx-auto rounded-2xl overflow-hidden border-4 border-stone-800 shadow-2xl">
      {ranks.map((rank) =>
        files.map((file) => {
          const square = `${file}${rank}`;
          const rankIdx = 8 - rank;
          const fileIdx = FILES.indexOf(file);
          const piece = board?.[rankIdx]?.[fileIdx];
          
          // Chess board colors (Tournament look)
          const isDark = (FILES.indexOf(file) + rank) % 2 === 0;
          const isSelected = selected === square;
          const isLegal = legalMovesForSquare?.includes(square);
          const isLastMove = lastMove && (lastMove.from === square || lastMove.to === square);

          return (
            <button
              key={square}
              onClick={() => handleClick(square)}
              className={`relative flex items-center justify-center transition-all duration-200
                ${isDark ? "bg-stone-500" : "bg-stone-200"}
                ${isSelected ? "ring-inset ring-4 ring-amber-400" : ""}
                ${isLastMove ? "bg-yellow-500/30" : ""}
              `}
            >
              {/* Professional SVG Piece Rendering */}
              {piece && (
                <div className="w-full h-full p-1 select-none pointer-events-none">
                  <ChessPiece piece={`${piece.color}${piece.type.toUpperCase()}`} />
                </div>
              )}
              
              {/* Legal Move Indicator (Tic-Tac-Toe style dot) */}
              {isLegal && (
                <div className="absolute w-4 h-4 rounded-full bg-black/20 animate-pulse" />
              )}
            </button>
          );
        })
      )}
    </div>
  );
}
