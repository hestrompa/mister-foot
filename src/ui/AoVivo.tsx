import { euros } from '../core/formato'
import { useEffect, useRef, useState } from 'react'
import type { Jogo } from '../core/types'
import type { EventoJogo, Lado, LinhaTabela, Partida, Postura } from '../core/partida'
import { escalarIA } from '../core/tatica'
import { avancarMinuto, definirAutoSub, iniciarJogo, mudarPostura, substituir, type EstadoJogo } from '../core/motor'
import { concluirJornada, indisponiveisDe, partidasDaJornada, tabela } from '../core/epoca'
import { Emblema } from './Emblema'
import { POSTURAS } from './PreJogo'
import { sementeJornada, TabelaLiga } from './comum'
import { criarRepeticao, type CenaRepeticao } from '../core/repeticao'
import { Repeticao2D } from './Repeticao2D'

type Fase = 'jogo' | 'intervalo' | 'lesao' | 'pausa' | 'resumo' | 'repeticao'

/** Que lances do meu jogo abrem a repetição 2D. */
type ModoRep = 'tudo' | 'golos' | 'nada'
const MODOS_REP: Record<ModoRep, string> = { tudo: 'Repetições: golos e ocasiões', golos: 'Repetições: só golos', nada: 'Repetições: desligadas' }
const CHAVE_REP = 'mister-foot-repeticoes'
function lerModoRep(): ModoRep {
  try {
    const v = localStorage.getItem(CHAVE_REP)
    if (v === 'tudo' || v === 'golos' || v === 'nada') return v
  } catch { /* sem armazenamento */ }
  return 'tudo'
}
function gravarModoRep(m: ModoRep): void {
  try { localStorage.setItem(CHAVE_REP, m) } catch { /* ignora */ }
}
const MS_MINUTO = 450

interface Resumo {
  minha: Partida
  outras: Partida[]
  antes: Record<number, number>
  depois: LinhaTabela[]
  jornada: number
  /** Repetições dos lances do meu jogo. */
  cenas: CenaRepeticao[]
  /** Repetições dos golos dos outros jogos, por partida. */
  outrasCenas: Record<string, CenaRepeticao[]>
}

function clonarLinha(l: LinhaTabela): LinhaTabela {
  return { ...l, forma: [...l.forma] }
}

/** Tabela com os resultados ao vivo somados à tabela de antes da jornada. */
function tabelaAoVivo(base: LinhaTabela[], estados: EstadoJogo[]): LinhaTabela[] {
  const m = new Map(base.map((l) => [l.clubeId, clonarLinha(l)]))
  for (const e of estados) {
    const p = e.partida
    if (e.minuto <= 0) continue
    const [gc, gf] = p.golos
    const c = m.get(p.casaId), f = m.get(p.foraId)
    if (!c || !f) continue
    c.j++; f.j++; c.gm += gc; c.gs += gf; f.gm += gf; f.gs += gc
    if (gc > gf) { c.v++; f.d++; c.pts += 3 } else if (gc < gf) { f.v++; c.d++; f.pts += 3 } else { c.e++; f.e++; c.pts++; f.pts++ }
  }
  return [...m.values()].sort((a, b) => b.pts - a.pts || (b.gm - b.gs) - (a.gm - a.gs) || b.gm - a.gm)
}

export function AoVivo({ jogo, guardar, continuar }: { jogo: Jogo; guardar: () => void; continuar: () => void }) {
  const { mundo, epoca, clubeId } = jogo
  const div = mundo.clubes[clubeId].divisao

  const [ini] = useState(() => {
    const partidas = partidasDaJornada(epoca, div)
    const base = tabela(mundo, epoca, div).map(clonarLinha)
    const semente = sementeJornada(jogo)
    const escDe = (id: number, advId: number, emCasa: boolean) => {
      if (id === clubeId) {
        const ind = indisponiveisDe(mundo, epoca, id)
        return { ...jogo.escalacao, suplentes: jogo.escalacao.suplentes.filter((s) => !ind.has(s)) }
      }
      return escalarIA(mundo, id, advId, emCasa, indisponiveisDe(mundo, epoca, id))
    }
    const estados = partidas.map((p, i) => iniciarJogo(mundo, p, escDe(p.casaId, p.foraId, true), escDe(p.foraId, p.casaId, false), (semente + i * 7919) >>> 0))
    const mi = estados.findIndex((e) => e.partida.casaId === clubeId || e.partida.foraId === clubeId)
    if (mi > 0) estados.unshift(...estados.splice(mi, 1))
    if (estados[0]) definirAutoSub(estados[0], estados[0].partida.casaId === clubeId ? 'casa' : 'fora', false)
    return { estados, base }
  })
  const estados = ini.estados
  const meu = estados[0]
  const meuLado: Lado = meu.partida.casaId === clubeId ? 'casa' : 'fora'

  const [fase, setFase] = useState<Fase>('jogo')
  const [vel, setVel] = useState(1)
  const [, setTick] = useState(0)
  const tickRef = useRef(0)
  const flash = useRef<Record<string, number>>({})
  const feitos = useRef(new Set<string>())
  const concluido = useRef(false)
  const [lesionado, setLesionado] = useState<number | null>(null)
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [modoRep, setModoRep] = useState<ModoRep>(lerModoRep)
  const modoRepRef = useRef(modoRep)
  const cenas = useRef<CenaRepeticao[]>([])
  const [rep, setRep] = useState<CenaRepeticao | null>(null)
  /** Jogo da repetição em curso (o meu ou outro). */
  const [repJogo, setRepJogo] = useState<Partida | null>(null)
  const outrasCenas = useRef<Record<string, CenaRepeticao[]>>({})
  const repPend = useRef<CenaRepeticao | null>(null)
  const depoisRep = useRef<Fase | null>(null)
  const saltando = useRef(false)
  /** Lance do meu jogo a passar em direto: o golo só conta no marcador e no relato quando a bola entra. */
  const escondido = useRef<{ ev: EventoJogo; golo: boolean } | null>(null)
  const revelar = () => {
    const x = escondido.current
    if (!x) return
    escondido.current = null
    if (x.golo) {
      meu.partida.golos[x.ev.lado === 'casa' ? 0 : 1]++
      flash.current[meu.partida.id] = tickRef.current
    }
    setTick((t) => t + 1)
  }

  const terminou = (e: EstadoJogo) => e.partida.jogada || feitos.current.has(e.partida.id)

  /** Avança um minuto em todos os jogos. Devolve a pausa pedida, se houver. */
  const passo = (): Fase | null => {
    let pausa: Fase | null = null
    tickRef.current++
    for (const e of estados) {
      if (terminou(e)) continue
      const evs = avancarMinuto(mundo, e)
      for (const ev of evs) {
        if (ev.tipo === 'fim') feitos.current.add(e.partida.id)
        if (ev.tipo === 'golo') flash.current[e.partida.id] = tickRef.current
        if (e !== meu && ev.tipo === 'golo' && ev.lance) {
          const cena = criarRepeticao(ev, {
            casa: { escalacao: e.escalacoes.casa, fora: e.fora },
            fora: { escalacao: e.escalacoes.fora, fora: e.fora },
          }, (sementeJornada(jogo, 700 + ev.minuto) ^ (ev.jogadorId ?? 0) ^ e.partida.casaId * 977) >>> 0)
          if (cena) (outrasCenas.current[e.partida.id] ??= []).push(cena)
        }
        if (e === meu) {
          if ((ev.tipo === 'golo' || ev.tipo === 'oportunidade') && ev.lance) {
            const cena = criarRepeticao(ev, {
              casa: { escalacao: e.escalacoes.casa, fora: e.fora },
              fora: { escalacao: e.escalacoes.fora, fora: e.fora },
            }, (sementeJornada(jogo, 500 + ev.minuto) ^ (ev.jogadorId ?? 0)) >>> 0)
            if (cena) {
              cenas.current.push(cena)
              const m = modoRepRef.current
              if (!saltando.current && (m === 'tudo' || (m === 'golos' && ev.tipo === 'golo'))) {
                repPend.current = cena
                // Em direto: esconder o desfecho até a jogada acabar.
                if (ev.tipo === 'golo') {
                  meu.partida.golos[ev.lado === 'casa' ? 0 : 1]--
                  delete flash.current[meu.partida.id]
                }
                escondido.current = { ev, golo: ev.tipo === 'golo' }
              }
            }
          }
          if (ev.tipo === 'intervalo') pausa = 'intervalo'
          if (ev.tipo === 'lesao' && ev.lado === meuLado && meu.subs[meuLado] < 5 && !pausa) {
            pausa = 'lesao'
            setLesionado(ev.jogadorId ?? null)
          }
        }
      }
    }
    if (repPend.current) {
      setRep(repPend.current)
      setRepJogo(meu.partida)
      repPend.current = null
      depoisRep.current = pausa
      return 'repeticao'
    }
    return pausa
  }

  const concluir = () => {
    if (concluido.current) return
    revelar()
    concluido.current = true
    const jornada = epoca.jornada
    const cal = epoca.calendario[div - 1][jornada - 1]
    for (const e of estados) {
      e.partida.jogada = true
      const i = cal.findIndex((p) => p.id === e.partida.id)
      if (i >= 0) cal[i] = e.partida
    }
    const antes: Record<number, number> = {}
    ini.base.forEach((l, i) => { antes[l.clubeId] = i })
    concluirJornada(mundo, epoca, sementeJornada(jogo, 999))
    const depois = tabela(mundo, epoca, div)
    guardar()
    setResumo({ minha: meu.partida, outras: estados.slice(1).map((e) => e.partida), antes, depois, jornada, cenas: cenas.current.slice(), outrasCenas: { ...outrasCenas.current } })
    setFase('resumo')
  }

  useEffect(() => {
    if (fase !== 'jogo') return
    const t = setInterval(() => {
      if (concluido.current) return
      const pausa = passo()
      // Uma pausa (repetição, intervalo) vem antes de fechar a jornada, mesmo no último minuto.
      if (pausa) { setFase(pausa); setTick(tickRef.current); return }
      if (estados.every(terminou)) { clearInterval(t); concluir(); return }
      setTick(tickRef.current)
    }, MS_MINUTO / vel)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, vel])

  const saltar = () => {
    let guarda = 0
    saltando.current = true
    revelar()
    while (!estados.every(terminou) && guarda++ < 200) passo()
    setRep(null)
    setLesionado(null)
    concluir()
  }

  if (fase === 'resumo' && resumo) return <ResumoJornada jogo={jogo} r={resumo} continuar={continuar} />

  const ao = tabelaAoVivo(ini.base, estados)
  const mp = meu.partida
  const lances = mp.eventos.filter((e) => e.tipo === 'golo' || e.tipo === 'oportunidade')
  const rem = [lances.filter((e) => e.lado === 'casa').length, lances.filter((e) => e.lado === 'fora').length]
  const feed = [...mp.eventos].filter((ev) => ev !== escondido.current?.ev).reverse()
  const casa = mundo.clubes[mp.casaId], fora = mundo.clubes[mp.foraId]
  const recente = (p: Partida) => flash.current[p.id] != null && tickRef.current - flash.current[p.id] < 5 * vel

  return (
    <div className="ao-vivo">
      <div className="av-principal">
        <div className={`cartao meu-jogo ${recente(mp) ? 'flash' : ''}`}>
          <div className="mj-min">{terminou(meu) ? 'Final' : fase === 'intervalo' ? 'Intervalo' : `${meu.minuto}'`}</div>
          <div className="mj-placar">
            <div className="mj-eq"><Emblema clube={casa} tamanho={40} /><span>{casa.nome}</span></div>
            <div className="mj-golos">{mp.golos[0]}<span>-</span>{mp.golos[1]}</div>
            <div className="mj-eq"><Emblema clube={fora} tamanho={40} /><span>{fora.nome}</span></div>
          </div>
          <div className="mj-estat">
            {mp.jogada && <Estat t="Posse" a={`${mp.estat.posse[0]}%`} b={`${mp.estat.posse[1]}%`} pa={mp.estat.posse[0]} pb={mp.estat.posse[1]} />}
            {mp.jogada
              ? <Estat t="Remates" a={`${mp.estat.remates[0]} (${mp.estat.rematesBaliza[0]})`} b={`${mp.estat.remates[1]} (${mp.estat.rematesBaliza[1]})`} pa={mp.estat.remates[0]} pb={mp.estat.remates[1]} />
              : <Estat t="Remates" a={String(rem[0])} b={String(rem[1])} pa={rem[0]} pb={rem[1]} />}
          </div>
        </div>

        <div className="controlos">
          {[1, 2, 4].map((v) => (
            <button key={v} className={`botao ${vel === v ? 'ativo' : ''}`} onClick={() => setVel(v)}>{v}x</button>
          ))}
          <button className="botao" disabled={fase !== 'jogo'} onClick={() => setFase('pausa')}>Pausa</button>
          <button className="botao" onClick={saltar}>Saltar</button>
          <button className="botao modo-rep" onClick={() => {
            const m: ModoRep = modoRep === 'tudo' ? 'golos' : modoRep === 'golos' ? 'nada' : 'tudo'
            setModoRep(m)
            modoRepRef.current = m
            gravarModoRep(m)
          }}>{MODOS_REP[modoRep]}</button>
        </div>

        {fase === 'repeticao' && rep && (
          <Repeticao2D key={`${rep.minuto}-${rep.rematadorId}`} cena={rep} mundo={mundo}
            casa={mundo.clubes[(repJogo ?? mp).casaId]} fora={mundo.clubes[(repJogo ?? mp).foraId]} velocidade={vel > 1 ? 1.5 : 1}
            outroJogo={repJogo != null && repJogo.id !== mp.id ? `${mundo.clubes[repJogo.casaId].sigla} ${repJogo.golos[0]}-${repJogo.golos[1]} ${mundo.clubes[repJogo.foraId].sigla}` : undefined}
            emDireto={escondido.current != null && repJogo?.id === mp.id} revelar={revelar}
            fim={() => { revelar(); setRep(null); setFase(depoisRep.current ?? 'jogo'); depoisRep.current = null }} />
        )}

        {(fase === 'intervalo' || fase === 'lesao' || fase === 'pausa') && (
          <PainelSubs jogo={jogo} estado={meu} lado={meuLado} fase={fase} lesionado={lesionado}
            retomar={() => { setLesionado(null); setFase('jogo') }} atualizar={() => setTick((t) => t + 1)} />
        )}

        <div className="cartao relato">
          <h3 className="sub-tit">Relato</h3>
          {feed.length === 0 && <p className="dica">O árbitro apita para o início.</p>}
          <ul>
            {feed.map((ev, i) => (
              <li key={feed.length - i} className={`ev ev-${ev.tipo} ${ev.lado === meuLado ? 'nosso' : ''}`}>
                <span className="ev-min">{ev.minuto}'</span> {ev.texto}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="av-lateral">
        <div className="cartao placares">
          <h3 className="sub-tit">{mundo.divisoes[div - 1].nome} · Jornada {epoca.jornada}</h3>
          <ul>
            {estados.map((e) => {
              const p = e.partida
              const golosOutro = outrasCenas.current[p.id]
              const podeVer = e !== meu && golosOutro?.length && fase !== 'repeticao' && fase !== 'resumo'
              return (
                <li key={p.id} className={`placar ${e === meu ? 'meu' : ''} ${recente(p) ? 'flash' : ''}`}>
                  <span className="pl-casa"><span className="nm-longo">{mundo.clubes[p.casaId].nome}</span><span className="nm-sigla">{mundo.clubes[p.casaId].sigla}</span></span>
                  {podeVer
                    ? <button className="pl-golos pl-ver" title="Ver o último golo" onClick={() => {
                        depoisRep.current = fase === 'jogo' ? null : fase
                        setRep(golosOutro[golosOutro.length - 1])
                        setRepJogo(p)
                        setFase('repeticao')
                      }}>{p.golos[0]}-{p.golos[1]}</button>
                    : <span className="pl-golos">{p.golos[0]}-{p.golos[1]}</span>}
                  <span className="pl-fora"><span className="nm-longo">{mundo.clubes[p.foraId].nome}</span><span className="nm-sigla">{mundo.clubes[p.foraId].sigla}</span></span>
                  <span className="pl-min">{terminou(e) ? 'F' : `${e.minuto}'`}</span>
                </li>
              )
            })}
          </ul>
        </div>
        <h3 className="sub-tit">Classificação ao vivo</h3>
        <TabelaLiga mundo={mundo} linhas={ao} divisao={div} meuId={clubeId} compacta />
      </div>
    </div>
  )
}

function Estat({ t, a, b, pa, pb }: { t: string; a: string; b: string; pa: number; pb: number }) {
  const tot = pa + pb || 1
  return (
    <div className="estat">
      <div className="estat-l"><span>{a}</span><span className="dica">{t}</span><span>{b}</span></div>
      <div className="estat-barra"><span style={{ width: `${(pa / tot) * 100}%` }} /></div>
    </div>
  )
}

export function PainelSubs({ jogo, estado, lado, fase, lesionado, retomar, atualizar }: {
  jogo: Jogo; estado: EstadoJogo; lado: Lado; fase: Fase; lesionado: number | null; retomar: () => void; atualizar: () => void
}) {
  const { mundo } = jogo
  const [sai, setSai] = useState<number | null>(lesionado)
  const [msg, setMsg] = useState('')
  const esc = estado.escalacoes[lado]
  const expulsos = new Set(estado.partida.eventos.filter((e) => e.tipo === 'vermelho').map((e) => e.jogadorId))
  const fora = new Set(estado.fora)
  const restam = 5 - estado.subs[lado]
  const banco = esc.suplentes.filter((id) => !fora.has(id) && !esc.titulares.includes(id))

  const entrar = (id: number) => {
    if (sai == null) return
    const ok = substituir(mundo, estado, lado, sai, id)
    setMsg(ok ? `Sai ${mundo.jogadores[sai].curto}, entra ${mundo.jogadores[id].curto}.` : 'Substituição não permitida.')
    setSai(null)
    atualizar()
  }

  return (
    <div className="cartao painel-subs">
      <div className="ps-cab">
        <h3>{fase === 'intervalo' ? 'Intervalo' : fase === 'lesao' ? 'Lesão!' : 'Pausa'}</h3>
        <span className="dica">{restam} substituições restantes</span>
      </div>
      {fase === 'lesao' && lesionado != null && <p className="aviso-txt">{mundo.jogadores[lesionado].curto} lesionou-se. Escolhe quem entra.</p>}
      <div className="grupo-botoes">
        {POSTURAS.map((x) => (
          <button key={x.v} className={`botao ${esc.postura === x.v ? 'ativo' : ''}`}
            onClick={() => { mudarPostura(estado, lado, x.v as Postura); atualizar() }}>{x.t}</button>
        ))}
      </div>
      <div className="onze-grelha">
        <ul className="lista-jog">
          {esc.titulares.map((id) => {
            const j = mundo.jogadores[id]
            const off = fora.has(id) && expulsos.has(id)
            const lesao = fora.has(id) && !off
            return (
              <li key={id}>
                <button className={`linha-jog ${sai === id ? 'sel' : ''} ${off ? 'indisp' : ''} ${lesao ? 'lesionado' : ''}`} disabled={off || restam <= 0} onClick={() => setSai(sai === id ? null : id)}>
                  <span className={`pos pos-${j.posicao}`}>{j.posicao}</span><span className="nome-jogador">{j.curto}</span>
                  {lesao && <span className="baixa baixa-lesao">Lesionado</span>}
                  {off && <span className="baixa baixa-castigo">Expulso</span>}
                  <span className="direita forca-num">{j.forca}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <ul className="lista-jog">
          {banco.map((id) => {
            const j = mundo.jogadores[id]
            return (
              <li key={id}>
                <button className={`linha-jog ${sai != null ? 'alvo' : ''}`} disabled={sai == null || restam <= 0} onClick={() => entrar(id)}>
                  <span className={`pos pos-${j.posicao}`}>{j.posicao}</span><span className="nome-jogador">{j.curto}</span>
                  <span className="direita forca-num">{j.forca}</span>
                </button>
              </li>
            )
          })}
          {banco.length === 0 && <li className="dica">Sem suplentes disponíveis.</li>}
        </ul>
      </div>
      {msg && <p className="dica">{msg}</p>}
      <button className="botao principal grande" onClick={retomar}>{fase === 'intervalo' ? 'Segunda parte' : 'Continuar'}</button>
    </div>
  )
}

function ResumoJornada({ jogo, r, continuar }: { jogo: Jogo; r: Resumo; continuar: () => void }) {
  const { mundo, clubeId } = jogo
  const p = r.minha
  const casa = p.casaId === clubeId
  const [a, b] = casa ? p.golos : [p.golos[1], p.golos[0]]
  const res = a > b ? 'Vitória' : a < b ? 'Derrota' : 'Empate'
  const posAntes = (r.antes[clubeId] ?? 0) + 1
  const posDepois = r.depois.findIndex((l) => l.clubeId === clubeId) + 1
  const div = mundo.clubes[clubeId].divisao
  const golos = p.eventos.filter((e) => e.tipo === 'golo')
  const [ver, setVer] = useState<CenaRepeticao | null>(null)
  const [outra, setOutra] = useState<{ p: Partida; c: CenaRepeticao } | null>(null)
  return (
    <div className="resumo-jornada">
      <div className={`cartao resumo-meu res-${res[0]}`}>
        <div className="pj-cab">Jornada {r.jornada} · {res}</div>
        <div className="mj-placar">
          <div className="mj-eq"><Emblema clube={mundo.clubes[p.casaId]} tamanho={40} /><span><span className="nm-longo">{mundo.clubes[p.casaId].nome}</span><span className="nm-sigla">{mundo.clubes[p.casaId].sigla}</span></span></div>
          <div className="mj-golos">{p.golos[0]}<span>-</span>{p.golos[1]}</div>
          <div className="mj-eq"><Emblema clube={mundo.clubes[p.foraId]} tamanho={40} /><span><span className="nm-longo">{mundo.clubes[p.foraId].nome}</span><span className="nm-sigla">{mundo.clubes[p.foraId].sigla}</span></span></div>
        </div>
        {golos.length > 0 && <ul className="golos-lista">{golos.map((g, i) => <li key={i} className={g.lado}>{g.minuto}' {g.jogadorId != null ? mundo.jogadores[g.jogadorId]?.curto : ''}</li>)}</ul>}
        {r.cenas.length > 0 && (
          <div className="rep-lista">
            {r.cenas.map((c, i) => (
              <button key={i} className={`botao ${ver === c ? 'ativo' : ''}`} onClick={() => setVer(c)}>
                {c.desfecho === 'golo' ? 'Golo' : 'Ocasião'} {c.minuto}' · {mundo.jogadores[c.rematadorId]?.curto}
              </button>
            ))}
          </div>
        )}
        {ver && (
          <Repeticao2D key={`${ver.minuto}-${ver.rematadorId}`} cena={ver} mundo={mundo} casa={mundo.clubes[p.casaId]} fora={mundo.clubes[p.foraId]}
            autoFim={false} rotuloFim="Fechar" fim={() => setVer(null)} />
        )}
        {p.porque && <p className="porque">{p.porque}</p>}
        {jogo.epoca.ultimoBalanco?.[clubeId] && (() => {
          const b = jogo.epoca.ultimoBalanco![clubeId]
          return (
            <p className="balanco">
              {b.publico > 0 && <>Público {b.publico.toLocaleString('pt-PT')} · bilheteira {euros(b.bilheteira)} · </>}
              TV e patrocínios {euros(b.fixas)} · salários {euros(b.salarios)} · {b.estadio ? <>estádio {euros(b.estadio)} · </> : null}{b.banco ? <>banco {euros(b.banco)} · </> : null}<b className={b.saldo >= 0 ? 'positivo' : 'negativo'}>saldo {b.saldo >= 0 ? '+' : ''}{euros(b.saldo)}</b>
            </p>
          )
        })()}
        {jogo.epoca.ultimoBalanco?.[clubeId]?.inaugurados ? <p className="balanco">Obras concluídas: o estádio tem mais {jogo.epoca.ultimoBalanco[clubeId].inaugurados!.toLocaleString('pt-PT')} lugares.</p> : null}
        <p className="pos-mudanca">
          Posição: {posAntes}.º → <b>{posDepois}.º</b>
          {posDepois < posAntes && <span className="sobe-seta"> ▲ {posAntes - posDepois}</span>}
          {posDepois > posAntes && <span className="desce-seta"> ▼ {posDepois - posAntes}</span>}
        </p>
      </div>
      <div className="resumo-grelha">
        <div className="cartao placares">
          <h3 className="sub-tit">Outros resultados</h3>
          <ul>
            {outra && (
              <li className="placar-rep">
                <Repeticao2D key={`${outra.p.id}-${outra.c.minuto}-${outra.c.rematadorId}`} cena={outra.c} mundo={mundo}
                  casa={mundo.clubes[outra.p.casaId]} fora={mundo.clubes[outra.p.foraId]} autoFim={false} rotuloFim="Fechar" fim={() => setOutra(null)}
                  outroJogo={`${mundo.clubes[outra.p.casaId].sigla} ${outra.p.golos[0]}-${outra.p.golos[1]} ${mundo.clubes[outra.p.foraId].sigla}`} />
                <div className="rep-lista">
                  {(r.outrasCenas[outra.p.id] ?? []).map((c, i) => (
                    <button key={i} className={`botao ${outra.c === c ? 'ativo' : ''}`} onClick={() => setOutra({ p: outra.p, c })}>
                      {c.minuto}' {mundo.jogadores[c.rematadorId]?.curto}
                    </button>
                  ))}
                </div>
              </li>
            )}
            {r.outras.map((o) => (
              <li key={o.id} className="placar">
                <span className="pl-casa"><span className="nm-longo">{mundo.clubes[o.casaId].nome}</span><span className="nm-sigla">{mundo.clubes[o.casaId].sigla}</span></span>
                {r.outrasCenas[o.id]?.length
                  ? <button className="pl-golos pl-ver" title="Ver os golos" onClick={() => setOutra({ p: o, c: r.outrasCenas[o.id][0] })}>{o.golos[0]}-{o.golos[1]}</button>
                  : <span className="pl-golos">{o.golos[0]}-{o.golos[1]}</span>}
                <span className="pl-fora"><span className="nm-longo">{mundo.clubes[o.foraId].nome}</span><span className="nm-sigla">{mundo.clubes[o.foraId].sigla}</span></span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="sub-tit">Classificação</h3>
          <TabelaLiga mundo={mundo} linhas={r.depois} divisao={div} meuId={clubeId} compacta antes={r.antes} />
        </div>
      </div>
      <div className="barra-acao">
        <button className="botao principal grande" onClick={continuar}>Continuar</button>
      </div>
    </div>
  )
}
