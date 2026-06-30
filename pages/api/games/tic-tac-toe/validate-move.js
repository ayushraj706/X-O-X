// pages/api/games/tic-tac-toe/validate-move.js
// Thin wrapper: this file ONLY adapts HTTP <-> the real backend logic which
// lives in games/tic-tac-toe/backend/gameLogic.js. Keeps games/ as the single
// source of truth so adding new games never touches shared platform code.

import { isValidMove, applyMove, getGameStatus } from '../../../../games/tic-tac-toe/backend/gameLogic';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { board, index, turn, symbol } = req.body || {};

  if (!Array.isArray(board) || typeof index !== 'number') {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const valid = isValidMove(board, index, turn, symbol);
  if (!valid) {
    return res.status(200).json({ valid: false });
  }

  const newBoard = applyMove(board, index, symbol);
  const status = getGameStatus(newBoard);

  return res.status(200).json({ valid: true, board: newBoard, status });
}
