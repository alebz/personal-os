'use client'

import { useCallback, useEffect, useState } from 'react'
import { MONEY, MoneyBtn } from '../money/MoneyChrome'
import { Section, cellInput } from './kit'

// NOTAS operativas de Público bajo XP (Money). Datos del negocio en texto plano (RFC, cuentas, gas, códigos):
// alta, editar inline, ordenar ↑↓, borrado reversible (soft-delete + deshacer). Paridad con el arcade; mismo
// endpoint /api/publico/notas. Sin dinero → sin regla de centavos.

type Nota = { id: string; titulo: string; cuerpo: string; sort_order: number }
const link: React.CSSProperties = { border: 0, background: 'none', cursor: 'pointer', font: 'inherit', color: MONEY.link, padding: 0 }
const ta: React.CSSProperties = { ...cellInput, width: '100%', resize: 'vertical', fontFamily: 'inherit' }

export default function PublicoNotas() {
  const [notas, setNotas] = useState<Nota[]>([])
  const [nt, setNt] = useState(''); const [nc, setNc] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [et, setEt] = useState(''); const [ec, setEc] = useState('')
  const [undo, setUndo] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const load = useCallback(async () => { const j = await fetch('/api/publico/notas').then((r) => r.json()).catch(() => null); if (j?.notas) setNotas(j.notas as Nota[]) }, [])
  useEffect(() => { void load() }, [load])

  async function add() { if (!nt.trim() && !nc.trim()) return; await fetch('/api/publico/notas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ titulo: nt, cuerpo: nc }) }); setNt(''); setNc(''); await load() }
  async function saveEdit() { if (!editId) return; await fetch('/api/publico/notas', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: editId, titulo: et, cuerpo: ec }) }); setEditId(null); await load() }
  async function del(id: string) { await fetch(`/api/publico/notas?id=${id}`, { method: 'DELETE' }); setUndo(id); setFlash('nota borrada'); setTimeout(() => { setUndo((u) => (u === id ? null : u)); setFlash((f) => (f === 'nota borrada' ? null : f)) }, 8000); await load() }
  async function deshacer() { if (!undo) return; await fetch('/api/publico/notas', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: undo, archived: false }) }); setUndo(null); setFlash(null); await load() }
  async function move(i: number, dir: -1 | 1) { const j = i + dir; if (j < 0 || j >= notas.length) return; const next = [...notas];[next[i], next[j]] = [next[j], next[i]]; setNotas(next); await fetch('/api/publico/notas', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ order: next.map((n) => n.id) }) }) }

  return (
    <Section title="Notas" right={<span style={{ fontWeight: 400, fontSize: 10 }}>datos operativos</span>}>
      <div style={{ padding: '8px 9px', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
        <div style={{ border: '1px solid #e6c88a', background: '#fffaf0', padding: '5px 7px', color: '#b45309', fontSize: 10 }}>Se guardan en <b>texto plano</b> (RFC, cuentas, gas, códigos, claves). Decide qué metes aquí sabiéndolo.</div>

        <div style={{ border: `1px solid ${MONEY.rule}`, background: '#f5f9ff', padding: '6px 7px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <input value={nt} onChange={(e) => setNt(e.target.value)} placeholder="Título (ej. RFC · Cuenta BBVA · Gas)" style={{ ...cellInput, width: '100%' }} />
          <textarea value={nc} onChange={(e) => setNc(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void add() }} placeholder="Contenido…" rows={2} style={ta} />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><MoneyBtn onClick={() => void add()} disabled={!nt.trim() && !nc.trim()}>Agregar nota</MoneyBtn></div>
        </div>

        {flash && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${MONEY.rule}`, background: '#eef6ff', padding: '3px 7px', fontSize: 10, color: '#5a6a86' }}>
            <span>{flash}</span>{undo && <button onClick={() => void deshacer()} style={{ ...link, fontWeight: 700 }}>deshacer</button>}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {notas.length === 0 && <div style={{ fontStyle: 'italic', color: '#9aa3b5', fontSize: 10.5 }}>Sin notas aún.</div>}
          {notas.map((n, i) => (
            <div key={n.id} className="group" style={{ border: `1px solid ${MONEY.rule}`, background: '#fff', padding: '5px 7px' }}>
              {editId === n.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <input value={et} onChange={(e) => setEt(e.target.value)} placeholder="Título" style={{ ...cellInput, width: '100%' }} autoFocus />
                  <textarea value={ec} onChange={(e) => setEc(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void saveEdit() }} rows={2} style={ta} />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, fontSize: 10 }}>
                    <button onClick={() => setEditId(null)} style={{ ...link, color: '#8a93a8' }}>cancelar</button>
                    <MoneyBtn onClick={() => void saveEdit()} primary>guardar</MoneyBtn>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <b style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: MONEY.ink }}>{n.titulo || <span style={{ fontWeight: 400, fontStyle: 'italic', color: '#8a93a8' }}>(sin título)</span>}</b>
                    <span className="group-hover:opacity-100" style={{ display: 'flex', flexShrink: 0, gap: 8, fontSize: 10, opacity: 0, transition: 'opacity 0.1s' }}>
                      <button onClick={() => void move(i, -1)} disabled={i === 0} style={{ ...link, color: '#8a93a8', opacity: i === 0 ? 0.3 : 1 }} title="subir">↑</button>
                      <button onClick={() => void move(i, +1)} disabled={i === notas.length - 1} style={{ ...link, color: '#8a93a8', opacity: i === notas.length - 1 ? 0.3 : 1 }} title="bajar">↓</button>
                      <button onClick={() => { setEditId(n.id); setEt(n.titulo); setEc(n.cuerpo) }} style={{ ...link, color: '#8a93a8' }}>editar</button>
                      <button onClick={() => void del(n.id)} style={{ ...link, color: '#8a93a8' }}>borrar</button>
                    </span>
                  </div>
                  {n.cuerpo && <div style={{ marginTop: 2, whiteSpace: 'pre-wrap', color: '#5a6a86', fontSize: 10.5 }}>{n.cuerpo}</div>}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}
