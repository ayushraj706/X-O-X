// games/carrom/ui/LocalGame.js — offline pass & play, pure React state
import { useState } from "react";
import Board from "./Board";
import { createInitialGameState, applyShot } from "../backend/logic";
import { playSound } from "../../../src/lib/sound";
import { SOUNDS } from "./sounds";

export default function LocalGame() {
  const [state, setState] = useState(createInitialGameState());
  const [animFrame, setAnimFrame] = useState(null);

  function handleShoot({ angle, power }) {
    playSound(SOUNDS.strike);
    const next = applyShot(state, { angle, power, shooter: state.turn });
    animateFrames(next.lastShot.frames, () => {
      setState(next);
      setAnimFrame(null);
      if (next.foul) playSound(SOUNDS.foul);
      else if (next.pocketedThisShot?.length) playSound(SOUNDS.pocket);
      if (next.status === "finished") setTimeout(() => playSound(SOUNDS.win), 200);
    });
  }

  function animateFrames(frames, done) {
    let i = 0;
    const tick = () => {
      if (i >= frames.length) return done();
      setAnimFrame(frames[i]);
      i++;
      requestAnimationFrame(() => setTimeout(tick, 16));
    };
    tick();
  }

  function reset() {
    setState(createInitialGameState());
    setAnimFrame(null);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-gray-400">Local Pass & Play — drag from striker to aim & shoot</p>
      <div className="flex gap-6 text-sm">
        <span className={state.turn === "player1" ? "text-whatsapp-teal font-bold" : ""}>Player 1: {state.scores.player1}</span>
        <span className={state.turn === "player2" ? "text-whatsapp-teal font-bold" : ""}>Player 2: {state.scores.player2}</span>
      </div>
      {state.foul && <p className="text-red-400 text-sm">⚠️ Foul! Striker pocketed, turn passed + penalty.</p>}
      <Board
        coins={state.coins}
        striker={state.striker}
        disabled={state.status !== "playing" || !!animFrame}
        onShoot={handleShoot}
        animFrame={animFrame}
      />
      <p className="text-xs text-gray-400">Turn: <span className="font-bold capitalize">{state.turn}</span></p>
      {state.status === "finished" && (
        <>
          <p className="font-semibold text-whatsapp-teal">
            🏆 {state.scores.player1 > state.scores.player2 ? "Player 1" : "Player 2"} wins!
          </p>
          <button onClick={reset} className="px-4 py-2 rounded-full bg-whatsapp-teal">Play Again</button>
        </>
      )}
    </div>
  );
}
