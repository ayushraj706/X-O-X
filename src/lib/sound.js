// src/lib/sound.js

// Sound library/helper
const sounds = {
  move: '/sounds/move.mp3',
  capture: '/sounds/capture.mp3',
  win: '/sounds/win.mp3',
  draw: '/sounds/draw.mp3',
  check: '/sounds/check.mp3', // Chess ke liye
  foul: '/sounds/foul.mp3',   // Carrom ke liye
  dice: '/sounds/dice.mp3',   // Ludo ke liye
};

export const playSound = (soundKey) => {
  if (typeof window !== 'undefined') {
    const audio = new Audio(sounds[soundKey] || soundKey);
    audio.play().catch(e => console.log("Sound play prevented:", e));
  }
};

