// Staff dos clubes do computador: contratam conforme a divisão e o dinheiro, e escolhem o foco do treino.
import { createRng } from './rng'
import { salariosPorJornada } from './financas'
import { FUNCOES, candidatos, mistura, salarioStaff, staffDe, type ClubeComStaff, type FocoTreino, type MembroStaff } from './staff'
import type { Mundo, Posicao } from './types'

/** Nível típico do staff por divisão. */
const NIVEL_DIVISAO = [2, 2, 2, 1]

/** Nível que um clube do computador procura para uma função nesta época. */
function nivelAlvo(mundo: Mundo, clubeId: number, k: number): number {
  const c = mundo.clubes[clubeId]
  const rng = createRng(mistura(mundo.semente, mundo.epoca, clubeId, k, 0x1a))
  let n = NIVEL_DIVISAO[c.divisao - 1] ?? 1
  const sal = Math.max(1, salariosPorJornada(mundo, clubeId))
  // Com folga (mais de uma época de salários em caixa) arrisca-se mais; à justa, poupa-se.
  if (c.dinheiro > sal * 34 && rng.chance(0.4)) n += 1
  if (rng.chance(0.2)) n -= 1
  if (c.dinheiro > sal * 68) n += 1
  if (c.dinheiro < sal * 17) n -= 1
  return Math.max(1, Math.min(5, n))
}

/** Foco do treino: o setor mais fraco do onze provável; com muitos miúdos, os jovens. */
export function focoIA(mundo: Mundo, clubeId: number): FocoTreino {
  const c = mundo.clubes[clubeId]
  const js = c.plantel.map((id) => mundo.jogadores[id]).filter(Boolean)
  const jovens = js.filter((j) => j.idade <= 21 && j.forca < j.potencial).length
  if (jovens >= 6) return 'jovens'
  const quantos: Record<Posicao, number> = { GR: 1, DEF: 4, MED: 4, AV: 2 }
  let pior: FocoTreino = 'equilibrado', min = Infinity
  const medias: number[] = []
  for (const p of ['GR', 'DEF', 'MED', 'AV'] as Posicao[]) {
    const melhores = js.filter((j) => j.posicao === p).map((j) => j.forca).sort((a, b) => b - a).slice(0, quantos[p])
    if (!melhores.length) continue
    const m = melhores.reduce((s, v) => s + v, 0) / melhores.length
    medias.push(m)
    if (m < min) { min = m; pior = p }
  }
  const media = medias.reduce((s, v) => s + v, 0) / Math.max(1, medias.length)
  // Só foca se o setor estiver mesmo atrás.
  return media - min >= 3 ? pior : 'equilibrado'
}

function contratarIA(mundo: Mundo, clubeId: number, k: number) {
  const c = mundo.clubes[clubeId] as ClubeComStaff
  const f = FUNCOES[k]
  // À justa (menos de meia época de salários em caixa) só fica o essencial.
  const pobre = c.dinheiro < Math.max(1, salariosPorJornada(mundo, clubeId)) * 17
  // Sem dinheiro, o olheiro e o preparador físico são os primeiros a sair.
  if (pobre && (f === 'olheiro' || f === 'fisico')) {
    c.staff!.membros = c.staff!.membros.filter((m) => m.funcao !== f)
    return
  }
  const alvo = nivelAlvo(mundo, clubeId, k)
  const atual = c.staff!.membros.find((m) => m.funcao === f)
  if (atual && atual.nivel === alvo) {
    // Mantém-se; o salário acompanha a divisão.
    atual.salario = salarioStaff(alvo, c.divisao)
    return
  }
  const novo: MembroStaff | undefined = candidatos(mundo, clubeId, f).find((m) => m.nivel === alvo)
  if (!novo) return
  c.staff!.membros = c.staff!.membros.filter((m) => m.funcao !== f).concat(novo)
}

/** Dá staff a quem ainda não tem (jogo novo ou gravação antiga). O clube do utilizador recebe o mesmo que a IA daria. Devolve true se mudou algo. */
export function garantirStaff(mundo: Mundo): boolean {
  let mudou = false
  for (const id of Object.keys(mundo.clubes).map(Number).sort((a, b) => a - b)) {
    const c = mundo.clubes[id] as ClubeComStaff
    if (c.staff) continue
    c.staff = { membros: [], foco: focoIA(mundo, id) }
    for (let k = 0; k < FUNCOES.length; k++) contratarIA(mundo, id, k)
    mudou = true
  }
  return mudou
}

/** Entre épocas: os clubes do computador revêm o staff e o foco do treino. */
export function staffIA(mundo: Mundo, excluir: number): void {
  garantirStaff(mundo)
  for (const id of Object.keys(mundo.clubes).map(Number).sort((a, b) => a - b)) {
    if (id === excluir) continue
    const c = mundo.clubes[id] as ClubeComStaff
    for (let k = 0; k < FUNCOES.length; k++) contratarIA(mundo, id, k)
    c.staff!.foco = focoIA(mundo, id)
    if (staffDe(c)?.ganhos) c.staff!.ganhos = {}
  }
}
