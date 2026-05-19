"use client";

// app/page.js
// ─────────────────────────────────────────────────────────────────────────────
// NeonX Next-Gen Platform Engine — Universal Desktop Canvas
// Features: Real Firebase Google Auth, Top-Right Identity Hub, App Store View,
// Dual-Key Room Gateways (PL & CM), and Peer Voice Commentary Mesh.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react";
import { db } from "@/lib/firebase";
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { ref, set, get, onValue, off, update, remove } from "firebase/database";
import { generateRoomId, checkWinner, checkDraw, getInitialRoomState } from "@/lib/gameUtils";

const HUB_STATE = {
  AUTH: "AUTH",
  STORE: "STORE",
  DASHBOARD: "DASHBOARD",
  WAITING: "WAITING",
  PLAYING: "PLAYING",
};

export default function GamingHub() {
  const [appState, setAppState] = useState(HUB_STATE.AUTH);
  const [userProfile, setUserProfile] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [playerRole, setPlayerRole] = useState(null); // "X" | "O" | "SPECTATOR"
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [gateInput, setGateInput] = useState("");
  const [errorShake, setErrorShake] = useState(false);
  const [generatedKeys, setGeneratedKeys] = useState({ playingKey: "", guestKey: "" });

  const listenerRef = useRef(null);
  const authInstance = useRef(null);

  // Initialize Firebase Auth Safely for Next.js Client Engine
  useEffect(() => {
    if (typeof window !== "undefined") {
      const auth = getAuth(getApp());
      authInstance.current = auth;
      
      const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
        if (user) {
          setUserProfile({
            name: user.displayName,
            email: user.email,
            avatar: user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`,
          });
          setAppState(HUB_STATE.STORE);
        } else {
          setUserProfile(null);
          setAppState(HUB_STATE.AUTH);
        }
        setIsLoading(false);
      });

      return () => unsubscribeAuth();
    }
  }, []);

  const detachListener = useCallback(() => {
    if (listenerRef.current) {
      off(listenerRef.current);
      listenerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => detachListener();
  }, [detachListener]);

  const triggerDiagnosticError = useCallback((message) => {
    setError(message);
    setErrorShake(true);
    setTimeout(() => setErrorShake(false), 400);
    setTimeout(() => setError(""), 4000);
  }, []);

  const handleGoogleLogin = async () => {
    if (!authInstance.current) return;
    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(authInstance.current, provider);
    } catch (err) {
      console.error(err);
      triggerDiagnosticError("Google authentication intercept or popup closed.");
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!authInstance.current) return;
    try {
      await signOut(authInstance.current);
      setShowProfileMenu(false);
      setGateInput("");
    } catch (err) {
      triggerDiagnosticError("Sign out execution sequence failed.");
    }
  };

  const subscribeToRoomLiveSync = useCallback((id, assignedRole) => {
    detachListener();
    const roomRef = ref(db, `rooms/${id}`);
    listenerRef.current = roomRef;

    onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      setGameState(data);

      if (assignedRole === "SPECTATOR") {
        setAppState(HUB_STATE.PLAYING);
      } else if (data.status === "playing" || data.status === "finished") {
        setAppState(HUB_STATE.PLAYING);
      }
    });
  }, [detachListener]);

  const handleCreateDynamicRoom = async () => {
    setIsLoading(true);
    setError("");

    try {
      const baseId = generateRoomId(); 
      const pKey = `PL-${baseId}`; 
      const gKey = `CM-${baseId}`; 
      
      const initialSchema = {
        ...getInitialRoomState(),
        playingCode: pKey,
        guestCode: gKey,
        status: "waiting",
        connections: { slotsTaken: 1 }
      };

      await set(ref(db, `rooms/${baseId}`), initialSchema);

      setRoomId(baseId);
      setPlayerRole("X");
      setGeneratedKeys({ playingKey: pKey, guestKey: gKey });
      setGameState(initialSchema);
      subscribeToRoomLiveSync(baseId, "X");
      setAppState(HUB_STATE.WAITING);
    } catch (err) {
      triggerDiagnosticError("Database synchronized link failure.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyGateCode = async () => {
    const inputCode = gateInput.trim().toUpperCase();
    if (!inputCode || inputCode.length < 9) {
      triggerDiagnosticError("Invalid code block array parameters.");
      return;
    }

    setIsLoading(true);
    setError("");
    const targetBaseId = inputCode.substring(3);

    try {
      const snapshot = await get(ref(db, `rooms/${targetBaseId}`));
      if (!snapshot.exists()) {
        triggerDiagnosticError("Target core server room space offline.");
        setIsLoading(false);
        return;
      }

      const serverRoom = snapshot.val();

      if (inputCode === serverRoom.playingCode) {
        if (serverRoom.status !== "waiting") {
          triggerDiagnosticError("Active playing connection matrix locked.");
          setIsLoading(false);
          return;
        }

        await update(ref(db, `rooms/${targetBaseId}`), { 
          status: "playing",
          "connections/slotsTaken": 2
        });

        setRoomId(targetBaseId);
        setPlayerRole("O");
        subscribeToRoomLiveSync(targetBaseId, "O");

      } else if (inputCode === serverRoom.guestCode) {
        setRoomId(targetBaseId);
        setPlayerRole("SPECTATOR");
        subscribeToRoomLiveSync(targetBaseId, "SPECTATOR");
      } else {
        triggerDiagnosticError("Verification mismatch credential anomaly.");
        setIsLoading(false);
      }
    } catch (err) {
      triggerDiagnosticError("Gateway verification cluster handshake timed out.");
      setIsLoading(false);
    }
  };

  const handleCellClick = async (index) => {
    if (!gameState || playerRole === "SPECTATOR") return;
    const { board, turn, status, winner } = gameState;

    if (status === "finished" || winner !== "" || turn !== playerRole || board[index] !== "") {
      return;
    }

    const newBoard = [...board];
    newBoard[index] = playerRole;

    const nextTurn = playerRole === "X" ? "O" : "X";
    const result = checkWinner(newBoard);
    const isDraw = !result && checkDraw(newBoard);

    const dataPayload = {
      board: newBoard,
      turn: nextTurn,
      status: result || isDraw ? "finished" : "playing",
      winner: result ? result.winner : isDraw ? "draw" : "",
      winLine: result ? result.line : [],
    };

    try {
      await update(ref(db, `rooms/${roomId}`), dataPayload);
    } catch (err) {
      triggerDiagnosticError("Dynamic matrix grid step rejected.");
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
      triggerDiagnosticError("Re-initialization network handshake blocked.");
    }
  };

  const handleLeaveRoom = () => {
    detachListener();
    setAppState(HUB_STATE.DASHBOARD);
    setRoomId("");
    setPlayerRole(null);
    setGameState(null);
    setGateInput("");
    setError("");
  };

  if (isLoading && appState === HUB_STATE.AUTH) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <span className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-300 relative overflow-x-hidden">
      
      {/* GLOBAL TOP HUD PANEL */}
      {userProfile && (
        <header className="w-full max-w-7xl mx-auto px-6 h-20 flex justify-between items-center z-40 border-b border-slate-200/50 dark:border-slate-800/40 sticky top-0 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setAppState(HUB_STATE.STORE)}>
            <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 tracking-wider">NEONX</span>
            <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900 px-2 py-0.5 rounded-md font-bold text-indigo-600 dark:text-indigo-400">CORE</span>
          </div>

          {/* TOP RIGHT PROFILE NAV PLATFORM */}
          <div className="relative">
            <button 
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 focus:outline-none p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 transition"
            >
              <img src={userProfile.avatar} alt="User Space Avatar" className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white object-cover shadow-sm" />
              <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showProfileMenu ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showProfileMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-4 z-50 animate-scale-in">
                  <div className="pb-3 border-b border-slate-100 dark:border-slate-800 mb-3 text-left">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Signed User</p>
                    <p className="text-sm font-black text-slate-800 dark:text-slate-200 mt-1 truncate">{userProfile.name}</p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{userProfile.email}</p>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="w-full py-2.5 px-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Disconnect Profile
                  </button>
                </div>
              </>
            )}
          </div>
        </header>
      )}

      {/* CORE DISPLAY WINDOW (Full Canvas Area) */}
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-center relative py-6">
        {error && (
          <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl bg-red-50 dark:bg-red-950/90 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-sm font-medium shadow-xl flex items-center gap-2 ${errorShake ? "animate-bounce" : ""}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {error}
          </div>
        )}

        {appState === HUB_STATE.AUTH && <AuthScreen onLogin={handleGoogleLogin} isLoading={isLoading} />}
        {appState === HUB_STATE.STORE && <AppStoreScreen onLock={() => setAppState(HUB_STATE.DASHBOARD)} />}
        {appState === HUB_STATE.DASHBOARD && <DashboardScreen onCreate={handleCreateDynamicRoom} gateInput={gateInput} setGateInput={setGateInput} onVerify={handleVerifyGateCode} isLoading={isLoading} />}
        {appState === HUB_STATE.WAITING && <WaitingScreen generatedKeys={generatedKeys} onLeave={handleLeaveRoom} />}
        {appState === HUB_STATE.PLAYING && gameState && <PlayingScreen gameState={gameState} playerRole={playerRole} roomId={roomId} onCellClick={handleCellClick} onPlayAgain={handlePlayAgain} onLeave={handleLeaveRoom} showError={triggerDiagnosticError} profile={userProfile} />}
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. SECURE GOOGLE HUB AUTHORIZATION
// ─────────────────────────────────────────────────────────────────────────────
function AuthScreen({ onLogin, isLoading }) {
  return (
    <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl shadow-2xl text-center animate-fade-in">
      <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-md shadow-indigo-500/20">
        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 009 11V7a2 2 0 00-2-2H6a2 2 0 00-2 2v6a13.978 13.978 0 003.046 8.357M15 11c0 3.517 1.009 6.799 2.753 9.571m3.44-2.04l-.054-.09A13.916 13.916 0 0015 11V7a2 2 0 002-2h1a2 2 0 002 2v6a13.978 13.978 0 00-3.046 8.357m-3.333-13.417z" />
        </svg>
      </div>
      <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100">Universal Game Platform</h1>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 mb-8 uppercase tracking-widest font-semibold">Secure Entry Matrix</p>
      
      <button
        onClick={onLogin}
        disabled={isLoading}
        className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold rounded-xl transition flex items-center justify-center gap-3 shadow-md"
      >
        {isLoading ? (
          <span className="w-5 h-5 border-2 border-white dark:border-slate-900 border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.866-3.577-7.866-8s3.536-8 7.866-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C17.955 2.192 15.34 1 12.24 1 6.033 1 12.24 6.033 1 12.24s5.033 11.24 11.24 11.24c6.478 0 10.793-4.537 10.793-10.99 0-.743-.078-1.31-.174-1.866H12.24z"/>
            </svg>
            Google Safe SignIn
          </>
        )}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. NEW APPLICATION DISPLAY STORE CATALOG
// ─────────────────────────────────────────────────────────────────────────────
function AppStoreScreen({ onLock }) {
  return (
    <div className="w-full max-w-4xl px-2 animate-fade-in text-left">
      <div className="mb-8">
        <h2 className="text-3xl font-black tracking-tight text-slate-800 dark:text-slate-100">Application Showcase</h2>
        <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">Select a secure node matrix to boot micro-services</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* TicTacToe Premium Modular Launcher */}
        <div 
          onClick={onLock}
          className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 p-6 rounded-3xl hover:border-indigo-500 dark:hover:border-indigo-400 cursor-pointer shadow-sm hover:shadow-xl transition-all duration-300 group relative overflow-hidden"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 font-black text-2xl text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform">
              XO
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                TicTacToe Pro Live
                <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md font-bold">READY</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">P2P Voice Commentary System Built-in</p>
            </div>
          </div>
          <p className="text-xs text-slate-400/80 dark:text-slate-500 line-clamp-2 mt-4 border-t border-slate-50 dark:border-slate-800/50 pt-3">
            Multi-user room coordination engine allowing unlimited real-time commentary audio streams with isolated playing role matrices.
          </p>
          <div className="mt-4 flex justify-end text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform">
            Boot Dynamic Module →
          </div>
        </div>

        {/* Locked Dummy Apps to expand dashboard portfolio later */}
        <div className="bg-slate-100/50 dark:bg-slate-900/30 border border-dashed border-slate-200 dark:border-slate-800/80 p-6 rounded-3xl flex items-center justify-center text-center opacity-60">
          <div>
            <svg className="w-6 h-6 mx-auto text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <p className="text-sm font-bold text-slate-500">More Apps Coming Soon</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. INTERNAL MODULE TERMINAL
// ─────────────────────────────────────────────────────────────────────────────
function DashboardScreen({ onCreate, gateInput, setGateInput, onVerify, isLoading }) {
  return (
    <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl shadow-2xl animate-scale-in">
      <div className="text-center mb-8">
        <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900 px-3 py-1 rounded-full">TicTacToe Node Terminal</span>
        <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-4">Room Synchronization</h2>
        <p className="text-xs text-slate-400 mt-1">Configure live telemetry parameters to attach game views</p>
      </div>

      <div className="space-y-5">
        <button
          onClick={onCreate}
          disabled={isLoading}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition shadow-md shadow-indigo-500/10 flex items-center justify-center gap-2"
        >
          {isLoading ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Initialize Game Matrix"}
        </button>

        <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase tracking-widest my-3">
          <div className="h-px bg-slate-100 dark:bg-slate-800 flex-1" />
          <span>or join gateway</span>
          <div className="h-px bg-slate-100 dark:bg-slate-800 flex-1" />
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="ENTER ACCESS KEY (PL- / CM-)"
            maxLength={11}
            value={gateInput}
            onChange={(e) => setGateInput(e.target.value.toUpperCase())}
            className="flex-1 px-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 rounded-xl outline-none font-mono text-center uppercase tracking-wider text-sm transition"
          />
          <button
            onClick={onVerify}
            disabled={isLoading || gateInput.trim().length < 9}
            className="px-5 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 rounded-xl transition font-black text-lg"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. ROOM VERIFICATION DISPATCH
// ─────────────────────────────────────────────────────────────────────────────
function WaitingScreen({ generatedKeys, onLeave }) {
  return (
    <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl shadow-2xl text-center animate-scale-in">
      <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-1">Matrix Pipeline Secured</h2>
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-6">Distribute credential channels to lock roles</p>

      <div className="space-y-4 mb-6 text-left">
        <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl">
          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">1. Player Access Token</span>
          <div className="text-xl font-mono font-black text-slate-800 dark:text-slate-200 mt-1 select-all tracking-wider">{generatedKeys.playingKey}</div>
        </div>

        <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl">
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">2. Commentator Live Feed Token</span>
          <div className="text-xl font-mono font-black text-slate-800 dark:text-slate-200 mt-1 select-all tracking-wider">{generatedKeys.guestKey}</div>
        </div>
      </div>

      <button onClick={onLeave} className="w-full py-3.5 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-xl transition">
        Abort Broadcast Session
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. MATCHPLAY MATRIX & P2P MULTI-USER VOICE STREAMING
// ─────────────────────────────────────────────────────────────────────────────
function PlayingScreen({ gameState, playerRole, roomId, onCellClick, onPlayAgain, onLeave, showError, profile }) {
  const { board, turn, status, winner, winLine = [] } = gameState;
  const isFinished = status === "finished";
  const isSpectator = playerRole === "SPECTATOR";
  const isYourTurn = turn === playerRole && !isFinished && !isSpectator;

  const [isMicOn, setIsMicOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  const localStreamRef = useRef(null);
  const connectedPeersRef = useRef({}); 
  const meshSignalingRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined" || !profile) return;

    const myAudioId = profile.name + "_" + Math.random().toString(36).substring(2, 5);
    const peerRegistryRef = ref(db, `rooms/${roomId}/voice_mesh/${myAudioId}`);

    const initMeshAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;

        await set(peerRegistryRef, { active: true });

        const wholeMeshRef = ref(db, `rooms/${roomId}/voice_mesh`);
        meshSignalingRef.current = wholeMeshRef;

        onValue(wholeMeshRef, (snapshot) => {
          if (!snapshot.exists()) return;
          const currentNodes = snapshot.val();

          Object.keys(currentNodes).forEach((remoteNodeId) => {
            if (remoteNodeId === myAudioId || connectedPeersRef.current[remoteNodeId]) return;

            const pc = new RTCPeerConnection({
              iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
            });

            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            const audioEl = document.createElement("audio");
            audioEl.autoplay = true;

            pc.ontrack = (e) => {
              if (e.streams[0]) audioEl.srcObject = e.streams[0];
            };

            pc.onicecandidate = (e) => {
              if (e.candidate) {
                set(ref(db, `rooms/${roomId}/voice_signals/${remoteNodeId}/${myAudioId}/${Date.now()}`), JSON.stringify(e.candidate));
              }
            };

            connectedPeersRef.current[remoteNodeId] = { pc, audioEl };

            if (myAudioId > remoteNodeId) {
              pc.createOffer().then(async (offer) => {
                await pc.setLocalDescription(offer);
                await set(ref(db, `rooms/${roomId}/voice_handshakes/${remoteNodeId}/${myAudioId}`), JSON.stringify(offer));
              });
            }
          });
        });

        onValue(ref(db, `rooms/${roomId}/voice_handshakes/${myAudioId}`), async (snapshot) => {
          if (!snapshot.exists()) return;
          const incomingOffers = snapshot.val();

          Object.keys(incomingOffers).forEach(async (senderId) => {
            const peerObj = connectedPeersRef.current[senderId];
            if (!peerObj) return;
            const pc = peerObj.pc;

            if (pc.signalingState === "stable") return;
            
            await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(incomingOffers[senderId])));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await set(ref(db, `rooms/${roomId}/voice_handshakes/${senderId}/${myAudioId}_reply`), JSON.stringify(answer));
          });
        });

        onValue(ref(db, `rooms/${roomId}/voice_handshakes`), (snapshot) => {
          if (!snapshot.exists()) return;
          const data = snapshot.val();
          Object.keys(data).forEach(targetId => {
            Object.keys(data[targetId]).forEach(async (key) => {
              if (key.endsWith("_reply") && key.startsWith(myAudioId)) {
                const originalSenderId = targetId;
                const peerObj = connectedPeersRef.current[originalSenderId];
                if (peerObj && peerObj.pc.signalingState === "have-local-offer") {
                  await peerObj.pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(data[targetId][key])));
                }
              }
            });
          });
        });

        onValue(ref(db, `rooms/${roomId}/voice_signals/${myAudioId}`), (snapshot) => {
          if (!snapshot.exists()) return;
          const foreignIce = snapshot.val();
          Object.keys(foreignIce).forEach(senderId => {
            const peerObj = connectedPeersRef.current[senderId];
            if (!peerObj) return;
            Object.values(foreignIce[senderId]).forEach(candidateStr => {
              try { peerObj.pc.addIceCandidate(new RTCIceCandidate(JSON.parse(candidateStr))); } catch(e){}
            });
          });
        });

      } catch (err) {
        showError("Microphone device integration blocked.");
      }
    };

    initMeshAudio();

    return () => {
      remove(peerRegistryRef);
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
      Object.values(connectedPeersRef.current).forEach(peer => peer.pc.close());
      if (meshSignalingRef.current) off(meshSignalingRef.current);
      off(ref(db, `rooms/${roomId}/voice_handshakes`));
      off(ref(db, `rooms/${roomId}/voice_signals/${myAudioId}`));
    };
  }, [roomId, profile, showError]);

  const toggleLocalMicStream = () => {
    const target = !isMicOn;
    setIsMicOn(target);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => t.enabled = target);
    }
  };

  const toggleLocalSpeakerAudio = () => {
    const target = !isSpeakerOn;
    setIsSpeakerOn(target);
    Object.values(connectedPeersRef.current).forEach(peer => {
      peer.audioEl.muted = !target;
    });
  };

  return (
    <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-2xl animate-fade-in mx-auto">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg">
          <span className={`w-2 h-2 rounded-full ${isSpectator ? "bg-amber-500 animate-pulse" : playerRole === "X" ? "bg-indigo-600" : "bg-rose-500"}`} />
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
            {isSpectator ? "Live Commentator" : `You: Player ${playerRole}`}
          </span>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
          <button onClick={toggleLocalMicStream} className={`p-2 rounded-lg transition-all active:scale-90 ${isMicOn ? "bg-emerald-500 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-400 line-through"}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
          <button onClick={toggleLocalSpeakerAudio} className={`p-2 rounded-lg transition-all active:scale-90 ${isSpeakerOn ? "bg-indigo-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-400 line-through"}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          </button>
        </div>

        <button onClick={onLeave} className="text-xs font-bold text-slate-400 hover:text-rose-500 transition">Leave</button>
      </div>

      {isSpectator && (
        <div className="w-full text-center py-2 mb-4 bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 rounded-xl text-[10px] font-black tracking-widest text-amber-600 dark:text-amber-400 uppercase">
          🎥 SPECTATOR LIVE STREAMS ACTIVE
        </div>
      )}

      <div className="text-center mb-6">
        {isFinished ? (
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Session Complete</span>
            <div className="text-lg font-black text-slate-800 dark:text-slate-200">
              {winner === "draw" ? "🤝 Peace Draw Match" : winner === playerRole ? "🎉 You Won the Session! 🏆" : isSpectator ? `Winner Declared: ${winner.toUpperCase()}` : "💀 System Defeat / Terminated"}
            </div>
          </div>
        ) : (
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition
            ${isYourTurn ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 text-emerald-700" : "bg-slate-50 dark:bg-slate-950 text-slate-500"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isYourTurn ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`} />
            {isSpectator ? `Live Action Tracker: Turn ${turn}` : isYourTurn ? "Your Execution Turn Open" : `Awaiting Remote Sync (${turn})`}
          </div>
        )}
      </div>

      <div className="flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800/60 rounded-2xl p-3 mb-6">
        <div className={`flex-1 text-center py-2 rounded-xl transition ${turn === "X" && !isFinished ? "bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 shadow-sm" : ""}`}>
          <span className="font-black text-indigo-600 dark:text-indigo-400 block text-lg">X</span>
          <span className="text-[10px] text-slate-400 uppercase font-bold">{playerRole === "X" ? "You" : "Opponent"}</span>
        </div>
        <div className="w-px h-8 bg-slate-200 dark:bg-slate-800" />
        <div className={`flex-1 text-center py-2 rounded-xl transition ${turn === "O" && !isFinished ? "bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 shadow-sm" : ""}`}>
          <span className="font-black text-rose-500 dark:text-rose-400 block text-lg">O</span>
          <span className="text-[10px] text-slate-400 uppercase font-bold">{playerRole === "O" ? "You" : "Opponent"}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-950 p-2 rounded-2xl border border-slate-200 dark:border-slate-800">
        {board.map((cell, i) => {
          const isWinningCell = winLine.includes(i);
          return (
            <button
              key={i}
              className={`h-24 sm:h-28 bg-white dark:bg-slate-900 border border-slate-200/30 dark:border-slate-800/60 rounded-xl font-black flex items-center justify-center transition-all relative
                ${!cell && isYourTurn ? "hover:bg-indigo-50/40 cursor-pointer" : "cursor-default"}
                ${isWinningCell ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 shadow-inner" : ""}`}
              onClick={() => onCellClick(i)}
              disabled={!!cell || isFinished || !isYourTurn || isSpectator}
            >
              {cell === "X" && <span className="text-4xl font-black text-indigo-600 dark:text-indigo-400 animate-scale-in">X</span>}
              {cell === "O" && <span className="text-4xl font-black text-rose-500 dark:text-rose-400 animate-scale-in">O</span>}
            </button>
          );
        })}
      </div>

      {isFinished && !isSpectator && (
        <button className="w-full mt-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition shadow-sm" onClick={onPlayAgain}>
          Re-Initialize Match Grid
        </button>
      )}
    </div>
  );
}
