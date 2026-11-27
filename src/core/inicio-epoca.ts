// Dinheiro de arranque de época: direitos de TV, patrocinador principal, lugares anuais (sócios) e prémio da Liga
// pela classificação da época anterior. É sobretudo dinheiro que antes chegava às pinguinhas por jornada:
// as receitas fixas por jornada descem para PARTE_JORNADA e os lugares anuais deixam de pagar bilhete em cada jogo.
import { nivelDivisao, nivelDoNumero } from './ligas'
import type { Mundo } from './types'
import type { EstadoEpoca, LinhaTabela } from './partida'
import { RECEITA_FIXA, BILHETE_NORMAL } from './financas'
import { avancarNaming } from './naming'
import { humorDe } from './adeptos'

/** Parte das receitas fixas (TV e patrocínios) que continua a chegar em cada jornada. */
export const PARTE_JORNADA = 0.65 // igual à constante em financas.ts
/** Direitos de TV pagos no arranque, em fração das receitas fixas da época (igual para todos na divisão). */
export const PARTE_TV = 0.25
/** Patrocinador principal no arranque (média da divisão), ajustado pela reputação. */
export const PARTE_PATROCINIO = 0.1
/** Prémio da Liga por classificação: bolo de cada divisão em fração das receitas fixas, por clube. */
export const PARTE_PREMIO = 0.2
/** Desconto do lugar anual face a comprar bilhete jogo a jogo. */
export const DESCONTO_ANUAL = 0.15
const JOGOS_CASA = 17

export interface InjecaoEpoca {
  tv: number
  patrocinio: number
  /** Lugares anuais vendidos (estes adeptos não pagam bilhete em cada jogo). */
  socios: number
  /** Dinheiro dos lugares anuais. */
  anuais: number
  premio: number
  /** Lugar e divisão da época anterior (para o prémio). */
  lugarAnterior?: number
  divisaoAnterior?: number
  /** Verba da direção (ligada à confiança no fim da época anterior). */
  direcao?: number
  confianca?: number
  /** Nome do estádio vendido a uma marca. */
  naming?: number
  /** Bónus do patrocinador por objetivos da época anterior. */
  bonusPatrocinio?: number
  total: number
}

/** Totais da época por clube, somados jornada a jornada (para as contas no separador Clube). */
export interface ContasEpoca { bilheteira: number; fixas: number; salarios: number; estadio: number; banco: number; jogos: number }

export type EpocaComInicio = EstadoEpoca & {
  inicio?: Record<number, InjecaoEpoca>
  /** Caixa de cada clube antes do dinheiro de arranque. */
  caixaInicio?: Record<number, number>
  contas?: Record<number, ContasEpoca>
}

/** Soma o balanço de uma jornada às contas da época. */
export function somarContas(epoca: EstadoEpoca, balancos: Record<number, { bilheteira: number; fixas: number; salarios: number; estadio?: number; banco?: number }>): void {
  const e = epoca as EpocaComInicio
  const contas = (e.contas ??= {})
  for (const [k, b] of Object.entries(balancos)) {
    const c = (contas[Number(k)] ??= { bilheteira: 0, fixas: 0, salarios: 0, estadio: 0, banco: 0, jogos: 0 })
    c.bilheteira += b.bilheteira; c.fixas += b.fixas; c.salarios += b.salarios
    c.estadio += b.estadio ?? 0; c.banco += b.banco ?? 0; c.jogos += 1
  }
}

/** Receitas fixas da época inteira (34 jornadas) numa divisão. */
export function fixasEpoca(divisao: number): number {
  return (RECEITA_FIXA[divisao - 1] ?? 0) * 34
}

/** Quantos lugares anuais o clube vende: depende do estádio original e da reputação, com tecto. */
export function lugaresAnuais(c: Mundo['clubes'][number]): number {
  const base = c.estadio.base ?? c.estadio.lugares
  // Adeptos contentes no verão compram mais lugares anuais (0,85x a 1,15x).
  const n = base * (0.08 + c.reputacao / 600) * (0.85 + (0.3 * humorDe(c)) / 100)
  return Math.max(0, Math.min(Math.round(c.estadio.lugares * 0.3), Math.round(n / 10) * 10))
}

/**
 * Calcula e paga o dinheiro de arranque a todos os clubes. `anteriores[divisao-1]` é a tabela final da época
 * passada (vazia num jogo novo: sem prémio). Guarda o detalhe em `epoca.inicio`.
 */
export function pagarInicioEpoca(mundo: Mundo, epoca: EstadoEpoca, anteriores: LinhaTabela[][]): Record<number, InjecaoEpoca> {
  const out: Record<number, InjecaoEpoca> = {}
  const caixa: Record<number, number> = {}
  for (const c of Object.values(mundo.clubes)) caixa[c.id] = c.dinheiro
  ;(epoca as EpocaComInicio).caixaInicio = caixa
  // Prémio: cada divisão reparte um bolo pelos clubes, do 1.º (quase o dobro da média) ao último (quase nada).
  const premio = new Map<number, { valor: number; lugar: number; div: number }>()
  anteriores.forEach((t, d) => {
    const n = t.length
    if (!n) return
    const bolo = fixasEpoca(nivelDoNumero(mundo, d + 1)) * PARTE_PREMIO
    t.forEach((l, i) => premio.set(l.clubeId, { valor: Math.round((bolo * 2 * (n - i)) / (n + 1) / 1000) * 1000, lugar: i + 1, div: d + 1 }))
  })
  for (const div of mundo.divisoes) {
    const F = fixasEpoca(nivelDivisao(div))
    // Patrocínio pela reputação relativa dentro da divisão: o de mais nome recebe 1,3x, o de menos 0,7x.
    const porRep = [...div.clubes].sort((a, b) => mundo.clubes[b].reputacao - mundo.clubes[a].reputacao || a - b)
    for (const id of div.clubes) {
      const c = mundo.clubes[id]
      const k = porRep.length > 1 ? porRep.indexOf(id) / (porRep.length - 1) : 0.5
      const tv = Math.round((F * PARTE_TV) / 1000) * 1000
      const patrocinio = Math.round((F * PARTE_PATROCINIO * (1.3 - 0.6 * k)) / 1000) * 1000
      const socios = lugaresAnuais(c)
      const anuais = Math.round((socios * (BILHETE_NORMAL[nivelDivisao(div) - 1] ?? 5) * JOGOS_CASA * (1 - DESCONTO_ANUAL)) / 1000) * 1000
      const p = premio.get(id)
      const inj: InjecaoEpoca = { tv, patrocinio, socios, anuais, premio: p?.valor ?? 0, total: 0 }
      if (p) { inj.lugarAnterior = p.lugar; inj.divisaoAnterior = p.div }
      inj.total = inj.tv + inj.patrocinio + inj.anuais + inj.premio
      c.dinheiro += inj.total
      out[id] = inj
    }
  }
  for (const [id, v] of avancarNaming(Object.values(mundo.clubes), epoca.ano)) {
    if (!out[id]) continue
    out[id].naming = v
    out[id].total += v
  }
  ;(epoca as EpocaComInicio).inicio = out
  return out
}
