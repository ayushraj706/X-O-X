// src/constants/gamesRegistry.js
// Central registry of all games shown on the Home Page.

import ticTacToeManifest from '../../games/tic-tac-toe';
import chessManifest from '../../games/chess';
import carromManifest from '../../games/carrom';
import ludoManifest from '../../games/ludo';

const GAMES = [
  ticTacToeManifest,
  chessManifest,
  carromManifest,
  ludoManifest
];

export default GAMES;
