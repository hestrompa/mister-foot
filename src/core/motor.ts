// Motor de jogo minuto a minuto. IMPLEMENTAÇÃO: agente do motor.
import type { Mundo } from './types'
import type { Escalacao, EventoJogo, Lado, Partida, Postura } from './partida'

/** Estado interno de um jogo a decorrer. Serializável (sem funções). */
export interface EstadoJogo {
  partida: Partida
  minuto: number
  escalacoes: Record<Lado, Escalacao>
  /** Substituições feitas por lado (máximo 5). */
  subs: Record<Lado, number>
  /** Jogadores expulsos ou lesionados que saíram (não podem voltar). */
  fora: number[]
  /** Estado do gerador de números, para continuar de forma determinística. */
  rng: number
  [extra: string]: unknown
}

/** Escolhe a melhor escalação automática para um clube, ignorando indisponíveis. */
export function escalarAuto(_mundo: Mundo, _clubeId: number, _indisponiveis: ReadonlySet<number>, _formacao?: Escalacao['formacao']): Escalacao {
  throw new Error('por implementar')
}

/** Prepara um jogo para ser jogado minuto a minuto. */
export function iniciarJogo(_mundo: Mundo, _partida: Partida, _casa: Escalacao, _fora: Escalacao, _semente: number): EstadoJogo {
  throw new Error('por implementar')
}

/** Joga o minuto seguinte (1 a 90, com descontos opcionais) e devolve os eventos desse minuto. Ao 45 inclui 'intervalo'; no fim inclui 'fim' e marca partida.jogada = true. */
export function avancarMinuto(_mundo: Mundo, _estado: EstadoJogo): EventoJogo[] {
  throw new Error('por implementar')
}

/** Substituição: devolve false se não for permitida. */
export function substituir(_mundo: Mundo, _estado: EstadoJogo, _lado: Lado, _saiId: number, _entraId: number): boolean {
  throw new Error('por implementar')
}

export function mudarPostura(_estado: EstadoJogo, _lado: Lado, _postura: Postura): void {
  throw new Error('por implementar')
}

/** Joga o jogo inteiro de uma vez (para os jogos das outras divisões e para testes). */
export function simularJogo(_mundo: Mundo, _partida: Partida, _casa: Escalacao, _fora: Escalacao, _semente: number): Partida {
  throw new Error('por implementar')
}
