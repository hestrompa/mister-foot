import { describe, expect, it } from 'vitest'
import { gerarMundo } from './mundo'
import { CONQUISTAS, estadoConquistas, verificarConquistas, vistasConquistas } from './conquistas'
import { estadoRecordes } from './recordes'
import { novaEpoca } from './epoca'
import type { Jogo } from './types'

describe('conquistas', () => {
  it('desbloqueiam uma vez, ficam marcadas com a época e saem das novas quando vistas', () => {
    const mundo = gerarMundo(3)
    const clubeId = mundo.divisoes[3].clubes[0]
    const jogo = { mundo, clubeId, treinador: 'T', criado: '', epoca: novaEpoca(mundo, 1) } as unknown as Jogo
    expect(verificarConquistas(jogo).map((c) => c.id)).not.toContain('vitoria1')
    estadoRecordes(jogo).mister.v = 1
    estadoRecordes(jogo).mister.melhorSerie = 5
    const novas = verificarConquistas(jogo).map((c) => c.id)
    expect(novas).toContain('vitoria1')
    expect(novas).toContain('serie5')
    expect(novas).not.toContain('serie10')
    expect(estadoConquistas(jogo).feitas.vitoria1).toBe(jogo.epoca.ano)
    expect(verificarConquistas(jogo).map((c) => c.id)).not.toContain('vitoria1')
    vistasConquistas(jogo)
    expect(estadoConquistas(jogo).novas).toEqual([])
    expect(new Set(CONQUISTAS.map((c) => c.id)).size).toBe(CONQUISTAS.length)
  })
})
