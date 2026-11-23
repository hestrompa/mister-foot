// Taça Nacional: eliminatórias a uma mão com os 72 clubes, jogadas a meio da semana entre jornadas da liga.
// Empate no fim dos 90 minutos dá prolongamento (30 minutos) e, se persistir, penáltis. O clube da divisão mais baixa joga em casa; a final é em campo neutro.
import type { Jogo, Mundo } from './types'
import type { Escalacao, EstatJogo, EventoJogo, Partida } from './partida'
import { createRng, type Rng } from './rng'
import { avancarMinuto, iniciarJogo, type EstadoJogo } from './motor'
import { escalarIA } from './tatica'
import { publicoEsperado } from './financas'

export const NOME_TACA = 'Taça Nacional'

/** Só há taça numa época se ela for criada até esta jornada (gravações antigas a meio da época esperam pela seguinte). */
const ULTIMA_JORNADA_PARA_COMECAR = 3

export interface RondaTaca {
  nome: string
  /** Joga-se depois desta jornada da liga. */
  aposJornada: number
  jogos: Partida[]
  /** Clubes que só entram na ronda seguinte. */
  isentos: number[]
  jogada: boolean
}

export interface NoticiaTaca {
  ronda: number
  texto: string
  /** Diz respeito ao clube do utilizador. */
  minha?: boolean
}

export interface HistoricoTaca {
  ano: number
  vencedorId: number
  finalistaId: number
  /** Ex.: "2-1" ou "1-1 (4-3 g.p.)", com o vencedor primeiro. */
  resultado: string
}

export interface EstadoTaca {
  ano: number
  /** Época sem taça (gravação antiga carregada a meio da época). */
  semTaca?: boolean
  rondas: RondaTaca[]
  /** Índice da próxima ronda por jogar (= rondas.length quando acabou). */
  atual: number
  /** Ronda em que cada clube foi eliminado (índice); o vencedor não aparece. */
  eliminados: Record<number, number>
  /** Jogos de castigo na taça (vermelho = falha o próximo jogo da taça). */
  castigos: Record<number, number>
  marcadores: Record<number, number>
  /** Prémios e bilheteira ganhos na taça, por clube. */
  receitas: Record<number, number>
  noticias: NoticiaTaca[]
  historico: HistoricoTaca[]
}

export type JogoComTaca = Jogo & { taca?: EstadoTaca }

/** Prémio por passar cada ronda, contado a partir da final (0 = ganhar a final, 1 = meias, ...). */
const PREMIOS = [1_000_000, 400_000, 200_000, 100_000, 50_000, 25_000, 10_000]

/** Prémio para quem passa a ronda `r` da taça. */
export function premioRonda(t: Pick<EstadoTaca, 'rondas'>, r: number): number {
  return PREMIOS[Math.min(PREMIOS.length - 1, t.rondas.length - 1 - r)]
}
/** O finalista vencido também leva um prémio. */
export const PREMIO_FINALISTA = 400_000

function mistura(...partes: number[]): number {
  let h = 0x9e3779b9
  for (const p of partes) {
    h = Math.imul(h ^ (p >>> 0), 0x85ebca6b) >>> 0
    h ^= h >>> 13
    h = Math.imul(h, 0xc2b2ae35) >>> 0
    h ^= h >>> 16
  }
  return h >>> 0
}

function nomeRonda(clubes: number, preliminar: boolean, k: number): string {
  if (preliminar) return 'Eliminatória preliminar'
  if (clubes === 2) return 'Final'
  if (clubes === 4) return 'Meias-finais'
  if (clubes === 8) return 'Quartos de final'
  if (clubes === 16) return 'Oitavos de final'
  return `${k}.ª eliminatória`
}

function estatVazia(): EstatJogo {
  return { posse: [0, 0], remates: [0, 0], rematesBaliza: [0, 0], cantos: [0, 0], amarelos: [0, 0], vermelhos: [0, 0] }
}

/** Jornadas da liga depois das quais se joga cada ronda: espalhadas entre a 3.ª e a antepenúltima. */
export function jornadasDaTaca(nRondas: number, totalJornadas: number): number[] {
  const ini = Math.min(3, Math.max(1, totalJornadas - 1))
  const fim = Math.max(ini, totalJornadas - 2)
  if (nRondas <= 1) return [fim]
  return Array.from({ length: nRondas }, (_, i) => Math.round(ini + (i * (fim - ini)) / (nRondas - 1)))
}

function todosOsClubes(mundo: Mundo): number[] {
  return mundo.divisoes.flatMap((d) => d.clubes)
}

/** Cria a taça da época com o calendário das rondas e o sorteio da primeira. */
export function novaTaca(mundo: Mundo, totalJornadas: number, semente: number, historico: HistoricoTaca[] = []): EstadoTaca {
  const ano = mundo.epoca
  const clubes = todosOsClubes(mundo)
  const n = clubes.length
  let p2 = 1
  while (p2 * 2 <= n) p2 *= 2
  const preliminar = n > p2
  const nRondas = Math.log2(p2) + (preliminar ? 1 : 0)
  const datas = jornadasDaTaca(nRondas, totalJornadas)
  const rondas: RondaTaca[] = []
  let naRonda = p2
  let k = 1
  for (let r = 0; r < nRondas; r++) {
    const pre = preliminar && r === 0
    rondas.push({ nome: nomeRonda(naRonda, pre, k), aposJornada: datas[r], jogos: [], isentos: [], jogada: false })
    if (!pre) { naRonda /= 2; k++ }
  }
  const taca: EstadoTaca = { ano, rondas, atual: 0, eliminados: {}, castigos: {}, marcadores: {}, receitas: {}, noticias: [], historico }

  // Ronda 0: na preliminar jogam os clubes das divisões mais baixas; os restantes ficam isentos.
  const rng = createRng(mistura(semente, ano, 0x7aca))
  if (preliminar) {
    const ordem = rng.shuffle(clubes).sort((a, b) => mundo.clubes[b].divisao - mundo.clubes[a].divisao)
    const jogam = ordem.slice(0, 2 * (n - p2))
    rondas[0].isentos = ordem.slice(2 * (n - p2))
    sortear(mundo, taca, 0, jogam, rng)
  } else {
    sortear(mundo, taca, 0, clubes, rng)
  }
  return taca
}

/** Sorteia os jogos de uma ronda. Joga em casa o clube de divisão mais baixa; na final, o primeiro a sair. */
function sortear(mundo: Mundo, taca: EstadoTaca, r: number, clubes: number[], rng: Rng): void {
  const ronda = taca.rondas[r]
  const bolas = rng.shuffle(clubes)
  const final = r === taca.rondas.length - 1
  ronda.jogos = []
  for (let i = 0; i + 1 < bolas.length; i += 2) {
    let [c, f] = [bolas[i], bolas[i + 1]]
    if (!final && mundo.clubes[f].divisao > mundo.clubes[c].divisao) [c, f] = [f, c]
    ronda.jogos.push({
      id: `T${taca.ano}-R${r + 1}-${c}-${f}`,
      competicao: 'taca',
      divisao: 0,
      jornada: r + 1,
      casaId: c,
      foraId: f,
      golos: [0, 0],
      eventos: [],
      estat: estatVazia(),
      jogada: false,
    })
  }
}

/** Taça da época atual, criada se ainda não existe (ou se é de outra época). */
export function garantirTaca(jogo: JogoComTaca): EstadoTaca {
  const ano = jogo.epoca.ano
  if (jogo.taca && jogo.taca.ano === ano) return jogo.taca
  const historico = jogo.taca?.historico ?? []
  if (jogo.epoca.jornada > ULTIMA_JORNADA_PARA_COMECAR) {
    jogo.taca = { ano, semTaca: true, rondas: [], atual: 0, eliminados: {}, castigos: {}, marcadores: {}, receitas: {}, noticias: [], historico }
  } else {
    jogo.taca = novaTaca(jogo.mundo, jogo.epoca.totalJornadas, mistura(jogo.mundo.semente, ano), historico)
    noticiaSorteio(jogo, jogo.taca, 0)
  }
  return jogo.taca
}

/** Ronda que já devia ser jogada (a jornada da liga a seguir à data dela ainda não começou), ou null. */
export function rondaPendente(jogo: JogoComTaca): RondaTaca | null {
  const t = garantirTaca(jogo)
  const r = t.rondas[t.atual]
  if (!r || r.jogada) return null
  return jogo.epoca.jornada - 1 >= r.aposJornada ? r : null
}

/** O meu jogo numa ronda, se lá estou. */
export function meuJogoNaRonda(jogo: Jogo, ronda: RondaTaca | null | undefined): Partida | undefined {
  return ronda?.jogos.find((p) => p.casaId === jogo.clubeId || p.foraId === jogo.clubeId)
}

/** Jogo da taça que o utilizador tem de jogar agora, se houver. */
export function meuJogoPendente(jogo: JogoComTaca): { ronda: RondaTaca; partida: Partida } | null {
  const r = rondaPendente(jogo)
  const p = meuJogoNaRonda(jogo, r)
  return r && p ? { ronda: r, partida: p } : null
}

/** Jogadores que não podem jogar na taça: lesionados e castigados na taça (os castigos da liga não contam). */
export function indisponiveisTaca(jogo: JogoComTaca, clubeId: number): Set<number> {
  const t = garantirTaca(jogo)
  const fora = new Set<number>()
  for (const id of jogo.mundo.clubes[clubeId]?.plantel ?? []) {
    const ind = jogo.epoca.indisponiveis[id]
    if (ind && ind.jogos > 0 && ind.motivo === 'lesao') fora.add(id)
    if ((t.castigos[id] ?? 0) > 0) fora.add(id)
  }
  return fora
}

/** O jogo acabou empatado nos 90 minutos e ainda não teve prolongamento. */
export function precisaProlongamento(e: EstadoJogo): boolean {
  const p = e.partida
  return p.jogada && p.golos[0] === p.golos[1] && !p.prolongamento
}

/** Reabre um jogo empatado para 30 minutos de prolongamento (minutos 91 a 120). */
export function prolongar(e: EstadoJogo): EventoJogo {
  const x = e as unknown as { fimMinuto: number; posseAcum: number }
  // A posse é a média por minuto: reescala o acumulado para os 90 minutos de base.
  x.posseAcum *= 90 / Math.max(90, e.minuto)
  e.minuto = 90
  x.fimMinuto = 120
  e.partida.jogada = false
  e.partida.prolongamento = true
  const ev: EventoJogo = { minuto: 90, tipo: 'intervalo', lado: 'casa', texto: `Empate ao fim dos 90 minutos: vai haver prolongamento.` }
  e.partida.eventos.push(ev)
  return ev
}

/** Joga um jogo da taça inteiro, com prolongamento se empatar (os penáltis vêm depois). */
export function simularJogoTaca(mundo: Mundo, p: Partida, casa: Escalacao, fora: Escalacao, semente: number): Partida {
  const e = iniciarJogo(mundo, p, casa, fora, semente)
  let guarda = 0
  while (!e.partida.jogada && guarda++ < 300) {
    avancarMinuto(mundo, e)
    if (precisaProlongamento(e)) prolongar(e)
  }
  return e.partida
}

/** Escalação da IA para a taça. */
export function escalacaoTaca(jogo: JogoComTaca, p: Partida, clubeId: number): Escalacao {
  const emCasa = clubeId === p.casaId
  return escalarIA(jogo.mundo, clubeId, emCasa ? p.foraId : p.casaId, emCasa, indisponiveisTaca(jogo, clubeId))
}

export interface Penaltis {
  golos: [number, number]
  /** Sequência: [lado 0/1, jogadorId, marcou]. */
  serie: [0 | 1, number, boolean][]
}

/**
 * Desempate por penáltis: 5 para cada lado, depois morte súbita.
 * `cobradores[l]` são os jogadores em campo (o guarda-redes de cada lado é `gr[l]`).
 */
export function marcarPenaltis(mundo: Mundo, cobradores: [number[], number[]], gr: [number | undefined, number | undefined], rng: Rng): Penaltis {
  const ordem = cobradores.map((ids) => ids.slice().sort((a, b) => (mundo.jogadores[b]?.forca ?? 0) - (mundo.jogadores[a]?.forca ?? 0)))
  const golos: [number, number] = [0, 0]
  const serie: Penaltis['serie'] = []
  const prob = (atirador: number, guarda?: number) => {
    const f = mundo.jogadores[atirador]?.forca ?? 50
    const g = guarda != null ? (mundo.jogadores[guarda]?.forca ?? 50) : 40
    return Math.max(0.6, Math.min(0.9, 0.76 + (f - g) / 300))
  }
  const cobra = (l: 0 | 1, k: number) => {
    const lista = ordem[l].length ? ordem[l] : [0]
    const id = lista[k % lista.length]
    const ok = rng.chance(prob(id, gr[1 - l]))
    if (ok) golos[l]++
    serie.push([l, id, ok])
  }
  for (let k = 0; k < 5; k++) {
    for (const l of [0, 1] as const) {
      cobra(l, k)
      // Acaba cedo se um lado já não pode ser apanhado.
      const faltam = [5 - (k + 1), 5 - (k + (l === 0 ? 0 : 1))]
      if (golos[0] + faltam[0] < golos[1] || golos[1] + faltam[1] < golos[0]) return { golos, serie }
    }
  }
  for (let k = 5; golos[0] === golos[1] && k < 60; k++) {
    cobra(0, k)
    cobra(1, k)
  }
  if (golos[0] === golos[1]) golos[rng.int(0, 1)]++
  return { golos, serie }
}

/** Vencedor de um jogo já jogado (com penáltis se empatou). */
export function vencedorDe(p: Partida): number {
  const [a, b] = p.golos
  if (a !== b) return a > b ? p.casaId : p.foraId
  const pen = p.penaltis ?? [1, 0]
  return pen[0] > pen[1] ? p.casaId : p.foraId
}

/** Resultado em texto (ex.: "1-1 (4-3 g.p.)"). */
export function textoResultado(p: Partida): string {
  return `${p.golos[0]}-${p.golos[1]}${p.penaltis ? ` (${p.penaltis[0]}-${p.penaltis[1]} g.p.)` : p.prolongamento ? ' a.p.' : ''}`
}

function noticia(t: EstadoTaca, texto: string, minha = false) {
  t.noticias.push({ ronda: t.atual, texto, minha: minha || undefined })
  if (t.noticias.length > 60) t.noticias.splice(0, t.noticias.length - 60)
}

function noticiaSorteio(jogo: Jogo, t: EstadoTaca, r: number) {
  const ronda = t.rondas[r]
  const meu = meuJogoNaRonda(jogo, ronda)
  const nome = (id: number) => jogo.mundo.clubes[id]?.nome ?? '?'
  if (meu) {
    const casa = meu.casaId === jogo.clubeId
    const adv = casa ? meu.foraId : meu.casaId
    const onde = r === t.rondas.length - 1 ? 'em campo neutro' : casa ? 'em casa' : 'fora'
    noticia(t, `Sorteio da ${ronda.nome} da ${NOME_TACA}: ${nome(jogo.clubeId)} contra ${nome(adv)}, ${onde}, depois da ${ronda.aposJornada}.ª jornada.`, true)
  } else if (ronda.isentos.includes(jogo.clubeId)) {
    noticia(t, `${nome(jogo.clubeId)} está isento da ${ronda.nome} e entra na ronda seguinte.`, true)
  } else {
    noticia(t, `Sorteio da ${ronda.nome} da ${NOME_TACA} feito: ${ronda.jogos.length} jogos.`)
  }
}

/**
 * Joga a ronda pendente: os jogos já jogados ao vivo (em `jogadas`, com os jogadores em campo no fim) ficam,
 * os outros são simulados. Decide empates nos penáltis, aplica lesões, castigos, marcadores, bilheteira e prémios,
 * escreve as notícias e sorteia a ronda seguinte.
 */
export function jogarRondaTaca(jogo: JogoComTaca, jogadas: { partida: Partida; emCampo?: [number[], number[]] }[] = []): RondaTaca | null {
  const t = garantirTaca(jogo)
  const r = t.atual
  const ronda = t.rondas[r]
  if (!ronda || ronda.jogada) return null
  const { mundo, epoca } = jogo
  const final = r === t.rondas.length - 1
  const semente = mistura(mundo.semente, t.ano, r, 0x7aca)
  const emCampo: Record<string, [number[], number[]]> = {}

  // 1. Simular o que falta (escalações com as baixas de antes da ronda).
  ronda.jogos.forEach((p, i) => {
    const viva = jogadas.find((x) => x.partida.id === p.id)
    if (viva) {
      ronda.jogos[i] = { ...viva.partida, jogada: true }
      if (viva.emCampo) emCampo[p.id] = viva.emCampo
      return
    }
    if (p.jogada) return
    const casa = escalacaoTaca(jogo, p, p.casaId)
    const fora = escalacaoTaca(jogo, p, p.foraId)
    const res = simularJogoTaca(mundo, p, casa, fora, mistura(semente, i))
    const saiu = new Set(res.eventos.filter((e) => e.tipo === 'vermelho' || e.tipo === 'lesao' || e.tipo === 'substituicao').map((e) => e.jogadorId))
    const entrou = res.eventos.filter((e) => e.tipo === 'substituicao').map((e) => e.outroId!)
    const lado = (esc: Escalacao, l: 'casa' | 'fora') => [...esc.titulares, ...entrou.filter((id) => mundo.jogadores[id]?.clubeId === (l === 'casa' ? p.casaId : p.foraId))].filter((id) => !saiu.has(id))
    emCampo[p.id] = [lado(casa, 'casa'), lado(fora, 'fora')]
    ronda.jogos[i] = { ...res, jogada: true }
  })

  // 2. Penáltis nos empates.
  const rngPen = createRng(mistura(semente, 0x9e7))
  for (const p of ronda.jogos) {
    if (p.golos[0] !== p.golos[1] || p.penaltis) continue
    const [ec, ef] = emCampo[p.id] ?? [[], []]
    const grDe = (ids: number[]) => ids.find((id) => mundo.jogadores[id]?.posicao === 'GR')
    const pen = marcarPenaltis(mundo, [ec, ef], [grDe(ec), grDe(ef)], rngPen)
    p.penaltis = pen.golos
    p.serie = pen.serie
  }

  // 3. Castigos da taça já cumpridos por quem jogou; novos castigos, lesões e golos.
  const jogaram = new Set(ronda.jogos.flatMap((p) => [p.casaId, p.foraId]))
  for (const key of Object.keys(t.castigos)) {
    const id = Number(key)
    if (jogaram.has(mundo.jogadores[id]?.clubeId ?? -1)) {
      t.castigos[id] -= 1
      if (t.castigos[id] <= 0) delete t.castigos[id]
    }
  }
  for (const p of ronda.jogos) {
    for (const ev of p.eventos) {
      const id = ev.jogadorId
      if (id === undefined) continue
      if (ev.tipo === 'vermelho') t.castigos[id] = (t.castigos[id] ?? 0) + 1
      else if (ev.tipo === 'golo') t.marcadores[id] = (t.marcadores[id] ?? 0) + 1
      else if (ev.tipo === 'lesao') {
        const jogos = Math.max(1, Math.round(ev.duracao ?? 1))
        const atual = epoca.indisponiveis[id]
        if (!atual || atual.jogos < jogos) epoca.indisponiveis[id] = { jogos, motivo: 'lesao' }
      }
    }
  }

  // 4. Dinheiro: bilheteira para a casa (a final é em campo neutro) e prémios a quem passa.
  const pagar = (id: number, v: number) => {
    if (!v || !mundo.clubes[id]) return
    mundo.clubes[id].dinheiro += v
    t.receitas[id] = (t.receitas[id] ?? 0) + v
  }
  for (const p of ronda.jogos) {
    if (!final) {
      const casa = mundo.clubes[p.casaId]
      const publico = publicoEsperado(casa, mundo.clubes[p.foraId], 8, 18)
      p.publico = publico
      p.receita = publico * casa.bilhete
      pagar(p.casaId, p.receita)
    }
    const v = vencedorDe(p)
    const perde = v === p.casaId ? p.foraId : p.casaId
    t.eliminados[perde] = r
    pagar(v, premioRonda(t, r))
    if (final) pagar(perde, PREMIO_FINALISTA)
  }

  // 5. Notícias: o meu jogo, surpresas e a final.
  const nome = (id: number) => mundo.clubes[id]?.nome ?? '?'
  const div = (id: number) => mundo.clubes[id]?.divisao ?? 4
  for (const p of ronda.jogos) {
    const v = vencedorDe(p)
    const perde = v === p.casaId ? p.foraId : p.casaId
    const res = textoResultado(p)
    if (final) {
      noticia(t, `${nome(v)} vence a ${NOME_TACA}! Final: ${nome(p.casaId)} ${res} ${nome(p.foraId)}.`, v === jogo.clubeId || perde === jogo.clubeId)
      const [a, b] = v === p.casaId ? [p.golos[0], p.golos[1]] : [p.golos[1], p.golos[0]]
      const pen = p.penaltis ? (v === p.casaId ? ` (${p.penaltis[0]}-${p.penaltis[1]} g.p.)` : ` (${p.penaltis[1]}-${p.penaltis[0]} g.p.)`) : p.prolongamento ? ' a.p.' : ''
      t.historico.push({ ano: t.ano, vencedorId: v, finalistaId: perde, resultado: `${a}-${b}${pen}` })
    } else if (v === jogo.clubeId) {
      noticia(t, `${nome(v)} segue em frente na taça (${ronda.nome}): ${nome(p.casaId)} ${res} ${nome(p.foraId)}. Prémio de ${Math.round(premioRonda(t, r) / 1000)} mil €.`, true)
    } else if (perde === jogo.clubeId) {
      noticia(t, `${nome(perde)} eliminado na ${ronda.nome}: ${nome(p.casaId)} ${res} ${nome(p.foraId)}.`, true)
    } else if (div(perde) - div(v) >= 2) {
      noticia(t, `Surpresa na ${ronda.nome}: ${nome(v)} (${div(v)}.ª) elimina ${nome(perde)} (${div(perde)}.ª), ${res}.`)
    }
  }

  // 6. Relatos antigos ocupam espaço: guardam-se só os golos, menos no meu jogo.
  ronda.jogos = ronda.jogos.map((p) => (p.casaId === jogo.clubeId || p.foraId === jogo.clubeId ? p : { ...p, eventos: p.eventos.filter((e) => e.tipo === 'golo') }))
  ronda.jogada = true
  t.atual = r + 1

  // 7. Sorteio da ronda seguinte.
  const prox = t.rondas[t.atual]
  if (prox) {
    const passam = [...ronda.isentos, ...ronda.jogos.map(vencedorDe)]
    sortear(mundo, t, t.atual, passam, createRng(mistura(semente, 0x5047)))
    noticiaSorteio(jogo, t, t.atual)
  }
  return ronda
}

/** Joga as rondas pendentes em que o utilizador não entra. Chamar depois de cada jornada da liga. */
export function avancarTaca(jogo: JogoComTaca): void {
  let guarda = 0
  for (let r = rondaPendente(jogo); r && !meuJogoNaRonda(jogo, r) && guarda++ < 10; r = rondaPendente(jogo)) {
    jogarRondaTaca(jogo)
  }
}

/** Onde o meu clube está na taça, em texto curto. */
export function minhaSituacao(jogo: JogoComTaca): string {
  const t = garantirTaca(jogo)
  if (t.semTaca) return `A ${NOME_TACA} começa na próxima época.`
  const elim = t.eliminados[jogo.clubeId]
  if (elim !== undefined) return `Eliminado na ${t.rondas[elim].nome}.`
  const h = t.historico.find((x) => x.ano === t.ano)
  if (h) return h.vencedorId === jogo.clubeId ? `Vencedor da ${NOME_TACA}!` : `Finalista vencido.`
  const r = t.rondas[t.atual]
  if (!r) return ''
  const p = meuJogoNaRonda(jogo, r)
  if (p) {
    const adv = jogo.mundo.clubes[p.casaId === jogo.clubeId ? p.foraId : p.casaId]
    return `${r.nome}: contra ${adv.nome}, depois da ${r.aposJornada}.ª jornada.`
  }
  return `Isento: entra na ${t.rondas[t.atual + 1]?.nome ?? 'ronda seguinte'}.`
}
