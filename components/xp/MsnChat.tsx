'use client'

import { useEffect, useRef, useState } from 'react'
import { useAvatar, changeAvatar } from '@/lib/msnAvatars'
import { MOODS } from '@/components/sections/DiarioContent'

// Ventana de conversación MSN (canon MSN 6/7: cada chat es su propia ventana del WM). Cablea los 4
// tipos de buddy (regla "no resta funcionalidad" — cada función de Cerebro tiene su puerta aquí):
//  · Cerebro → Consultar (RAG streaming vía /api/ask SSE + fuentes).
//  · Diario (tú) → journal (POST /api/journal) con mood.
//  · Persona → notas ligadas por tag `contacto:<id>` (POST /api/notes) + historial (GET /api/notes).
//  · Lolo → su chat (POST /api/companion/chat).

export type ChatKind = 'cerebro' | 'lolo' | 'diario' | 'person'
export interface ChatBuddy {
  id: string
  name: string
  kind: ChatKind
  avatar: { img?: string; initials?: string; bg?: string }
  birthday?: string | null
  category?: string
}

const MONTHS_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function bdayLabel(b: string | null | undefined): string | null {
  const mm = b ? /^(\d{4})-(\d{2})-(\d{2})/.exec(b) : null
  return mm ? `${+mm[3]} ${MONTHS_ABBR[+mm[2] - 1]}` : null
}
function localDateISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const LOLO_SYSTEM = 'Eres Lolo, el compañero del sistema operativo personal de Alex (como un Clippy con alma). Cálido, breve, con humor ligero y cariño. Estás de visita desde el arcade, chateando en el Messenger. Responde SIEMPRE en español, 1–3 frases, sin markdown.'

interface Source { id: string; content: string }
interface Msg { id: number; from: 'me' | 'them' | 'sys'; name: string; text: string; sources?: Source[]; streaming?: boolean }
interface NoteRow { id: string; title: string; content: string | null; tags?: string[]; created_at?: string }

let _mid = 0
const nextId = () => ++_mid

export default function MsnChat({ buddy }: { buddy: ChatBuddy }) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [mood, setMood] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const bd = bdayLabel(buddy.birthday)

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }) }, [msgs])
  useEffect(() => () => abortRef.current?.abort(), [])

  // Historial de una persona = sus notas previas (tag contacto:<id>), más viejas primero.
  useEffect(() => {
    if (buddy.kind !== 'person') return
    let live = true
    fetch('/api/notes')
      .then((r) => r.json())
      .then((all: NoteRow[]) => {
        if (!live || !Array.isArray(all)) return
        const tag = `contacto:${buddy.id}`
        const mine = all.filter((n) => Array.isArray(n.tags) && n.tags.includes(tag)).reverse()
        if (mine.length) setMsgs(mine.map((n) => ({ id: nextId(), from: 'me' as const, name: 'Alex', text: n.content || n.title })))
      })
      .catch(() => {})
    return () => { live = false }
  }, [buddy.id, buddy.kind])

  const pushMe = (text: string) => setMsgs((m) => [...m, { id: nextId(), from: 'me', name: 'Alex', text }])
  const pushSys = (text: string) => setMsgs((m) => [...m, { id: nextId(), from: 'sys', name: '', text }])
  const patchMsg = (id: number, fn: (m: Msg) => Msg) => setMsgs((all) => all.map((m) => (m.id === id ? fn(m) : m)))

  async function send() {
    const t = input.trim()
    if (!t || busy) return
    setInput('')
    pushMe(t)
    if (buddy.kind === 'cerebro') await askCerebro(t)
    else if (buddy.kind === 'lolo') await askLolo(t)
    else if (buddy.kind === 'diario') await saveDiario(t)
    else await saveNote(t)
  }

  async function askCerebro(q: string) {
    setBusy(true)
    const replyId = nextId()
    setMsgs((m) => [...m, { id: replyId, from: 'them', name: 'Cerebro', text: '', streaming: true }])
    abortRef.current?.abort()
    const ctrl = new AbortController(); abortRef.current = ctrl
    try {
      const r = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: q }), signal: ctrl.signal })
      if (!r.ok || !r.body) throw new Error(await r.text().catch(() => 'error'))
      const reader = r.body.getReader(); const decoder = new TextDecoder(); let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n'); buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') continue
          try {
            const ev = JSON.parse(raw) as { type: string; text?: string; sources?: Source[]; message?: string }
            if (ev.type === 'sources') patchMsg(replyId, (m) => ({ ...m, sources: ev.sources ?? [] }))
            else if (ev.type === 'text') patchMsg(replyId, (m) => ({ ...m, text: m.text + (ev.text ?? '') }))
            else if (ev.type === 'error') patchMsg(replyId, (m) => ({ ...m, text: m.text || `⚠ ${ev.message ?? 'Error'}` }))
          } catch { /* skip */ }
        }
      }
      patchMsg(replyId, (m) => ({ ...m, streaming: false, text: m.text || '(sin respuesta)' }))
    } catch (e) {
      if ((e as Error).name !== 'AbortError') patchMsg(replyId, (m) => ({ ...m, text: `⚠ ${String(e)}`, streaming: false }))
    } finally { setBusy(false) }
  }

  async function askLolo(t: string) {
    setBusy(true)
    const replyId = nextId()
    setMsgs((m) => [...m, { id: replyId, from: 'them', name: 'Lolo', text: '', streaming: true }])
    try {
      const history = msgs.filter((m) => m.from !== 'sys').map((m) => ({ role: m.from === 'me' ? 'user' : 'assistant', content: m.text }))
      const r = await fetch('/api/companion/chat', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ system: LOLO_SYSTEM, messages: [...history, { role: 'user', content: t }] }),
      })
      const d = await r.json().catch(() => ({}))
      patchMsg(replyId, (m) => ({ ...m, streaming: false, text: (d.text as string) || '…' }))
    } catch (e) {
      patchMsg(replyId, (m) => ({ ...m, streaming: false, text: `⚠ ${String(e)}` }))
    } finally { setBusy(false) }
  }

  async function saveDiario(t: string) {
    setBusy(true)
    try {
      const r = await fetch('/api/journal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entry_date: localDateISO(), content: t, mood: mood || null }) })
      pushSys(r.ok ? 'Guardado en tu diario ✓' : '⚠ No se pudo guardar')
      setMood('')
    } catch { pushSys('⚠ No se pudo guardar') } finally { setBusy(false) }
  }

  async function saveNote(t: string) {
    setBusy(true)
    try {
      const title = (t.split('\n')[0] || t).slice(0, 80).trim() || `Nota sobre ${buddy.name}`
      const r = await fetch('/api/notes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title, content: t, tags: [`contacto:${buddy.id}`, buddy.name] }) })
      pushSys(r.ok ? `Anotado sobre ${buddy.name} ✓` : '⚠ No se pudo anotar')
    } catch { pushSys('⚠ No se pudo anotar') } finally { setBusy(false) }
  }

  const emptyHint: Record<ChatKind, string> = {
    cerebro: 'Pregúntale a tu segundo cerebro lo que sea — busca en tu memoria y te responde.',
    lolo: 'Salúdalo 👋 — Lolo está de visita desde el arcade.',
    diario: 'Escribe cómo va tu día. Se guarda en tu diario (con el ánimo que elijas).',
    person: `Anota lo que quieras recordar de ${buddy.name}. Tus notas quedan ligadas a él/ella.`,
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff', fontFamily: 'inherit', fontSize: 11, color: '#000' }}>
      {/* Cabecera del contacto — foto (click = cambiar), nombre, presencia y CUMPLEAÑOS siempre visible */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', background: 'linear-gradient(180deg,#eaf3fd,#cfe0f5)', borderBottom: '1px solid #9db8dd' }}>
        <Avatar id={buddy.id} {...buddy.avatar} size={38} onPick={() => changeAvatar(buddy.id)} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1c4a86' }}>{buddy.name}</div>
          <div style={{ fontSize: 10.5, color: '#2f9a22' }}>En línea</div>
          {bd && <div style={{ fontSize: 10.5, color: '#9a6b1a' }}>🎂 Cumpleaños: {bd}</div>}
        </div>
      </div>

      {/* Historial */}
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 10px', background: '#fff' }}>
        {msgs.length === 0 ? (
          <div style={{ color: '#8a867a', fontStyle: 'italic', fontSize: 11 }}>{emptyHint[buddy.kind]}</div>
        ) : (
          msgs.map((m) => m.from === 'sys' ? (
            <div key={m.id} style={{ textAlign: 'center', color: '#8a867a', fontSize: 10.5, margin: '6px 0' }}>{m.text}</div>
          ) : (
            <div key={m.id} style={{ marginBottom: 8 }}>
              <span style={{ fontWeight: 700, color: m.from === 'me' ? '#c0271c' : '#1c4a86' }}>{m.name} dice:</span>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.45, marginTop: 1 }}>
                {m.text}
                {m.streaming && !m.text && <span style={{ fontStyle: 'italic', color: '#8a867a' }}>escribiendo un mensaje…</span>}
              </div>
              {m.sources && m.sources.length > 0 && (
                <div style={{ marginTop: 4, paddingLeft: 8, borderLeft: '2px solid #d5e0ef', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {m.sources.slice(0, 6).map((s) => (
                    <div key={s.id} style={{ fontSize: 10, color: '#5b6b7f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      📎 {s.content.replace(/\s+/g, ' ').slice(0, 90)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Selector de ánimo (solo Diario) */}
      {buddy.kind === 'diario' && (
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: '#f4f7fb', borderTop: '1px solid #dbe1ea', fontSize: 11 }}>
          <span style={{ color: '#6a6a6a', marginRight: 2 }}>Ánimo:</span>
          {MOODS.map((mo) => (
            <button key={mo.value} onClick={() => setMood((v) => (v === mo.value ? '' : mo.value))} title={mo.label}
              style={{ border: mood === mo.value ? '1px solid #3163c8' : '1px solid transparent', background: mood === mo.value ? '#dbe8fb' : 'transparent', borderRadius: 3, cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: '1px 3px' }}>
              {mo.emoji}
            </button>
          ))}
        </div>
      )}

      {/* Barra de entrada */}
      <div style={{ flexShrink: 0, borderTop: '1px solid #c9c6ba', background: '#ece9d8', padding: 6 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Escribe un mensaje…"
            rows={2}
            className="xp-sunken"
            style={{ flex: 1, resize: 'none', padding: '4px 6px', fontFamily: 'inherit', fontSize: 11, outline: 'none' }}
          />
          <button
            className="xp-raised" onClick={send} disabled={busy || !input.trim()}
            style={{ padding: '5px 16px', fontSize: 11, fontFamily: 'inherit', cursor: !busy && input.trim() ? 'pointer' : 'default', alignSelf: 'stretch' }}
          >
            {busy ? '…' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Avatar({ id, img, initials, bg, size = 20, onPick }: { id?: string; img?: string; initials?: string; bg?: string; size?: number; onPick?: () => void }) {
  const stored = useAvatar(id ?? '')
  const src = stored || img
  return (
    <span
      onClick={onPick ? (e) => { e.stopPropagation(); onPick() } : undefined}
      title={onPick ? 'Cambiar foto…' : undefined}
      style={{
        display: 'inline-flex', width: size, height: size, flexShrink: 0, alignItems: 'center', justifyContent: 'center',
        borderRadius: 2, background: bg ?? '#8aa0c0', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.35)',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.4)', color: '#fff', fontSize: size * 0.5, fontWeight: 700,
        cursor: onPick ? 'pointer' : 'default',
      }}
    >
      {src ? <img src={src} alt="" width={size} height={size} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
    </span>
  )
}
