import { createRng, type Rng } from './rng'
import type { Clube, Divisao, Jogador, Mundo, Posicao } from './types'
import {
  APELIDOS_AF, APELIDOS_BR, APELIDOS_ES, APELIDOS_PT, CORES, NOMES_AF, NOMES_BR, NOMES_ES, NOMES_ESTADIO,
  NOMES_PT, PADROES_CLUBE, TERRAS,
} from './nomes'

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
  const fator = [3, 1.6, 1.1, 1][divisao - 1] ?? 1
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

/** Gera um mundo novo: 4 divisões de 18 clubes, cada um com 24 jogadores. */
export function gerarMundo(semente: number): Mundo {
  const rng = createRng(semente)
  const terras = rng.shuffle(TERRAS)
  const clubes: Record<number, Clube> = {}
  const jogadores: Record<number, Jogador> = {}
  const divisoes: Divisao[] = []
  let proximoJogador = 1
  let proximoClube = 1
  const siglas = new Set<string>()

  for (let d = 1; d <= NUM_DIVISOES; d++) {
    const [fMin, fMax] = FORCA_DIVISAO[d - 1]
    const ids: number[] = []
    for (let i = 0; i < CLUBES_POR_DIVISAO; i++) {
      const terra = terras[(d - 1) * CLUBES_POR_DIVISAO + i]
      // Força média do clube: espalhada pela divisão, com 3 "grandes" na 1.ª.
      let media = fMin + ((fMax - fMin) * (CLUBES_POR_DIVISAO - 1 - i)) / (CLUBES_POR_DIVISAO - 1)
      if (d === 1 && i < 3) media += 6 - i * 1.5
      media += rng.normal(0, 1.5)
      const clube = criarClube(rng, proximoClube++, terra, d, media, siglas)
      for (const pos of ['GR', 'DEF', 'MED', 'AV'] as Posicao[]) {
        for (let k = 0; k < PLANTEL[pos]; k++) {
          // Titulares acima da média do clube, suplentes abaixo.
          const titular = (pos === 'GR' && k === 0) || (pos === 'DEF' && k < 4) || (pos === 'MED' && k < 4) || (pos === 'AV' && k < 2)
          const idade = idadeAleatoria(rng)
          const forca = clamp(Math.round(media + (titular ? 3 : -4) + curvaIdade(idade) + rng.normal(0, 4.5)), 5, 95)
          const margem = idade <= 21 ? rng.int(6, 22) : idade <= 25 ? rng.int(2, 10) : rng.int(0, 3)
          const n = nomeJogador(rng)
          const j: Jogador = {
            id: proximoJogador++,
            ...n,
            posicao: pos,
            idade,
            forca,
            potencial: clamp(forca + margem, forca, 99),
            salario: salarioDe(forca, d),
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
      clubes[clube.id] = clube
      ids.push(clube.id)
    }
    divisoes.push({ numero: d, nome: NOMES_DIVISAO[d - 1], clubes: ids })
  }

  return { versao: 1, semente, epoca: 2027, divisoes, clubes, jogadores }
}

function criarClube(rng: Rng, id: number, terra: string, divisao: number, media: number, siglas: Set<string>): Clube {
  const padrao = rng.pick(PADROES_CLUBE)
  const nome = padrao.replace('{T}', terra)
  const sigla = criarSigla(terra, siglas)
  const reputacao = clamp(Math.round(media * 1.15 + rng.normal(0, 3)), 5, 100)
  const lugares = [
    [9000, 52000], [3000, 11000], [1500, 5000], [500, 2500],
  ][divisao - 1]
  const dinheiro = [
    [2_000_000, 15_000_000], [500_000, 2_000_000], [150_000, 500_000], [50_000, 200_000],
  ][divisao - 1]
  const t = clamp((media - FORCA_DIVISAO[divisao - 1][0]) / (FORCA_DIVISAO[divisao - 1][1] - FORCA_DIVISAO[divisao - 1][0]), 0, 1.3)
  const estadioNome = rng.pick(NOMES_ESTADIO).replace('{T}', terra)
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
