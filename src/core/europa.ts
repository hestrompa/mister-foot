// Competições europeias: Liga Continental (os 2 primeiros da 1.ª Divisão) e Taça Continental (3.º, 4.º e o vencedor da taça).
// 16 clubes em cada uma: 4 grupos de 4 a duas voltas, quartos e meias a duas mãos, final a uma mão em campo neutro.
// Os clubes estrangeiros não entram no mundo (nem no mercado, nem nas finanças): vivem no estado da Europa e
// os jogos usam uma cópia do mundo com eles lá dentro (`mundoEuropa`). Joga-se a meio da semana, em datas
// que não chocam com a Taça Nacional, e não há salários nesses jogos.
import { aplicarJogo } from './balneario'
import type { Clube, Jogador, Jogo, Mundo, Posicao } from './types'
import type { Escalacao, EstatJogo, Partida } from './partida'
import { createRng, type Rng } from './rng'
import { avancarMinuto, iniciarJogo } from './motor'
import { escalarIA } from './tatica'
import { forcaClube, salarioDe, valorDe } from './mundo'
import { publicoEsperado } from './financas'
import { lotacaoAtual } from './estadio'
import { tabela } from './epoca'
import { garantirTaca, marcarPenaltis, prolongar, vencedorDe, textoResultado, type JogoComTaca } from './taca'
import { CLUBES_EUROPA, CORES_EUROPA, PAISES_EUROPA } from './nomes-europa'

export type IdComp = 'liga' | 'taca'

export interface PremiosEuropa {
  /** Por entrar na fase de grupos. */
  entrada: number
  vitoria: number
  empate: number
  /** Por chegar aos quartos, às meias e à final. */
  quartos: number
  meias: number
  final: number
  /** Por ganhar a final. */
  vencedor: number
}

export interface InfoComp {
  id: IdComp
  nome: string
  /** Vagas para clubes nacionais. */
  vagas: number
  premios: PremiosEuropa
  /** Pontos de reputação para o vencedor. */
  reputacao: number
}

export const COMPETICOES: Record<IdComp, InfoComp> = {
  liga: {
    id: 'liga', nome: 'Liga Continental', vagas: 2, reputacao: 4,
    premios: { entrada: 600_000, vitoria: 100_000, empate: 35_000, quartos: 400_000, meias: 600_000, final: 900_000, vencedor: 1_200_000 },
  },
  taca: {
    id: 'taca', nome: 'Taça Continental', vagas: 3, reputacao: 2,
    premios: { entrada: 250_000, vitoria: 50_000, empate: 15_000, quartos: 150_000, meias: 250_000, final: 400_000, vencedor: 500_000 },
  },
}

export const ORDEM_COMPS: IdComp[] = ['liga', 'taca']
/** Parte da bilheteira europeia que fica para o clube da casa. */
export const PARTE_BILHETEIRA = 0.4
const POR_COMP = 16
const GRUPOS = 4
/** Primeiro id dos clubes estrangeiros e dos seus jogadores (longe dos do mundo). */
const ID_CLUBE = 9001
const ID_JOGADOR = 5_000_000
/** Jogos de cada jornada da fase de grupos (índices no grupo): todos jogam com todos em casa e fora. */
const JORNADAS_GRUPO: [number, number][][] = [
  [[0, 1], [2, 3]], [[3, 0], [1, 2]], [[0, 2], [3, 1]], [[1, 0], [3, 2]], [[0, 3], [2, 1]], [[2, 0], [1, 3]],
]
const NOMES_RONDA = [
  'Fase de grupos · 1.ª jornada', 'Fase de grupos · 2.ª jornada', 'Fase de grupos · 3.ª jornada',
  'Fase de grupos · 4.ª jornada', 'Fase de grupos · 5.ª jornada', 'Fase de grupos · 6.ª jornada',
  'Quartos de final · 1.ª mão', 'Quartos de final · 2.ª mão', 'Meias-finais · 1.ª mão', 'Meias-finais · 2.ª mão', 'Final',
]
const FASES: RondaEuropa['fase'][] = ['grupo', 'grupo', 'grupo', 'grupo', 'grupo', 'grupo', 'ida', 'volta', 'ida', 'volta', 'final']
/** Datas (jornada da liga depois da qual se joga) pensadas para 34 jornadas; escalam para outros calendários. */
const DATAS_BASE = [2, 4, 6, 10, 12, 15, 20, 24, 26, 29, 33]

export interface ClubeEstrangeiro {
  id: number
  pais: string
  /** 0 a ~1: quão forte é o clube no panorama europeu (muda devagar de época para época). */
  nivel: number
  cores: [string, string]
}

export interface RondaEuropa {
  nome: string
  fase: 'grupo' | 'ida' | 'volta' | 'final'
  jogos: Partida[]
  jogada: boolean
}

export interface CompEuropa {
  id: IdComp
  clubes: number[]
  /** grupos[g] = 4 clubes pela ordem do sorteio. */
  grupos: number[][]
  /** 11 rondas, uma por data de `datas`. Na 2.ª mão, jogos[i] é a desforra de jogos[i] da 1.ª. */
  rondas: RondaEuropa[]
  /** Fase em que cada clube caiu (texto). */
  eliminados: Record<number, string>
  vencedorId?: number
}

export interface NoticiaEuropa { dia: number; texto: string; minha?: boolean }

export interface HistoricoEuropa {
  ano: number
  comp: IdComp
  vencedorId: number
  finalistaId: number
  /** Nomes guardados: os clubes estrangeiros mudam de época para época. */
  vencedor: string
  finalista: string
  /** País do vencedor (vazio = clube nacional). */
  pais: string
  resultado: string
}

export interface Qualificados { ano: number; liga: number[]; taca: number[] }

export interface EstadoEuropa {
  ano: number
  /** Gravação antiga carregada tarde demais: a Europa começa na época seguinte. */
  semEuropa?: boolean
  pool: ClubeEstrangeiro[]
  /** Clubes e jogadores estrangeiros desta época. */
  clubes: Record<number, Clube>
  jogadores: Record<number, Jogador>
  pais: Record<number, string>
  /** Jornada da liga depois da qual se joga cada dia europeu. */
  datas: number[]
  /** Próximo dia por jogar (= datas.length quando acabou). */
  dia: number
  comps: CompEuropa[]
  castigos: Record<number, number>
  marcadores: Record<number, number>
  receitas: Record<number, number>
  noticias: NoticiaEuropa[]
  historico: HistoricoEuropa[]
  /** Apurados no fim da época anterior (ou no fim desta, para a seguinte). */
  qualificados?: Qualificados
}

export type JogoComEuropa = Jogo & { europa?: EstadoEuropa }

function mistura(...partes: number[]): number {
  let h = 0x1b873593
  for (const p of partes) {
    h = Math.imul(h ^ (p >>> 0), 0xcc9e2d51) >>> 0
    h ^= h >>> 15
    h = Math.imul(h, 0x85ebca6b) >>> 0
    h ^= h >>> 13
  }
  return h >>> 0
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function estatVazia(): EstatJogo {
  return { posse: [0, 0], remates: [0, 0], rematesBaliza: [0, 0], cantos: [0, 0], amarelos: [0, 0], vermelhos: [0, 0] }
}

/** Datas dos 11 dias europeus, sem chocar com as jornadas `ocupadas` (Taça Nacional). */
export function datasEuropa(totalJornadas: number, ocupadas: number[]): number[] {
  const usadas = new Set(ocupadas)
  const out: number[] = []
  const max = Math.max(1, totalJornadas - 1)
  for (const b of DATAS_BASE) {
    const alvo = clamp(Math.round((b * totalJornadas) / 34), 1, max)
    const ultimo = out.length ? out[out.length - 1] : 0
    let escolhida = -1
    for (const dl of [0, 1, -1, 2, -2, 3, -3]) {
      const c = alvo + dl
      if (c > ultimo && c >= 1 && c <= max && !usadas.has(c)) { escolhida = c; break }
    }
    if (escolhida < 0) escolhida = Math.min(max, ultimo + 1)
    usadas.add(escolhida)
    out.push(escolhida)
  }
  return out
}

/** Os clubes estrangeiros que existem no jogo (sempre os mesmos numa carreira). */
export function gerarPool(semente: number): ClubeEstrangeiro[] {
  const rng = createRng(mistura(semente, 0xe0a0))
  return CLUBES_EUROPA.map(([pais], i) => {
    const peso = PAISES_EUROPA[pais]?.peso ?? 0.4
    return { id: ID_CLUBE + i, pais, nivel: clamp(peso * 0.8 + rng.normal(0, 0.12), 0.05, 1.1), cores: CORES_EUROPA[(i * 5 + rng.int(0, 3)) % CORES_EUROPA.length] }
  })
}

/** Nível médio dos candidatos nacionais: as 5 equipas mais fortes da 1.ª Divisão. */
function referencia(mundo: Mundo): number {
  const d1 = mundo.divisoes[0]?.clubes ?? []
  const f = d1.map((id) => forcaClube(mundo, id)).sort((a, b) => b - a).slice(0, 5)
  return f.length ? f.reduce((s, x) => s + x, 0) / f.length : 70
}

const PLANTEL_EU: Record<Posicao, number> = { GR: 2, DEF: 7, MED: 7, AV: 4 }

function criarClubeEstrangeiro(est: EstadoEuropa, base: ClubeEstrangeiro, media: number, rng: Rng, proxJog: { v: number }): Clube {
  const [pais, nome, cidade, sigla, estadio] = CLUBES_EUROPA[base.id - ID_CLUBE]
  const p = PAISES_EUROPA[pais]
  const c: Clube = {
    id: base.id, nome, sigla, cidade, cores: base.cores, divisao: 0,
    reputacao: clamp(Math.round(media * 1.15 + rng.normal(0, 2)), 30, 100),
    dinheiro: 0,
    estadio: { nome: estadio, lugares: Math.round((18_000 + base.nivel * 55_000) / 500) * 500 },
    bilhete: 25,
    plantel: [],
  }
  for (const pos of ['GR', 'DEF', 'MED', 'AV'] as Posicao[]) {
    for (let k = 0; k < PLANTEL_EU[pos]; k++) {
      const titular = (pos === 'GR' && k === 0) || (pos === 'DEF' && k < 4) || (pos === 'MED' && k < 4) || (pos === 'AV' && k < 2)
      const idade = clamp(Math.round(rng.normal(26, 4)), 18, 35)
      const forca = clamp(Math.round(media + (titular ? 3 : -4) + rng.normal(0, 4)), 20, 97)
      // Uns quantos estrangeiros de outros países, como em qualquer plantel.
      const origem = rng.chance(0.75) ? p : PAISES_EUROPA[rng.pick(['ES', 'FR', 'NL', 'HR', 'TR'])]
      const primeiro = rng.pick(origem.nomes), ultimo = rng.pick(origem.apelidos)
      const j: Jogador = {
        id: proxJog.v++, nome: `${primeiro} ${ultimo}`, curto: `${primeiro[0]}. ${ultimo}`, posicao: pos, idade, forca,
        potencial: forca, nacionalidade: origem.codigo, salario: salarioDe(forca, 1), valor: valorDe(forca, idade), craque: false, contrato: 2, clubeId: c.id,
      }
      est.jogadores[j.id] = j
      c.plantel.push(j.id)
    }
  }
  const ordem = c.plantel.map((id) => est.jogadores[id]).sort((a, b) => b.forca - a.forca)
  if (ordem[0].forca - ordem[1].forca >= 2) ordem[0].craque = true
  est.clubes[c.id] = c
  est.pais[c.id] = pais
  return c
}

/** O mundo com os clubes estrangeiros desta época lá dentro (para o motor, a tática e a UI). */
export function mundoEuropa(jogo: JogoComEuropa): Mundo {
  const e = jogo.europa
  if (!e || !Object.keys(e.clubes).length) return jogo.mundo
  return { ...jogo.mundo, clubes: { ...jogo.mundo.clubes, ...e.clubes }, jogadores: { ...jogo.mundo.jogadores, ...e.jogadores } }
}

/** Primeira época (sem classificação anterior): vão os clubes da 1.ª com mais nome. */
function qualificacaoInicial(mundo: Mundo, ano: number): Qualificados {
  const d1 = (mundo.divisoes[0]?.clubes ?? []).slice().sort((a, b) => mundo.clubes[b].reputacao - mundo.clubes[a].reputacao || a - b)
  return { ano: ano - 1, liga: d1.slice(0, COMPETICOES.liga.vagas), taca: d1.slice(COMPETICOES.liga.vagas, COMPETICOES.liga.vagas + COMPETICOES.taca.vagas) }
}

function novaPartida(id: string, casaId: number, foraId: number, jornada: number): Partida {
  return { id, competicao: 'europa', divisao: 0, jornada, casaId, foraId, golos: [0, 0], eventos: [], estat: estatVazia(), jogada: false }
}

function noticia(e: EstadoEuropa, texto: string, minha = false) {
  e.noticias.push({ dia: e.dia, texto, minha: minha || undefined })
  if (e.noticias.length > 70) e.noticias.splice(0, e.noticias.length - 70)
}

export function nomeClube(jogo: JogoComEuropa, id: number): string {
  return jogo.mundo.clubes[id]?.nome ?? jogo.europa?.clubes[id]?.nome ?? '?'
}

/** País de um clube estrangeiro (undefined = clube nacional). */
export function paisDe(jogo: JogoComEuropa, id: number): string | undefined {
  const c = jogo.europa?.pais[id]
  return c ? PAISES_EUROPA[c]?.nome : undefined
}

/** Cria a Europa da época: clubes estrangeiros, sorteio dos grupos e calendário. */
function criarEuropa(jogo: JogoComEuropa, antiga: EstadoEuropa | undefined): EstadoEuropa {
  const { mundo } = jogo
  const ano = jogo.epoca.ano
  const rng = createRng(mistura(mundo.semente, ano, 0xe1))
  const pool = antiga?.pool ?? gerarPool(mundo.semente)
  // De época para época, os estrangeiros sobem e descem um pouco (e puxam para o peso do campeonato).
  if (antiga && antiga.ano < ano) {
    for (const c of pool) {
      const peso = PAISES_EUROPA[c.pais]?.peso ?? 0.4
      c.nivel = clamp(c.nivel + (peso * 0.8 - c.nivel) * 0.1 + rng.normal(0, 0.05), 0.05, 1.15)
    }
  }
  const datas = datasEuropa(jogo.epoca.totalJornadas, garantirTaca(jogo as JogoComTaca).rondas.map((r) => r.aposJornada))
  const e: EstadoEuropa = {
    ano, pool, clubes: {}, jogadores: {}, pais: {}, datas, dia: 0, comps: [],
    castigos: {}, marcadores: {}, receitas: {}, noticias: [], historico: antiga?.historico ?? [], qualificados: antiga?.qualificados,
  }
  const q0 = antiga?.qualificados && antiga.qualificados.ano === ano - 1 ? antiga.qualificados : qualificacaoInicial(mundo, ano)
  const valido = (id: number) => !!mundo.clubes[id]
  const qual: Record<IdComp, number[]> = { liga: q0.liga.filter(valido), taca: q0.taca.filter(valido) }

  // Estrangeiros: os de mais nível (com um pouco de sorte) vão à Liga, os seguintes à Taça.
  const ordem = pool.map((c) => ({ c, v: c.nivel + rng.normal(0, 0.08) })).sort((a, b) => b.v - a.v).map((x) => x.c)
  const ref = referencia(mundo)
  const proxJog = { v: ID_JOGADOR }
  let k = 0
  for (const id of ORDEM_COMPS) {
    const nacionais = qual[id].slice(0, POR_COMP)
    const fora = ordem.slice(k, k + POR_COMP - nacionais.length)
    k += fora.length
    const clubes = [...nacionais]
    for (const c of fora) {
      // Liga: de um pouco abaixo dos nossos melhores até bem acima. Taça: à volta dos nossos 3.º a 5.º.
      const media = id === 'liga' ? ref - 6 + c.nivel * 12 : ref - 8 + c.nivel * 11
      clubes.push(criarClubeEstrangeiro(e, c, media + rng.normal(0, 1.2), rng, proxJog).id)
    }
    e.comps.push({ id, clubes, grupos: [], rondas: NOMES_RONDA.map((nome, i) => ({ nome, fase: FASES[i], jogos: [], jogada: false })), eliminados: {} })
  }

  // Sorteio dos grupos: 4 potes pela força, sem dois clubes do mesmo país no mesmo grupo.
  const m: Mundo = { ...mundo, clubes: { ...mundo.clubes, ...e.clubes }, jogadores: { ...mundo.jogadores, ...e.jogadores } }
  const paisDeId = (id: number) => e.pais[id] ?? 'NAC'
  for (const comp of e.comps) {
    const porForca = comp.clubes.slice().sort((a, b) => forcaClube(m, b) - forcaClube(m, a) || a - b)
    const potes = Array.from({ length: 4 }, (_, p) => porForca.slice(p * GRUPOS, (p + 1) * GRUPOS))
    let grupos: number[][] = []
    for (let tent = 0; tent < 400; tent++) {
      const bal = potes.map((p) => rng.shuffle(p))
      grupos = Array.from({ length: GRUPOS }, (_, g) => bal.map((p) => p[g]).filter((x) => x !== undefined))
      if (grupos.every((gr) => new Set(gr.map(paisDeId)).size === gr.length)) break
    }
    comp.grupos = grupos
    JORNADAS_GRUPO.forEach((pares, d) => {
      comp.rondas[d].jogos = grupos.flatMap((gr, g) => pares.filter(([a, b]) => gr[a] !== undefined && gr[b] !== undefined)
        .map(([a, b]) => novaPartida(`E${ano}-${comp.id}-${d + 1}-G${g + 1}-${gr[a]}-${gr[b]}`, gr[a], gr[b], d + 1)))
    })
  }

  // Notícias do sorteio.
  for (const comp of e.comps) {
    const info = COMPETICOES[comp.id]
    const nac = comp.clubes.filter((id) => mundo.clubes[id])
    if (nac.length) noticia(e, `${info.nome}: ${nac.map((id) => mundo.clubes[id].nome).join(', ')} na fase de grupos.`, nac.includes(jogo.clubeId))
    const g = comp.grupos.findIndex((gr) => gr.includes(jogo.clubeId))
    if (g >= 0) {
      const outros = comp.grupos[g].filter((id) => id !== jogo.clubeId).map((id) => `${m.clubes[id].nome}${e.pais[id] ? ` (${PAISES_EUROPA[e.pais[id]].nome})` : ''}`)
      noticia(e, `Sorteio do grupo ${letraGrupo(g)} da ${info.nome}: ${outros.join(', ')}. Primeiro jogo depois da ${datas[0]}.ª jornada.`, true)
    }
  }
  return e
}

export function letraGrupo(g: number): string {
  return String.fromCharCode(65 + g)
}

/** Europa da época atual, criada se ainda não existe. Gravações carregadas a meio jogam logo os dias já passados. */
export function garantirEuropa(jogo: JogoComEuropa): EstadoEuropa {
  const ano = jogo.epoca.ano
  if (jogo.europa && jogo.europa.ano === ano) return jogo.europa
  const antiga = jogo.europa
  const datas = datasEuropa(jogo.epoca.totalJornadas, garantirTaca(jogo as JogoComTaca).rondas.map((r) => r.aposJornada))
  const passou = jogo.epoca.jornada - 1
  if (passou > datas[5]) {
    jogo.europa = {
      ano, semEuropa: true, pool: antiga?.pool ?? gerarPool(jogo.mundo.semente), clubes: {}, jogadores: {}, pais: {}, datas, dia: datas.length, comps: [],
      castigos: {}, marcadores: {}, receitas: {}, noticias: [], historico: antiga?.historico ?? [], qualificados: antiga?.qualificados,
    }
    return jogo.europa
  }
  jogo.europa = criarEuropa(jogo, antiga)
  if (passou > datas[0]) noticia(jogo.europa, 'As competições europeias começaram antes de chegares: os jogos já disputados foram simulados.')
  let guarda = 0
  while (jogo.europa.dia < datas.length && passou > datas[jogo.europa.dia] && guarda++ < 12) jogarDiaEuropa(jogo)
  return jogo.europa
}

/** Índice do dia europeu que já devia ser jogado, ou null. */
export function diaPendente(jogo: JogoComEuropa): number | null {
  const e = garantirEuropa(jogo)
  if (e.semEuropa || e.dia >= e.datas.length) return null
  return jogo.epoca.jornada - 1 >= e.datas[e.dia] ? e.dia : null
}

const eMeu = (p: Partida, id: number) => p.casaId === id || p.foraId === id

/** O meu jogo europeu por jogar agora, se houver. */
export function meuJogoEuropa(jogo: JogoComEuropa): { comp: CompEuropa; ronda: RondaEuropa; partida: Partida; dia: number } | null {
  const d = diaPendente(jogo)
  if (d == null) return null
  for (const comp of jogo.europa!.comps) {
    const r = comp.rondas[d]
    const p = r?.jogos.find((x) => eMeu(x, jogo.clubeId))
    if (p && !r.jogada) return { comp, ronda: r, partida: p, dia: d }
  }
  return null
}

/** Lesionados e castigados na Europa (os castigos da liga e da taça não contam). */
export function indisponiveisEuropa(jogo: JogoComEuropa, clubeId: number): Set<number> {
  const e = garantirEuropa(jogo)
  const fora = new Set<number>()
  const plantel = jogo.mundo.clubes[clubeId]?.plantel ?? e.clubes[clubeId]?.plantel ?? []
  for (const id of plantel) {
    const ind = jogo.epoca.indisponiveis[id]
    if (ind && ind.jogos > 0 && ind.motivo === 'lesao') fora.add(id)
    if ((e.castigos[id] ?? 0) > 0) fora.add(id)
  }
  return fora
}

export function escalacaoEuropa(jogo: JogoComEuropa, m: Mundo, p: Partida, clubeId: number): Escalacao {
  const emCasa = clubeId === p.casaId
  return escalarIA(m, clubeId, emCasa ? p.foraId : p.casaId, emCasa, indisponiveisEuropa(jogo, clubeId))
}

/** Golos na eliminatória do ponto de vista da casa da 2.ª mão. */
export function agregado(volta: Partida, ida: Partida): [number, number] {
  return [volta.golos[0] + ida.golos[1], volta.golos[1] + ida.golos[0]]
}

/** A 1.ª mão de um jogo da 2.ª mão (ou undefined). */
export function idaDe(comp: CompEuropa, dia: number, p: Partida): Partida | undefined {
  const r = comp.rondas[dia]
  if (r?.fase !== 'volta') return undefined
  return comp.rondas[dia - 1].jogos.find((x) => x.casaId === p.foraId && x.foraId === p.casaId)
}

function empatado(p: Partida, ida: Partida | undefined, final: boolean): boolean {
  if (final) return p.golos[0] === p.golos[1]
  if (ida) { const [a, b] = agregado(p, ida); return a === b }
  return false
}

/** Fim dos 90 minutos de uma final ou 2.ª mão empatada: há prolongamento. */
export function precisaProlongEuropa(p: Partida, ida: Partida | undefined, final: boolean): boolean {
  return p.jogada && !p.prolongamento && empatado(p, ida, final)
}

/** Quem passa (ou ganha a final). Na fase de grupos devolve o vencedor do jogo (ou a casa no empate). */
export function vencedorEuropa(p: Partida, ida?: Partida): number {
  if (!ida) return vencedorDe(p)
  const [a, b] = agregado(p, ida)
  if (a !== b) return a > b ? p.casaId : p.foraId
  const pen = p.penaltis ?? [1, 0]
  return pen[0] > pen[1] ? p.casaId : p.foraId
}

function simularEuropa(m: Mundo, p: Partida, casa: Escalacao, fora: Escalacao, semente: number, ida: Partida | undefined, final: boolean): Partida {
  const e = iniciarJogo(m, p, casa, fora, semente)
  let guarda = 0
  while (!e.partida.jogada && guarda++ < 300) {
    avancarMinuto(m, e)
    if (precisaProlongEuropa(e.partida, ida, final)) prolongar(e)
  }
  return e.partida
}

export interface LinhaGrupo { clubeId: number; j: number; v: number; e: number; d: number; gm: number; gs: number; pts: number }

/** Classificação de um grupo. */
export function tabelaGrupo(comp: CompEuropa, g: number): LinhaGrupo[] {
  const ids = comp.grupos[g] ?? []
  const l: Record<number, LinhaGrupo> = {}
  for (const id of ids) l[id] = { clubeId: id, j: 0, v: 0, e: 0, d: 0, gm: 0, gs: 0, pts: 0 }
  for (const r of comp.rondas.slice(0, 6)) {
    for (const p of r.jogos) {
      if (!p.jogada || !l[p.casaId] || !l[p.foraId]) continue
      const [a, b] = p.golos
      const c = l[p.casaId], f = l[p.foraId]
      c.j++; f.j++; c.gm += a; c.gs += b; f.gm += b; f.gs += a
      if (a > b) { c.v++; f.d++; c.pts += 3 } else if (a < b) { f.v++; c.d++; f.pts += 3 } else { c.e++; f.e++; c.pts++; f.pts++ }
    }
  }
  return ids.map((id) => l[id]).sort((x, y) => y.pts - x.pts || (y.gm - y.gs) - (x.gm - x.gs) || y.gm - x.gm || y.v - x.v || ids.indexOf(x.clubeId) - ids.indexOf(y.clubeId))
}

/** Resultado com o vencedor primeiro (para o histórico). */
function resultadoFinal(p: Partida): string {
  const v = vencedorDe(p)
  const [a, b] = v === p.casaId ? p.golos : [p.golos[1], p.golos[0]]
  const pen = p.penaltis ? (v === p.casaId ? ` (${p.penaltis[0]}-${p.penaltis[1]} g.p.)` : ` (${p.penaltis[1]}-${p.penaltis[0]} g.p.)`) : p.prolongamento ? ' a.p.' : ''
  return `${a}-${b}${pen}`
}

/**
 * Joga o dia europeu pendente nas duas competições: os jogos jogados ao vivo (em `jogadas`) ficam, os outros
 * são simulados. Decide prolongamentos e penáltis, aplica castigos, lesões, marcadores, bilheteira e prémios,
 * escreve as notícias e sorteia a fase seguinte.
 */
export function jogarDiaEuropa(jogo: JogoComEuropa, jogadas: { partida: Partida; emCampo?: [number[], number[]] }[] = []): number | null {
  const e = garantirEuropa(jogo)
  const d = e.dia
  if (e.semEuropa || d >= e.datas.length) return null
  const { mundo, epoca } = jogo
  const m = mundoEuropa(jogo)
  const semente = mistura(mundo.semente, e.ano, d, 0xe2)
  const nome = (id: number) => m.clubes[id]?.nome ?? '?'
  const nacional = (id: number) => !!mundo.clubes[id]
  const pagar = (id: number, v: number) => {
    if (!v || !mundo.clubes[id]) return
    mundo.clubes[id].dinheiro += v
    e.receitas[id] = (e.receitas[id] ?? 0) + v
  }

  if (d === 0) for (const comp of e.comps) for (const id of comp.clubes) pagar(id, COMPETICOES[comp.id].premios.entrada)

  // Castigos cumpridos por quem joga hoje (um vermelho = falha o jogo europeu seguinte).
  const jogaram = new Set(e.comps.flatMap((c) => (c.rondas[d]?.jogos ?? []).flatMap((p) => [p.casaId, p.foraId])))
  for (const key of Object.keys(e.castigos)) {
    const id = Number(key)
    if (jogaram.has(m.jogadores[id]?.clubeId ?? -1)) {
      e.castigos[id] -= 1
      if (e.castigos[id] <= 0) delete e.castigos[id]
    }
  }
  const resultadosNac: string[] = []
  e.comps.forEach((comp, ci) => {
    const r = comp.rondas[d]
    if (!r || r.jogada || !r.jogos.length) return
    const info = COMPETICOES[comp.id]
    const final = r.fase === 'final'
    const emCampo: Record<string, [number[], number[]]> = {}
    r.jogos.forEach((p, i) => {
      const viva = jogadas.find((x) => x.partida.id === p.id)
      if (viva) {
        r.jogos[i] = { ...viva.partida, jogada: true }
        if (viva.emCampo) emCampo[p.id] = viva.emCampo
        return
      }
      if (p.jogada) return
      const casa = escalacaoEuropa(jogo, m, p, p.casaId)
      const fora = escalacaoEuropa(jogo, m, p, p.foraId)
      const res = simularEuropa(m, p, casa, fora, mistura(semente, ci, i), idaDe(comp, d, p), final)
      const saiu = new Set(res.eventos.filter((ev) => ev.tipo === 'vermelho' || ev.tipo === 'lesao' || ev.tipo === 'substituicao').map((ev) => ev.jogadorId))
      const entrou = res.eventos.filter((ev) => ev.tipo === 'substituicao').map((ev) => ev.outroId!)
      const lado = (esc: Escalacao, clubeId: number) => [...esc.titulares, ...entrou.filter((id) => m.jogadores[id]?.clubeId === clubeId)].filter((id) => !saiu.has(id))
      emCampo[p.id] = [lado(casa, p.casaId), lado(fora, p.foraId)]
      r.jogos[i] = { ...res, jogada: true }
    })

    // Penáltis onde a eliminatória (ou a final) continua empatada.
    const rngPen = createRng(mistura(semente, ci, 0x9e7))
    for (const p of r.jogos) {
      if (p.penaltis || !empatado(p, idaDe(comp, d, p), final)) continue
      const [ec, ef] = emCampo[p.id] ?? [[], []]
      const grDe = (ids: number[]) => ids.find((id) => m.jogadores[id]?.posicao === 'GR')
      const pen = marcarPenaltis(m, [ec, ef], [grDe(ec), grDe(ef)], rngPen)
      p.penaltis = pen.golos
      p.serie = pen.serie
    }

    const ausentesEu = new Set(Object.keys(epoca.indisponiveis).map(Number).filter((id) => epoca.indisponiveis[id].jogos > 0))
    for (const p of r.jogos) {
      for (const ev of p.eventos) {
        const id = ev.jogadorId
        if (id === undefined) continue
        if (ev.tipo === 'vermelho') e.castigos[id] = (e.castigos[id] ?? 0) + 1
        else if (ev.tipo === 'golo') e.marcadores[id] = (e.marcadores[id] ?? 0) + 1
        else if (ev.tipo === 'lesao' && mundo.jogadores[id]) {
          const jogos = Math.max(1, Math.round(ev.duracao ?? 1))
          const atual = epoca.indisponiveis[id]
          if (!atual || atual.jogos < jogos) epoca.indisponiveis[id] = { jogos, motivo: 'lesao', ...(ev.tipoLesao ? { tipo: ev.tipoLesao } : {}), total: jogos }
        }
      }
      // Noites europeias também cansam e mexem com a moral (sem semana de descanso pelo meio).
      aplicarJogo(m, p, ausentesEu, false)
      // Bilheteira para os clubes nacionais em casa (noite europeia: estádio mais cheio, mas a organização fica com parte). A final é neutra.
      const casa = m.clubes[p.casaId]
      if (!final && nacional(p.casaId)) {
        const publico = Math.min(lotacaoAtual(casa), Math.round(publicoEsperado(casa, m.clubes[p.foraId], 2, 18) * 1.1))
        p.publico = publico
        p.receita = Math.round(publico * casa.bilhete * PARTE_BILHETEIRA)
        pagar(p.casaId, p.receita)
      }
      if (r.fase === 'grupo') {
        const [a, b] = p.golos
        if (a === b) { pagar(p.casaId, info.premios.empate); pagar(p.foraId, info.premios.empate) } else pagar(a > b ? p.casaId : p.foraId, info.premios.vitoria)
      }
      if (nacional(p.casaId) || nacional(p.foraId)) {
        const ida = idaDe(comp, d, p)
        const extra = ida ? ` (eliminatória ${agregado(p, ida).join('-')})` : ''
        resultadosNac.push(`${nome(p.casaId)} ${textoResultado(p)} ${nome(p.foraId)}${extra}`)
        if (eMeu(p, jogo.clubeId)) {
          if (r.fase === 'grupo') noticia(e, `${info.nome}, ${r.nome.toLowerCase()}: ${nome(p.casaId)} ${textoResultado(p)} ${nome(p.foraId)}.`, true)
        }
      }
    }
    r.jogada = true
    // Relatos antigos ocupam espaço: guardam-se só os golos, menos no meu jogo.
    r.jogos = r.jogos.map((p) => (eMeu(p, jogo.clubeId) ? p : { ...p, eventos: p.eventos.filter((ev) => ev.tipo === 'golo') }))
    avancarFase(jogo, e, comp, d, m, createRng(mistura(semente, ci, 0x50)))
  })

  if (resultadosNac.length && !resultadosNac.every((x) => x.includes(nome(jogo.clubeId)))) {
    noticia(e, `Noite europeia: ${resultadosNac.filter((x) => !x.includes(nome(jogo.clubeId))).join('; ')}.`)
  }
  e.dia = d + 1
  return d
}

/** Depois da última jornada dos grupos, dos quartos e das meias: sorteia a fase seguinte e paga a quem passa. */
function avancarFase(jogo: JogoComEuropa, e: EstadoEuropa, comp: CompEuropa, d: number, m: Mundo, rng: Rng): void {
  const info = COMPETICOES[comp.id]
  const nome = (id: number) => m.clubes[id]?.nome ?? '?'
  const pagar = (id: number, v: number) => {
    if (!v || !jogo.mundo.clubes[id]) return
    jogo.mundo.clubes[id].dinheiro += v
    e.receitas[id] = (e.receitas[id] ?? 0) + v
  }
  const meu = jogo.clubeId
  const mostrar = (ids: number[]) => ids.some((id) => id === meu)
  const pais = (id: number) => (e.pais[id] ? ` (${PAISES_EUROPA[e.pais[id]].nome})` : '')

  if (d === 5) {
    const tabs = comp.grupos.map((_, g) => tabelaGrupo(comp, g))
    const prim = tabs.map((t) => t[0]?.clubeId), seg = tabs.map((t) => t[1]?.clubeId)
    for (const t of tabs) for (const l of t.slice(2)) comp.eliminados[l.clubeId] = 'Fase de grupos'
    // Quartos: cada vencedor de grupo contra um segundo de outro grupo; o vencedor do grupo decide em casa.
    let ordem = seg.map((_, g) => g)
    for (let t = 0; t < 200; t++) {
      ordem = rng.shuffle(seg.map((_, g) => g))
      if (ordem.every((g, i) => g !== i)) break
    }
    comp.rondas[6].jogos = prim.map((w, i) => novaPartida(`E${e.ano}-${comp.id}-QF1-${seg[ordem[i]]}-${w}`, seg[ordem[i]], w, 7))
    comp.rondas[7].jogos = prim.map((w, i) => novaPartida(`E${e.ano}-${comp.id}-QF2-${w}-${seg[ordem[i]]}`, w, seg[ordem[i]], 8))
    for (const id of [...prim, ...seg]) pagar(id, info.premios.quartos)
    const g = comp.grupos.findIndex((gr) => gr.includes(meu))
    if (g >= 0) {
      const pos = tabs[g].findIndex((l) => l.clubeId === meu) + 1
      const jq = comp.rondas[6].jogos.find((p) => eMeu(p, meu))
      if (jq) {
        const adv = jq.casaId === meu ? jq.foraId : jq.casaId
        noticia(e, `${nome(meu)} passa aos quartos da ${info.nome} em ${pos}.º do grupo ${letraGrupo(g)}! Sorteio: ${nome(adv)}${pais(adv)}, 2.ª mão ${jq.foraId === meu ? 'em casa' : 'fora'}.`, true)
      } else noticia(e, `${nome(meu)} fica em ${pos}.º no grupo ${letraGrupo(g)} e está fora da ${info.nome}.`, true)
    }
    const nacQ = [...prim, ...seg].filter((id) => jogo.mundo.clubes[id] && id !== meu)
    if (nacQ.length) noticia(e, `${nacQ.map(nome).join(' e ')} ${nacQ.length > 1 ? 'seguem' : 'segue'} para os quartos da ${info.nome}.`)
    return
  }
  if (d === 7 || d === 9) {
    const volta = comp.rondas[d]
    const passam = volta.jogos.map((p) => vencedorEuropa(p, idaDe(comp, d, p)))
    const fase = d === 7 ? 'Quartos de final' : 'Meias-finais'
    for (const p of volta.jogos) {
      const v = vencedorEuropa(p, idaDe(comp, d, p))
      const perde = v === p.casaId ? p.foraId : p.casaId
      comp.eliminados[perde] = fase
      if (jogo.mundo.clubes[perde] || jogo.mundo.clubes[v]) {
        const [a, b] = agregado(p, idaDe(comp, d, p)!)
        const agg = v === p.casaId ? `${a}-${b}` : `${b}-${a}`
        const pen = p.penaltis ? ` nos penáltis` : ''
        noticia(e, jogo.mundo.clubes[v]
          ? `${nome(v)} elimina ${nome(perde)}${pais(perde)} nos ${fase.toLowerCase()} da ${info.nome} (${agg}${pen} no conjunto)!`
          : `${nome(perde)} cai nos ${fase.toLowerCase()} da ${info.nome} frente a ${nome(v)}${pais(v)} (${agg}${pen} no conjunto).`, mostrar([v, perde]))
      }
    }
    if (d === 7) {
      const b = rng.shuffle(passam)
      comp.rondas[8].jogos = [0, 2].map((i) => novaPartida(`E${e.ano}-${comp.id}-SF1-${b[i]}-${b[i + 1]}`, b[i], b[i + 1], 9))
      comp.rondas[9].jogos = [0, 2].map((i) => novaPartida(`E${e.ano}-${comp.id}-SF2-${b[i + 1]}-${b[i]}`, b[i + 1], b[i], 10))
      for (const id of passam) pagar(id, info.premios.meias)
    } else {
      const [a, b] = rng.shuffle(passam)
      comp.rondas[10].jogos = [novaPartida(`E${e.ano}-${comp.id}-F-${a}-${b}`, a, b, 11)]
      for (const id of passam) pagar(id, info.premios.final)
      noticia(e, `Final da ${info.nome} depois da ${e.datas[10]}.ª jornada, em campo neutro: ${nome(a)}${pais(a)} contra ${nome(b)}${pais(b)}.`, mostrar(passam))
    }
    return
  }
  if (d === 10) {
    const p = comp.rondas[10].jogos[0]
    if (!p) return
    const v = vencedorDe(p)
    const perde = v === p.casaId ? p.foraId : p.casaId
    comp.vencedorId = v
    comp.eliminados[perde] = 'Final'
    pagar(v, info.premios.vencedor)
    if (jogo.mundo.clubes[v]) jogo.mundo.clubes[v].reputacao = clamp(jogo.mundo.clubes[v].reputacao + info.reputacao, 1, 100)
    if (jogo.mundo.clubes[perde]) jogo.mundo.clubes[perde].reputacao = clamp(jogo.mundo.clubes[perde].reputacao + 1, 1, 100)
    const base = e.pool.find((c) => c.id === v)
    if (base) base.nivel = clamp(base.nivel + 0.04, 0.05, 1.15)
    e.historico.push({ ano: e.ano, comp: comp.id, vencedorId: v, finalistaId: perde, vencedor: nome(v), finalista: nome(perde), pais: e.pais[v] ?? '', resultado: resultadoFinal(p) })
    noticia(e, `${nome(v)}${pais(v)} vence a ${info.nome}! Final: ${nome(p.casaId)} ${textoResultado(p)} ${nome(p.foraId)}.`, mostrar([v, perde]) || !!jogo.mundo.clubes[v])
  }
}

/** Joga os dias europeus pendentes em que o utilizador não entra. Chamar depois de cada jornada da liga. */
export function avancarEuropa(jogo: JogoComEuropa): void {
  let guarda = 0
  for (let d = diaPendente(jogo); d != null && !meuJogoEuropa(jogo) && guarda++ < 12; d = diaPendente(jogo)) jogarDiaEuropa(jogo)
}

/** No fim da época (antes de fecharEpoca): quem vai à Europa na seguinte. */
export function qualificarEuropa(jogo: JogoComEuropa): Qualificados {
  const e = garantirEuropa(jogo)
  const { mundo, epoca } = jogo
  const ordem = tabela(mundo, epoca, 1).map((l) => l.clubeId)
  const liga = ordem.slice(0, COMPETICOES.liga.vagas)
  const taca: number[] = []
  const t = (jogo as JogoComTaca).taca
  const h = t?.historico.find((x) => x.ano === t.ano)
  if (h && mundo.clubes[h.vencedorId] && !liga.includes(h.vencedorId)) taca.push(h.vencedorId)
  for (const id of ordem.slice(liga.length)) {
    if (taca.length >= COMPETICOES.taca.vagas) break
    if (!taca.includes(id)) taca.push(id)
  }
  const q = { ano: epoca.ano, liga, taca }
  if (e.qualificados?.ano !== epoca.ano) {
    const meu = jogo.clubeId
    const onde = liga.includes(meu) ? COMPETICOES.liga.nome : taca.includes(meu) ? COMPETICOES.taca.nome : null
    if (onde) noticia(e, `${mundo.clubes[meu].nome} vai jogar a ${onde} na próxima época!`, true)
    noticia(e, `Apurados para a próxima época: ${COMPETICOES.liga.nome} ${liga.map((id) => mundo.clubes[id].nome).join(', ')}; ${COMPETICOES.taca.nome} ${taca.map((id) => mundo.clubes[id].nome).join(', ')}.`)
  }
  e.qualificados = q
  return q
}

/** Em que competição europeia está o clube nesta época. */
export function compDoClube(e: EstadoEuropa, clubeId: number): CompEuropa | undefined {
  return e.comps.find((c) => c.clubes.includes(clubeId))
}

/** Onde o meu clube está na Europa, em texto curto. */
export function minhaSituacaoEuropa(jogo: JogoComEuropa): string {
  const e = garantirEuropa(jogo)
  if (e.semEuropa) return 'As competições europeias começam na próxima época.'
  const comp = compDoClube(e, jogo.clubeId)
  if (!comp) return 'Não estás na Europa esta época: acaba nos 5 primeiros da 1.ª Divisão ou ganha a Taça Nacional.'
  const info = COMPETICOES[comp.id]
  if (comp.vencedorId === jogo.clubeId) return `Vencedor da ${info.nome}!`
  const elim = comp.eliminados[jogo.clubeId]
  if (elim) return elim === 'Final' ? `Finalista vencido da ${info.nome}.` : `Eliminado na ${elim.toLowerCase()} da ${info.nome}.`
  if (e.dia <= 5) {
    const g = comp.grupos.findIndex((gr) => gr.includes(jogo.clubeId))
    const pos = tabelaGrupo(comp, g).findIndex((l) => l.clubeId === jogo.clubeId) + 1
    return `${info.nome}: ${e.dia === 0 ? 'grupo' : `${pos}.º no grupo`} ${letraGrupo(g)}.`
  }
  const r = comp.rondas[e.dia]
  return r ? `${info.nome}: ${r.nome.replace(' · ', ', ')}.` : info.nome
}
