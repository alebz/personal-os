'use client'

import { useMemo, useRef, useState } from 'react'

// Sudoku — no es app de época XP, pero cabe en la carpeta Juegos (pedido del usuario). Generador por
// backtracking (solución completa → se quitan celdas), dados fijos vs editables, resaltado de
// conflictos en vivo, entrada por teclado y teclado numérico, detección de victoria. Marco tipo XP.

const DIFFS: Record<string, { label: string; remove: number }> = {
  facil: { label: 'Fácil', remove: 40 },
  medio: { label: 'Medio', remove: 48 },
  dificil: { label: 'Difícil', remove: 54 },
}

const rc = (i: number) => [Math.floor(i / 9), i % 9] as const

function isValid(g: number[], i: number, v: number): boolean {
  const [r, c] = rc(i)
  const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3
  for (let k = 0; k < 9; k++) {
    if (g[r * 9 + k] === v && r * 9 + k !== i) return false
    if (g[k * 9 + c] === v && k * 9 + c !== i) return false
  }
  for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) {
    const j = (br + dr) * 9 + (bc + dc)
    if (g[j] === v && j !== i) return false
  }
  return true
}

function solve(g: number[]): boolean {
  const i = g.indexOf(0)
  if (i === -1) return true
  const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  for (let k = nums.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1));[nums[k], nums[j]] = [nums[j], nums[k]] }
  for (const v of nums) {
    if (isValid(g, i, v)) { g[i] = v; if (solve(g)) return true; g[i] = 0 }
  }
  return false
}

function makePuzzle(remove: number) {
  const sol = Array(81).fill(0); solve(sol)
  const puzzle = sol.slice()
  const idx = Array.from({ length: 81 }, (_, i) => i)
  for (let k = idx.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1));[idx[k], idx[j]] = [idx[j], idx[k]] }
  for (let k = 0; k < remove; k++) puzzle[idx[k]] = 0
  const given = puzzle.map((v) => v !== 0)
  return { puzzle, given, sol }
}

export default function Sudoku() {
  const [diffKey, setDiffKey] = useState('facil')
  const [{ puzzle, given }, setP] = useState(() => makePuzzle(DIFFS.facil.remove))
  const [values, setValues] = useState<number[]>(() => puzzle.slice())
  const [sel, setSel] = useState<number | null>(null)
  const [menu, setMenu] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  function newGame(key = diffKey) {
    const p = makePuzzle(DIFFS[key].remove)
    setDiffKey(key); setP(p); setValues(p.puzzle.slice()); setSel(null); setMenu(false)
  }

  // Conjunto de índices en conflicto (mismo valor en fila/col/caja).
  const conflicts = useMemo(() => {
    const bad = new Set<number>()
    for (let i = 0; i < 81; i++) { const v = values[i]; if (v && !isValid(values, i, v)) bad.add(i) }
    return bad
  }, [values])

  const filled = values.every((v) => v !== 0)
  const won = filled && conflicts.size === 0

  function setCell(v: number) {
    if (sel === null || given[sel] || won) return
    setValues((cur) => { const n = cur.slice(); n[sel] = v; return n })
  }

  function onKey(e: React.KeyboardEvent) {
    if (sel === null) return
    if (e.key >= '1' && e.key <= '9') { setCell(Number(e.key)); e.preventDefault() }
    else if (e.key === '0' || e.key === 'Backspace' || e.key === 'Delete') { setCell(0); e.preventDefault() }
    else if (e.key === 'ArrowRight') { setSel((s) => Math.min(80, (s ?? 0) + 1)); e.preventDefault() }
    else if (e.key === 'ArrowLeft') { setSel((s) => Math.max(0, (s ?? 0) - 1)); e.preventDefault() }
    else if (e.key === 'ArrowDown') { setSel((s) => Math.min(80, (s ?? 0) + 9)); e.preventDefault() }
    else if (e.key === 'ArrowUp') { setSel((s) => Math.max(0, (s ?? 0) - 9)); e.preventDefault() }
  }

  const selVal = sel !== null ? values[sel] : 0

  return (
    <div ref={rootRef} tabIndex={0} onKeyDown={onKey} className="xp-dialog" style={{ height: '100%', outline: 'none', display: 'flex', flexDirection: 'column', background: '#ece9d8', userSelect: 'none' }}>
      {/* Menú clásico */}
      <div style={{ display: 'flex', alignItems: 'center', fontSize: 11, padding: '1px 2px', borderBottom: '1px solid #c8c4b4', position: 'relative' }}>
        <button className="xp-ms-menu" onClick={() => setMenu((m) => !m)}>Juego</button>
        <span className="xp-ms-menu" style={{ cursor: 'default' }}>Ayuda</span>
        <span style={{ flex: 1 }} />
        <span style={{ padding: '0 8px', color: '#555' }}>{DIFFS[diffKey].label}</span>
        {menu && (
          <div onMouseLeave={() => setMenu(false)} style={{ position: 'absolute', top: '100%', left: 2, zIndex: 20, minWidth: 132, background: '#fff', border: '1px solid #97948a', boxShadow: '2px 3px 6px rgba(0,0,0,0.28)', padding: '2px 0', fontSize: 11 }}>
            <button className="xp-startmenu-item" style={sdItem} onClick={() => newGame()}>Nuevo</button>
            <div style={{ height: 1, background: '#e3e1d5', margin: '2px 0' }} />
            {Object.entries(DIFFS).map(([k, d]) => (
              <button key={k} className="xp-startmenu-item" style={{ ...sdItem, fontWeight: k === diffKey ? 700 : 400 }} onClick={() => newGame(k)}>
                {k === diffKey ? '• ' : '  '}{d.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        {/* Tablero */}
        <div className="xp-su-board">
          {Array.from({ length: 81 }, (_, i) => {
            const [r, c] = rc(i)
            const v = values[i]
            const isGiven = given[i]
            const isSel = sel === i
            const isConf = conflicts.has(i)
            const sameVal = v !== 0 && v === selVal && !isSel
            const bg = isSel ? '#bcd4f6' : sameVal ? '#e4eefb' : '#fff'
            return (
              <div key={i}
                onClick={() => { setSel(i); rootRef.current?.focus() }}
                style={{
                  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, cursor: 'pointer', background: bg,
                  color: isConf ? '#d21b1b' : isGiven ? '#111' : '#1550c0',
                  fontWeight: isGiven ? 700 : 500,
                  borderRight: `${c % 3 === 2 ? 2 : 1}px solid ${c % 3 === 2 ? '#4a4a4a' : '#c9c9c9'}`,
                  borderBottom: `${r % 3 === 2 ? 2 : 1}px solid ${r % 3 === 2 ? '#4a4a4a' : '#c9c9c9'}`,
                  borderLeft: c === 0 ? '2px solid #4a4a4a' : undefined,
                  borderTop: r === 0 ? '2px solid #4a4a4a' : undefined,
                }}>
                {v !== 0 ? v : ''}
              </div>
            )
          })}
        </div>

        {won && <div style={{ fontSize: 13, fontWeight: 700, color: '#1a7a34' }}>¡Resuelto! 🎉</div>}

        {/* Teclado numérico */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 300 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button key={n} className="xp-raised" onClick={() => setCell(n)} style={sdPad}>{n}</button>
          ))}
          <button className="xp-raised" onClick={() => setCell(0)} style={{ ...sdPad, width: 'auto', padding: '0 12px' }}>Borrar</button>
        </div>
      </div>
    </div>
  )
}

const sdItem: React.CSSProperties = { display: 'block', width: '100%', textAlign: 'left', border: 0, background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, color: '#000', padding: '3px 14px' }
const sdPad: React.CSSProperties = { width: 30, height: 30, fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: 0 }
