// lib/gameUtils.js
// Pure utility functions for game logic — no side effects, fully testable.

/**
 * Generates a cryptographically random 6-character uppercase room ID.
 * Uses a character set that avoids visually ambiguous characters (0, O, I, 1).
 */
export function generateRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

/**
 * All 8 possible winning line combinations for a 3x3 board.
 * Indices refer to positions in the flat 9-element board array.
 */
const WIN_LINES = [
  [0, 1, 2], // top row
  [3, 4, 5], // middle row
  [6, 7, 8], // bottom row
  [0, 3, 6], // left column
  [1, 4, 7], // middle column
  [2, 5, 8], // right column
  [0, 4, 8], // diagonal top-left → bottom-right
  [2, 4, 6], // diagonal top-right → bottom-left
];

/**
 * Checks the board for a winner.
 * @param {string[]} board - 9-element array of "", "X", or "O"
 * @returns {{ winner: string, line: number[] } | null}
 *   winner: "X" or "O", line: the winning indices — or null if no winner yet.
 */
export function checkWinner(board) {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line };
    }
  }
  return null;
}

/**
 * Checks whether the board is completely filled (a draw condition).
 * Should only be called after checkWinner returns null.
 * @param {string[]} board
 * @returns {boolean}
 */
export function checkDraw(board) {
  return board.every((cell) => cell !== "");
}

/**
 * Returns the initial, clean game state object for a new room.
 * @returns {object}
 */
export function getInitialRoomState() {
  return {
    board: Array(9).fill(""),
    turn: "X",
    status: "waiting", // "waiting" | "playing" | "finished"
    winner: "",        // "" | "X" | "O" | "draw"
    winLine: [],       // winning cell indices, or []
  };
}
