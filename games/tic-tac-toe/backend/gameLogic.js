// games/tic-tac-toe/backend/gameLogic.js
// Pure, framework-agnostic game rules. No Firebase/Agora imports here —
// keeps it unit-testable and reusable on both client & server.

export const EMPTY_BOARD = Array(9).fill(null);
// Naya: Default score jab game start ho
export const INITIAL_SCORES = { X: 0, O: 0 }; 

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],            // diagonals
];

/** Returns { winner: 'X' | 'O' | 'draw' | null, line: [...] | null } */
export function getGameStatus(board) {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: [a, b, c] };
    }
  }
  if (board.every((cell) => cell !== null)) {
    return { winner: 'draw', line: null };
  }
  return { winner: null, line: null };
}

export function isValidMove(board, index, turn, playerSymbol) {
  if (index < 0 || index > 8) return false;
  if (board[index] !== null) return false;
  if (turn !== playerSymbol) return false;
  const status = getGameStatus(board);
  if (status.winner) return false;
  return true;
}

export function applyMove(board, index, symbol) {
  const newBoard = [...board];
  newBoard[index] = symbol;
  return newBoard;
}

export function nextTurn(turn) {
  return turn === 'X' ? 'O' : 'X';
}


// ==========================================
// NAYE FEATURES: SCORE AUR TURN ROTATION
// ==========================================

/** 
 * Score update karne ka logic. 
 * Agar koi jita hai, toh uska score +1 kar do. 
 */
export function calculateNewScores(currentScores, winner) {
  if (!winner || winner === 'draw') return currentScores;
  
  return {
    ...currentScores,
    [winner]: (currentScores[winner] || 0) + 1
  };
}

/** 
 * Agla round kaun start karega uska logic.
 * Agar pichla round X ne start kiya tha, toh ye round O start karega.
 */
export function getNextRoundStarter(currentStarter) {
  return currentStarter === 'X' ? 'O' : 'X';
}
