// pages/games/tic-tac-toe/index.js
import Head from 'next/head';
import { useRouter } from 'next/router';
import Navbar from '../../../src/components/common/Navbar';
import TicTacToeGame from '../../../games/tic-tac-toe/ui/TicTacToeGame';
import { useAuth } from '../../../src/context/AuthContext';

export default function TicTacToePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  return (
    <div className="min-h-screen">
      <Head>
        <title>Tic-Tac-Toe — GamePlatform</title>
      </Head>
      <Navbar />

      <main className="py-6">
        {!loading && !user ? (
          <div className="max-w-md mx-auto mt-20 text-center p-8 rounded-2xl bg-white dark:bg-wa-panelDark border border-gray-200 dark:border-gray-800">
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Please sign in with Google to play Tic-Tac-Toe.
            </p>
            <button onClick={() => router.push('/')} className="wa-btn px-6 py-2">
              Go to Home
            </button>
          </div>
        ) : (
          <TicTacToeGame />
        )}
      </main>
    </div>
  );
}
