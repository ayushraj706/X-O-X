// games/ludo/ui/boardLayout.js
// Stylized (not pixel-classic) Ludo board geometry: a square ring track with
// 4 home-stretches leading to center, and 4 corner yards. Purely presentational
// math — game rules live entirely in backend/logic.js.
import { START_OFFSET, HOME_ENTRY, TRACK_LENGTH, HOME_STRETCH_LENGTH } from "../backend/logic";

const CORNERS = [
  { x: 10, y: 10 }, // top-left
  { x: 90, y: 10 }, // top-right
  { x: 90, y: 90 }, // bottom-right
  { x: 10, y: 90 }  // bottom-left
];

const YARD_CENTERS = [
  { x: 20, y: 20 },
  { x: 80, y: 20 },
  { x: 80, y: 80 },
  { x: 20, y: 80 }
];

const COLOR_TO_CORNER = { red: 0, green: 1, yellow: 2, blue: 3 };

export function ringPoint(index) {
  const t = ((index % TRACK_LENGTH) + TRACK_LENGTH) % TRACK_LENGTH / TRACK_LENGTH;
  const perimeter = t * 4;
  const side = Math.floor(perimeter);
  const frac = perimeter - side;
  const a = CORNERS[side];
  const b = CORNERS[(side + 1) % 4];
  return { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
}

export function homeStretchPoint(color, idx) {
  const entry = ringPoint(HOME_ENTRY[color]);
  const frac = (idx + 1) / (HOME_STRETCH_LENGTH);
  return { x: entry.x + (50 - entry.x) * frac, y: entry.y + (50 - entry.y) * frac };
}

export function yardPoint(color, tokenIndex) {
  const c = YARD_CENTERS[COLOR_TO_CORNER[color]];
  const offsets = [
    { dx: -4, dy: -4 }, { dx: 4, dy: -4 }, { dx: -4, dy: 4 }, { dx: 4, dy: 4 }
  ];
  return { x: c.x + offsets[tokenIndex].dx, y: c.y + offsets[tokenIndex].dy };
}

export function tokenScreenPosition(color, token) {
  if (token.state === "yard") {
    const idx = parseInt(token.id.replace(color, ""), 10);
    return yardPoint(color, idx);
  }
  if (token.state === "track") return ringPoint(token.position);
  if (token.state === "homeStretch") return homeStretchPoint(color, token.position);
  return { x: 50, y: 50 }; // home
}

export const CORNER_STYLE = COLOR_TO_CORNER;
export const YARD_CENTER_POINTS = YARD_CENTERS;
