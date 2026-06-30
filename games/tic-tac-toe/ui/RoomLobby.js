// games/tic-tac-toe/ui/RoomLobby.js
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function RoomLobby({ onCreateRoom, onJoinRoom }) {
  const [joinCode, setJoinCode] = useState('');
  const [role, setRole] = useState('player');
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    setBusy(true);
    try {
      await onCreateRoom();
    } catch (e) {
      toast.error('Could not create room');
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) {
      toast.error('Enter a room code');
      return;
    }
    setBusy(true);
    try {
      await onJoinRoom(joinCode.trim().toUpperCase(), role);
    } catch (e) {
      toast.error(e.message === 'ROOM_NOT_FOUND' ? 'Room not found' : 'Could not join room');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16 p-8 rounded-2xl bg-white dark:bg-wa-panelDark border border-gray-200 dark:border-gray-800 shadow-xl">
      <h2 className="text-2xl font-bold text-center mb-1 text-gray-900 dark:text-white">⭕❌ Tic-Tac-Toe</h2>
      <p className="text-center text-gray-500 dark:text-gray-400 mb-6 text-sm">Zero Kattice</p>

      <button
        onClick={handleCreate}
        disabled={busy}
        className="wa-btn w-full py-3 mb-6 disabled:opacity-50"
      >
        ➕ Create New Room
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
        <span className="text-xs text-gray-400">OR JOIN EXISTING</span>
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
      </div>

      <input
        type="text"
        placeholder="Enter Room Code (e.g. TTT-7G2K)"
        value={joinCode}
        onChange={(e) => setJoinCode(e.target.value)}
        className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white mb-4 focus:outline-none focus:ring-2 focus:ring-wa-green"
      />

      <div className="flex gap-3 mb-4">
        <RoleOption label="🎮 Player" value="player" current={role} onSelect={setRole} />
        <RoleOption label="👀 Spectator" value="spectator" current={role} onSelect={setRole} />
      </div>

      <button
        onClick={handleJoin}
        disabled={busy}
        className="wa-btn w-full py-3 disabled:opacity-50"
      >
        Join Room
      </button>
    </div>
  );
}

function RoleOption({ label, value, current, onSelect }) {
  const active = current === value;
  return (
    <button
      onClick={() => onSelect(value)}
      className={`flex-1 py-2 rounded-xl border text-sm font-medium transition ${
        active
          ? 'border-wa-green bg-wa-green/10 text-wa-greenDark dark:text-wa-green'
          : 'border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400'
      }`}
    >
      {label}
    </button>
  );
}
