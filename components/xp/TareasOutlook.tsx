'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { dayColor, lightDayInk } from '@/lib/weekdayColors'

// TAREAS bajo XP = OUTLOOK 2003 Tasks (alma de época). Rama shell==='xp' de TareasContent (arcade =
// Kanban/Lista intacto). Las 4 urgencias (Hoy/Esta Semana/Este Mes/Algún Día) = los grupos por fecha de
// Outlook; completed_at = el check; + filtro por entidad, alta en línea, y diálogo de edición. Como ya
// existe el Calendario, aquí se EXCLUYEN los eventos (kind='event') → Tareas es solo tareas, sin duplicar.

const OL = {
  head1: '#f4f8fe', head2: '#c9ddf5', line: '#a8c0e0', blue: '#15427e', accent: '#2b5fb0',
  band1: '#eaf1fb', band2: '#cfe0f4', bandInk: '#1c3d6e', sel: '#dce8fb', rule: '#e6ebf3',
  done: '#9aa3b5', overdue: '#c0271c', ink: '#1a2a44',
}
const TIERS = [
  { id: 'today', label: 'Hoy' },
  { id: 'this_week', label: 'Esta Semana' },
  { id: 'this_month', label: 'Este Mes' },
  { id: 'someday', label: 'Algún Día' },
] as const
type TierId = typeof TIERS[number]['id']

const todayStr = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-') }

interface Task { id: string; title: string; description: string | null; urgency: string | null; key: string | null; priority_score: number | null; tags: string[]; entity_id: string | null; entity_name: string | null; completed_at: string | null; due_date: string | null; kind?: string | null; metadata?: { event_date?: string; date?: string } | null }
interface Entity { id: string; name: string; type: string }

const taskDay = (t: Task): string | null => t.due_date || t.metadata?.event_date || t.metadata?.date || null
const tierOf = (t: Task): TierId => ((t.urgency ?? 'someday') as TierId)

async function post(url: string, b: unknown) { const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }); if (!r.ok) throw new Error(await r.text()); return r.json().catch(() => ({})) }
async function patch(url: string, b: unknown) { const r = await fetch(url, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }); if (!r.ok) throw new Error(await r.text()); return r.json().catch(() => ({})) }
async function del(url: string) { await fetch(url, { method: 'DELETE' }) }

export default function TareasOutlook() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [entities, setEntities] = useState<Entity[]>([])
  const [loading, setLoading] = useState(true)
  const [actionableOnly, setActionableOnly] = useState(true)
  const [entityFilter, setEntityFilter] = useState<string | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [dialog, setDialog] = useState<{ task: Task | null } | null>(null)

  const loadAll = useCallback(() => {
    setLoading(true)
    Promise.all([fetch('/api/tasks').then((r) => r.json()), fetch('/api/entities').then((r) => r.json())])
      .then(([t, e]) => { if (Array.isArray(t)) setTasks(t.filter((x: Task) => x.kind !== 'event')); if (Array.isArray(e)) setEntities(e) })
      .catch(() => {}).finally(() => setLoading(false))
  }, [])
  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => { const h = () => loadAll(); window.addEventListener('capture:task', h); return () => window.removeEventListener('capture:task', h) }, [loadAll])

  // ── handlers ──
  async function toggleDone(t: Task) {
    const completed_at = t.completed_at ? null : new Date().toISOString()
    setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, completed_at } : x)))
    try { await patch(`/api/tasks/${t.id}`, { completed_at }) } catch { setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, completed_at: t.completed_at } : x))) }
  }
  async function quickAdd(title: string, urgency: TierId) {
    if (!title.trim()) return
    const row = await post('/api/tasks', { title: title.trim(), urgency, entity_name: entityFilter }) as Task
    setTasks((ts) => [row, ...ts])
  }
  async function saveTask(form: TaskForm, editing: Task | null) {
    const entity_id = entities.find((e) => e.name === form.entity_name)?.id ?? null
    const body = { title: form.title.trim(), description: form.description || null, urgency: form.urgency, key: form.key || null, priority_score: form.priority_score === '' ? null : Number(form.priority_score), tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean), entity_name: form.entity_name || null, entity_id, due_date: form.due_date || null }
    if (editing) { const r = await patch(`/api/tasks/${editing.id}`, body) as Task; setTasks((ts) => ts.map((x) => (x.id === editing.id ? { ...x, ...r, ...body } : x))) }
    else { const r = await post('/api/tasks', body) as Task; setTasks((ts) => [r, ...ts]) }
    setDialog(null)
  }
  async function deleteTask(t: Task) { await del(`/api/tasks/${t.id}`); setTasks((ts) => ts.filter((x) => x.id !== t.id)); setDialog(null) }
  async function moveTier(id: string, urgency: TierId) {
    setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, urgency } : x)))
    try { await patch(`/api/tasks/${id}`, { urgency }) } catch { loadAll() }
  }
  // entidades
  const createEntity = (name: string) => post('/api/entities', { name }).then((e) => setEntities((es) => [...es, e as Entity].sort((a, b) => a.name.localeCompare(b.name))))
  const renameEntity = (id: string, name: string) => patch(`/api/entities/${id}`, { name }).then(() => { setEntities((es) => es.map((e) => (e.id === id ? { ...e, name } : e))); setTasks((ts) => ts.map((t) => (t.entity_id === id ? { ...t, entity_name: name } : t))) })
  const deleteEntity = (id: string) => del(`/api/entities/${id}`).then(() => { setEntities((es) => es.filter((e) => e.id !== id)); setTasks((ts) => ts.map((t) => (t.entity_id === id ? { ...t, entity_id: null, entity_name: null } : t))) })

  // ── derivados ──
  const filtered = useMemo(() => tasks.filter((t) => !entityFilter || t.entity_name === entityFilter), [tasks, entityFilter])
  const byTier = useMemo(() => { const m: Record<string, Task[]> = { today: [], this_week: [], this_month: [], someday: [] }; for (const t of filtered) m[tierOf(t)].push(t); return m }, [filtered])
  const openCount = filtered.filter((t) => !t.completed_at).length
  // Siempre las 4 secciones (Hoy/Esta Semana/Este Mes/Algún Día). "Activas" solo oculta las completadas.
  const shownTiers = TIERS

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff', fontFamily: 'inherit', fontSize: 11, color: OL.ink }}>
      {/* Menú (decorativo) */}
      <div style={{ display: 'flex', gap: 13, padding: '2px 9px', background: '#f7f9fc', borderBottom: '1px solid #cdd6e2', fontSize: 11, color: '#333' }}>{['Archivo', 'Editar', 'Ver', 'Acciones', 'Herramientas', 'Ayuda'].map((m) => <span key={m}>{m}</span>)}</div>
      {/* Toolbar Outlook */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: `linear-gradient(180deg,${OL.head1},${OL.head2})`, borderBottom: `1px solid ${OL.line}`, position: 'relative' }}>
        <OlBtn onClick={() => setDialog({ task: null })} primary>🗒 Nueva tarea</OlBtn>
        <span style={{ width: 1, height: 18, background: OL.line, margin: '0 2px' }} />
        <OlBtn onClick={() => setActionableOnly((v) => !v)} pressed={actionableOnly}>Activas{actionableOnly && ` (${openCount})`}</OlBtn>
        <OlBtn onClick={() => setFilterOpen((v) => !v)} pressed={!!entityFilter}>Filtro{entityFilter ? `: ${entityFilter}` : ''} ▾</OlBtn>
        <span style={{ flex: 1 }} />
        <span style={{ color: '#5a6a86', fontSize: 10.5 }}>{openCount} tareas abiertas</span>
        {filterOpen && <EntityMenu entities={entities} active={entityFilter} onPick={(n) => { setEntityFilter(n); setFilterOpen(false) }} onClose={() => setFilterOpen(false)} onCreate={createEntity} onRename={renameEntity} onDelete={deleteEntity} />}
      </div>
      {/* Encabezado de columnas */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', background: `linear-gradient(${OL.head1},${OL.head2})`, borderBottom: `1px solid ${OL.line}`, fontSize: 10, fontWeight: 700, color: OL.blue, padding: '2px 0' }}>
        <span style={{ width: 26, textAlign: 'center' }}>✓</span>
        <span style={{ width: 18, textAlign: 'center' }}>!</span>
        <span style={{ flex: 1, paddingLeft: 4 }}>Asunto</span>
        <span style={{ width: 132 }}>Entidad</span>
        <span style={{ width: 104 }}>Vencimiento</span>
      </div>

      {/* Lista agrupada por urgencia (grupos de Outlook) */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {loading && <div style={{ padding: 14, color: '#8a93a8', fontStyle: 'italic' }}>Cargando tareas…</div>}
        {!loading && shownTiers.map((tier) => {
          const all = byTier[tier.id]
          const open = all.filter((t) => !t.completed_at)
          const done = all.filter((t) => t.completed_at)
          return (
            <div key={tier.id} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const id = e.dataTransfer.getData('text/plain'); if (id) moveTier(id, tier.id) }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: `linear-gradient(${OL.band1},${OL.band2})`, borderTop: `1px solid ${OL.line}`, borderBottom: `1px solid ${OL.line}`, padding: '2px 8px', fontSize: 10.5, fontWeight: 700, color: OL.bandInk }}>
                <span style={{ fontSize: 8 }}>▾</span> {tier.label} <span style={{ fontWeight: 400, color: '#6a7690' }}>({open.length})</span>
              </div>
              {open.map((t) => <TaskRow key={t.id} t={t} entityWidth onToggle={() => toggleDone(t)} onOpen={() => setDialog({ task: t })} />)}
              {!actionableOnly && done.map((t) => <TaskRow key={t.id} t={t} entityWidth onToggle={() => toggleDone(t)} onOpen={() => setDialog({ task: t })} />)}
              <AddRow onAdd={(title) => quickAdd(title, tier.id)} />
            </div>
          )
        })}
      </div>

      {dialog && <TaskDialog task={dialog.task} entities={entities} onClose={() => setDialog(null)} onSave={(f) => saveTask(f, dialog.task)} onDelete={dialog.task ? () => deleteTask(dialog.task!) : undefined} />}
    </div>
  )
}

// ── primitivas ──
function OlBtn({ children, onClick, primary, pressed }: { children: React.ReactNode; onClick: () => void; primary?: boolean; pressed?: boolean }) {
  return <button onClick={onClick} style={{ border: `1px solid ${pressed ? OL.accent : OL.line}`, borderRadius: 3, padding: '2px 10px', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer', color: primary ? '#fff' : OL.blue, background: primary ? `linear-gradient(${OL.accent},#1c4790)` : pressed ? '#cfe0f4' : 'linear-gradient(#fff,#e9f0fa)' }}>{children}</button>
}

function TaskRow({ t, onToggle, onOpen }: { t: Task; entityWidth?: boolean; onToggle: () => void; onOpen: () => void }) {
  const [hover, setHover] = useState(false)
  const done = !!t.completed_at
  const day = taskDay(t)
  const overdue = !done && !!day && day < todayStr()
  const high = (t.priority_score ?? 0) >= 70
  const dueTxt = day ? new Date(day + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }) : ''
  const dueCol = day ? lightDayInk(dayColor(new Date(day + 'T12:00:00'))) : '#8a93a8'
  return (
    <div
      draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)}
      onClick={onOpen} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', alignItems: 'center', minHeight: 20, borderBottom: `1px solid ${OL.rule}`, background: hover ? OL.sel : '#fff', cursor: 'pointer', fontSize: 11 }}
    >
      <span style={{ width: 26, display: 'flex', justifyContent: 'center' }}>
        <input type="checkbox" checked={done} onClick={(e) => e.stopPropagation()} onChange={onToggle} style={{ cursor: 'pointer' }} />
      </span>
      <span style={{ width: 18, textAlign: 'center', color: OL.overdue, fontWeight: 700 }}>{high ? '!' : ''}</span>
      <span style={{ flex: 1, minWidth: 0, paddingLeft: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: done ? OL.done : OL.ink, textDecoration: done ? 'line-through' : 'none' }}>
        {t.title}
        {t.tags?.length > 0 && t.tags.map((tag) => <span key={tag} style={{ marginLeft: 5, fontSize: 9, color: '#5a6a86', border: '1px solid #d3ddec', borderRadius: 3, padding: '0 3px' }}>{tag}</span>)}
        {t.key && <span style={{ marginLeft: 5, fontSize: 9, color: '#8a93a8', fontFamily: 'monospace' }}>{t.key}</span>}
      </span>
      <span style={{ width: 132, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#5a6a86', fontSize: 10.5 }}>{t.entity_name ?? ''}</span>
      <span style={{ width: 104, color: overdue ? OL.overdue : dueCol, fontWeight: overdue ? 700 : 400, fontSize: 10.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>{dueTxt}</span>
    </div>
  )
}

// Fila "Haga clic aquí para agregar una tarea" de Outlook.
function AddRow({ onAdd }: { onAdd: (title: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [v, setV] = useState('')
  const go = () => { if (v.trim()) { onAdd(v.trim()); setV('') } setEditing(false) }
  if (!editing) return <div onClick={() => setEditing(true)} style={{ padding: '3px 8px 3px 30px', color: '#9aa8bd', fontStyle: 'italic', fontSize: 10.5, cursor: 'text', borderBottom: `1px solid ${OL.rule}` }}>Haga clic aquí para agregar una tarea</div>
  return (
    <div style={{ padding: '2px 8px 2px 26px', borderBottom: `1px solid ${OL.rule}`, background: '#fffef2' }}>
      <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onBlur={go} onKeyDown={(e) => { if (e.key === 'Enter') go(); if (e.key === 'Escape') { setV(''); setEditing(false) } }}
        placeholder="Asunto de la tarea…" style={{ width: '100%', border: `1px solid ${OL.line}`, borderRadius: 2, padding: '2px 5px', fontSize: 11, fontFamily: 'inherit', outline: 'none' }} />
    </div>
  )
}

function EntityMenu({ entities, active, onPick, onClose, onCreate, onRename, onDelete }: {
  entities: Entity[]; active: string | null; onPick: (n: string | null) => void; onClose: () => void; onCreate: (n: string) => void; onRename: (id: string, n: string) => void; onDelete: (id: string) => void
}) {
  const [nw, setNw] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editV, setEditV] = useState('')
  const [armDel, setArmDel] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h) }, [onClose])
  return (
    <div ref={ref} style={{ position: 'absolute', top: '100%', left: 90, zIndex: 30, marginTop: 2, width: 216, background: '#fff', border: `1px solid ${OL.line}`, boxShadow: '2px 3px 8px rgba(0,0,0,0.25)', borderRadius: 3, padding: 4, fontSize: 11 }}>
      <button onClick={() => onPick(null)} style={{ ...menuItem, fontWeight: active ? 400 : 700 }}>Todas las entidades</button>
      <div style={{ maxHeight: 180, overflow: 'auto', margin: '2px 0', borderTop: `1px solid ${OL.rule}` }}>
        {entities.map((e) => (
          <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            {editId === e.id ? (
              <input autoFocus value={editV} onChange={(ev) => setEditV(ev.target.value)} onBlur={() => { setEditId(null); if (editV.trim() && editV !== e.name) onRename(e.id, editV.trim()) }} onKeyDown={(ev) => { if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur() }} style={{ flex: 1, border: `1px solid ${OL.line}`, borderRadius: 2, padding: '1px 4px', fontSize: 11, fontFamily: 'inherit', outline: 'none' }} />
            ) : (
              <button onClick={() => onPick(e.name)} style={{ ...menuItem, flex: 1, fontWeight: active === e.name ? 700 : 400 }}>{e.name}</button>
            )}
            <button onClick={() => { setEditId(e.id); setEditV(e.name) }} title="Renombrar" style={miniBtn}>✎</button>
            <button onClick={() => { if (armDel === e.id) { setArmDel(null); onDelete(e.id) } else setArmDel(e.id) }} title="Eliminar" style={{ ...miniBtn, color: armDel === e.id ? '#c31212' : '#a9b0be' }}>{armDel === e.id ? '✓?' : '🗑'}</button>
          </div>
        ))}
        {entities.length === 0 && <div style={{ padding: '4px 6px', color: '#9aa8bd', fontStyle: 'italic', fontSize: 10 }}>Sin entidades.</div>}
      </div>
      <div style={{ display: 'flex', gap: 4, borderTop: `1px solid ${OL.rule}`, paddingTop: 3 }}>
        <input value={nw} onChange={(e) => setNw(e.target.value)} placeholder="Nueva entidad…" onKeyDown={(e) => { if (e.key === 'Enter' && nw.trim()) { onCreate(nw.trim()); setNw('') } }} style={{ flex: 1, border: `1px solid ${OL.line}`, borderRadius: 2, padding: '1px 5px', fontSize: 11, fontFamily: 'inherit', outline: 'none' }} />
        <button onClick={() => { if (nw.trim()) { onCreate(nw.trim()); setNw('') } }} style={miniBtn}>＋</button>
      </div>
    </div>
  )
}
const menuItem: React.CSSProperties = { display: 'block', width: '100%', textAlign: 'left', border: 0, background: 'none', cursor: 'pointer', padding: '3px 6px', fontSize: 11, fontFamily: 'inherit', color: OL.ink, borderRadius: 2 }
const miniBtn: React.CSSProperties = { border: 0, background: 'none', cursor: 'pointer', fontSize: 11, padding: '1px 3px', color: '#5a6a86' }

// ── Diálogo de tarea (crear/editar/borrar) ──
interface TaskForm { title: string; description: string; urgency: string; key: string; priority_score: string; tags: string; entity_name: string; due_date: string }
function TaskDialog({ task, entities, onClose, onSave, onDelete }: { task: Task | null; entities: Entity[]; onClose: () => void; onSave: (f: TaskForm) => void; onDelete?: () => void }) {
  const editing = !!task
  const [f, setF] = useState<TaskForm>({
    title: task?.title ?? '', description: task?.description ?? '', urgency: task?.urgency ?? 'someday',
    key: task?.key ?? '', priority_score: task?.priority_score != null ? String(task.priority_score) : '',
    tags: (task?.tags ?? []).join(', '), entity_name: task?.entity_name ?? '', due_date: task?.due_date ?? '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k: keyof TaskForm, v: string) => setF((p) => ({ ...p, [k]: v }))
  async function save() { if (!f.title.trim() || busy) return; setBusy(true); try { await onSave(f) } catch { setBusy(false) } }
  return (
    <div onMouseDown={onClose} style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(20,40,80,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onMouseDown={(e) => e.stopPropagation()} style={{ width: 400, maxWidth: '94%', background: '#ece9d8', border: '1px solid #0831d8', borderRadius: 4, boxShadow: '0 6px 22px rgba(0,0,0,0.35)', overflow: 'hidden', fontSize: 11 }}>
        <div className="xp-titlebar" style={{ height: 24, color: '#fff', fontWeight: 700, padding: '0 4px 0 9px', display: 'flex', alignItems: 'center' }}><span style={{ flex: 1 }}>{editing ? 'Tarea' : 'Nueva tarea'}</span><button onClick={onClose} style={{ border: 0, background: 'rgba(255,255,255,0.18)', color: '#fff', width: 16, height: 16, borderRadius: 2, cursor: 'pointer', lineHeight: 1 }}>×</button></div>
        <div style={{ padding: 11, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={lbl}>Asunto<input autoFocus value={f.title} onChange={(e) => set('title', e.target.value)} className="xp-sunken" style={inp} /></label>
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ ...lbl, flex: 1 }}>Urgencia<select value={f.urgency} onChange={(e) => set('urgency', e.target.value)} className="xp-sunken" style={inp}>{TIERS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
            <label style={{ ...lbl, width: 130 }}>Vencimiento<input type="date" value={f.due_date} onChange={(e) => set('due_date', e.target.value)} className="xp-sunken" style={inp} /></label>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ ...lbl, flex: 1 }}>Entidad<select value={f.entity_name} onChange={(e) => set('entity_name', e.target.value)} className="xp-sunken" style={inp}><option value="">— Ninguna —</option>{entities.map((e) => <option key={e.id} value={e.name}>{e.name}</option>)}</select></label>
            <label style={{ ...lbl, width: 78 }}>Prioridad<input type="number" min={0} max={100} value={f.priority_score} onChange={(e) => set('priority_score', e.target.value)} className="xp-sunken" style={inp} placeholder="0–100" /></label>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ ...lbl, width: 110 }}>Clave<input value={f.key} onChange={(e) => set('key', e.target.value)} className="xp-sunken" style={{ ...inp, fontFamily: 'monospace' }} placeholder="CRM-01" /></label>
            <label style={{ ...lbl, flex: 1 }}>Etiquetas<input value={f.tags} onChange={(e) => set('tags', e.target.value)} className="xp-sunken" style={inp} placeholder="coma, separadas" /></label>
          </div>
          <label style={lbl}>Notas<textarea value={f.description} onChange={(e) => set('description', e.target.value)} rows={2} className="xp-sunken" style={{ ...inp, resize: 'none' }} /></label>
        </div>
        <div style={{ padding: '7px 11px', borderTop: '1px solid #c9c6ba', background: '#f3f1e6', display: 'flex', gap: 7, alignItems: 'center' }}>
          {editing && onDelete && <button onClick={onDelete} disabled={busy} className="xp-raised" style={{ ...btn, color: '#a02015' }}>Eliminar</button>}
          <span style={{ flex: 1 }} />
          <button onClick={onClose} className="xp-raised" style={btn}>Cancelar</button>
          <button onClick={save} disabled={busy || !f.title.trim()} className="xp-raised" style={btn}>{busy ? '…' : editing ? 'Aceptar' : 'Crear'}</button>
        </div>
      </div>
    </div>
  )
}
const lbl: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10.5, color: '#3a4a64' }
const inp: React.CSSProperties = { padding: '3px 5px', fontFamily: 'inherit', fontSize: 11, outline: 'none' }
const btn: React.CSSProperties = { padding: '3px 14px', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer' }
