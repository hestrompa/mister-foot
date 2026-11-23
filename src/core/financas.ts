// Dinheiro por jornada: bilheteira dos jogos em casa, receitas fixas (TV e patrocínios) e salários.
import type { Clube, Mundo } from './types'
import type { LinhaTabela, Partida } from './partida'
import { lotacaoAtual, avancarObra } from './estadio'
import { cobrarPrestacao } from './banco'

/** Receitas fixas por jornada (TV e patrocínios), por divisão. */
export const RECEITA_FIXA = [50_000, 15_000, 5_000, 5_000]

/** Manutenção do estádio por lugar e por jornada (relvado, segurança, funcionários), por divisão. */
export const MANUTENCAO_LUGAR = [0.6, 0.4, 0.3, 0.2]

/** Preço "normal" do bilhete em cada divisão: acima disto vai menos gente. */
export const BILHETE_NORMAL = [15, 10, 7, 5]

export interface Balanco {
  publico: number
  bilheteira: number
  fixas: number
  salarios: number
  /** Manutenção do estádio nesta jornada. */
  estadio?: number
  saldo: number
  /** Prestação do empréstimo cobrada nesta jornada. */
  banco?: number
  /** Lugares inaugurados nesta jornada (obra acabada). */
  inaugurados?: number
}

/** Quantos adeptos vão ao jogo em casa. Determinístico: depende da reputação, do adversário, da posição e do preço. */
export function publicoEsperado(casa: Clube, fora: Clube, posCasa: number, totalClubes: number): number {
  const d = casa.divisao - 1
  // Procura base: uma parte do estádio, mais para clubes com reputação alta.
  // Lugares acrescentados por obras atraem metade da procura dos originais.
  const base = casa.estadio.base ?? casa.estadio.lugares
  const tamanho = base + 0.5 * Math.max(0, casa.estadio.lugares - base)
  let procura = tamanho * (0.35 + casa.reputacao / 160)
  // Adversário com mais nome atrai mais gente.
  procura *= 0.85 + fora.reputacao / 250
  // Equipa nos lugares de cima enche mais; no fundo, menos.
  const frac = totalClubes > 1 ? posCasa / (totalClubes - 1) : 0.5
  procura *= 1.15 - 0.3 * frac
  // Preço: cada 10% acima do normal tira ~8% do público; abaixo traz mais.
  const rel = casa.bilhete / (BILHETE_NORMAL[d] ?? 5)
  procura *= Math.pow(rel, -0.8)
  return Math.max(0, Math.min(lotacaoAtual(casa), Math.round(procura)))
}

export function salariosPorJornada(mundo: Mundo, clubeId: number): number {
  const mensal = mundo.clubes[clubeId].plantel.reduce((s, id) => s + (mundo.jogadores[id]?.salario ?? 0), 0)
  return Math.round((mensal * 12) / 34)
}

/**
 * Aplica o dinheiro de uma jornada a todos os clubes que jogaram e devolve o balanço de cada um.
 * `tabelas[divisao-1]` é a tabela de antes da jornada (para a procura).
 */
export function aplicarFinancas(mundo: Mundo, partidas: Partida[], tabelas: LinhaTabela[][]): Record<number, Balanco> {
  const out: Record<number, Balanco> = {}
  const posDe = (clubeId: number, div: number) => {
    const t = tabelas[div - 1] ?? []
    const i = t.findIndex((l) => l.clubeId === clubeId)
    return i < 0 ? Math.floor(t.length / 2) : i
  }
  for (const p of partidas) {
    for (const id of [p.casaId, p.foraId]) {
      const c = mundo.clubes[id]
      const emCasa = id === p.casaId
      const publico = emCasa ? publicoEsperado(c, mundo.clubes[p.foraId], posDe(id, c.divisao), (tabelas[c.divisao - 1] ?? []).length || 18) : 0
      const bilheteira = publico * c.bilhete
      const fixas = RECEITA_FIXA[c.divisao - 1] ?? 0
      const salarios = salariosPorJornada(mundo, id)
      const banco = cobrarPrestacao(c)
      const inaugurados = avancarObra(c)
      const estadio = Math.round(c.estadio.lugares * (MANUTENCAO_LUGAR[c.divisao - 1] ?? 0.2))
      const saldo = bilheteira + fixas - salarios - estadio - banco
      c.dinheiro += bilheteira + fixas - salarios - estadio
      out[id] = { publico, bilheteira, fixas, salarios, estadio, saldo }
      if (banco) out[id].banco = banco
      if (inaugurados) out[id].inaugurados = inaugurados
      if (emCasa) { p.publico = publico; p.receita = bilheteira }
    }
  }
  return out
}
