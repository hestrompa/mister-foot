// Separador Balneário: ambiente, capitão, conflitos, promessas, moral e físico de cada jogador,
// departamento médico e convocatórias para as seleções.
import { useState } from 'react'
import type { Jogo, Posicao } from '../core/types'
import {
  ambiente, capitaoDe, estadoBalneario, estatutos, lideranca, moralDe, NOME_ESTATUTO, textoMoral, type JogoComBalneario,
} from '../core/balneario'
import {
  acoesPossiveis, anteciparRegresso, chanceConversa, definirCapitao, MAX_PROMESSAS, NOME_ACAO, podeAntecipar, prometer,
  PROMESSA_JANELA, PROMESSA_JOGOS, resolverConflito, valorMulta, type AcaoConflito, type Resultado,
} from '../core/balneario-acoes'
import { fadigaDe, fragilDe, textoFadiga, tipoLesao } from '../core/lesoes'
import { estadoSelecao, PAISES, PARAGENS, textoJogoSelecao, type JogoComSelecao } from '../core/selecao'
import { euros } from '../core/formato'
import { Forca } from './Plantel'
import './balneario.css'

const ORDEM_POS: Record<Posicao, number> = { GR: 0, DEF: 1, MED: 2, AV: 3 }

function corMoral(m: number): string {
  if (m >= 70) return 'var(--f-top)'
  if (m >= 50) return 'var(--f-alta)'
  if (m >= 30) return 'var(--f-baixa)'
  return 'var(--f-fraca)'
}

export function Barra({ v, cor, rotulo }: { v: number; cor: string; rotulo: string }) {
  return (
    <span className="bn-barra" title={`${rotulo}: ${Math.round(v)}/100`}>
      <span className="bn-barra-fundo"><span style={{ width: `${Math.max(3, v)}%`, background: cor }} /></span>
      <span className="bn-barra-txt">{rotulo}</span>
    </span>
  )
}

/** Etiquetas pequenas de cansaço, fragilidade e moral para as listas da escalação. */
export function EstadoFisico({ jogo, id }: { jogo: Jogo; id: number }) {
  const j = jogo.mundo.jogadores[id]
  if (!j) return null
  const f = fadigaDe(j)
  const m = moralDe(j)
  const prometido = (jogo as JogoComBalneario).balneario?.promessas.some((p) => p.jogadorId === id)
  return (
    <>
      {fragilDe(j) > 0 && <span className="baixa baixa-lesao" title="Voltou antes do tempo: risco alto de recaída">Frágil</span>}
      {f >= 35 && <span className="baixa baixa-cansado" title={`Cansaço ${f}/100: rende menos e arrisca mais lesões`}>{textoFadiga(f)}</span>}
      {m < 35 && <span className="baixa baixa-moral" title={`Moral ${Math.round(m)}/100`}>Em baixo</span>}
      {prometido && <span className="baixa baixa-promessa" title="Prometeste-lhe jogos a titular">Prometido</span>}
    </>
  )
}

export function Balneario({ jogo, atualizar }: { jogo: Jogo; atualizar: (j: Jogo) => void }) {
  const g = jogo as JogoComBalneario & JogoComSelecao
  const { mundo } = jogo
  const c = mundo.clubes[jogo.clubeId]
  const st = estadoBalneario(g)
  const [msg, setMsg] = useState<Resultado | null>(null)
  const feito = (r: Resultado) => { setMsg(r); atualizar(jogo) }
  const amb = ambiente(mundo, c.id)
  const cap = capitaoDe(mundo, c.id)
  const est = estatutos(mundo, c.id)
  const jogadores = c.plantel.map((id) => mundo.jogadores[id]).filter(Boolean)
    .sort((a, b) => ORDEM_POS[a.posicao] - ORDEM_POS[b.posicao] || b.forca - a.forca)
  const lesionados = jogadores.filter((j) => jogo.epoca.indisponiveis[j.id]?.motivo === 'lesao' && jogo.epoca.indisponiveis[j.id].jogos > 0)
  const sel = estadoSelecao(g)
  const ultima = [...sel.convocatorias].reverse().find((x) => x.ano === jogo.epoca.ano)
  const proxima = PARAGENS.find((p) => p >= jogo.epoca.jornada)
  const meusConv = ultima ? [...ultima.ids, ...ultima.outros].filter((id) => mundo.jogadores[id]?.clubeId === c.id) : []

  return (
    <div className="balneario">
      {msg && <p className={msg.ok ? 'msg-ok' : 'erro'} role="status">{msg.texto}</p>}

      <div className="bn-topo">
        <section className="cartao bn-cartao" aria-label="Ambiente">
          <h3 className="sub-tit">Ambiente</h3>
          <p className="bn-grande" style={{ color: corMoral(amb) }}>{textoMoral(amb)}</p>
          <Barra v={amb} cor={corMoral(amb)} rotulo={`${Math.round(amb)}/100`} />
          <p className="nota">Ganhar, jogar e ver promessas cumpridas sobe a moral. Uma equipa motivada rende um pouco mais; uma revoltada, menos.</p>
        </section>
        <section className="cartao bn-cartao" aria-label="Capitão">
          <h3 className="sub-tit">Capitão</h3>
          {cap && <p className="bn-grande">{mundo.jogadores[cap].nome}</p>}
          {cap && <p className="nota">Liderança {Math.round(lideranca(mundo, mundo.jogadores[cap]) * 100)}/100: amortece as derrotas, acalma conflitos e ajuda nas conversas.</p>}
          <label className="bn-escolha">
            Trocar capitão
            <select value={cap ?? ''} onChange={(e) => feito(definirCapitao(g, Number(e.target.value)))}>
              {[...jogadores].sort((a, b) => lideranca(mundo, b) - lideranca(mundo, a)).map((j) => (
                <option key={j.id} value={j.id}>{j.curto} (liderança {Math.round(lideranca(mundo, j) * 100)})</option>
              ))}
            </select>
          </label>
        </section>
      </div>

      {st.conflitos.length > 0 && (
        <section className="cartao bn-conflitos" aria-label="Conflitos">
          <h3 className="sub-tit">Precisam de ti ({st.conflitos.length})</h3>
          <p className="nota">Se não responderes até à próxima jornada, o jogador sente-se ignorado.</p>
          {st.conflitos.map((k) => {
            const j = mundo.jogadores[k.jogadorId]
            return (
              <div key={k.id} className="bn-conflito">
                <p>{k.texto}</p>
                <div className="ob-opcoes">
                  {acoesPossiveis(k).map((a: AcaoConflito) => (
                    <button key={a} className="botao" onClick={() => feito(resolverConflito(g, k.id, a))}>
                      {NOME_ACAO[a]}
                      {a === 'conversar' && ` (${Math.round(chanceConversa(g, k.jogadorId) * 100)}%)`}
                      {a === 'multar' && j && ` (${euros(valorMulta(j.salario))})`}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </section>
      )}

      {st.promessas.length > 0 && (
        <section className="cartao" aria-label="Promessas">
          <h3 className="sub-tit">Promessas</h3>
          <ul className="bn-lista">
            {st.promessas.map((p) => {
              const j = mundo.jogadores[p.jogadorId]
              return <li key={p.jogadorId}><b>{j?.curto}</b>: titular {p.feitos} de {p.jogos} · prazo até à jornada {p.ate - 1}</li>
            })}
          </ul>
        </section>
      )}

      <section aria-label="Jogadores">
        <h3 className="sub-tit">Jogadores</h3>
        <p className="nota">Prometer jogos: titular em {PROMESSA_JOGOS} dos próximos {PROMESSA_JANELA} jogos do campeonato (máximo {MAX_PROMESSAS} de cada vez). Quebrar a promessa custa caro.</p>
        <div className="tabela-wrap">
          <table className="tabela bn-tabela">
            <thead>
              <tr><th>Pos</th><th>Nome</th><th className="esconde-m">Estatuto</th><th>Moral</th><th>Físico</th><th className="num esconde-m">Jogos</th><th></th></tr>
            </thead>
            <tbody>
              {jogadores.map((j) => {
                const m = moralDe(j)
                const f = fadigaDe(j)
                const ind = jogo.epoca.indisponiveis[j.id]
                const prometido = st.promessas.some((p) => p.jogadorId === j.id)
                return (
                  <tr key={j.id}>
                    <td><span className={`pos pos-${j.posicao}`}>{j.posicao}</span></td>
                    <td>
                      <span className="nome-jogador">{j.curto}</span>
                      {j.id === cap && <span className="craque" title="Capitão">C</span>}
                      {ind && ind.jogos > 0 && <span className={`baixa baixa-${ind.motivo}`}>{ind.motivo === 'lesao' ? 'Lesionado' : 'Castigado'}</span>}
                    </td>
                    <td className="esconde-m">{NOME_ESTATUTO[est.get(j.id) ?? 'reserva']}</td>
                    <td><Barra v={m} cor={corMoral(m)} rotulo={textoMoral(m)} /></td>
                    <td><Barra v={100 - f} cor={f >= 50 ? 'var(--f-fraca)' : f >= 35 ? 'var(--f-baixa)' : 'var(--f-alta)'} rotulo={fragilDe(j) > 0 ? 'Frágil' : textoFadiga(f)} /></td>
                    <td className="num esconde-m">{st.titular[j.id] ?? 0}/{st.jogos[j.id] ?? 0}</td>
                    <td>
                      {!prometido && st.promessas.length < MAX_PROMESSAS && !(ind && ind.jogos > 0) && (
                        <button className="botao mini" onClick={() => feito(prometer(g, j.id))}>Prometer</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="nota">Jogos: titular / total nesta época. Quem joga muito seguido (sobretudo com a Taça pelo meio) acumula cansaço: rende menos e lesiona-se mais. A escalação automática já dá descanso a quem está esgotado.</p>
      </section>

      <section className="cartao" aria-label="Departamento médico">
        <h3 className="sub-tit">Departamento médico</h3>
        {lesionados.length === 0 ? <p className="nota">Ninguém lesionado.</p> : (
          <ul className="bn-lista">
            {lesionados.map((j) => {
              const ind = jogo.epoca.indisponiveis[j.id]
              const t = tipoLesao(ind.tipo)
              return (
                <li key={j.id} className="bn-lesao">
                  <span><b>{j.curto}</b> · {t?.nome ?? 'Lesão'} · faltam {ind.jogos} {ind.jogos === 1 ? 'jogo' : 'jogos'}{ind.total ? ` de ${ind.total}` : ''}</span>
                  {podeAntecipar(g, j.id) && <button className="botao mini" onClick={() => feito(anteciparRegresso(g, j.id))}>Antecipar regresso</button>}
                </li>
              )
            })}
          </ul>
        )}
        <p className="nota">Antecipar regresso: o jogador fica disponível já, mas com risco alto de recaída durante 3 jogos. Quem volta de uma lesão longa precisa de jogos para recuperar o ritmo.</p>
      </section>

      <section className="cartao" aria-label="Seleções">
        <h3 className="sub-tit">Seleções</h3>
        {ultima ? (
          <>
            <p>{textoJogoSelecao(ultima)} (paragem depois da jornada {ultima.jornada})</p>
            {meusConv.length ? (
              <ul className="bn-lista">
                {meusConv.map((id) => {
                  const j = mundo.jogadores[id]
                  const nacional = ultima.ids.includes(id)
                  return <li key={id}><b>{j.curto}</b> · {nacional ? `Portugal (${sel.internacional[id] ?? 1} internacionalizações)` : PAISES[j.nacionalidade] ?? j.nacionalidade}{ultima.lesionados.includes(id) ? ' · lesionou-se' : ''}</li>
                })}
              </ul>
            ) : <p className="nota">Nenhum jogador teu foi convocado.</p>}
          </>
        ) : <p className="nota">Ainda não houve paragem para as seleções esta época.</p>}
        {proxima && <p className="nota">Próxima paragem depois da jornada {proxima}. Os convocados ganham moral e valor, mas voltam mais cansados.</p>}
        <SelecaoNacional jogo={g} />
      </section>

      {st.mensagens.length > 0 && (
        <section className="cartao" aria-label="Notícias do balneário">
          <h3 className="sub-tit">Notícias do balneário</h3>
          <ul className="bn-lista bn-msgs">
            {st.mensagens.slice(0, 12).map((m, i) => <li key={i} className={`bn-${m.tom}`}>J{m.jornada} · {m.texto}</li>)}
          </ul>
        </section>
      )}
    </div>
  )
}

function SelecaoNacional({ jogo }: { jogo: JogoComSelecao }) {
  const [abrir, setAbrir] = useState(false)
  const sel = estadoSelecao(jogo)
  const ultima = [...sel.convocatorias].reverse()[0]
  if (!ultima) return null
  return (
    <>
      <button className="botao fantasma" onClick={() => setAbrir(!abrir)}>{abrir ? 'Esconder' : 'Ver'} a convocatória de Portugal</button>
      {abrir && (
        <ul className="bn-conv">
          {ultima.ids.map((id) => {
            const j = jogo.mundo.jogadores[id]
            if (!j) return null
            return (
              <li key={id} className={j.clubeId === jogo.clubeId ? 'meu' : ''}>
                <span className={`pos pos-${j.posicao}`}>{j.posicao}</span>
                <span className="nome-jogador">{j.curto}</span>
                <span className="bn-clube">{jogo.mundo.clubes[j.clubeId]?.sigla}</span>
                <Forca valor={j.forca} />
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

/** Número de assuntos à espera do treinador (para o separador). */
export function conflitosPendentes(jogo: Jogo): number {
  return (jogo as JogoComBalneario).balneario?.conflitos.length ?? 0
}
