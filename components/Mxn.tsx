export const mxn = (n: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)

export default function Mxn({ v, className }: { v: number; className?: string }) {
  return (
    <span data-sensitive className={className}>
      {mxn(v)}
    </span>
  )
}
