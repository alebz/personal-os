import Shell from '@/components/Shell'
import HabitTracker from '@/components/HabitTracker'
import GoalsCard from '@/components/GoalsCard'
import SessionCard from '@/components/SessionCard'
import CumpleanosCard from '@/components/CumpleanosCard'
import CalendarCard from '@/components/CalendarCard'
import DailyQuoteCard from '@/components/DailyQuoteCard'
import QuickCaptureCard from '@/components/QuickCaptureCard'
import AdanCompanion from '@/components/AdanCompanion'

export default function DashboardPage() {
  return (
    <Shell glow="home">
      <main className="mx-auto max-w-7xl px-6 py-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">

          {/* Left rail */}
          <div className="flex flex-col gap-5 lg:col-span-3">
            <DailyQuoteCard />
            <HabitTracker />
            <QuickCaptureCard />
          </div>

          {/* Center stage */}
          <div className="flex flex-col gap-5 lg:col-span-6">
            <SessionCard />
            <GoalsCard />
          </div>

          {/* Right rail */}
          <div className="flex flex-col gap-5 lg:col-span-3">
            <CalendarCard />
            <CumpleanosCard />
          </div>

        </div>
      </main>
      <AdanCompanion />
    </Shell>
  )
}
