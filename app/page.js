"use client";

// app/page.js
// ─────────────────────────────────────────────────────────────────────────────
// NeonX Immersive Gaming Suite — Full-Screen Adaptive Hub
// Features: Firebase Google Auth, Dynamic Catalog, Multi-User Core Mesh,
// Unlimited Peer Commentary channels, and Coordinated Text Broadcasting.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react";
import { db } from "@/lib/firebase";
import { getApp } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { ref, set, get, onValue, off, update, push, serverTimestamp } from "firebase/database";
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

  // Dedicated Chat & Participant Active Trackers
  const [chatMessages, setChatMessages] = useState([]);
  const [activeMembers, setActiveMembers] = useState({});
  const [currentMessage, setCurrentMessage] = useState("");

  const listenerRef = useRef(null);
  const authInstance = useRef(null);

  // Initialize Safe Frontend Client Auth Protocol
  useEffect(() => {
    if (typeof window !== "undefined") {
      const auth = getAuth(getApp());
      authInstance.current = auth;
      
      const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
        if (user) {
          setUserProfile({
            uid: user.uid,
            name: user.displayName || "Anonymous Player",
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
      triggerDiagnosticError("Google entry closed or popup blocked.");
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
      triggerDiagnosticError("Signout stream execution failure.");
    }
  };

  // Synchronize Text Chat Channels and Active Room Registry
  const wireRoomSubServices = useCallback((targetId, currentIdentity) => {
    // 1. Text Messages Synced Link
    const msgRef = ref(db, `rooms/${targetId}/global_chat`);
    onValue(msgRef, (snapshot) => {
      if (snapshot.exists()) {
        setChatMessages(Object.values(snapshot.val()));
      } else {
        setChatMessages([]);
      }
    });

    // 2. Map Dynamic Roster Node
    const trackingKey = currentIdentity.name.replace(/[.#$/\[\]]/g, "_") + "_" + currentIdentity.uid.substring(0,4);
    const membershipNode = ref(db, `rooms/${targetId}/participants/${trackingKey}`);
    set(membershipNode, {
      name: currentIdentity.name,
      avatar: currentIdentity.avatar,
      role: playerRole || "SPECTATOR"
    });

    // 3. Keep Track of Active Users Node
    onValue(ref(db, `rooms/${targetId}/participants`), (snapshot) => {
      if (snapshot.exists()) setActiveMembers(snapshot.val());
    });

    // Trigger explicit exit strategy mapping on network drop
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        update(ref(db, `rooms/${targetId}/participants/${trackingKey}`), null);
      });
    }
  }, [playerRole]);

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
      wireRoomSubServices(baseId, userProfile);
      setAppState(HUB_STATE.WAITING);
    } catch (err) {
      triggerDiagnosticError("Database synchronized synchronization failure.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyGateCode = async () => {
    const inputCode = gateInput.trim().toUpperCase();
    if (!inputCode || inputCode.length < 9) {
      triggerDiagnosticError("Invalid code gateway validation lengths.");
      return;
    }

    setIsLoading(true);
    setError("");
    const targetBaseId = inputCode.substring(3);

    try {
      const snapshot = await get(ref(db, `rooms/${targetBaseId}`));
      if (!snapshot.exists()) {
        triggerDiagnosticError("Active room vector matrix offline.");
        setIsLoading(false);
        return;
      }

      const serverRoom = snapshot.val();

      if (inputCode === serverRoom.playingCode) {
        if (serverRoom.status !== "waiting") {
          triggerDiagnosticError(" Khiladi places are locked and full.");
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
        wireRoomSubServices(targetBaseId, userProfile);

      } else if (inputCode === serverRoom.guestCode) {
        setRoomId(targetBaseId);
        setPlayerRole("SPECTATOR");
        subscribeToRoomLiveSync(targetBaseId, "SPECTATOR");
        wireRoomSubServices(targetBaseId, userProfile);
      } else {
        triggerDiagnosticError("Gateway key matching exception.");
        setIsLoading(false);
      }
    } catch (err) {
      triggerDiagnosticError("Handshake packet signature verification timeout.");
      setIsLoading(false);
    }
  };

  const handleBroadcastMessage = (e) => {
    e.preventDefault();
    if (!currentMessage.trim() || !roomId) return;

    const chatChannelNode = ref(db, `rooms/${roomId}/global_chat`);
    const packetRef = push(chatChannelNode);
    set(packetRef, {
      sender: userProfile.name,
      avatar: userProfile.avatar,
      text: currentMessage.trim(),
      timestamp: Date.now()
    });
    setCurrentMessage("");
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
      triggerDiagnosticError("Matrix step execution dropped.");
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
      triggerDiagnosticError("Re-initialization stack tracking failed.");
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
    setChatMessages([]);
    setActiveMembers({});
  };

  if (isLoading && appState === HUB_STATE.AUTH) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center w-full">
        <span className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-300 relative overflow-hidden">
      
      {/* UNIVERSAL APPLICATION HUD PROFILE NAVIGATION */}
      {userProfile && (
        <header className="w-full px-8 h-20 flex justify-between items-center z-40 border-b border-slate-200/60 dark:border-slate-800/50 sticky top-0 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setAppState(HUB_STATE.STORE)}>
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tracking-wider font-display">NEONX</span>
            <span className="text-[9px] bg-indigo-50 dark:bg-indigo-950 border border-indigo-100 dark:border-indigo-900 px-2.5 py-0.5 rounded-md font-extrabold text-indigo-600 dark:text-indigo-400 tracking-widest uppercase">PRO</span>
          </div>

          <div className="relative">
            <button 
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 focus:outline-none p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900/60 transition"
            >
              <img src={userProfile.avatar} alt="Google Node Avatar" className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 object-cover shadow-inner" />
              <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showProfileMenu ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showProfileMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 z-50 animate-scale-in">
                  <div className="pb-3 border-b border-slate-100 dark:border-slate-800 mb-3 text-left">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Google Active Identity</span>
                    <p className="text-sm font-black text-slate-800 dark:text-slate-100 mt-1 truncate">{userProfile.name}</p>
                    <p className="text-xs text-slate-400 truncate mt-0.5 font-mono">{userProfile.email}</p>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="w-full py-2.5 px-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-sm"
                  >
                    Disconnect Profile
                  </button>
                </div>
              </>
            )}
          </div>
        </header>
      )}

      {/* SUB-SYSTEM CONTAINER CANVAS (FULL-SCREEN INTEGRATED VIEWPORTS) */}
      <div className="flex-1 w-full flex items-center justify-center relative overflow-hidden">
        {appState === HUB_STATE.AUTH && <AuthScreen onLogin={handleGoogleLogin} isLoading={isLoading} />}
        {appState === HUB_STATE.STORE && <AppStoreScreen onLock={() => setAppState(HUB_STATE.DASHBOARD)} />}
        {appState === HUB_STATE.DASHBOARD && <DashboardScreen onCreate={handleCreateDynamicRoom} gateInput={gateInput} setGateInput={setGateInput} onVerify={handleVerifyGateCode} isLoading={isLoading} />}
        {appState === HUB_STATE.WAITING && <WaitingScreen generatedKeys={generatedKeys} onLeave={handleLeaveRoom} />}
        {appState === HUB_STATE.PLAYING && gameState && <PlayingScreen gameState={gameState} playerRole={playerRole} roomId={roomId} onCellClick={handleCellClick} onPlayAgain={handlePlayAgain} onLeave={handleLeaveRoom} showError={triggerDiagnosticError} profile={userProfile} chatMessages={chatMessages} activeMembers={activeMembers} currentMessage={currentMessage} setCurrentMessage={setCurrentMessage} onSendChat={handleBroadcastMessage} />}
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. FULL CANVAS AUTH INTERFACE (NO CUTTING / FLOATING LOGOS)
// ─────────────────────────────────────────────────────────────────────────────
function AuthScreen({ onLogin, isLoading }) {
  return (
    <div className="w-full min-h-[calc(100vh-5rem)] flex flex-col items-center justify-center bg-white dark:bg-slate-950 px-6 animate-fade-in text-center">
      <div className="w-24 h-24 bg-gradient-to-tr from-indigo-600 to-indigo-700 dark:from-indigo-500 dark:to-indigo-600 rounded-3xl flex items-center justify-center mb-8 shadow-xl shadow-indigo-500/20">
        <span className="text-white text-5xl font-black font-display tracking-tighter">XO</span>
      </div>
      <h1 className="text-4xl font-black tracking-tight text-slate-800 dark:text-slate-100 sm:text-5xl">Universal Game Portal</h1>
      <p className="text-sm text-slate-400 dark:text-slate-500 mt-3 max-w-sm font-medium">Claim low-latency secure workspace sync tokens mapping directly via Google accounts</p>
      
      <button
        onClick={onLogin}
        disabled={isLoading}
        className="mt-10 w-full max-w-sm py-4 px-6 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-base rounded-2xl transition flex items-center justify-center gap-3 shadow-lg"
      >
        {isLoading ? <span className="w-5 h-5 border-2 border-white dark:border-slate-900 border-t-transparent rounded-full animate-spin" /> : "Sign In via Google Secure Auth"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. APP STORE GRID CANVAS VIEWPORTS
// ─────────────────────────────────────────────────────────────────────────────
function AppStoreScreen({ onLock }) {
  return (
    <div className="w-full min-h-[calc(100vh-5rem)] max-w-6xl px-8 flex flex-col justify-center py-12 animate-fade-in text-left">
      <div className="mb-10">
        <h2 className="text-4xl font-black tracking-tight text-slate-800 dark:text-slate-100">Application Catalog</h2>
        <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Boot highly modular decentralized gaming logic nodes dynamically</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <div 
          onClick={onLock}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-6 rounded-3xl hover:border-indigo-500 dark:hover:border-indigo-400 cursor-pointer shadow-sm hover:shadow-2xl transition-all duration-300 group relative"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 font-black text-2xl text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform">
              XO
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">TicTacToe Pro</h3>
              <p className="text-xs text-slate-400">Mesh Audio System Integrated</p>
            </div>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-4 border-t border-slate-50 dark:border-slate-800/40 pt-4 line-clamp-3">
            Deploy dynamic rooms splitting credentials into Khiladi Key and Spectator Feeds with native synchronized serverless infrastructure layers.
          </p>
          <div className="mt-6 text-sm font-bold text-indigo-600 dark:text-indigo-400 flex justify-end group-hover:translate-x-1 transition-transform">Initialize Console →</div>
        </div>

        <div className="bg-slate-100/40 dark:bg-slate-900/20 border border-dashed border-slate-200 dark:border-slate-800/80 rounded-3xl flex items-center justify-center text-center p-8 opacity-50">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Dynamic App Stream Node Slot Empty</p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. INTERNAL TELEMETRY CONSOLE PANEL
// ─────────────────────────────────────────────────────────────────────────────
function DashboardScreen({ onCreate, gateInput, setGateInput, onVerify, isLoading }) {
  return (
    <div className="w-full min-h-[calc(100vh-5rem)] flex items-center justify-center px-6 animate-scale-in">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl shadow-xl text-center">
        <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900 px-3 py-1 rounded-full">XO Module Deployment</span>
        <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 mt-4">Room Management</h2>
        <p className="text-xs text-slate-400 mt-1 mb-8">Mount decentralized real-time sessions instantly</p>

        <div className="space-y-4">
          <button onClick={onCreate} disabled={isLoading} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition shadow-md flex items-center justify-center">
            {isLoading ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Deploy Matrix Engine Room"}
          </button>
          
          <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase tracking-widest my-4">
            <div className="h-px bg-slate-100 dark:bg-slate-800 flex-1" />
            <span>or inject code parameters</span>
            <div className="h-px bg-slate-100 dark:bg-slate-800 flex-1" />
          </div>

          <div className="flex gap-2">
            <input type="text" placeholder="ACCESS KEY (PL- / CM-)" maxLength={11} value={gateInput} onChange={(e) => setGateInput(e.target.value.toUpperCase())} className="flex-1 px-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 rounded-xl outline-none font-mono text-center text-sm uppercase tracking-wider" />
            <button onClick={onVerify} disabled={isLoading || gateInput.trim().length < 9} className="px-6 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 rounded-xl transition font-black">→</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. SYNC DISPATCH PANEL TERMINAL
// ─────────────────────────────────────────────────────────────────────────────
function WaitingScreen({ generatedKeys, onLeave }) {
  return (
    <div className="w-full min-h-[calc(100vh-5rem)] flex items-center justify-center px-6 animate-scale-in">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl shadow-xl text-center">
        <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-1">Matrix Gateway Active</h2>
        <p className="text-xs text-slate-400 mb-6">Distribute channels keys to bind interface roles</p>

        <div className="space-y-4 mb-8 text-left">
          <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl">
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">1. Player Key Gateway (Slots: 2)</span>
            <div className="text-2xl font-mono font-black text-slate-800 dark:text-slate-100 mt-1 select-all tracking-wider">{generatedKeys.playingKey}</div>
          </div>
          <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl">
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">2. Live Commentary Feed Key (Unlimited)</span>
            <div className="text-2xl font-mono font-black text-slate-800 dark:text-slate-100 mt-1 select-all tracking-wider">{generatedKeys.guestKey}</div>
          </div>
        </div>

        <button onClick={onLeave} className="w-full py-3.5 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 border border-slate-200 text-slate-500 font-bold rounded-xl transition">Abort Broadcaster</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. EDGE-TO-EDGE INTEGRATED GAME ENGINE WORKSPACE + BROADCAST MATRICES
// ─────────────────────────────────────────────────────────────────────────────
function PlayingScreen({ 
  gameState, playerRole, roomId, onCellClick, onPlayAgain, onLeave, showError, profile,
  chatMessages, activeMembers, currentMessage, setCurrentMessage, onSendChat 
}) {
  const { board, turn, status, winner, winLine = [], playingCode, guestCode } = gameState;
  const isFinished = status === "finished";
  const isSpectator = playerRole === "SPECTATOR";
  const isYourTurn = turn === playerRole && !isFinished && !isSpectator;

  const [isMicOn, setIsMicOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  // Active Dynamic Commentary Mesh System (WebRTC)
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

        // Event Handshake Triggers
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
        showError("Microphone hardware layer allocation failed.");
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
    <div className="w-full h-[calc(100vh-5rem)] grid grid-cols-1 lg:grid-cols-4 bg-white dark:bg-slate-950 transition-colors animate-fade-in">
      
      {/* COLUMN 1: INTERACTIVE GAME GRID CONTROL CANVAS (Take 2 Columns) */}
      <div className="lg:col-span-2 border-r border-slate-200/50 dark:border-slate-900/60 p-6 flex flex-col justify-between overflow-y-auto">
        
        {/* Top Control Header strip */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-900">
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200/40 dark:border-slate-800">
            <span className={`w-2.5 h-2.5 rounded-full ${isSpectator ? "bg-amber-500 animate-pulse" : playerRole === "X" ? "bg-indigo-600" : "bg-rose-500"}`} />
            <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">
              {isSpectator ? "Live Commentator Profile" : `Khiladi Node: ${playerRole}`}
            </span>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/40 p-1 rounded-xl border border-slate-200/60 dark:border-slate-800/80">
            <button onClick={toggleLocalMicStream} className={`p-2 rounded-lg transition-all active:scale-95 ${isMicOn ? "bg-emerald-500 text-white shadow" : "bg-slate-200 dark:bg-slate-800 text-slate-400 line-through"}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
            <button onClick={toggleLocalSpeakerAudio} className={`p-2 rounded-lg transition-all active:scale-95 ${isSpeakerOn ? "bg-indigo-600 text-white shadow" : "bg-slate-200 dark:bg-slate-800 text-slate-400 line-through"}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            </button>
          </div>

          <button onClick={handleLeaveRoom} className="text-xs font-extrabold text-rose-500 bg-rose-50 dark:bg-rose-950/20 px-4 py-2 rounded-xl border border-rose-100 dark:border-rose-900/50 hover:bg-rose-100 transition">Leave Hub</button>
        </div>

        {/* Dynamic State Announcement Headers */}
        <div className="my-6 text-center">
          {isSpectator && (
            <div className="w-full text-center py-2.5 mb-4 bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-black text-xs tracking-widest rounded-xl">
              🎥 SPECTATOR MULTI-CAST AUDIO ROUTE CONNECTED
            </div>
          )}

          {isFinished ? (
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl">
              <span className="text-xs font-bold uppercase text-slate-400 block mb-1">Session Closed</span>
              <div className="text-xl font-black text-slate-800 dark:text-slate-200">
                {winner === "draw" ? "🤝 Match Draw Payload" : winner === playerRole ? "🎉 You Won the Session Matrix! 🏆" : isSpectator ? `Victor Declared: Node ${winner.toUpperCase()}` : "💀 Execution Terminal Defeat"}
              </div>
            </div>
          ) : (
            <div className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm border transition-all
              ${isYourTurn ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 text-emerald-700 dark:text-emerald-400" : "bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-500"}`}>
              <span className={`w-2 h-2 rounded-full ${isYourTurn ? "bg-emerald-500 animate-pulse" : "bg-slate-300 dark:bg-slate-700"}`} />
              {isSpectator ? `Live Sync Action: Turn Player ${turn}` : isYourTurn ? "Your Strategy Matrix Window Open" : `Awaiting Remote Stream Strategy (${turn})`}
            </div>
          )}
        </div>

        {/* Immersive Responsive XO Play Grid */}
        <div className="grid grid-cols-3 gap-3 bg-slate-100 dark:bg-slate-900/60 p-3 rounded-3xl border border-slate-200 dark:border-slate-800/80 aspect-square max-w-md mx-auto w-full">
          {board.map((cell, i) => {
            const isWinningCell = winLine.includes(i);
            return (
              <button
                key={i}
                className={`w-full h-full bg-white dark:bg-slate-900 border border-slate-200/40 dark:border-slate-800/60 rounded-2xl font-black flex items-center justify-center transition-all relative
                  ${!cell && isYourTurn ? "hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 cursor-pointer active:scale-95" : "cursor-default"}
                  ${isWinningCell ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 shadow-inner" : ""}`}
                onClick={() => onCellClick(i)}
                disabled={!!cell || isFinished || !isYourTurn || isSpectator}
              >
                {cell === "X" && <span className="text-5xl font-black text-indigo-600 dark:text-indigo-400 animate-scale-in">X</span>}
                {cell === "O" && <span className="text-5xl font-black text-rose-500 dark:text-rose-400 animate-scale-in">O</span>}
              </button>
            );
          })}
        </div>

        {isFinished && !isSpectator && (
          <button className="w-full mt-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition shadow-md" onClick={onPlayAgain}>
            ↺ Re-Initialize Grid Matrix
          </button>
        )}
      </div>

      {/* COLUMN 2: REAL-TIME SECURED LIVE TOKENS & ACTIVE USERS PROFILE LIST */}
      <div className="border-r border-slate-200/50 dark:border-slate-900/60 p-6 flex flex-col gap-6 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/10">
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-3">Live Session Access Keys</span>
          <div className="space-y-2">
            <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col">
              <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Player Access Token</span>
              <span className="text-sm font-mono font-black text-slate-800 dark:text-slate-100 select-all mt-0.5 tracking-wider">{playingCode}</span>
            </div>
            <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col">
              <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Guest Commentary Token</span>
              <span className="text-sm font-mono font-black text-slate-800 dark:text-slate-100 select-all mt-0.5 tracking-wider">{guestCode}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-3">Connected Members ({Object.keys(activeMembers).length})</span>
          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {Object.values(activeMembers).map((member, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-xl shadow-sm transition hover:scale-[1.01]">
                <div className="flex items-center gap-3 min-w-0">
                  <img src={member.avatar} alt="Peer Avatar" className="w-8 h-8 rounded-lg border border-slate-100 dark:border-slate-800 object-cover bg-slate-50" />
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">{member.name}</p>
                    <p className="text-[10px] text-slate-400 font-medium truncate uppercase tracking-wider mt-0.5">{member.role === "SPECTATOR" ? "🎙️ Commentary Guest" : `🕹️ Player [ ${member.role} ]`}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* COLUMN 3: GLOBAL OPEN TEXT CHAT CONSOLE BROADCASING (1 Column space) */}
      <div className="p-6 flex flex-col h-full bg-white dark:bg-slate-900/20 overflow-hidden">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-4 border-b border-slate-100 dark:border-slate-900 pb-2">Global Live Chat Hub</span>
        
        {/* Messages Stream Layer */}
        <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1 flex flex-col min-h-0">
          {chatMessages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-center text-xs text-slate-400 dark:text-slate-600 font-medium">
              No transmission logs recorded.<br />Initialize chat packets below.
            </div>
          ) : (
            chatMessages.map((msg, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-left animate-slide-up">
                <img src={msg.avatar} alt="" className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200/30 object-cover shrink-0 mt-0.5" />
                <div className="min-w-0 bg-slate-50 dark:bg-slate-900 border border-slate-200/40 dark:border-slate-800 p-2.5 rounded-2xl rounded-tl-none">
                  <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 truncate">{msg.sender}</p>
                  <p className="text-xs text-slate-700 dark:text-slate-300 break-words mt-0.5 leading-relaxed font-medium">{msg.text}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input Message Dispatcher Form */}
        <form onSubmit={handleBroadcastMessage} className="flex gap-2 border-t border-slate-100 dark:border-slate-900 pt-3 shrink-0">
          <input 
            type="text" 
            placeholder="Broadcast chat packet..." 
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            className="flex-1 px-4 py-3 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-indigo-500 transition-colors"
          />
          <button type="submit" disabled={!currentMessage.trim()} className="px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:text-slate-400 text-white font-bold rounded-xl text-xs transition active:scale-95">
            Send
          </button>
        </form>
      </div>

    </div>
  );
}
