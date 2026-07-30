'use client'

import { useEffect, useMemo, useState } from 'react'
import { useXpWM } from './wm-context'
import MsnChat, { type ChatBuddy } from './MsnChat'
import { CerebroButterfly } from './CerebroButterfly'

// MSN-CEREBRO — la re-encarnación de época de Cerebro (regla "alma de época": cada app resuelta como
// en 2003). NO envuelve CerebroContent: es una presentación nueva. Windows/MSN Messenger 6/7: ventana
// principal con panel de estado (tu foto + nombre + presencia + mensaje personal) y buddy list.
// Contactos = tus personas reales (/api/contacts) agrupadas por categoría, MÁS tres buddies fijos:
// Cerebro (el oráculo → Consultar/RAG), Lolo (compañero cross-mundo) y Alex/Diario (tú → journal).
// Inc.1: solo la ventana principal (buddy list). El chat llega en inc.2.

interface Contact {
  id: string
  name: string
  category: string
  company: string | null
}

// Buddies fijos (siempre en línea). id con prefijo para no chocar con uuids de contactos.
interface Special {
  id: string
  name: string
  status: string          // mensaje personal / rol
  avatar: { img?: string; initials?: string; bg?: string }
}
const SPECIALS: Special[] = [
  { id: 'sys:cerebro', name: 'Cerebro',        status: 'tu segundo cerebro — pregúntame lo que sea', avatar: { img: '/logo.png', bg: '#171410' } },
  { id: 'sys:lolo',    name: 'Lolo',           status: 'del arcade, de visita 👋',                   avatar: { img: '/Lolo/Idle/lolo_idle_2.png', bg: '#eef4fb' } },
  { id: 'sys:diario',  name: 'Alex (Diario)',  status: 'yo, hablando conmigo mismo',                 avatar: { initials: 'A', bg: '#3163c8' } },
]

const CAT_ORDER = ['Familia', 'Círculo cercano', 'Círculo extendido', 'Proveedores', 'Clientes', 'Enemigos']
const CAT_EMOJI: Record<string, string> = {
  'Familia': '👨‍👩‍👧', 'Círculo cercano': '🤝', 'Círculo extendido': '🌐',
  'Proveedores': '🔧', 'Clientes': '💼', 'Enemigos': '⚔️',
}

// Icono de presencia MSN (buddy verde "en línea"): silueta simple de dos tonos.
function Presence() {
  return (
    <span aria-hidden style={{ display: 'inline-flex', width: 15, height: 15, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ position: 'relative', width: 12, height: 12 }}>
        <span style={{ position: 'absolute', top: 0, left: 3, width: 6, height: 6, borderRadius: '50%', background: 'linear-gradient(#7ee06a,#3aa62c)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)' }} />
        <span style={{ position: 'absolute', bottom: 0, left: 0, width: 12, height: 6, borderRadius: '6px 6px 3px 3px', background: 'linear-gradient(#7ee06a,#39a52b)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)' }} />
      </span>
    </span>
  )
}

function Avatar({ img, initials, bg, size = 20 }: { img?: string; initials?: string; bg?: string; size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex', width: size, height: size, flexShrink: 0, alignItems: 'center', justifyContent: 'center',
        borderRadius: 2, background: bg ?? '#8aa0c0', overflow: 'hidden',
        border: '1px solid rgba(0,0,0,0.35)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.4)',
        color: '#fff', fontSize: size * 0.5, fontWeight: 700,
      }}
    >
      {img
        ? <img src={img} alt="" width={size} height={size} style={{ width: '100%', height: '100%', objectFit: 'cover', imageRendering: 'auto' }} />
        : initials}
    </span>
  )
}

function BuddyRow({ name, status, avatar, onOpen }: { name: string; status?: string; avatar: Special['avatar']; onOpen: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onDoubleClick={onOpen}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left', border: 0, cursor: 'default',
        padding: '2px 6px 2px 20px', fontFamily: 'inherit', fontSize: 11, color: '#1a1a1a',
        background: hover ? '#d8e6fb' : 'transparent',
      }}
    >
      <Presence />
      <Avatar {...avatar} size={18} />
      <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
        {status && <span style={{ color: '#7a7a7a', fontStyle: 'italic' }}> — {status}</span>}
      </span>
    </button>
  )
}

function GroupHeader({ label, count, open, onToggle }: { label: string; count: number; open: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%', textAlign: 'left', border: 0, background: 'transparent', cursor: 'pointer', padding: '3px 6px', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, color: '#2a4d8f' }}
    >
      <span style={{ fontSize: 8, width: 9 }}>{open ? '▼' : '▶'}</span>
      <span>{label}</span>
      <span style={{ fontWeight: 400, color: '#7a7a7a' }}>({count})</span>
    </button>
  )
}

export default function MsnCerebro() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let live = true
    fetch('/api/contacts')
      .then((r) => r.json())
      .then((d) => { if (live && Array.isArray(d)) setContacts(d) })
      .catch(() => {})
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [])

  // Agrupa contactos por categoría, en el orden canónico (categorías desconocidas al final).
  const groups = useMemo(() => {
    const by: Record<string, Contact[]> = {}
    for (const c of contacts) (by[c.category] ??= []).push(c)
    const ordered = [...CAT_ORDER.filter((c) => by[c]), ...Object.keys(by).filter((c) => !CAT_ORDER.includes(c)).sort()]
    return ordered.map((cat) => ({ cat, items: by[cat].slice().sort((a, b) => a.name.localeCompare(b.name)) }))
  }, [contacts])

  const wm = useXpWM()
  const openChat = (b: ChatBuddy) => wm?.openWindow(`chat:${b.id}`, b.name, <MsnChat buddy={b} />, { w: 404, h: 432, resizable: true, icon: 'cerebro' })
  const toggle = (k: string) => setCollapsed((p) => ({ ...p, [k]: !p[k] }))

  const specialKind = (id: string): ChatBuddy['kind'] => (id === 'sys:cerebro' ? 'cerebro' : id === 'sys:lolo' ? 'lolo' : 'diario')

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff', fontFamily: 'inherit', fontSize: 11, color: '#000' }}>
      {/* Menú (decorativo, sabor MSN) */}
      <div style={{ display: 'flex', gap: 13, padding: '2px 9px', background: '#f7f9fc', borderBottom: '1px solid #cdd6e2', fontSize: 11, color: '#333' }}>
        {['Archivo', 'Contactos', 'Acciones', 'Herramientas', 'Ayuda'].map((m) => <span key={m}>{m}</span>)}
      </div>

      {/* Banner con la marca: la mariposa de MSN reimaginada en el rainbow del OS */}
      <div style={{ height: 44, flexShrink: 0, background: 'linear-gradient(180deg,#f3f8ff,#d3e4f7)', borderBottom: '1px solid #9db8dd', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 6 }}>
        <span style={{ fontSize: 17, fontWeight: 800, color: '#15559e', letterSpacing: -0.3 }}>Cerebro</span>
        <CerebroButterfly size={27} />
        <span style={{ fontSize: 15, fontWeight: 600, color: '#5f6b7a' }}>Messenger</span>
      </div>

      {/* Panel de estado: tu foto + nombre + presencia + mensaje personal */}
      <div style={{ flexShrink: 0, display: 'flex', gap: 9, padding: '8px 10px', alignItems: 'center', borderBottom: '1px solid #d7d4c8' }}>
        <Avatar initials="A" bg="#3163c8" size={44} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#111' }}>Alex</span>
            <span style={{ fontSize: 11, color: '#2f9a22' }}>(En línea ▾)</span>
          </div>
          {/* Mensaje personal = el Supraconsciente (se cablea el feed real en un inc. posterior) */}
          <div style={{ fontSize: 11, fontStyle: 'italic', color: '#6a6a6a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            ‹escribe un mensaje personal…›
          </div>
        </div>
      </div>

      {/* Banda de info amarilla (icónica de MSN) */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: '#fbf8d8', borderBottom: '1px solid #e6dfa8', fontSize: 11, color: '#4a4632' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, flexShrink: 0, borderRadius: '50%', background: '#3163c8', color: '#fff', fontSize: 10, fontWeight: 700, fontStyle: 'italic' }}>i</span>
        <span style={{ color: '#1c4a86', textDecoration: 'underline', cursor: 'pointer' }}>Tu segundo cerebro está en línea — pregúntale lo que sea.</span>
      </div>

      {/* Toolbar (decorativo) */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', background: 'linear-gradient(#fbfcfe,#eef2f7)', borderBottom: '1px solid #d7dbe2', fontSize: 11, color: '#2a4d8f' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 14, position: 'relative' }} aria-hidden>
          <span style={{ position: 'relative', width: 9, height: 9 }}>
            <span style={{ position: 'absolute', top: 0, left: 2, width: 5, height: 5, borderRadius: '50%', background: 'linear-gradient(#8ef07a,#2f9a22)' }} />
            <span style={{ position: 'absolute', bottom: 0, left: 0, width: 9, height: 5, borderRadius: '5px 5px 2px 2px', background: 'linear-gradient(#8ef07a,#2f9a22)' }} />
          </span>
          <span style={{ position: 'absolute', right: -1, bottom: -1, fontSize: 9, fontWeight: 900, color: '#2f9a22' }}>+</span>
        </span>
        <span style={{ cursor: 'pointer' }}>Agregar un contacto</span>
      </div>

      {/* Lista de contactos */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: '#fff', padding: '4px 0' }}>
        {/* Buddies fijos: Cerebro, Lolo, Diario */}
        <GroupHeader label="Mi mundo" count={SPECIALS.length} open={!collapsed['__sys']} onToggle={() => toggle('__sys')} />
        {!collapsed['__sys'] && SPECIALS.map((s) => (
          <BuddyRow key={s.id} name={s.name} status={s.status} avatar={s.avatar} onOpen={() => openChat({ id: s.id, name: s.name, kind: specialKind(s.id), avatar: s.avatar })} />
        ))}

        {/* Contactos reales por categoría */}
        {loading && <div style={{ padding: '8px 20px', color: '#8a867a', fontStyle: 'italic' }}>Cargando contactos…</div>}
        {groups.map(({ cat, items }) => (
          <div key={cat}>
            <GroupHeader label={`${CAT_EMOJI[cat] ?? '🏷️'} ${cat}`} count={items.length} open={!collapsed[cat]} onToggle={() => toggle(cat)} />
            {!collapsed[cat] && items.map((c) => (
              <BuddyRow
                key={c.id} name={c.name}
                status={c.company ?? undefined}
                avatar={{ initials: c.name.trim().charAt(0).toUpperCase() || '?', bg: '#8aa0c0' }}
                onOpen={() => openChat({ id: c.id, name: c.name, kind: 'person', avatar: { initials: c.name.trim().charAt(0).toUpperCase() || '?', bg: '#8aa0c0' } })}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Banner inferior — el "ad" .net de MSN, con la mariposa */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'linear-gradient(180deg,#ffffff,#e9f0f9)', borderTop: '1px solid #cdd6e2' }}>
        <CerebroButterfly size={18} />
        <span style={{ fontSize: 12, color: '#5f6b7a' }}><b style={{ color: '#15559e' }}>Cerebro</b> Messenger</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#8a93a0' }}>.mx</span>
      </div>
    </div>
  )
}
