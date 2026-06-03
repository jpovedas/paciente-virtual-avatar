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
  recursos?: { tipo: string; nombre: string; valor: string; referencia?: string; unidad?: string; notas?: string; }[];
}

const DIFF: Record<string, { color: string; bg: string; border: string }> = {
  fácil:    { color: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.2)'  },
  facil:    { color: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.2)'  },
  moderado: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
  moderada: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
  difícil:  { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.2)'  },
  dificil:  { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.2)'  },
};

export default function Home() {
  const [cases, setCases]               = useState<ClinicalCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<ClinicalCase | null>(null);
  const [loading, setLoading]           = useState(true);
  const [hovered, setHovered]           = useState<string | null>(null);

  useEffect(() => {
    getDocs(collection(db, 'clinical_cases'))
      .then(snap => setCases(snap.docs.map(d => ({ id: d.id, ...d.data() })) as ClinicalCase[]))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (selectedCase) {
    return (
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setSelectedCase(null)}
          style={{ position: 'absolute', top: '0.875rem', left: '1rem', zIndex: 50, display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '0.45rem 1rem', borderRadius: '9999px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600', backdropFilter: 'blur(12px)', transition: 'all 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
        >
          ← Sala de espera
        </button>
        <VapiChat caseData={selectedCase} userId="demo_user" />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#080d1a', padding: '3rem 2rem', position: 'relative', overflow: 'hidden' }}>
      {/* Ambient background */}
      <div style={{ position: 'fixed', top: '-20%', left: '-10%', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '-20%', right: '-10%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: '1100px', margin: '0 auto', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#93c5fd', padding: '0.35rem 1rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '1.5rem' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3b82f6', display: 'inline-block', animation: 'pulse 2s ease-in-out infinite' }} />
            Sistema de Entrenamiento Clínico
          </div>
          <h1 style={{ fontSize: '3rem', fontWeight: '800', color: 'white', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '0.875rem' }}>
            Paciente Virtual <span style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>IA</span>
          </h1>
          <p style={{ color: '#475569', fontSize: '1rem', maxWidth: '480px', margin: '0 auto', lineHeight: 1.6 }}>
            Practica habilidades clínicas con pacientes simulados por inteligencia artificial en tiempo real
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '5rem 0' }}>
            <div style={{ width: '2.5rem', height: '2.5rem', border: '3px solid rgba(59,130,246,0.2)', borderTop: '3px solid #3b82f6', borderRadius: '50%', margin: '0 auto 1.25rem', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: '#334155', fontSize: '0.875rem' }}>Cargando casos clínicos...</p>
          </div>
        ) : cases.length === 0 ? (
          <div style={{ maxWidth: '440px', margin: '0 auto', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', padding: '2.5rem', borderRadius: '1.25rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📋</div>
            <p style={{ color: '#fbbf24', fontWeight: '700', marginBottom: '0.5rem' }}>Sin casos disponibles</p>
            <p style={{ color: '#78716c', fontSize: '0.8rem' }}>Ejecuta <code style={{ background: 'rgba(255,255,255,0.08)', padding: '0.1rem 0.4rem', borderRadius: '0.3rem', color: '#fbbf24' }}>node addCases.js</code> para cargar los casos de ejemplo.</p>
          </div>
        ) : (
          <>
            {/* Top bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <p style={{ color: '#334155', fontSize: '0.8rem' }}>
                  <span style={{ color: '#60a5fa', fontWeight: '700', fontSize: '1.1rem' }}>{cases.length}</span>
                  <span style={{ marginLeft: '0.4rem' }}>pacientes en sala de espera</span>
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <a href="/admin" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#475569', padding: '0.5rem 1rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600', textDecoration: 'none', transition: 'all 0.2s' }}>
                  ⚙️ Admin
                </a>
                <button
                  onClick={() => setSelectedCase(cases[Math.floor(Math.random() * cases.length)])}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#a5b4fc', padding: '0.5rem 1.25rem', borderRadius: '9999px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', transition: 'all 0.2s', letterSpacing: '0.01em' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.18)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; }}
                >
                  🎲 Caso aleatorio
                </button>
              </div>
            </div>

            {/* Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '1rem' }}>
              {cases.map(c => {
                const diff = DIFF[c.difficulty?.toLowerCase()] || { color: '#64748b', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.2)' };
                const isH  = hovered === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCase(c)}
                    onMouseEnter={() => setHovered(c.id)}
                    onMouseLeave={() => setHovered(null)}
                    style={{ background: isH ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.025)', border: `1px solid ${isH ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '1.25rem', padding: '1.375rem', cursor: 'pointer', transition: 'all 0.22s ease', transform: isH ? 'translateY(-3px)' : 'translateY(0)', boxShadow: isH ? '0 16px 40px rgba(0,0,0,0.3)' : 'none', backdropFilter: 'blur(10px)' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                      <div style={{ width: '2.75rem', height: '2.75rem', borderRadius: '0.875rem', background: c.avatarGender === 'male' ? 'linear-gradient(135deg, #1d4ed8, #3b82f6)' : 'linear-gradient(135deg, #6d28d9, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                        {c.avatarGender === 'male' ? '👨' : '👩'}
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {c.specialty && <span style={{ fontSize: '0.65rem', color: '#60a5fa', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontWeight: '600' }}>{c.specialty}</span>}
                        {c.difficulty && <span style={{ fontSize: '0.65rem', color: diff.color, background: diff.bg, border: `1px solid ${diff.border}`, padding: '0.2rem 0.6rem', borderRadius: '9999px', fontWeight: '600' }}>{c.difficulty}</span>}
                      </div>
                    </div>

                    <h3 style={{ color: 'white', fontWeight: '700', fontSize: '0.9rem', marginBottom: '0.5rem', letterSpacing: '-0.01em', lineHeight: 1.4 }}>{c.title}</h3>

                    <p style={{ color: '#334155', fontSize: '0.78rem', lineHeight: '1.5', marginBottom: '1.125rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {c.caseContext}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        {[{ icon: '🎙️', label: 'Voz' }, { icon: '🤖', label: 'IA' }].map((tag, i) => (
                          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.68rem', color: '#334155' }}>
                            <span>{tag.icon}</span>{tag.label}
                          </span>
                        ))}
                      </div>
                      <span style={{ color: isH ? '#818cf8' : '#1e293b', fontSize: '1rem', transition: 'all 0.2s', transform: isH ? 'translateX(3px)' : 'translateX(0)', display: 'inline-block' }}>→</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Feature strip */}
            <div style={{ marginTop: '3rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              {[
                { icon: '🎙️', title: 'Voz natural', desc: 'Sin botones — conversación fluida' },
                { icon: '🤖', title: 'GPT-4o mini', desc: 'Respuestas rápidas y realistas' },
                { icon: '📊', title: 'Evaluación IA', desc: 'Feedback automático con Claude' },
                { icon: '🎭', title: 'Avatar Simli', desc: 'Cara animada en tiempo real' },
              ].map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '0.875rem 1.125rem', borderRadius: '0.875rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>{f.icon}</span>
                  <div>
                    <p style={{ color: '#94a3b8', fontWeight: '600', fontSize: '0.8rem' }}>{f.title}</p>
                    <p style={{ color: '#1e293b', fontSize: '0.72rem', marginTop: '0.1rem' }}>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.4; } }
        @keyframes spin  { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
