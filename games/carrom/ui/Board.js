// games/carrom/ui/Board.js
// Renders coins/striker as % positioned circles over a 1000x1000 virtual board.
// Aim & power are set by pointer-down-drag-release from the striker (slingshot style).
import { useRef, useState } from "react";
import { BOARD_SIZE, POCKET_RADIUS } from "../backend/logic";

const COLOR_MAP = { white: "#f4f4f4", black: "#1a1a1a", red: "#e0455f" };

export default function Board({ coins, striker, disabled, onShoot, animFrame }) {
  const boardRef = useRef(null);
  const [drag, setDrag] = useState(null); // {startX, startY, curX, curY}

  const shownStriker = animFrame?.striker || striker;
  const shownCoins = animFrame?.coins
    ? coins.map((c) => animFrame.coins.find((f) => f.id === c.id) || c)
    : coins;

  function pct(v) {
    return `${(v / BOARD_SIZE) * 100}%`;
  }

  function handlePointerDown(e) {
    if (disabled) return;
    const rect = boardRef.current.getBoundingClientRect();
    setDrag({ startX: e.clientX, startY: e.clientY, curX: e.clientX, curY: e.clientY, rect });
  }
  function handlePointerMove(e) {
    if (!drag) return;
    setDrag((d) => ({ ...d, curX: e.clientX, curY: e.clientY }));
  }
  function handlePointerUp() {
    if (!drag || disabled) return;
    const dx = drag.startX - drag.curX;
    const dy = drag.startY - drag.curY;
    const distPx = Math.hypot(dx, dy);
    setDrag(null);
    if (distPx < 8) return; // treat as a tap, ignore

    const angle = Math.atan2(dy, dx);
    const power = Math.min(distPx / 180, 1); // 180px drag = full power
    onShoot({ angle, power });
  }

  return (
    <div
      ref={boardRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => setDrag(null)}
      className="relative w-80 h-80 mx-auto rounded-lg bg-amber-900/40 border-4 border-amber-800 select-none touch-none"
    >
      {/* pockets */}
      {[[0,0],[1,0],[0,1],[1,1]].map(([fx, fy], i) => (
        <div key={i} className="absolute rounded-full bg-black"
          style={{
            width: `${(POCKET_RADIUS * 2 / BOARD_SIZE) * 100}%`,
            height: `${(POCKET_RADIUS * 2 / BOARD_SIZE) * 100}%`,
            left: `${fx * 100}%`, top: `${fy * 100}%`, transform: "translate(-50%,-50%)"
          }} />
      ))}

      {/* coins */}
      {shownCoins.filter((c) => !c.pocketed).map((c) => (
        <div key={c.id} className="absolute rounded-full shadow-md border border-black/30"
          style={{
            width: "6%", height: "6%",
            left: pct(c.x), top: pct(c.y), transform: "translate(-50%,-50%)",
            background: COLOR_MAP[c.color],
            transition: animFrame ? "none" : "left 0.4s ease, top 0.4s ease"
          }} />
      ))}

      {/* striker */}
      {!shownStriker.pocketed && (
        <div className="absolute rounded-full border-2 border-whatsapp-accent shadow-lg"
          style={{
            width: "8%", height: "8%",
            left: pct(shownStriker.x), top: pct(shownStriker.y), transform: "translate(-50%,-50%)",
            background: "#ffe9b3",
            transition: animFrame ? "none" : "left 0.4s ease, top 0.4s ease"
          }} />
      )}

      {/* aim line */}
      {drag && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <line
            x1={pct(shownStriker.x)} y1={pct(shownStriker.y)}
            x2={`calc(${pct(shownStriker.x)} - ${drag.curX - drag.startX}px)`}
            y2={`calc(${pct(shownStriker.y)} - ${drag.curY - drag.startY}px)`}
            stroke="#25d366" strokeWidth="2" strokeDasharray="4"
          />
        </svg>
      )}

      {disabled && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-sm">
          Opponent's turn / Spectating
        </div>
      )}
    </div>
  );
}
