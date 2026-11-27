// História: campeões (hall of fame), recordes, melhores marcadores de sempre, rivalidades e números do mister.
import type { Jogo } from '../core/types'
import { ListaConquistas } from './Conquistas'
import { NOMES_DIVISAO } from '../core/mundo'
import { nomeDivisao } from '../core/ligas'
import { estadoRecordes, marcadoresDeSempre, NOME_RECORDE, confronto, type TipoRecorde } from '../core/recordes'
import { regiaoDe, rivaisDe } from '../core/rivalidades'
import type { JogoComTaca } from '../core/taca'
import { Emblema } from './Emblema'
import './imprensa.css'
import './carreira-jogador.css'
import { idolosAtivos, lendas, lendasDoClube, reformas } from '../core/carreira-jogador'

const ep = (ano: number) => `${ano}/${String(ano + 1).slice(2)}`
const ORDEM: TipoRecorde[] = ['maisPontos', 'maiorVitoria', 'maisGolosJogo', 'golosJogador', 'maisGolosEpoca', 'serieVitorias', 'serieInvencivel', 'serieDerrotas']

export function Historia({ jogo }: { jogo: Jogo }) {
  const st = estadoRecordes(jogo)
  const { mundo } = jogo
  const mi = st.mister
  const anos = [...new Set(st.campeoes.map((c) => c.ano))].sort((a, b) => b - a)
  const taca = [...((jogo as JogoComTaca).taca?.historico ?? [])].sort((a, b) => b.ano - a.ano)
  const sempre = marcadoresDeSempre(jogo, 15)
  const rivais = rivaisDe(mundo, jogo.clubeId)
  const reg = regiaoDe(mundo.clubes[jogo.clubeId])
  const pct = mi.jogos ? Math.round((100 * mi.v) / mi.jogos) : 0
  return (
    <div className="historia">
      <h3 className="sub-tit">Mister {jogo.treinador} (liga)</h3>
      <div className="cartoes-info">
        <div className="cartao info"><span className="info-t">Jogos</span><span className="info-v">{mi.jogos}</span><span className="info-d">{mi.v}V {mi.e}E {mi.d}D · {pct}% de vitórias</span></div>
        <div className="cartao info"><span className="info-t">Golos</span><span className="info-v">{mi.gm}-{mi.gs}</span><span className="info-d">marcados e sofridos</span></div>
        <div className="cartao info"><span className="info-t">Títulos</span><span className="info-v">{mi.titulos}</span><span className="info-d">{mi.subidas} subida{mi.subidas === 1 ? '' : 's'} de divisão</span></div>
        <div className="cartao info"><span className="info-t">Melhor série</span><span className="info-v">{mi.melhorSerie}</span><span className="info-d">vitórias seguidas{mi.maiorVitoria ? ` · maior vitória ${mi.maiorVitoria.texto}` : ''}</span></div>
      </div>

      <ListaConquistas jogo={jogo} />

      <h3 className="sub-tit">Rivais{reg ? ` · região ${reg.de.replace(/^d[oa] /, '')}` : ''}</h3>
      <div className="tabela-wrap">
        <table className="tabela">
          <thead><tr><th>Clube</th><th>Jogo</th><th className="num">V</th><th className="num">E</th><th className="num">D</th><th className="num">Golos</th></tr></thead>
          <tbody>
            {rivais.map(({ clube, r }) => {
              const h = confronto(jogo, jogo.clubeId, clube.id)
              return (
                <tr key={clube.id} className={r.tipo === 'classico' ? 'meu' : ''}>
                  <td><span className="clube-linha"><Emblema clube={clube} tamanho={22} /> {clube.nome} <span className="dica">{nomeDivisao(mundo, clube.divisao)}</span></span></td>
                  <td>{r.nome}</td>
                  <td className="num">{h.v}</td><td className="num">{h.e}</td><td className="num">{h.d}</td>
                  <td className="num">{h.gm}-{h.gs}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="nota">Os dérbis enchem o estádio e pesam mais na moral e na direção. O clássico é com o rival destacado.</p>

      <h3 className="sub-tit">Galeria de campeões</h3>
      {anos.length || taca.length ? (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead><tr><th>Época</th>{NOMES_DIVISAO.map((n) => <th key={n}>{n}</th>)}<th>Taça</th></tr></thead>
            <tbody>
              {[...new Set([...anos, ...taca.map((t) => t.ano)])].sort((a, b) => b - a).map((ano) => {
                const t = taca.find((x) => x.ano === ano)
                return (
                  <tr key={ano}>
                    <td>{ep(ano)}</td>
                    {NOMES_DIVISAO.map((_, d) => {
                      const c = st.campeoes.find((x) => x.ano === ano && x.divisao === d + 1)
                      return <td key={d} className={c?.meu ? 'hi-meu' : ''}>{c ? `${c.nome} (${c.pontos})` : '·'}</td>
                    })}
                    <td className={t && t.vencedorId === jogo.clubeId ? 'hi-meu' : ''}>{t ? mundo.clubes[t.vencedorId]?.nome ?? '?' : '·'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : <p className="nota">Os campeões aparecem aqui no fim de cada época.</p>}

      <h3 className="sub-tit">Recordes</h3>
      {ORDEM.some((k) => st.recordes[k]) ? (
        <ul className="hi-recordes">
          {ORDEM.filter((k) => st.recordes[k]).map((k) => {
            const r = st.recordes[k]!
            return (
              <li key={k} className="cartao">
                <span className="info-t">{NOME_RECORDE[k]}</span>
                <span className="hi-valor">{r.valor}</span>
                <span className="info-d">{r.texto}</span>
              </li>
            )
          })}
        </ul>
      ) : <p className="nota">Ainda sem recordes. Joga umas jornadas.</p>}

      <h3 className="sub-tit">Melhores marcadores de sempre</h3>
      {sempre.length ? (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead><tr><th className="num">#</th><th>Jogador</th><th>Clube</th><th className="num">Épocas</th><th className="num">Golos</th></tr></thead>
            <tbody>
              {sempre.map((m, i) => (
                <tr key={m.id} className={mundo.jogadores[m.id]?.clubeId === jogo.clubeId ? 'meu' : ''}>
                  <td className="num">{i + 1}</td><td>{m.nome}</td><td>{m.clube}</td><td className="num">{m.epocas}</td><td className="num"><b>{m.golos}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="nota">Ainda ninguém marcou.</p>}

      <Lendas jogo={jogo} />

      {st.goleadores.length > 0 && (
        <>
          <h3 className="sub-tit">Melhores marcadores por época</h3>
          <div className="tabela-wrap">
            <table className="tabela">
              <thead><tr><th>Época</th><th>Divisão</th><th>Jogador</th><th>Clube</th><th className="num">Golos</th></tr></thead>
              <tbody>
                {[...st.goleadores].reverse().map((g) => (
                  <tr key={`${g.ano}-${g.divisao}`}><td>{ep(g.ano)}</td><td>{nomeDivisao(mundo, g.divisao)}</td><td>{g.nome}</td><td>{g.clube}</td><td className="num">{g.golos}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

/** Lendas do clube, galeria de lendas do futebol e reformas recentes. */
function Lendas({ jogo }: { jogo: Jogo }) {
  const { mundo } = jogo
  const doClube = lendasDoClube(mundo, jogo.clubeId)
  const idolos = idolosAtivos(mundo, jogo.clubeId, 5)
  const todas = lendas(mundo).slice(0, 15)
  const ref = reformas(mundo).slice(0, 12)
  const meu = mundo.clubes[jogo.clubeId]
  return (
    <>
      <h3 className="sub-tit">Lendas e ídolos do {meu.nome}</h3>
      {doClube.length || idolos.length ? (
        <div className="tabela-wrap">
          <table className="tabela lendas-lista">
            <thead><tr><th>Jogador</th><th>Pos</th><th>No clube</th><th className="num">Jogos</th><th className="num">Golos</th></tr></thead>
            <tbody>
              {doClube.map(({ lenda: l, jogos, golos }) => (
                <tr key={`l${l.id}`}><td><b>{l.nome}</b> <span className="craque">lenda</span></td><td>{l.posicao}</td><td>{ep(l.de)} a {ep(l.ate)}</td><td className="num">{jogos}</td><td className="num">{golos}</td></tr>
              ))}
              {idolos.map(({ j, jogos, golos }) => (
                <tr key={`a${j.id}`} className="meu"><td>{j.nome} <span className="dica">no plantel</span></td><td>{j.posicao}</td><td>{j.idade} anos</td><td className="num">{jogos}</td><td className="num">{golos}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="nota">Os jogos e golos de cada jogador contam a partir desta versão. Os ídolos do clube aparecem aqui ao fim da primeira época.</p>}

      <h3 className="sub-tit">Galeria de lendas</h3>
      {todas.length ? (
        <div className="tabela-wrap">
          <table className="tabela lendas-lista">
            <thead><tr><th>Jogador</th><th>Pos</th><th>Carreira</th><th>Clubes</th><th className="num">Jogos</th><th className="num">Golos</th><th className="num">Auge</th></tr></thead>
            <tbody>
              {todas.map((l) => (
                <tr key={l.id} className={l.clubes.some((c) => c[0] === jogo.clubeId) ? 'meu' : ''}>
                  <td><b>{l.nome}</b>{l.nacionalidade !== 'PT' && <span className="nac">{l.nacionalidade}</span>}</td>
                  <td>{l.posicao}</td>
                  <td>{ep(l.de)} a {ep(l.ate)}</td>
                  <td><span className="nota">{l.clubes.map((c) => mundo.clubes[c[0]]?.sigla ?? c[1]).join(', ')}</span></td>
                  <td className="num">{l.jogos}</td><td className="num">{l.golos}</td><td className="num">{l.pico}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="nota">Quem acabar uma grande carreira (muitas épocas a titular nas divisões de cima, ou um craque) entra aqui quando se reformar.</p>}

      {ref.length > 0 && (
        <>
          <h3 className="sub-tit">Reformas recentes</h3>
          <div className="tabela-wrap">
            <table className="tabela">
              <thead><tr><th>Época</th><th>Jogador</th><th>Último clube</th><th className="num">Idade</th><th className="num">Jogos</th><th className="num">Golos</th></tr></thead>
              <tbody>
                {ref.map((r) => (
                  <tr key={`${r.id}-${r.ano}`} className={r.clubeId === jogo.clubeId ? 'meu' : ''}>
                    <td>{ep(r.ano)}</td><td>{r.nome}{r.lenda && <span className="craque">lenda</span>}</td><td>{r.clube}</td>
                    <td className="num">{r.idade}</td><td className="num">{r.jogos}</td><td className="num">{r.golos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="nota">Os jogos contam desde que o histórico começou a ser registado.</p>
        </>
      )}
    </>
  )
}
