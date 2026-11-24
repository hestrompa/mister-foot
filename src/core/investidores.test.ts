import { describe, expect, it } from 'vitest'
import { gerarMundo } from './mundo'
import { concluirJornada, epocaTerminada, novaEpoca } from './epoca'
import { avancarInvestidores, confiancasFimEpoca, verbaDirecao, type EpocaComInvestidores } from './investidores'
import { fixasEpoca } from './inicio-epoca'
import { tabela } from './epoca'

describe('verba da direção e investidores', () => {
  it('a verba cresce com a confiança e é zero abaixo de 60', () => {
    expect(verbaDirecao(1, 50)).toBe(0)
    expect(verbaDirecao(1, 60)).toBe(0)
    expect(verbaDirecao(1, 80)).toBeGreaterThan(0)
    expect(verbaDirecao(1, 100)).toBeGreaterThan(verbaDirecao(1, 80))
    expect(verbaDirecao(1, 100)).toBeLessThanOrEqual(fixasEpoca(1) * 0.5)
  })

  it('investidores só entram em quem supera o esperado, uma vez por clube, e a confiança da IA segue o lugar', () => {
    const mundo = gerarMundo(11)
    const ep = novaEpoca(mundo, 4) as EpocaComInvestidores
    let n = 0
    const todos = []
    while (!epocaTerminada(ep)) { concluirJornada(mundo, ep, 900 + n++); todos.push(...avancarInvestidores(mundo, ep)) }
    expect(todos.every((i) => i.jornada >= 8 && i.valor > 0)).toBe(true)
    expect(new Set(todos.map((i) => i.clubeId)).size).toBe(todos.length)
    expect(ep.investidores?.length).toBe(todos.length)
    const tabs = ep.calendario.map((_, d) => tabela(mundo, ep, d + 1))
    const conf = confiancasFimEpoca(mundo, tabs)
    expect(conf.size).toBe(Object.keys(mundo.clubes).length)
    for (const v of conf.values()) expect(v >= 0 && v <= 100).toBe(true)
  })
})
