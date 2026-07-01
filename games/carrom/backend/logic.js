// games/carrom/backend/logic.js
// Pure, framework-agnostic 2D physics-lite simulation. No React, no Firebase.
// Board is a 1000x1000 unit square. Deterministic: same input (coins, angle,
// power) ALWAYS produces the same output frames — this lets every client
// (shooter, opponent, spectators) replay the exact same shot locally after
// only the compact shot params + final state are synced via Firestore.

export const BOARD_SIZE = 1000;
export const POCKET_RADIUS = 42;
export const COIN_RADIUS = 15;
export const STRIKER_RADIUS = 20;
export const FRICTION = 0.985;
export const MIN_VELOCITY = 1.2;
export const MAX_POWER = 42;

export const POCKETS = [
  { x: 0, y: 0 }, { x: BOARD_SIZE, y: 0 },
  { x: 0, y: BOARD_SIZE }, { x: BOARD_SIZE, y: BOARD_SIZE }
];

export function createInitialCoins() {
  // Simplified concentric ring setup around the center, standard-ish carrom layout.
  const center = BOARD_SIZE / 2;
  const coins = [{ id: "queen", color: "red", x: center, y: center, pocketed: false }];

  const ring = [
    [0, -1], [0.87, -0.5], [0.87, 0.5], [0, 1],
    [-0.87, 0.5], [-0.87, -0.5]
  ];
  ring.forEach(([dx, dy], i) => {
    coins.push({
      id: `w${i}`,
      color: i % 2 === 0 ? "white" : "black",
      x: center + dx * 34,
      y: center + dy * 34,
      pocketed: false
    });
  });
  const outerRing = [
    [0, -2], [1.73, -1], [1.73, 1], [0, 2], [-1.73, 1], [-1.73, -1]
  ];
  outerRing.forEach(([dx, dy], i) => {
    coins.push({
      id: `b${i}`,
      color: i % 2 === 0 ? "black" : "white",
      x: center + dx * 34,
      y: center + dy * 34,
      pocketed: false
    });
  });
  return coins;
}

export function createStriker(playerSide) {
  // playerSide: "bottom" | "top" — striker starts on the shooter's baseline
  const y = playerSide === "bottom" ? BOARD_SIZE - 60 : 60;
  return { x: BOARD_SIZE / 2, y, pocketed: false };
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function resolveCircleCollision(a, ra, b, rb) {
  const d = dist(a, b);
  const overlap = ra + rb - d;
  if (overlap <= 0) return;
  const nx = (b.x - a.x) / (d || 1);
  const ny = (b.y - a.y) / (d || 1);

  // separate
  a.x -= (nx * overlap) / 2; a.y -= (ny * overlap) / 2;
  b.x += (nx * overlap) / 2; b.y += (ny * overlap) / 2;

  // simple elastic exchange along normal
  const avx = a.vx || 0, avy = a.vy || 0, bvx = b.vx || 0, bvy = b.vy || 0;
  const relVel = (avx - bvx) * nx + (avy - bvy) * ny;
  if (relVel < 0) return;
  a.vx = avx - relVel * nx; a.vy = avy - relVel * ny;
  b.vx = bvx + relVel * nx; b.vy = bvy + relVel * ny;
}

/**
 * Runs the full shot to completion (pure function, no rendering).
 * Returns { frames, finalCoins, finalStriker, pocketedThisShot, strikerPocketed }
 * `frames` is a compact array of positions per step, useful for local animation replay.
 */
export function simulateShot({ coins, striker, angle, power }) {
  const clampedPower = Math.min(Math.max(power, 0), 1) * MAX_POWER;
  const s = { ...striker, vx: Math.cos(angle) * clampedPower, vy: Math.sin(angle) * clampedPower, pocketed: false };
  const c = coins.filter((k) => !k.pocketed).map((k) => ({ ...k, vx: 0, vy: 0 }));
  const pocketedThisShot = [];
  const frames = [];
  let strikerPocketed = false;

  for (let step = 0; step < 600; step++) {
    // integrate
    s.x += s.vx; s.y += s.vy;
    c.forEach((k) => { k.x += k.vx; k.y += k.vy; });

    // friction
    s.vx *= FRICTION; s.vy *= FRICTION;
    c.forEach((k) => { k.vx *= FRICTION; k.vy *= FRICTION; });

    // wall bounce
    [s, ...c].forEach((obj) => {
      const r = obj === s ? STRIKER_RADIUS : COIN_RADIUS;
      if (obj.x < r) { obj.x = r; obj.vx *= -0.8; }
      if (obj.x > BOARD_SIZE - r) { obj.x = BOARD_SIZE - r; obj.vx *= -0.8; }
      if (obj.y < r) { obj.y = r; obj.vy *= -0.8; }
      if (obj.y > BOARD_SIZE - r) { obj.y = BOARD_SIZE - r; obj.vy *= -0.8; }
    });

    // collisions: striker vs coins
    c.forEach((k) => resolveCircleCollision(s, STRIKER_RADIUS, k, COIN_RADIUS));
    // coin vs coin
    for (let i = 0; i < c.length; i++) {
      for (let j = i + 1; j < c.length; j++) {
        resolveCircleCollision(c[i], COIN_RADIUS, c[j], COIN_RADIUS);
      }
    }

    // pocket checks
    if (!s.pocketed && POCKETS.some((p) => dist(s, p) < POCKET_RADIUS)) {
      s.pocketed = true;
      strikerPocketed = true;
    }
    c.forEach((k) => {
      if (!k.pocketed && POCKETS.some((p) => dist(k, p) < POCKET_RADIUS)) {
        k.pocketed = true;
        pocketedThisShot.push(k.id);
      }
    });

    if (step % 4 === 0) {
      frames.push({
        striker: { x: s.x, y: s.y, pocketed: s.pocketed },
        coins: c.map((k) => ({ id: k.id, x: k.x, y: k.y, pocketed: k.pocketed }))
      });
    }

    const allSlow =
      Math.hypot(s.vx, s.vy) < MIN_VELOCITY &&
      c.every((k) => Math.hypot(k.vx, k.vy) < MIN_VELOCITY);
    if (allSlow) break;
  }

  const finalCoins = coins.map((orig) => {
    if (orig.pocketed) return orig;
    const match = c.find((k) => k.id === orig.id);
    if (!match) return orig; // was already pocketed before this shot
    return { ...orig, x: match.x, y: match.y, pocketed: match.pocketed };
  });

  return {
    frames,
    finalCoins,
    finalStriker: { x: s.x, y: s.y, pocketed: s.pocketed },
    pocketedThisShot,
    strikerPocketed
  };
}

export function createInitialGameState() {
  return {
    coins: createInitialCoins(),
    striker: createStriker("bottom"),
    turn: "player1",
    scores: { player1: 0, player2: 0 },
    status: "playing", // playing | finished
    lastShot: null,
    foul: false,
    moveCount: 0
  };
}

/**
 * Applies a shot to game state, resolves scoring + fouls, switches turn.
 */
export function applyShot(state, { angle, power, shooter, opponentQueenClaimed }) {
  const result = simulateShot({ coins: state.coins, striker: state.striker, angle, power });

  let scoreDelta = 0;
  let foul = false;
  result.pocketedThisShot.forEach((id) => {
    if (id === "queen") scoreDelta += 3;
    else scoreDelta += 1;
  });
  if (result.strikerPocketed) foul = true;

  const scores = { ...state.scores };
  if (!foul) scores[shooter] = (scores[shooter] || 0) + scoreDelta;
  else scores[shooter] = Math.max(0, (scores[shooter] || 0) - 1); // foul penalty

  const remaining = result.finalCoins.filter((c) => !c.pocketed && c.id !== "queen");
  const gameOver = remaining.length === 0;

  const nextTurn =
    result.pocketedThisShot.length > 0 && !foul
      ? shooter // pot a coin & no foul => shoot again
      : shooter === "player1" ? "player2" : "player1";

  return {
    ...state,
    coins: result.finalCoins,
    striker: createStriker(nextTurn === "player1" ? "bottom" : "top"),
    turn: nextTurn,
    scores,
    status: gameOver ? "finished" : "playing",
    lastShot: { angle, power, shooter, frames: result.frames },
    foul,
    pocketedThisShot: result.pocketedThisShot,
    moveCount: state.moveCount + 1
  };
}
