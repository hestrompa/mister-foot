import { describe, expect, it } from 'vitest'
import { gerarMundo } from './mundo'
import { concluirJornada, epocaTerminada, novaEpoca } from './epoca'
import { mediaEpoca, jogosComNota, curva } from './notas'

describe('notas dos jogadores', () => {
  it('curva: 6 ao centro, limites 1 e 10', () => {
    expect(curva(0)).toBe(6)
    expect(curva(50)).toBeLessThanOrEqual(10)
    expect(curva(-50)).toBeGreaterThanOrEqual(1)
    expect(curva(1)).toBeGreaterThan(6.9)
    expect(curva(1)).toBeLessThan(7.4)
  })

  it('distribuição credível numa época inteira', () => {
    const m = gerarMundo(11)
    const ep = novaEpoca(m, 123)
    let guarda = 0
    while (!epocaTerminada(ep) && guarda++ < 60) concluirJornada(m, ep, 1000 + guarda)
    const todas: number[] = []
    const porPos: Record<string, number[]> = { GR: [], DEF: [], MED: [], AV: [] }
    for (const div of ep.calendario) for (const j of div) for (const p of j) for (const n of Object.values(p.notas ?? {})) todas.push(n)
    for (const div of ep.calendario) for (const j of div) for (const p of j) for (const [k, n] of Object.entries(p.notas ?? {})) porPos[m.jogadores[Number(k)]?.posicao ?? 'MED'].push(n)
    const medias: { id: number; n: number; f: number }[] = []
    for (const k of Object.keys(m.jogadores)) {
      const id = Number(k)
      if (jogosComNota(ep, id) >= 10) medias.push({ id, n: mediaEpoca(ep, id)!, f: m.jogadores[id].forca })
    }
    const media = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length
    const frac = (a: number[], f: (v: number) => boolean) => a.filter(f).length / a.length
    const mn = medias.map((x) => x.n)
    if ((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.NOTAS) {
      console.log('jogo: média', media(todas).toFixed(2), '>=8', frac(todas, (v) => v >= 8).toFixed(3), '>=9', frac(todas, (v) => v >= 9).toFixed(4), '<5', frac(todas, (v) => v < 5).toFixed(3))
      for (const [p, a] of Object.entries(porPos)) console.log(p, media(a).toFixed(2), a.length)
      console.log('época: n', mn.length, 'média', media(mn).toFixed(2), '5.5-7.5', frac(mn, (v) => v >= 5.5 && v <= 7.5).toFixed(3), '>7.5', frac(mn, (v) => v > 7.5).toFixed(3), '<5.5', frac(mn, (v) => v < 5.5).toFixed(3), 'min', Math.min(...mn), 'max', Math.max(...mn))
      // correlação força-nota dentro de cada divisão
      const mx = media(medias.map((x) => x.f)), my = media(mn)
      let sxy = 0, sxx = 0, syy = 0
      for (const x of medias) { sxy += (x.f - mx) * (x.n - my); sxx += (x.f - mx) ** 2; syy += (x.n - my) ** 2 }
      console.log('corr força-nota', (sxy / Math.sqrt(sxx * syy)).toFixed(2))
      const top = medias.slice().sort((a, b) => b.n - a.n).slice(0, 5).map((x) => `${m.jogadores[x.id].posicao} ${x.n} f${x.f}`)
      console.log('top', top.join(' | '))
    }
    expect(media(todas)).toBeGreaterThan(6.1)
    expect(media(todas)).toBeLessThan(6.9)
    expect(frac(mn, (v) => v >= 5.5 && v <= 7.5)).toBeGreaterThan(0.85)
    expect(frac(todas, (v) => v >= 9)).toBeLessThan(0.02)
  })
})
