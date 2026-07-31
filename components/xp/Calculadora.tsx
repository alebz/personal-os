'use client'

import { useEffect, useRef, useState } from 'react'

// Calculadora estándar de Windows XP (Ver → Estándar). Bocado alma-de-época QoL.
// FIDELIDAD: la calc de XP NO se Luna-ificó — conservó los botones grises cuadrados con bevel
// clásico (Win2000) y texto a color (dígitos azul, operadores/memoria/limpiar rojo, funciones azul).
// Motor de cálculo estándar: acumulador + operador pendiente + bandera "esperando operando", con
// memoria (MC/MR/MS/M+), ±, √, %, 1/x, Retro/CE/C. Teclado cuando la ventana tiene foco.

type Op = '+' | '−' | '×' | '÷'
const OPS: Record<Op, (a: number, b: number) => number> = {
  '+': (a, b) => a + b,
  '−': (a, b) => a - b,
  '×': (a, b) => a * b,
  '÷': (a, b) => a / b,
}

// Formatea como la calc de XP: hasta ~16 dígitos significativos, sin ceros de cola inútiles,
// notación normal (no exponencial salvo desbordes extremos).
function fmt(n: number): string {
  if (!isFinite(n)) return 'No se puede dividir entre cero.'
  if (Number.isNaN(n)) return 'Entrada no válida.'
  if (n === 0) return '0'
  const abs = Math.abs(n)
  if (abs < 1e-15 || abs >= 1e16) return n.toExponential(10).replace(/\.?0+e/, 'e')
  // Recorta a 15 dígitos significativos y limpia colas
  let s = Number(n.toPrecision(15)).toString()
  return s
}

export default function Calculadora() {
  const [display, setDisplay] = useState('0')
  const [acc, setAcc] = useState<number | null>(null)   // acumulador (operando izq)
  const [op, setOp] = useState<Op | null>(null)
  const [fresh, setFresh] = useState(true)              // el próximo dígito arranca un operando nuevo
  const [mem, setMem] = useState<number | null>(null)
  const [err, setErr] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const cur = () => parseFloat(display.replace(/,/g, '')) || 0

  function inputDigit(d: string) {
    if (err) { clearAll(); }
    setDisplay((prev) => {
      if (fresh || err) { setFresh(false); return d === '.' ? '0.' : d }
      if (d === '.') return prev.includes('.') ? prev : prev + '.'
      if (prev === '0') return d
      if (prev.replace(/[^0-9]/g, '').length >= 16) return prev  // tope de dígitos
      return prev + d
    })
    if (err) setErr(false)
  }

  function clearAll() { setDisplay('0'); setAcc(null); setOp(null); setFresh(true); setErr(false) }
  function clearEntry() { setDisplay('0'); setFresh(true); setErr(false) }
  function backspace() {
    if (fresh || err) return
    setDisplay((p) => {
      const t = p.length <= 1 || (p.length === 2 && p.startsWith('-')) ? '0' : p.slice(0, -1)
      return t === '-' || t === '' ? '0' : t
    })
  }

  function applyOp(next: Op) {
    const v = cur()
    if (op !== null && !fresh) {
      const r = OPS[op](acc ?? 0, v)
      if (!isFinite(r)) { setErr(true); setDisplay(fmt(r)); setAcc(null); setOp(null); setFresh(true); return }
      setAcc(r); setDisplay(fmt(r))
    } else {
      setAcc(v)
    }
    setOp(next); setFresh(true); setErr(false)
  }

  function equals() {
    if (op === null || acc === null) { setFresh(true); return }
    const v = cur()
    const r = OPS[op](acc, v)
    if (!isFinite(r) || Number.isNaN(r)) { setErr(true); setDisplay(fmt(r)) }
    else setDisplay(fmt(r))
    setAcc(null); setOp(null); setFresh(true)
  }

  function unary(fn: (x: number) => number, guard?: (x: number) => boolean) {
    const v = cur()
    if (guard && !guard(v)) { setErr(true); setDisplay(fmt(NaN)); setFresh(true); return }
    const r = fn(v)
    if (!isFinite(r) || Number.isNaN(r)) { setErr(true); setDisplay(v === 0 ? 'No se puede dividir entre cero.' : 'Entrada no válida.'); setFresh(true); return }
    setDisplay(fmt(r)); setFresh(true)
  }

  function percent() {
    // XP: "a op b%" → b es porcentaje de a. Sin operador, b% = b/100.
    const v = cur()
    const base = acc ?? 0
    const r = op ? (base * v) / 100 : v / 100
    setDisplay(fmt(r)); setFresh(true)
  }

  function negate() {
    if (err) return
    setDisplay((p) => (p === '0' ? p : p.startsWith('-') ? p.slice(1) : '-' + p))
  }

  // Memoria
  const memStore = () => { setMem(cur()); setFresh(true) }
  const memPlus = () => { setMem((m) => (m ?? 0) + cur()); setFresh(true) }
  const memRecall = () => { if (mem !== null) { setDisplay(fmt(mem)); setFresh(true) } }
  const memClear = () => setMem(null)

  // Teclado (solo con foco en la ventana de la calc)
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const onKey = (e: KeyboardEvent) => {
      const k = e.key
      if (k >= '0' && k <= '9') { inputDigit(k); e.preventDefault() }
      else if (k === '.' || k === ',') { inputDigit('.'); e.preventDefault() }
      else if (k === '+') { applyOp('+'); e.preventDefault() }
      else if (k === '-') { applyOp('−'); e.preventDefault() }
      else if (k === '*') { applyOp('×'); e.preventDefault() }
      else if (k === '/') { applyOp('÷'); e.preventDefault() }
      else if (k === 'Enter' || k === '=') { equals(); e.preventDefault() }
      else if (k === 'Backspace') { backspace(); e.preventDefault() }
      else if (k === 'Escape') { clearAll(); e.preventDefault() }
      else if (k === 'Delete') { clearEntry(); e.preventDefault() }
      else if (k === '%') { percent(); e.preventDefault() }
    }
    el.addEventListener('keydown', onKey)
    return () => el.removeEventListener('keydown', onKey)
  })

  return (
    <div ref={rootRef} tabIndex={0} className="xp-dialog xp-calc" style={{ height: '100%', outline: 'none', display: 'flex', flexDirection: 'column', background: '#ece9d8', userSelect: 'none' }}>
      {/* Barra de menú clásica */}
      <div style={{ display: 'flex', gap: 0, fontSize: 11, padding: '1px 2px', borderBottom: '1px solid #d7d3c4' }}>
        {['Edición', 'Ver', 'Ayuda'].map((m) => (
          <span key={m} style={{ padding: '2px 7px', cursor: 'default' }}>{m}</span>
        ))}
      </div>

      <div style={{ padding: '8px 9px 10px', display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
        {/* Display */}
        <div className="xp-calc-display">{display}</div>

        {/* Fila indicador memoria + Retroceso/CE/C */}
        <div style={{ display: 'flex', gap: 6 }}>
          <div className="xp-calc-memind">{mem !== null ? 'M' : ''}</div>
          <div style={{ display: 'flex', gap: 6, flex: 1 }}>
            <CalcBtn onClick={backspace} color="#a11" flex>Retroceso</CalcBtn>
            <CalcBtn onClick={clearEntry} color="#a11" flex>CE</CalcBtn>
            <CalcBtn onClick={clearAll} color="#a11" flex>C</CalcBtn>
          </div>
        </div>

        {/* Rejilla principal: [mem][7 8 9][/][sqrt] ... */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, flex: 1 }}>
          <CalcBtn onClick={memClear} color="#a11">MC</CalcBtn>
          <CalcBtn onClick={() => inputDigit('7')} color="#00a">7</CalcBtn>
          <CalcBtn onClick={() => inputDigit('8')} color="#00a">8</CalcBtn>
          <CalcBtn onClick={() => inputDigit('9')} color="#00a">9</CalcBtn>
          <CalcBtn onClick={() => applyOp('÷')} color="#a11">÷</CalcBtn>
          <CalcBtn onClick={() => unary(Math.sqrt, (x) => x >= 0)} color="#00a">sqrt</CalcBtn>

          <CalcBtn onClick={memRecall} color="#a11">MR</CalcBtn>
          <CalcBtn onClick={() => inputDigit('4')} color="#00a">4</CalcBtn>
          <CalcBtn onClick={() => inputDigit('5')} color="#00a">5</CalcBtn>
          <CalcBtn onClick={() => inputDigit('6')} color="#00a">6</CalcBtn>
          <CalcBtn onClick={() => applyOp('×')} color="#a11">×</CalcBtn>
          <CalcBtn onClick={percent} color="#00a">%</CalcBtn>

          <CalcBtn onClick={memStore} color="#a11">MS</CalcBtn>
          <CalcBtn onClick={() => inputDigit('1')} color="#00a">1</CalcBtn>
          <CalcBtn onClick={() => inputDigit('2')} color="#00a">2</CalcBtn>
          <CalcBtn onClick={() => inputDigit('3')} color="#00a">3</CalcBtn>
          <CalcBtn onClick={() => applyOp('−')} color="#a11">−</CalcBtn>
          <CalcBtn onClick={() => unary((x) => 1 / x)} color="#00a">1/x</CalcBtn>

          <CalcBtn onClick={memPlus} color="#a11">M+</CalcBtn>
          <CalcBtn onClick={() => inputDigit('0')} color="#00a">0</CalcBtn>
          <CalcBtn onClick={negate} color="#00a">±</CalcBtn>
          <CalcBtn onClick={() => inputDigit('.')} color="#00a">.</CalcBtn>
          <CalcBtn onClick={() => applyOp('+')} color="#a11">+</CalcBtn>
          <CalcBtn onClick={equals} color="#a11">=</CalcBtn>
        </div>
      </div>
    </div>
  )
}

function CalcBtn({ children, onClick, color, flex }: { children: React.ReactNode; onClick: () => void; color: string; flex?: boolean }) {
  return (
    <button className="xp-calc-btn" onClick={onClick} style={{ color, ...(flex ? { flex: 1 } : {}) }}>
      {children}
    </button>
  )
}
