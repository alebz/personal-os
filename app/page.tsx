import Shell from '@/components/Shell'
import HabitTracker from '@/components/HabitTracker'
import GoalsCard from '@/components/GoalsCard'
import SessionCard from '@/components/SessionCard'
import CumpleanosCard from '@/components/CumpleanosCard'
import CalendarCard from '@/components/CalendarCard'
import TarotCard from '@/components/TarotCard'
import QuickCaptureCard from '@/components/QuickCaptureCard'
import FinancePulseCard from '@/components/FinancePulseCard'
import AdanCompanion from '@/components/AdanCompanion'

export default function DashboardPage() {
  return (
    <Shell>
      <AdanCompanion />
      <main className="mx-auto max-w-7xl px-6 py-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">

          {/* Column 1 — Tarot + Metas */}
          <div className="flex flex-col gap-5 lg:col-span-3">
            <TarotCard />
            <GoalsCard />
          </div>

          {/* Column 2 — Calendar + capture + tasks */}
          <div className="flex flex-col gap-5 lg:col-span-6">
            <CalendarCard />
            <QuickCaptureCard />
            <SessionCard />
          </div>

          {/* Column 3 — Finance + Hábitos + Cumpleaños */}
          <div className="flex flex-col gap-5 lg:col-span-3">
            <FinancePulseCard />
            <HabitTracker />
            <CumpleanosCard />
          </div>

        </div>
      </main>
    </Shell>
  )
}
