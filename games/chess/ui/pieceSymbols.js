// games/chess/ui/pieceSymbols.js
const SYMBOLS = {
  w: { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕", k: "♔" },
  b: { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" }
};
export function pieceSymbol(piece) {
  if (!piece) return "";
  return SYMBOLS[piece.color][piece.type];
}
