import { describe, expect, it } from 'vitest'
import { gerarMundo } from './mundo'
import { concluirJornada, novaEpoca } from './epoca'
import { escalarAuto } from './motor'
import { fichasDe, registarFichas } from './fichas'
import type { Jogo } from './types'

function jogoEm(semente: number): Jogo {
  const mundo = gerarMundo(semente)
  const id = mundo.divisoes[3].clubes[0]
  const epoca = novaEpoca(mundo, semente + 1)
  return { mundo, epoca, escalacao: escalarAuto(mundo, id, new Set()), treinador: 'T', clubeId: id, criado: '' }
}

describe('fichas de jogo', () => {
  it('guarda táticas, onzes e eventos de cada jogo meu, uma vez só', () => {
    const jogo = jogoEm(7)
    for (let n = 0; n < 3; n++) {
      concluirJornada(jogo.mundo, jogo.epoca, 900 + n)
      registarFichas(jogo)
    }
    expect(registarFichas(jogo)).toBe(0)
    const fichas = fichasDe(jogo)
    expect(fichas).toHaveLength(3)
    for (const f of fichas) {
      expect([f.casa.id, f.fora.id]).toContain(jogo.clubeId)
      for (const e of [f.casa, f.fora]) {
        expect(e.formacao).toBeTruthy()
        expect(e.titulares).toHaveLength(11)
        expect(e.titulares[0].pos).toBe('GR')
      }
      const golos = f.eventos.filter((e) => e.tipo === 'golo')
      expect(golos.filter((e) => e.lado === 0)).toHaveLength(f.golos[0])
      expect(golos.filter((e) => e.lado === 1)).toHaveLength(f.golos[1])
      expect(golos.every((e) => e.quem)).toBe(true)
    }
    expect(fichas[0].ronda).toBe('Jornada 1')
  })
})
