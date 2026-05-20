"use client";

// app/page.js
// ─────────────────────────────────────────────────────────────────────────────
// NeonX Immersive Gaming Suite — Bright & Clean Saffron/Green Theme
// Features: Light UI, Professional Color Palette, Hydration Safety, Auto 9-char Fix.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react";
import { db } from "@/lib/firebase";
import { getApp, getApps } from "firebase/app";
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
  const [isMounted, setIsMounted] = useState(false);

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
    setIsMounted(true); 
    if (typeof window !== "undefined") {
      try {
        const auth = getApps().length > 0 ? getAuth(getApp()) : getAuth();
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
      } catch (e) {
        setIsLoading(false);
      }
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

    if (status === "finished" || winner !== "" || turn !== playerRole || board[index] !== "") return;

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

  if (!isMounted) {
    return (
      <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse text-orange-500 font-bold tracking-widest text-sm">INITIALIZING...</div>
      </div>
    );
  }

  // GLOBAL LIGHT THEME WRAPPER
  return (
    <main className="min-h-screen w-full bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-orange-500/20 relative overflow-hidden">
      
      {/* Global Error Notification */}
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-100 border border-red-300 text-red-700 px-6 py-2 rounded-xl font-bold text-sm shadow-lg animate-bounce">
          ⚠️ {error}
        </div>
      )}

      {userProfile && (
        <header className="w-full px-6 lg:px-10 h-20 flex justify-between items-center z-40 bg-white border-b border-slate-200 shadow-sm shrink-0">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setAppState(HUB_STATE.STORE)}>
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center border border-orange-200">
              <span className="text-orange-600 font-black text-lg">NX</span>
            </div>
            <span className="text-2xl font-black tracking-tight text-slate-800">Neon<span className="text-orange-500">X</span></span>
          </div>

          <div className="relative">
            <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="flex items-center gap-2 hover:opacity-80 transition-opacity focus:outline-none">
              <img src={userProfile.avatar} alt="Profile" className="w-11 h-11 rounded-full border-2 border-orange-100 object-cover shadow-sm bg-slate-100" />
            </button>
            {showProfileMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                <div className="absolute right-0 mt-3 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-5 z-50">
                  <p className="text-base font-bold text-slate-800 truncate">{userProfile.name}</p>
                  <p className="text-xs text-slate-500 truncate mt-1">{userProfile.email}</p>
                  <div className="h-px w-full bg-slate-100 my-4"></div>
                  <button onClick={handleLogout} className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl transition-colors">Log Out</button>
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
// BRIGHT & PROFESSIONAL UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function AuthScreen({ onLogin, isLoading }) {
  return (
    <div className="w-full flex flex-col items-center justify-center px-6 text-center">
      <div className="w-28 h-28 bg-orange-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-orange-500/30 mb-8 transform rotate-3">
        <span className="text-white text-6xl font-black -rotate-3">NX</span>
      </div>
      <h1 className="text-4xl lg:text-5xl font-black tracking-tight text-slate-900 mb-3">Welcome to NeonX</h1>
      <p className="text-slate-500 text-sm mb-12 max-w-sm mx-auto">Connect securely to start your immersive gaming and voice experience.</p>
      
      <button onClick={onLogin} disabled={isLoading} className="w-full max-w-sm py-4 px-6 bg-white text-slate-800 font-bold rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-orange-300 transition-all flex items-center justify-center gap-4">
        <svg className="w-6 h-6" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
        <span>{isLoading ? "Connecting safely..." : "Continue with Google"}</span>
      </button>
    </div>
  );
}

function AppStoreScreen({ onLock }) {
  return (
    <div className="w-full max-w-5xl px-6 flex flex-col justify-center text-left">
      <h2 className="text-3xl font-black text-slate-800 mb-8 text-center lg:text-left">Select Module</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div onClick={onLock} className="bg-white border border-slate-200 p-6 rounded-3xl cursor-pointer hover:border-orange-400 hover:shadow-xl transition-all duration-300 group">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600 font-black text-2xl group-hover:bg-orange-500 group-hover:text-white transition-colors">
              XO
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800">TicTacToe Pro</h3>
              <p className="text-xs text-emerald-600 font-bold mt-1 bg-emerald-50 inline-block px-2 py-0.5 rounded-md">Voice Enabled</p>
            </div>
          </div>
          <p className="text-sm text-slate-500 mt-6 pt-5 border-t border-slate-100 leading-relaxed">
            Create dynamic rooms, talk with friends in real-time, and play instantly.
          </p>
          <div className="mt-5 text-sm font-bold text-orange-600 flex justify-end group-hover:translate-x-1 transition-transform">
            Start Game →
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
      <div className="w-full max-w-md bg-white border border-slate-200 p-8 rounded-3xl shadow-xl">
        <h2 className="text-2xl font-black text-slate-800 text-center mb-8">Room Dashboard</h2>
        
        <div className="space-y-6">
          <button onClick={onCreate} disabled={isLoading} className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-black text-lg rounded-2xl transition-colors shadow-md shadow-orange-500/20">
            Create New Room
          </button>
          
          <div className="relative flex items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink-0 mx-4 text-xs font-bold text-slate-400 uppercase">Or Join Existing</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          <div className="flex gap-2">
            <input 
              type="text" 
              inputMode={shouldSwitchToNumeric ? "decimal" : "text"} 
              pattern={shouldSwitchToNumeric ? "[0-9]*" : "[A-Z]*"}
              placeholder="Enter Key (PL-/CM-)" 
              maxLength={9} 
              value={gateInput} 
              onChange={handleInputChange} 
              className="flex-1 px-5 py-4 bg-slate-50 border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 rounded-2xl outline-none font-bold text-center text-slate-800 placeholder-slate-400 transition-all" 
            />
            <button onClick={onVerify} disabled={isLoading || gateInput.trim().length < 9} className="px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xl transition-colors disabled:opacity-50 disabled:bg-slate-300">
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
      <div className="w-full max-w-md bg-white border border-slate-200 p-8 rounded-3xl shadow-xl text-center">
        <div className="inline-block px-4 py-1 mb-6 bg-emerald-50 text-emerald-600 font-bold text-xs rounded-full border border-emerald-100">SERVER IS ONLINE</div>
        <h2 className="text-2xl font-black text-slate-800 mb-8">Share these codes</h2>
        
        <div className="space-y-4 mb-8 text-left">
          <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl">
            <span className="text-xs font-bold text-orange-600 uppercase block mb-1">🎮 Player Code (To Play)</span>
            <div className="text-2xl font-black text-slate-800 tracking-wider select-all">{generatedKeys.playingKey}</div>
          </div>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
            <span className="text-xs font-bold text-slate-500 uppercase block mb-1">👁️ Spectator Code (To Watch)</span>
            <div className="text-2xl font-black text-slate-800 tracking-wider select-all">{generatedKeys.guestKey}</div>
          </div>
        </div>
        <button onClick={onLeave} className="w-full py-3.5 bg-white text-slate-500 border border-slate-200 font-bold text-sm rounded-xl hover:bg-slate-50 transition-colors">Cancel & Leave</button>
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
    <div className="w-full h-[calc(100vh-5rem)] grid grid-cols-1 lg:grid-cols-4 bg-slate-50 overflow-hidden">
      
      {/* LEFT COLUMN: Controls & Roster */}
      <div className="border-r border-slate-200 p-4 lg:p-6 flex flex-col gap-5 overflow-y-auto bg-white shadow-[2px_0_10px_rgba(0,0,0,0.02)] z-10">
        
        {/* Role Identity */}
        <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
           <span className="text-xs text-slate-500 font-bold uppercase">You are</span>
           <span className={`px-3 py-1 rounded-lg text-xs font-black border ${isSpectator ? "bg-slate-200 text-slate-600 border-slate-300" : playerRole === "X" ? "bg-orange-100 text-orange-600 border-orange-200" : "bg-emerald-100 text-emerald-600 border-emerald-200"}`}>
             {isSpectator ? "SPECTATOR" : `PLAYER ${playerRole}`}
           </span>
        </div>

        {/* Voice Controls */}
        <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
          <span className="text-xs text-slate-500 font-bold uppercase block mb-3">Voice Chat</span>
          <div className="flex items-center gap-3">
            <button onClick={toggleLocalMicStream} className={`flex-1 flex justify-center py-3 rounded-xl border-2 transition-colors ${isMicOn ? "bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/20" : "bg-white border-slate-200 text-slate-400"}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={isMicOn ? "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" : "M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4" } /></svg>
            </button>
            <button onClick={toggleLocalSpeakerAudio} className={`flex-1 flex justify-center py-3 rounded-xl border-2 transition-colors ${isSpeakerOn ? "bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-500/20" : "bg-white border-slate-200 text-slate-400"}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={isSpeakerOn ? "M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" : "M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" } /></svg>
            </button>
          </div>
        </div>

        {/* Players List */}
        <div className="flex-1 flex flex-col min-h-0 bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-100">
            <span className="text-xs text-slate-500 font-bold uppercase">People Here ({Object.keys(activeMembers).length})</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {Object.values(activeMembers).map((member, index) => (
              <div key={index} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl transition-colors">
                <img src={member.avatar} alt="" className="w-9 h-9 rounded-full bg-slate-200 object-cover border border-slate-200" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{member.name}</p>
                  <p className={`text-[10px] font-bold uppercase ${member.role === "SPECTATOR" ? "text-slate-400" : member.role === "X" ? "text-orange-500" : "text-emerald-500"}`}>{member.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <button onClick={handleLeaveRoom} className="w-full py-3.5 bg-red-50 text-red-600 hover:bg-red-100 font-bold rounded-xl transition-colors mt-auto">Leave Room</button>
      </div>

      {/* CENTER COLUMN: TIC-TAC-TOE BOARD */}
      <div className="lg:col-span-2 border-r border-slate-200 p-6 flex flex-col items-center justify-center relative bg-slate-50">
        
        {/* Game Status */}
        <div className="absolute top-10 text-center w-full">
           {!isFinished ? (
              <div className="inline-flex items-center gap-2 bg-white px-5 py-2.5 rounded-full shadow-sm border border-slate-200">
                <span className="text-sm font-bold text-slate-500">Current Turn:</span>
                <span className={`text-lg font-black ${turn === "X" ? "text-orange-500" : "text-emerald-500"}`}>Player {turn}</span>
              </div>
           ) : (
              <div className="inline-block bg-white px-8 py-4 rounded-2xl shadow-lg border border-slate-200 animate-bounce">
                <p className="text-2xl font-black text-slate-800">
                  {winner === "draw" ? "It's a Tie! 🤝" : <span className={winner === "X" ? "text-orange-500" : "text-emerald-500"}>Player {winner} Wins! 🏆</span>}
                </p>
              </div>
           )}
        </div>

        {/* The Grid */}
        <div className="grid grid-cols-3 gap-3 bg-slate-200 p-4 rounded-3xl aspect-square w-full max-w-sm shadow-inner">
          {board.map((cell, i) => {
            const isWinningCell = winLine.includes(i);
            return (
              <button 
                key={i} 
                onClick={() => onCellClick(i)} 
                disabled={!!cell || isFinished || !isYourTurn || isSpectator} 
                className={`w-full h-full bg-white rounded-2xl font-black flex items-center justify-center transition-all duration-200 shadow-sm
                  ${!cell && !isFinished && isYourTurn && !isSpectator ? "hover:bg-slate-50 cursor-pointer hover:shadow-md transform hover:-translate-y-1" : "cursor-default"}
                  ${isWinningCell ? (winner === "X" ? "bg-orange-100 border-2 border-orange-400" : "bg-emerald-100 border-2 border-emerald-400") : ""}
                `}
              >
                {cell === "X" && <span className="text-7xl font-black text-orange-500 drop-shadow-sm">X</span>}
                {cell === "O" && <span className="text-7xl font-black text-emerald-500 drop-shadow-sm">O</span>}
              </button>
            );
          })}
        </div>

        {/* Play Again Button */}
        {isFinished && !isSpectator && (
          <button onClick={onPlayAgain} className="mt-12 px-8 py-4 bg-slate-800 text-white hover:bg-slate-900 font-bold text-sm rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1">
            Play Another Round
          </button>
        )}
      </div>

      {/* RIGHT COLUMN: CHAT */}
      <div className="p-4 lg:p-6 flex flex-col h-full bg-white overflow-hidden lg:col-span-1 shadow-[-2px_0_10px_rgba(0,0,0,0.02)] z-10">
        <div className="pb-4 border-b border-slate-100 mb-4 shrink-0 flex items-center justify-between">
            <span className="text-base font-black text-slate-800">Room Chat</span>
            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-md font-bold uppercase">{playingCode}</span>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar min-h-0 flex flex-col-reverse">
          <div className="flex flex-col gap-4">
            {chatMessages.map((msg, idx) => {
              const isMe = profile && msg.sender === profile.name;
              return (
                <div key={idx} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <img src={msg.avatar} alt="" className="w-8 h-8 rounded-full border border-slate-200 shrink-0" />
                  <div className={`p-3 rounded-2xl max-w-[85%] ${isMe ? 'bg-orange-500 text-white rounded-br-sm shadow-sm shadow-orange-500/20' : 'bg-slate-100 text-slate-800 rounded-bl-sm border border-slate-200'}`}>
                    {!isMe && <p className="text-[10px] font-bold mb-0.5 text-slate-500">{msg.sender}</p>}
                    <p className="text-sm leading-snug break-words">{msg.text}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <form onSubmit={onSendChat} className="flex gap-2 pt-4 mt-2 border-t border-slate-100 shrink-0">
          <input 
            type="text" 
            placeholder="Type a message..." 
            value={currentMessage} 
            onChange={(e) => setCurrentMessage(e.target.value)} 
            className="flex-1 px-4 py-3 text-sm bg-slate-50 border border-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 rounded-xl outline-none text-slate-800 placeholder-slate-400 transition-all" 
          />
          <button type="submit" disabled={!currentMessage.trim()} className="px-5 py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl disabled:opacity-50 transition-colors">
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
