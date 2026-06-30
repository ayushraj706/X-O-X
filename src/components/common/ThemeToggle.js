// src/components/common/ThemeToggle.js
import { useTheme } from '../../context/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle dark/light mode"
      className="relative h-9 w-16 rounded-full bg-gray-200 dark:bg-gray-700 transition-colors duration-300 flex items-center px-1"
    >
      <span
        className={`absolute h-7 w-7 rounded-full bg-wa-gradient shadow-wa transform transition-transform duration-300 flex items-center justify-center text-xs ${
          theme === 'dark' ? 'translate-x-7' : 'translate-x-0'
        }`}
      >
        {theme === 'dark' ? '🌙' : '☀️'}
      </span>
    </button>
  );
}
