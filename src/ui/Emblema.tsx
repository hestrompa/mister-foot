import type { Clube } from '../core/types'
import { emblemaDe, type ClubeComEmblema, type FormaEmblema, type PadraoEmblema } from '../core/editar'

const FORMA: Record<FormaEmblema, string> = {
  escudo: 'M20 2 L36 8 V20 C36 30 28 36 20 38 C12 36 4 30 4 20 V8 Z',
  redondo: 'M20 2 A18 18 0 1 1 19.99 2 Z',
  quadrado: 'M5 3 H35 Q37 3 37 5 V35 Q37 37 35 37 H5 Q3 37 3 35 V5 Q3 3 5 3 Z',
  losango: 'M20 1 L39 20 L20 39 L1 20 Z',
}

function Padrao({ p, cor }: { p: PadraoEmblema; cor: string }) {
  switch (p) {
    case 'metades': return <rect x="0" y="0" width="20" height="40" fill={cor} opacity="0.3" />
    case 'riscas': return <g fill={cor} opacity="0.45">{[6, 16, 26].map((x) => <rect key={x} x={x} y="0" width="5" height="40" />)}</g>
    case 'faixa': return <path d="M-2 10 L10 -2 L42 30 L30 42 Z" fill={cor} opacity="0.45" />
    case 'cruz': return <g fill={cor} opacity="0.4"><rect x="16" y="0" width="8" height="40" /><rect x="0" y="12" width="40" height="7" /></g>
    case 'aro': return <circle cx="20" cy="20" r="11.5" fill="none" stroke={cor} strokeWidth="2" opacity="0.7" />
    default: return null
  }
}

/** Emblema simples: forma, padrão e sigla nas cores do clube (sem logótipos reais). Editável pelo jogador. */
export function Emblema({ clube, tamanho = 36 }: { clube: Pick<Clube, 'sigla' | 'cores'> & Partial<Clube>; tamanho?: number }) {
  const [a, b] = clube.cores
  const e = emblemaDe(clube as ClubeComEmblema)
  const d = FORMA[e.forma] ?? FORMA.escudo
  const id = `em-${(clube.id ?? clube.sigla)}-${e.forma}`.replace(/[^\w-]/g, '')
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 40 40" aria-hidden="true" className="emblema">
      <defs><clipPath id={id}><path d={d} /></clipPath></defs>
      <path d={d} fill={a} />
      <g clipPath={`url(#${id})`}><Padrao p={e.padrao} cor={b} /></g>
      <path d={d} fill="none" stroke={b} strokeWidth="2.5" />
      <text x="20" y="24.5" textAnchor="middle" fontSize="10" fontWeight="700" fill={b} fontFamily="system-ui, sans-serif" stroke={a} strokeWidth="0.6" paintOrder="stroke">
        {clube.sigla}
      </text>
    </svg>
  )
}
