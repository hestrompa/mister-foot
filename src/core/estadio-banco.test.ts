import { describe, expect, it } from 'vitest'
import { gerarMundo } from './mundo'
import { concluirJornada, novaEpoca } from './epoca'
import { publicoEsperado } from './financas'
import { custoObra, duracaoObra, iniciarObra, lotacaoAtual, motivoSemObra } from './estadio'
import { juroTotal, limiteCredito, liquidar, pedirEmprestimo, prestacaoDe } from './banco'

describe('obras no estádio', () => {
  it('paga já, fecha parte das bancadas e inaugura ao fim das jornadas certas', () => {
    const m = gerarMundo(3)
    const id = m.divisoes[2].clubes[0]
    const c = m.clubes[id]
    c.dinheiro = 1_000_000
    const antes = c.estadio.lugares
    expect(iniciarObra(c, 2_500)).toBe(true)
    expect(c.dinheiro).toBe(1_000_000 - custoObra(2_500))
    expect(lotacaoAtual(c)).toBeLessThan(antes)
    expect(motivoSemObra(c, 1_000)).toMatch(/obra/)
    const e = novaEpoca(m, 1)
    const n = duracaoObra(2_500)
    for (let j = 0; j < n - 1; j++) concluirJornada(m, e, j)
    expect(c.estadio.lugares).toBe(antes)
    concluirJornada(m, e, 99)
    expect(c.estadio.lugares).toBe(antes + 2_500)
    expect(c.estadio.obra).toBeUndefined()
    expect(e.ultimoBalanco?.[id]?.inaugurados).toBe(2_500)
  })

  it('sem dinheiro não há obra', () => {
    const m = gerarMundo(3)
    const c = m.clubes[m.divisoes[3].clubes[0]]
    c.dinheiro = 1_000
    expect(iniciarObra(c, 1_000)).toBe(false)
    expect(c.estadio.obra).toBeUndefined()
  })

  it('mais lugares trazem mais público, mas menos do que proporcional', () => {
    const m = gerarMundo(4)
    const [a, b] = m.divisoes[1].clubes.map((i) => m.clubes[i])
    a.bilhete = 20 // caro: o estádio não enche
    const antes = publicoEsperado(a, b, 0, 18)
    a.dinheiro = 10_000_000
    iniciarObra(a, 10_000)
    a.estadio.lugares += 10_000
    delete a.estadio.obra
    const depois = publicoEsperado(a, b, 0, 18)
    expect(depois).toBeGreaterThan(antes)
    expect(antes).toBeLessThan(a.estadio.base!)
    expect(depois - antes).toBeLessThan(5_000)
  })
})

describe('banco', () => {
  it('empresta até ao limite e cobra montante + juros em prestações', () => {
    const m = gerarMundo(5)
    const id = m.divisoes[3].clubes[0]
    const c = m.clubes[id]
    const limite = limiteCredito(c)
    expect(limite).toBeGreaterThan(0)
    expect(pedirEmprestimo(c, limite + 10_000, 34)).toBe(false)
    const montante = Math.floor(limite / 20_000) * 10_000
    const d0 = c.dinheiro
    expect(pedirEmprestimo(c, montante, 17)).toBe(true)
    expect(c.dinheiro).toBe(d0 + montante)
    expect(pedirEmprestimo(c, 10_000, 17)).toBe(false)
    const p = prestacaoDe(c, montante, 17)
    expect(p * 17).toBeGreaterThanOrEqual(montante + juroTotal(c, montante, 17))
    const e = novaEpoca(m, 2)
    let pago = 0
    for (let j = 0; j < 17; j++) {
      concluirJornada(m, e, j)
      pago += e.ultimoBalanco?.[id]?.banco ?? 0
    }
    expect(c.emprestimo).toBeUndefined()
    expect(pago).toBe(p * 17)
    concluirJornada(m, e, 50)
    expect(e.ultimoBalanco?.[id]?.banco).toBeUndefined()
  })

  it('liquidar paga só o capital que falta', () => {
    const m = gerarMundo(6)
    const c = m.clubes[m.divisoes[0].clubes[0]]
    pedirEmprestimo(c, 1_000_000, 34)
    const e = novaEpoca(m, 3)
    for (let j = 0; j < 17; j++) concluirJornada(m, e, j)
    const cap = c.emprestimo!.capital
    expect(cap).toBe(500_000)
    const d = c.dinheiro
    expect(liquidar(c)).toBe(true)
    expect(c.dinheiro).toBe(d - cap)
    expect(c.emprestimo).toBeUndefined()
  })
})
