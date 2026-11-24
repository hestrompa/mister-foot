// Escolha da pré-época no separador Jogo (só antes da 1.ª jornada).
import { useState } from 'react'
import type { Jogo } from '../core/types'
import { escolherPreEpoca, opcoesPreEpoca, preEpocaPendente } from '../core/pre-epoca'
import { euros } from '../core/formato'
import './conquistas.css'

export function PreEpoca({ jogo, atualizar }: { jogo: Jogo; atualizar: (j: Jogo) => void }) {
  const [erro, setErro] = useState('')
  if (!preEpocaPendente(jogo)) return null
  return (
    <section className="cartao pre-epoca" aria-label="Pré-época" data-testid="pre-epoca">
      <h3 className="sub-tit">Pré-época · escolhe antes da 1.ª jornada</h3>
      <div className="pe-opcoes">
        {opcoesPreEpoca(jogo).map((o) => (
          <button key={o.tipo} className="botao pe-opcao" onClick={() => { if (escolherPreEpoca(jogo, o.tipo)) { setErro(''); atualizar(jogo) } else setErro('Não tens dinheiro para isso.') }}>
            <b>{o.nome}</b>
            <span>{o.texto}</span>
            <span className="pe-efeito">{o.dinheiro ? `${o.dinheiro > 0 ? '+' : '−'}${euros(Math.abs(o.dinheiro))}` : 'sem custos'}{o.moral ? ` · moral ${o.moral > 0 ? '+' : ''}${o.moral}` : ''}</span>
          </button>
        ))}
      </div>
      {erro && <p className="erro">{erro}</p>}
    </section>
  )
}
