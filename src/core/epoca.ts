// Calendário, tabela, castigos, lesões, subidas e descidas. IMPLEMENTAÇÃO: agente da época.
import type { Mundo } from './types'
import type { EstadoEpoca, LinhaTabela, Partida, ResumoEpoca } from './partida'

/** Cria a época: calendário de 34 jornadas (ida e volta) em cada divisão. */
export function novaEpoca(_mundo: Mundo, _semente: number): EstadoEpoca {
  throw new Error('por implementar')
}

/** Partidas da jornada atual numa divisão. */
export function partidasDaJornada(_epoca: EstadoEpoca, _divisao: number): Partida[] {
  throw new Error('por implementar')
}

/** Ids dos jogadores indisponíveis (lesionados ou castigados) de um clube. */
export function indisponiveisDe(_mundo: Mundo, _epoca: EstadoEpoca, _clubeId: number): Set<number> {
  throw new Error('por implementar')
}

/**
 * Fecha a jornada atual: simula com o motor (escalação automática) todas as partidas ainda não jogadas
 * de todas as divisões, aplica cartões, castigos, lesões e marcadores de TODAS as partidas da jornada
 * (incluindo as que a UI jogou ao vivo), reduz as baixas antigas e avança `jornada`.
 */
export function concluirJornada(_mundo: Mundo, _epoca: EstadoEpoca, _semente: number): void {
  throw new Error('por implementar')
}

/** Tabela ordenada: pontos, diferença de golos, golos marcados, nome. */
export function tabela(_mundo: Mundo, _epoca: EstadoEpoca, _divisao: number): LinhaTabela[] {
  throw new Error('por implementar')
}

export function epocaTerminada(_epoca: EstadoEpoca): boolean {
  throw new Error('por implementar')
}

/**
 * Fecha a época: 3 sobem e 3 descem entre divisões vizinhas (atualiza mundo.divisoes e clube.divisao),
 * jogadores envelhecem 1 ano (com pequena evolução/declínio de força pela idade e potencial),
 * contratos descem 1 ano, mundo.epoca += 1. Devolve o resumo.
 */
export function fecharEpoca(_mundo: Mundo, _epoca: EstadoEpoca): ResumoEpoca {
  throw new Error('por implementar')
}
