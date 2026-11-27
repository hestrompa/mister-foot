// Empréstimos ao banco: dinheiro já, pago em prestações por jornada, com juros.
import { nivelDe } from './ligas'
import type { Clube } from './types'
import { RECEITA_FIXA } from './financas'

export interface Emprestimo {
  /** Quanto se pediu. */
  montante: number
  /** Capital ainda por pagar (sem juros). */
  capital: number
  /** Prestação por jornada (capital + juros). */
  prestacao: number
  /** Prestações que faltam. */
  falta: number
  prazo: number
}

/** Juro por época (34 jornadas), sobre o montante. Clubes de divisões baixas pagam mais. */
export const JURO_EPOCA = [0.06, 0.08, 0.1, 0.12]
/** Prazos possíveis, em jornadas: meia época, uma época, duas épocas. */
export const PRAZOS = [17, 34, 68]
export const JORNADAS_EPOCA = 34

/** Quanto o banco empresta ao clube, no total, de acordo com as receitas e o estádio. */
export function limiteCredito(c: Clube): number {
  const fixa = RECEITA_FIXA[nivelDe(c) - 1] ?? 0
  const base = fixa * 20 + c.estadio.lugares * 50 + c.reputacao * 2_000
  // Com caixa negativa o banco desconta o buraco.
  const v = base - Math.max(0, -c.dinheiro)
  return Math.max(0, Math.floor(v / 10_000) * 10_000)
}

export function juroTotal(c: Clube, montante: number, prazo: number): number {
  const taxa = JURO_EPOCA[nivelDe(c) - 1] ?? 0.1
  return Math.round(montante * taxa * (prazo / JORNADAS_EPOCA))
}

export function prestacaoDe(c: Clube, montante: number, prazo: number): number {
  return Math.ceil((montante + juroTotal(c, montante, prazo)) / prazo)
}

export function motivoSemEmprestimo(c: Clube, montante: number, prazo: number): string | null {
  if (c.emprestimo) return 'Já tens um empréstimo. Paga-o primeiro.'
  if (!PRAZOS.includes(prazo)) return 'Prazo inválido.'
  if (montante <= 0) return 'Escolhe um montante.'
  if (montante > limiteCredito(c)) return 'O banco não empresta tanto.'
  return null
}

export function pedirEmprestimo(c: Clube, montante: number, prazo: number): boolean {
  if (motivoSemEmprestimo(c, montante, prazo)) return false
  c.dinheiro += montante
  c.emprestimo = { montante, capital: montante, prestacao: prestacaoDe(c, montante, prazo), falta: prazo, prazo }
  return true
}

/** Liquidar já: paga só o capital que falta (poupa os juros que faltavam). */
export function liquidar(c: Clube): boolean {
  const e = c.emprestimo
  if (!e || c.dinheiro < e.capital) return false
  c.dinheiro -= e.capital
  delete c.emprestimo
  return true
}

/** Cobra a prestação de uma jornada. Devolve o valor cobrado. */
export function cobrarPrestacao(c: Clube): number {
  const e = c.emprestimo
  if (!e) return 0
  const pago = e.prestacao
  e.falta -= 1
  e.capital = e.falta <= 0 ? 0 : Math.max(0, Math.round(e.montante * e.falta / e.prazo))
  c.dinheiro -= pago
  if (e.falta <= 0) delete c.emprestimo
  return pago
}
