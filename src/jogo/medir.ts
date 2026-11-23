// Medições de equilíbrio de épocas completas (testes de equilíbrio e testes/medir.ts).
import { gerarMundo, forcaClube } from '../core/mundo'
import { concluirJornada, epocaTerminada, fecharEpoca, novaEpoca, tabela } from '../core/epoca'
import type { Mundo } from '../core/types'

export interface MedidaEpoca {
  ano: number
  jogos: number
  golosPorJogo: number[]
  empates: number
  vitoriasCasa: number
  amarelos: number
  vermelhos: number
  lesoes: number
  castigos: number
  /** Força média do campeão e do último por divisão. */
  campeaoRank: number[]
  /** Pontos do campeão e do último por divisão. */
  ptsCampeao: number[]
  ptsUltimo: number[]
  /** Dinheiro mediano por divisão no fim da época, e nº de clubes com saldo negativo. */
  dinheiroMediano: number[]
  falidos: number
  /** Força média por divisão no fim da época. */
  forcaMedia: number[]
  maiorGoleada: number
  maxGolosMarcador: number
}

export function medirEpoca(mundo: Mundo, semente: number): MedidaEpoca {
  const epoca = novaEpoca(mundo, semente)
  const forcaInicio = new Map<number, number>()
  for (const id of Object.keys(mundo.clubes).map(Number)) forcaInicio.set(id, forcaClube(mundo, id))
  let n = 0
  let castigos = 0
  while (!epocaTerminada(epoca)) {
    const antes = new Set(Object.entries(epoca.indisponiveis).filter(([, i]) => i.motivo === 'castigo').map(([k]) => k))
    concluirJornada(mundo, epoca, semente * 100 + n++)
    for (const [k, i] of Object.entries(epoca.indisponiveis)) if (i.motivo === 'castigo' && !antes.has(k)) castigos++
  }
  const m: MedidaEpoca = {
    ano: epoca.ano, jogos: 0, golosPorJogo: [], empates: 0, vitoriasCasa: 0, amarelos: 0, vermelhos: 0, lesoes: 0,
    castigos, campeaoRank: [], ptsCampeao: [], ptsUltimo: [], dinheiroMediano: [], falidos: 0, forcaMedia: [], maiorGoleada: 0, maxGolosMarcador: 0,
  }
  for (const div of epoca.calendario) {
    let g = 0, jogos = 0
    for (const jorn of div) for (const p of jorn) {
      jogos++
      const t = p.golos[0] + p.golos[1]
      g += t
      m.maiorGoleada = Math.max(m.maiorGoleada, Math.abs(p.golos[0] - p.golos[1]))
      if (p.golos[0] === p.golos[1]) m.empates++
      else if (p.golos[0] > p.golos[1]) m.vitoriasCasa++
      m.amarelos += p.estat.amarelos[0] + p.estat.amarelos[1]
      m.vermelhos += p.estat.vermelhos[0] + p.estat.vermelhos[1]
      m.lesoes += p.eventos.filter((e) => e.tipo === 'lesao').length
    }
    m.jogos += jogos
    m.golosPorJogo.push(g / jogos)
  }
  for (const d of mundo.divisoes) {
    const t = tabela(mundo, epoca, d.numero)
    const ordemForca = t.map((l) => l.clubeId).sort((a, b) => (forcaInicio.get(b)! - forcaInicio.get(a)!))
    m.campeaoRank.push(ordemForca.indexOf(t[0].clubeId) + 1)
    m.ptsCampeao.push(t[0].pts)
    m.ptsUltimo.push(t[t.length - 1].pts)
  }
  m.maxGolosMarcador = Math.max(0, ...Object.values(epoca.marcadores))
  fecharEpoca(mundo, epoca)
  for (const d of mundo.divisoes) {
    const din = d.clubes.map((id) => mundo.clubes[id].dinheiro).sort((a, b) => a - b)
    m.dinheiroMediano.push(din[Math.floor(din.length / 2)])
    m.falidos += din.filter((v) => v < 0).length
    m.forcaMedia.push(Math.round(d.clubes.reduce((s, id) => s + forcaClube(mundo, id), 0) / d.clubes.length))
  }
  return m
}

export function medirCarreira(semente: number, epocas: number): MedidaEpoca[] {
  const mundo = gerarMundo(semente)
  const out: MedidaEpoca[] = []
  for (let e = 0; e < epocas; e++) out.push(medirEpoca(mundo, semente * 13 + e + 1))
  return out
}
