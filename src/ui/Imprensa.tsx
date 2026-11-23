// Notícias, conferências de imprensa e aviso de dérbi antes do jogo.
import { useEffect, useState } from 'react'
import type { Jogo } from '../core/types'
import { conferenciaPendente, estadoImprensa, marcarLidas, responderConferencia, type Noticia, type TipoNoticia } from '../core/imprensa'
import { rivalidade } from '../core/rivalidades'
import { confronto } from '../core/recordes'
import { minhaPartida } from './comum'
import { Emblema } from './Emblema'
import './imprensa.css'

const ETIQUETA: Record<TipoNoticia, string> = {
  meu: 'O teu clube', liga: 'Liga', derbi: 'Dérbi', recorde: 'Recorde', imprensa: 'Imprensa', direcao: 'Direção', epoca: 'Época',
}

function efeito(v: number, nome: string) {
  if (!v) return null
  return <span className={`im-ef ${v > 0 ? 'mais' : 'menos'}`}>{nome} {v > 0 ? '+' : '−'}</span>
}

/** Conferência de imprensa antes do jogo (opcional: pode-se jogar sem responder). */
export function ConferenciaCartao({ jogo, atualizar }: { jogo: Jogo; atualizar: (j: Jogo) => void }) {
  const c = conferenciaPendente(jogo)
  const [aberta, setAberta] = useState(true)
  if (!c) return null
  return (
    <section className="cartao im-conf" aria-label="Conferência de imprensa">
      <div className="im-conf-topo">
        <span className="im-etq imprensa">Conferência de imprensa</span>
        <button className="botao fantasma pequeno" onClick={() => setAberta(!aberta)}>{aberta ? 'Agora não' : 'Responder'}</button>
      </div>
      {aberta && (
        <>
          <p className="im-pergunta">«{c.pergunta}»</p>
          <div className="im-opcoes">
            {c.opcoes.map((o, i) => (
              <button key={i} className="botao im-opcao" onClick={() => { responderConferencia(jogo, i); atualizar(jogo) }}>
                <span>{o.texto}</span>
                <span className="im-efs">
                  {efeito(o.moral, 'Moral')}
                  {efeito(o.moralJogador ?? 0, 'Moral dele')}
                  {efeito(o.confianca, 'Direção')}
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
      <ConferenciaCartao jogo={jogo} atualizar={atualizar} />
      {st.noticias.length ? <ListaNoticias noticias={st.noticias} novas={lidaAte} /> : <p className="nota">Ainda não há notícias. Joga a primeira jornada.</p>}
    </div>
  )
}
