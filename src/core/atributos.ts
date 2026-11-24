// Atributos detalhados dos jogadores (velocidade, remate, passe, defesa, físico, guarda-redes).
//
// A força continua a ser a nota geral (é ela que evolui no treino e com a idade). Cada jogador tem
// um perfil: quanto cada atributo está acima ou abaixo da força. A média dos atributos que contam
// na posição do jogador, com os pesos da posição, é a própria força. Assim, quem evolui sobe tudo,
// e o perfil decide em que é melhor: um avançado rápido, um médio de passe, um central forte.
//
// Jogadores sem perfil gravado (gravações antigas, jogadores novos) têm um perfil calculado do id,
// sempre igual. Só se grava o perfil quando o treino ou a idade o mudam.
import type { Jogador, Posicao } from './types'
import { createRng } from './rng'

export type Atributo = 'vel' | 'rem' | 'pas' | 'def' | 'fis' | 'gr'
export const ATRIBUTOS: readonly Atributo[] = ['vel', 'rem', 'pas', 'def', 'fis', 'gr']
export const NOME_ATRIBUTO: Record<Atributo, string> = {
  vel: 'Velocidade', rem: 'Remate', pas: 'Passe', def: 'Defesa', fis: 'Físico', gr: 'Guarda-redes',
}
export const SIGLA_ATRIBUTO: Record<Atributo, string> = {
  vel: 'VEL', rem: 'REM', pas: 'PAS', def: 'DEF', fis: 'FÍS', gr: 'GR',
}
export const DICA_ATRIBUTO: Record<Atributo, string> = {
  vel: 'Contra-ataques e cansaço do adversário.',
  rem: 'Quem remata e quantos remates dão golo.',
  pas: 'Posse de bola e assistências.',
  def: 'Cortes e quantos remates o adversário consegue.',
  fis: 'Cansa menos na segunda parte e aguenta melhor os duelos.',
  gr: 'Defesas do guarda-redes.',
}

export type Perfil = Record<Atributo, number>
export type Atributos = Record<Atributo, number>

/** Peso de cada atributo em cada posição (soma 1). Os de peso 0 não contam para a força. */
export const PESOS: Record<Posicao, Partial<Record<Atributo, number>>> = {
  GR: { gr: 0.7, pas: 0.1, fis: 0.1, vel: 0.1 },
  DEF: { def: 0.45, fis: 0.25, vel: 0.15, pas: 0.15 },
  MED: { pas: 0.45, def: 0.15, rem: 0.15, vel: 0.15, fis: 0.1 },
  AV: { rem: 0.45, vel: 0.25, fis: 0.15, pas: 0.15 },
}

/** Atributos que contam na posição, do mais importante para o menos. */
export function atributosDaPosicao(pos: Posicao): Atributo[] {
  return (Object.entries(PESOS[pos]) as [Atributo, number][]).sort((a, b) => b[1] - a[1]).map(([k]) => k)
}

const LIM = 16

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

/** Acerta o perfil para que a média pesada dos atributos da posição seja 0 (atributos = força). */
export function normalizar(p: Perfil, pos: Posicao): Perfil {
  const pesos = PESOS[pos]
  const out = { ...p }
  for (let k = 0; k < 4; k++) {
    let m = 0
    for (const a of ATRIBUTOS) m += (pesos[a] ?? 0) * out[a]
    if (Math.abs(m) < 0.01) break
    for (const a of ATRIBUTOS) if (pesos[a]) out[a] = clamp(out[a] - m, -LIM, LIM)
  }
  for (const a of ATRIBUTOS) out[a] = Math.round(out[a] * 10) / 10
  return out
}

/** Perfil calculado do id e da posição (o mesmo jogador tem sempre o mesmo). */
export function perfilBase(id: number, pos: Posicao): Perfil {
  const rng = createRng((Math.imul(id + 1, 2654435761) ^ (pos.charCodeAt(0) * 40503)) >>> 0)
  const pesos = PESOS[pos]
  const p = {} as Perfil
  for (const a of ATRIBUTOS) {
    if (pesos[a]) p[a] = clamp(rng.normal(0, 7), -LIM, LIM)
    // Fora da posição: bem abaixo da força (um central não remata como um avançado).
    else p[a] = a === 'gr' || pos === 'GR' ? -(32 + rng.next() * 18) : -(10 + rng.next() * 18)
  }
  // Um ponto forte claro na maioria dos jogadores.
  const fortes = atributosDaPosicao(pos)
  const forte = fortes[Math.floor(rng.next() * fortes.length)]
  p[forte] = clamp(p[forte] + 5, -LIM, LIM)
  return normalizar(p, pos)
}

// O perfil base é puro (id + posição): guarda-se em memória por jogador para o motor não o recalcular a cada minuto.
const cache = new WeakMap<Jogador, { id: number; pos: Posicao; p: Perfil }>()

export function perfilDe(j: Jogador): Perfil {
  if (j.perfil) return j.perfil
  const c = cache.get(j)
  if (c && c.id === j.id && c.pos === j.posicao) return c.p
  const p = perfilBase(j.id, j.posicao)
  cache.set(j, { id: j.id, pos: j.posicao, p })
  return p
}

/** Atributos visíveis do jogador, 1 a 99. */
export function atributosDe(j: Jogador): Atributos {
  const p = perfilDe(j)
  const out = {} as Atributos
  for (const a of ATRIBUTOS) out[a] = clamp(Math.round(j.forca + p[a]), 1, 99)
  return out
}

export function atributo(j: Jogador, a: Atributo): number {
  return clamp(Math.round(j.forca + perfilDe(j)[a]), 1, 99)
}

/** Os atributos da posição, do melhor para o pior (para mostrar o ponto forte). */
export function pontosFortes(j: Jogador, n = 2): Atributo[] {
  const at = atributosDe(j)
  return atributosDaPosicao(j.posicao).sort((a, b) => at[b] - at[a]).slice(0, n)
}

/**
 * Fator de um atributo face à força do jogador (1 = igual à força). Usado pelo motor para
 * que o perfil conte sem mudar o equilíbrio: em média, num plantel, dá 1.
 */
export function fatorAtributo(j: Jogador, a: Atributo, expoente = 1): number {
  const v = j.forca + perfilDe(j)[a]
  const f = ((v < 1 ? 1 : v > 99 ? 99 : v) + 5) / (j.forca + 5)
  const r = f < 0.4 ? 0.4 : f > 1.6 ? 1.6 : f
  return expoente === 1 ? r : Math.pow(r, expoente)
}

/** Fatores dos atributos e potências que o motor usa a cada minuto (calculados uma vez por jogador e força). */
export interface FatoresMotor extends Atributos {
  pas35: number; pas15: number; pas150: number
  rem25vel15: number; rem20: number; rem150: number; rem80: number; vel40: number
  def35: number; def20: number; gr50: number; fisLes: number
}

const cacheF = new WeakMap<Jogador, { forca: number; perfil: Perfil; f: FatoresMotor }>()

export function fatores(j: Jogador): FatoresMotor {
  const p = perfilDe(j)
  const c = cacheF.get(j)
  if (c && c.forca === j.forca && c.perfil === p) return c.f
  const r = {} as Atributos
  for (const a of ATRIBUTOS) {
    const v = j.forca + p[a]
    const x = ((v < 1 ? 1 : v > 99 ? 99 : v) + 5) / (j.forca + 5)
    r[a] = x < 0.4 ? 0.4 : x > 1.6 ? 1.6 : x
  }
  const f: FatoresMotor = {
    ...r,
    pas35: r.pas ** 0.35, pas15: r.pas ** 0.15, pas150: r.pas ** 1.5,
    rem25vel15: r.rem ** 0.25 * r.vel ** 0.15, rem20: r.rem ** 0.2, rem150: r.rem ** 1.5, rem80: r.rem ** 0.8, vel40: r.vel ** 0.4,
    def35: r.def ** 0.35, def20: r.def ** 0.2, gr50: r.gr ** 0.5, fisLes: r.fis ** -0.7,
  }
  cacheF.set(j, { forca: j.forca, perfil: p, f })
  return f
}

/** Nota do jogador numa posição que não é a sua (com os pesos dessa posição). */
export function notaNaPosicao(j: Jogador, pos: Posicao): number {
  const at = atributosDe(j)
  let s = 0
  for (const [a, w] of Object.entries(PESOS[pos]) as [Atributo, number][]) s += w * at[a]
  return s
}

/** Muda o perfil (treino específico, idade) e volta a acertar para a força não mudar. */
export function mexerPerfil(j: Jogador, mudancas: Partial<Record<Atributo, number>>): void {
  const p = { ...perfilDe(j) }
  for (const [a, d] of Object.entries(mudancas) as [Atributo, number][]) {
    p[a] = clamp(p[a] + d, a in PESOS[j.posicao] ? -LIM : -60, LIM)
  }
  j.perfil = normalizar(p, j.posicao)
}

/** Depois de mudar a posição de um jogador: o perfil gravado passa a valer para a nova posição. */
export function ajustarPerfilPosicao(j: Jogador): void {
  if (j.perfil) j.perfil = normalizar(j.perfil, j.posicao)
}
