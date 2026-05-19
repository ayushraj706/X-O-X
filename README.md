# NeonX — Real-time Multiplayer Tic-Tac-Toe

A production-ready, multiplayer Tic-Tac-Toe game built with **Next.js 14**, **Firebase Realtime Database**, and **Tailwind CSS**. Features a premium dark glassmorphism/neon UI with instant synchronization via room codes — no login required.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Database | Firebase Realtime Database |
| Styling | Tailwind CSS v3 |
| Fonts | Exo 2 + Share Tech Mono (Google Fonts) |

---

## Project Structure

```
tictactoe/
├── app/
│   ├── globals.css       # Global styles, CSS variables, glassmorphism theme
│   ├── layout.js         # Root layout with metadata
│   └── page.js           # Entire app: HOME / WAITING / PLAYING screens
├── lib/
│   ├── firebase.js       # Firebase singleton initialization
│   └── gameUtils.js      # Pure game logic (generateRoomId, checkWinner, etc.)
├── .env.local            # Firebase credentials (fill in before running)
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
├── jsconfig.json
└── package.json
```

---

## Setup Instructions

### 1. Create a Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → follow the setup wizard (Analytics is optional)
3. In the left sidebar, click **Build → Realtime Database**
4. Click **Create Database** → choose a region → start in **Test Mode** (you can add security rules later)

### 2. Get Your Firebase Config

1. In the Firebase Console, click the ⚙️ gear icon → **Project Settings**
2. Scroll to **Your apps** → click **</>** (Web) → register the app
3. Copy the `firebaseConfig` values

### 3. Configure Environment Variables

Open `.env.local` and fill in your Firebase credentials:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
NEXT_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:abc123
```

### 4. Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in two browser tabs to test multiplayer locally.

---

## How to Play

1. **Player 1** clicks **Create Room** → a 6-character Room ID is generated
2. **Player 1** shares the Room ID with their friend
3. **Player 2** enters the Room ID and clicks **Join Room**
4. Both players are instantly moved to the game board
5. Player X always goes first
6. After a win or draw, either player can click **Play Again** to reset the board while staying in the same room

---

## Firebase Database Schema

```json
rooms/{roomId}: {
  "board": ["", "", "", "", "", "", "", "", ""],
  "turn": "X",
  "status": "waiting | playing | finished",
  "winner": "X | O | draw | (empty string)",
  "winLine": [0, 1, 2]
}
```

---

## Firebase Security Rules (Recommended for Production)

Replace Test Mode rules with these in **Realtime Database → Rules**:

```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        ".read": true,
        ".write": true,
        ".validate": "newData.hasChildren(['board', 'turn', 'status', 'winner'])"
      }
    }
  }
}
```

---

## Deployment (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard or via CLI:
vercel env add NEXT_PUBLIC_FIREBASE_API_KEY
# (repeat for each variable)
```

---

## License

MIT — use freely for personal or commercial projects.
