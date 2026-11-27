// Separador Staff: equipa técnica (contratar, trocar, despedir), foco do treino e evolução da época.
import { useEffect, useState } from 'react'
import type { Jogo, Posicao } from '../core/types'
import { euros } from '../core/formato'
import {
  EFEITO_FUNCAO, FOCOS, FUNCOES, NIVEL_MAX, NOME_FOCO, NOME_FUNCAO, candidatos, contratarStaff, custoStaffPorJornada,
  despedirStaff, estimativaPotencial, indemnizacao, membro, mudarFoco, mudarTreinoAtributo, staffDe, type Funcao, type Resultado,
  FUNCOES_SETOR, INTENSIDADES, NOME_INTENSIDADE, DICA_INTENSIDADE, mudarIntensidade, intensidadeDe, definirPlano, PLANOS_MAX,
  ritmoPosicao, type PlanoIndividual, type Regiao,
} from '../core/staff'
import {
  DICA_REGIAO, NOME_REGIAO, REGIOES, chanceDescoberta, contratarTalento, definirMissao, descobertas, dispensarTalento, marcarVistas, ESPERA,
} from '../core/olheiro'
import { aprendido, posicoesExtra } from '../core/polivalencia'
import { nivelDe } from '../core/staff'
import { Forca } from './Plantel'
import { ATRIBUTOS, DICA_ATRIBUTO, NOME_ATRIBUTO, PESOS, atributo, type Atributo } from '../core/atributos'
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
  // Talentos novos: guardados na primeira vista para o destaque, e marcados como vistos.
  const [novas] = useState(() => new Set(descobertas(mundo, jogo.clubeId).filter((d) => d.nova).map((d) => d.j.id)))
  useEffect(() => { if (marcarVistas(mundo, jogo.clubeId)) atualizar(jogo) }, [])
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

      {[FUNCOES.filter((f) => !(FUNCOES_SETOR as readonly string[]).includes(f)), [...FUNCOES_SETOR]].map((grupo, gi) => (
      <div key={gi} className="st-bloco">
      {gi === 1 && <><h3 className="sub-tit st-sub">Treinadores de setor (opcionais)</h3><p className="nota">Ajudam o adjunto com uma posição: os jogadores dela evoluem mais depressa e, quando sobem, ficam melhores no que a posição mais pede. Ganham menos do que um adjunto.</p></>}
      <div className="st-grelha">
        {grupo.map((f) => {
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
      </div>
      ))}

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
        <h4 className="st-sub">Intensidade</h4>
        <div className="ob-opcoes" role="radiogroup" aria-label="Intensidade do treino">
          {INTENSIDADES.map((k) => (
            <button key={k} role="radio" aria-checked={intensidadeDe(c) === k} className={`botao ${intensidadeDe(c) === k ? 'sel' : ''}`} onClick={() => { mudarIntensidade(mundo, c.id, k); atualizar(jogo) }}>
              {NOME_INTENSIDADE[k]}
            </button>
          ))}
        </div>
        <p className="nota">{DICA_INTENSIDADE[intensidadeDe(c)]}</p>
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
                {na > 0 && (() => {
                  const pl = st?.planos?.[j.id]
                  const a = pl?.tipo === 'atributo' ? pl.atributo : treinoAtr
                  return a && <span className="st-mais st-atr" title={`Pontos ganhos em ${NOME_ATRIBUTO[a].toLowerCase()} no treino`}>{NOME_ATRIBUTO[a].slice(0, 3)}. +{na} ({atributo(j, a)})</span>
                })()}
                <Forca valor={j.forca} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <TreinoIndividual jogo={jogo} feito={feito} />
      <Prospecao jogo={jogo} feito={feito} novas={novas} />

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

const NOME_POS_UM: Record<Posicao, string> = { GR: 'guarda-redes', DEF: 'defesa', MED: 'médio', AV: 'avançado' }

function TreinoIndividual({ jogo, feito }: { jogo: Jogo; feito: (r: Resultado) => void }) {
  const { mundo } = jogo
  const c = mundo.clubes[jogo.clubeId]
  const planos = staffDe(c)?.planos ?? {}
  const plantel = c.plantel.map((id) => mundo.jogadores[id]).filter(Boolean).sort((a, b) => POSICOES.indexOf(a.posicao) - POSICOES.indexOf(b.posicao) || b.forca - a.forca)
  const livres = plantel.filter((j) => !planos[j.id])
  const [quem, setQuem] = useState<number | ''>('')
  const [oque, setOque] = useState('')
  const j = quem === '' ? undefined : mundo.jogadores[quem]
  const opcoes: [string, string][] = j ? [
    ...ATRIBUTOS.filter((a) => PESOS[j.posicao][a]).map((a) => [`a:${a}`, `Atributo: ${NOME_ATRIBUTO[a].toLowerCase()}`] as [string, string]),
    ...(j.posicao === 'GR' ? [] : POSICOES.filter((p) => p !== 'GR' && p !== j.posicao && aprendido(j, p) < 100)
      .map((p) => [`p:${p}`, `Aprender a jogar a ${NOME_POS_UM[p]}`] as [string, string])),
  ] : []
  const escolhido = opcoes.some(([k]) => k === oque) ? oque : opcoes[0]?.[0] ?? ''
  const adicionar = () => {
    if (!j || !escolhido) return
    const [t, v] = escolhido.split(':')
    const plano: PlanoIndividual = t === 'a' ? { tipo: 'atributo', atributo: v as Atributo } : { tipo: 'posicao', posicao: v as Posicao }
    feito(definirPlano(mundo, c.id, j.id, plano))
    setQuem('')
  }
  const polis = plantel.filter((x) => posicoesExtra(x, 1).length > 0 && !planos[x.id])
  return (
    <section className="cartao st-treino" aria-label="Treino individual">
      <h3 className="sub-tit">Treino individual</h3>
      <p className="nota">Até {PLANOS_MAX} jogadores com um plano só deles: puxar um atributo (sobe bem mais depressa do que no treino específico) ou aprender uma posição nova. Quem aprende uma posição rende quase como lá jogasse desde sempre (fora da posição, sem treino, vale cerca de 74%; aprendida, 94%). Bom para mexer na tática sem perder o jogador.</p>
      {Object.keys(planos).length > 0 && (
        <ul className="st-planos">
          {Object.entries(planos).map(([id, p]) => {
            const x = mundo.jogadores[Number(id)]
            if (!x) return null
            const prog = p.tipo === 'posicao' ? aprendido(x, p.posicao) : 0
            const semanas = p.tipo === 'posicao' ? Math.ceil((100 - prog) / Math.max(0.1, ritmoPosicao(c, x, p.posicao))) : 0
            return (
              <li key={id}>
                <span className={`pos pos-${x.posicao}`}>{x.posicao}</span>
                <span className="st-cand-nome">{x.curto}</span>
                {p.tipo === 'posicao' ? (
                  <span className="st-plano">A aprender {NOME_POS_UM[p.posicao]}: <b>{Math.floor(prog)}%</b> <span className="st-barra" aria-hidden="true"><span style={{ width: `${prog}%` }} /></span> <span className="st-sal">cerca de {semanas} {semanas === 1 ? 'semana' : 'semanas'}</span></span>
                ) : (
                  <span className="st-plano">{NOME_ATRIBUTO[p.atributo]}: <b>{atributo(x, p.atributo)}</b></span>
                )}
                <button className="botao" onClick={() => feito(definirPlano(mundo, c.id, x.id, null))}>Parar</button>
              </li>
            )
          })}
        </ul>
      )}
      {Object.keys(planos).length < PLANOS_MAX && (
        <div className="st-novo-plano">
          <select aria-label="Jogador" value={quem} onChange={(e) => { setQuem(e.target.value === '' ? '' : Number(e.target.value)); setOque('') }}>
            <option value="">Escolhe um jogador…</option>
            {livres.map((x) => <option key={x.id} value={x.id}>{x.posicao} · {x.curto} ({x.forca})</option>)}
          </select>
          {j && (
            <select aria-label="Plano" value={escolhido} onChange={(e) => setOque(e.target.value)}>
              {opcoes.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select>
          )}
          <button className="botao principal" disabled={!j || !escolhido} onClick={adicionar}>Começar</button>
        </div>
      )}
      {polis.length > 0 && (
        <>
          <h4 className="st-sub">Polivalentes</h4>
          <ul className="st-evol">
            {polis.map((x) => (
              <li key={x.id}>
                <span className={`pos pos-${x.posicao}`}>{x.posicao}</span> {x.curto}
                <span className="st-sal">{posicoesExtra(x, 1).map((p) => `${p} ${Math.floor(aprendido(x, p))}%`).join(' · ')}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function Prospecao({ jogo, feito, novas }: { jogo: Jogo; feito: (r: Resultado) => void; novas: Set<number> }) {
  const { mundo } = jogo
  const c = mundo.clubes[jogo.clubeId]
  const missao = staffDe(c)?.missao
  const nivel = nivelDe(c, 'olheiro')
  const lista = descobertas(mundo, c.id)
  const [, refrescar] = useState(0)
  const mudar = (regiao: Regiao | null, posicao: Posicao | 'qualquer' = missao?.posicao ?? 'qualquer') => {
    definirMissao(mundo, c.id, regiao, posicao)
    refrescar((n) => n + 1)
    feito({ ok: true, texto: regiao ? `O olheiro parte em missão: ${NOME_REGIAO[regiao].toLowerCase()}${posicao === 'qualquer' ? '' : `, à procura de um ${NOME_POS_UM[posicao]}`}.` : 'O olheiro fica em casa.' })
  }
  const porJornada = Math.round(chanceDescoberta(nivel) * 100)
  return (
    <section className="cartao st-treino" aria-label="Prospeção">
      <h3 className="sub-tit">Prospeção do olheiro</h3>
      {nivel === 0 ? <p className="nota">Contrata um olheiro para o mandar à procura de talentos jovens (16 a 20 anos) fora do campeonato.</p> : (
        <>
          <p className="nota">Escolhe para onde vai o olheiro. Em cada jornada tem cerca de {porJornada}% de hipóteses de encontrar um talento; quanto melhor ele for, mais vezes encontra e mais alto é o teto de quem encontra. Cada talento fica à espera {ESPERA} jornadas e depois outro clube leva-o. Pode-se contratar a qualquer altura, pagando a compensação ao clube de formação.</p>
          <div className="ob-opcoes" role="radiogroup" aria-label="Região da missão">
            <button role="radio" aria-checked={!missao} className={`botao ${!missao ? 'sel' : ''}`} onClick={() => mudar(null)}>Em casa</button>
            {REGIOES.map((r) => (
              <button key={r} role="radio" aria-checked={missao?.regiao === r} className={`botao ${missao?.regiao === r ? 'sel' : ''}`} onClick={() => mudar(r)}>{NOME_REGIAO[r]}</button>
            ))}
          </div>
          {missao && (
            <>
              <p className="nota">{DICA_REGIAO[missao.regiao]}</p>
              <div className="ob-opcoes" role="radiogroup" aria-label="Posição procurada">
                {(['qualquer', ...POSICOES] as const).map((p) => (
                  <button key={p} role="radio" aria-checked={missao.posicao === p} className={`botao ${missao.posicao === p ? 'sel' : ''}`} onClick={() => mudar(missao.regiao, p)}>{p === 'qualquer' ? 'Qualquer posição' : NOME_POS[p][0].toUpperCase() + NOME_POS[p].slice(1)}</button>
                ))}
              </div>
            </>
          )}
        </>
      )}
      <h4 className="st-sub">Talentos encontrados</h4>
      {lista.length === 0 ? <p className="nota">{missao ? 'Ainda nada. O olheiro manda notícias depois das jornadas.' : 'Nenhum de momento.'}</p> : (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead><tr><th>Pos</th><th>Nome</th><th className="num">Idade</th><th>Força</th><th>Potencial</th><th className="num">Compensação</th><th /></tr></thead>
            <tbody>
              {lista.map((d, i) => {
                const e = estimativaPotencial(mundo, c.id, d.j)
                const faltam = d.ate - jogo.epoca.jornada + 1
                return (
                  <tr key={d.j.id} className={novas.has(d.j.id) ? 'st-nova' : ''}>
                    <td><span className={`pos pos-${d.j.posicao}`}>{d.j.posicao}</span></td>
                    <td>{d.j.nome} <span className="st-sal">{d.j.nacionalidade}{novas.has(d.j.id) ? ' · novo' : ''} · {faltam <= 1 ? 'última jornada' : `${faltam} jornadas`}</span></td>
                    <td className="num">{d.j.idade}</td>
                    <td><Forca valor={d.j.forca} /></td>
                    <td><b className={`pot pot-${e.texto}`}>{e.texto}</b> <span className="st-sal st-int">{e.min === e.max ? e.min : `${e.min}–${e.max}`}</span></td>
                    <td className="num">{euros(d.preco)}</td>
                    <td className="st-acoes">
                      <button className="botao principal" disabled={c.dinheiro < d.preco} onClick={() => feito(contratarTalento(mundo, c.id, i))}>Contratar</button>
                      <button className="botao" onClick={() => { dispensarTalento(mundo, c.id, i); feito({ ok: true, texto: `${d.j.curto} sai da lista.` }) }}>Esquecer</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
