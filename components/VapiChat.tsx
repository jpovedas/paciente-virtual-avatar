'use client';

import { useState, useEffect, useRef } from 'react';
import Vapi from '@vapi-ai/web';
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';

/* ── Types ── */
interface Recurso {
  tipo: string;
  nombre: string;
  // Lab / Signos vitales
  valor?: string;
  unidad?: string;
  referencia?: string;
  // Imagen
  imageUrl?: string;
  hallazgos?: string;
  // Historia / Medicamento / Otro
  descripcion?: string;
  dosis?: string;
  frecuencia?: string;
  via?: string;
  notas?: string;
}

interface Message {
  role: 'user' | 'assistant' | 'resource';
  content: string;
  timestamp: number;
  resource?: Recurso;
}

interface VapiChatProps {
  caseData: {
    id: string; title: string; specialty: string; difficulty: string;
    caseContext: string; avatarGender: 'male' | 'female'; recursos?: Recurso[];
  };
  userId: string;
}

/* ── System prompt ── */
function buildSystemPrompt(caseData: VapiChatProps['caseData']): string {
  const recursos = caseData.recursos ?? [];
  const nombres  = recursos.map(r => r.nombre).join(', ');

  const recursosText = recursos.length > 0
    ? `\n\nEXÁMENES DISPONIBLES: ${nombres}
IMPORTANTE: Cuando el médico solicite un examen de esta lista, responde ÚNICAMENTE con algo como "Aquí tiene, doctor" o "Claro, tome". NUNCA leas ni menciones los valores — los resultados se mostrarán visualmente de forma automática. Si piden algo no disponible, di que ese resultado no lo tienes todavía.`
    : '';

  return `Eres un paciente en consulta médica. Responde SIEMPRE en 1-2 oraciones cortas, en primera persona, lenguaje coloquial mexicano.

CASO: ${caseData.caseContext}${recursosText}

REGLAS:
- Máximo 2 oraciones por respuesta
- Sin términos médicos. Si no sabes algo, di "no sé"
- "doctor" solo al inicio o cuando estés muy preocupado
- Emociones sutiles. Responde directo, sin rodeos`;
}

/* ── Resource card component ── */
function ResourceCard({ r }: { r: Recurso }) {
  const tipo = r.tipo?.toLowerCase() ?? '';
  const isLab    = tipo === 'laboratorio' || tipo === 'signos vitales';
  const isImage  = tipo === 'imagen';
  const isMed    = tipo === 'medicamento';

  const cardBase: React.CSSProperties = {
    background: '#1a2744', border: '1px solid rgba(99,102,241,0.3)',
    borderRadius: '0.875rem', overflow: 'hidden', width: '100%', maxWidth: '340px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
  };

  const header = (icon: string, label: string, color: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 0.875rem', background: `${color}18`, borderBottom: `1px solid ${color}30` }}>
      <span style={{ fontSize: '0.85rem' }}>{icon}</span>
      <span style={{ fontSize: '0.65rem', fontWeight: '800', color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
      <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#64748b', fontWeight: '600' }}>{r.nombre}</span>
    </div>
  );

  if (isImage) return (
    <div style={cardBase}>
      {header('🩻', 'Imagen', '#6366f1')}
      {r.imageUrl && (
        <img src={r.imageUrl} alt={r.nombre} style={{ width: '100%', maxHeight: '220px', objectFit: 'cover', display: 'block' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      )}
      {r.hallazgos && (
        <div style={{ padding: '0.75rem 0.875rem' }}>
          <p style={{ fontSize: '0.65rem', color: '#475569', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>Hallazgos</p>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: '1.55' }}>{r.hallazgos}</p>
        </div>
      )}
      {r.notas && <div style={{ padding: '0 0.875rem 0.75rem' }}><p style={{ fontSize: '0.72rem', color: '#475569', fontStyle: 'italic' }}>{r.notas}</p></div>}
    </div>
  );

  if (isLab) {
    const inRef = r.referencia && r.valor ? checkInRange(r.valor, r.referencia) : null;
    return (
      <div style={cardBase}>
        {header('🧪', r.tipo, '#10b981')}
        <div style={{ padding: '0.875rem' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: '800', color: inRef === false ? '#ef4444' : inRef === true ? '#10b981' : '#e2e8f0', lineHeight: 1 }}>{r.valor}</span>
            {r.unidad && <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600' }}>{r.unidad}</span>}
            {inRef !== null && (
              <span style={{ marginLeft: 'auto', fontSize: '0.65rem', fontWeight: '700', color: inRef ? '#10b981' : '#ef4444', background: inRef ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${inRef ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`, padding: '0.2rem 0.5rem', borderRadius: '9999px' }}>
                {inRef ? 'Normal' : 'Anormal'}
              </span>
            )}
          </div>
          {r.referencia && <p style={{ fontSize: '0.7rem', color: '#334155' }}>Referencia: <span style={{ color: '#64748b' }}>{r.referencia}</span></p>}
          {r.notas && <p style={{ fontSize: '0.7rem', color: '#475569', marginTop: '0.35rem', fontStyle: 'italic' }}>{r.notas}</p>}
        </div>
      </div>
    );
  }

  if (isMed) return (
    <div style={cardBase}>
      {header('💊', 'Medicamento', '#f59e0b')}
      <div style={{ padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        {r.dosis     && <p style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>Dosis: <span style={{ color: '#e2e8f0', fontWeight: '600' }}>{r.dosis}</span></p>}
        {r.frecuencia && <p style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>Frecuencia: <span style={{ color: '#e2e8f0', fontWeight: '600' }}>{r.frecuencia}</span></p>}
        {r.via        && <p style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>Vía: <span style={{ color: '#e2e8f0', fontWeight: '600' }}>{r.via}</span></p>}
        {r.notas      && <p style={{ fontSize: '0.72rem', color: '#475569', marginTop: '0.25rem', fontStyle: 'italic' }}>{r.notas}</p>}
      </div>
    </div>
  );

  // Historia / Otro
  return (
    <div style={cardBase}>
      {header('📋', r.tipo, '#94a3b8')}
      <div style={{ padding: '0.875rem' }}>
        <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: '1.6' }}>{r.descripcion || r.notas || '—'}</p>
      </div>
    </div>
  );
}

function checkInRange(valor: string, referencia: string): boolean | null {
  const num = parseFloat(valor.replace(',', '.'));
  if (isNaN(num)) return null;
  const match = referencia.match(/([\d.,]+)\s*[-–]\s*([\d.,]+)/);
  if (!match) return null;
  const lo = parseFloat(match[1].replace(',', '.'));
  const hi = parseFloat(match[2].replace(',', '.'));
  return num >= lo && num <= hi;
}

const DIFF_COLOR: Record<string, string> = {
  fácil: '#10b981', facil: '#10b981', moderado: '#f59e0b', moderada: '#f59e0b', difícil: '#ef4444', dificil: '#ef4444',
};

/* ══════════════════════════════════════════════ */
export default function VapiChat({ caseData, userId }: VapiChatProps) {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isStarting, setIsStarting]     = useState(false);
  const [messages, setMessages]         = useState<Message[]>([]);
  const [callDuration, setCallDuration] = useState(0);
  const [sessionId, setSessionId]       = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking]     = useState(false);
  const [isThinking, setIsThinking]     = useState(false);
  const [callEnded, setCallEnded]       = useState(false);
  const [requestedNames, setRequestedNames] = useState<Set<string>>(new Set());

  const vapiRef        = useRef<Vapi | null>(null);
  const timerRef       = useRef<NodeJS.Timeout | null>(null);
  const mergeTimerRef  = useRef<NodeJS.Timeout | null>(null);
  const messagesRef    = useRef<Message[]>([]);
  const sessionIdRef   = useRef<string | null>(null);
  const callDurRef     = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { messagesRef.current  = messages;    }, [messages]);
  useEffect(() => { sessionIdRef.current = sessionId;   }, [sessionId]);
  useEffect(() => { callDurRef.current   = callDuration; }, [callDuration]);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
    if (!key) return;
    vapiRef.current = new Vapi(key);
    vapiRef.current.on('call-start',   handleCallStart);
    vapiRef.current.on('call-end',     handleCallEnd);
    vapiRef.current.on('speech-start', () => { setIsSpeaking(true); setIsThinking(false); });
    vapiRef.current.on('speech-end',   () => setIsSpeaking(false));
    vapiRef.current.on('message',      handleMessage);
    vapiRef.current.on('error',        () => {});
    return () => {
      vapiRef.current?.stop();
      if (timerRef.current)      clearInterval(timerRef.current);
      if (mergeTimerRef.current) clearTimeout(mergeTimerRef.current);
    };
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const createSession = async () => {
    try {
      const ref = await addDoc(collection(db, 'sessions'), {
        userId, caseId: caseData.id, caseTitle: caseData.title,
        messages: [], startTime: serverTimestamp(), status: 'active',
      });
      setSessionId(ref.id); return ref.id;
    } catch (e) { return null; }
  };

  const handleCallStart = () => { setIsStarting(false); setIsCallActive(true); timerRef.current = setInterval(() => setCallDuration(p => p + 1), 1000); };

  const handleCallEnd = async () => {
    setIsCallActive(false); setIsSpeaking(false); setIsThinking(false);
    if (timerRef.current) clearInterval(timerRef.current);
    const sid = sessionIdRef.current;
    const dur = callDurRef.current;
    if (sid) updateDoc(doc(db, 'sessions', sid), { endTime: serverTimestamp(), duration: dur, status: 'completed', messages: messagesRef.current.filter(m => m.role !== 'resource') }).catch(console.error);
    setCallEnded(true);
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
        if (last && last.role === incoming.role && last.role !== 'resource' && Date.now() - last.timestamp < 3000) {
          updated = [...prev.slice(0, -1), { ...last, content: last.content + ' ' + incoming.content, timestamp: Date.now() }];
        } else { updated = [...prev, incoming]; }
        const sid = sessionIdRef.current;
        if (sid) updateDoc(doc(db, 'sessions', sid), { messages: updated.filter(m => m.role !== 'resource') }).catch(console.error);
        return updated;
      });
    }, 1200);
  };

  /* ── Request a resource visually ── */
  const requestResource = (recurso: Recurso) => {
    if (requestedNames.has(recurso.nombre)) return;
    setRequestedNames(prev => new Set(prev).add(recurso.nombre));
    setMessages(prev => [...prev, { role: 'resource', content: recurso.nombre, timestamp: Date.now(), resource: recurso }]);
    vapiRef.current?.send({
      type: 'add-message',
      message: { role: 'system', content: `El médico acaba de solicitar el examen: "${recurso.nombre}". Responde muy brevemente ("Aquí tiene, doctor" o similar). NO menciones valores ni resultados.` }
    } as any);
  };

  const startCall = async () => {
    if (!vapiRef.current) return;
    setIsStarting(true);
    try {
      await createSession();
      await vapiRef.current.start({
        model: { provider: 'openai', model: 'gpt-4o-mini', temperature: 0.6, messages: [{ role: 'system', content: buildSystemPrompt(caseData) }] },
        voice: { provider: 'cartesia', voiceId: caseData.avatarGender === 'male' ? '2fc4f1ec-bfd0-46f1-8e6d-d4279eaaf838' : 'b4b8e2af-6139-466e-a93a-30c20d2e1fc5', model: 'sonic-2', language: 'es' } as any,
        transcriber: { provider: 'deepgram', model: 'nova-2', language: 'es' },
        firstMessage: 'Hola doctor, buenos días.',
      });
    } catch (e: any) { setIsStarting(false); }
  };

  const endCall = () => vapiRef.current?.stop();
  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const statusConfig = !isCallActive
    ? { label: 'En espera', color: '#64748b', dot: '#475569' }
    : isSpeaking ? { label: 'Paciente hablando', color: '#10b981', dot: '#10b981' }
    : isThinking  ? { label: 'Procesando...', color: '#f59e0b', dot: '#f59e0b' }
    : { label: 'Escuchando', color: '#3b82f6', dot: '#3b82f6' };

  const recursos = caseData.recursos ?? [];

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
          {callEnded && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', padding: '0.35rem 0.875rem', borderRadius: '9999px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              <span style={{ fontSize: '0.75rem', color: '#6ee7b7', fontWeight: '600' }}>Sesión guardada</span>
            </div>
          )}
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Transcript (full width) ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.015)' }}>
          <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#475569', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Transcripción</span>
            {messages.length > 0 && <span style={{ fontSize: '0.65rem', background: 'rgba(59,130,246,0.15)', color: '#93c5fd', padding: '0.1rem 0.5rem', borderRadius: '9999px', border: '1px solid rgba(59,130,246,0.2)' }}>{messages.filter(m => m.role !== 'resource').length} mensajes</span>}
            {isCallActive && (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: statusConfig.dot, display: 'inline-block', boxShadow: `0 0 8px ${statusConfig.dot}`, animation: 'pulse 2s ease-in-out infinite' }} />
                <span style={{ fontSize: '0.78rem', fontWeight: '600', color: statusConfig.color }}>{statusConfig.label}</span>
                {isSpeaking && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '0.25rem' }}>
                    {[0.5,0.9,0.7,1,0.6,0.8,0.5].map((h,i) => (
                      <div key={i} style={{ width:'2px', background:'#10b981', borderRadius:'9999px', animation:`wave ${0.6+i*0.05}s ease-in-out infinite`, animationDelay:`${i*0.08}s`, height:`${h*18}px` }} />
                    ))}
                  </div>
                )}
                {isThinking && (
                  <div style={{ display: 'flex', gap: '3px', marginLeft: '0.25rem' }}>
                    {[0,1,2].map(i => <div key={i} style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#f59e0b', animation:'bounce 1.2s ease-in-out infinite', animationDelay:`${i*0.18}s` }} />)}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {messages.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#1e293b' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '1rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', marginBottom: '0.875rem' }}>💬</div>
                <p style={{ color: '#334155', fontWeight: '600', fontSize: '0.875rem', marginBottom: '0.3rem' }}>Sin mensajes aún</p>
                <p style={{ color: '#1e293b', fontSize: '0.78rem' }}>Inicia la consulta para comenzar</p>
              </div>
            ) : (
              messages.map((msg, idx) => {
                if (msg.role === 'resource') return (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'center', animation: 'fadeUp 0.3s ease forwards' }}>
                    <ResourceCard r={msg.resource!} />
                  </div>
                );
                return (
                  <div key={idx} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', animation: 'fadeUp 0.25s ease forwards' }}>
                    <div style={{ maxWidth: '80%', padding: '0.75rem 1rem', borderRadius: msg.role === 'user' ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem', background: msg.role === 'user' ? 'linear-gradient(135deg, #2563eb, #4f46e5)' : 'rgba(255,255,255,0.06)', border: msg.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.08)' }}>
                      <p style={{ fontSize: '0.65rem', fontWeight: '700', color: msg.role === 'user' ? 'rgba(255,255,255,0.5)' : '#475569', marginBottom: '0.3rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                        {msg.role === 'user' ? '🩺 Médico' : '🧑 Paciente'}
                      </p>
                      <p style={{ fontSize: '0.875rem', color: msg.role === 'user' ? 'white' : '#cbd5e1', lineHeight: '1.55', margin: 0 }}>{msg.content}</p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ── Controls ── */}
          <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
            {/* Recursos */}
            {recursos.length > 0 && isCallActive && (
              <div style={{ marginBottom: '0.875rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '0.75rem', padding: '0.75rem 1rem' }}>
                <p style={{ fontSize: '0.62rem', color: '#475569', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>Exámenes disponibles</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {recursos.map((r, i) => {
                    const done = requestedNames.has(r.nombre);
                    return (
                      <button key={i} onClick={() => requestResource(r)} disabled={done}
                        style={{ fontSize: '0.72rem', fontWeight: '600', padding: '0.3rem 0.75rem', borderRadius: '9999px', border: `1px solid ${done ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.35)'}`, background: done ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)', color: done ? '#6ee7b7' : '#a5b4fc', cursor: done ? 'default' : 'pointer', transition: 'all 0.2s' }}
                        onMouseEnter={e => { if (!done) e.currentTarget.style.background = 'rgba(99,102,241,0.2)'; }}
                        onMouseLeave={e => { if (!done) e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; }}
                      >
                        {done ? '✓ ' : ''}{r.nombre}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {!isCallActive ? (
              <button onClick={startCall} disabled={isStarting} style={{ width: '100%', background: isStarting ? 'rgba(22,163,74,0.4)' : 'linear-gradient(135deg, #16a34a, #059669)', color: 'white', fontWeight: '700', fontSize: '0.95rem', padding: '0.9rem', borderRadius: '0.875rem', border: 'none', cursor: isStarting ? 'not-allowed' : 'pointer', boxShadow: isStarting ? 'none' : '0 8px 24px rgba(16,185,129,0.25)', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.625rem' }}
                onMouseEnter={e => { if (!isStarting) e.currentTarget.style.boxShadow = '0 12px 28px rgba(16,185,129,0.4)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(16,185,129,0.25)'; }}
              >
                {isStarting ? <><div style={{ width: '1rem', height: '1rem', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Conectando con el paciente...</> : 'Iniciar Consulta'}
              </button>
            ) : (
              <button onClick={endCall} style={{ width: '100%', background: 'rgba(239,68,68,0.1)', color: '#fca5a5', fontWeight: '700', fontSize: '0.95rem', padding: '0.9rem', borderRadius: '0.875rem', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer', transition: 'all 0.2s ease' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.18)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
              >
                Finalizar Consulta
              </button>
            )}
            <p style={{ textAlign: 'center', fontSize: '0.7rem', color: '#1e293b', marginTop: '0.5rem' }}>
              Conversación fluida por voz · Sin botones para hablar
            </p>
          </div>
        </div>
      </div>

      {/* ── Consulta finalizada ── */}
      {callEnded && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(8px)' }}>
          <div style={{ background: '#0f1629', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1.5rem', padding: '2.5rem', textAlign: 'center', maxWidth: '400px', width: '90%' }}>
            <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '50%', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', margin: '0 auto 1.5rem' }}>✓</div>
            <h2 style={{ color: 'white', fontWeight: '800', fontSize: '1.25rem', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>Consulta finalizada</h2>
            <p style={{ color: '#475569', fontSize: '0.875rem', lineHeight: '1.6', marginBottom: '0.75rem' }}>
              Sesión guardada correctamente.
            </p>
            <p style={{ color: '#334155', fontSize: '0.75rem', marginBottom: '2rem' }}>
              Duración: <span style={{ color: '#64748b', fontWeight: '600' }}>{fmt(callDuration)}</span> · {messages.filter(m => m.role !== 'resource').length} mensajes
            </p>
            <button onClick={() => setCallEnded(false)} style={{ display: 'block', width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '0.7rem', borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer', marginBottom: '0.75rem' }}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
