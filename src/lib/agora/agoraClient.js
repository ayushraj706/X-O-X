// src/lib/agora/agoraClient.js
// Thin wrapper around agora-rtc-sdk-ng for voice-only (audio) channels.
// Used by any game's room — pass a unique channel name (e.g. `tictactoe_<roomCode>`).

let AgoraRTC = null;

async function loadSDK() {
  if (typeof window === 'undefined') return null;
  if (!AgoraRTC) {
    AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
  }
  return AgoraRTC;
}

export class VoiceChannel {
  constructor() {
    this.client = null;
    this.localAudioTrack = null;
    this.remoteUsers = new Map(); // uid -> { audioTrack }
    this.isMuted = false;
    this.isDeafened = false;
  }

  /** Fetch a secure token from our backend instead of using App Certificate on client */
  async _fetchToken(channelName, uid) {
    const res = await fetch('/api/agora/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelName, uid }),
    });
    if (!res.ok) throw new Error('Failed to fetch Agora token');
    return res.json();
  }

  async join(channelName, uid, { onUserJoined, onUserLeft } = {}) {
    const SDK = await loadSDK();
    if (!SDK) return;

    this.client = SDK.createClient({ mode: 'rtc', codec: 'vp8' });

    const { token, appId, uid: numericUid } = await this._fetchToken(channelName, uid);

    this.client.on('user-published', async (user, mediaType) => {
      if (mediaType !== 'audio') return;
      await this.client.subscribe(user, mediaType);
      if (!this.isDeafened) {
        user.audioTrack?.play();
      }
      this.remoteUsers.set(user.uid, user);
      onUserJoined?.(user.uid);
    });

    this.client.on('user-unpublished', (user) => {
      this.remoteUsers.delete(user.uid);
    });

    this.client.on('user-left', (user) => {
      this.remoteUsers.delete(user.uid);
      onUserLeft?.(user.uid);
    });

    await this.client.join(appId, channelName, token, numericUid);

    this.localAudioTrack = await SDK.createMicrophoneAudioTrack();
    await this.client.publish([this.localAudioTrack]);
  }

  /** Mic button: mute/unmute YOUR own outgoing voice */
  toggleMic() {
    if (!this.localAudioTrack) return this.isMuted;
    this.isMuted = !this.isMuted;
    this.localAudioTrack.setEnabled(!this.isMuted);
    return this.isMuted;
  }

  /** Speaker/Listening button: deafen/undeafen ALL incoming audio */
  toggleDeafen() {
    this.isDeafened = !this.isDeafened;
    this.remoteUsers.forEach((user) => {
      if (this.isDeafened) {
        user.audioTrack?.stop();
      } else {
        user.audioTrack?.play();
      }
    });
    return this.isDeafened;
  }

  async leave() {
    this.localAudioTrack?.close();
    if (this.client) {
      await this.client.leave();
    }
    this.remoteUsers.clear();
    this.client = null;
    this.localAudioTrack = null;
  }
}

export function createVoiceChannel() {
  return new VoiceChannel();
}
