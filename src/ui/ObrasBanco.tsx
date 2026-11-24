// Separador Clube: obras no estádio e empréstimo ao banco.
import { useState } from 'react'
import type { Jogo } from '../core/types'
import { OBRAS, custoObra, duracaoObra, iniciarObra, lotacaoAtual, motivoSemObra } from '../core/estadio'
import { JURO_EPOCA, PRAZOS, juroTotal, limiteCredito, liquidar, motivoSemEmprestimo, pedirEmprestimo, prestacaoDe } from '../core/banco'
import { euros, lugares } from '../core/formato'
import { MANUTENCAO_LUGAR } from '../core/financas'
import './obras-banco.css'
import { ContasDaEpoca, InicioEpoca } from './InicioEpoca'

const NOME_PRAZO: Record<number, string> = { 17: 'Meia época', 34: '1 época', 68: '2 épocas' }

export function ObrasBanco({ jogo, atualizar }: { jogo: Jogo; atualizar: (j: Jogo) => void }) {
  const c = jogo.mundo.clubes[jogo.clubeId]
  const [obra, setObra] = useState(OBRAS[0])
  const limite = limiteCredito(c)
  const [montante, setMontante] = useState(0)
  const [prazo, setPrazo] = useState(34)
  const m = Math.min(montante || Math.min(limite, Math.max(10_000, Math.round(limite / 2 / 10_000) * 10_000)), limite)
  const o = c.estadio.obra
  const e = c.emprestimo
  const semObra = motivoSemObra(c, obra)
  const semEmp = motivoSemEmprestimo(c, m, prazo)

  return (
    <div className="obras-banco">
      <InicioEpoca jogo={jogo} titulo="Arranque da época" />
      <ContasDaEpoca jogo={jogo} />
      <section className="cartao ob-cartao" aria-label="Obras no estádio">
        <h3 className="sub-tit">Obras no estádio</h3>
        {o ? (
          <>
            <p>A acrescentar <b>{lugares(o.lugares)} lugares</b>. Faltam <b>{o.falta}</b> {o.falta === 1 ? 'jornada' : 'jornadas'}.</p>
            <div className="ob-barra" role="progressbar" aria-valuemin={0} aria-valuemax={o.total} aria-valuenow={o.total - o.falta}>
              <span style={{ width: `${Math.round(((o.total - o.falta) / o.total) * 100)}%` }} />
            </div>
            <p className="nota">Durante as obras há {lugares(lotacaoAtual(c))} lugares disponíveis (parte das bancadas está fechada).</p>
          </>
        ) : (
          <>
            <p className="nota">Hoje: {lugares(c.estadio.lugares)} lugares. Mais lugares só rendem se houver procura: os novos atraem metade do público dos antigos.</p>
            <div className="ob-opcoes" role="radiogroup" aria-label="Tamanho da obra">
              {OBRAS.map((n) => (
                <button key={n} role="radio" aria-checked={obra === n} className={`botao ${obra === n ? 'sel' : ''}`} onClick={() => setObra(n)}>
                  +{lugares(n)}
                </button>
              ))}
            </div>
            <p>Custo <b>{euros(custoObra(obra))}</b>, pago já · demora <b>{duracaoObra(obra)} jornadas</b> · manutenção +{euros(Math.round(obra * (MANUTENCAO_LUGAR[c.divisao - 1] ?? 0.2)))} por jornada</p>
            {semObra && <p className="ob-aviso">{semObra}</p>}
            <button className="botao principal" disabled={!!semObra} onClick={() => { if (iniciarObra(c, obra)) atualizar(jogo) }}>
              Começar obra
            </button>
          </>
        )}
      </section>

      <section className="cartao ob-cartao" aria-label="Banco">
        <h3 className="sub-tit">Banco</h3>
        {e ? (
          <>
            <p>Empréstimo de <b>{euros(e.montante)}</b>: prestação de <b>{euros(e.prestacao)}</b> por jornada, faltam <b>{e.falta}</b>.</p>
            <p className="nota">Capital por pagar: {euros(e.capital)}. Liquidar já poupa os juros que faltam.</p>
            {c.dinheiro < e.capital && <p className="ob-aviso">Não há dinheiro em caixa para liquidar.</p>}
            <button className="botao" disabled={c.dinheiro < e.capital} onClick={() => { if (liquidar(c)) atualizar(jogo) }}>
              Liquidar {euros(e.capital)}
            </button>
          </>
        ) : limite <= 0 ? (
          <p className="nota">O banco não empresta mais dinheiro a este clube por agora.</p>
        ) : (
          <>
            <p className="nota">O banco empresta até {euros(limite)} · juro de {Math.round((JURO_EPOCA[c.divisao - 1] ?? 0.1) * 100)}% por época.</p>
            <label className="ob-montante">
              <span>Montante: <b>{euros(m)}</b></span>
              <input type="range" min={10_000} max={Math.max(10_000, limite)} step={10_000} value={m} onChange={(ev) => setMontante(Number(ev.target.value))} />
            </label>
            <div className="ob-opcoes" role="radiogroup" aria-label="Prazo">
              {PRAZOS.map((p) => (
                <button key={p} role="radio" aria-checked={prazo === p} className={`botao ${prazo === p ? 'sel' : ''}`} onClick={() => setPrazo(p)}>
                  {NOME_PRAZO[p] ?? `${p} jornadas`}
                </button>
              ))}
            </div>
            <p>Prestação <b>{euros(prestacaoDe(c, m, prazo))}</b> por jornada · juros {euros(juroTotal(c, m, prazo))} no total</p>
            {semEmp && <p className="ob-aviso">{semEmp}</p>}
            <button className="botao principal" disabled={!!semEmp} onClick={() => { if (pedirEmprestimo(c, m, prazo)) { setMontante(0); atualizar(jogo) } }}>
              Pedir empréstimo
            </button>
          </>
        )}
      </section>
    </div>
  )
}
