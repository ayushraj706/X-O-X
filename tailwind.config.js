/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Exo 2'", "sans-serif"],
        mono: ["'Share Tech Mono'", "monospace"],
      },
      colors: {
        cyan: {
          neon: "#00f5ff",
        },
        purple: {
          neon: "#bf00ff",
        },
      },
      boxShadow: {
        "neon-cyan": "0 0 8px #00f5ff, 0 0 30px rgba(0,245,255,0.3)",
        "neon-purple": "0 0 8px #bf00ff, 0 0 30px rgba(191,0,255,0.3)",
        "neon-cyan-lg": "0 0 15px #00f5ff, 0 0 60px rgba(0,245,255,0.4), 0 0 120px rgba(0,245,255,0.15)",
        "neon-purple-lg": "0 0 15px #bf00ff, 0 0 60px rgba(191,0,255,0.4), 0 0 120px rgba(191,0,255,0.15)",
        "glass": "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "flicker": "flicker 4s linear infinite",
        "slide-up": "slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "fade-in": "fadeIn 0.3s ease forwards",
        "scale-in": "scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "winner-glow": "winnerGlow 1.5s ease-in-out infinite alternate",
        "scanline": "scanline 8s linear infinite",
        "float": "float 6s ease-in-out infinite",
      },
      keyframes: {
        flicker: {
          "0%, 95%, 100%": { opacity: "1" },
          "96%": { opacity: "0.8" },
          "97%": { opacity: "1" },
          "98%": { opacity: "0.6" },
          "99%": { opacity: "1" },
        },
        slideUp: {
          from: { transform: "translateY(24px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        scaleIn: {
          from: { transform: "scale(0.7)", opacity: "0" },
          to: { transform: "scale(1)", opacity: "1" },
        },
        winnerGlow: {
          from: { textShadow: "0 0 10px currentColor, 0 0 30px currentColor" },
          to: { textShadow: "0 0 20px currentColor, 0 0 60px currentColor, 0 0 100px currentColor" },
        },
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
