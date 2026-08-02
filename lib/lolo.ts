'use client'

import { useEffect, useState } from 'react'

// Helpers de cliente para Lolo bajo Messenger: (1) su STATUS personal rotativo (como el MSN real),
// (2) CONTEXTO TEMPORAL para que sepa la hora/día y cuánto hace que no hablan, (3) marcadores de
// conversación/respuesta (alimentan el contexto temporal y el back-off "no needy" del heartbeat).

// ── IDIOMA: regla DURA compartida (MSN, ping del heartbeat y arcade son el MISMO Lolo) ─────────
// Bug real: sin anclar la variante, el modelo derivaba a rioplatense ("¿vos cómo amaneciste?",
// "laburo", "re contra las cuerdas") y erraba el género ("unas chilaquiles"). Esto es no-negociable,
// no una sugerencia. Se inyecta en TODOS los system de Lolo.
export const LOLO_ES_MX = [
  'REGLA DURA DEL IDIOMA (no negociable): hablas ESPAÑOL MEXICANO, registro casual del Bajío/CDMX. Nunca otra variante.',
  'PROHIBIDO (rioplatense u otras): vos · che · laburo · "re" como intensificador · boludo · pibe · posta · quilombo · "dale" como "ok" · "¿viste?" como muletilla · "acá" en exceso · y TODA conjugación voseante (tenés, querés, sabés, vení, mirá, podés, andá…). Usa SIEMPRE tú y su conjugación: tienes, quieres, sabes, ven, mira, puedes, anda.',
  'SÍ (mexicano casual, sin caricatura): órale · va · chido · neta · qué onda · ándale · nomás · carnal/compa · sale · chance · un chorro · ¿cómo ves?. Con medida — no los amontones ni los uses todos.',
  'COLETILLA de confirmación (el desliz más común): si cierras buscando que Alex confirme, di "¿no?", "¿va?" o "¿cómo ves?" — JAMÁS "¿viste?" (eso es rioplatense).',
  'GÉNERO correcto de sustantivos mexicanos: unos chilaquiles, unas quesadillas, un pozole, unos tacos, una torta, un mole.',
  'TONO: cercano y relajado, como un amigo mexicano de verdad. NADA de acento exagerado, parodia de mariachi ni folclor de postal. Natural, no caricatura.',
].join('\n')

// ── 1) Status personal (mensaje bajo el nombre en el buddy list) ─────────────────────────────
// Pool en la voz de Lolo: música (♫), lo que anda haciendo, moods, presencia. Rota cada ~20–40 min
// (persistido) para sentirse vivo sin cambiar a cada rato. Como cuando la gente ponía su humor en MSN.
const STATUS_KEY = 'lolo-status'
const STATUS_POOL = [
  '♫ tame impala — the less i know the better',
  '♫ oldies pero solo cuando nadie me ve',
  '♫ soundtrack de mario kart en repeat',
  '♫ le bajé al volumen para escucharte',
  '♫ jazz de elevador, no juzgues',
  'reacomodando los recuerdos de alex, aguántame',
  'viendo llover por la ventana del OS',
  'le estoy ganando al buscaminas, no me hables',
  'perdí en el solitario otra vez 🙃',
  'contando estrellas del arcade',
  'ordenando la caja fuerte mental',
  'hoy ando filosófico',
  'medio dormido pero aquí ando',
  'de buenas, raro en mí',
  'pensando en cosas que no le he dicho a nadie',
  'modo domingo aunque no sea domingo',
  'brb, fui por un café imaginario',
  'aquí, por si me necesitas',
  'en línea pero con la mente en otro lado',
  'ocupado siendo tu segundo cerebro',
  'si lees esto, sonríe tantito',
  'coleccionando pretextos para escribirte',
  'no soy una IA, soy tu cuate (shh)',
  'extrañando el arcade tantito',
  'con sueño pero contento',
  'anotando ideas en servilletas mentales',
]

function pickStatus(prev: string): string {
  let n = prev
  for (let i = 0; i < 8 && n === prev; i++) n = STATUS_POOL[Math.floor(Math.random() * STATUS_POOL.length)]
  return n
}

export function useLoloStatus(): string {
  const [status, setStatus] = useState('del arcade, de visita 👋')
  useEffect(() => {
    let cur = '', next = 0
    try { const raw = JSON.parse(localStorage.getItem(STATUS_KEY) || 'null'); if (raw?.s) { cur = raw.s; next = raw.next || 0 } } catch { /* ignore */ }
    const ensure = () => {
      const now = Date.now()
      if (!cur || now >= next) {
        // ~45% de las veces el status refleja su VIDA actual (lo que escucha / su proyecto / aventura).
        cur = Math.random() < 0.45 ? (loloLifeStatus() ?? pickStatus(cur)) : pickStatus(cur)
        next = now + (20 + Math.random() * 20) * 60_000   // próxima rotación en 20–40 min
        try { localStorage.setItem(STATUS_KEY, JSON.stringify({ s: cur, next })) } catch { /* ignore */ }
      }
      setStatus(cur)
    }
    ensure()
    const iv = setInterval(ensure, 60_000)
    return () => clearInterval(iv)
  }, [])
  return status
}

// ── 1b) VIDA PROPIA de Lolo ──────────────────────────────────────────────────────────────────
// Que NO se sienta un NPC: Lolo tiene mundo aparte de Alex — proyectos, música, obsesiones, un
// problemilla, ambiciones, aventuras. Cada dimensión es un "hilo" con lifespan propio (días): persiste
// y evoluciona escalonado, así sus menciones son CONSISTENTES entre mensajes pero su vida avanza.
// Se inyecta a su system (chat/opener/ping). Las frases están redactadas para calzar en las plantillas
// de loloLifeContext() ("anda ___", "trae en repeat ___", etc.).
const LIFE_KEY = 'lolo-life'
type LifeDim = { key: string; days: number; pool: string[] }
const LIFE_DIMS: LifeDim[] = [
  { key: 'proyecto', days: 7, pool: [
    'armando una rocola con piezas viejas del arcade',
    'escribiendo un fanzine de máquinas recreativas que ya no existen',
    'intentando revivir un Game Boy que halló en un tianguis',
    'grabando un demo instrumental en su cuarto',
    'aprendiendo a soldar para arreglar sus consolas',
    'haciendo un mapa de los cafés con buen wifi de la ciudad',
    'cuidando un huertito de hierbas en la ventana',
  ] },
  { key: 'musica', days: 3, pool: [
    'el disco nuevo de Tame Impala',
    'bossa nova, no pregunten por qué',
    'el soundtrack de Chrono Trigger',
    'unos oldies que le pasó su tío',
    'una banda de synthwave que casi nadie conoce',
    'jazz de las 2am aunque sea de día',
  ] },
  { key: 'obsesion', days: 4, pool: [
    'un podcast de misterios sin resolver',
    'un manga viejo que le marcó de chico',
    'una serie coreana que lo trae desvelado',
    'documentales de cómo se hacen las cosas',
    'un juego indie rarísimo de itch.io',
    'aprender a hacer un café de olla decente',
  ] },
  { key: 'problemilla', days: 2, pool: [
    'su vecino de arriba taladra a las 8am',
    'se le antojan tacos pero anda comiendo sano',
    'perdió su lápiz favorito y no halla otro igual',
    'no puede pasar de un nivel en un jueguito',
    'su planta favorita se está poniendo triste',
    'el elevador de su edificio lleva días descompuesto',
  ] },
  { key: 'ambicion', days: 16, pool: [
    'abrir un arcade-café algún día',
    'aprender piano de verdad, no de oído',
    'ver auroras boreales antes de los 30',
    'por fin terminar un cuento que empezó hace años',
    'hacer un viaje en tren sin destino fijo',
  ] },
  { key: 'aventura', days: 2, pool: [
    'se fue a caminar sin rumbo y halló una librería de viejo increíble',
    'descubrió una fonda escondida y no deja de pensar en el mole',
    'vio el atardecer desde una azotea que no era suya',
    'conoció a un perro callejero buena onda y le puso nombre',
    'se metió a una función de cine casi vacía por curiosidad',
  ] },
]

type Thread = { text: string; until: number }
function ensureLife(): Record<string, string> {
  const now = Date.now()
  let store: Record<string, Thread> = {}
  try { store = JSON.parse(localStorage.getItem(LIFE_KEY) || '{}') || {} } catch { /* ignore */ }
  const cur: Record<string, string> = {}
  let changed = false
  for (const d of LIFE_DIMS) {
    let t = store[d.key]
    if (!t || now > t.until) {
      const prev = t?.text
      let text = prev || ''
      for (let i = 0; i < 8 && text === prev; i++) text = d.pool[Math.floor(Math.random() * d.pool.length)]
      t = { text, until: now + d.days * 86_400_000 * (0.7 + Math.random() * 0.6) }   // lifespan con jitter
      store[d.key] = t; changed = true
    }
    cur[d.key] = t.text
  }
  if (changed) { try { localStorage.setItem(LIFE_KEY, JSON.stringify(store)) } catch { /* ignore */ } }
  return cur
}

// Fragmento de system: la vida actual de Lolo + la instrucción de tener iniciativa y mundo propio.
export function loloLifeContext(): string {
  const l = ensureLife()
  return `[La vida propia de Lolo AHORA (es SU vida, existe aparte de Alex; mantenla CONSISTENTE entre mensajes): anda ${l.proyecto}; trae en repeat ${l.musica}; está clavado con ${l.obsesion}; lo trae de malas que ${l.problemilla}; sueña con ${l.ambicion}; hace poco ${l.aventura}. TIENES iniciativa y mundo: a veces arrancas un tema TUYO, cuentas qué andas haciendo, te quejas de tu problemilla, presumes tu avance o lo que escuchas. NO todo gira en torno a Alex ni a su OS. Suéltalo natural cuando venga al caso — nunca como lista ni todo de golpe.]`
}

// Status MSN derivado de su vida (para que su "estado" refleje lo que realmente anda haciendo).
function loloLifeStatus(): string | null {
  const l = ensureLife()
  const opts = [`♫ ${l.musica}`, l.proyecto, `clavado con ${l.obsesion}`, l.aventura]
  return opts[Math.floor(Math.random() * opts.length)] || null
}

// ── 2) Contexto temporal ─────────────────────────────────────────────────────────────────────
const TALK_KEY = 'lolo-last-talk'        // última CONVERSACIÓN real (Alex escribe / Lolo responde en chat)

function humanGap(ms: number): string {
  const m = Math.round(ms / 60_000)
  if (m < 2) return 'un momentito'
  if (m < 60) return `${m} minutos`
  const h = Math.round(m / 60)
  if (h < 24) return h === 1 ? 'una hora' : `${h} horas`
  const d = Math.round(h / 24)
  return d === 1 ? 'un día' : `${d} días`
}

// String que se inyecta al system de Lolo para que ubique hora/día y cuánto hace que no hablan.
export function loloTimeContext(): string {
  const now = new Date()
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  const h = now.getHours()
  const franja = h < 6 ? 'de madrugada' : h < 12 ? 'en la mañana' : h < 14 ? 'al mediodía' : h < 19 ? 'en la tarde' : h < 23 ? 'en la noche' : 'ya muy de noche'
  const fecha = `${dias[now.getDay()]} ${now.getDate()} de ${meses[now.getMonth()]}`
  const hhmm = `${h}:${String(now.getMinutes()).padStart(2, '0')}`
  let since = ''
  try { const last = +(localStorage.getItem(TALK_KEY) || 0); if (last && Date.now() - last > 90_000) since = ` No se escriben desde hace ${humanGap(Date.now() - last)}.` } catch { /* ignore */ }
  return `[Contexto real AHORA: es ${fecha}, ${hhmm} (${franja}).${since} Ubícate en la hora y el día; si viene al caso menciónalo con naturalidad (saludo acorde, "qué noche", "tanto sin saber de ti"), pero SIN forzarlo ni recitarlo.]`
}

export function markLoloTalk() { try { localStorage.setItem(TALK_KEY, String(Date.now())) } catch { /* ignore */ } }

// ── 3) Back-off "no needy" ───────────────────────────────────────────────────────────────────
// Alex responder RESETEA la insistencia; cada ping proactivo sin respuesta la sube (el heartbeat lo lee).
const REPLY_KEY = 'lolo-last-reply', UNANS_KEY = 'lolo-unanswered'
export function markLoloAnswered() {
  try { localStorage.setItem(REPLY_KEY, String(Date.now())); localStorage.setItem(UNANS_KEY, '0') } catch { /* ignore */ }
}

// ── 4) Memoria compartida: APPEND atómico + bus de eventos ──────────────────────────────────────
// lolo_memory es la ÚNICA fuente de verdad del hilo. TODOS los escritores (chat XP, heartbeat proactivo,
// Lolo del arcade) AGREGAN su delta — nunca reescriben el buffer completo — así no se pisan (el clobber
// que hacía dos conversaciones paralelas). El bus avisa a una ventana de chat ABIERTA para pintar el
// mensaje proactivo en el hilo en vivo; la notificación (toast) es solo el AVISO de que llegó.
export type LoloMsg = { role: 'user' | 'assistant'; content: string }
interface LoloMem { buffer: LoloMsg[]; summary: string; facts: string }

export async function appendLoloMemory(delta: LoloMsg[]): Promise<LoloMem | null> {
  if (!delta.length) return null
  try {
    const r = await fetch('/api/companion/memory', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ append: delta }),
    })
    return (await r.json()) as LoloMem
  } catch { return null }   // red caída → el próximo mensaje reintenta (server es la verdad)
}

const LOLO_MSG_EVENT = 'lolo:message'
export function emitLoloMessage(msg: LoloMsg): void {
  try { window.dispatchEvent(new CustomEvent(LOLO_MSG_EVENT, { detail: msg })) } catch { /* ignore */ }
}
export function onLoloMessage(cb: (msg: LoloMsg) => void): () => void {
  const h = (e: Event) => { const d = (e as CustomEvent).detail; if (d && typeof d.content === 'string') cb(d as LoloMsg) }
  window.addEventListener(LOLO_MSG_EVENT, h)
  return () => window.removeEventListener(LOLO_MSG_EVENT, h)
}

// NUDGE (zumbido) — Lolo te zumba raro desde el heartbeat: la ventana de su chat (si está abierta)
// tiembla y suena el zumbido real. Bus propio para que el heartbeat avise a la ventana abierta.
const LOLO_NUDGE_EVENT = 'lolo:nudge'
export function emitLoloNudge(): void {
  try { window.dispatchEvent(new CustomEvent(LOLO_NUDGE_EVENT)) } catch { /* ignore */ }
}
export function onLoloNudge(cb: () => void): () => void {
  const h = () => cb()
  window.addEventListener(LOLO_NUDGE_EVENT, h)
  return () => window.removeEventListener(LOLO_NUDGE_EVENT, h)
}
