// Dinheiro extra que não vem das receitas: verba da direção no arranque (ligada à confiança) e
// investidores que aparecem a meio da época quando um clube está a fazer melhor do que se esperava.
import type { Jogo, Mundo } from './types'
import type { EstadoEpoca, LinhaTabela } from './partida'
import { createRng } from './rng'
import { tabela } from './epoca'
import { fixasEpoca, type EpocaComInicio } from './inicio-epoca'
import { lugarEsperado, type JogoComCarreira } from './direcao'

/** Verba da direção com confiança 100, em fração das receitas fixas da época. Abaixo de CONFIANCA_VERBA não há verba. */
export const VERBA_MAX = 0.5
export const CONFIANCA_VERBA = 60

/** Verba da direção para uma dada confiança (0-100). */
export function verbaDirecao(divisao: number, confianca: number): number {
  const k = Math.max(0, (confianca - CONFIANCA_VERBA) / (100 - CONFIANCA_VERBA))
  return Math.round((fixasEpoca(divisao) * VERBA_MAX * k) / 1000) * 1000
}

/**
 * Confiança da direção no fim da época, para todos os clubes: o do mister usa a confiança real; os da IA
 * uma estimativa pelo lugar em relação ao que a reputação prometia na divisão.
 */
export function confiancasFimEpoca(mundo: Mundo, anteriores: LinhaTabela[][], meuId?: number, minha?: number): Map<number, number> {
  const out = new Map<number, number>()
  for (const t of anteriores) {
    const porRep = t.map((l) => l.clubeId).sort((a, b) => mundo.clubes[b].reputacao - mundo.clubes[a].reputacao || a - b)
    t.forEach((l, i) => {
      const esperado = porRep.indexOf(l.clubeId) + 1
      out.set(l.clubeId, Math.max(0, Math.min(100, Math.round(55 + 4 * (esperado - (i + 1))))))
    })
  }
  if (meuId !== undefined && minha !== undefined) out.set(meuId, minha)
  return out
}

/** Paga a verba da direção a cada clube (chamar logo depois de pagarInicioEpoca). */
export function pagarVerbaDirecao(jogo: Jogo, anteriores: LinhaTabela[][]): void {
  const ep = jogo.epoca as EpocaComInicio
  if (!ep.inicio || !anteriores.length) return
  const st = (jogo as JogoComCarreira).carreira
  const minha = st && !st.despedido ? st.confianca : undefined
  const conf = confiancasFimEpoca(jogo.mundo, anteriores, jogo.clubeId, minha)
  for (const [id, inj] of Object.entries(ep.inicio)) {
    const c = jogo.mundo.clubes[Number(id)]
    const cf = conf.get(c.id)
    if (cf === undefined) continue
    const v = verbaDirecao(c.divisao, cf)
    inj.confianca = cf
    if (!v) continue
    inj.direcao = v
    inj.total += v
    c.dinheiro += v
  }
}

export interface Investimento {
  clubeId: number
  jornada: number
  valor: number
  nome: string
}

export type EpocaComInvestidores = EpocaComInicio & { investidores?: Investimento[]; investJornada?: number }
type ClubeComInvestidor = Mundo['clubes'][number] & { investidorAno?: number }

const NOMES_INVESTIDOR = ['Grupo Atlântico', 'Fundo Lusitano', 'Capital do Norte', 'Holding Tejo', 'Investimentos Serra', 'Grupo Maré Alta', 'Fundo Raia', 'Sociedade Douro']
/** Probabilidade por jornada para um clube que está 3+ lugares acima do esperado. */
export const PROB_INVESTIDOR = 0.015
/** Épocas sem novo investidor depois de um entrar. */
const PAUSA = 3

/**
 * A partir da 8.ª jornada, um clube a fazer bem melhor do que se esperava pode receber um investidor
 * (1 a 2 vezes as receitas fixas da época). Idempotente por jornada. Devolve os novos investimentos.
 */
export function avancarInvestidores(mundo: Mundo, epoca: EstadoEpoca): Investimento[] {
  const ep = epoca as EpocaComInvestidores
  const jn = epoca.jornada - 1
  const novos: Investimento[] = []
  if (jn < 8 || jn > epoca.totalJornadas - 2 || (ep.investJornada ?? 0) >= jn) return novos
  ep.investJornada = jn
  ep.investidores ??= []
  for (const div of mundo.divisoes) {
    const t = tabela(mundo, epoca, div.numero)
    t.forEach((l, i) => {
      const c = mundo.clubes[l.clubeId] as ClubeComInvestidor
      if (c.investidorAno !== undefined && epoca.ano - c.investidorAno < PAUSA) return
      if (lugarEsperado(mundo, c.id) - (i + 1) < 3) return
      const rng = createRng(((mundo.semente * 7919) ^ (epoca.ano * 104729) ^ (jn * 131071) ^ (c.id * 2654435761)) >>> 0)
      if (rng.next() >= PROB_INVESTIDOR) return
      const valor = Math.round((fixasEpoca(div.numero) * (1 + rng.next())) / 10_000) * 10_000
      const inv = { clubeId: c.id, jornada: jn, valor, nome: NOMES_INVESTIDOR[Math.floor(rng.next() * NOMES_INVESTIDOR.length)] }
      c.dinheiro += valor
      c.investidorAno = epoca.ano
      ep.investidores!.push(inv)
      novos.push(inv)
    })
  }
  return novos
}
