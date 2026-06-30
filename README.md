# 🎮 Cloud Multiplayer Gaming Platform

Next.js + Firebase (Auth/Firestore) + Agora.io voice chat. Modular `games/` folder — add new games without touching platform code.

## 1. Install

```bash
npm install
```

## 2. Environment variables

Copy `.env.local.example` → `.env.local` and fill in:

- **Firebase (client)**: Firebase Console → Project Settings → General → Your apps → Web app config.
- **Firebase Admin (server)**: Firebase Console → Project Settings → Service Accounts → Generate new private key (download JSON, copy `project_id`, `client_email`, `private_key`).
- **Agora**: [console.agora.io](https://console.agora.io) → Create Project → copy **App ID**. Enable "App Certificate" (Primary Certificate) and copy it too — required for secure server-side token generation (`pages/api/agora/token.js`).

## 3. Firebase setup

1. Enable **Authentication → Sign-in method → Google**.
2. Enable **Firestore Database** (production mode).
3. Deploy `firestore.rules` (or paste into Firebase Console → Firestore → Rules):
   ```bash
   firebase deploy --only firestore:rules
   ```

## 4. Run locally

```bash
npm run dev
```

Visit `http://localhost:3000`.

## 5. Folder structure

```
pages/                      → routes + API (thin wrappers only)
  index.js                  → Home page (game grid)
  api/home/rooms.js         → platform-level room/signaling backend
  api/agora/token.js        → secure Agora token generation
  games/tic-tac-toe/        → route that renders games/tic-tac-toe/ui
  api/games/tic-tac-toe/    → thin HTTP wrapper around games/tic-tac-toe/backend

src/                        → shared platform code (auth, theme, firebase, agora, UI)

games/                      → ⭐ ADD NEW GAMES HERE ONLY
  tic-tac-toe/
    index.js                → manifest (name/icon/route) — register in src/constants/gamesRegistry.js
    ui/                     → React components for this game
    backend/                → pure game logic + Firestore room service
```

## 6. Adding a new game

1. `games/<id>/index.js` — manifest object (`id, name, icon, description, players, route`).
2. `games/<id>/backend/` — game rules + Firestore room service (copy `roomService.js` pattern).
3. `games/<id>/ui/` — React components, reuse `VoiceControls`, `useAuth`.
4. `pages/games/<id>/index.js` — route that renders your game's main component.
5. Register manifest in `src/constants/gamesRegistry.js`.
6. (Optional) `pages/api/games/<id>/*.js` — thin wrappers if you need server-validated endpoints.

## 7. Notes on "Logout All Devices"

Implemented via a `sessionVersion` counter on `users/{uid}`. Each device stores the version it logged in with in `localStorage`. "Logout All Devices" increments the Firestore counter; every active tab/device has a live `onSnapshot` listener (`watchSessionValidity`) that force-signs-out as soon as it detects a newer version.

## 8. Notes on Voice Chat

Agora tokens are generated **server-side only** (`pages/api/agora/token.js`) — the App Certificate never reaches the browser. Mic (mute self) and Speaker (deafen incoming) are independent toggles, matching the requirement.
