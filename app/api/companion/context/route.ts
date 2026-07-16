import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import ICAL from 'ical.js'

export const runtime = 'nodejs'

interface HabitDef { id: string; label: string }

function daysUntilBirthday(birthday: string): number {
  const parts = birthday.split('-').map(Number)
  const m = parts.length === 3 ? parts[1] : parts[0]
  const d = parts.length === 3 ? parts[2] : parts[1]
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const thisYear = new Date(today.getFullYear(), m - 1, d)
  const diff = Math.round((thisYear.getTime() - today.getTime()) / 86400000)
  if (diff >= 0) return diff
  return Math.round((new Date(today.getFullYear() + 1, m - 1, d).getTime() - today.getTime()) / 86400000)
}

function daysSince(dateStr: string): number {
  const d = new Date(dateStr)
  const now = new Date()
  return Math.floor((now.getTime() - d.getTime()) / 86400000)
}

// GET /api/companion/context
// Full OS snapshot for Adán — every data source in Alex's personal OS.
export async function GET(req: NextRequest) {
  const supabase = createServerClient()
  let body: { localDate?: string; habitDefs?: HabitDef[] } = {}
  try { body = await req.json() } catch { /* no body is fine */ }

  // Prefer client-supplied local date; fall back to server-side Mexico City time
  const today = body.localDate ?? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
  const todayMonth = today.slice(5, 7)
  const todayDay   = today.slice(8, 10)

  const sections: string[] = []

  // ═══════════════════════════════════════════════════════════
  // FECHA Y CALENDARIO
  // ═══════════════════════════════════════════════════════════
  const dateLines: string[] = [`Fecha: ${today}`]

  try {
    const calUrl = process.env.APPLE_CALENDAR_ICAL_URL
    if (calUrl) {
      const url = calUrl.replace(/^webcal:\/\//i, 'https://')
      const res = await fetch(url, { cache: 'no-store' })
      if (res.ok) {
        const raw = await res.text()
        const comp = new ICAL.Component(ICAL.parse(raw))
        const todayEvents: string[] = []
        const soonEvents: string[] = []
        comp.getAllSubcomponents('vevent').forEach((vevent) => {
          const ev = new ICAL.Event(vevent)
          const startStr = ev.startDate?.toString().slice(0, 10) ?? ''
          if (startStr === today) todayEvents.push(ev.summary ?? '')
          else if (startStr > today && startStr <= today.slice(0,8) + String(Number(todayDay)+7).padStart(2,'0')) {
            soonEvents.push(`${ev.summary} (${startStr})`)
          }
        })
        if (todayEvents.length) dateLines.push(`Eventos hoy: ${todayEvents.join(', ')}`)
        if (soonEvents.length)  dateLines.push(`Próximos eventos: ${soonEvents.slice(0,5).join(', ')}`)
      }
    }
  } catch { /* ignore */ }

  sections.push(dateLines.join('\n'))

  // ═══════════════════════════════════════════════════════════
  // CUMPLEAÑOS
  // ═══════════════════════════════════════════════════════════
  try {
    const { data: contacts } = await supabase
      .from('contacts')
      .select('name, birthday, category')
      .not('birthday', 'is', null)

    if (contacts?.length) {
      const withDays = contacts
        .filter(c => c.birthday)
        .map(c => ({ ...c, days: daysUntilBirthday(c.birthday) }))
        .sort((a, b) => a.days - b.days)

      const bLines: string[] = []
      const todayB = withDays.filter(c => c.days === 0)
      const soonB  = withDays.filter(c => c.days > 0 && c.days <= 30)

      if (todayB.length) bLines.push(`HOY cumple años: ${todayB.map(c => `${c.name} (${c.category})`).join(', ')}`)
      if (soonB.length)  bLines.push(`Próximos 30 días: ${soonB.map(c => `${c.name} en ${c.days}d`).join(', ')}`)
      if (bLines.length) sections.push('CUMPLEAÑOS\n' + bLines.join('\n'))
    }
  } catch { /* ignore */ }

  // ═══════════════════════════════════════════════════════════
  // HÁBITOS
  // ═══════════════════════════════════════════════════════════
  try {
    const { data } = await supabase
      .from('daily_logs')
      .select('metadata')
      .eq('kind', 'habits')
      .eq('log_date', today)
      .maybeSingle()

    console.log('[companion/context] habits query — today:', today, '| raw data:', JSON.stringify(data))
    const habits = (data?.metadata as { habits?: { done?: string[]; total?: number } } | null)?.habits
    const habitDefs: HabitDef[] = body.habitDefs ?? []
    const doneIds: string[] = habits?.done ?? []

    if (habitDefs.length > 0 || doneIds.length > 0) {
      const total = habitDefs.length || habits?.total || doneIds.length
      const doneLabels   = doneIds.map(id => habitDefs.find(h => h.id === id)?.label ?? id)
      const pendingLabels = habitDefs.filter(h => !doneIds.includes(h.id)).map(h => h.label)
      const hLines = [`Hoy: ${doneIds.length}/${total} completados`]
      if (doneLabels.length)   hLines.push(`Hechos: ${doneLabels.join(', ')}`)
      if (pendingLabels.length) hLines.push(`Pendientes: ${pendingLabels.join(', ')}`)
      sections.push('HÁBITOS\n' + hLines.join('\n'))
    }
  } catch { /* ignore */ }

  // ═══════════════════════════════════════════════════════════
  // METAS
  // ═══════════════════════════════════════════════════════════
  try {
    const { data } = await supabase
      .from('daily_logs')
      .select('metadata')
      .eq('kind', 'goals')
      .eq('log_date', '2000-01-01')
      .maybeSingle()

    const meta = data?.metadata as {
      goals_week?:  { text: string; done: boolean }[]
      goals_month?: { text: string; done: boolean }[]
    } | null

    const week  = meta?.goals_week  ?? []
    const month = meta?.goals_month ?? []
    const gLines: string[] = []

    if (week.length) {
      gLines.push(`Semanales: ${week.filter(g => g.done).length}/${week.length} hechas`)
      const pendW = week.filter(g => !g.done).map(g => g.text)
      if (pendW.length) gLines.push(`  Pendientes: ${pendW.join(', ')}`)
      const doneW = week.filter(g => g.done).map(g => g.text)
      if (doneW.length) gLines.push(`  Completadas: ${doneW.join(', ')}`)
    }
    if (month.length) {
      gLines.push(`Mensuales: ${month.filter(g => g.done).length}/${month.length} hechas`)
      const pendM = month.filter(g => !g.done).map(g => g.text)
      if (pendM.length) gLines.push(`  Pendientes: ${pendM.join(', ')}`)
    }
    if (gLines.length) sections.push('METAS\n' + gLines.join('\n'))
  } catch { /* ignore */ }

  // ═══════════════════════════════════════════════════════════
  // TAREAS
  // ═══════════════════════════════════════════════════════════
  try {
    const { data } = await supabase
      .from('tasks')
      .select('title, urgency, priority_score, tags, entity_name')
      .is('completed_at', null)
      .order('priority_score', { ascending: false, nullsFirst: false })
      .limit(10)

    if (data?.length) {
      const tLines = data.map(t => {
        let s = `- ${t.title}`
        if (t.urgency)     s += ` [${t.urgency}]`
        if (t.entity_name) s += ` · ${t.entity_name}`
        return s
      })
      sections.push(`TAREAS ABIERTAS (${data.length})\n` + tLines.join('\n'))
    }
  } catch { /* ignore */ }

  // ═══════════════════════════════════════════════════════════
  // JOURNAL (últimas entradas)
  // ═══════════════════════════════════════════════════════════
  try {
    const { data } = await supabase
      .from('journal_entries')
      .select('entry_date, mood, summary')
      .order('entry_date', { ascending: false })
      .limit(5)

    if (data?.length) {
      const jLines = data.map(e => {
        let s = `${e.entry_date}`
        if (e.mood)    s += ` [mood: ${e.mood}]`
        if (e.summary) s += `: ${e.summary}`
        return s
      })
      sections.push('JOURNAL (últimas entradas)\n' + jLines.join('\n'))
    }
  } catch { /* ignore */ }

  // ═══════════════════════════════════════════════════════════
  // NUTRICIÓN (hoy)
  // ═══════════════════════════════════════════════════════════
  try {
    const { data } = await supabase
      .from('daily_logs')
      .select('metadata')
      .eq('kind', 'nutrition')
      .eq('log_date', today)
      .maybeSingle()

    const meals = (data?.metadata as { nutrition?: { meals?: { n: string; kcal: number }[] } } | null)
      ?.nutrition?.meals ?? []

    if (meals.length) {
      const kcal = meals.reduce((s, m) => s + (m.kcal ?? 0), 0)
      const names = meals.map(m => m.n).join(', ')
      sections.push(`NUTRICIÓN HOY\nCalorías: ${Math.round(kcal)} kcal\nComidas: ${names}`)
    }
  } catch { /* ignore */ }

  // ═══════════════════════════════════════════════════════════
  // FINANZAS
  // ═══════════════════════════════════════════════════════════
  try {
    const [balRes, commRes, envRes, incRes, fundMovsRes] = await Promise.all([
      supabase.from('finance_balance').select('tarjeta,efectivo').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('finance_commitments').select('name,amount,active').eq('active', true).order('sort_order'),
      supabase.from('finance_envelopes').select('id,key,label,target,archived').eq('archived', false).order('sort_order'),
      supabase.from('finance_income_items').select('nombre,monto,metodo').eq('active', true).order('sort_order'),
      supabase.from('finance_movements').select('envelope_id,amount,flow').not('envelope_id', 'is', null),
    ])

    // Per-fund saved (flow-aware). "Guardado" = Σ of every ACTIVE fund EXCEPT mantenimiento (Uptown's).
    // envRes is already filtered to active funds; archived ones simply aren't in it. Replaces the
    // now-frozen finance_balance.caja_fuerte snapshot column.
    const activeIds = new Set((envRes.data ?? []).map((e: { id: string }) => e.id))
    const mantId = (envRes.data ?? []).find((e: { key: string | null }) => e.key === 'mantenimiento')?.id
    const savedByEnv: Record<string, number> = {}
    for (const m of (fundMovsRes.data ?? []) as Array<{ envelope_id: string | null; amount: number; flow: string }>) {
      if (m.envelope_id && activeIds.has(m.envelope_id)) savedByEnv[m.envelope_id] = (savedByEnv[m.envelope_id] ?? 0) + (m.flow === 'out' ? Number(m.amount) : -Number(m.amount))
    }
    const guardado = Object.entries(savedByEnv).reduce((s, [envId, v]) => envId === mantId ? s : s + v, 0)

    const fLines: string[] = []

    const bal = balRes.data
    if (bal) {
      const total = (bal.tarjeta ?? 0) + (bal.efectivo ?? 0) + guardado
      fLines.push(`Balance: $${total.toLocaleString('es-MX')} total (tarjeta $${(bal.tarjeta??0).toLocaleString('es-MX')}, efectivo $${(bal.efectivo??0).toLocaleString('es-MX')}, guardado $${guardado.toLocaleString('es-MX')})`)
    }

    const incs = incRes.data ?? []
    if (incs.length) {
      const totalInc = incs.reduce((s, i) => s + Number(i.monto ?? 0), 0)
      fLines.push(`Ingresos mensuales: $${totalInc.toLocaleString('es-MX')} (${incs.map(i => `${i.nombre}: $${Number(i.monto).toLocaleString('es-MX')}`).join(', ')})`)
    }

    const comms = commRes.data ?? []
    if (comms.length) {
      const totalComm = comms.reduce((s, c) => s + Number(c.amount ?? 0), 0)
      fLines.push(`Compromisos fijos: $${totalComm.toLocaleString('es-MX')}/mes (${comms.map(c => `${c.name}: $${Number(c.amount).toLocaleString('es-MX')}`).join(', ')})`)
    }

    const apartados = (envRes.data ?? []).filter((e: { key: string | null }) => e.key !== 'mantenimiento')
    if (apartados.length) {
      const eList = apartados.map((e: { id: string; label: string; target: number | null }) => {
        const s = savedByEnv[e.id] ?? 0
        return e.target
          ? `${e.label}: $${s.toLocaleString('es-MX')}/$${Number(e.target).toLocaleString('es-MX')}`
          : `${e.label}: $${s.toLocaleString('es-MX')}`
      })
      fLines.push(`Apartados (Caja Fuerte): ${eList.join(', ')}`)
    }

    if (fLines.length) sections.push('FINANZAS\n' + fLines.join('\n'))
  } catch { /* ignore */ }

  // ═══════════════════════════════════════════════════════════
  // CONTACTOS CRM (últimos contactados + sin contactar)
  // ═══════════════════════════════════════════════════════════
  try {
    const { data: contacts } = await supabase
      .from('contacts')
      .select('name, category, last_contacted, notes, company')
      .order('name')

    if (contacts?.length) {
      const cLines: string[] = [`Total contactos: ${contacts.length}`]

      const stale = contacts
        .filter(c => c.last_contacted && daysSince(c.last_contacted) > 30)
        .map(c => `${c.name} (hace ${daysSince(c.last_contacted!)}d)`)
        .slice(0, 5)
      if (stale.length) cLines.push(`Sin contactar hace >30 días: ${stale.join(', ')}`)

      const never = contacts.filter(c => !c.last_contacted).map(c => c.name).slice(0, 5)
      if (never.length) cLines.push(`Nunca contactados: ${never.join(', ')}`)

      // Full roster by category
      const byCategory: Record<string, string[]> = {}
      contacts.forEach(c => {
        const cat = c.category ?? 'Sin categoría'
        if (!byCategory[cat]) byCategory[cat] = []
        byCategory[cat].push(c.name)
      })
      Object.entries(byCategory).forEach(([cat, names]) => {
        cLines.push(`${cat}: ${names.join(', ')}`)
      })

      sections.push('CONTACTOS\n' + cLines.join('\n'))
    }
  } catch { /* ignore */ }

  // ═══════════════════════════════════════════════════════════
  // ENTIDADES (empresas/proyectos)
  // ═══════════════════════════════════════════════════════════
  try {
    const { data: entities } = await supabase
      .from('entities')
      .select('name, type')
      .order('name')

    if (entities?.length) {
      const byType: Record<string, string[]> = {}
      entities.forEach(e => {
        if (!byType[e.type]) byType[e.type] = []
        byType[e.type].push(e.name)
      })
      const eLines = Object.entries(byType).map(([t, names]) => `${t}: ${names.join(', ')}`)
      sections.push('ENTIDADES\n' + eLines.join('\n'))
    }
  } catch { /* ignore */ }

  // ═══════════════════════════════════════════════════════════
  // UPTOWN (negocio)
  // ═══════════════════════════════════════════════════════════
  try {
    const currentMonth = today.slice(0, 7)
    const [rentsRes, nominaRes, extraIncRes, extraExpRes, balRes, expRes] = await Promise.all([
      supabase.from('uptown_rents').select('renter,amount,paid').eq('month', currentMonth),
      supabase.from('uptown_nomina').select('week_num,amount,paid').eq('month', currentMonth).order('week_num'),
      supabase.from('uptown_extra_income').select('description,amount').eq('month', currentMonth),
      supabase.from('uptown_extra_expenses').select('description,amount').eq('month', currentMonth),
      supabase.from('uptown_balance').select('starting_balance,cuenta_bancaria,efectivo').eq('month', currentMonth).maybeSingle(),
      supabase.from('uptown_fixed_expenses').select('category,amount,paid').eq('month', currentMonth),
    ])

    const uLines: string[] = []
    const bal = balRes.data
    if (bal) {
      const liquid = (bal.cuenta_bancaria ?? 0) + (bal.efectivo ?? 0)
      uLines.push(`Balance: $${liquid.toLocaleString('es-MX')} (banco $${Number(bal.cuenta_bancaria??0).toLocaleString('es-MX')}, efectivo $${Number(bal.efectivo??0).toLocaleString('es-MX')})`)
    }
    const rents = rentsRes.data ?? []
    if (rents.length) {
      const totalRent = rents.reduce((s, r) => s + Number(r.amount), 0)
      const paidCount = rents.filter(r => r.paid).length
      uLines.push(`Rentas: $${totalRent.toLocaleString('es-MX')} · ${paidCount}/${rents.length} cobradas`)
      const unpaid = rents.filter(r => !r.paid).map(r => r.renter)
      if (unpaid.length) uLines.push(`  Sin cobrar: ${unpaid.join(', ')}`)
    }
    const nomina = nominaRes.data ?? []
    if (nomina.length) {
      const totalNom = nomina.reduce((s, n) => s + Number(n.amount), 0)
      const paidNom  = nomina.filter(n => n.paid).length
      uLines.push(`Nómina: $${totalNom.toLocaleString('es-MX')} · ${paidNom}/${nomina.length} semanas pagadas`)
    }
    const extraInc = extraIncRes.data ?? []
    if (extraInc.length) {
      const total = extraInc.reduce((s, e) => s + Number(e.amount), 0)
      uLines.push(`Ingresos extra: $${total.toLocaleString('es-MX')} (${extraInc.map(e => e.description).join(', ')})`)
    }
    const extraExp = extraExpRes.data ?? []
    if (extraExp.length) {
      const total = extraExp.reduce((s, e) => s + Number(e.amount), 0)
      uLines.push(`Gastos extra: $${total.toLocaleString('es-MX')} (${extraExp.map(e => e.description).join(', ')})`)
    }
    const fixedExp = expRes.data ?? []
    if (fixedExp.length) {
      const unpaidFixed = fixedExp.filter(e => !e.paid).map(e => e.category)
      if (unpaidFixed.length) uLines.push(`Gastos fijos sin pagar: ${unpaidFixed.join(', ')}`)
    }
    if (uLines.length) sections.push(`UPTOWN — NEGOCIO (${currentMonth})\n` + uLines.join('\n'))
  } catch { /* ignore */ }

  const context = sections.join('\n\n')
  return NextResponse.json({ context })
}
