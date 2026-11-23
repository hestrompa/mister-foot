import { describe, expect, it } from 'vitest'
import { gerarMundo } from './mundo'
import { concluirJornada, epocaTerminada, novaEpoca } from './epoca'
import { ambiente, aplicarJogo, capitaoDe, estadoBalneario, estatutos, fatorMoral, moralDe, mudarMoral, mudarMoralJogador, type JogoComBalneario } from './balneario'
import { anteciparRegresso, avancarBalneario, definirCapitao, prometer, resolverConflito } from './balneario-acoes'
import { TIPOS_LESAO, fadigaDe, fatorFisico, riscoLesao, sortearLesao } from './lesoes'
import { createRng } from './rng'
import { escalarAuto } from './motor'
import { avancarMercado, clausulaDe, comissaoEmpresario, definirClausula, estadoMercado, pagarClausula, pedidoSalarial, renovar, type JogoComMercado } from './mercado'
import { avancarSelecao, estadoSelecao, PARAGENS, type JogoComSelecao } from './selecao'
import type { Jogo } from './types'
import type { Partida } from './partida'

function novoJogo(semente = 11, div = 1): JogoComBalneario & JogoComMercado & JogoComSelecao {
  const mundo = gerarMundo(semente)
  const clubeId = mundo.divisoes[div - 1].clubes[0]
  const epoca = novaEpoca(mundo, semente)
  const jogo: Jogo = { mundo, treinador: 'T', clubeId, criado: '', epoca, escalacao: escalarAuto(mundo, clubeId, new Set()) }
  return jogo
}

describe('moral', () => {
  it('mudarMoral mexe no plantel todo, com limites e rendimentos decrescentes', () => {
    const jogo = novoJogo()
    const c = jogo.mundo.clubes[jogo.clubeId]
    mudarMoral(jogo, c.id, 50, 'teste')
    const m1 = moralDe(jogo.mundo.jogadores[c.plantel[0]])
    expect(m1).toBe(70)
    for (let k = 0; k < 30; k++) mudarMoral(jogo, c.id, 10, '')
    expect(moralDe(jogo.mundo.jogadores[c.plantel[0]])).toBeLessThanOrEqual(100)
    expect(estadoBalneario(jogo).mensagens[0]?.texto).toBe('teste')
    mudarMoralJogador(jogo, c.plantel[1], -100, '')
    expect(moralDe(jogo.mundo.jogadores[c.plantel[1]])).toBeGreaterThan(50)
    expect(fatorMoral(jogo.mundo.jogadores[c.plantel[0]])).toBeGreaterThan(1)
    expect(fatorMoral(jogo.mundo.jogadores[c.plantel[0]])).toBeLessThan(1.06)
  })

  it('titular que fica de fora perde moral; quem joga e ganha sobe; jogar cansa', () => {
    const jogo = novoJogo()
    const { mundo } = jogo
    const c = mundo.clubes[jogo.clubeId]
    const est = estatutos(mundo, c.id)
    const titulares = c.plantel.filter((id) => est.get(id) === 'titular')
    const banco = titulares[0]
    const onze = c.plantel.filter((id) => id !== banco).slice(0, 11)
    const p: Partida = {
      id: 'x', competicao: 'liga', divisao: 1, jornada: 1, casaId: c.id, foraId: mundo.divisoes[0].clubes[1], golos: [2, 0], eventos: [],
      estat: { posse: [50, 50], remates: [0, 0], rematesBaliza: [0, 0], cantos: [0, 0], amarelos: [0, 0], vermelhos: [0, 0] }, jogada: true,
      onzes: [
        { formacao: '4-4-2', postura: 'equilibrada', titulares: onze, suplentes: [] },
        { formacao: '4-4-2', postura: 'equilibrada', titulares: mundo.clubes[mundo.divisoes[0].clubes[1]].plantel.slice(0, 11), suplentes: [] },
      ],
    }
    aplicarJogo(mundo, p, new Set(), true)
    const jogou = onze.find((id) => est.get(id) === 'titular')!
    expect(moralDe(mundo.jogadores[jogou])).toBeGreaterThan(60)
    expect(moralDe(mundo.jogadores[banco])).toBeLessThan(moralDe(mundo.jogadores[jogou]))
    expect(fadigaDe(mundo.jogadores[jogou])).toBeGreaterThanOrEqual(18)
    expect(fadigaDe(mundo.jogadores[banco])).toBe(0)
    // Os que perderam descem.
    const perdeu = mundo.clubes[p.foraId].plantel[0]
    expect(moralDe(mundo.jogadores[perdeu])).toBeLessThan(60)
  })

  it('numa época inteira a moral e o cansaço ficam em valores razoáveis', () => {
    const jogo = novoJogo(5)
    const { mundo, epoca } = jogo
    let n = 0
    while (!epocaTerminada(epoca)) concluirJornada(mundo, epoca, 500 + n++)
    const morais = Object.values(mundo.jogadores).filter((j) => j.clubeId).map(moralDe)
    const media = morais.reduce((s, m) => s + m, 0) / morais.length
    expect(media).toBeGreaterThan(45)
    expect(media).toBeLessThan(75)
    expect(morais.filter((m) => m <= 5).length / morais.length).toBeLessThan(0.05)
    const ambientes = Object.keys(mundo.clubes).map((id) => ambiente(mundo, Number(id)))
    expect(Math.max(...ambientes) - Math.min(...ambientes)).toBeGreaterThan(5)
    const fad = Object.values(mundo.jogadores).map(fadigaDe)
    expect(Math.max(...fad)).toBeLessThan(80)
  }, 30_000)
})

describe('balneário do treinador', () => {
  it('promessa quebrada custa moral; capitão novo e antigo', () => {
    const jogo = novoJogo()
    const { mundo, epoca } = jogo
    const c = mundo.clubes[jogo.clubeId]
    const reserva = c.plantel.map((id) => mundo.jogadores[id]).sort((a, b) => a.forca - b.forca)[0]
    expect(prometer(jogo, reserva.id).ok).toBe(true)
    expect(prometer(jogo, reserva.id).ok).toBe(false)
    const antes = moralDe(reserva)
    // Cinco jornadas sem o pôr a titular.
    for (let k = 0; k < 5; k++) {
      concluirJornada(mundo, epoca, 900 + k)
      avancarBalneario(jogo)
    }
    expect(estadoBalneario(jogo).promessas.length).toBe(0)
    expect(moralDe(reserva)).toBeLessThan(antes - 10)

    const cap = capitaoDe(mundo, c.id)!
    const outro = c.plantel.find((id) => id !== cap)!
    const mCap = moralDe(mundo.jogadores[cap])
    expect(definirCapitao(jogo, outro).ok).toBe(true)
    expect(capitaoDe(mundo, c.id)).toBe(outro)
    expect(moralDe(mundo.jogadores[cap])).toBeLessThan(mCap)
  }, 20_000)

  it('jogadores muito em baixo criam conflitos que o treinador resolve', () => {
    const jogo = novoJogo(3)
    const { mundo, epoca } = jogo
    const c = mundo.clubes[jogo.clubeId]
    let vistos = 0
    for (let k = 0; k < 10; k++) {
      for (const id of c.plantel) mudarMoralJogador(jogo, id, -30, '')
      concluirJornada(mundo, epoca, 300 + k)
      avancarBalneario(jogo)
      const st = estadoBalneario(jogo)
      for (const kf of st.conflitos.slice()) {
        vistos++
        expect(resolverConflito(jogo, kf.id, 'conversar').ok).toBe(true)
      }
    }
    expect(vistos).toBeGreaterThan(0)
  }, 20_000)

  it('regresso antecipado deixa o jogador frágil', () => {
    const jogo = novoJogo()
    const id = jogo.mundo.clubes[jogo.clubeId].plantel[3]
    jogo.epoca.indisponiveis[id] = { jogos: 1, motivo: 'lesao', tipo: 'distensao', total: 3 }
    expect(anteciparRegresso(jogo, id).ok).toBe(true)
    expect(jogo.epoca.indisponiveis[id]).toBeUndefined()
    const j = jogo.mundo.jogadores[id]
    expect(riscoLesao(j)).toBeGreaterThan(5)
    expect(fatorFisico(j)).toBeLessThan(1)
  })
})

describe('lesões', () => {
  it('duração média parecida com a antiga e cansaço puxa lesões musculares', () => {
    const rng = createRng(1)
    const m = gerarMundo(2)
    const j = { ...Object.values(m.jogadores)[0] }
    let total = 0, musc = 0
    const N = 4000
    for (let k = 0; k < N; k++) { const l = sortearLesao(rng, j); total += l.jogos; if (l.tipo.cansaco > 1) musc++ }
    expect(total / N).toBeGreaterThan(2.8)
    expect(total / N).toBeLessThan(4.2)
    const cansado = { ...j, fadiga: 70 }
    let musc2 = 0
    for (let k = 0; k < N; k++) if (sortearLesao(rng, cansado).tipo.cansaco > 1) musc2++
    expect(musc2).toBeGreaterThan(musc * 1.3)
    expect(riscoLesao(cansado)).toBeGreaterThan(riscoLesao(j))
    expect(TIPOS_LESAO.length).toBeGreaterThanOrEqual(5)
  })
})

describe('contratos e seleção', () => {
  it('cláusula baixa pode ser paga; comissão do empresário sai do comprador', () => {
    const jogo = novoJogo(9, 2)
    const { mundo } = jogo
    estadoMercado(jogo)
    const alvo = mundo.clubes[mundo.divisoes[1].clubes[5]].plantel.map((id) => mundo.jogadores[id]).sort((a, b) => a.forca - b.forca)[0]
    definirClausula(alvo, 'baixa')
    const meu = mundo.clubes[jogo.clubeId]
    meu.dinheiro = clausulaDe(alvo) * 3
    const antes = meu.dinheiro
    const c0 = clausulaDe(alvo)
    const sal = pedidoSalarial(mundo, alvo, meu.id)
    const r = pagarClausula(jogo, alvo.id, sal)
    expect(r.ok).toBe(true)
    expect(alvo.clubeId).toBe(meu.id)
    expect(antes - meu.dinheiro).toBe(c0 + comissaoEmpresario(c0, sal))
  })

  it('jogador desmotivado não renova; renovar paga comissão', () => {
    const jogo = novoJogo()
    const j = jogo.mundo.jogadores[jogo.mundo.clubes[jogo.clubeId].plantel[2]]
    j.contrato = 1
    mudarMoralJogador(jogo, j.id, -30, ''); mudarMoralJogador(jogo, j.id, -30, '')
    expect(renovar(jogo, j.id, 2).ok).toBe(false)
    mudarMoralJogador(jogo, j.id, 30, ''); mudarMoralJogador(jogo, j.id, 30, '')
    const d = jogo.mundo.clubes[jogo.clubeId].dinheiro
    expect(renovar(jogo, j.id, 2, 'alta').ok).toBe(true)
    expect(jogo.mundo.clubes[jogo.clubeId].dinheiro).toBe(d - j.salario)
  })

  it('a seleção convoca nas paragens, uma vez por paragem', () => {
    const jogo = novoJogo()
    const { mundo, epoca } = jogo
    let feitas = 0
    for (let k = 0; k < PARAGENS[0]; k++) {
      concluirJornada(mundo, epoca, 40 + k)
      avancarMercado(jogo)
      if (avancarSelecao(jogo)) feitas++
      expect(avancarSelecao(jogo)).toBeNull()
    }
    expect(feitas).toBe(1)
    const c = estadoSelecao(jogo).convocatorias[0]
    expect(c.ids.length).toBe(23)
    expect(c.ids.every((id) => mundo.jogadores[id].nacionalidade === 'PT')).toBe(true)
  }, 20_000)
})
