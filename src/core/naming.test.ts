import { describe, expect, it } from 'vitest'
import { gerarMundo } from './mundo'
import { novaEpoca } from './epoca'
import { avancarNaming, namingDe, venderNaming, EPOCAS_NAMING } from './naming'
import type { Jogo } from './types'

describe('naming do estádio', () => {
  it('paga já, muda o nome, paga nas épocas seguintes e devolve o nome no fim', () => {
    const mundo = gerarMundo(4)
    const clubeId = mundo.divisoes[1].clubes[2]
    const c = mundo.clubes[clubeId]
    const jogo = { mundo, clubeId, treinador: 'T', criado: '', epoca: novaEpoca(mundo, 1) } as unknown as Jogo
    const nome = c.estadio.nome, din = c.dinheiro, rep = c.reputacao
    expect(venderNaming(jogo)).toBe(true)
    expect(venderNaming(jogo)).toBe(false)
    const n = namingDe(c)!
    expect(c.dinheiro).toBe(din + n.valor)
    expect(c.estadio.nome).toContain('Arena')
    expect(c.reputacao).toBe(rep - 2)
    const ano = jogo.epoca.ano
    for (let k = 1; k < EPOCAS_NAMING; k++) expect(avancarNaming([c], ano + k).get(clubeId)).toBe(n.valor)
    expect(avancarNaming([c], ano + EPOCAS_NAMING).get(clubeId)).toBeUndefined()
    expect(c.estadio.nome).toBe(nome)
    expect(namingDe(c)).toBeUndefined()
  })
})
