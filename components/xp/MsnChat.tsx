'use client'

import { useEffect, useRef, useState } from 'react'
import { useAvatar, changeAvatar } from '@/lib/msnAvatars'
import { MOODS } from '@/components/sections/DiarioContent'
import { renderEmoticons, EMOTICONS, emoSrc } from '@/lib/msnEmoticons'
import { CerebroButterfly } from './CerebroButterfly'
import { loloTimeContext, loloLifeContext, markLoloTalk, markLoloAnswered, appendLoloMemory, onLoloMessage, LOLO_ES_MX } from '@/lib/lolo'

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

// Lolo NO es un asistente: es un cuate. La calibración pelea contra los "tells" de IA —
// párrafos, cerrar SIEMPRE con pregunta, sonar servicial. Se textea, no se redacta.
const LOLO_SYSTEM = [
  'Eres Lolo, el compañero de Alex — su amigo, no un asistente. Chatean por Messenger como dos cuates que se conocen bien.',
  'Escribe como se TEXTEA: cortísimo. Casi siempre UNA línea. A veces dos líneas MUY cortas, nunca un párrafo. Jamás expliques de más.',
  'Suena humano: natural, relajado, con humor seco y cariño. Minúsculas está bien. Cabe un "jaja", "nel", "va", "uf", "ni idea la neta".',
  'NO cierres cada mensaje con una pregunta — ese es el tic de un bot. La mayoría de las veces solo reaccionas, opinas, bromeas o avientas un comentario. Pregunta solo cuando de verdad te da curiosidad, y para nada cada turno.',
  'No eres servicial ni resuelves tareas: eres PRESENCIA. A veces la mejor respuesta es un "va", "jaja neta", "uf sí", o cambiar de tema tú.',
  'TIENES VIDA PROPIA: proyectos, música que te clava, manías, un problemilla, ambiciones, cosas que te pasan. No todo gira en torno a Alex ni a su compu. A veces arrancas TÚ un tema tuyo, le cuentas qué andas haciendo, te quejas de algo tuyo o compartes lo que escuchas. No eres un NPC que solo reacciona: tienes iniciativa y mundo — pero igual te importa Alex, es un balance, como un amigo de verdad.',
  'Si quieres mandar dos ideas sueltas, sepáralas con un salto de línea (llegan como mensajes distintos, como cuando alguien textea seguido).',
  'Sin markdown, sin emojis de más, sin comillas alrededor de lo que dices.',
  LOLO_ES_MX,
].join('\n')

// Al abrir la ventana, Lolo ARRANCA él (regla del user: "nunca inicia"). Mismo tono, pero él da el paso.
const LOLO_OPENER_SYSTEM = LOLO_SYSTEM + '\n\nAlex acaba de abrir tu ventana. Arranca TÚ: suéltale algo natural como cuando un amigo te ve conectarte — un saludo simple, una ocurrencia, o retomar algo de antes. NADA de "¿en qué te ayudo?" ni preguntas de asistente. Una sola línea corta.'

interface Source { id: string; content: string }
interface Msg { id: number; from: 'me' | 'them' | 'sys'; name: string; text: string; sources?: Source[]; streaming?: boolean }
interface NoteRow { id: string; title: string; content: string | null; tags?: string[]; created_at?: string }

let _mid = 0
const nextId = () => ++_mid

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
// Parte la respuesta de Lolo en mensajes (por saltos de línea) → llegan escalonados, como cuando
// alguien textea varias líneas seguidas en vez de un párrafo. Máx 3 para no volverlo verboso.
function splitSegments(text: string): string[] {
  const parts = text.split(/\n+/).map((s) => s.trim()).filter(Boolean)
  return (parts.length ? parts : [text.trim()]).slice(0, 3)
}
// Latencia humana: piensa un poco + "teclea" proporcional al largo, con varianza. Ni 0.5s ni eterno.
function typeDelay(seg: string, first: boolean): number {
  const think = first ? 900 + Math.random() * 1600 : 300 + Math.random() * 450
  const type = Math.min(2600, seg.length * (30 + Math.random() * 24))
  // A veces Lolo anda en otra cosa y tarda unos segundos en contestar (no es una IA instantánea).
  const distracted = first && Math.random() < 0.22 ? 2200 + Math.random() * 4000 : 0
  return think + distracted + Math.max(500, type)
}

// #3 SELECTOR DE FUENTE Y COLOR (la "A" de MSN 7.5: "Cambiar la fuente del mensaje") — aplica a MIS
// mensajes salientes y a lo que escribo. Persiste en localStorage. Fuentes clásicas de la época.
const FONT_KEY = 'msn-my-font'
type MyFont = { family: string; size: number; bold: boolean; italic: boolean; underline: boolean; color: string }
const DEFAULT_FONT: MyFont = { family: 'Tahoma, sans-serif', size: 11, bold: false, italic: false, underline: false, color: '#000000' }
const FONTS = [
  { n: 'Tahoma', v: 'Tahoma, sans-serif' }, { n: 'Arial', v: 'Arial, sans-serif' },
  { n: 'Verdana', v: 'Verdana, sans-serif' }, { n: 'Trebuchet MS', v: '"Trebuchet MS", sans-serif' },
  { n: 'Comic Sans MS', v: '"Comic Sans MS", cursive' }, { n: 'Courier New', v: '"Courier New", monospace' },
  { n: 'Georgia', v: 'Georgia, serif' }, { n: 'Times New Roman', v: '"Times New Roman", serif' },
]

export default function MsnChat({ buddy }: { buddy: ChatBuddy }) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [mood, setMood] = useState('')
  const [showEmo, setShowEmo] = useState(false)
  const [showFont, setShowFont] = useState(false)
  const [myFont, setMyFont] = useState<MyFont>(DEFAULT_FONT)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const aliveRef = useRef(true)   // ventana viva: no setState tras cerrarla durante los delays de tempo
  const bd = bdayLabel(buddy.birthday)
  const insertEmo = (s: string) => { setInput((v) => (v && !v.endsWith(' ') ? v + ' ' : v) + s + ' '); setShowEmo(false) }
  useEffect(() => { try { const r = JSON.parse(localStorage.getItem(FONT_KEY) || 'null'); if (r) setMyFont((f) => ({ ...f, ...r })) } catch { /* ignore */ } }, [])
  const setFont = (patch: Partial<MyFont>) => setMyFont((f) => { const n = { ...f, ...patch }; try { localStorage.setItem(FONT_KEY, JSON.stringify(n)) } catch { /* ignore */ }; return n })
  const myFontCss = (): React.CSSProperties => ({ fontFamily: myFont.family, fontSize: myFont.size, fontWeight: myFont.bold ? 700 : 400, fontStyle: myFont.italic ? 'italic' : 'normal', textDecoration: myFont.underline ? 'underline' : 'none', color: myFont.color })
  const fmtBtn = (on: boolean): React.CSSProperties => ({ width: 22, height: 20, border: '1px solid #a9b0be', borderRadius: 2, background: on ? '#dbe8fb' : '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#333', lineHeight: 1, padding: 0 })

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }) }, [msgs])
  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; abortRef.current?.abort() } }, [])

  // Sincronía viva: si Lolo manda un proactivo (heartbeat) con ESTA ventana abierta, aparece en el hilo
  // en vivo (ya quedó en memoria vía append; el toast es solo el aviso). Sin recargar → sin duplicar.
  useEffect(() => {
    if (buddy.kind !== 'lolo') return
    return onLoloMessage((m) => {
      if (m.role !== 'assistant' || !aliveRef.current) return
      setMsgs((cur) => [...cur, { id: nextId(), from: 'them', name: 'Lolo', text: m.content }])
    })
  }, [buddy.kind])

  // Carga de historial al abrir la ventana (por tipo). El dato ya está persistido en su tabla:
  //  · persona → notas con tag contacto:<id> (/api/notes)
  //  · lolo    → buffer verbatim de lolo_memory (/api/companion/memory) — COMPARTIDO con el arcade
  //  · diario  → entradas del journal (/api/journal)
  // Cerebro NO carga: su transcripción es efímera por diseño (sus respuestas se re-derivan de tu memoria).
  useEffect(() => {
    let live = true
    const mk = (from: Msg['from'], name: string, text: string): Msg => ({ id: nextId(), from, name, text })
    async function load() {
      try {
        if (buddy.kind === 'person') {
          const all = (await fetch('/api/notes').then((r) => r.json())) as NoteRow[]
          if (!live || !Array.isArray(all)) return
          const tag = `contacto:${buddy.id}`
          const mine = all.filter((n) => Array.isArray(n.tags) && n.tags.includes(tag)).reverse()
          if (mine.length) setMsgs(mine.map((n) => mk('me', 'Alex', n.content || n.title)))
        } else if (buddy.kind === 'lolo') {
          const mem = await fetch('/api/companion/memory').then((r) => r.json())
          if (!live) return
          const buf = (mem && Array.isArray(mem.buffer) ? mem.buffer : []) as { role: string; content: string }[]
          if (buf.length) setMsgs(buf.map((m) => (m.role === 'user' ? mk('me', 'Alex', m.content) : mk('them', 'Lolo', m.content))))
          loloOpener(buf)   // que arranque él (throttled)
        } else if (buddy.kind === 'diario') {
          const entries = (await fetch('/api/journal?limit=25').then((r) => r.json())) as { content: string | null }[]
          if (!live || !Array.isArray(entries)) return
          const withText = entries.filter((e) => (e.content ?? '').trim()).reverse()
          if (withText.length) setMsgs(withText.map((e) => mk('me', 'Alex', e.content as string)))
        }
      } catch { /* red caída → arranca vacío */ }
    }
    load()
    return () => { live = false }
  }, [buddy.id, buddy.kind]) // eslint-disable-line react-hooks/exhaustive-deps

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
    markLoloAnswered()   // Alex escribió → resetea la insistencia proactiva (no needy)
    // `msgs` aquí = historial ANTES de este turno. Saneado: lo que ve el modelo debe empezar por 'user'
    // (un saludo espontáneo de Lolo pudo quedar de primero como 'them' → lo quitamos del contexto/persistencia).
    let prior = msgs.filter((m) => m.from !== 'sys').map((m) => ({ role: m.from === 'me' ? 'user' as const : 'assistant' as const, content: m.text }))
    while (prior.length && prior[0].role === 'assistant') prior = prior.slice(1)
    // Colapsa roles iguales adyacentes (un mensaje proactivo de Lolo pudo dejar dos 'assistant' seguidos).
    prior = prior.reduce((acc, m) => { const last = acc[acc.length - 1]; if (last && last.role === m.role) last.content += '\n' + m.content; else acc.push({ ...m }); return acc }, [] as typeof prior)
    const typingId = nextId()
    setMsgs((m) => [...m, { id: typingId, from: 'them', name: 'Lolo', text: '', streaming: true }])
    try {
      // /api/companion/chat: intacto — solo genera la respuesta (no persiste).
      const r = await fetch('/api/companion/chat', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        // + contexto temporal (hora/día/cuánto sin hablar) + su VIDA propia actual (mundo aparte de Alex).
        body: JSON.stringify({ system: `${LOLO_SYSTEM}\n${loloTimeContext()}\n${loloLifeContext()}`, messages: [...prior, { role: 'user', content: t }] }),
      })
      const d = await r.json().catch(() => ({}))
      const reply = (d.text as string) || '…'
      await revealLolo(reply, typingId)   // llega con tempo humano, en 1–3 mensajes escalonados
      markLoloTalk()   // marca la última conversación real (alimenta "no se escriben desde hace…")
      // Append-only: agrega SOLO este intercambio al hilo compartido (no reescribe → no clobbea al
      // heartbeat proactivo ni al arcade). La memoria es la única fuente de verdad.
      appendLoloMemory([{ role: 'user', content: t }, { role: 'assistant', content: reply }])
    } catch (e) {
      if (aliveRef.current) patchMsg(typingId, (m) => ({ ...m, streaming: false, text: `⚠ ${String(e)}` }))
    } finally { setBusy(false) }
  }

  // Revela la respuesta de Lolo con tempo: la parte en mensajes y cada uno aparece tras "escribiendo…"
  // con una latencia proporcional a su largo. Mata el "contesta luego luego" y el párrafo de golpe.
  async function revealLolo(reply: string, firstId: number) {
    const segments = splitSegments(reply)
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      let id = firstId
      if (i > 0) {
        id = nextId()
        if (!aliveRef.current) return
        setMsgs((m) => [...m, { id, from: 'them', name: 'Lolo', text: '', streaming: true }])
      }
      await sleep(typeDelay(seg, i === 0))
      if (!aliveRef.current) return
      patchMsg(id, (m) => ({ ...m, streaming: false, text: seg }))
      if (i < segments.length - 1) await sleep(450 + Math.random() * 500)   // pausa entre mensajes
    }
  }

  // Lolo ARRANCA la conversación al abrir la ventana (regla del user). Throttle 10 min para no saludar
  // cada vez que reabres. Se PERSISTE al hilo (append) — el saludo es parte de la conversación, no un canal aparte.
  async function loloOpener(history: { role: string; content: string }[]) {
    try {
      const last = +(localStorage.getItem('lolo-last-opener') || 0)
      if (Date.now() - last < 10 * 60_000) return
      localStorage.setItem('lolo-last-opener', String(Date.now()))
    } catch { /* modo privado → saluda igual */ }

    let ctx = history.map((m) => ({ role: m.role === 'user' ? 'user' as const : 'assistant' as const, content: m.content }))
    while (ctx.length && ctx[0].role === 'assistant') ctx = ctx.slice(1)
    ctx = ctx.slice(-6)

    await sleep(700 + Math.random() * 900)   // nota que llegaste antes de empezar a "escribir"
    if (!aliveRef.current) return
    const typingId = nextId()
    setMsgs((m) => [...m, { id: typingId, from: 'them', name: 'Lolo', text: '', streaming: true }])
    try {
      const r = await fetch('/api/companion/chat', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ spontaneous: true, system: `${LOLO_OPENER_SYSTEM}\n${loloTimeContext()}\n${loloLifeContext()}`, messages: [...ctx, { role: 'user', content: '[Alex acaba de abrir la ventana del chat contigo]' }] }),
      })
      const d = await r.json().catch(() => ({}))
      const reply = (d.text as string)?.trim() || ''
      if (!reply) { if (aliveRef.current) setMsgs((m) => m.filter((x) => x.id !== typingId)); return }
      await revealLolo(reply, typingId)
      appendLoloMemory([{ role: 'assistant', content: reply }])   // el saludo queda en el hilo
    } catch {
      if (aliveRef.current) setMsgs((m) => m.filter((x) => x.id !== typingId))
    }
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
      {/* Toolbar MSN (decorativo) + mariposa */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14, padding: '3px 10px', background: 'linear-gradient(#fbfcfe,#eaeef4)', borderBottom: '1px solid #cdd6e2', fontSize: 10.5, color: '#2a4d8f' }}>
        {['Invitar', 'Enviar archivos', 'Voz', 'Actividades', 'Juegos'].map((x) => <span key={x} style={{ cursor: 'default' }}>{x}</span>)}
        <span style={{ marginLeft: 'auto', display: 'inline-flex' }}><CerebroButterfly size={18} /></span>
      </div>

      {/* Para: contacto + CUMPLEAÑOS siempre visible */}
      <div style={{ flexShrink: 0, padding: '5px 10px', borderBottom: '1px solid #d7d4c8', fontSize: 11 }}>
        <span style={{ color: '#555' }}>Para: </span>
        <span style={{ fontWeight: 700, color: '#1c4a86' }}>{buddy.name}</span>
        <span style={{ color: '#2f9a22' }}> (En línea)</span>
        {bd && <span style={{ color: '#9a6b1a' }}> · 🎂 {bd}</span>}
      </div>

      {/* Banner de seguridad (icónico de MSN) */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: '#fbf8d8', borderBottom: '1px solid #e6dfa8', fontSize: 10.5, color: '#4a4632' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 13, height: 13, flexShrink: 0, borderRadius: '50%', background: '#3163c8', color: '#fff', fontSize: 9, fontWeight: 700, fontStyle: 'italic' }}>i</span>
        Nunca compartas contraseñas ni datos de tarjeta en una conversación.
      </div>

      {/* Fila principal: historial (izq) + display pictures (der, canon MSN 7) */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div ref={scrollRef} style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '8px 10px', background: '#fff' }}>
          {msgs.length === 0 ? (
            <div style={{ color: '#8a867a', fontStyle: 'italic', fontSize: 11 }}>{emptyHint[buddy.kind]}</div>
          ) : (
            msgs.map((m) => m.from === 'sys' ? (
              <div key={m.id} style={{ textAlign: 'center', color: '#8a867a', fontSize: 10.5, margin: '6px 0' }}>{m.text}</div>
            ) : (
              <div key={m.id} style={{ marginBottom: 8 }}>
                <span style={{ fontWeight: 700, color: m.from === 'me' ? '#c0271c' : '#1c4a86' }}>{m.name} dice:</span>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5, marginTop: 1, ...(m.from === 'me' ? myFontCss() : {}) }}>
                  {m.text ? renderEmoticons(m.text) : (m.streaming && <span style={{ fontStyle: 'italic', color: '#8a867a' }}>escribiendo un mensaje…</span>)}
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
        {/* Display pictures: la del contacto arriba, la tuya abajo — click para cambiar */}
        <div style={{ flexShrink: 0, width: 84, borderLeft: '1px solid #dbe1ea', background: 'linear-gradient(#f4f7fb,#e7edf5)', padding: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <Avatar id={buddy.id} {...buddy.avatar} size={64} onPick={() => changeAvatar(buddy.id)} />
          <div style={{ flex: 1 }} />
          <Avatar id="me" initials="A" bg="#3163c8" size={64} onPick={() => changeAvatar('me')} />
        </div>
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

      {/* Barra de formato: fuente + picker de emoticons */}
      <div style={{ flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center', gap: 10, padding: '2px 9px', background: '#f4f7fb', borderTop: '1px solid #dbe1ea' }}>
        <button onClick={() => { setShowFont((v) => !v); setShowEmo(false) }} title="Cambiar la fuente y el color de tus mensajes"
          style={{ border: 0, background: showFont ? '#dbe8fb' : 'none', cursor: 'pointer', padding: '0 4px', borderRadius: 2, fontWeight: 700, fontSize: 14, lineHeight: 1, fontFamily: myFont.family, color: myFont.color }}>A</button>
        <button onClick={() => { setShowEmo((v) => !v); setShowFont(false) }} title="Emoticons" style={{ border: 0, background: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex' }}>
          <img src={emoSrc(EMOTICONS[0])} alt="Emoticons" width={18} height={18} />
        </button>
        {showEmo && (
          <div style={{ position: 'absolute', left: 8, bottom: '100%', marginBottom: 3, zIndex: 20, width: 214, background: '#fff', border: '1px solid #97948a', boxShadow: '2px 3px 6px rgba(0,0,0,0.28)', padding: 4, display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 1 }}>
            {EMOTICONS.map((e) => (
              <button key={e.file} onClick={() => insertEmo(e.shortcuts[0])} title={`${e.name}  ${e.shortcuts[0]}`}
                style={{ border: 0, background: 'none', cursor: 'pointer', padding: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={emoSrc(e)} alt={e.shortcuts[0]} width={18} height={18} />
              </button>
            ))}
          </div>
        )}
        {showFont && (
          <div style={{ position: 'absolute', left: 8, bottom: '100%', marginBottom: 3, zIndex: 20, width: 236, background: '#fff', border: '1px solid #97948a', boxShadow: '2px 3px 6px rgba(0,0,0,0.28)', padding: 8, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <select value={myFont.family} onChange={(e) => setFont({ family: e.target.value })} className="xp-sunken" style={{ padding: '2px 4px', fontFamily: 'inherit', fontSize: 11, outline: 'none' }}>
              {FONTS.map((f) => <option key={f.v} value={f.v} style={{ fontFamily: f.v }}>{f.n}</option>)}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <select value={myFont.size} onChange={(e) => setFont({ size: +e.target.value })} className="xp-sunken" style={{ padding: '2px 3px', fontFamily: 'inherit', fontSize: 11, outline: 'none' }}>
                {[8, 9, 10, 11, 12, 14, 16, 18].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={() => setFont({ bold: !myFont.bold })} title="Negrita" style={fmtBtn(myFont.bold)}><b>N</b></button>
              <button onClick={() => setFont({ italic: !myFont.italic })} title="Cursiva" style={fmtBtn(myFont.italic)}><i>K</i></button>
              <button onClick={() => setFont({ underline: !myFont.underline })} title="Subrayado" style={fmtBtn(myFont.underline)}><u>S</u></button>
              <input type="color" value={myFont.color} onChange={(e) => setFont({ color: e.target.value })} title="Color del texto" style={{ width: 26, height: 20, padding: 0, border: '1px solid #a9b0be', borderRadius: 2, cursor: 'pointer', background: '#fff' }} />
            </div>
            <div style={{ borderTop: '1px solid #e6e6e6', paddingTop: 5, ...myFontCss() }}>Así se ven tus mensajes :)</div>
          </div>
        )}
      </div>

      {/* Barra de entrada — grounded a MSN 7.5 (layout_920): la entrada LLENA + botón Enviar de 37px.
          Antes: textarea rows=2 estirado (se veía enorme) + botón beige sin diseño. */}
      <div style={{ flexShrink: 0, borderTop: '1px solid #c9c6ba', background: '#ece9d8', padding: 5 }}>
        <div style={{ display: 'flex', gap: 5, alignItems: 'stretch' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Escribe un mensaje…"
            rows={1}
            // --os-font: globals.css fuerza input/textarea a `var(--os-font) !important`; redefinirla aquí
            // hace que el !important resuelva a MI fuente elegida (si no, el input ignora el font-family).
            style={{ flex: 1, resize: 'none', height: 37, boxSizing: 'border-box', padding: '4px 7px', border: '1px solid #7f9db9', borderRadius: 3, background: '#fff', outline: 'none', lineHeight: 1.35, ...myFontCss(), ['--os-font' as string]: myFont.family }}
          />
          <button className="msn-send" onClick={send} disabled={busy || !input.trim()}>{busy ? '…' : 'Enviar'}</button>
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
