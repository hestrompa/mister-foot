import { describe, expect, it } from 'vitest'
import { gerarMundo } from './mundo'
import { concluirJornada, epocaTerminada, fecharEpoca } from './epoca'
import { prepararEpoca } from '../jogo/gravar'
import { previsaoFimEpoca, type JogoComHistFinancas } from './previsao'
import type { Jogo } from './types'

describe('previsão de caixa e histórico financeiro', () => {
  it('prevê a caixa do fim da época perto da real e regista a época no histórico', () => {
    const mundo = gerarMundo(5)
    const clubeId = mundo.divisoes[1].clubes[4]
    const jogo = prepararEpoca({ mundo, treinador: 'T', clubeId, criado: '' } as Jogo) as JogoComHistFinancas
    let n = 0
    while (jogo.epoca.jornada <= 10) concluirJornada(mundo, jogo.epoca, 50 + n++)
    const p = previsaoFimEpoca(jogo)
    expect(p.jornadasFalta).toBe(24)
    while (!epocaTerminada(jogo.epoca)) concluirJornada(mundo, jogo.epoca, 50 + n++)
    const real = mundo.clubes[clubeId].dinheiro
    const escala = Math.max(Math.abs(real), p.despesaJornada * 34)
    expect(Math.abs(p.caixaFim - real) / escala).toBeLessThan(0.25)
    fecharEpoca(mundo, jogo.epoca)
    const depoisIrc = mundo.clubes[clubeId].dinheiro
    prepararEpoca(jogo)
    expect(jogo.histFinancas?.length).toBe(1)
    expect(jogo.histFinancas![0].caixaFim).toBe(depoisIrc)
    expect(jogo.histFinancas![0].lugar).toBeGreaterThan(0)
  })
})
