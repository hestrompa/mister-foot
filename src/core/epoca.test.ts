import { describe, expect, it } from 'vitest'
import { CLUBES_POR_DIVISAO, NUM_DIVISOES, gerarMundo } from './mundo'
import { escalarAuto, simularJogo } from './motor'
import { concluirJornada, epocaTerminada, fecharEpoca, indisponiveisDe, novaEpoca, partidasDaJornada, tabela } from './epoca'
import type { EstadoEpoca, EventoJogo, Partida } from './partida'
import type { Mundo } from './types'

function motorPronto(): boolean {
  try {
    const m = gerarMundo(1)
    const e = novaEpoca(m, 1)
    const p = partidasDaJornada(e, 1)[0]
    simularJogo(m, p, escalarAuto(m, p.casaId, new Set()), escalarAuto(m, p.foraId, new Set()), 1)
    return true
  } catch (err) {
    if (err instanceof Error && err.message.includes('por implementar')) return false
    throw err
  }
}

/** Marca todas as partidas da jornada atual como jogadas 0-0 (sem motor), com eventos opcionais. */
function jogarJornadaAMao(mundo: Mundo, epoca: EstadoEpoca, eventos: (p: Partida) => EventoJogo[] = () => []) {
  for (const d of mundo.divisoes) {
    for (const p of partidasDaJornada(epoca, d.numero)) {
      p.jogada = true
      p.eventos = eventos(p)
    }
  }
}

describe('calendário', () => {
  const m = gerarMundo(2024)
  const e = novaEpoca(m, 7)

  it('tem 34 jornadas de 9 jogos em cada divisão', () => {
    expect(e.totalJornadas).toBe(34)
    expect(e.jornada).toBe(1)
    expect(e.calendario).toHaveLength(NUM_DIVISOES)
    for (const jornadas of e.calendario) {
      expect(jornadas).toHaveLength(34)
      for (const partidas of jornadas) expect(partidas).toHaveLength(9)
    }
  })

  it('cada clube joga 34 vezes, 17 em casa, uma vez por jornada, e cada par encontra-se em casa de cada um', () => {
    for (const div of m.divisoes) {
      const jornadas = e.calendario[div.numero - 1]
      const jogos = new Map<number, number>()
      const casa = new Map<number, number>()
      const pares = new Set<string>()
      jornadas.forEach((partidas, j) => {
        const nesta = new Set<number>()
        for (const p of partidas) {
          expect(p.jornada).toBe(j + 1)
          expect(p.divisao).toBe(div.numero)
          expect(p.id).toBe(`L${m.epoca}-D${div.numero}-J${j + 1}-${p.casaId}-${p.foraId}`)
          expect(p.jogada).toBe(false)
          expect(p.golos).toEqual([0, 0])
          expect(nesta.has(p.casaId) || nesta.has(p.foraId)).toBe(false)
          nesta.add(p.casaId)
          nesta.add(p.foraId)
          jogos.set(p.casaId, (jogos.get(p.casaId) ?? 0) + 1)
          jogos.set(p.foraId, (jogos.get(p.foraId) ?? 0) + 1)
          casa.set(p.casaId, (casa.get(p.casaId) ?? 0) + 1)
          const chave = `${p.casaId}-${p.foraId}`
          expect(pares.has(chave)).toBe(false)
          pares.add(chave)
        }
      })
      expect(jogos.size).toBe(CLUBES_POR_DIVISAO)
      for (const id of div.clubes) {
        expect(jogos.get(id)).toBe(34)
        expect(casa.get(id)).toBe(17)
      }
      for (const a of div.clubes) for (const b of div.clubes) if (a !== b) expect(pares.has(`${a}-${b}`)).toBe(true)
    }
  })

  it('a segunda volta espelha a primeira com casa e fora trocados', () => {
    for (const jornadas of e.calendario) {
      for (let j = 0; j < 17; j++) {
        const ida = jornadas[j].map((p) => `${p.foraId}-${p.casaId}`).sort()
        const volta = jornadas[j + 17].map((p) => `${p.casaId}-${p.foraId}`).sort()
        expect(volta).toEqual(ida)
      }
    }
  })

  it('casa e fora alternam razoavelmente (nunca 3 seguidos fora ou em casa mais de algumas vezes)', () => {
    for (const div of m.divisoes) {
      const jornadas = e.calendario[div.numero - 1]
      for (const id of div.clubes) {
        const seq = jornadas.map((ps) => (ps.find((p) => p.casaId === id) ? 'C' : 'F')).join('')
        expect(seq).not.toMatch(/CCCC|FFFF/)
      }
    }
  })

  it('é determinístico', () => {
    expect(JSON.stringify(novaEpoca(gerarMundo(2024), 7))).toBe(JSON.stringify(e))
  })
})

describe('tabela', () => {
  it('ordena por pontos, diferença de golos, golos marcados e nome', () => {
    const m = gerarMundo(5)
    const e = novaEpoca(m, 5)
    const div = m.divisoes[0]
    const [a, b, c, d] = div.clubes
    // Um calendário pequeno feito à mão na divisão 1.
    const p = (j: number, casa: number, fora: number, golos: [number, number]): Partida => ({
      id: `t${j}-${casa}-${fora}`, competicao: 'liga', divisao: 1, jornada: j, casaId: casa, foraId: fora, golos,
      eventos: [], estat: { posse: [50, 50], remates: [0, 0], rematesBaliza: [0, 0], cantos: [0, 0], amarelos: [0, 0], vermelhos: [0, 0] },
      jogada: true,
    })
    e.calendario[0] = [
      [p(1, a, b, [2, 0]), p(1, c, d, [1, 1])],
      [p(2, b, c, [3, 0]), p(2, d, a, [0, 1])],
      [p(3, a, c, [0, 0]), { ...p(3, b, d, [5, 0]), jogada: false }],
    ]
    const t = tabela(m, e, 1)
    // a: V V E = 7 pts, +3. b: D V = 3 pts, +1 (3-2). c: E D E = 2 pts, -3. d: E D = 1 pt, -1.
    expect(t.map((l) => l.clubeId)).toEqual([a, b, c, d])
    expect(t[0]).toMatchObject({ j: 3, v: 2, e: 1, d: 0, gm: 3, gs: 0, pts: 7, forma: ['V', 'V', 'E'] })
    expect(t[1]).toMatchObject({ j: 2, pts: 3, gm: 3, gs: 2, forma: ['D', 'V'] })
    expect(t[3]).toMatchObject({ j: 2, pts: 1, forma: ['E', 'D'] })

    // Desempates: mesma pontuação, decide a diferença de golos, depois golos marcados, depois o nome.
    m.clubes[a].nome = 'Zeta'
    m.clubes[b].nome = 'Alfa'
    e.calendario[0] = [[p(1, a, c, [2, 1]), p(1, b, d, [1, 0])]]
    expect(tabela(m, e, 1).slice(0, 2).map((l) => l.clubeId)).toEqual([a, b]) // mesma DG, a marcou mais
    e.calendario[0] = [[p(1, a, c, [1, 0]), p(1, b, d, [1, 0])]]
    expect(tabela(m, e, 1).slice(0, 2).map((l) => l.clubeId)).toEqual([b, a]) // tudo igual: Alfa antes de Zeta
    e.calendario[0] = [[p(1, a, c, [3, 2]), p(1, b, d, [1, 0])], [p(2, a, d, [0, 0]), p(2, b, c, [0, 0])]]
    // Igual em pontos e DG, a marcou mais.
    expect(tabela(m, e, 1).slice(0, 2).map((l) => l.clubeId)).toEqual([a, b])
  })

  it('forma guarda só os últimos 5 resultados', () => {
    const m = gerarMundo(6)
    const e = novaEpoca(m, 6)
    for (let j = 0; j < 7; j++) for (const p of e.calendario[0][j]) { p.jogada = true; p.golos = [1, 0] }
    for (const l of tabela(m, e, 1)) {
      expect(l.j).toBe(7)
      expect(l.forma).toHaveLength(5)
    }
  })
})

describe('castigos, lesões e marcadores', () => {
  it('aplica cartões e lesões, desconta jornada a jornada e avança', () => {
    const m = gerarMundo(11)
    const e = novaEpoca(m, 11)
    const p0 = partidasDaJornada(e, 1)[0]
    const casa = m.clubes[p0.casaId].plantel
    const fora = m.clubes[p0.foraId].plantel
    const [amarelado, expulsoDireto, segundoAmarelo, lesionado, marcador] = [casa[5], casa[6], fora[5], fora[6], fora[10]]
    e.amarelos[amarelado] = 4

    const ev = (minuto: number, tipo: EventoJogo['tipo'], jogadorId: number, extra: Partial<EventoJogo> = {}): EventoJogo =>
      ({ minuto, tipo, lado: 'casa', jogadorId, texto: '', ...extra })
    jogarJornadaAMao(m, e, (p) => p === p0 ? [
      ev(10, 'amarelo', amarelado),
      ev(20, 'vermelho', expulsoDireto),
      ev(30, 'amarelo', segundoAmarelo),
      ev(60, 'amarelo', segundoAmarelo),
      ev(60, 'vermelho', segundoAmarelo),
      ev(70, 'lesao', lesionado, { duracao: 3 }),
      ev(80, 'golo', marcador),
      ev(85, 'golo', marcador),
    ] : [])
    concluirJornada(m, e, 1)

    expect(e.jornada).toBe(2)
    expect(e.amarelos[amarelado]).toBe(0)
    expect(e.indisponiveis[amarelado]).toEqual({ jogos: 1, motivo: 'castigo' })
    expect(e.indisponiveis[expulsoDireto]).toEqual({ jogos: 2, motivo: 'castigo' })
    expect(e.indisponiveis[segundoAmarelo]).toEqual({ jogos: 1, motivo: 'castigo' })
    expect(e.amarelos[segundoAmarelo]).toBe(2)
    expect(e.indisponiveis[lesionado]).toEqual({ jogos: 3, motivo: 'lesao' })
    expect(e.marcadores[marcador]).toBe(2)
    expect(indisponiveisDe(m, e, p0.casaId)).toEqual(new Set([amarelado, expulsoDireto]))
    expect(indisponiveisDe(m, e, p0.foraId)).toEqual(new Set([segundoAmarelo, lesionado]))

    jogarJornadaAMao(m, e)
    concluirJornada(m, e, 2)
    expect(e.jornada).toBe(3)
    expect(e.indisponiveis[amarelado]).toBeUndefined()
    expect(e.indisponiveis[segundoAmarelo]).toBeUndefined()
    expect(e.indisponiveis[expulsoDireto]).toEqual({ jogos: 1, motivo: 'castigo' })
    expect(e.indisponiveis[lesionado]).toEqual({ jogos: 2, motivo: 'lesao' })

    jogarJornadaAMao(m, e)
    concluirJornada(m, e, 3)
    jogarJornadaAMao(m, e)
    concluirJornada(m, e, 4)
    expect(e.jornada).toBe(5)
    expect(Object.keys(e.indisponiveis)).toHaveLength(0)
    expect(indisponiveisDe(m, e, p0.foraId).size).toBe(0)
  })
})

describe('fim de época (sem motor)', () => {
  it('troca 3 clubes entre divisões vizinhas, envelhece jogadores e avança o ano', () => {
    const m = gerarMundo(21)
    const e = novaEpoca(m, 21)
    const ano = m.epoca
    while (!epocaTerminada(e)) {
      // Resultado determinado pelo id: o clube de id menor ganha sempre.
      for (const d of m.divisoes) for (const p of partidasDaJornada(e, d.numero)) {
        p.jogada = true
        p.golos = p.casaId < p.foraId ? [1, 0] : [0, 1]
      }
      concluirJornada(m, e, e.jornada)
    }
    const antes = JSON.parse(JSON.stringify(m)) as Mundo
    const tabelas = m.divisoes.map((d) => tabela(m, e, d.numero).map((l) => l.clubeId))
    const r = fecharEpoca(m, e)

    expect(m.epoca).toBe(ano + 1)
    expect(r.ano).toBe(ano)
    expect(r.campeoes.map((c) => c.clubeId)).toEqual(tabelas.map((t) => t[0]))
    for (let k = 0; k < NUM_DIVISOES - 1; k++) {
      expect(r.descidas[k]).toEqual({ divisao: k + 1, clubeIds: tabelas[k].slice(-3) })
      expect(r.subidas[k]).toEqual({ divisao: k + 2, clubeIds: tabelas[k + 1].slice(0, 3) })
      for (const id of tabelas[k].slice(-3)) expect(m.clubes[id].divisao).toBe(k + 2)
      for (const id of tabelas[k + 1].slice(0, 3)) expect(m.clubes[id].divisao).toBe(k + 1)
    }
    for (const d of m.divisoes) {
      expect(d.clubes).toHaveLength(CLUBES_POR_DIVISAO)
      for (const id of d.clubes) expect(m.clubes[id].divisao).toBe(d.numero)
    }
    expect(new Set(m.divisoes.flatMap((d) => d.clubes)).size).toBe(NUM_DIVISOES * CLUBES_POR_DIVISAO)

    for (const j of Object.values(m.jogadores)) {
      const a = antes.jogadores[j.id]
      expect(j.idade).toBe(a.idade + 1)
      expect(j.contrato).toBe(Math.max(0, a.contrato - 1))
      expect(j.forca).toBeGreaterThanOrEqual(1)
      expect(j.forca).toBeLessThanOrEqual(99)
      if (j.idade >= 34) expect(j.forca).toBeLessThan(a.forca)
      if (j.idade < 30 && a.forca < a.potencial) {
        // Até aos 25 cresce sempre; dos 26 aos 29 pode estabilizar.
        if (j.idade <= 25) expect(j.forca).toBeGreaterThan(a.forca)
        else expect(j.forca).toBeGreaterThanOrEqual(a.forca)
        expect(j.forca).toBeLessThanOrEqual(a.potencial)
      }
      if (j.idade < 30 && a.forca >= a.potencial) expect(j.forca).toBe(a.forca)
    }
    // A época seguinte arranca com as novas divisões.
    const e2 = novaEpoca(m, 22)
    expect(e2.ano).toBe(ano + 1)
    for (const d of m.divisoes) {
      const ids = new Set(e2.calendario[d.numero - 1][0].flatMap((p) => [p.casaId, p.foraId]))
      expect(ids).toEqual(new Set(d.clubes))
    }
  })
})

describe.skipIf(!motorPronto())('época completa com o motor', () => {
  it('cada clube joga 34 jogos, 3 sobem e 3 descem, 18 por divisão', () => {
    const m = gerarMundo(77)
    const e = novaEpoca(m, 77)
    const t0 = performance.now()
    while (!epocaTerminada(e)) concluirJornada(m, e, 1000 + e.jornada)
    const ms = performance.now() - t0
    console.log(`época completa (4 divisões, ${4 * 34 * 9} jogos): ${ms.toFixed(0)} ms`)

    for (const d of m.divisoes) {
      const t = tabela(m, e, d.numero)
      expect(t).toHaveLength(CLUBES_POR_DIVISAO)
      for (const l of t) {
        expect(l.j).toBe(34)
        expect(l.v + l.e + l.d).toBe(34)
      }
      for (const partidas of e.calendario[d.numero - 1]) for (const p of partidas) expect(p.jogada).toBe(true)
    }
    for (const ind of Object.values(e.indisponiveis)) expect(ind.jogos).toBeGreaterThan(0)

    const tabelas = m.divisoes.map((d) => tabela(m, e, d.numero).map((l) => l.clubeId))
    const r = fecharEpoca(m, e)
    for (let k = 0; k < NUM_DIVISOES - 1; k++) {
      expect(r.descidas[k].clubeIds).toHaveLength(3)
      expect(r.subidas[k].clubeIds).toHaveLength(3)
      for (const id of tabelas[k].slice(-3)) expect(m.clubes[id].divisao).toBe(k + 2)
      for (const id of tabelas[k + 1].slice(0, 3)) expect(m.clubes[id].divisao).toBe(k + 1)
    }
    for (const d of m.divisoes) expect(d.clubes).toHaveLength(CLUBES_POR_DIVISAO)
    expect(r.melhorMarcador).not.toBeNull()
    expect(Object.values(e.marcadores).reduce((a, b) => a + b, 0)).toBeGreaterThan(0)
  })
})
