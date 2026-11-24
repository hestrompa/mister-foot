import { describe, expect, it } from 'vitest'
import { gerarMundo } from './mundo'
import { concluirJornada, novaEpoca } from './epoca'
import { escalarAuto, iniciarJogo } from './motor'
import type { Jogo } from './types'
import { depoisDoMinuto, novaRondaViva, passoRonda, rondaAcabou, type PausaVivo, type RondaViva } from './ao-vivo'
import { escalacaoTaca, garantirTaca, jogarRondaTaca, meuJogoNaRonda, meuJogoPendente, precisaProlongamento, prolongar, rondaPendente, vencedorDe, type JogoComTaca } from './taca'

function jogoNaTaca(semente: number): JogoComTaca {
  const mundo = gerarMundo(semente)
  const clubeId = mundo.divisoes[3].clubes[0]
  const jogo = { mundo, epoca: novaEpoca(mundo, semente + 1), escalacao: escalarAuto(mundo, clubeId, new Set()), treinador: 'T', clubeId, criado: '' } as Jogo as JogoComTaca
  garantirTaca(jogo)
  let n = 0
  while (!rondaPendente(jogo) && n < 10) concluirJornada(mundo, jogo.epoca, 500 + n++)
  // O utilizador é um dos clubes desta ronda (a preliminar só tem clubes da 4.ª, os outros estão isentos).
  jogo.clubeId = rondaPendente(jogo)!.jogos[semente % 8].foraId
  jogo.escalacao = escalarAuto(mundo, jogo.clubeId, new Set())
  expect(meuJogoPendente(jogo)).toBeTruthy()
  return jogo
}

function rondaViva(jogo: JogoComTaca, semente: number): RondaViva {
  const ronda = rondaPendente(jogo)!
  const estados = ronda.jogos.map((p, i) => iniciarJogo(jogo.mundo, p, escalacaoTaca(jogo, p, p.casaId), escalacaoTaca(jogo, p, p.foraId), (semente + i * 7919) >>> 0))
  const mi = estados.findIndex((e) => e.partida.casaId === jogo.clubeId || e.partida.foraId === jogo.clubeId)
  if (mi > 0) estados.unshift(...estados.splice(mi, 1))
  return novaRondaViva(estados, jogo.clubeId, (e) => {
    if (!precisaProlongamento(e)) return false
    prolongar(e)
    return true
  })
}

/** O ecrã ao vivo, minuto a minuto, sem tempo real: devolve a fase em que acaba e quantos minutos levou. */
function ecra(jogo: JogoComTaca, r: RondaViva, regra: 'nova' | 'antiga', pausaForcada?: { minuto: number; pausa: PausaVivo }) {
  let fase: 'jogo' | PausaVivo | 'resumo' = 'jogo'
  let fechada = false
  let n = 0
  while (n++ < 400) {
    if (fase !== 'jogo') {
      if (fase === 'resumo') break
      fase = 'jogo' // o utilizador carrega em Continuar
      continue
    }
    if (fechada) break // o intervalo do ecrã não volta a fazer nada depois de fechar
    const m = passoRonda(jogo.mundo, r)
    let pausa = m.pausa
    if (!pausa && pausaForcada && rondaAcabou(r) && n >= pausaForcada.minuto) { pausa = pausaForcada.pausa; pausaForcada = undefined }
    if (regra === 'antiga') {
      if (rondaAcabou(r)) { fechada = true; fase = 'resumo' }
      if (pausa) fase = pausa
      continue
    }
    const d = depoisDoMinuto(pausa, rondaAcabou(r))
    if (d.tipo === 'pausa') fase = d.pausa
    else if (d.tipo === 'fechar') { fechada = true; fase = 'resumo' }
  }
  return { fase, minutos: n }
}

describe('ronda ao vivo (taça e Europa)', () => {
  it('uma pausa no último minuto vem antes de fechar a ronda', () => {
    expect(depoisDoMinuto('lesao', true)).toEqual({ tipo: 'pausa', pausa: 'lesao' })
    expect(depoisDoMinuto(null, true)).toEqual({ tipo: 'fechar' })
    expect(depoisDoMinuto(null, false)).toEqual({ tipo: 'segue' })
  })

  it('o ecrã antigo ficava preso no "Final" com uma lesão no último minuto; o novo chega ao resumo', () => {
    const jogo = jogoNaTaca(31)
    const antiga = ecra(jogo, rondaViva(jogo, 77), 'antiga', { minuto: 1, pausa: 'lesao' })
    expect(antiga.fase).not.toBe('resumo')
    const nova = ecra(jogo, rondaViva(jogo, 77), 'nova', { minuto: 1, pausa: 'lesao' })
    expect(nova.fase).toBe('resumo')
  })

  it('ronda da taça ao vivo chega sempre ao resumo, com prolongamento e penáltis, e tem outros jogos', () => {
    let prolongamentos = 0
    for (let s = 1; s <= 12; s++) {
      const jogo = jogoNaTaca(40 + s)
      const r = rondaViva(jogo, s * 1013)
      expect(r.estados.length).toBeGreaterThan(1)
      expect(ecra(jogo, r, 'nova').fase).toBe('resumo')
      expect(rondaAcabou(r)).toBe(true)
      prolongamentos += r.estados.filter((e) => e.partida.prolongamento).length
      const feita = jogarRondaTaca(jogo, r.estados.map((e) => ({ partida: { ...e.partida, jogada: true } })))!
      const minha = meuJogoNaRonda(jogo, feita)!
      expect([minha.casaId, minha.foraId]).toContain(vencedorDe(minha))
      for (const p of feita.jogos) expect(p.golos[0] !== p.golos[1] || p.penaltis).toBeTruthy()
    }
    expect(prolongamentos).toBeGreaterThan(0)
  })
})
