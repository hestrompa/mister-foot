import { describe, expect, it } from 'vitest'
import { gerarMundo } from './mundo'
import { escalarAuto } from './motor'
import { bolaEm, caricasEm, COMPRIMENTO, criarAmbiente, criarRepeticao, fimEmCampo, POSTES, type EmCampoRep } from './repeticao'
import type { EventoJogo, Lado, Lance } from './partida'

const m = gerarMundo(11)
const [a, b] = m.divisoes[0].clubes
const NADA = new Set<number>()
const escA = escalarAuto(m, a, NADA, '4-3-3')
const escB = escalarAuto(m, b, NADA, '5-3-2')
const emCampo: Record<Lado, EmCampoRep> = { casa: { escalacao: escA, fora: [] }, fora: { escalacao: escB, fora: [] } }

const ORIGENS: Lance['origem'][] = ['jogada', 'contra', 'canto', 'livre', 'penalti', 'longe']
const DESFECHOS: Lance['desfecho'][] = ['golo', 'defesa', 'poste', 'fora']

function evento(origem: Lance['origem'], desfecho: Lance['desfecho'], corredor: -1 | 0 | 1, lado: Lado = 'casa'): EventoJogo {
  const at = lado === 'casa' ? escA : escB
  const df = lado === 'casa' ? escB : escA
  const lance: Lance = {
    origem, desfecho, corredor, rematadorId: at.titulares[10],
    ...(origem === 'penalti' || origem === 'livre' ? {} : { passadorId: at.titulares[7] }),
    defensorId: df.titulares[2], guardaRedesId: df.titulares[0],
  }
  return { minuto: 33, tipo: desfecho === 'golo' ? 'golo' : 'oportunidade', lado, jogadorId: lance.rematadorId, lance, texto: 'teste' }
}

describe('repetição 2D', () => {
  it('cada equipa ataca para a sua baliza e troca ao intervalo', () => {
    const e = evento('jogada', 'golo', 0, 'casa')
    expect(criarRepeticao({ ...e, minuto: 20 }, emCampo, 3)!.espelhar).toBe(false)
    expect(criarRepeticao({ ...e, minuto: 70 }, emCampo, 3)!.espelhar).toBe(true)
    const f = evento('jogada', 'golo', 0, 'fora')
    expect(criarRepeticao({ ...f, minuto: 20 }, emCampo, 3)!.espelhar).toBe(true)
    expect(criarRepeticao({ ...f, minuto: 70 }, emCampo, 3)!.espelhar).toBe(false)
  })

  it('penálti: primeiro a falta, depois o corte para a marcação', () => {
    const c = criarRepeticao(evento('penalti', 'golo', 1), emCampo, 9)!
    const falta = c.acoes.find((a) => a.tipo === 'falta')!
    expect(falta).toBeDefined()
    expect(falta.t).toBeLessThan(c.cortes[0])
    expect(c.cortes[0]).toBeLessThan(c.tRemate)
    // A falta é dentro da área.
    const b = bolaEm(c, falta.t)
    expect(b.x).toBeGreaterThan(88.5)
  })

  it('é determinística', () => {
    const e = evento('jogada', 'golo', 1)
    expect(criarRepeticao(e, emCampo, 5)).toEqual(criarRepeticao(e, emCampo, 5))
    expect(criarRepeticao({ ...e, lance: undefined }, emCampo, 5)).toBeNull()
  })

  for (const origem of ORIGENS) {
    for (const desfecho of DESFECHOS) {
      it(`${origem} / ${desfecho}: bola e caricas coerentes`, () => {
        let fintas = 0
        for (let s = 1; s <= 12; s++) {
          const corredor = ((s % 3) - 1) as -1 | 0 | 1
          const c = criarRepeticao(evento(origem, desfecho, corredor, s % 2 ? 'casa' : 'fora'), emCampo, s * 977)!
          expect(c.caricas).toHaveLength(22)
          expect(c.tRemate).toBeLessThan(c.tFim)
          expect(c.tFim).toBeLessThan(c.duracao)
          // O rematador está com a bola no remate.
          const iR = c.caricas.findIndex((k) => k.id === c.rematadorId)
          const pr = caricasEm(c, c.tRemate)[iR]
          const br = bolaEm(c, c.tRemate)
          expect(Math.hypot(pr[0] - br.x, pr[1] - br.y)).toBeLessThan(1.6)
          // Onde a bola acaba bate certo com o desfecho.
          const bf = bolaEm(c, c.tFim)
          if (desfecho === 'golo') {
            const fim = bolaEm(c, c.duracao)
            expect(fim.x).toBeGreaterThan(COMPRIMENTO)
            expect(fim.y).toBeGreaterThan(POSTES[0])
            expect(fim.y).toBeLessThan(POSTES[1])
          }
          if (desfecho === 'fora') expect(bf.y < POSTES[0] - 0.5 || bf.y > POSTES[1] + 0.5).toBe(true)
          if (desfecho === 'poste') expect(Math.min(Math.abs(bf.y - POSTES[0]), Math.abs(bf.y - POSTES[1]))).toBeLessThan(0.1)
          if (desfecho === 'defesa') {
            const iG = c.caricas.findIndex((k) => k.pos === 'GR' && k.lado !== c.atacante)
            const pg = caricasEm(c, c.tFim)[iG]
            expect(Math.hypot(pg[0] - bf.x, pg[1] - bf.y)).toBeLessThan(1)
          }
          // Ninguém se teletransporta nem sai do mapa.
          for (let k = 1; k < c.quadros.length; k++) {
            if (c.cortes.some((tc) => (k - 1) * c.dt < tc - 1e-6 && k * c.dt >= tc - 1e-6)) continue
            for (let i = 0; i < 22; i++) {
              const [x0, y0] = c.quadros[k - 1][i], [x1, y1] = c.quadros[k][i]
              const salto = Math.hypot(x1 - x0, y1 - y0)
              if (salto >= 1.6) throw new Error(`salto ${salto.toFixed(2)} m: ${c.caricas[i].pos} ${c.caricas[i].lado === c.atacante ? 'ataque' : 'defesa'} t=${(k * c.dt).toFixed(1)} rem=${c.caricas[i].id === c.rematadorId}`)
              expect(x1).toBeGreaterThanOrEqual(-1)
              expect(x1).toBeLessThanOrEqual(COMPRIMENTO + 2)
            }
          }
          // Finta: o adversário chega à bola na altura da finta e o condutor fica com ela.
          for (const f of c.acoes.filter((a) => a.tipo === 'finta')) {
            const ps = caricasEm(c, f.t)
            const bt = bolaEm(c, f.t)
            const iV = c.caricas.findIndex((k) => k.id === f.vitimaId)
            const iA = c.caricas.findIndex((k) => k.id === f.autorId)
            expect(c.caricas[iV].lado).not.toBe(c.atacante)
            expect(Math.hypot(ps[iV][0] - bt.x, ps[iV][1] - bt.y)).toBeLessThan(3.5)
            expect(Math.hypot(ps[iA][0] - bt.x, ps[iA][1] - bt.y)).toBeLessThan(1.6)
            fintas++
          }
          // No penálti, só o marcador e o guarda-redes estão na área no remate.
          if (origem === 'penalti') {
            const ps = caricasEm(c, c.tRemate)
            c.caricas.forEach((k, i) => {
              if (k.id === c.rematadorId || k.pos === 'GR') return
              expect(ps[i][0]).toBeLessThan(88.6)
            })
          }
        }
        if (origem === 'jogada' || origem === 'contra') expect(fintas).toBeGreaterThan(2)
      })
    }
  }
})

describe('campo ao vivo (minutos sem lance)', () => {
  const base = { emCampo, minuto: 10, posturas: { casa: 'equilibrada', fora: 'equilibrada' } as const }
  it('continua do minuto anterior, sem saltos, e a bola vai para um jogador da equipa com posse', () => {
    let c = criarAmbiente({ ...base, posse: 'casa', semente: 1 })
    for (let k = 0; k < 30; k++) {
      const posse = k % 4 === 3 ? 'fora' : 'casa'
      const antes = { ...fimEmCampo(c), posse: c.atacante }
      const n = criarAmbiente({ ...base, minuto: 10 + k, posse, antes, semente: 100 + k })
      // Primeiro quadro = onde o anterior acabou (a menos de um passo).
      n.caricas.forEach((kk, i) => {
        const [x, y] = antes.pos[kk.id]
        expect(Math.hypot(n.quadros[0][i][0] - x, n.quadros[0][i][1] - y)).toBeLessThan(1.2)
      })
      for (let f = 1; f < n.quadros.length; f++) for (let i = 0; i < 22; i++) {
        expect(Math.hypot(n.quadros[f][i][0] - n.quadros[f - 1][i][0], n.quadros[f][i][1] - n.quadros[f - 1][i][1])).toBeLessThan(1.2)
      }
      const iR = n.caricas.findIndex((kk) => kk.id === n.rematadorId)
      expect(n.caricas[iR].lado).toBe(posse)
      const b = bolaEm(n, n.duracao)
      const p = caricasEm(n, n.duracao)[iR]
      expect(Math.hypot(p[0] - b.x, p[1] - b.y)).toBeLessThan(4)
      c = n
    }
  })

  it('a postura muda a altura do bloco', () => {
    const med = (p: 'defensiva' | 'ofensiva') => {
      const c = criarAmbiente({ ...base, posturas: { casa: p, fora: 'equilibrada' }, posse: 'casa', antes: { pos: {}, bola: { x: 60, y: 34 }, posse: 'casa' }, semente: 4 })
      const q = c.quadros[c.quadros.length - 1]
      const xs = c.caricas.map((k, i) => (k.lado === 'casa' && k.pos !== 'GR' ? q[i][0] : null)).filter((x): x is number => x != null)
      return xs.reduce((a, b) => a + b, 0) / xs.length
    }
    expect(med('ofensiva')).toBeGreaterThan(med('defensiva') + 4)
  })
})
