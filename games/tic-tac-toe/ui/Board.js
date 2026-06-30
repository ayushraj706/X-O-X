// games/tic-tac-toe/ui/Board.js

export default function Board({ board, onCellClick, winLine, disabled }) {
  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-sm mx-auto">
      {board.map((cell, i) => {
        const isWinCell = winLine?.includes(i);
        return (
          <button
            key={i}
            onClick={() => onCellClick(i)}
            disabled={disabled || cell !== null}
            className={`aspect-square rounded-2xl text-4xl sm:text-5xl font-bold flex items-center justify-center transition-all duration-150
              ${isWinCell ? 'bg-wa-gradient text-white shadow-wa scale-105' : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white'}
              border-2 ${isWinCell ? 'border-wa-green' : 'border-gray-200 dark:border-gray-700'}
              ${!disabled && cell === null ? 'hover:border-wa-green hover:scale-[1.03] cursor-pointer' : 'cursor-default'}
            `}
          >
            {cell === 'X' && <span className="text-wa-greenDark dark:text-wa-green">✕</span>}
            {cell === 'O' && <span className="text-gray-700 dark:text-gray-200">○</span>}
          </button>
        );
      })}
    </div>
  );
}
