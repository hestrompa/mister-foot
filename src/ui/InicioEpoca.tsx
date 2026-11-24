// Cartão com o dinheiro de arranque da época (TV, patrocinador, lugares anuais, prémio da Liga).
import type { Jogo } from '../core/types'
import { NOMES_DIVISAO } from '../core/mundo'
import { euros, lugares } from '../core/formato'
import './obras-banco.css'
import { PARTE_JORNADA, type EpocaComInicio } from '../core/inicio-epoca'
import { previsaoFimEpoca, type JogoComHistFinancas } from '../core/previsao'

export function InicioEpoca({ jogo, titulo = 'Dinheiro para a nova época' }: { jogo: Jogo; titulo?: string }) {
  const inj = (jogo.epoca as EpocaComInicio).inicio?.[jogo.clubeId]
  if (!inj) return null
  const div = (n?: number) => (n ? NOMES_DIVISAO[n - 1] ?? `${n}.ª Divisão` : '')
  return (
    <section className="cartao inicio-epoca" data-testid="inicio-epoca" aria-label={titulo}>
      <h3 className="sub-tit">{titulo}</h3>
      <p className="ie-total">+{euros(inj.total)} <span>entraram na caixa no arranque da época {jogo.epoca.ano}/{String(jogo.epoca.ano + 1).slice(2)}</span></p>
      <table className="ie-tabela">
        <tbody>
          <tr><td>Direitos de TV</td><td className="num">{euros(inj.tv)}</td><td className="ie-d">igual para todos na divisão</td></tr>
          <tr><td>Patrocinador principal</td><td className="num">{euros(inj.patrocinio)}</td><td className="ie-d">mais nome, contrato maior</td></tr>
          <tr><td>Lugares anuais</td><td className="num">{euros(inj.anuais)}</td><td className="ie-d">{lugares(inj.socios)} sócios com lugar (não pagam bilhete jogo a jogo)</td></tr>
          <tr><td>Prémio da Liga</td><td className="num">{euros(inj.premio)}</td><td className="ie-d">{inj.lugarAnterior ? `${inj.lugarAnterior}.º lugar na ${div(inj.divisaoAnterior)}` : 'sem época anterior'}</td></tr>
        </tbody>
      </table>
      <p className="ie-nota">Durante a época continuam a entrar {Math.round(PARTE_JORNADA * 100)}% das receitas de TV e publicidade por jornada, mais a bilheteira. Gere bem: este dinheiro tem de pagar salários até maio.</p>
    </section>
  )
}

/** Contas da época até agora: o que entrou e saiu, por rubrica. */
export function ContasDaEpoca({ jogo }: { jogo: Jogo }) {
  const e = jogo.epoca as EpocaComInicio
  const id = jogo.clubeId
  const inj = e.inicio?.[id]
  const c = e.contas?.[id]
  const caixa0 = e.caixaInicio?.[id]
  if (!inj || caixa0 === undefined) return null
  const j = jogo as Jogo & { taca?: { ano?: number; receitas?: Record<number, number> }; europa?: { ano?: number; receitas?: Record<number, number> } }
  const taca = j.taca?.ano === e.ano ? j.taca.receitas?.[id] ?? 0 : 0
  const europa = j.europa?.ano === e.ano ? j.europa.receitas?.[id] ?? 0 : 0
  const linhas: [string, number][] = [
    ['Arranque da época', inj.total],
    ['Bilheteira', c?.bilheteira ?? 0],
    ['TV e publicidade (por jornada)', c?.fixas ?? 0],
    ['Taça', taca],
    ['Europa', europa],
    ['Salários (plantel e staff)', -(c?.salarios ?? 0)],
    ['Manutenção do estádio', -(c?.estadio ?? 0)],
    ['Banco (prestações)', -(c?.banco ?? 0)],
  ]
  const resultado = jogo.mundo.clubes[id].dinheiro - caixa0
  const conhecido = linhas.reduce((s, [, v]) => s + v, 0)
  linhas.push(['Mercado, obras, empréstimos e outros', resultado - conhecido])
  return (
    <section className="cartao inicio-epoca contas-epoca" data-testid="contas-epoca" aria-label="Contas da época">
      <h3 className="sub-tit">Contas da época · {c?.jogos ?? 0} jornadas</h3>
      <table className="ie-tabela">
        <tbody>
          {linhas.filter(([, v]) => v !== 0).map(([t, v]) => (
            <tr key={t}><td>{t}</td><td className={`num ${v >= 0 ? 'ie-mais' : 'ie-menos'}`}>{v >= 0 ? '+' : '−'}{euros(Math.abs(v))}</td></tr>
          ))}
          <tr className="ie-res"><td>Resultado</td><td className={`num ${resultado >= 0 ? 'ie-mais' : 'ie-menos'}`}>{resultado >= 0 ? '+' : '−'}{euros(Math.abs(resultado))}</td></tr>
        </tbody>
      </table>
    </section>
  )
}

/** Quanto dinheiro haverá no fim da época se nada mudar. */
export function PrevisaoCaixa({ jogo }: { jogo: Jogo }) {
  const p = previsaoFimEpoca(jogo)
  if (!p.jornadasFalta) return null
  const saldo = p.receitaJornada - p.despesaJornada
  return (
    <section className="cartao inicio-epoca previsao" data-testid="previsao" aria-label="Previsão para o fim da época">
      <h3 className="sub-tit">Previsão para o fim da época</h3>
      <p className={`ie-total ${p.caixaFim < 0 ? 'ie-menos' : ''}`}>{p.caixaFim < 0 ? '−' : ''}{euros(Math.abs(p.caixaFim))} <span>em caixa daqui a {p.jornadasFalta} {p.jornadasFalta === 1 ? 'jornada' : 'jornadas'}</span></p>
      <table className="ie-tabela">
        <tbody>
          <tr><td>Receitas por jornada</td><td className="num ie-mais">+{euros(p.receitaJornada)}</td></tr>
          <tr><td>Salários e estádio por jornada</td><td className="num ie-menos">−{euros(p.despesaJornada)}</td></tr>
          {p.banco > 0 && <tr><td>Prestações do banco até ao fim</td><td className="num ie-menos">−{euros(p.banco)}</td></tr>}
          <tr className="ie-res"><td>Saldo por jornada</td><td className={`num ${saldo >= 0 ? 'ie-mais' : 'ie-menos'}`}>{saldo >= 0 ? '+' : '−'}{euros(Math.abs(saldo))}</td></tr>
        </tbody>
      </table>
      <p className="ie-nota">{p.caixaFim < 0 ? 'A este ritmo acabas a época no vermelho: vende, corta salários ou sobe o bilhete.' : 'Sem contar com taça, Europa, transferências e obras.'}</p>
    </section>
  )
}

/** Dinheiro no fim de cada época já jogada. */
export function HistoricoFinancas({ jogo }: { jogo: Jogo }) {
  const h = (jogo as JogoComHistFinancas).histFinancas ?? []
  if (!h.length) return null
  return (
    <section className="cartao inicio-epoca" data-testid="hist-financas" aria-label="Épocas anteriores">
      <h3 className="sub-tit">Épocas anteriores</h3>
      <table className="ie-tabela">
        <thead><tr><th>Época</th><th>Lugar</th><th className="num">Receitas</th><th className="num">Salários</th><th className="num">Caixa no fim</th></tr></thead>
        <tbody>
          {[...h].reverse().map((e) => (
            <tr key={e.ano}>
              <td>{e.ano}/{String(e.ano + 1).slice(2)}</td>
              <td>{e.lugar}.º · {e.divisao}.ª</td>
              <td className="num">{euros(e.receitas)}</td>
              <td className="num">{euros(e.salarios)}</td>
              <td className={`num ${e.caixaFim >= 0 ? 'ie-mais' : 'ie-menos'}`}>{e.caixaFim < 0 ? '−' : ''}{euros(Math.abs(e.caixaFim))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
