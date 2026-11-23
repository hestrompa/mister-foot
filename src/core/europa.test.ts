import { describe, expect, it } from 'vitest'
import { gerarMundo } from './mundo'
import { concluirJornada, epocaTerminada, fecharEpoca, novaEpoca } from './epoca'
import { escalarAuto } from './motor'
import type { Jogo } from './types'
import { garantirTaca, jogarRondaTaca, meuJogoPendente, registarCampeao, avancarTaca } from './taca'
import {
  COMPETICOES, avancarEuropa, datasEuropa, diaPendente, garantirEuropa, jogarDiaEuropa, meuJogoEuropa, minhaSituacaoEuropa,
  qualificarEuropa, tabelaGrupo, type JogoComEuropa,
} from './europa'

function novoJogo(semente: number, div = 1, i = 0): JogoComEuropa {
  const mundo = gerarMundo(semente)
  const clubeId = mundo.divisoes[div - 1].clubes[i]
  const epoca = novaEpoca(mundo, semente + 1)
  return { mundo, epoca, escalacao: escalarAuto(mundo, clubeId, new Set()), treinador: 'T', clubeId, criado: '' } as Jogo
}

/** Joga a época como a App: liga, taça e Europa (os meus jogos também simulados). */
function jogarEpoca(jogo: JogoComEuropa) {
  garantirTaca(jogo)
  garantirEuropa(jogo)
  let n = 0
  const pendentes = () => {
    for (let g = 0; g < 5; g++) {
      if (meuJogoPendente(jogo)) jogarRondaTaca(jogo)
      else if (meuJogoEuropa(jogo)) jogarDiaEuropa(jogo)
    }
  }
  while (!epocaTerminada(jogo.epoca)) {
    pendentes()
    concluirJornada(jogo.mundo, jogo.epoca, 700 + n++)
    avancarTaca(jogo)
    avancarEuropa(jogo)
  }
  pendentes()
}

describe('Competições europeias', () => {
  it('11 datas a meio da semana, por ordem e sem chocar com a taça', () => {
    const taca = [3, 8, 13, 18, 22, 27, 32]
    const d = datasEuropa(34, taca)
    expect(d).toHaveLength(11)
    for (let i = 1; i < d.length; i++) expect(d[i]).toBeGreaterThan(d[i - 1])
    expect(d.some((x) => taca.includes(x))).toBe(false)
    expect(d[d.length - 1]).toBeLessThan(34)
  })

  it('época completa: grupos, quartos, meias e final nas duas provas, com prémios e histórico', () => {
    const jogo = novoJogo(41)
    const dinheiroAntes = Object.fromEntries(jogo.mundo.divisoes[0].clubes.map((id) => [id, jogo.mundo.clubes[id].dinheiro]))
    jogarEpoca(jogo)
    const e = jogo.europa!
    expect(e.dia).toBe(11)
    for (const comp of e.comps) {
      expect(comp.clubes).toHaveLength(16)
      expect(new Set(comp.clubes).size).toBe(16)
      expect(comp.grupos.every((g) => g.length === 4)).toBe(true)
      for (let g = 0; g < 4; g++) expect(tabelaGrupo(comp, g).every((l) => l.j === 6)).toBe(true)
      expect(comp.rondas.every((r) => r.jogada)).toBe(true)
      expect(comp.rondas[6].jogos).toHaveLength(4)
      expect(comp.rondas[8].jogos).toHaveLength(2)
      expect(comp.vencedorId).toBeDefined()
      // Ninguém é eliminado duas vezes e só o vencedor fica de fora da lista.
      expect(Object.keys(comp.eliminados)).toHaveLength(15)
    }
    // Clubes nacionais na Europa: 2 na Liga, 3 na Taça.
    const nac = e.comps.map((c) => c.clubes.filter((id) => jogo.mundo.clubes[id]).length)
    expect(nac).toEqual([COMPETICOES.liga.vagas, COMPETICOES.taca.vagas])
    expect(e.historico).toHaveLength(2)
    // Os nacionais na Europa ganharam pelo menos o prémio de entrada.
    for (const comp of e.comps) for (const id of comp.clubes.filter((x) => jogo.mundo.clubes[x])) {
      expect(e.receitas[id]).toBeGreaterThanOrEqual(COMPETICOES[comp.id].premios.entrada)
    }
    const total = Object.values(e.receitas).reduce((s, v) => s + v, 0)
    console.log('Europa: receitas dos clubes nacionais', Math.round(total / 1000), 'mil €', e.historico.map((h) => `${h.comp}: ${h.vencedor}`))
    // Não rebenta as finanças: menos de 25 M€ para os 5 clubes numa época.
    expect(total).toBeLessThan(25_000_000)
    expect(Object.keys(dinheiroAntes).length).toBe(18)
  })

  it('é determinística', () => {
    const a = novoJogo(52), b = novoJogo(52)
    jogarEpoca(a); jogarEpoca(b)
    expect(a.europa!.historico).toEqual(b.europa!.historico)
  })

  it('apuramento no fim da época e nova Europa com histórico', () => {
    const jogo = novoJogo(63)
    jogarEpoca(jogo)
    const q = qualificarEuropa(jogo)
    expect(q.liga).toHaveLength(2)
    expect(q.taca).toHaveLength(3)
    const r = fecharEpoca(jogo.mundo, jogo.epoca)
    registarCampeao(jogo, r.campeoes)
    jogo.epoca = novaEpoca(jogo.mundo, 5)
    const e = garantirEuropa(jogo)
    expect(e.ano).toBe(jogo.mundo.epoca)
    expect(e.historico).toHaveLength(2)
    expect(e.comps[0].clubes.filter((id) => jogo.mundo.clubes[id])).toEqual(q.liga)
    expect(e.comps[1].clubes.filter((id) => jogo.mundo.clubes[id]).sort()).toEqual(q.taca.slice().sort())
    expect(e.dia).toBe(0)
  })

  it('o meu jogo fica à espera e os outros dias passam sozinhos', () => {
    const fora = novoJogo(74, 4)
    for (let n = 0; n < 3; n++) { concluirJornada(fora.mundo, fora.epoca, n); avancarTaca(fora); avancarEuropa(fora) }
    expect(meuJogoEuropa(fora)).toBeNull()
    expect(fora.europa!.dia).toBeGreaterThan(0)
    expect(minhaSituacaoEuropa(fora)).toContain('Não estás na Europa')

    const dentro = novoJogo(74)
    const e = garantirEuropa(dentro)
    const meu = e.comps.some((c) => c.clubes.includes(dentro.clubeId))
    for (let n = 0; n < e.datas[0]; n++) { concluirJornada(dentro.mundo, dentro.epoca, n); avancarTaca(dentro); avancarEuropa(dentro) }
    if (meu) {
      expect(diaPendente(dentro)).toBe(0)
      expect(meuJogoEuropa(dentro)).not.toBeNull()
      expect(e.dia).toBe(0)
    }
  })

  it('gravação carregada a meio: simula os dias passados; tarde demais fica para a época seguinte', () => {
    const meio = novoJogo(85)
    for (let n = 0; n < 8; n++) concluirJornada(meio.mundo, meio.epoca, n)
    const e = garantirEuropa(meio)
    expect(e.semEuropa).toBeFalsy()
    expect(e.dia).toBeGreaterThanOrEqual(2)
    const tarde = novoJogo(86)
    for (let n = 0; n < 20; n++) concluirJornada(tarde.mundo, tarde.epoca, n)
    expect(garantirEuropa(tarde).semEuropa).toBe(true)
    expect(meuJogoEuropa(tarde)).toBeNull()
  })

  it('os nossos clubes chegam longe às vezes, mas raramente ganham a Liga', () => {
    let quartosLiga = 0, nacLiga = 0, vitoriasLiga = 0, vitoriasTaca = 0, quartosTaca = 0, nacTaca = 0
    for (let s = 1; s <= 30; s++) {
      const jogo = novoJogo(200 + s, 4)
      garantirEuropa(jogo)
      for (let d = 0; d < 11; d++) jogarDiaEuropa(jogo)
      for (const comp of jogo.europa!.comps) {
        const nac = comp.clubes.filter((id) => jogo.mundo.clubes[id])
        const q = comp.rondas[6].jogos.flatMap((p) => [p.casaId, p.foraId]).filter((id) => jogo.mundo.clubes[id]).length
        const ganhou = !!jogo.mundo.clubes[comp.vencedorId!]
        if (comp.id === 'liga') { nacLiga += nac.length; quartosLiga += q; if (ganhou) vitoriasLiga++ } else { nacTaca += nac.length; quartosTaca += q; if (ganhou) vitoriasTaca++ }
      }
    }
    console.log(`Liga: ${quartosLiga}/${nacLiga} nos quartos, ${vitoriasLiga}/30 vitórias · Taça: ${quartosTaca}/${nacTaca} nos quartos, ${vitoriasTaca}/30 vitórias`)
    expect(quartosLiga).toBeGreaterThan(0)
    expect(vitoriasLiga).toBeLessThanOrEqual(8)
    expect(quartosTaca).toBeGreaterThan(0)
  }, 30_000)
})
