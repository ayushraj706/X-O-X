// src/components/common/GameCard.js
import { useRouter } from 'next/router';

export default function GameCard({ game }) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push(game.route)}
      className="group relative rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-wa-panelDark hover:-translate-y-1 transition-transform duration-200 shadow-md hover:shadow-wa text-left"
    >
      <div className="h-32 w-full bg-wa-gradient flex items-center justify-center text-6xl">
        {game.icon}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">{game.name}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{game.description}</p>
        <span className="inline-block mt-3 text-xs px-2 py-1 rounded-full bg-wa-green/10 text-wa-greenDark dark:text-wa-green font-medium">
          {game.players} players
        </span>
      </div>
      <div className="absolute inset-0 ring-2 ring-transparent group-hover:ring-wa-green rounded-2xl transition pointer-events-none" />
    </button>
  );
}
