'use client'

import { useEffect, useRef, useState } from 'react'

// Ventana de conversación MSN (canon MSN 6/7: cada chat es su propia ventana del WM). Inc.2 cablea
// SOLO al buddy "Cerebro" = Consultar (RAG streaming vía /api/ask, con fuentes). Los demás buddies
// (Lolo, Diario, personas) abren la ventana con un placeholder — se cablean en inc.3.

export type ChatKind = 'cerebro' | 'lolo' | 'diario' | 'person'
export interface ChatBuddy {
  id: string
  name: string
  kind: ChatKind
  avatar: { img?: string; initials?: string; bg?: string }
}

interface Source { id: string; content: string }
interface Msg { id: number; from: 'me' | 'them'; name: string; text: string; sources?: Source[]; streaming?: boolean }

let _mid = 0
const nextId = () => ++_mid

export default function MsnChat({ buddy }: { buddy: ChatBuddy }) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const wired = buddy.kind === 'cerebro'

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [msgs])

  useEffect(() => () => abortRef.current?.abort(), [])

  async function send() {
    const t = input.trim()
    if (!t || busy || !wired) return
    setInput('')
    setMsgs((m) => [...m, { id: nextId(), from: 'me', name: 'Alex', text: t }])
    await askCerebro(t)
  }

  async function askCerebro(q: string) {
    setBusy(true)
    const replyId = nextId()
    setMsgs((m) => [...m, { id: replyId, from: 'them', name: 'Cerebro', text: '', streaming: true }])
    abortRef.current?.abort()
    const ctrl = new AbortController(); abortRef.current = ctrl
    try {
      const r = await fetch('/api/ask', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: q }), signal: ctrl.signal,
      })
      if (!r.ok || !r.body) throw new Error(await r.text().catch(() => 'error'))
      const reader = r.body.getReader(); const decoder = new TextDecoder(); let buffer = ''
      const patch = (fn: (m: Msg) => Msg) => setMsgs((all) => all.map((m) => (m.id === replyId ? fn(m) : m)))
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
            if (ev.type === 'sources') patch((m) => ({ ...m, sources: ev.sources ?? [] }))
            else if (ev.type === 'text') patch((m) => ({ ...m, text: m.text + (ev.text ?? '') }))
            else if (ev.type === 'error') patch((m) => ({ ...m, text: m.text || `⚠ ${ev.message ?? 'Error'}` }))
          } catch { /* skip */ }
        }
      }
      patch((m) => ({ ...m, streaming: false, text: m.text || '(sin respuesta)' }))
    } catch (e) {
      if ((e as Error).name !== 'AbortError') patch2(replyId, `⚠ ${String(e)}`)
    } finally {
      setBusy(false)
    }
    function patch2(id: number, text: string) { setMsgs((all) => all.map((m) => (m.id === id ? { ...m, text, streaming: false } : m))) }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff', fontFamily: 'inherit', fontSize: 11, color: '#000' }}>
      {/* Cabecera del contacto */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'linear-gradient(180deg,#eaf3fd,#cfe0f5)', borderBottom: '1px solid #9db8dd' }}>
        <Avatar {...buddy.avatar} size={28} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1c4a86' }}>{buddy.name}</div>
          <div style={{ fontSize: 10.5, color: '#2f9a22' }}>En línea</div>
        </div>
      </div>

      {/* Historial */}
      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 10px', background: '#fff' }}>
        {!wired ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#8a867a', textAlign: 'center' }}>
            <Avatar {...buddy.avatar} size={40} />
            <div style={{ fontSize: 12 }}>Esta conversación llega pronto 🚧</div>
            <div style={{ fontSize: 10.5 }}>{buddy.name} podrá chatear en la siguiente entrega.</div>
          </div>
        ) : msgs.length === 0 ? (
          <div style={{ color: '#8a867a', fontStyle: 'italic', fontSize: 11 }}>
            Pregúntale a tu segundo cerebro lo que sea — busca en tu memoria y te responde.
          </div>
        ) : (
          msgs.map((m) => (
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

      {/* Barra de entrada */}
      <div style={{ flexShrink: 0, borderTop: '1px solid #c9c6ba', background: '#ece9d8', padding: 6 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
          <textarea
            value={input}
            disabled={!wired}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder={wired ? 'Escribe un mensaje…' : 'No disponible aún'}
            rows={2}
            className="xp-sunken"
            style={{ flex: 1, resize: 'none', padding: '4px 6px', fontFamily: 'inherit', fontSize: 11, outline: 'none' }}
          />
          <button
            className="xp-raised" onClick={send} disabled={!wired || busy || !input.trim()}
            style={{ padding: '5px 16px', fontSize: 11, fontFamily: 'inherit', cursor: wired && !busy && input.trim() ? 'pointer' : 'default', alignSelf: 'stretch' }}
          >
            {busy ? '…' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Avatar({ img, initials, bg, size = 20 }: { img?: string; initials?: string; bg?: string; size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex', width: size, height: size, flexShrink: 0, alignItems: 'center', justifyContent: 'center',
        borderRadius: 2, background: bg ?? '#8aa0c0', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.35)',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.4)', color: '#fff', fontSize: size * 0.5, fontWeight: 700,
      }}
    >
      {img ? <img src={img} alt="" width={size} height={size} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
    </span>
  )
}
