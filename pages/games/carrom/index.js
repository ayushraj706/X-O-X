// pages/games/carrom/index.js — thin route, renders games/carrom/ui/CarromGame
import { useState } from "react";
import { useRouter } from "next/router";
import Navbar from "../../../src/components/Navbar";
import LocalGame from "../../../games/carrom/ui/LocalGame";
import CarromGame from "../../../games/carrom/ui/CarromGame";
import RoomLobby from "../../../games/carrom/ui/RoomLobby";

export default function CarromPage() {
  const router = useRouter();
  const { room } = router.query;
  const [mode, setMode] = useState(room ? "online" : "select");

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6 text-center">🎯 Carrom</h1>
        {mode === "select" && (
          <div className="flex justify-center gap-4 mb-8">
            <button onClick={() => setMode("local")} className="px-5 py-2 rounded-full bg-white/10">🎮 Local Pass & Play</button>
            <button onClick={() => setMode("online")} className="px-5 py-2 rounded-full bg-whatsapp-teal">🌐 Online Multiplayer</button>
          </div>
        )}
        {mode === "local" && <LocalGame />}
        {mode === "online" && (room ? <CarromGame roomId={room} /> : <RoomLobby />)}
      </main>
    </div>
  );
}
