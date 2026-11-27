// Polivalência: posições que um jogador aprendeu no treino individual (0 a 100 por posição).
// Fora da sua posição um jogador vale cerca de 74% (motor.forcaNoLugar); a aprender, vai subindo
// até 94% quando a posição está aprendida. Vive no próprio jogador (campo opcional), por isso
// acompanha-o nas transferências e as gravações antigas continuam a funcionar.
import type { Jogador, Posicao } from './types'

type JogadorPoli = Jogador & { aprende?: Partial<Record<Posicao, number>> }

/** Fator de quem joga fora da posição sem a ter aprendido. */
export const FATOR_FORA = 0.74
/** Fator de quem aprendeu a posição por completo. */
export const FATOR_APRENDIDA = 0.94

/** Quanto o jogador já aprendeu da posição (0 a 100). A sua própria posição conta 100. */
export function aprendido(j: Jogador, pos: Posicao): number {
  if (j.posicao === pos) return 100
  return (j as JogadorPoli).aprende?.[pos] ?? 0
}

export function definirAprendido(j: Jogador, pos: Posicao, v: number): void {
  const x = j as JogadorPoli
  const n = Math.round(Math.max(0, Math.min(100, v)) * 10) / 10
  x.aprende = { ...(x.aprende ?? {}), [pos]: n }
}

/** Fator de rendimento fora da posição: de 0.74 (nunca treinou) a 0.94 (posição aprendida). */
export function fatorForaDaPosicao(j: Jogador, pos: Posicao): number {
  const a = (j as JogadorPoli).aprende?.[pos]
  return a ? FATOR_FORA + (FATOR_APRENDIDA - FATOR_FORA) * (a / 100) : FATOR_FORA
}

/** Posições que o jogador já aprendeu (pelo menos `min`). */
export function posicoesExtra(j: Jogador, min = 100): Posicao[] {
  const ap = (j as JogadorPoli).aprende ?? {}
  return (Object.keys(ap) as Posicao[]).filter((p) => p !== j.posicao && (ap[p] ?? 0) >= min)
}
