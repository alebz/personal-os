import Shell from '@/components/Shell'
import CerebroContent from '@/components/sections/CerebroContent'

// /brain = el command bar de Cerebro (captura + consulta + rainbow), EXACTAMENTE lo que montaba su
// cara del tambor (app/page.tsx SECTIONS: content <CerebroContent/>). Tras la muerte del tambor
// (1954ea5) esta ruta apuntaba a BrainIndex (solo el índice de navegación), huerfanando el command
// bar en el arcade. El índice completo sigue accesible desde el "ver todo →" del propio command bar
// (BrainIndexModal). Bajo XP, CerebroContent cae a MsnCerebro.
export default function BrainPage() {
  return (
    <Shell>
      <CerebroContent />
    </Shell>
  )
}
