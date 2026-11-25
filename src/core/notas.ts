// Nota de cada jogador num jogo (0,0 a 10,0), ao estilo dos jornais desportivos.
//
// Como se calcula:
// - Todos começam em 6,0. Somam-se pontos pelo que o jogador fez (golos, assistências, remates,
//   passes para remate, desarmes, defesas) e tiram-se pelo que correu mal (golos sofridos com ele
//   em campo, ocasiões claras falhadas, erros, perdas de bola, cartões).
// - Conta a posição: um golo de um central vale mais do que o de um avançado; um golo sofrido
//   pesa mais no guarda-redes e nos defesas; a baliza a zeros é dos de trás; a posse é dos médios.
// - O resultado (vitória/derrota) entra em todos, pesado pelos minutos jogados.
// - No fim os pontos passam por uma curva suave: é fácil ter 6,5-7,0, difícil passar de 8,5,
//   e só um jogo enorme dá 9,5 ou mais (o mesmo para baixo: abaixo de 4,5 só com expulsões e erros).
// - Quem jogou menos de 10 minutos e não fez nada de especial fica sem nota (como nos jornais).
//
// Os eventos "invisíveis" do motor (desarmes, perdas de bola, erros, passes) vêm de um gerador
// próprio, com a sua semente: não mexem nos números do jogo, só na nota.
import type { Posicao } from './types'
import type { EstadoEpoca, Lado, Lance, Partida } from './partida'

/** Contas de um jogador num jogo. Serializável (vive dentro do EstadoJogo). */
export interface ContaJogo {
  /** 0 casa, 1 fora. */
  l: 0 | 1
  pos: Posicao
  /** Minutos jogados. */
  m: number
  /** Pontos individuais (antes da curva e do resultado). */
  p: number
  /** Golos da equipa e golos sofridos com ele em campo. */
  gf: number
  gc: number
  g: number
  a: number
  rem: number
  rb: number
  /** Passes para remate (sem golo). */
  pc: number
  des: number
  dfs: number
  err: number
  perdas: number
  am: number
  vm: number
}

export type Contas = Record<number, ContaJogo>

/** Pesos: o mesmo feito vale diferente conforme a posição. */
const GOLO: Record<Posicao, number> = { GR: 1.5, DEF: 1.3, MED: 1.1, AV: 1 }
const GOLO_PRO: Record<Posicao, number> = { GR: 0.03, DEF: 0.05, MED: 0.09, AV: 0.12 }
const GOLO_CONTRA: Record<Posicao, number> = { GR: 0.3, DEF: 0.13, MED: 0.08, AV: 0.03 }
const ZEROS: Record<Posicao, number> = { GR: 0.45, DEF: 0.3, MED: 0.08, AV: 0 }
const DESARME = 0.1
const PERDA = 0.035
const ASSIST = 0.65
const RESULTADO = 0.35

export function novaConta(l: 0 | 1, pos: Posicao): ContaJogo {
  return { l, pos, m: 0, p: 0, gf: 0, gc: 0, g: 0, a: 0, rem: 0, rb: 0, pc: 0, des: 0, dfs: 0, err: 0, perdas: 0, am: 0, vm: 0 }
}

/** Remate (com ou sem golo). `clara` = ocasião que foi ao relato. `erroDef`/`erroGR` vêm do gerador da nota. */
export function contarRemate(c: Contas, lance: Lance, clara: boolean, erroDef: boolean, erroGR: boolean): void {
  const r = c[lance.rematadorId]
  const pas = lance.passadorId != null ? c[lance.passadorId] : undefined
  const gr = lance.guardaRedesId != null ? c[lance.guardaRedesId] : undefined
  const df = lance.defensorId != null ? c[lance.defensorId] : undefined
  const pen = lance.origem === 'penalti'
  const d = lance.desfecho
  if (r) {
    r.rem++
    if (d === 'golo' || d === 'defesa') r.rb++
    if (d === 'golo') { r.g++; r.p += GOLO[r.pos] * (pen ? 0.55 : lance.origem === 'longe' || lance.esquema === 'direto' ? 1.15 : 1) }
    else if (pen) r.p -= 0.7
    else if (d === 'poste') r.p += 0.12
    else if (d === 'defesa') r.p += clara ? 0.12 : 0.08
    else r.p -= clara ? 0.25 : 0.04
  }
  if (pas) {
    if (d === 'golo') { pas.a++; pas.p += ASSIST }
    else { pas.pc++; pas.p += clara ? 0.15 : 0.07 }
  }
  if (gr) {
    if (d === 'golo') {
      // O golo sofrido já pesa pelo "gc"; num penálti a culpa é pouca.
      if (pen) gr.p += GOLO_CONTRA.GR * 0.7
      if (erroGR) { gr.err++; gr.p -= 0.6 }
    } else if (d === 'defesa') {
      gr.dfs++
      gr.p += pen ? 1.1 : clara ? 0.45 : 0.2
    }
  }
  if (df && !pen) {
    if (d === 'golo') { df.p -= 0.22; if (erroDef) { df.err++; df.p -= 0.55 } }
    else if (d === 'fora') df.p += 0.04
  }
}

export function contarDesarme(x: ContaJogo | undefined): void {
  if (!x) return
  x.des++
  x.p += DESARME
}

export function contarPerda(x: ContaJogo | undefined): void {
  if (!x) return
  x.perdas++
  x.p -= PERDA
}

export function contarCartao(x: ContaJogo | undefined, tipo: 'amarelo' | 'segundo' | 'direto'): void {
  if (!x) return
  if (tipo === 'amarelo') { x.am++; x.p -= 0.3 }
  else if (tipo === 'segundo') { x.vm++; x.p -= 1.2 }
  else { x.vm++; x.p -= 2 }
}

/** Curva suave: pontos (à volta de 0) para a nota final. */
export function curva(s: number): number {
  const n = s >= 0 ? 6 + 4 * Math.tanh(s / 3.2) : 6 - 3 * Math.tanh(-s / 3.2)
  return Math.round(Math.max(1, Math.min(10, n)) * 10) / 10
}

/** Pontos totais de um jogador: o que fez, mais o coletivo (golos com ele em campo, zeros, posse, resultado). */
export function pontosDe(x: ContaJogo, golos: [number, number], posse: [number, number]): number {
  const fr = Math.min(1, x.m / 90)
  const dif = golos[x.l] - golos[1 - x.l]
  let s = x.p
  s += x.gf * GOLO_PRO[x.pos] - x.gc * GOLO_CONTRA[x.pos]
  if (x.gc === 0 && x.m >= 60) s += ZEROS[x.pos]
  if (x.pos === 'MED') s += ((posse[x.l] - 50) / 100) * 0.6 * fr
  s += Math.sign(dif) * RESULTADO * Math.min(1, x.m / 75)
  return s
}

/** Tem nota quem jogou pelo menos 10 minutos ou fez algo que conta (golo, assistência, cartão, erro, defesa). */
export function temNota(x: ContaJogo): boolean {
  return x.m >= 10 || x.g + x.a + x.am + x.vm + x.err + x.dfs > 0
}

/** Notas de todos os jogadores com nota (a meio do jogo é a nota provisória). */
export function calcularNotas(c: Contas, golos: [number, number], posse: [number, number]): Record<number, number> {
  const out: Record<number, number> = {}
  for (const k of Object.keys(c)) {
    const x = c[Number(k)]
    if (temNota(x)) out[Number(k)] = curva(pontosDe(x, golos, posse))
  }
  return out
}

/** Melhor em campo: a nota mais alta (desempate: golos, depois o vencedor). */
export function melhorEmCampo(notas: Record<number, number> | undefined): number | undefined {
  if (!notas) return undefined
  let melhor: number | undefined
  for (const k of Object.keys(notas)) {
    const id = Number(k)
    if (melhor === undefined || notas[id] > notas[melhor]) melhor = id
  }
  return melhor
}

/** Lado da conta como Lado do motor. */
export function ladoDe(x: ContaJogo): Lado {
  return x.l === 0 ? 'casa' : 'fora'
}

/** Classe de cor para mostrar uma nota (verde forte, verde, amarelo, laranja, vermelho). */
export function classeNota(n: number | undefined): string {
  if (n == null) return 'nota-sem'
  if (n >= 8) return 'nota-top'
  if (n >= 7) return 'nota-boa'
  if (n >= 6) return 'nota-ok'
  if (n >= 5) return 'nota-fraca'
  return 'nota-ma'
}

export function textoNota(n: number | undefined): string {
  return n == null ? '–' : n.toFixed(1).replace('.', ',')
}

// ---------------------------------------------------------------------------
// Histórico da época: soma e número de notas por jogador, e as últimas cinco.
// Guardado em décimas (inteiros) para a gravação ficar pequena. Gravações antigas começam vazias.

export type EpocaComNotas = EstadoEpoca & {
  /** [soma das notas em décimas, jogos com nota] (liga, taça e Europa). */
  notas?: Record<number, [number, number]>
  /** Últimas notas em décimas, a mais recente no fim (máximo 5). */
  ultNotas?: Record<number, number[]>
}

const ULTIMAS = 5

/** Junta as notas de partidas jogadas ao histórico da época (só jogadores do mundo nacional). */
export function registarNotas(epoca: EstadoEpoca, partidas: Iterable<Partida>, existe: (id: number) => boolean): void {
  const e = epoca as EpocaComNotas
  for (const p of partidas) {
    if (!p.notas) continue
    const soma = (e.notas ??= {})
    const ult = (e.ultNotas ??= {})
    for (const k of Object.keys(p.notas)) {
      const id = Number(k)
      if (!existe(id)) continue
      const d = Math.round(p.notas[id] * 10)
      const s = (soma[id] ??= [0, 0])
      s[0] += d
      s[1] += 1
      const u = (ult[id] ??= [])
      u.push(d)
      if (u.length > ULTIMAS) u.shift()
    }
  }
}

/** Média das notas na época (undefined sem jogos com nota). */
export function mediaEpoca(epoca: EstadoEpoca | undefined, id: number): number | undefined {
  const s = (epoca as EpocaComNotas | undefined)?.notas?.[id]
  return s && s[1] > 0 ? Math.round(s[0] / s[1]) / 10 : undefined
}

export function jogosComNota(epoca: EstadoEpoca | undefined, id: number): number {
  return (epoca as EpocaComNotas | undefined)?.notas?.[id]?.[1] ?? 0
}

/** Últimas notas (a mais recente no fim). */
export function ultimasNotas(epoca: EstadoEpoca | undefined, id: number): number[] {
  return ((epoca as EpocaComNotas | undefined)?.ultNotas?.[id] ?? []).map((d) => d / 10)
}

/** Nota média de referência (uma época normal anda por aqui). */
export const NOTA_MEDIA = 6.45

/**
 * Quanto a época mexe no valor de mercado: cada ponto de média acima (ou abaixo) da referência vale 15%,
 * até ±15%, e só conta por inteiro a partir de 10 jogos com nota.
 */
export function fatorValorNota(media: number | undefined, jogos: number): number {
  if (media == null || jogos <= 0) return 1
  const d = Math.max(-0.15, Math.min(0.15, (media - NOTA_MEDIA) * 0.15))
  return 1 + d * Math.min(1, jogos / 10)
}

/** Moral depois de um jogo: uma grande exibição dá confiança, uma má tira (no máximo ±1,5). */
export function moralDaNota(nota: number | undefined): number {
  if (nota == null) return 0
  return Math.max(-1.5, Math.min(1.5, (nota - NOTA_MEDIA) * 0.9))
}
