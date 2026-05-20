"use client";

// app/page.js
// ─────────────────────────────────────────────────────────────────────────────
// NeonX Immersive Gaming Suite — Cyberpunk Dark UI Edition
// Features: Dynamic Matrix Grid, Neon Aesthetics, HUD Interface, Auto 9-char Fix.
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
import { ref, set, get, onValue, off, update, push } from "firebase/database";
import { checkWinner, checkDraw, getInitialRoomState } from "@/lib/gameUtils";
import { VoiceMeshManager } from "@/lib/voiceMeshUtil";

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
  const [playerRole, setPlayerRole] = useState(null); 
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [gateInput, setGateInput] = useState("");
  const [generatedKeys, setGeneratedKeys] = useState({ playingKey: "", guestKey: "" });

  const [chatMessages, setChatMessages] = useState([]);
  const [activeMembers, setActiveMembers] = useState({});
  const [currentMessage, setCurrentMessage] = useState("");

  const listenerRef = useRef(null);
  const authInstance = useRef(null);
  const voiceManagerRef = useRef(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const auth = getAuth(getApp());
      authInstance.current = auth;
      
      const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
        if (user) {
          const profileData = {
            uid: user.uid,
            name: user.displayName || "Anonymous Player",
            email: user.email,
            avatar: user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`,
          };
          setUserProfile(profileData);
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
    if (voiceManagerRef.current) {
      voiceManagerRef.current.stopBroadcast();
      voiceManagerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => detachListener();
  }, [detachListener]);

  const triggerDiagnosticError = useCallback((message) => {
    setError(message);
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
      triggerDiagnosticError("Login Sequence Aborted.");
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
      triggerDiagnosticError("Disconnect failed.");
    }
  };

  const wireRoomSubServices = useCallback((targetId, currentIdentity, roleKey) => {
    if (!currentIdentity) return;

    const msgRef = ref(db, `rooms/${targetId}/global_chat`);
    onValue(msgRef, (snapshot) => {
      if (snapshot.exists()) {
        setChatMessages(Object.values(snapshot.val()));
      } else {
        setChatMessages([]);
      }
    });

    const trackingKey = currentIdentity.name.replace(/[.#$/\[\]]/g, "_") + "_" + currentIdentity.uid.substring(0,4);
    const membershipNode = ref(db, `rooms/${targetId}/participants/${trackingKey}`);
    
    set(membershipNode, {
      name: currentIdentity.name,
      avatar: currentIdentity.avatar,
      role: roleKey || "SPECTATOR"
    });

    onValue(ref(db, `rooms/${targetId}/participants`), (snapshot) => {
      if (snapshot.exists()) setActiveMembers(snapshot.val());
    });

    if (!voiceManagerRef.current) {
      voiceManagerRef.current = new VoiceMeshManager(db, targetId, currentIdentity, triggerDiagnosticError);
      voiceManagerRef.current.startBroadcast();
    }
  }, [triggerDiagnosticError]);

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

  const generateAlphaNumericId = () => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numbers = "0123456789";
    let alphaPart = "";
    let numericPart = "";
    for (let i = 0; i < 3; i++) {
      alphaPart += letters.charAt(Math.floor(Math.random() * letters.length));
      numericPart += numbers.charAt(Math.floor(Math.random() * numbers.length));
    }
    return alphaPart + numericPart;
  };

  const handleCreateDynamicRoom = async () => {
    if (!userProfile) return;
    setIsLoading(true);
    setError("");

    try {
      const baseId = generateAlphaNumericId(); 
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
      wireRoomSubServices(baseId, userProfile, "X");
      setAppState(HUB_STATE.WAITING);
    } catch (err) {
      triggerDiagnosticError("Matrix creation failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyGateCode = async () => {
    if (!userProfile) return;
    const inputCode = gateInput.trim().toUpperCase();
    
    // YAHAN 11 KI JAGAH 9 KAR DIYA HAI (FIXED)
    if (!inputCode || inputCode.length < 9) {
      triggerDiagnosticError("Invalid access token format.");
      return;
    }

    setIsLoading(true);
    setError("");
    const targetBaseId = inputCode.substring(3);

    try {
      const snapshot = await get(ref(db, `rooms/${targetBaseId}`));
      if (!snapshot.exists()) {
        triggerDiagnosticError("Server offline or not found.");
        setIsLoading(false);
        return;
      }

      const serverRoom = snapshot.val();

      if (inputCode === serverRoom.playingCode) {
        if (serverRoom.status !== "waiting") {
          triggerDiagnosticError("Lobby is full.");
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
        wireRoomSubServices(targetBaseId, userProfile, "O");

      } else if (inputCode === serverRoom.guestCode) {
        setRoomId(targetBaseId);
        setPlayerRole("SPECTATOR");
        subscribeToRoomLiveSync(targetBaseId, "SPECTATOR");
        wireRoomSubServices(targetBaseId, userProfile, "SPECTATOR");
      } else {
        triggerDiagnosticError("Invalid access sequence.");
        setIsLoading(false);
      }
    } catch (err) {
      triggerDiagnosticError("Network synchronization failed.");
      setIsLoading(false);
    }
  };

  const handleBroadcastMessage = (e) => {
    e.preventDefault();
    if (!currentMessage.trim() || !roomId || !userProfile) return;

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
      triggerDiagnosticError("Move execution failed.");
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
      triggerDiagnosticError("Re-initialization failed.");
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

  // GLOBAL DARK THEME WRAPPER
  return (
    <main className="min-h-screen w-full bg-[#09090b] text-gray-100 flex flex-col font-sans selection:bg-cyan-500/30 relative overflow-hidden">
      
      {/* Dynamic Background Glow */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-cyan-900/20 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-900/20 blur-[120px] rounded-full pointer-events-none"></div>

      {/* Global Error HUD */}
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500/10 border border-red-500/50 text-red-400 px-6 py-2 rounded-lg font-mono text-xs uppercase tracking-widest backdrop-blur-md shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse">
          ⚠️ {error}
        </div>
      )}

      {userProfile && (
        <header className="w-full px-8 h-20 flex justify-between items-center z-40 border-b border-white/5 bg-black/40 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setAppState(HUB_STATE.STORE)}>
            <div className="w-8 h-8 bg-cyan-500/10 border border-cyan-500/30 rounded-md flex items-center justify-center group-hover:bg-cyan-500/20 transition-all">
              <span className="text-cyan-400 font-black text-sm">NX</span>
            </div>
            <span className="text-xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500">NEON<span className="text-cyan-400">X</span></span>
          </div>

          <div className="relative">
            <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="flex items-center gap-2 hover:opacity-80 transition-opacity focus:outline-none">
              <img src={userProfile.avatar} alt="Profile" className="w-10 h-10 rounded-lg border border-white/10 object-cover bg-gray-900 shadow-[0_0_10px_rgba(255,255,255,0.05)]" />
            </button>
            {showProfileMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                <div className="absolute right-0 mt-3 w-64 bg-[#121214] border border-white/10 rounded-xl shadow-2xl p-4 z-50 backdrop-blur-xl">
                  <p className="text-sm font-bold text-gray-100 truncate">{userProfile.name}</p>
                  <p className="text-[10px] text-gray-500 truncate font-mono mt-1">{userProfile.email}</p>
                  <div className="h-px w-full bg-white/5 my-3"></div>
                  <button onClick={handleLogout} className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-bold rounded-lg transition-all tracking-wider uppercase">Disconnect</button>
                </div>
              </>
            )}
          </div>
        </header>
      )}

      <div className="flex-1 w-full flex items-center justify-center relative z-10">
        {appState === HUB_STATE.AUTH && <AuthScreen onLogin={handleGoogleLogin} isLoading={isLoading} />}
        {appState === HUB_STATE.STORE && <AppStoreScreen onLock={() => setAppState(HUB_STATE.DASHBOARD)} />}
        {appState === HUB_STATE.DASHBOARD && <DashboardScreen onCreate={handleCreateDynamicRoom} gateInput={gateInput} setGateInput={setGateInput} onVerify={handleVerifyGateCode} isLoading={isLoading} />}
        {appState === HUB_STATE.WAITING && <WaitingScreen generatedKeys={generatedKeys} onLeave={handleLeaveRoom} />}
        {appState === HUB_STATE.PLAYING && gameState && <PlayingScreen gameState={gameState} playerRole={playerRole} roomId={roomId} onCellClick={handleCellClick} onPlayAgain={handlePlayAgain} onLeave={handleLeaveRoom} profile={userProfile} chatMessages={chatMessages} activeMembers={activeMembers} currentMessage={currentMessage} setCurrentMessage={setCurrentMessage} onSendChat={handleBroadcastMessage} voiceManager={voiceManagerRef.current} />}
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GAMING THEMED UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function AuthScreen({ onLogin, isLoading }) {
  return (
    <div className="w-full flex flex-col items-center justify-center px-6 text-center">
      <div className="relative mb-8 group">
        <div className="absolute inset-0 bg-cyan-500 blur-3xl opacity-20 group-hover:opacity-40 transition-opacity duration-1000"></div>
        <div className="w-28 h-28 bg-[#121214] border border-cyan-500/30 rounded-3xl flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.15)] relative z-10">
          <span className="text-cyan-400 text-6xl font-black tracking-tighter">NX</span>
        </div>
      </div>
      <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl mb-2 uppercase">NeonX Protocol</h1>
      <p className="text-gray-400 font-mono text-sm mb-12 tracking-widest uppercase">Secure Identity Verification</p>
      
      <button onClick={onLogin} disabled={isLoading} className="relative overflow-hidden group w-full max-w-sm py-4 px-6 bg-[#121214] text-white font-bold rounded-xl border border-white/10 hover:border-cyan-500/50 transition-all duration-300 flex items-center justify-center gap-3 shadow-[0_0_0_rgba(6,182,212,0)] hover:shadow-[0_0_20px_rgba(6,182,212,0.2)]">
        <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
        <span className="tracking-widest uppercase text-xs">{isLoading ? "Connecting to server..." : "Initialize Session"}</span>
      </button>
    </div>
  );
}

function AppStoreScreen({ onLock }) {
  return (
    <div className="w-full max-w-5xl px-6 flex flex-col justify-center text-left">
      <div className="flex items-center gap-4 mb-10">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10"></div>
        <h2 className="text-xl font-black tracking-widest text-white uppercase font-mono">Select Module</h2>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10"></div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div onClick={onLock} className="bg-[#121214] border border-white/5 p-6 rounded-2xl cursor-pointer hover:border-cyan-500/50 transition-all duration-300 group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl group-hover:bg-cyan-500/20 transition-all"></div>
          
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-14 h-14 bg-black border border-cyan-500/30 rounded-xl flex items-center justify-center shadow-inner">
              <span className="font-black text-xl text-cyan-400">XO</span>
            </div>
            <div>
              <h3 className="text-lg font-black text-white tracking-wide">TicTacToe Core</h3>
              <p className="text-[10px] text-cyan-500 uppercase tracking-widest mt-1">Voice Mesh Enabled</p>
            </div>
          </div>
          
          <p className="text-xs text-gray-500 mt-6 pt-4 border-t border-white/5 font-mono leading-relaxed relative z-10">
            Deploy low-latency gaming matrix. Synchronized state vectors and real-time audio channels.
          </p>
          
          <div className="mt-6 text-[10px] font-black tracking-widest text-cyan-400 uppercase flex justify-end group-hover:translate-x-1 transition-transform relative z-10">
            Launch Instance →
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardScreen({ onCreate, gateInput, setGateInput, onVerify, isLoading }) {
  const handleInputChange = (e) => {
    let value = e.target.value.toUpperCase();
    if (value.startsWith("P") && !value.startsWith("PL-") && value.length >= 2) value = "PL-" + value.substring(1);
    else if (value.startsWith("C") && !value.startsWith("CM-") && value.length >= 2) value = "CM-" + value.substring(1);
    setGateInput(value);
  };

  const shouldSwitchToNumeric = gateInput.length >= 6 && (gateInput.startsWith("PL-") || gateInput.startsWith("CM-"));

  return (
    <div className="w-full flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-[#121214] border border-white/10 p-8 rounded-2xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-purple-500"></div>
        <h2 className="text-xl font-black text-white uppercase tracking-widest text-center mb-8 font-mono">Server Gateway</h2>
        
        <div className="space-y-6">
          <button onClick={onCreate} disabled={isLoading} className="w-full py-4 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 font-black tracking-widest uppercase text-xs rounded-xl transition-all shadow-[0_0_15px_rgba(6,182,212,0.15)] hover:shadow-[0_0_25px_rgba(6,182,212,0.3)]">
            Deploy Host Server
          </button>
          
          <div className="relative flex items-center">
            <div className="flex-grow border-t border-white/10"></div>
            <span className="flex-shrink-0 mx-4 text-[10px] text-gray-600 uppercase tracking-widest font-mono">Or Connect</span>
            <div className="flex-grow border-t border-white/10"></div>
          </div>

          <div className="flex gap-2">
            <input 
              type="text" 
              inputMode={shouldSwitchToNumeric ? "decimal" : "text"} 
              pattern={shouldSwitchToNumeric ? "[0-9]*" : "[A-Z]*"}
              placeholder="ENTER ACCESS KEY..." 
              maxLength={9} // YAHAN 9 FIXED HAI
              value={gateInput} 
              onChange={handleInputChange} 
              className="flex-1 px-4 py-4 bg-black border border-white/10 focus:border-cyan-500 rounded-xl outline-none font-mono text-center text-sm uppercase tracking-widest text-cyan-100 placeholder-gray-700 transition-colors" 
            />
            {/* YAHAN BHI 9 FIXED HAI */}
            <button onClick={onVerify} disabled={isLoading || gateInput.trim().length < 9} className="px-6 bg-white hover:bg-gray-200 text-black rounded-xl font-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function WaitingScreen({ generatedKeys, onLeave }) {
  return (
    <div className="w-full flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-[#121214] border border-cyan-500/30 p-8 rounded-2xl shadow-[0_0_30px_rgba(6,182,212,0.1)] text-center relative">
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#09090b] px-4 text-[10px] text-cyan-500 font-mono tracking-widest border border-cyan-500/30 rounded-full">SERVER ONLINE</div>
        
        <div className="space-y-4 mb-8 text-left mt-6">
          <div className="p-4 bg-black border border-white/5 rounded-xl relative group">
            <span className="text-[9px] font-mono tracking-widest text-gray-500 uppercase block mb-1">Player Gateway Key</span>
            <div className="text-xl font-mono font-black text-cyan-400 tracking-widest select-all">{generatedKeys.playingKey}</div>
          </div>
          <div className="p-4 bg-black border border-white/5 rounded-xl relative group">
            <span className="text-[9px] font-mono tracking-widest text-gray-500 uppercase block mb-1">Spectator Feed Key</span>
            <div className="text-xl font-mono font-black text-purple-400 tracking-widest select-all">{generatedKeys.guestKey}</div>
          </div>
        </div>
        <button onClick={onLeave} className="w-full py-3 bg-red-500/10 text-red-400 border border-red-500/20 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-red-500/20 transition-all">Abort Server</button>
      </div>
    </div>
  );
}

function PlayingScreen({ 
  gameState, playerRole, roomId, onCellClick, onPlayAgain, onLeave, profile,
  chatMessages, activeMembers, currentMessage, setCurrentMessage, onSendChat, voiceManager 
}) {
  const { board, turn, status, winner, winLine = [], playingCode, guestCode } = gameState;
  const isFinished = status === "finished";
  const isSpectator = playerRole === "SPECTATOR";
  const isYourTurn = turn === playerRole && !isFinished && !isSpectator;

  const [isMicOn, setIsMicOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  const toggleLocalMicStream = () => {
    const target = !isMicOn;
    setIsMicOn(target);
    if (voiceManager) voiceManager.setMicState(target);
  };

  const toggleLocalSpeakerAudio = () => {
    const target = !isSpeakerOn;
    setIsSpeakerOn(target);
    if (voiceManager) voiceManager.setSpeakerState(target);
  };

  return (
    <div className="w-full h-[calc(100vh-5rem)] grid grid-cols-1 lg:grid-cols-4 bg-[#09090b] overflow-hidden">
      
      {/* LEFT COLUMN: HUD & Voice Controls */}
      <div className="border-r border-white/10 p-4 lg:p-6 flex flex-col gap-4 overflow-y-auto bg-black/50">
        
        {/* Connection Info */}
        <div className="p-4 bg-[#121214] border border-white/5 rounded-2xl flex flex-col items-center text-center">
           <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mb-2">Current Role</span>
           <span className={`px-4 py-1.5 rounded-full text-xs font-black tracking-widest border ${isSpectator ? "bg-purple-500/10 text-purple-400 border-purple-500/30" : playerRole === "X" ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" : "bg-pink-500/10 text-pink-400 border-pink-500/30"}`}>
             {isSpectator ? "SPECTATOR" : `PLAYER [ ${playerRole} ]`}
           </span>
        </div>

        {/* Comms Panel */}
        <div className="p-4 bg-[#121214] border border-white/5 rounded-2xl">
          <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest block mb-3">Comms Link</span>
          <div className="flex items-center gap-2">
            <button onClick={toggleLocalMicStream} className={`flex-1 flex justify-center py-2.5 rounded-lg border transition-colors ${isMicOn ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-400" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMicOn ? "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" : "M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4" } /></svg>
            </button>
            <button onClick={toggleLocalSpeakerAudio} className={`flex-1 flex justify-center py-2.5 rounded-lg border transition-colors ${isSpeakerOn ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-400" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isSpeakerOn ? "M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" : "M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" } /></svg>
            </button>
          </div>
        </div>

        {/* Connected Roster */}
        <div className="flex-1 flex flex-col min-h-0 bg-[#121214] border border-white/5 p-4 rounded-2xl">
          <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest block mb-3">Live Roster ({Object.keys(activeMembers).length})</span>
          <div className="flex-1 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
            {Object.values(activeMembers).map((member, index) => (
              <div key={index} className="flex items-center gap-3 p-2 bg-black border border-white/5 rounded-lg">
                <img src={member.avatar} alt="" className="w-8 h-8 rounded-md opacity-80" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-200 truncate">{member.name}</p>
                  <p className={`text-[9px] font-mono tracking-widest uppercase ${member.role === "SPECTATOR" ? "text-purple-400" : "text-cyan-400"}`}>{member.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <button onClick={handleLeaveRoom} className="w-full py-3 bg-[#121214] text-red-500 border border-white/5 hover:border-red-500/30 text-xs font-black uppercase tracking-widest rounded-xl transition-colors mt-auto">Disconnect</button>
      </div>

      {/* CENTER COLUMN: THE MATRIX GRID */}
      <div className="lg:col-span-2 border-r border-white/10 p-6 flex flex-col items-center justify-center relative">
        {/* Status Indicator */}
        <div className="absolute top-8 text-center w-full">
           {!isFinished ? (
              <p className="text-sm font-mono tracking-widest uppercase text-gray-400">
                Awaiting Input: <span className={turn === "X" ? "text-cyan-400 font-black" : "text-pink-400 font-black"}>Player {turn}</span>
              </p>
           ) : (
              <p className="text-lg font-mono tracking-widest uppercase font-black text-white">
                {winner === "draw" ? "Matrix Stalemate" : <span className={winner === "X" ? "text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]" : "text-pink-400 drop-shadow-[0_0_10px_rgba(236,72,153,0.8)]"}>Player {winner} Wins</span>}
              </p>
           )}
        </div>

        <div className="grid grid-cols-3 gap-3 bg-[#121214] p-4 rounded-3xl aspect-square w-full max-w-sm border border-white/5 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
          {board.map((cell, i) => {
            const isWinningCell = winLine.includes(i);
            return (
              <button 
                key={i} 
                onClick={() => onCellClick(i)} 
                disabled={!!cell || isFinished || !isYourTurn || isSpectator} 
                className={`w-full h-full bg-black border border-white/5 rounded-2xl font-black flex items-center justify-center transition-all duration-300
                  ${!cell && !isFinished && isYourTurn && !isSpectator ? "hover:bg-white/5 hover:border-white/20 cursor-pointer" : "cursor-default"}
                  ${isWinningCell ? "bg-white/10 border-white/30 shadow-[inset_0_0_20px_rgba(255,255,255,0.1)]" : ""}
                `}
              >
                {cell === "X" && <span className="text-6xl font-black text-cyan-400 drop-shadow-[0_0_15px_rgba(6,182,212,0.6)]">X</span>}
                {cell === "O" && <span className="text-6xl font-black text-pink-500 drop-shadow-[0_0_15px_rgba(236,72,153,0.6)]">O</span>}
              </button>
            );
          })}
        </div>

        {isFinished && !isSpectator && (
          <button onClick={onPlayAgain} className="mt-10 px-8 py-3 bg-white text-black font-black uppercase tracking-widest text-xs rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)] transition-all">
            Restart Sequence
          </button>
        )}
      </div>

      {/* RIGHT COLUMN: CHAT HUD */}
      <div className="p-4 lg:p-6 flex flex-col h-full bg-black/30 overflow-hidden lg:col-span-1">
        <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest block mb-4 border-b border-white/10 pb-3">Global Comms Feed</span>
        
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 custom-scrollbar min-h-0">
          {chatMessages.map((msg, idx) => {
            const isMe = msg.sender === profile.name;
            return (
              <div key={idx} className={`flex items-start gap-3 text-left ${isMe ? 'flex-row-reverse' : ''}`}>
                <img src={msg.avatar} alt="" className="w-8 h-8 rounded-md object-cover opacity-80" />
                <div className={`p-3 rounded-xl max-w-[85%] ${isMe ? 'bg-cyan-500/10 border border-cyan-500/20 rounded-tr-none' : 'bg-[#121214] border border-white/5 rounded-tl-none'}`}>
                  <p className={`text-[9px] font-mono tracking-widest mb-1 ${isMe ? 'text-cyan-400 text-right' : 'text-gray-500'}`}>{msg.sender}</p>
                  <p className="text-xs text-gray-200 leading-relaxed break-words">{msg.text}</p>
                </div>
              </div>
            )
          })}
        </div>

        <form onSubmit={onSendChat} className="flex gap-2 shrink-0">
          <input 
            type="text" 
            placeholder="Transmit data..." 
            value={currentMessage} 
            onChange={(e) => setCurrentMessage(e.target.value)} 
            className="flex-1 px-4 py-3 text-xs font-mono bg-[#121214] border border-white/10 focus:border-cyan-500 rounded-xl outline-none text-gray-200 placeholder-gray-600 transition-colors" 
          />
          <button type="submit" disabled={!currentMessage.trim()} className="px-5 py-3 bg-white text-black font-black uppercase tracking-widest rounded-xl text-[10px] disabled:opacity-50 transition-opacity">
            TX
          </button>
        </form>
      </div>
    </div>
  );
}
