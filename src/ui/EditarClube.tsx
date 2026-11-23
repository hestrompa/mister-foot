// Editar nome, sigla, estádio, cores e emblema de um clube, e os nomes dos jogadores.
import { useState } from 'react'
import type { Jogo } from '../core/types'
import { dadosDe, editarClube, editarJogador, FORMAS, PADROES, validarClube, type DadosClube } from '../core/editar'
import { Emblema } from './Emblema'
import './editar.css'

export function EditarClube({ jogo, clubeId, atualizar, fechar }: { jogo: Jogo; clubeId: number; atualizar: (j: Jogo) => void; fechar: () => void }) {
  const { mundo } = jogo
  const c = mundo.clubes[clubeId]
  const [d, setD] = useState<DadosClube>(() => dadosDe(c))
  const [nomes, setNomes] = useState<Record<number, string>>({})
  const [erro, setErro] = useState<string | null>(null)
  const muda = (p: Partial<DadosClube>) => { setD({ ...d, ...p }); setErro(null) }
  const previa = { ...c, nome: d.nome, sigla: d.sigla.toUpperCase(), cores: d.cores, emblema: d.emblema }
  const aviso = validarClube(mundo, clubeId, d)
  const gravar = () => {
    const e = editarClube(mundo, clubeId, d)
    if (e) { setErro(e); return }
    for (const [id, n] of Object.entries(nomes)) {
      const ej = editarJogador(mundo, Number(id), n)
      if (ej) { setErro(`${mundo.jogadores[Number(id)]?.nome}: ${ej}`); return }
    }
    atualizar(jogo)
    fechar()
  }
  return (
    <form className="cartao ed-clube" onSubmit={(e) => { e.preventDefault(); gravar() }}>
      <div className="ed-topo">
        <Emblema clube={previa} tamanho={72} />
        <div className="ed-campos">
          <label>Nome do clube<input value={d.nome} maxLength={40} onChange={(e) => muda({ nome: e.target.value })} /></label>
          <div className="ed-linha">
            <label className="ed-sigla">Sigla<input value={d.sigla} maxLength={3} onChange={(e) => muda({ sigla: e.target.value.toUpperCase() })} /></label>
            <label className="ed-cor">Cor 1<input type="color" value={d.cores[0]} onChange={(e) => muda({ cores: [e.target.value, d.cores[1]] })} /></label>
            <label className="ed-cor">Cor 2<input type="color" value={d.cores[1]} onChange={(e) => muda({ cores: [d.cores[0], e.target.value] })} /></label>
          </div>
          <label>Estádio<input value={d.estadio} maxLength={40} onChange={(e) => muda({ estadio: e.target.value })} /></label>
        </div>
      </div>
      <p className="sub-tit">Forma do emblema</p>
      <div className="ed-opcoes">
        {FORMAS.map((f) => (
          <button type="button" key={f.v} className={`botao ed-op ${d.emblema.forma === f.v ? 'ativo' : ''}`} onClick={() => muda({ emblema: { ...d.emblema, forma: f.v } })}>
            <Emblema clube={{ ...previa, emblema: { ...d.emblema, forma: f.v } } as never} tamanho={28} /> {f.t}
          </button>
        ))}
      </div>
      <p className="sub-tit">Padrão</p>
      <div className="ed-opcoes">
        {PADROES.map((p) => (
          <button type="button" key={p.v} className={`botao ed-op ${d.emblema.padrao === p.v ? 'ativo' : ''}`} onClick={() => muda({ emblema: { ...d.emblema, padrao: p.v } })}>
            <Emblema clube={{ ...previa, emblema: { ...d.emblema, padrao: p.v } } as never} tamanho={28} /> {p.t}
          </button>
        ))}
      </div>
      <details className="ed-jogadores">
        <summary>Nomes dos jogadores</summary>
        <div className="ed-lista">
          {c.plantel.map((id) => mundo.jogadores[id]).filter(Boolean).map((j) => (
            <label key={j.id}><span className={`pos pos-${j.posicao}`}>{j.posicao}</span>
              <input value={nomes[j.id] ?? j.nome} maxLength={40} aria-label={`Nome de ${j.nome}`} onChange={(e) => setNomes({ ...nomes, [j.id]: e.target.value })} />
            </label>
          ))}
        </div>
      </details>
      {(erro || aviso) && <p className="ed-erro">{erro ?? aviso}</p>}
      <div className="ed-acoes">
        <button type="button" className="botao fantasma" onClick={fechar}>Cancelar</button>
        <button type="button" className="botao fantasma" onClick={() => { setD(dadosDe(c)); setNomes({}); setErro(null) }}>Repor</button>
        <button type="submit" className="botao principal" disabled={!!aviso}>Guardar</button>
      </div>
    </form>
  )
}
