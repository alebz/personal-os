'use client'

import Shell from '@/components/Shell'
import HabitTracker from '@/components/HabitTracker'
import GoalsCard from '@/components/GoalsCard'
import SessionCard from '@/components/SessionCard'
import CumpleanosCard from '@/components/CumpleanosCard'
import CalendarCard from '@/components/CalendarCard'
import TarotCard from '@/components/TarotCard'
import QuickCaptureCard from '@/components/QuickCaptureCard'
import FinancePulseCard from '@/components/FinancePulseCard'

export default function DashboardPage() {
  return (
    <Shell>
      <main className="mx-auto max-w-7xl px-6 py-6">

        {/* ── Zona primaria: lo que ves y tocas primero ──────────────── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Ancla — calendario + captura rápida (mayor uso diario) */}
          <div className="flex flex-col gap-5 lg:col-span-8">
            <CalendarCard />
            <QuickCaptureCard />
          </div>
          {/* Rail — pulso (aquí entra luego el pulse de Uptown) */}
          <div className="flex flex-col gap-5 lg:col-span-4">
            <FinancePulseCard />
            <GoalsCard />
          </div>
        </div>

        {/* ── Zona de seguimiento: ambiente — 4-up escritorio / 2-up tablet ─ */}
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <HabitTracker />
          <SessionCard />
          <CumpleanosCard />
          <TarotCard />
        </div>

      </main>
    </Shell>
  )
}
