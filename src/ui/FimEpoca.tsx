import type { Jogo } from '../core/types'
import type { ResumoEpoca } from '../core/partida'
import { NOMES_DIVISAO } from '../core/mundo'
import { Emblema } from './Emblema'
import { vencedorTacaDe } from './Taca'
import { NOME_TACA } from '../core/taca'
import { BalancoDirecao } from './Carreira'

export interface DadosFimEpoca {
  resumo: ResumoEpoca
  posicao: number
  divisaoAntes: number
  divisaoDepois: number
}

export function FimEpoca({ jogo, d, continuar }: { jogo: Jogo; d: DadosFimEpoca; continuar: () => void }) {
  const { mundo } = jogo
  const r = d.resumo
  const nomeDiv = (n: number) => NOMES_DIVISAO[n - 1] ?? `${n}.ª Divisão`
  const clube = (id: number) => (
    <span key={id} className="clube-linha"><Emblema clube={mundo.clubes[id]} tamanho={20} /> {mundo.clubes[id].nome}</span>
  )
  const msg = d.divisaoDepois < d.divisaoAntes ? `Subida de divisão! Para a próxima época jogas na ${nomeDiv(d.divisaoDepois)}.`
    : d.divisaoDepois > d.divisaoAntes ? `Descida de divisão. Para a próxima época jogas na ${nomeDiv(d.divisaoDepois)}.`
    : `Continuas na ${nomeDiv(d.divisaoDepois)}.`
  return (
    <div className="fim-epoca">
      <div className="cartao destaque">
        <div className="pj-cab">Fim da época {r.ano}/{String(r.ano + 1).slice(2)}</div>
        <h2>{d.posicao}.º lugar na {nomeDiv(d.divisaoAntes)}</h2>
        <p>{msg}</p>
      </div>
      <BalancoDirecao jogo={jogo} />
      <div className="cartoes-info">
        {r.campeoes.map((c) => (
          <div key={c.divisao} className="cartao info">
            <span className="info-t">Campeão · {nomeDiv(c.divisao)}</span>
            {clube(c.clubeId)}
            <span className="info-d">Sobem: {r.subidas.find((s) => s.divisao === c.divisao)?.clubeIds.map((id) => mundo.clubes[id].sigla).join(', ') || '—'}</span>
            <span className="info-d">Descem: {r.descidas.find((s) => s.divisao === c.divisao)?.clubeIds.map((id) => mundo.clubes[id].sigla).join(', ') || '—'}</span>
          </div>
        ))}
        {(() => {
          const h = vencedorTacaDe(jogo, r.ano)
          if (!h) return null
          return (
            <div className={`cartao info ${h.vencedorId === jogo.clubeId ? 'meu' : ''}`}>
              <span className="info-t">{NOME_TACA}{h.vencedorId === jogo.clubeId ? ' · ganhaste!' : ''}</span>
              {clube(h.vencedorId)}
              <span className="info-d">Final: {h.resultado} contra {mundo.clubes[h.finalistaId]?.nome ?? ''}</span>
            </div>
          )
        })()}
        {r.melhorMarcador && (
          <div className="cartao info">
            <span className="info-t">Melhor marcador</span>
            <span className="info-v">{mundo.jogadores[r.melhorMarcador.jogadorId]?.nome ?? '—'}</span>
            <span className="info-d">{r.melhorMarcador.golos} golos · {mundo.clubes[mundo.jogadores[r.melhorMarcador.jogadorId]?.clubeId]?.nome ?? ''}</span>
          </div>
        )}
      </div>
      <div className="barra-acao">
        <button className="botao principal grande" onClick={continuar}>Começar nova época</button>
      </div>
    </div>
  )
}
