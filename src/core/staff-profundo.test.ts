import { describe, expect, it } from 'vitest'
import { gerarMundo } from './mundo'
import {
  candidatos, chanceTreino, contratarStaff, definirPlano, despedirStaff, mudarIntensidade, nivelDe, salarioStaff, staffDe, treinarJornada,
  type Funcao,
} from './staff'
import { garantirStaff, staffIA } from './staff-ia'
import { aprendido, fatorForaDaPosicao, FATOR_APRENDIDA, FATOR_FORA } from './polivalencia'
import { forcaNoLugar } from './motor'
import { chanceDescoberta, contratarTalento, definirMissao, descobertas, observarJornada, ESPERA } from './olheiro'
import { fadigaDe } from './lesoes'
import { atributo } from './atributos'
import type { Mundo } from './types'

function contratar(m: Mundo, clubeId: number, f: Funcao, nivel: number) {
  const k = candidatos(m, clubeId, f).find((x) => x.nivel === nivel)
  if (!k) return
  m.clubes[clubeId].dinheiro += 10_000_000
  contratarStaff(m, clubeId, k)
}

describe('treinadores de setor', () => {
  it('fazem evoluir mais depressa os jogadores da sua posição', () => {
    const contar = (comSetor: boolean) => {
      const m = gerarMundo(21)
      garantirStaff(m)
      const ids = m.divisoes[3].clubes
      for (const id of ids) {
        contratar(m, id, 'adjunto', 3)
        if (comSetor) contratar(m, id, 'tmed', 5)
        else despedirStaff(m, id, 'tmed')
      }
      let med = 0, outros = 0
      for (let r = 0; r < 34; r++) {
        for (const jid of treinarJornada(m, ids, new Set(), 500 + r, 2026)) {
          if (m.jogadores[jid].posicao === 'MED') med++
          else outros++
        }
      }
      return { med, outros }
    }
    const sem = contar(false), com = contar(true)
    expect(com.med).toBeGreaterThan(sem.med * 1.2)
    // Os outros setores não ganham nada com ele (só ruído do sorteio).
    expect(Math.abs(com.outros - sem.outros)).toBeLessThan(sem.outros * 0.15)
  })

  it('ganham menos do que um adjunto e a IA só os contrata com folga', () => {
    expect(salarioStaff(3, 1, 'tdef')).toBeLessThan(salarioStaff(3, 1, 'adjunto'))
    const m = gerarMundo(22)
    garantirStaff(m)
    staffIA(m, -1)
    let ricos = 0, comSetor = 0
    for (const c of Object.values(m.clubes)) {
      const temSetor = ['tdef', 'tmed', 'tav'].some((f) => nivelDe(c, f as Funcao) > 0)
      if (temSetor) comSetor++
      if (c.dinheiro > 0) ricos++
    }
    expect(comSetor).toBeLessThan(ricos)
  })
})

describe('intensidade do treino', () => {
  it('forte evolui mais e cansa; leve evolui menos e descansa', () => {
    const correr = (i: 'leve' | 'normal' | 'forte') => {
      const m = gerarMundo(23)
      garantirStaff(m)
      const ids = m.divisoes[2].clubes
      for (const id of ids) mudarIntensidade(m, id, i)
      let n = 0
      for (let r = 0; r < 34; r++) n += treinarJornada(m, ids, new Set(), 900 + r, 2026).length
      const fad = ids.flatMap((id) => m.clubes[id].plantel).reduce((s, id) => s + fadigaDe(m.jogadores[id]), 0)
      return { n, fad }
    }
    const leve = correr('leve'), normal = correr('normal'), forte = correr('forte')
    expect(forte.n).toBeGreaterThan(normal.n * 1.1)
    expect(leve.n).toBeLessThan(normal.n * 0.92)
    expect(forte.fad).toBeGreaterThan(normal.fad)
  })
})

describe('treino individual', () => {
  it('um médio aprende a jogar a defesa numa época e passa a render quase como defesa', () => {
    const m = gerarMundo(24)
    garantirStaff(m)
    const cid = m.divisoes[1].clubes[2]
    contratar(m, cid, 'adjunto', 3)
    const c = m.clubes[cid]
    const j = c.plantel.map((id) => m.jogadores[id]).find((x) => x.posicao === 'MED' && x.idade <= 28)!
    const antes = forcaNoLugar(j, 'DEF')
    expect(definirPlano(m, cid, j.id, { tipo: 'posicao', posicao: 'DEF' }).ok).toBe(true)
    expect(definirPlano(m, cid, j.id, { tipo: 'posicao', posicao: 'GR' }).ok).toBe(false)
    let semanas = 0
    while (aprendido(j, 'DEF') < 100 && semanas < 60) { treinarJornada(m, [cid], new Set(), 3000 + semanas, 2026); semanas++ }
    expect(semanas).toBeGreaterThan(8)
    expect(semanas).toBeLessThanOrEqual(34)
    expect(fatorForaDaPosicao(j, 'DEF')).toBeCloseTo(FATOR_APRENDIDA)
    expect(forcaNoLugar(j, 'DEF')).toBeGreaterThan(antes * (FATOR_APRENDIDA / FATOR_FORA) * 0.95)
    // O plano termina sozinho quando a posição está aprendida.
    expect(staffDe(c)!.planos?.[j.id]).toBeUndefined()
  })

  it('puxar um atributo sobe-o mais do que o treino normal, sem mudar a força', () => {
    const m = gerarMundo(25)
    garantirStaff(m)
    const cid = m.divisoes[2].clubes[0]
    const c = m.clubes[cid]
    const [a, b] = c.plantel.map((id) => m.jogadores[id]).filter((x) => x.posicao === 'AV' && x.idade >= 30)
    if (!a || !b) return
    const ra = a.forca, rb = b.forca
    const remA = atributo(a, 'rem'), remB = atributo(b, 'rem')
    expect(definirPlano(m, cid, a.id, { tipo: 'atributo', atributo: 'rem' }).ok).toBe(true)
    for (let s = 0; s < 34; s++) treinarJornada(m, [cid], new Set(), 7000 + s, 2026)
    expect(atributo(a, 'rem') - remA).toBeGreaterThan(atributo(b, 'rem') - remB + 3)
    expect(a.forca).toBe(ra)
    expect(b.forca).toBe(rb)
  })

  it('no máximo 5 planos', () => {
    const m = gerarMundo(26)
    garantirStaff(m)
    const cid = m.divisoes[0].clubes[0]
    const js = m.clubes[cid].plantel.map((id) => m.jogadores[id]).filter((x) => x.posicao === 'DEF')
    const res = js.slice(0, 6).map((x) => definirPlano(m, cid, x.id, { tipo: 'posicao', posicao: 'MED' }).ok)
    expect(res.filter(Boolean).length).toBe(Math.min(5, res.length))
    expect(chanceTreino(m.clubes[cid], js[0])).toBeGreaterThanOrEqual(0)
  })
})

describe('olheiro em missão', () => {
  it('encontra talentos conforme o nível, que expiram e se podem contratar', () => {
    const correr = (nivel: number) => {
      const m = gerarMundo(27)
      garantirStaff(m)
      const cid = m.divisoes[2].clubes[4]
      if (nivel) contratar(m, cid, 'olheiro', nivel)
      else despedirStaff(m, cid, 'olheiro')
      definirMissao(m, cid, 'BR', 'AV')
      let achados = 0
      for (let r = 1; r <= 34; r++) {
        const antes = descobertas(m, cid).length
        observarJornada(m, 2026, r, 4242)
        if (descobertas(m, cid).length > antes) achados++
      }
      return { m, cid, achados }
    }
    expect(correr(0).achados).toBe(0)
    const bom = correr(5), fraco = correr(1)
    expect(bom.achados).toBeGreaterThan(fraco.achados)
    expect(bom.achados).toBeGreaterThanOrEqual(3)
    expect(bom.achados).toBeLessThanOrEqual(14)
    // Só ficam os das últimas jornadas.
    for (const d of descobertas(bom.m, bom.cid)) {
      expect(d.ate).toBeGreaterThanOrEqual(35)
      expect(d.ate).toBeLessThanOrEqual(34 + ESPERA)
      expect(d.j.posicao).toBe('AV')
      expect(d.j.nacionalidade).toBe('BR')
      expect(d.j.idade).toBeGreaterThanOrEqual(16)
      expect(d.j.idade).toBeLessThanOrEqual(20)
      expect(d.j.potencial).toBeGreaterThan(d.j.forca)
    }
    const { m, cid } = bom
    const lista = descobertas(m, cid)
    if (!lista.length) return
    const c = m.clubes[cid]
    c.dinheiro = lista[0].preco + 10
    const n = c.plantel.length
    const r = contratarTalento(m, cid, 0)
    expect(r.ok).toBe(true)
    expect(c.plantel.length).toBe(n + 1)
    const novo = m.jogadores[c.plantel.at(-1)!]
    expect(novo.id).toBeGreaterThan(0)
    expect(novo.clubeId).toBe(cid)
    expect(c.dinheiro).toBe(10)
    expect(descobertas(m, cid).length).toBe(lista.length - 1)
  })

  it('é determinístico e a probabilidade sobe com o nível', () => {
    expect(chanceDescoberta(0)).toBe(0)
    expect(chanceDescoberta(5)).toBeGreaterThan(chanceDescoberta(1))
    const um = () => {
      const m = gerarMundo(28)
      garantirStaff(m)
      const cid = m.divisoes[3].clubes[0]
      contratar(m, cid, 'olheiro', 4)
      definirMissao(m, cid, 'EU')
      for (let r = 1; r <= 20; r++) observarJornada(m, 2026, r, 99)
      return descobertas(m, cid).map((d) => [d.j.nome, d.j.forca, d.j.potencial, d.preco])
    }
    expect(um()).toEqual(um())
  })
})
