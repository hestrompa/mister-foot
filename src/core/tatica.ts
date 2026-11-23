// Tática dos clubes da IA: formação ao jeito do plantel e postura conforme o adversário.
import type { Mundo } from './types'
import type { Escalacao, Formacao, Postura } from './partida'
import { escalarAuto, forcaNoLugar, posicaoDoLugar } from './motor'
import { forcaClube } from './mundo'

/** Formações que os treinadores da IA consideram (as extremas ficam para o jogador). */
export const FORMACOES_IA: Formacao[] = ['4-4-2', '4-3-3', '4-5-1', '3-5-2', '5-3-2', '3-4-3', '5-4-1']

/** Quanto a escalação rende: soma da força de cada jogador no seu lugar. */
function rendimento(mundo: Mundo, esc: Escalacao): number {
  return esc.titulares.reduce((s, id, i) => s + forcaNoLugar(mundo.jogadores[id], posicaoDoLugar(esc.formacao, i)), 0)
}

/** Postura de partida: quem é bem mais fraco espera atrás, sobretudo fora; quem é bem mais forte em casa ataca. */
export function posturaIA(forcaMeu: number, forcaAdv: number, emCasa: boolean): Postura {
  const dif = forcaMeu - forcaAdv + (emCasa ? 1.5 : -1.5)
  if (dif <= -5) return 'defensiva'
  if (dif >= 6) return 'ofensiva'
  return 'equilibrada'
}

/**
 * Escalação de um clube da IA para um jogo: experimenta as formações habituais e fica com a que mais rende
 * com os jogadores disponíveis (o 4-4-2 ganha empates), e escolhe a postura pelo adversário.
 */
export function escalarIA(mundo: Mundo, clubeId: number, advId: number, emCasa: boolean, indisponiveis: ReadonlySet<number>): Escalacao {
  let melhor: Escalacao | null = null
  let melhorR = -Infinity
  for (const f of FORMACOES_IA) {
    const esc = escalarAuto(mundo, clubeId, indisponiveis, f)
    if (esc.titulares.length < 11) continue
    // Pequena preferência pelo clássico para não mudar de formação por décimas.
    const r = rendimento(mundo, esc) + (f === '4-4-2' ? 3 : 0)
    if (r > melhorR) { melhor = esc; melhorR = r }
  }
  const esc = melhor ?? escalarAuto(mundo, clubeId, indisponiveis)
  return { ...esc, postura: posturaIA(forcaClube(mundo, clubeId), forcaClube(mundo, advId), emCasa) }
}
