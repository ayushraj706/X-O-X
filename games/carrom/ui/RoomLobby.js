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
    if (!user) return loginWithGoogle();
    setCreating(true);
    try {
      const roomId = await createRoom({ hostUid: user.uid, hostName: user.displayName || "Player 1" });
      router.push(`/games/carrom?room=${roomId}`);
    } finally {
      setCreating(false);
    }
  }
  function handleJoin() {
    if (!joinCode.trim()) return;
    router.push(`/games/carrom?room=${joinCode.trim()}`);
  }

  return (
    <div className="flex flex-col items-center gap-4 max-w-sm mx-auto">
      <button onClick={handleCreate} disabled={creating} className="w-full px-4 py-2 rounded-full bg-whatsapp-teal font-semibold">
        {creating ? "Creating room..." : "➕ Create Online Room"}
      </button>
      <div className="w-full flex items-center gap-2">
        <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="Enter Room ID"
          className="flex-1 px-3 py-2 rounded-lg bg-whatsapp-bubble border border-white/10 outline-none" />
        <button onClick={handleJoin} className="px-4 py-2 rounded-full bg-white/10">Join</button>
      </div>
    </div>
  );
}
