export type ThemeName = 'Mint' | 'Cream' | 'Blush' | 'Slate'
export type Mode = 'normal' | 'chat' | 'cfg'

export interface ChatMessage { role: 'user' | 'assistant'; content: string }
export interface Bubble { visible: boolean; text: string; typing: boolean }
export interface Cfg {
  theme?: string; deviceColor?: string; btnColor?: string
  scanlines?: boolean; distress?: number; provider?: string
}
export type Temperament = 'SERENE' | 'FOCUSED' | 'MOTIVATED' | 'CURIOUS' | 'REFLECTIVE' | 'OVERWHELMED'
export interface TemperamentState { current: Temperament; strength: number; lastChange: string }
export interface SettingsRow { key: string; label: string; value: string; isColor: boolean; swatch: string; readonly?: boolean }
