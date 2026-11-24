// Ronda ao vivo (taça e Europa): avança um minuto em todos os jogos e decide o que o ecrã faz a seguir.
// Sem UI: os ecrãs só desenham. A ordem importa: uma pausa do meu jogo vem sempre antes de fechar a ronda,
// senão o ecrã muda para o resumo e logo a seguir volta à pausa, e fica preso no "Final".
import { avancarMinuto, type EstadoJogo } from './motor'
import type { EventoJogo, Lado } from './partida'
import type { Mundo } from './types'

export type PausaVivo = 'intervalo' | 'lesao' | 'pausa'

export interface RondaViva {
  /** Jogos da ronda; o primeiro é o meu. */
  estados: EstadoJogo[]
  meuLado: Lado
  /** Jogos que já deram o apito final. */
  feitos: Set<string>
  /** No apito final: reabre o jogo para prolongamento se for preciso (e devolve true). */
  prolongar?: (e: EstadoJogo, i: number) => boolean
}

export function novaRondaViva(estados: EstadoJogo[], clubeId: number, prolongar?: RondaViva['prolongar']): RondaViva {
  const meu = estados[0]
  return { estados, meuLado: meu && meu.partida.casaId === clubeId ? 'casa' : 'fora', feitos: new Set(), prolongar }
}

export function terminouVivo(r: RondaViva, e: EstadoJogo): boolean {
  return e.partida.jogada || r.feitos.has(e.partida.id)
}

export function rondaAcabou(r: RondaViva): boolean {
  return r.estados.every((e) => terminouVivo(r, e))
}

export interface MinutoVivo {
  pausa: PausaVivo | null
  /** Jogador meu que se lesionou e pede substituição. */
  lesionado?: number
}

/** Avança um minuto em todos os jogos por acabar. `aoEvento` recebe cada evento (para o campo 2D, por exemplo). */
export function passoRonda(mundo: Mundo, r: RondaViva, aoEvento?: (e: EstadoJogo, ev: EventoJogo) => void): MinutoVivo {
  const meu = r.estados[0]
  const out: MinutoVivo = { pausa: null }
  r.estados.forEach((e, i) => {
    if (terminouVivo(r, e)) return
    for (const ev of avancarMinuto(mundo, e)) {
      if (ev.tipo === 'fim' && r.prolongar?.(e, i)) {
        if (e === meu && !out.pausa) out.pausa = 'pausa'
        continue
      }
      if (ev.tipo === 'fim') r.feitos.add(e.partida.id)
      aoEvento?.(e, ev)
      if (e !== meu) continue
      if (ev.tipo === 'intervalo') out.pausa = 'intervalo'
      if (ev.tipo === 'lesao' && ev.lado === r.meuLado && meu.subs[r.meuLado] < 5 && !out.pausa) {
        out.pausa = 'lesao'
        out.lesionado = ev.jogadorId
      }
    }
  })
  return out
}

/**
 * O que o ecrã faz depois de um minuto: parar (intervalo, lesão, repetição), fechar a ronda ou seguir.
 * A pausa ganha a fechar: quando o jogo retoma, o minuto seguinte já não tem nada a jogar e fecha.
 */
export function depoisDoMinuto<P extends string>(pausa: P | null, acabou: boolean): { tipo: 'pausa'; pausa: P } | { tipo: 'fechar' } | { tipo: 'segue' } {
  if (pausa) return { tipo: 'pausa', pausa }
  return acabou ? { tipo: 'fechar' } : { tipo: 'segue' }
}

/** Joga até ao fim sem parar (botão Saltar). */
export function saltarRonda(mundo: Mundo, r: RondaViva, aoEvento?: (e: EstadoJogo, ev: EventoJogo) => void): void {
  let guarda = 0
  while (!rondaAcabou(r) && guarda++ < 300) passoRonda(mundo, r, aoEvento)
}
