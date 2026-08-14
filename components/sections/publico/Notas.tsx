'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardHead, inputCell as cell } from './ui'

// Notas operativas de Público: lista simple (título + cuerpo), ordenable, borrado reversible. Datos del negocio
// que no viven en ninguna otra parte: RFC, cuentas, contacto del gas, códigos, claves de proveedores.
// Se guardan en TEXTO PLANO — se avisa explícito. Sin categorías ni etiquetas (a propósito, por ahora).
type Nota = { id: string; titulo: string; cuerpo: string; sort_order: number }

export function Notas({ tone }: { tone?: string }) {
  const [notas, setNotas] = useState<Nota[]>([])
  const [nt, setNt] = useState(''); const [nc, setNc] = useState('')       // alta: título / cuerpo
  const [editId, setEditId] = useState<string | null>(null)
  const [et, setEt] = useState(''); const [ec, setEc] = useState('')        // edición
  const [undo, setUndo] = useState<string | null>(null)                     // id de la última borrada (deshacer)
  const [flash, setFlash] = useState<string | null>(null)

  const load = useCallback(async () => {
    const j = await fetch('/api/publico/notas').then((r) => r.json()).catch(() => null)
    if (j?.notas) setNotas(j.notas as Nota[])
  }, [])
  useEffect(() => { void load() }, [load])

  async function add() {
    if (!nt.trim() && !nc.trim()) return
    await fetch('/api/publico/notas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ titulo: nt, cuerpo: nc }) })
    setNt(''); setNc(''); await load()
  }
  async function saveEdit() {
    if (!editId) return
    await fetch('/api/publico/notas', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: editId, titulo: et, cuerpo: ec }) })
    setEditId(null); await load()
  }
  async function del(id: string) {
    await fetch(`/api/publico/notas?id=${id}`, { method: 'DELETE' })   // soft-delete
    setUndo(id); setFlash('nota borrada'); setTimeout(() => { setUndo((u) => (u === id ? null : u)); setFlash((f) => (f === 'nota borrada' ? null : f)) }, 8000)
    await load()
  }
  async function deshacer() {
    if (!undo) return
    await fetch('/api/publico/notas', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: undo, archived: false }) })
    setUndo(null); setFlash(null); await load()
  }
  async function move(i: number, dir: -1 | 1) {
    const j = i + dir; if (j < 0 || j >= notas.length) return
    const next = [...notas];[next[i], next[j]] = [next[j], next[i]]
    setNotas(next)   // optimista
    await fetch('/api/publico/notas', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ order: next.map((n) => n.id) }) })
  }

  return (
    <Card className="text-secondary">
      <CardHead tone={tone}>Notas <span className="font-normal normal-case tracking-normal">— datos operativos (RFC, cuentas, contacto del gas, códigos, claves)</span></CardHead>
      <div className="mb-2 rounded-card border p-2 text-label text-warn" style={{ borderColor: 'var(--color-warn, #b45309)55', background: 'color-mix(in srgb, var(--color-warn, #b45309) 8%, transparent)' }}>⚠ Se guardan en <b>texto plano</b>. Decide qué metes aquí sabiéndolo.</div>

      {/* Alta */}
      <Card pad="sm" className="space-y-1">
        <input value={nt} onChange={(e) => setNt(e.target.value)} placeholder="Título (ej. RFC · Cuenta BBVA · Gas)" style={{ ...cell, width: '100%' }} />
        <textarea value={nc} onChange={(e) => setNc(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void add() }} placeholder="Contenido…" rows={2} style={{ ...cell, width: '100%', resize: 'vertical', fontFamily: 'inherit' }} />
        <div className="flex justify-end"><button onClick={() => void add()} className="rounded-card border border-border px-3 py-1 font-medium">Agregar nota</button></div>
      </Card>

      {flash && (
        <div className="mt-2 flex items-center justify-between rounded-card border border-border bg-surface-active p-1.5 text-label text-fg-muted">
          <span>{flash}</span>
          {undo && <button onClick={() => void deshacer()} className="font-medium text-accent hover:underline">deshacer</button>}
        </div>
      )}

      {/* Lista */}
      <div className="mt-2 space-y-1.5">
        {notas.length === 0 && <div className="italic text-fg-muted">Sin notas aún.</div>}
        {notas.map((n, i) => (
          <Card key={n.id} pad="sm" className="group">
            {editId === n.id ? (
              <div className="space-y-1">
                <input value={et} onChange={(e) => setEt(e.target.value)} placeholder="Título" style={{ ...cell, width: '100%' }} autoFocus />
                <textarea value={ec} onChange={(e) => setEc(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void saveEdit() }} rows={2} style={{ ...cell, width: '100%', resize: 'vertical', fontFamily: 'inherit' }} />
                <div className="flex justify-end gap-2 text-label">
                  <button onClick={() => setEditId(null)} className="text-fg-muted hover:text-accent">cancelar</button>
                  <button onClick={() => void saveEdit()} className="rounded-control border border-border px-2 py-0.5 font-medium">guardar</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <b className="min-w-0 truncate text-fg">{n.titulo || <span className="font-normal italic text-fg-muted">(sin título)</span>}</b>
                  <div className="flex shrink-0 gap-1.5 text-label opacity-0 transition-opacity group-hover:opacity-100">
                    <button onClick={() => void move(i, -1)} disabled={i === 0} className="text-fg-muted hover:text-accent disabled:opacity-20" title="subir">↑</button>
                    <button onClick={() => void move(i, +1)} disabled={i === notas.length - 1} className="text-fg-muted hover:text-accent disabled:opacity-20" title="bajar">↓</button>
                    <button onClick={() => { setEditId(n.id); setEt(n.titulo); setEc(n.cuerpo) }} className="text-fg-muted hover:text-accent">editar</button>
                    <button onClick={() => void del(n.id)} className="text-fg-muted hover:text-danger">borrar</button>
                  </div>
                </div>
                {n.cuerpo && <div className="mt-0.5 whitespace-pre-wrap text-fg-muted">{n.cuerpo}</div>}
              </>
            )}
          </Card>
        ))}
      </div>
    </Card>
  )
}
