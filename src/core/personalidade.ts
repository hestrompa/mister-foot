// Personalidade dos jogadores: um traço de carácter por jogador (ou nenhum), calculado do id como o
// perfil dos atributos, para que as gravações antigas funcionem sem nada gravado.
//
// Cada traço mexe em pouca coisa, mas visível na carreira:
// - Profissional: treina melhor e aguenta mais anos (reforma-se mais tarde, quebra menos).
// - Ambicioso: evolui um pouco mais, pede mais para renovar e não quer ficar num clube pequeno.
// - Leal: renova mais barato e mesmo desmotivado aceita ficar; termina a carreira no clube.
// - Temperamental: vê muito mais cartões; a moral sobe e desce mais.
// - Líder: pesa mais no balneário (capitão natural).
// - Descontraído: treina menos (talento desperdiçado se ninguém puxar por ele).
// - Frio: decide jogos grandes (converte um pouco melhor nas finais e penáltis), raramente vê cartões.
import type { Jogador } from './types'
import { createRng } from './rng'

export type Personalidade = 'profissional' | 'ambicioso' | 'leal' | 'temperamental' | 'lider' | 'descontraido' | 'frio'

export const NOME_PERSONALIDADE: Record<Personalidade, string> = {
  profissional: 'Profissional',
  ambicioso: 'Ambicioso',
  leal: 'Leal',
  temperamental: 'Temperamental',
  lider: 'Líder',
  descontraido: 'Descontraído',
  frio: 'Sangue-frio',
}

export const DICA_PERSONALIDADE: Record<Personalidade, string> = {
  profissional: 'Treina como ninguém: evolui mais depressa, quebra menos com a idade e joga até mais tarde.',
  ambicioso: 'Quer chegar longe: evolui um pouco mais, mas pede mais para renovar e não aceita clubes pequenos.',
  leal: 'Veste a camisola: renova mais barato, aceita ficar mesmo desmotivado e acaba a carreira no clube.',
  temperamental: 'Joga no limite: vê muitos mais cartões e a moral muda depressa.',
  lider: 'Fala alto no balneário: conta muito mais para capitão e para o ambiente do grupo.',
  descontraido: 'Talento sem pressa: evolui mais devagar e reforma-se cedo.',
  frio: 'Não treme: raramente vê cartões e marca melhor nos penáltis.',
}

/** Probabilidade de cada traço (o resto, cerca de 40%, não tem traço marcado). */
const TRACOS: [Personalidade, number][] = [
  ['profissional', 0.12], ['ambicioso', 0.1], ['leal', 0.09], ['temperamental', 0.09],
  ['lider', 0.07], ['descontraido', 0.08], ['frio', 0.05],
]

type ComPersonalidade = Jogador & { carater?: Personalidade | '' }

/** Traço do jogador (`undefined` = sem traço marcado). Estável: o mesmo jogador tem sempre o mesmo. */
export function personalidadeDe(j: Jogador): Personalidade | undefined {
  const g = (j as ComPersonalidade).carater
  if (g !== undefined) return g || undefined
  const rng = createRng((Math.imul(j.id + 7, 2246822519) ^ 0x5eed) >>> 0)
  let r = rng.next()
  for (const [p, w] of TRACOS) if ((r -= w) < 0) return p
  return undefined
}

/** Fixa o traço (juniores da academia podem nascer com um traço escolhido pela formação). */
export function definirPersonalidade(j: Jogador, p: Personalidade | undefined): void {
  (j as ComPersonalidade).carater = p ?? ''
}

/** Multiplicador da probabilidade de evoluir no treino. */
export function fatorTreinoPers(j: Jogador): number {
  switch (personalidadeDe(j)) {
    case 'profissional': return 1.25
    case 'ambicioso': return 1.12
    case 'descontraido': return 0.75
    default: return 1
  }
}

/** Peso nas faltas (quem vê os cartões). */
export function fatorFaltaPers(j: Jogador): number {
  const p = personalidadeDe(j)
  return p === 'temperamental' ? 2.3 : p === 'frio' ? 0.5 : 1
}

/** Anos a mais (ou a menos) de carreira antes da reforma. */
export function anosExtraCarreira(j: Jogador): number {
  const p = personalidadeDe(j)
  return p === 'profissional' ? 1 : p === 'descontraido' ? -1 : 0
}

/** Multiplicador do salário pedido ao renovar. */
export function fatorRenovacaoPers(j: Jogador): number {
  const p = personalidadeDe(j)
  return p === 'leal' ? 0.9 : p === 'ambicioso' ? 1.12 : 1
}
