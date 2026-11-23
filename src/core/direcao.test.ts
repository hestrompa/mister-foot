import { describe, expect, it } from 'vitest'
import { forcaClube, gerarMundo } from './mundo'
import { concluirJornada, epocaTerminada, fecharEpoca, novaEpoca } from './epoca'
import { escalarAuto } from './motor'
import { aceitarOferta, avancarDirecao, definirObjetivos, estadoCarreira, iniciarEpocaDirecao, ofertasValidas, type JogoComCarreira } from './direcao'
import type { Jogo } from './types'

function jogoEm(semente: number, clubeId?: (m: ReturnType<typeof gerarMundo>) => number): JogoComCarreira {
  const mundo = gerarMundo(semente)
  const id = clubeId ? clubeId(mundo) : mundo.divisoes[3].clubes[0]
  const epoca = novaEpoca(mundo, semente + 1)
  const jogo = { mundo, epoca, escalacao: escalarAuto(mundo, id, new Set()), treinador: 'T', clubeId: id, criado: '' } as Jogo as JogoComCarreira
  iniciarEpocaDirecao(jogo)
  return jogo
}

/** Joga a jornada e passa pela direção, como a app. */
function jornada(jogo: JogoComCarreira, n: number) {
  concluirJornada(jogo.mundo, jogo.epoca, 5000 + n)
  avancarDirecao(jogo)
}

describe('direção do clube', () => {
  it('objetivos acompanham o plantel: o mais forte luta pelo título, o mais fraco pela manutenção', () => {
    const mundo = gerarMundo(11)
    for (const d of mundo.divisoes) {
      const ord = [...d.clubes].sort((a, b) => forcaClube(mundo, b) - forcaClube(mundo, a))
      const forte = definirObjetivos(mundo, ord[0])
      const fraco = definirObjetivos(mundo, ord[ord.length - 1])
      expect(forte.alvo).toBeLessThanOrEqual(5)
      expect(fraco.tipo).toBe('manutencao')
      expect(fraco.alvo).toBe(15)
    }
  })

  it('perder todos os jogos leva ao despedimento a meio da época, com pelo menos uma oferta', () => {
    const jogo = jogoEm(21)
    const meu = jogo.mundo.clubes[jogo.clubeId]
    // Plantel arrasado: força 1.
    for (const id of meu.plantel) jogo.mundo.jogadores[id].forca = 1
    let n = 0
    while (!estadoCarreira(jogo).despedido && !epocaTerminada(jogo.epoca)) jornada(jogo, n++)
    const st = estadoCarreira(jogo)
    expect(st.despedido).toBeTruthy()
    expect(jogo.epoca.jornada).toBeGreaterThanOrEqual(9)
    expect(jogo.epoca.jornada).toBeLessThan(30)
    const of = ofertasValidas(jogo)
    expect(of.length).toBeGreaterThan(0)
    expect(of.every((o) => o.clubeId !== meu.id)).toBe(true)
    // Escolhe um clube novo e a época continua lá.
    const antigo = jogo.clubeId
    expect(aceitarOferta(jogo, of[0].clubeId)).toBe(true)
    expect(jogo.clubeId).not.toBe(antigo)
    expect(jogo.escalacao.titulares).toHaveLength(11)
    expect(estadoCarreira(jogo).despedido).toBeUndefined()
    expect(estadoCarreira(jogo).historico.some((e) => e.clubeId === antigo && e.saida === 'despedido')).toBe(true)
    while (!epocaTerminada(jogo.epoca)) jornada(jogo, n++)
    expect(estadoCarreira(jogo).avaliada).toBe(true)
    expect(estadoCarreira(jogo).historico.at(-1)?.posicao).toBeGreaterThan(0)
  })

  it('o clube mais forte da 4.ª raramente despede e acaba a época avaliado', () => {
    let despedidos = 0
    for (const s of [3, 4, 5, 6]) {
      const jogo = jogoEm(s, (m) => [...m.divisoes[3].clubes].sort((a, b) => forcaClube(m, b) - forcaClube(m, a))[0])
      let n = 0
      while (!epocaTerminada(jogo.epoca) && !estadoCarreira(jogo).despedido) jornada(jogo, n++)
      const st = estadoCarreira(jogo)
      if (st.despedido) despedidos++
      else expect(st.ultimaAvaliacao?.ano).toBe(jogo.epoca.ano)
    }
    expect(despedidos).toBeLessThanOrEqual(1)
  }, 20_000)

  it('duas épocas seguidas: objetivos novos, histórico e determinismo', () => {
    const corre = () => {
      const jogo = jogoEm(42)
      let n = 0
      for (let e = 0; e < 2; e++) {
        while (!epocaTerminada(jogo.epoca)) {
          jornada(jogo, n++)
          const st = estadoCarreira(jogo)
          if (st.despedido) aceitarOferta(jogo, st.despedido.ofertas[0].clubeId)
        }
        fecharEpoca(jogo.mundo, jogo.epoca)
        jogo.epoca = novaEpoca(jogo.mundo, 900 + e)
        iniciarEpocaDirecao(jogo)
        const st = estadoCarreira(jogo)
        if (st.despedido) aceitarOferta(jogo, st.despedido.ofertas[0].clubeId)
      }
      return estadoCarreira(jogo)
    }
    const a = corre()
    const b = corre()
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(a.historico.filter((e) => e.posicao).length).toBeGreaterThanOrEqual(2)
    expect(a.ano).toBe(a.historico.at(-1)?.ano)
    expect(a.confianca).toBeGreaterThanOrEqual(0)
    expect(a.confianca).toBeLessThanOrEqual(100)
  }, 20_000)
})
