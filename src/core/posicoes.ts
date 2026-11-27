// Posições no campo: onde cada um dos onze joga, em metros.
//
// x mede-se a partir da própria baliza (0) para a frente; y vai de 0 a 68 (largura do campo).
// Sem posições guardadas, cada lugar fica na posição base da formação (a de sempre). O treinador
// pode arrastar cada jogador: mais recuado defende mais e ataca menos, mais adiantado o contrário,
// e quem passa a linha de uma zona muda de papel (um médio arrastado para a frente passa a avançado,
// e a formação muda com ele). Nada disto dá golos de borla: é uma troca entre setores (ver motor.ts).
import type { Posicao } from './types'
import { FORMACOES, type Escalacao, type Formacao } from './partida'

export type Ponto = [number, number]

export const LARGURA_CAMPO = 68
/** x base de cada papel (da própria baliza). */
export const BX: Record<Posicao, number> = { GR: 4, DEF: 22, MED: 40, AV: 56 }
/** Fronteiras das zonas: até LIMITE_DEF é defesa, até LIMITE_MED é meio-campo, daí para a frente ataque. */
export const LIMITE_DEF = 31
export const LIMITE_MED = 48.5
/** Onde um jogador de campo pode ir (não passa da linha do meio da área adversária nem entra na própria pequena área). */
export const X_MIN = 9
export const X_MAX = 66
const Y_MIN = 3
const Y_MAX = LARGURA_CAMPO - 3
/** Metros de desvio que valem uma instrução inteira (subir ou ficar atrás). */
export const METROS_INSTRUCAO = 10

/** Quantos DEF, MED e AV uma formação tem (aceita formações feitas à mão, ex.: "3-4-3" ou "4-2-4"). */
export function contagem(f: Formacao): [number, number, number] {
  const pre = (FORMACOES as Record<string, [number, number, number]>)[f]
  if (pre) return pre
  const p = String(f).split('-').map((n) => Math.max(0, Math.floor(Number(n) || 0)))
  if (p.length === 3 && p[0] + p[1] + p[2] === 10) return [p[0], p[1], p[2]]
  return [4, 4, 2]
}

export function nomeFormacao(d: number, m: number, a: number): Formacao {
  return `${d}-${m}-${a}` as Formacao
}

/** É uma das formações do menu (as outras foram feitas a arrastar jogadores). */
export function formacaoPredefinida(f: Formacao): boolean {
  return Object.prototype.hasOwnProperty.call(FORMACOES, f)
}

/** Papel do lugar `i` numa formação (0 = GR, depois DEF, MED e AV). */
export function papelNaFormacao(f: Formacao, i: number): Posicao {
  const [d, m] = contagem(f)
  if (i === 0) return 'GR'
  if (i <= d) return 'DEF'
  if (i <= d + m) return 'MED'
  return 'AV'
}

/** Posições base de uma formação, pela ordem dos lugares (a forma de sempre). */
export function posicoesBase(f: Formacao): Ponto[] {
  const [d, m, a] = contagem(f)
  const tam: Record<Posicao, number> = { GR: 1, DEF: d, MED: m, AV: a }
  const inicio: Record<Posicao, number> = { GR: 0, DEF: 1, MED: 1 + d, AV: 1 + d + m }
  const out: Ponto[] = []
  for (let i = 0; i < 11; i++) {
    const pos = papelNaFormacao(f, i)
    const n = Math.max(1, tam[pos])
    const k = i - inicio[pos]
    const w = Math.min(50, 14 * (n - 1))
    const y = n === 1 ? 34 : 34 - w / 2 + (w * k) / (n - 1)
    // Meio-campo de 5: os das pontas um pouco mais à frente.
    const x = BX[pos] + (pos === 'MED' && n >= 5 && (k === 0 || k === n - 1) ? 5 : 0)
    out.push([x, y])
  }
  return out
}

/** Posições de uma escalação (as do treinador, ou as da formação). */
export function posicoesDe(esc: Pick<Escalacao, 'formacao' | 'posicoes'>): Ponto[] {
  const base = posicoesBase(esc.formacao)
  const p = esc.posicoes
  if (!p || p.length !== 11) return base
  return base.map((b, i) => (p[i] && Number.isFinite(p[i][0]) && Number.isFinite(p[i][1]) ? [p[i][0], p[i][1]] : b))
}

/** Papel que uma posição em x dá a um jogador de campo. */
export function papelDaZona(x: number): Exclude<Posicao, 'GR'> {
  return x < LIMITE_DEF ? 'DEF' : x < LIMITE_MED ? 'MED' : 'AV'
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

/**
 * Desvio do lugar `i` face à posição base: `altura` de -1 (bem recuado) a 1 (bem adiantado) e
 * `abertura` em metros a mais (positiva) ou a menos do centro do que na formação.
 */
export function desvioDoLugar(esc: Pick<Escalacao, 'formacao' | 'posicoes'>, i: number): { altura: number; abertura: number } {
  if (!esc.posicoes || i === 0) return { altura: 0, abertura: 0 }
  const b = posicoesBase(esc.formacao)[i]
  const p = posicoesDe(esc)[i]
  return {
    altura: clamp((p[0] - b[0]) / METROS_INSTRUCAO, -1, 1),
    abertura: Math.abs(p[1] - 34) - Math.abs(b[1] - 34),
  }
}

/** Largura da equipa (desvio-padrão de y dos jogadores de campo) face à da formação: 1 = igual. */
export function larguraRelativa(esc: Pick<Escalacao, 'formacao' | 'posicoes'>, vivos?: (i: number) => boolean): number {
  if (!esc.posicoes) return 1
  const dp = (ps: Ponto[]) => {
    const ys = ps.filter((_, i) => i > 0 && (!vivos || vivos(i))).map((p) => p[1])
    if (ys.length < 2) return 1
    const md = ys.reduce((s, y) => s + y, 0) / ys.length
    return Math.sqrt(ys.reduce((s, y) => s + (y - md) ** 2, 0) / ys.length)
  }
  return clamp(dp(posicoesDe(esc)) / Math.max(1, dp(posicoesBase(esc.formacao))), 0.6, 1.4)
}

/**
 * Arrasta o jogador do lugar `i` para `ponto`. Devolve a escalação nova: posições, papéis e formação
 * (os lugares voltam a ficar por ordem GR, DEF, MED, AV), ou null se não for permitido
 * (o guarda-redes não sai da baliza; tem de haver pelo menos dois defesas).
 */
export function moverJogador(esc: Escalacao, i: number, ponto: Ponto): Escalacao | null {
  if (i <= 0 || i >= esc.titulares.length) return null
  const ps = posicoesDe(esc).map((p) => [p[0], p[1]] as Ponto)
  ps[i] = [clamp(ponto[0], X_MIN, X_MAX), clamp(ponto[1], Y_MIN, Y_MAX)]
  return arrumar(esc, ps)
}

/** Volta a pôr os lugares por ordem de papel (e, em cada linha, da esquerda para a direita) e calcula a formação. */
export function arrumar(esc: Escalacao, ps: Ponto[]): Escalacao | null {
  const papeis = ps.map((p, i) => (i === 0 ? 'GR' : papelDaZona(p[0])))
  const ordem: number[] = [0]
  for (const papel of ['DEF', 'MED', 'AV'] as const) {
    // Dentro de cada linha, da esquerda para a direita (como na formação base).
    const linha: number[] = []
    for (let i = 1; i < 11; i++) if (papeis[i] === papel) linha.push(i)
    linha.sort((x, y) => ps[x][1] - ps[y][1] || x - y)
    ordem.push(...linha)
  }
  const d = papeis.filter((p) => p === 'DEF').length
  const m = papeis.filter((p) => p === 'MED').length
  const a = papeis.filter((p) => p === 'AV').length
  if (d < 2) return null
  const titulares = ordem.map((k) => esc.titulares[k])
  const posicoes = ordem.map((k) => ps[k])
  const out: Escalacao = { ...esc, formacao: nomeFormacao(d, m, a), titulares, posicoes }
  // Se ficou tudo nas posições base da formação, não há nada a guardar.
  const base = posicoesBase(out.formacao)
  if (posicoes.every((p, k) => Math.abs(p[0] - base[k][0]) < 0.5 && Math.abs(p[1] - base[k][1]) < 0.5)) delete out.posicoes
  return out
}

/** Escalação com as posições da formação (sem desvios). */
export function semPosicoes(esc: Escalacao): Escalacao {
  const out = { ...esc }
  delete out.posicoes
  return out
}

/** Frase curta para o relato quando o treinador arrasta alguém a meio do jogo. */
export function textoMovimento(antes: Escalacao, depois: Escalacao, id: number, nome: string): string {
  const ia = antes.titulares.indexOf(id), id2 = depois.titulares.indexOf(id)
  if (ia < 0 || id2 < 0) return 'O treinador mexe nas posições.'
  const pa = papelNaFormacao(antes.formacao, ia), pd = papelNaFormacao(depois.formacao, id2)
  const nomePapel: Record<Posicao, string> = { GR: 'guarda-redes', DEF: 'defesa', MED: 'médio', AV: 'avançado' }
  if (pa !== pd) return `${nome} passa a jogar a ${nomePapel[pd]} (${depois.formacao}).`
  const xa = posicoesDe(antes)[ia][0], xd = posicoesDe(depois)[id2][0]
  if (xd < xa - 1.5) return `${nome} recua no terreno.`
  if (xd > xa + 1.5) return `${nome} joga mais adiantado.`
  return `${nome} muda de corredor.`
}
