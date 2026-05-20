// lib/voiceMeshUtil.js
import { ref, set, onValue, off, remove } from "firebase/database";

/**
 * Custom WebRTC Multi-User Mesh Voice Channel Manager
 */
export class VoiceMeshManager {
  constructor(db, roomId, profile, showError) {
    this.db = db;
    this.roomId = roomId;
    this.profile = profile;
    this.showError = showError;
    this.localStream = null;
    this.connectedPeers = {};
    this.myAudioId = `${profile.name}_${Math.random().toString(36).substring(2, 5)}`;
    this.peerRegistryRef = ref(db, `rooms/${roomId}/voice_mesh/${this.myAudioId}`);
    
    // Default system servers (STUN) + Future Custom TURN placeholder
    this.rtcConfig = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        // Jab Linux par COTURN deploy ho jaye, tab apna credentials yahan daalna:
        // { urls: "turn:YOUR_LINUX_SERVER_IP:3478", username: "ayush", credential: "merapassword123" }
      ]
    };
  }

  async startBroadcast(onRemoteTrackCallback) {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Register into global directory
      await set(this.peerRegistryRef, { active: true });

      const wholeMeshRef = ref(this.db, `rooms/${this.roomId}/voice_mesh`);
      onValue(wholeMeshRef, (snapshot) => {
        if (!snapshot.exists()) return;
        const currentNodes = snapshot.val();

        Object.keys(currentNodes).forEach((remoteNodeId) => {
          if (remoteNodeId === this.myAudioId || this.connectedPeers[remoteNodeId]) return;

          const pc = new RTCPeerConnection(this.rtcConfig);
          this.localStream.getTracks().forEach(track => pc.addTrack(track, this.localStream));

          const audioEl = document.createElement("audio");
          audioEl.autoplay = true;

          pc.ontrack = (e) => {
            if (e.streams[0]) {
              audioEl.srcObject = e.streams[0];
              if (onRemoteTrackCallback) onRemoteTrackCallback(remoteNodeId, audioEl);
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
            });
          }
        });
      });

      // Listen to incoming handshakes
      onValue(ref(this.db, `rooms/${this.roomId}/voice_handshakes/${this.myAudioId}`), async (snapshot) => {
        if (!snapshot.exists()) return;
        const incomingOffers = snapshot.val();
        Object.keys(incomingOffers).forEach(async (senderId) => {
          const peerObj = this.connectedPeers[senderId];
          if (!peerObj) return;
          const pc = peerObj.pc;
          if (pc.signalingState === "stable") return;
          
          await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(incomingOffers[senderId])));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await set(ref(this.db, `rooms/${this.roomId}/voice_handshakes/${senderId}/${this.myAudioId}_reply`), JSON.stringify(answer));
        });
      });

      // Sync replies back
      onValue(ref(this.db, `rooms/${this.roomId}/voice_handshakes`), (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.val();
        Object.keys(data).forEach(targetId => {
          Object.keys(data[targetId]).forEach(async (key) => {
            if (key.endsWith("_reply") && key.startsWith(this.myAudioId)) {
              const originalSenderId = targetId;
              const peerObj = this.connectedPeers[originalSenderId];
              if (peerObj && peerObj.pc.signalingState === "have-local-offer") {
                await peerObj.pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(data[targetId][key])));
              }
            }
          });
        });
      });

      // Load ICE candidates
      onValue(ref(this.db, `rooms/${this.roomId}/voice_signals/${this.myAudioId}`), (snapshot) => {
        if (!snapshot.exists()) return;
        const foreignIce = snapshot.val();
        Object.keys(foreignIce).forEach(senderId => {
          const peerObj = this.connectedPeers[senderId];
          if (!peerObj) return;
          Object.values(foreignIce[senderId]).forEach(candidateStr => {
            try { peerObj.pc.addIceCandidate(new RTCIceCandidate(JSON.parse(candidateStr))); } catch(e){}
          });
        });
      });

    } catch (err) {
      this.showError("Microphone hardware trace block execution.");
    }
  }

  setMicState(enabled) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(t => t.enabled = enabled);
    }
  }

  setSpeakerState(enabled) {
    Object.values(this.connectedPeers).forEach(peer => {
      peer.audioEl.muted = !enabled;
    });
  }

  stopBroadcast() {
    remove(this.peerRegistryRef);
    if (this.localStream) this.localStream.getTracks().forEach(t => t.stop());
    Object.values(this.connectedPeers).forEach(peer => peer.pc.close());
    off(ref(this.db, `rooms/${this.roomId}/voice_mesh`));
    off(ref(this.db, `rooms/${this.roomId}/voice_handshakes`));
  }
}
