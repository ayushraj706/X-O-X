// app/layout.js
import "./globals.css";

export const metadata = {
  title: "NeonX — Multiplayer Tic-Tac-Toe",
  description: "Real-time online Tic-Tac-Toe with room codes. No login required.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {/* CRT scanline overlay — purely decorative */}
        <div className="scanline-overlay" aria-hidden="true" />
        <div className="relative z-10 min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
