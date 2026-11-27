// Previsão de tesouraria até ao fim da época e histórico financeiro das épocas do mister.
import { nivelDe } from './ligas'
import type { Jogo } from './types'
import type { EstadoEpoca } from './partida'
import { publicoEsperado, salariosPorJornada, MANUTENCAO_LUGAR, RECEITA_FIXA } from './financas'
import { custoStaffPorJornada } from './staff'
import { PARTE_JORNADA, type EpocaComInicio } from './inicio-epoca'

export interface Previsao {
  jornadasFalta: number
  receitaJornada: number
  despesaJornada: number
  banco: number
  caixaFim: number
}

/** Caixa prevista no fim da época, se nada mudar (sem taça, Europa nem mercado). */
export function previsaoFimEpoca(jogo: Jogo): Previsao {
  const { mundo, epoca } = jogo
  const c = mundo.clubes[jogo.clubeId]
  const ep = epoca as EpocaComInicio
  const total = epoca.calendario[c.divisao - 1]?.length ?? epoca.totalJornadas
  const jornadasFalta = Math.max(0, total - epoca.jornada + 1)
  const contas = ep.contas?.[c.id]
  let receitaJornada: number
  if (contas && contas.jogos >= 3) receitaJornada = (contas.bilheteira + contas.fixas) / contas.jogos
  else {
    const div = mundo.divisoes[c.divisao - 1]?.clubes ?? []
    const repMedia = div.length ? div.reduce((t, i) => t + mundo.clubes[i].reputacao, 0) / div.length : c.reputacao
    const publico = publicoEsperado(c, { ...c, reputacao: repMedia }, Math.floor(div.length / 2), div.length || 18)
    const socios = ep.inicio?.[c.id]?.socios ?? 0
    const fixas = (RECEITA_FIXA[nivelDe(c) - 1] ?? 0) * (ep.inicio?.[c.id] ? PARTE_JORNADA : 1)
    receitaJornada = fixas + 0.5 * Math.max(0, publico - socios) * c.bilhete
  }
  const despesaJornada = salariosPorJornada(mundo, c.id) + custoStaffPorJornada(c) + Math.round(c.estadio.lugares * (MANUTENCAO_LUGAR[nivelDe(c) - 1] ?? 0.2))
  const banco = c.emprestimo ? c.emprestimo.prestacao * Math.min(c.emprestimo.falta, jornadasFalta) : 0
  const caixaFim = Math.round(c.dinheiro + jornadasFalta * (receitaJornada - despesaJornada) - banco)
  return { jornadasFalta, receitaJornada: Math.round(receitaJornada), despesaJornada, banco, caixaFim }
}

export interface EpocaFinancas {
  ano: number
  divisao: number
  lugar: number
  /** Caixa no fim da época (antes do dinheiro de arranque seguinte). */
  caixaFim: number
  receitas: number
  salarios: number
}

export type JogoComHistFinancas = Jogo & { histFinancas?: EpocaFinancas[] }

/** Regista a época que acabou (chamar depois de pagar o arranque da nova). */
export function registarEpocaFinancas(jogo: Jogo, anterior: EstadoEpoca, divisao: number, lugar: number): void {
  const j = jogo as JogoComHistFinancas
  const nova = jogo.epoca as EpocaComInicio
  const caixaFim = nova.caixaInicio?.[jogo.clubeId] ?? jogo.mundo.clubes[jogo.clubeId].dinheiro
  const ct = (anterior as EpocaComInicio).contas?.[jogo.clubeId]
  const ini = (anterior as EpocaComInicio).inicio?.[jogo.clubeId]
  j.histFinancas ??= []
  if (j.histFinancas.some((h) => h.ano === anterior.ano)) return
  j.histFinancas.push({ ano: anterior.ano, divisao, lugar, caixaFim, receitas: (ct ? ct.bilheteira + ct.fixas : 0) + (ini?.total ?? 0), salarios: ct?.salarios ?? 0 })
  if (j.histFinancas.length > 40) j.histFinancas.shift()
}
