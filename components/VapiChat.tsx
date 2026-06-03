'use client';

import { useState, useEffect, useRef } from 'react';
import Vapi from '@vapi-ai/web';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import SimliAvatar from './SimliAvatar';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface Evaluation {
  score: number;
  diagnostico_identificado: boolean;
  diagnostico_probable: string;
  fortalezas: string[];
  areas_mejora: string[];
  preguntas_clave_realizadas: string[];
  preguntas_faltantes: string[];
  resumen: string;
}

interface Recurso {
  tipo: string;
  nombre: string;
  valor: string;
  referencia?: string;
  unidad?: string;
  notas?: string;
}

interface VapiChatProps {
  caseData: {
    id: string;
    title: string;
    specialty: string;
    difficulty: string;
    caseContext: string;
    avatarGender: 'male' | 'female';
    recursos?: Recurso[];
  };
  userId: string;
}

function buildSystemPrompt(caseData: VapiChatProps['caseData']): string {
  const recursos = caseData.recursos ?? [];

  const recursosText = recursos.length > 0
    ? `\n\nRECURSOS CLÍNICOS DISPONIBLES (entrégalos SOLO si el médico los solicita explícitamente, nunca los menciones espontáneamente):
${recursos.map(r => {
  const ref = r.referencia ? ` (ref: ${r.referencia})` : '';
  const notas = r.notas ? ` — ${r.notas}` : '';
  return `- ${r.tipo.toUpperCase()} | ${r.nombre}: ${r.valor}${r.unidad ? ' ' + r.unidad : ''}${ref}${notas}`;
}).join('\n')}

Cuando el médico pida un examen disponible, dile algo como: "Aquí tiene, doctor: [nombre] resultó [valor]". Si pide algo que no está disponible, di que todavía no tienes ese resultado.`
    : '';

  return `Eres un paciente en consulta médica. Responde SIEMPRE en 1-2 oraciones cortas, en primera persona, lenguaje coloquial mexicano.

CASO: ${caseData.caseContext}${recursosText}

REGLAS ESTRICTAS:
- Máximo 2 oraciones por respuesta
- Sin términos médicos. Si no sabes algo de tu historia, di "no sé"
- Di "doctor" solo al inicio o cuando estés muy preocupado, no en cada respuesta
- Emociones sutiles y naturales
- Responde directo, sin rodeos
- NUNCA reveles tu diagnóstico ni los resultados de exámenes a menos que el médico los solicite`;
}

const DIFF_COLOR: Record<string, string> = {
  fácil: '#10b981', facil: '#10b981',
  moderado: '#f59e0b', moderada: '#f59e0b',
  difícil: '#ef4444', dificil: '#ef4444',
};

export default function VapiChat({ caseData, userId }: VapiChatProps) {
  const [isCallActive, setIsCallActive]     = useState(false);
  const [messages, setMessages]             = useState<Message[]>([]);
  const [callDuration, setCallDuration]     = useState(0);
  const [sessionId, setSessionId]           = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking]         = useState(false);
  const [isThinking, setIsThinking]         = useState(false);
  const [evaluation, setEvaluation]         = useState<Evaluation | null>(null);
  const [isEvaluating, setIsEvaluating]     = useState(false);
  const [showEvaluation, setShowEvaluation] = useState(false);

  const vapiRef        = useRef<Vapi | null>(null);
  const timerRef       = useRef<NodeJS.Timeout | null>(null);
  const mergeTimerRef  = useRef<NodeJS.Timeout | null>(null);
  const messagesRef    = useRef<Message[]>([]);
  const sessionIdRef   = useRef<string | null>(null);
  const callDurRef     = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { messagesRef.current  = messages;   }, [messages]);
  useEffect(() => { sessionIdRef.current = sessionId;  }, [sessionId]);
  useEffect(() => { callDurRef.current   = callDuration; }, [callDuration]);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
    if (!key) return;
    vapiRef.current = new Vapi(key);
    vapiRef.current.on('call-start',  handleCallStart);
    vapiRef.current.on('call-end',    handleCallEnd);
    vapiRef.current.on('speech-start', () => { setIsSpeaking(true);  setIsThinking(false); });
    vapiRef.current.on('speech-end',   () =>   setIsSpeaking(false));
    vapiRef.current.on('message',     handleMessage);
    vapiRef.current.on('error',       () => {});
    return () => {
      vapiRef.current?.stop();
      if (timerRef.current)      clearInterval(timerRef.current);
      if (mergeTimerRef.current) clearTimeout(mergeTimerRef.current);
    };
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  /* ── session ── */
  const createSession = async () => {
    try {
      const ref = await addDoc(collection(db, 'sessions'), {
        userId, caseId: caseData.id, caseTitle: caseData.title,
        messages: [], startTime: serverTimestamp(), status: 'active',
      });
      setSessionId(ref.id);
      return ref.id;
    } catch (e) { console.error(e); return null; }
  };

  /* ── call handlers ── */
  const handleCallStart = () => {
    setIsCallActive(true);
    timerRef.current = setInterval(() => setCallDuration(p => p + 1), 1000);
  };

  const handleCallEnd = async () => {
    setIsCallActive(false); setIsSpeaking(false); setIsThinking(false);
    if (timerRef.current) clearInterval(timerRef.current);
    const sid  = sessionIdRef.current;
    const dur  = callDurRef.current;
    const msgs = messagesRef.current;
    if (sid) updateDoc(doc(db, 'sessions', sid), { endTime: serverTimestamp(), duration: dur, status: 'completed' }).catch(console.error);
    if (msgs.length > 0) evaluateSession(msgs);
  };

  const evaluateSession = async (msgs: Message[]) => {
    setIsEvaluating(true); setShowEvaluation(true);
    try {
      const res  = await fetch('/api/evaluate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: msgs, caseContext: caseData.caseContext, caseTitle: caseData.title }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEvaluation(data);
    } catch (e: any) { console.error(e); } finally { setIsEvaluating(false); }
  };

  const handleMessage = (message: any) => {
    if (message.type === 'transcript' && message.transcriptType === 'final' && message.role === 'user') setIsThinking(true);
    if (message.type !== 'transcript' || message.transcriptType !== 'final') return;
    const incoming: Message = { role: message.role, content: message.transcript.trim(), timestamp: Date.now() };
    if (!incoming.content) return;
    if (mergeTimerRef.current) clearTimeout(mergeTimerRef.current);
    mergeTimerRef.current = setTimeout(() => {
      setMessages(prev => {
        const last = prev[prev.length - 1];
        let updated: Message[];
        if (last && last.role === incoming.role && Date.now() - last.timestamp < 3000) {
          updated = [...prev.slice(0, -1), { ...last, content: last.content + ' ' + incoming.content, timestamp: Date.now() }];
        } else { updated = [...prev, incoming]; }
        const sid = sessionIdRef.current;
        if (sid) updateDoc(doc(db, 'sessions', sid), { messages: updated }).catch(console.error);
        return updated;
      });
    }, 1200);
  };

  const startCall = async () => {
    if (!vapiRef.current) return;
    try {
      await createSession();
      await vapiRef.current.start({
        model: {
          provider: 'openai', model: 'gpt-4o-mini', temperature: 0.6,
          messages: [{ role: 'system', content: buildSystemPrompt(caseData) }],
        },
        voice: { provider: 'cartesia', voiceId: caseData.avatarGender === 'male' ? '5619d38c-cf51-4d8e-9575-48f61a280413' : 'b7d50908-b17c-442d-ad8d-810c63997ed9', model: 'sonic-multilingual', language: 'es' } as any,
        transcriber: { provider: 'deepgram', model: 'nova-3', language: 'es' },
        firstMessage: 'Hola doctor, buenos días.',
      });
    } catch (e: any) { console.warn('Call start failed:', e?.message); }
  };

  const endCall = () => vapiRef.current?.stop();

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const scoreColor = (n: number) => n >= 8 ? '#10b981' : n >= 5 ? '#f59e0b' : '#ef4444';

  /* ── status badge ── */
  const statusConfig = !isCallActive
    ? { label: 'En espera', color: '#64748b', dot: '#475569' }
    : isSpeaking
    ? { label: 'Paciente hablando', color: '#10b981', dot: '#10b981' }
    : isThinking
    ? { label: 'Procesando...', color: '#f59e0b', dot: '#f59e0b' }
    : { label: 'Escuchando', color: '#3b82f6', dot: '#3b82f6' };

  const avatarRing = isCallActive
    ? isSpeaking ? 'ringGreen 2s ease-in-out infinite' : 'ringBlue 2s ease-in-out infinite'
    : 'none';

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#080d1a', position: 'relative', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.875rem 1.75rem', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)', flexShrink: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.625rem', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
            {caseData.avatarGender === 'male' ? '👨' : '👩'}
          </div>
          <div>
            <h2 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'white', letterSpacing: '-0.01em' }}>{caseData.title}</h2>
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
              {caseData.specialty && <span style={{ fontSize: '0.65rem', color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '0.15rem 0.5rem', borderRadius: '9999px', border: '1px solid rgba(255,255,255,0.08)' }}>{caseData.specialty}</span>}
              {caseData.difficulty && <span style={{ fontSize: '0.65rem', color: DIFF_COLOR[caseData.difficulty?.toLowerCase()] || '#94a3b8', background: `${DIFF_COLOR[caseData.difficulty?.toLowerCase()] || '#64748b'}18`, padding: '0.15rem 0.5rem', borderRadius: '9999px', border: `1px solid ${DIFF_COLOR[caseData.difficulty?.toLowerCase()] || '#64748b'}40` }}>{caseData.difficulty}</span>}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {isCallActive && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', padding: '0.35rem 0.875rem', borderRadius: '9999px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'pulse 1.5s ease-in-out infinite' }} />
              <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: '600', color: '#fca5a5' }}>{fmt(callDuration)}</span>
            </div>
          )}
          {messages.length > 0 && !isCallActive && (
            <button onClick={() => setShowEvaluation(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc', padding: '0.35rem 0.875rem', borderRadius: '9999px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.22)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(99,102,241,0.12)'}>
              <span>📊</span> Ver Evaluación
            </button>
          )}
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Left: Avatar ── */}
        <div style={{ width: '42%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', borderRight: '1px solid rgba(255,255,255,0.06)', position: 'relative' }}>
          {/* Ambient glow */}
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '280px', height: '280px', borderRadius: '50%', background: isCallActive ? (isSpeaking ? 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)') : 'radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 70%)', pointerEvents: 'none', transition: 'all 0.6s ease' }} />

          {/* Avatar circle */}
          <div style={{ width: '200px', height: '200px', borderRadius: '50%', overflow: 'hidden', animation: avatarRing, transition: 'all 0.4s ease', marginBottom: '1.75rem', position: 'relative', flexShrink: 0 }}>
            <SimliAvatar
              faceId={caseData.avatarGender === 'male' ? process.env.NEXT_PUBLIC_SIMLI_MALE_FACE_ID || 'dd10cb5a-d31d-4f12-b69f-6db3383c006e' : process.env.NEXT_PUBLIC_SIMLI_FEMALE_FACE_ID || 'b9e5fba3-071a-4e35-896e-211c4d6eaa7b'}
              gender={caseData.avatarGender}
              isActive={isCallActive}
            />
          </div>

          {/* Status badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', padding: '0.5rem 1.25rem', borderRadius: '9999px', marginBottom: '0.75rem' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: statusConfig.dot, display: 'inline-block', boxShadow: `0 0 8px ${statusConfig.dot}`, animation: isCallActive ? 'pulse 2s ease-in-out infinite' : 'none' }} />
            <span style={{ fontSize: '0.8rem', fontWeight: '600', color: statusConfig.color, letterSpacing: '0.02em' }}>{statusConfig.label}</span>
          </div>

          {/* Waveform / dots */}
          {isCallActive && (
            <div style={{ height: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              {isSpeaking
                ? [0.5, 0.9, 0.7, 1, 0.6, 0.8, 0.5].map((h, i) => (
                    <div key={i} style={{ width: '3px', background: '#10b981', borderRadius: '9999px', animation: `wave ${0.6 + i * 0.05}s ease-in-out infinite`, animationDelay: `${i * 0.08}s`, height: `${h * 28}px` }} />
                  ))
                : isThinking
                ? [0, 1, 2].map(i => (
                    <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', animation: 'bounce 1.2s ease-in-out infinite', animationDelay: `${i * 0.18}s` }} />
                  ))
                : [0.3, 0.5, 0.3, 0.5, 0.3, 0.5, 0.3].map((h, i) => (
                    <div key={i} style={{ width: '3px', background: 'rgba(59,130,246,0.4)', borderRadius: '9999px', height: `${h * 28}px` }} />
                  ))
              }
            </div>
          )}

          {/* Recursos disponibles (solo tipos, sin valores) */}
          {(caseData.recursos?.length ?? 0) > 0 && (
            <div style={{ position: 'absolute', bottom: '1.5rem', left: '1.5rem', right: '1.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '0.875rem', padding: '0.875rem 1rem' }}>
              <p style={{ fontSize: '0.65rem', color: '#475569', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>Exámenes disponibles</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {caseData.recursos!.map((r, i) => (
                  <span key={i} style={{ fontSize: '0.68rem', color: '#64748b', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '0.2rem 0.55rem', borderRadius: '9999px' }}>
                    {r.nombre}
                  </span>
                ))}
              </div>
              <p style={{ fontSize: '0.62rem', color: '#334155', marginTop: '0.5rem' }}>Pídelos durante la consulta para obtener los resultados</p>
            </div>
          )}
        </div>

        {/* ── Right: Transcript ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.015)' }}>
          <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#475569', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Transcripción</span>
            {messages.length > 0 && <span style={{ fontSize: '0.65rem', background: 'rgba(59,130,246,0.15)', color: '#93c5fd', padding: '0.1rem 0.5rem', borderRadius: '9999px', border: '1px solid rgba(59,130,246,0.2)' }}>{messages.length} mensajes</span>}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
            {messages.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#1e293b' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '1rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', marginBottom: '1rem' }}>💬</div>
                <p style={{ color: '#334155', fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.35rem' }}>Sin mensajes aún</p>
                <p style={{ color: '#1e293b', fontSize: '0.8rem' }}>Inicia la consulta para comenzar</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {messages.map((msg, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', animation: 'fadeUp 0.25s ease forwards' }}>
                    <div style={{ maxWidth: '80%', padding: '0.75rem 1rem', borderRadius: msg.role === 'user' ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem', background: msg.role === 'user' ? 'linear-gradient(135deg, #2563eb, #4f46e5)' : 'rgba(255,255,255,0.06)', border: msg.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)' }}>
                      <p style={{ fontSize: '0.65rem', fontWeight: '700', color: msg.role === 'user' ? 'rgba(255,255,255,0.55)' : '#475569', marginBottom: '0.3rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                        {msg.role === 'user' ? '🩺 Médico' : '🧑 Paciente'}
                      </p>
                      <p style={{ fontSize: '0.875rem', color: msg.role === 'user' ? 'white' : '#cbd5e1', lineHeight: '1.55', margin: 0 }}>{msg.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* ── Call button ── */}
          <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
            {!isCallActive ? (
              <button onClick={startCall} style={{ width: '100%', background: 'linear-gradient(135deg, #16a34a, #059669)', color: 'white', fontWeight: '700', fontSize: '0.95rem', padding: '0.9rem', borderRadius: '0.875rem', border: 'none', cursor: 'pointer', letterSpacing: '0.01em', boxShadow: '0 8px 24px rgba(16,185,129,0.25)', transition: 'all 0.2s ease' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 28px rgba(16,185,129,0.4)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(16,185,129,0.25)'; }}>
                Iniciar Consulta
              </button>
            ) : (
              <button onClick={endCall} style={{ width: '100%', background: 'rgba(239,68,68,0.12)', color: '#fca5a5', fontWeight: '700', fontSize: '0.95rem', padding: '0.9rem', borderRadius: '0.875rem', border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer', letterSpacing: '0.01em', transition: 'all 0.2s ease' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; }}>
                Finalizar Consulta
              </button>
            )}
            <p style={{ textAlign: 'center', fontSize: '0.7rem', color: '#1e293b', marginTop: '0.6rem' }}>
              Conversación fluida por voz · Sin botones para hablar
            </p>
          </div>
        </div>
      </div>

      {/* ── Evaluation Modal ── */}
      {showEvaluation && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem', backdropFilter: 'blur(8px)' }}>
          <div style={{ background: '#0f1629', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1.5rem', width: '100%', maxWidth: '660px', maxHeight: '88vh', overflow: 'auto', boxShadow: '0 40px 80px rgba(0,0,0,0.6)' }}>
            {/* Modal header */}
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontWeight: '800', fontSize: '1.1rem', color: 'white', letterSpacing: '-0.01em', margin: 0 }}>Evaluación de Consulta</h2>
                <p style={{ color: '#475569', fontSize: '0.8rem', marginTop: '0.2rem' }}>{caseData.title}</p>
              </div>
              <button onClick={() => setShowEvaluation(false)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', width: '2.25rem', height: '2.25rem', borderRadius: '50%', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}>✕</button>
            </div>

            <div style={{ padding: '1.75rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {isEvaluating ? (
                <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                  <div style={{ width: '2.5rem', height: '2.5rem', border: '3px solid rgba(99,102,241,0.2)', borderTop: '3px solid #6366f1', borderRadius: '50%', margin: '0 auto 1.25rem', animation: 'spin 1s linear infinite' }} />
                  <p style={{ color: '#94a3b8', fontWeight: '600', marginBottom: '0.35rem' }}>Analizando con Claude...</p>
                  <p style={{ color: '#334155', fontSize: '0.8rem' }}>Esto tarda unos segundos</p>
                </div>
              ) : evaluation ? (
                <>
                  {/* Score row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', padding: '1.25rem 1.5rem', borderRadius: '1rem' }}>
                    <div style={{ textAlign: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: '3rem', fontWeight: '800', color: scoreColor(evaluation.score), lineHeight: 1, letterSpacing: '-0.03em' }}>{evaluation.score}</div>
                      <div style={{ fontSize: '0.7rem', color: '#334155', marginTop: '0.2rem' }}>/ 10</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '9999px', overflow: 'hidden', marginBottom: '1rem' }}>
                        <div style={{ height: '100%', width: `${evaluation.score * 10}%`, background: `linear-gradient(to right, ${scoreColor(evaluation.score)}99, ${scoreColor(evaluation.score)})`, borderRadius: '9999px', transition: 'width 1s ease' }} />
                      </div>
                      <p style={{ color: '#94a3b8', fontSize: '0.83rem', lineHeight: '1.6' }}>{evaluation.resumen}</p>
                    </div>
                  </div>

                  {/* Diagnóstico */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', background: evaluation.diagnostico_identificado ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${evaluation.diagnostico_identificado ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`, padding: '1rem 1.25rem', borderRadius: '0.875rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>{evaluation.diagnostico_identificado ? '✅' : '⚠️'}</span>
                    <div>
                      <p style={{ fontWeight: '700', color: 'white', fontSize: '0.875rem', margin: 0 }}>
                        {evaluation.diagnostico_identificado ? 'Diagnóstico orientado correctamente' : 'Diagnóstico no identificado'}
                      </p>
                      <p style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '0.2rem' }}>
                        Probable: <span style={{ color: '#94a3b8', fontWeight: '600' }}>{evaluation.diagnostico_probable}</span>
                      </p>
                    </div>
                  </div>

                  {/* Fortalezas / Mejora */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <p style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.625rem' }}>💪 Fortalezas</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {evaluation.fortalezas.map((f, i) => (
                          <div key={i} style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)', padding: '0.5rem 0.75rem', borderRadius: '0.625rem', fontSize: '0.78rem', color: '#6ee7b7' }}>✓ {f}</div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.625rem' }}>📈 Áreas de mejora</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {evaluation.areas_mejora.map((a, i) => (
                          <div key={i} style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.15)', padding: '0.5rem 0.75rem', borderRadius: '0.625rem', fontSize: '0.78rem', color: '#fcd34d' }}>→ {a}</div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Preguntas faltantes */}
                  {evaluation.preguntas_faltantes?.length > 0 && (
                    <div>
                      <p style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.625rem' }}>❓ Preguntas no realizadas</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {evaluation.preguntas_faltantes.map((q, i) => (
                          <div key={i} style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', padding: '0.5rem 0.75rem', borderRadius: '0.625rem', fontSize: '0.78rem', color: '#fca5a5' }}>• {q}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Preguntas realizadas */}
                  {evaluation.preguntas_clave_realizadas?.length > 0 && (
                    <div>
                      <p style={{ fontSize: '0.72rem', color: '#3b82f6', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.625rem' }}>✔ Preguntas clave realizadas</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {evaluation.preguntas_clave_realizadas.map((q, i) => (
                          <span key={i} style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#93c5fd', padding: '0.3rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem' }}>{q}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p style={{ color: '#ef4444', textAlign: 'center', padding: '2rem 0', fontSize: '0.875rem' }}>
                  No se pudo generar la evaluación. Verifica ANTHROPIC_API_KEY en .env.local
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
