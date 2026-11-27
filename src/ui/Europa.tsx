// Competições europeias: separador com grupos, eliminatórias, notícias e vencedores, e o dia europeu ao vivo.
import { etiquetaDivisao } from '../core/ligas'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Jogo, Mundo } from '../core/types'
import type { Lado, Partida } from '../core/partida'
import { definirAutoSub, iniciarJogo, notasDoJogo, type EstadoJogo } from '../core/motor'
import { MelhorEmCampo, NotasEquipa } from './Nota'
import { depoisDoMinuto, novaRondaViva, passoRonda, rondaAcabou, saltarRonda, terminouVivo, type PausaVivo } from '../core/ao-vivo'
import { useMonitor2D } from './Monitor2D'
import { euros } from '../core/formato'
import { tabela } from '../core/epoca'
import { prolongar, textoResultado } from '../core/taca'
import {
  COMPETICOES, ORDEM_COMPS, agregado, compDoClube, escalacaoEuropa, garantirEuropa, idaDe, indisponiveisEuropa, jogarDiaEuropa, letraGrupo,
  minhaSituacaoEuropa, mundoEuropa, paisDe, precisaProlongEuropa, tabelaGrupo, vencedorEuropa,
  type CompEuropa, type IdComp, type JogoComEuropa, type RondaEuropa,
} from '../core/europa'
import type { OutroJogo } from './PreJogo'
import { Emblema } from './Emblema'
import { PainelSubs } from './AoVivo'
import { LayoutVivo } from './LayoutVivo'
import { SaltarJogo, sementeJornada } from './comum'
import './taca.css'
import './europa.css'

const MS_MINUTO = 450
type FaseVivo = PausaVivo | 'jogo' | 'resumo' | 'repeticao'

function Nome({ jogo, m, id, sigla = false }: { jogo: JogoComEuropa; m: Mundo; id: number; sigla?: boolean }) {
  const c = m.clubes[id]
  if (!c) return <span>?</span>
  const pais = paisDe(jogo, id)
  return (
    <span className="clube-linha">
      <Emblema clube={c} tamanho={18} />
      {sigla ? c.sigla : <><span className="nm-longo">{c.nome}</span><span className="nm-sigla">{c.sigla}</span></>}
      <span className={`div-tag ${pais ? '' : 'eu-nac'}`}>{pais ?? etiquetaDivisao(jogo.mundo, c.divisao)}</span>
    </span>
  )
}

function JogoEu({ jogo, m, p, ida, meuId }: { jogo: JogoComEuropa; m: Mundo; p: Partida; ida?: Partida; meuId: number }) {
  const ko = !!ida || p.id.includes('-F-')
  const v = p.jogada && ko ? vencedorEuropa(p, ida) : null
  const meu = p.casaId === meuId || p.foraId === meuId
  const extra = p.penaltis ? `${p.penaltis[0]}-${p.penaltis[1]} gp` : ida && p.jogada ? `(${agregado(p, ida).join('-')})` : p.prolongamento ? 'a.p.' : ''
  return (
    <li className={`placar taca-jogo ${meu ? 'meu' : ''}`}>
      <span className={`pl-casa ${v === p.casaId ? 'passa' : ''}`}><Nome jogo={jogo} m={m} id={p.casaId} /></span>
      <span className="pl-golos">{p.jogada ? `${p.golos[0]}-${p.golos[1]}` : 'vs'}</span>
      <span className={`pl-fora ${v === p.foraId ? 'passa' : ''}`}><Nome jogo={jogo} m={m} id={p.foraId} /></span>
      <span className="pl-min">{extra}</span>
    </li>
  )
}

function Grupo({ jogo, m, comp, g }: { jogo: JogoComEuropa; m: Mundo; comp: CompEuropa; g: number }) {
  const linhas = tabelaGrupo(comp, g)
  return (
    <div className="eu-grupo">
      <h4>Grupo {letraGrupo(g)}</h4>
      <table className="tabela compacta">
        <thead><tr><th>Clube</th><th className="num">J</th><th className="num">DG</th><th className="num">Pts</th></tr></thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={l.clubeId} className={`${i < 2 ? 'sobe' : ''} ${l.clubeId === jogo.clubeId ? 'meu' : ''}`}>
              <td><Nome jogo={jogo} m={m} id={l.clubeId} sigla /></td>
              <td className="num">{l.j}</td>
              <td className="num">{l.gm - l.gs > 0 ? '+' : ''}{l.gm - l.gs}</td>
              <td className="num pts">{l.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

type Fase = 'grupos' | 'quartos' | 'meias' | 'final'
const FASE_RONDAS: Record<Fase, number[]> = { grupos: [0, 1, 2, 3, 4, 5], quartos: [6, 7], meias: [8, 9], final: [10] }

function faseAtual(dia: number): Fase {
  return dia <= 5 ? 'grupos' : dia <= 7 ? 'quartos' : dia <= 9 ? 'meias' : 'final'
}

/** Separador Europa. */
export function EuropaSeparador({ jogo }: { jogo: JogoComEuropa }) {
  const e = garantirEuropa(jogo)
  const m = useMemo(() => mundoEuropa(jogo), [jogo, e])
  const minha = compDoClube(e, jogo.clubeId)
  const [compId, setComp] = useState<IdComp>(minha?.id ?? 'liga')
  const [fase, setFase] = useState<Fase>(faseAtual(Math.min(e.dia, 10)))
  const [jornada, setJornada] = useState(e.dia === 0 ? 0 : Math.min(5, e.dia - 1))
  const comp = e.comps.find((c) => c.id === compId)
  const info = COMPETICOES[compId]
  const ganho = e.receitas[jogo.clubeId] ?? 0
  const noticias = [...e.noticias].reverse().slice(0, 15)
  const marc = Object.entries(e.marcadores)
    .map(([id, g]) => ({ id: Number(id), g }))
    .filter((x) => comp?.clubes.includes(m.jogadores[x.id]?.clubeId ?? -1))
    .sort((a, b) => b.g - a.g).slice(0, 5)

  return (
    <div className="taca europa">
      <div className="cartao destaque taca-cab">
        <div className="pj-cab">Europa {e.ano}/{String(e.ano + 1).slice(2)}</div>
        <h2>{minhaSituacaoEuropa(jogo)}</h2>
        {ganho > 0 && <p className="dica">Já ganhaste {euros(ganho)} na Europa (prémios e bilheteira).</p>}
        <p className="dica">Jogos a meio da semana, sem salários. Grupos de 4 a duas voltas, quartos e meias a duas mãos, final em campo neutro. Empate no conjunto dá prolongamento e penáltis.</p>
      </div>

      {!e.semEuropa && comp && (
        <>
          <nav className="separadores" aria-label="Competições europeias">
            {ORDEM_COMPS.map((id) => (
              <button key={id} className={`${compId === id ? 'ativo' : ''} ${minha?.id === id ? 'tem-meu' : ''}`} onClick={() => setComp(id)}>{COMPETICOES[id].nome}</button>
            ))}
          </nav>
          <nav className="separadores taca-rondas" aria-label="Fases">
            {(['grupos', 'quartos', 'meias', 'final'] as Fase[]).map((f) => (
              <button key={f} className={fase === f ? 'ativo' : ''} disabled={!comp.rondas[FASE_RONDAS[f][0]].jogos.length} onClick={() => setFase(f)}>
                {{ grupos: 'Grupos', quartos: 'Quartos', meias: 'Meias', final: 'Final' }[f]}
              </button>
            ))}
          </nav>

          {fase === 'grupos' && (
            <>
              <div className="eu-grupos">{comp.grupos.map((_, g) => <Grupo key={g} jogo={jogo} m={m} comp={comp} g={g} />)}</div>
              <div className="cartao placares">
                <h3 className="sub-tit">
                  <span className="eu-nav">
                    <button className="botao" aria-label="Jornada anterior" disabled={jornada === 0} onClick={() => setJornada(jornada - 1)}>‹</button>
                    {comp.rondas[jornada].nome} · {comp.rondas[jornada].jogada ? 'jogada' : `depois da ${e.datas[jornada]}.ª jornada`}
                    <button className="botao" aria-label="Jornada seguinte" disabled={jornada === 5} onClick={() => setJornada(jornada + 1)}>›</button>
                  </span>
                </h3>
                <ul>{comp.rondas[jornada].jogos.map((p) => <JogoEu key={p.id} jogo={jogo} m={m} p={p} meuId={jogo.clubeId} />)}</ul>
                <p className="dica">Passam os 2 primeiros de cada grupo. Vitória {euros(info.premios.vitoria)}, empate {euros(info.premios.empate)}.</p>
              </div>
            </>
          )}
          {fase !== 'grupos' && (
            <div className="cartao placares">
              {FASE_RONDAS[fase].map((d) => {
                const r: RondaEuropa = comp.rondas[d]
                return (
                  <div key={d}>
                    <h3 className="sub-tit">{r.nome} · {r.jogada ? 'jogada' : `depois da ${e.datas[d]}.ª jornada`}{r.fase === 'final' ? ' · campo neutro' : ''}</h3>
                    <ul>{r.jogos.map((p) => <JogoEu key={p.id} jogo={jogo} m={m} p={p} ida={idaDe(comp, d, p)} meuId={jogo.clubeId} />)}</ul>
                  </div>
                )
              })}
              <p className="dica">
                Prémios: {fase === 'quartos' ? `${euros(info.premios.quartos)} por chegar aos quartos` : fase === 'meias' ? `${euros(info.premios.meias)} por chegar às meias` : `${euros(info.premios.final)} por chegar à final, mais ${euros(info.premios.vencedor)} ao vencedor`}.
              </p>
            </div>
          )}
        </>
      )}

      <div className="taca-grelha">
        <div className="cartao">
          <h3 className="sub-tit">Notícias da Europa</h3>
          {noticias.length === 0 ? <p className="dica">Ainda sem notícias.</p> : (
            <ul className="noticias taca-noticias">{noticias.map((n, i) => <li key={i} className={n.minha ? 'minha' : ''}>{n.texto}</li>)}</ul>
          )}
          <Apuramento jogo={jogo} />
        </div>
        <div className="cartao">
          {comp && <>
            <h3 className="sub-tit">Marcadores · {info.nome}</h3>
            {marc.length === 0 ? <p className="dica">Ainda ninguém marcou.</p> : (
              <ol className="taca-marc">{marc.map((x) => <li key={x.id}>{m.jogadores[x.id]?.curto ?? '?'} <span className="dica">{m.clubes[m.jogadores[x.id]?.clubeId]?.sigla ?? ''}</span> <b>{x.g}</b></li>)}</ol>
            )}
          </>}
          {ORDEM_COMPS.map((id) => {
            const h = e.historico.filter((x) => x.comp === id)
            return (
              <div key={id}>
                <h3 className="sub-tit">Vencedores · {COMPETICOES[id].nome}</h3>
                {h.length === 0 ? <p className="dica">A primeira final ainda está por jogar.</p> : (
                  <ul className="taca-hist">{[...h].reverse().slice(0, 10).map((x) => (
                    <li key={`${x.ano}-${id}`} className={x.vencedorId === jogo.clubeId ? 'meu' : ''}>
                      <span className="dica">{x.ano}/{String(x.ano + 1).slice(2)}</span> <b className={x.pais ? '' : 'eu-nosso'}>{x.vencedor}</b> {x.resultado} {x.finalista}
                    </li>
                  ))}</ul>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** Quem vai à Europa na próxima época (ou quem iria, se a época acabasse hoje). */
function Apuramento({ jogo }: { jogo: JogoComEuropa }) {
  const { mundo } = jogo
  const e = jogo.europa
  const q = e?.qualificados?.ano === jogo.epoca.ano ? e.qualificados : null
  const linhas = q ? null : tabela(mundo, jogo.epoca, 1).slice(0, 5).map((l) => l.clubeId)
  const nomes = (ids: number[]) => ids.map((id) => mundo.clubes[id]?.nome ?? '?').join(', ')
  return (
    <>
      <h3 className="sub-tit">Apuramento</h3>
      <p className="dica">{COMPETICOES.liga.nome}: 1.º e 2.º da 1.ª Divisão. {COMPETICOES.taca.nome}: 3.º, 4.º e o vencedor da Taça Nacional (se já estiver apurado, vai o 5.º).</p>
      {q && <p className="dica">Próxima época: {COMPETICOES.liga.nome} {nomes(q.liga)}; {COMPETICOES.taca.nome} {nomes(q.taca)}.</p>}
      {linhas && jogo.epoca.jornada > 1 && <p className="dica">Se a época acabasse hoje: {COMPETICOES.liga.nome} {nomes(linhas.slice(0, 2))}; {COMPETICOES.taca.nome} {nomes(linhas.slice(2))}.</p>}
    </>
  )
}

/** Cartão no separador Jogo quando o próximo jogo é europeu. */
export function avisoEuropa(jogo: JogoComEuropa, comp: CompEuropa, ronda: RondaEuropa, p: Partida, dia: number): OutroJogo {
  const info = COMPETICOES[comp.id]
  const onde = ronda.fase === 'final' ? 'campo neutro' : p.casaId === jogo.clubeId ? 'em casa' : 'fora'
  const ida = idaDe(comp, dia, p)
  const ag = ida ? ` · 1.ª mão ${ida.golos[1]}-${ida.golos[0]}` : ''
  return { titulo: `${info.nome} · ${ronda.nome} · ${onde}${ag}`, indisp: indisponiveisEuropa(jogo, jogo.clubeId), partida: p, indispAdv: indisponiveisEuropa(jogo, p.casaId === jogo.clubeId ? p.foraId : p.casaId), botao: 'Jogar na Europa' }
}

interface EstadoEu { e: EstadoJogo; comp: CompEuropa; ida?: Partida; final: boolean }

/** Dia europeu ao vivo: o meu jogo com relato e substituições, os outros (das duas provas) no quadro. */
export function AoVivoEuropa({ jogo, guardar, continuar }: { jogo: JogoComEuropa; guardar: () => void; continuar: () => void }) {
  const { clubeId } = jogo
  const eu = garantirEuropa(jogo)
  const [dia] = useState(eu.dia)
  const [m] = useState(() => mundoEuropa(jogo))
  const [ini] = useState(() => {
    const semente = sementeJornada(jogo, 8000 + dia)
    const lista: EstadoEu[] = []
    eu.comps.forEach((comp, ci) => {
      const r = comp.rondas[dia]
      if (!r || r.jogada) return
      r.jogos.forEach((p, i) => {
        const escDe = (id: number) => {
          if (id === clubeId) {
            const ind = indisponiveisEuropa(jogo, id)
            return { ...jogo.escalacao, suplentes: jogo.escalacao.suplentes.filter((s) => !ind.has(s)) }
          }
          return escalacaoEuropa(jogo, m, p, id)
        }
        lista.push({ e: iniciarJogo(m, p, escDe(p.casaId), escDe(p.foraId), (semente + ci * 104729 + i * 7919) >>> 0), comp, ida: idaDe(comp, dia, p), final: r.fase === 'final' })
      })
    })
    const mi = lista.findIndex((x) => x.e.partida.casaId === clubeId || x.e.partida.foraId === clubeId)
    if (mi > 0) lista.unshift(...lista.splice(mi, 1))
    if (lista[0]) definirAutoSub(lista[0].e, lista[0].e.partida.casaId === clubeId ? 'casa' : 'fora', false)
    return lista
  })
  const meu = ini[0]
  const [rv] = useState(() => novaRondaViva(ini.map((x) => x.e), clubeId, (e, i) => {
    const x = ini[i]
    if (!precisaProlongEuropa(e.partida, x.ida, x.final)) return false
    prolongar(e)
    return true
  }))
  const meuLado: Lado = rv.meuLado
  const [fase, setFase] = useState<FaseVivo>('jogo')
  const [vel, setVel] = useState(1)
  const [, setTick] = useState(0)
  const concluido = useRef(false)
  const [lesionado, setLesionado] = useState<number | null>(null)
  const [resumo, setResumo] = useState<{ minha: Partida; premio: number } | null>(null)
  const terminou = (x: EstadoEu) => terminouVivo(rv, x.e)
  const jogoVista = useMemo(() => ({ ...jogo, mundo: m }), [jogo, m])
  const mon = useMonitor2D({
    mundo: m, meu: meu.e, casa: m.clubes[meu.e.partida.casaId], fora: m.clubes[meu.e.partida.foraId],
    semente: (x) => sementeJornada(jogo, 8100 + dia * 1000 + x),
    voltar: (f) => setFase((f as FaseVivo | null) ?? 'jogo'),
  })

  const passo = (): FaseVivo | null => {
    const r = passoRonda(m, rv, mon.aoEvento)
    if (r.pausa === 'lesao') setLesionado(r.lesionado ?? null)
    return mon.fimDoMinuto(r.pausa)
  }

  const concluir = () => {
    if (concluido.current) return
    mon.revelar()
    concluido.current = true
    const emCampo = (e: EstadoJogo): [number[], number[]] => {
      const fora = new Set(e.fora)
      return [e.escalacoes.casa.titulares.filter((id) => !fora.has(id)), e.escalacoes.fora.titulares.filter((id) => !fora.has(id))]
    }
    const antes = jogo.mundo.clubes[clubeId].dinheiro
    jogarDiaEuropa(jogo, ini.map((x) => ({ partida: { ...x.e.partida, jogada: true, notas: notasDoJogo(x.e) }, emCampo: emCampo(x.e) })))
    guardar()
    const minha = meu.comp.rondas[dia].jogos.find((p) => p.id === meu.e.partida.id) ?? meu.e.partida
    setResumo({ minha, premio: jogo.mundo.clubes[clubeId].dinheiro - antes })
    setFase('resumo')
  }

  useEffect(() => {
    if (fase !== 'jogo') return
    const h = setInterval(() => {
      if (concluido.current) return
      const d = depoisDoMinuto(passo(), rondaAcabou(rv))
      if (d.tipo === 'pausa') { clearInterval(h); setFase(d.pausa); return }
      if (d.tipo === 'fechar') { clearInterval(h); concluir(); return }
      setTick((x) => x + 1)
    }, MS_MINUTO / vel)
    return () => clearInterval(h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, vel])

  const saltar = () => {
    mon.saltar()
    saltarRonda(m, rv)
    setLesionado(null)
    concluir()
  }

  const info = COMPETICOES[meu.comp.id]
  const ronda = meu.comp.rondas[dia]
  if (fase === 'resumo' && resumo) return <ResumoEuropa jogo={jogo} m={m} comp={meu.comp} dia={dia} p={resumo.minha} premio={resumo.premio} continuar={continuar} />

  const mp = meu.e.partida
  const casa = m.clubes[mp.casaId], fora = m.clubes[mp.foraId]
  const feed = [...mp.eventos].filter((ev) => ev !== mon.escondido()).reverse()
  const ag = meu.ida ? agregado(mp, meu.ida) : null
  return (
    <LayoutVivo
      placar={(
        <div className="cartao meu-jogo">
          <div className="pj-cab">{info.nome} · {ronda.nome}</div>
          <div className="mj-min">{terminou(meu) ? 'Final' : fase === 'intervalo' ? 'Intervalo' : `${meu.e.minuto}'${mp.prolongamento ? ' · prolongamento' : ''}`}</div>
          <div className="mj-placar">
            <div className="mj-eq"><Emblema clube={casa} tamanho={40} /><span>{casa.nome}</span></div>
            <div className="mj-golos">{mp.golos[0]}<span>-</span>{mp.golos[1]}</div>
            <div className="mj-eq"><Emblema clube={fora} tamanho={40} /><span>{fora.nome}</span></div>
          </div>
          {ag && <p className="dica">No conjunto das duas mãos: {ag[0]}-{ag[1]}</p>}
          {terminou(meu) && (meu.final ? mp.golos[0] === mp.golos[1] : ag && ag[0] === ag[1]) && <p className="dica">Empate depois do prolongamento: decide-se nos penáltis.</p>}
        </div>
      )}
      controlos={<>
        <div className="controlos">
          {[1, 2, 4].map((v) => <button key={v} className={`botao ${vel === v ? 'ativo' : ''}`} onClick={() => setVel(v)}>{v}x</button>)}
          <button className="botao" disabled={fase !== 'jogo'} onClick={() => setFase('pausa')}>Pausa</button>
          {mon.botaoModo}
        </div>
        <SaltarJogo saltar={saltar} />
      </>}
      palco={mon.campo({ repeticao: fase === 'repeticao', acabou: terminou(meu), vel })}
      painel={(fase === 'intervalo' || fase === 'lesao' || fase === 'pausa') ? (
          <PainelSubs jogo={jogoVista} estado={meu.e} lado={meuLado} fase={fase} lesionado={lesionado}
            retomar={() => { setLesionado(null); setFase('jogo') }} atualizar={() => setTick((x) => x + 1)} />
        ) : undefined}
      relato={<>
          {feed.length === 0 && <p className="dica">O árbitro apita para o início.</p>}
          <ul>{feed.map((ev, i) => <li key={feed.length - i} className={`ev ev-${ev.tipo} ${ev.lado === meuLado ? 'nosso' : ''}`}><span className="ev-min">{ev.minuto}'</span> {ev.texto}</li>)}</ul>
      </>}
      notas={<NotasEquipa mundo={jogoVista.mundo} partida={mp} lado={meuLado} estado={meu.e} />}
      tituloJogos="Noite europeia · outros jogos"
      jogos={<ul>
            {ini.slice(1).map((x) => {
              const p = x.e.partida
              return (
                <li key={p.id} className={`placar ${jogo.mundo.clubes[p.casaId] || jogo.mundo.clubes[p.foraId] ? 'eu-nacional' : ''}`}>
                  <span className="pl-casa"><span className="nm-longo">{m.clubes[p.casaId].nome}</span><span className="nm-sigla">{m.clubes[p.casaId].sigla}</span></span>
                  <span className="pl-golos">{p.golos[0]}-{p.golos[1]}</span>
                  <span className="pl-fora"><span className="nm-longo">{m.clubes[p.foraId].nome}</span><span className="nm-sigla">{m.clubes[p.foraId].sigla}</span></span>
                  <span className="pl-min">{terminou(x) ? 'F' : `${x.e.minuto}'`}</span>
                </li>
              )
            })}
          </ul>}
    />
  )
}

function ResumoEuropa({ jogo, m, comp, dia, p, premio, continuar }: { jogo: JogoComEuropa; m: Mundo; comp: CompEuropa; dia: number; p: Partida; premio: number; continuar: () => void }) {
  const { clubeId } = jogo
  const info = COMPETICOES[comp.id]
  const r = comp.rondas[dia]
  const ida = idaDe(comp, dia, p)
  const ko = r.fase === 'volta' || r.fase === 'final'
  const passou = ko ? vencedorEuropa(p, ida) === clubeId : false
  const [a, b] = p.casaId === clubeId ? p.golos : [p.golos[1], p.golos[0]]
  const res = a > b ? 'V' : a < b ? 'D' : 'E'
  const titulo = r.fase === 'final' ? (passou ? `Vencedores da ${info.nome}!` : 'Finalista vencido') : ko ? (passou ? 'Passamos a eliminatória!' : `Eliminados da ${info.nome}`) : res === 'V' ? 'Vitória europeia!' : res === 'E' ? 'Empate na Europa' : 'Derrota na Europa'
  const outros = comp.rondas[dia].jogos.filter((x) => x.id !== p.id)
  const g = comp.grupos.findIndex((gr) => gr.includes(clubeId))
  return (
    <div className="resumo-jornada">
      <div className={`cartao resumo-meu res-${ko ? (passou ? 'V' : 'D') : res}`}>
        <div className="pj-cab">{info.nome} · {r.nome}</div>
        <h2 className="taca-titulo">{titulo}</h2>
        <div className="mj-placar">
          <div className="mj-eq"><Emblema clube={m.clubes[p.casaId]} tamanho={40} /><span>{m.clubes[p.casaId].nome}</span></div>
          <div className="mj-golos">{p.golos[0]}<span>-</span>{p.golos[1]}</div>
          <div className="mj-eq"><Emblema clube={m.clubes[p.foraId]} tamanho={40} /><span>{m.clubes[p.foraId].nome}</span></div>
        </div>
        {ida && <p className="dica">No conjunto: {agregado(p, ida).join('-')}{p.prolongamento && !p.penaltis ? ', decidido no prolongamento' : ''}.</p>}
        {p.penaltis && p.serie && (
          <div className="penaltis">
            <b>Penáltis {p.penaltis[0]}-{p.penaltis[1]}</b>
            {[0, 1].map((l) => (
              <div key={l} className="pen-linha">
                <span className="pen-sigla">{m.clubes[l === 0 ? p.casaId : p.foraId].sigla}</span>
                {p.serie!.filter((x) => x[0] === l).map((x, i) => <span key={i} className={`pen ${x[2] ? 'marcou' : 'falhou'}`} title={`${m.jogadores[x[1]]?.curto ?? ''}: ${x[2] ? 'golo' : 'falhou'}`}>{x[2] ? '●' : '○'}</span>)}
              </div>
            ))}
          </div>
        )}
        {p.eventos.some((e) => e.tipo === 'golo') && (
          <ul className="golos-lista">{p.eventos.filter((e) => e.tipo === 'golo').map((x, i) => <li key={i} className={x.lado}>{x.minuto}' {x.jogadorId != null ? m.jogadores[x.jogadorId]?.curto : ''}</li>)}</ul>
        )}
        <p className="balanco">
          {p.publico ? <>Público {p.publico.toLocaleString('pt-PT')} · bilheteira {euros(p.receita ?? 0)} · </> : null}
          {premio > 0 ? <b className="positivo">entrou {euros(premio)} em caixa</b> : 'sem prémio'}
        </p>
        <MelhorEmCampo mundo={m} partida={p} />
        {r.fase === 'grupo' && g >= 0 && <div className="eu-grupos um"><Grupo jogo={jogo} m={m} comp={comp} g={g} /></div>}
      </div>
      {p.notas && (
        <div className="cartao notas-colunas">
          <NotasEquipa mundo={m} partida={p} lado="casa" titulo={`Notas · ${m.clubes[p.casaId]?.nome ?? ''}`} />
          <NotasEquipa mundo={m} partida={p} lado="fora" titulo={`Notas · ${m.clubes[p.foraId]?.nome ?? ''}`} />
        </div>
      )}
      {outros.length > 0 && (
        <div className="cartao placares">
          <h3 className="sub-tit">Outros resultados · {info.nome}</h3>
          <ul>{outros.map((o) => <JogoEu key={o.id} jogo={jogo} m={m} p={o} ida={idaDe(comp, dia, o)} meuId={clubeId} />)}</ul>
        </div>
      )}
      <div className="barra-acao">
        <button className="botao principal grande" onClick={continuar}>Continuar</button>
      </div>
    </div>
  )
}

/** Os meus jogos europeus depois da jornada `j`, para o calendário. */
export function jogosEuropaCalendario(jogo: Jogo, j: number): { p: Partida; nome: string; adv: number; ida?: Partida; dia: number; comp: CompEuropa }[] {
  const e = (jogo as JogoComEuropa).europa
  if (!e || e.semEuropa || e.ano !== jogo.epoca.ano) return []
  const out = []
  for (let d = 0; d < e.datas.length; d++) {
    if (e.datas[d] !== j) continue
    for (const comp of e.comps) {
      const p = comp.rondas[d]?.jogos.find((x) => x.casaId === jogo.clubeId || x.foraId === jogo.clubeId)
      if (p) out.push({ p, nome: `${COMPETICOES[comp.id].nome} · ${comp.rondas[d].nome.replace('Fase de grupos · ', 'grupos, ')}`, adv: p.casaId === jogo.clubeId ? p.foraId : p.casaId, ida: idaDe(comp, d, p), dia: d, comp })
    }
  }
  return out
}

/** Linhas do calendário para os jogos europeus depois da jornada `j`. */
export function LinhasEuropa({ jogo, j, abrir }: { jogo: Jogo; j: number; abrir?: (p: Partida, ronda: string) => void }) {
  const lista = jogosEuropaCalendario(jogo, j)
  if (!lista.length) return null
  const e = (jogo as JogoComEuropa).europa!
  return (
    <>
      {lista.map(({ p, nome, adv, ida, comp, dia }) => {
        const c = jogo.mundo.clubes[adv] ?? e.clubes[adv]
        const ko = comp.rondas[dia].fase === 'volta' || comp.rondas[dia].fase === 'final'
        const [a, b] = p.casaId === jogo.clubeId ? p.golos : [p.golos[1], p.golos[0]]
        const res = ko ? (vencedorEuropa(p, ida) === jogo.clubeId ? 'V' : 'D') : a > b ? 'V' : a < b ? 'D' : 'E'
        return (
          <tr key={p.id} className={`linha-taca linha-europa ${p.jogada ? 'clicavel' : ''}`} onClick={() => abrir?.(p, nome)}>
            <td className="num">E</td>
            <td><span className="casa-fora">{comp.rondas[dia].fase === 'final' ? 'N' : p.casaId === jogo.clubeId ? 'C' : 'F'}</span></td>
            <td><span className="clube-linha">{c && <Emblema clube={c} tamanho={22} />} {c?.nome ?? '?'} <span className="dica">{nome}</span></span></td>
            <td className="num">{p.jogada ? <span className={`resultado res-${res}`}>{textoResultado(p)}</span> : <span className="dica">Europa</span>}</td>
          </tr>
        )
      })}
    </>
  )
}

/** Cartões do fim da época: vencedores europeus e apurados para a seguinte. */
export function EuropaFimEpoca({ jogo, ano }: { jogo: Jogo; ano: number }) {
  const e = (jogo as JogoComEuropa).europa
  if (!e) return null
  const hs = e.historico.filter((h) => h.ano === ano)
  const q = e.qualificados?.ano === ano ? e.qualificados : null
  return (
    <>
      {hs.map((h) => (
        <div key={h.comp} className={`cartao info ${h.vencedorId === jogo.clubeId ? 'meu' : ''}`}>
          <span className="info-t">{COMPETICOES[h.comp].nome}{h.vencedorId === jogo.clubeId ? ' · ganhaste!' : ''}</span>
          <span className="info-v">{h.vencedor}</span>
          <span className="info-d">Final: {h.resultado} contra {h.finalista}</span>
        </div>
      ))}
      {q && (
        <div className={`cartao info ${[...q.liga, ...q.taca].includes(jogo.clubeId) ? 'meu' : ''}`}>
          <span className="info-t">Europa na próxima época</span>
          <span className="info-d">{COMPETICOES.liga.nome}: {q.liga.map((id) => jogo.mundo.clubes[id]?.sigla).join(', ')}</span>
          <span className="info-d">{COMPETICOES.taca.nome}: {q.taca.map((id) => jogo.mundo.clubes[id]?.sigla).join(', ')}</span>
        </div>
      )}
    </>
  )
}
