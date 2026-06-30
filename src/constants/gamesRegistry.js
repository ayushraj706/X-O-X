// src/constants/gamesRegistry.js
// Central registry of all games shown on the Home Page.
// To add a new game: create games/<id>/ui + games/<id>/backend, then register it here.

import ticTacToeManifest from '../../games/tic-tac-toe';

const GAMES = [ticTacToeManifest];

export default GAMES;
