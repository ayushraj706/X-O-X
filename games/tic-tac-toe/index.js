// games/tic-tac-toe/index.js
// Game manifest consumed by the home page registry. Keep this self-contained
// so adding a new game later is just: create games/<id>/index.js + register it.

import { FaTimes, FaRegCircle } from 'react-icons/fa';

// Custom Icon: Emoji ki jagah professional UI jo har device par same aur premium dikhega
const TicTacToeIcon = () => (
  <div className="flex items-center gap-1.5 text-3xl">
    <FaRegCircle className="text-blue-500 drop-shadow-sm" />
    <span className="text-gray-300 dark:text-gray-600 text-2xl font-light">|</span>
    <FaTimes className="text-wa-green drop-shadow-sm scale-110" />
  </div>
);

const ticTacToeManifest = {
  id: 'tic-tac-toe',
  name: 'Tic-Tac-Toe',
  description: 'Classic Zero-Kattice — create a room and challenge a friend.',
  icon: <TicTacToeIcon />, // Yahan humne string ki jagah apna naya component pass kar diya
  players: '2 + spectators',
  route: '/games/tic-tac-toe',
};

export default ticTacToeManifest;
