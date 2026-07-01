// games/ludo/ui/LocalGame.js — offline pass & play, 2-4 players, pure React state
import { useState } from "react";
import Board from "./Board";
import {
  createInitialGameState, rollDice, moveToken, passTurn, getMovableTokens, currentPlayer
} from "../backend/logic";
import { playSound } from "../../../src/lib/sound";
import { SOUNDS, PLAYER_TONE } from "./sounds";

const ALL_COLORS = ["red", "green", "yellow", "blue"];

export default function LocalGame() {
  const [numPlayers, setNumPlayers] = useState(null);
  const [state, setState] = useState(null);

  function startGame(n) {
    const activeColors = ALL_COLORS.slice(0, n);
    setNumPlayers(n);
    setState(createInitialGameState(activeColors));
  }

  if (!numPlayers) {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-gray-400 text-sm">How many players?</p>
        <div className="flex gap-3">
          {[2, 3, 4].map((n) => (
            <button key={n} onClick={() => startGame(n)} className="px-5 py-2 rounded-full bg-whatsapp-teal">
              {n} Players
            </button>
          ))}
        </div>
      </div>
    );
  }

  const color = currentPlayer(state);
  const movable = state.diceValue ? getMovableTokens(state, color) : [];

  function handleRoll() {
    playSound(SOUNDS.diceRoll);
    let next = rollDice(state);
    if (next.invalid) return;
    const movableNow = getMovableTokens(next, color);
    if (movableNow.length === 0) {
      next = passTurn(next);
    }
    setState(next);
  }

  function handleTokenClick(clickColor, tokenId) {
    if (clickColor !== color) return;
    const next = moveToken(state, color, tokenId);
    if (next.invalid) {
      playSound(SOUNDS.invalid);
      return;
    }
    playSound(PLAYER_TONE[color]);
    setTimeout(() => playSound(SOUNDS.tokenStep), 100);
    if (next.lastEvent?.type === "capture") setTimeout(() => playSound(SOUNDS.capture), 250);
    if (next.lastEvent?.type === "home") setTimeout(() => playSound(SOUNDS.home), 250);
    if (next.status === "finished") setTimeout(() => playSound(SOUNDS.win), 400);
    setState(next);
  }

  function reset() {
    setState(createInitialGameState(state.activeColors));
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-gray-400">Local Pass & Play — {numPlayers} players</p>

      <div className="flex gap-3 text-xs flex-wrap justify-center">
        {state.activeColors.map((c) => (
          <span key={c} className={`px-2 py-1 rounded-full capitalize ${c === color ? "bg-whatsapp-teal/40 font-bold" : "bg-white/5"}`}>
            {c}
          </span>
        ))}
      </div>

      <Board
        tokens={state.tokens}
        activeColors={state.activeColors}
        movableTokenIds={movable}
        onTokenClick={handleTokenClick}
        diceValue={state.diceValue}
        currentColor={color}
      />

      {state.status === "playing" && (
        <button
          onClick={handleRoll}
          disabled={state.diceRolledThisTurn}
          className="px-5 py-2 rounded-full bg-whatsapp-teal disabled:opacity-40"
        >
          🎲 Roll Dice ({color})
        </button>
      )}

      {state.status === "finished" && (
        <>
          <p className="font-semibold text-whatsapp-teal capitalize">🏆 {state.winner} wins!</p>
          <button onClick={reset} className="px-4 py-2 rounded-full bg-whatsapp-teal">Play Again</button>
        </>
      )}
    </div>
  );
}
