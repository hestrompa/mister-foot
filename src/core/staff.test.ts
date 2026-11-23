import { describe, expect, it } from 'vitest'
import { gerarMundo } from './mundo'
import { concluirJornada, novaEpoca } from './epoca'
import {
  candidatos, chanceTreino, contratarStaff, custoStaffPorJornada, despedirStaff, duracaoLesao, estimativaPotencial,
  indemnizacao, membro, mudarFoco, nivelDe, staffDe, treinarJornada, type MembroStaff,
} from './staff'
import { garantirStaff, staffIA } from './staff-ia'
import type { Mundo } from './types'

function comNivel(mundo: Mundo, clubeId: number, nivel: number) {
  for (const f of ['adjunto', 'gr', 'fisico', 'olheiro'] as const) {
    if (nivelDe(mundo.clubes[clubeId], f) === nivel) continue
    const c = candidatos(mundo, clubeId, f).find((m) => m.nivel === nivel)!
    mundo.clubes[clubeId].dinheiro += 10_000_000
    contratarStaff(mundo, clubeId, c)
  }
}

describe('staff', () => {
  it('todos os clubes recebem staff, com salários que sobem com o nível e a divisão', () => {
    const m = gerarMundo(7)
    expect(garantirStaff(m)).toBe(true)
    expect(garantirStaff(m)).toBe(false)
    for (const c of Object.values(m.clubes)) {
      expect(staffDe(c)!.membros.length).toBeGreaterThanOrEqual(2)
      expect(custoStaffPorJornada(c)).toBeGreaterThan(0)
    }
    const id1 = m.divisoes[0].clubes[0], id4 = m.divisoes[3].clubes[0]
    const c1 = candidatos(m, id1, 'adjunto'), c4 = candidatos(m, id4, 'adjunto')
    expect(c1.at(-1)!.salario).toBeGreaterThan(c1[0].salario)
    expect(c1[0].salario).toBeGreaterThan(c4[0].salario)
    // Determinístico: os mesmos candidatos durante a época.
    expect(candidatos(m, id1, 'adjunto')).toEqual(c1)
  })

  it('contratar substitui e paga indemnização; despedir também', () => {
    const m = gerarMundo(8)
    garantirStaff(m)
    const id = m.divisoes[2].clubes[3]
    const c = m.clubes[id]
    c.dinheiro = 1_000_000
    const antigo = membro(c, 'adjunto')!
    const novo = candidatos(m, id, 'adjunto').find((x) => x.nivel === 5)!
    expect(contratarStaff(m, id, novo).ok).toBe(true)
    expect(c.dinheiro).toBe(1_000_000 - indemnizacao(antigo))
    expect(nivelDe(c, 'adjunto')).toBe(5)
    const antes = c.dinheiro
    expect(despedirStaff(m, id, 'adjunto').ok).toBe(true)
    expect(c.dinheiro).toBe(antes - indemnizacao(novo as MembroStaff))
    expect(membro(c, 'adjunto')).toBeUndefined()
    expect(despedirStaff(m, id, 'adjunto').ok).toBe(false)
  })

  it('um bom staff faz evoluir mais no treino, e o foco puxa pelo setor escolhido', () => {
    const contar = (nivel: number, foco?: 'DEF') => {
      const m = gerarMundo(9)
      garantirStaff(m)
      const ids = m.divisoes[3].clubes
      for (const id of ids) {
        comNivel(m, id, nivel)
        if (foco) mudarFoco(m, id, foco)
      }
      let total = 0, def = 0
      for (let r = 0; r < 34; r++) {
        for (const jid of treinarJornada(m, ids, new Set(), 1000 + r, 2026)) {
          total++
          if (m.jogadores[jid].posicao === 'DEF') def++
        }
      }
      return { total, def }
    }
    const fraco = contar(1), bom = contar(5), focado = contar(3, 'DEF'), normal = contar(3)
    expect(bom.total).toBeGreaterThan(fraco.total * 1.5)
    expect(focado.def).toBeGreaterThan(normal.def * 1.2)
    // Por clube e época, uns 15 a 60 pontos de força no plantel (não explode).
    expect(fraco.total / 18).toBeGreaterThan(8)
    expect(bom.total / 18).toBeLessThan(70)
  })

  it('veteranos e jogadores no teto não evoluem no treino', () => {
    const m = gerarMundo(10)
    garantirStaff(m)
    const c = m.clubes[m.divisoes[0].clubes[0]]
    for (const id of c.plantel) {
      const j = m.jogadores[id]
      if (j.idade >= 30 || j.forca >= j.potencial) expect(chanceTreino(c, j)).toBe(0)
    }
  })

  it('o preparador físico encurta as lesões', () => {
    const m = gerarMundo(11)
    garantirStaff(m)
    const id = m.divisoes[1].clubes[0]
    comNivel(m, id, 5)
    expect(duracaoLesao(m.clubes[id], 6)).toBeLessThan(6)
    expect(duracaoLesao(undefined, 6)).toBe(6)
    expect(duracaoLesao(m.clubes[id], 1)).toBe(1)
  })

  it('o olheiro estreita a estimativa do potencial, que contém quase sempre o valor real', () => {
    const m = gerarMundo(12)
    garantirStaff(m)
    const id = m.divisoes[3].clubes[0]
    const jovens = Object.values(m.jogadores).filter((j) => j.idade <= 23 && j.potencial - j.forca >= 4).slice(0, 200)
    const largura = (nivel: number) => {
      comNivel(m, id, nivel)
      let w = 0, dentro = 0
      for (const j of jovens) {
        const e = estimativaPotencial(m, id, j)
        w += e.max - e.min
        if (j.potencial >= e.min - 1 && j.potencial <= e.max + 1) dentro++
        expect(e).toEqual(estimativaPotencial(m, id, j))
      }
      return { w: w / jovens.length, dentro: dentro / jovens.length }
    }
    const l1 = largura(1), l5 = largura(5)
    expect(l5.w).toBeLessThan(l1.w / 2)
    expect(l5.dentro).toBeGreaterThan(0.9)
  })

  it('o custo do staff entra nas contas da jornada e a IA revê o staff entre épocas', () => {
    const m = gerarMundo(13)
    garantirStaff(m)
    const ep = novaEpoca(m, 3)
    concluirJornada(m, ep, 1)
    const id = m.divisoes[0].clubes[0]
    const b = ep.ultimoBalanco![id]
    expect(b.staff).toBe(custoStaffPorJornada(m.clubes[id]))
    expect(b.salarios).toBeGreaterThan(b.staff!)
    m.epoca += 1
    staffIA(m, id)
    for (const c of Object.values(m.clubes)) expect(staffDe(c)!.membros.length).toBeGreaterThanOrEqual(1)
  })
})
