// pages/index.js
import Head from 'next/head';
import Navbar from '../src/components/common/Navbar';
import GameCard from '../src/components/common/GameCard';
import GAMES from '../src/constants/gamesRegistry';
import { useAuth } from '../src/context/AuthContext';

export default function Home() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen">
      <Head>
        <title>GamePlatform — Play with friends</title>
        <meta name="description" content="Cloud-based multiplayer gaming platform" />
      </Head>

      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-10">
        {/* H1 Heading Section */}
        <section className="mb-10 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white">
            Play Multiplayer Games <span className="text-wa-green">Instantly</span>
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Create a room, share the code, and play with voice chat — right in your browser.
          </p>
        </section>

        {!loading && !user && (
          <div className="mb-8 p-4 rounded-xl bg-wa-green/10 text-wa-greenDark dark:text-wa-green text-center text-sm">
            Sign in with Google (top right) to create or join a game room.
          </div>
        )}

        {/* Games Grid Section */}
        <section>
          {/* Lighthouse Accessibility Fix: sr-only se UI pe kuch nahi dikhega, par hierarchy maintain ho jayegi */}
          <h2 className="sr-only">Available Games</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {GAMES.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
