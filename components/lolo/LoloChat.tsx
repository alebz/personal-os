'use client'

import { useEffect, useRef, useState } from 'react'
import type { Mode, Bubble, ChatMessage } from './LoloTypes'

interface LoloChatProps {
  mode: Mode
  busy: boolean
  chatMessages: ChatMessage[]
  bubble: Bubble
  messagesRef: React.RefObject<HTMLDivElement | null>
  dialogueRef: React.RefObject<HTMLDivElement | null>
  onScrollDown: () => void
  onBubblePause?: () => void
  onBubbleResume?: () => void
}

const DOT_DELAYS = [0, 0.22, 0.44]

export default function LoloChat({
  mode, busy, chatMessages, bubble,
  messagesRef, dialogueRef, onScrollDown,
  onBubblePause, onBubbleResume,
}: LoloChatProps) {
  const bubbleRef = useRef<HTMLDivElement>(null)
  const [touchPaused, setTouchPaused] = useState(false)

  useEffect(() => {
    if (!touchPaused) return
    function onDocTouch(e: TouchEvent) {
      if (bubbleRef.current?.contains(e.target as Node)) return
      onBubbleResume?.()
      setTouchPaused(false)
    }
    document.addEventListener('touchstart', onDocTouch)
    return () => document.removeEventListener('touchstart', onDocTouch)
  }, [touchPaused, onBubbleResume])

  // Autoscroll: seguir el fondo mientras Lolo escribe, salvo que subas a leer manualmente
  const stickBottomRef = useRef(true)
  useEffect(() => { stickBottomRef.current = true }, [chatMessages])
  useEffect(() => {
    if (mode !== 'chat') return
    const el = messagesRef.current
    if (el && stickBottomRef.current) el.scrollTop = el.scrollHeight
  }, [bubble.text, chatMessages, mode, messagesRef])
  function onMessagesScroll() {
    const el = messagesRef.current
    if (el) stickBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
  }

  return (
    <>
      {/* Chat history — overlays character area when chat mode is active */}
      {mode === 'chat' && (
        <div style={{position:'absolute',left:0,right:0,bottom:0,zIndex:20,minHeight:130,maxHeight:'55%',display:'flex',flexDirection:'column',background:'var(--lcd)',borderTop:'2px solid var(--ink)',animation:'adanBox .18s ease',overflow:'hidden'}}>
          <div ref={messagesRef} onScroll={onMessagesScroll} style={{flex:1,overflowY:'auto',maxHeight:'100%',padding:'8px 12px 4px',scrollbarWidth:'none',minHeight:0} as React.CSSProperties}>
            {chatMessages.length === 0 && !busy && (
              <span style={{fontFamily:"'Press Start 2P',monospace",fontSize:8,color:'var(--ink)',opacity:.3}}>…</span>
            )}
            {chatMessages.filter(m => m.role === 'user').at(-1)?.content && (
              <div style={{fontFamily:"'VT323',monospace",fontSize:30,color:'color-mix(in srgb, var(--ink) 70%, #000)',opacity:.6,marginBottom:4,whiteSpace:'normal',wordBreak:'break-word'}}>
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
              <div style={{fontFamily:"'VT323',monospace",fontSize:38,color:'color-mix(in srgb, var(--ink) 70%, #000)',lineHeight:1.25,whiteSpace:'normal',wordBreak:'break-word',overflowWrap:'break-word'}}>
                {bubble.typing ? bubble.text : chatMessages.filter(m => m.role === 'assistant').at(-1)!.content}
                {bubble.typing && <span style={{display:'inline-block',width:10,color:'var(--ink)',animation:'adanCaret .7s steps(1) infinite'}}>▌</span>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dialogue bubble — spontaneous interventions in non-chat mode */}
      {(bubble.visible || busy) && mode !== 'chat' && (
        <div
          ref={bubbleRef}
          style={{position:'absolute',left:0,right:0,bottom:0,zIndex:15,animation:'adanBox .26s cubic-bezier(.34,1.4,.64,1)'}}
          onMouseEnter={onBubblePause}
          onMouseLeave={onBubbleResume}
          onTouchStart={() => { onBubblePause?.(); setTouchPaused(true) }}
        >
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
                <div style={{fontFamily:"'Press Start 2P',monospace",fontSize:14,lineHeight:1.75,color:'color-mix(in srgb, var(--ink) 70%, #000)',letterSpacing:.3}}>
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
