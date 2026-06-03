'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import VapiChat from '@/components/VapiChat';

interface ClinicalCase {
  id: string;
  title: string;
  specialty: string;
  difficulty: string;
  caseContext: string;
  avatarGender: 'male' | 'female';
}

const difficultyConfig: Record<string, { color: string; bg: string; border: string }> = {
  fácil:    { color: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
  facil:    { color: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
  moderado: { color: '#92400e', bg: '#fffbeb', border: '#fde68a' },
  moderada: { color: '#92400e', bg: '#fffbeb', border: '#fde68a' },
  difícil:  { color: '#991b1b', bg: '#fef2f2', border: '#fecaca' },
  dificil:  { color: '#991b1b', bg: '#fef2f2', border: '#fecaca' },
};

export default function Home() {
  const [cases, setCases] = useState<ClinicalCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<ClinicalCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => { loadCases(); }, []);

  const loadCases = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'clinical_cases'));
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ClinicalCase[];
      setCases(data);
    } catch (error) {
      console.error('Error loading cases:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectRandom = () => {
    if (cases.length === 0) return;
    setSelectedCase(cases[Math.floor(Math.random() * cases.length)]);
  };

  if (selectedCase) {
    return (
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setSelectedCase(null)}
          style={{ position: 'absolute', top: '1rem', left: '1rem', zIndex: 50, background: 'white', padding: '0.6rem 1.25rem', borderRadius: '0.75rem', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.875rem', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', transition: 'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.transform = 'scale(1.03)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.transform = 'scale(1)'; }}
        >
          ← Sala de espera
        </button>
        <VapiChat caseData={selectedCase} userId="demo_user" />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)', padding: '3rem 2rem' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🩺</div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '800', background: 'linear-gradient(to right, #60a5fa, #a78bfa, #f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: '0 0 0.75rem' }}>
            Paciente Virtual IA
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '1.1rem', margin: 0 }}>
            Entrena tus habilidades clínicas con pacientes simulados por inteligencia artificial
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem 0' }}>
            <div style={{ width: '3rem', height: '3rem', border: '4px solid rgba(96,165,250,0.3)', borderTop: '4px solid #60a5fa', borderRadius: '50%', margin: '0 auto 1rem', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: '#94a3b8' }}>Cargando casos clínicos...</p>
          </div>
        ) : cases.length === 0 ? (
          <div style={{ background: 'rgba(251,191,36,0.08)', border: '2px solid rgba(251,191,36,0.25)', padding: '2.5rem', borderRadius: '1.25rem', textAlign: 'center', maxWidth: '500px', margin: '0 auto' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📋</div>
            <p style={{ color: '#fbbf24', fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem' }}>No hay casos disponibles todavía</p>
            <p style={{ color: '#fde68a', fontSize: '0.875rem', margin: 0 }}>
              Agrega documentos a la colección <code style={{ background: 'rgba(255,255,255,0.1)', padding: '0.1rem 0.4rem', borderRadius: '0.25rem' }}>clinical_cases</code> en Firestore.
            </p>
          </div>
        ) : (
          <>
            {/* Controls bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', margin: 0 }}>
                <span style={{ color: '#60a5fa', fontWeight: '700', fontSize: '1.1rem' }}>{cases.length}</span> pacientes en sala de espera
              </p>
              <button
                onClick={selectRandom}
                style={{ background: 'linear-gradient(to right, #7c3aed, #6d28d9)', color: 'white', fontWeight: '700', padding: '0.6rem 1.5rem', borderRadius: '0.75rem', border: 'none', cursor: 'pointer', fontSize: '0.875rem', boxShadow: '0 4px 15px rgba(124,58,237,0.4)', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(124,58,237,0.5)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(124,58,237,0.4)'; }}
              >
                🎲 Caso aleatorio
              </button>
            </div>

            {/* Cases grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
              {cases.map(c => {
                const diff = difficultyConfig[c.difficulty?.toLowerCase()] || { color: '#475569', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.3)' };
                const isHovered = hoveredId === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCase(c)}
                    onMouseEnter={() => setHoveredId(c.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      background: isHovered
                        ? 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(99,102,241,0.1))'
                        : 'rgba(30,41,59,0.7)',
                      border: `1px solid ${isHovered ? 'rgba(99,102,241,0.5)' : 'rgba(148,163,184,0.15)'}`,
                      borderRadius: '1.25rem',
                      padding: '1.5rem',
                      cursor: 'pointer',
                      transition: 'all 0.25s ease',
                      transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
                      boxShadow: isHovered ? '0 20px 40px rgba(0,0,0,0.3)' : '0 4px 6px rgba(0,0,0,0.1)',
                      backdropFilter: 'blur(10px)',
                    }}
                  >
                    {/* Card header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                      <div style={{ width: '3rem', height: '3rem', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', borderRadius: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
                        {c.avatarGender === 'male' ? '👨' : '👩'}
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {c.specialty && (
                          <span style={{ fontSize: '0.7rem', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#93c5fd', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontWeight: '600' }}>
                            {c.specialty}
                          </span>
                        )}
                        {c.difficulty && (
                          <span style={{ fontSize: '0.7rem', background: diff.bg, border: `1px solid ${diff.border}`, color: diff.color, padding: '0.2rem 0.6rem', borderRadius: '9999px', fontWeight: '600' }}>
                            {c.difficulty}
                          </span>
                        )}
                      </div>
                    </div>

                    <h3 style={{ color: 'white', fontWeight: '700', fontSize: '1rem', margin: '0 0 0.5rem', lineHeight: '1.4' }}>{c.title}</h3>

                    <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '0 0 1.25rem', lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {c.caseContext}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
                        Voz en tiempo real · Transcripción automática
                      </span>
                      <span style={{ color: isHovered ? '#818cf8' : '#475569', fontSize: '1.25rem', transition: 'all 0.2s' }}>→</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Features footer */}
            <div style={{ marginTop: '3rem', background: 'rgba(30,41,59,0.4)', borderRadius: '1rem', padding: '1.5rem 2rem', border: '1px solid rgba(148,163,184,0.1)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                {[
                  { icon: '🎙️', text: 'Conversación por voz sin botones' },
                  { icon: '🤖', text: 'Paciente simulado con GPT-4o' },
                  { icon: '📊', text: 'Evaluación automática con Claude' },
                  { icon: '🎭', text: 'Avatar animado en tiempo real' },
                ].map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.25rem' }}>{f.icon}</span>
                    <span style={{ color: '#cbd5e1', fontSize: '0.875rem' }}>{f.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
