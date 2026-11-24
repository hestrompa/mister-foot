// Venda do nome do estádio (naming): uma empresa paga todas as épocas durante 3 épocas, o estádio muda de nome
// e os adeptos não gostam (a reputação desce um pouco). Só o mister decide; no fim do contrato o nome antigo volta.
import type { Clube, Jogo } from './types'
import { RECEITA_FIXA } from './financas'

const fixasEpoca = (d: number) => (RECEITA_FIXA[d - 1] ?? 0) * 34

export const EPOCAS_NAMING = 3
/** Valor por época, em fração das receitas fixas da época, ajustado à reputação. */
export const PARTE_NAMING = 0.3
export const REPUTACAO_NAMING = 2

const MARCAS = ['Lusoleo', 'Banco Atlântida', 'TeleNorte', 'Cervejas Ribeira', 'Seguros Farol', 'Energia Sol Nascente', 'Mercados Avenida', 'Vinhos da Serra']

export interface Naming { marca: string; nomeAntigo: string; valor: number; ate: number }
type ClubeComNaming = Clube & { naming?: Naming }

export function namingDe(c: Clube): Naming | undefined {
  return (c as ClubeComNaming).naming
}

/** Proposta de naming para a época atual (determinística). */
export function propostaNaming(jogo: Jogo): { marca: string; valor: number } {
  const c = jogo.mundo.clubes[jogo.clubeId]
  const marca = MARCAS[(jogo.mundo.semente + c.id * 7 + jogo.epoca.ano) % MARCAS.length]
  const valor = Math.round((fixasEpoca(c.divisao) * PARTE_NAMING * (0.6 + c.reputacao / 100)) / 1000) * 1000
  return { marca, valor }
}

export function nomeNaming(marca: string): string {
  return `${marca} Arena`
}

/** Aceita a proposta: paga já esta época, muda o nome, tira reputação. */
export function venderNaming(jogo: Jogo): boolean {
  const c = jogo.mundo.clubes[jogo.clubeId] as ClubeComNaming
  if (c.naming) return false
  const p = propostaNaming(jogo)
  c.naming = { marca: p.marca, nomeAntigo: c.estadio.nome, valor: p.valor, ate: jogo.epoca.ano + EPOCAS_NAMING - 1 }
  c.estadio.nome = nomeNaming(p.marca)
  c.dinheiro += p.valor
  c.reputacao = Math.max(1, c.reputacao - REPUTACAO_NAMING)
  return true
}

/** No arranque de cada época: paga quem ainda tem contrato, e devolve o nome antigo quando acaba. Devolve o valor pago por clube. */
export function avancarNaming(clubes: Clube[], ano: number): Map<number, number> {
  const pago = new Map<number, number>()
  for (const cl of clubes) {
    const c = cl as ClubeComNaming
    const n = c.naming
    if (!n) continue
    if (ano > n.ate) {
      c.estadio.nome = n.nomeAntigo
      delete c.naming
      continue
    }
    c.dinheiro += n.valor
    pago.set(c.id, n.valor)
  }
  return pago
}
