// Academia (camadas jovens). Cada clube tem um nível de 1 a 5; o nível normal vem da reputação e é o que
// já dava os juniores de sempre. Só o meu clube investe: cada nível acima do normal dá juniores mais
// fortes, com mais teto, mais pérolas, mais profissionais, e a partir de +2 um júnior extra por época.
// Custa uma obra (paga de uma vez) e manutenção por jornada.
import { nivelDe } from './ligas'
import type { Clube } from './types'

export type ClubeComAcademia = Clube & { academia?: number }

export const NIVEL_MAX_ACADEMIA = 5

/** Nível normal de um clube, pela reputação (o que gerava os juniores antes de haver academia). */
export function nivelPadraoAcademia(c: Clube): number {
  return Math.max(1, Math.min(4, Math.round(c.reputacao / 25)))
}

export function nivelAcademia(c: Clube | undefined): number {
  if (!c) return 1
  return (c as ClubeComAcademia).academia ?? nivelPadraoAcademia(c)
}

/** Níveis acima do normal (0 para todos os clubes que nunca investiram). */
export function bonusAcademia(c: Clube | undefined): number {
  if (!c) return 0
  return Math.max(0, nivelAcademia(c) - nivelPadraoAcademia(c))
}

const FATOR_DIV = [1, 0.45, 0.2, 0.1]

/** Custo da obra para subir ao nível `nivel`. */
export function custoAcademia(c: Clube, nivel: number): number {
  const base = [0, 0, 400_000, 1_000_000, 2_500_000, 6_000_000][nivel] ?? 6_000_000
  return Math.round((base * (FATOR_DIV[nivelDe(c) - 1] ?? 0.1)) / 10_000) * 10_000
}

/** Manutenção por jornada dos níveis acima do normal (somada aos custos do staff). */
export function manutencaoAcademia(c: Clube): number {
  const b = bonusAcademia(c)
  if (!b) return 0
  return Math.round((b * (b + 1) * 6_000 * (FATOR_DIV[nivelDe(c) - 1] ?? 0.1)) / 50) * 50
}

export function melhorarAcademia(c: Clube): { ok: boolean; texto: string } {
  const n = nivelAcademia(c)
  if (n >= NIVEL_MAX_ACADEMIA) return { ok: false, texto: 'A academia já está no nível máximo.' }
  const custo = custoAcademia(c, n + 1)
  if (c.dinheiro < custo) return { ok: false, texto: 'Não há dinheiro em caixa para esta obra.' }
  c.dinheiro -= custo
  ;(c as ClubeComAcademia).academia = n + 1
  return { ok: true, texto: `Academia melhorada para o nível ${n + 1}. A próxima fornada de juniores já se nota.` }
}

/** Efeito do bónus nos juniores gerados. */
export function efeitoAcademia(c: Clube | undefined): { forca: number; potencial: number; perola: number; extra: number; profissional: number } {
  const b = bonusAcademia(c)
  return { forca: 1.5 * b, potencial: 2.5 * b, perola: 0.025 * b, extra: b >= 2 ? 1 : 0, profissional: 0.06 * b }
}

export const NOME_NIVEL_ACADEMIA = ['', 'Modesta', 'Razoável', 'Boa', 'Muito boa', 'De elite']
