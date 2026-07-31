'use client'

import { useEffect, useRef, useState } from 'react'

// Buscaminas (Minesweeper) — clásico de XP en la carpeta Juegos. Look bevel clásico (NO Luna):
// celdas grises elevadas, contador LED rojo de minas, carita de reset, timer, banderas.
// Clic izq = descubrir (flood-fill en ceros), clic der = bandera → ? → nada. Primer clic SEGURO
// (las minas se colocan tras el 1er clic, evitando esa celda y sus vecinas). Números a color canónico.

type Diff = { rows: number; cols: number; mines: number; label: string }
const DIFFS: Record<string, Diff> = {
  principiante: { rows: 9, cols: 9, mines: 10, label: 'Principiante' },
  intermedio: { rows: 16, cols: 16, mines: 40, label: 'Intermedio' },
  experto: { rows: 16, cols: 30, mines: 99, label: 'Experto' },
}
const NUM_COLOR = ['', '#0000ff', '#008000', '#ff0000', '#000080', '#800000', '#008080', '#000000', '#808080']

interface Board {
  rows: number; cols: number; mines: number
  mine: boolean[]; revealed: boolean[]; flag: number[]; count: number[]
  placed: boolean; over: boolean; win: boolean
}

function emptyBoard(d: Diff): Board {
  const n = d.rows * d.cols
  return { rows: d.rows, cols: d.cols, mines: d.mines, mine: Array(n).fill(false), revealed: Array(n).fill(false), flag: Array(n).fill(0), count: Array(n).fill(0), placed: false, over: false, win: false }
}

function neighbors(i: number, rows: number, cols: number): number[] {
  const r = Math.floor(i / cols), c = i % cols, out: number[] = []
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue
    const nr = r + dr, nc = c + dc
    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) out.push(nr * cols + nc)
  }
  return out
}

function placeMines(b: Board, safe: number) {
  const { rows, cols } = b
  const forbidden = new Set([safe, ...neighbors(safe, rows, cols)])
  const pool: number[] = []
  for (let i = 0; i < rows * cols; i++) if (!forbidden.has(i)) pool.push(i)
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[pool[i], pool[j]] = [pool[j], pool[i]] }
  for (let k = 0; k < b.mines && k < pool.length; k++) b.mine[pool[k]] = true
  for (let i = 0; i < rows * cols; i++) if (!b.mine[i]) b.count[i] = neighbors(i, rows, cols).filter((j) => b.mine[j]).length
  b.placed = true
}

function clone(b: Board): Board {
  return { ...b, mine: b.mine.slice(), revealed: b.revealed.slice(), flag: b.flag.slice(), count: b.count.slice() }
}

export default function Buscaminas() {
  const [diffKey, setDiffKey] = useState('principiante')
  const [board, setBoard] = useState<Board>(() => emptyBoard(DIFFS.principiante))
  const [time, setTime] = useState(0)
  const [pressing, setPressing] = useState(false)
  const [menu, setMenu] = useState(false)

  const flagsUsed = board.flag.filter((f) => f === 1).length
  const minesLeft = board.mines - flagsUsed

  function newGame(key = diffKey) {
    setDiffKey(key); setBoard(emptyBoard(DIFFS[key])); setTime(0); setMenu(false)
  }

  // Timer: corre mientras haya minas colocadas y el juego no termine.
  useEffect(() => {
    if (!board.placed || board.over) return
    const id = setInterval(() => setTime((t) => Math.min(t + 1, 999)), 1000)
    return () => clearInterval(id)
  }, [board.placed, board.over])

  function revealAt(i: number) {
    if (board.over || board.revealed[i] || board.flag[i] === 1) return
    const b = clone(board)
    if (!b.placed) placeMines(b, i)
    if (b.mine[i]) {
      b.revealed[i] = true; b.over = true; b.win = false
      for (let k = 0; k < b.mine.length; k++) if (b.mine[k]) b.revealed[k] = true
      setBoard(b); return
    }
    // Flood-fill iterativo por ceros
    const stack = [i]
    while (stack.length) {
      const j = stack.pop()!
      if (b.revealed[j] || b.flag[j] === 1) continue
      b.revealed[j] = true
      if (b.count[j] === 0 && !b.mine[j]) for (const nb of neighbors(j, b.rows, b.cols)) if (!b.revealed[nb]) stack.push(nb)
    }
    // ¿Victoria? Todas las no-minas descubiertas.
    let win = true
    for (let k = 0; k < b.mine.length; k++) if (!b.mine[k] && !b.revealed[k]) { win = false; break }
    if (win) { b.over = true; b.win = true; for (let k = 0; k < b.mine.length; k++) if (b.mine[k]) b.flag[k] = 1 }
    setBoard(b)
  }

  function flagAt(e: React.MouseEvent, i: number) {
    e.preventDefault()
    if (board.over || board.revealed[i]) return
    const b = clone(board)
    b.flag[i] = (b.flag[i] + 1) % 3   // 0 nada → 1 bandera → 2 interrogación → 0
    setBoard(b)
  }

  // Acorde (chord): clic en número revelado con banderas suficientes abre vecinas.
  function chord(i: number) {
    if (!board.revealed[i] || board.count[i] === 0 || board.over) return
    const nbs = neighbors(i, board.rows, board.cols)
    const flags = nbs.filter((j) => board.flag[j] === 1).length
    if (flags !== board.count[i]) return
    for (const j of nbs) if (board.flag[j] !== 1 && !board.revealed[j]) { revealAt(j); return }
  }

  const face = board.over ? (board.win ? '😎' : '😵') : pressing ? '😮' : '🙂'
  const led = (n: number) => { const s = Math.max(-99, Math.min(999, n)); return (s < 0 ? '-' + String(-s).padStart(2, '0') : String(s).padStart(3, '0')) }
  const cellPx = board.cols > 20 ? 19 : 22

  return (
    <div className="xp-dialog xp-ms" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#ece9d8', userSelect: 'none', overflow: 'hidden' }}>
      {/* Menú clásico */}
      <div style={{ display: 'flex', alignItems: 'center', fontSize: 11, padding: '1px 2px', borderBottom: '1px solid #c8c4b4', position: 'relative' }}>
        <button className="xp-ms-menu" onClick={() => setMenu((m) => !m)}>Juego</button>
        <span className="xp-ms-menu" style={{ cursor: 'default' }}>Ayuda</span>
        {menu && (
          <div onMouseLeave={() => setMenu(false)} style={{ position: 'absolute', top: '100%', left: 2, zIndex: 20, minWidth: 148, background: '#fff', border: '1px solid #97948a', boxShadow: '2px 3px 6px rgba(0,0,0,0.28)', padding: '2px 0', fontSize: 11 }}>
            <button className="xp-startmenu-item" style={msItem} onClick={() => newGame()}>Nuevo</button>
            <div style={{ height: 1, background: '#e3e1d5', margin: '2px 0' }} />
            {Object.entries(DIFFS).map(([k, d]) => (
              <button key={k} className="xp-startmenu-item" style={{ ...msItem, fontWeight: k === diffKey ? 700 : 400 }} onClick={() => newGame(k)}>
                {k === diffKey ? '• ' : '  '}{d.label} ({d.rows}×{d.cols}, {d.mines})
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: 8, overflow: 'auto', flex: 1 }}>
        <div className="xp-ms-frame" style={{ display: 'inline-block', minWidth: '100%', boxSizing: 'border-box' }}>
          {/* Cabecera: LED minas · carita · LED tiempo */}
          <div className="xp-ms-head">
            <div className="xp-ms-led">{led(minesLeft)}</div>
            <button className="xp-ms-face" onClick={() => newGame()}>{face}</button>
            <div className="xp-ms-led">{led(time)}</div>
          </div>

          {/* Rejilla */}
          <div className="xp-ms-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${board.cols}, ${cellPx}px)` }}
            onMouseDown={() => setPressing(true)} onMouseUp={() => setPressing(false)} onMouseLeave={() => setPressing(false)}>
            {Array.from({ length: board.rows * board.cols }, (_, i) => {
              const rev = board.revealed[i], f = board.flag[i]
              const isMine = board.mine[i]
              const cls = rev ? 'xp-ms-cell xp-ms-cell--open' : 'xp-ms-cell'
              let content: React.ReactNode = null
              let color: string | undefined
              if (rev) {
                if (isMine) content = board.win ? '🚩' : '💣'
                else if (board.count[i] > 0) { content = board.count[i]; color = NUM_COLOR[board.count[i]] }
              } else if (f === 1) content = '🚩'
              else if (f === 2) content = '?'
              const badFlag = board.over && !board.win && f === 1 && !isMine   // bandera equivocada al perder
              return (
                <button key={i} className={cls}
                  style={{ width: cellPx, height: cellPx, color, fontSize: cellPx > 20 ? 13 : 11, lineHeight: 1, background: badFlag ? '#f3c0c0' : undefined }}
                  onClick={() => (rev ? chord(i) : revealAt(i))}
                  onContextMenu={(e) => flagAt(e, i)}>
                  {badFlag ? '❌' : content}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

const msItem: React.CSSProperties = { display: 'block', width: '100%', textAlign: 'left', border: 0, background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, color: '#000', padding: '3px 14px' }
