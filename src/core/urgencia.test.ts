import { describe, expect, it } from 'vitest'
import { gerarMundo } from './mundo'
import { concluirJornada, novaEpoca } from './epoca'
import { escalarAuto } from './motor'
import { avancarMercado, chamarJunioresUrgencia, type JogoComMercado } from './mercado'

function novoJogo(semente = 5, div = 4): JogoComMercado {
  const mundo = gerarMundo(semente)
  const clubeId = mundo.divisoes[div - 1].clubes[0]
  const epoca = novaEpoca(mundo, semente)
  return { mundo, epoca, escalacao: escalarAuto(mundo, clubeId, new Set()), treinador: 'T', clubeId, criado: '' }
}

describe('nunca ficar sem equipa', () => {
  it('com menos de 11 disponíveis sobem juniores de urgência até haver onze', () => {
    const j = novoJogo()
    const meu = j.mundo.clubes[j.clubeId]
    const indisp = new Set(meu.plantel.slice(0, 16))
    const nomes = chamarJunioresUrgencia(j, indisp)
    expect(nomes.length).toBe(3)
    expect(meu.plantel.filter((id) => !indisp.has(id)).length).toBe(11)
    expect(chamarJunioresUrgencia(j, indisp)).toEqual([])
    const esc = escalarAuto(j.mundo, j.clubeId, indisp)
    expect(esc.titulares.length).toBe(11)
  })

  it('a IA nunca leva por cláusula o penúltimo guarda-redes', () => {
    for (const semente of [3, 5, 77]) {
      const j = novoJogo(semente)
      for (let r = 0; r < 34; r++) {
        concluirJornada(j.mundo, j.epoca, semente * 100 + r)
        avancarMercado(j)
        const grs = j.mundo.clubes[j.clubeId].plantel.filter((id) => j.mundo.jogadores[id].posicao === 'GR').length
        expect(grs).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('sem guarda-redes disponíveis a escalação põe um de campo na baliza e ninguém de campo fica de fora por um GR', () => {
    const j = novoJogo()
    const meu = j.mundo.clubes[j.clubeId]
    const grs = meu.plantel.filter((id) => j.mundo.jogadores[id].posicao === 'GR')
    const esc = escalarAuto(j.mundo, j.clubeId, new Set(grs.slice(1)))
    expect(esc.titulares.slice(1).every((id) => j.mundo.jogadores[id].posicao !== 'GR')).toBe(true)
    const sem = escalarAuto(j.mundo, j.clubeId, new Set(grs))
    expect(sem.titulares.length).toBe(11)
  })
})
