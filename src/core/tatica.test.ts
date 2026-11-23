import { describe, expect, it } from 'vitest'
import { gerarMundo } from './mundo'
import { escalarAuto, reacaoIA, simularJogo } from './motor'
import { escalarIA, posturaIA } from './tatica'
import type { Partida, Postura } from './partida'
import type { Mundo } from './types'

function partidaNova(casaId: number, foraId: number): Partida {
  return {
    id: `t-${casaId}-${foraId}`, competicao: 'liga', divisao: 1, jornada: 1, casaId, foraId,
    golos: [0, 0], eventos: [], jogada: false,
    estat: { posse: [50, 50], remates: [0, 0], rematesBaliza: [0, 0], cantos: [0, 0], amarelos: [0, 0], vermelhos: [0, 0] },
  }
}

function mundoForcas(fa: number, fb: number): { m: Mundo; a: number; b: number } {
  const m = gerarMundo(7)
  const [a, b] = m.divisoes[0].clubes
  for (const id of m.clubes[a].plantel) m.jogadores[id].forca = fa
  for (const id of m.clubes[b].plantel) m.jogadores[id].forca = fb
  return { m, a, b }
}

/** Pontos por jogo de `a` com a postura pa contra `b` com pb, metade em casa. */
function pontos(fa: number, fb: number, pa: Postura, pb: Postura, n = 500): number {
  const { m, a, b } = mundoForcas(fa, fb)
  const ea = { ...escalarAuto(m, a, new Set()), postura: pa }, eb = { ...escalarAuto(m, b, new Set()), postura: pb }
  let pts = 0
  for (let s = 0; s < n; s++) {
    const casa = s % 2 === 0
    const p = casa ? simularJogo(m, partidaNova(a, b), ea, eb, s) : simularJogo(m, partidaNova(b, a), eb, ea, s)
    const i = casa ? 0 : 1
    pts += p.golos[i] > p.golos[1 - i] ? 3 : p.golos[i] === p.golos[1 - i] ? 1 : 0
  }
  return pts / n
}

describe('tática', () => {
  it('a IA escolhe a postura pelo adversário', () => {
    expect(posturaIA(50, 60, false)).toBe('defensiva')
    expect(posturaIA(62, 55, true)).toBe('ofensiva')
    expect(posturaIA(58, 58, true)).toBe('equilibrada')
  })

  it('a IA reage ao resultado na 2.ª parte', () => {
    expect(reacaoIA(30, -1, 'equilibrada')).toBeNull()
    expect(reacaoIA(65, -1, 'equilibrada')).toBe('ofensiva')
    expect(reacaoIA(80, 1, 'equilibrada')).toBe('defensiva')
    expect(reacaoIA(70, 1, 'equilibrada')).toBeNull()
    expect(reacaoIA(70, -3, 'ofensiva')).toBe('equilibrada')
  })

  it('a IA escolhe a formação que o plantel permite', () => {
    const m = gerarMundo(8)
    const id = m.divisoes[0].clubes[4]
    // Muitos avançados bons e médios fracos: não deve ficar no 4-4-2 com médios fracos.
    for (const j of m.clubes[id].plantel.map((x) => m.jogadores[x])) {
      if (j.posicao === 'AV') j.forca = 80
      if (j.posicao === 'MED') j.forca = 30
    }
    const e = escalarIA(m, id, m.divisoes[0].clubes[5], true, new Set())
    expect(e.titulares).toHaveLength(11)
    expect(e.formacao).not.toBe('4-4-2')
    expect(Number(e.formacao.split('-')[2])).toBeGreaterThanOrEqual(3)
  })

  it('nenhuma postura ganha sempre entre equipas iguais', () => {
    const ps: Postura[] = ['defensiva', 'equilibrada', 'ofensiva']
    for (const pb of ps) {
      const r = ps.map((pa) => pontos(60, 60, pa, pb))
      expect(Math.max(...r) - Math.min(...r)).toBeLessThan(0.2)
    }
  })

  it('o mais fraco ganha pontos a defender, o mais forte a atacar', () => {
    expect(pontos(52, 62, 'defensiva', 'equilibrada')).toBeGreaterThan(pontos(52, 62, 'ofensiva', 'equilibrada'))
    expect(pontos(62, 52, 'ofensiva', 'defensiva')).toBeGreaterThan(pontos(62, 52, 'defensiva', 'defensiva'))
  })

  it('jogar recuado contra quem ataca dá mais contra-ataques', () => {
    const { m, a, b } = mundoForcas(60, 60)
    const conta = (pa: Postura, pb: Postura) => {
      let c = 0
      for (let s = 0; s < 200; s++) {
        const p = simularJogo(m, partidaNova(a, b), { ...escalarAuto(m, a, new Set()), postura: pa }, { ...escalarAuto(m, b, new Set()), postura: pb }, s)
        c += p.eventos.filter((e) => e.lado === 'casa' && e.lance?.origem === 'contra').length
      }
      return c
    }
    expect(conta('defensiva', 'ofensiva')).toBeGreaterThan(conta('equilibrada', 'equilibrada'))
  })
})
