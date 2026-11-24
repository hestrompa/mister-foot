import { describe, expect, it } from 'vitest'
import { gerarMundo } from './mundo'
import { concluirJornada, epocaTerminada, fecharEpoca } from './epoca'
import { prepararEpoca } from '../jogo/gravar'
import { avancarMercado } from './mercado'
import type { Jogo } from './types'
import { LIMIAR_LENDA, histDe, idadeReforma, jogosNaEpoca, lendas, pontosLenda, registarReforma, reformas, totaisCarreira, type JogadorComHist, type LinhaHist } from './carreira-jogador'
import { NOME_PERSONALIDADE, personalidadeDe, type Personalidade } from './personalidade'
import { bonusAcademia, custoAcademia, melhorarAcademia, nivelAcademia, nivelPadraoAcademia } from './academia'
import { gerarJunior } from './juniores'
import { createRng } from './rng'

function jogar(epocas: number, semente = 7) {
  const mundo = gerarMundo(semente)
  const jogo = prepararEpoca({ mundo, treinador: 'T', clubeId: mundo.divisoes[0].clubes[0], criado: '' } as Jogo)
  for (let e = 0; e < epocas; e++) {
    let n = 0
    avancarMercado(jogo)
    while (!epocaTerminada(jogo.epoca)) { concluirJornada(mundo, jogo.epoca, semente * 1000 + e * 50 + n++); avancarMercado(jogo) }
    if (e === epocas - 1) return { jogo, mundo }
    fecharEpoca(mundo, jogo.epoca)
    prepararEpoca(jogo)
  }
  return { jogo, mundo }
}

describe('carreira dos jogadores', () => {
  it('conta jogos na época e grava uma linha de histórico por época, com golos certos', () => {
    const { jogo, mundo } = jogar(1)
    const meu = mundo.clubes[jogo.clubeId]
    const jogosPlantel = meu.plantel.map((id) => jogosNaEpoca(jogo.epoca, id))
    // Um onze joga 34 jornadas: o plantel soma perto de 11 x 34 jogos (quem saiu a meio leva os seus).
    expect(jogosPlantel.reduce((s, x) => s + x, 0)).toBeGreaterThanOrEqual(11 * jogo.epoca.totalJornadas * 0.85)
    expect(Math.max(...jogosPlantel)).toBeLessThanOrEqual(jogo.epoca.totalJornadas)
    const marcadores = { ...jogo.epoca.marcadores }
    const ano = jogo.epoca.ano
    fecharEpoca(mundo, jogo.epoca)
    for (const id of meu.plantel) {
      const h = histDe(mundo.jogadores[id])
      expect(h).toHaveLength(1)
      expect(h[0][0]).toBe(ano)
      expect(h[0][1]).toBe(meu.id)
      expect(h[0][4]).toBe(marcadores[id] ?? 0)
    }
  })

  it('reformas entre os 33 e os 39 e lendas só para carreiras grandes', () => {
    const m = gerarMundo(3)
    for (const j of Object.values(m.jogadores)) {
      const r = idadeReforma(j)
      expect(r).toBeGreaterThanOrEqual(33)
      expect(r).toBeLessThanOrEqual(39)
    }
    const c = m.clubes[m.divisoes[0].clubes[0]]
    const j = m.jogadores[c.plantel[0]] as JogadorComHist
    j.hist = [[2020, c.id, 1, 30, 2, 60]]
    expect(pontosLenda(j)).toBeLessThan(LIMIAR_LENDA)
    expect(registarReforma(m, j, -1).lenda).toBe(false)
    expect(lendas(m)).toHaveLength(0)
    j.hist = Array.from({ length: 16 }, (_, k) => [2020 + k, c.id, 1, 34, 12, 70 + (k % 5)] as LinhaHist)
    expect(totaisCarreira(j).jogos).toBe(16 * 34)
    expect(pontosLenda(j)).toBeGreaterThanOrEqual(LIMIAR_LENDA)
    expect(registarReforma(m, j, -1).lenda).toBe(true)
    expect(lendas(m)[0].clubes[0][0]).toBe(c.id)
    expect(reformas(m)[0].id).toBe(j.id)
  })

  it('várias épocas: o histórico cresce e quem chega à idade da reforma sai', () => {
    const { mundo } = jogar(4, 11)
    const ativos = Object.values(mundo.jogadores).filter((j) => j.clubeId > 0 && mundo.clubes[j.clubeId]?.divisao >= 1)
    expect(ativos.some((j) => histDe(j).length >= 3)).toBe(true)
    // Só fica quem o plantel não pode perder (posição a descoberto).
    expect(ativos.filter((j) => j.idade > idadeReforma(j) + 1).length).toBeLessThanOrEqual(2)
  })
})

describe('personalidade', () => {
  it('cerca de 60% tem um traço, todos os traços aparecem, e é estável', () => {
    const m = gerarMundo(5)
    const js = Object.values(m.jogadores)
    const conta = new Map<Personalidade | undefined, number>()
    for (const j of js) conta.set(personalidadeDe(j), (conta.get(personalidadeDe(j)) ?? 0) + 1)
    for (const p of Object.keys(NOME_PERSONALIDADE) as Personalidade[]) expect(conta.get(p) ?? 0).toBeGreaterThan(js.length * 0.02)
    const sem = (conta.get(undefined) ?? 0) / js.length
    expect(sem).toBeGreaterThan(0.3)
    expect(sem).toBeLessThan(0.5)
    expect(personalidadeDe(js[10])).toBe(personalidadeDe({ ...js[10] }))
  })
})

describe('academia', () => {
  it('nível normal pela reputação, a obra custa e melhora os juniores', () => {
    const m = gerarMundo(9)
    const c = m.clubes[m.divisoes[0].clubes[0]]
    const n0 = nivelPadraoAcademia(c)
    expect(nivelAcademia(c)).toBe(n0)
    expect(bonusAcademia(c)).toBe(0)
    const antes = Array.from({ length: 60 }, () => gerarJunior(m, createRng(1), c.id))
    c.dinheiro = 50_000_000
    const custo = custoAcademia(c, n0 + 1)
    expect(melhorarAcademia(c).ok).toBe(true)
    expect(c.dinheiro).toBe(50_000_000 - custo)
    if (nivelAcademia(c) < 5) melhorarAcademia(c)
    expect(bonusAcademia(c)).toBeGreaterThanOrEqual(1)
    const depois = Array.from({ length: 60 }, () => gerarJunior(m, createRng(1), c.id))
    const media = (l: typeof antes) => l.reduce((s, j) => s + j.potencial, 0) / l.length
    expect(media(depois)).toBeGreaterThan(media(antes))
  })
})
