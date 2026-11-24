import { describe, expect, it } from 'vitest'
import { gerarMundo } from './mundo'
import { escalarAuto, simularJogo } from './motor'
import { escalarIA } from './tatica'
import { comInstrucao, manterPlano, planoIA, type PlanoJogo } from './plano'
import { relatorioAdversario } from './relatorio'
import type { Escalacao, Partida } from './partida'
import type { Mundo } from './types'

function partidaNova(casaId: number, foraId: number): Partida {
  return {
    id: `t-${casaId}-${foraId}`, competicao: 'liga', divisao: 1, jornada: 1, casaId, foraId,
    golos: [0, 0], eventos: [], jogada: false,
    estat: { posse: [50, 50], remates: [0, 0], rematesBaliza: [0, 0], cantos: [0, 0], amarelos: [0, 0], vermelhos: [0, 0] },
  }
}

/** Dois clubes com a mesma força para todos (só o perfil e o plano mudam). */
function mundoIgual(): { m: Mundo; a: number; b: number } {
  const m = gerarMundo(31)
  const [a, b] = m.divisoes[0].clubes
  for (const id of [...m.clubes[a].plantel, ...m.clubes[b].plantel]) m.jogadores[id].forca = 65
  return { m, a, b }
}

/** Joga n jogos de A (com o plano dado) contra B, metade em casa, e soma o que `contar` devolve por jogo. */
function jogar(m: Mundo, a: number, b: number, plano: PlanoJogo | undefined, n: number, contar: (p: Partida, lado: 0 | 1) => number): number {
  const ea: Escalacao = { ...escalarAuto(m, a, new Set()), ...(plano ? { plano } : {}) }
  const eb = escalarAuto(m, b, new Set())
  let t = 0
  for (let s = 0; s < n; s++) {
    const casa = s % 2 === 0
    const p = casa ? simularJogo(m, partidaNova(a, b), ea, eb, s) : simularJogo(m, partidaNova(b, a), eb, ea, s)
    t += contar(p, casa ? 0 : 1)
  }
  return t
}

describe('plano de jogo', () => {
  it('sem plano o motor joga como antes (o plano é opcional)', () => {
    const { m, a, b } = mundoIgual()
    const ea = escalarAuto(m, a, new Set()), eb = escalarAuto(m, b, new Set())
    const p1 = simularJogo(m, partidaNova(a, b), ea, eb, 5)
    const p2 = simularJogo(m, partidaNova(a, b), { ...ea, plano: {} }, eb, 5)
    expect(p2.golos).toEqual(p1.golos)
    expect(p2.eventos.length).toBe(p1.eventos.length)
  })

  it('cantos à área rendem com cabeceadores fortes e cantos curtos com bons passadores', () => {
    const { m, a, b } = mundoIgual()
    const campo = escalarAuto(m, a, new Set()).titulares.slice(1)
    // Equipa A: muito físico, passe fraco.
    for (const id of campo) m.jogadores[id].perfil = { vel: 0, rem: 0, pas: -12, def: 0, fis: 14, gr: -40 }
    const golosCanto = (p: Partida, l: 0 | 1) => p.eventos.filter((e) => e.tipo === 'golo' && e.lado === (l === 0 ? 'casa' : 'fora') && e.lance?.origem === 'canto').length
    const area = jogar(m, a, b, { canto: 'area' }, 1500, golosCanto)
    const curto = jogar(m, a, b, { canto: 'curto' }, 1500, golosCanto)
    expect(area).toBeGreaterThan(curto * 1.15)
  })

  it('marcar de perto o craque tira-lhe golos', () => {
    const { m, a, b } = mundoIgual()
    const av = escalarAuto(m, b, new Set()).titulares.find((id) => m.jogadores[id].posicao === 'AV')!
    m.jogadores[av].forca = 80
    const med = escalarAuto(m, a, new Set()).titulares.find((id) => m.jogadores[id].posicao === 'MED')!
    const golosDele = (p: Partida) => p.eventos.filter((e) => e.tipo === 'golo' && e.jogadorId === av).length
    const livre = jogar(m, a, b, undefined, 500, golosDele)
    const marcado = jogar(m, a, b, { ...comInstrucao(undefined, med, 'marcar'), alvo: av }, 500, golosDele)
    expect(marcado).toBeLessThan(livre * 0.85)
  })

  it('a pressão alta dá mais bola a quem tem físico e velocidade', () => {
    const { m, a, b } = mundoIgual()
    for (const id of escalarAuto(m, a, new Set()).titulares.slice(1)) m.jogadores[id].perfil = { vel: 8, rem: -4, pas: -4, def: -4, fis: 8, gr: -40 }
    const posse = (p: Partida, l: 0 | 1) => p.estat.posse[l]
    const zona = jogar(m, a, b, { marcacao: 'zona' }, 100, posse) / 100
    const pressao = jogar(m, a, b, { marcacao: 'pressao' }, 100, posse) / 100
    expect(pressao).toBeGreaterThan(zona + 2)
  })

  it('só um jogador marca de perto e o plano sobrevive a refazer o onze', () => {
    let p = comInstrucao(undefined, 1, 'marcar')
    p = comInstrucao(p, 2, 'marcar')
    expect(p.instrucoes).toEqual({ 2: 'marcar' })
    p = comInstrucao(p, 2, undefined)
    expect(p.instrucoes).toEqual({})
    const velha: Escalacao = { formacao: '4-4-2', postura: 'ofensiva', titulares: [], suplentes: [], plano: { marcacao: 'pressao' } }
    const nova = manterPlano({ formacao: '4-3-3', postura: 'equilibrada', titulares: [1], suplentes: [] }, velha)
    expect(nova.plano?.marcacao).toBe('pressao')
    expect(nova.postura).toBe('ofensiva')
    expect(nova.formacao).toBe('4-3-3')
  })

  it('a IA escolhe um plano e o olheiro melhor diz mais', () => {
    const m = gerarMundo(9)
    const [a, b] = m.divisoes[0].clubes
    const ea = escalarIA(m, a, b, true, new Set()), eb = escalarIA(m, b, a, false, new Set())
    expect(ea.plano?.marcacao).toBeDefined()
    expect(ea.plano?.canto).toBeDefined()
    expect(planoIA(m, ea, eb).batedor).toBeDefined()
    const r0 = relatorioAdversario(m, ea, eb, 0), r4 = relatorioAdversario(m, ea, eb, 4)
    expect(r0.chave.length).toBe(1)
    expect(r0.sugestoes.length).toBeLessThanOrEqual(1)
    expect(r4.chave.length).toBeGreaterThan(1)
    expect(r4.sugestoes.length).toBeGreaterThanOrEqual(r0.sugestoes.length)
    expect(r4.habitos).toBeTruthy()
  })
})
