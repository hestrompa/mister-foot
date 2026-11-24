// Notícias das reformas: lendas do futebol e jogadores do meu clube que penduram as botas.
import type { Jogo } from './types'
import { reformas, type Reforma } from './carreira-jogador'
import { noticiaExtra } from './imprensa'

/** Publica (uma vez) as reformas ainda não anunciadas. Devolve quantas publicou. */
export function anunciarReformas(jogo: Jogo): number {
  let n = 0
  for (const r of reformas(jogo.mundo) as (Reforma & { dito?: boolean })[]) {
    if (r.dito) continue
    r.dito = true
    const meu = r.clubeId === jogo.clubeId
    if (!meu && !r.lenda) continue
    const titulo = r.lenda
      ? `${r.nome} despede-se: uma lenda pendura as botas`
      : `${r.nome} termina a carreira no ${r.clube}`
    const texto = `Aos ${r.idade} anos${r.jogos ? `, depois de ${r.jogos} jogos e ${r.golos} golos registados` : ''}. ${r.lenda ? 'Entra na galeria de lendas (separador História).' : 'O balneário fez-lhe uma despedida à altura.'}`
    noticiaExtra(jogo, meu ? 'meu' : 'liga', titulo, texto)
    n++
  }
  return n
}
