// Lesões com tipo, cansaço acumulado e risco. Sem UI, determinístico (o rng vem de quem chama).
import type { Rng } from './rng'
import type { Jogador } from './types'
import type { JogadorVivo } from './balneario'

export interface TipoLesao {
  id: string
  nome: string
  min: number
  max: number
  /** Peso no sorteio com o jogador fresco. */
  peso: number
  /** Quanto o cansaço aumenta a probabilidade deste tipo (lesões musculares). */
  cansaco: number
}

/** Duração média parecida com a antiga (1 a 6 jogos), mas com cauda de lesões longas. */
export const TIPOS_LESAO: TipoLesao[] = [
  { id: 'pancada', nome: 'Pancada', min: 1, max: 1, peso: 32, cansaco: 0 },
  { id: 'entorse', nome: 'Entorse no tornozelo', min: 2, max: 4, peso: 22, cansaco: 0.2 },
  { id: 'distensao', nome: 'Distensão muscular', min: 2, max: 4, peso: 20, cansaco: 1.5 },
  { id: 'rotura', nome: 'Rotura muscular', min: 4, max: 8, peso: 11, cansaco: 2 },
  { id: 'joelho', nome: 'Lesão no joelho', min: 8, max: 16, peso: 5, cansaco: 0.5 },
  { id: 'fratura', nome: 'Fratura', min: 10, max: 20, peso: 2, cansaco: 0 },
]

export function tipoLesao(id: string | undefined): TipoLesao | undefined {
  return TIPOS_LESAO.find((t) => t.id === id)
}

export function fadigaDe(j: Jogador | undefined): number {
  return (j as JogadorVivo | undefined)?.fadiga ?? 0
}

export function definirFadiga(j: Jogador, v: number): void {
  ;(j as JogadorVivo).fadiga = Math.round(Math.max(0, Math.min(100, v)))
}

/** Rendimento pelo cansaço acumulado: até 35 não se nota; 75 tira cerca de 10%. */
export function fatorFisico(j: Jogador): number {
  const f = fadigaDe(j)
  return f <= 35 ? 1 : 1 - (f - 35) * 0.0025
}

/** Jogos em que o jogador ainda está frágil (voltou antes do tempo). */
export function fragilDe(j: Jogador | undefined): number {
  return (j as (JogadorVivo & { fragil?: number }) | undefined)?.fragil ?? 0
}

export function definirFragil(j: Jogador, n: number): void {
  const x = j as JogadorVivo & { fragil?: number }
  if (n > 0) x.fragil = n
  else delete x.fragil
}

/**
 * Peso de um jogador no sorteio de quem se lesiona (1 = fresco). Cansado ou de regresso apressado arrisca mais;
 * os mais velhos um pouco mais.
 */
export function riscoLesao(j: Jogador): number {
  const f = fadigaDe(j)
  let r = 0.75 + f / 60
  if (j.idade >= 32) r *= 1.2
  if (fragilDe(j) > 0) r *= 12
  return r
}

/** Sorteia o tipo e a duração de uma lesão. */
export function sortearLesao(rng: Rng, j: Jogador): { tipo: TipoLesao; jogos: number } {
  const f = fadigaDe(j) / 50
  const pesos = TIPOS_LESAO.map((t) => t.peso * (1 + t.cansaco * f) * (fragilDe(j) > 0 && t.cansaco > 1 ? 3 : 1))
  let r = rng.next() * pesos.reduce((s, p) => s + p, 0)
  let i = 0
  while (i < pesos.length - 1 && (r -= pesos[i]) > 0) i++
  const tipo = TIPOS_LESAO[i]
  return { tipo, jogos: rng.int(tipo.min, tipo.max) }
}

/** Cansaço ganho num jogo: 90 minutos dão ~20; mais velhos cansam mais, os miúdos recuperam melhor. */
export function cansacoDoJogo(j: Jogador, minutos: number): number {
  const idade = j.idade >= 31 ? 1.25 : j.idade <= 21 ? 0.9 : 1
  return 20 * idade * Math.min(1.35, minutos / 90)
}

/** Recuperação semanal (entre jornadas do campeonato), melhor com bom preparador físico (nível 0-5). */
export function recuperar(j: Jogador, nivelFisico: number): void {
  const f = fadigaDe(j)
  if (f <= 0) return
  definirFadiga(j, f * (0.55 - 0.025 * nivelFisico))
}

export function textoFadiga(f: number): string {
  if (f >= 70) return 'Esgotado'
  if (f >= 50) return 'Cansado'
  if (f >= 35) return 'Pesado'
  return 'Fresco'
}
