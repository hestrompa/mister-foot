import { describe, expect, it } from 'vitest'
import { gerarMundo } from './mundo'
import { concluirJornada, novaEpoca } from './epoca'
import { avancarTreinadorMes, estadoTreinadorMes } from './treinador-mes'
import type { Jogo } from './types'

describe('treinador do mês', () => {
  it('um prémio por divisão a cada 4 jornadas, sem repetir', () => {
    const mundo = gerarMundo(13)
    const clubeId = mundo.divisoes[0].clubes[0]
    const jogo = { mundo, clubeId, treinador: 'T', criado: '', epoca: novaEpoca(mundo, 6) } as unknown as Jogo
    for (let n = 0; n < 3; n++) concluirJornada(mundo, jogo.epoca, 70 + n)
    expect(avancarTreinadorMes(jogo)).toEqual([])
    for (let n = 3; n < 9; n++) concluirJornada(mundo, jogo.epoca, 70 + n)
    const p = avancarTreinadorMes(jogo)
    expect(p.length).toBe(mundo.divisoes.length * 2)
    expect(p.every((x) => x.pontos >= 6 && x.pontos <= 12)).toBe(true)
    expect(avancarTreinadorMes(jogo)).toEqual([])
    expect(estadoTreinadorMes(jogo).ultimo).toBe(8)
  })
})
