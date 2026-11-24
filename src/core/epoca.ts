// Calendário, tabela, castigos, lesões, subidas e descidas. IMPLEMENTAÇÃO: agente da época.
import { aplicarFinancas } from './financas'
import type { Mundo } from './types'
import type { EstadoEpoca, EstatJogo, Indisponivel, LinhaTabela, Partida, ResumoEpoca } from './partida'
import { createRng } from './rng'
import { simularJogo } from './motor'
import { escalarIA } from './tatica'
import { valorDe } from './mundo'
import { duracaoLesao, evoluirFimEpoca, nivelDe, treinarJornada } from './staff'
import { aplicarJogo, semanaDeTreino } from './balneario'
import { definirFadiga, fadigaDe } from './lesoes'

/** Quantos clubes sobem e descem entre divisões vizinhas. */
const TROCAS = 3

/** Mistura de inteiros (para derivar sementes independentes de uma semente base). */
function mistura(...partes: number[]): number {
  let h = 0x811c9dc5
  for (const p of partes) {
    h = Math.imul(h ^ (p >>> 0), 0x01000193) >>> 0
    h ^= h >>> 13
    h = Math.imul(h, 0x5bd1e995) >>> 0
    h ^= h >>> 15
  }
  return h >>> 0
}

function estatVazia(): EstatJogo {
  return {
    posse: [0, 0],
    remates: [0, 0],
    rematesBaliza: [0, 0],
    cantos: [0, 0],
    amarelos: [0, 0],
    vermelhos: [0, 0],
  }
}

function novaPartida(ano: number, divisao: number, jornada: number, casaId: number, foraId: number): Partida {
  return {
    id: `L${ano}-D${divisao}-J${jornada}-${casaId}-${foraId}`,
    competicao: 'liga',
    divisao,
    jornada,
    casaId,
    foraId,
    golos: [0, 0],
    eventos: [],
    estat: estatVazia(),
    jogada: false,
  }
}

/**
 * Método do círculo: devolve as rondas da primeira volta como pares [casa, fora].
 * Com número ímpar de clubes, um "fantasma" (-1) folga e os jogos com ele são ignorados.
 */
function primeiraVolta(clubes: number[]): [number, number][][] {
  const lista = clubes.length % 2 === 0 ? clubes.slice() : [...clubes, -1]
  const n = lista.length
  const rondas: [number, number][][] = []
  // Casa e fora: joga em casa quem tem o saldo (casa - fora) mais baixo; empate, quem esteve fora na última.
  const saldo = new Map<number, number>()
  const ultimaEmCasa = new Map<number, boolean>()
  for (let r = 0; r < n - 1; r++) {
    const jogos: [number, number][] = []
    for (let i = 0; i < n / 2; i++) {
      const a = lista[i]
      const b = lista[n - 1 - i]
      if (a === -1 || b === -1) continue
      const sa = saldo.get(a) ?? 0
      const sb = saldo.get(b) ?? 0
      let aEmCasa: boolean
      if (sa !== sb) aEmCasa = sa < sb
      else if ((ultimaEmCasa.get(a) ?? false) !== (ultimaEmCasa.get(b) ?? false)) aEmCasa = !ultimaEmCasa.get(a)
      else aEmCasa = (r + i) % 2 === 0
      const [c, f] = aEmCasa ? [a, b] : [b, a]
      saldo.set(c, (saldo.get(c) ?? 0) + 1)
      saldo.set(f, (saldo.get(f) ?? 0) - 1)
      ultimaEmCasa.set(c, true)
      ultimaEmCasa.set(f, false)
      jogos.push([c, f])
    }
    rondas.push(jogos)
    // Roda todos menos o primeiro.
    const ultimo = lista.pop() as number
    lista.splice(1, 0, ultimo)
  }
  return rondas
}

/** Cria a época: calendário de 34 jornadas (ida e volta) em cada divisão. */
export function novaEpoca(mundo: Mundo, semente: number): EstadoEpoca {
  const ano = mundo.epoca
  const calendario: Partida[][][] = []
  let totalJornadas = 0
  for (const div of mundo.divisoes) {
    const rng = createRng(mistura(semente, ano, div.numero))
    const ida = primeiraVolta(rng.shuffle(div.clubes))
    const metade = ida.length
    const jornadas: Partida[][] = []
    ida.forEach((jogos, r) => {
      jornadas[r] = jogos.map(([c, f]) => novaPartida(ano, div.numero, r + 1, c, f))
      jornadas[r + metade] = jogos.map(([c, f]) => novaPartida(ano, div.numero, r + metade + 1, f, c))
    })
    calendario[div.numero - 1] = jornadas
    totalJornadas = Math.max(totalJornadas, jornadas.length)
  }
  const liquidoInicio: Record<number, number> = {}
  for (const c of Object.values(mundo.clubes)) liquidoInicio[c.id] = liquido(c)
  return { ano, jornada: 1, totalJornadas, calendario, amarelos: {}, indisponiveis: {}, marcadores: {}, liquidoInicio }
}

/** IRC sobre o lucro da época (como uma SAD). Obras e reforços pagos na época descontam no lucro. */
export const TAXA_IRC = 0.21

/** Caixa menos o capital que falta pagar ao banco (um empréstimo não é lucro). */
function liquido(c: { dinheiro: number; emprestimo?: { capital: number } }): number {
  return c.dinheiro - (c.emprestimo?.capital ?? 0)
}

/** Cobra o IRC a quem deu lucro na época. Devolve lucro e imposto por clube. */
export function cobrarImpostos(mundo: Mundo, epoca: EstadoEpoca): Record<number, { lucro: number; imposto: number }> {
  const out: Record<number, { lucro: number; imposto: number }> = {}
  if (!epoca.liquidoInicio) return out
  for (const c of Object.values(mundo.clubes)) {
    const inicio = epoca.liquidoInicio[c.id]
    if (inicio === undefined) continue
    const lucro = liquido(c) - inicio
    if (lucro <= 0) continue
    const imposto = Math.round((lucro * TAXA_IRC) / 1000) * 1000
    if (imposto <= 0) continue
    c.dinheiro -= imposto
    out[c.id] = { lucro, imposto }
  }
  return out
}

/** Partidas da jornada atual numa divisão. */
export function partidasDaJornada(epoca: EstadoEpoca, divisao: number): Partida[] {
  return epoca.calendario[divisao - 1]?.[epoca.jornada - 1] ?? []
}

/** Ids dos jogadores indisponíveis (lesionados ou castigados) de um clube. */
export function indisponiveisDe(mundo: Mundo, epoca: EstadoEpoca, clubeId: number): Set<number> {
  const fora = new Set<number>()
  const clube = mundo.clubes[clubeId]
  if (!clube) return fora
  for (const id of clube.plantel) {
    const ind = epoca.indisponiveis[id]
    if (ind && ind.jogos > 0) fora.add(id)
  }
  return fora
}

/** Junta uma nova baixa à que o jogador já tenha (castigos somam-se; lesão e castigo, fica a mais longa). */
function juntarBaixa(epoca: EstadoEpoca, jogadorId: number, nova: Indisponivel) {
  if (nova.jogos <= 0) return
  const atual = epoca.indisponiveis[jogadorId]
  if (!atual) {
    epoca.indisponiveis[jogadorId] = { ...nova }
  } else if (atual.motivo === 'castigo' && nova.motivo === 'castigo') {
    atual.jogos += nova.jogos
  } else if (nova.jogos > atual.jogos) {
    epoca.indisponiveis[jogadorId] = { ...nova }
  }
}

function castigar(epoca: EstadoEpoca, jogadorId: number, jogos: number) {
  juntarBaixa(epoca, jogadorId, { jogos, motivo: 'castigo' })
}

/**
 * Fecha a jornada atual: simula com o motor (escalação automática) todas as partidas ainda não jogadas
 * de todas as divisões, aplica cartões, castigos, lesões e marcadores de TODAS as partidas da jornada
 * (incluindo as que a UI jogou ao vivo), reduz as baixas antigas e avança `jornada`.
 */
export function concluirJornada(mundo: Mundo, epoca: EstadoEpoca, semente: number): void {
  if (epocaTerminada(epoca)) return
  const j = epoca.jornada - 1
  const daJornada: Partida[] = []

  // 1. Simular o que falta (as escalações usam as baixas de antes desta jornada).
  epoca.calendario.forEach((jornadas, d) => {
    const partidas = jornadas[j]
    if (!partidas) return
    partidas.forEach((p, i) => {
      if (!p.jogada) {
        const casa = escalarIA(mundo, p.casaId, p.foraId, true, indisponiveisDe(mundo, epoca, p.casaId))
        const fora = escalarIA(mundo, p.foraId, p.casaId, false, indisponiveisDe(mundo, epoca, p.foraId))
        const res = simularJogo(mundo, p, casa, fora, mistura(semente, epoca.ano, j, d, i))
        partidas[i] = { ...res, jogada: true }
      }
      daJornada.push(partidas[i])
    })
  })

  // 1b. Dinheiro da jornada (com as tabelas de antes dela).
  const tabelas = epoca.calendario.map((_, d) => tabela(mundo, epoca, d + 1))
  epoca.ultimoBalanco = aplicarFinancas(mundo, daJornada, tabelas)

  // Quem estava de fora antes do jogo (não conta como "não foi escolhido" para a moral).
  const ausentes = new Set(Object.keys(epoca.indisponiveis).map(Number).filter((id) => epoca.indisponiveis[id].jogos > 0))
  const regressos: { id: number; total: number }[] = []

  // 2. Reduzir as baixas antigas dos jogadores cujos clubes jogaram.
  const jogaram = new Set<number>()
  for (const p of daJornada) {
    jogaram.add(p.casaId)
    jogaram.add(p.foraId)
  }
  for (const key of Object.keys(epoca.indisponiveis)) {
    const id = Number(key)
    const jogador = mundo.jogadores[id]
    if (jogador && !jogaram.has(jogador.clubeId)) continue
    const ind = epoca.indisponiveis[id]
    ind.jogos -= 1
    if (ind.jogos <= 0) {
      if (ind.motivo === 'lesao' && (ind.total ?? 0) >= 4) regressos.push({ id, total: ind.total ?? 0 })
      delete epoca.indisponiveis[id]
    }
  }

  // 3. Aplicar os eventos desta jornada.
  for (const p of daJornada) {
    const amarelosNoJogo = new Set<number>()
    for (const ev of p.eventos) {
      const id = ev.jogadorId
      if (id === undefined) continue
      switch (ev.tipo) {
        case 'amarelo': {
          amarelosNoJogo.add(id)
          const n = (epoca.amarelos[id] ?? 0) + 1
          if (n >= 5) {
            epoca.amarelos[id] = 0
            castigar(epoca, id, 1)
          } else {
            epoca.amarelos[id] = n
          }
          break
        }
        case 'vermelho':
          castigar(epoca, id, amarelosNoJogo.has(id) ? 1 : 2)
          break
        case 'lesao': {
          const jogos = duracaoLesao(mundo.clubes[mundo.jogadores[id]?.clubeId], Math.max(1, Math.round(ev.duracao ?? 1)))
          juntarBaixa(epoca, id, { jogos, motivo: 'lesao', ...(ev.tipoLesao ? { tipo: ev.tipoLesao } : {}), total: jogos })
          break
        }
        case 'golo':
          epoca.marcadores[id] = (epoca.marcadores[id] ?? 0) + 1
          break
        default:
          break
      }
    }
  }

  // 3b. Balneário e físico: moral pelo resultado e tempo de jogo, cansaço, e a semana de recuperação.
  for (const p of daJornada) aplicarJogo(mundo, p, ausentes, true)
  semanaDeTreino(mundo, jogaram, (cid) => nivelDe(mundo.clubes[cid], 'fisico'))
  // Quem volta de uma lesão longa ainda não tem ritmo de jogo.
  for (const r of regressos) {
    const j = mundo.jogadores[r.id]
    if (j) definirFadiga(j, Math.max(fadigaDe(j), Math.min(65, 35 + r.total * 2)))
  }

  // 4. Treino da semana: quem não está lesionado pode ganhar força (depende do staff e do foco).
  const lesionados = new Set(Object.keys(epoca.indisponiveis).map(Number).filter((id) => epoca.indisponiveis[id].motivo === 'lesao'))
  treinarJornada(mundo, jogaram, lesionados, mistura(semente, epoca.ano, j, 0x7e1), epoca.ano)

  epoca.jornada += 1
}

/** Tabela ordenada: pontos, diferença de golos, golos marcados, nome. */
export function tabela(mundo: Mundo, epoca: EstadoEpoca, divisao: number): LinhaTabela[] {
  const linhas = new Map<number, LinhaTabela>()
  const div = mundo.divisoes.find((d) => d.numero === divisao)
  const jornadas = epoca.calendario[divisao - 1] ?? []
  const garantir = (id: number) => {
    let l = linhas.get(id)
    if (!l) {
      l = { clubeId: id, j: 0, v: 0, e: 0, d: 0, gm: 0, gs: 0, pts: 0, forma: [] }
      linhas.set(id, l)
    }
    return l
  }
  // Clubes da divisão no calendário (a divisão do mundo pode já ter mudado depois de fecharEpoca).
  for (const partidas of jornadas) for (const p of partidas) { garantir(p.casaId); garantir(p.foraId) }
  if (linhas.size === 0 && div) for (const id of div.clubes) garantir(id)

  for (const partidas of jornadas) {
    for (const p of partidas) {
      if (!p.jogada) continue
      const [gc, gf] = p.golos
      const casa = garantir(p.casaId)
      const fora = garantir(p.foraId)
      casa.j++; fora.j++
      casa.gm += gc; casa.gs += gf
      fora.gm += gf; fora.gs += gc
      if (gc > gf) {
        casa.v++; casa.pts += 3; fora.d++
        casa.forma.push('V'); fora.forma.push('D')
      } else if (gc < gf) {
        fora.v++; fora.pts += 3; casa.d++
        casa.forma.push('D'); fora.forma.push('V')
      } else {
        casa.e++; fora.e++; casa.pts++; fora.pts++
        casa.forma.push('E'); fora.forma.push('E')
      }
    }
  }
  const nome = (id: number) => mundo.clubes[id]?.nome ?? String(id)
  const res = [...linhas.values()]
  for (const l of res) l.forma = l.forma.slice(-5)
  res.sort((a, b) =>
    b.pts - a.pts ||
    (b.gm - b.gs) - (a.gm - a.gs) ||
    b.gm - a.gm ||
    nome(a.clubeId).localeCompare(nome(b.clubeId), 'pt'),
  )
  return res
}

export function epocaTerminada(epoca: EstadoEpoca): boolean {
  return epoca.jornada > epoca.totalJornadas
}

/**
 * Fecha a época: 3 sobem e 3 descem entre divisões vizinhas (atualiza mundo.divisoes e clube.divisao),
 * jogadores envelhecem 1 ano (com pequena evolução/declínio de força pela idade e potencial),
 * contratos descem 1 ano, mundo.epoca += 1. Devolve o resumo.
 */
export function fecharEpoca(mundo: Mundo, epoca: EstadoEpoca): ResumoEpoca {
  const divisoes = [...mundo.divisoes].sort((a, b) => a.numero - b.numero)
  const tabelas = new Map<number, number[]>()
  for (const d of divisoes) tabelas.set(d.numero, tabela(mundo, epoca, d.numero).map((l) => l.clubeId))

  const campeoes: ResumoEpoca['campeoes'] = []
  for (const d of divisoes) {
    const t = tabelas.get(d.numero) ?? []
    if (t.length) campeoes.push({ divisao: d.numero, clubeId: t[0] })
  }

  // Subidas e descidas, calculadas antes de mexer nas divisões.
  const subidas: ResumoEpoca['subidas'] = []
  const descidas: ResumoEpoca['descidas'] = []
  const trocas: { cima: number; baixo: number; desce: number[]; sobe: number[] }[] = []
  for (let k = 0; k + 1 < divisoes.length; k++) {
    const cima = divisoes[k]
    const baixo = divisoes[k + 1]
    const tCima = tabelas.get(cima.numero) ?? []
    const tBaixo = tabelas.get(baixo.numero) ?? []
    const n = Math.min(TROCAS, Math.floor(tCima.length / 2), Math.floor(tBaixo.length / 2))
    const desce = tCima.slice(tCima.length - n)
    const sobe = tBaixo.slice(0, n)
    trocas.push({ cima: cima.numero, baixo: baixo.numero, desce, sobe })
    descidas.push({ divisao: cima.numero, clubeIds: desce })
    subidas.push({ divisao: baixo.numero, clubeIds: sobe })
  }
  for (const t of trocas) {
    const cima = mundo.divisoes.find((d) => d.numero === t.cima)!
    const baixo = mundo.divisoes.find((d) => d.numero === t.baixo)!
    cima.clubes = cima.clubes.filter((id) => !t.desce.includes(id)).concat(t.sobe)
    baixo.clubes = baixo.clubes.filter((id) => !t.sobe.includes(id)).concat(t.desce)
  }
  for (const d of mundo.divisoes) for (const id of d.clubes) if (mundo.clubes[id]) mundo.clubes[id].divisao = d.numero

  // Melhor marcador.
  let melhorMarcador: ResumoEpoca['melhorMarcador'] = null
  for (const [key, golos] of Object.entries(epoca.marcadores)) {
    const id = Number(key)
    if (golos <= 0) continue
    if (!melhorMarcador || golos > melhorMarcador.golos || (golos === melhorMarcador.golos && id < melhorMarcador.jogadorId)) {
      melhorMarcador = { jogadorId: id, golos }
    }
  }

  // Envelhecimento e evolução.
  const rng = createRng(mistura(mundo.semente, epoca.ano, 0xe90c4))
  const ids = Object.keys(mundo.jogadores).map(Number).sort((a, b) => a - b)
  for (const id of ids) {
    const j = mundo.jogadores[id]
    j.idade += 1
    evoluirFimEpoca(mundo, j, rng)
    j.valor = valorDe(j.forca, j.idade)
    j.contrato = Math.max(0, j.contrato - 1)
  }

  const impostos = cobrarImpostos(mundo, epoca)

  mundo.epoca += 1
  return { ano: epoca.ano, campeoes, subidas, descidas, melhorMarcador, impostos }
}
