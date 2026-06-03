'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  gender: 'male' | 'female';
  isActive: boolean;
}

type Status = 'idle' | 'connecting' | 'connected' | 'error';

export default function DIDAvatar({ gender, isActive }: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const pcRef       = useRef<RTCPeerConnection | null>(null);
  const streamIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    if (isActive) { startStream(); }
    else          { stopStream();  }
    return () => { stopStream(); };
  }, [isActive]);

  const startStream = async () => {
    if (pcRef.current) return;
    setStatus('connecting');
    try {
      // 1. Create D-ID stream (server-side proxy)
      const res = await fetch('/api/did/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gender }),
      });
      const { id, offer, ice_servers, session_id, error } = await res.json();
      if (error) throw new Error(error);

      streamIdRef.current  = id;
      sessionIdRef.current = session_id ?? id;

      // 2. Set up WebRTC peer connection
      const pc = new RTCPeerConnection({ iceServers: ice_servers });
      pcRef.current = pc;

      // 3. Send ICE candidates to D-ID
      pc.onicecandidate = ({ candidate }) => {
        if (!candidate) return;
        fetch('/api/did/ice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            session_id: sessionIdRef.current,
            candidate:      candidate.candidate,
            sdpMid:         candidate.sdpMid,
            sdpMLineIndex:  candidate.sdpMLineIndex,
          }),
        }).catch(() => {});
      };

      // 4. Receive video track
      pc.ontrack = (event) => {
        if (event.track.kind === 'video' && videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          setStatus('connected');
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setStatus('error');
        }
      };

      // 5. Exchange SDP
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await fetch('/api/did/sdp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, session_id: sessionIdRef.current, answer }),
      });

    } catch (err) {
      console.warn('DIDAvatar error:', err);
      setStatus('error');
    }
  };

  const stopStream = async () => {
    const id = streamIdRef.current;
    if (id) {
      fetch('/api/did/stream', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, session_id: sessionIdRef.current }),
      }).catch(() => {});
      streamIdRef.current  = null;
      sessionIdRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus('idle');
  };

  const emoji = gender === 'male' ? '👨‍⚕️' : '👩‍⚕️';

  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative',
      borderRadius: '50%', overflow: 'hidden',
      background: gender === 'male'
        ? 'linear-gradient(135deg, #1e3a5f, #1d4ed8)'
        : 'linear-gradient(135deg, #3b1f5e, #6d28d9)',
    }}>
      {/* Video stream */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%', height: '100%', objectFit: 'cover',
          display: status === 'connected' ? 'block' : 'none',
        }}
      />

      {/* Fallback while connecting or on error */}
      {status !== 'connected' && (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.625rem' }}>
          <span style={{ fontSize: '3.5rem' }}>{emoji}</span>
          {status === 'connecting' && (
            <div style={{ width: '1.25rem', height: '1.25rem', border: '2px solid rgba(255,255,255,0.2)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
          )}
          {status === 'error' && (
            <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '0 0.5rem' }}>Sin conexión</span>
          )}
        </div>
      )}
    </div>
  );
}
