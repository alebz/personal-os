'use client'

import { useEffect, useRef } from 'react'
import { pushNotification } from '@/lib/notifications'
import { loloTimeContext, loloLifeContext, appendLoloMemory, emitLoloMessage, LOLO_ES_MX } from '@/lib/lolo'
import { setAvatar } from '@/lib/msnAvatars'

// LOLO PROACTIVO — Lolo te escribe SOLO, pero con TACTO:
//  · PRESENCIA: solo cuando estás EN LÍNEA (pestaña visible + interacción reciente). Si estás fuera,
//    NO manda nada → no regresas a mensajes "en visto" acumulados.
//  · NO AL INSTANTE: hay un warmup tras conectarte y probabilidad en cada chequeo (no siempre).
//  · NO NEEDY: si no le respondes, sube el back-off (el hueco entre pings crece y baja la probabilidad).
//    Que le contestes (markLoloAnswered en el chat) resetea la insistencia.
//  · CONSCIENTE DEL TIEMPO: cada ping lleva contexto de hora/día y cuánto hace que no hablan.
// Cada ping: genera 1 línea (spontaneous) → TOAST (target 'lolo') + persiste al buffer (para que esté al abrir).

const KEY_PING = 'lolo-last-ping'
const KEY_UNANS = 'lolo-unanswered'
const BASE_GAP = 90 * 60_000          // hueco base entre pings
const MAX_GAP = 8 * 60 * 60_000       // tope del back-off
const CHECK = 90_000                  // cada cuánto se evalúa
const WARMUP = 80_000                 // no escribe hasta llevar un rato presente ("no al instante")
const ACTIVE_WINDOW = 4 * 60_000      // "en línea" = interacción hace <4 min

const gapFor = (u: number) => Math.min(BASE_GAP * 2 ** u, MAX_GAP)                 // 90m · 3h · 6h · tope 8h
const probFor = (u: number, firstOfSession: boolean) => (firstOfSession ? 0.5 : u === 0 ? 0.3 : u === 1 ? 0.14 : 0.07)

const LOLO_PING_SYSTEM = [
  'Eres Lolo, el compañero de Alex — su amigo, no un asistente. Le escribes por Messenger.',
  'Le llegas TÚ sin que te escriba primero, como un cuate que manda un mensaje de la nada.',
  'MUY corto (1 línea), natural, cálido, con humor seco: una ocurrencia, un cariño, o retomar algo de antes.',
  'A veces el mensaje es sobre TU vida (algo que te pasó, tu proyecto, lo que andas escuchando, tu problemilla), no siempre sobre Alex. Tienes mundo propio.',
  'NADA de "¿en qué te ayudo?" ni preguntas de asistente; puedes no preguntar nada.',
  'Minúsculas ok, sin markdown ni comillas.',
  LOLO_ES_MX,
].join(' ')

type Msg = { role: 'user' | 'assistant'; content: string }
function collapse(msgs: Msg[]): Msg[] {
  const out: Msg[] = []
  for (const m of msgs) { const last = out[out.length - 1]; if (last && last.role === m.role) last.content += '\n' + m.content; else out.push({ ...m }) }
  return out
}
const readNum = (k: string) => { try { return +(localStorage.getItem(k) || 0) } catch { return 0 } }

// FOTO DE PERFIL DE LOLO — Lolo cambia su propia foto solo, ~1 vez al día (jitter 20–28h), solo cuando
// estás en línea (misma presencia del ping). Silencioso (sin notificación). Persiste entre recargas
// (la guardada se re-aplica al abrir; no cambia cada vez). Solo MSN/XP — el Lolo del arcade no tiene foto.
const KEY_PIC = 'lolo-pic'
const KEY_PIC_NEXT = 'lolo-pic-next'
const PICS = Array.from({ length: 9 }, (_, i) => `/Lolo/profile-pics/${String(i + 1).padStart(2, '0')}.png`)
const picGapMs = () => (20 + Math.random() * 8) * 3_600_000   // próximo cambio en 20–28h
function rotatePic() {
  let cur = ''
  try { cur = localStorage.getItem(KEY_PIC) || '' } catch { /* */ }
  const pool = PICS.filter((p) => p !== cur)   // nunca repite la anterior
  const pick = pool[Math.floor(Math.random() * pool.length)] || PICS[0]
  setAvatar('sys:lolo', pick)
  try { localStorage.setItem(KEY_PIC, pick); localStorage.setItem(KEY_PIC_NEXT, String(Date.now() + picGapMs())) } catch { /* */ }
}

export default function LoloHeartbeat() {
  const busy = useRef(false)
  const lastActive = useRef(Date.now())
  const presentSince = useRef(0)
  const sessionPinged = useRef(false)

  // Foto de perfil: al abrir, re-aplica la persistida (misma foto entre recargas, no cambia al reabrir);
  // si nunca se ha elegido una, elige la primera y agenda el próximo cambio.
  useEffect(() => {
    try {
      const cur = localStorage.getItem(KEY_PIC)
      if (cur) { setAvatar('sys:lolo', cur); if (!localStorage.getItem(KEY_PIC_NEXT)) localStorage.setItem(KEY_PIC_NEXT, String(Date.now() + picGapMs())) }
      else rotatePic()
    } catch { /* */ }
  }, [])

  useEffect(() => {
    let alive = true
    const bump = () => { lastActive.current = Date.now() }
    const evts: (keyof WindowEventMap)[] = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'focus']
    evts.forEach((e) => window.addEventListener(e, bump, { passive: true }))

    const online = () => document.visibilityState === 'visible' && Date.now() - lastActive.current < ACTIVE_WINDOW

    async function ping() {
      if (busy.current) return
      busy.current = true
      try {
        const mem = await fetch('/api/companion/memory').then((r) => r.json()).catch(() => ({}))
        let ctx: Msg[] = (Array.isArray(mem?.buffer) ? mem.buffer : []).map((m: Msg) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))
        while (ctx.length && ctx[0].role === 'assistant') ctx = ctx.slice(1)
        ctx = collapse(ctx).slice(-6)
        const messages = [...ctx, { role: 'user' as const, content: `[Alex está en línea en su OS. Escríbele tú, sin que te escriba primero.] ${loloTimeContext()} ${loloLifeContext()}` }]
        const d = await fetch('/api/companion/chat', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ spontaneous: true, system: LOLO_PING_SYSTEM, messages: collapse(messages) }),
        }).then((r) => r.json()).catch(() => ({}))
        const reply = (d?.text as string)?.trim()
        if (!alive || !reply) return
        try {
          localStorage.setItem(KEY_PING, String(Date.now()))
          localStorage.setItem(KEY_UNANS, String(Math.min(readNum(KEY_UNANS) + 1, 4)))   // sube el back-off; que responda lo resetea
        } catch { /* ignore */ }
        sessionPinged.current = true
        // El mensaje es UNO: (a) queda en el hilo (append atómico, no reescribe lo que leyó → no clobbea
        // al chat), (b) aparece en la ventana abierta si la hay (bus), (c) el toast es solo el aviso.
        appendLoloMemory([{ role: 'assistant', content: reply }])
        emitLoloMessage({ role: 'assistant', content: reply })
        pushNotification({ id: `lolo:${Date.now()}`, icon: '/Lolo/Idle/lolo_idle_2.png', title: 'Lolo', body: reply, target: 'lolo' })
      } finally { busy.current = false }
    }

    function tick() {
      // Foto de perfil: cambia sola cuando estás en línea y pasó el intervalo (~diario). Independiente
      // del ping (no la limita el back-off/horario/probabilidad); silenciosa.
      if (online() && Date.now() >= readNum(KEY_PIC_NEXT)) rotatePic()
      if (busy.current) return
      const h = new Date().getHours(); if (h < 8 || h >= 24) return          // horario despierto
      if (!online()) { presentSince.current = 0; sessionPinged.current = false; return }   // FUERA → no molesta
      if (presentSince.current === 0) presentSince.current = Date.now()
      if (Date.now() - presentSince.current < WARMUP) return                 // recién llegó ("no al instante")
      const u = Math.min(readNum(KEY_UNANS), 4)
      if (Date.now() - readNum(KEY_PING) < gapFor(u)) return                 // back-off
      if (Math.random() > probFor(u, !sessionPinged.current)) return         // no siempre
      ping()
    }

    const iv = setInterval(() => { if (alive) tick() }, CHECK)
    return () => { alive = false; clearInterval(iv); evts.forEach((e) => window.removeEventListener(e, bump)) }
  }, [])

  return null
}
