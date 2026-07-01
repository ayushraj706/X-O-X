// games/ludo/backend/logic.js
// Pure, framework-agnostic Ludo rules engine. No React, no Firebase.
//
// Model: each color's path is represented on a single unified 0..51 "main track"
// (52 squares), plus a private 0..5 "home stretch" per color (6 squares) that
// leads into home (index 6 = reached home / finished).
// Each color has a fixed entry offset onto the main track and a fixed square
// index where it turns off into its own home stretch.

export const COLORS = ["red", "green", "yellow", "blue"];

// Entry point (main-track index) for each color's tokens when they leave the start yard.
export const START_OFFSET = { red: 0, green: 13, yellow: 26, blue: 39 };
// Square (main-track index) each color turns off the main track into its home stretch.
export const HOME_ENTRY = { red: 50, green: 11, yellow: 24, blue: 37 };
// Safe squares (star squares + all start squares) — no capturing here.
export const SAFE_SQUARES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

export const TRACK_LENGTH = 52;
export const HOME_STRETCH_LENGTH = 6; // 0..4 travel squares, 5 = fully home
export const TOKENS_PER_PLAYER = 4;

export function createInitialGameState(activeColors = ["red", "yellow"]) {
  const tokens = {};
  activeColors.forEach((color) => {
    tokens[color] = Array.from({ length: TOKENS_PER_PLAYER }, (_, i) => ({
      id: `${color}${i}`,
      state: "yard", // yard | track | homeStretch | home
      position: null // main-track index (0-51) OR home-stretch index (0-4) depending on state
    }));
  });

  return {
    activeColors,
    tokens,
    turnIndex: 0, // index into activeColors
    diceValue: null,
    diceRolledThisTurn: false,
    consecutiveSixes: 0,
    status: "playing", // playing | finished
    winner: null,
    lastEvent: null, // { type: 'move'|'capture'|'home'|'foul', ... }
    moveCount: 0
  };
}

export function currentPlayer(state) {
  return state.activeColors[state.turnIndex];
}

export function rollDice(state) {
  if (state.diceRolledThisTurn) return { ...state, invalid: true };
  const value = 1 + Math.floor(Math.random() * 6);
  return { ...state, diceValue: value, diceRolledThisTurn: true, invalid: false };
}

/** Absolute main-track square for a token given its owner color + local position. */
function absoluteTrackSquare(color, localPos) {
  return (START_OFFSET[color] + localPos) % TRACK_LENGTH;
}

export function getMovableTokens(state, color) {
  const dice = state.diceValue;
  if (!dice) return [];
  return state.tokens[color].filter((t) => {
    if (t.state === "home") return false;
    if (t.state === "yard") return dice === 6;
    if (t.state === "track") {
      // check it doesn't overshoot home stretch
      const localPos = (t.position - START_OFFSET[color] + TRACK_LENGTH) % TRACK_LENGTH;
      const stepsToHomeEntryLocal = ((HOME_ENTRY[color] - START_OFFSET[color] + TRACK_LENGTH) % TRACK_LENGTH);
      const newLocal = localPos + dice;
      if (newLocal > stepsToHomeEntryLocal) {
        const intoHomeStretch = newLocal - stepsToHomeEntryLocal - 1;
        return intoHomeStretch < HOME_STRETCH_LENGTH;
      }
      return true;
    }
    if (t.state === "homeStretch") {
      return t.position + dice < HOME_STRETCH_LENGTH;
    }
    return false;
  }).map((t) => t.id);
}

/**
 * Moves a single token by the current dice value. Handles: leaving yard on 6,
 * normal track movement, turning into home stretch, reaching home, capturing
 * opponent tokens landed on the same (non-safe) square, and extra-turn rules
 * (rolled a 6, captured a token, or reached home => same player goes again).
 */
export function moveToken(state, color, tokenId) {
  if (color !== currentPlayer(state)) return { ...state, invalid: true };
  if (!state.diceValue) return { ...state, invalid: true };
  if (!getMovableTokens(state, color).includes(tokenId)) return { ...state, invalid: true };

  const dice = state.diceValue;
  const tokens = JSON.parse(JSON.stringify(state.tokens));
  const token = tokens[color].find((t) => t.id === tokenId);
  let event = { type: "move", color, tokenId };

  if (token.state === "yard") {
    token.state = "track";
    token.position = START_OFFSET[color];
  } else if (token.state === "track") {
    const localPos = (token.position - START_OFFSET[color] + TRACK_LENGTH) % TRACK_LENGTH;
    const stepsToHomeEntryLocal = (HOME_ENTRY[color] - START_OFFSET[color] + TRACK_LENGTH) % TRACK_LENGTH;
    const newLocal = localPos + dice;

    if (newLocal > stepsToHomeEntryLocal) {
      const intoHomeStretch = newLocal - stepsToHomeEntryLocal - 1;
      if (intoHomeStretch >= HOME_STRETCH_LENGTH - 1) {
        token.state = "home";
        token.position = null;
        event = { type: "home", color, tokenId };
      } else {
        token.state = "homeStretch";
        token.position = intoHomeStretch;
        event = { type: "move", color, tokenId };
      }
    } else {
      token.position = absoluteTrackSquare(color, newLocal);
      event = { type: "move", color, tokenId };
    }
  } else if (token.state === "homeStretch") {
    const newPos = token.position + dice;
    if (newPos >= HOME_STRETCH_LENGTH - 1) {
      token.state = "home";
      token.position = null;
      event = { type: "home", color, tokenId };
    } else {
      token.position = newPos;
      event = { type: "move", color, tokenId };
    }
  }

  // capture check — only relevant if token landed on the main track (not safe)
  let captured = false;
  if (token.state === "track" && !SAFE_SQUARES.has(token.position)) {
    state.activeColors.forEach((otherColor) => {
      if (otherColor === color) return;
      tokens[otherColor].forEach((ot) => {
        if (ot.state === "track" && ot.position === token.position) {
          ot.state = "yard";
          ot.position = null;
          captured = true;
        }
      });
    });
  }
  if (captured) event = { type: "capture", color, tokenId };

  // win check: all 4 tokens home
  const allHome = tokens[color].every((t) => t.state === "home");
  const winner = allHome ? color : null;

  // extra turn rules
  const extraTurn = dice === 6 || captured || event.type === "home";
  let nextTurnIndex = state.turnIndex;
  let consecutiveSixes = dice === 6 ? state.consecutiveSixes + 1 : 0;

  if (consecutiveSixes >= 3) {
    // three sixes in a row = forfeit turn (anti-abuse rule)
    nextTurnIndex = (state.turnIndex + 1) % state.activeColors.length;
    consecutiveSixes = 0;
  } else if (!extraTurn) {
    nextTurnIndex = (state.turnIndex + 1) % state.activeColors.length;
  }

  return {
    ...state,
    tokens,
    turnIndex: winner ? state.turnIndex : nextTurnIndex,
    diceValue: null,
    diceRolledThisTurn: false,
    consecutiveSixes,
    status: winner ? "finished" : "playing",
    winner,
    lastEvent: event,
    moveCount: state.moveCount + 1,
    invalid: false
  };
}

/** Called when a player rolled but has zero legal moves (e.g. no 6, all tokens boxed). */
export function passTurn(state) {
  return {
    ...state,
    turnIndex: (state.turnIndex + 1) % state.activeColors.length,
    diceValue: null,
    diceRolledThisTurn: false,
    consecutiveSixes: 0,
    lastEvent: { type: "pass" },
    invalid: false
  };
}
