import type { Jogo } from '../core/types'
import { Emblema } from './Emblema'
import { minhaPartida } from './comum'
import { meuJogoNaRonda, vencedorDe, type JogoComTaca } from '../core/taca'
import { useState } from 'react'
import type { Partida } from '../core/partida'
import { criarFicha, fichaPorId, type FichaJogo } from '../core/fichas'
import { Ficha, JogosAnteriores } from './Ficha'
import { LinhasEuropa } from './Europa'

export function Calendario({ jogo }: { jogo: Jogo }) {
  const { mundo, epoca, clubeId } = jogo
  const [ver, setVer] = useState<FichaJogo | null>(null)
  if (ver) return <Ficha f={ver} voltar={() => setVer(null)} />
  /** Ficha guardada, ou feita na hora a partir da partida (jogos de versões antigas). */
  const abrir = (p: Partida, ronda: string) => { if (p.jogada) setVer(fichaPorId(jogo, p.id) ?? criarFicha(mundo, p, epoca.ano, ronda)) }
  const linhas = []
  const sup = (jogo as JogoComTaca).taca?.supertaca
  const ps = sup && meuJogoNaRonda(jogo, sup)
  if (ps) {
    const advS = mundo.clubes[ps.casaId === clubeId ? ps.foraId : ps.casaId]
    linhas.push(
      <tr key="sup" className={`linha-taca ${ps.jogada ? 'clicavel' : ''}`} onClick={() => abrir(ps, 'Supertaça')}>
        <td className="num">S</td>
        <td><span className="casa-fora">N</span></td>
        <td><span className="clube-linha"><Emblema clube={advS} tamanho={22} /> {advS.nome} <span className="dica">Supertaça</span></span></td>
        <td className="num">{ps.jogada ? <span className={`resultado res-${vencedorDe(ps) === clubeId ? 'V' : 'D'}`}>{ps.golos[0]}-{ps.golos[1]}{ps.penaltis ? ` (${ps.penaltis[0]}-${ps.penaltis[1]})` : ''}</span> : <span className="dica">Supertaça</span>}</td>
      </tr>,
    )
  }
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
      <tr key={j} className={`${j === epoca.jornada ? 'proxima' : ''} ${p.jogada ? 'clicavel' : ''}`} onClick={() => abrir(p, `Jornada ${j}`)}>
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
    // Jogos da taça a meio da semana, depois desta jornada.
    for (const r of (jogo as JogoComTaca).taca?.rondas ?? []) {
      const t = r.aposJornada === j ? meuJogoNaRonda(jogo, r) : undefined
      if (!t) continue
      const emCasa = t.casaId === clubeId
      const advT = mundo.clubes[emCasa ? t.foraId : t.casaId]
      const passou = t.jogada && vencedorDe(t) === clubeId
      linhas.push(
        <tr key={`t${j}`} className={`linha-taca ${t.jogada ? 'clicavel' : ''}`} onClick={() => abrir(t, `Taça · ${r.nome}`)}>
          <td className="num">T</td>
          <td><span className="casa-fora">{r.nome === 'Final' ? 'N' : emCasa ? 'C' : 'F'}</span></td>
          <td><span className="clube-linha"><Emblema clube={advT} tamanho={22} /> {advT.nome} <span className="dica">Taça · {r.nome}</span></span></td>
          <td className="num">
            {t.jogada
              ? <span className={`resultado res-${passou ? 'V' : 'D'}`}>{t.golos[0]}-{t.golos[1]}{t.penaltis ? ` (${t.penaltis[0]}-${t.penaltis[1]})` : ''}</span>
              : <span className="dica">Taça</span>}
          </td>
        </tr>,
      )
    }
    linhas.push(<LinhasEuropa key={`e${j}`} jogo={jogo} j={j} />)
  }
  return (
    <>
      <p className="nota">Toca num jogo já jogado para ver a ficha: táticas, onzes, substituições, golos e cartões.</p>
      <div className="tabela-wrap">
        <table className="tabela calendario">
          <thead><tr><th className="num">J</th><th></th><th>Adversário</th><th className="num">Resultado</th></tr></thead>
          <tbody>{linhas}</tbody>
        </table>
      </div>
      <JogosAnteriores jogo={jogo} abrir={(id) => setVer(fichaPorId(jogo, id) ?? null)} />
    </>
  )
}
