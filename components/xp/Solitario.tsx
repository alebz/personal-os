'use client'

import { useMemo, useState } from 'react'

// Solitario (Klondike) — bocado alma-de-época, carpeta Juegos del menú Inicio.
// Robar UNA (opción clásica "Draw one": más jugable/ganable). Interacción CLICK-PARA-MOVER en vez de
// drag: el lienzo XP va escalado (transform:scale) → el drag pediría ÷scale + hit-testing frágil;
// el clic resuelve por elemento del DOM, inmune a la escala y 100% jugable. Selecciono un naipe (y su
// corrida) → clic en destino; doble-clic manda a fundación. Reglas Klondike completas.

type Suit = '♠' | '♥' | '♦' | '♣'
const SUITS: Suit[] = ['♠', '♥', '♦', '♣']
const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const isRed = (s: Suit) => s === '♥' || s === '♦'

interface Card { id: string; suit: Suit; rank: number; up: boolean }

type Sel =
  | { pile: 'waste' }
  | { pile: 'foundation'; col: number }
  | { pile: 'tableau'; col: number; idx: number }
  | null

function freshDeal(): { stock: Card[]; tableau: Card[][] } {
  const deck: Card[] = []
  for (const s of SUITS) for (let r = 1; r <= 13; r++) deck.push({ id: s + r, suit: s, rank: r, up: false })
  // Fisher–Yates (Math.random OK en código de app; solo los scripts de workflow lo prohíben)
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[deck[i], deck[j]] = [deck[j], deck[i]] }
  const tableau: Card[][] = [[], [], [], [], [], [], []]
  for (let c = 0; c < 7; c++) for (let k = 0; k <= c; k++) { const card = deck.pop()!; card.up = k === c; tableau[c].push(card) }
  return { stock: deck, tableau }
}

export default function Solitario() {
  const [{ stock: initStock, tableau: initTab }, setSeed] = useState(freshDeal)
  const [stock, setStock] = useState<Card[]>(initStock)
  const [waste, setWaste] = useState<Card[]>([])
  const [foundations, setFoundations] = useState<Card[][]>([[], [], [], []])
  const [tableau, setTableau] = useState<Card[][]>(initTab)
  const [sel, setSel] = useState<Sel>(null)
  const [moves, setMoves] = useState(0)

  const won = foundations.every((f) => f.length === 13)

  function newGame() {
    const d = freshDeal()
    setSeed(d); setStock(d.stock); setWaste([]); setFoundations([[], [], [], []]); setTableau(d.tableau); setSel(null); setMoves(0)
  }

  function drawStock() {
    setSel(null)
    if (stock.length === 0) {
      // Reciclar el descarte al mazo (robar una: se voltea completo).
      if (waste.length === 0) return
      setStock(waste.slice().reverse().map((c) => ({ ...c, up: false })))
      setWaste([])
      return
    }
    const s = stock.slice()
    const c = s.pop()!
    setStock(s); setWaste((w) => [...w, { ...c, up: true }])
  }

  // Naipes que se moverían dada la selección actual.
  function movingCards(s: Sel): Card[] {
    if (!s) return []
    if (s.pile === 'waste') return waste.length ? [waste[waste.length - 1]] : []
    if (s.pile === 'foundation') { const f = foundations[s.col]; return f.length ? [f[f.length - 1]] : [] }
    return tableau[s.col].slice(s.idx)
  }

  const canOnTableau = (moving: Card, destTop: Card | undefined) =>
    destTop ? destTop.up && isRed(destTop.suit) !== isRed(moving.suit) && moving.rank === destTop.rank - 1 : moving.rank === 13
  const canOnFoundation = (card: Card, f: Card[]) =>
    f.length ? f[f.length - 1].suit === card.suit && card.rank === f[f.length - 1].rank + 1 : card.rank === 1

  // Quita los naipes de su pila de origen (y voltea el tableau si queda un dorso arriba).
  function removeFromSource(s: Sel) {
    if (!s) return
    if (s.pile === 'waste') setWaste((w) => w.slice(0, -1))
    else if (s.pile === 'foundation') setFoundations((fs) => fs.map((f, i) => (i === s.col ? f.slice(0, -1) : f)))
    else setTableau((t) => t.map((col, i) => {
      if (i !== s.col) return col
      const kept = col.slice(0, s.idx)
      if (kept.length && !kept[kept.length - 1].up) kept[kept.length - 1] = { ...kept[kept.length - 1], up: true }
      return kept
    }))
  }

  function moveToTableau(destCol: number) {
    const mv = movingCards(sel)
    if (!mv.length) { setSel(null); return }
    const destTop = tableau[destCol][tableau[destCol].length - 1]
    if (sel && sel.pile === 'tableau' && sel.col === destCol) { setSel(null); return }
    if (!canOnTableau(mv[0], destTop)) { setSel(null); return }
    removeFromSource(sel)
    setTableau((t) => t.map((col, i) => (i === destCol ? [...col, ...mv] : col)))
    setSel(null); setMoves((m) => m + 1)
  }

  function moveToFoundation(destCol: number, source?: Sel) {
    const s = source ?? sel
    const mv = movingCards(s)
    if (mv.length !== 1) { setSel(null); return }
    if (!canOnFoundation(mv[0], foundations[destCol])) { if (!source) setSel(null); return }
    removeFromSource(s)
    setFoundations((fs) => fs.map((f, i) => (i === destCol ? [...f, mv[0]] : f)))
    setSel(null); setMoves((m) => m + 1)
  }

  // Doble-clic: manda el naipe a la primera fundación válida.
  function autoFoundation(s: Sel) {
    const mv = movingCards(s)
    if (mv.length !== 1) return
    const target = foundations.findIndex((f) => canOnFoundation(mv[0], f))
    if (target >= 0) moveToFoundation(target, s)
  }

  function clickTableauCard(col: number, idx: number) {
    const card = tableau[col][idx]
    if (!card.up) return
    if (sel) { moveToTableau(col); return }   // con selección activa, este clic es un intento de mover AQUÍ
    setSel({ pile: 'tableau', col, idx })
  }
  function clickWaste() {
    if (!waste.length) return
    if (sel && !(sel.pile === 'waste')) { setSel(null) }
    setSel((cur) => (cur && cur.pile === 'waste' ? null : { pile: 'waste' }))
  }

  const selSet = useMemo(() => {
    const set = new Set<string>()
    for (const c of movingCards(sel)) set.add(c.id)
    return set
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, waste, tableau, foundations])

  return (
    <div className="xp-solitaire" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a7a34', userSelect: 'none', overflow: 'hidden' }}>
      {/* Barra de menú clásica */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, fontSize: 11, padding: '1px 2px', background: '#ece9d8', borderBottom: '1px solid #b8b4a4', color: '#000', flexShrink: 0 }}>
        <button onClick={newGame} className="xp-solitaire-menu">Juego</button>
        <span className="xp-solitaire-menu" style={{ cursor: 'default' }}>Ayuda</span>
        <span style={{ flex: 1 }} />
        <span style={{ padding: '0 8px', color: '#333' }}>Movimientos: {moves}</span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {/* Fila superior: mazo + descarte … fundaciones */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <Slot onClick={drawStock}>
            {stock.length ? <CardBack /> : <Recycle />}
          </Slot>
          <Slot onClick={clickWaste} onDouble={() => autoFoundation({ pile: 'waste' })}>
            {waste.length ? <CardFace card={waste[waste.length - 1]} selected={selSet.has(waste[waste.length - 1].id)} /> : null}
          </Slot>

          <div style={{ flex: 1 }} />

          {foundations.map((f, i) => (
            <Slot key={i} onClick={() => (sel ? moveToFoundation(i) : setSel(f.length ? { pile: 'foundation', col: i } : null))} ghost="A">
              {f.length ? <CardFace card={f[f.length - 1]} selected={selSet.has(f[f.length - 1].id)} /> : null}
            </Slot>
          ))}
        </div>

        {/* Tableau: 7 columnas */}
        <div style={{ display: 'flex', gap: 10 }}>
          {tableau.map((col, ci) => {
            let y = 0
            const positions = col.map((c) => { const at = y; y += c.up ? 24 : 13; return at })
            const height = (col.length ? y : 0) + CARD_H
            return (
              <div key={ci}
                onClick={col.length === 0 ? () => { if (sel) moveToTableau(ci) } : undefined}
                style={{ width: CARD_W, position: 'relative', minHeight: CARD_H, cursor: col.length === 0 && sel ? 'pointer' : undefined }}>
                {/* Columna vacía: el drop se maneja en el wrapper (recibe el clic por burbujeo aunque el
                    div de apilado transparente quede encima del EmptyCol). Rey (o corrida con Rey) → OK. */}
                {col.length === 0 && <EmptyCol />}
                <div style={{ position: 'relative', height }}>
                  {col.map((c, i) => (
                    <div key={c.id} style={{ position: 'absolute', top: positions[i], left: 0 }}
                      onClick={() => clickTableauCard(ci, i)}
                      onDoubleClick={() => { if (c.up && i === col.length - 1) autoFoundation({ pile: 'tableau', col: ci, idx: i }) }}>
                      {c.up ? <CardFace card={c} selected={selSet.has(c.id)} /> : <CardBack />}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {won && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)' }}>
          <div className="xp-dialog" style={{ padding: '18px 24px', borderRadius: 6, border: '1px solid #0831d8', textAlign: 'center', boxShadow: '0 8px 26px rgba(0,0,0,0.4)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>¡Ganaste! 🂡</div>
            <div style={{ fontSize: 11, color: '#444', marginBottom: 12 }}>Completaste el solitario en {moves} movimientos.</div>
            <button className="xp-raised" onClick={newGame} style={{ padding: '3px 16px', fontSize: 11, cursor: 'pointer' }}>Repartir de nuevo</button>
          </div>
        </div>
      )}
    </div>
  )
}

const CARD_W = 62
const CARD_H = 86

function Slot({ children, onClick, onDouble, ghost }: { children?: React.ReactNode; onClick?: () => void; onDouble?: () => void; ghost?: string }) {
  return (
    <div onClick={onClick} onDoubleClick={onDouble}
      style={{ width: CARD_W, height: CARD_H, borderRadius: 5, border: '1.5px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxSizing: 'border-box' }}>
      {children ?? (ghost ? <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 22, fontWeight: 700 }}>{ghost}</span> : null)}
    </div>
  )
}

function EmptyCol({ onClick }: { onClick?: () => void }) {
  return <div onClick={onClick} style={{ position: 'absolute', top: 0, left: 0, width: CARD_W, height: CARD_H, borderRadius: 5, border: '1.5px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.08)', cursor: 'pointer', boxSizing: 'border-box' }} />
}

function CardFace({ card, selected }: { card: Card; selected?: boolean }) {
  const color = isRed(card.suit) ? '#d21b1b' : '#111'
  return (
    <div style={{
      width: CARD_W, height: CARD_H, borderRadius: 5, background: '#fff',
      border: selected ? '2px solid #ffd63a' : '1px solid #7a7a7a',
      boxShadow: selected ? '0 0 6px 1px rgba(255,206,40,0.85)' : '0 1px 2px rgba(0,0,0,0.3)',
      boxSizing: 'border-box', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 3, left: 5, lineHeight: 1, color, fontWeight: 700, textAlign: 'center' }}>
        <div style={{ fontSize: 14 }}>{RANKS[card.rank]}</div>
        <div style={{ fontSize: 13, marginTop: -1 }}>{card.suit}</div>
      </div>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontSize: 30, opacity: 0.92 }}>{card.suit}</div>
    </div>
  )
}

function CardBack() {
  return (
    <div style={{
      width: CARD_W, height: CARD_H, borderRadius: 5, boxSizing: 'border-box',
      border: '1px solid #cdd8ea',
      background: 'repeating-linear-gradient(45deg,#1e5fbf 0 6px,#2f78e0 6px 12px)',
      boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
    }} />
  )
}

function Recycle() {
  return <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 26 }}>↻</span>
}
