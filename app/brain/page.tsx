import Shell from '@/components/Shell'
import BrainIndex from '@/components/BrainIndex'

// Direct-URL access to the memory index (kept alive for isolated testing). The same BrainIndex also
// renders inside the drum's BrainIndexModal — one component, zero duplication.
export default function BrainPage() {
  return (
    <Shell>
      <main className="mx-auto w-full max-w-3xl px-6 pt-[7vh] pb-28">
        <BrainIndex />
      </main>
    </Shell>
  )
}
