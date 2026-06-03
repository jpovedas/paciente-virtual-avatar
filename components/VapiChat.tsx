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

interface VapiChatProps {
  caseData: {
    id: string;
    title: string;
    specialty: string;
    difficulty: string;
    caseContext: string;
    avatarGender: 'male' | 'female';
  };
  userId: string;
}

export default function VapiChat({ caseData, userId }: VapiChatProps) {
  const [isCallActive, setIsCallActive] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [callDuration, setCallDuration] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [showEvaluation, setShowEvaluation] = useState(false);

  const vapiRef = useRef<Vapi | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const callDurationRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    callDurationRef.current = callDuration;
  }, [callDuration]);

  useEffect(() => {
    const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
    if (!publicKey) return;

    vapiRef.current = new Vapi(publicKey);
    vapiRef.current.on('call-start', handleCallStart);
    vapiRef.current.on('call-end', handleCallEnd);
    vapiRef.current.on('speech-start', () => setIsSpeaking(true));
    vapiRef.current.on('speech-end', () => setIsSpeaking(false));
    vapiRef.current.on('message', handleMessage);
    vapiRef.current.on('error', (e: any) => console.error('Vapi error:', e));

    return () => {
      if (vapiRef.current) vapiRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const createSession = async () => {
    try {
      const sessionRef = await addDoc(collection(db, 'sessions'), {
        userId,
        caseId: caseData.id,
        caseTitle: caseData.title,
        messages: [],
        startTime: serverTimestamp(),
        status: 'active',
      });
      setSessionId(sessionRef.id);
      return sessionRef.id;
    } catch (error) {
      console.error('Error creating session:', error);
      return null;
    }
  };

  const handleCallStart = () => {
    setIsCallActive(true);
    timerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const handleCallEnd = async () => {
    setIsCallActive(false);
    setIsSpeaking(false);
    if (timerRef.current) clearInterval(timerRef.current);

    const sid = sessionIdRef.current;
    const dur = callDurationRef.current;
    const msgs = messagesRef.current;

    if (sid) {
      await updateDoc(doc(db, 'sessions', sid), {
        endTime: serverTimestamp(),
        duration: dur,
        status: 'completed',
      }).catch(err => console.error('Error updating session:', err));
    }

    if (msgs.length > 0) {
      evaluateSession(msgs);
    }
  };

  const evaluateSession = async (msgs: Message[]) => {
    setIsEvaluating(true);
    setShowEvaluation(true);
    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: msgs,
          caseContext: caseData.caseContext,
          caseTitle: caseData.title,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEvaluation(data);
    } catch (err: any) {
      console.error('Evaluation failed:', err);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleMessage = (message: any) => {
    if (message.type === 'transcript' && message.transcriptType === 'final') {
      const newMessage: Message = {
        role: message.role,
        content: message.transcript,
        timestamp: Date.now(),
      };

      setMessages(prev => {
        if (prev.length > 0) {
          const last = prev[prev.length - 1];
          if (last.content === newMessage.content && last.role === newMessage.role) return prev;
        }
        const updated = [...prev, newMessage];
        const sid = sessionIdRef.current;
        if (sid) {
          updateDoc(doc(db, 'sessions', sid), { messages: updated })
            .catch(err => console.error('Error saving message:', err));
        }
        return updated;
      });
    }
  };

  const startCall = async () => {
    if (!vapiRef.current) return;
    try {
      await createSession();
      await vapiRef.current.start({
        model: {
          provider: 'openai',
          model: 'gpt-4o',
          messages: [{
            role: 'system',
            content: `Eres un paciente real en consulta médica.

CASO: ${caseData.caseContext}

REGLAS:
- Responde en primera persona, lenguaje natural y coloquial
- MUY BREVE: 1-2 oraciones máximo
- Di "doctor" al inicio y ocasionalmente cuando estés preocupado, no en cada respuesta
- Muestra emociones de forma SUTIL
- Si algo duele MUCHO cuando te tocan, di "ay" o "duele ahí" - solo una vez
- Si el dolor es moderado, solo menciona que duele, sin exclamaciones
- NO uses términos médicos. Si no sabes algo, di "no sé"
- Responde directo y breve`,
          }],
          temperature: 0.7,
        },
        voice: {
          provider: 'azure',
          voiceId: caseData.avatarGender === 'male' ? 'es-MX-JorgeNeural' : 'es-MX-DaliaNeural',
        },
        transcriber: {
          provider: 'deepgram',
          model: 'nova-2',
          language: 'es',
        },
        firstMessage: 'Hola doctor, buenos días.',
      });
    } catch (error: any) {
      console.error('Error starting call:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const endCall = () => {
    if (vapiRef.current) vapiRef.current.stop();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const scoreColor = (score: number) => {
    if (score >= 8) return '#10b981';
    if (score >= 5) return '#f59e0b';
    return '#ef4444';
  };

  const difficultyColor: Record<string, string> = {
    fácil: '#10b981', facil: '#10b981',
    moderado: '#f59e0b', moderada: '#f59e0b',
    difícil: '#ef4444', dificil: '#ef4444',
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(to bottom right, #1e293b, #334155)', position: 'relative' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(to right, #2563eb, #4f46e5)', color: 'white', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '2.5rem', height: '2.5rem', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
            {caseData.avatarGender === 'male' ? '👨' : '👩'}
          </div>
          <div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', margin: 0 }}>{caseData.title}</h2>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
              {caseData.specialty && (
                <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.2)', padding: '0.1rem 0.5rem', borderRadius: '9999px' }}>
                  {caseData.specialty}
                </span>
              )}
              {caseData.difficulty && (
                <span style={{ fontSize: '0.7rem', background: `${difficultyColor[caseData.difficulty?.toLowerCase()] || '#6b7280'}33`, border: `1px solid ${difficultyColor[caseData.difficulty?.toLowerCase()] || '#6b7280'}`, color: difficultyColor[caseData.difficulty?.toLowerCase()] || 'white', padding: '0.1rem 0.5rem', borderRadius: '9999px' }}>
                  {caseData.difficulty}
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {isCallActive && (
            <div style={{ background: 'rgba(239,68,68,0.3)', padding: '0.4rem 1rem', borderRadius: '9999px', border: '1px solid rgba(252,165,165,0.5)' }}>
              <span style={{ fontFamily: 'monospace', fontSize: '0.875rem', fontWeight: 'bold' }}>
                ● {formatDuration(callDuration)}
              </span>
            </div>
          )}
          {messages.length > 0 && !isCallActive && (
            <button
              onClick={() => setShowEvaluation(true)}
              style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '0.4rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}
            >
              📊 Ver Evaluación
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Avatar Panel */}
        <div style={{ width: '40%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{ textAlign: 'center', width: '100%' }}>
            <div style={{
              width: '14rem',
              height: '14rem',
              borderRadius: '50%',
              margin: '0 auto 1.5rem',
              overflow: 'hidden',
              boxShadow: isCallActive
                ? isSpeaking
                  ? '0 0 0 4px #10b981, 0 0 40px rgba(16,185,129,0.5)'
                  : '0 0 0 4px #3b82f6, 0 0 40px rgba(59,130,246,0.4)'
                : '0 0 0 2px rgba(148,163,184,0.3)',
              transition: 'all 0.4s ease',
            }}>
              <SimliAvatar
                faceId={caseData.avatarGender === 'male'
                  ? process.env.NEXT_PUBLIC_SIMLI_MALE_FACE_ID || 'dd10cb5a-d31d-4f12-b69f-6db3383c006e'
                  : process.env.NEXT_PUBLIC_SIMLI_FEMALE_FACE_ID || 'b9e5fba3-071a-4e35-896e-211c4d6eaa7b'
                }
                gender={caseData.avatarGender}
                isActive={isCallActive}
              />
            </div>

            <div style={{ color: 'white' }}>
              {!isCallActive ? (
                <>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>Listo para iniciar</h3>
                  <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Presiona el botón para comenzar</p>
                </>
              ) : isSpeaking ? (
                <>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#6ee7b7', marginBottom: '0.75rem' }}>Paciente hablando</h3>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.25rem' }}>
                    {[0.6, 1, 0.8].map((h, i) => (
                      <div key={i} style={{ width: '0.4rem', background: '#6ee7b7', borderRadius: '0.25rem', animation: `wave 0.8s ease-in-out infinite`, animationDelay: `${i * 0.15}s`, height: `${h * 2}rem` }} />
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#93c5fd', marginBottom: '0.25rem' }}>Escuchando...</h3>
                  <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Habla cuando quieras</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Transcript Panel */}
        <div style={{ width: '60%', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', marginTop: '4rem', color: '#64748b' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💬</div>
                <p style={{ fontSize: '1.125rem', fontWeight: '500', marginBottom: '0.5rem' }}>Transcripción en tiempo real</p>
                <p style={{ fontSize: '0.875rem' }}>La conversación aparecerá aquí</p>
              </div>
            ) : (
              <div>
                {messages.map((msg, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: '0.75rem' }}>
                    <div style={{
                      maxWidth: '78%',
                      padding: '0.875rem 1rem',
                      borderRadius: '1rem',
                      background: msg.role === 'user' ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'white',
                      color: msg.role === 'user' ? 'white' : '#1e293b',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    }}>
                      <p style={{ fontSize: '0.7rem', fontWeight: 'bold', marginBottom: '0.35rem', opacity: 0.75 }}>
                        {msg.role === 'user' ? '🩺 Tú (médico)' : '👤 Paciente'}
                      </p>
                      <p style={{ fontSize: '0.875rem', margin: 0, lineHeight: '1.5' }}>{msg.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div style={{ padding: '1.25rem 1.5rem', background: 'white', borderTop: '1px solid #e2e8f0' }}>
            {!isCallActive ? (
              <button
                onClick={startCall}
                style={{ width: '100%', background: 'linear-gradient(to right, #16a34a, #15803d)', color: 'white', fontWeight: 'bold', padding: '0.875rem', borderRadius: '0.75rem', border: 'none', cursor: 'pointer', fontSize: '1rem', boxShadow: '0 8px 15px rgba(22,163,74,0.3)', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 12px 20px rgba(22,163,74,0.4)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 8px 15px rgba(22,163,74,0.3)'; }}
              >
                📞 Iniciar Consulta
              </button>
            ) : (
              <button
                onClick={endCall}
                style={{ width: '100%', background: 'linear-gradient(to right, #dc2626, #b91c1c)', color: 'white', fontWeight: 'bold', padding: '0.875rem', borderRadius: '0.75rem', border: 'none', cursor: 'pointer', fontSize: '1rem', boxShadow: '0 8px 15px rgba(220,38,38,0.3)', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                ⏹ Finalizar Consulta
              </button>
            )}
            <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.5rem', margin: '0.5rem 0 0' }}>
              Habla naturalmente — la conversación es fluida por voz
            </p>
          </div>
        </div>
      </div>

      {/* Evaluation Modal */}
      {showEvaluation && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'white', borderRadius: '1.5rem', width: '100%', maxWidth: '640px', maxHeight: '85vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.4)' }}>
            {/* Modal header */}
            <div style={{ background: 'linear-gradient(to right, #1e293b, #334155)', color: 'white', padding: '1.5rem 2rem', borderRadius: '1.5rem 1.5rem 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontWeight: 'bold', fontSize: '1.25rem', margin: 0 }}>📊 Evaluación de Consulta</h2>
                <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>{caseData.title}</p>
              </div>
              <button
                onClick={() => setShowEvaluation(false)}
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', width: '2rem', height: '2rem', borderRadius: '50%', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '2rem' }}>
              {isEvaluating ? (
                <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                  <div style={{ width: '3rem', height: '3rem', border: '4px solid rgba(99,102,241,0.3)', borderTop: '4px solid #6366f1', borderRadius: '50%', margin: '0 auto 1.5rem', animation: 'spin 1s linear infinite' }} />
                  <p style={{ color: '#64748b', fontSize: '1rem', fontWeight: '500' }}>Analizando la consulta con Claude...</p>
                  <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.5rem' }}>Esto puede tardar unos segundos</p>
                </div>
              ) : evaluation ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Score */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', background: '#f8fafc', padding: '1.25rem', borderRadius: '1rem' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '3rem', fontWeight: 'bold', color: scoreColor(evaluation.score), lineHeight: 1 }}>{evaluation.score}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>/ 10</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ height: '0.75rem', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${evaluation.score * 10}%`, background: `linear-gradient(to right, ${scoreColor(evaluation.score)}, ${scoreColor(evaluation.score)}88)`, borderRadius: '9999px', transition: 'width 0.8s ease' }} />
                      </div>
                      <p style={{ color: '#475569', fontSize: '0.875rem', marginTop: '0.75rem', lineHeight: '1.5' }}>{evaluation.resumen}</p>
                    </div>
                  </div>

                  {/* Diagnóstico */}
                  <div style={{ background: evaluation.diagnostico_identificado ? '#f0fdf4' : '#fef9c3', border: `1px solid ${evaluation.diagnostico_identificado ? '#bbf7d0' : '#fde68a'}`, padding: '1rem 1.25rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>{evaluation.diagnostico_identificado ? '✅' : '⚠️'}</span>
                    <div>
                      <p style={{ fontWeight: '600', color: '#1e293b', margin: 0, fontSize: '0.875rem' }}>
                        {evaluation.diagnostico_identificado ? 'Diagnóstico orientado correctamente' : 'Diagnóstico no identificado claramente'}
                      </p>
                      <p style={{ color: '#64748b', margin: '0.2rem 0 0', fontSize: '0.8rem' }}>
                        Diagnóstico probable: <strong>{evaluation.diagnostico_probable}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Fortalezas y áreas de mejora */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <h4 style={{ color: '#10b981', fontWeight: '700', fontSize: '0.875rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        💪 Fortalezas
                      </h4>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {evaluation.fortalezas.map((f, i) => (
                          <li key={i} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.8rem', color: '#166534' }}>
                            ✓ {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 style={{ color: '#f59e0b', fontWeight: '700', fontSize: '0.875rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        📈 Áreas de mejora
                      </h4>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {evaluation.areas_mejora.map((a, i) => (
                          <li key={i} style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.8rem', color: '#92400e' }}>
                            → {a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Preguntas */}
                  {evaluation.preguntas_faltantes?.length > 0 && (
                    <div>
                      <h4 style={{ color: '#ef4444', fontWeight: '700', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                        ❓ Preguntas importantes no realizadas
                      </h4>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {evaluation.preguntas_faltantes.map((q, i) => (
                          <li key={i} style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.8rem', color: '#991b1b' }}>
                            • {q}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {evaluation.preguntas_clave_realizadas?.length > 0 && (
                    <div>
                      <h4 style={{ color: '#3b82f6', fontWeight: '700', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                        ✔ Preguntas clave realizadas
                      </h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {evaluation.preguntas_clave_realizadas.map((q, i) => (
                          <span key={i} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '0.3rem 0.75rem', borderRadius: '9999px', fontSize: '0.78rem', color: '#1e40af' }}>
                            {q}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: '#ef4444' }}>
                  <p>No se pudo generar la evaluación. Verifica que ANTHROPIC_API_KEY esté configurada en .env.local</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes wave { 0%, 100% { transform: scaleY(0.5); } 50% { transform: scaleY(1.2); } }
      `}</style>
    </div>
  );
}
