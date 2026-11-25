// Carreira de cada jogador: jogos e golos por época, histórico de clubes, reformas e lendas.
//
// - Durante a época contam-se os jogos (titular ou suplente utilizado) e as assistências na liga
//   (EstadoEpoca.jogos / .assist; os golos já estão em `marcadores`).
// - No fecho da época cada jogador de um clube ganha uma linha no histórico (gravada no próprio
//   jogador, por isso desaparece com ele e as gravações antigas começam simplesmente vazias).
// - Os minutos contam na evolução: um jovem que joga muito cresce o potencial; um que nunca joga perde-o.
// - A reforma chega entre os 33 e os 39 anos, conforme a posição, a força e a personalidade.
// - Quem se reforma com uma carreira grande entra na galeria de lendas (mundo.lendas).
import type { EstadoEpoca, Partida } from './partida'
import type { Jogador, Mundo } from './types'
import type { Rng } from './rng'
import { anosExtraCarreira } from './personalidade'
import type { EpocaComNotas } from './notas'

/** Uma época no histórico: [ano, clubeId, divisão, jogos, golos, força no fim, assistências, nota média em décimas]. */
export type LinhaHist = [number, number, number, number, number, number, number?, number?]

export type JogadorComHist = Jogador & { hist?: LinhaHist[] }

export interface Lenda {
  id: number
  nome: string
  posicao: Jogador['posicao']
  nacionalidade: string
  /** Primeira e última época registadas. */
  de: number
  ate: number
  jogos: number
  golos: number
  /** Melhor força da carreira. */
  pico: number
  /** Clubes por número de jogos: [clubeId, nome, jogos, golos]. */
  clubes: [number, string, number, number][]
  /** Pontos de lenda (ordenação da galeria). */
  pontos: number
}

export interface Reforma {
  ano: number
  id: number
  nome: string
  posicao: Jogador['posicao']
  idade: number
  clubeId: number
  clube: string
  jogos: number
  golos: number
  lenda: boolean
}

export type MundoComLendas = Mundo & { lendas?: Lenda[]; reformas?: Reforma[] }

type EpocaComJogos = EstadoEpoca & { jogos?: Record<number, number>; assist?: Record<number, number> }

export function histDe(j: Jogador | undefined): LinhaHist[] {
  return (j as JogadorComHist | undefined)?.hist ?? []
}

/** Conta jogos e assistências de uma jornada de liga (chamado em concluirJornada). */
export function contarJogos(epoca: EstadoEpoca, partidas: Partida[]): void {
  const e = epoca as EpocaComJogos
  const jogos = (e.jogos ??= {})
  const assist = (e.assist ??= {})
  for (const p of partidas) {
    const ids = new Set<number>()
    for (const o of p.onzes ?? []) for (const id of o.titulares) ids.add(id)
    for (const ev of p.eventos) {
      if (ev.tipo === 'substituicao' && ev.outroId !== undefined) ids.add(ev.outroId)
      if (ev.tipo === 'golo' && ev.outroId !== undefined) assist[ev.outroId] = (assist[ev.outroId] ?? 0) + 1
    }
    for (const id of ids) jogos[id] = (jogos[id] ?? 0) + 1
  }
}

export function jogosNaEpoca(epoca: EstadoEpoca, id: number): number {
  return (epoca as EpocaComJogos).jogos?.[id] ?? 0
}

export function assistNaEpoca(epoca: EstadoEpoca, id: number): number {
  return (epoca as EpocaComJogos).assist?.[id] ?? 0
}

/**
 * Fecho da época no histórico de cada jogador com clube (antes de envelhecer). Também mexe no potencial
 * dos jovens conforme os minutos: titular aos 17-21 anos ganha teto; quem quase não joga perde-o.
 */
export function fecharEpocaJogadores(mundo: Mundo, epoca: EstadoEpoca, rng: Rng): void {
  const e = epoca as EpocaComJogos
  const ids = Object.keys(mundo.jogadores).map(Number).sort((a, b) => a - b)
  for (const id of ids) {
    const j = mundo.jogadores[id] as JogadorComHist
    const c = mundo.clubes[j.clubeId]
    if (!c || !(c.divisao >= 1)) continue
    const jogos = e.jogos?.[id] ?? 0
    const golos = epoca.marcadores[id] ?? 0
    const assist = e.assist?.[id] ?? 0
    const linha: LinhaHist = [epoca.ano, c.id, c.divisao, jogos, golos, j.forca]
    const nt = (epoca as EpocaComNotas).notas?.[id]
    if (assist || nt?.[1]) linha.push(assist)
    if (nt?.[1]) linha.push(Math.round(nt[0] / nt[1]))
    ;(j.hist ??= []).push(linha)
    // Uma carreira longa não precisa de mais de 25 linhas (as mais antigas juntam-se na primeira).
    if (j.hist.length > 25) {
      const [a, b] = j.hist
      const l: LinhaHist = [a[0], b[1], b[2], a[3] + b[3], a[4] + b[4], Math.max(a[5], b[5]), (a[6] ?? 0) + (b[6] ?? 0)]
      // Nota média das duas épocas juntas, pesada pelos jogos.
      if (a[7] || b[7]) {
        const ja = a[7] ? a[3] : 0, jb = b[7] ? b[3] : 0
        l.push(Math.round(((a[7] ?? 0) * ja + (b[7] ?? 0) * jb) / Math.max(1, ja + jb)))
      }
      j.hist.splice(0, 2, l)
    }
    if (j.idade <= 21 && e.jogos) {
      if (jogos >= 18 && rng.chance(0.5)) j.potencial = Math.min(99, j.potencial + 1 + (jogos >= 28 ? 1 : 0))
      else if (jogos <= 2 && j.potencial > j.forca + 3 && rng.chance(0.4)) j.potencial -= 1
    }
  }
}

/** Totais da carreira registada. */
export function totaisCarreira(j: Jogador): { jogos: number; golos: number; assist: number; epocas: number; pico: number; clubes: number } {
  const h = histDe(j)
  const clubes = new Set(h.map((l) => l[1]))
  return {
    jogos: h.reduce((s, l) => s + l[3], 0),
    golos: h.reduce((s, l) => s + l[4], 0),
    assist: h.reduce((s, l) => s + (l[6] ?? 0), 0),
    epocas: h.length,
    pico: Math.max(j.forca, ...h.map((l) => l[5])),
    clubes: clubes.size,
  }
}

/** Idade em que o jogador pendura as botas (33 a 39). Estável para cada jogador. */
export function idadeReforma(j: Jogador): number {
  const sorte = ((Math.imul(j.id + 3, 2654435761) >>> 0) % 3) // 0, 1 ou 2
  let idade = 34 + sorte + anosExtraCarreira(j)
  if (j.posicao === 'GR') idade += 2
  if (j.forca >= 70) idade += 1
  else if (j.forca < 30) idade -= 1
  return Math.max(33, Math.min(39, idade))
}

/** Pontos de lenda: jogos (mais nas divisões de cima), golos e a força no auge. */
export function pontosLenda(j: Jogador): number {
  const h = histDe(j)
  let p = 0
  for (const l of h) p += l[3] * (1 + (4 - Math.min(4, l[2])) * 0.35) + l[4] * 2.2 + (l[6] ?? 0) * 0.8
  const pico = Math.max(j.forca, ...h.map((l) => l[5]))
  p += Math.max(0, pico - 60) * 8
  return Math.round(p)
}

/** Limiar da galeria de lendas (cerca de 15 épocas de titular na 1.ª Divisão, menos para um craque de topo). */
export const LIMIAR_LENDA = 1300

function porClube(mundo: Mundo, j: Jogador): [number, string, number, number][] {
  const m = new Map<number, [number, string, number, number]>()
  for (const l of histDe(j)) {
    const x = m.get(l[1]) ?? [l[1], mundo.clubes[l[1]]?.nome ?? '?', 0, 0]
    x[2] += l[3]; x[3] += l[4]
    m.set(l[1], x)
  }
  return [...m.values()].sort((a, b) => b[2] - a[2] || b[3] - a[3])
}

/** Regista a reforma (e a entrada nas lendas, se a carreira chegar). Chamar antes de o jogador sair do clube. */
export function registarReforma(mundo: Mundo, j: Jogador, meuClubeId: number): Reforma {
  const m = mundo as MundoComLendas
  const t = totaisCarreira(j)
  const pontos = pontosLenda(j)
  const lenda = pontos >= LIMIAR_LENDA
  const h = histDe(j)
  const ano = mundo.epoca - 1
  const r: Reforma = {
    ano, id: j.id, nome: j.nome, posicao: j.posicao, idade: j.idade,
    clubeId: j.clubeId, clube: mundo.clubes[j.clubeId]?.nome ?? '', jogos: t.jogos, golos: t.golos, lenda,
  }
  // Reformas: as lendas, as do meu clube e as de quem jogou muito ficam na lista (as 40 mais recentes).
  if (lenda || j.clubeId === meuClubeId || t.jogos >= 150) {
    m.reformas = [r, ...(m.reformas ?? [])].slice(0, 40)
  }
  if (lenda) {
    const l: Lenda = {
      id: j.id, nome: j.nome, posicao: j.posicao, nacionalidade: j.nacionalidade,
      de: h[0]?.[0] ?? ano, ate: ano, jogos: t.jogos, golos: t.golos, pico: t.pico,
      clubes: porClube(mundo, j).slice(0, 4), pontos,
    }
    m.lendas = [...(m.lendas ?? []).filter((x) => x.id !== j.id), l].sort((a, b) => b.pontos - a.pontos).slice(0, 80)
  }
  return r
}

export function lendas(mundo: Mundo): Lenda[] {
  return (mundo as MundoComLendas).lendas ?? []
}

export function reformas(mundo: Mundo): Reforma[] {
  return (mundo as MundoComLendas).reformas ?? []
}

/** Lendas que passaram por um clube (pelo número de jogos lá). */
export function lendasDoClube(mundo: Mundo, clubeId: number): { lenda: Lenda; jogos: number; golos: number }[] {
  const out: { lenda: Lenda; jogos: number; golos: number }[] = []
  for (const l of lendas(mundo)) {
    const c = l.clubes.find((x) => x[0] === clubeId)
    if (c && c[2] >= 30) out.push({ lenda: l, jogos: c[2], golos: c[3] })
  }
  return out.sort((a, b) => b.jogos - a.jogos)
}

/** Os que mais jogaram por um clube entre os jogadores ainda no ativo (para "ídolos do clube"). */
export function idolosAtivos(mundo: Mundo, clubeId: number, n = 5): { j: Jogador; jogos: number; golos: number }[] {
  const out: { j: Jogador; jogos: number; golos: number }[] = []
  for (const id of mundo.clubes[clubeId]?.plantel ?? []) {
    const j = mundo.jogadores[id]
    if (!j) continue
    let jogos = 0, golos = 0
    for (const l of histDe(j)) if (l[1] === clubeId) { jogos += l[3]; golos += l[4] }
    if (jogos > 0) out.push({ j, jogos, golos })
  }
  return out.sort((a, b) => b.jogos - a.jogos).slice(0, n)
}
