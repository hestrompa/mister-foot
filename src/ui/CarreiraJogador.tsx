// Carreira de um jogador (linha aberta no plantel): personalidade, idade da reforma e histórico por época.
import type { Jogador, Mundo } from '../core/types'
import type { EstadoEpoca } from '../core/partida'
import { DICA_PERSONALIDADE, NOME_PERSONALIDADE, personalidadeDe } from '../core/personalidade'
import { assistNaEpoca, histDe, idadeReforma, jogosNaEpoca, totaisCarreira } from '../core/carreira-jogador'
import { corForca } from './Plantel'
import './carreira-jogador.css'

const ep = (ano: number) => `${ano}/${String(ano + 1).slice(2)}`

/** Etiqueta da personalidade (nada quando o jogador não tem traço marcado). */
export function Carater({ j }: { j: Jogador }) {
  const p = personalidadeDe(j)
  if (!p) return null
  return <span className={`carater carater-${p}`} title={DICA_PERSONALIDADE[p]}>{NOME_PERSONALIDADE[p]}</span>
}

export function CarreiraJogador({ j, mundo, epoca }: { j: Jogador; mundo: Mundo; epoca?: EstadoEpoca }) {
  const h = histDe(j)
  const t = totaisCarreira(j)
  const p = personalidadeDe(j)
  const reforma = idadeReforma(j)
  const atual = epoca && j.clubeId > 0 ? { jogos: jogosNaEpoca(epoca, j.id), golos: epoca.marcadores[j.id] ?? 0, assist: assistNaEpoca(epoca, j.id) } : null
  const sigla = (id: number) => mundo.clubes[id]?.sigla ?? '?'
  const nomeClube = (id: number) => mundo.clubes[id]?.nome ?? 'Clube extinto'
  const jogos = t.jogos + (atual?.jogos ?? 0)
  const golos = t.golos + (atual?.golos ?? 0)
  return (
    <div className="carreira-jog">
      <p className="carreira-jog-topo">
        {p ? <><Carater j={j} /> <span className="nota">{DICA_PERSONALIDADE[p]}</span></> : <span className="nota">Sem traço de personalidade marcado.</span>}
      </p>
      <p className="nota">
        {j.idade >= reforma - 1 ? <b>Está a pensar pendurar as botas no fim da época. </b> : j.idade >= 30 ? `Deve jogar até aos ${reforma} anos. ` : ''}
        {jogos > 0 && <>Carreira registada: {jogos} jogos e {golos} golos{t.clubes > 1 ? ` em ${t.clubes} clubes` : ''}{t.pico > j.forca ? `, melhor força ${t.pico}` : ''}.</>}
      </p>
      {(h.length > 0 || (atual && atual.jogos > 0)) && (
        <div className="tabela-wrap">
          <table className="tabela carreira-tab">
            <thead><tr><th>Época</th><th>Clube</th><th className="num">Div.</th><th className="num">J</th><th className="num">G</th><th className="num">A</th><th className="num">Força</th></tr></thead>
            <tbody>
              {atual && (
                <tr className="meu">
                  <td>{ep(epoca!.ano)} (agora)</td>
                  <td title={nomeClube(j.clubeId)}>{sigla(j.clubeId)}</td>
                  <td className="num">{mundo.clubes[j.clubeId]?.divisao ?? ''}</td>
                  <td className="num">{atual.jogos}</td><td className="num">{atual.golos}</td><td className="num">{atual.assist}</td>
                  <td className="num" style={{ color: corForca(j.forca) }}>{j.forca}</td>
                </tr>
              )}
              {[...h].reverse().map((l, k) => (
                <tr key={k}>
                  <td>{ep(l[0])}</td>
                  <td title={nomeClube(l[1])}>{sigla(l[1])}</td>
                  <td className="num">{l[2]}</td>
                  <td className="num">{l[3]}</td><td className="num">{l[4]}</td><td className="num">{l[6] ?? 0}</td>
                  <td className="num" style={{ color: corForca(l[5]) }}>{l[5]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {h.length === 0 && !(atual && atual.jogos > 0) && <p className="nota">Ainda sem épocas registadas. O histórico começa a contar a partir desta versão.</p>}
    </div>
  )
}
