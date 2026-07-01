// games/tic-tac-toe/ui/LocalGame.js
import { useState } from 'react';
import { FaTimes, FaRegCircle } from 'react-icons/fa';
import useSound from 'use-sound'; // Sound library import
import { SOUNDS } from './sounds'; // Ensure this file path is correct

export default function LocalGame() {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [xIsNext, setXIsNext] = useState(true);
  const [scores, setScores] = useState({ X: 0, O: 0 });
  const [xStarts, setXStarts] = useState(true);

  // Sound Hooks
  const [playMove] = useSound(SOUNDS.move);
  const [playWin] = useSound(SOUNDS.checkmate); // Using checkmate sound for win
  const [playDraw] = useSound(SOUNDS.draw);
  const [playInvalid] = useSound(SOUNDS.invalid);

  const { winner, winLine } = calculateWinner(board);

  const handleClick = (index) => {
    // Invalid click check
    if (board[index] || winner) {
      playInvalid(); 
      return;
    }

    const newBoard = [...board];
    newBoard[index] = xIsNext ? 'X' : 'O';
    setBoard(newBoard);
    
    // Play move sound
    playMove();
    
    const winResult = calculateWinner(newBoard);
    if (winResult.winner) {
      setScores((prev) => ({ ...prev, [winResult.winner]: prev[winResult.winner] + 1 }));
      playWin(); // Win sound
    } else if (!newBoard.includes(null)) {
      playDraw(); // Draw sound
    } else {
      setXIsNext(!xIsNext);
    }
  };

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    const nextStarter = !xStarts;
    setXStarts(nextStarter);
    setXIsNext(nextStarter);
  };

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Offline Mode: Pass & Play</h2>
      
      {/* Scoreboard */}
      <div className="flex gap-12 mb-8 text-xl font-bold">
        <div className={`flex flex-col items-center transition-transform ${xIsNext && !winner ? 'text-wa-green scale-110' : 'text-gray-400'}`}>
          <span className="text-sm uppercase tracking-wide">Player 1 (X)</span>
          <span className="text-4xl mt-1">{scores.X}</span>
        </div>
        <div className={`flex flex-col items-center transition-transform ${!xIsNext && !winner ? 'text-blue-500 scale-110' : 'text-gray-400'}`}>
          <span className="text-sm uppercase tracking-wide">Player 2 (O)</span>
          <span className="text-4xl mt-1">{scores.O}</span>
        </div>
      </div>

      {/* Game Board */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-sm mx-auto mb-8">
        {board.map((cell, idx) => {
          const isWinCell = winLine?.includes(idx);
          return (
            <button
              key={idx}
              onClick={() => handleClick(idx)}
              className={`aspect-square rounded-2xl text-5xl font-extrabold flex items-center justify-center transition-all duration-300
                ${isWinCell 
                  ? 'bg-wa-gradient text-white shadow-wa scale-[1.08] z-10 border-2 border-wa-green' 
                  : 'bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-wa-green hover:scale-[1.03]'} 
              `}
            >
              {cell === 'X' && (
                <FaTimes className={isWinCell ? 'text-white drop-shadow-md' : 'text-wa-greenDark dark:text-wa-green'} />
              )}
              {cell === 'O' && (
                <FaRegCircle className={isWinCell ? 'text-white drop-shadow-md' : 'text-blue-500'} />
              )}
            </button>
          );
        })}
      </div>

      {/* Status & Play Again */}
      <div className="h-20 flex flex-col items-center justify-center">
        {winner ? (
          <>
            <p className="text-2xl text-wa-green font-bold mb-4 animate-bounce">
              Player {winner} Wins! 🎉
            </p>
            <button onClick={resetGame} className="wa-btn px-8 py-3">Play Next Round</button>
          </>
        ) : !board.includes(null) ? (
          <>
            <p className="text-2xl text-gray-500 font-bold mb-4">It's a Draw! 🤝</p>
            <button onClick={resetGame} className="wa-btn px-8 py-3">Play Again</button>
          </>
        ) : (
          <p className="text-lg font-medium text-gray-600 dark:text-gray-300">
            Turn: <span className={xIsNext ? 'text-wa-green' : 'text-blue-500'}>{xIsNext ? 'Player X' : 'Player O'}</span>
          </p>
        )}
      </div>
    </div>
  );
}

function calculateWinner(squares) {
  const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  for (let i = 0; i < lines.length; i++) {
    const [a, b, c] = lines[i];
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return { winner: squares[a], winLine: [a, b, c] };
    }
  }
  return { winner: null, winLine: null };
}
