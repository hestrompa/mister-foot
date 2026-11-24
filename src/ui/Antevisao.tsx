// Antevisão do jogo: como a minha tática encaixa na provável tática do adversário, setor a setor.
import type { Jogo } from '../core/types'
import type { Escalacao, Partida } from '../core/partida'
import type { PlanoJogo } from '../core/plano'
import { relatorioAdversario } from '../core/relatorio'
import { nivelDe } from '../core/staff'
import { Forca } from './Plantel'
import { forcaSetores } from '../core/motor'
import { escalarIA } from '../core/tatica'
import { indisponiveisDe } from '../core/epoca'
import { minhaPartida } from './comum'
import './antevisao.css'
import './plano.css'

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

/** Provável escalação (e plano) do adversário no próximo jogo. */
export function escalacaoAdversario(jogo: Jogo, partida?: Partida, indispAdv?: ReadonlySet<number>): Escalacao | null {
  const { mundo, epoca, clubeId } = jogo
  const p = partida ?? minhaPartida(jogo, epoca.jornada)
  if (!p) return null
  const emCasa = p.casaId === clubeId
  const advId = emCasa ? p.foraId : p.casaId
  return escalarIA(mundo, advId, clubeId, !emCasa, indispAdv ?? indisponiveisDe(mundo, epoca, advId))
}

/** JSON com as chaves ordenadas (para comparar planos). */
function estavel(v: unknown): string {
  return JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x)
    ? Object.fromEntries(Object.entries(x).filter(([, y]) => y !== undefined).sort(([a], [b]) => a.localeCompare(b))) : x))
}

/** Relatório do olheiro: jogadores-chave e ideias que se aplicam ao plano com um toque. */
function RelatorioOlheiro({ jogo, escAdv, aplicar }: { jogo: Jogo; escAdv: Escalacao; aplicar?: (p: PlanoJogo) => void }) {
  const { mundo } = jogo
  const nivel = nivelDe(mundo.clubes[jogo.clubeId], 'olheiro')
  const rel = relatorioAdversario(mundo, jogo.escalacao, escAdv, nivel)
  return (
    <div className="relatorio" data-testid="relatorio">
      <h4>Relatório do olheiro{nivel ? ` (nível ${nivel})` : ''}</h4>
      {!nivel && <p className="dica">Sem olheiro o relatório é curto. Contrata um no separador Staff para saberes mais.</p>}
      <ul className="rel-chave">
        {rel.chave.map((c) => {
          const j = mundo.jogadores[c.id]
          return <li key={c.id}><span className={`pos pos-${j.posicao}`}>{j.posicao}</span><b>{j.curto}</b><Forca valor={j.forca} /><span className="rel-motivo">{c.motivo}{c.forte ? ` · ${c.forte}` : ''}</span></li>
        })}
      </ul>
      {rel.habitos && <p className="dica">{rel.habitos}</p>}
      {rel.sugestoes.length > 0 && <h4>Ideias para este jogo</h4>}
      <ul className="rel-sug">
        {rel.sugestoes.map((s, i) => {
          const novo = s.aplicar?.(jogo.escalacao.plano)
          const feito = !!novo && estavel(novo) === estavel(jogo.escalacao.plano ?? {})
          return (
            <li key={i}>
              <span>{s.texto}</span>
              {s.aplicar && s.rotulo && aplicar && (
                <button className={`botao ${feito ? 'aplicado' : ''}`} disabled={feito} onClick={() => aplicar(novo!)}>{feito ? 'Feito' : s.rotulo}</button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** `partida` e `indispAdv` servem para jogos fora da liga (taça). `aplicar` muda o plano de jogo. */
export function Antevisao({ jogo, partida, indispAdv, aplicar }: { jogo: Jogo; partida?: Partida; indispAdv?: ReadonlySet<number>; aplicar?: (p: PlanoJogo) => void }) {
  const { mundo, epoca, clubeId } = jogo
  const p = partida ?? minhaPartida(jogo, epoca.jornada)
  if (!p || jogo.escalacao.titulares.length !== 11) return null
  const emCasa = p.casaId === clubeId
  const advId = emCasa ? p.foraId : p.casaId
  const escAdv = escalacaoAdversario(jogo, partida, indispAdv)!
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
      <RelatorioOlheiro jogo={jogo} escAdv={escAdv} aplicar={aplicar} />
    </div>
  )
}
