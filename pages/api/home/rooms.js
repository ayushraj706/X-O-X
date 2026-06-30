// pages/api/home/rooms.js
// Home-page level backend logic: lists active rooms across all games (for lobby/discovery),
// and provides generic call-signaling bookkeeping (active room counts, presence ping).
// Per-game logic itself stays inside games/<id>/backend — this is platform-level only.

import { adminDb } from '../../../src/lib/firebase/admin';

const GAME_IDS = ['tic-tac-toe']; // extend as you add more games

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const summary = {};
      for (const gameId of GAME_IDS) {
        const snap = await adminDb
          .collection('games')
          .doc(gameId)
          .collection('rooms')
          .where('status', '==', 'active')
          .get();
        summary[gameId] = snap.size;
      }
      return res.status(200).json({ success: true, activeRooms: summary });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, error: 'Failed to fetch room summary' });
    }
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
