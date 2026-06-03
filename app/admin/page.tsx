'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';

const ADMIN_PASSWORD = 'cmc2025';

/* ── Types ── */
interface Recurso {
  tipo: string; nombre: string;
  valor?: string; unidad?: string; referencia?: string;   // Lab / Signos
  imageUrl?: string; hallazgos?: string;                   // Imagen
  descripcion?: string;                                    // Historia / Otro
  dosis?: string; frecuencia?: string; via?: string;       // Medicamento
  notas?: string;
}
interface ClinicalCase { id?: string; title: string; specialty: string; difficulty: string; avatarGender: 'male' | 'female'; caseContext: string; recursos: Recurso[]; }
interface SessionMsg  { role: 'user' | 'assistant'; content: string; timestamp: number; }
interface Session {
  id: string; caseId: string; caseTitle: string; userId: string;
  messages: SessionMsg[]; startTime: any; endTime?: any; duration?: number; status: string;
  evaluation?: Evaluation;
}
interface Evaluation {
  score: number; diagnostico_identificado: boolean; diagnostico_probable: string;
  fortalezas: string[]; areas_mejora: string[]; preguntas_clave_realizadas: string[];
  preguntas_faltantes: string[]; resumen: string;
}

/* ── Constants ── */
const TIPOS_RECURSO  = ['Laboratorio','Signos vitales','Imagen','Historia previa','Medicamento','Otro'];
const ESPECIALIDADES = ['Medicina Interna','Cardiología','Endocrinología','Neumología','Neurología','Gastroenterología','Pediatría','Ginecología','Traumatología','Dermatología','Psiquiatría','Otra'];
const EMPTY_CASE: ClinicalCase = { title:'', specialty:'', difficulty:'Moderado', avatarGender:'female', caseContext:'', recursos:[] };
const EMPTY_REC: Recurso = { tipo:'Laboratorio', nombre:'' };

const scoreColor = (n: number) => n >= 8 ? '#10b981' : n >= 5 ? '#f59e0b' : '#ef4444';
const fmt = (s: number) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
const fmtDate = (ts: any) => { if (!ts) return '—'; const d = ts.toDate?.() ?? new Date(ts); return d.toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }); };

/* ══════════════════════════════════════════════ */
export default function AdminPage() {
  const [authed, setAuthed]   = useState(false);
  const [password, setPassword] = useState('');
  const [tab, setTab]         = useState<'casos' | 'sesiones'>('casos');
  const [toast, setToast]     = useState('');

  /* casos */
  const [cases, setCases]     = useState<ClinicalCase[]>([]);
  const [caseView, setCaseView] = useState<'list' | 'edit'>('list');
  const [editing, setEditing] = useState<ClinicalCase>(EMPTY_CASE);
  const [saving, setSaving]   = useState(false);

  /* sesiones */
  const [sessions, setSessions]   = useState<Session[]>([]);
  const [selSession, setSelSession] = useState<Session | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingCases, setLoadingCases]       = useState(false);

  useEffect(() => { if (authed) { loadCases(); loadSessions(); } }, [authed]);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  /* ── loaders ── */
  const loadCases = async () => {
    setLoadingCases(true);
    const snap = await getDocs(collection(db, 'clinical_cases'));
    setCases(snap.docs.map(d => ({ id: d.id, ...d.data() })) as ClinicalCase[]);
    setLoadingCases(false);
  };

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const q = query(collection(db, 'sessions'), orderBy('startTime', 'desc'));
      const snap = await getDocs(q);
      setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Session[]);
    } catch {
      const snap = await getDocs(collection(db, 'sessions'));
      setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Session[]);
    }
    setLoadingSessions(false);
  };

  /* ── case CRUD ── */
  const saveCase = async () => {
    if (!editing.title || !editing.caseContext) return alert('Título y contexto son obligatorios.');
    setSaving(true);
    try {
      const payload = { ...editing, updatedAt: serverTimestamp() };
      if (editing.id) { const { id, ...data } = payload; await updateDoc(doc(db, 'clinical_cases', editing.id!), data); showToast('Caso actualizado ✓'); }
      else { await addDoc(collection(db, 'clinical_cases'), { ...payload, createdAt: serverTimestamp() }); showToast('Caso creado ✓'); }
      await loadCases(); setCaseView('list');
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const deleteCase = async (id: string) => {
    if (!confirm('¿Eliminar este caso?')) return;
    await deleteDoc(doc(db, 'clinical_cases', id));
    showToast('Caso eliminado'); await loadCases();
  };

  const addRec    = () => setEditing(p => ({ ...p, recursos: [...p.recursos, { ...EMPTY_REC }] }));
  const removeRec = (i: number) => setEditing(p => ({ ...p, recursos: p.recursos.filter((_,idx) => idx !== i) }));
  const updateRec = (i: number, f: keyof Recurso, v: string) => setEditing(p => ({ ...p, recursos: p.recursos.map((r,idx) => idx===i ? { ...r, [f]: v } : r) }));

  /* ── evaluation ── */
  const generateEvaluation = async (session: Session) => {
    if (session.messages.length === 0) return alert('La sesión no tiene mensajes.');
    setEvaluating(true);
    try {
      const caseData = cases.find(c => c.id === session.caseId);
      const res  = await fetch('/api/evaluate', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ messages: session.messages, caseContext: caseData?.caseContext ?? '', caseTitle: session.caseTitle }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      await updateDoc(doc(db, 'sessions', session.id), { evaluation: data });
      const updated = { ...session, evaluation: data };
      setSessions(prev => prev.map(s => s.id === session.id ? updated : s));
      setSelSession(updated);
      showToast('Evaluación generada ✓');
    } catch (e: any) { alert('Error: ' + e.message); } finally { setEvaluating(false); }
  };

  /* ════════════════ LOGIN ════════════════ */
  if (!authed) return (
    <div style={{ minHeight:'100vh', background:'#080d1a', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'1.25rem', padding:'2.5rem', width:'100%', maxWidth:'360px', textAlign:'center' }}>
        <div style={{ fontSize:'2rem', marginBottom:'1rem' }}>🔐</div>
        <h1 style={{ color:'white', fontWeight:'800', fontSize:'1.25rem', marginBottom:'0.35rem' }}>Panel Administrativo</h1>
        <p style={{ color:'#475569', fontSize:'0.8rem', marginBottom:'2rem' }}>Paciente Virtual IA</p>
        <input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key==='Enter' && (password===ADMIN_PASSWORD ? setAuthed(true) : alert('Contraseña incorrecta'))} style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'0.75rem', padding:'0.75rem 1rem', color:'white', fontSize:'0.9rem', marginBottom:'1rem', outline:'none' }} />
        <button onClick={() => password===ADMIN_PASSWORD ? setAuthed(true) : alert('Contraseña incorrecta')} style={{ width:'100%', background:'linear-gradient(135deg,#3b82f6,#6366f1)', color:'white', fontWeight:'700', padding:'0.75rem', borderRadius:'0.75rem', border:'none', cursor:'pointer', fontSize:'0.9rem' }}>Entrar</button>
      </div>
    </div>
  );

  /* ════════════════ SHARED LAYOUT ════════════════ */
  const S = { /* shared inline styles */
    input: { width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'0.625rem', padding:'0.625rem 0.875rem', color:'white', fontSize:'0.875rem', outline:'none' } as React.CSSProperties,
    label: { fontSize:'0.72rem', color:'#64748b', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:'0.4rem' } as React.CSSProperties,
  };

  return (
    <div style={{ minHeight:'100vh', background:'#080d1a', display:'flex', flexDirection:'column' }}>
      {toast && <div style={{ position:'fixed', top:'1.25rem', right:'1.25rem', background:'#10b981', color:'white', padding:'0.7rem 1.25rem', borderRadius:'0.75rem', fontWeight:'600', fontSize:'0.85rem', zIndex:999, boxShadow:'0 8px 24px rgba(16,185,129,0.3)' }}>{toast}</div>}

      {/* Nav */}
      <nav style={{ background:'rgba(255,255,255,0.02)', borderBottom:'1px solid rgba(255,255,255,0.07)', padding:'0 2rem', display:'flex', alignItems:'center', gap:'0', height:'52px', flexShrink:0 }}>
        <a href="/" style={{ color:'#334155', fontSize:'0.78rem', fontWeight:'600', textDecoration:'none', marginRight:'2rem' }}>← App</a>
        {(['casos','sesiones'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setCaseView('list'); setSelSession(null); }} style={{ background:'none', border:'none', cursor:'pointer', padding:'0 1rem', height:'100%', fontSize:'0.85rem', fontWeight:'600', color: tab===t ? 'white' : '#475569', borderBottom: tab===t ? '2px solid #6366f1' : '2px solid transparent', transition:'all 0.2s', textTransform:'capitalize' }}>
            {t === 'casos' ? '📋 Casos clínicos' : '🗂 Sesiones'}
          </button>
        ))}
        <div style={{ marginLeft:'auto', display:'flex', gap:'0.5rem', alignItems:'center' }}>
          <span style={{ fontSize:'0.72rem', color:'#1e293b' }}>{cases.length} casos · {sessions.length} sesiones</span>
        </div>
      </nav>

      <div style={{ flex:1, padding:'2rem', maxWidth:'960px', width:'100%', margin:'0 auto' }}>

        {/* ════════════ CASOS ════════════ */}
        {tab === 'casos' && caseView === 'list' && (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' }}>
              <h2 style={{ color:'white', fontWeight:'800', fontSize:'1.25rem', letterSpacing:'-0.02em' }}>Casos clínicos</h2>
              <button onClick={() => { setEditing(EMPTY_CASE); setCaseView('edit'); }} style={{ background:'linear-gradient(135deg,#3b82f6,#6366f1)', color:'white', padding:'0.5rem 1.25rem', borderRadius:'9999px', border:'none', cursor:'pointer', fontSize:'0.8rem', fontWeight:'700' }}>+ Nuevo caso</button>
            </div>
            {loadingCases ? <p style={{ color:'#334155', textAlign:'center', padding:'3rem' }}>Cargando...</p> : cases.length === 0 ? <p style={{ color:'#1e293b', textAlign:'center', padding:'3rem' }}>Sin casos todavía</p> : (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.625rem' }}>
                {cases.map(c => (
                  <div key={c.id} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'1rem', padding:'1rem 1.25rem', display:'flex', alignItems:'center', gap:'1rem' }}>
                    <div style={{ width:'2.5rem', height:'2.5rem', borderRadius:'0.75rem', background: c.avatarGender==='male' ? 'linear-gradient(135deg,#1d4ed8,#3b82f6)' : 'linear-gradient(135deg,#6d28d9,#a78bfa)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem', flexShrink:0 }}>{c.avatarGender==='male' ? '👨' : '👩'}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ color:'white', fontWeight:'700', fontSize:'0.875rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.title}</p>
                      <div style={{ display:'flex', gap:'0.4rem', marginTop:'0.25rem', flexWrap:'wrap' }}>
                        {c.specialty && <span style={{ fontSize:'0.63rem', color:'#60a5fa', background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.2)', padding:'0.15rem 0.5rem', borderRadius:'9999px' }}>{c.specialty}</span>}
                        {c.difficulty && <span style={{ fontSize:'0.63rem', color:'#94a3b8', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', padding:'0.15rem 0.5rem', borderRadius:'9999px' }}>{c.difficulty}</span>}
                        {(c.recursos?.length ?? 0) > 0 && <span style={{ fontSize:'0.63rem', color:'#10b981', background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.2)', padding:'0.15rem 0.5rem', borderRadius:'9999px' }}>🧪 {c.recursos.length} exámenes</span>}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:'0.5rem' }}>
                      <button onClick={() => { setEditing({ ...c, recursos: c.recursos ?? [] }); setCaseView('edit'); }} style={{ background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.2)', color:'#93c5fd', padding:'0.4rem 0.875rem', borderRadius:'0.5rem', cursor:'pointer', fontSize:'0.75rem', fontWeight:'600' }}>Editar</button>
                      <button onClick={() => deleteCase(c.id!)} style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.15)', color:'#fca5a5', padding:'0.4rem 0.875rem', borderRadius:'0.5rem', cursor:'pointer', fontSize:'0.75rem', fontWeight:'600' }}>Eliminar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ════════════ EDITOR DE CASO ════════════ */}
        {tab === 'casos' && caseView === 'edit' && (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.75rem' }}>
              <h2 style={{ color:'white', fontWeight:'800', fontSize:'1.125rem' }}>{editing.id ? 'Editar caso' : 'Nuevo caso'}</h2>
              <button onClick={() => setCaseView('list')} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#94a3b8', padding:'0.4rem 1rem', borderRadius:'9999px', cursor:'pointer', fontSize:'0.78rem', fontWeight:'600' }}>← Volver</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
              {/* Info básica */}
              <section style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'1rem', padding:'1.5rem' }}>
                <p style={{ color:'#64748b', fontWeight:'700', fontSize:'0.75rem', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'1.25rem' }}>Información básica</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1rem' }}>
                  <div><label style={S.label}>Título *</label><input style={S.input} value={editing.title} onChange={e => setEditing(p => ({...p, title: e.target.value}))} placeholder="ej. Dolor abdominal agudo" /></div>
                  <div><label style={S.label}>Especialidad</label><select style={{...S.input, cursor:'pointer'}} value={editing.specialty} onChange={e => setEditing(p => ({...p, specialty: e.target.value}))}><option value="">Selecciona...</option>{ESPECIALIDADES.map(s => <option key={s}>{s}</option>)}</select></div>
                  <div><label style={S.label}>Dificultad</label><select style={{...S.input, cursor:'pointer'}} value={editing.difficulty} onChange={e => setEditing(p => ({...p, difficulty: e.target.value}))}>{['Fácil','Moderado','Difícil'].map(d => <option key={d}>{d}</option>)}</select></div>
                  <div><label style={S.label}>Género avatar</label><select style={{...S.input, cursor:'pointer'}} value={editing.avatarGender} onChange={e => setEditing(p => ({...p, avatarGender: e.target.value as 'male'|'female'}))}><option value="female">👩 Femenino</option><option value="male">👨 Masculino</option></select></div>
                </div>
                <div><label style={S.label}>Contexto del caso * <span style={{ color:'#1e293b', fontWeight:'400', textTransform:'none', letterSpacing:0 }}>(perfil, síntomas, antecedentes, comportamiento)</span></label><textarea style={{...S.input, minHeight:'160px', resize:'vertical', lineHeight:'1.6', fontFamily:'inherit'}} value={editing.caseContext} onChange={e => setEditing(p => ({...p, caseContext: e.target.value}))} placeholder={`PERFIL:\n- Nombre, edad, ocupación\n\nMOTIVO DE CONSULTA:\n...\n\nSÍNTOMAS:\n...\n\nANTECEDENTES:\n...\n\nCOMPORTAMIENTO:\n...`} /></div>
              </section>

              {/* Recursos */}
              <section style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'1rem', padding:'1.5rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
                  <div><p style={{ color:'#64748b', fontWeight:'700', fontSize:'0.75rem', textTransform:'uppercase', letterSpacing:'0.06em' }}>Exámenes y recursos</p><p style={{ color:'#1e293b', fontSize:'0.7rem', marginTop:'0.15rem' }}>Solo se revelan si el médico los solicita</p></div>
                  <button onClick={addRec} style={{ background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.2)', color:'#6ee7b7', padding:'0.4rem 0.875rem', borderRadius:'9999px', cursor:'pointer', fontSize:'0.75rem', fontWeight:'700' }}>+ Agregar</button>
                </div>
                {editing.recursos.length === 0 ? <p style={{ color:'#1e293b', fontSize:'0.8rem', textAlign:'center', padding:'1rem 0' }}>Sin exámenes configurados</p> : (
                  <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
                    {editing.recursos.map((r, i) => {
                      const isLab   = r.tipo === 'Laboratorio' || r.tipo === 'Signos vitales';
                      const isImg   = r.tipo === 'Imagen';
                      const isMed   = r.tipo === 'Medicamento';
                      const isText  = r.tipo === 'Historia previa' || r.tipo === 'Otro';
                      const inp = {...S.input, fontSize:'0.78rem', padding:'0.4rem 0.6rem'} as React.CSSProperties;
                      return (
                        <div key={i} style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'0.75rem', padding:'1rem' }}>
                          {/* Fila común: tipo + nombre */}
                          <div style={{ display:'grid', gridTemplateColumns:'150px 1fr', gap:'0.5rem', marginBottom:'0.5rem' }}>
                            <div>
                              <label style={S.label}>Tipo</label>
                              <select style={{...inp, cursor:'pointer'}} value={r.tipo} onChange={e => updateRec(i,'tipo',e.target.value)}>
                                {TIPOS_RECURSO.map(t => <option key={t}>{t}</option>)}
                              </select>
                            </div>
                            <div>
                              <label style={S.label}>Nombre del examen</label>
                              <input style={inp} value={r.nombre} onChange={e => updateRec(i,'nombre',e.target.value)}
                                placeholder={isLab ? 'ej. Glucosa en ayunas' : isImg ? 'ej. Radiografía de tórax' : isMed ? 'ej. Metformina' : 'ej. Antecedente quirúrgico'} />
                            </div>
                          </div>

                          {/* Lab / Signos vitales */}
                          {isLab && (
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 100px 1fr', gap:'0.5rem', marginBottom:'0.5rem' }}>
                              <div><label style={S.label}>Valor resultado</label><input style={inp} value={r.valor ?? ''} onChange={e => updateRec(i,'valor',e.target.value)} placeholder="285" /></div>
                              <div><label style={S.label}>Unidad</label><input style={inp} value={r.unidad ?? ''} onChange={e => updateRec(i,'unidad',e.target.value)} placeholder="mg/dL" /></div>
                              <div><label style={S.label}>Referencia normal</label><input style={inp} value={r.referencia ?? ''} onChange={e => updateRec(i,'referencia',e.target.value)} placeholder="70-100 mg/dL" /></div>
                            </div>
                          )}

                          {/* Imagen */}
                          {isImg && (
                            <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem', marginBottom:'0.5rem' }}>
                              <div><label style={S.label}>URL de la imagen <span style={{ color:'#1e293b', fontWeight:'400', textTransform:'none', letterSpacing:0 }}>(pega un link directo a la imagen)</span></label><input style={inp} value={r.imageUrl ?? ''} onChange={e => updateRec(i,'imageUrl',e.target.value)} placeholder="https://..." /></div>
                              {r.imageUrl && <img src={r.imageUrl} alt="" style={{ maxHeight:'120px', objectFit:'cover', borderRadius:'0.5rem', border:'1px solid rgba(255,255,255,0.08)' }} onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />}
                              <div><label style={S.label}>Hallazgos <span style={{ color:'#1e293b', fontWeight:'400', textTransform:'none', letterSpacing:0 }}>(descripción verbal que el AI usará si la piden)</span></label><textarea style={{...inp, minHeight:'80px', resize:'vertical', lineHeight:'1.5', fontFamily:'inherit'}} value={r.hallazgos ?? ''} onChange={e => updateRec(i,'hallazgos',e.target.value)} placeholder="ej. Infiltrado bilateral en bases pulmonares compatible con neumonía..." /></div>
                            </div>
                          )}

                          {/* Medicamento */}
                          {isMed && (
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0.5rem', marginBottom:'0.5rem' }}>
                              <div><label style={S.label}>Dosis</label><input style={inp} value={r.dosis ?? ''} onChange={e => updateRec(i,'dosis',e.target.value)} placeholder="500 mg" /></div>
                              <div><label style={S.label}>Frecuencia</label><input style={inp} value={r.frecuencia ?? ''} onChange={e => updateRec(i,'frecuencia',e.target.value)} placeholder="cada 8 horas" /></div>
                              <div><label style={S.label}>Vía</label><input style={inp} value={r.via ?? ''} onChange={e => updateRec(i,'via',e.target.value)} placeholder="oral" /></div>
                            </div>
                          )}

                          {/* Historia / Otro */}
                          {isText && (
                            <div style={{ marginBottom:'0.5rem' }}>
                              <label style={S.label}>Descripción</label>
                              <textarea style={{...inp, minHeight:'80px', resize:'vertical', lineHeight:'1.5', fontFamily:'inherit'}} value={r.descripcion ?? ''} onChange={e => updateRec(i,'descripcion',e.target.value)} placeholder="ej. Cirugía de apéndice en 2018..." />
                            </div>
                          )}

                          {/* Notas (todos) */}
                          <div style={{ display:'flex', alignItems:'flex-end', gap:'0.5rem' }}>
                            <div style={{ flex:1 }}>
                              <label style={S.label}>Notas adicionales <span style={{ color:'#1e293b', fontWeight:'400', textTransform:'none', letterSpacing:0 }}>(opcional)</span></label>
                              <input style={inp} value={r.notas ?? ''} onChange={e => updateRec(i,'notas',e.target.value)} placeholder="ej. tomado en ayunas de 8 horas" />
                            </div>
                            <button onClick={() => removeRec(i)} style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.15)', color:'#fca5a5', padding:'0.4rem 0.75rem', borderRadius:'0.5rem', cursor:'pointer', fontSize:'0.72rem', fontWeight:'600', flexShrink:0 }}>Quitar</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end', paddingBottom:'2rem' }}>
                <button onClick={() => setCaseView('list')} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'#64748b', padding:'0.7rem 1.5rem', borderRadius:'0.75rem', cursor:'pointer', fontSize:'0.875rem', fontWeight:'600' }}>Cancelar</button>
                <button onClick={saveCase} disabled={saving} style={{ background: saving ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg,#3b82f6,#6366f1)', color:'white', fontWeight:'700', padding:'0.7rem 2rem', borderRadius:'0.75rem', border:'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize:'0.875rem' }}>
                  {saving ? 'Guardando...' : editing.id ? 'Guardar cambios' : 'Crear caso'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ════════════ SESIONES LIST ════════════ */}
        {tab === 'sesiones' && !selSession && (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' }}>
              <h2 style={{ color:'white', fontWeight:'800', fontSize:'1.25rem', letterSpacing:'-0.02em' }}>Sesiones grabadas</h2>
              <button onClick={loadSessions} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#94a3b8', padding:'0.4rem 1rem', borderRadius:'9999px', cursor:'pointer', fontSize:'0.78rem', fontWeight:'600' }}>↺ Actualizar</button>
            </div>
            {loadingSessions ? <p style={{ color:'#334155', textAlign:'center', padding:'3rem' }}>Cargando...</p> : sessions.length === 0 ? <p style={{ color:'#1e293b', textAlign:'center', padding:'3rem' }}>Sin sesiones todavía</p> : (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.625rem' }}>
                {sessions.map(s => (
                  <div key={s.id} onClick={() => setSelSession(s)} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'1rem', padding:'1rem 1.25rem', display:'flex', alignItems:'center', gap:'1rem', cursor:'pointer', transition:'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.055)'} onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.03)'}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ color:'white', fontWeight:'700', fontSize:'0.875rem', marginBottom:'0.25rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.caseTitle || 'Sin título'}</p>
                      <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
                        <span style={{ fontSize:'0.65rem', color:'#475569' }}>{fmtDate(s.startTime)}</span>
                        {s.duration && <span style={{ fontSize:'0.65rem', color:'#475569' }}>⏱ {fmt(s.duration)}</span>}
                        <span style={{ fontSize:'0.65rem', color:'#475569' }}>💬 {s.messages?.length ?? 0} mensajes</span>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:'0.5rem', alignItems:'center', flexShrink:0 }}>
                      {s.evaluation ? (
                        <span style={{ fontSize:'0.75rem', color: scoreColor(s.evaluation.score), background:`${scoreColor(s.evaluation.score)}18`, border:`1px solid ${scoreColor(s.evaluation.score)}40`, padding:'0.3rem 0.75rem', borderRadius:'9999px', fontWeight:'700' }}>
                          {s.evaluation.score}/10
                        </span>
                      ) : (
                        <span style={{ fontSize:'0.65rem', color:'#334155', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', padding:'0.3rem 0.75rem', borderRadius:'9999px' }}>Sin evaluar</span>
                      )}
                      <span style={{ color:'#334155', fontSize:'1rem' }}>→</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ════════════ SESIÓN DETALLE ════════════ */}
        {tab === 'sesiones' && selSession && (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' }}>
              <div>
                <button onClick={() => setSelSession(null)} style={{ background:'none', border:'none', color:'#475569', cursor:'pointer', fontSize:'0.78rem', fontWeight:'600', padding:0, marginBottom:'0.5rem', display:'block' }}>← Volver a sesiones</button>
                <h2 style={{ color:'white', fontWeight:'800', fontSize:'1.125rem', letterSpacing:'-0.01em' }}>{selSession.caseTitle}</h2>
                <p style={{ color:'#334155', fontSize:'0.75rem', marginTop:'0.2rem' }}>{fmtDate(selSession.startTime)} · {selSession.duration ? fmt(selSession.duration) : '—'} · {selSession.messages?.length ?? 0} mensajes</p>
              </div>
              {!selSession.evaluation && (
                <button onClick={() => generateEvaluation(selSession)} disabled={evaluating} style={{ background: evaluating ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg,#6366f1,#4f46e5)', color:'white', fontWeight:'700', padding:'0.6rem 1.25rem', borderRadius:'0.75rem', border:'none', cursor: evaluating ? 'not-allowed' : 'pointer', fontSize:'0.8rem', display:'flex', alignItems:'center', gap:'0.5rem', flexShrink:0 }}>
                  {evaluating ? <><div style={{ width:'0.875rem', height:'0.875rem', border:'2px solid rgba(255,255,255,0.3)', borderTop:'2px solid white', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />Analizando...</> : '✦ Generar evaluación'}
                </button>
              )}
            </div>

            <div style={{ display:'grid', gridTemplateColumns: selSession.evaluation ? '1fr 1fr' : '1fr', gap:'1.25rem' }}>
              {/* Transcripción */}
              <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'1rem', overflow:'hidden' }}>
                <div style={{ padding:'0.875rem 1.25rem', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                  <span style={{ fontSize:'0.72rem', color:'#475569', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.06em' }}>Transcripción</span>
                  <span style={{ fontSize:'0.65rem', background:'rgba(59,130,246,0.12)', color:'#93c5fd', padding:'0.1rem 0.5rem', borderRadius:'9999px', border:'1px solid rgba(59,130,246,0.2)' }}>{selSession.messages?.length ?? 0} mensajes</span>
                </div>
                <div style={{ padding:'1rem', maxHeight:'520px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'0.5rem' }}>
                  {(selSession.messages ?? []).length === 0 ? <p style={{ color:'#1e293b', textAlign:'center', padding:'2rem 0', fontSize:'0.8rem' }}>Sin mensajes grabados</p> : (
                    selSession.messages.map((m, i) => (
                      <div key={i} style={{ display:'flex', justifyContent: m.role==='user' ? 'flex-end' : 'flex-start' }}>
                        <div style={{ maxWidth:'85%', padding:'0.625rem 0.875rem', borderRadius: m.role==='user' ? '0.875rem 0.875rem 0.25rem 0.875rem' : '0.875rem 0.875rem 0.875rem 0.25rem', background: m.role==='user' ? 'rgba(37,99,235,0.25)' : 'rgba(255,255,255,0.05)', border: m.role==='user' ? '1px solid rgba(59,130,246,0.2)' : '1px solid rgba(255,255,255,0.07)' }}>
                          <p style={{ fontSize:'0.62rem', color: m.role==='user' ? '#93c5fd' : '#475569', fontWeight:'700', marginBottom:'0.2rem', textTransform:'uppercase', letterSpacing:'0.04em' }}>{m.role==='user' ? '🩺 Médico' : '🧑 Paciente'}</p>
                          <p style={{ fontSize:'0.82rem', color: m.role==='user' ? '#bfdbfe' : '#94a3b8', lineHeight:'1.5' }}>{m.content}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Evaluación */}
              {selSession.evaluation && (() => {
                const ev = selSession.evaluation!;
                return (
                  <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'1rem', overflow:'hidden' }}>
                    <div style={{ padding:'0.875rem 1.25rem', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <span style={{ fontSize:'0.72rem', color:'#475569', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.06em' }}>Evaluación IA</span>
                      <button onClick={() => generateEvaluation(selSession)} disabled={evaluating} style={{ background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.2)', color:'#a5b4fc', padding:'0.25rem 0.75rem', borderRadius:'9999px', cursor:'pointer', fontSize:'0.68rem', fontWeight:'600' }}>↺ Re-evaluar</button>
                    </div>
                    <div style={{ padding:'1.25rem', display:'flex', flexDirection:'column', gap:'1rem', maxHeight:'520px', overflowY:'auto' }}>
                      {/* Score */}
                      <div style={{ display:'flex', alignItems:'center', gap:'1.25rem', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', padding:'1rem 1.25rem', borderRadius:'0.875rem' }}>
                        <div style={{ textAlign:'center', flexShrink:0 }}>
                          <div style={{ fontSize:'2.75rem', fontWeight:'800', color: scoreColor(ev.score), lineHeight:1, letterSpacing:'-0.03em' }}>{ev.score}</div>
                          <div style={{ fontSize:'0.65rem', color:'#334155', marginTop:'0.15rem' }}>/ 10</div>
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ height:'5px', background:'rgba(255,255,255,0.06)', borderRadius:'9999px', overflow:'hidden', marginBottom:'0.75rem' }}>
                            <div style={{ height:'100%', width:`${ev.score*10}%`, background:`linear-gradient(to right, ${scoreColor(ev.score)}80, ${scoreColor(ev.score)})`, borderRadius:'9999px' }} />
                          </div>
                          <p style={{ color:'#64748b', fontSize:'0.78rem', lineHeight:'1.55' }}>{ev.resumen}</p>
                        </div>
                      </div>

                      {/* Diagnóstico */}
                      <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', background: ev.diagnostico_identificado ? 'rgba(16,185,129,0.07)' : 'rgba(245,158,11,0.07)', border:`1px solid ${ev.diagnostico_identificado ? 'rgba(16,185,129,0.18)' : 'rgba(245,158,11,0.18)'}`, padding:'0.875rem 1rem', borderRadius:'0.75rem' }}>
                        <span style={{ fontSize:'1.25rem' }}>{ev.diagnostico_identificado ? '✅' : '⚠️'}</span>
                        <div>
                          <p style={{ fontWeight:'700', color:'white', fontSize:'0.8rem', margin:0 }}>{ev.diagnostico_identificado ? 'Diagnóstico orientado' : 'Diagnóstico no identificado'}</p>
                          <p style={{ color:'#64748b', fontSize:'0.72rem', marginTop:'0.15rem' }}>Probable: <span style={{ color:'#94a3b8', fontWeight:'600' }}>{ev.diagnostico_probable}</span></p>
                        </div>
                      </div>

                      {/* Fortalezas / Mejora */}
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>
                        {[{ title:'💪 Fortalezas', items: ev.fortalezas, color:'#10b981', bg:'rgba(16,185,129,0.07)', border:'rgba(16,185,129,0.15)', tc:'#6ee7b7', prefix:'✓' },
                          { title:'📈 Áreas de mejora', items: ev.areas_mejora, color:'#f59e0b', bg:'rgba(245,158,11,0.07)', border:'rgba(245,158,11,0.15)', tc:'#fcd34d', prefix:'→' }
                        ].map(g => (
                          <div key={g.title}>
                            <p style={{ fontSize:'0.65rem', color: g.color, fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.5rem' }}>{g.title}</p>
                            <div style={{ display:'flex', flexDirection:'column', gap:'0.3rem' }}>
                              {g.items.map((x,i) => <div key={i} style={{ background: g.bg, border:`1px solid ${g.border}`, padding:'0.4rem 0.625rem', borderRadius:'0.5rem', fontSize:'0.72rem', color: g.tc }}>{g.prefix} {x}</div>)}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Preguntas faltantes */}
                      {ev.preguntas_faltantes?.length > 0 && (
                        <div>
                          <p style={{ fontSize:'0.65rem', color:'#ef4444', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.5rem' }}>❓ Preguntas no realizadas</p>
                          <div style={{ display:'flex', flexDirection:'column', gap:'0.3rem' }}>
                            {ev.preguntas_faltantes.map((q,i) => <div key={i} style={{ background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.15)', padding:'0.4rem 0.625rem', borderRadius:'0.5rem', fontSize:'0.72rem', color:'#fca5a5' }}>• {q}</div>)}
                          </div>
                        </div>
                      )}

                      {/* Preguntas realizadas */}
                      {ev.preguntas_clave_realizadas?.length > 0 && (
                        <div>
                          <p style={{ fontSize:'0.65rem', color:'#3b82f6', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.5rem' }}>✔ Preguntas clave realizadas</p>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:'0.3rem' }}>
                            {ev.preguntas_clave_realizadas.map((q,i) => <span key={i} style={{ background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.2)', color:'#93c5fd', padding:'0.25rem 0.625rem', borderRadius:'9999px', fontSize:'0.7rem' }}>{q}</span>)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </>
        )}
      </div>
      <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
