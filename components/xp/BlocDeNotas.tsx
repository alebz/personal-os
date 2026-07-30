'use client'

import { useEffect, useState } from 'react'

// Bloc de notas — el hogar de las notas del OS (tabla `notes`, /api/notes), como app XP propia. Estética
// Notepad: lista de notas a la izquierda + editor monospace a la derecha. CRUD completo; preserva los
// tags al guardar (p.ej. las notas ligadas a un contacto desde MSN-Cerebro conservan su `contacto:<id>`).

interface Note { id: string; title: string; content: string | null; tags?: string[]; updated_at?: string; created_at?: string }

const MONO = "'Lucida Console', 'Consolas', 'Courier New', monospace"

function fmtDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function BlocDeNotas() {
  const [notes, setNotes] = useState<Note[]>([])
  const [selId, setSelId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)

  function load() {
    return fetch('/api/notes')
      .then((r) => r.json())
      .then((d: Note[]) => { if (Array.isArray(d)) setNotes(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const sel = notes.find((n) => n.id === selId) ?? null

  function open(n: Note) {
    if (dirty && !confirm('Hay cambios sin guardar. ¿Descartarlos?')) return
    setSelId(n.id); setTitle(n.title); setContent(n.content ?? ''); setDirty(false)
  }
  function nueva() {
    if (dirty && !confirm('Hay cambios sin guardar. ¿Descartarlos?')) return
    setSelId(null); setTitle(''); setContent(''); setDirty(false)
  }

  async function guardar() {
    if (busy || (!title.trim() && !content.trim())) return
    setBusy(true)
    try {
      const t = (title.trim() || content.trim().split('\n')[0] || 'Nota').slice(0, 80)
      if (selId) {
        await fetch(`/api/notes/${selId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: t, content, tags: sel?.tags ?? [] }) })
        setTitle(t); setDirty(false); await load()
      } else {
        const r = await fetch('/api/notes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: t, content, tags: [] }) })
        const created = await r.json().catch(() => null)
        setDirty(false)
        await load()
        if (created?.id) { setSelId(created.id); setTitle(t) }
      }
    } finally { setBusy(false) }
  }

  async function eliminar() {
    if (!selId || busy) return
    if (!confirm(`¿Eliminar la nota "${title || 'sin título'}"?`)) return
    setBusy(true)
    try {
      await fetch(`/api/notes/${selId}`, { method: 'DELETE' })
      setSelId(null); setTitle(''); setContent(''); setDirty(false)
      await load()
    } finally { setBusy(false) }
  }

  const btn: React.CSSProperties = { padding: '3px 12px', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer' }

  return (
    <div className="xp-dialog" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Menú (Notepad, decorativo) */}
      <div style={{ display: 'flex', gap: 13, padding: '2px 9px', background: '#f7f9fc', borderBottom: '1px solid #cdd6e2', fontSize: 11, color: '#333' }}>
        {['Archivo', 'Edición', 'Formato', 'Ver', 'Ayuda'].map((m) => <span key={m}>{m}</span>)}
      </div>

      {/* Toolbar */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: 6, background: '#ece9d8', borderBottom: '1px solid #c9c6ba' }}>
        <button className="xp-raised" style={btn} onClick={nueva}>Nueva nota</button>
        <button className="xp-raised" style={{ ...btn, opacity: !title.trim() && !content.trim() ? 0.5 : 1 }} onClick={guardar} disabled={busy || (!title.trim() && !content.trim())}>{busy ? 'Guardando…' : dirty ? 'Guardar *' : 'Guardar'}</button>
        <button className="xp-raised" style={{ ...btn, marginLeft: 'auto', color: selId ? '#a0201a' : '#999' }} onClick={eliminar} disabled={!selId || busy}>Eliminar</button>
      </div>

      {/* Cuerpo: lista + editor */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {/* Lista de notas */}
        <div className="xp-sunken" style={{ width: 186, flexShrink: 0, overflowY: 'auto', background: '#fff', margin: 6, marginRight: 0 }}>
          {loading ? (
            <div style={{ padding: 8, color: '#8a867a', fontStyle: 'italic', fontSize: 11 }}>Cargando…</div>
          ) : notes.length === 0 ? (
            <div style={{ padding: 8, color: '#8a867a', fontStyle: 'italic', fontSize: 11 }}>Sin notas. Crea la primera con «Nueva nota».</div>
          ) : notes.map((n) => {
            const on = n.id === selId
            return (
              <button key={n.id} onClick={() => open(n)}
                style={{ display: 'block', width: '100%', textAlign: 'left', border: 0, borderBottom: '1px solid #eee', padding: '4px 7px', cursor: 'pointer', background: on ? '#3163c8' : 'transparent', color: on ? '#fff' : '#000' }}>
                <div style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title || '(sin título)'}</div>
                <div style={{ fontSize: 10, color: on ? '#dbe8fb' : '#8a867a' }}>{fmtDate(n.updated_at || n.created_at)}</div>
              </button>
            )
          })}
        </div>

        {/* Editor */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: 6, gap: 6 }}>
          <input
            className="xp-sunken" value={title} placeholder="Título de la nota"
            onChange={(e) => { setTitle(e.target.value); setDirty(true) }}
            style={{ height: 22, padding: '0 6px', fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit', outline: 'none' }}
          />
          <textarea
            className="xp-sunken" value={content} placeholder="Escribe aquí…"
            onChange={(e) => { setContent(e.target.value); setDirty(true) }}
            style={{ flex: 1, resize: 'none', padding: '6px 8px', fontSize: 12, lineHeight: 1.5, outline: 'none', background: '#fff', ...( { '--os-font': MONO } as React.CSSProperties) }}
          />
        </div>
      </div>
    </div>
  )
}
