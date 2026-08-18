'use client'

import { useCallback, useEffect, useState } from 'react'
import { MONEY, MoneyAmount, MoneyBtn } from '../money/MoneyChrome'
import { localDate, addDays, dayLabel } from '@/components/sections/publico/util'
import { Section, pesosCent } from './kit'

// CIERRE del POS bajo XP (Money). Las ventas entran solas de Poster; esto es para CUADRAR un día — corregirlo
// o capturarlo a mano si el import no llegó. Navegable por día, badge POS/manual. Ventas del día CON CENTAVOS
// (salen del POS al centavo y se reconcilian contra la caja — regla del kit: ante la duda, centavos).

type Venta = { id: string; date: string; efectivo: number; tarjeta: number; note: string | null; source?: 'manual' | 'poster' }
const link: React.CSSProperties = { border: 0, background: 'none', cursor: 'pointer', font: 'inherit', color: MONEY.link, padding: 0 }

export default function PublicoCierre() {
  const today = localDate()
  const [capDate, setCapDate] = useState(today)
  const [ventas, setVentas] = useState<Venta[]>([])
  const [efectivo, setEfectivo] = useState<number | null>(null)
  const [tarjeta, setTarjeta] = useState<number | null>(null)
  const [editVenta, setEditVenta] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  const load = useCallback(async () => {
    const j = await fetch(`/api/publico?month=${capDate.slice(0, 7)}`).then((r) => r.json()).catch(() => null)
    if (j?.ventas) setVentas(j.ventas as Venta[])
  }, [capDate])
  useEffect(() => { void load() }, [load])
  useEffect(() => { setEditVenta(false) }, [capDate])

  const hoyV = ventas.find((v) => v.date === capDate) ?? null

  async function saveVenta() {
    const ef = efectivo ?? 0, ta = tarjeta ?? 0
    if ((!ef && !ta) || ef < 0 || ta < 0) return
    await fetch('/api/publico/venta', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ date: capDate, efectivo: ef || 0, tarjeta: ta || 0 }) })
    setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1400); setEditVenta(false); await load()
  }

  return (
    <Section title="Cierre del POS" right={savedFlash ? <span style={{ color: MONEY.up, fontWeight: 700 }}>guardado</span> : (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 400 }}>
        <button onClick={() => setCapDate((d) => addDays(d, -1))} style={{ ...link, color: '#cfe0f8' }} aria-label="Día anterior">◀</button>
        <button onClick={() => setCapDate(today)} style={{ ...link, color: '#fff', fontWeight: capDate === today ? 700 : 400 }}>{capDate === today ? 'hoy' : dayLabel(capDate)}</button>
        <button onClick={() => setCapDate((d) => (addDays(d, 1) > today ? today : addDays(d, 1)))} style={{ ...link, color: '#cfe0f8' }} aria-label="Día siguiente">▶</button>
      </span>
    )}>
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8a93a8', fontSize: 10 }}>
          {hoyV && <span style={{ borderRadius: 2, padding: '0 5px', fontWeight: 600, background: hoyV.source === 'poster' ? '#dbeafe' : '#eef3fb', color: hoyV.source === 'poster' ? MONEY.blue : '#5a6a86' }} title={hoyV.source === 'poster' ? 'Importado del POS' : 'Capturado a mano'}>{hoyV.source === 'poster' ? 'POS' : 'manual'}</span>}
          <span>Las ventas del POS entran solas de Poster. Esto es para <b style={{ color: MONEY.ink }}>cuadrar</b> un día si el import no llegó.</span>
        </div>
        {hoyV && !editVenta ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#5a6a86' }}>efectivo <b style={{ color: MONEY.ink, fontVariantNumeric: 'tabular-nums' }}>{pesosCent(Number(hoyV.efectivo))}</b> · tarjeta <b style={{ color: MONEY.ink, fontVariantNumeric: 'tabular-nums' }}>{pesosCent(Number(hoyV.tarjeta))}</b> · total <b style={{ color: MONEY.ink, fontVariantNumeric: 'tabular-nums' }}>{pesosCent(Number(hoyV.efectivo) + Number(hoyV.tarjeta))}</b></span>
            <button onClick={() => { setEfectivo(Number(hoyV.efectivo) || null); setTarjeta(Number(hoyV.tarjeta) || null); setEditVenta(true) }} style={{ ...link, color: '#5a6a86', textDecoration: 'underline' }}>corregir a mano</button>
          </div>
        ) : (
          <>
            {!hoyV && <div style={{ color: '#8a93a8', fontSize: 10 }}>Sin ventas del POS para este día — captúralas a mano o espera el import.</div>}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
              <label style={{ flex: 1 }}><div style={{ fontSize: 9.5, color: '#8a93a8', marginBottom: 2 }}>Efectivo</div><MoneyAmount value={efectivo} onChange={setEfectivo} onKeyDown={(e) => { if (e.key === 'Enter') document.getElementById('cierre-tarjeta')?.focus() }} placeholder="0.00" style={{ width: '100%', textAlign: 'right' }} /></label>
              <label style={{ flex: 1 }}><div style={{ fontSize: 9.5, color: '#8a93a8', marginBottom: 2 }}>Tarjeta</div><MoneyAmount id="cierre-tarjeta" value={tarjeta} onChange={setTarjeta} onKeyDown={(e) => { if (e.key === 'Enter') void saveVenta() }} placeholder="0.00" style={{ width: '100%', textAlign: 'right' }} /></label>
              <MoneyBtn onClick={() => void saveVenta()} primary>Guardar</MoneyBtn>
              {hoyV && <button onClick={() => setEditVenta(false)} style={{ ...link, color: '#8a93a8' }}>cancelar</button>}
            </div>
            <div style={{ textAlign: 'right', fontSize: 10, color: '#8a93a8' }}>Total {pesosCent((efectivo ?? 0) + (tarjeta ?? 0))}</div>
          </>
        )}
      </div>
    </Section>
  )
}
