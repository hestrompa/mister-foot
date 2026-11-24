import { describe, expect, it } from 'vitest'
import { gerarMundo } from './mundo'
import { novaEpoca, concluirJornada, epocaTerminada, fecharEpoca, tabela } from './epoca'
import { pagarInicioEpoca, fixasEpoca, type EpocaComInicio } from './inicio-epoca'

describe('dinheiro de arranque de época', () => {
  it('paga TV, patrocínio e lugares anuais a todos; sem prémio num jogo novo', () => {
    const mundo = gerarMundo(7)
    const antes = Object.fromEntries(Object.values(mundo.clubes).map((c) => [c.id, c.dinheiro]))
    const epoca = novaEpoca(mundo, 1)
    const inj = pagarInicioEpoca(mundo, epoca, [])
    for (const c of Object.values(mundo.clubes)) {
      const i = inj[c.id]
      expect(i.tv).toBeGreaterThan(0)
      expect(i.premio).toBe(0)
      expect(c.dinheiro - antes[c.id]).toBe(i.total)
    }
    expect((epoca as EpocaComInicio).inicio).toBe(inj)
  })

  it('o prémio da Liga favorece o campeão e o patrocínio a reputação', () => {
    const mundo = gerarMundo(9)
    const ep = novaEpoca(mundo, 2)
    let n = 0
    while (!epocaTerminada(ep)) concluirJornada(mundo, ep, 100 + n++)
    const tabs = ep.calendario.map((_, d) => tabela(mundo, ep, d + 1))
    fecharEpoca(mundo, ep)
    const nova = novaEpoca(mundo, 3)
    const inj = pagarInicioEpoca(mundo, nova, tabs)
    const t1 = tabs[0]
    const camp = inj[t1[0].clubeId], ultimo = inj[t1[t1.length - 1].clubeId]
    expect(camp.lugarAnterior).toBe(1)
    expect(camp.premio).toBeGreaterThan(ultimo.premio * 5)
    // O bolo de cada divisão é PARTE_PREMIO das receitas fixas por clube, em média.
    const soma = t1.reduce((s, l) => s + inj[l.clubeId].premio, 0)
    expect(soma / t1.length).toBeGreaterThan(fixasEpoca(1) * 0.15)
    expect(soma / t1.length).toBeLessThan(fixasEpoca(1) * 0.25)
  })
})
