export function euros(v: number): string {
  const a = Math.abs(v)
  const s = v < 0 ? '-' : ''
  if (a >= 1_000_000) return `${s}${(a / 1_000_000).toLocaleString('pt-PT', { maximumFractionDigits: 1 })} M€`
  if (a >= 1_000) return `${s}${Math.round(a / 1_000).toLocaleString('pt-PT')} mil €`
  return `${s}${Math.round(a)} €`
}

export function lugares(n: number): string {
  return n.toLocaleString('pt-PT')
}
