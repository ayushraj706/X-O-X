// games/ludo/ui/Board.js
import { ringPoint, homeStretchPoint, CORNER_STYLE, YARD_CENTER_POINTS } from "./boardLayout";
import { tokenScreenPosition } from "./boardLayout";
import { TRACK_LENGTH, HOME_STRETCH_LENGTH, SAFE_SQUARES } from "../backend/logic";

const COLOR_HEX = { red: "#ef4444", green: "#22c55e", yellow: "#eab308", blue: "#3b82f6" };

export default function Board({ tokens, activeColors, movableTokenIds, onTokenClick, diceValue, currentColor }) {
  return (
    <div className="relative w-80 h-80 mx-auto rounded-2xl bg-whatsapp-bubble border border-white/10 overflow-hidden">
      {/* corner yard boxes */}
      {activeColors.map((color) => {
        const c = YARD_CENTER_POINTS[CORNER_STYLE[color]];
        return (
          <div key={color} className="absolute rounded-xl opacity-20"
            style={{
              left: `${c.x - 14}%`, top: `${c.y - 14}%`, width: "28%", height: "28%",
              background: COLOR_HEX[color]
            }} />
        );
      })}

      {/* main track ring */}
      {Array.from({ length: TRACK_LENGTH }).map((_, i) => {
        const p = ringPoint(i);
        const isSafe = SAFE_SQUARES.has(i);
        return (
          <div key={i} className={`absolute rounded-sm ${isSafe ? "bg-white/30" : "bg-white/10"}`}
            style={{ left: `${p.x}%`, top: `${p.y}%`, width: "3%", height: "3%", transform: "translate(-50%,-50%)" }} />
        );
      })}

      {/* home stretches */}
      {activeColors.map((color) =>
        Array.from({ length: HOME_STRETCH_LENGTH - 1 }).map((_, idx) => {
          const p = homeStretchPoint(color, idx);
          return (
            <div key={`${color}-hs-${idx}`} className="absolute rounded-sm"
              style={{ left: `${p.x}%`, top: `${p.y}%`, width: "3%", height: "3%", transform: "translate(-50%,-50%)", background: COLOR_HEX[color] + "55" }} />
          );
        })
      )}

      {/* center home triangle */}
      <div className="absolute rounded-full bg-white/10 flex items-center justify-center text-xs"
        style={{ left: "50%", top: "50%", width: "16%", height: "16%", transform: "translate(-50%,-50%)" }}>
        🏠
      </div>

      {/* tokens */}
      {activeColors.map((color) =>
        tokens[color]?.map((t) => {
          if (t.state === "home") return null;
          const p = tokenScreenPosition(color, t);
          const isMovable = movableTokenIds?.includes(t.id);
          return (
            <button
              key={t.id}
              disabled={!isMovable}
              onClick={() => onTokenClick(color, t.id)}
              className={`absolute rounded-full border-2 flex items-center justify-center text-[8px] font-bold
                ${isMovable ? "ring-2 ring-white animate-pulse cursor-pointer" : "cursor-default"}`}
              style={{
                left: `${p.x}%`, top: `${p.y}%`, width: "6%", height: "6%",
                transform: "translate(-50%,-50%)",
                background: COLOR_HEX[color], borderColor: "#fff",
                transition: "left 0.3s ease, top 0.3s ease"
              }}
            />
          );
        })
      )}

      {diceValue && (
        <div className="absolute bottom-2 right-2 w-8 h-8 rounded bg-white text-black flex items-center justify-center font-bold text-sm">
          {diceValue}
        </div>
      )}
    </div>
  );
}
