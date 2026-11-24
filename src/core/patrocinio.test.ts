import { describe, expect, it } from 'vitest'
import { gerarMundo } from './mundo'
import { prepararEpoca } from '../jogo/gravar'
import { bonusPatrocinio, patrocinioPorObjetivos, podeEscolherPatrocinio, BONUS_PATROCINIO } from './patrocinio'
import type { EpocaComInicio } from './inicio-epoca'
import type { JogoComCarreira } from './direcao'
import type { Jogo } from './types'

describe('patrocínio por objetivos', () => {
  it('devolve metade agora, só antes da 1.ª jornada, e paga o bónus conforme a avaliação', () => {
    const mundo = gerarMundo(8)
    const clubeId = mundo.divisoes[2].clubes[3]
    const jogo = prepararEpoca({ mundo, treinador: 'T', clubeId, criado: '' } as Jogo) as JogoComCarreira
    const inj = (jogo.epoca as EpocaComInicio).inicio![clubeId]
    const base = inj.patrocinio, caixa = mundo.clubes[clubeId].dinheiro
    expect(podeEscolherPatrocinio(jogo)).toBe(true)
    expect(patrocinioPorObjetivos(jogo)).toBe(true)
    expect(mundo.clubes[clubeId].dinheiro).toBe(caixa - Math.round(base / 2))
    expect(podeEscolherPatrocinio(jogo)).toBe(false)
    expect(patrocinioPorObjetivos(jogo)).toBe(false)
    const anterior = jogo.epoca
    jogo.carreira!.ultimaAvaliacao = { ano: anterior.ano, texto: '', avaliacao: 'superado', confianca: 70 }
    expect(bonusPatrocinio(jogo, anterior)).toBe(Math.round((base * BONUS_PATROCINIO.superado) / 1000) * 1000)
    jogo.carreira!.ultimaAvaliacao = { ano: anterior.ano, texto: '', avaliacao: 'falhado', confianca: 20 }
    expect(bonusPatrocinio(jogo, anterior)).toBe(0)
  })
})
