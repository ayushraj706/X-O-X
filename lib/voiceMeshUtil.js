// lib/voiceMeshUtil.js
// ─────────────────────────────────────────────────────────────────────────────
// NeonX Immersive Gaming Suite — Dynamic REST API Cloud Voice Engine
// Optimization: Automated Token Refresh Mechanism (No Manual Password Expiry)
// ─────────────────────────────────────────────────────────────────────────────

import { ref, set, onValue, off, remove } from "firebase/database";

export class VoiceMeshManager {
  constructor(db, roomId, profile, showError) {
    this.db = db;
    this.roomId = roomId;
    this.profile = profile;
    this.showError = showError;
    this.localStream = null;
    this.connectedPeers = {};
    
    // Identity verification parameters clean wrapper
    const cleanName = profile.name.replace(/[.#$/\[\]]/g, "_");
    this.myAudioId = `${cleanName}_${Math.random().toString(36).substring(2, 5)}`;
    this.peerRegistryRef = ref(db, `rooms/${roomId}/voice_mesh/${this.myAudioId}`);
    
    // Metered REST API Secure Endpoint Configuration
    this.apiKey = "1f07b5e3f0c0cf3f763a4781ab7e453b4750";
    this.iceServers = []; // Runtime par automatic populate hoga
  }

  /**
   * Fetches fresh, valid iceServers credentials directly via Metered REST API
   */
  async fetchLiveIceServers() {
    try {
      const response = await fetch(`https://basekey.metered.live/api/v1/turn/credentials?apiKey=${this.apiKey}`);
      if (!response.ok) throw new Error("Metered API Connection Error");
      
      this.iceServers = await response.json();
    } catch (err) {
      console.warn("Dynamic API fetch failed. Falling back to high-priority Google STUN tracking.");
      // Fallback in case of server timeout or connection drops
      this.iceServers = [{ urls: "stun:stun.l.google.com:19302" }];
    }
  }

  async startBroadcast(onRemoteTrackCallback) {
    try {
      // CRITICAL: Room setup se pehle live cloud credentials fetch karo
      await this.fetchLiveIceServers();

      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      await set(this.peerRegistryRef, { active: true });

      const wholeMeshRef = ref(this.db, `rooms/${this.roomId}/voice_mesh`);
      onValue(wholeMeshRef, (snapshot) => {
        if (!snapshot.exists()) return;
        const currentNodes = snapshot.val();

        Object.keys(currentNodes).forEach((remoteNodeId) => {
          if (remoteNodeId === this.myAudioId || this.connectedPeers[remoteNodeId]) return;

          try {
            // Initializing connection with fresh dynamic tokens
            const pc = new RTCPeerConnection({
              iceServers: this.iceServers,
              iceTransportPolicy: "all",
              bundlePolicy: "max-bundle"
            });
            
            this.localStream.getTracks().forEach(track => pc.addTrack(track, this.localStream));

            const audioEl = document.createElement("audio");
            audioEl.autoplay = true;

            pc.ontrack = (e) => {
              if (e.streams[0] && onRemoteTrackCallback) {
                audioEl.srcObject = e.streams[0];
                onRemoteTrackCallback(remoteNodeId, audioEl);
              }
            };

            pc.onicecandidate = (e) => {
              if (e.candidate) {
                set(ref(this.db, `rooms/${this.roomId}/voice_signals/${remoteNodeId}/${this.myAudioId}/${Date.now()}`), JSON.stringify(e.candidate));
              }
            };

            this.connectedPeers[remoteNodeId] = { pc, audioEl };

            if (this.myAudioId > remoteNodeId) {
              pc.createOffer().then(async (offer) => {
                await pc.setLocalDescription(offer);
                await set(ref(this.db, `rooms/${this.roomId}/voice_handshakes/${remoteNodeId}/${this.myAudioId}`), JSON.stringify(offer));
              }).catch(() => console.warn("Handshake holding safely on thread locker."));
            }
          } catch (pcInitError) {
            console.error("Network restriction detected, executing emergency backup route:", pcInitError);
            this.executeStunOnlyFallback(remoteNodeId, onRemoteTrackCallback);
          }
        });
      });

      // ─── SIGNALING HANDSHAKE SYNC CHANNELS ─────────────────────────────────────
      onValue(ref(this.db, `rooms/${this.roomId}/voice_handshakes/${this.myAudioId}`), async (snapshot) => {
        if (!snapshot.exists()) return;
        const incomingOffers = snapshot.val();
        Object.keys(incomingOffers).forEach(async (senderId) => {
          const peerObj = this.connectedPeers[senderId];
          if (!peerObj) return;
          const pc = peerObj.pc;
          if (pc.signalingState === "stable") return;
          
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(incomingOffers[senderId])));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await set(ref(this.db, `rooms/${this.roomId}/voice_handshakes/${senderId}/${this.myAudioId}_reply`), JSON.stringify(answer));
          } catch(err) { console.warn("Handshake exception recovered safely."); }
        });
      });

      onValue(ref(this.db, `rooms/${this.roomId}/voice_handshakes`), (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.val();
        Object.keys(data).forEach(targetId => {
          Object.keys(data[targetId]).forEach(async (key) => {
            if (key.endsWith("_reply") && key.startsWith(this.myAudioId)) {
              const originalSenderId = targetId;
              const peerObj = this.connectedPeers[originalSenderId];
              if (peerObj && peerObj.pc.signalingState === "have-local-offer") {
                try {
                  await peerObj.pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(data[targetId][key])));
                } catch(e) {}
              }
            }
          });
        });
      });

      onValue(ref(this.db, `rooms/${this.roomId}/voice_signals/${this.myAudioId}`), (snapshot) => {
        if (!snapshot.exists()) return;
        const foreignIce = snapshot.val();
        Object.keys(foreignIce).forEach(senderId => {
          const peerObj = this.connectedPeers[senderId];
          if (!peerObj) return;
          Object.values(foreignIce[senderId]).forEach(candidateStr => {
            try { 
              peerObj.pc.addIceCandidate(new RTCIceCandidate(JSON.parse(candidateStr))); 
            } catch(e){}
          });
        });
      });

    } catch (err) {
      this.showError("Microphone hardware layer allocation failed.");
    }
  }

  // Pure STUN routing node for local/same network traffic fallbacks
  executeStunOnlyFallback(remoteNodeId, onRemoteTrackCallback) {
    try {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      if (this.localStream) this.localStream.getTracks().forEach(track => pc.addTrack(track, this.localStream));
      
      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      pc.ontrack = (e) => {
        if (e.streams[0] && onRemoteTrackCallback) {
          audioEl.srcObject = e.streams[0];
          onRemoteTrackCallback(remoteNodeId, audioEl);
        }
      };
      this.connectedPeers[remoteNodeId] = { pc, audioEl };
    } catch(e) { console.error("Critical fallback stack error."); }
  }

  setMicState(enabled) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(t => t.enabled = enabled);
    }
  }

  setSpeakerState(enabled) {
    Object.values(this.connectedPeers).forEach(peer => {
      if (peer.audioEl) peer.audioEl.muted = !enabled;
    });
  }

  stopBroadcast() {
    try { remove(this.peerRegistryRef); } catch(e){}
    if (this.localStream) this.localStream.getTracks().forEach(t => t.stop());
    Object.values(this.connectedPeers).forEach(peer => {
      if (peer.pc) peer.pc.close();
    });
    off(ref(this.db, `rooms/${this.roomId}/voice_mesh`));
    off(ref(this.db, `rooms/${this.roomId}/voice_handshakes`));
    off(ref(this.db, `rooms/${this.roomId}/voice_signals/${this.myAudioId}`));
  }
}
