"use client";

// app/page.js
// ─────────────────────────────────────────────────────────────────────────────
// NeonX — Real-time Multiplayer Tic-Tac-Toe + WebRTC Voice Call (PUBG Style)
// System Adaptive Theme Supported (Light / Dark automatic match)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react";
import { db } from "@/lib/firebase";
import { ref, set, get, onValue, off, update } from "firebase/database";
import { generateRoomId, checkWinner, checkDraw, getInitialRoomState } from "@/lib/gameUtils";

const SCREEN = {
  HOME: "HOME",
  WAITING: "WAITING",
  PLAYING: "PLAYING",
};

export default function Home() {
  const [screen, setScreen] = useState(SCREEN.HOME);
  const [roomId, setRoomId] = useState("");
  const [playerRole, setPlayerRole] = useState(null); // "X" | "O"
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [joinInput, setJoinInput] = useState("");
  const [errorShake, setErrorShake] = useState(false);

  const listenerRef = useRef(null);

  const detachListener = useCallback(() => {
    if (listenerRef.current) {
      off(listenerRef.current);
      listenerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => detachListener();
  }, [detachListener]);

  const showError = useCallback((message) => {
    setError(message);
    setErrorShake(true);
    setTimeout(() => setErrorShake(false), 400);
    setTimeout(() => setError(""), 3500);
  }, []);

  const subscribeToRoom = useCallback(
    (id) => {
      detachListener();
      const roomRef = ref(db, `rooms/${id}`);
      listenerRef.current = roomRef;

      onValue(roomRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        setGameState(data);

        if (data.status === "playing" || data.status === "finished") {
          setScreen(SCREEN.PLAYING);
        }
      });
    },
    [detachListener]
  );

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

      await update(ref(db, `rooms/${id}`), { status: "playing" });

      setRoomId(id);
      setPlayerRole("O");
      subscribeToRoom(id);
    } catch (err) {
      console.error("Join room error:", err);
      showError("Failed to join room. Check your connection.");
      setIsLoading(false);
    }
  };

  const handleCellClick = async (index) => {
    if (!gameState) return;
    const { board, turn, status, winner } = gameState;

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

  const handleLeaveRoom = () => {
    detachListener();
    setScreen(SCREEN.HOME);
    setRoomId("");
    setPlayerRole(null);
    setGameState(null);
    setJoinInput("");
    setError("");
  };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 py-12 transition-colors duration-300">
      <div className="w-full max-w-md relative">
        {error && (
          <div
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl
              bg-red-50 dark:bg-red-950/90 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-sm font-medium
              shadow-xl flex items-center gap-2 transition-all duration-300
              ${errorShake ? "animate-bounce" : ""}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {error}
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
            showError={showError}
          />
        )}
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOME SCREEN (Adaptive)
// ─────────────────────────────────────────────────────────────────────────────
function HomeScreen({ joinInput, setJoinInput, onCreateRoom, onJoinRoom, isLoading }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.02)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] transition-all">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-2xl p-4 mb-4">
          <span className="text-4xl font-extrabold text-indigo-600 dark:text-indigo-400 tracking-tight">X</span>
          <span className="text-lg font-medium text-slate-300 dark:text-slate-700 mx-2">vs</span>
          <span className="text-4xl font-extrabold text-rose-500 dark:text-rose-400 tracking-tight">O</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">TicTacToe Online</h1>
        <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Play instantly with your friends via room links</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Start Fresh</label>
          <button
            className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 disabled:bg-indigo-400 text-white font-medium rounded-xl transition shadow-sm flex items-center justify-center gap-2"
            onClick={onCreateRoom}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create New Room
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-3 my-4">
          <div className="h-[1px] bg-slate-100 dark:bg-slate-800 flex-1"></div>
          <span className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-widest">or</span>
          <div className="h-[1px] bg-slate-100 dark:bg-slate-800 flex-1"></div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Join a Friend</label>
          <div className="flex gap-2">
            <input
              className="flex-1 px-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 dark:focus:border-indigo-400 focus:bg-white dark:focus:bg-slate-900 rounded-xl outline-none font-mono text-center uppercase tracking-widest text-slate-700 dark:text-slate-300 transition"
              type="text"
              placeholder="ENTER 6-DIGIT CODE"
              maxLength={6}
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
              disabled={isLoading}
            />
            <button
              className="px-5 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-slate-200 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white dark:text-slate-900 disabled:text-slate-400 font-medium rounded-xl transition flex items-center justify-center"
              onClick={onJoinRoom}
              disabled={isLoading || joinInput.trim().length !== 6}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WAITING SCREEN (Adaptive)
// ─────────────────────────────────────────────────────────────────────────────
function WaitingScreen({ roomId, onLeave }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.02)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] text-center animate-fade-in">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50 mb-6">
        <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-pulse" />
        <span className="text-xs font-medium text-indigo-700 dark:text-indigo-400 tracking-wide uppercase">You are Player X</span>
      </div>

      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-1">Waiting for Opponent</h2>
      <p className="text-sm text-slate-400 dark:text-slate-500 mb-6">Send this code to your friend to start playing</p>

      <div
        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-xl cursor-pointer group hover:bg-slate-100/70 dark:hover:bg-slate-900/70 transition relative"
        onClick={handleCopy}
      >
        <span className="text-xs text-slate-400 dark:text-slate-500 block uppercase font-semibold tracking-wider mb-1">Room Code</span>
        <div className="text-3xl font-mono font-bold tracking-widest text-slate-800 dark:text-slate-200">{roomId}</div>
        <div className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium flex items-center justify-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
          {copied ? "Copied to clipboard!" : "Click to copy code"}
        </div>
      </div>

      <div className="flex items-center justify-center gap-1.5 my-8">
        <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700 animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700 animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>

      <button className="w-full py-3 px-4 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-medium rounded-xl transition flex items-center justify-center gap-2" onClick={onLeave}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Cancel & Leave
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAYING SCREEN + WebRTC Audio (Adaptive)
// ─────────────────────────────────────────────────────────────────────────────
function PlayingScreen({ gameState, playerRole, roomId, onCellClick, onPlayAgain, onLeave, showError }) {
  const { board, turn, status, winner, winLine = [] } = gameState;
  const isFinished = status === "finished";
  const isYourTurn = turn === playerRole && !isFinished;

  // PUBG style voice hooks
  const [isMicOn, setIsMicOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const remoteAudioRef = useRef(null);

  // WebRTC Setup (Serverless configuration using generic STUN servers)
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Create a hidden audio element to stream opponent voice
    const audioNode = document.createElement("audio");
    audioNode.autoplay = true;
    remoteAudioRef.current = audioNode;

    const setupVoice = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;

        const pc = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
        });
        peerConnectionRef.current = pc;

        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        pc.ontrack = (event) => {
          if (remoteAudioRef.current && event.streams[0]) {
            remoteAudioRef.current.srcObject = event.streams[0];
          }
        };

        // Serverless signaling using existing Firebase Room schema
        const signalPath = playerRole === "X" ? "signalX" : "signalO";
        const listenPath = playerRole === "X" ? "signalO" : "signalX";

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            set(ref(db, `rooms/${roomId}/ice/${signalPath}/${Date.now()}`), JSON.stringify(event.candidate));
          }
        };

        if (playerRole === "X") {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await set(ref(db, `rooms/${roomId}/sdp/offer`), JSON.stringify(offer));
        } else {
          // Delay briefly to allow X offer initialization
          setTimeout(async () => {
            const snapshot = await get(ref(db, `rooms/${roomId}/sdp/offer`));
            if (snapshot.exists()) {
              await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(snapshot.val())));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              await set(ref(db, `rooms/${roomId}/sdp/answer`), JSON.stringify(answer));
            }
          }, 1000);
        }

        // Listen for connection states
        onValue(ref(db, `rooms/${roomId}/sdp/answer`), async (snapshot) => {
          if (playerRole === "X" && snapshot.exists() && pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(snapshot.val())));
          }
        });

        onValue(ref(db, `rooms/${roomId}/ice/${listenPath}`), (snapshot) => {
          if (snapshot.exists()) {
            const candidates = snapshot.val();
            Object.values(candidates).forEach(candStr => {
              try { pc.addIceCandidate(new RTCIceCandidate(JSON.parse(candStr))); } catch(e){}
            });
          }
        });

      } catch (err) {
        console.warn("Microphone access denied or audio device busy.");
        showError("Mic access needed for Voice Chat.");
      }
    };

    setupVoice();

    return () => {
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
      if (peerConnectionRef.current) peerConnectionRef.current.close();
      off(ref(db, `rooms/${roomId}/sdp/answer`));
      off(ref(db, `rooms/${roomId}/ice`));
    };
  }, [roomId, playerRole, showError]);

  // Handle PUBG Mic Mute (Stops audio output stream)
  const toggleMic = () => {
    const nextState = !isMicOn;
    setIsMicOn(nextState);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = nextState;
      });
    }
  };

  // Handle PUBG Speaker Mute (Mutes incoming streams locally)
  const toggleSpeaker = () => {
    const nextState = !isSpeakerOn;
    setIsSpeakerOn(nextState);
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = !nextState;
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.02)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] animate-fade-in">
      {/* Top Utility Bar */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg">
          <span className={`w-2 h-2 rounded-full ${playerRole === "X" ? "bg-indigo-600" : "bg-rose-500"}`} />
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">You: {playerRole}</span>
        </div>
        
        {/* PUBG Voice Control Panel */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200/60 dark:border-slate-800 shadow-inner">
          {/* Mic Button */}
          <button 
            onClick={toggleMic}
            className={`p-2 rounded-lg transition-all active:scale-90 ${isMicOn ? "bg-emerald-500 text-white shadow-sm" : "bg-slate-200 dark:bg-slate-800 text-slate-400 line-through"}`}
            title={isMicOn ? "Mute Mic" : "Unmute Mic"}
          >
            {isMicOn ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            )}
          </button>

          {/* Speaker Button */}
          <button 
            onClick={toggleSpeaker}
            className={`p-2 rounded-lg transition-all active:scale-90 ${isSpeakerOn ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-200 dark:bg-slate-800 text-slate-400 line-through"}`}
            title={isSpeakerOn ? "Mute Speaker" : "Unmute Speaker"}
          >
            {isSpeakerOn ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            )}
          </button>
        </div>

        <button className="text-xs font-medium text-slate-500 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-400 transition flex items-center gap-1" onClick={onLeave}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Leave
        </button>
      </div>

      {/* Modern Turn Badge / Winner Announcement */}
      <div className="text-center mb-6">
        {isFinished ? (
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1">Game Over</span>
            <div className="text-xl font-bold text-slate-800 dark:text-slate-200">
              {winner === "draw" ? "🤝 It's a peaceful draw!" : winner === playerRole ? "🎉 Amazing, You Won! 🏆" : "💀 Better luck next time!"}
            </div>
          </div>
        ) : (
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition
            ${isYourTurn ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400" : "bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900 text-slate-500 dark:text-slate-400"}`}>
            <span className={`w-2 h-2 rounded-full ${isYourTurn ? "bg-emerald-500 animate-pulse" : "bg-slate-300 dark:bg-slate-700"}`} />
            {isYourTurn ? "Your Turn to Move" : "Waiting for Friend's move"}
          </div>
        )}
      </div>

      {/* Scoreboard Strip */}
      <div className="flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800/60 rounded-xl p-3 mb-6">
        <div className={`flex-1 text-center py-1.5 rounded-lg transition ${turn === "X" && !isFinished ? "bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-sm" : ""}`}>
          <span className="font-bold text-indigo-600 dark:text-indigo-400 block text-lg">X</span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-medium">{playerRole === "X" ? "You" : "Friend"}</span>
        </div>
        <div className="w-px h-8 bg-slate-200 dark:bg-slate-800" />
        <div className={`flex-1 text-center py-1.5 rounded-lg transition ${turn === "O" && !isFinished ? "bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-sm" : ""}`}>
          <span className="font-bold text-rose-500 dark:text-rose-400 block text-lg">O</span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-medium">{playerRole === "O" ? "You" : "Friend"}</span>
        </div>
      </div>

      {/* Simple Clean Adaptive Board */}
      <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-950 p-2 rounded-2xl border border-slate-200/40 dark:border-slate-800">
        {board.map((cell, i) => {
          const isWinningCell = winLine.includes(i);
          return (
            <button
              key={i}
              className={`h-24 sm:h-28 bg-white dark:bg-slate-900 border border-slate-200/40 dark:border-slate-800/60 rounded-xl font-bold flex items-center justify-center transition-all relative
                ${!cell && isYourTurn && !isFinished ? "hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 cursor-pointer" : "cursor-default"}
                ${isWinningCell ? "bg-emerald-50 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-800 shadow-inner" : ""}`}
              onClick={() => onCellClick(i)}
              disabled={!!cell || isFinished || !isYourTurn}
            >
              {cell === "X" && <span className="text-4xl font-extrabold text-indigo-600 dark:text-indigo-400 animate-scale-in">X</span>}
              {cell === "O" && <span className="text-4xl font-extrabold text-rose-500 dark:text-rose-400 animate-scale-in">O</span>}
            </button>
          );
        })}
      </div>

      {/* Actions */}
      {isFinished && (
        <div className="mt-6 space-y-3">
          <button className="w-full py-3.5 px-4 bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white font-medium rounded-xl transition shadow-sm flex items-center justify-center gap-2" onClick={onPlayAgain}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 4.89M9 11l3 3L22 4" />
            </svg>
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}
