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
  fácil:    { color: '#059669', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)'  },
  facil:    { color: '#059669', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)'  },
  moderado: { color: '#d97706', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
  moderada: { color: '#d97706', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
  difícil:  { color: '#dc2626', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)'  },
  dificil:  { color: '#dc2626', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)'  },
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
    return <VapiChat caseData={selectedCase} userId="demo_user" onBack={() => setSelectedCase(null)} />;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', padding: '3rem 2rem' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', color: '#a5b4fc', padding: '0.35rem 1rem', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '1.25rem' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#818cf8', display: 'inline-block' }} />
            Sistema de Entrenamiento Clínico
          </div>
          <h1 style={{ fontSize: '2.75rem', fontWeight: '800', color: '#f1f5f9', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '0.75rem' }}>
            Paciente Virtual <span style={{ background: 'linear-gradient(135deg, #6366f1, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>IA</span>
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.95rem', maxWidth: '460px', margin: '0 auto', lineHeight: 1.65 }}>
            Practica habilidades clínicas con pacientes simulados por inteligencia artificial en tiempo real
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '5rem 0' }}>
            <div style={{ width: '2rem', height: '2rem', border: '3px solid rgba(99,102,241,0.2)', borderTop: '3px solid #6366f1', borderRadius: '50%', margin: '0 auto 1rem', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: '#475569', fontSize: '0.875rem' }}>Cargando casos clínicos...</p>
          </div>
        ) : cases.length === 0 ? (
          <div style={{ maxWidth: '420px', margin: '0 auto', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', padding: '2.5rem', borderRadius: '1.25rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📋</div>
            <p style={{ color: '#fbbf24', fontWeight: '700', marginBottom: '0.5rem' }}>Sin casos disponibles</p>
            <p style={{ color: '#78716c', fontSize: '0.8rem' }}>Ejecuta <code style={{ background: 'rgba(255,255,255,0.08)', padding: '0.1rem 0.4rem', borderRadius: '0.3rem' }}>node addCases.js</code></p>
          </div>
        ) : (
          <>
            {/* Top bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                <span style={{ color: '#e2e8f0', fontWeight: '700', fontSize: '1.1rem' }}>{cases.length}</span>
                <span style={{ marginLeft: '0.4rem' }}>pacientes en sala de espera</span>
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <a href="/admin" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '0.5rem 1rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: '600', textDecoration: 'none', transition: 'all 0.2s' }}>
                  ⚙️ Admin
                </a>
                <button
                  onClick={() => setSelectedCase(cases[Math.floor(Math.random() * cases.length)])}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#c7d2fe', padding: '0.5rem 1.25rem', borderRadius: '9999px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', transition: 'all 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.25)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(99,102,241,0.15)'}
                >
                  🎲 Caso aleatorio
                </button>
              </div>
            </div>

            {/* Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
              {cases.map(c => {
                const diff = DIFF[c.difficulty?.toLowerCase()] || { color: '#64748b', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.2)' };
                const isH  = hovered === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCase(c)}
                    onMouseEnter={() => setHovered(c.id)}
                    onMouseLeave={() => setHovered(null)}
                    style={{
                      background: isH ? '#1e293b' : '#172033',
                      border: `1px solid ${isH ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: '1.125rem',
                      padding: '1.375rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      transform: isH ? 'translateY(-3px)' : 'translateY(0)',
                      boxShadow: isH ? '0 12px 32px rgba(0,0,0,0.3)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                      <div style={{ width: '2.75rem', height: '2.75rem', borderRadius: '0.875rem', background: c.avatarGender === 'male' ? 'linear-gradient(135deg, #1d4ed8, #3b82f6)' : 'linear-gradient(135deg, #6d28d9, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                        {c.avatarGender === 'male' ? '👨' : '👩'}
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {c.specialty && <span style={{ fontSize: '0.68rem', color: '#93c5fd', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontWeight: '600' }}>{c.specialty}</span>}
                        {c.difficulty && <span style={{ fontSize: '0.68rem', color: diff.color, background: diff.bg, border: `1px solid ${diff.border}`, padding: '0.2rem 0.6rem', borderRadius: '9999px', fontWeight: '600' }}>{c.difficulty}</span>}
                      </div>
                    </div>

                    <h3 style={{ color: '#f1f5f9', fontWeight: '700', fontSize: '0.95rem', marginBottom: '0.5rem', letterSpacing: '-0.01em', lineHeight: 1.4 }}>{c.title}</h3>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.7rem', color: '#334155' }}>Consulta por voz · IA</span>
                      <span style={{ color: isH ? '#818cf8' : '#334155', fontSize: '1rem', transition: 'all 0.2s', transform: isH ? 'translateX(3px)' : 'translateX(0)', display: 'inline-block' }}>→</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
