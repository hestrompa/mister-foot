import { useEffect, useState } from 'react'
import type { Jogo, Mundo } from '../core/types'
import type { LinhaTabela, Partida } from '../core/partida'
import { temAbaixo, temAcima } from '../core/ligas'
import { Emblema } from './Emblema'

export function FormaPills({ forma }: { forma: LinhaTabela['forma'] }) {
  return (
    <span className="forma">
      {forma.map((r, i) => <span key={i} className={`forma-p forma-${r}`}>{r}</span>)}
    </span>
  )
}

/** A minha partida numa jornada (1-based), se existir. */
export function minhaPartida(jogo: Jogo, jornada: number): Partida | undefined {
  const div = jogo.mundo.clubes[jogo.clubeId].divisao
  return jogo.epoca.calendario[div - 1]?.[jornada - 1]?.find((p) => p.casaId === jogo.clubeId || p.foraId === jogo.clubeId)
}

/** Sorte de uma partida: tirada à sorte cada vez que um jogo começa (só na UI; o núcleo e os testes usam sementes fixas). */
export function sorteJogo(): number {
  return (Math.random() * 0x100000000) >>> 0
}

/** Semente da jornada. Com `sorte` (de sorteJogo), recomeçar o mesmo jogo dá uma partida diferente. */
export function sementeJornada(jogo: Jogo, extra = 0, sorte = 0): number {
  return (((jogo.mundo.semente * 2654435761 + jogo.epoca.ano * 97 + jogo.epoca.jornada * 131 + extra * 7) ^ sorte) >>> 0) || 1
}

/** Linhas da tabela com zonas de subida e descida. */
export function TabelaLiga({ mundo, linhas, divisao, meuId, compacta = false, antes }: {
  mundo: Mundo; linhas: LinhaTabela[]; divisao: number; meuId: number; compacta?: boolean; antes?: Record<number, number>
}) {
  const n = linhas.length
  const acima = temAcima(mundo, divisao), abaixo = temAbaixo(mundo, divisao)
  return (
    <div className="tabela-wrap">
      <table className={`tabela classificacao ${compacta ? 'compacta' : ''}`}>
        <thead>
          <tr>
            <th className="num">#</th><th>Clube</th><th className="num">J</th>
            {!compacta && <><th className="num esconde-m">V</th><th className="num esconde-m">E</th><th className="num esconde-m">D</th></>}
            <th className="num">DG</th><th className="num">Pts</th>
            {!compacta && <th className="esconde-m">Forma</th>}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => {
            const c = mundo.clubes[l.clubeId]
            const zona = i < 3 && acima ? 'sobe' : i >= n - 3 && abaixo ? 'desce' : i === 0 && !acima ? 'sobe' : ''
            const mov = antes ? (antes[l.clubeId] ?? i) - i : 0
            return (
              <tr key={l.clubeId} className={`${zona} ${l.clubeId === meuId ? 'meu' : ''}`}>
                <td className="num pos-tab">{i + 1}{mov > 0 && <span className="sobe-seta">▲</span>}{mov < 0 && <span className="desce-seta">▼</span>}</td>
                <td><span className="clube-linha"><Emblema clube={c} tamanho={compacta ? 18 : 22} /> <span className="nome-tab">{compacta ? c.sigla : c.nome}</span></span></td>
                <td className="num">{l.j}</td>
                {!compacta && <><td className="num esconde-m">{l.v}</td><td className="num esconde-m">{l.e}</td><td className="num esconde-m">{l.d}</td></>}
                <td className="num">{l.gm - l.gs > 0 ? '+' : ''}{l.gm - l.gs}</td>
                <td className="num pts">{l.pts}</td>
                {!compacta && <td className="esconde-m"><FormaPills forma={l.forma} /></td>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Botão para saltar o resto do jogo, pequeno, afastado dos outros controlos e
 * com confirmação (era fácil carregar sem querer e o jogo acabava logo).
 */
export function SaltarJogo({ saltar }: { saltar: () => void }) {
  const [confirmar, setConfirmar] = useState(false)
  useEffect(() => {
    if (!confirmar) return
    const t = setTimeout(() => setConfirmar(false), 5000)
    return () => clearTimeout(t)
  }, [confirmar])
  return (
    <div className="saltar-jogo">
      {confirmar ? (
        <>
          <span>Saltar para o resultado final?</span>
          <button className="botao pequeno" onClick={() => { setConfirmar(false); saltar() }}>Sim, saltar</button>
          <button className="botao pequeno fantasma" onClick={() => setConfirmar(false)}>Não</button>
        </>
      ) : (
        <button className="saltar-link" onClick={() => setConfirmar(true)}>Saltar para o fim</button>
      )}
    </div>
  )
}
