// src/components/common/Navbar.js
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from './ThemeToggle';
import ProfileDropdown from './ProfileDropdown';

export default function Navbar() {
  const { user, login } = useAuth();

  return (
    <nav className="sticky top-0 z-40 backdrop-blur bg-white/80 dark:bg-wa-panelDark/80 border-b border-gray-200 dark:border-gray-800 px-4 sm:px-8 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 rounded-full bg-wa-gradient flex items-center justify-center text-white font-bold shadow-wa">
          🎮
        </div>
        <span className="font-bold text-lg text-gray-900 dark:text-white">GamePlatform</span>
      </div>

      <div className="flex items-center gap-4">
        <ThemeToggle />
        {user ? (
          <ProfileDropdown />
        ) : (
          <button
            onClick={login}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-wa-gradient hover:bg-wa-gradient-hover text-white font-medium shadow-wa transition"
          >
            <GoogleIcon /> Continue with Google
          </button>
        )}
      </div>
    </nav>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#fff" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
      <path fill="#fff" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.95v2.33A9 9 0 0 0 9 18z"/>
      <path fill="#fff" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.05l3.02-2.33z"/>
      <path fill="#fff" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
    </svg>
  );
}
