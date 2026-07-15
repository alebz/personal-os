import type { ReactNode } from 'react'

// Fixed-width, centered cell for the payment-method emoji (💵 / 💳) in movement rows.
// Shared by FinanzasContent (MethodBadge, display) and UptownContent (MethodToggle, interactive)
// so the emoji column stays aligned and rows WITHOUT a method still reserve the slot. Alignment of
// the column ultimately needs the AMOUNT cell after it to be fixed-width too (see the consumers);
// this cell keeps the emoji glyph consistent and the slot reserved. Only the cell is shared — the
// interaction (badge vs toggle) stays per-file.
export function MethodCell({ children }: { children?: ReactNode }) {
  return <span className="flex w-5 shrink-0 items-center justify-center">{children}</span>
}
