// games/tic-tac-toe/ui/LocalGame.js
import { useState } from 'react';

export default function LocalGame() {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [xIsNext, setXIsNext] = useState(true);
  const [scores, setScores] = useState({ X: 0, O: 0 });
  const [xStarts, setXStarts] = useState(true); // Track karne ke liye ki pehla chance kiska hai

  const winner = calculateWinner(board);

  const handleClick = (index) => {
    // Agar jagah bhari hai ya koi jeet gaya toh kuch mat karo
    if (board[index] || winner) return;

    const newBoard = [...board];
    newBoard[index] = xIsNext ? 'X' : 'O';
    setBoard(newBoard);
    
    // Check karo abhi wale click se koi jeeta kya
    const newWinner = calculateWinner(newBoard);
    if (newWinner) {
      setScores((prev) => ({ ...prev, [newWinner]: prev[newWinner] + 1 }));
    } else {
      setXIsNext(!xIsNext);
    }
  };

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    // Turn rotate karo: Agar pichli baar X pehle chala tha, toh ab O chalega
    const nextStarter = !xStarts;
    setXStarts(nextStarter);
    setXIsNext(nextStarter);
  };

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <h2 className="text-2xl font-bold mb-6">Offline Mode: Pass & Play</h2>
      
      {/* Scoreboard */}
      <div className="flex gap-10 mb-8 text-xl font-bold">
        <div className={`flex flex-col items-center ${xIsNext && !winner ? 'text-wa-green scale-110' : 'text-gray-500'}`}>
          <span>Player 1 (X)</span>
          <span className="text-3xl">{scores.X}</span>
        </div>
        <div className={`flex flex-col items-center ${!xIsNext && !winner ? 'text-blue-500 scale-110' : 'text-gray-500'}`}>
          <span>Player 2 (O)</span>
          <span className="text-3xl">{scores.O}</span>
        </div>
      </div>

      {/* Game Board */}
      <div className="grid grid-cols-3 gap-2 bg-gray-800 p-2 rounded-xl mb-6">
        {board.map((cell, idx) => (
          <button
            key={idx}
            onClick={() => handleClick(idx)}
            className="w-24 h-24 bg-gray-700 rounded-lg text-5xl font-extrabold flex items-center justify-center hover:bg-gray-600 transition"
          >
            <span className={cell === 'X' ? 'text-wa-green' : 'text-blue-500'}>
              {cell}
            </span>
          </button>
        ))}
      </div>

      {/* Status & Play Again */}
      {winner ? (
        <div className="text-center">
          <p className="text-2xl text-wa-green font-bold mb-4">{winner} Wins This Round!</p>
          <button onClick={resetGame} className="px-6 py-2 bg-wa-gradient rounded-full font-bold text-white shadow-wa">
            Play Next Round
          </button>
        </div>
      ) : !board.includes(null) ? (
        <div className="text-center">
          <p className="text-2xl text-gray-400 font-bold mb-4">It's a Draw!</p>
          <button onClick={resetGame} className="px-6 py-2 bg-wa-gradient rounded-full font-bold text-white shadow-wa">
            Play Again
          </button>
        </div>
      ) : (
        <p className="text-lg">Turn: {xIsNext ? 'Player X' : 'Player O'}</p>
      )}
    </div>
  );
}

// Simple Winner Logic
function calculateWinner(squares) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
    [0, 4, 8], [2, 4, 6]             // Diagonals
  ];
  for (let i = 0; i < lines.length; i++) {
    const [a, b, c] = lines[i];
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return squares[a];
    }
  }
  return null;
}

