/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,jsx}',
    './src/**/*.{js,jsx}',
    './games/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // WhatsApp "@" icon inspired palette: vibrant green, white, dark teal/charcoal
        wa: {
          green: '#25D366',     // primary vibrant green
          greenDark: '#128C7E', // deep teal-green
          dark: '#075E54',      // dark teal (WhatsApp dark accent)
          panelDark: '#0B141A', // near-black dark mode background
          panelLight: '#FFFFFF',
          bubble: '#DCF8C6',
        },
      },
      backgroundImage: {
        'wa-gradient': 'linear-gradient(135deg, #25D366 0%, #128C7E 50%, #075E54 100%)',
        'wa-gradient-hover': 'linear-gradient(135deg, #2EE676 0%, #15A18F 50%, #097266 100%)',
      },
      boxShadow: {
        wa: '0 4px 14px rgba(37, 211, 102, 0.35)',
      },
    },
  },
  plugins: [],
};
