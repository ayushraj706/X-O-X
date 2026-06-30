// pages/api/agora/token.js
// Generates a short-lived Agora RTC token server-side so the App Certificate
// never reaches the client. Used by src/lib/agora/agoraClient.js

import { RtcTokenBuilder, RtcRole } from 'agora-access-token';

const APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID;
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;
const TOKEN_EXPIRY_SECONDS = 3600; // 1 hour

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { channelName, uid } = req.body || {};

  if (!channelName || uid === undefined || uid === null) {
    return res.status(400).json({ error: 'channelName and uid are required' });
  }

  if (!APP_ID || !APP_CERTIFICATE) {
    return res.status(500).json({ error: 'Agora credentials not configured on server' });
  }

  try {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + TOKEN_EXPIRY_SECONDS;

    // Agora requires numeric uid for token generation; hash string uid into a number
    const numericUid =
      typeof uid === 'number' ? uid : Math.abs(hashCode(String(uid))) % 1000000;

    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channelName,
      numericUid,
      RtcRole.PUBLISHER,
      privilegeExpiredTs
    );

    return res.status(200).json({ token, appId: APP_ID, uid: numericUid });
  } catch (err) {
    console.error('Agora token generation failed:', err);
    return res.status(500).json({ error: 'Token generation failed' });
  }
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
