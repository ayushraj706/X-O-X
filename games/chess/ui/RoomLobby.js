// games/chess/ui/RoomLobby.js
import { useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../../../src/context/AuthContext";
import { createRoom } from "../backend/roomService";

export default function RoomLobby() {
  const { user, loginWithGoogle } = useAuth();
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  async function handleCreate() {
    if (!user) {
      await loginWithGoogle();
      return;
    }
    setCreating(true);
    try {
      const roomId = await createRoom({ 
        hostUid: user.uid, 
        hostName: user.displayName || "Player 1" 
      });
      router.push(`/games/chess?room=${roomId}`);
    } catch (error) {
      console.error("Room creation failed:", error);
      alert("Could not create room. Check your connection!");
      setCreating(false);
    }
  }

  function handleJoin() {
    if (!joinCode.trim()) return;
    router.push(`/games/chess?room=${joinCode.trim()}`);
  }

  return (
    <div className="flex flex-col gap-6 p-6 rounded-2xl bg-white/5 border border-white/10 shadow-xl backdrop-blur-md">
      {/* Create Section */}
      <button 
        onClick={handleCreate} 
        disabled={creating} 
        className="w-full py-4 rounded-xl bg-wa-green hover:bg-green-600 transition duration-200 font-bold text-white shadow-lg shadow-green-500/20"
      >
        {creating ? "Setting up..." : "➕ Create Online Room"}
      </button>

      {/* Divider */}
      <div className="flex items-center gap-4 text-gray-500 text-sm">
        <div className="flex-1 h-px bg-white/10"></div>
        OR
        <div className="flex-1 h-px bg-white/10"></div>
      </div>

      {/* Join Section */}
      <div className="flex flex-col gap-2">
        <input 
          value={joinCode} 
          onChange={(e) => setJoinCode(e.target.value)} 
          placeholder="Enter 20-char Room ID"
          className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 outline-none focus:border-wa-green transition" 
        />
        <button 
          onClick={handleJoin} 
          className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 transition font-semibold"
        >
          Join Room
        </button>
      </div>
    </div>
  );
}
