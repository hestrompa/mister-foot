// Taça Nacional: separador com o quadro, notícias e vencedores, e a ronda jogada ao vivo.
import { useEffect, useRef, useState } from 'react'
import type { Jogo, Mundo } from '../core/types'
import type { Lado, Partida } from '../core/partida'
import { definirAutoSub, iniciarJogo, notasDoJogo, type EstadoJogo } from '../core/motor'
import { MelhorEmCampo, NotasEquipa } from './Nota'
import { depoisDoMinuto, novaRondaViva, passoRonda, rondaAcabou, saltarRonda, terminouVivo, type PausaVivo } from '../core/ao-vivo'
import { useMonitor2D } from './Monitor2D'
import { euros } from '../core/formato'
import {
  NOME_SUPERTACA, NOME_TACA, PREMIO_FINALISTA, PREMIO_SUPERTACA, rondaPendente, precisaProlongamento, prolongar, escalacaoTaca, garantirTaca, indisponiveisTaca, jogarRondaTaca, meuJogoNaRonda,
  minhaSituacao, premioRonda, vencedorDe, type JogoComTaca, type RondaTaca,
} from '../core/taca'
import { Emblema } from './Emblema'
import { PainelSubs } from './AoVivo'
import { LayoutVivo } from './LayoutVivo'
import { SaltarJogo, sementeJornada } from './comum'
import './taca.css'

const MS_MINUTO = 450
type FaseVivo = PausaVivo | 'jogo' | 'resumo' | 'repeticao'

function Nome({ mundo, id, sigla = false }: { mundo: Mundo; id: number; sigla?: boolean }) {
  const c = mundo.clubes[id]
  return (
    <span className="clube-linha">
      <Emblema clube={c} tamanho={18} />
      {sigla ? c.sigla : <><span className="nm-longo">{c.nome}</span><span className="nm-sigla">{c.sigla}</span></>}
      <span className="div-tag">{c.divisao}.ª</span>
    </span>
  )
}

function JogoTaca({ mundo, p, meuId }: { mundo: Mundo; p: Partida; meuId: number }) {
  const v = p.jogada ? vencedorDe(p) : null
  const meu = p.casaId === meuId || p.foraId === meuId
  return (
    <li className={`placar taca-jogo ${meu ? 'meu' : ''}`}>
      <span className={`pl-casa ${v === p.casaId ? 'passa' : ''}`}><Nome mundo={mundo} id={p.casaId} /></span>
      <span className="pl-golos">{p.jogada ? `${p.golos[0]}-${p.golos[1]}` : 'vs'}</span>
      <span className={`pl-fora ${v === p.foraId ? 'passa' : ''}`}><Nome mundo={mundo} id={p.foraId} /></span>
      <span className="pl-min">{p.penaltis ? `${p.penaltis[0]}-${p.penaltis[1]} gp` : ''}</span>
    </li>
  )
}

const eMeu = (p: Partida, id: number) => p.casaId === id || p.foraId === id

/** Separador da taça. */
export function TacaSeparador({ jogo }: { jogo: JogoComTaca }) {
  const { mundo, clubeId } = jogo
  const t = garantirTaca(jogo)
  const ultima = Math.max(0, Math.min(t.atual, t.rondas.length - 1))
  const [ver, setVer] = useState(ultima)
  const ronda: RondaTaca | undefined = t.rondas[ver]
  const nomes = Object.entries(t.marcadores).map(([id, g]) => ({ id: Number(id), g })).sort((a, b) => b.g - a.g).slice(0, 5)
  const noticias = [...t.noticias].reverse().slice(0, 15)
  const ganho = t.receitas[clubeId] ?? 0
  return (
    <div className="taca">
      <div className="cartao destaque taca-cab">
        <div className="pj-cab">{NOME_TACA} {t.ano}/{String(t.ano + 1).slice(2)}</div>
        <h2>{minhaSituacao(jogo)}</h2>
        {ganho > 0 && <p className="dica">Já ganhaste {euros(ganho)} na taça (prémios e bilheteira).</p>}
        {!t.semTaca && <p className="dica">Eliminatórias a uma mão a meio da semana. Joga em casa o clube da divisão mais baixa; empate dá penáltis; a final é em campo neutro.</p>}
      </div>

      {t.supertaca && (
        <div className="cartao placares">
          <h3 className="sub-tit">{NOME_SUPERTACA} · {t.supertaca.jogada ? 'jogada' : 'antes da 1.ª jornada'} · campeão contra vencedor da taça, em campo neutro</h3>
          <ul>{t.supertaca.jogos.map((p) => <JogoTaca key={p.id} mundo={mundo} p={p} meuId={clubeId} />)}</ul>
        </div>
      )}

      {!t.semTaca && (
        <>
          <nav className="separadores taca-rondas" aria-label="Rondas da taça">
            {t.rondas.map((r, i) => (
              <button key={i} className={`${ver === i ? 'ativo' : ''} ${meuJogoNaRonda(jogo, r) ? 'tem-meu' : ''}`} onClick={() => setVer(i)} disabled={!r.jogos.length}>
                {r.nome.replace('Eliminatória preliminar', 'Preliminar').replace(' eliminatória', ' elim.')}
              </button>
            ))}
          </nav>
          {ronda && (
            <div className="cartao placares">
              <h3 className="sub-tit">
                {ronda.nome} · {ronda.jogada ? 'jogada' : `depois da ${ronda.aposJornada}.ª jornada`} · prémio a quem passa {euros(premioRonda(t, ver))}
              </h3>
              {ronda.jogos.length === 0 ? <p className="dica">Sorteio depois da ronda anterior.</p> : (
                <ul>{[...ronda.jogos].sort((a, b) => Number(eMeu(b, clubeId)) - Number(eMeu(a, clubeId))).map((p) => <JogoTaca key={p.id} mundo={mundo} p={p} meuId={clubeId} />)}</ul>
              )}
              {ronda.isentos.length > 0 && <p className="dica">Isentos desta ronda: {ronda.isentos.length} clubes das divisões de cima.</p>}
            </div>
          )}
        </>
      )}

      <div className="taca-grelha">
        <div className="cartao">
          <h3 className="sub-tit">Notícias da taça</h3>
          {noticias.length === 0 ? <p className="dica">Ainda sem notícias.</p> : (
            <ul className="noticias taca-noticias">{noticias.map((n, i) => <li key={i} className={n.minha ? 'minha' : ''}>{n.texto}</li>)}</ul>
          )}
        </div>
        <div className="cartao">
          <h3 className="sub-tit">Marcadores</h3>
          {nomes.length === 0 ? <p className="dica">Ainda ninguém marcou.</p> : (
            <ol className="taca-marc">{nomes.map((m) => <li key={m.id}>{mundo.jogadores[m.id]?.curto ?? '?'} <span className="dica">{mundo.clubes[mundo.jogadores[m.id]?.clubeId]?.sigla ?? ''}</span> <b>{m.g}</b></li>)}</ol>
          )}
          <h3 className="sub-tit">Vencedores</h3>
          {t.historico.length === 0 ? <p className="dica">A primeira final ainda está por jogar.</p> : (
            <ul className="taca-hist">{[...t.historico].reverse().map((h) => (
              <li key={h.ano}><span className="dica">{h.ano}/{String(h.ano + 1).slice(2)}</span> <Nome mundo={mundo} id={h.vencedorId} sigla /> {h.resultado} <Nome mundo={mundo} id={h.finalistaId} sigla /></li>
            ))}</ul>
          )}
          {(t.historicoSuper?.length ?? 0) > 0 && <>
            <h3 className="sub-tit">{NOME_SUPERTACA}</h3>
            <ul className="taca-hist">{[...t.historicoSuper!].reverse().map((h) => (
              <li key={h.ano}><span className="dica">{h.ano}/{String(h.ano + 1).slice(2)}</span> <Nome mundo={mundo} id={h.vencedorId} sigla /> {h.resultado} <Nome mundo={mundo} id={h.finalistaId} sigla /></li>
            ))}</ul>
          </>}
        </div>
      </div>
    </div>
  )
}

/** Cartão no separador Jogo quando o próximo jogo é da taça. */
export function avisoTaca(jogo: JogoComTaca, ronda: RondaTaca, p: Partida): { titulo: string; indisp: Set<number>; partida: Partida } {
  const sup = ronda.nome === NOME_SUPERTACA
  const final = sup || ronda.nome === 'Final'
  const onde = final ? 'campo neutro' : p.casaId === jogo.clubeId ? 'em casa' : 'fora'
  return { titulo: sup ? `${NOME_SUPERTACA} · campeão contra vencedor da taça · ${onde}` : `${NOME_TACA} · ${ronda.nome} · ${onde}`, indisp: indisponiveisTaca(jogo, jogo.clubeId), partida: p }
}

interface ResumoTaca { ronda: RondaTaca; minha: Partida; premio: number }

/** Ronda da taça ao vivo: o meu jogo com relato e substituições, os outros no quadro. */
export function AoVivoTaca({ jogo, guardar, continuar }: { jogo: JogoComTaca; guardar: () => void; continuar: () => void }) {
  const { mundo, clubeId } = jogo
  const t = garantirTaca(jogo)
  const [ronda] = useState(() => rondaPendente(jogo) ?? t.rondas[t.atual])
  const [ini] = useState(() => {
    const semente = sementeJornada(jogo, ronda.nome === NOME_SUPERTACA ? 6999 : 7000 + t.atual)
    const escDe = (p: Partida, id: number) => {
      if (id === clubeId) {
        const ind = indisponiveisTaca(jogo, id)
        return { ...jogo.escalacao, suplentes: jogo.escalacao.suplentes.filter((s) => !ind.has(s)) }
      }
      return escalacaoTaca(jogo, p, id)
    }
    const estados = ronda.jogos.map((p, i) => iniciarJogo(mundo, p, escDe(p, p.casaId), escDe(p, p.foraId), (semente + i * 7919) >>> 0))
    const mi = estados.findIndex((e) => e.partida.casaId === clubeId || e.partida.foraId === clubeId)
    if (mi > 0) estados.unshift(...estados.splice(mi, 1))
    if (estados[0]) definirAutoSub(estados[0], estados[0].partida.casaId === clubeId ? 'casa' : 'fora', false)
    return estados
  })
  const estados = ini
  const meu = estados[0]
  const [rv] = useState(() => novaRondaViva(estados, clubeId, (e) => {
    if (!precisaProlongamento(e)) return false
    prolongar(e)
    return true
  }))
  const meuLado: Lado = rv.meuLado
  const [fase, setFase] = useState<FaseVivo>('jogo')
  const [vel, setVel] = useState(1)
  const [, setTick] = useState(0)
  const concluido = useRef(false)
  const [lesionado, setLesionado] = useState<number | null>(null)
  const [resumo, setResumo] = useState<ResumoTaca | null>(null)
  const terminou = (e: EstadoJogo) => terminouVivo(rv, e)
  const mon = useMonitor2D({
    mundo, meu, casa: mundo.clubes[meu.partida.casaId], fora: mundo.clubes[meu.partida.foraId],
    semente: (x) => sementeJornada(jogo, 7100 + t.atual * 1000 + x),
    voltar: (f) => setFase((f as FaseVivo | null) ?? 'jogo'),
  })

  const passo = (): FaseVivo | null => {
    const r = passoRonda(mundo, rv, mon.aoEvento)
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
    const antes = mundo.clubes[clubeId].dinheiro
    const feita = jogarRondaTaca(jogo, estados.map((e) => ({ partida: { ...e.partida, jogada: true, notas: notasDoJogo(e) }, emCampo: emCampo(e) })))
    guardar()
    const minha = (feita ? meuJogoNaRonda(jogo, feita) : undefined) ?? meu.partida
    setResumo({ ronda: feita ?? ronda, minha, premio: mundo.clubes[clubeId].dinheiro - antes })
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
    saltarRonda(mundo, rv)
    setLesionado(null)
    concluir()
  }

  if (fase === 'resumo' && resumo) return <ResumoRonda jogo={jogo} r={resumo} continuar={continuar} />

  const mp = meu.partida
  const casa = mundo.clubes[mp.casaId], fora = mundo.clubes[mp.foraId]
  const feed = [...mp.eventos].filter((ev) => ev !== mon.escondido()).reverse()
  return (
    <LayoutVivo
      placar={(
        <div className="cartao meu-jogo">
          <div className="pj-cab">{ronda.nome === NOME_SUPERTACA ? NOME_SUPERTACA : `${NOME_TACA} · ${ronda.nome}`}</div>
          <div className="mj-min">{terminou(meu) ? 'Final' : fase === 'intervalo' ? 'Intervalo' : `${meu.minuto}'${mp.prolongamento ? ' · prolongamento' : ''}`}</div>
          <div className="mj-placar">
            <div className="mj-eq"><Emblema clube={casa} tamanho={40} /><span>{casa.nome}</span></div>
            <div className="mj-golos">{mp.golos[0]}<span>-</span>{mp.golos[1]}</div>
            <div className="mj-eq"><Emblema clube={fora} tamanho={40} /><span>{fora.nome}</span></div>
          </div>
          {terminou(meu) && mp.golos[0] === mp.golos[1] && <p className="dica">Empate depois do prolongamento: decide-se nos penáltis.</p>}
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
          <PainelSubs jogo={jogo} estado={meu} lado={meuLado} fase={fase} lesionado={lesionado}
            retomar={() => { setLesionado(null); setFase('jogo') }} atualizar={() => setTick((x) => x + 1)} />
        ) : undefined}
      relato={<>
          {feed.length === 0 && <p className="dica">O árbitro apita para o início.</p>}
          <ul>{feed.map((ev, i) => <li key={feed.length - i} className={`ev ev-${ev.tipo} ${ev.lado === meuLado ? 'nosso' : ''}`}><span className="ev-min">{ev.minuto}'</span> {ev.texto}</li>)}</ul>
      </>}
      notas={<NotasEquipa mundo={mundo} partida={mp} lado={meuLado} estado={meu} />}
      tituloJogos={`${ronda.nome} · outros jogos`}
      jogos={<ul>
            {estados.slice(1).map((e) => {
              const p = e.partida
              return (
                <li key={p.id} className="placar">
                  <span className="pl-casa"><span className="nm-longo">{mundo.clubes[p.casaId].nome}</span><span className="nm-sigla">{mundo.clubes[p.casaId].sigla}</span></span>
                  <span className="pl-golos">{p.golos[0]}-{p.golos[1]}</span>
                  <span className="pl-fora"><span className="nm-longo">{mundo.clubes[p.foraId].nome}</span><span className="nm-sigla">{mundo.clubes[p.foraId].sigla}</span></span>
                  <span className="pl-min">{terminou(e) ? 'F' : `${e.minuto}'`}</span>
                </li>
              )
            })}
            {estados.length === 1 && <li className="dica">É o único jogo desta ronda.</li>}
          </ul>}
    />
  )
}

function ResumoRonda({ jogo, r, continuar }: { jogo: JogoComTaca; r: ResumoTaca; continuar: () => void }) {
  const { mundo, clubeId } = jogo
  const t = garantirTaca(jogo)
  const p = r.minha
  const passou = vencedorDe(p) === clubeId
  const sup = r.ronda.nome === NOME_SUPERTACA
  const final = sup || r.ronda.nome === 'Final'
  const titulo = sup ? (passou ? `Vencedores da ${NOME_SUPERTACA}!` : `${NOME_SUPERTACA} perdida`) : final ? (passou ? `Vencedores da ${NOME_TACA}!` : 'Finalista vencido') : passou ? `Passamos à ronda seguinte!` : `Eliminados da ${NOME_TACA}`
  const prox = t.rondas[t.atual]
  const meuProx = meuJogoNaRonda(jogo, prox)
  const outros = r.ronda.jogos.filter((x) => x.id !== p.id)
  const premioEsperado = sup ? PREMIO_SUPERTACA[passou ? 0 : 1] : passou ? premioRonda(t, t.atual - 1) : final ? PREMIO_FINALISTA : 0
  return (
    <div className="resumo-jornada">
      <div className={`cartao resumo-meu res-${passou ? 'V' : 'D'}`}>
        <div className="pj-cab">{sup ? NOME_SUPERTACA : `${NOME_TACA} · ${r.ronda.nome}`}</div>
        <h2 className="taca-titulo">{titulo}</h2>
        <div className="mj-placar">
          <div className="mj-eq"><Emblema clube={mundo.clubes[p.casaId]} tamanho={40} /><span>{mundo.clubes[p.casaId].nome}</span></div>
          <div className="mj-golos">{p.golos[0]}<span>-</span>{p.golos[1]}</div>
          <div className="mj-eq"><Emblema clube={mundo.clubes[p.foraId]} tamanho={40} /><span>{mundo.clubes[p.foraId].nome}</span></div>
        </div>
        {p.prolongamento && !p.penaltis && <p className="dica">Decidido no prolongamento.</p>}
        {p.penaltis && p.serie && (
          <div className="penaltis">
            <b>Penáltis {p.penaltis[0]}-{p.penaltis[1]}</b>
            {[0, 1].map((l) => (
              <div key={l} className="pen-linha">
                <span className="pen-sigla">{mundo.clubes[l === 0 ? p.casaId : p.foraId].sigla}</span>
                {p.serie!.filter((x) => x[0] === l).map((x, i) => <span key={i} className={`pen ${x[2] ? 'marcou' : 'falhou'}`} title={`${mundo.jogadores[x[1]]?.curto ?? ''}: ${x[2] ? 'golo' : 'falhou'}`}>{x[2] ? '●' : '○'}</span>)}
              </div>
            ))}
          </div>
        )}
        {p.eventos.some((e) => e.tipo === 'golo') && (
          <ul className="golos-lista">{p.eventos.filter((e) => e.tipo === 'golo').map((g, i) => <li key={i} className={g.lado}>{g.minuto}' {g.jogadorId != null ? mundo.jogadores[g.jogadorId]?.curto : ''}</li>)}</ul>
        )}
        <p className="balanco">
          {p.publico ? <>Público {p.publico.toLocaleString('pt-PT')} · bilheteira {euros(p.receita ?? 0)} para {mundo.clubes[p.casaId].sigla} · </> : null}
          {premioEsperado > 0 ? <b className="positivo">prémio {euros(premioEsperado)}</b> : 'sem prémio'}
        </p>
        <MelhorEmCampo mundo={mundo} partida={p} />
        {meuProx && prox && (
          <p className="pos-mudanca">Sorteio da {prox.nome}: {mundo.clubes[meuProx.casaId === clubeId ? meuProx.foraId : meuProx.casaId].nome}, {prox.nome === 'Final' ? 'em campo neutro' : meuProx.casaId === clubeId ? 'em casa' : 'fora'}, depois da {prox.aposJornada}.ª jornada.</p>
        )}
      </div>
      {p.notas && (
        <div className="cartao notas-colunas">
          <NotasEquipa mundo={mundo} partida={p} lado="casa" titulo={`Notas · ${mundo.clubes[p.casaId].nome}`} />
          <NotasEquipa mundo={mundo} partida={p} lado="fora" titulo={`Notas · ${mundo.clubes[p.foraId].nome}`} />
        </div>
      )}
      {outros.length > 0 && (
        <div className="cartao placares">
          <h3 className="sub-tit">Outros resultados</h3>
          <ul>{outros.map((o) => <JogoTaca key={o.id} mundo={mundo} p={o} meuId={clubeId} />)}</ul>
        </div>
      )}
      <div className="barra-acao">
        <button className="botao principal grande" onClick={continuar}>Continuar</button>
      </div>
    </div>
  )
}

/** Linha para o fim da época: quem ganhou a taça. */
export function vencedorTacaDe(jogo: Jogo, ano: number) {
  return (jogo as JogoComTaca).taca?.historico.find((h) => h.ano === ano)
}
