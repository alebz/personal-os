import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { runPosterImport } from '@/lib/posterImport'

export const runtime = 'nodejs'

// GET /api/publico/poster/cron — lo llama el Vercel Cron 1×/día (Vercel manda GET). Corre el import de la
// ventana (relleno de huecos incluido). Protegido: Vercel agrega `Authorization: Bearer $CRON_SECRET`
// automáticamente si CRON_SECRET está en el entorno; lo verificamos para que nadie más lo dispare.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 401 })
  }
  const r = await runPosterImport(14)
  return NextResponse.json(r, { status: r.ok ? 200 : r.status })
}
