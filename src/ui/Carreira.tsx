// Direção e carreira do treinador: separador Carreira, ecrã de despedimento e balanço no fim da época.
import { nomeDivisao } from '../core/ligas'
import type { Jogo } from '../core/types'
import { euros } from '../core/formato'
import {
  aceitarOferta, estadoCarreira, ofertasValidas, recusarOferta, situacao, textoConfianca, textoObjetivo,
  LIMIAR_AVISO, LIMIAR_DESPEDIMENTO, type Avaliacao, type JogoComCarreira, type Oferta,
} from '../core/direcao'
import { forcaClube } from '../core/mundo'
import { Emblema } from './Emblema'
import { Forca } from './Plantel'
import './carreira.css'

const AVAL: Record<Avaliacao, string> = { superado: 'Superado', cumprido: 'Cumprido', quase: 'Quase', falhado: 'Falhado' }

/** Ofertas por responder (para o número no separador). */
export function ofertasPendentes(jogo: Jogo): number {
  return ofertasValidas(jogo as JogoComCarreira).length
}

export function despedido(jogo: Jogo): boolean {
  return !!estadoCarreira(jogo as JogoComCarreira).despedido
}

function BarraConfianca({ valor }: { valor: number }) {
  const nivel = valor < LIMIAR_AVISO ? 'mal' : valor < 50 ? 'perto' : 'bem'
  return (
    <div className="cr-conf">
      <div className="cr-conf-barra" role="meter" aria-label="Confiança da direção" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(valor)}>
        <span className={`cr-${nivel}`} style={{ width: `${Math.round(valor)}%` }} />
        <i style={{ left: `${LIMIAR_DESPEDIMENTO}%` }} title="Despedimento" />
      </div>
      <span className={`cr-conf-txt cr-t-${nivel}`}>{textoConfianca(valor)} · {Math.round(valor)}/100</span>
    </div>
  )
}

function CartaoOferta({ jogo, o, aceitar, recusar }: { jogo: Jogo; o: Oferta; aceitar: () => void; recusar?: () => void }) {
  const c = jogo.mundo.clubes[o.clubeId]
  return (
    <div className="cartao cr-oferta">
      <Emblema clube={c} tamanho={36} />
      <div className="cr-of-info">
        <b>{c.nome}</b>
        <span className="info-d">{nomeDivisao(jogo.mundo, c.divisao)} · reputação {c.reputacao} · {euros(c.dinheiro)}</span>
        <span className="info-d">{o.motivo}</span>
      </div>
      <Forca valor={forcaClube(jogo.mundo, c.id)} />
      <div className="grupo-botoes">
        <button className="botao principal" onClick={aceitar}>Aceitar</button>
        {recusar && <button className="botao" onClick={recusar}>Recusar</button>}
      </div>
    </div>
  )
}

export function Carreira({ jogo, atualizar, mudouClube }: { jogo: Jogo; atualizar: (j: Jogo) => void; mudouClube: () => void }) {
  const jc = jogo as JogoComCarreira
  const st = estadoCarreira(jc)
  const o = st.objetivos
  const sit = situacao(jc)
  const meu = jogo.mundo.clubes[jogo.clubeId]
  const ofertas = ofertasValidas(jc)
  const msgs = [...st.mensagens].reverse().slice(0, 5)
  const dinheiroOk = meu.dinheiro >= o.dinheiroMin
  return (
    <div className="carreira">
      <section className="cartao cr-direcao" aria-label="Direção">
        <h3 className="sub-tit">Confiança da direção</h3>
        <BarraConfianca valor={st.confianca} />
        {st.confianca < LIMIAR_AVISO && <p className="aviso-txt">O teu lugar está em risco. Abaixo de {LIMIAR_DESPEDIMENTO} a direção despede.</p>}
        <h3 className="sub-tit">Objetivos da época</h3>
        <ul className="cr-obj">
          <li>
            <span>Liga: <b>{textoObjetivo(o)}</b></span>
            <span className={`cr-t-${sit.nivel}`}>{sit.texto}</span>
          </li>
          <li>
            <span>Contas: <b>{o.dinheiroMin > 0 ? `acabar com pelo menos ${euros(o.dinheiroMin)}` : o.dinheiroMin === 0 ? 'não acabar no vermelho' : `não dever mais de ${euros(-o.dinheiroMin)}`}</b></span>
            <span className={dinheiroOk ? 'cr-t-bem' : 'cr-t-mal'}>Hoje: {euros(meu.dinheiro)}</span>
          </li>
        </ul>
        <p className="nota">A direção esperava o {o.esperado}.º lugar, pelas contas da força do plantel, dos salários e da reputação do clube.</p>
      </section>

      <div className="cartoes-info">
        <div className="cartao info">
          <span className="info-t">Reputação do treinador</span>
          <span className="info-v">{st.reputacao}/100</span>
          <span className="info-d">clubes até ~{Math.min(100, st.reputacao + 12)} podem chamar-te</span>
        </div>
        <div className="cartao info">
          <span className="info-t">Carreira</span>
          <span className="info-v">{st.historico.filter((e) => e.jogos > 0).length} {st.historico.filter((e) => e.jogos > 0).length === 1 ? 'época' : 'épocas'}</span>
          <span className="info-d">{st.historico.filter((e) => e.campeao).length} títulos · {st.historico.filter((e) => e.subiu).length} subidas</span>
        </div>
      </div>

      {ofertas.length > 0 && (
        <section aria-label="Ofertas">
          <h3 className="sub-tit">Ofertas de outros clubes</h3>
          <p className="nota">Aceitar muda-te já para o clube novo, com objetivos novos. Valem até à próxima jornada.</p>
          {ofertas.map((of) => (
            <CartaoOferta key={of.clubeId} jogo={jogo} o={of}
              aceitar={() => {
                if (!confirm(`Deixar o ${meu.nome} e assinar pelo ${jogo.mundo.clubes[of.clubeId].nome}?`)) return
                if (aceitarOferta(jc, of.clubeId)) { atualizar(jogo); mudouClube() }
              }}
              recusar={() => { recusarOferta(jc, of.clubeId); atualizar(jogo) }} />
          ))}
        </section>
      )}

      {msgs.length > 0 && (
        <section aria-label="Mensagens da direção">
          <h3 className="sub-tit">Mensagens</h3>
          <ul className="cr-msgs">
            {msgs.map((m, i) => <li key={i}><span className="ev-min">J{Math.max(1, m.jornada)}</span> {m.texto}</li>)}
          </ul>
        </section>
      )}

      <h3 className="sub-tit">Histórico</h3>
      <div className="tabela-wrap">
        <table className="tabela">
          <thead><tr><th>Época</th><th>Clube</th><th className="esconde-m">Objetivo</th><th className="num">Pos.</th><th>Resultado</th></tr></thead>
          <tbody>
            {[...st.historico].reverse().map((e, i) => (
              <tr key={i} className={i === 0 && !e.posicao && !e.saida ? 'meu' : ''}>
                <td>{e.ano}/{String(e.ano + 1).slice(2)}</td>
                <td>
                  <span className="clube-linha">
                    {jogo.mundo.clubes[e.clubeId] && <Emblema clube={jogo.mundo.clubes[e.clubeId]} tamanho={18} />}
                    <span className="cr-nome">{e.clubeNome}</span>
                  </span>
                  <span className="info-d cr-div"> {nomeDivisao(jogo.mundo, e.divisao)}</span>
                </td>
                <td className="esconde-m">{e.objetivo}</td>
                <td className="num">{e.posicao ? `${e.posicao}.º` : '—'}</td>
                <td>
                  {e.saida === 'despedido' ? <span className="cr-t-mal">Despedido (J{e.ate})</span>
                    : e.saida === 'saiu' ? <span>Saiu (J{e.ate})</span>
                    : e.avaliacao ? <span className={`cr-av cr-av-${e.avaliacao}`}>{AVAL[e.avaliacao]}{e.campeao ? ' · campeão' : e.subiu ? ' · subiu' : e.desceu ? ' · desceu' : ''}</span>
                    : <span className="info-d">a decorrer · {e.pontos} pts em {e.jogos} j</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Ecrã que aparece quando a direção me despede: escolho um dos clubes que me querem. */
export function Despedido({ jogo, atualizar, mudouClube }: { jogo: Jogo; atualizar: (j: Jogo) => void; mudouClube: () => void }) {
  const jc = jogo as JogoComCarreira
  const st = estadoCarreira(jc)
  const d = st.despedido
  if (!d) return null
  return (
    <div className="carreira despedido">
      <div className="cartao destaque">
        <div className="pj-cab">Comunicado da direção</div>
        <h2>Foste despedido do {jogo.mundo.clubes[jogo.clubeId].nome}</h2>
        <p>{d.motivo}</p>
      </div>
      <h3 className="sub-tit">Clubes que te querem</h3>
      <p className="nota">Escolhe o próximo desafio. A época continua no clube novo.</p>
      {d.ofertas.map((o) => (
        <CartaoOferta key={o.clubeId} jogo={jogo} o={o} aceitar={() => { if (aceitarOferta(jc, o.clubeId)) { atualizar(jogo); mudouClube() } }} />
      ))}
    </div>
  )
}

/** Balanço da direção no ecrã de fim de época. */
export function BalancoDirecao({ jogo }: { jogo: Jogo }) {
  const st = estadoCarreira(jogo as JogoComCarreira)
  const a = st.ultimaAvaliacao
  if (!a) return null
  const novas = st.ofertas.filter((o) => o.ano === jogo.epoca.ano).length
  return (
    <div className="cartao cr-balanco">
      <span className="info-t">A direção · objetivo {AVAL[a.avaliacao].toLowerCase()}</span>
      <p>{a.texto}</p>
      {!st.despedido && <BarraConfianca valor={st.confianca} />}
      {!st.despedido && <p className="info-d">Objetivo para a nova época: <b>{textoObjetivo(st.objetivos)}</b>.</p>}
      {!st.despedido && novas > 0 && <p className="aviso-txt">{novas === 1 ? 'Tens uma oferta de outro clube' : `Tens ${novas} ofertas de outros clubes`}: vê no separador Carreira antes da 1.ª jornada.</p>}
    </div>
  )
}

/** Linha curta no separador Jogo quando há ofertas ou o lugar está em risco. */
export function AvisoDirecao({ jogo, abrir }: { jogo: Jogo; abrir: () => void }) {
  const st = estadoCarreira(jogo as JogoComCarreira)
  const n = ofertasValidas(jogo as JogoComCarreira).length
  if (!n && st.confianca >= LIMIAR_AVISO) return null
  return (
    <button className="cartao cr-aviso" onClick={abrir}>
      {st.confianca < LIMIAR_AVISO && <span className="cr-t-mal">A direção está a perder a paciência ({Math.round(st.confianca)}/100).</span>}
      {n > 0 && <span className="cr-t-bem">{n === 1 ? 'Tens uma oferta de outro clube.' : `Tens ${n} ofertas de outros clubes.`}</span>}
      <span className="info-d">Ver carreira</span>
    </button>
  )
}
