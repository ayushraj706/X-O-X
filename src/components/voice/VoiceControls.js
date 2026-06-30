// src/components/voice/VoiceControls.js
import { useState } from 'react';

export default function VoiceControls({ voiceChannel }) {
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);

  const handleMicToggle = () => {
    if (!voiceChannel) return;
    const newState = voiceChannel.toggleMic();
    setMuted(newState);
  };

  const handleDeafenToggle = () => {
    if (!voiceChannel) return;
    const newState = voiceChannel.toggleDeafen();
    setDeafened(newState);
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleMicToggle}
        title={muted ? 'Unmute mic' : 'Mute mic'}
        className={`h-12 w-12 rounded-full flex items-center justify-center text-xl shadow-wa transition ${
          muted
            ? 'bg-red-500 text-white'
            : 'bg-wa-gradient hover:bg-wa-gradient-hover text-white'
        }`}
      >
        {muted ? '🎙️🚫' : '🎙️'}
      </button>

      <button
        onClick={handleDeafenToggle}
        title={deafened ? 'Undeafen' : 'Deafen'}
        className={`h-12 w-12 rounded-full flex items-center justify-center text-xl shadow-wa transition ${
          deafened
            ? 'bg-red-500 text-white'
            : 'bg-wa-gradient hover:bg-wa-gradient-hover text-white'
        }`}
      >
        {deafened ? '🔇' : '🔊'}
      </button>
    </div>
  );
}
