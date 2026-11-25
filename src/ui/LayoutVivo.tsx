import { useState, type ReactNode } from 'react'
import './layout-vivo.css'

type Aba = 'relato' | 'jogos' | 'tabela'

/**
 * Esqueleto do jogo ao vivo: ocupa o ecrã inteiro sem scroll da página.
 * - Ecrã largo: relato | placar + campo | jogos + tabela.
 * - Ecrã médio deitado: placar + campo | abas.
 * - Vertical: placar, campo, controlos e abas por baixo.
 * - Telemóvel deitado: campo à esquerda, o resto à direita.
 * Só as listas (relato, jogos, tabela, painel) fazem scroll por dentro.
 */
export function LayoutVivo({ placar, controlos, palco, painel, relato, jogos, tituloJogos, tabela }: {
  placar: ReactNode
  controlos: ReactNode
  palco: ReactNode
  painel?: ReactNode
  relato: ReactNode
  jogos: ReactNode
  tituloJogos: string
  tabela?: ReactNode
}) {
  const [aba, setAba] = useState<Aba>('relato')
  const abas: [Aba, string][] = [['relato', 'Relato'], ['jogos', 'Jogos'], ...(tabela ? [['tabela', 'Tabela'] as [Aba, string]] : [])]
  return (
    <div className={`lv ${painel ? 'com-painel' : ''} ${tabela ? '' : 'sem-tabela'}`} data-aba={aba} data-testid="layout-vivo">
      <div className="lv-placar">{placar}</div>
      <div className="lv-ctl">{controlos}</div>
      <div className="lv-palco">{palco}</div>
      {painel && <div className="lv-painel">{painel}</div>}
      <nav className="lv-abas" aria-label="Painéis do jogo">
        {abas.map(([k, t]) => <button key={k} className={aba === k ? 'ativo' : ''} onClick={() => setAba(k)}>{t}</button>)}
      </nav>
      <section className="cartao lv-p lv-relato relato">
        <h3 className="sub-tit">Relato</h3>
        {relato}
      </section>
      <div className="lv-lado">
        <section className="cartao lv-p lv-jogos placares">
          <h3 className="sub-tit">{tituloJogos}</h3>
          {jogos}
        </section>
        {tabela && (
          <section className="lv-p lv-tabela">
            <h3 className="sub-tit">Classificação ao vivo</h3>
            {tabela}
          </section>
        )}
      </div>
    </div>
  )
}
