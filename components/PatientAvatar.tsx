'use client';

interface Props {
  gender: 'male' | 'female';
  isActive: boolean;
  isSpeaking: boolean;
  isThinking: boolean;
}

export default function PatientAvatar({ gender, isActive, isSpeaking, isThinking }: Props) {
  const isFemale = gender === 'female';

  const bgGrad = isFemale
    ? 'linear-gradient(160deg, #4c1d95 0%, #6d28d9 50%, #7c3aed 100%)'
    : 'linear-gradient(160deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%)';

  const skinTone  = isFemale ? '#f5c2a0' : '#e8a87c';
  const hairColor = isFemale ? '#2d1b10' : '#1a1a2e';
  const shirtColor = isFemale ? '#7c3aed' : '#1d4ed8';

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', borderRadius: '50%', overflow: 'hidden', background: bgGrad, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

      {/* Ambient glow ring when active */}
      {isActive && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          boxShadow: isSpeaking
            ? 'inset 0 0 40px rgba(16,185,129,0.25), 0 0 0 3px rgba(16,185,129,0.6)'
            : 'inset 0 0 30px rgba(255,255,255,0.08), 0 0 0 2px rgba(255,255,255,0.2)',
          transition: 'all 0.4s ease',
        }} />
      )}

      {/* Background texture */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 80%, rgba(0,0,0,0.3) 0%, transparent 70%)', borderRadius: '50%' }} />

      {/* SVG Avatar */}
      <svg viewBox="0 0 200 220" style={{ width: '85%', height: '85%', position: 'relative', zIndex: 1 }} xmlns="http://www.w3.org/2000/svg">

        {/* Shirt / Body */}
        <ellipse cx="100" cy="195" rx="58" ry="38" fill={shirtColor} opacity="0.9" />
        <ellipse cx="100" cy="188" rx="52" ry="32" fill={shirtColor} />

        {/* Collar / neck */}
        <rect x="88" y="145" width="24" height="28" rx="8" fill={skinTone} />

        {/* Lab coat lapels (white) */}
        <path d="M 70 168 L 88 155 L 88 190 L 70 200 Z" fill="white" opacity="0.85" />
        <path d="M 130 168 L 112 155 L 112 190 L 130 200 Z" fill="white" opacity="0.85" />

        {/* Stethoscope */}
        <path d="M 88 165 Q 78 175 76 185 Q 74 195 80 198" stroke="rgba(0,0,0,0.4)" strokeWidth="3" fill="none" strokeLinecap="round" />
        <circle cx="80" cy="200" r="4" fill="rgba(0,0,0,0.4)" />

        {/* Head */}
        <ellipse cx="100" cy="105" rx="38" ry="42" fill={skinTone} />

        {/* Hair */}
        {isFemale ? (
          <>
            <ellipse cx="100" cy="72" rx="39" ry="18" fill={hairColor} />
            <path d="M 62 78 Q 58 110 62 130" stroke={hairColor} strokeWidth="12" fill="none" strokeLinecap="round" />
            <path d="M 138 78 Q 142 110 138 130" stroke={hairColor} strokeWidth="12" fill="none" strokeLinecap="round" />
            <ellipse cx="100" cy="70" rx="36" ry="16" fill={hairColor} />
            {/* Wavy hair detail */}
            <path d="M 62 90 Q 58 100 62 110 Q 58 120 62 130" stroke={hairColor} strokeWidth="10" fill="none" strokeLinecap="round" />
            <path d="M 138 90 Q 142 100 138 110 Q 142 120 138 130" stroke={hairColor} strokeWidth="10" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <ellipse cx="100" cy="70" rx="39" ry="15" fill={hairColor} />
            <path d="M 62 75 Q 60 85 63 95" stroke={hairColor} strokeWidth="10" fill="none" strokeLinecap="round" />
            <path d="M 138 75 Q 140 85 137 95" stroke={hairColor} strokeWidth="10" fill="none" strokeLinecap="round" />
          </>
        )}

        {/* Eyes */}
        <ellipse cx="85" cy="105" rx="6" ry="7" fill="white" />
        <ellipse cx="115" cy="105" rx="6" ry="7" fill="white" />
        <ellipse cx="86" cy="106" rx="4" ry="5" fill="#2d2d2d" />
        <ellipse cx="116" cy="106" rx="4" ry="5" fill="#2d2d2d" />
        {/* Eye shine */}
        <circle cx="88" cy="104" r="1.5" fill="white" />
        <circle cx="118" cy="104" r="1.5" fill="white" />

        {/* Eyebrows */}
        <path d="M 79 97 Q 85 94 91 97" stroke="#2d2d2d" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M 109 97 Q 115 94 121 97" stroke="#2d2d2d" strokeWidth="2.5" fill="none" strokeLinecap="round" />

        {/* Nose */}
        <path d="M 100 110 Q 96 120 98 124 Q 102 127 106 124 Q 108 120 104 110" stroke={`${skinTone}88`} strokeWidth="1.5" fill="none" />

        {/* Mouth — changes with speaking state */}
        {isSpeaking ? (
          // Open mouth (speaking)
          <>
            <path d="M 88 133 Q 100 142 112 133" stroke="#c97b6a" strokeWidth="2" fill="#c97b6a" />
            <path d="M 88 133 Q 100 145 112 133" fill="#8b3a2a" opacity="0.8" />
            <path d="M 91 136 Q 100 143 109 136" fill="#e8a0a0" opacity="0.6" />
          </>
        ) : isThinking ? (
          // Pursed / thinking
          <path d="M 90 133 Q 97 130 110 133" stroke="#c97b6a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        ) : (
          // Neutral / slight smile
          <path d="M 88 133 Q 100 140 112 133" stroke="#c97b6a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        )}

        {/* Ears */}
        <ellipse cx="62" cy="108" rx="7" ry="9" fill={skinTone} />
        <ellipse cx="138" cy="108" rx="7" ry="9" fill={skinTone} />
        <ellipse cx="62" cy="108" rx="4" ry="6" fill={`${skinTone}bb`} />
        <ellipse cx="138" cy="108" rx="4" ry="6" fill={`${skinTone}bb`} />

        {/* Thinking animation dots */}
        {isThinking && (
          <>
            <circle cx="80" cy="74" r="5" fill="rgba(255,255,255,0.7)" style={{ animation: 'bounce 1.2s ease-in-out infinite', animationDelay: '0s' }} />
            <circle cx="100" cy="68" r="5" fill="rgba(255,255,255,0.7)" style={{ animation: 'bounce 1.2s ease-in-out infinite', animationDelay: '0.2s' }} />
            <circle cx="120" cy="74" r="5" fill="rgba(255,255,255,0.7)" style={{ animation: 'bounce 1.2s ease-in-out infinite', animationDelay: '0.4s' }} />
          </>
        )}
      </svg>

      {/* Speaking waveform overlay at bottom */}
      {isSpeaking && (
        <div style={{ position: 'absolute', bottom: '12%', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '3px', alignItems: 'flex-end', height: '24px' }}>
          {[0.4, 0.7, 1, 0.8, 0.5, 0.9, 0.6, 1, 0.7, 0.4].map((h, i) => (
            <div key={i} style={{ width: '3px', background: 'rgba(255,255,255,0.7)', borderRadius: '9999px', height: `${h * 22}px`, animation: `wave ${0.5 + i * 0.04}s ease-in-out infinite`, animationDelay: `${i * 0.07}s` }} />
          ))}
        </div>
      )}

      {/* Idle subtle pulse ring */}
      {isActive && !isSpeaking && !isThinking && (
        <div style={{ position: 'absolute', inset: '6px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)', animation: 'idlePulse 3s ease-in-out infinite' }} />
      )}

      <style jsx>{`
        @keyframes wave { 0%,100% { transform: scaleY(0.4); } 50% { transform: scaleY(1.2); } }
        @keyframes bounce { 0%,100% { transform: translateY(0); opacity: 0.4; } 50% { transform: translateY(-6px); opacity: 1; } }
        @keyframes idlePulse { 0%,100% { opacity: 0.2; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.02); } }
      `}</style>
    </div>
  );
}
