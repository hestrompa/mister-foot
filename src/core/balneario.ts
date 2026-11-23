// Balneário: moral de cada jogador, tempo de jogo, promessas, conflitos e capitão.
// A moral vive no próprio jogador (campo opcional, gravado com o mundo) para o motor a poder ler.
// O estado do balneário do utilizador (capitão, promessas, mensagens) vive em jogo.balneario.
import type { Jogador, Jogo, Mundo } from './types'

/** Moral de quem ainda não tem registo. */
export const MORAL_NEUTRA = 60

/** Campos extra que o balneário e o departamento médico guardam no jogador. */
export interface JogadorVivo extends Jogador {
  /** 0 a 100. */
  moral?: number
  /** Cansaço acumulado, 0 a 100 (sobe a jogar, desce a descansar). */
  fadiga?: number
}

export interface MensagemBalneario {
  ano: number
  jornada: number
  texto: string
  jogadorId?: number
  /** bom / mau / info, para a cor na lista. */
  tom: 'bom' | 'mau' | 'info'
}

export interface Promessa {
  jogadorId: number
  /** Jornada (epoca.jornada) em que se avalia. */
  ate: number
  /** Jogos como titular prometidos até lá. */
  jogos: number
  feitos: number
  ano: number
}

/** Conflito à espera de decisão do treinador. */
export interface Conflito {
  id: number
  jogadorId: number
  motivo: 'tempo' | 'moral' | 'capitao' | 'saida'
  texto: string
  ano: number
  jornada: number
}

export interface EstadoBalneario {
  capitaoId?: number
  promessas: Promessa[]
  conflitos: Conflito[]
  mensagens: MensagemBalneario[]
  proximoId: number
  /** Jogos e titularidades da época por jogador (só do meu clube). */
  jogos: Record<number, number>
  titular: Record<number, number>
  /** Ano a que `jogos`/`titular` dizem respeito. */
  ano: number
  /** Jornada até onde o balneário já avançou. */
  jornada: number
}

export type JogoComBalneario = Jogo & { balneario?: EstadoBalneario }

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

export function moralDe(j: Jogador | undefined): number {
  return (j as JogadorVivo | undefined)?.moral ?? MORAL_NEUTRA
}

export function definirMoral(j: Jogador, v: number): void {
  ;(j as JogadorVivo).moral = Math.round(clamp(v, 0, 100) * 10) / 10
}

/**
 * Quanto a moral pesa no rendimento em campo: 0 vale 0,93; 60 vale 1; 100 vale cerca de 1,05.
 * Pequeno de propósito: a força continua a mandar.
 */
export function fatorMoral(j: Jogador): number {
  const m = moralDe(j)
  return m >= MORAL_NEUTRA ? 1 + (m - MORAL_NEUTRA) * 0.0012 : 1 - (MORAL_NEUTRA - m) * 0.0012
}

export function estadoBalneario(jogo: JogoComBalneario): EstadoBalneario {
  const ano = jogo.epoca?.ano ?? jogo.mundo.epoca
  if (!jogo.balneario) {
    jogo.balneario = { promessas: [], conflitos: [], mensagens: [], proximoId: 1, jogos: {}, titular: {}, ano, jornada: jogo.epoca?.jornada ?? 1 }
  }
  const st = jogo.balneario
  if (st.ano !== ano) { st.ano = ano; st.jogos = {}; st.titular = {} }
  return st
}

const MAX_MENSAGENS = 40

export function anotar(jogo: JogoComBalneario, texto: string, tom: MensagemBalneario['tom'], jogadorId?: number): void {
  const st = estadoBalneario(jogo)
  st.mensagens.unshift({ ano: jogo.epoca?.ano ?? jogo.mundo.epoca, jornada: jogo.epoca?.jornada ?? 1, texto, tom, ...(jogadorId ? { jogadorId } : {}) })
  if (st.mensagens.length > MAX_MENSAGENS) st.mensagens.length = MAX_MENSAGENS
}

/**
 * Muda a moral de todo o plantel de um clube (conferências de imprensa, dérbis, prémios...).
 * `delta` de equipa entre -10 e +10; quem já está muito em baixo ou muito em cima mexe menos.
 */
export function mudarMoral(jogo: Jogo, clubeId: number, delta: number, motivo: string): void {
  const c = jogo.mundo.clubes[clubeId]
  if (!c) return
  const d = clamp(delta, -10, 10)
  for (const id of c.plantel) {
    const j = jogo.mundo.jogadores[id]
    if (j) aplicar(j, d)
  }
  if (clubeId === jogo.clubeId && motivo && Math.abs(d) >= 1) anotar(jogo, motivo, d > 0 ? 'bom' : 'mau')
}

/** Muda a moral de um só jogador (limitado a ±30). */
export function mudarMoralJogador(jogo: Jogo, jogadorId: number, delta: number, motivo: string): void {
  const j = jogo.mundo.jogadores[jogadorId]
  if (!j) return
  const d = clamp(delta, -30, 30)
  aplicar(j, d)
  if (j.clubeId === jogo.clubeId && motivo && Math.abs(d) >= 1) anotar(jogo, motivo, d > 0 ? 'bom' : 'mau', jogadorId)
}

/** Aplica um delta com rendimentos decrescentes perto dos extremos. */
function aplicar(j: Jogador, d: number) {
  const m = moralDe(j)
  const folga = d > 0 ? (100 - m) / 40 : m / 40
  definirMoral(j, m + d * clamp(folga, 0.25, 1))
}

/** Moral média de um plantel (ambiente do balneário). */
export function ambiente(mundo: Mundo, clubeId: number): number {
  const c = mundo.clubes[clubeId]
  if (!c || !c.plantel.length) return MORAL_NEUTRA
  return c.plantel.reduce((s, id) => s + moralDe(mundo.jogadores[id]), 0) / c.plantel.length
}

export function textoMoral(m: number): string {
  if (m >= 85) return 'Eufórico'
  if (m >= 70) return 'Motivado'
  if (m >= 50) return 'Normal'
  if (m >= 30) return 'Desanimado'
  return 'Revoltado'
}
