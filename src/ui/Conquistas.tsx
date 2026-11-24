// Conquistas: aviso das novas no separador Jogo e lista completa na História.
import type { Jogo } from '../core/types'
import { CONQUISTAS, estadoConquistas, vistasConquistas } from '../core/conquistas'
import './conquistas.css'

export function AvisoConquistas({ jogo, atualizar }: { jogo: Jogo; atualizar: (j: Jogo) => void }) {
  const st = estadoConquistas(jogo)
  const novas = st.novas.map((id) => CONQUISTAS.find((c) => c.id === id)).filter((c) => !!c)
  if (!novas.length) return null
  return (
    <div className="cartao aviso-conquista" role="status" data-testid="aviso-conquista">
      <span className="ac-icone" aria-hidden="true">🏆</span>
      <div className="ac-texto">
        <b>{novas.length === 1 ? 'Conquista desbloqueada' : `${novas.length} conquistas desbloqueadas`}</b>
        <span>{novas.map((c) => `${c.nome} (${c.texto.replace(/\.$/, '').toLowerCase()})`).join(' · ')}</span>
      </div>
      <button className="botao" onClick={() => { vistasConquistas(jogo); atualizar(jogo) }}>Boa!</button>
    </div>
  )
}

export function ListaConquistas({ jogo }: { jogo: Jogo }) {
  const st = estadoConquistas(jogo)
  const feitas = CONQUISTAS.filter((c) => st.feitas[c.id] !== undefined).length
  return (
    <>
      <h3 className="sub-tit">Conquistas · {feitas}/{CONQUISTAS.length}</h3>
      <div className="lista-conquistas">
        {CONQUISTAS.map((c) => {
          const ano = st.feitas[c.id]
          const [a, alvo] = c.progresso(jogo)
          const pct = Math.max(0, Math.min(100, Math.round((100 * a) / alvo)))
          return (
            <div key={c.id} className={`cartao conquista ${ano !== undefined ? 'feita' : ''}`}>
              <span className="cq-icone" aria-hidden="true">{ano !== undefined ? '🏆' : '🔒'}</span>
              <div className="cq-txt">
                <b>{c.nome}</b>
                <span>{c.texto}</span>
                {ano !== undefined
                  ? <span className="cq-ano">Época {ano}/{String(ano + 1).slice(2)}</span>
                  : alvo > 1 && <span className="cq-barra" aria-label={`${pct}%`}><span style={{ width: `${pct}%` }} /></span>}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
