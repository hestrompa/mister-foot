// Medições de equilíbrio de épocas completas (testes de equilíbrio e testes/medir.ts).
import { gerarMundo, forcaClube } from '../core/mundo'
import { concluirJornada, epocaTerminada, fecharEpoca, novaEpoca, tabela } from '../core/epoca'
import type { Jogo, Mundo } from '../core/types'
import { avancarMercado, type JogoComMercado } from '../core/mercado'
import { prepararEpoca } from './gravar'
import { salariosPorJornada } from '../core/financas'

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

// ---------- Carreira completa como na app (mercado, contratos, obras e empréstimos) ----------

export interface MedidaDinheiro {
  ano: number
  /** Por divisão: percentis 10/50/90 do dinheiro em caixa no fim da época. */
  p10: number[]; p50: number[]; p90: number[]
  /** Clubes no vermelho, com empréstimo, e com obra. */
  vermelho: number; emprestimo: number; obras: number
  /** Massa salarial anual mediana por divisão. */
  salarios: number[]
  forcaMedia: number[]
  plantelMin: number; plantelMax: number
  /** Dinheiro total no mundo. */
  total: number
  transferencias: number
}

const pct = (v: number[], p: number) => { const s = v.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))] }

/** Joga `epocas` épocas como a app (o clube do utilizador não faz nada: só joga). */
export function medirDinheiro(semente: number, epocas: number, divUtilizador = 3): MedidaDinheiro[] {
  const mundo = gerarMundo(semente)
  const clubeId = mundo.divisoes[divUtilizador].clubes[9]
  const jogo = prepararEpoca({ mundo, treinador: 'T', clubeId, criado: '' } as Jogo) as JogoComMercado
  const out: MedidaDinheiro[] = []
  for (let e = 0; e < epocas; e++) {
    let n = 0
    const clubeAntes = new Map(Object.values(mundo.jogadores).map((j) => [j.id, j.clubeId]))
    avancarMercado(jogo)
    while (!epocaTerminada(jogo.epoca)) {
      concluirJornada(mundo, jogo.epoca, semente * 1000 + e * 50 + n++)
      avancarMercado(jogo)
    }
    const ano = jogo.epoca.ano
    const transferencias = Object.values(mundo.jogadores).filter((j) => j.clubeId !== 0 && clubeAntes.has(j.id) && clubeAntes.get(j.id) !== 0 && clubeAntes.get(j.id) !== j.clubeId).length
    fecharEpoca(mundo, jogo.epoca)
    const m: MedidaDinheiro = { ano, p10: [], p50: [], p90: [], vermelho: 0, emprestimo: 0, obras: 0, salarios: [], forcaMedia: [], plantelMin: 99, plantelMax: 0, total: 0, transferencias }
    for (const d of mundo.divisoes) {
      const din = d.clubes.map((id) => mundo.clubes[id].dinheiro)
      m.p10.push(pct(din, 0.1)); m.p50.push(pct(din, 0.5)); m.p90.push(pct(din, 0.9))
      m.salarios.push(pct(d.clubes.map((id) => salariosPorJornada(mundo, id) * 34), 0.5))
      m.forcaMedia.push(Math.round(d.clubes.reduce((s, id) => s + forcaClube(mundo, id), 0) / d.clubes.length))
      for (const id of d.clubes) {
        const c = mundo.clubes[id]
        if (c.dinheiro < 0) m.vermelho++
        if (c.emprestimo) m.emprestimo++
        if (c.estadio.obra) m.obras++
        m.total += c.dinheiro
        m.plantelMin = Math.min(m.plantelMin, c.plantel.length)
        m.plantelMax = Math.max(m.plantelMax, c.plantel.length)
      }
    }
    prepararEpoca(jogo)
    out.push(m)
  }
  return out
}
