"use client";

// app/page.js
// ─────────────────────────────────────────────────────────────────────────────
// NeonX Universal Gaming Platform — Adaptive Next-Gen Hub
// Features: Google Simulated Authentication, Dual-Key Gateways (PL & CM),
// Unlimited Peer Commentary Mesh & PUBG Live Diagnostics Controller.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react";
import { db } from "@/lib/firebase";
import { ref, set, get, onValue, off, update, remove } from "firebase/database";
import { generateRoomId, checkWinner, checkDraw, getInitialRoomState } from "@/lib/gameUtils";

const STATE_PANEL = {
  AUTH: "AUTH",
  DASHBOARD: "DASHBOARD",
  WAITING: "WAITING",
  PLAYING: "PLAYING",
};

export default function GamingHub() {
  const [appState, setAppState] = useState(STATE_PANEL.AUTH);
  const [userProfile, setUserProfile] = useState(null);
  const [roomId, setRoomId] = useState("");
  const [playerRole, setPlayerRole] = useState(null); // "X" | "O" | "SPECTATOR"
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [gateInput, setGateInput] = useState("");
  const [errorShake, setErrorShake] = useState(false);
  
  // Dual Key references generated on creation
  const [generatedKeys, setGeneratedKeys] = useState({ playingKey: "", guestKey: "" });

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

  const triggerDiagnosticError = useCallback((message) => {
    setError(message);
    setErrorShake(true);
    setTimeout(() => setErrorShake(false), 400);
    setTimeout(() => setError(""), 4000);
  }, []);

  // Simulating Google Secure Authentication Protocol
  const handleGoogleLogin = () => {
    setIsLoading(true);
    setTimeout(() => {
      setUserProfile({
        name: "Ayush Raj",
        email: "ayush@example.com",
        avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Ayush",
      });
      setAppState(STATE_PANEL.DASHBOARD);
      setIsLoading(false);
    }, 1200);
  };

  const handleLogout = () => {
    setUserProfile(null);
    setAppState(STATE_PANEL.AUTH);
    setGateInput("");
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
        setAppState(STATE_PANEL.PLAYING);
      } else if (data.status === "playing" || data.status === "finished") {
        setAppState(STATE_PANEL.PLAYING);
      }
    });
  }, [detachListener]);

  // Dual Gateway Engine: Generates separate keys for Players vs Commentators
  const handleCreateDynamicRoom = async () => {
    setIsLoading(true);
    setError("");

    try {
      const baseId = generateRoomId(); 
      const pKey = `PL-${baseId}`; // Alpha-Numeric Player Lock
      const gKey = `CM-${baseId}`; // Separate Identity Guest Code
      
      const initialSchema = {
        ...getInitialRoomState(),
        playingCode: pKey,
        guestCode: gKey,
        status: "waiting",
        connections: {
          slotsTaken: 1
        }
      };

      await set(ref(db, `rooms/${baseId}`), initialSchema);

      setRoomId(baseId);
      setPlayerRole("X");
      setGeneratedKeys({ playingKey: pKey, guestKey: gKey });
      setGameState(initialSchema);
      subscribeToRoomLiveSync(baseId, "X");
      setAppState(STATE_PANEL.WAITING);
    } catch (err) {
      console.error(err);
      triggerDiagnosticError("Database synchronization failed.");
    } finally {
      setIsLoading(false);
    }
  };

  // Unified Verification Box Input Logic
  const handleVerifyGateCode = async () => {
    const inputCode = gateInput.trim().toUpperCase();
    if (!inputCode || inputCode.length < 9) {
      triggerDiagnosticError("Invalid Gateway Code Format.");
      return;
    }

    setIsLoading(true);
    setError("");
    const targetBaseId = inputCode.substring(3); // Extract root space id

    try {
      const snapshot = await get(ref(db, `rooms/${targetBaseId}`));
      if (!snapshot.exists()) {
        triggerDiagnosticError("Active room terminal not found.");
        setIsLoading(false);
        return;
      }

      const serverRoom = snapshot.val();

      if (inputCode === serverRoom.playingCode) {
        // Player Entry Authorization
        if (serverRoom.status !== "waiting") {
          triggerDiagnosticError("Player slots are locked or full.");
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
        // Spectator / Commentary Entry Authorization
        setRoomId(targetBaseId);
        setPlayerRole("SPECTATOR");
        subscribeToRoomLiveSync(targetBaseId, "SPECTATOR");
      } else {
        triggerDiagnosticError("Code mismatch. Check credentials.");
        setIsLoading(false);
      }
    } catch (err) {
      triggerDiagnosticError("Network handshake timeout.");
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
      triggerDiagnosticError("State submission intercepted.");
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
      triggerDiagnosticError("Reset command rejected.");
    }
  };

  const handleLeaveRoom = () => {
    detachListener();
    setAppState(STATE_PANEL.DASHBOARD);
    setRoomId("");
    setPlayerRole(null);
    setGameState(null);
    setGateInput("");
    setError("");
  };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 py-12 transition-colors duration-300">
      <div className="w-full max-w-md relative">
        {error && (
          <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl bg-red-50 dark:bg-red-950/90 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-sm font-medium shadow-xl flex items-center gap-2 ${errorShake ? "animate-bounce" : ""}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {error}
          </div>
        )}

        {appState === STATE_PANEL.AUTH && <AuthScreen onLogin={handleGoogleLogin} isLoading={isLoading} />}
        {appState === STATE_PANEL.DASHBOARD && <DashboardScreen profile={userProfile} onLogout={handleLogout} onCreate={handleCreateDynamicRoom} gateInput={gateInput} setGateInput={setGateInput} onVerify={handleVerifyGateCode} isLoading={isLoading} />}
        {appState === STATE_PANEL.WAITING && <WaitingScreen generatedKeys={generatedKeys} onLeave={handleLeaveRoom} />}
        {appState === STATE_PANEL.PLAYING && gameState && <PlayingScreen gameState={gameState} playerRole={playerRole} roomId={roomId} onCellClick={handleCellClick} onPlayAgain={handlePlayAgain} onLeave={handleLeaveRoom} showError={triggerDiagnosticError} profile={userProfile} />}
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. SECURE SIMULATED GOOGLE GATEWAY
// ─────────────────────────────────────────────────────────────────────────────
function AuthScreen({ onLogin, isLoading }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl shadow-xl text-center">
      <div className="w-16 h-16 bg-indigo-600/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
        <svg className="w-8 h-8 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Gaming Engine Terminal</h1>
      <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 mb-8">Sign in with Google identity to claim your global index</p>
      
      <button
        onClick={onLogin}
        disabled={isLoading}
        className="w-full py-3 px-4 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium rounded-xl transition flex items-center justify-center gap-3 text-slate-700 dark:text-slate-200 shadow-sm"
      >
        {isLoading ? (
          <span className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.866-3.577-7.866-8s3.536-8 7.866-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C17.955 2.192 15.34 1 12.24 1 6.033 1 1 6.033 1 12.24s5.033 11.24 11.24 11.24c6.478 0 10.793-4.537 10.793-10.99 0-.743-.078-1.31-.174-1.866H12.24z"/>
            </svg>
            Continue with Google
          </>
        )}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. CENTRAL GAMING DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function DashboardScreen({ profile, onLogout, onCreate, gateInput, setGateInput, onVerify, isLoading }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xl">
      {/* Identity Profile Strip */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
        <div className="flex items-center gap-3">
          <img src={profile?.avatar} alt="User Avatar" className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-950 p-1 border border-slate-200 dark:border-slate-800" />
          <div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">{profile?.name}</h4>
            <span className="text-xs font-medium text-emerald-500 flex items-center gap-1">● Online Node</span>
          </div>
        </div>
        <button onClick={onLogout} className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-400 hover:text-rose-500 rounded-xl transition">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>

      <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-900 mb-6">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Available Apps</span>
        <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200/60 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="font-black text-xl text-indigo-600 bg-indigo-50 dark:bg-indigo-950 p-2 rounded-lg">XO</div>
            <div>
              <h5 className="text-sm font-bold text-slate-800 dark:text-slate-200">TicTacToe Pro</h5>
              <p className="text-[11px] text-slate-400">P2P Voice Commentary Built-in</p>
            </div>
          </div>
          <span className="text-xs bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-md font-semibold">v3.0</span>
        </div>
      </div>

      <div className="space-y-4">
        <button
          onClick={onCreate}
          disabled={isLoading}
          className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition shadow-md flex items-center justify-center gap-2"
        >
          {isLoading ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "+ Initialize Game Room"}
        </button>

        <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-widest my-2">
          <div className="h-px bg-slate-100 dark:bg-slate-800 flex-1" />
          <span>or entry terminal</span>
          <div className="h-px bg-slate-100 dark:bg-slate-800 flex-1" />
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="ENTER GATEWAY CODE (PL- / CM-)"
            maxLength={11}
            value={gateInput}
            onChange={(e) => setGateInput(e.target.value.toUpperCase())}
            className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 rounded-xl outline-none font-mono text-center uppercase text-sm tracking-wider"
          />
          <button
            onClick={onVerify}
            disabled={isLoading || gateInput.trim().length < 9}
            className="px-5 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 rounded-xl transition font-bold"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. SECURE GATEWAY WAITING CONTROL (Shows Dual Keys)
// ─────────────────────────────────────────────────────────────────────────────
function WaitingScreen({ generatedKeys, onLeave }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xl text-center">
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-1">Room Initiated</h2>
      <p className="text-sm text-slate-400 dark:text-slate-500 mb-6">Distribute targeted keys to lock permissions</p>

      <div className="space-y-3 mb-6">
        {/* Play Key Node */}
        <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-xl text-left">
          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">1. Player Key (Max 2 users)</span>
          <div className="text-xl font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5 select-all">{generatedKeys.playingKey}</div>
        </div>

        {/* Guest Key Node */}
        <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-xl text-left">
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">2. Commentator Key (Unlimited Audits)</span>
          <div className="text-xl font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5 select-all">{generatedKeys.guestKey}</div>
        </div>
      </div>

      <button onClick={onLeave} className="w-full py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-medium rounded-xl transition">
        Abort Terminal
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. LIVE MATCHPLAY ENGINE + MULTI-USER AUDIO STREAM MESH
// ─────────────────────────────────────────────────────────────────────────────
function PlayingScreen({ gameState, playerRole, roomId, onCellClick, onPlayAgain, onLeave, showError, profile }) {
  const { board, turn, status, winner, winLine = [] } = gameState;
  const isFinished = status === "finished";
  const isSpectator = playerRole === "SPECTATOR";
  const isYourTurn = turn === playerRole && !isFinished && !isSpectator;

  const [isMicOn, setIsMicOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  const localStreamRef = useRef(null);
  const connectedPeersRef = useRef({}); // Tracks mesh of dynamic callers
  const meshSignalingRef = useRef(null);

  // Advanced Dynamic Coordinated Mesh Networking Architecture
  useEffect(() => {
    if (typeof window === "undefined" || !profile) return;

    const myAudioId = profile.name + "_" + Math.random().toString(36).substring(2, 5);
    const peerRegistryRef = ref(db, `rooms/${roomId}/voice_mesh/${myAudioId}`);

    const initMeshAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;

        // Register identity into the live mesh directory
        await set(peerRegistryRef, { active: true });

        // Listen for external entries joining the channel
        const wholeMeshRef = ref(db, `rooms/${roomId}/voice_mesh`);
        meshSignalingRef.current = wholeMeshRef;

        onValue(wholeMeshRef, (snapshot) => {
          if (!snapshot.exists()) return;
          const currentNodes = snapshot.val();

          Object.keys(currentNodes).forEach((remoteNodeId) => {
            if (remoteNodeId === myAudioId || connectedPeersRef.current[remoteNodeId]) return;

            // Establish full isolated p2p route inside the mesh channel
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

            // Coordination Protocol triggers offer/answer based on lexicographical priority
            if (myAudioId > remoteNodeId) {
              pc.createOffer().then(async (offer) => {
                await pc.setLocalDescription(offer);
                await set(ref(db, `rooms/${roomId}/voice_handshakes/${remoteNodeId}/${myAudioId}`), JSON.stringify(offer));
              });
            }
          });
        });

        // Event listener dealing with handshakes
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

        // Listener for handshake answers back
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

        // Syncing remote ICE nodes inside network structure
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
        showError("Mic access refused. Commentary track disabled.");
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
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xl animate-fade-in">
      {/* Top Controller Panel */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg">
          <span className={`w-2 h-2 rounded-full ${isSpectator ? "bg-amber-500 animate-pulse" : playerRole === "X" ? "bg-indigo-600" : "bg-rose-500"}`} />
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            {isSpectator ? "Guest Engine" : `Role: Player ${playerRole}`}
          </span>
        </div>

        {/* Real-time PUBG Audio Diagnostics Switches */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
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

        <button onClick={onLeave} className="text-xs font-semibold text-slate-500 hover:text-rose-500 flex items-center gap-1">
          Leave
        </button>
      </div>

      {/* Role State Broadcast */}
      {isSpectator && (
        <div className="w-full text-center py-2 mb-4 bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/30 rounded-xl text-xs font-bold tracking-widest text-amber-600 dark:text-amber-400 uppercase">
          🎥 LIVE SPECTATOR / COMMENTATOR
        </div>
      )}

      {/* Active Room Announcements */}
      <div className="text-center mb-6">
        {isFinished ? (
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Session Complete</span>
            <div className="text-xl font-bold text-slate-800 dark:text-slate-200">
              {winner === "draw" ? "🤝 Peaceful Draw Transaction" : winner === playerRole ? "🎉 You Dominated the Matrix! 🏆" : isSpectator ? `Winner: Player ${winner.toUpperCase()}` : "💀 Node Terminated / Defeat"}
            </div>
          </div>
        ) : (
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
            ${isYourTurn ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 text-emerald-700" : "bg-slate-50 dark:bg-slate-950 text-slate-500"}`}>
            <span className={`w-2 h-2 rounded-full ${isYourTurn ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`} />
            {isSpectator ? `Live Action: Turn ${turn}` : isYourTurn ? "Your Execution Window Open" : `Awaiting Remote Move (${turn})`}
          </div>
        )}
      </div>

      {/* Synchronized Graphic Board Grid */}
      <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-950 p-2 rounded-2xl border border-slate-200 dark:border-slate-800/60 mb-6">
        {board.map((cell, i) => {
          const isWinningCell = winLine.includes(i);
          return (
            <button
              key={i}
              className={`h-24 sm:h-28 bg-white dark:bg-slate-900 border border-slate-200/40 dark:border-slate-800/60 rounded-xl font-black flex items-center justify-center transition-all relative
                ${!cell && isYourTurn ? "hover:bg-indigo-50/40 cursor-pointer" : "cursor-default"}
                ${isWinningCell ? "bg-emerald-50 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-800 shadow-inner" : ""}`}
              onClick={() => onCellClick(i)}
              disabled={!!cell || isFinished || !isYourTurn || isSpectator}
            >
              {cell === "X" && <span className="text-4xl font-extrabold text-indigo-600 dark:text-indigo-400 animate-scale-in">X</span>}
              {cell === "O" && <span className="text-4xl font-extrabold text-rose-500 dark:text-rose-400 animate-scale-in">O</span>}
            </button>
          );
        })}
      </div>

      {isFinished && !isSpectator && (
        <button className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition shadow-sm flex items-center justify-center gap-2" onClick={onPlayAgain}>
          ↺ Re-Initialize Board
        </button>
      )}
    </div>
  );
}
