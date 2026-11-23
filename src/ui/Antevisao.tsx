// Antevisão do jogo: como a minha tática encaixa na provável tática do adversário, setor a setor.
import type { Jogo } from '../core/types'
import type { Partida } from '../core/partida'
import { forcaSetores } from '../core/motor'
import { escalarIA } from '../core/tatica'
import { indisponiveisDe } from '../core/epoca'
import { minhaPartida } from './comum'
import './antevisao.css'

const NOME_POSTURA = { defensiva: 'à defesa', equilibrada: 'equilibrado', ofensiva: 'ao ataque' } as const

function Duelo({ titulo, meu, deles, dica }: { titulo: string; meu: number; deles: number; dica: string }) {
  const pc = Math.round((100 * meu) / (meu + deles || 1))
  const cls = pc >= 54 ? 'bom' : pc <= 46 ? 'mau' : ''
  return (
    <div className={`duelo ${cls}`}>
      <div className="duelo-cab"><span>{titulo}</span><span className="duelo-pc">{pc}%</span></div>
      <div className="duelo-barra" role="img" aria-label={`${titulo}: ${pc}% a teu favor`}><span style={{ width: `${pc}%` }} /></div>
      <div className="duelo-dica">{dica}</div>
    </div>
  )
}

/** `partida` e `indispAdv` servem para jogos fora da liga (taça). */
export function Antevisao({ jogo, partida, indispAdv }: { jogo: Jogo; partida?: Partida; indispAdv?: ReadonlySet<number> }) {
  const { mundo, epoca, clubeId } = jogo
  const p = partida ?? minhaPartida(jogo, epoca.jornada)
  if (!p || jogo.escalacao.titulares.length !== 11) return null
  const emCasa = p.casaId === clubeId
  const advId = emCasa ? p.foraId : p.casaId
  const escAdv = escalarIA(mundo, advId, clubeId, !emCasa, indispAdv ?? indisponiveisDe(mundo, epoca, advId))
  const eu = forcaSetores(mundo, jogo.escalacao, emCasa)
  const ele = forcaSetores(mundo, escAdv, !emCasa)
  const adv = mundo.clubes[advId]
  let conselho = ''
  if (escAdv.postura === 'defensiva') conselho = `${adv.nome} deve fechar-se atrás: atacar compensa, há pouco perigo de contra-ataque.`
  else if (escAdv.postura === 'ofensiva') conselho = `${adv.nome} deve vir ao ataque: jogar mais recuado abre espaço para contra-ataques.`
  return (
    <div className="cartao antevisao">
      <h3 className="sub-tit">Antevisão</h3>
      <p className="dica">Provável tática de {adv.sigla}: {escAdv.formacao}, {NOME_POSTURA[escAdv.postura]}.</p>
      <Duelo titulo="Meio-campo" meu={eu.meio} deles={ele.meio} dica="Decide quem tem mais bola e mais jogadas." />
      <Duelo titulo="O teu ataque contra a defesa deles" meu={eu.ataque} deles={ele.defesa} dica="Decide a qualidade das tuas oportunidades." />
      <Duelo titulo="A tua defesa contra o ataque deles" meu={eu.defesa} deles={ele.ataque} dica="Decide quanto perigo vais sofrer." />
      {conselho && <p className="nota">{conselho}</p>}
    </div>
  )
}
