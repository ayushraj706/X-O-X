// games/tic-tac-toe/ui/TicTacToeGame.js
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import Image from 'next/image';

import { useAuth } from '../../../src/context/AuthContext';
import { createVoiceChannel } from '../../../src/lib/agora/agoraClient';
import VoiceControls from '../../../src/components/voice/VoiceControls';

import {
  createRoom,
  joinRoom,
  watchRoom,
  makeMove,
  resetBoard,
  leaveRoom,
  generateRoomCode,
} from '../backend/roomService';

import RoomLobby from './RoomLobby';
import Board from './Board';
import ExitButton from './ExitButton';

export default function TicTacToeGame() {
  const { user, profile } = useAuth();
  const router = useRouter();

  const [roomCode, setRoomCode] = useState(null);
  const [room, setRoom] = useState(null);
  const [myRole, setMyRole] = useState(null); // 'player' | 'spectator'
  const [mySymbol, setMySymbol] = useState(null); // 'X' | 'O' | null
  const [loading, setLoading] = useState(false);

  const voiceChannelRef = useRef(null);
  const unsubRoomRef = useRef(null);

  // ---------- Voice chat lifecycle ----------
  const joinVoice = useCallback(async (code) => {
    if (!user) return;
    try {
      const vc = createVoiceChannel();
      await vc.join(`tictactoe_${code}`, user.uid);
      voiceChannelRef.current = vc;
    } catch (err) {
      console.error('Voice join failed', err);
      toast.error('Voice chat unavailable (mic permission?)');
    }
  }, [user]);

  const leaveVoice = useCallback(async () => {
    if (voiceChannelRef.current) {
      await voiceChannelRef.current.leave();
      voiceChannelRef.current = null;
    }
  }, []);

  // ---------- Room actions ----------
  const handleCreateRoom = async () => {
    if (!user) return toast.error('Please sign in first');
    setLoading(true);
    const code = generateRoomCode();
    await createRoom({ roomCode: code, uid: user.uid, name: profile?.name, photoURL: profile?.photoURL });
    setRoomCode(code);
    setMyRole('player');
    setMySymbol('X');
    await joinVoice(code);
    setLoading(false);
  };

  const handleJoinRoom = async (code, desiredRole) => {
    if (!user) return toast.error('Please sign in first');
    setLoading(true);
    try {
      const currentData = await new Promise((resolve, reject) => {
        const unsub = watchRoom(code, (data) => {
          unsub();
          data ? resolve(data) : reject(new Error('ROOM_NOT_FOUND'));
        });
      });

      const result = await joinRoom(
        { roomCode: code, uid: user.uid, name: profile?.name, photoURL: profile?.photoURL, desiredRole },
        currentData
      );
      setRoomCode(code);
      setMyRole(result.role);
      setMySymbol(result.symbol);
      await joinVoice(code);
      if (result.role === 'spectator' && desiredRole === 'player') {
        toast('Both player slots full — joined as Spectator', { icon: '👀' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExit = async () => {
    if (roomCode && user) {
      await leaveRoom({ roomCode, uid: user.uid, currentRoomData: room });
    }
    await leaveVoice();
    if (unsubRoomRef.current) unsubRoomRef.current();
    setRoomCode(null);
    setRoom(null);
    setMyRole(null);
    setMySymbol(null);
  };

  // ---------- Subscribe to room updates ----------
  useEffect(() => {
    if (!roomCode) return;
    unsubRoomRef.current = watchRoom(roomCode, (data) => {
      if (!data) {
        toast('Room closed', { icon: 'ℹ️' });
        setRoomCode(null);
        setRoom(null);
        return;
      }
      setRoom(data);
    });
    return () => unsubRoomRef.current?.();
  }, [roomCode]);

  // Cleanup voice on unmount
  useEffect(() => {
    return () => {
      leaveVoice();
    };
  }, [leaveVoice]);

  const handleCellClick = async (index) => {
    if (myRole !== 'player' || !mySymbol || !room) return;
    try {
      await makeMove({ roomCode, index, symbol: mySymbol, currentRoomData: room });
    } catch (e) {
      // invalid move — ignore silently
    }
  };

  // ---------- Render ----------
  if (!roomCode || !room) {
    return <RoomLobby onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />;
  }

  const isMyTurn = myRole === 'player' && room.turn === mySymbol && !room.winner;
  const statusText = room.winner
    ? room.winner === 'draw'
      ? "It's a Draw!"
      : `${room.winner} Wins! 🎉`
    : `${room.turn}'s Turn${isMyTurn ? ' (You)' : ''}`;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <p className="text-xs text-gray-400">Room Code</p>
          <p className="font-mono font-bold text-lg text-wa-greenDark dark:text-wa-green">{roomCode}</p>
        </div>
        <VoiceControls voiceChannel={voiceChannelRef.current} />
      </div>

      <div className="flex items-center justify-center gap-6 mb-6">
        <PlayerBadge label="X" player={room.players?.X} active={room.turn === 'X' && !room.winner} />
        <span className="text-gray-400 font-bold">VS</span>
        <PlayerBadge label="O" player={room.players?.O} active={room.turn === 'O' && !room.winner} />
      </div>

      {myRole === 'spectator' && (
        <p className="text-center text-sm mb-4 text-gray-500 dark:text-gray-400">👀 You are spectating</p>
      )}

      <p className="text-center font-semibold mb-4 text-gray-800 dark:text-gray-200">{statusText}</p>

      <Board
        board={room.board}
        onCellClick={handleCellClick}
        winLine={room.winLine}
        disabled={!isMyTurn || !!room.winner}
      />

      {room.winner && myRole === 'player' && (
        <div className="flex justify-center mt-6">
          <button onClick={() => resetBoard(roomCode)} className="wa-btn px-6 py-3">
            🔄 Play Again
          </button>
        </div>
      )}

      <ExitButton onExit={handleExit} />

      {room.spectators?.length > 0 && (
        <p className="text-center text-xs text-gray-400 mt-2">
          {room.spectators.length} spectator{room.spectators.length > 1 ? 's' : ''} watching
        </p>
      )}
    </div>
  );
}

function PlayerBadge({ label, player, active }) {
  return (
    <div className={`flex flex-col items-center gap-1 ${active ? 'scale-110' : 'opacity-70'} transition-transform`}>
      <div className={`h-12 w-12 rounded-full overflow-hidden ring-2 ${active ? 'ring-wa-green' : 'ring-gray-300 dark:ring-gray-700'} flex items-center justify-center bg-gray-100 dark:bg-gray-800`}>
        {player?.photoURL ? (
          <Image src={player.photoURL} alt={player.name} width={48} height={48} className="object-cover" />
        ) : (
          <span className="text-xl font-bold text-gray-400">{label}</span>
        )}
      </div>
      <span className="text-xs text-gray-600 dark:text-gray-300 max-w-[80px] truncate">
        {player?.name || 'Waiting…'}
      </span>
    </div>
  );
}
