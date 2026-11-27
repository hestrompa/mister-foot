// Notícias, conferências de imprensa e aviso de dérbi antes do jogo.
import { useEffect, useState } from 'react'
import type { Jogo } from '../core/types'
import { conferenciaPendente, estadoImprensa, flashPendente, marcarLidas, responderConferencia, type Noticia, type TipoNoticia } from '../core/imprensa'
import { fatorAdeptos, humorDe, NOME_HUMOR, nivelHumor } from '../core/adeptos'
import { lotacaoAtual } from '../core/estadio'
import { rivalidade } from '../core/rivalidades'
import { confronto } from '../core/recordes'
import { minhaPartida } from './comum'
import { Emblema } from './Emblema'
import './imprensa.css'

const ETIQUETA: Record<TipoNoticia, string> = {
  meu: 'O teu clube', liga: 'Liga', derbi: 'Dérbi', recorde: 'Recorde', imprensa: 'Imprensa', direcao: 'Direção', epoca: 'Época', adeptos: 'Adeptos',
}

function efeito(v: number, nome: string) {
  if (!v) return null
  return <span className={`im-ef ${v > 0 ? 'mais' : 'menos'}`}>{nome} {v > 0 ? '+' : '−'}</span>
}

/** Conferência de imprensa antes do jogo, ou no fim do último (opcional: pode-se jogar sem responder). */
export function ConferenciaCartao({ jogo, atualizar, momento = 'antes' }: { jogo: Jogo; atualizar: (j: Jogo) => void; momento?: 'antes' | 'depois' }) {
  const c = momento === 'depois' ? flashPendente(jogo) : conferenciaPendente(jogo)
  const [aberta, setAberta] = useState(true)
  if (!c) return null
  return (
    <section className={`cartao im-conf ${momento === 'depois' ? 'im-flash' : ''}`} aria-label={momento === 'depois' ? 'Conferência depois do jogo' : 'Conferência de imprensa'}>
      <div className="im-conf-topo">
        <span className="im-etq imprensa">{momento === 'depois' ? 'Conferência depois do jogo' : 'Conferência antes do jogo'}</span>
        <button className="botao fantasma pequeno" onClick={() => setAberta(!aberta)}>{aberta ? 'Agora não' : 'Responder'}</button>
      </div>
      {aberta && (
        <>
          <p className="im-pergunta">«{c.pergunta}»</p>
          <div className="im-opcoes">
            {c.opcoes.map((o, i) => (
              <button key={i} className="botao im-opcao" onClick={() => { responderConferencia(jogo, i, momento); atualizar(jogo) }}>
                <span>{o.texto}</span>
                <span className="im-efs">
                  {efeito(o.moral, 'Moral')}
                  {efeito(o.moralJogador ?? 0, 'Moral dele')}
                  {efeito(o.confianca, 'Direção')}
                  {efeito(o.adeptos ?? 0, 'Adeptos')}
                  {o.promessa && <span className="im-ef promessa">{o.promessa === 'vencer' ? 'Promete vitória' : 'Promete não perder'}</span>}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

/** Humor dos adeptos do meu clube e o que faz à bilheteira. */
export function PainelAdeptos({ jogo }: { jogo: Jogo }) {
  const meu = jogo.mundo.clubes[jogo.clubeId]
  const h = humorDe(meu)
  const nivel = nivelHumor(h)
  const pct = Math.round((fatorAdeptos(meu) - 1) * 100)
  // Último jogo em casa da liga.
  let ultimo: { publico: number; adv: string } | null = null
  const cal = jogo.epoca.calendario[meu.divisao - 1] ?? []
  for (let k = Math.min(cal.length, jogo.epoca.jornada - 1) - 1; k >= 0 && !ultimo; k--) {
    const p = cal[k]?.find((x) => x.casaId === meu.id && x.jogada)
    if (p?.publico) ultimo = { publico: p.publico, adv: jogo.mundo.clubes[p.foraId]?.nome ?? '?' }
  }
  const lot = lotacaoAtual(meu)
  return (
    <section className={`cartao im-adeptos ${nivel}`} aria-label="Adeptos" data-testid="adeptos">
      <div className="im-ad-topo">
        <span className="im-etq adeptos">Adeptos</span>
        <b>{NOME_HUMOR[nivel]}</b>
        <span className="im-ad-num">{Math.round(h)}/100</span>
      </div>
      <div className="im-ad-barra" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(h)} aria-label="Humor dos adeptos">
        <span style={{ width: `${Math.max(2, h)}%` }} />
      </div>
      <p className="info-d">
        {pct === 0 ? 'Procura de bilhetes normal.' : `${pct > 0 ? '+' : '−'}${Math.abs(pct)}% de procura de bilhetes e de lugares anuais.`}
        {ultimo ? ` Último jogo em casa: ${ultimo.publico.toLocaleString('pt-PT')} de ${lot.toLocaleString('pt-PT')} lugares (${ultimo.adv}).` : ''}
        {nivel === 'furiosos' ? ' A direção sente a pressão das bancadas e os jogadores ouvem assobios em casa.' : nivel === 'euforia' ? ' O estádio em festa dá moral em casa e a direção agradece.' : ''}
      </p>
      <p className="nota">Sobem e descem com os resultados face ao esperado (dérbis valem mais), com o que dizes na imprensa, com o preço do bilhete e com a venda das figuras.</p>
    </section>
  )
}

/** Faixa antes de um dérbi ou clássico: nome, historial e pressão. */
export function AvisoRival({ jogo }: { jogo: Jogo }) {
  const p = minhaPartida(jogo, jogo.epoca.jornada)
  if (!p) return null
  const advId = p.casaId === jogo.clubeId ? p.foraId : p.casaId
  const r = rivalidade(jogo.mundo.clubes[jogo.clubeId], jogo.mundo.clubes[advId])
  if (!r) return null
  const h = confronto(jogo, jogo.clubeId, advId)
  const promessa = estadoImprensa(jogo).promessa
  return (
    <div className={`cartao im-rival ${r.tipo}`}>
      <Emblema clube={jogo.mundo.clubes[advId]} tamanho={28} />
      <div>
        <b>{r.nome}</b> contra o {jogo.mundo.clubes[advId].nome}
        <span className="info-d">
          {h.v + h.e + h.d ? `Historial: ${h.v}V ${h.e}E ${h.d}D (${h.gm}-${h.gs}). ` : 'Primeiro encontro registado. '}
          {p.casaId === jogo.clubeId ? 'Casa mais cheia do que o costume. ' : ''}
          {r.tipo === 'classico' ? 'A direção e os adeptos não perdoam uma derrota.' : 'Um dérbi pesa mais na moral e na direção.'}
          {promessa && promessa.jornada === jogo.epoca.jornada ? ` Prometeste ${promessa.tipo === 'vencer' ? 'ganhar' : 'não perder'}.` : ''}
        </span>
      </div>
    </div>
  )
}

function ListaNoticias({ noticias, novas }: { noticias: Noticia[]; novas: number }) {
  const porJornada = new Map<string, Noticia[]>()
  for (const n of [...noticias].reverse()) {
    const k = `${n.ano}-${n.jornada}`
    if (!porJornada.has(k)) porJornada.set(k, [])
    porJornada.get(k)!.push(n)
  }
  return (
    <div className="im-lista">
      {[...porJornada.entries()].map(([k, ns]) => (
        <div key={k}>
          <h4 className="sub-tit">{ns[0].jornada ? `Depois da jornada ${ns[0].jornada}` : 'Antes da época'} · {ns[0].ano}/{String(ns[0].ano + 1).slice(2)}</h4>
          <ul className="im-noticias">
            {ns.map((n) => (
              <li key={n.n} className={`cartao im-noticia ${n.n > novas ? 'nova' : ''}`}>
                <span className={`im-etq ${n.tipo}`}>{ETIQUETA[n.tipo]}</span>
                <span className="im-tit">{n.titulo}</span>
                {n.texto && <span className="im-txt">{n.texto}</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

export function Noticias({ jogo, atualizar }: { jogo: Jogo; atualizar: (j: Jogo) => void }) {
  const st = estadoImprensa(jogo)
  // As que estavam por ler quando se abriu o separador ficam destacadas.
  const [lidaAte] = useState(st.lidaAte)
  useEffect(() => {
    if (st.lidaAte !== st.seq) { marcarLidas(jogo); atualizar(jogo) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="imprensa">
      <PainelAdeptos jogo={jogo} />
      <ConferenciaCartao jogo={jogo} atualizar={atualizar} momento="depois" />
      <ConferenciaCartao jogo={jogo} atualizar={atualizar} />
      {st.noticias.length ? <ListaNoticias noticias={st.noticias} novas={lidaAte} /> : <p className="nota">Ainda não há notícias. Joga a primeira jornada.</p>}
    </div>
  )
}
