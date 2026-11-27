// Humor dos adeptos (0 a 100, 50 neutro) de cada clube. Sobe e desce com os resultados face ao esperado
// (pela força dos plantéis), pesa mais nos dérbis, castiga bilhetes caros e volta devagar ao neutro.
// Mexe na bilheteira (procura por jogo e lugares anuais). No meu clube a imprensa também mexe (imprensa.ts).
import type { Clube, Mundo } from './types'
import type { Partida } from './partida'
import { forcaClube } from './mundo'
import { rivalidade } from './rivalidades'

export const HUMOR_NEUTRO = 50

/** Preço "normal" do bilhete em cada divisão (igual ao de financas.ts; aqui para evitar import circular). */
const BILHETE_REF = [15, 10, 7, 5]

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

export type ClubeComAdeptos = Clube & { adeptos?: number }

export function humorDe(c: Clube): number {
  return (c as ClubeComAdeptos).adeptos ?? HUMOR_NEUTRO
}

export function definirHumor(c: Clube, v: number): void {
  (c as ClubeComAdeptos).adeptos = Math.round(clamp(v, 0, 100) * 10) / 10
}

/** Muda o humor com rendimentos decrescentes perto dos extremos. */
export function mudarHumor(c: Clube, delta: number): void {
  const h = humorDe(c)
  const folga = delta > 0 ? (100 - h) / 40 : h / 40
  definirHumor(c, h + delta * clamp(folga, 0.25, 1))
}

/** Multiplicador da procura de bilhetes: 0,8 com adeptos furiosos, 1,2 em euforia. */
export function fatorAdeptos(c: Clube): number {
  return 0.8 + (0.4 * humorDe(c)) / 100
}

export type NivelHumor = 'furiosos' | 'desiludidos' | 'exigentes' | 'satisfeitos' | 'euforia'

export function nivelHumor(h: number): NivelHumor {
  return h < 25 ? 'furiosos' : h < 42 ? 'desiludidos' : h < 60 ? 'exigentes' : h < 78 ? 'satisfeitos' : 'euforia'
}

export const NOME_HUMOR: Record<NivelHumor, string> = {
  furiosos: 'Furiosos', desiludidos: 'Desiludidos', exigentes: 'Exigentes', satisfeitos: 'Satisfeitos', euforia: 'Em euforia',
}

/** Pontos esperados pelos adeptos (como a direção: diferença de força e casa). */
export function pontosEsperadosAdeptos(minha: number, deles: number, emCasa: boolean): number {
  return clamp(1.35 + 0.07 * (minha - deles) + (emCasa ? 0.15 : -0.15), 0.25, 2.5)
}

/** Quanto o humor de um clube muda com um jogo (sem o regresso ao neutro). */
export function deltaJogo(mundo: Mundo, p: Partida, clubeId: number, forca?: Record<number, number>): number {
  const casa = p.casaId === clubeId
  const outro = casa ? p.foraId : p.casaId
  const f = (id: number) => forca?.[id] ?? forcaClube(mundo, id)
  const [gm, gs] = casa ? p.golos : [p.golos[1], p.golos[0]]
  const pts = gm > gs ? 3 : gm === gs ? 1 : 0
  let d = (pts - pontosEsperadosAdeptos(f(clubeId), f(outro), casa)) * 2.6 + clamp(gm - gs, -4, 4) * 0.5
  const riv = rivalidade(mundo.clubes[clubeId], mundo.clubes[outro])
  if (riv) d *= riv.tipo === 'classico' ? 1.8 : 1.4
  // Bilhetes muito acima do normal: os adeptos queixam-se a cada jogo em casa.
  const c = mundo.clubes[clubeId]
  if (casa) {
    const rel = c.bilhete / (BILHETE_REF[c.divisao - 1] ?? 5)
    if (rel > 1.3) d -= Math.min(2, (rel - 1.3) * 2.5)
    else if (rel < 0.75) d += 0.4
  }
  return d
}

/** Atualiza o humor dos adeptos de todos os clubes que jogaram (chamar depois do dinheiro da jornada). */
export function atualizarAdeptos(mundo: Mundo, partidas: Partida[], peso = 1): void {
  const forca: Record<number, number> = {}
  for (const p of partidas) for (const id of [p.casaId, p.foraId]) forca[id] ??= forcaClube(mundo, id)
  for (const p of partidas) {
    if (!p.jogada) continue
    for (const id of [p.casaId, p.foraId]) {
      const c = mundo.clubes[id]
      if (!c) continue
      const h = humorDe(c)
      // Regresso lento ao neutro e depois o efeito do jogo.
      definirHumor(c, h + (HUMOR_NEUTRO - h) * 0.05 * peso)
      mudarHumor(c, deltaJogo(mundo, p, id, forca) * peso)
    }
  }
}

/** Fim de época: os adeptos esquecem metade (subir, ser campeão ou descer já pesou ao longo da época). */
export function feriasAdeptos(mundo: Mundo, extra?: Record<number, number>): void {
  for (const c of Object.values(mundo.clubes)) {
    const h = humorDe(c)
    definirHumor(c, HUMOR_NEUTRO + (h - HUMOR_NEUTRO) * 0.5 + (extra?.[c.id] ?? 0))
  }
}
