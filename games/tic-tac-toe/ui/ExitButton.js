// games/tic-tac-toe/ui/ExitButton.js
import { FaSignOutAlt } from 'react-icons/fa';

export default function ExitButton({ onExit }) {
  return (
    <div className="flex justify-center my-6">
      <button
        onClick={onExit}
        className="px-8 py-3 rounded-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold shadow-lg active:scale-95 transition-all flex items-center gap-2"
      >
        <FaSignOutAlt /> Exit Room
      </button>
    </div>
  );
}
