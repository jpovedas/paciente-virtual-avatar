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

    try {
      await simli.start();
    } catch (err) {
      console.warn('Simli connection failed:', err);
      setStatus('failed');
      simliRef.current = null;
    }
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
          gap: '0.5rem',
          background: gender === 'male'
            ? 'linear-gradient(135deg, #1e3a5f, #2563eb44)'
            : 'linear-gradient(135deg, #3b1f5e, #7c3aed44)',
        }}>
          <div style={{
            width: '70%',
            height: '70%',
            borderRadius: '50%',
            background: gender === 'male'
              ? 'linear-gradient(135deg, #1d4ed8, #3b82f6)'
              : 'linear-gradient(135deg, #6d28d9, #a78bfa)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '3.5rem',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}>
            {gender === 'male' ? '👨' : '👩'}
          </div>
          {status === 'connecting' && (
            <div style={{
              position: 'absolute',
              bottom: '12%',
              width: '1rem',
              height: '1rem',
              border: '2px solid rgba(255,255,255,0.3)',
              borderTop: '2px solid white',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
          )}
        </div>
      )}
      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
