import type { Clube } from '../core/types'

/** Emblema simples: sigla nas cores do clube (sem logótipos reais). */
export function Emblema({ clube, tamanho = 36 }: { clube: Clube; tamanho?: number }) {
  const [a, b] = clube.cores
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 40 40" aria-hidden="true" className="emblema">
      <path d="M20 2 L36 8 V20 C36 30 28 36 20 38 C12 36 4 30 4 20 V8 Z" fill={a} stroke={b} strokeWidth="2.5" />
      <path d="M20 2 L20 38 C12 36 4 30 4 20 V8 Z" fill={b} opacity="0.25" />
      <text x="20" y="24.5" textAnchor="middle" fontSize="10" fontWeight="700" fill={b} fontFamily="system-ui, sans-serif">
        {clube.sigla}
      </text>
    </svg>
  )
}
