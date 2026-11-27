import { describe, expect, it } from 'vitest'
import { gerarMundo } from './mundo'
import { escalarAuto, forcaSetores, iniciarJogo, mudarPosicoes, simularJogo } from './motor'
import { criarAmbiente, emCampoDe } from './repeticao'
import { contagem, moverJogador, posicoesBase, posicoesDe, type Ponto } from './posicoes'
import type { Escalacao, Partida } from './partida'
import type { Jogador, Mundo } from './types'

function partidaNova(casaId: number, foraId: number): Partida {
  return {
    id: `t-${casaId}-${foraId}`, competicao: 'liga', divisao: 1, jornada: 1, casaId, foraId,
    golos: [0, 0], eventos: [], jogada: false,
    estat: { posse: [50, 50], remates: [0, 0], rematesBaliza: [0, 0], cantos: [0, 0], amarelos: [0, 0], vermelhos: [0, 0] },
  }
}

function mundoIgual(f = 60): { m: Mundo; a: number; b: number } {
  const m = gerarMundo(7)
  const [a, b] = m.divisoes[0].clubes
  for (const c of [a, b]) for (const id of m.clubes[c].plantel) (m.jogadores[id] as Jogador).forca = f
  return { m, a, b }
}

/** Arrasta vários lugares (índices da formação 4-4-2 de partida) de uma vez. */
function forma(esc: Escalacao, moves: [number, Ponto][]): Escalacao {
  let e = esc
  // Os ids não mudam quando os lugares se reordenam.
  for (const [i, p] of moves) {
    const id = esc.titulares[i]
    e = moverJogador(e, e.titulares.indexOf(id), p) ?? e
  }
  return e
}

function pontos(m: Mundo, a: number, b: number, ea: Escalacao, eb: Escalacao, n: number): { pts: number; golos: number; sofridos: number; posse: number } {
  let pts = 0, golos = 0, sofridos = 0, posse = 0
  for (let s = 0; s < n; s++) {
    const casa = s % 2 === 0
    const p = casa ? simularJogo(m, partidaNova(a, b), ea, eb, s + 1) : simularJogo(m, partidaNova(b, a), eb, ea, s + 1)
    const i = casa ? 0 : 1
    pts += p.golos[i] > p.golos[1 - i] ? 3 : p.golos[i] === p.golos[1 - i] ? 1 : 0
    golos += p.golos[i]; sofridos += p.golos[1 - i]; posse += p.estat.posse[i]
  }
  return { pts: pts / n, golos: golos / n, sofridos: sofridos / n, posse: posse / n }
}

describe('posições no campo', () => {
  it('sem posições à medida, as posições são as da formação', () => {
    const { m, a } = mundoIgual()
    const e = escalarAuto(m, a, new Set())
    expect(posicoesDe(e)).toEqual(posicoesBase('4-4-2'))
    expect(contagem('3-6-1')).toEqual([3, 6, 1])
  })

  it('arrastar um médio para a frente faz dele avançado e muda a formação', () => {
    const { m, a } = mundoIgual()
    const e = escalarAuto(m, a, new Set())
    const id = e.titulares[6]
    const n = moverJogador(e, 6, [58, 30])!
    expect(n.formacao).toBe('4-3-3')
    expect(n.titulares).toHaveLength(11)
    expect(new Set(n.titulares)).toEqual(new Set(e.titulares))
    expect(n.titulares.indexOf(id)).toBeGreaterThan(7)
    expect(posicoesDe(n)[n.titulares.indexOf(id)]).toEqual([58, 30])
    // Voltar ao sítio: deixa de haver posições guardadas.
    const volta = moverJogador(n, n.titulares.indexOf(id), posicoesBase('4-4-2')[6])!
    expect(volta.formacao).toBe('4-4-2')
    expect(volta.posicoes).toBeUndefined()
  })

  it('o guarda-redes não sai e ficam sempre pelo menos dois defesas', () => {
    const { m, a } = mundoIgual()
    const e = escalarAuto(m, a, new Set())
    expect(moverJogador(e, 0, [40, 34])).toBeNull()
    const tres = forma(e, [[1, [40, 10]], [2, [40, 20]]])
    expect(tres.formacao).toBe('2-6-2')
    expect(moverJogador(tres, 1, [40, 50])).toBeNull()
  })

  it('médio recuado defende mais e ataca menos; adiantado o contrário', () => {
    const { m, a } = mundoIgual()
    const e = escalarAuto(m, a, new Set())
    const base = forcaSetores(m, e, true)
    const [x, y] = posicoesBase('4-4-2')[6]
    const recuado = forcaSetores(m, moverJogador(e, 6, [x - 8, y])!, true)
    const adiantado = forcaSetores(m, moverJogador(e, 6, [x + 8, y])!, true)
    expect(recuado.defesa).toBeGreaterThan(base.defesa)
    expect(recuado.ataque).toBeLessThan(base.ataque)
    expect(adiantado.ataque).toBeGreaterThan(base.ataque)
    expect(adiantado.defesa).toBeLessThan(base.defesa)
    // Avançado que recua (falso 9) dá meio-campo.
    const f9 = forcaSetores(m, moverJogador(e, 9, [50, 34])!, true)
    expect(f9.meio).toBeGreaterThan(base.meio)
  })

  it('o 2D mostra as caricas onde o treinador as pôs', () => {
    const { m, a, b } = mundoIgual()
    const e = moverJogador(escalarAuto(m, a, new Set()), 6, [33, 30])!
    const est = iniciarJogo(m, partidaNova(a, b), e, escalarAuto(m, b, new Set()), 3)
    const cena = criarAmbiente({ emCampo: emCampoDe(m, est), posse: 'casa', minuto: 1, posturas: { casa: 'equilibrada', fora: 'equilibrada' }, semente: 5 })
    const id = e.titulares[6]
    const k = cena.caricas.findIndex((c) => c.id === id)
    // Pontapé de saída: x = bx * 0.8 + 4 (o médio recuado fica bem atrás dos outros médios).
    expect(cena.quadros[0][k][0]).toBeCloseTo(33 * 0.8 + 4, 0)
  })

  it('ao vivo: mexer nas posições muda a formação e fica no relato (uma linha por minuto)', () => {
    const { m, a, b } = mundoIgual()
    const ea = escalarAuto(m, a, new Set())
    const est = iniciarJogo(m, partidaNova(a, b), ea, escalarAuto(m, b, new Set()), 3)
    const id = ea.titulares[7]
    expect(mudarPosicoes(m, est, 'casa', id, [36, 40])).toBe(true)
    expect(mudarPosicoes(m, est, 'casa', id, [60, 40])).toBe(true)
    expect(est.escalacoes.casa.formacao).toBe('4-3-3')
    const linhas = est.partida.eventos.filter((ev) => ev.jogadorId === id && ev.tipo === 'postura')
    expect(linhas).toHaveLength(1)
    expect(linhas[0].texto).toContain('avançado')
    expect(mudarPosicoes(m, est, 'casa', ea.titulares[0], [40, 34])).toBe(false)
  })

  it('equilíbrio: nenhuma forma arrastada ganha sempre e o meio-campo conta', { timeout: 120000 }, () => {
    const { m, a, b } = mundoIgual()
    const e = escalarAuto(m, a, new Set())
    const eb = escalarAuto(m, b, new Set())
    const N = 400
    const ref = pontos(m, a, b, e, eb, N)
    const B = posicoesBase('4-4-2')
    const variantes: Record<string, Escalacao> = {
      'médios recuados': forma(e, [[5, [32, B[5][1]]], [6, [32, B[6][1]]], [7, [32, B[7][1]]], [8, [32, B[8][1]]]]),
      'médios adiantados': forma(e, [[5, [48, B[5][1]]], [6, [48, B[6][1]]], [7, [48, B[7][1]]], [8, [48, B[8][1]]]]),
      'laterais subidos': forma(e, [[1, [30, 6]], [4, [30, 62]]]),
      'falso 9': forma(e, [[9, [49, 30]]]),
      'tudo à frente': forma(e, [[1, [30, 8]], [2, [30, 26]], [3, [30, 42]], [4, [30, 60]], [5, [48, 8]], [6, [48, 26]], [7, [48, 42]], [8, [48, 60]], [9, [66, 30]], [10, [66, 40]]]),
      'tudo atrás': forma(e, [[1, [10, 8]], [2, [10, 26]], [3, [10, 42]], [4, [10, 60]], [5, [31, 8]], [6, [31, 26]], [7, [31, 42]], [8, [31, 60]], [9, [49, 30]], [10, [49, 40]]]),
      'tudo ao centro': forma(e, [[1, [22, 26]], [4, [22, 42]], [5, [40, 28]], [8, [40, 40]]]),
      'tudo aberto': forma(e, [[2, [22, 14]], [3, [22, 54]], [6, [40, 8]], [7, [40, 60]], [9, [56, 10]], [10, [56, 58]]]),
      // Médios todos passados a avançados: perde o meio-campo.
      'sem meio-campo': forma(e, [[5, [52, 8]], [6, [52, 26]], [7, [52, 42]], [8, [52, 60]]]),
    }
    const linhas: string[] = [`base ${ref.pts.toFixed(2)} pts ${ref.golos.toFixed(2)}-${ref.sofridos.toFixed(2)} posse ${ref.posse.toFixed(0)}%`]
    const res: Record<string, ReturnType<typeof pontos>> = {}
    for (const [nome, v] of Object.entries(variantes)) {
      const r = pontos(m, a, b, v, eb, N)
      res[nome] = r
      linhas.push(`${nome} (${v.formacao}): ${r.pts.toFixed(2)} pts ${r.golos.toFixed(2)}-${r.sofridos.toFixed(2)} posse ${r.posse.toFixed(0)}%`)
    }
    console.log(linhas.join('\n'))
    // Nenhuma forma domina a base (empates entre iguais valem ~1,35 pts).
    for (const r of Object.values(res)) expect(r.pts).toBeLessThan(ref.pts + 0.22)
    // As trocas veem-se: à frente marca e sofre mais, atrás o contrário.
    expect(res['tudo à frente'].golos).toBeGreaterThan(ref.golos)
    expect(res['tudo à frente'].sofridos).toBeGreaterThan(ref.sofridos)
    expect(res['tudo atrás'].sofridos).toBeLessThan(ref.sofridos)
    expect(res['tudo atrás'].golos).toBeLessThan(ref.golos)
    // O meio-campo conta: sem médios perde a posse e não ganha mais pontos.
    expect(res['sem meio-campo'].posse).toBeLessThan(ref.posse - 5)
    expect(res['sem meio-campo'].pts).toBeLessThan(ref.pts + 0.05)
  })
})
