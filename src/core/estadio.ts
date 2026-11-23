// Obras no estádio: aumentar a lotação custa dinheiro e demora algumas jornadas.
import type { Clube } from './types'

export interface Obra {
  /** Lugares que a obra acrescenta. */
  lugares: number
  /** Jornadas que ainda faltam (só contam as jornadas em que o clube joga). */
  falta: number
  /** Duração total, para a barra de progresso. */
  total: number
  custo: number
}

/** Tamanhos de obra que se podem encomendar. */
export const OBRAS = [1_000, 2_500, 5_000, 10_000]
export const LOTACAO_MAX = 90_000
/** Euros por lugar novo, mais um custo fixo de projeto. */
export const CUSTO_LUGAR = 120
export const CUSTO_PROJETO = 20_000
/** Durante as obras, parte das bancadas fica fechada. */
export const FECHADO_EM_OBRAS = 0.1

export function custoObra(lugares: number): number {
  return CUSTO_PROJETO + lugares * CUSTO_LUGAR
}

export function duracaoObra(lugares: number): number {
  return 3 + Math.ceil(lugares / 1_000)
}

/** Lugares disponíveis para o próximo jogo (menos durante as obras). */
export function lotacaoAtual(c: Clube): number {
  const l = c.estadio.lugares
  return c.estadio.obra ? Math.round(l * (1 - FECHADO_EM_OBRAS)) : l
}

/** Porque é que não se pode fazer esta obra agora, ou null se se pode. */
export function motivoSemObra(c: Clube, lugares: number): string | null {
  if (c.estadio.obra) return 'Já há uma obra a decorrer.'
  if (c.estadio.lugares + lugares > LOTACAO_MAX) return `O estádio não pode passar de ${LOTACAO_MAX.toLocaleString('pt-PT')} lugares.`
  if (c.dinheiro < custoObra(lugares)) return 'Não há dinheiro em caixa para pagar a obra.'
  return null
}

/** Encomenda a obra e paga-a já. Devolve false se não for possível. */
export function iniciarObra(c: Clube, lugares: number): boolean {
  if (motivoSemObra(c, lugares)) return false
  const custo = custoObra(lugares)
  c.dinheiro -= custo
  // A procura de bilhetes cresce menos do que a lotação: guarda-se o tamanho original.
  if (c.estadio.base === undefined) c.estadio.base = c.estadio.lugares
  const total = duracaoObra(lugares)
  c.estadio.obra = { lugares, falta: total, total, custo }
  return true
}

/** Avança a obra uma jornada. Devolve os lugares acabados de inaugurar (0 se nada acabou). */
export function avancarObra(c: Clube): number {
  const o = c.estadio.obra
  if (!o) return 0
  o.falta -= 1
  if (o.falta > 0) return 0
  c.estadio.lugares += o.lugares
  delete c.estadio.obra
  return o.lugares
}
