// Países e campeonatos do mundo: Portugal (4 divisões) e, nos jogos novos, os campeonatos estrangeiros
// (Espanha e Inglaterra, 2 divisões cada). Cada divisão tem um número único no mundo (o índice em
// `mundo.divisoes` e no calendário) e um nível no seu país (1 = a primeira). Tudo o que depende do
// "tamanho" da divisão (receitas, salários, juros, staff) usa o nível; o que identifica a divisão
// (tabela, calendário) usa o número. Sem imports para poder ser usado em qualquer módulo do núcleo.
import type { Clube, Divisao, Mundo } from './types'

export const PAIS_BASE = 'PT'

export interface InfoPais {
  codigo: string
  nome: string
  /** "de Portugal", "de Espanha", "de Inglaterra". */
  de: string
  /** Bandeira simples (duas cores) para as etiquetas. */
  cores: [string, string]
}

export const PAISES: Record<string, InfoPais> = {
  PT: { codigo: 'PT', nome: 'Portugal', de: 'de Portugal', cores: ['#046a38', '#da291c'] },
  ES: { codigo: 'ES', nome: 'Espanha', de: 'de Espanha', cores: ['#aa151b', '#f1bf00'] },
  EN: { codigo: 'EN', nome: 'Inglaterra', de: 'de Inglaterra', cores: ['#ffffff', '#cf142b'] },
}

/** Campeonatos estrangeiros dos jogos novos, pela ordem em que aparecem. */
export const PAISES_ESTRANGEIROS = ['ES', 'EN'] as const

/** Nível da divisão do clube no seu país (1 = a primeira). */
export function nivelDe(c: Pick<Clube, 'divisao' | 'nivel'> | undefined): number {
  return c ? c.nivel ?? c.divisao : 4
}

/** País do clube (código). */
export function paisDe(c: Pick<Clube, 'pais'> | undefined): string {
  return c?.pais ?? PAIS_BASE
}

export function nivelDivisao(d: Divisao | undefined, numero = 4): number {
  return d ? d.nivel ?? d.numero : numero
}

export function paisDivisao(d: Divisao | undefined): string {
  return d?.pais ?? PAIS_BASE
}

/** Nível de uma divisão pelo número. */
export function nivelDoNumero(mundo: Mundo, numero: number): number {
  return nivelDivisao(mundo.divisoes[numero - 1], numero)
}

/** Países com campeonato neste mundo (Portugal primeiro). */
export function paisesDoMundo(mundo: Mundo): string[] {
  const out: string[] = []
  for (const d of mundo.divisoes) { const p = paisDivisao(d); if (!out.includes(p)) out.push(p) }
  return out
}

/** Divisões de um país, da primeira para a última. */
export function divisoesDoPais(mundo: Mundo, pais: string): Divisao[] {
  return mundo.divisoes.filter((d) => paisDivisao(d) === pais).sort((a, b) => nivelDivisao(a) - nivelDivisao(b))
}

/** Há divisão abaixo (descidas) / acima (subidas) desta, no mesmo país? */
export function temAbaixo(mundo: Mundo, numero: number): boolean {
  const d = mundo.divisoes[numero - 1]
  return mundo.divisoes.some((x) => paisDivisao(x) === paisDivisao(d) && nivelDivisao(x) === nivelDivisao(d, numero) + 1)
}
export function temAcima(mundo: Mundo, numero: number): boolean {
  return nivelDoNumero(mundo, numero) > 1
}

/** Nome da divisão para textos: "2.ª Divisão" em Portugal, "1.ª Divisão de Espanha" lá fora. */
export function nomeDivisao(mundo: Mundo | undefined, numero: number): string {
  const d = mundo?.divisoes[numero - 1]
  if (!d) return `${numero}.ª Divisão`
  const p = paisDivisao(d)
  return p === PAIS_BASE ? d.nome : `${d.nome} ${PAISES[p]?.de ?? ''}`.trim()
}

/** Etiqueta curta: "2.ª" em Portugal, "ESP 1.ª" lá fora. */
export function etiquetaDivisao(mundo: Mundo | undefined, numero: number): string {
  const d = mundo?.divisoes[numero - 1]
  const n = nivelDivisao(d, numero)
  const p = paisDivisao(d)
  return p === PAIS_BASE ? `${n}.ª` : `${PAISES[p]?.nome.slice(0, 3).toUpperCase() ?? p} ${n}.ª`
}

/** A última divisão do país (onde vão parar os treinadores despedidos, por exemplo). */
export function ultimaDivisao(mundo: Mundo, pais: string): Divisao | undefined {
  const ds = divisoesDoPais(mundo, pais)
  return ds[ds.length - 1]
}
