// Balneário: moral de cada jogador, tempo de jogo, promessas, conflitos e capitão.
// A moral vive no próprio jogador (campo opcional, gravado com o mundo) para o motor a poder ler.
// O estado do balneário do utilizador (capitão, promessas, mensagens) vive em jogo.balneario.
import { personalidadeDe } from './personalidade'
import { moralDaNota } from './notas'
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
  // Época nova: contadores a zero; promessas e conflitos da época passada caem (as férias acalmam tudo).
  if (st.ano !== ano) { st.ano = ano; st.jogos = {}; st.titular = {}; st.jornada = jogo.epoca?.jornada ?? 1; st.promessas = []; st.conflitos = [] }
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

// ---------- Capitão ----------

/** Clube com capitão escolhido (opcional; sem escolha, o balneário escolhe o líder natural). */
export type ClubeComCapitao = import('./types').Clube & { capitaoId?: number }

/** Liderança 0-1: experiência pesa mais, ser dos melhores do plantel ajuda. */
function mediaPlantel(mundo: Mundo, clubeId: number): number | undefined {
  const c = mundo.clubes[clubeId]
  return c && c.plantel.length ? c.plantel.reduce((s, id) => s + (mundo.jogadores[id]?.forca ?? 0), 0) / c.plantel.length : undefined
}

export function lideranca(mundo: Mundo, j: Jogador, mediaDoPlantel?: number): number {
  const media = mediaDoPlantel ?? mediaPlantel(mundo, j.clubeId) ?? j.forca
  const exp = clamp((j.idade - 20) / 12, 0, 1)
  const nivel = clamp((j.forca - media) / 20 + 0.5, 0, 1)
  const tr = personalidadeDe(j)
  const bonus = tr === 'lider' ? 0.25 : tr === 'temperamental' || tr === 'descontraido' ? -0.1 : 0
  return Math.round(clamp(exp * 0.6 + nivel * 0.4 + bonus, 0, 1.25) * 100) / 100
}

/** Líder natural do plantel (quem o balneário escolheria). */
export function liderNatural(mundo: Mundo, clubeId: number): number | undefined {
  const c = mundo.clubes[clubeId]
  let melhor: Jogador | undefined
  let mv = -1
  const media = mediaPlantel(mundo, clubeId)
  for (const id of c?.plantel ?? []) {
    const j = mundo.jogadores[id]
    if (!j) continue
    const v = lideranca(mundo, j, media)
    if (v > mv || (v === mv && melhor && j.id < melhor.id)) { melhor = j; mv = v }
  }
  return melhor?.id
}

export function capitaoDe(mundo: Mundo, clubeId: number): number | undefined {
  const c = mundo.clubes[clubeId] as ClubeComCapitao | undefined
  if (c?.capitaoId && c.plantel.includes(c.capitaoId)) return c.capitaoId
  return liderNatural(mundo, clubeId)
}

// ---------- Estatuto e tempo de jogo ----------

export type Estatuto = 'titular' | 'rotacao' | 'reserva' | 'jovem'

const LUGARES: Record<string, number> = { GR: 1, DEF: 4, MED: 4, AV: 2 }

/** O que cada jogador espera jogar, pela posição dele na hierarquia do plantel. */
export function estatutos(mundo: Mundo, clubeId: number): Map<number, Estatuto> {
  const out = new Map<number, Estatuto>()
  const c = mundo.clubes[clubeId]
  if (!c) return out
  const porPos = new Map<string, Jogador[]>()
  for (const id of c.plantel) {
    const j = mundo.jogadores[id]
    if (!j) continue
    const l = porPos.get(j.posicao) ?? []
    l.push(j)
    porPos.set(j.posicao, l)
  }
  for (const [pos, l] of porPos) {
    l.sort((a, b) => b.forca - a.forca || a.id - b.id)
    const n = LUGARES[pos] ?? 2
    l.forEach((j, i) => {
      const e: Estatuto = i < n ? 'titular' : i < n * 2 ? 'rotacao' : 'reserva'
      out.set(j.id, e !== 'titular' && j.idade <= 20 ? 'jovem' : e)
    })
  }
  return out
}

export const NOME_ESTATUTO: Record<Estatuto, string> = { titular: 'Titular', rotacao: 'Rotação', reserva: 'Suplente', jovem: 'Jovem' }

/** Onze inicial de cada lado, se a partida o guardou. */
export function titularesDe(p: import('./partida').Partida): [number[], number[]] | undefined {
  return p.onzes ? [p.onzes[0].titulares, p.onzes[1].titulares] : undefined
}

/** Minutos jogados por cada jogador numa partida (onze + substituições + saídas). */
export function minutosJogados(p: import('./partida').Partida): Map<number, number> {
  const out = new Map<number, number>()
  const onze = titularesDe(p)
  if (!onze) return out
  const fim = Math.max(90, ...p.eventos.map((e) => e.minuto))
  const entrou = new Map<number, number>()
  for (const ids of onze) for (const id of ids) entrou.set(id, 0)
  const saiu = new Map<number, number>()
  for (const e of p.eventos) {
    if (e.tipo === 'substituicao') {
      if (e.jogadorId !== undefined && !saiu.has(e.jogadorId)) saiu.set(e.jogadorId, e.minuto)
      if (e.outroId !== undefined) entrou.set(e.outroId, e.minuto)
    } else if ((e.tipo === 'vermelho' || e.tipo === 'lesao') && e.jogadorId !== undefined && !saiu.has(e.jogadorId)) {
      saiu.set(e.jogadorId, e.minuto)
    }
  }
  for (const [id, de] of entrou) out.set(id, Math.max(1, (saiu.get(id) ?? fim) - de))
  return out
}

/**
 * Depois de um jogo: moral pelo resultado e pelo tempo de jogo, cansaço de quem jogou.
 * Vale para todos os clubes (o computador também tem balneário). `liga` = jogo do campeonato
 * (na taça a rotação é aceite e o resultado pesa menos).
 */
export function aplicarJogo(mundo: Mundo, p: import('./partida').Partida, indisponiveis: ReadonlySet<number>, liga = true): void {
  if (!p.jogada) return
  const mins = minutosJogados(p)
  const t = titularesDe(p)
  const onze = new Set(t ? [...t[0], ...t[1]] : [])
  const lados: [number, number, number][] = [[p.casaId, p.golos[0], p.golos[1]], [p.foraId, p.golos[1], p.golos[0]]]
  for (const [cid, gm, gs] of lados) {
    const c = mundo.clubes[cid]
    if (!c) continue
    const cap = capitaoDe(mundo, cid)
    const lid = cap ? lideranca(mundo, mundo.jogadores[cap]) : 0
    const est = estatutos(mundo, cid)
    const peso = liga ? 1 : 0.5
    const resultado = gm > gs ? 3 : gm === gs ? 0.5 : -3 * (1 - 0.3 * lid)
    for (const id of c.plantel) {
      const j = mundo.jogadores[id]
      if (!j) continue
      const m = mins.get(id) ?? 0
      const e = est.get(id) ?? 'reserva'
      let d = resultado * peso
      if (m > 0) {
        const titular = onze.has(id)
        if (titular) d += e === 'titular' ? 1 : e === 'rotacao' ? 2 : 3
        else d += e === 'titular' ? -1 : 1.5
        // A exibição também conta: uma grande nota dá confiança, uma má tira.
        d += moralDaNota(p.notas?.[id]) * (liga ? 1 : 0.6)
        definirFadigaJ(j, m)
      } else if (!indisponiveis.has(id)) {
        d += (e === 'titular' ? -4 : e === 'rotacao' ? -1.5 : e === 'reserva' ? -0.3 : 0) * (liga ? 1 : 0.4)
        if (id === cap) d -= 2
      }
      aplicar(j, d)
    }
  }
}

function definirFadigaJ(j: Jogador, minutos: number) {
  const x = j as JogadorVivo & { fragil?: number }
  const f = x.fadiga ?? 0
  const idade = j.idade >= 31 ? 1.25 : j.idade <= 21 ? 0.9 : 1
  x.fadiga = Math.round(Math.min(100, f + 20 * idade * Math.min(1.35, minutos / 90)))
  if (x.fragil) { x.fragil -= 1; if (x.fragil <= 0) delete x.fragil }
}

/** Semana de descanso entre jornadas: recupera-se do cansaço e a moral volta devagar ao normal. */
export function semanaDeTreino(mundo: Mundo, clubes: Iterable<number>, nivelFisico: (clubeId: number) => number): void {
  for (const cid of clubes) {
    const c = mundo.clubes[cid]
    if (!c) continue
    const n = nivelFisico(cid)
    for (const id of c.plantel) {
      const j = mundo.jogadores[id] as JogadorVivo | undefined
      if (!j) continue
      if (j.fadiga) j.fadiga = Math.round(j.fadiga * (0.55 - 0.025 * n))
      if (j.moral !== undefined) definirMoral(j, j.moral + (MORAL_NEUTRA - j.moral) * 0.1)
    }
  }
}

/** Férias: o cansaço desaparece, a moral fica a meio caminho do normal e as fragilidades passam. */
export function feriasBalneario(mundo: Mundo): void {
  for (const j of Object.values(mundo.jogadores) as (JogadorVivo & { fragil?: number })[]) {
    if (j.fadiga) j.fadiga = 0
    if (j.fragil) delete j.fragil
    if (j.moral !== undefined) definirMoral(j, MORAL_NEUTRA + (j.moral - MORAL_NEUTRA) * 0.5)
  }
}
