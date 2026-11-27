import { describe, expect, it } from 'vitest'
import { gerarMundo } from './mundo'
import { concluirJornada, epocaTerminada, fecharEpoca, novaEpoca, tabela } from './epoca'
import { divisoesDoPais, etiquetaDivisao, nivelDe, nomeDivisao, paisDe, paisesDoMundo, temAbaixo, temAcima } from './ligas'
import { garantirEuropa, qualificarEuropa, type JogoComEuropa } from './europa'
import { garantirTaca, type JogoComTaca } from './taca'
import { garantirRivais, regiaoDe } from './rivalidades'
import { escalarAuto } from './motor'
import type { Jogo } from './types'

describe('campeonatos estrangeiros', () => {
  it('Portugal fica igual com ou sem Espanha e Inglaterra', () => {
    const a = gerarMundo(9)
    const b = gerarMundo(9, { estrangeiros: true })
    expect(b.divisoes.slice(0, 4)).toEqual(a.divisoes)
    for (const id of a.divisoes[0].clubes) expect(b.clubes[id]).toEqual(a.clubes[id])
    expect(b.jogadores[500]).toEqual(a.jogadores[500])
  })

  it('gera 2 países com 2 divisões de 18, com nível e país nos clubes', () => {
    const m = gerarMundo(3, { estrangeiros: true })
    expect(paisesDoMundo(m)).toEqual(['PT', 'ES', 'EN'])
    expect(m.divisoes).toHaveLength(8)
    for (const p of ['ES', 'EN']) {
      const ds = divisoesDoPais(m, p)
      expect(ds.map((d) => d.nivel)).toEqual([1, 2])
      for (const d of ds) {
        expect(d.clubes).toHaveLength(18)
        for (const id of d.clubes) {
          const c = m.clubes[id]
          expect(c.divisao).toBe(d.numero)
          expect(paisDe(c)).toBe(p)
          expect(nivelDe(c)).toBe(d.nivel)
          expect(c.plantel).toHaveLength(24)
        }
      }
    }
    expect(new Set(Object.values(m.clubes).map((c) => c.sigla)).size).toBe(144)
    expect(nomeDivisao(m, 5)).toBe('1.ª Divisão de Espanha')
    expect(etiquetaDivisao(m, 8)).toBe('ING 2.ª')
    expect(etiquetaDivisao(m, 2)).toBe('2.ª')
    expect(temAbaixo(m, 4)).toBe(false)
    expect(temAbaixo(m, 5)).toBe(true)
    expect(temAbaixo(m, 6)).toBe(false)
    expect(temAcima(m, 7)).toBe(false)
    expect(temAcima(m, 8)).toBe(true)
  })

  it('uma época inteira: sobe e desce só dentro do mesmo país', () => {
    const m = gerarMundo(5, { estrangeiros: true })
    const epoca = novaEpoca(m, 7)
    expect(epoca.calendario).toHaveLength(8)
    expect(epoca.totalJornadas).toBe(34)
    let n = 0
    while (!epocaTerminada(epoca)) concluirJornada(m, epoca, 100 + n++)
    const t5 = tabela(m, epoca, 5).map((l) => l.clubeId)
    const t6 = tabela(m, epoca, 6).map((l) => l.clubeId)
    const r = fecharEpoca(m, epoca)
    expect(r.campeoes).toHaveLength(8)
    // Espanha: os 3 últimos da 1.ª descem para a 2.ª, os 3 primeiros da 2.ª sobem.
    for (const id of t5.slice(-3)) expect(m.clubes[id].divisao).toBe(6)
    for (const id of t6.slice(0, 3)) expect(m.clubes[id].divisao).toBe(5)
    // Nenhum clube mudou de país; o nível acompanha a divisão.
    for (const d of m.divisoes) {
      expect(d.clubes).toHaveLength(18)
      for (const id of d.clubes) {
        expect(paisDe(m.clubes[id])).toBe(d.pais ?? 'PT')
        expect(nivelDe(m.clubes[id])).toBe(d.nivel ?? d.numero)
      }
    }
    // A 4.ª de Portugal não troca clubes com a 1.ª de Espanha.
    expect(r.subidas.find((s) => s.divisao === 5)).toBeUndefined()
    expect(r.descidas.find((s) => s.divisao === 4)).toBeUndefined()
  }, 60_000)

  it('a Taça é só de Portugal e a Europa leva clubes de Espanha e Inglaterra', () => {
    const m = gerarMundo(11, { estrangeiros: true })
    const clubeId = m.divisoes[0].clubes[0]
    const jogo = { mundo: m, treinador: 'T', clubeId, criado: '', epoca: novaEpoca(m, 1), escalacao: escalarAuto(m, clubeId, new Set()) } as Jogo
    const taca = garantirTaca(jogo as JogoComTaca)
    const naTaca = new Set(taca.rondas.flatMap((r) => r.jogos.flatMap((p) => [p.casaId, p.foraId])))
    for (const id of naTaca) if (m.clubes[id]) expect(paisDe(m.clubes[id])).toBe('PT')
    const eu = garantirEuropa(jogo as JogoComEuropa)
    const doMundo = eu.comps.flatMap((c) => c.clubes).filter((id) => m.clubes[id])
    const paises = doMundo.map((id) => paisDe(m.clubes[id]))
    expect(paises.filter((p) => p === 'ES')).toHaveLength(4)
    expect(paises.filter((p) => p === 'EN')).toHaveLength(4)
    expect(paises.filter((p) => p === 'PT')).toHaveLength(5)
    // Sem clubes inventados de Espanha ou Inglaterra (esses países já têm campeonato).
    expect(Object.values(eu.pais).filter((p) => p === 'ES' || p === 'EN')).toHaveLength(0)
    for (const comp of eu.comps) expect(comp.clubes).toHaveLength(16)
    // Fim de época: os 2 primeiros da 1.ª de cada país à Liga Continental.
    const q = qualificarEuropa(jogo as JogoComEuropa)
    expect(q.liga).toHaveLength(6)
    expect(q.taca).toHaveLength(7)
  })

  it('dérbis com regiões do próprio país', () => {
    const m = gerarMundo(13, { estrangeiros: true })
    garantirRivais(m)
    const es = m.clubes[m.divisoes[4].clubes[0]]
    expect(['Andaluzia', 'Castela', 'Catalunha', 'Galiza', 'País Basco', 'Levante']).toContain(regiaoDe(es)?.nome)
    const pt = m.clubes[m.divisoes[0].clubes[0]]
    expect(['Minho', 'Douro', 'Beira Serra', 'Beira Litoral', 'Ribatejo', 'Estremadura', 'Alentejo', 'Algarve']).toContain(regiaoDe(pt)?.nome)
    for (const c of Object.values(m.clubes) as (typeof es & { rival?: number })[]) {
      if (c.rival !== undefined) expect(paisDe(m.clubes[c.rival])).toBe(paisDe(c))
    }
  })
})
