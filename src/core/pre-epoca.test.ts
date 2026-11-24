import { describe, expect, it } from 'vitest'
import { gerarMundo } from './mundo'
import { novaEpoca } from './epoca'
import { escolherPreEpoca, opcoesPreEpoca, preEpocaPendente } from './pre-epoca'
import { ambiente } from './balneario'
import type { Jogo } from './types'

describe('pré-época', () => {
  it('digressão dá dinheiro e tira moral; só uma escolha por época, antes da 1.ª jornada', () => {
    const mundo = gerarMundo(17)
    const clubeId = mundo.divisoes[0].clubes[1]
    const jogo = { mundo, clubeId, treinador: 'T', criado: '', epoca: novaEpoca(mundo, 3) } as unknown as Jogo
    const din = mundo.clubes[clubeId].dinheiro, amb = ambiente(mundo, clubeId)
    const d = opcoesPreEpoca(jogo).find((o) => o.tipo === 'digressao')!
    expect(preEpocaPendente(jogo)).toBe(true)
    expect(escolherPreEpoca(jogo, 'digressao')).not.toBeNull()
    expect(mundo.clubes[clubeId].dinheiro).toBe(din + d.dinheiro)
    expect(ambiente(mundo, clubeId)).toBeLessThan(amb)
    expect(preEpocaPendente(jogo)).toBe(false)
    expect(escolherPreEpoca(jogo, 'estagio')).toBeNull()
  })
})
