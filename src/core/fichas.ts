// Ficha de cada jogo do meu clube: táticas, onzes, substituições, golos e cartões, guardada para consulta
// (a partida do calendário perde os pormenores ao gravar, e os jogadores mudam de clube).
import type { Jogo, Mundo, Posicao } from './types'
import type { EstatJogo, Formacao, Partida, Postura, TipoEvento } from './partida'
import { posicaoDoLugar } from './motor'
import type { JogoComTaca } from './taca'

export interface JogadorFicha { id: number; nome: string; pos: Posicao; forca: number }

export interface EquipaFicha {
  id: number
  nome: string
  sigla: string
  cores: [string, string]
  formacao?: Formacao
  postura?: Postura
  titulares: JogadorFicha[]
  suplentes: JogadorFicha[]
}

export interface EventoFicha {
  minuto: number
  tipo: TipoEvento
  lado: 0 | 1
  texto: string
  /** Nome do jogador (marcador, cartão, quem sai). */
  quem?: string
  /** Assistência ou quem entra. */
  outro?: string
}

export interface FichaJogo {
  id: string
  ano: number
  competicao: 'liga' | 'taca'
  /** Ex.: "Jornada 5", "Taça · Oitavos", "Supertaça". */
  ronda: string
  casa: EquipaFicha
  fora: EquipaFicha
  golos: [number, number]
  penaltis?: [number, number]
  prolongamento?: boolean
  publico?: number
  estat: EstatJogo
  porque?: string
  eventos: EventoFicha[]
}

export type JogoComFichas = Jogo & { fichas?: FichaJogo[] }

/** Fichas completas guardadas; as mais antigas perdem os onzes para poupar espaço. */
const MAX_COMPLETAS = 90
const MAX_FICHAS = 400

const RELEVANTES: TipoEvento[] = ['golo', 'amarelo', 'vermelho', 'lesao', 'substituicao', 'postura', 'oportunidade']

function equipa(mundo: Mundo, p: Partida, lado: 0 | 1): EquipaFicha {
  const id = lado === 0 ? p.casaId : p.foraId
  const c = mundo.clubes[id]
  const esc = p.onzes?.[lado]
  const jog = (jid: number, pos?: Posicao): JogadorFicha => {
    const j = mundo.jogadores[jid]
    return { id: jid, nome: j?.curto ?? '?', pos: pos ?? j?.posicao ?? 'MED', forca: j?.forca ?? 0 }
  }
  return {
    id,
    nome: c?.nome ?? '?',
    sigla: c?.sigla ?? '???',
    cores: c?.cores ?? ['#888888', '#ffffff'],
    formacao: esc?.formacao,
    postura: esc?.postura,
    titulares: esc ? esc.titulares.map((jid, i) => jog(jid, posicaoDoLugar(esc.formacao, i))) : [],
    suplentes: esc ? esc.suplentes.map((jid) => jog(jid)) : [],
  }
}

export function criarFicha(mundo: Mundo, p: Partida, ano: number, ronda: string): FichaJogo {
  const nome = (id?: number) => (id === undefined ? undefined : mundo.jogadores[id]?.curto)
  return {
    id: p.id,
    ano,
    competicao: p.competicao,
    ronda,
    casa: equipa(mundo, p, 0),
    fora: equipa(mundo, p, 1),
    golos: [p.golos[0], p.golos[1]],
    penaltis: p.penaltis ? [p.penaltis[0], p.penaltis[1]] : undefined,
    prolongamento: p.prolongamento,
    publico: p.publico,
    estat: p.estat,
    porque: p.porque,
    eventos: p.eventos
      .filter((e) => RELEVANTES.includes(e.tipo))
      .map((e) => ({ minuto: e.minuto, tipo: e.tipo, lado: e.lado === 'casa' ? 0 : 1, texto: e.texto, quem: nome(e.jogadorId), outro: nome(e.outroId) })),
  }
}

/** Jogos já jogados do meu clube que ainda não têm ficha (liga e taça). */
function jogosPorRegistar(jogo: JogoComTaca): { p: Partida; ronda: string }[] {
  const out: { p: Partida; ronda: string }[] = []
  const meu = (p: Partida) => p.jogada && (p.casaId === jogo.clubeId || p.foraId === jogo.clubeId)
  for (const div of jogo.epoca.calendario) for (const jornada of div) for (const p of jornada) if (meu(p)) out.push({ p, ronda: `Jornada ${p.jornada}` })
  const t = jogo.taca
  if (t) {
    if (t.supertaca) for (const p of t.supertaca.jogos) if (meu(p)) out.push({ p, ronda: 'Supertaça' })
    for (const r of t.rondas) for (const p of r.jogos) if (meu(p)) out.push({ p, ronda: `Taça · ${r.nome}` })
  }
  return out
}

/** Regista as fichas que faltam. Idempotente. Devolve quantas fichas novas. */
export function registarFichas(jogo: Jogo): number {
  const j = jogo as JogoComFichas & JogoComTaca
  const fichas = (j.fichas ??= [])
  const tem = new Set(fichas.map((f) => f.id))
  let n = 0
  for (const { p, ronda } of jogosPorRegistar(j)) {
    if (tem.has(p.id)) continue
    fichas.push(criarFicha(jogo.mundo, p, jogo.epoca.ano, ronda))
    tem.add(p.id)
    n++
  }
  if (n) {
    if (fichas.length > MAX_FICHAS) fichas.splice(0, fichas.length - MAX_FICHAS)
    for (let i = 0; i < fichas.length - MAX_COMPLETAS; i++) {
      const f = fichas[i]
      if (f.casa.titulares.length) {
        f.casa = { ...f.casa, titulares: [], suplentes: [] }
        f.fora = { ...f.fora, titulares: [], suplentes: [] }
        f.eventos = f.eventos.filter((e) => e.tipo === 'golo' || e.tipo === 'vermelho')
      }
    }
  }
  return n
}

export function fichasDe(jogo: Jogo): FichaJogo[] {
  return (jogo as JogoComFichas).fichas ?? []
}

export function fichaPorId(jogo: Jogo, id: string): FichaJogo | undefined {
  return fichasDe(jogo).find((f) => f.id === id)
}

/** Postura no fim do jogo, pelas mudanças registadas (o texto diz "ofensiva", "defensiva"...). */
export function posturaFinal(f: FichaJogo, lado: 0 | 1): Postura | undefined {
  let p = (lado === 0 ? f.casa : f.fora).postura
  for (const e of f.eventos) {
    if (e.tipo !== 'postura' || e.lado !== lado) continue
    if (/ofensiv|ataque|arrisca/i.test(e.texto)) p = 'ofensiva'
    else if (/defensiv|fecha|recua/i.test(e.texto)) p = 'defensiva'
    else if (/equilibrad/i.test(e.texto)) p = 'equilibrada'
  }
  return p
}
