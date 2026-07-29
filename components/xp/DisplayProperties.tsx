'use client'

import { useState } from 'react'
import { useOSSettings } from '@/components/OSSettingsContext'

// "Propiedades de Pantalla" — el diálogo diegético que controla la escala del lienzo (Tema 3). Vive
// como ventana FIJA del WM (canon de diálogos). El slider "Menos ↔ Más" gobierna xpLogicalH persistido:
// Menos = altura lógica chica = todo más grande (presencia de época); Más = más alto lógico = más
// densidad. Regla THEMING: cada tema configura LO SUYO con SU interfaz (arcade su panel CRT, XP sus
// Propiedades). El valor se COMMITEA al soltar (no en vivo) para no re-escalar el lienzo bajo el
// cursor; el monitorcito + el número dan feedback durante el arrastre.

const MIN_H = 640    // Menos → chrome grande
const MAX_H = 1080   // Más → denso

function MiniMonitor() {
  return (
    <div style={{ width: 156, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: 156, height: 116, borderRadius: 9, padding: 9, background: 'linear-gradient(#e0ddd0,#b6b3a4)', boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.7), 0 2px 5px rgba(0,0,0,0.3)' }}>
        <div style={{ width: '100%', height: '100%', borderRadius: 3, background: "url('/themes/xp/wallpapers/bliss.png') center / cover", boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.45)' }} />
      </div>
      <div style={{ width: 34, height: 11, background: 'linear-gradient(#cecabd,#b6b3a4)' }} />
      <div style={{ width: 78, height: 7, borderRadius: 4, background: 'linear-gradient(#cecabd,#a6a394)' }} />
    </div>
  )
}

const TABS = ['Temas', 'Escritorio', 'Protector', 'Apariencia', 'Configuración']

export default function DisplayProperties() {
  const { xpLogicalH, set } = useOSSettings()
  const [draft, setDraft] = useState(xpLogicalH)
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1440
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900
  const logicalW = Math.round((vw * draft) / vh)
  const commit = () => set('xpLogicalH', draft)

  return (
    <div className="flex h-full flex-col text-fg" style={{ fontSize: 13 }}>
      {/* Barra de pestañas (solo "Configuración" activa; las demás decorativas = sabor XP) */}
      <div style={{ display: 'flex', gap: 2, padding: '8px 8px 0', background: '#ece9d8', borderBottom: '1px solid #aca899' }}>
        {TABS.map((t) => {
          const active = t === 'Configuración'
          return (
            <div
              key={t}
              style={{
                padding: '4px 9px', fontSize: 11.5, borderRadius: '4px 4px 0 0',
                border: '1px solid #aca899', borderBottom: active ? '1px solid #fff' : '1px solid #aca899',
                marginBottom: active ? -1 : 0,
                background: active ? '#fff' : 'linear-gradient(#f4f2ea,#e2dfd2)',
                color: active ? '#1a1712' : '#8a867a', cursor: active ? 'default' : 'not-allowed',
              }}
            >
              {t}
            </div>
          )
        })}
      </div>

      {/* Cuerpo blanco */}
      <div className="flex flex-1 flex-col items-center gap-4 bg-white px-5 py-5">
        <MiniMonitor />

        <div className="w-full">
          <p className="mb-2 font-semibold">Resolución del lienzo</p>
          <div className="flex items-center gap-3">
            <span className="text-fg-muted" style={{ fontSize: 11 }}>Menos</span>
            <input
              type="range" min={MIN_H} max={MAX_H} step={20} value={draft}
              onChange={(e) => setDraft(+e.target.value)}
              onPointerUp={commit} onKeyUp={commit}
              className="os-slider flex-1"
              aria-label="Resolución del lienzo"
            />
            <span className="text-fg-muted" style={{ fontSize: 11 }}>Más</span>
          </div>
          <p className="mt-2 text-center font-semibold tabular-nums">{logicalW} × {draft}</p>
        </div>

        <p className="text-fg-muted" style={{ fontSize: 11, lineHeight: 1.5 }}>
          El escritorio XP se escala para llenar tu pantalla. <b>Menos</b> = todo más grande (presencia de época);
          <b> Más</b> = más espacio útil. Se aplica al soltar.
        </p>
      </div>
    </div>
  )
}
