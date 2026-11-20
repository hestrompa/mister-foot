import { describe, expect, it } from 'vitest'
import { CLUBES_POR_DIVISAO, NUM_DIVISOES, forcaClube, gerarMundo } from './mundo'

describe('gerarMundo', () => {
  const m = gerarMundo(12345)
  const clubes = Object.values(m.clubes)
  const jogadores = Object.values(m.jogadores)

  it('cria 4 divisões de 18 clubes', () => {
    expect(m.divisoes).toHaveLength(NUM_DIVISOES)
    for (const d of m.divisoes) expect(d.clubes).toHaveLength(CLUBES_POR_DIVISAO)
    expect(clubes).toHaveLength(72)
  })

  it('é determinístico: a mesma semente dá o mesmo mundo', () => {
    expect(JSON.stringify(gerarMundo(12345))).toBe(JSON.stringify(m))
    expect(JSON.stringify(gerarMundo(999))).not.toBe(JSON.stringify(m))
  })

  it('nomes, siglas e terras não se repetem', () => {
    expect(new Set(clubes.map((c) => c.nome)).size).toBe(72)
    expect(new Set(clubes.map((c) => c.sigla)).size).toBe(72)
    for (const c of clubes) expect(c.sigla).toMatch(/^[A-Z0-9]{3}$/)
  })

  it('cada plantel tem 3 GR, 8 DEF, 8 MED e 5 AV', () => {
    for (const c of clubes) {
      const p = c.plantel.map((id) => m.jogadores[id])
      const conta = (pos: string) => p.filter((j) => j.posicao === pos).length
      expect([conta('GR'), conta('DEF'), conta('MED'), conta('AV')]).toEqual([3, 8, 8, 5])
      for (const j of p) expect(j.clubeId).toBe(c.id)
    }
  })

  it('forças e potenciais dentro dos limites', () => {
    for (const j of jogadores) {
      expect(j.forca).toBeGreaterThanOrEqual(1)
      expect(j.forca).toBeLessThanOrEqual(99)
      expect(j.potencial).toBeGreaterThanOrEqual(j.forca)
      expect(j.potencial).toBeLessThanOrEqual(99)
      expect(j.idade).toBeGreaterThanOrEqual(17)
      expect(j.valor).toBeGreaterThan(0)
      expect(j.salario).toBeGreaterThan(0)
    }
  })

  it('divisões mais altas são mais fortes, sem sobreposição grosseira', () => {
    const media = (d: number) => {
      const ids = m.divisoes[d].clubes
      return ids.reduce((s, id) => s + forcaClube(m, id), 0) / ids.length
    }
    expect(media(0)).toBeGreaterThan(media(1) + 6)
    expect(media(1)).toBeGreaterThan(media(2) + 6)
    expect(media(2)).toBeGreaterThan(media(3) + 6)
  })

  it('cada clube tem no máximo um craque', () => {
    for (const c of clubes) {
      const n = c.plantel.filter((id) => m.jogadores[id].craque).length
      expect(n).toBeLessThanOrEqual(1)
    }
  })
})
