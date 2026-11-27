import { createRng, type Rng } from './rng'
import type { Clube, Divisao, Jogador, Mundo, Posicao } from './types'
import {
  APELIDOS_AF, APELIDOS_BR, APELIDOS_ES, APELIDOS_PT, CORES, NOMES_AF, NOMES_BR, NOMES_ES, NOMES_ESTADIO,
  NOMES_PT, PADROES_CLUBE, TERRAS,
} from './nomes'
import { NOMES_LIGA } from './nomes-ligas'
import { PAISES_ESTRANGEIROS } from './ligas'

export const NUM_DIVISOES = 4
export const CLUBES_POR_DIVISAO = 18

export const NOMES_DIVISAO = ['1.ª Divisão', '2.ª Divisão', '3.ª Divisão', '4.ª Divisão']

/** Força média dos clubes em cada divisão (mín, máx). */
const FORCA_DIVISAO: [number, number][] = [
  [58, 76],
  [47, 60],
  [37, 50],
  [27, 41],
]

/** Composição do plantel: quantos jogadores por posição. */
const PLANTEL: Record<Posicao, number> = { GR: 3, DEF: 8, MED: 8, AV: 5 }

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

/** Valor de mercado em euros a partir da força e da idade. */
export function valorDe(forca: number, idade: number): number {
  const base = 2000 * Math.pow(1.12, forca - 20)
  const fIdade = idade <= 21 ? 1.4 : idade <= 24 ? 1.2 : idade <= 29 ? 1 : idade <= 32 ? 0.6 : 0.3
  return arredonda(base * fIdade)
}

/** Salário mensal em euros. */
export function salarioDe(forca: number, divisao: number): number {
  const minimo = [3000, 1500, 900, 600][divisao - 1] ?? 600
  // As divisões de cima pagam mais pela mesma força (é para onde vai a receita da bilheteira e da TV).
  const fator = [4.5, 1.7, 1.1, 1][divisao - 1] ?? 1
  return arredonda(Math.max(minimo, 120 * fator * Math.pow(1.085, forca - 20)))
}

function arredonda(v: number): number {
  if (v >= 1_000_000) return Math.round(v / 50_000) * 50_000
  if (v >= 100_000) return Math.round(v / 5_000) * 5_000
  if (v >= 10_000) return Math.round(v / 500) * 500
  return Math.round(v / 50) * 50
}

function nomeJogador(rng: Rng): { nome: string; curto: string; nacionalidade: string } {
  const r = rng.next()
  let nomes = NOMES_PT, apelidos = APELIDOS_PT, nac = 'PT'
  if (r > 0.92) { nomes = NOMES_ES; apelidos = APELIDOS_ES; nac = 'ES' }
  else if (r > 0.84) { nomes = NOMES_AF; apelidos = APELIDOS_AF; nac = rng.pick(['AO', 'CV', 'GW', 'MZ']) }
  else if (r > 0.74) { nomes = NOMES_BR; apelidos = APELIDOS_BR; nac = 'BR' }
  const primeiro = rng.pick(nomes)
  const ultimo = rng.pick(apelidos)
  const dois = rng.chance(0.5) && nac === 'PT'
  let meio = ''
  if (dois) {
    let m = rng.pick(APELIDOS_PT)
    while (m === ultimo) m = rng.pick(APELIDOS_PT)
    meio = ` ${m}`
  }
  return { nome: `${primeiro}${meio} ${ultimo}`, curto: `${primeiro[0]}. ${ultimo}`, nacionalidade: nac }
}

function idadeAleatoria(rng: Rng): number {
  // A maioria entre 21 e 31, alguns jovens e veteranos.
  return clamp(Math.round(rng.normal(26, 4.2)), 17, 37)
}

/** Ajuste da força pela idade: jovens ainda a crescer, veteranos a descer. */
function curvaIdade(idade: number): number {
  if (idade <= 19) return -9
  if (idade <= 21) return -5
  if (idade <= 23) return -2
  if (idade <= 29) return 0
  if (idade <= 32) return -1
  return -4
}

export interface OpcoesMundo {
  /** Junta os campeonatos de Espanha e de Inglaterra (2 divisões cada). */
  estrangeiros?: boolean
}

/** Força média dos clubes nas divisões estrangeiras (por nível). */
const FORCA_ESTRANGEIRA: Record<string, [number, number][]> = {
  ES: [[59, 77], [48, 61]],
  EN: [[60, 78], [48, 62]],
}

interface FonteNomes {
  jogador: (rng: Rng) => { nome: string; curto: string; nacionalidade: string }
  padroes: readonly string[]
  estadios: readonly string[]
}

const FONTE_PT: FonteNomes = { jogador: nomeJogador, padroes: PADROES_CLUBE, estadios: NOMES_ESTADIO }

function fonteEstrangeira(pais: string): FonteNomes {
  const n = NOMES_LIGA[pais]
  return {
    padroes: n.padroes,
    estadios: n.estadios,
    jogador: (rng) => {
      // A maioria da casa, alguns portugueses, brasileiros, africanos e do outro país.
      const r = rng.next()
      if (r > 0.9) return nomeJogador(rng)
      let nomes = n.nomes, apelidos = n.apelidos, nac = pais
      if (r > 0.82) { const outro = pais === 'ES' ? 'EN' : 'ES'; nomes = NOMES_LIGA[outro].nomes; apelidos = NOMES_LIGA[outro].apelidos; nac = outro }
      const primeiro = rng.pick(nomes)
      const ultimo = rng.pick(apelidos)
      return { nome: `${primeiro} ${ultimo}`, curto: `${primeiro[0]}. ${ultimo}`, nacionalidade: nac }
    },
  }
}

interface Contexto {
  rng: Rng
  clubes: Record<number, Clube>
  jogadores: Record<number, Jogador>
  siglas: Set<string>
  proximoJogador: number
  proximoClube: number
}

/** Gera os 18 clubes (e planteis) de uma divisão. */
function gerarDivisao(ctx: Contexto, nivel: number, terras: readonly string[], [fMin, fMax]: [number, number], fonte: FonteNomes, pais?: string, numero = nivel): number[] {
  const { rng, jogadores, clubes } = ctx
  const ids: number[] = []
  for (let i = 0; i < CLUBES_POR_DIVISAO; i++) {
    const terra = terras[i]
    // Força média do clube: espalhada pela divisão, com 3 "grandes" na 1.ª.
    let media = fMin + ((fMax - fMin) * (CLUBES_POR_DIVISAO - 1 - i)) / (CLUBES_POR_DIVISAO - 1)
    if (nivel === 1 && i < 3) media += 6 - i * 1.5
    media += rng.normal(0, 1.5)
    const clube = criarClube(rng, ctx.proximoClube++, terra, nivel, media, ctx.siglas, fonte, [fMin, fMax])
    for (const pos of ['GR', 'DEF', 'MED', 'AV'] as Posicao[]) {
      for (let k = 0; k < PLANTEL[pos]; k++) {
        // Titulares acima da média do clube, suplentes abaixo.
        const titular = (pos === 'GR' && k === 0) || (pos === 'DEF' && k < 4) || (pos === 'MED' && k < 4) || (pos === 'AV' && k < 2)
        const idade = idadeAleatoria(rng)
        const forca = clamp(Math.round(media + (titular ? 3 : -4) + curvaIdade(idade) + rng.normal(0, 4.5)), 5, 95)
        const margem = idade <= 21 ? rng.int(3, 14) : idade <= 25 ? rng.int(1, 6) : rng.int(0, 2)
        const n = fonte.jogador(rng)
        const j: Jogador = {
          id: ctx.proximoJogador++,
          ...n,
          posicao: pos,
          idade,
          forca,
          potencial: clamp(forca + margem, forca, 99),
          salario: salarioDe(forca, nivel),
          valor: valorDe(forca, idade),
          craque: false,
          contrato: rng.int(1, 4),
          clubeId: clube.id,
        }
        jogadores[j.id] = j
        clube.plantel.push(j.id)
      }
    }
    // Craque: o melhor do plantel, se se destacar do segundo.
    const ordem = clube.plantel.map((id) => jogadores[id]).sort((a, b) => b.forca - a.forca)
    if (ordem[0].forca - ordem[1].forca >= 2 || ordem[0].forca >= media + 10) {
      ordem[0].craque = true
      ordem[0].valor = arredonda(ordem[0].valor * 1.3)
      ordem[0].salario = arredonda(ordem[0].salario * 1.3)
    }
    if (pais) { clube.pais = pais; clube.nivel = nivel; clube.divisao = numero }
    clubes[clube.id] = clube
    ids.push(clube.id)
  }
  return ids
}

/**
 * Gera um mundo novo: 4 divisões de 18 clubes em Portugal, cada clube com 24 jogadores.
 * Com `estrangeiros`, junta Espanha e Inglaterra (2 divisões de 18 cada, números 5 a 8).
 */
export function gerarMundo(semente: number, opcoes: OpcoesMundo = {}): Mundo {
  const rng = createRng(semente)
  const terras = rng.shuffle(TERRAS)
  const ctx: Contexto = { rng, clubes: {}, jogadores: {}, siglas: new Set<string>(), proximoJogador: 1, proximoClube: 1 }
  const divisoes: Divisao[] = []

  for (let d = 1; d <= NUM_DIVISOES; d++) {
    const ids = gerarDivisao(ctx, d, terras.slice((d - 1) * CLUBES_POR_DIVISAO, d * CLUBES_POR_DIVISAO), FORCA_DIVISAO[d - 1], FONTE_PT)
    divisoes.push({ numero: d, nome: NOMES_DIVISAO[d - 1], clubes: ids })
  }

  if (opcoes.estrangeiros) {
    for (const pais of PAISES_ESTRANGEIROS) {
      // Gerador próprio: Portugal fica igual com ou sem os campeonatos estrangeiros.
      const r = createRng(((semente * 2654435761) ^ (pais === 'ES' ? 0xe5 : 0xe9)) >>> 0 || 1)
      const sub: Contexto = { ...ctx, rng: r }
      const terrasP = r.shuffle(NOMES_LIGA[pais].terras)
      FORCA_ESTRANGEIRA[pais].forEach((faixa, k) => {
        const nivel = k + 1
        const ids = gerarDivisao(sub, nivel, terrasP.slice(k * CLUBES_POR_DIVISAO, (k + 1) * CLUBES_POR_DIVISAO), faixa, fonteEstrangeira(pais), pais, divisoes.length + 1)
        divisoes.push({ numero: divisoes.length + 1, nome: NOMES_DIVISAO[k], clubes: ids, pais, nivel })
      })
      ctx.proximoClube = sub.proximoClube
      ctx.proximoJogador = sub.proximoJogador
    }
  }

  return { versao: 1, semente, epoca: 2027, divisoes, clubes: ctx.clubes, jogadores: ctx.jogadores }
}

function criarClube(rng: Rng, id: number, terra: string, divisao: number, media: number, siglas: Set<string>, fonte: FonteNomes, [fMin, fMax]: [number, number]): Clube {
  const padrao = rng.pick(fonte.padroes)
  const nome = padrao.replace('{T}', terra)
  const sigla = criarSigla(terra, siglas)
  const reputacao = clamp(Math.round(media * 1.15 + rng.normal(0, 3)), 5, 100)
  const lugares = [
    [9000, 52000], [3000, 11000], [1500, 5000], [500, 2500],
  ][divisao - 1]
  const dinheiro = [
    [2_000_000, 15_000_000], [500_000, 2_000_000], [150_000, 500_000], [50_000, 200_000],
  ][divisao - 1]
  const t = clamp((media - fMin) / (fMax - fMin), 0, 1.3)
  const estadioNome = rng.pick(fonte.estadios).replace('{T}', terra)
  return {
    id,
    nome,
    sigla,
    cidade: terra,
    cores: rng.pick(CORES),
    divisao,
    reputacao,
    dinheiro: arredonda(dinheiro[0] + (dinheiro[1] - dinheiro[0]) * t * (0.8 + rng.next() * 0.4)),
    estadio: { nome: estadioNome, lugares: Math.round((lugares[0] + (lugares[1] - lugares[0]) * t * (0.7 + rng.next() * 0.6)) / 100) * 100 },
    bilhete: [15, 10, 7, 5][divisao - 1],
    plantel: [],
  }
}

function criarSigla(terra: string, usadas: Set<string>): string {
  const limpa = terra.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
  const palavras = limpa.split(/\s+/).filter((p) => !['DE', 'DO', 'DA', 'DAS', 'DOS'].includes(p))
  const candidatos = [
    palavras.length > 1 ? palavras[0].slice(0, 2) + palavras[1][0] : palavras[0].slice(0, 3),
    palavras[0].slice(0, 3),
    palavras[0][0] + palavras[0].slice(-2),
    palavras.map((p) => p[0]).join('').padEnd(3, 'X').slice(0, 3),
  ]
  for (const c of candidatos) if (!usadas.has(c)) { usadas.add(c); return c }
  for (let i = 1; ; i++) {
    const c = palavras[0].slice(0, 2) + i
    if (!usadas.has(c)) { usadas.add(c); return c }
  }
}

/** Força dos 11 melhores (1 GR, 4 DEF, 4 MED, 2 AV): uma medida simples do clube. */
export function forcaClube(mundo: Mundo, clubeId: number): number {
  const plantel = mundo.clubes[clubeId].plantel.map((id) => mundo.jogadores[id])
  const melhores = (pos: Posicao, n: number) =>
    plantel.filter((j) => j.posicao === pos).sort((a, b) => b.forca - a.forca).slice(0, n)
  const onze = [...melhores('GR', 1), ...melhores('DEF', 4), ...melhores('MED', 4), ...melhores('AV', 2)]
  return Math.round(onze.reduce((s, j) => s + j.forca, 0) / onze.length)
}
