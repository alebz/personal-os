'use client'

import { useState, type ReactNode } from 'react'
import { useOSSettings } from '@/components/OSSettingsContext'
import type { XpScreensaverKind } from '@/components/OSSettingsContext'
import { GroupBox, XpSelect, XpSpinner, XpSlider, XpCheckbox } from './xp-controls'
import { XP_WALLPAPERS, wallpaperSrc } from '@/lib/xpWallpapers'

// "Propiedades de Pantalla" — diálogo de sistema XP LITERAL (#ECE9D8, group boxes, vocabulario XP).
// Ventana FIJA del WM. Pestañas FUNCIONALES: Temas (selector diegético XP/Arcade), Escritorio
// (wallpaper picker), Protector (screensaver XP + minutos + modo discreto), Apariencia (grisada
// honesta), Configuración (dial de escala del lienzo). Cada tema configura LO SUYO con SU interfaz
// (regla THEMING); bajo XP NO se monta el panel arcade.

const MIN_H = 640, MAX_H = 1080
const XP_BLUE = '#3163c8'
const TABS = ['Temas', 'Escritorio', 'Protector', 'Apariencia', 'Configuración'] as const
type Tab = (typeof TABS)[number]

const SAVERS: { value: XpScreensaverKind; label: string }[] = [
  { value: 'mystify',   label: 'Mystify' },
  { value: 'logo',      label: 'Logo flotante' },
  { value: 'starfield', label: 'Campo de estrellas' },
]

// Monitorcito de época (el chasis beige con la pantalla dentro)
function MiniMonitor({ src, children }: { src?: string; children?: ReactNode }) {
  return (
    <div style={{ width: 150, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: 150, height: 112, borderRadius: 9, padding: 8, background: 'linear-gradient(#e8e5d8,#b6b3a4)', boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.7), 0 2px 5px rgba(0,0,0,0.3)' }}>
        <div style={{ width: '100%', height: '100%', borderRadius: 3, background: src ? `#3a6ea5 url('${src}') center / cover` : '#081d3f', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.45)', overflow: 'hidden', position: 'relative' }}>
          {children}
        </div>
      </div>
      <div style={{ width: 32, height: 10, background: 'linear-gradient(#cecabd,#b6b3a4)' }} />
      <div style={{ width: 74, height: 7, borderRadius: 4, background: 'linear-gradient(#cecabd,#a6a394)' }} />
    </div>
  )
}

export default function DisplayProperties() {
  const { shell, set, xpLogicalH, xpWallpaper, xpScreensaver, screensaver, discreto, startScreensaver } = useOSSettings()
  const [tab, setTab] = useState<Tab>('Escritorio')
  const [draft, setDraft] = useState(xpLogicalH)

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1440
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900
  const logicalW = Math.round((vw * draft) / vh)

  const setMinutes = (n: number) => set('screensaver', { ...screensaver, minutes: Math.min(60, Math.max(1, n)) })

  return (
    <div className="xp-dialog" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '7px 8px 8px' }}>
      {/* Barra de pestañas (todas funcionales) */}
      <div style={{ display: 'flex', gap: 2, paddingLeft: 3 }}>
        {TABS.map((t) => {
          const on = t === tab
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                position: 'relative', zIndex: on ? 1 : 0, padding: '3px 8px', fontSize: 11, fontFamily: 'inherit',
                borderRadius: '3px 3px 0 0', border: '1px solid #919b9c', borderBottom: 'none', marginBottom: on ? -1 : 0,
                background: on ? '#ece9d8' : 'linear-gradient(#f4f2ea,#e0ddce)', color: on ? '#000' : '#5f5c52', cursor: 'pointer',
              }}
            >
              {t}
            </button>
          )
        })}
      </div>

      {/* Panel de contenido (borde raised → look tabbed) */}
      <div style={{ flex: 1, minHeight: 0, borderStyle: 'solid', borderWidth: 1, borderColor: '#fff #919b9c #919b9c #fff', background: '#ece9d8', padding: 12, overflow: 'auto' }}>

        {tab === 'Temas' && (
          <GroupBox label="Tema">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 11 }}>Un tema es un cascarón completo: fondo, ventanas y navegación. Cambiarlo recarga el sistema en ese mundo.</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11 }}>Tema:</span>
                <XpSelect
                  value={shell}
                  width={200}
                  onChange={(v) => set('shell', v as typeof shell)}
                  options={[{ value: 'xp', label: 'Windows XP (Luna)' }, { value: 'arcade', label: 'Arcade — el tambor' }]}
                />
              </div>
              <span style={{ fontSize: 10.5, color: '#5f5c52' }}>Elegir «Arcade» te devuelve al tambor giratorio (tu OS original).</span>
            </div>
          </GroupBox>
        )}

        {tab === 'Escritorio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <MiniMonitor src={wallpaperSrc(xpWallpaper)} />
            <GroupBox label="Fondo de escritorio">
              <div className="xp-sunken" style={{ height: 132, overflowY: 'auto', background: '#fff' }}>
                {XP_WALLPAPERS.map((wp) => {
                  const on = wp.key === xpWallpaper
                  return (
                    <button
                      key={wp.key}
                      onClick={() => set('xpWallpaper', wp.key)}
                      style={{ display: 'block', width: '100%', textAlign: 'left', border: 0, padding: '3px 8px', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer', background: on ? XP_BLUE : 'transparent', color: on ? '#fff' : '#000' }}
                    >
                      {wp.label}
                    </button>
                  )
                })}
              </div>
            </GroupBox>
          </div>
        )}

        {tab === 'Protector' && (
          <GroupBox label="Protector de pantalla">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <XpSelect
                  value={xpScreensaver} width={168}
                  onChange={(v) => set('xpScreensaver', v as XpScreensaverKind)}
                  options={SAVERS}
                />
                <button
                  className="xp-raised" onClick={startScreensaver}
                  style={{ padding: '3px 12px', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer' }}
                >
                  Vista previa
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11 }}>Esperar</span>
                <XpSpinner value={screensaver.minutes} width={34} onStep={(dir) => setMinutes(screensaver.minutes + dir)} />
                <span style={{ fontSize: 11 }}>minutos</span>
              </div>
              <XpCheckbox
                checked={discreto}
                onChange={(v) => set('discreto', v)}
                label="Al reanudar, proteger con Modo Discreto"
              />
              <span style={{ fontSize: 10.5, color: '#5f5c52', lineHeight: 1.4 }}>
                El Modo Discreto censura los montos al despertar (el «proteger con contraseña» de este OS).
              </span>
            </div>
          </GroupBox>
        )}

        {tab === 'Apariencia' && (
          <GroupBox label="Apariencia">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: 0.55 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11 }}>Ventanas y botones:</span>
                <XpSelect value="luna" width={150} onChange={() => {}} options={[{ value: 'luna', label: 'Estilo Windows XP' }]} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11 }}>Combinación de colores:</span>
                <XpSelect value="azul" width={120} onChange={() => {}} options={[{ value: 'azul', label: 'Azul (predet.)' }]} />
              </div>
            </div>
            <span style={{ display: 'block', marginTop: 10, fontSize: 10.5, color: '#5f5c52' }}>La apariencia Luna es fija en este tema.</span>
          </GroupBox>
        )}

        {tab === 'Configuración' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <MiniMonitor src={wallpaperSrc(xpWallpaper)}>
              <span style={{ position: 'absolute', bottom: 3, right: 4, fontSize: 8, color: '#fff', textShadow: '0 1px 1px #000' }}>{logicalW}×{draft}</span>
            </MiniMonitor>
            <GroupBox label="Resolución del lienzo">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11 }}>Menos</span>
                  <XpSlider
                    value={draft} min={MIN_H} max={MAX_H} step={20} length={190} ticks={0}
                    onChange={setDraft} onCommit={(v) => set('xpLogicalH', v)}
                  />
                  <span style={{ fontSize: 11 }}>Más</span>
                </div>
                <span style={{ fontSize: 11, textAlign: 'center', fontWeight: 700 }}>{logicalW} × {draft}</span>
                <span style={{ fontSize: 10.5, color: '#5f5c52', lineHeight: 1.4 }}>
                  El escritorio se escala para llenar tu pantalla. <b>Menos</b> = todo más grande; <b>Más</b> = más espacio útil. Se aplica al soltar.
                </span>
              </div>
            </GroupBox>
          </div>
        )}
      </div>
    </div>
  )
}
