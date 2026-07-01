// pages/games/carrom/index.js
import { useState } from "react";
import { useRouter } from "next/router";
import Navbar from "../../../src/components/common/Navbar"; // Path fixed
import LocalGame from "../../../games/carrom/ui/LocalGame";
import CarromGame from "../../../games/carrom/ui/CarromGame";
import RoomLobby from "../../../games/carrom/ui/RoomLobby";

export default function CarromPage() {
  const router = useRouter();
  const { room } = router.query;
  // Mode ko 'select' se start karenge taaki user choose kar sake
  const [mode, setMode] = useState("select"); 

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6 text-center">🎯 Carrom</h1>
        
        {mode === "select" && (
          <div className="flex flex-col gap-4 mt-10">
            <button 
              onClick={() => setMode("local")} 
              className="px-5 py-4 rounded-xl bg-white/10 hover:bg-white/20 transition font-bold"
            >
              🎮 Local Pass & Play
            </button>
            <button 
              onClick={() => setMode("online")} 
              className="px-5 py-4 rounded-xl bg-wa-green text-white font-bold"
            >
              🌐 Online Multiplayer
            </button>
          </div>
        )}

        {/* Yahan wahi logic hai jo tumne photo mein dikhaya */}
        {mode === "local" && (
          <div className="mt-4">
            <button onClick={() => setMode("select")} className="mb-4 text-sm text-gray-400">← Back</button>
            <LocalGame />
          </div>
        )}

        {mode === "online" && (
          <div className="mt-4">
            <button onClick={() => setMode("select")} className="mb-4 text-sm text-gray-400">← Back</button>
            {room ? <CarromGame roomId={room} /> : <RoomLobby />}
          </div>
        )}
      </main>
    </div>
  );
}
