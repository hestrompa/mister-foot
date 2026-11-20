import { describe, expect, it } from 'vitest'
import { gerarMundo } from './mundo'
import { concluirJornada, epocaTerminada, novaEpoca } from './epoca'
import { publicoEsperado } from './financas'

describe('finanças', () => {
  it('preço mais alto leva menos gente, nunca acima da lotação', () => {
    const m = gerarMundo(5)
    const [a, b] = m.divisoes[1].clubes.map((id) => m.clubes[id])
    a.bilhete = 5
    const barato = publicoEsperado(a, b, 5, 18)
    a.bilhete = 30
    const caro = publicoEsperado(a, b, 5, 18)
    expect(barato).toBeGreaterThan(caro)
    expect(barato).toBeLessThanOrEqual(a.estadio.lugares)
  })

  it('numa época, a maioria dos clubes não vai à falência e o dinheiro mexe', () => {
    const m = gerarMundo(9)
    const antes = Object.fromEntries(Object.values(m.clubes).map((c) => [c.id, c.dinheiro]))
    const e = novaEpoca(m, 1)
    let n = 0
    while (!epocaTerminada(e)) concluirJornada(m, e, n++)
    const clubes = Object.values(m.clubes)
    const negativos = clubes.filter((c) => c.dinheiro < 0).length
    const mudou = clubes.filter((c) => c.dinheiro !== antes[c.id]).length
    expect(mudou).toBe(72)
    expect(negativos).toBeLessThan(15)
    for (const d of [0, 1, 2, 3]) {
      const ids = m.divisoes[d].clubes
      const media = ids.reduce((s, id) => s + m.clubes[id].dinheiro - antes[id], 0) / ids.length
      console.log(`div ${d + 1}: variação média ${Math.round(media)} €, negativos ${ids.filter((id) => m.clubes[id].dinheiro < 0).length}`)
    }
  })
})
