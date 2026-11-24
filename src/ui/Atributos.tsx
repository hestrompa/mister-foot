// Atributos do jogador: barras (fichas de mercado, contratos, plantel) e o ponto forte (tabelas).
import type { Jogador } from '../core/types'
import { ATRIBUTOS, DICA_ATRIBUTO, NOME_ATRIBUTO, PESOS, SIGLA_ATRIBUTO, atributosDe, pontosFortes, type Atributo } from '../core/atributos'
import { corForca } from './Plantel'

/** Atributos que se mostram: os de campo para os de campo, os de baliza para os guarda-redes. */
export function atributosVisiveis(j: Jogador): Atributo[] {
  return j.posicao === 'GR' ? ['gr', 'vel', 'pas', 'fis'] : ATRIBUTOS.filter((a) => a !== 'gr')
}

export function AtributosJogador({ j }: { j: Jogador }) {
  const at = atributosDe(j)
  const fortes = new Set(pontosFortes(j, 1))
  return (
    <div className="atributos" aria-label="Atributos">
      {atributosVisiveis(j).map((a) => {
        const v = at[a]
        const conta = (PESOS[j.posicao][a] ?? 0) > 0
        return (
          <div key={a} className={`atr ${conta ? '' : 'atr-fora'} ${fortes.has(a) ? 'atr-forte' : ''}`} title={`${DICA_ATRIBUTO[a]}${conta ? '' : ' Pouco conta na posição dele.'}`}>
            <span className="atr-nome">{NOME_ATRIBUTO[a]}</span>
            <span className="atr-barra"><span style={{ width: `${v}%`, background: corForca(v) }} /></span>
            <span className="atr-num" style={{ color: corForca(v) }}>{v}</span>
          </div>
        )
      })}
    </div>
  )
}

/** O ponto forte do jogador, curto (ex.: "REM 81"). */
export function PontoForte({ j }: { j: Jogador }) {
  const at = atributosDe(j)
  const [a] = pontosFortes(j, 1)
  return <span className="ponto-forte" title={`Ponto forte: ${NOME_ATRIBUTO[a].toLowerCase()}`}>{SIGLA_ATRIBUTO[a]} {at[a]}</span>
}
