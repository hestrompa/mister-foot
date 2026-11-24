import { describe, expect, it } from 'vitest'
import { gerarMundo } from './mundo'
import { concluirJornada, novaEpoca } from './epoca'
import { avancarPremiosJogo, escolherPremio, estadoPremios } from './premios-jogo'
import { ambiente } from './balneario'
import type { Jogo } from './types'

describe('prémios de jogo', () => {
  it('pagam por vitória e sobem a moral; sem prémio não custam nada', () => {
    const mundo = gerarMundo(21)
    const clubeId = mundo.divisoes[0].clubes[0]
    const jogo = { mundo, clubeId, treinador: 'T', criado: '', epoca: novaEpoca(mundo, 2) } as unknown as Jogo
    escolherPremio(jogo, 2)
    let n = 0, gasto = 0
    for (; n < 10; n++) {
      concluirJornada(mundo, jogo.epoca, 30 + n)
      const antes = ambiente(mundo, clubeId)
      const pago = avancarPremiosJogo(jogo)
      gasto += pago
      if (pago) expect(ambiente(mundo, clubeId)).toBeGreaterThan(antes)
    }
    const st = estadoPremios(jogo)
    expect(st.vitorias).toBeGreaterThan(0)
    expect(st.pagoEpoca).toBe(gasto)
    expect(avancarPremiosJogo(jogo)).toBe(0)
  })
})
