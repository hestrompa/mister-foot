// Direção do clube e carreira do treinador: objetivos por época, confiança da direção, despedimento,
// ofertas de outros clubes e histórico. Tudo determinístico (createRng com semente do mundo e da jornada).
import { createRng } from './rng'
import { forcaClube, NOMES_DIVISAO } from './mundo'
import { epocaTerminada, indisponiveisDe, tabela } from './epoca'
import { escalarAuto } from './motor'
import { RECEITA_FIXA } from './financas'
import type { Jogo, Mundo } from './types'
import type { EstadoMercado } from './mercado'

export type TipoObjetivo = 'titulo' | 'subida' | 'europa' | 'metade' | 'meio' | 'manutencao'

export interface Objetivos {
  /** Divisão em que o objetivo foi marcado. */
  divisao: number
  tipo: TipoObjetivo
  /** Posição máxima que cumpre o objetivo. */
  alvo: number
  /** Lugar que a direção espera, pelas contas do plantel, salários e reputação. */
  esperado: number
  /** Dinheiro mínimo no fim da época (pode ser negativo se o clube já começa endividado). */
  dinheiroMin: number
  dinheiroInicio: number
}

export interface Oferta {
  clubeId: number
  /** Vale enquanto epoca.jornada <= ate. */
  ate: number
  /** Ano da época em que foi feita. */
  ano: number
  motivo: string
}

export type Avaliacao = 'superado' | 'cumprido' | 'quase' | 'falhado'

export interface EntradaCarreira {
  ano: number
  clubeId: number
  clubeNome: string
  divisao: number
  objetivo: string
  /** Jornada em que entrou e a última que orientou. */
  de: number
  ate: number
  posicao?: number
  avaliacao?: Avaliacao
  campeao?: boolean
  subiu?: boolean
  desceu?: boolean
  saida?: 'despedido' | 'saiu'
  pontos: number
  jogos: number
}

export interface EstadoCarreira {
  /** Época dos objetivos atuais. */
  ano: number
  clubeId: number
  objetivos: Objetivos
  /** 0 a 100. */
  confianca: number
  /** Reputação do treinador, 0 a 100. */
  reputacao: number
  /** Última jornada (1-based) já avaliada pela direção. */
  jornada: number
  /** A época atual já foi avaliada (fim de época). */
  avaliada?: boolean
  ofertas: Oferta[]
  /** Fui despedido e tenho de escolher clube. */
  despedido?: { ofertas: Oferta[]; motivo: string }
  /** Avaliação da última época que acabou (para mostrar no fim da época). */
  ultimaAvaliacao?: { ano: number; texto: string; avaliacao: Avaliacao; confianca: number }
  /** Aviso da direção ("ultimato") já dado nesta época. */
  avisado?: boolean
  historico: EntradaCarreira[]
  /** Mensagens da direção, mais recente no fim. */
  mensagens: { ano: number; jornada: number; texto: string }[]
}

export type JogoComCarreira = Jogo & { carreira?: EstadoCarreira; mercado?: EstadoMercado }

/** Abaixo disto, a partir da jornada LIMITE_JORNADA, a direção despede. */
export const LIMIAR_DESPEDIMENTO = 15
export const LIMIAR_AVISO = 30
const JORNADA_MIN_DESPEDIR = 8
const CONFIANCA_INICIAL = 55

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

function semente(...xs: number[]): number {
  let h = 0x9e3779b1
  for (const x of xs) h = Math.imul(h ^ (x >>> 0), 0x85ebca6b) ^ (h >>> 13)
  return (h >>> 0) || 1
}

const nomeDiv = (n: number) => NOMES_DIVISAO[n - 1] ?? `${n}.ª Divisão`

export function textoObjetivo(o: Pick<Objetivos, 'tipo' | 'alvo' | 'divisao'>): string {
  switch (o.tipo) {
    case 'titulo': return 'Lutar pelo título (2 primeiros)'
    case 'subida': return `Subir de divisão (${o.alvo} primeiros)`
    case 'europa': return `Ficar nos ${o.alvo} primeiros`
    case 'metade': return `Ficar na primeira metade (até ${o.alvo}.º)`
    case 'meio': return `Meio da tabela (até ${o.alvo}.º)`
    case 'manutencao': return o.divisao === 4 ? `Não ficar nos últimos (até ${o.alvo}.º)` : `Evitar a descida (até ${o.alvo}.º)`
  }
}

function rank<T>(lista: T[], valor: (x: T) => number, alvo: T): number {
  const ord = [...lista].sort((a, b) => valor(b) - valor(a))
  return ord.indexOf(alvo) + 1
}

/** Lugar que a direção espera: 50% força do onze, 30% massa salarial, 20% reputação (ranking na divisão). */
export function lugarEsperado(mundo: Mundo, clubeId: number): number {
  const c = mundo.clubes[clubeId]
  const div = mundo.divisoes.find((d) => d.numero === c.divisao)!
  const ids = div.clubes
  const forca = (id: number) => forcaClube(mundo, id)
  const massa = (id: number) => mundo.clubes[id].plantel.reduce((s, j) => s + (mundo.jogadores[j]?.salario ?? 0), 0)
  const rep = (id: number) => mundo.clubes[id].reputacao
  const r = 0.5 * rank(ids, forca, clubeId) + 0.3 * rank(ids, massa, clubeId) + 0.2 * rank(ids, rep, clubeId)
  return clamp(Math.round(r), 1, ids.length)
}

export function definirObjetivos(mundo: Mundo, clubeId: number): Objetivos {
  const c = mundo.clubes[clubeId]
  const n = mundo.divisoes.find((d) => d.numero === c.divisao)!.clubes.length
  const esperado = lugarEsperado(mundo, clubeId)
  let tipo: TipoObjetivo
  let alvo: number
  if (esperado <= 2) { tipo = 'titulo'; alvo = 2 }
  else if (esperado <= 5) { tipo = c.divisao === 1 ? 'europa' : 'subida'; alvo = c.divisao === 1 ? 5 : 3 }
  else if (esperado <= 9) { tipo = 'metade'; alvo = 9 }
  else if (esperado <= 13) { tipo = 'meio'; alvo = 12 }
  else { tipo = 'manutencao'; alvo = n - 3 }
  // Orçamento: quem tem folga não pode perder mais de metade; quem começa a zeros não pode ficar no vermelho;
  // quem já deve não pode afundar mais de uma época de receitas fixas.
  const fixa = (RECEITA_FIXA[c.divisao - 1] ?? 5_000) * 34
  const d = c.dinheiro
  const dinheiroMin = d > fixa ? Math.round(d * 0.5) : d >= 0 ? 0 : Math.round(d - fixa * 0.5)
  return { divisao: c.divisao, tipo, alvo, esperado, dinheiroMin, dinheiroInicio: d }
}

function arredonda(v: number): number {
  if (Math.abs(v) >= 100_000) return Math.round(v / 10_000) * 10_000
  return Math.round(v / 1_000) * 1_000
}

/** Estado da carreira (cria-o num jogo novo ou antigo). */
export function estadoCarreira(jogo: JogoComCarreira): EstadoCarreira {
  if (!jogo.carreira) {
    const c = jogo.mundo.clubes[jogo.clubeId]
    jogo.carreira = {
      ano: jogo.epoca.ano,
      clubeId: jogo.clubeId,
      objetivos: definirObjetivos(jogo.mundo, jogo.clubeId),
      confianca: CONFIANCA_INICIAL,
      reputacao: clamp(c.reputacao - 5, 5, 90),
      jornada: jogo.epoca.jornada - 1,
      ofertas: [],
      historico: [novaEntrada(jogo, jogo.epoca.jornada)],
      mensagens: [],
    }
    jogo.carreira.objetivos.dinheiroMin = arredonda(jogo.carreira.objetivos.dinheiroMin)
  }
  return jogo.carreira
}

function novaEntrada(jogo: JogoComCarreira, de: number): EntradaCarreira {
  const c = jogo.mundo.clubes[jogo.clubeId]
  const o = jogo.carreira?.objetivos
  return {
    ano: jogo.epoca.ano, clubeId: c.id, clubeNome: c.nome, divisao: c.divisao,
    objetivo: o ? textoObjetivo(o) : '', de, ate: de - 1, pontos: 0, jogos: 0,
  }
}

function entradaAtual(st: EstadoCarreira): EntradaCarreira {
  return st.historico[st.historico.length - 1]
}

/** Início de época (chamar depois de prepararEpoca): objetivos novos e confiança a meio caminho de 55. */
export function iniciarEpocaDirecao(jogo: JogoComCarreira): void {
  const st = estadoCarreira(jogo)
  if (st.ano === jogo.epoca.ano && st.clubeId === jogo.clubeId) {
    if (!entradaAtual(st).objetivo) entradaAtual(st).objetivo = textoObjetivo(st.objetivos)
    return
  }
  st.ano = jogo.epoca.ano
  st.clubeId = jogo.clubeId
  st.objetivos = definirObjetivos(jogo.mundo, jogo.clubeId)
  st.objetivos.dinheiroMin = arredonda(st.objetivos.dinheiroMin)
  st.confianca = Math.round(st.confianca * 0.5 + CONFIANCA_INICIAL * 0.5)
  st.jornada = jogo.epoca.jornada - 1
  st.avaliada = false
  st.avisado = false
  // Ofertas do fim da época valem até à 1.ª jornada; as da época anterior que já não valem saem.
  st.ofertas = st.ofertas.filter((o) => o.ano === jogo.epoca.ano)
  st.historico.push(novaEntrada(jogo, jogo.epoca.jornada))
  st.historico = st.historico.slice(-60)
}

/** Pontos que a direção espera de um jogo, pela diferença de força (casa conta um pouco). */
export function pontosEsperados(minha: number, deles: number, emCasa: boolean): number {
  return clamp(1.35 + 0.07 * (minha - deles) + (emCasa ? 0.15 : -0.15), 0.25, 2.5)
}

function dizer(st: EstadoCarreira, ano: number, jornada: number, texto: string) {
  st.mensagens.push({ ano, jornada, texto })
  st.mensagens = st.mensagens.slice(-12)
}

/**
 * Avança a direção até à jornada atual: confiança jogo a jogo, aviso, despedimento, ofertas a meio da época
 * e, quando a época acaba (antes de fecharEpoca), a avaliação final. Idempotente.
 */
export function avancarDirecao(jogo: JogoComCarreira): void {
  const st = estadoCarreira(jogo)
  if (st.despedido) return
  const { mundo, epoca } = jogo
  const div = mundo.clubes[jogo.clubeId].divisao
  while (st.jornada < epoca.jornada - 1 && !st.despedido) {
    st.jornada += 1
    const jn = st.jornada
    const p = epoca.calendario[div - 1]?.[jn - 1]?.find((x) => x.casaId === jogo.clubeId || x.foraId === jogo.clubeId)
    if (!p?.jogada) continue
    const casa = p.casaId === jogo.clubeId
    const [gm, gs] = casa ? p.golos : [p.golos[1], p.golos[0]]
    const pts = gm > gs ? 3 : gm === gs ? 1 : 0
    const outro = casa ? p.foraId : p.casaId
    const esp = pontosEsperados(forcaClube(mundo, jogo.clubeId), forcaClube(mundo, outro), casa)
    let delta = (pts - esp) * 2.2 + clamp(gm - gs, -3, 3) * 0.3 + (50 - st.confianca) * 0.02
    // A partir da 6.ª jornada conta também a posição na tabela em relação ao objetivo.
    if (jn >= 6) {
      const pos = tabela(mundo, epoca, div).findIndex((l) => l.clubeId === jogo.clubeId) + 1
      const folga = st.objetivos.alvo - pos
      delta += folga >= 0 ? 0.5 : folga >= -3 ? -0.3 : -1.2
    }
    if (mundo.clubes[jogo.clubeId].dinheiro < st.objetivos.dinheiroMin) delta -= 0.8
    st.confianca = clamp(Math.round((st.confianca + delta) * 10) / 10, 0, 100)
    const e = entradaAtual(st)
    e.ate = jn
    e.jogos += 1
    e.pontos += pts

    if (!st.avisado && jn >= JORNADA_MIN_DESPEDIR - 3 && st.confianca < LIMIAR_AVISO) {
      st.avisado = true
      dizer(st, epoca.ano, jn, 'A direção está preocupada com os resultados. Ou a equipa reage, ou o lugar fica em risco.')
    }
    if (jn >= JORNADA_MIN_DESPEDIR && jn <= epoca.totalJornadas - 2 && st.confianca < LIMIAR_DESPEDIMENTO) {
      despedir(jogo, st, 'A direção perdeu a confiança no teu trabalho e decidiu despedir-te.')
      return
    }
    // A meio da época, um treinador com bom nome pode ser desafiado por clubes maiores.
    if (jn === 17 && st.confianca >= 65) gerarOfertas(jogo, st, jn + 1, semente(mundo.semente, epoca.ano, 17))
  }
  if (!st.despedido && epocaTerminada(epoca) && !st.avaliada) avaliarEpoca(jogo, st)
}

function avaliarEpoca(jogo: JogoComCarreira, st: EstadoCarreira): void {
  const { mundo, epoca } = jogo
  st.avaliada = true
  const meu = mundo.clubes[jogo.clubeId]
  const div = meu.divisao
  const t = tabela(mundo, epoca, div)
  const pos = t.findIndex((l) => l.clubeId === jogo.clubeId) + 1
  const n = t.length
  const o = st.objetivos
  const campeao = pos === 1
  const subiu = div > 1 && pos <= 3
  const desceu = div < 4 && pos > n - 3
  let av: Avaliacao = pos <= o.alvo - 3 || (campeao && o.tipo !== 'titulo') ? 'superado' : pos <= o.alvo ? 'cumprido' : pos <= o.alvo + 3 ? 'quase' : 'falhado'
  if (campeao && o.tipo === 'titulo') av = 'superado'
  const dinheiroOk = meu.dinheiro >= o.dinheiroMin

  const bonus = { superado: 18, cumprido: 10, quase: -6, falhado: -22 }[av] + (dinheiroOk ? 3 : -10) + (subiu ? 6 : 0) + (desceu && o.tipo !== 'manutencao' ? -12 : 0)
  st.confianca = clamp(Math.round(st.confianca + bonus), 0, 100)
  const repDelta = { superado: 6, cumprido: 3, quase: -1, falhado: -5 }[av] + (campeao ? 4 : 0) + (subiu ? 3 : 0) + (desceu ? -3 : 0) + Math.max(0, 4 - div)
  st.reputacao = clamp(st.reputacao + repDelta, 1, 100)

  const e = entradaAtual(st)
  Object.assign(e, { posicao: pos, avaliacao: av, campeao, subiu, desceu })

  // A reputação dos clubes acompanha os resultados (devagar).
  reputacaoDosClubes(mundo, epoca)

  const txt = {
    superado: 'A direção está encantada: objetivo superado.',
    cumprido: 'Objetivo cumprido. A direção está satisfeita.',
    quase: 'Ficaste perto do objetivo. A direção espera mais na próxima época.',
    falhado: 'Objetivo falhado. A direção está muito descontente.',
  }[av] + (dinheiroOk ? '' : ' E as contas ficaram abaixo do que foi pedido.')
  st.ultimaAvaliacao = { ano: epoca.ano, texto: txt, avaliacao: av, confianca: st.confianca }
  dizer(st, epoca.ano, epoca.totalJornadas, txt)

  if (st.confianca < 35 && (av === 'falhado' || (av === 'quase' && !dinheiroOk))) {
    despedir(jogo, st, `${txt} Decidiu não continuar contigo.`)
    return
  }
  // Ofertas de verão: valem até à 1.ª jornada da época seguinte.
  gerarOfertas(jogo, st, 1, semente(mundo.semente, epoca.ano, 99), epoca.ano + 1)
}

/** Campeões e quem sobe ganha reputação; quem desce perde (devagar, entre 5 e 100). */
function reputacaoDosClubes(mundo: Mundo, epoca: Jogo['epoca']): void {
  for (const d of mundo.divisoes) {
    const t = tabela(mundo, epoca, d.numero)
    const n = t.length
    t.forEach((l, i) => {
      const c = mundo.clubes[l.clubeId]
      if (!c) return
      let dr = 0
      if (i === 0) dr += 2
      if (d.numero > 1 && i < 3) dr += 2
      if (d.numero < 4 && i >= n - 3) dr -= 2
      c.reputacao = clamp(c.reputacao + dr, 5, 100)
    })
  }
}

function despedir(jogo: JogoComCarreira, st: EstadoCarreira, motivo: string) {
  const { mundo, epoca } = jogo
  const e = entradaAtual(st)
  e.saida = 'despedido'
  st.reputacao = clamp(st.reputacao - 6, 1, 100)
  dizer(st, epoca.ano, st.jornada, motivo)
  const ofertas = ofertasDesempregado(jogo, st, semente(mundo.semente, epoca.ano, st.jornada, 0xd35))
  st.ofertas = []
  st.despedido = { ofertas, motivo }
}

/** Clubes que contratam um treinador despedido: mais pequenos, a correr mal; há sempre pelo menos um. */
function ofertasDesempregado(jogo: JogoComCarreira, st: EstadoCarreira, s: number): Oferta[] {
  const { mundo, epoca } = jogo
  const rng = createRng(s)
  const ate = epocaTerminada(epoca) ? 999 : epoca.jornada
  const ano = epoca.ano
  const cands = Object.values(mundo.clubes)
    .filter((c) => c.id !== jogo.clubeId && c.reputacao <= st.reputacao + 6 && c.reputacao >= st.reputacao - 30)
    .map((c) => ({ c, peso: aflicao(mundo, epoca, c.id) + rng.next() }))
    .sort((a, b) => b.peso - a.peso)
    .slice(0, 3)
  let lista = cands.map(({ c }) => ({ clubeId: c.id, ate, ano, motivo: motivoDe(mundo, epoca, c.id) }))
  if (!lista.length) {
    const d4 = [...mundo.divisoes[mundo.divisoes.length - 1].clubes].filter((id) => id !== jogo.clubeId)
      .sort((a, b) => mundo.clubes[a].reputacao - mundo.clubes[b].reputacao)
    lista = d4.slice(0, 2).map((id) => ({ clubeId: id, ate, ano, motivo: 'Procura um treinador para recomeçar o projeto.' }))
  }
  return lista
}

/** Quanto um clube está pior do que esperava (0 = bem, mais = pior). */
function aflicao(mundo: Mundo, epoca: Jogo['epoca'], clubeId: number): number {
  const c = mundo.clubes[clubeId]
  if (epoca.jornada <= 2 || epocaTerminada(epoca)) return 0
  const pos = tabela(mundo, epoca, c.divisao).findIndex((l) => l.clubeId === clubeId) + 1
  return Math.max(0, pos - lugarEsperado(mundo, clubeId)) / 4
}

function motivoDe(mundo: Mundo, epoca: Jogo['epoca'], clubeId: number): string {
  const a = aflicao(mundo, epoca, clubeId)
  if (a >= 1.5) return 'Está muito abaixo do esperado e quer mudar de treinador já.'
  if (a > 0.5) return 'Não está contente com a época e procura um treinador novo.'
  return 'Quer um treinador com o teu perfil para a próxima fase do clube.'
}

/** Ofertas de clubes maiores para um treinador com bom nome. */
function gerarOfertas(jogo: JogoComCarreira, st: EstadoCarreira, ate: number, s: number, ano = jogo.epoca.ano) {
  const { mundo, epoca } = jogo
  const rng = createRng(s)
  const meu = mundo.clubes[jogo.clubeId]
  // Só depois de mostrar trabalho: meio da época com confiança alta, ou fim de época cumprido.
  if (st.confianca < 55) return
  const cands = Object.values(mundo.clubes)
    .filter((c) => c.id !== meu.id && c.divisao <= meu.divisao && c.reputacao > meu.reputacao + 2 && c.reputacao <= st.reputacao + 12)
    .map((c) => ({ c, peso: aflicao(mundo, epoca, c.id) + rng.next() * 1.5 }))
    .sort((a, b) => b.peso - a.peso)
  const quantas = Math.min(cands.length, rng.chance(0.35 + (st.reputacao - meu.reputacao) / 60) ? rng.int(1, 2) : 0)
  for (const { c } of cands.slice(0, quantas)) {
    st.ofertas.push({ clubeId: c.id, ate, ano, motivo: motivoDe(mundo, epoca, c.id) })
  }
  if (quantas) dizer(st, epoca.ano, st.jornada, quantas > 1 ? 'Há clubes interessados em ti.' : `O ${cands[0].c.nome} quer contratar-te.`)
}

/** Ofertas ainda válidas (não despedido). */
export function ofertasValidas(jogo: JogoComCarreira): Oferta[] {
  const st = estadoCarreira(jogo)
  if (st.despedido) return st.despedido.ofertas
  return st.ofertas.filter((o) => o.ano === jogo.epoca.ano && jogo.epoca.jornada <= o.ate && o.clubeId !== jogo.clubeId)
}

/** Aceita uma oferta (ou escolhe clube depois de ser despedido): muda de clube já. */
export function aceitarOferta(jogo: JogoComCarreira, clubeId: number): boolean {
  const st = estadoCarreira(jogo)
  const of = ofertasValidas(jogo).find((o) => o.clubeId === clubeId)
  if (!of || !jogo.mundo.clubes[clubeId]) return false
  const e = entradaAtual(st)
  if (!st.despedido) {
    e.saida = 'saiu'
    dizer(st, jogo.epoca.ano, st.jornada, `Saíste do ${jogo.mundo.clubes[jogo.clubeId].nome} para o ${jogo.mundo.clubes[clubeId].nome}.`)
  }
  // Se a entrada da época atual ainda não tem jogos (pré-época), não fica no histórico.
  if (e.jogos === 0 && !e.posicao) st.historico.pop()
  jogo.clubeId = clubeId
  // O que era do clube antigo no mercado deixa de ser meu.
  if (jogo.mercado) {
    jogo.mercado.lista = jogo.mercado.lista.filter((a) => !a.meu)
    jogo.mercado.propostas = []
    jogo.mercado.recusados = []
  }
  jogo.escalacao = escalarAuto(jogo.mundo, clubeId, indisponiveisDe(jogo.mundo, jogo.epoca, clubeId), jogo.escalacao?.formacao)
  st.despedido = undefined
  st.ofertas = []
  // Objetivos do clube novo, confiança de quem chega.
  const terminou = epocaTerminada(jogo.epoca)
  st.clubeId = clubeId
  st.ano = jogo.epoca.ano
  st.objetivos = definirObjetivos(jogo.mundo, clubeId)
  st.objetivos.dinheiroMin = arredonda(st.objetivos.dinheiroMin)
  st.confianca = CONFIANCA_INICIAL
  st.avisado = false
  st.avaliada = terminou
  st.jornada = jogo.epoca.jornada - 1
  st.historico.push(novaEntrada(jogo, jogo.epoca.jornada))
  dizer(st, jogo.epoca.ano, st.jornada, `Bem-vindo ao ${jogo.mundo.clubes[clubeId].nome}. Objetivo: ${textoObjetivo(st.objetivos).toLowerCase()}.`)
  return true
}

export function recusarOferta(jogo: JogoComCarreira, clubeId: number): void {
  const st = estadoCarreira(jogo)
  if (st.despedido) return
  st.ofertas = st.ofertas.filter((o) => o.clubeId !== clubeId)
}

/** Como está a correr a época em relação ao objetivo (para a UI). */
export function situacao(jogo: JogoComCarreira): { posicao: number; texto: string; nivel: 'bem' | 'perto' | 'mal' } {
  const st = estadoCarreira(jogo)
  const div = jogo.mundo.clubes[jogo.clubeId].divisao
  const pos = tabela(jogo.mundo, jogo.epoca, div).findIndex((l) => l.clubeId === jogo.clubeId) + 1
  if (jogo.epoca.jornada <= 1) return { posicao: 0, texto: 'A época ainda não começou.', nivel: 'bem' }
  if (jogo.epoca.jornada <= 6) return { posicao: pos, texto: `${pos}.º lugar: ainda é cedo.`, nivel: 'bem' }
  const folga = st.objetivos.alvo - pos
  if (folga >= 0) return { posicao: pos, texto: `${pos}.º lugar: dentro do objetivo.`, nivel: 'bem' }
  if (folga >= -3) return { posicao: pos, texto: `${pos}.º lugar: perto do objetivo.`, nivel: 'perto' }
  return { posicao: pos, texto: `${pos}.º lugar: longe do objetivo (${st.objetivos.alvo}.º).`, nivel: 'mal' }
}

export function textoConfianca(c: number): string {
  if (c >= 80) return 'Total'
  if (c >= 60) return 'Boa'
  if (c >= 40) return 'Razoável'
  if (c >= LIMIAR_AVISO) return 'Baixa'
  return 'Em risco'
}

export { nomeDiv }
