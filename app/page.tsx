import Panel from '@/components/Panel'
import Shell from '@/components/Shell'
import HabitTracker from '@/components/HabitTracker'
import GoalsCard from '@/components/GoalsCard'
import SessionCard from '@/components/SessionCard'

export default function DashboardPage() {
  return (
    <Shell glow="home">
      <main className="mx-auto max-w-7xl px-6 py-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Left rail */}
          <div className="flex flex-col gap-5 lg:col-span-3">
            <HabitTracker />
            <GoalsCard />
            <Panel title="Quick Capture">
              <p className="text-sm text-ink-3">
                Drop a thought, task, or note. Placeholder for the inbox.
              </p>
            </Panel>
          </div>

          {/* Center stage */}
          <div className="flex flex-col gap-5 lg:col-span-6">
            <SessionCard />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Panel title="Tasks">
                <p className="text-sm text-ink-3">No tasks yet.</p>
              </Panel>
              <Panel title="Recent Activity">
                <p className="text-sm text-ink-3">Nothing recent.</p>
              </Panel>
            </div>
          </div>

          {/* Right rail */}
          <div className="flex flex-col gap-5 lg:col-span-3">
            <Panel title="Upcoming">
              <p className="text-sm text-ink-3">Calendar and reminders placeholder.</p>
            </Panel>
            <Panel title="Signals">
              <p className="text-sm text-ink-3">Metrics and notifications placeholder.</p>
            </Panel>
          </div>
        </div>
      </main>
    </Shell>
  )
}
