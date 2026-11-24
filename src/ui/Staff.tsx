// Separador Staff: equipa técnica (contratar, trocar, despedir), foco do treino e evolução da época.
import { useState } from 'react'
import type { Jogo, Posicao } from '../core/types'
import { euros } from '../core/formato'
import {
  EFEITO_FUNCAO, FOCOS, FUNCOES, NIVEL_MAX, NOME_FOCO, NOME_FUNCAO, candidatos, contratarStaff, custoStaffPorJornada,
  despedirStaff, estimativaPotencial, indemnizacao, membro, mudarFoco, mudarTreinoAtributo, staffDe, type Funcao, type Resultado,
} from '../core/staff'
import { Forca } from './Plantel'
import { ATRIBUTOS, DICA_ATRIBUTO, NOME_ATRIBUTO, PESOS, atributo } from '../core/atributos'
import { POSICOES } from '../core/types'

const NOME_POS = { GR: 'guarda-redes', DEF: 'defesas', MED: 'médios', AV: 'avançados' } as const
import './staff.css'

const DICA_FOCO: Record<string, string> = {
  equilibrado: 'Todos treinam por igual.',
  jovens: 'Os jogadores até 21 anos evoluem mais depressa; os outros um pouco menos.',
}

function Nivel({ n }: { n: number }) {
  return (
    <span className="st-nivel" aria-label={`Nível ${n} de ${NIVEL_MAX}`} title={`Nível ${n} de ${NIVEL_MAX}`}>
      {Array.from({ length: NIVEL_MAX }, (_, i) => <span key={i} className={i < n ? 'on' : ''} />)}
    </span>
  )
}

export function Staff({ jogo, atualizar }: { jogo: Jogo; atualizar: (j: Jogo) => void }) {
  const { mundo } = jogo
  const c = mundo.clubes[jogo.clubeId]
  const st = staffDe(c)
  const [abrir, setAbrir] = useState<Funcao | null>(null)
  const [msg, setMsg] = useState<Resultado | null>(null)
  const feito = (r: Resultado) => { setMsg(r); if (r.ok) setAbrir(null); atualizar(jogo) }
  const foco = st?.foco ?? 'equilibrado'
  const mensal = (st?.membros ?? []).reduce((s, m) => s + m.salario, 0)
  const ganhos = st?.ano === jogo.epoca.ano ? st.ganhos ?? {} : {}
  const ganhosAtrib = st?.ano === jogo.epoca.ano ? st.ganhosAtrib ?? {} : {}
  const treinoAtr = st?.atributo ?? null
  const evoluiram = [...new Set([...Object.keys(ganhos), ...Object.keys(ganhosAtrib)])]
    .map((id) => ({ j: mundo.jogadores[Number(id)], n: ganhos[Number(id)] ?? 0, na: ganhosAtrib[Number(id)] ?? 0 }))
    .filter((x) => x.j && x.j.clubeId === c.id)
    .sort((a, b) => b.n - a.n || b.na - a.na || b.j.forca - a.j.forca)
  const jovens = c.plantel.map((id) => mundo.jogadores[id]).filter((j) => j.idade <= 23).sort((a, b) => a.idade - b.idade || b.forca - a.forca)

  return (
    <div className="staff">
      <p className="nota">A equipa técnica custa <b>{euros(mensal)}</b> por mês ({euros(custoStaffPorJornada(c))} por jornada, já incluído nos salários). Contratar ou trocar faz-se a qualquer altura; quem sai leva 3 meses de indemnização.</p>
      {msg && <p className={msg.ok ? 'msg-ok' : 'erro'} role="status">{msg.texto}</p>}

      <div className="st-grelha">
        {FUNCOES.map((f) => {
          const m = membro(c, f)
          return (
            <section key={f} className="cartao st-cartao" aria-label={NOME_FUNCAO[f]}>
              <h3 className="sub-tit">{NOME_FUNCAO[f]}</h3>
              {m ? (
                <p className="st-pessoa"><b>{m.nome}</b> <Nivel n={m.nivel} /> <span className="st-sal">{euros(m.salario)}/mês</span></p>
              ) : <p className="st-pessoa st-vazio">Ninguém nesta função</p>}
              <p className="nota st-efeito">{EFEITO_FUNCAO[f]}</p>
              <div className="ob-opcoes">
                <button className="botao" onClick={() => { setAbrir(abrir === f ? null : f); setMsg(null) }}>{m ? 'Trocar' : 'Contratar'}</button>
                {m && (
                  <button className="botao" onClick={() => feito(despedirStaff(mundo, c.id, f))}>Despedir ({euros(indemnizacao(m))})</button>
                )}
              </div>
              {abrir === f && (
                <ul className="st-candidatos">
                  {candidatos(mundo, c.id, f).map((k) => {
                    const custo = m ? indemnizacao(m) : 0
                    return (
                      <li key={k.id}>
                        <span className="st-cand-nome">{k.nome}</span>
                        <Nivel n={k.nivel} />
                        <span className="st-sal">{euros(k.salario)}/mês</span>
                        <button className="botao principal" disabled={c.dinheiro < custo} onClick={() => feito(contratarStaff(mundo, c.id, k))}>Contratar</button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })}
      </div>

      <section className="cartao st-treino" aria-label="Treino">
        <h3 className="sub-tit">Treino</h3>
        <p className="nota">Todas as semanas, quem não está lesionado pode ganhar força até ao seu potencial. Os jovens evoluem mais, a partir dos 30 anos já ninguém evolui. Um bom adjunto (e um bom treinador de guarda-redes) acelera tudo.</p>
        <div className="ob-opcoes" role="radiogroup" aria-label="Foco do treino">
          {FOCOS.map((k) => (
            <button key={k} role="radio" aria-checked={foco === k} className={`botao ${foco === k ? 'sel' : ''}`} onClick={() => { mudarFoco(mundo, c.id, k); atualizar(jogo) }}>
              {NOME_FOCO[k]}
            </button>
          ))}
        </div>
        <p className="nota">{DICA_FOCO[foco] ?? `Os ${NOME_FOCO[foco as Posicao].toLowerCase()} evoluem mais depressa; os outros um pouco menos.`}</p>
        <h4 className="st-sub">Treino específico</h4>
        <p className="nota">Escolhe um atributo para todo o plantel trabalhar mais. Sobe aos poucos todas as semanas (até nos veteranos) e muito mais em quem ganha força. A força geral não muda por isso: o jogador fica mais especialista.</p>
        <div className="ob-opcoes" role="radiogroup" aria-label="Treino específico">
          <button role="radio" aria-checked={treinoAtr == null} className={`botao ${treinoAtr == null ? 'sel' : ''}`} onClick={() => { mudarTreinoAtributo(mundo, c.id, null); atualizar(jogo) }}>Nenhum</button>
          {ATRIBUTOS.map((a) => (
            <button key={a} role="radio" aria-checked={treinoAtr === a} className={`botao ${treinoAtr === a ? 'sel' : ''}`} onClick={() => { mudarTreinoAtributo(mundo, c.id, a); atualizar(jogo) }}>
              {NOME_ATRIBUTO[a]}
            </button>
          ))}
        </div>
        {treinoAtr && <p className="nota">{NOME_ATRIBUTO[treinoAtr]}: {DICA_ATRIBUTO[treinoAtr].toLowerCase()} {POSICOES.every((p) => PESOS[p][treinoAtr]) ? 'Treinam-no todos.' : `Treinam-no só os ${POSICOES.filter((p) => PESOS[p][treinoAtr]).map((p) => NOME_POS[p]).join(' e os ')}.`}</p>}
        <h4 className="st-sub">Evolução no treino nesta época</h4>
        {evoluiram.length === 0 ? <p className="nota">Ainda ninguém evoluiu nesta época.</p> : (
          <ul className="st-evol">
            {evoluiram.map(({ j, n, na }) => (
              <li key={j.id}>
                <span className={`pos pos-${j.posicao}`}>{j.posicao}</span> {j.curto}
                {n > 0 && <span className="st-mais">+{n}</span>}
                {na > 0 && treinoAtr && <span className="st-mais st-atr" title={`Pontos ganhos em ${NOME_ATRIBUTO[treinoAtr].toLowerCase()} no treino específico`}>{NOME_ATRIBUTO[treinoAtr].slice(0, 3)}. +{na} ({atributo(j, treinoAtr)})</span>}
                <Forca valor={j.forca} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="cartao st-treino" aria-label="Potencial dos jovens">
        <h3 className="sub-tit">Potencial dos jovens (até 23 anos)</h3>
        <p className="nota">É a estimativa do teu olheiro: quanto melhor ele for, mais estreito e certo é o intervalo. Sem olheiro, é quase um palpite.</p>
        {jovens.length === 0 ? <p className="nota">Não há jovens no plantel.</p> : (
          <div className="tabela-wrap">
            <table className="tabela">
              <thead><tr><th>Pos</th><th>Nome</th><th className="num">Idade</th><th>Força</th><th>Potencial</th></tr></thead>
              <tbody>
                {jovens.map((j) => {
                  const e = estimativaPotencial(mundo, c.id, j)
                  return (
                    <tr key={j.id}>
                      <td><span className={`pos pos-${j.posicao}`}>{j.posicao}</span></td>
                      <td>{j.curto}</td>
                      <td className="num">{j.idade}</td>
                      <td><Forca valor={j.forca} /></td>
                      <td><b className={`pot pot-${e.texto}`}>{e.texto}</b> <span className="st-sal st-int">{e.min === e.max ? e.min : `${e.min}–${e.max}`}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
