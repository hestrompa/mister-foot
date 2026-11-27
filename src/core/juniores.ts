// Formação: jovens das camadas jovens de cada clube, gerados com semente.
import { nivelDe } from './ligas'
import type { Rng } from './rng'
import { efeitoAcademia } from './academia'
import { definirPersonalidade } from './personalidade'
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
  const ac = efeitoAcademia(c)
  const forca = clamp(Math.round(forcaClube(mundo, clubeId) * 0.62 + (idade - 16) * 2 + rng.normal(0, 5) + ac.forca), 8, 70)
  const perola = rng.chance(0.06 + ac.perola)
  // Potencial à volta do nível histórico do clube (a reputação, que não muda), não da força atual:
  // assim não há efeito de bola de neve nas divisões de baixo.
  const nivel = c.reputacao / 1.15 - 3
  const potencial = clamp(Math.round(nivel + ac.potencial + rng.normal(0, 7) + (perola ? rng.int(10, 25) : 0)), forca + 3, 99)
  const j: Jogador = {
    id,
    ...nome(rng),
    posicao: posicao(rng),
    idade,
    forca,
    potencial,
    salario: salarioDe(forca, nivelDe(c)),
    valor: valorDe(forca, idade),
    craque: false,
    contrato: 0,
    clubeId: 0,
  }
  // Uma academia acima do normal forma mais profissionais (sem gastar sorteios nos outros clubes).
  if (ac.profissional > 0 && rng.chance(ac.profissional)) definirPersonalidade(j, 'profissional')
  mundo.jogadores[id] = j
  return j
}

/**
 * Estimativa do potencial, como a daria um olheiro: nunca o número exato.
 * Comparada com a força do clube de referência (o meu): Pérola chega bem acima do onze atual.
 */
export function potencialTexto(j: Jogador, mundo?: Mundo, clubeId?: number): string {
  const ref = mundo && clubeId != null && mundo.clubes[clubeId] ? forcaClube(mundo, clubeId) : j.forca + 15
  const d = j.potencial - ref
  if (d >= 10) return 'Pérola'
  if (d >= 2) return 'Alto'
  if (d >= -6) return 'Médio'
  return 'Baixo'
}
