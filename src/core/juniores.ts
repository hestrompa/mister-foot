// Formação: jovens das camadas jovens de cada clube, gerados com semente.
import type { Rng } from './rng'
import { forcaClube, salarioDe, valorDe } from './mundo'
import { APELIDOS_AF, APELIDOS_BR, APELIDOS_PT, NOMES_AF, NOMES_BR, NOMES_PT } from './nomes'
import type { Jogador, Mundo, Posicao } from './types'

const POS_PESO: [Posicao, number][] = [['GR', 0.12], ['DEF', 0.33], ['MED', 0.33], ['AV', 0.22]]

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

function posicao(rng: Rng): Posicao {
  let r = rng.next()
  for (const [p, w] of POS_PESO) if ((r -= w) < 0) return p
  return 'MED'
}

function nome(rng: Rng): { nome: string; curto: string; nacionalidade: string } {
  const r = rng.next()
  let nomes = NOMES_PT, apelidos = APELIDOS_PT, nac = 'PT'
  if (r > 0.9) { nomes = NOMES_AF; apelidos = APELIDOS_AF; nac = rng.pick(['AO', 'CV', 'GW', 'MZ']) }
  else if (r > 0.82) { nomes = NOMES_BR; apelidos = APELIDOS_BR; nac = 'BR' }
  const primeiro = rng.pick(nomes)
  const ultimo = rng.pick(apelidos)
  return { nome: `${primeiro} ${ultimo}`, curto: `${primeiro[0]}. ${ultimo}`, nacionalidade: nac }
}

/** Próximo id livre de jogador. */
export function proximoIdJogador(mundo: Mundo): number {
  let max = 0
  for (const k of Object.keys(mundo.jogadores)) max = Math.max(max, Number(k))
  return max + 1
}

/**
 * Um júnior de 16 a 18 anos das camadas jovens de um clube. Fica registado no mundo sem clube (clubeId 0)
 * até ser promovido. Clubes mais fortes formam um pouco melhor; às vezes sai uma pérola.
 */
export function gerarJunior(mundo: Mundo, rng: Rng, clubeId: number): Jogador {
  const c = mundo.clubes[clubeId]
  const id = proximoIdJogador(mundo)
  const idade = rng.int(16, 18)
  const forca = clamp(Math.round(forcaClube(mundo, clubeId) * 0.62 + (idade - 16) * 2 + rng.normal(0, 5)), 8, 70)
  const perola = rng.chance(0.06)
  const potencial = clamp(forca + rng.int(4, 18) + (perola ? rng.int(15, 30) : 0), forca, 99)
  const j: Jogador = {
    id,
    ...nome(rng),
    posicao: posicao(rng),
    idade,
    forca,
    potencial,
    salario: salarioDe(forca, c.divisao),
    valor: valorDe(forca, idade),
    craque: false,
    contrato: 0,
    clubeId: 0,
  }
  mundo.jogadores[id] = j
  return j
}

/** Estimativa do potencial, como a daria um olheiro: nunca o número exato. */
export function potencialTexto(j: Jogador): string {
  const m = j.potencial - j.forca
  if (j.potencial >= 75 || m >= 28) return 'Pérola'
  if (m >= 14) return 'Alto'
  if (m >= 8) return 'Médio'
  return 'Baixo'
}
