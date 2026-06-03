'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';

const ADMIN_PASSWORD = 'cmc2025';

interface Recurso {
  tipo: string;
  nombre: string;
  valor: string;
  referencia?: string;
  unidad?: string;
  notas?: string;
}

interface ClinicalCase {
  id?: string;
  title: string;
  specialty: string;
  difficulty: string;
  avatarGender: 'male' | 'female';
  caseContext: string;
  recursos: Recurso[];
}

const TIPOS_RECURSO = ['Laboratorio', 'Signos vitales', 'Imagen', 'Historia previa', 'Medicamento', 'Otro'];
const ESPECIALIDADES = ['Medicina Interna', 'Cardiología', 'Endocrinología', 'Neumología', 'Neurología', 'Gastroenterología', 'Pediatría', 'Ginecología', 'Traumatología', 'Dermatología', 'Psiquiatría', 'Otra'];
const EMPTY_CASE: ClinicalCase = { title: '', specialty: '', difficulty: 'Moderado', avatarGender: 'female', caseContext: '', recursos: [] };
const EMPTY_RECURSO: Recurso = { tipo: 'Laboratorio', nombre: '', valor: '', referencia: '', unidad: '', notas: '' };

export default function AdminPage() {
  const [authed, setAuthed]         = useState(false);
  const [password, setPassword]     = useState('');
  const [cases, setCases]           = useState<ClinicalCase[]>([]);
  const [loading, setLoading]       = useState(true);
  const [view, setView]             = useState<'list' | 'edit'>('list');
  const [editing, setEditing]       = useState<ClinicalCase>(EMPTY_CASE);
  const [saving, setSaving]         = useState(false);
  const [toast, setToast]           = useState('');

  useEffect(() => {
    if (authed) loadCases();
  }, [authed]);

  const loadCases = async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, 'clinical_cases'));
    setCases(snap.docs.map(d => ({ id: d.id, ...d.data() })) as ClinicalCase[]);
    setLoading(false);
  };

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const saveCase = async () => {
    if (!editing.title || !editing.caseContext) return alert('Título y contexto son obligatorios.');
    setSaving(true);
    try {
      const payload = { ...editing, updatedAt: serverTimestamp() };
      if (editing.id) {
        const { id, ...data } = payload;
        await updateDoc(doc(db, 'clinical_cases', editing.id!), data);
        showToast('Caso actualizado ✓');
      } else {
        await addDoc(collection(db, 'clinical_cases'), { ...payload, createdAt: serverTimestamp() });
        showToast('Caso creado ✓');
      }
      await loadCases();
      setView('list');
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const deleteCase = async (id: string) => {
    if (!confirm('¿Eliminar este caso?')) return;
    await deleteDoc(doc(db, 'clinical_cases', id));
    showToast('Caso eliminado');
    await loadCases();
  };

  const addRecurso = () => setEditing(p => ({ ...p, recursos: [...p.recursos, { ...EMPTY_RECURSO }] }));
  const removeRecurso = (i: number) => setEditing(p => ({ ...p, recursos: p.recursos.filter((_, idx) => idx !== i) }));
  const updateRecurso = (i: number, field: keyof Recurso, val: string) =>
    setEditing(p => ({ ...p, recursos: p.recursos.map((r, idx) => idx === i ? { ...r, [field]: val } : r) }));

  /* ── Login ── */
  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', background: '#080d1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1.25rem', padding: '2.5rem', width: '100%', maxWidth: '380px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔐</div>
          <h1 style={{ color: 'white', fontWeight: '800', fontSize: '1.25rem', marginBottom: '0.35rem' }}>Panel Administrativo</h1>
          <p style={{ color: '#475569', fontSize: '0.8rem', marginBottom: '2rem' }}>Gestión de casos clínicos</p>
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (password === ADMIN_PASSWORD ? setAuthed(true) : alert('Contraseña incorrecta'))}
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', padding: '0.75rem 1rem', color: 'white', fontSize: '0.9rem', marginBottom: '1rem', outline: 'none' }}
          />
          <button
            onClick={() => password === ADMIN_PASSWORD ? setAuthed(true) : alert('Contraseña incorrecta')}
            style={{ width: '100%', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', color: 'white', fontWeight: '700', padding: '0.75rem', borderRadius: '0.75rem', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            Entrar
          </button>
        </div>
      </div>
    );
  }

  /* ── List ── */
  if (view === 'list') {
    return (
      <div style={{ minHeight: '100vh', background: '#080d1a', padding: '2rem' }}>
        {toast && <div style={{ position: 'fixed', top: '1.5rem', right: '1.5rem', background: '#10b981', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '0.75rem', fontWeight: '600', fontSize: '0.875rem', zIndex: 999, boxShadow: '0 8px 24px rgba(16,185,129,0.3)' }}>{toast}</div>}

        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <div>
              <h1 style={{ color: 'white', fontWeight: '800', fontSize: '1.5rem', letterSpacing: '-0.02em' }}>Panel Admin</h1>
              <p style={{ color: '#475569', fontSize: '0.8rem', marginTop: '0.25rem' }}>{cases.length} casos en Firestore</p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '0.5rem 1rem', borderRadius: '9999px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', textDecoration: 'none' }}>
                ← App
              </a>
              <button
                onClick={() => { setEditing(EMPTY_CASE); setView('edit'); }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', color: 'white', padding: '0.5rem 1.25rem', borderRadius: '9999px', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700' }}
              >
                + Nuevo caso
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: '#475569' }}>Cargando...</div>
          ) : cases.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: '#334155' }}>
              <p style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Sin casos aún</p>
              <p style={{ fontSize: '0.8rem' }}>Crea el primero con el botón de arriba.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {cases.map(c => (
                <div key={c.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '1rem', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: c.avatarGender === 'male' ? 'linear-gradient(135deg,#1d4ed8,#3b82f6)' : 'linear-gradient(135deg,#6d28d9,#a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>
                    {c.avatarGender === 'male' ? '👨' : '👩'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: 'white', fontWeight: '700', fontSize: '0.9rem', marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</p>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {c.specialty && <span style={{ fontSize: '0.65rem', color: '#60a5fa', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', padding: '0.15rem 0.5rem', borderRadius: '9999px' }}>{c.specialty}</span>}
                      {c.difficulty && <span style={{ fontSize: '0.65rem', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', padding: '0.15rem 0.5rem', borderRadius: '9999px' }}>{c.difficulty}</span>}
                      {(c.recursos?.length ?? 0) > 0 && <span style={{ fontSize: '0.65rem', color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', padding: '0.15rem 0.5rem', borderRadius: '9999px' }}>🧪 {c.recursos.length} exámenes</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                    <button onClick={() => { setEditing({ ...c, recursos: c.recursos ?? [] }); setView('edit'); }} style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#93c5fd', padding: '0.4rem 0.875rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600' }}>Editar</button>
                    <button onClick={() => deleteCase(c.id!)} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#fca5a5', padding: '0.4rem 0.875rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600' }}>Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Editor ── */
  const inputStyle: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.625rem', padding: '0.625rem 0.875rem', color: 'white', fontSize: '0.875rem', outline: 'none' };
  const labelStyle: React.CSSProperties = { fontSize: '0.72rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.4rem' };
  const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0' };

  return (
    <div style={{ minHeight: '100vh', background: '#080d1a', padding: '2rem' }}>
      <div style={{ maxWidth: '780px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ color: 'white', fontWeight: '800', fontSize: '1.25rem', letterSpacing: '-0.02em' }}>
              {editing.id ? 'Editar caso' : 'Nuevo caso'}
            </h1>
          </div>
          <button onClick={() => setView('list')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '0.4rem 1rem', borderRadius: '9999px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600' }}>
            ← Volver
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Info básica */}
          <section style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '1rem', padding: '1.5rem' }}>
            <p style={{ color: '#94a3b8', fontWeight: '700', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1.25rem' }}>Información básica</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Título del caso *</label>
                <input style={inputStyle} value={editing.title} onChange={e => setEditing(p => ({ ...p, title: e.target.value }))} placeholder="ej. Dolor abdominal agudo" />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Especialidad</label>
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={editing.specialty} onChange={e => setEditing(p => ({ ...p, specialty: e.target.value }))}>
                  <option value="">Selecciona...</option>
                  {ESPECIALIDADES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Dificultad</label>
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={editing.difficulty} onChange={e => setEditing(p => ({ ...p, difficulty: e.target.value }))}>
                  {['Fácil', 'Moderado', 'Difícil'].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Género del avatar</label>
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={editing.avatarGender} onChange={e => setEditing(p => ({ ...p, avatarGender: e.target.value as 'male' | 'female' }))}>
                  <option value="female">👩 Femenino</option>
                  <option value="male">👨 Masculino</option>
                </select>
              </div>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Contexto del caso * <span style={{ color: '#334155', fontWeight: '400', textTransform: 'none', letterSpacing: 0 }}>(perfil del paciente, síntomas, antecedentes, comportamiento)</span></label>
              <textarea
                style={{ ...inputStyle, minHeight: '160px', resize: 'vertical', lineHeight: '1.6', fontFamily: 'inherit' }}
                value={editing.caseContext}
                onChange={e => setEditing(p => ({ ...p, caseContext: e.target.value }))}
                placeholder={`PERFIL:\n- Nombre, edad, ocupación\n\nMOTIVO DE CONSULTA:\n...\n\nSÍNTOMAS:\n...\n\nANTECEDENTES:\n...\n\nCOMPORTAMIENTO:\n...`}
              />
            </div>
          </section>

          {/* Recursos */}
          <section style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '1rem', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <p style={{ color: '#94a3b8', fontWeight: '700', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Exámenes y recursos</p>
                <p style={{ color: '#334155', fontSize: '0.72rem', marginTop: '0.2rem' }}>Solo se revelan si el médico los solicita durante la consulta</p>
              </div>
              <button onClick={addRecurso} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#6ee7b7', padding: '0.4rem 0.875rem', borderRadius: '9999px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '700' }}>
                + Agregar
              </button>
            </div>

            {editing.recursos.length === 0 ? (
              <p style={{ color: '#1e293b', fontSize: '0.8rem', textAlign: 'center', padding: '1.5rem 0' }}>Sin exámenes — el médico solo puede preguntar síntomas e historia clínica</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {editing.recursos.map((r, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '0.875rem', padding: '1rem 1.125rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 100px 100px', gap: '0.625rem', marginBottom: '0.625rem' }}>
                      <div style={fieldStyle}>
                        <label style={labelStyle}>Tipo</label>
                        <select style={{ ...inputStyle, fontSize: '0.78rem', padding: '0.45rem 0.625rem', cursor: 'pointer' }} value={r.tipo} onChange={e => updateRecurso(i, 'tipo', e.target.value)}>
                          {TIPOS_RECURSO.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div style={fieldStyle}>
                        <label style={labelStyle}>Nombre del examen</label>
                        <input style={{ ...inputStyle, fontSize: '0.78rem', padding: '0.45rem 0.625rem' }} value={r.nombre} onChange={e => updateRecurso(i, 'nombre', e.target.value)} placeholder="ej. Glucosa en ayunas" />
                      </div>
                      <div style={fieldStyle}>
                        <label style={labelStyle}>Valor</label>
                        <input style={{ ...inputStyle, fontSize: '0.78rem', padding: '0.45rem 0.625rem' }} value={r.valor} onChange={e => updateRecurso(i, 'valor', e.target.value)} placeholder="285" />
                      </div>
                      <div style={fieldStyle}>
                        <label style={labelStyle}>Unidad</label>
                        <input style={{ ...inputStyle, fontSize: '0.78rem', padding: '0.45rem 0.625rem' }} value={r.unidad} onChange={e => updateRecurso(i, 'unidad', e.target.value)} placeholder="mg/dL" />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
                      <div style={fieldStyle}>
                        <label style={labelStyle}>Referencia normal</label>
                        <input style={{ ...inputStyle, fontSize: '0.78rem', padding: '0.45rem 0.625rem' }} value={r.referencia} onChange={e => updateRecurso(i, 'referencia', e.target.value)} placeholder="70-100 mg/dL" />
                      </div>
                      <div style={fieldStyle}>
                        <label style={labelStyle}>Notas adicionales</label>
                        <input style={{ ...inputStyle, fontSize: '0.78rem', padding: '0.45rem 0.625rem' }} value={r.notas} onChange={e => updateRecurso(i, 'notas', e.target.value)} placeholder="ej. tomado en ayunas" />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.625rem' }}>
                      <button onClick={() => removeRecurso(i)} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#fca5a5', padding: '0.3rem 0.75rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.72rem', fontWeight: '600' }}>Quitar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Save */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingBottom: '2rem' }}>
            <button onClick={() => setView('list')} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b', padding: '0.7rem 1.5rem', borderRadius: '0.75rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' }}>Cancelar</button>
            <button onClick={saveCase} disabled={saving} style={{ background: saving ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, #3b82f6, #6366f1)', color: 'white', fontWeight: '700', padding: '0.7rem 2rem', borderRadius: '0.75rem', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.875rem', letterSpacing: '0.01em' }}>
              {saving ? 'Guardando...' : editing.id ? 'Guardar cambios' : 'Crear caso'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
