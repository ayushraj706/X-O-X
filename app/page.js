"use client";

// app/page.js
// ─────────────────────────────────────────────────────────────────────────────
// NeonX Immersive Gaming Suite — Full-Screen Adaptive Hub (Stable Release)
// Fixed: Handshake Snapshot Pointer Bug causing Client-Side Exception
// Features: Firebase Google Auth, Dynamic Input Key Filters, Global Mesh Chat.
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

  const [chatMessages, setChatMessages] = useState([]);
  const [activeMembers, setActiveMembers] = useState({});
  const [currentMessage, setCurrentMessage] = useState("");

  const listenerRef = useRef(null);
  const authInstance = useRef(null);

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
  }, []);

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
    if (!userProfile) return;
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
      wireRoomSubServices(baseId, userProfile, "X");
      setAppState(HUB_STATE.WAITING);
    } catch (err) {
      triggerDiagnosticError("Database synchronization failure.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyGateCode = async () => {
    if (!userProfile) return;
    const inputCode = gateInput.trim().toUpperCase();
    if (!inputCode || inputCode.length < 9) {
      triggerDiagnosticError("Invalid code gateway validation lengths.");
      return;
    }

    setIsLoading(true);
    setError("");
    const targetBaseId = inputCode.substring(3);

    try {
      // FIXED: Corrected network pointer trajectory reference directly target base location schema
      const snapshot = await get(ref(db, `rooms/${targetBaseId}`));
      if (!snapshot.exists()) {
        triggerDiagnosticError("Active room vector matrix offline.");
        setIsLoading(false);
        return;
      }

      const serverRoom = snapshot.val();

      if (inputCode === serverRoom.playingCode) {
        if (serverRoom.status !== "waiting") {
          triggerDiagnosticError("Player slots locked and full.");
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
        triggerDiagnosticError("Gateway key matching exception.");
        setIsLoading(false);
      }
    } catch (err) {
      triggerDiagnosticError("Handshake tracking package exception.");
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

  return (
    <main className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-300 relative overflow-hidden">
      
      {userProfile && (
        <header className="w-full px-8 h-20 flex justify-between items-center z-40 border-b border-slate-200/60 dark:border-slate-800/50 bg-white dark:bg-slate-950">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setAppState(HUB_STATE.STORE)}>
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tracking-wider">NEONX</span>
            <span className="text-[9px] bg-indigo-50 dark:bg-indigo-950 border border-indigo-100 dark:border-indigo-900 px-2.5 py-0.5 rounded-md font-extrabold text-indigo-600 dark:text-indigo-400">PRO</span>
          </div>

          <div className="relative">
            <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900/60">
              <img src={userProfile.avatar} alt="" className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-800 object-cover" />
            </button>
            {showProfileMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 z-50">
                  <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">{userProfile.name}</p>
                  <p className="text-xs text-slate-400 truncate font-mono mt-0.5">{userProfile.email}</p>
                  <button onClick={handleLogout} className="w-full mt-3 py-2 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl transition">Disconnect</button>
                </div>
              </>
            )}
          </div>
        </header>
      )}

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

function AuthScreen({ onLogin, isLoading }) {
  return (
    <div className="w-full min-h-[calc(100vh-5rem)] flex flex-col items-center justify-center bg-white dark:bg-slate-950 px-6 text-center">
      <div className="w-24 h-24 bg-indigo-600 rounded-3xl flex items-center justify-center mb-8 shadow-xl">
        <span className="text-white text-5xl font-black">XO</span>
      </div>
      <h1 className="text-4xl font-black tracking-tight text-slate-800 dark:text-slate-100 sm:text-5xl">Universal Game Portal</h1>
      <button onClick={onLogin} disabled={isLoading} className="mt-10 w-full max-w-sm py-4 px-6 bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold rounded-2xl shadow-lg">
        {isLoading ? "Connecting System..." : "Sign In via Google Secure Auth"}
      </button>
    </div>
  );
}

function AppStoreScreen({ onLock }) {
  return (
    <div className="w-full min-h-[calc(100vh-5rem)] max-w-6xl px-8 flex flex-col justify-center py-12 text-left">
      <h2 className="text-4xl font-black tracking-tight text-slate-800 dark:text-slate-100 mb-10">Application Catalog</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <div onClick={onLock} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl cursor-pointer shadow-sm hover:shadow-2xl transition-all duration-300 group">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 font-black text-2xl text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 rounded-2xl flex items-center justify-center">XO</div>
            <div>
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">TicTacToe Pro</h3>
              <p className="text-xs text-slate-400">Mesh Audio System Integrated</p>
            </div>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-4 border-t border-slate-50 dark:border-slate-800 pt-4">Deploy dynamic rooms with native synchronized configuration layers.</p>
          <div className="mt-6 text-sm font-bold text-indigo-600 dark:text-indigo-400 flex justify-end group-hover:translate-x-1 transition-transform">Initialize Console →</div>
        </div>
      </div>
    </div>
  );
}

function DashboardScreen({ onCreate, gateInput, setGateInput, onVerify, isLoading }) {
  // Enhanced auto-prefixing layout with adaptive dynamic formatting
  const handleInputChange = (e) => {
    let value = e.target.value.toUpperCase();
    
    // Auto-formatting PL and CM prefixes instantly
    if (value.startsWith("P") && !value.startsWith("PL-") && value.length >= 2) {
      value = "PL-" + value.substring(1);
    } else if (value.startsWith("C") && !value.startsWith("CM-") && value.length >= 2) {
      value = "CM-" + value.substring(1);
    }
    setGateInput(value);
  };

  // Check prefix setup to dynamically alter keyboard behavior
  const isPrefixLocked = gateInput.startsWith("PL-") || gateInput.startsWith("CM-");

  return (
    <div className="w-full min-h-[calc(100vh-5rem)] flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl shadow-xl text-center">
        <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100">Room Management</h2>
        <div className="space-y-4 mt-8">
          <button onClick={onCreate} disabled={isLoading} className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-md">Deploy Matrix Engine Room</button>
          
          <div className="flex gap-2 relative">
            <input 
              type="text" 
              // KEYBOARD LOGIC: If 'PL-' or 'CM-' is written, automatically switch keyboard to numeric mode for room digits
              inputMode={isPrefixLocked ? "decimal" : "text"} 
              pattern={isPrefixLocked ? "[0-9]*" : "[A-Z]*"}
              placeholder="ACCESS KEY (PL- / CM-)" 
              maxLength={11} 
              value={gateInput} 
              onChange={handleInputChange} 
              className="flex-1 px-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 rounded-xl outline-none font-mono text-center text-sm uppercase tracking-wider" 
            />
            <button onClick={onVerify} disabled={isLoading || gateInput.trim().length < 9} className="px-6 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-black">→</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function WaitingScreen({ generatedKeys, onLeave }) {
  return (
    <div className="w-full min-h-[calc(100vh-5rem)] flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl shadow-xl text-center">
        <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-1">Matrix Gateway Active</h2>
        <div className="space-y-4 mb-8 text-left mt-6">
          <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 rounded-2xl">
            <span className="text-[10px] font-bold text-indigo-600 block">1. Player Key Gateway</span>
            <div className="text-2xl font-mono font-black text-slate-800 dark:text-slate-100 mt-1 select-all">{generatedKeys.playingKey}</div>
          </div>
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 rounded-2xl">
            <span className="text-[10px] font-bold text-emerald-600 block">2. Live Commentary Feed Key</span>
            <div className="text-2xl font-mono font-black text-slate-800 dark:text-slate-100 mt-1 select-all">{generatedKeys.guestKey}</div>
          </div>
        </div>
        <button onClick={onLeave} className="w-full py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 text-slate-500 font-bold rounded-xl">Abort Broadcaster</button>
      </div>
    </div>
  );
}

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
    <div className="w-full h-[calc(100vh-5rem)] grid grid-cols-1 lg:grid-cols-4 bg-white dark:bg-slate-950 overflow-hidden">
      <div className="lg:col-span-2 border-r border-slate-200 dark:border-slate-900 p-6 flex flex-col justify-between overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-900">
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 px-4 py-2 rounded-xl">
            <span className={`w-2.5 h-2.5 rounded-full ${isSpectator ? "bg-amber-500 animate-pulse" : playerRole === "X" ? "bg-indigo-600" : "bg-rose-500"}`} />
            <span className="text-xs font-black uppercase">{isSpectator ? "Live Commentator" : `Khiladi: ${playerRole}`}</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <button onClick={toggleLocalMicStream} className={`p-2 rounded-lg ${isMicOn ? "bg-emerald-500 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-400 line-through"}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
            </button>
            <button onClick={toggleLocalSpeakerAudio} className={`p-2 rounded-lg ${isSpeakerOn ? "bg-indigo-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-400 line-through"}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
            </button>
          </div>
          <button onClick={handleLeaveRoom} className="text-xs font-extrabold text-rose-500 bg-rose-50 dark:bg-rose-950/20 px-4 py-2 rounded-xl transition">Leave Hub</button>
        </div>

        <div className="grid grid-cols-3 gap-3 bg-slate-100 dark:bg-slate-900 p-3 rounded-3xl aspect-square max-w-md mx-auto w-full my-4">
          {board.map((cell, i) => {
            const isWinningCell = winLine.includes(i);
            return (
              <button key={i} onClick={() => onCellClick(i)} disabled={!!cell || isFinished || !isYourTurn || isSpectator} className={`w-full h-full bg-white dark:bg-slate-900 border rounded-2xl font-black flex items-center justify-center transition-all ${isWinningCell ? "bg-emerald-50 dark:bg-emerald-950" : ""}`}>
                {cell === "X" && <span className="text-5xl font-black text-indigo-600 dark:text-indigo-400">X</span>}
                {cell === "O" && <span className="text-5xl font-black text-rose-500 dark:text-rose-400">O</span>}
              </button>
            );
          })}
        </div>
        {isFinished && !isSpectator && <button className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl" onClick={onPlayAgain}>↺ Re-Initialize Grid Matrix</button>}
      </div>

      <div className="border-r border-slate-200 dark:border-slate-900 p-6 flex flex-col gap-6 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/10">
        <div className="space-y-2">
          <div className="p-3 bg-white dark:bg-slate-900 border rounded-2xl flex flex-col">
            <span className="text-[9px] font-bold text-indigo-600 uppercase">Player Access Token</span>
            <span className="text-sm font-mono font-black select-all tracking-wider">{playingCode}</span>
          </div>
          <div className="p-3 bg-white dark:bg-slate-900 border rounded-2xl flex flex-col">
            <span className="text-[9px] font-bold text-emerald-600 uppercase">Guest Commentary Token</span>
            <span className="text-sm font-mono font-black select-all tracking-wider">{guestCode}</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Connected Members ({Object.keys(activeMembers).length})</span>
          <div className="flex-1 space-y-2 overflow-y-auto">
            {Object.values(activeMembers).map((member, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border rounded-xl">
                <div className="flex items-center gap-3 min-w-0">
                  <img src={member.avatar} alt="" className="w-8 h-8 rounded-lg object-cover" />
                  <div className="min-w-0">
                    <p className="text-xs font-black truncate">{member.name}</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">{member.role === "SPECTATOR" ? "🎙️ Commentary" : `🕹️ Player [${member.role}]`}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 flex flex-col h-full bg-white dark:bg-slate-900/20 overflow-hidden lg:col-span-1">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-4 border-b pb-2">Global Live Chat Hub</span>
        <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1 min-h-0">
          {chatMessages.map((msg, idx) => (
            <div key={idx} className="flex items-start gap-2.5 text-left">
              <img src={msg.avatar} alt="" className="w-7 h-7 rounded-lg object-cover mt-0.5" />
              <div className="bg-slate-50 dark:bg-slate-900 border p-2.5 rounded-2xl rounded-tl-none min-w-0">
                <p className="text-[10px] font-black text-indigo-600 truncate">{msg.sender}</p>
                <p className="text-xs text-slate-700 dark:text-slate-300 break-words mt-0.5">{msg.text}</p>
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={onSendChat} className="flex gap-2 border-t pt-3 shrink-0">
          <input type="text" placeholder="Broadcast chat packet..." value={currentMessage} onChange={(e) => setCurrentMessage(e.target.value)} className="flex-1 px-4 py-3 text-xs bg-slate-50 dark:bg-slate-950 border rounded-xl outline-none focus:border-indigo-500" />
          <button type="submit" disabled={!currentMessage.trim()} className="px-4 py-3 bg-indigo-600 text-white font-bold rounded-xl text-xs">Send</button>
        </form>
      </div>
    </div>
  );
}
