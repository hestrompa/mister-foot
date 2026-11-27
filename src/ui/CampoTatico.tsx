// Campo tático: o onze em caricas, onde cada jogador pode ser arrastado.
// Mais recuado defende mais, mais adiantado ataca mais; passar a linha de uma zona muda o papel
// (e a formação). As barras por baixo mostram o que a forma muda nos setores face à formação base.
import { useRef, useState } from 'react'
import type { Mundo, Posicao } from '../core/types'
import type { Escalacao } from '../core/partida'
import { forcaSetores } from '../core/motor'
import { LIMITE_DEF, LIMITE_MED, X_MAX, X_MIN, papelDaZona, papelNaFormacao, posicoesBase, posicoesDe, semPosicoes, type Ponto } from '../core/posicoes'
import './campo-tatico.css'

const COMP = 105, LARG = 68

const COR: Record<Posicao, string> = { GR: '#f5c451', DEF: '#4ea3ff', MED: '#3ddc84', AV: '#ff7a70' }

const SETORES: { k: 'meio' | 'ataque' | 'defesa'; t: string }[] = [
  { k: 'meio', t: 'Meio-campo' }, { k: 'ataque', t: 'Ataque' }, { k: 'defesa', t: 'Defesa' },
]

export function CampoTatico({ mundo, esc, emCasa, mover, repor, bloqueados, adversario, titulo = 'Posições em campo' }: {
  mundo: Mundo
  esc: Escalacao
  emCasa: boolean
  /** O jogador `id` foi largado em `ponto` (metros: x da própria baliza, y de 0 a 68). */
  mover: (id: number, ponto: Ponto) => void
  repor?: () => void
  /** Expulsos e lesionados: não aparecem. */
  bloqueados?: ReadonlySet<number>
  /** O adversário em campo (desenhado esbatido, a atacar para a esquerda). */
  adversario?: Escalacao
  titulo?: string
}) {
  const svg = useRef<SVGSVGElement>(null)
  const [arr, setArr] = useState<{ id: number; p: Ponto } | null>(null)
  const ps = posicoesDe(esc)
  const base = posicoesBase(esc.formacao)

  const ponto = (ev: React.PointerEvent): Ponto | null => {
    const el = svg.current
    const m = el?.getScreenCTM()
    if (!el || !m) return null
    const pt = el.createSVGPoint()
    pt.x = ev.clientX; pt.y = ev.clientY
    const q = pt.matrixTransform(m.inverse())
    return [Math.max(X_MIN, Math.min(X_MAX, q.x)), Math.max(3, Math.min(LARG - 3, q.y))]
  }

  const largar = (ev: React.PointerEvent) => {
    if (!arr) return
    const p = ponto(ev) ?? arr.p
    setArr(null)
    mover(arr.id, [Math.round(p[0] * 2) / 2, Math.round(p[1] * 2) / 2])
  }

  const set = forcaSetores(mundo, esc, emCasa)
  const ref = forcaSetores(mundo, semPosicoes(esc), emCasa)
  const mudou = !!esc.posicoes

  return (
    <div className="campo-tatico">
      <div className="ct-cab">
        <h3 className="sub-tit">{titulo} <span className="ct-form">{esc.formacao}</span></h3>
        {repor && <button className="botao ct-repor" disabled={!mudou} onClick={repor}>Repor posições</button>}
      </div>
      <svg ref={svg} className="ct-svg" viewBox={`-2 -2 ${COMP + 4} ${LARG + 4}`} role="img" aria-label="Campo tático: arrasta os jogadores"
        onPointerMove={(ev) => { if (arr) { const p = ponto(ev); if (p) setArr({ id: arr.id, p }) } }}
        onPointerUp={largar} onPointerCancel={() => setArr(null)}>
        <rect x={0} y={0} width={COMP} height={LARG} className="ct-relva" />
        <rect x={X_MIN} y={0} width={LIMITE_DEF - X_MIN} height={LARG} className="ct-zona ct-z-def" />
        <rect x={LIMITE_DEF} y={0} width={LIMITE_MED - LIMITE_DEF} height={LARG} className="ct-zona ct-z-med" />
        <rect x={LIMITE_MED} y={0} width={X_MAX - LIMITE_MED} height={LARG} className="ct-zona ct-z-av" />
        <text x={(X_MIN + LIMITE_DEF) / 2} y={4.5} className="ct-zona-t">DEFESA</text>
        <text x={(LIMITE_DEF + LIMITE_MED) / 2} y={4.5} className="ct-zona-t">MEIO</text>
        <text x={(LIMITE_MED + X_MAX) / 2} y={4.5} className="ct-zona-t">ATAQUE</text>
        <g className="ct-linhas">
          <rect x={0} y={0} width={COMP} height={LARG} />
          <line x1={COMP / 2} y1={0} x2={COMP / 2} y2={LARG} />
          <circle cx={COMP / 2} cy={LARG / 2} r={9.15} />
          <rect x={0} y={LARG / 2 - 20.16} width={16.5} height={40.32} />
          <rect x={COMP - 16.5} y={LARG / 2 - 20.16} width={16.5} height={40.32} />
          <rect x={0} y={LARG / 2 - 9.16} width={5.5} height={18.32} />
          <rect x={COMP - 5.5} y={LARG / 2 - 9.16} width={5.5} height={18.32} />
        </g>
        <text x={COMP - 2} y={LARG - 2} className="ct-dir" textAnchor="end">ataque →</text>
        {adversario && posicoesDe(adversario).map((p, i) => {
          const id = adversario.titulares[i]
          if (id == null || bloqueados?.has(id)) return null
          return <circle key={`a${id}`} cx={COMP - p[0]} cy={p[1]} r={1.9} className="ct-adv" />
        })}
        {esc.titulares.map((id, i) => {
          const j = mundo.jogadores[id]
          if (!j || bloqueados?.has(id)) return null
          const p = arr?.id === id ? arr.p : ps[i]
          const papel = i === 0 ? 'GR' : arr?.id === id ? papelDaZona(p[0]) : papelNaFormacao(esc.formacao, i)
          const fora = i > 0 && j.posicao !== papel && j.posicao !== 'GR'
          const b = base[i]
          const desviado = i > 0 && arr?.id !== id && (Math.abs(b[0] - p[0]) > 0.5 || Math.abs(b[1] - p[1]) > 0.5)
          return (
            <g key={id} className={`ct-jog ${i === 0 ? 'ct-gr' : ''} ${arr?.id === id ? 'ct-arr' : ''}`}
              onPointerDown={i === 0 ? undefined : (ev) => {
                ev.preventDefault()
                svg.current?.setPointerCapture(ev.pointerId)
                setArr({ id, p: ps[i] })
              }}>
              {desviado && <line x1={b[0]} y1={b[1]} x2={p[0]} y2={p[1]} className="ct-rasto" />}
              <circle cx={p[0]} cy={p[1]} r={3.4} fill={COR[papel]} className="ct-carica" />
              <text x={p[0]} y={p[1] + 1.25} className="ct-num">{i + 1}</text>
              <text x={p[0]} y={p[1] > LARG - 9 ? p[1] - 4.6 : p[1] + 7.4} className={`ct-nome ${fora ? 'ct-fora' : ''}`}>{j.curto.split(' ').pop()}</text>
            </g>
          )
        })}
      </svg>
      <div className="ct-setores">
        {SETORES.map(({ k, t }) => {
          const d = ref[k] > 0 ? Math.round((set[k] / ref[k] - 1) * 100) : 0
          return (
            <div key={k} className="ct-setor">
              <span className="dica">{t}</span>
              <b className={d > 0 ? 'positivo' : d < 0 ? 'negativo' : ''}>{d > 0 ? '+' : ''}{d}%</b>
            </div>
          )
        })}
      </div>
      <p className="dica ct-ajuda">Arrasta as caricas. Mais recuado defende mais e ataca menos; mais adiantado o contrário. Quem passa para outra zona muda de papel (e a formação muda). As percentagens comparam com a formação base.</p>
    </div>
  )
}
