// games/chess/backend/logic.js
// Pure game-logic wrapper around chess.js (battle-tested rules engine —
// handles castling, en passant, promotion, check & checkmate detection).
// No React, no Firebase — safe for both local and Firestore-synced modes.
import { Chess } from "chess.js";

export function createInitialGameState() {
  const chess = new Chess();
  return serialize(chess);
}

export function loadFromFen(fen) {
  const chess = new Chess(fen);
  return chess;
}

export function serialize(chess) {
  return {
    fen: chess.fen(),
    pgn: chess.pgn(),
    turn: chess.turn() === "w" ? "white" : "black",
    isCheck: chess.isCheck(),
    isCheckmate: chess.isCheckmate(),
    isStalemate: chess.isStalemate(),
    isDraw: chess.isDraw(),
    isGameOver: chess.isGameOver(),
    history: chess.history({ verbose: true }),
    board: chess.board()
  };
}

/**
 * Attempts a move. Returns { invalid: true } if illegal, otherwise the new
 * serialized state plus metadata about what kind of move it was, so the UI
 * layer can pick the right sound (move / capture / check / checkmate).
 */
export function attemptMove(fen, { from, to, promotion = "q" }) {
  const chess = new Chess(fen);
  let moveResult;
  try {
    moveResult = chess.move({ from, to, promotion });
  } catch (e) {
    moveResult = null;
  }

  if (!moveResult) return { invalid: true };

  const state = serialize(chess);
  return {
    invalid: false,
    state,
    move: moveResult,
    wasCapture: !!moveResult.captured,
    isCheck: state.isCheck,
    isCheckmate: state.isCheckmate
  };
}

export function getLegalMovesForSquare(fen, square) {
  const chess = new Chess(fen);
  return chess.moves({ square, verbose: true }).map((m) => m.to);
}
