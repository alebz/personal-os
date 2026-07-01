'use client'

import type { Mode, Bubble, ChatMessage } from './LoloTypes'

interface LoloChatProps {
  mode: Mode
  busy: boolean
  chatMessages: ChatMessage[]
  bubble: Bubble
  messagesRef: React.RefObject<HTMLDivElement | null>
  inputRef: React.RefObject<HTMLInputElement | null>
  dialogueRef: React.RefObject<HTMLDivElement | null>
  onInputKey: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onSend: () => void
  onScrollDown: () => void
}

const DOT_DELAYS = [0, 0.22, 0.44]

export default function LoloChat({
  mode, busy, chatMessages, bubble,
  messagesRef, inputRef, dialogueRef,
  onInputKey, onSend, onScrollDown,
}: LoloChatProps) {
  return (
    <>
      {/* GBA chat overlay — sits on top of Lolo in chat mode */}
      {mode === 'chat' && (
        <div style={{position:'absolute',left:0,right:0,bottom:0,zIndex:20,minHeight:130,maxHeight:'55%',display:'flex',flexDirection:'column',background:'var(--lcd)',borderTop:'2px solid var(--ink)',animation:'adanBox .18s ease',overflow:'hidden'}}>
          <div ref={messagesRef} style={{flex:1,overflowY:'auto',maxHeight:'100%',padding:'8px 12px 4px',scrollbarWidth:'none',minHeight:0} as React.CSSProperties}>
            {chatMessages.length === 0 && !busy && (
              <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:8,color:'var(--ink)',opacity:.3}}>…</span>
            )}
            {chatMessages.filter(m => m.role === 'user').at(-1)?.content && (
              <div style={{fontFamily:"'VT323',monospace",fontSize:26,color:'var(--ink)',opacity:.6,marginBottom:4,whiteSpace:'normal',wordBreak:'break-word'}}>
                › {chatMessages.filter(m => m.role === 'user').at(-1)!.content}
              </div>
            )}
            {busy && (
              <div style={{display:'flex',gap:6,padding:'4px 0',alignItems:'center'}}>
                {DOT_DELAYS.map((d, i) => (
                  <span key={i} style={{width:6,height:6,borderRadius:0,background:'var(--ink)',imageRendering:'pixelated',animation:`adanDot 1.1s steps(1) ${d}s infinite`,display:'inline-block'}} />
                ))}
              </div>
            )}
            {!busy && chatMessages.filter(m => m.role === 'assistant').at(-1)?.content && (
              <div style={{fontFamily:"'VT323',monospace",fontSize:30,color:'var(--ink)',lineHeight:1.25,whiteSpace:'normal',wordBreak:'break-word',overflowWrap:'break-word'}}>
                {chatMessages.filter(m => m.role === 'assistant').at(-1)!.content}
              </div>
            )}
          </div>
          <div style={{height:48,flexShrink:0,display:'flex',alignItems:'center',borderTop:'1px solid var(--ink)',background:'var(--lcd)',padding:'0 8px',gap:4}}>
            <input
              ref={inputRef}
              onKeyDown={onInputKey}
              placeholder="habla con lolo…"
              maxLength={160}
              style={{flex:1,width:'100%',border:'none',background:'rgba(0,0,0,0.08)',padding:'4px 8px',fontFamily:"'VT323',monospace",fontSize:20,color:'#1a1a1a',outline:'none',letterSpacing:.5}}
            />
            <button onClick={onSend} style={{flexShrink:0,border:'none',background:'transparent',cursor:'pointer',display:'grid',placeItems:'center' as const,padding:0}}>
              <svg width="13" height="13" viewBox="0 0 14 14" style={{imageRendering:'pixelated',display:'block'}}>
                <rect x="0"  y="4"  width="2" height="6"  fill="var(--ink)"/>
                <rect x="2"  y="2"  width="2" height="10" fill="var(--ink)"/>
                <rect x="4"  y="0"  width="2" height="14" fill="var(--ink)"/>
                <rect x="6"  y="2"  width="2" height="10" fill="var(--ink)"/>
                <rect x="8"  y="4"  width="2" height="6"  fill="var(--ink)"/>
                <rect x="10" y="6"  width="2" height="2"  fill="var(--ink)"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Dialogue bubble — normal mode only */}
      {(bubble.visible || busy) && mode !== 'chat' && (
        <div style={{position:'absolute',left:0,right:0,bottom:0,zIndex:15,animation:'adanBox .26s cubic-bezier(.34,1.4,.64,1)'}}>
          <div style={{position:'relative',background:'var(--lcd)',border:'3px solid var(--ink)',borderRadius:2,boxShadow:'inset 2px 2px 0 rgba(255,255,255,.55),inset -2px -2px 0 rgba(0,0,0,.12),5px 5px 0 color-mix(in srgb, var(--ink) 22%, transparent)'}}>
            <div
              ref={dialogueRef}
              style={{padding:'18px 16px 14px',minHeight:88,maxHeight:200,overflowY:'auto',scrollbarWidth:'none',scrollBehavior:'smooth'} as React.CSSProperties}
            >
              <div style={{position:'absolute',top:-16,left:14,background:'var(--ink)',color:'var(--lcd)',fontFamily:"'Press Start 2P',monospace",fontSize:9,letterSpacing:1,padding:'5px 9px 6px',borderRadius:2,boxShadow:'2px 2px 0 rgba(0,0,0,.25)'}}>LOLO</div>
              {busy && (
                <div style={{display:'flex',gap:6,padding:'14px 6px',alignItems:'center'}}>
                  {DOT_DELAYS.map((d, i) => (
                    <span key={i} style={{width:8,height:8,borderRadius:0,background:'var(--ink)',imageRendering:'pixelated',animation:`adanDot 1.1s steps(1) ${d}s infinite`,display:'inline-block'}} />
                  ))}
                </div>
              )}
              {!busy && bubble.text && (
                <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:12,lineHeight:1.75,color:'var(--ink)',letterSpacing:.3}}>
                  {bubble.text}
                  {bubble.typing && <span style={{display:'inline-block',width:10,color:'var(--ink)',animation:'adanCaret .7s steps(1) infinite'}}>▌</span>}
                </div>
              )}
              {bubble.visible && !busy && !bubble.typing && (
                <span onClick={onScrollDown} style={{position:'absolute',right:12,bottom:7,color:'var(--ink)',fontSize:15,animation:'adanCaret .9s steps(1) infinite',cursor:'pointer',zIndex:2}}>▼</span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
