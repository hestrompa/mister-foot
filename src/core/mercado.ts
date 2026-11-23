// Mercado de transferências: lista de jogadores à venda, compras, vendas, propostas da IA, leilões e janelas.
// Tudo determinístico: cada sorteio usa createRng com uma semente derivada do mundo, da época e da jornada.
import { createRng, type Rng } from './rng'
import { salarioDe } from './mundo'
import { escalarAuto } from './motor'
import { indisponiveisDe } from './epoca'
import type { EstadoEpoca } from './partida'
import type { Jogador, Jogo, Mundo, Posicao } from './types'

/** Jogador à venda. `meu` = anunciado pelo utilizador. */
export interface Anuncio {
  jogadorId: number
  preco: number
  /** Leilão: vende-se automaticamente na jornada seguinte a quem der mais (se chegar à base). */
  leilao?: boolean
  meu?: boolean
}

/** Proposta de um clube da IA por um jogador do utilizador. Vale até à jornada seguinte. */
export interface Proposta {
  id: number
  jogadorId: number
  clubeId: number
  valor: number
  /** true se o jogador não estava à venda. */
  espontanea: boolean
}

export interface Noticia {
  /** Jornada em que aconteceu (próxima a jogar nesse momento). */
  jornada: number
  jogadorId: number
  deId: number
  paraId: number
  valor: number
  leilao?: boolean
}

export interface EstadoMercado {
  ano: number
  /** Jornada (epoca.jornada) até onde o mercado já avançou. */
  jornada: number
  lista: Anuncio[]
  propostas: Proposta[]
  noticias: Noticia[]
  /** Jogadores cujo clube já recusou uma oferta minha nesta jornada (uma tentativa por jornada). */
  recusados: number[]
  proximaProposta: number
}

export type JogoComMercado = Jogo & { mercado?: EstadoMercado }

/** Limites de plantel. */
export const PLANTEL_MIN = 16
export const PLANTEL_MAX = 30
const MIN_POS: Record<Posicao, number> = { GR: 2, DEF: 5, MED: 5, AV: 3 }
/** Quantos titulares de cada posição um clube quer ter bons (para decidir se um jogador interessa). */
const TITULARES: Record<Posicao, number> = { GR: 1, DEF: 4, MED: 4, AV: 2 }
const MAX_NOTICIAS = 40

function mistura(...partes: number[]): number {
  let h = 0x9e3779b9
  for (const p of partes) {
    h = Math.imul(h ^ (p >>> 0), 0x85ebca6b) >>> 0
    h ^= h >>> 13
    h = Math.imul(h, 0xc2b2ae35) >>> 0
    h ^= h >>> 16
  }
  return h >>> 0 || 1
}

function rngDe(mundo: Mundo, ano: number, jornada: number, ...extra: number[]): Rng {
  return createRng(mistura(mundo.semente, ano, jornada, ...extra))
}

function arredonda(v: number): number {
  if (v >= 1_000_000) return Math.round(v / 50_000) * 50_000
  if (v >= 100_000) return Math.round(v / 5_000) * 5_000
  if (v >= 10_000) return Math.round(v / 500) * 500
  return Math.max(50, Math.round(v / 50) * 50)
}

// ---------- Janelas ----------

/** Janela de verão: antes das jornadas 1 a 6. Janela de inverno: antes das jornadas 17 a 20. */
export function janelaAberta(epoca: Pick<EstadoEpoca, 'jornada'>): boolean {
  const j = epoca.jornada
  return j <= 6 || (j >= 17 && j <= 20)
}

/** Texto curto sobre a janela (ex.: "Janela de verão aberta até à jornada 6"). */
export function textoJanela(epoca: Pick<EstadoEpoca, 'jornada' | 'totalJornadas'>): string {
  const j = epoca.jornada
  if (j <= 6) return 'Janela de verão aberta: fecha depois da jornada 6.'
  if (j >= 17 && j <= 20) return 'Janela de inverno aberta: fecha depois da jornada 20.'
  if (j < 17) return `Mercado fechado: a janela de inverno abre na jornada 17 (faltam ${17 - j}).`
  return 'Mercado fechado até ao fim da época: a janela de verão abre na pré-época.'
}

// ---------- Valores e pedidos ----------

/** Preço que o clube pede por um jogador que não está à venda. */
export function precoSemAnuncio(j: Jogador): number {
  // Veteranos fortes valem pouco no papel, mas o clube não os dá: pelo menos 60% do valor de um jogador da mesma força no auge.
  const auge = 2000 * Math.pow(1.12, j.forca - 20)
  return arredonda(Math.max(j.valor, auge * 0.6) * (j.craque ? 2.2 : 1.6))
}

/** Preço de referência (o anunciado, se estiver à venda). */
export function precoPedido(jogo: JogoComMercado, jogadorId: number): number {
  const a = estadoMercado(jogo).lista.find((x) => x.jogadorId === jogadorId)
  return a ? a.preco : precoSemAnuncio(jogo.mundo.jogadores[jogadorId])
}

/** Salário mensal que o jogador pede para assinar pelo clube. */
export function pedidoSalarial(mundo: Mundo, j: Jogador, clubeId: number): number {
  const origem = mundo.clubes[j.clubeId]
  const destino = mundo.clubes[clubeId]
  let base = Math.max(j.salario * 1.15, salarioDe(j.forca, destino.divisao))
  const dif = (origem?.reputacao ?? 0) - destino.reputacao
  if (dif > 0) base *= 1 + dif / 40
  return arredonda(base)
}

/** O jogador aceita mudar-se? Devolve o motivo da recusa, ou null. */
export function recusaDoJogador(mundo: Mundo, j: Jogador, clubeId: number): string | null {
  const origem = mundo.clubes[j.clubeId]
  const destino = mundo.clubes[clubeId]
  if (origem && origem.reputacao - destino.reputacao > 35) return `${j.curto} não quer trocar o ${origem.nome} por um clube tão pequeno.`
  if (origem && destino.divisao - origem.divisao >= 2 && j.idade < 30) return `${j.curto} não quer descer ${destino.divisao - origem.divisao} divisões.`
  return null
}

function contaPos(mundo: Mundo, clubeId: number): Record<Posicao, number> {
  const n: Record<Posicao, number> = { GR: 0, DEF: 0, MED: 0, AV: 0 }
  for (const id of mundo.clubes[clubeId].plantel) n[mundo.jogadores[id].posicao]++
  return n
}

/** O clube pode ficar sem este jogador? Devolve o motivo, ou null. */
export function impedeSaida(mundo: Mundo, j: Jogador): string | null {
  const c = mundo.clubes[j.clubeId]
  if (c.plantel.length <= PLANTEL_MIN) return `O ${c.nome} ficava com menos de ${PLANTEL_MIN} jogadores.`
  if (contaPos(mundo, c.id)[j.posicao] <= MIN_POS[j.posicao]) return `O ${c.nome} ficava com menos de ${MIN_POS[j.posicao]} jogadores na posição ${j.posicao}.`
  return null
}

/** Quanto um jogador melhora um clube: força acima do pior dos titulares da posição (0 se não melhora). */
function ganho(mundo: Mundo, clubeId: number, j: Jogador): number {
  const mesmos = mundo.clubes[clubeId].plantel
    .map((id) => mundo.jogadores[id])
    .filter((x) => x.posicao === j.posicao && x.id !== j.id)
    .sort((a, b) => b.forca - a.forca)
  const n = TITULARES[j.posicao]
  if (mesmos.length < n) return j.forca
  return Math.max(0, j.forca - mesmos[n - 1].forca)
}

// ---------- Estado ----------

/** Estado do mercado do jogo (cria-o, ou recomeça-o numa época nova). */
export function estadoMercado(jogo: JogoComMercado): EstadoMercado {
  const ano = jogo.epoca.ano
  if (!jogo.mercado || jogo.mercado.ano !== ano) {
    const antigas = jogo.mercado?.noticias ?? []
    jogo.mercado = { ano, jornada: jogo.epoca.jornada, lista: [], propostas: [], noticias: antigas.slice(-10), recusados: [], proximaProposta: 1 }
    renovarLista(jogo, rngDe(jogo.mundo, ano, 0, 0x115a))
  }
  return jogo.mercado
}

/** Jogadores da IA à venda (sem os meus). */
export function listaIA(jogo: JogoComMercado): Anuncio[] {
  return estadoMercado(jogo).lista.filter((a) => !a.meu && jogo.mundo.jogadores[a.jogadorId]?.clubeId !== jogo.clubeId)
}

/** Acrescenta à lista jogadores dispensáveis dos clubes da IA até ~3 por clube no total. */
function renovarLista(jogo: JogoComMercado, rng: Rng) {
  const st = jogo.mercado!
  const { mundo } = jogo
  const naLista = new Set(st.lista.map((a) => a.jogadorId))
  const ids = Object.keys(mundo.clubes).map(Number).sort((a, b) => a - b)
  for (const cid of ids) {
    if (cid === jogo.clubeId) continue
    const c = mundo.clubes[cid]
    const ja = c.plantel.filter((id) => naLista.has(id)).length
    const alvo = rng.int(1, 3)
    if (ja >= alvo) continue
    // Candidatos: excedentes da posição, veteranos, ou suplentes fracos. Nunca o craque.
    const cands = c.plantel
      .map((id) => mundo.jogadores[id])
      .filter((j) => !j.craque && !naLista.has(j.id) && !impedeSaida(mundo, j))
    if (!cands.length) continue
    const peso = (j: Jogador) => {
      const pos = contaPos(mundo, cid)[j.posicao] - MIN_POS[j.posicao]
      return 1 + pos * 0.5 + (j.idade >= 31 ? 2 : 0) + (ganho(mundo, cid, j) === 0 ? 1.5 : 0)
    }
    for (let k = ja; k < alvo && cands.length; k++) {
      const total = cands.reduce((s, j) => s + peso(j), 0)
      let r = rng.next() * total
      let i = 0
      while (i < cands.length - 1 && (r -= peso(cands[i])) > 0) i++
      const j = cands.splice(i, 1)[0]
      st.lista.push({ jogadorId: j.id, preco: arredonda(j.valor * (0.9 + rng.next() * 0.35)) })
      naLista.add(j.id)
    }
  }
}

// ---------- Transferência ----------

/** Notícias novas desde o início do avancarMercado em curso. */
let coletor: Noticia[] | null = null

function noticiar(st: EstadoMercado, n: Noticia) {
  st.noticias.push(n)
  if (st.noticias.length > MAX_NOTICIAS) st.noticias.splice(0, st.noticias.length - MAX_NOTICIAS)
  coletor?.push(n)
}

function transferir(jogo: JogoComMercado, jogadorId: number, paraId: number, valor: number, salario: number, contrato: number, leilao = false) {
  const { mundo } = jogo
  const st = estadoMercado(jogo)
  const j = mundo.jogadores[jogadorId]
  const de = mundo.clubes[j.clubeId]
  const para = mundo.clubes[paraId]
  de.plantel = de.plantel.filter((id) => id !== jogadorId)
  para.plantel.push(jogadorId)
  de.dinheiro += valor
  para.dinheiro -= valor
  noticiar(st, { jornada: jogo.epoca.jornada, jogadorId, deId: de.id, paraId, valor, leilao })
  j.clubeId = paraId
  j.salario = salario
  j.contrato = contrato
  st.lista = st.lista.filter((a) => a.jogadorId !== jogadorId)
  st.propostas = st.propostas.filter((p) => p.jogadorId !== jogadorId)
  // O craque de cada clube é o melhor do plantel.
  for (const c of [de, para]) {
    const ordem = c.plantel.map((id) => mundo.jogadores[id]).sort((a, b) => b.forca - a.forca)
    for (const x of ordem) x.craque = false
    if (ordem.length > 1 && ordem[0].forca - ordem[1].forca >= 2) ordem[0].craque = true
  }
  if (de.id === jogo.clubeId || para.id === jogo.clubeId) corrigirEscalacao(jogo)
}

/** Se algum jogador da minha escalação saiu do clube, refaz o onze mantendo formação e postura. */
function corrigirEscalacao(jogo: JogoComMercado) {
  const plantel = new Set(jogo.mundo.clubes[jogo.clubeId].plantel)
  const esc = jogo.escalacao
  if (!esc) return
  if (esc.titulares.every((id) => plantel.has(id))) {
    esc.suplentes = esc.suplentes.filter((id) => plantel.has(id))
    return
  }
  const nova = escalarAuto(jogo.mundo, jogo.clubeId, indisponiveisDe(jogo.mundo, jogo.epoca, jogo.clubeId), esc.formacao)
  jogo.escalacao = { ...nova, postura: esc.postura }
}

export interface Resultado { ok: boolean; texto: string }

/** Mínimo que o clube vendedor aceita nesta jornada (escondido do utilizador). */
function minimoAceite(jogo: JogoComMercado, j: Jogador): number {
  const rng = rngDe(jogo.mundo, jogo.epoca.ano, jogo.epoca.jornada, j.id, 0xc0)
  const anunciado = estadoMercado(jogo).lista.find((a) => a.jogadorId === j.id)
  return anunciado ? anunciado.preco * (0.82 + rng.next() * 0.18) : precoSemAnuncio(j) * (0.85 + rng.next() * 0.25)
}

/** Fazer uma oferta por um jogador de outro clube. Se clube e jogador aceitarem, a transferência é imediata. */
export function comprar(jogo: JogoComMercado, jogadorId: number, oferta: number, salario: number): Resultado {
  const { mundo } = jogo
  const st = estadoMercado(jogo)
  const j = mundo.jogadores[jogadorId]
  const meu = mundo.clubes[jogo.clubeId]
  if (!j || j.clubeId === jogo.clubeId) return { ok: false, texto: 'Esse jogador já é teu.' }
  if (!janelaAberta(jogo.epoca)) return { ok: false, texto: 'O mercado está fechado.' }
  if (meu.plantel.length >= PLANTEL_MAX) return { ok: false, texto: `O plantel já tem ${PLANTEL_MAX} jogadores. Vende alguém primeiro.` }
  if (oferta > meu.dinheiro) return { ok: false, texto: 'Não tens dinheiro para essa oferta.' }
  if (st.recusados.includes(jogadorId)) return { ok: false, texto: 'O clube já recusou uma oferta tua nesta jornada. Tenta na próxima.' }
  const saida = impedeSaida(mundo, j)
  if (saida) return { ok: false, texto: `${saida} Não vende.` }
  const recusa = recusaDoJogador(mundo, j, jogo.clubeId)
  if (recusa) return { ok: false, texto: recusa }
  const pede = pedidoSalarial(mundo, j, jogo.clubeId)
  if (salario < pede) return { ok: false, texto: `${j.curto} quer ganhar pelo menos ${pede.toLocaleString('pt-PT')} € por mês.` }
  const de = mundo.clubes[j.clubeId]
  if (oferta < minimoAceite(jogo, j)) {
    st.recusados.push(jogadorId)
    return { ok: false, texto: `O ${de.nome} recusou. Querem mais dinheiro.` }
  }
  transferir(jogo, jogadorId, jogo.clubeId, oferta, salario, 3)
  return { ok: true, texto: `${j.nome} é jogador do ${meu.nome}!` }
}

/** Pôr um jogador meu à venda (ou em leilão, com preço base). */
export function porAVenda(jogo: JogoComMercado, jogadorId: number, preco: number, leilao = false): Resultado {
  const st = estadoMercado(jogo)
  const j = jogo.mundo.jogadores[jogadorId]
  if (!j || j.clubeId !== jogo.clubeId) return { ok: false, texto: 'Esse jogador não é teu.' }
  const saida = impedeSaida(jogo.mundo, j)
  if (saida) return { ok: false, texto: saida.replace(/^O .+? ficava/, 'Ficavas') }
  st.lista = st.lista.filter((a) => a.jogadorId !== jogadorId)
  st.lista.push({ jogadorId, preco: Math.max(50, Math.round(preco)), leilao, meu: true })
  return { ok: true, texto: leilao ? `${j.curto} vai a leilão na próxima jornada.` : `${j.curto} está à venda.` }
}

export function retirarDaVenda(jogo: JogoComMercado, jogadorId: number): void {
  const st = estadoMercado(jogo)
  st.lista = st.lista.filter((a) => a.jogadorId !== jogadorId)
}

export function aceitarProposta(jogo: JogoComMercado, propostaId: number): Resultado {
  const st = estadoMercado(jogo)
  const p = st.propostas.find((x) => x.id === propostaId)
  if (!p) return { ok: false, texto: 'A proposta já não existe.' }
  const j = jogo.mundo.jogadores[p.jogadorId]
  const c = jogo.mundo.clubes[p.clubeId]
  if (j.clubeId !== jogo.clubeId) { recusarProposta(jogo, propostaId); return { ok: false, texto: 'Esse jogador já não é teu.' } }
  const saida = impedeSaida(jogo.mundo, j)
  if (saida) return { ok: false, texto: saida.replace(/^O .+? ficava/, 'Ficavas') }
  if (c.dinheiro < p.valor) { recusarProposta(jogo, propostaId); return { ok: false, texto: `O ${c.nome} já não tem dinheiro.` } }
  transferir(jogo, j.id, c.id, p.valor, Math.max(j.salario, salarioDe(j.forca, c.divisao)), 3)
  return { ok: true, texto: `${j.nome} foi vendido ao ${c.nome}.` }
}

export function recusarProposta(jogo: JogoComMercado, propostaId: number): void {
  const st = estadoMercado(jogo)
  st.propostas = st.propostas.filter((x) => x.id !== propostaId)
}

// ---------- IA ----------

/** Clubes da IA interessados num jogador, com quanto pagariam. */
function interessados(jogo: JogoComMercado, j: Jogador, base: number, rng: Rng): { clubeId: number; valor: number }[] {
  const { mundo } = jogo
  const out: { clubeId: number; valor: number }[] = []
  const origem = mundo.clubes[j.clubeId]
  for (const d of mundo.divisoes) {
    // Só clubes da mesma divisão ou próximas.
    if (Math.abs(d.numero - origem.divisao) > 1) continue
    for (const cid of d.clubes) {
      if (cid === jogo.clubeId || cid === j.clubeId) continue
      const c = mundo.clubes[cid]
      if (c.plantel.length >= PLANTEL_MAX - 2) continue
      const g = ganho(mundo, cid, j)
      if (g <= 0) continue
      if (recusaDoJogador(mundo, j, cid)) continue
      const valor = arredonda(base * (0.8 + rng.next() * 0.3 + Math.min(0.3, g / 30)))
      if (c.dinheiro < valor * 1.3) continue
      out.push({ clubeId: cid, valor })
    }
  }
  return out.sort((a, b) => b.valor - a.valor)
}

/** Dinheiro que um clube da IA guarda de reserva, por divisão. */
const RESERVA = [1_500_000, 300_000, 80_000, 30_000]

function comprasAtivas(jogo: JogoComMercado, rng: Rng, quantas: number) {
  const { mundo } = jogo
  const ricos = Object.values(mundo.clubes)
    .filter((c) => c.id !== jogo.clubeId && c.plantel.length < PLANTEL_MAX - 2 && c.dinheiro > (RESERVA[c.divisao - 1] ?? 0) * 1.5)
    .sort((a, b) => a.id - b.id)
  for (let k = 0; k < quantas && ricos.length; k++) {
    // Mais dinheiro (face à reserva da divisão), mais hipóteses de ir às compras.
    const pesos = ricos.map((c) => c.dinheiro / (RESERVA[c.divisao - 1] ?? 1))
    let r = rng.next() * pesos.reduce((s, p) => s + p, 0)
    let i = 0
    while (i < ricos.length - 1 && (r -= pesos[i]) > 0) i++
    const c = ricos.splice(i, 1)[0]
    const orcamento = c.dinheiro - (RESERVA[c.divisao - 1] ?? 0)
    let melhor: { j: Jogador; preco: number; g: number } | null = null
    for (const d of mundo.divisoes) {
      if (d.numero < c.divisao || d.numero > c.divisao + 1) continue
      for (const cid of d.clubes) {
        if (cid === c.id || cid === jogo.clubeId) continue
        for (const id of mundo.clubes[cid].plantel) {
          const j = mundo.jogadores[id]
          const g = ganho(mundo, c.id, j)
          if (g < 2) continue
          const preco = precoSemAnuncio(j)
          if (preco > orcamento) continue
          // Prefere quem mais melhora a equipa, depois o mais jovem.
          const nota = g - j.idade * 0.05
          if (!melhor || nota > melhor.g) melhor = { j, preco, g: nota }
        }
      }
    }
    if (!melhor || impedeSaida(mundo, melhor.j) || recusaDoJogador(mundo, melhor.j, c.id)) continue
    const j = melhor.j
    transferir(jogo, j.id, c.id, melhor.preco, Math.max(j.salario, salarioDe(j.forca, c.divisao)), rng.int(2, 4))
  }
}

/**
 * Avança o mercado até à jornada atual da época: leilões, propostas da IA aos meus jogadores,
 * transferências entre clubes da IA e lista renovada. Chamar depois de cada jornada (é idempotente).
 * Devolve as notícias novas.
 */
export function avancarMercado(jogo: JogoComMercado): Noticia[] {
  const st = estadoMercado(jogo)
  const novas: Noticia[] = []
  coletor = novas
  try {
    while (st.jornada < jogo.epoca.jornada) {
      st.jornada += 1
      passoMercado(jogo, st.jornada)
    }
  } finally {
    coletor = null
  }
  return novas
}

function passoMercado(jogo: JogoComMercado, jornada: number) {
  const { mundo } = jogo
  const st = jogo.mercado!
  const rng = rngDe(mundo, st.ano, jornada, 0x3e7)
  // Propostas da jornada anterior caducam; recusas também.
  st.propostas = []
  st.recusados = []
  if (!janelaAberta({ jornada })) {
    // Fora da janela, os leilões pendentes esperam e a lista mantém-se.
    return
  }

  // 1. Meus jogadores à venda: leilões resolvem-se; anúncios normais recebem propostas.
  for (const a of st.lista.filter((x) => x.meu)) {
    const j = mundo.jogadores[a.jogadorId]
    if (!j || j.clubeId !== jogo.clubeId) continue
    if (impedeSaida(mundo, j)) continue
    const ofertas = interessados(jogo, j, Math.max(a.preco, j.valor * 0.7), rng)
    if (a.leilao) {
      const lances = ofertas.slice(0, 5)
      if (lances.length && lances[0].valor >= a.preco) {
        // O vencedor paga um pouco acima do segundo lance (ou a base).
        const segundo = lances[1]?.valor ?? a.preco
        const valor = Math.min(lances[0].valor, arredonda(Math.max(a.preco, segundo * 1.05)))
        const c = mundo.clubes[lances[0].clubeId]
        transferir(jogo, j.id, c.id, valor, Math.max(j.salario, salarioDe(j.forca, c.divisao)), 3, true)
      } else {
        st.lista = st.lista.filter((x) => x.jogadorId !== j.id)
        noticiar(st, { jornada, jogadorId: j.id, deId: jogo.clubeId, paraId: jogo.clubeId, valor: 0, leilao: true })
      }
      continue
    }
    for (const o of ofertas.slice(0, rng.int(0, 2))) {
      if (o.valor < a.preco * 0.75) continue
      st.propostas.push({ id: st.proximaProposta++, jogadorId: j.id, clubeId: o.clubeId, valor: o.valor, espontanea: false })
    }
  }

  // 2. Propostas espontâneas pelos meus melhores jogadores.
  for (let k = rng.chance(0.7) ? rng.int(1, 2) : 0; k > 0; k--) {
    const meus = mundo.clubes[jogo.clubeId].plantel
      .map((id) => mundo.jogadores[id])
      .filter((j) => !st.lista.some((a) => a.jogadorId === j.id) && !st.propostas.some((p) => p.jogadorId === j.id) && !impedeSaida(mundo, j))
      .sort((a, b) => b.forca - a.forca)
      .slice(0, 8)
    if (meus.length) {
      const j = rng.pick(meus)
      const o = interessados(jogo, j, j.valor * 1.2, rng)[0]
      if (o) st.propostas.push({ id: st.proximaProposta++, jogadorId: j.id, clubeId: o.clubeId, valor: o.valor, espontanea: true })
    }
  }

  // 3. Transferências entre clubes da IA, a partir da lista.
  const daIA = rng.shuffle(st.lista.filter((a) => !a.meu))
  let feitas = 0
  const alvo = rng.int(3, 7)
  for (const a of daIA) {
    if (feitas >= alvo) break
    const j = mundo.jogadores[a.jogadorId]
    if (!j || j.clubeId === jogo.clubeId || impedeSaida(mundo, j)) continue
    const o = interessados(jogo, j, a.preco, rng).find((x) => x.valor >= a.preco * 0.9)
    if (!o || !rng.chance(0.5)) continue
    const c = mundo.clubes[o.clubeId]
    transferir(jogo, j.id, c.id, Math.min(o.valor, a.preco), Math.max(j.salario, salarioDe(j.forca, c.divisao)), rng.int(2, 4))
    feitas++
  }

  // 3b. Clubes com dinheiro vão às compras: o melhor reforço que conseguem pagar, mesmo que não esteja à venda.
  comprasAtivas(jogo, rng, rng.int(3, 7))

  // 4. Anúncios antigos saem às vezes; entram novos.
  st.lista = st.lista.filter((a) => a.meu || rng.chance(0.85))
  renovarLista(jogo, rng)
}
