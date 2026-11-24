// Medições de equilíbrio de épocas completas (testes de equilíbrio e testes/medir.ts).
import { gerarMundo, forcaClube } from '../core/mundo'
import { concluirJornada, epocaTerminada, fecharEpoca, novaEpoca, tabela } from '../core/epoca'
import type { Jogo, Mundo } from '../core/types'
import { avancarMercado, type JogoComMercado } from '../core/mercado'
import { prepararEpoca } from './gravar'
import type { EpocaComInicio } from '../core/inicio-epoca'
import { garantirStaff, staffIA } from '../core/staff-ia'
import { salariosPorJornada } from '../core/financas'
import { avancarTaca, jogarRondaTaca, meuJogoPendente, registarCampeao, type JogoComTaca } from '../core/taca'
import { avancarEuropa, jogarDiaEuropa, meuJogoEuropa, qualificarEuropa, type JogoComEuropa } from '../core/europa'
import { registarFichas } from '../core/fichas'
import { avancarBalneario } from '../core/balneario-acoes'
import { avancarSelecao } from '../core/selecao'
import { avancarDirecao } from '../core/direcao'
import { avancarImprensa } from '../core/imprensa'

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
  garantirStaff(mundo)
  for (let e = 0; e < epocas; e++) {
    if (e > 0) staffIA(mundo, -1)
    out.push(medirEpoca(mundo, semente * 13 + e + 1))
  }
  return out
}

// ---------- Carreira completa como na app (mercado, contratos, obras e empréstimos) ----------

export interface MedidaDinheiro {
  ano: number
  /** Por divisão: percentis 10/50/90 do dinheiro em caixa no fim da época. */
  p10: number[]; p50: number[]; p90: number[]
  /** Por divisão: o mais rico e o mais pobre. */
  max: number[]; min: number[]
  /** Clubes no vermelho, com empréstimo, e com obra feita ou a decorrer. */
  vermelho: number; emprestimo: number; obras: number
  /** Massa salarial anual mediana por divisão. */
  salarios: number[]
  forcaMedia: number[]
  plantelMin: number; plantelMax: number
  /** Dinheiro total no mundo. */
  total: number
  transferencias: number
  /** Média por clube (divisão no início da época) de cada fluxo de dinheiro na época. */
  fluxos: Record<'inicio' | 'bilheteira' | 'fixas' | 'salarios' | 'estadio' | 'taca' | 'europa' | 'resto' | 'saldo', number>[]
}

const pct = (v: number[], p: number) => { const s = v.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))] }

/** Taça e Europa como na app (os jogos do utilizador também simulados). */
function competicoes(jogo: JogoComTaca & JogoComEuropa) {
  avancarTaca(jogo)
  avancarEuropa(jogo)
  for (let g = 0; g < 6; g++) {
    if (meuJogoPendente(jogo)) jogarRondaTaca(jogo)
    else if (meuJogoEuropa(jogo)) jogarDiaEuropa(jogo)
    else break
    avancarTaca(jogo)
    avancarEuropa(jogo)
  }
}

/** O resto do que a app faz depois de cada jornada (fichas, balneário, seleções, direção, imprensa). */
function restoDaJornada(jogo: Jogo) {
  registarFichas(jogo)
  avancarBalneario(jogo)
  avancarSelecao(jogo)
  avancarDirecao(jogo)
  avancarImprensa(jogo)
}

/** Joga `epocas` épocas como a app (o clube do utilizador não faz nada: só joga). Com `taca`, joga também a taça e a Europa; com `tudo`, também o balneário, seleções, direção, imprensa e fichas. */
export function medirDinheiro(semente: number, epocas: number, divUtilizador = 3, taca = false, tudo = false): MedidaDinheiro[] {
  const mundo = gerarMundo(semente)
  const clubeId = mundo.divisoes[divUtilizador].clubes[9]
  const jogo = prepararEpoca({ mundo, treinador: 'T', clubeId, criado: '' } as Jogo) as JogoComMercado
  const out: MedidaDinheiro[] = []
  for (let e = 0; e < epocas; e++) {
    let n = 0
    const clubeAntes = new Map(Object.values(mundo.jogadores).map((j) => [j.id, j.clubeId]))
    const divAntes = new Map(Object.values(mundo.clubes).map((c) => [c.id, c.divisao]))
    const ini = (jogo.epoca as EpocaComInicio).inicio ?? {}
    const dinAntes = new Map(Object.values(mundo.clubes).map((c) => [c.id, c.dinheiro - (ini[c.id]?.total ?? 0)]))
    const fl = mundo.divisoes.map(() => ({ inicio: 0, bilheteira: 0, fixas: 0, salarios: 0, estadio: 0, taca: 0, europa: 0, resto: 0, saldo: 0 }))
    const somarBalanco = () => {
      for (const [k, b] of Object.entries(jogo.epoca.ultimoBalanco ?? {})) {
        const f = fl[(divAntes.get(Number(k)) ?? 1) - 1]
        f.bilheteira += b.bilheteira; f.fixas += b.fixas; f.salarios -= b.salarios; f.estadio -= b.estadio ?? 0
      }
    }
    avancarMercado(jogo)
    if (taca || tudo) competicoes(jogo)
    while (!epocaTerminada(jogo.epoca)) {
      concluirJornada(mundo, jogo.epoca, semente * 1000 + e * 50 + n++)
      somarBalanco()
      if (tudo) registarFichas(jogo)
      avancarMercado(jogo)
      if (taca || tudo) competicoes(jogo)
      if (tudo) restoDaJornada(jogo)
    }
    const ano = jogo.epoca.ano
    const transferencias = Object.values(mundo.jogadores).filter((j) => j.clubeId !== 0 && clubeAntes.has(j.id) && clubeAntes.get(j.id) !== 0 && clubeAntes.get(j.id) !== j.clubeId).length
    if (taca || tudo) qualificarEuropa(jogo)
    const resumo = fecharEpoca(mundo, jogo.epoca)
    if (taca || tudo) registarCampeao(jogo, resumo.campeoes)
    const jt = jogo as JogoComTaca & JogoComEuropa
    for (const c of Object.values(mundo.clubes)) {
      const f = fl[(divAntes.get(c.id) ?? 1) - 1]
      const t = jt.taca?.receitas[c.id] ?? 0, eu = jt.europa?.receitas[c.id] ?? 0
      f.inicio += ini[c.id]?.total ?? 0
      f.taca += t; f.europa += eu; f.saldo += c.dinheiro - (dinAntes.get(c.id) ?? 0)
    }
    for (const f of fl) {
      f.resto = f.saldo - f.inicio - f.bilheteira - f.fixas - f.salarios - f.estadio - f.taca - f.europa
      for (const k of Object.keys(f) as (keyof typeof f)[]) f[k] = Math.round(f[k] / 18)
    }
    const m: MedidaDinheiro = { ano, p10: [], p50: [], p90: [], max: [], min: [], vermelho: 0, emprestimo: 0, obras: 0, salarios: [], forcaMedia: [], plantelMin: 99, plantelMax: 0, total: 0, transferencias, fluxos: fl }
    for (const d of mundo.divisoes) {
      const din = d.clubes.map((id) => mundo.clubes[id].dinheiro)
      m.p10.push(pct(din, 0.1)); m.p50.push(pct(din, 0.5)); m.p90.push(pct(din, 0.9))
      m.max.push(Math.max(...din)); m.min.push(Math.min(...din))
      m.salarios.push(pct(d.clubes.map((id) => salariosPorJornada(mundo, id) * 34), 0.5))
      m.forcaMedia.push(Math.round(d.clubes.reduce((s, id) => s + forcaClube(mundo, id), 0) / d.clubes.length))
      for (const id of d.clubes) {
        const c = mundo.clubes[id]
        if (c.dinheiro < 0) m.vermelho++
        if (c.emprestimo) m.emprestimo++
        if (c.estadio.obra || (c.estadio.base !== undefined && c.estadio.lugares > c.estadio.base)) m.obras++
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
