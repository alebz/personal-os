'use client'

import { useState } from 'react'
import { MoneyChrome, MoneyBar, MONEY } from './money/MoneyChrome'
import PublicoFondos from './publico/PublicoFondos'
import PublicoNotas from './publico/PublicoNotas'
import PublicoMovimientos from './publico/PublicoMovimientos'
import PublicoRail from './publico/PublicoRail'
import PublicoPanel from './publico/PublicoPanel'

// PÚBLICO bajo XP = MSN MONEY 2003 (misma familia que Finanzas y Uptown). Rama shell==='xp' de PublicoContent.
// PASO 1: esqueleto — abre, navega entre tabs de folder, y cada tab declara qué va a llevar y en qué ola se
// construye. Se llena por olas reusando MoneyChrome/xp-controls; el arcade queda intacto. Nada se pierde:
// cada bullet aquí sale de la checklist de paridad.

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const todayLabel = () => { const d = new Date(); return `${d.getDate()} de ${MONTHS[d.getMonth()]}` }

const TABS = [
  { id: 'panel', label: 'Panel' },
  { id: 'movimientos', label: 'Movimientos' },
  { id: 'direccion', label: 'Dirección' },
  { id: 'fondos', label: 'Fondos' },
  { id: 'notas', label: 'Notas' },
  { id: 'inventario', label: 'Inventario' },
]

// Qué llevará cada tab (paridad con el arcade) y en qué ola se construye. Visible mientras es esqueleto.
const PLAN: Record<string, { ola: number; items: string[] }> = {
  panel: { ola: 2, items: ['Métricas del mes (ventas, gastos, food cost, ticket promedio)', 'Utilidad operativa + punto de equilibrio (rediseñado a DÍAS)', 'Contenedores (saldos de hoy)', '(Qué toca vive en el riel — no se duplica aquí)'] },
  movimientos: { ola: 1, items: ['Captura por foto (IA propone → confirmas) + guardián de magnitud', 'Registrar a mano', 'Historial de tickets (filtrar, expandir, editar, borrar, ★)', 'Cierre del POS por día'] },
  direccion: { ola: 2, items: ['Food cost teórico por categoría', 'Top productos', 'Horas pico y día de la semana', 'Guardián de recibos de madrugada'] },
  fondos: { ola: 1, items: ['Socios (Alex/Andrés: aportar/retirar, libreta)', 'Reparto de utilidad (%)', 'Otros ingresos', 'Gastos previstos', 'Contenedores (cuadre, traspasos, comisión Clip, propinas)'] },
  notas: { ola: 1, items: ['Notas operativas (texto plano: RFC, cuentas, teléfonos)', 'Agregar / editar / borrar / reordenar'] },
  inventario: { ola: 3, items: ['Conteo físico (por unidades + factor, total en vivo)', 'Historial de conteos', 'Unidades de conteo', 'Clasificar insumos (comida/bebida/empaque)'] },
}

function Placeholder({ tab }: { tab: string }) {
  const p = PLAN[tab]
  const label = TABS.find((t) => t.id === tab)?.label ?? tab
  if (!p) return null
  return (
    <div>
      <MoneyBar right={<span style={{ fontWeight: 400, fontSize: 10 }}>ola {p.ola}</span>}>{label}</MoneyBar>
      <div style={{ border: `1px solid ${MONEY.rule}`, borderTop: 'none', background: '#fff', padding: '10px 12px' }}>
        <div style={{ fontSize: 11, color: MONEY.ink, fontWeight: 700, marginBottom: 6 }}>En construcción</div>
        <div style={{ fontSize: 10.5, color: '#5a6a86', marginBottom: 8 }}>Esta sección llevará, con paridad total al arcade:</div>
        <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {p.items.map((it, i) => (
            <li key={i} style={{ fontSize: 10.5, color: MONEY.ink }}>{it}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default function PublicoMoney() {
  const [tab, setTab] = useState('panel')
  return (
    <MoneyChrome brand="Money · Público" tabs={TABS} active={tab} onTab={setTab} right={<>Público Gourmet · {todayLabel()}</>} rail={<PublicoRail />}>
      {tab === 'panel' ? <PublicoPanel /> : tab === 'fondos' ? <PublicoFondos /> : tab === 'notas' ? <PublicoNotas /> : tab === 'movimientos' ? <PublicoMovimientos /> : <Placeholder tab={tab} />}
    </MoneyChrome>
  )
}
