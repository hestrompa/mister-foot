import { describe, expect, it } from 'vitest'
import { gerarMundo } from '../core/mundo'
import { concluirJornada, epocaTerminada, fecharEpoca, novaEpoca } from '../core/epoca'
import { escalarAuto } from '../core/motor'
import type { Jogo } from '../core/types'
import { carregar, gravar } from './gravar'

describe('época completa com gravação', () => {
  it('joga 2 épocas inteiras, grava e carrega, e o save fica pequeno', () => {
    const mem: Record<string, string> = {}
    ;(globalThis as any).localStorage = {
      getItem: (k: string) => mem[k] ?? null,
      setItem: (k: string, v: string) => { mem[k] = v },
      removeItem: (k: string) => { delete mem[k] },
    }
    const mundo = gerarMundo(77)
    const clubeId = mundo.divisoes[3].clubes[0]
    let epoca = novaEpoca(mundo, 1)
    const jogo: Jogo = { mundo, epoca, escalacao: escalarAuto(mundo, clubeId, new Set()), treinador: 'T', clubeId, criado: '' } as Jogo
    let maior = 0
    for (let e = 0; e < 2; e++) {
      let n = 0
      while (!epocaTerminada(epoca)) {
        concluirJornada(mundo, epoca, 1000 + n++)
        jogo.epoca = epoca
        expect(gravar(jogo)).toBe(true)
        maior = Math.max(maior, Object.values(mem).reduce((s, v) => s + v.length, 0))
      }
      expect(n).toBe(34)
      const r = fecharEpoca(mundo, epoca)
      expect(r.campeoes).toHaveLength(4)
      for (const d of mundo.divisoes) expect(d.clubes).toHaveLength(18)
      epoca = novaEpoca(mundo, 2 + e)
      jogo.epoca = epoca
    }
    const back = carregar()
    expect(back?.mundo.epoca).toBe(mundo.epoca)
    console.log('save máximo (caracteres):', maior)
    expect(maior).toBeLessThan(4_000_000)
  }, 20_000)
})
