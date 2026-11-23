// Testes de equilíbrio: várias épocas, vários mundos, e gravar/carregar a meio da época.
// Os intervalos são grades de segurança largas (apanham regressões), não alvos do motor.
import { describe, expect, it } from 'vitest'
import { medirCarreira } from './medir'
import { gerarMundo } from '../core/mundo'
import { concluirJornada, epocaTerminada, novaEpoca, tabela } from '../core/epoca'
import { escalarAuto } from '../core/motor'
import type { Jogo } from '../core/types'
import { carregar, gravar } from './gravar'
import { garantirStaff } from '../core/staff-ia'
import { garantirRivais } from '../core/rivalidades'

function memoria() {
  const mem: Record<string, string> = {}
  ;(globalThis as any).localStorage = {
    getItem: (k: string) => mem[k] ?? null,
    setItem: (k: string, v: string) => { mem[k] = v },
    removeItem: (k: string) => { delete mem[k] },
  }
}

describe('equilíbrio de épocas completas', () => {
  const medidas = [11, 222, 3333].flatMap((s) => medirCarreira(s, 3))
  const media = (f: (m: (typeof medidas)[number]) => number) => medidas.reduce((s, m) => s + f(m), 0) / medidas.length

  it('golos, empates e fator casa em valores de futebol', () => {
    for (const m of medidas) for (const g of m.golosPorJogo) expect(g).toBeGreaterThan(1.8), expect(g).toBeLessThan(3.6)
    expect(media((m) => m.empates / m.jogos)).toBeGreaterThan(0.18)
    expect(media((m) => m.empates / m.jogos)).toBeLessThan(0.32)
    expect(media((m) => m.vitoriasCasa / m.jogos)).toBeGreaterThan(0.36)
    expect(media((m) => m.vitoriasCasa / m.jogos)).toBeLessThan(0.52)
  })

  it('cartões, expulsões e lesões', () => {
    expect(media((m) => m.amarelos / m.jogos)).toBeGreaterThan(2.5)
    expect(media((m) => m.amarelos / m.jogos)).toBeLessThan(5)
    expect(media((m) => m.vermelhos / m.jogos)).toBeGreaterThan(0.08)
    expect(media((m) => m.vermelhos / m.jogos)).toBeLessThan(0.3)
    expect(media((m) => m.lesoes / m.jogos)).toBeGreaterThan(0.1)
    expect(media((m) => m.lesoes / m.jogos)).toBeLessThan(0.6)
  })

  it('o mais forte costuma ganhar, mas não sempre; melhores marcadores plausíveis', () => {
    const ranks = medidas.flatMap((m) => m.campeaoRank)
    expect(ranks.filter((r) => r <= 3).length / ranks.length).toBeGreaterThan(0.5)
    expect(ranks.some((r) => r > 1)).toBe(true)
    for (const m of medidas) expect(m.maxGolosMarcador).toBeLessThanOrEqual(42)
  })

  it('a força das divisões não deriva ao longo das épocas', () => {
    const porMundo = [0, 3, 6].map((i) => [medidas[i], medidas[i + 2]])
    for (const [a, b] of porMundo) for (let d = 0; d < 4; d++) expect(Math.abs(a.forcaMedia[d] - b.forcaMedia[d])).toBeLessThanOrEqual(3)
  })
})

describe('gravar e carregar a meio da época', () => {
  it('continuar depois de carregar dá o mesmo final que sem gravar', () => {
    memoria()
    const jogar = (comGravacao: boolean) => {
      const mundo = gerarMundo(909)
      garantirStaff(mundo)
      garantirRivais(mundo)
      const clubeId = mundo.divisoes[1].clubes[5]
      const epoca = novaEpoca(mundo, 5)
      let jogo: Jogo = { mundo, epoca, escalacao: escalarAuto(mundo, clubeId, new Set()), treinador: 'T', clubeId, criado: '' }
      let n = 0
      while (!epocaTerminada(jogo.epoca)) {
        concluirJornada(jogo.mundo, jogo.epoca, 50 + n++)
        if (comGravacao && n % 7 === 0) {
          expect(gravar(jogo)).toBe(true)
          jogo = carregar()!
          expect(jogo.epoca.jornada).toBe(n + 1)
        }
      }
      return jogo.mundo.divisoes.map((d) => tabela(jogo.mundo, jogo.epoca, d.numero).map((l) => `${l.clubeId}:${l.pts}:${l.gm}-${l.gs}`).join(','))
        .concat(String(Object.values(jogo.mundo.clubes).reduce((s, c) => s + c.dinheiro, 0)))
    }
    expect(jogar(true)).toEqual(jogar(false))
  })

  it('carregar uma época acabada fecha-a e começa a seguinte', () => {
    memoria()
    for (const div of [0, 3]) {
      const mundo = gerarMundo(42 + div)
      const clubeId = mundo.divisoes[div].clubes[0]
      const epoca = novaEpoca(mundo, 1)
      let n = 0
      while (!epocaTerminada(epoca)) concluirJornada(mundo, epoca, n++)
      gravar({ mundo, epoca, escalacao: escalarAuto(mundo, clubeId, new Set()), treinador: 'T', clubeId, criado: '' })
      const j = carregar()!
      expect(j.mundo.epoca).toBe(2028)
      expect(j.epoca.jornada).toBe(1)
      expect(j.escalacao.titulares).toHaveLength(11)
      for (const d of j.mundo.divisoes) expect(d.clubes).toHaveLength(18)
    }
  })
})

describe('finanças ao longo das épocas (sem mercado)', () => {
  it('ninguém de meio da tabela vai à falência e a 1.ª não acumula sem limite', () => {
    const ms = medirCarreira(55, 3)
    // Sem mercado, quem desce não consegue vender salários altos: alguns vão ao vermelho (o teste com mercado é mais apertado).
    for (const m of ms) expect(m.falidos).toBeLessThanOrEqual(6)
    const d1 = ms.map((m) => m.dinheiroMediano[0])
    // Lucro mediano da 1.ª por época abaixo de 8 M€.
    expect(d1[2] - d1[0]).toBeLessThan(16_000_000)
    for (const m of ms) expect(m.dinheiroMediano[3]).toBeGreaterThan(0)
  })
})

describe('dinheiro com mercado, contratos, obras e empréstimos', () => {
  it('sem falências em massa, salários sem inflação e sem dinheiro a explodir', async () => {
    const { medirDinheiro } = await import('./medir')
    const ms = medirDinheiro(21, 4)
    for (const m of ms) expect(m.vermelho).toBeLessThanOrEqual(6)
    const [a, z] = [ms[0], ms[ms.length - 1]]
    for (let d = 1; d < 4; d++) expect(z.salarios[d]).toBeLessThan(a.salarios[d] * 1.6)
    expect((z.total - a.total) / (ms.length - 1)).toBeLessThan(100_000_000)
    // A força das divisões não se aproxima demasiado (no início: ~71/58/48/38).
    for (let d = 0; d < 4; d++) expect(Math.abs(z.forcaMedia[d] - a.forcaMedia[d])).toBeLessThanOrEqual(4)
    for (let d = 0; d < 3; d++) expect(z.forcaMedia[d] - z.forcaMedia[d + 1]).toBeGreaterThanOrEqual(7)
  }, 30_000)
})
