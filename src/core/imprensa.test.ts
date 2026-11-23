import { describe, expect, it } from 'vitest'
import { gerarMundo } from './mundo'
import { concluirJornada, epocaTerminada, fecharEpoca, novaEpoca } from './epoca'
import { escalarAuto } from './motor'
import { iniciarEpocaDirecao, estadoCarreira, avancarDirecao, type JogoComCarreira } from './direcao'
import { avancarImprensa, conferenciaPendente, estadoImprensa, gerarConferencia, responderConferencia } from './imprensa'
import { garantirRivais, rivaisDe, rivalidade } from './rivalidades'
import { confronto, estadoRecordes, marcadoresDeSempre } from './recordes'
import { publicoEsperado } from './financas'
import { ambiente } from './balneario'
import type { Jogo } from './types'

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

function epocaInteira(jogo: Jogo, responder: (i: number) => number | null) {
  let n = 0
  while (!epocaTerminada(jogo.epoca)) {
    const c = conferenciaPendente(jogo)
    if (c) { const r = responder(c.opcoes.length); if (r !== null) responderConferencia(jogo, r) }
    concluirJornada(jogo.mundo, jogo.epoca, 4000 + n++)
    avancarDirecao(jogo as JogoComCarreira)
    avancarImprensa(jogo)
  }
}

describe('rivalidades', () => {
  it('cada clube tem região, grande rival e vizinhos; dérbi enche mais o estádio', () => {
    const mundo = gerarMundo(5)
    expect(garantirRivais(mundo)).toBe(true)
    expect(garantirRivais(mundo)).toBe(false)
    for (const c of Object.values(mundo.clubes)) {
      const r = rivaisDe(mundo, c.id)
      expect(r.length).toBeGreaterThanOrEqual(6)
      expect(r[0].r.tipo).toBe('classico')
      // Pelo menos um dérbi na própria divisão.
      expect(r.filter((x) => x.clube.divisao === c.divisao).length).toBeGreaterThanOrEqual(1)
    }
    const a = Object.values(mundo.clubes)[0]
    const b = mundo.clubes[rivaisDe(mundo, a.id)[0].clube.id]
    const longe = Object.values(mundo.clubes).find((c) => !rivalidade(a, c) && c.id !== a.id)!
    expect(rivalidade(a, b)?.nome).toMatch(/^Clássico d/)
    const grande = { ...a, bilhete: 60, estadio: { ...a.estadio, lugares: 1e6, base: 1e6 } }
    const semDerbi = publicoEsperado(grande, { ...b, regiao: undefined } as never, 5, 18)
    expect(publicoEsperado(grande, b, 5, 18)).toBeGreaterThan(semDerbi * 1.3)
    expect(longe).toBeTruthy()
  })
})

describe('imprensa e recordes', () => {
  it('uma época dá notícias, conferências, recordes e confrontos; é determinística', () => {
    const a = jogoEm(21)
    const b = jogoEm(21)
    epocaInteira(a, () => 0)
    epocaInteira(b, () => 0)
    const st = estadoImprensa(a)
    expect(st.noticias.length).toBeGreaterThan(30)
    expect(JSON.stringify(st.noticias)).toBe(JSON.stringify(estadoImprensa(b).noticias))
    expect(st.noticias.some((n) => n.tipo === 'imprensa')).toBe(true)
    expect(st.noticias.some((n) => /campeão da 1\.ª Divisão/.test(n.titulo))).toBe(true)
    const r = estadoRecordes(a)
    expect(r.campeoes).toHaveLength(4)
    expect(r.goleadores).toHaveLength(4)
    expect(r.mister.jogos).toBe(34)
    expect(r.mister.v + r.mister.e + r.mister.d).toBe(34)
    expect(r.recordes.maiorVitoria?.valor).toBeGreaterThanOrEqual(3)
    expect(marcadoresDeSempre(a)[0].golos).toBe(Math.max(...Object.values(a.epoca.marcadores)))
    // Confronto direto: duas jornadas (ida e volta) contra cada adversário.
    const adv = a.mundo.divisoes[2].clubes.find((id) => id !== a.clubeId)!
    const c = confronto(a, a.clubeId, adv)
    expect(c.v + c.e + c.d).toBe(2)
    const inv = confronto(a, adv, a.clubeId)
    expect(inv.v).toBe(c.d)
    // Fechar a época duas vezes não duplica.
    avancarImprensa(a)
    expect(estadoRecordes(a).campeoes).toHaveLength(4)
    fecharEpoca(a.mundo, a.epoca)
  })

  it('as respostas mexem na moral e na confiança, e há sempre conferência na 1.ª jornada', () => {
    const jogo = jogoEm(33)
    const c = conferenciaPendente(jogo)
    expect(c?.tema).toBe('inicio')
    const conf = estadoCarreira(jogo as JogoComCarreira).confianca
    const moral = ambiente(jogo.mundo, jogo.clubeId)
    // Opção 2: "queremos mais" dá moral +3 e confiança +4.
    expect(responderConferencia(jogo, 1)).toBe(true)
    expect(responderConferencia(jogo, 1)).toBe(false)
    expect(estadoCarreira(jogo as JogoComCarreira).confianca).toBe(conf + 4)
    expect(ambiente(jogo.mundo, jogo.clubeId)).toBeGreaterThan(moral)
    expect(conferenciaPendente(jogo)).toBeUndefined()
  })

  it('há conferências variadas ao longo da época', () => {
    const jogo = jogoEm(8)
    const temas = new Set<string>()
    let n = 0
    while (!epocaTerminada(jogo.epoca)) {
      const c = gerarConferencia(jogo)
      if (c) temas.add(c.tema)
      concluirJornada(jogo.mundo, jogo.epoca, 70 + n++)
      avancarImprensa(jogo)
    }
    expect(temas.size).toBeGreaterThanOrEqual(3)
  })
})
