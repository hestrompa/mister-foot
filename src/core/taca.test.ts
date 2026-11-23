import { describe, expect, it } from 'vitest'
import { gerarMundo } from './mundo'
import { concluirJornada, epocaTerminada, fecharEpoca, novaEpoca } from './epoca'
import { escalarAuto } from './motor'
import { createRng } from './rng'
import type { Jogo } from './types'
import {
  avancarTaca, garantirTaca, registarCampeao, rondaPendente, jogarRondaTaca, jornadasDaTaca, marcarPenaltis, meuJogoPendente, minhaSituacao,
  textoResultado, vencedorDe, type JogoComTaca,
} from './taca'

function novoJogo(semente: number, div = 4): JogoComTaca {
  const mundo = gerarMundo(semente)
  const clubeId = mundo.divisoes[div - 1].clubes[0]
  const epoca = novaEpoca(mundo, semente + 1)
  return { mundo, epoca, escalacao: escalarAuto(mundo, clubeId, new Set()), treinador: 'T', clubeId, criado: '' } as Jogo
}

/** Joga a época inteira como a App: liga, depois as rondas da taça (a minha simulada também). */
function jogarEpoca(jogo: JogoComTaca) {
  garantirTaca(jogo)
  let n = 0
  while (!epocaTerminada(jogo.epoca)) {
    if (meuJogoPendente(jogo)) jogarRondaTaca(jogo)
    concluirJornada(jogo.mundo, jogo.epoca, 500 + n++)
    avancarTaca(jogo)
  }
  if (meuJogoPendente(jogo)) jogarRondaTaca(jogo)
}

describe('Taça Nacional', () => {
  it('espalha as rondas pela época e acaba antes da última jornada', () => {
    expect(jornadasDaTaca(7, 34)).toEqual([3, 8, 13, 18, 22, 27, 32])
  })

  it('72 clubes: preliminar com 16 da 4.ª, depois 64, e uma final com um vencedor', () => {
    const jogo = novoJogo(11)
    const t = garantirTaca(jogo)
    expect(t.rondas.map((r) => r.nome)).toEqual([
      'Eliminatória preliminar', '1.ª eliminatória', '2.ª eliminatória', 'Oitavos de final', 'Quartos de final', 'Meias-finais', 'Final',
    ])
    expect(t.rondas[0].jogos).toHaveLength(8)
    expect(t.rondas[0].isentos).toHaveLength(56)
    for (const p of t.rondas[0].jogos) {
      expect(jogo.mundo.clubes[p.casaId].divisao).toBe(4)
      expect(jogo.mundo.clubes[p.foraId].divisao).toBe(4)
    }
    const dinheiroAntes = Object.values(jogo.mundo.clubes).reduce((s, c) => s + c.dinheiro, 0)
    jogarEpoca(jogo)
    expect(t.atual).toBe(7)
    expect(t.rondas.map((r) => r.jogos.length)).toEqual([8, 32, 16, 8, 4, 2, 1])
    expect(Object.keys(t.eliminados)).toHaveLength(71)
    expect(t.historico).toHaveLength(1)
    const final = t.rondas[6].jogos[0]
    expect(t.historico[0].vencedorId).toBe(vencedorDe(final))
    // Na taça não há empates: quem empata aos 90 vai a prolongamento e, se persistir, a penáltis.
    let prolongados = 0, decididosNoProlongamento = 0
    for (const r of t.rondas) for (const p of r.jogos) {
      expect(p.jogada).toBe(true)
      if (p.prolongamento) prolongados++
      if (p.golos[0] === p.golos[1]) {
        expect(p.prolongamento).toBe(true)
        expect(p.penaltis![0]).not.toBe(p.penaltis![1])
      } else {
        expect(p.penaltis).toBeUndefined()
        if (p.prolongamento) decididosNoProlongamento++
      }
    }
    expect(prolongados).toBeGreaterThan(5)
    expect(decididosNoProlongamento).toBeGreaterThan(0)
    // Joga em casa o clube da divisão mais baixa (menos na final, em campo neutro).
    for (const r of t.rondas.slice(0, 6)) for (const p of r.jogos) {
      expect(jogo.mundo.clubes[p.casaId].divisao).toBeGreaterThanOrEqual(jogo.mundo.clubes[p.foraId].divisao)
    }
    const premios = Object.values(t.receitas).reduce((s, v) => s + v, 0)
    expect(premios).toBeGreaterThan(3_000_000)
    expect(premios).toBeLessThan(20_000_000)
    expect(t.receitas[t.historico[0].vencedorId]).toBeGreaterThan(1_700_000)
    expect(Object.values(jogo.mundo.clubes).reduce((s, c) => s + c.dinheiro, 0)).not.toBe(dinheiroAntes)
    expect(t.noticias.some((x) => x.texto.includes('vence a Taça Nacional'))).toBe(true)
    expect(minhaSituacao(jogo)).not.toBe('')
  })

  it('é determinística: a mesma semente dá o mesmo vencedor', () => {
    const a = novoJogo(5), b = novoJogo(5)
    jogarEpoca(a); jogarEpoca(b)
    expect(a.taca!.historico).toEqual(b.taca!.historico)
    expect(a.taca!.rondas[3].jogos.map(textoResultado)).toEqual(b.taca!.rondas[3].jogos.map(textoResultado))
  })

  it('os mais fortes ganham mais vezes, mas há surpresas', () => {
    const porDiv = [0, 0, 0, 0]
    let surpresas = 0
    for (let s = 1; s <= 12; s++) {
      const jogo = novoJogo(100 + s)
      // Só a taça (sem a liga), para ser rápido.
      garantirTaca(jogo)
      for (let r = 0; r < 7; r++) jogarRondaTaca(jogo)
      const t = jogo.taca!
      porDiv[jogo.mundo.clubes[t.historico[0].vencedorId].divisao - 1]++
      surpresas += t.noticias.filter((x) => x.texto.startsWith('Surpresa')).length
    }
    console.log('vencedores por divisão:', porDiv, 'surpresas:', surpresas)
    expect(porDiv[0] + porDiv[1]).toBeGreaterThanOrEqual(8)
    expect(surpresas).toBeGreaterThan(0)
  })

  it('uma nova época traz nova taça e guarda o histórico', () => {
    const jogo = novoJogo(21)
    jogarEpoca(jogo)
    fecharEpoca(jogo.mundo, jogo.epoca)
    jogo.epoca = novaEpoca(jogo.mundo, 99)
    const t = garantirTaca(jogo)
    expect(t.ano).toBe(jogo.mundo.epoca)
    expect(t.historico).toHaveLength(1)
    expect(t.atual).toBe(0)
  })

  it('gravação carregada a meio da época fica sem taça até à seguinte', () => {
    const jogo = novoJogo(31)
    for (let n = 0; n < 6; n++) concluirJornada(jogo.mundo, jogo.epoca, n)
    const t = garantirTaca(jogo)
    expect(t.semTaca).toBe(true)
    expect(meuJogoPendente(jogo)).toBeNull()
  })

  it('penáltis: 5 para cada lado, morte súbita e quem é melhor marca mais', () => {
    const jogo = novoJogo(41)
    const [a, b] = jogo.mundo.divisoes[0].clubes
    const onze = (id: number) => escalarAuto(jogo.mundo, id, new Set()).titulares
    const rng = createRng(3)
    let marcados = 0, total = 0
    for (let i = 0; i < 200; i++) {
      const p = marcarPenaltis(jogo.mundo, [onze(a), onze(b)], [onze(a)[0], onze(b)[0]], rng)
      expect(p.golos[0]).not.toBe(p.golos[1])
      expect(p.serie.length).toBeGreaterThanOrEqual(6)
      marcados += p.serie.filter((x) => x[2]).length
      total += p.serie.length
    }
    const taxa = marcados / total
    expect(taxa).toBeGreaterThan(0.65)
    expect(taxa).toBeLessThan(0.88)
  })

  it('Supertaça: campeão contra vencedor da taça antes da 1.ª jornada', () => {
    for (const comigo of [false, true]) {
      const jogo = novoJogo(21)
      jogarEpoca(jogo)
      const h = jogo.taca!.historico[0]
      const resumo = fecharEpoca(jogo.mundo, jogo.epoca)
      registarCampeao(jogo, resumo.campeoes)
      const campeao = resumo.campeoes.find((c) => c.divisao === 1)!.clubeId
      const outro = campeao === h.vencedorId ? h.finalistaId : h.vencedorId
      if (comigo) jogo.clubeId = campeao
      jogo.epoca = novaEpoca(jogo.mundo, 99)
      const t = garantirTaca(jogo)
      const sup = t.supertaca!
      expect([sup.jogos[0].casaId, sup.jogos[0].foraId]).toEqual([campeao, outro])
      if (comigo) {
        expect(sup.jogada).toBe(false)
        expect(meuJogoPendente(jogo)?.ronda).toBe(sup)
        const antes = jogo.mundo.clubes[campeao].dinheiro
        jogarRondaTaca(jogo)
        expect(jogo.mundo.clubes[campeao].dinheiro - antes).toBeGreaterThanOrEqual(100_000)
      }
      expect(sup.jogada).toBe(true)
      expect(t.historicoSuper).toHaveLength(1)
      expect(t.atual).toBe(0)
      expect(rondaPendente(jogo)).toBeNull()
      expect(t.noticias.some((x) => x.texto.includes('vence a Supertaça'))).toBe(true)
    }
  })
})
