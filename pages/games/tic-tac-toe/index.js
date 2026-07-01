// pages/games/tic-tac-toe/index.js
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState } from 'react'; // State add ki taaki offline/online switch kar sakein
import Navbar from '../../../src/components/common/Navbar';
import TicTacToeGame from '../../../games/tic-tac-toe/ui/TicTacToeGame';
import LocalGame from '../../../games/tic-tac-toe/ui/LocalGame'; // Offline wala page import kiya
import { useAuth } from '../../../src/context/AuthContext';

export default function TicTacToePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [playOffline, setPlayOffline] = useState(false); // Ye yaad rakhega ki user offline khel raha hai ya nahi

  return (
    <div className="min-h-screen">
      <Head>
        <title>Tic-Tac-Toe — GamePlatform</title>
      </Head>
      <Navbar />

      <main className="py-6 px-4 sm:px-8 max-w-6xl mx-auto">
        {playOffline ? (
          /* OFFLINE MODE: Jab user offline button dabayega, ye UI dikhega */
          <div className="max-w-lg mx-auto mt-10">
            <button 
              onClick={() => setPlayOffline(false)}
              className="mb-6 px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-800 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition flex items-center gap-2"
            >
              ← Back
            </button>
            <LocalGame />
          </div>
        ) : !loading && !user ? (
          /* LOGGED OUT: Agar user login nahi hai */
          <div className="max-w-md mx-auto mt-20 text-center p-8 rounded-2xl bg-white dark:bg-wa-panelDark border border-gray-200 dark:border-gray-800 shadow-xl">
            <p className="text-gray-600 dark:text-gray-300 mb-6 font-medium text-lg">
              Sign in to play online, or play locally with a friend!
            </p>
            <div className="flex flex-col gap-4">
              <button 
                onClick={() => setPlayOffline(true)} 
                className="w-full py-3 rounded-xl border-2 border-wa-green text-wa-greenDark dark:text-wa-green font-bold hover:bg-wa-green/10 transition"
              >
                Play Offline (Pass & Play)
              </button>
              <button onClick={() => router.push('/')} className="wa-btn w-full py-3 text-white">
                Go to Home
              </button>
            </div>
          </div>
        ) : (
          /* LOGGED IN (ONLINE LOBBY): Agar login hai toh seedha main game khulega */
          <TicTacToeGame onPlayOffline={() => setPlayOffline(true)} />
        )}
      </main>
    </div>
  );
}
