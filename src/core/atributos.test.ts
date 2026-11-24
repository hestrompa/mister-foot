import { describe, expect, it } from 'vitest'
import { gerarMundo } from './mundo'
import { ATRIBUTOS, PESOS, atributo, atributosDe, mexerPerfil, perfilDe, pontosFortes, type Atributo } from './atributos'
import { escalarAuto, simularJogo } from './motor'
import { evoluirFimEpoca, mudarTreinoAtributo, treinarJornada, staffDe } from './staff'
import { createRng } from './rng'
import type { Partida } from './partida'
import type { Jogador } from './types'

function media(j: Jogador): number {
  const at = atributosDe(j)
  let s = 0
  for (const [a, w] of Object.entries(PESOS[j.posicao]) as [Atributo, number][]) s += w * at[a]
  return s
}

function partidaNova(i: number, casaId: number, foraId: number): Partida {
  return {
    id: `t-${i}`, competicao: 'liga', divisao: 1, jornada: 1, casaId, foraId, golos: [0, 0], eventos: [], jogada: false,
    estat: { posse: [50, 50], remates: [0, 0], rematesBaliza: [0, 0], cantos: [0, 0], amarelos: [0, 0], vermelhos: [0, 0] },
  }
}

describe('atributos', () => {
  it('a média pesada dos atributos da posição é a força, e o perfil é sempre o mesmo', () => {
    const m = gerarMundo(3)
    const js = Object.values(m.jogadores)
    for (const j of js) {
      expect(Math.abs(media(j) - j.forca)).toBeLessThan(2.5)
      for (const a of ATRIBUTOS) expect(atributo(j, a)).toBeGreaterThanOrEqual(1)
    }
    // Gravações antigas não têm perfil: o calculado não depende de nada guardado.
    const j = js[10]
    expect(j.perfil).toBeUndefined()
    expect(atributosDe({ ...j })).toEqual(atributosDe(j))
    // Fora da posição: um central remata pior do que defende.
    const centrais = js.filter((x) => x.posicao === 'DEF')
    expect(centrais.every((x) => atributo(x, 'rem') < atributo(x, 'def'))).toBe(true)
    // Há variedade de pontos fortes nos avançados.
    const fortes = new Set(js.filter((x) => x.posicao === 'AV').map((x) => pontosFortes(x, 1)[0]))
    expect(fortes.size).toBeGreaterThanOrEqual(3)
  })

  it('mexer no perfil especializa sem mudar a força', () => {
    const m = gerarMundo(3)
    const j = Object.values(m.jogadores).find((x) => x.posicao === 'MED')!
    const antes = atributo(j, 'pas')
    for (let k = 0; k < 5; k++) mexerPerfil(j, { pas: 2 })
    expect(atributo(j, 'pas')).toBeGreaterThan(antes)
    expect(Math.abs(media(j) - j.forca)).toBeLessThan(2.5)
    expect(JSON.parse(JSON.stringify(j)).perfil).toEqual(perfilDe(j))
  })

  it('o treino específico sobe o atributo escolhido; a idade tira velocidade', () => {
    const m = gerarMundo(5)
    const cid = m.divisoes[0].clubes[0]
    const c = m.clubes[cid]
    mudarTreinoAtributo(m, cid, 'vel')
    const ids = c.plantel.filter((id) => m.jogadores[id].posicao !== 'GR')
    const antes = ids.map((id) => atributo(m.jogadores[id], 'vel') - m.jogadores[id].forca)
    for (let s = 0; s < 34; s++) treinarJornada(m, [cid], new Set(), s, 2026)
    const depois = ids.map((id) => atributo(m.jogadores[id], 'vel') - m.jogadores[id].forca)
    const ganho = depois.reduce((s, d, i) => s + d - antes[i], 0) / ids.length
    expect(ganho).toBeGreaterThan(0.5)
    expect(Object.keys(staffDe(c)?.ganhosAtrib ?? {}).length).toBeGreaterThan(0)

    const velho = Object.values(m.jogadores).find((x) => x.idade >= 31 && x.posicao === 'AV')!
    const v0 = atributo(velho, 'vel') - velho.forca
    evoluirFimEpoca(m, velho, createRng(1))
    expect(atributo(velho, 'vel') - velho.forca).toBeLessThan(v0)
  })

  it('no motor, o melhor rematador marca mais do que um colega da mesma força', () => {
    const m = gerarMundo(9)
    const [a, b] = m.divisoes[0].clubes
    for (const cid of [a, b]) for (const id of m.clubes[cid].plantel) m.jogadores[id].forca = 60
    const ea = escalarAuto(m, a, new Set()), eb = escalarAuto(m, b, new Set())
    const avs = ea.titulares.map((id) => m.jogadores[id]).filter((j) => j.posicao === 'AV')
    const [x, y] = avs
    x.perfil = { ...perfilDe(x) }; y.perfil = { ...perfilDe(y) }
    mexerPerfil(x, { rem: 30 }); mexerPerfil(y, { rem: -30 })
    expect(atributo(x, 'rem')).toBeGreaterThan(atributo(y, 'rem') + 10)
    const golos: Record<number, number> = {}
    for (let s = 0; s < 400; s++) {
      const p = simularJogo(m, partidaNova(s, a, b), ea, eb, s)
      for (const e of p.eventos) if (e.tipo === 'golo' && e.jogadorId != null) golos[e.jogadorId] = (golos[e.jogadorId] ?? 0) + 1
    }
    expect(golos[x.id] ?? 0).toBeGreaterThan((golos[y.id] ?? 0) * 1.3)
  })
})
