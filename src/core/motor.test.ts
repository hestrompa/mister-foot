import { describe, expect, it } from 'vitest'
import { gerarMundo } from './mundo'
import { avancarMinuto, escalarAuto, iniciarJogo, simularJogo, substituir } from './motor'
import type { Escalacao, Partida } from './partida'
import type { Jogador, Mundo } from './types'

function partidaNova(casaId: number, foraId: number): Partida {
  return {
    id: `t-${casaId}-${foraId}`, competicao: 'liga', divisao: 1, jornada: 1, casaId, foraId,
    golos: [0, 0], eventos: [], jogada: false,
    estat: { posse: [50, 50], remates: [0, 0], rematesBaliza: [0, 0], cantos: [0, 0], amarelos: [0, 0], vermelhos: [0, 0] },
  }
}

/** Mundo com dois clubes de plantel igual (força dada) para comparar táticas sem ruído de plantel. */
function mundoIgual(fCasa: number, fFora: number): Mundo {
  const m = gerarMundo(7)
  const [a, b] = m.divisoes[0].clubes
  const ajusta = (clubeId: number, f: number) => {
    for (const id of m.clubes[clubeId].plantel) (m.jogadores[id] as Jogador).forca = f
  }
  ajusta(a, fCasa)
  ajusta(b, fFora)
  return m
}

const NADA = new Set<number>()

describe('motor', () => {
  it('escala 11 titulares e até 9 suplentes', () => {
    const m = gerarMundo(1)
    const id = m.divisoes[0].clubes[0]
    const e = escalarAuto(m, id, NADA)
    expect(e.titulares).toHaveLength(11)
    expect(m.jogadores[e.titulares[0]].posicao).toBe('GR')
    expect(e.suplentes.length).toBeLessThanOrEqual(9)
    expect(new Set([...e.titulares, ...e.suplentes]).size).toBe(e.titulares.length + e.suplentes.length)
  })

  it('é determinístico', () => {
    const m = gerarMundo(3)
    const [a, b] = m.divisoes[0].clubes
    const ea = escalarAuto(m, a, NADA), eb = escalarAuto(m, b, NADA)
    const p1 = simularJogo(m, partidaNova(a, b), ea, eb, 99)
    const p2 = simularJogo(m, partidaNova(a, b), ea, eb, 99)
    expect(p1).toEqual(p2)
    expect(p1.jogada).toBe(true)
  })

  it('minuto a minuto, intervalo, fim e posse a somar 100', () => {
    const m = gerarMundo(4)
    const [a, b] = m.divisoes[1].clubes
    const e = iniciarJogo(m, partidaNova(a, b), escalarAuto(m, a, NADA), escalarAuto(m, b, NADA), 5)
    const tipos: string[] = []
    while (!e.partida.jogada) tipos.push(...avancarMinuto(m, e).map((x) => x.tipo))
    expect(tipos).toContain('intervalo')
    expect(tipos[tipos.length - 1]).toBe('fim')
    expect(e.partida.estat.posse[0] + e.partida.estat.posse[1]).toBe(100)
    expect(e.partida.porque).toBeTruthy()
    // JSON ida e volta mantém o estado jogável
    expect(JSON.parse(JSON.stringify(e))).toEqual(e)
  })

  it('substituições: máximo 5 e só com suplentes', () => {
    const m = gerarMundo(5)
    const [a, b] = m.divisoes[0].clubes
    const ea = escalarAuto(m, a, NADA)
    const e = iniciarJogo(m, partidaNova(a, b), ea, escalarAuto(m, b, NADA), 1)
    expect(substituir(m, e, 'casa', ea.titulares[1], ea.titulares[2])).toBe(false)
    for (let i = 0; i < 5; i++) expect(substituir(m, e, 'casa', ea.titulares[i + 1], ea.suplentes[i])).toBe(true)
    expect(substituir(m, e, 'casa', ea.titulares[7], ea.suplentes[6])).toBe(false)
  })

  it('médias realistas, ids válidos e posse a somar 100 (jogos equilibrados)', () => {
    const m = mundoIgual(60, 60)
    const [a, b] = m.divisoes[0].clubes
    const ea = escalarAuto(m, a, NADA), eb = escalarAuto(m, b, NADA)
    const ids = new Set([...m.clubes[a].plantel, ...m.clubes[b].plantel])
    let golos = 0, remates = 0, amarelos = 0, casa = 0, fora = 0
    const N = 400
    for (let s = 0; s < N; s++) {
      const p = simularJogo(m, partidaNova(a, b), ea, eb, 1000 + s)
      golos += p.golos[0] + p.golos[1]
      remates += p.estat.remates[0] + p.estat.remates[1]
      amarelos += p.estat.amarelos[0] + p.estat.amarelos[1]
      if (p.golos[0] > p.golos[1]) casa++
      if (p.golos[0] < p.golos[1]) fora++
      expect(p.estat.posse[0] + p.estat.posse[1]).toBe(100)
      for (const ev of p.eventos) {
        if (ev.jogadorId !== undefined) expect(ids.has(ev.jogadorId)).toBe(true)
        if (ev.outroId !== undefined) expect(ids.has(ev.outroId)).toBe(true)
      }
    }
    const mg = golos / N, mr = remates / N / 2
    console.log(`golos/jogo ${mg.toFixed(2)}, remates/equipa ${mr.toFixed(1)}, amarelos ${(amarelos / N).toFixed(2)}, casa ${casa} fora ${fora}`)
    expect(mg).toBeGreaterThan(2.0)
    expect(mg).toBeLessThan(3.2)
    expect(mr).toBeGreaterThan(9)
    expect(mr).toBeLessThan(15)
    expect(casa).toBeGreaterThan(fora)
  })

  it('a equipa mais forte ganha mais', () => {
    const m = mundoIgual(70, 55)
    const [a, b] = m.divisoes[0].clubes
    const ea = escalarAuto(m, a, NADA), eb = escalarAuto(m, b, NADA)
    let v = 0, d = 0
    const N = 300
    for (let s = 0; s < N; s++) {
      // metade em casa, metade fora
      const p = s % 2 ? simularJogo(m, partidaNova(a, b), ea, eb, s) : simularJogo(m, partidaNova(b, a), eb, ea, s)
      const [gf, ga] = s % 2 ? p.golos : [p.golos[1], p.golos[0]]
      if (gf > ga) v++
      if (gf < ga) d++
    }
    console.log(`mais forte (+15): ${((100 * v) / N).toFixed(0)}% vitórias, ${((100 * d) / N).toFixed(0)}% derrotas`)
    expect(v / N).toBeGreaterThan(0.5)
    expect(d / N).toBeLessThan(0.25)
  })

  it('5-0-5 não ganha a um 4-4-2 de plantel igual', () => {
    const m = mundoIgual(60, 60)
    const [a, b] = m.divisoes[0].clubes
    const e505: Escalacao = escalarAuto(m, a, NADA, '5-0-5')
    const e442 = escalarAuto(m, b, NADA, '4-4-2')
    let v = 0, d = 0, posse = 0
    const N = 300
    for (let s = 0; s < N; s++) {
      const casa505 = s % 2 === 0
      const p = casa505 ? simularJogo(m, partidaNova(a, b), e505, e442, s) : simularJogo(m, partidaNova(b, a), e442, e505, s)
      const i = casa505 ? 0 : 1
      posse += p.estat.posse[i]
      if (p.golos[i] > p.golos[1 - i]) v++
      if (p.golos[i] < p.golos[1 - i]) d++
    }
    console.log(`5-0-5 vs 4-4-2: ${v} V, ${d} D, posse média ${(posse / N).toFixed(0)}%`)
    expect(v).toBeLessThan(d)
    expect(posse / N).toBeLessThan(40)
  })
})
