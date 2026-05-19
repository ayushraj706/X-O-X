"use client";

// app/page.js
// ─────────────────────────────────────────────────────────────────────────────
// NeonX — Real-time Multiplayer Tic-Tac-Toe
// State machine: HOME → WAITING → PLAYING
// Firebase Realtime Database drives all synchronization.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react";
import { db } from "@/lib/firebase";
import { ref, set, get, onValue, off, update } from "firebase/database";
import { generateRoomId, checkWinner, checkDraw, getInitialRoomState } from "@/lib/gameUtils";

// ─── App screen states ────────────────────────────────────────────────────────
const SCREEN = {
  HOME: "HOME",
  WAITING: "WAITING",
  PLAYING: "PLAYING",
};

// ─────────────────────────────────────────────────────────────────────────────
// Root Component
// ─────────────────────────────────────────────────────────────────────────────
export default function Home() {
  const [screen, setScreen] = useState(SCREEN.HOME);
  const [roomId, setRoomId] = useState("");
  const [playerRole, setPlayerRole] = useState(null); // "X" | "O"
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [joinInput, setJoinInput] = useState("");
  const [errorShake, setErrorShake] = useState(false);

  // Ref to the active Firebase listener so we can detach it on cleanup
  const listenerRef = useRef(null);

  // ── Cleanup Firebase listener on unmount or when room changes ──────────────
  const detachListener = useCallback(() => {
    if (listenerRef.current) {
      off(listenerRef.current);
      listenerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => detachListener();
  }, [detachListener]);

  // ── Show an error with optional shake animation ────────────────────────────
  const showError = useCallback((message) => {
    setError(message);
    setErrorShake(true);
    setTimeout(() => setErrorShake(false), 400);
    setTimeout(() => setError(""), 3500);
  }, []);

  // ── Subscribe to a room in Firebase ───────────────────────────────────────
  const subscribeToRoom = useCallback(
    (id) => {
      detachListener();
      const roomRef = ref(db, `rooms/${id}`);
      listenerRef.current = roomRef;

      onValue(roomRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        setGameState(data);

        // Transition both players to PLAYING as soon as status flips
        if (data.status === "playing" || data.status === "finished") {
          setScreen(SCREEN.PLAYING);
        }
      });
    },
    [detachListener]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // ACTION: Create Room (Player X)
  // ─────────────────────────────────────────────────────────────────────────
  const handleCreateRoom = async () => {
    setIsLoading(true);
    setError("");

    try {
      const id = generateRoomId();
      const initialState = getInitialRoomState();

      await set(ref(db, `rooms/${id}`), initialState);

      setRoomId(id);
      setPlayerRole("X");
      setGameState(initialState);
      subscribeToRoom(id);
      setScreen(SCREEN.WAITING);
    } catch (err) {
      console.error("Create room error:", err);
      showError("Failed to create room. Check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ACTION: Join Room (Player O)
  // ─────────────────────────────────────────────────────────────────────────
  const handleJoinRoom = async () => {
    const id = joinInput.trim().toUpperCase();
    if (!id) {
      showError("Please enter a Room ID.");
      return;
    }
    if (id.length !== 6) {
      showError("Room ID must be 6 characters.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const snapshot = await get(ref(db, `rooms/${id}`));

      if (!snapshot.exists()) {
        showError("Room not found. Double-check the Room ID.");
        setIsLoading(false);
        return;
      }

      const data = snapshot.val();

      if (data.status !== "waiting") {
        showError(
          data.status === "playing"
            ? "This room is already full."
            : "This room's game has ended."
        );
        setIsLoading(false);
        return;
      }

      // Update status → "playing" to signal both players
      await update(ref(db, `rooms/${id}`), { status: "playing" });

      setRoomId(id);
      setPlayerRole("O");
      subscribeToRoom(id);
      // Screen will flip to PLAYING via the onValue listener above
    } catch (err) {
      console.error("Join room error:", err);
      showError("Failed to join room. Check your connection.");
      setIsLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ACTION: Make a Move
  // ─────────────────────────────────────────────────────────────────────────
  const handleCellClick = async (index) => {
    if (!gameState) return;
    const { board, turn, status, winner } = gameState;

    // Guard: only allow clicks if it's this player's turn and cell is empty
    if (
      status === "finished" ||
      winner !== "" ||
      turn !== playerRole ||
      board[index] !== ""
    ) {
      return;
    }

    const newBoard = [...board];
    newBoard[index] = playerRole;

    const nextTurn = playerRole === "X" ? "O" : "X";
    const result = checkWinner(newBoard);
    const isDraw = !result && checkDraw(newBoard);

    const updates = {
      board: newBoard,
      turn: nextTurn,
      status: result || isDraw ? "finished" : "playing",
      winner: result ? result.winner : isDraw ? "draw" : "",
      winLine: result ? result.line : [],
    };

    try {
      await update(ref(db, `rooms/${roomId}`), updates);
    } catch (err) {
      console.error("Move error:", err);
      showError("Move failed. Try again.");
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ACTION: Play Again — reset board, keep players in room
  // ─────────────────────────────────────────────────────────────────────────
  const handlePlayAgain = async () => {
    try {
      const resetState = {
        board: Array(9).fill(""),
        turn: "X",
        status: "playing",
        winner: "",
        winLine: [],
      };
      await update(ref(db, `rooms/${roomId}`), resetState);
    } catch (err) {
      console.error("Reset error:", err);
      showError("Reset failed. Try again.");
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ACTION: Leave Room — go back to HOME
  // ─────────────────────────────────────────────────────────────────────────
  const handleLeaveRoom = () => {
    detachListener();
    setScreen(SCREEN.HOME);
    setRoomId("");
    setPlayerRole(null);
    setGameState(null);
    setJoinInput("");
    setError("");
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-md relative">
        {/* Global error banner */}
        {error && (
          <div
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl
              bg-red-950/80 border border-red-500/50 text-red-300 text-sm font-medium
              backdrop-blur-md shadow-lg animate-slide-up whitespace-nowrap
              ${errorShake ? "shake" : ""}`}
          >
            ⚠ {error}
          </div>
        )}

        {screen === SCREEN.HOME && (
          <HomeScreen
            joinInput={joinInput}
            setJoinInput={setJoinInput}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            isLoading={isLoading}
          />
        )}

        {screen === SCREEN.WAITING && (
          <WaitingScreen roomId={roomId} onLeave={handleLeaveRoom} />
        )}

        {screen === SCREEN.PLAYING && gameState && (
          <PlayingScreen
            gameState={gameState}
            playerRole={playerRole}
            roomId={roomId}
            onCellClick={handleCellClick}
            onPlayAgain={handlePlayAgain}
            onLeave={handleLeaveRoom}
          />
        )}
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOME SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function HomeScreen({ joinInput, setJoinInput, onCreateRoom, onJoinRoom, isLoading }) {
  const handleKeyDown = (e) => {
    if (e.key === "Enter") onJoinRoom();
  };

  return (
    <div className="glass-card p-8 animate-slide-up">
      {/* Logo / Title */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-3 mb-4 animate-float">
          <span className="text-5xl font-black text-neon-cyan font-display tracking-tight">X</span>
          <span className="text-2xl font-light text-white/30 font-display">vs</span>
          <span className="text-5xl font-black text-neon-purple font-display tracking-tight">O</span>
        </div>
        <h1 className="text-2xl font-bold tracking-widest uppercase text-white/90 font-display">
          NeonX
        </h1>
        <p className="text-xs text-white/35 mt-1 tracking-wider font-mono uppercase">
          Multiplayer · Room Codes · No Login
        </p>
      </div>

      <hr className="neon-divider mb-8" />

      {/* Create Room */}
      <div className="mb-6">
        <p className="text-xs text-white/40 uppercase tracking-widest font-mono mb-3">
          New Game
        </p>
        <button
          className="btn-cyan"
          onClick={onCreateRoom}
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Creating…
            </span>
          ) : (
            "+ Create Room"
          )}
        </button>
      </div>

      {/* Divider with OR */}
      <div className="flex items-center gap-3 mb-6">
        <hr className="neon-divider flex-1" />
        <span className="text-xs text-white/25 uppercase tracking-widest font-mono">or</span>
        <hr className="neon-divider flex-1" />
      </div>

      {/* Join Room */}
      <div>
        <p className="text-xs text-white/40 uppercase tracking-widest font-mono mb-3">
          Join Existing Room
        </p>
        <input
          className="neon-input mb-3"
          type="text"
          placeholder="ENTER ROOM CODE"
          maxLength={6}
          value={joinInput}
          onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck="false"
        />
        <button
          className="btn-purple"
          onClick={onJoinRoom}
          disabled={isLoading || !joinInput.trim()}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Joining…
            </span>
          ) : (
            "→ Join Room"
          )}
        </button>
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-white/20 mt-8 font-mono">
        Share your Room ID with a friend · No account needed
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WAITING SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function WaitingScreen({ roomId, onLeave }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available in all environments
    }
  };

  return (
    <div className="glass-card p-8 text-center animate-slide-up">
      {/* Role indicator */}
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full
        bg-cyan-500/10 border border-cyan-500/30 mb-8">
        <span className="w-2 h-2 rounded-full bg-[var(--cyan)] animate-pulse" />
        <span className="text-xs font-mono text-[var(--cyan)] tracking-widest uppercase">
          You are Player X
        </span>
      </div>

      <h2 className="text-lg font-bold uppercase tracking-widest text-white/70 mb-2 font-display">
        Waiting for Opponent
      </h2>
      <p className="text-sm text-white/35 mb-8 font-mono">
        Share the Room ID below with your friend
      </p>

      {/* Room ID display */}
      <div
        className="relative glass-card p-6 mb-4 cursor-pointer group
          hover:border-[var(--cyan)] transition-all duration-200"
        style={{ borderColor: "rgba(0,245,255,0.2)" }}
        onClick={handleCopy}
        title="Click to copy"
      >
        <p className="text-xs text-white/30 uppercase tracking-widest font-mono mb-2">
          Room ID
        </p>
        <div className="room-id-display">{roomId}</div>
        <div className={`absolute bottom-2 right-3 text-xs font-mono transition-all duration-200
          ${copied ? "text-green-400 opacity-100" : "text-white/25 opacity-0 group-hover:opacity-100"}`}>
          {copied ? "✓ Copied!" : "Click to copy"}
        </div>
      </div>

      {/* Animated waiting dots */}
      <div className="flex items-center justify-center gap-2 my-8">
        <div className="waiting-dots flex items-center gap-2">
          <span style={{ background: "var(--cyan)", boxShadow: "0 0 6px var(--cyan)" }} />
          <span style={{ background: "var(--cyan)", boxShadow: "0 0 6px var(--cyan)" }} />
          <span style={{ background: "var(--cyan)", boxShadow: "0 0 6px var(--cyan)" }} />
        </div>
      </div>

      <p className="text-xs text-white/25 font-mono mb-8">
        Game will start automatically when your friend joins
      </p>

      <button className="btn-ghost" onClick={onLeave}>
        ← Cancel & Leave
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAYING SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function PlayingScreen({ gameState, playerRole, roomId, onCellClick, onPlayAgain, onLeave }) {
  const { board, turn, status, winner, winLine = [] } = gameState;
  const isFinished = status === "finished";
  const isYourTurn = turn === playerRole && !isFinished;
  const opponentRole = playerRole === "X" ? "O" : "X";

  // ── Derive status message ────────────────────────────────────────────────
  const getStatusContent = () => {
    if (isFinished) {
      if (winner === "draw") {
        return { label: "It's a Draw!", color: "text-white/80", dotClass: "" };
      }
      const youWon = winner === playerRole;
      return {
        label: youWon ? "You Win! 🏆" : "You Lose",
        color: youWon
          ? playerRole === "X" ? "text-neon-cyan" : "text-neon-purple"
          : "text-white/50",
        dotClass: "",
      };
    }
    if (isYourTurn) {
      return {
        label: "Your Turn",
        badgeClass: "your-turn",
        dotClass: "cyan",
      };
    }
    return {
      label: "Friend's Turn",
      badgeClass: "friend-turn",
      dotClass: "purple",
    };
  };

  const statusContent = getStatusContent();

  return (
    <div className="glass-card p-6 animate-fade-in">
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono font-bold tracking-widest
            ${playerRole === "X" ? "text-neon-cyan" : "text-neon-purple"}`}>
            {playerRole === "X" ? "[ X ]" : "[ O ]"}
          </span>
          <span className="text-xs text-white/25 font-mono uppercase tracking-wide">
            You
          </span>
        </div>
        <div className="text-xs font-mono text-white/20 tracking-widest">
          {roomId}
        </div>
        <button className="btn-ghost text-xs py-1 px-3" onClick={onLeave}>
          Leave
        </button>
      </div>

      {/* Status badge */}
      <div className="text-center mb-6">
        {isFinished ? (
          <div className={`text-2xl font-black font-display tracking-wide animate-scale-in
            ${statusContent.color}`}
            style={{ animation: isFinished ? "winnerGlow 1.5s ease-in-out infinite alternate" : "none" }}>
            {statusContent.label}
          </div>
        ) : (
          <div className={`status-badge ${statusContent.badgeClass} mx-auto`}>
            <span className={`pulse-dot ${statusContent.dotClass}`} />
            {statusContent.label}
          </div>
        )}
      </div>

      {/* Score/role strip */}
      <div className="flex items-center justify-between mb-5 px-2">
        <PlayerTag role="X" isActive={turn === "X" && !isFinished} isYou={playerRole === "X"} />
        <div className="text-white/15 font-mono text-sm">vs</div>
        <PlayerTag role="O" isActive={turn === "O" && !isFinished} isYou={playerRole === "O"} />
      </div>

      {/* The Board */}
      <div className="grid grid-cols-3 gap-2.5 mb-6">
        {board.map((cell, i) => {
          const isWinningCell = winLine.includes(i);
          const cellWinClass = isWinningCell
            ? cell === "X"
              ? "winning-cell-X"
              : "winning-cell-O"
            : "";

          return (
            <button
              key={i}
              className={`board-cell h-24 sm:h-28
                ${cell ? "cell-taken" : ""}
                ${isFinished ? "game-over" : ""}
                ${cellWinClass}`}
              onClick={() => onCellClick(i)}
              aria-label={`Cell ${i + 1}${cell ? `, ${cell}` : ""}`}
              disabled={!!cell || isFinished || !isYourTurn}
            >
              {cell && (
                <CellSymbol symbol={cell} isWinning={isWinningCell} />
              )}
              {/* Hover ghost */}
              {!cell && isYourTurn && !isFinished && (
                <span className={`absolute inset-0 flex items-center justify-center
                  text-3xl font-black opacity-0 hover:opacity-20 transition-opacity
                  font-display
                  ${playerRole === "X" ? "text-[var(--cyan)]" : "text-[var(--purple)]"}`}>
                  {playerRole}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Game-over actions */}
      {isFinished && (
        <div className="space-y-3 animate-slide-up">
          <button className="btn-cyan" onClick={onPlayAgain}>
            ↺ Play Again
          </button>
          <button className="btn-ghost w-full" onClick={onLeave}>
            Leave Room
          </button>
        </div>
      )}

      {/* Turn indicator footer */}
      {!isFinished && (
        <p className="text-center text-xs font-mono text-white/20 mt-2">
          {isYourTurn
            ? `Place your ${playerRole} on the board`
            : `Waiting for opponent's move…`}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/** Renders X or O with neon glow inside a cell */
function CellSymbol({ symbol, isWinning }) {
  const isCyan = symbol === "X";
  const color = isCyan ? "var(--cyan)" : "var(--purple)";
  const glowSm = isCyan
    ? "0 0 8px var(--cyan), 0 0 20px rgba(0,245,255,0.4)"
    : "0 0 8px var(--purple), 0 0 20px rgba(191,0,255,0.4)";
  const glowLg = isCyan
    ? "0 0 12px var(--cyan), 0 0 40px rgba(0,245,255,0.6)"
    : "0 0 12px var(--purple), 0 0 40px rgba(191,0,255,0.6)";

  return (
    <span
      className="text-4xl sm:text-5xl font-black font-display animate-scale-in select-none"
      style={{
        color,
        textShadow: isWinning ? glowLg : glowSm,
      }}
    >
      {symbol}
    </span>
  );
}

/** Player tag chip showing role, active indicator, and "You" label */
function PlayerTag({ role, isActive, isYou }) {
  const isCyan = role === "X";
  const activeColor = isCyan ? "var(--cyan)" : "var(--purple)";
  const dimBg = isCyan
    ? "rgba(0,245,255,0.08)"
    : "rgba(191,0,255,0.08)";
  const dimBorder = isCyan
    ? "rgba(0,245,255,0.25)"
    : "rgba(191,0,255,0.25)";

  return (
    <div
      className="flex flex-col items-center gap-1 px-5 py-2 rounded-xl transition-all duration-300"
      style={{
        background: isActive ? dimBg : "transparent",
        border: `1px solid ${isActive ? dimBorder : "transparent"}`,
      }}
    >
      <span
        className="text-2xl font-black font-display"
        style={{
          color: activeColor,
          textShadow: isActive ? `0 0 10px ${activeColor}` : "none",
          opacity: isActive ? 1 : 0.35,
        }}
      >
        {role}
      </span>
      {isYou && (
        <span
          className="text-xs font-mono tracking-widest uppercase"
          style={{ color: isActive ? activeColor : "rgba(255,255,255,0.2)" }}
        >
          You
        </span>
      )}
    </div>
  );
}
