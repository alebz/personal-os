'use client'

import type { SettingsRow } from './LoloTypes'

interface LoloConfigProps {
  settingsRowData: SettingsRow[]
  settingsSel: number
  setSettingsSel: (i: number) => void
  cycleSetting: (key: string) => void
}

export default function LoloConfig({ settingsRowData, settingsSel, setSettingsSel, cycleSetting }: LoloConfigProps) {
  return (
    <div style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',zIndex:40,background:'var(--lcd)',padding:'12px 14px 10px',display:'flex',flexDirection:'column',gap:7,animation:'adanBox .24s ease',overflowY:'auto'}}>
      <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',borderBottom:`2px solid color-mix(in srgb, var(--ink) 30%, transparent)`,paddingBottom:7}}>
        <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:14,letterSpacing:1,color:'var(--ink)'}}>CONFIG</span>
        <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:9,color:'var(--ink)',opacity:.55,letterSpacing:.5}}>toca para cambiar</span>
      </div>
      {settingsRowData.map((row, i) => {
        const isSel = settingsSel === i
        return (
          <div
            key={row.key}
            onClick={() => {
              if (row.readonly) return
              setSettingsSel(i)
              cycleSetting(row.key)
            }}
            style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,padding:'5px 9px',border:`2px solid ${isSel&&!row.readonly?'var(--ink)':'color-mix(in srgb, var(--ink) 25%, transparent)'}`,background:isSel&&!row.readonly?'color-mix(in srgb, var(--ink) 10%, transparent)':'transparent',cursor:row.readonly?'default':'pointer',imageRendering:'pixelated'}}
          >
            <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:13,color:'var(--ink)',letterSpacing:.5,opacity:row.readonly?.6:1}}>{row.label}</span>
            <div style={{display:'flex',alignItems:'center',gap:7}}>
              {row.isColor && (
                <span style={{width:13,height:13,border:'2px solid var(--ink)',background:row.swatch,imageRendering:'pixelated',display:'inline-block',borderRadius:row.swatch.startsWith('linear')?2:0}} />
              )}
              <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:13,letterSpacing:.5,color:'var(--ink)',opacity:row.readonly?.75:1}}>{row.value}</span>
            </div>
          </div>
        )
      })}
      <div style={{marginTop:'auto',fontFamily:"'Press Start 2P',monospace",fontSize:9,color:'var(--ink)',opacity:.5,letterSpacing:.5,textAlign:'right'}}>BCK para cerrar</div>
    </div>
  )
}
