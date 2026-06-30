// games/tic-tac-toe/index.js
// Game manifest consumed by the home page registry. Keep this self-contained
// so adding a new game later is just: create games/<id>/index.js + register it.

const ticTacToeManifest = {
  id: 'tic-tac-toe',
  name: 'Tic-Tac-Toe',
  description: 'Classic Zero-Kattice — create a room and challenge a friend.',
  icon: '⭕❌',
  players: '2 + spectators',
  route: '/games/tic-tac-toe',
};

export default ticTacToeManifest;
