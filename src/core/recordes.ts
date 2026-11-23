// Estatísticas e recordes de todas as épocas: campeões (hall of fame), melhores marcadores de sempre,
// séries, maiores vitórias, confrontos diretos e os números do mister. Atualizado jornada a jornada.
import type { Jogo } from './types'
import type { EstadoEpoca, Partida } from './partida'
import { tabela } from './epoca'
import { NOMES_DIVISAO } from './mundo'

export type TipoRecorde =
  | 'maiorVitoria' | 'maisGolosJogo' | 'golosJogador' | 'serieVitorias' | 'serieInvencivel' | 'serieDerrotas'
  | 'maisPontos' | 'maisGolosEpoca'

export const NOME_RECORDE: Record<TipoRecorde, string> = {
  maiorVitoria: 'Maior vitória',
  maisGolosJogo: 'Mais golos num jogo',
  golosJogador: 'Mais golos de um jogador num jogo',
  serieVitorias: 'Mais vitórias seguidas',
  serieInvencivel: 'Mais jogos seguidos sem perder',
  serieDerrotas: 'Mais derrotas seguidas',
  maisPontos: 'Mais pontos numa época',
  maisGolosEpoca: 'Mais golos de um jogador numa época',
}

export interface Recorde {
  valor: number
  texto: string
  ano: number
  /** Desempate de valor igual (diferença de golos, por exemplo). */
  extra?: number
}

export interface Serie { v: number; inv: number; d: number }

export interface Campeao { ano: number; divisao: number; clubeId: number; nome: string; pontos: number; meu?: boolean }
export interface Goleador { ano: number; divisao: number; jogadorId: number; nome: string; clube: string; golos: number }
export interface MarcadorHist { nome: string; clube: string; golos: number; epocas: number }

export interface NumerosMister {
  jogos: number; v: number; e: number; d: number; gm: number; gs: number
  titulos: number; subidas: number
  maiorVitoria?: Recorde
  melhorSerie: number
  /** Vitórias seguidas. */
  serieAtual: number
}

export interface EstadoRecordes {
  series: Record<number, Serie>
  recordes: Partial<Record<TipoRecorde, Recorde>>
  campeoes: Campeao[]
  goleadores: Goleador[]
  /** Golos das épocas já fechadas, por jogador. */
  marcadores: Record<number, MarcadorHist>
  /** "a-b" com a < b: [vitórias de a, empates, vitórias de b, golos de a, golos de b]. */
  confrontos: Record<string, [number, number, number, number, number]>
  mister: NumerosMister
  fechadas: number[]
}

export type JogoComRecordes = Jogo & { recordes?: EstadoRecordes }

export function estadoRecordes(jogo: Jogo): EstadoRecordes {
  const j = jogo as JogoComRecordes
  j.recordes ??= {
    series: {}, recordes: {}, campeoes: [], goleadores: [], marcadores: {}, confrontos: {},
    mister: { jogos: 0, v: 0, e: 0, d: 0, gm: 0, gs: 0, titulos: 0, subidas: 0, melhorSerie: 0, serieAtual: 0 },
    fechadas: [],
  }
  return j.recordes
}

const ep = (ano: number) => `${ano}/${String(ano + 1).slice(2)}`
const nomeDiv = (n: number) => NOMES_DIVISAO[n - 1] ?? `${n}.ª Divisão`

export function chaveConfronto(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`
}

/** Historial entre dois clubes, do ponto de vista de `a`: vitórias, empates, derrotas, golos marcados e sofridos. */
export function confronto(jogo: Jogo, a: number, b: number): { v: number; e: number; d: number; gm: number; gs: number } {
  const c = estadoRecordes(jogo).confrontos[chaveConfronto(a, b)]
  if (!c) return { v: 0, e: 0, d: 0, gm: 0, gs: 0 }
  return a < b ? { v: c[0], e: c[1], d: c[2], gm: c[3], gs: c[4] } : { v: c[2], e: c[1], d: c[0], gm: c[4], gs: c[3] }
}

/** Bate (ou iguala com melhor desempate) um recorde. Devolve true se bateu. */
function tentar(st: EstadoRecordes, tipo: TipoRecorde, r: Recorde): boolean {
  const atual = st.recordes[tipo]
  if (atual && (r.valor < atual.valor || (r.valor === atual.valor && (r.extra ?? 0) <= (atual.extra ?? 0)))) return false
  st.recordes[tipo] = r
  return true
}

/** Recorde batido numa jornada, para as notícias. */
export interface RecordeBatido { tipo: TipoRecorde; r: Recorde; anterior?: Recorde }

/** Processa uma jornada de todas as divisões. Devolve os recordes batidos. */
export function processarJornada(jogo: Jogo, partidas: Partida[], ano: number): RecordeBatido[] {
  const st = estadoRecordes(jogo)
  const { mundo } = jogo
  const out: RecordeBatido[] = []
  const bater = (tipo: TipoRecorde, r: Recorde) => {
    const anterior = st.recordes[tipo]
    // Só conta como notícia depois de haver um recorde (o primeiro registo não é "batido").
    if (tentar(st, tipo, r) && anterior) out.push({ tipo, r, anterior })
  }
  const nome = (id: number) => mundo.clubes[id]?.nome ?? '?'
  for (const p of partidas) {
    if (!p.jogada || p.competicao !== 'liga') continue
    const [gc, gf] = p.golos
    const placar = `${nome(p.casaId)} ${gc}-${gf} ${nome(p.foraId)}`
    const dif = Math.abs(gc - gf)
    if (dif >= 3) bater('maiorVitoria', { valor: dif, extra: Math.max(gc, gf), texto: `${placar} (${nomeDiv(p.divisao)})`, ano })
    if (gc + gf >= 5) bater('maisGolosJogo', { valor: gc + gf, texto: `${placar} (${nomeDiv(p.divisao)})`, ano })
    // Golos por jogador neste jogo.
    const porJog = new Map<number, number>()
    for (const e of p.eventos) if (e.tipo === 'golo' && e.jogadorId !== undefined) porJog.set(e.jogadorId, (porJog.get(e.jogadorId) ?? 0) + 1)
    for (const [id, n] of porJog) {
      if (n < 3) continue
      const j = mundo.jogadores[id]
      bater('golosJogador', { valor: n, texto: `${j?.nome ?? '?'} (${nome(j?.clubeId ?? -1)}) em ${placar}`, ano })
    }
    // Confrontos diretos.
    const k = chaveConfronto(p.casaId, p.foraId)
    const c = (st.confrontos[k] ??= [0, 0, 0, 0, 0])
    const [ga, gb] = p.casaId < p.foraId ? [gc, gf] : [gf, gc]
    c[ga > gb ? 0 : ga === gb ? 1 : 2]++
    c[3] += ga; c[4] += gb
    // Séries.
    for (const [id, m, s] of [[p.casaId, gc, gf], [p.foraId, gf, gc]] as const) {
      const se = (st.series[id] ??= { v: 0, inv: 0, d: 0 })
      if (m > s) { se.v++; se.inv++; se.d = 0 } else if (m === s) { se.v = 0; se.inv++; se.d = 0 } else { se.v = 0; se.inv = 0; se.d++ }
      if (se.v >= 5) bater('serieVitorias', { valor: se.v, texto: `${nome(id)} (${ep(ano)})`, ano })
      if (se.inv >= 8) bater('serieInvencivel', { valor: se.inv, texto: `${nome(id)} (${ep(ano)})`, ano })
      if (se.d >= 5) bater('serieDerrotas', { valor: se.d, texto: `${nome(id)} (${ep(ano)})`, ano })
      if (id === jogo.clubeId) {
        const mi = st.mister
        mi.jogos++; mi.gm += m; mi.gs += s
        if (m > s) { mi.v++; mi.serieAtual++ } else { if (m === s) mi.e++; else mi.d++; mi.serieAtual = 0 }
        mi.melhorSerie = Math.max(mi.melhorSerie, mi.serieAtual)
        if (m - s >= 2 && (!mi.maiorVitoria || m - s > mi.maiorVitoria.valor || (m - s === mi.maiorVitoria.valor && m > (mi.maiorVitoria.extra ?? 0)))) {
          mi.maiorVitoria = { valor: m - s, extra: m, texto: placar, ano }
        }
      }
    }
  }
  return out
}

/** Fecha a época nos recordes (chamar antes de fecharEpoca, com as tabelas finais). Idempotente. */
export function fecharEpocaRecordes(jogo: Jogo, epoca: EstadoEpoca): RecordeBatido[] {
  const st = estadoRecordes(jogo)
  if (st.fechadas.includes(epoca.ano)) return []
  st.fechadas.push(epoca.ano)
  const { mundo } = jogo
  const out: RecordeBatido[] = []
  const meuDiv = mundo.clubes[jogo.clubeId].divisao
  for (const d of mundo.divisoes) {
    const t = tabela(mundo, epoca, d.numero)
    if (!t.length) continue
    const l = t[0]
    const c = mundo.clubes[l.clubeId]
    const meu = l.clubeId === jogo.clubeId
    st.campeoes.push({ ano: epoca.ano, divisao: d.numero, clubeId: l.clubeId, nome: c?.nome ?? '?', pontos: l.pts, meu })
    if (meu) st.mister.titulos++
    const anterior = st.recordes.maisPontos
    if (tentar(st, 'maisPontos', { valor: l.pts, extra: l.gm - l.gs, texto: `${c?.nome ?? '?'}, campeão da ${nomeDiv(d.numero)} (${ep(epoca.ano)})`, ano: epoca.ano }) && anterior) {
      out.push({ tipo: 'maisPontos', r: st.recordes.maisPontos!, anterior })
    }
    if (d.numero === meuDiv && d.numero > 1) {
      const pos = t.findIndex((x) => x.clubeId === jogo.clubeId)
      if (pos >= 0 && pos < 3) st.mister.subidas++
    }
    // Melhor marcador da divisão.
    let melhor: { id: number; g: number } | null = null
    for (const [k, g] of Object.entries(epoca.marcadores)) {
      const id = Number(k)
      const j = mundo.jogadores[id]
      if (!j || mundo.clubes[j.clubeId]?.divisao !== d.numero) continue
      if (!melhor || g > melhor.g || (g === melhor.g && id < melhor.id)) melhor = { id, g }
    }
    if (melhor) {
      const j = mundo.jogadores[melhor.id]
      st.goleadores.push({ ano: epoca.ano, divisao: d.numero, jogadorId: melhor.id, nome: j.nome, clube: mundo.clubes[j.clubeId]?.nome ?? '?', golos: melhor.g })
    }
  }
  // Golos da época para a tabela de sempre e o recorde de golos numa época.
  for (const [k, g] of Object.entries(epoca.marcadores)) {
    if (g <= 0) continue
    const id = Number(k)
    const j = mundo.jogadores[id]
    const h = (st.marcadores[id] ??= { nome: j?.nome ?? '?', clube: '', golos: 0, epocas: 0 })
    h.golos += g; h.epocas++
    if (j) { h.nome = j.nome; h.clube = mundo.clubes[j.clubeId]?.nome ?? h.clube }
    const anterior = st.recordes.maisGolosEpoca
    if (tentar(st, 'maisGolosEpoca', { valor: g, texto: `${h.nome} (${h.clube}, ${ep(epoca.ano)})`, ano: epoca.ano }) && anterior) {
      out.push({ tipo: 'maisGolosEpoca', r: st.recordes.maisGolosEpoca!, anterior })
    }
  }
  // A tabela de sempre fica com os 200 melhores (o resto ocupa espaço sem nunca aparecer).
  const ids = Object.keys(st.marcadores)
  if (ids.length > 300) {
    const manter = new Set(ids.sort((a, b) => st.marcadores[Number(b)].golos - st.marcadores[Number(a)].golos).slice(0, 200))
    for (const k of ids) if (!manter.has(k)) delete st.marcadores[Number(k)]
  }
  return out
}

/** Melhores marcadores de sempre, contando a época em curso. */
export function marcadoresDeSempre(jogo: Jogo, n = 15): { id: number; nome: string; clube: string; golos: number; epocas: number }[] {
  const st = estadoRecordes(jogo)
  const { mundo, epoca } = jogo
  const tot = new Map<number, { nome: string; clube: string; golos: number; epocas: number }>()
  for (const [k, h] of Object.entries(st.marcadores)) tot.set(Number(k), { ...h })
  if (!st.fechadas.includes(epoca.ano)) {
    for (const [k, g] of Object.entries(epoca.marcadores)) {
      if (g <= 0) continue
      const id = Number(k)
      const j = mundo.jogadores[id]
      const h = tot.get(id) ?? { nome: j?.nome ?? '?', clube: '', golos: 0, epocas: 0 }
      h.golos += g; h.epocas++
      tot.set(id, h)
    }
  }
  for (const [id, h] of tot) { const j = mundo.jogadores[id]; if (j) h.clube = mundo.clubes[j.clubeId]?.nome ?? h.clube }
  return [...tot.entries()].map(([id, h]) => ({ id, ...h })).sort((a, b) => b.golos - a.golos || a.id - b.id).slice(0, n)
}

/** Série atual de um clube. */
export function serieDe(jogo: Jogo, clubeId: number): Serie {
  return estadoRecordes(jogo).series[clubeId] ?? { v: 0, inv: 0, d: 0 }
}

export function textoRecorde(b: RecordeBatido): string {
  return `${NOME_RECORDE[b.tipo]}: ${b.r.valor}, ${b.r.texto}${b.anterior ? ` (antes: ${b.anterior.valor})` : ''}`
}

