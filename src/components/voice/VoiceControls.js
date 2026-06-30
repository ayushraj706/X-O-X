// src/components/voice/VoiceControls.js
import { useState } from 'react';
import { FaMicrophone, FaMicrophoneSlash, FaVolumeUp, FaVolumeMute } from 'react-icons/fa';

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
      {/* Microphone Button */}
      <button
        onClick={handleMicToggle}
        title={muted ? 'Unmute mic' : 'Mute mic'}
        className={`h-12 w-12 rounded-full flex items-center justify-center text-lg shadow-lg transition-all duration-200 ${
          muted 
            ? 'bg-red-500 text-white' 
            : 'bg-[#25D366] text-white hover:bg-[#20bd5a]' // WhatsApp Green Color
        }`}
      >
        {muted ? <FaMicrophoneSlash /> : <FaMicrophone />}
      </button>

      {/* Speaker/Deafen Button */}
      <button
        onClick={handleDeafenToggle}
        title={deafened ? 'Undeafen' : 'Deafen'}
        className={`h-12 w-12 rounded-full flex items-center justify-center text-lg shadow-lg transition-all duration-200 ${
          deafened 
            ? 'bg-red-500 text-white' 
            : 'bg-[#25D366] text-white hover:bg-[#20bd5a]' // WhatsApp Green Color
        }`}
      >
        {deafened ? <FaVolumeMute /> : <FaVolumeUp />}
      </button>
    </div>
  );
}
