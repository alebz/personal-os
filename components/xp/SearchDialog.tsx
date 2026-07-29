'use client'

import { useState } from 'react'
import { XpIcon } from './xp-icons'

interface Chunk { id: string; content: string; created_at: string; similarity?: number }

// "Buscar" — consultar Cerebro desde cualquier lado (renacimiento del capture global, P2). Busca en
// tu memoria (/api/memory/search) y lista los fragmentos. El ask/síntesis de IA llega con Cerebro-MSN
// (Fase 3). Diálogo de sistema XP literal.
export function SearchDialog() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Chunk[] | null>(null)
  const [loading, setLoading] = useState(false)

  async function run() {
    if (!q.trim()) return
    setLoading(true)
    try {
      const r = await fetch('/api/memory/search', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: q.trim() }) })
      const d = await r.json()
      setResults(Array.isArray(d) ? d : [])
    } catch { setResults([]) } finally { setLoading(false) }
  }

  return (
    <div className="xp-dialog" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 10, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <XpIcon name="buscar" size={24} />
        <span style={{ fontSize: 11, fontWeight: 700 }}>Buscar en Cerebro</span>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          autoFocus className="xp-sunken" value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
          placeholder="¿Qué buscas en tu memoria?"
          style={{ flex: 1, height: 21, padding: '0 5px', fontFamily: 'inherit', fontSize: 11, outline: 'none' }}
        />
        <button className="xp-raised" onClick={run} style={{ padding: '0 12px', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer' }}>Buscar</button>
      </div>
      <div className="xp-sunken" style={{ flex: 1, overflowY: 'auto', padding: 4, background: '#fff' }}>
        {loading ? (
          <p style={{ fontSize: 11, color: '#666', padding: 8 }}>Buscando…</p>
        ) : results == null ? (
          <p style={{ fontSize: 11, color: '#888', padding: 8 }}>Escribe y pulsa Buscar para consultar tu memoria.</p>
        ) : results.length === 0 ? (
          <p style={{ fontSize: 11, color: '#888', padding: 8 }}>Sin resultados.</p>
        ) : (
          results.map((c) => (
            <div key={c.id} style={{ fontSize: 11, lineHeight: 1.4, padding: '5px 6px', borderBottom: '1px solid #eee', color: '#1a1712' }}>
              {c.content.length > 200 ? c.content.slice(0, 200) + '…' : c.content}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
