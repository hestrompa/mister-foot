// Rivalidades: cada clube pertence a uma região; clubes da mesma região jogam dérbis e cada um tem um
// grande rival (o vizinho de reputação mais próxima). Determinístico a partir da semente do mundo.
import { createRng } from './rng'
import type { Clube, Mundo } from './types'
import { divisoesDoPais, PAIS_BASE, paisDe, paisesDoMundo } from './ligas'
import { NOMES_LIGA } from './nomes-ligas'

export const REGIOES: { nome: string; de: string; pais?: string }[] = [
  { nome: 'Minho', de: 'do Minho' }, { nome: 'Douro', de: 'do Douro' }, { nome: 'Beira Serra', de: 'da Beira Serra' },
  { nome: 'Beira Litoral', de: 'da Beira Litoral' }, { nome: 'Ribatejo', de: 'do Ribatejo' }, { nome: 'Estremadura', de: 'da Estremadura' },
  { nome: 'Alentejo', de: 'do Alentejo' }, { nome: 'Algarve', de: 'do Algarve' },
  ...Object.entries(NOMES_LIGA).flatMap(([pais, n]) => n.regioes.map((r) => ({ ...r, pais }))),
]
const REGIOES_PT = 8

export type ClubeComRivais = Clube & {
  /** Índice em REGIOES. */
  regiao?: number
  /** O grande rival (clássico). */
  rival?: number
}

export interface Rivalidade {
  tipo: 'classico' | 'derbi'
  /** Ex.: "Clássico do Douro", "Dérbi do Douro". */
  nome: string
  /** Multiplicador da procura de bilhetes. */
  publico: number
}

/** Regiões de cada país: Portugal usa REGIOES[0..7]; os estrangeiros vêm a seguir (ver nomes-ligas). */
function regioesDoPais(pais: string): number[] {
  if (pais === PAIS_BASE) return Array.from({ length: REGIOES_PT }, (_, i) => i)
  return REGIOES.map((r, i) => (r.pais === pais ? i : -1)).filter((i) => i >= 0)
}

/** Dá região e grande rival aos clubes que ainda não têm. Devolve true se mudou alguma coisa. */
export function garantirRivais(mundo: Mundo): boolean {
  const clubes = Object.values(mundo.clubes) as ClubeComRivais[]
  if (clubes.every((c) => c.regiao !== undefined)) return false
  const rng = createRng(((mundo.semente ^ 0x5a17d3) >>> 0) || 1)
  for (const pais of paisesDoMundo(mundo)) {
    const regs = regioesDoPais(pais)
    if (!regs.length) continue
    const doPais = clubes.filter((c) => paisDe(c) === pais)
    if (doPais.every((c) => c.regiao !== undefined)) { rng.next(); continue }
    // Cada divisão espalha os seus clubes pelas regiões (2 ou 3 por região), para haver dérbis em todas.
    for (const d of divisoesDoPais(mundo, pais).sort((a, b) => a.numero - b.numero)) {
      const ids = rng.shuffle([...d.clubes].sort((a, b) => a - b))
      const desvio = rng.int(0, regs.length - 1)
      ids.forEach((id, i) => { (mundo.clubes[id] as ClubeComRivais).regiao = regs[(i + desvio) % regs.length] })
    }
    for (const r of regs) {
      // Pares dentro da divisão (por reputação); quem sobra emparelha com o mais próximo da região.
      const daRegiao = doPais.filter((c) => c.regiao === r).sort((a, b) => a.divisao - b.divisao || b.reputacao - a.reputacao || a.id - b.id)
      const livres: ClubeComRivais[] = []
      for (const div of [...new Set(daRegiao.map((c) => c.divisao))]) {
        const desta = daRegiao.filter((c) => c.divisao === div)
        let i = 0
        for (; i + 1 < desta.length; i += 2) { desta[i].rival = desta[i + 1].id; desta[i + 1].rival = desta[i].id }
        if (i < desta.length) livres.push(desta[i])
      }
      for (let i = 0; i + 1 < livres.length; i += 2) { livres[i].rival = livres[i + 1].id; livres[i + 1].rival = livres[i].id }
      // Número ímpar: o último fica rival de um vizinho (rivalidade de um só lado).
      const ultimo = livres.length % 2 === 1 ? livres[livres.length - 1] : undefined
      if (ultimo) ultimo.rival = daRegiao.find((c) => c.id !== ultimo.id)?.id
    }
  }
  return true
}

export function regiaoDe(c: Clube | undefined): { nome: string; de: string } | undefined {
  const r = (c as ClubeComRivais | undefined)?.regiao
  return r === undefined ? undefined : REGIOES[r]
}

/** A rivalidade entre dois clubes, ou null. */
export function rivalidade(a: Clube | undefined, b: Clube | undefined): Rivalidade | null {
  const ca = a as ClubeComRivais | undefined
  const cb = b as ClubeComRivais | undefined
  if (!ca || !cb || ca.regiao === undefined || ca.regiao !== cb.regiao) return null
  const reg = REGIOES[ca.regiao]
  if (ca.rival === cb.id || cb.rival === ca.id) return { tipo: 'classico', nome: `Clássico ${reg.de}`, publico: 1.35 }
  return { tipo: 'derbi', nome: `Dérbi ${reg.de}`, publico: 1.15 }
}

/** Rivais de um clube: o grande rival primeiro, depois os vizinhos da região (por reputação). */
export function rivaisDe(mundo: Mundo, clubeId: number): { clube: Clube; r: Rivalidade }[] {
  const c = mundo.clubes[clubeId]
  const out: { clube: Clube; r: Rivalidade }[] = []
  for (const o of Object.values(mundo.clubes)) {
    if (o.id === clubeId) continue
    const r = rivalidade(c, o)
    if (r) out.push({ clube: o, r })
  }
  return out.sort((x, y) => (x.r.tipo === 'classico' ? 0 : 1) - (y.r.tipo === 'classico' ? 0 : 1) || y.clube.reputacao - x.clube.reputacao)
}
