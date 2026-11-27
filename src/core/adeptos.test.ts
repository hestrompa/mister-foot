import { describe, expect, it } from 'vitest'
import { gerarMundo } from './mundo'
import { concluirJornada, epocaTerminada, fecharEpoca, novaEpoca } from './epoca'
import { escalarAuto } from './motor'
import { iniciarEpocaDirecao, avancarDirecao, type JogoComCarreira } from './direcao'
import { avancarImprensa, estadoImprensa, flashPendente, responderConferencia } from './imprensa'
import { garantirRivais } from './rivalidades'
import { publicoEsperado } from './financas'
import { lugaresAnuais } from './inicio-epoca'
import { definirHumor, deltaJogo, humorDe, nivelHumor } from './adeptos'
import type { Jogo } from './types'
import type { Partida } from './partida'

function jogoEm(semente: number): Jogo {
  const mundo = gerarMundo(semente)
  garantirRivais(mundo)
  const id = mundo.divisoes[2].clubes[0]
  const epoca = novaEpoca(mundo, semente + 1)
  const jogo = { mundo, epoca, escalacao: escalarAuto(mundo, id, new Set()), treinador: 'T', clubeId: id, criado: '' } as Jogo
  iniciarEpocaDirecao(jogo as JogoComCarreira)
  avancarImprensa(jogo)
  return jogo
}

describe('adeptos', () => {
  it('adeptos contentes enchem mais o estádio e compram mais lugares anuais', () => {
    const mundo = gerarMundo(11)
    const [a, b] = mundo.divisoes[1].clubes.map((id) => mundo.clubes[id])
    a.estadio.lugares = 200_000
    definirHumor(a, 10)
    const triste = publicoEsperado(a, b, 5, 18)
    const anuaisTriste = lugaresAnuais(a)
    definirHumor(a, 90)
    expect(publicoEsperado(a, b, 5, 18)).toBeGreaterThan(triste * 1.3)
    expect(lugaresAnuais(a)).toBeGreaterThan(anuaisTriste)
  })

  it('vitória inesperada alegra mais do que a esperada; derrota no dérbi dói mais', () => {
    const mundo = gerarMundo(12)
    garantirRivais(mundo)
    const ids = mundo.divisoes[0].clubes
    const p = (casaId: number, foraId: number, golos: [number, number]) => ({ casaId, foraId, golos, jogada: true, eventos: [] }) as unknown as Partida
    const [x, y] = ids
    for (const c of [x, y]) mundo.clubes[c].bilhete = 15
    const ganha = deltaJogo(mundo, p(x, y, [1, 0]), x)
    const perde = deltaJogo(mundo, p(x, y, [0, 1]), x)
    expect(ganha).toBeGreaterThan(0)
    expect(perde).toBeLessThan(0)
    // Bilhete muito caro tira humor em casa.
    mundo.clubes[x].bilhete = 40
    expect(deltaJogo(mundo, p(x, y, [1, 0]), x)).toBeLessThan(ganha)
  })

  it('numa época o humor espalha-se mas fica, em média, perto do neutro', () => {
    const jogo = jogoEm(21)
    let n = 0
    while (!epocaTerminada(jogo.epoca)) {
      concluirJornada(jogo.mundo, jogo.epoca, 900 + n++)
      avancarDirecao(jogo as JogoComCarreira)
      avancarImprensa(jogo)
    }
    const hs = Object.values(jogo.mundo.clubes).map(humorDe)
    const media = hs.reduce((s, h) => s + h, 0) / hs.length
    expect(media).toBeGreaterThan(38)
    expect(media).toBeLessThan(62)
    const niveis = new Set(hs.map(nivelHumor))
    expect(niveis.size).toBeGreaterThanOrEqual(3)
    expect(Math.max(...hs) - Math.min(...hs)).toBeGreaterThan(30)
    fecharEpoca(jogo.mundo, jogo.epoca)
    const depois = Object.values(jogo.mundo.clubes).map(humorDe)
    expect(Math.max(...depois) - Math.min(...depois)).toBeLessThan(Math.max(...hs) - Math.min(...hs) + 25)
  })

  it('depois de cada jogo há uma conferência; responder mexe nos adeptos e sai notícia', () => {
    const jogo = jogoEm(31)
    concluirJornada(jogo.mundo, jogo.epoca, 77)
    avancarDirecao(jogo as JogoComCarreira)
    avancarImprensa(jogo)
    const f = flashPendente(jogo)
    expect(f).toBeDefined()
    expect(f!.momento).toBe('depois')
    const i = f!.opcoes.findIndex((o) => (o.adeptos ?? 0) > 0)
    expect(i).toBeGreaterThanOrEqual(0)
    const meu = jogo.mundo.clubes[jogo.clubeId]
    const antes = humorDe(meu)
    const seq = estadoImprensa(jogo).seq
    expect(responderConferencia(jogo, i, 'depois')).toBe(true)
    expect(humorDe(meu)).toBeGreaterThan(antes)
    expect(estadoImprensa(jogo).seq).toBe(seq + 1)
    expect(flashPendente(jogo)).toBeUndefined()
    expect(responderConferencia(jogo, i, 'depois')).toBe(false)
    // A conferência antes do jogo seguinte é independente.
    concluirJornada(jogo.mundo, jogo.epoca, 78)
    avancarImprensa(jogo)
    expect(flashPendente(jogo)?.jornada).toBe(2)
  })
})
