'use client';

import { useEffect, useRef, useState } from 'react';
import { SimliClient } from 'simli-client';

interface SimliAvatarProps {
  faceId: string;
  gender: 'male' | 'female';
  isActive: boolean;
}

export default function SimliAvatar({ faceId, gender, isActive }: SimliAvatarProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const simliRef = useRef<SimliClient | null>(null);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'failed'>('idle');

  useEffect(() => {
    if (isActive && !simliRef.current) {
      initSimli();
    }
    if (!isActive && simliRef.current) {
      simliRef.current.close();
      simliRef.current = null;
      setStatus('idle');
    }
    return () => {
      if (!isActive && simliRef.current) {
        simliRef.current.close();
        simliRef.current = null;
      }
    };
  }, [isActive]);

  const initSimli = async () => {
    const apiKey = process.env.NEXT_PUBLIC_SIMLI_API_KEY;
    if (!apiKey || !videoRef.current || !audioRef.current) return;

    setStatus('connecting');

    const simli = new SimliClient();
    simliRef.current = simli;

    simli.on('connected', () => setStatus('connected'));
    simli.on('failed', () => setStatus('failed'));
    simli.on('disconnected', () => setStatus('idle'));

    simli.Initialize({
      apiKey,
      faceID: faceId,
      handleSilence: true,
      maxSessionLength: 600,
      maxIdleTime: 120,
      session_token: '',
      videoRef: videoRef.current,
      audioRef: audioRef.current,
      enableConsoleLogs: false,
      SimliURL: '',
      maxRetryAttempts: 3,
      retryDelay_ms: 2000,
      videoReceivedTimeout: 15000,
      model: 'fasttalk',
    });

    await simli.start();
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      borderRadius: '50%',
      overflow: 'hidden',
      background: 'linear-gradient(135deg, #475569, #334155)',
    }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: status === 'connected' ? 'block' : 'none',
        }}
      />
      <audio ref={audioRef} autoPlay />

      {status !== 'connected' && (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
        }}>
          <span style={{ fontSize: '4rem' }}>{gender === 'male' ? '👨' : '👩'}</span>
          {status === 'connecting' && (
            <div style={{
              width: '1.25rem',
              height: '1.25rem',
              border: '3px solid rgba(96, 165, 250, 0.3)',
              borderTop: '3px solid #60a5fa',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
          )}
          {status === 'failed' && (
            <span style={{ fontSize: '0.75rem', color: '#fca5a5' }}>Sin conexión</span>
          )}
        </div>
      )}
    </div>
  );
}
