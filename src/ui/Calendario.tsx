import type { Jogo } from '../core/types'
import { Emblema } from './Emblema'
import { minhaPartida } from './comum'

export function Calendario({ jogo }: { jogo: Jogo }) {
  const { mundo, epoca, clubeId } = jogo
  const linhas = []
  for (let j = 1; j <= epoca.totalJornadas; j++) {
    const p = minhaPartida(jogo, j)
    if (!p) continue
    const casa = p.casaId === clubeId
    const adv = mundo.clubes[casa ? p.foraId : p.casaId]
    let res = ''
    if (p.jogada) {
      const [a, b] = casa ? p.golos : [p.golos[1], p.golos[0]]
      res = a > b ? 'V' : a < b ? 'D' : 'E'
    }
    linhas.push(
      <tr key={j} className={j === epoca.jornada ? 'proxima' : ''}>
        <td className="num">{j}</td>
        <td><span className="casa-fora">{casa ? 'C' : 'F'}</span></td>
        <td><span className="clube-linha"><Emblema clube={adv} tamanho={22} /> {adv.nome}</span></td>
        <td className="num">
          {p.jogada
            ? <span className={`resultado res-${res}`}>{p.golos[0]}-{p.golos[1]}</span>
            : j === epoca.jornada ? <span className="dica">próximo</span> : ''}
        </td>
      </tr>,
    )
  }
  return (
    <div className="tabela-wrap">
      <table className="tabela calendario">
        <thead><tr><th className="num">J</th><th></th><th>Adversário</th><th className="num">Resultado</th></tr></thead>
        <tbody>{linhas}</tbody>
      </table>
    </div>
  )
}
