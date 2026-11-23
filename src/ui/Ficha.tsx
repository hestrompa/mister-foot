// Ficha de um jogo: resultado, táticas, onzes, substituições, golos, cartões e estatísticas.
import type { Jogo } from '../core/types'
import { fichasDe, posturaFinal, type EquipaFicha, type EventoFicha, type FichaJogo } from '../core/fichas'
import { lugares } from '../core/formato'
import { Emblema } from './Emblema'
import './ficha.css'

const POSTURA: Record<string, string> = { defensiva: 'Defensiva', equilibrada: 'Equilibrada', ofensiva: 'Ofensiva' }

/** Ícone desenhado em CSS (as letras de emoji variam muito entre sistemas). */
function Icone({ t }: { t: EventoFicha['tipo'] }) {
  return <i className={`fi-i fi-i-${t}`} aria-hidden="true" />
}

function EmblemaFicha({ e, tamanho = 28 }: { e: EquipaFicha; tamanho?: number }) {
  return <Emblema clube={{ nome: e.nome, sigla: e.sigla, cores: e.cores } as never} tamanho={tamanho} />
}

function Onze({ e, f, lado }: { e: EquipaFicha; f: FichaJogo; lado: 0 | 1 }) {
  const ev = f.eventos.filter((x) => x.lado === lado)
  const marcas = (nome: string) => {
    const out: { t: EventoFicha['tipo']; m: string }[] = []
    for (const x of ev) {
      if (x.quem !== nome && !(x.tipo === 'substituicao' && x.outro === nome)) continue
      if (x.tipo === 'golo' && x.quem === nome) out.push({ t: 'golo', m: `${x.minuto}'` })
      if (x.tipo === 'amarelo' && x.quem === nome) out.push({ t: 'amarelo', m: `${x.minuto}'` })
      if (x.tipo === 'vermelho' && x.quem === nome) out.push({ t: 'vermelho', m: `${x.minuto}'` })
      if (x.tipo === 'lesao' && x.quem === nome) out.push({ t: 'lesao', m: `${x.minuto}'` })
      if (x.tipo === 'substituicao' && x.quem === nome) out.push({ t: 'substituicao', m: `sai ${x.minuto}'` })
      if (x.tipo === 'substituicao' && x.outro === nome) out.push({ t: 'substituicao', m: `entra ${x.minuto}'` })
    }
    return out.map((o, i) => <span key={i} className="fi-marca"><Icone t={o.t} />{o.m}</span>)
  }
  const fim = posturaFinal(f, lado)
  const entraram = new Set(ev.filter((x) => x.tipo === 'substituicao').map((x) => x.outro))
  return (
    <div className="cartao fi-onze">
      <h4 className="fi-onze-tit"><EmblemaFicha e={e} tamanho={24} /> {e.nome}</h4>
      {e.formacao
        ? <p className="fi-tatica"><b>{e.formacao}</b> · {POSTURA[e.postura ?? 'equilibrada']}{fim && fim !== e.postura ? ` → ${POSTURA[fim]}` : ''}</p>
        : <p className="dica">Tática e onze não registados (jogo de uma versão antiga).</p>}
      {e.titulares.length > 0 && (
        <ol className="fi-lista">
          {e.titulares.map((j) => (
            <li key={j.id}><span className={`pos pos-${j.pos}`}>{j.pos}</span> <span className="fi-nome">{j.nome}</span> <span className="fi-f">{j.forca}</span> <span className="fi-marcas">{marcas(j.nome)}</span></li>
          ))}
        </ol>
      )}
      {e.suplentes.length > 0 && (
        <>
          <p className="fi-sup-tit">Suplentes</p>
          <ul className="fi-lista fi-sup">
            {e.suplentes.map((j) => (
              <li key={j.id} className={entraram.has(j.nome) ? 'entrou' : ''}><span className={`pos pos-${j.pos}`}>{j.pos}</span> <span className="fi-nome">{j.nome}</span> <span className="fi-f">{j.forca}</span> <span className="fi-marcas">{marcas(j.nome)}</span></li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

export function Ficha({ f, voltar }: { f: FichaJogo; voltar: () => void }) {
  const s = f.estat
  const linha = (t: string, v: [number, number], suf = '') => (
    <tr key={t}><td className="num">{v[0]}{suf}</td><td className="fi-et">{t}</td><td className="num">{v[1]}{suf}</td></tr>
  )
  const marcos = f.eventos.filter((e) => e.tipo !== 'oportunidade')
  return (
    <div className="ficha">
      <div className="topo outro-clube">
        <button className="botao fantasma" onClick={voltar}>Voltar</button>
        <h3>{f.ronda} · {f.ano}/{String(f.ano + 1).slice(2)}</h3>
      </div>
      <div className="cartao fi-placar">
        <span className="fi-eq"><EmblemaFicha e={f.casa} tamanho={40} /> {f.casa.nome}</span>
        <span className="fi-res">{f.golos[0]}-{f.golos[1]}{f.penaltis ? <small> ({f.penaltis[0]}-{f.penaltis[1]} g.p.)</small> : null}{f.prolongamento && !f.penaltis ? <small> a.p.</small> : null}</span>
        <span className="fi-eq fora">{f.fora.nome} <EmblemaFicha e={f.fora} tamanho={40} /></span>
      </div>
      {(f.porque || f.publico) && <p className="nota">{f.porque}{f.porque && f.publico ? ' · ' : ''}{f.publico ? `${lugares(f.publico)} espectadores` : ''}</p>}
      <div className="fi-grelha">
        <Onze e={f.casa} f={f} lado={0} />
        <div className="cartao fi-meio">
          <h4>Estatísticas</h4>
          <table className="fi-estat"><tbody>
            {linha('Posse', s.posse, '%')}
            {linha('Remates', s.remates)}
            {linha('À baliza', s.rematesBaliza)}
            {linha('Cantos', s.cantos)}
            {linha('Amarelos', s.amarelos)}
            {linha('Vermelhos', s.vermelhos)}
          </tbody></table>
          <h4>Momentos</h4>
          {marcos.length ? (
            <ul className="fi-eventos">
              {marcos.map((e, i) => (
                <li key={i} className={`fi-ev lado-${e.lado}`}><span className="fi-min">{e.minuto}'</span> <Icone t={e.tipo} /> {e.texto}</li>
              ))}
            </ul>
          ) : <p className="dica">Sem golos nem cartões.</p>}
        </div>
        <Onze e={f.fora} f={f} lado={1} />
      </div>
    </div>
  )
}

/** Jogos das épocas anteriores, por época. */
export function JogosAnteriores({ jogo, abrir }: { jogo: Jogo; abrir: (id: string) => void }) {
  const fichas = fichasDe(jogo).filter((f) => f.ano < jogo.epoca.ano)
  if (!fichas.length) return null
  const anos = [...new Set(fichas.map((f) => f.ano))].sort((a, b) => b - a)
  return (
    <details className="fi-anteriores">
      <summary>Jogos das épocas anteriores</summary>
      {anos.map((ano) => (
        <div key={ano}>
          <h4 className="sub-tit">Época {ano}/{String(ano + 1).slice(2)}</h4>
          <div className="tabela-wrap">
            <table className="tabela calendario">
              <tbody>
                {fichas.filter((f) => f.ano === ano).map((f) => {
                  const casa = f.casa.id === jogo.clubeId || (f.fora.id !== jogo.clubeId)
                  const adv = casa ? f.fora : f.casa
                  const [a, b] = casa ? f.golos : [f.golos[1], f.golos[0]]
                  let r = a > b ? 'V' : a < b ? 'D' : 'E'
                  if (f.penaltis) { const [pa, pb] = casa ? f.penaltis : [f.penaltis[1], f.penaltis[0]]; r = pa > pb ? 'V' : 'D' }
                  return (
                    <tr key={f.id} className="clicavel" onClick={() => abrir(f.id)}>
                      <td>{f.ronda}</td>
                      <td><span className="casa-fora">{casa ? 'C' : 'F'}</span></td>
                      <td><span className="clube-linha"><EmblemaFicha e={adv} tamanho={22} /> {adv.nome}</span></td>
                      <td className="num"><span className={`resultado res-${r}`}>{f.golos[0]}-{f.golos[1]}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </details>
  )
}
