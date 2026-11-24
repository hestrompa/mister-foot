// Plano de jogo no pré-jogo: marcação, bolas paradas, batedor e instruções individuais.
import { useState } from 'react'
import type { Jogo } from '../core/types'
import type { Escalacao } from '../core/partida'
import { atributo } from '../core/atributos'
import {
  comInstrucao, DICA_CANTO, DICA_INSTRUCAO, DICA_MARCACAO, NOME_CANTO, NOME_INSTRUCAO, NOME_LIVRE, NOME_MARCACAO,
  type EsquemaCanto, type EsquemaLivre, type Instrucao, type Marcacao, type PlanoJogo,
} from '../core/plano'
import './plano.css'

const MARCACOES: Marcacao[] = ['zona', 'homem', 'pressao']
const CANTOS: EsquemaCanto[] = ['area', 'curto', 'entrada']
const LIVRES: EsquemaLivre[] = ['direto', 'cruzar']
const INSTRUCOES: Instrucao[] = ['subir', 'segurar', 'rematar', 'marcar']

/** Escolha de marcação (também usada ao intervalo). */
export function EscolhaMarcacao({ valor, mudar }: { valor: Marcacao; mudar: (m: Marcacao) => void }) {
  return (
    <div className="campo">Marcação
      <div className="grupo-botoes">
        {MARCACOES.map((m) => (
          <button key={m} className={`botao ${valor === m ? 'ativo' : ''}`} onClick={() => mudar(m)}>{NOME_MARCACAO[m]}</button>
        ))}
      </div>
      <span className="plano-dica">{DICA_MARCACAO[valor]}</span>
    </div>
  )
}

export function PlanoJogoCartao({ jogo, mudar, escAdv }: { jogo: Jogo; mudar: (e: Escalacao) => void; escAdv?: Escalacao }) {
  const { mundo } = jogo
  const esc = jogo.escalacao
  const plano: PlanoJogo = esc.plano ?? {}
  const [aberto, setAberto] = useState(false)
  const set = (p: PlanoJogo) => mudar({ ...esc, plano: p })
  const campo = esc.titulares.map((id) => mundo.jogadores[id]).filter((j) => j && j.posicao !== 'GR')
  const porRemate = campo.slice().sort((a, b) => atributo(b, 'rem') - atributo(a, 'rem'))
  const batedorEmCampo = plano.batedor != null && esc.titulares.includes(plano.batedor)
  const instrucoes = plano.instrucoes ?? {}
  const nInst = esc.titulares.filter((id) => instrucoes[id]).length
  const marcador = esc.titulares.find((id) => instrucoes[id] === 'marcar')
  const alvos = (escAdv?.titulares ?? []).map((id) => mundo.jogadores[id]).filter((j) => j && j.posicao !== 'GR')
    .sort((a, b) => b.forca - a.forca)

  return (
    <div className="cartao plano-jogo" data-testid="plano-jogo">
      <h3 className="sub-tit">Plano de jogo</h3>
      <EscolhaMarcacao valor={plano.marcacao ?? 'zona'} mudar={(m) => set({ ...plano, marcacao: m })} />
      <div className="campo">Cantos
        <div className="grupo-botoes">
          {CANTOS.map((c) => (
            <button key={c} className={`botao ${(plano.canto ?? 'area') === c ? 'ativo' : ''}`} onClick={() => set({ ...plano, canto: c })}>{NOME_CANTO[c]}</button>
          ))}
        </div>
        <span className="plano-dica">{DICA_CANTO[plano.canto ?? 'area']}</span>
      </div>
      <div className="plano-linha">
        <div className="campo">Livres
          <div className="grupo-botoes">
            {LIVRES.map((l) => (
              <button key={l} className={`botao ${(plano.livre ?? 'direto') === l ? 'ativo' : ''}`} onClick={() => set({ ...plano, livre: l })}>{NOME_LIVRE[l]}</button>
            ))}
          </div>
        </div>
        <label className="campo">Batedor (livres e penáltis)
          <select value={batedorEmCampo ? plano.batedor : ''} onChange={(e) => {
            const v = e.target.value
            const p = { ...plano }
            if (v === '') delete p.batedor
            else p.batedor = Number(v)
            set(p)
          }}>
            <option value="">Automático (melhor remate)</option>
            {porRemate.map((j) => <option key={j.id} value={j.id}>{j.curto} · REM {atributo(j, 'rem')}</option>)}
          </select>
        </label>
      </div>

      <button className="botao plano-abrir" onClick={() => setAberto(!aberto)} aria-expanded={aberto}>
        {aberto ? 'Esconder instruções individuais' : `Instruções individuais${nInst ? ` (${nInst})` : ''}`}
      </button>
      {aberto && (
        <div className="plano-inst">
          {campo.map((j) => {
            const v = instrucoes[j.id]
            return (
              <div key={j.id} className="plano-jog">
                <span className={`pos pos-${j.posicao}`}>{j.posicao}</span>
                <span className="nome-jogador">{j.curto}</span>
                <span className="plano-attr">REM {atributo(j, 'rem')} · VEL {atributo(j, 'vel')} · DEF {atributo(j, 'def')}</span>
                <select aria-label={`Instrução para ${j.curto}`} value={v ?? ''} onChange={(e) => set(comInstrucao(plano, j.id, (e.target.value || undefined) as Instrucao | undefined))}>
                  <option value="">Normal</option>
                  {INSTRUCOES.map((i) => <option key={i} value={i}>{NOME_INSTRUCAO[i]}</option>)}
                </select>
              </div>
            )
          })}
          {marcador != null && (
            <label className="campo">{mundo.jogadores[marcador].curto} marca de perto
              <select value={plano.alvo ?? ''} onChange={(e) => set({ ...plano, alvo: e.target.value ? Number(e.target.value) : undefined })}>
                <option value="">Escolhe o adversário</option>
                {alvos.map((j) => <option key={j.id} value={j.id}>{j.curto} ({j.posicao}, {j.forca}){j.craque ? ' · craque' : ''}</option>)}
              </select>
            </label>
          )}
          <ul className="plano-legenda">
            {INSTRUCOES.map((i) => <li key={i}><b>{NOME_INSTRUCAO[i]}:</b> {DICA_INSTRUCAO[i]}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}
