// Conquistas da carreira do mister: metas pequenas e grandes que ficam desbloqueadas para sempre.
// Calculadas a partir do estado do jogo (recordes, taça, Europa, dinheiro, estádio), sem sorte nenhuma.
import type { Jogo } from './types'
import { estadoRecordes } from './recordes'
import type { JogoComTaca } from './taca'
import type { JogoComEuropa } from './europa'
import type { JogoComTreinadorMes } from './treinador-mes'

export interface DefConquista {
  id: string
  nome: string
  texto: string
  /** Progresso atual e alvo (para a barra); `feito` quando atual >= alvo. */
  progresso: (jogo: Jogo) => [number, number]
}

const mister = (j: Jogo) => estadoRecordes(j).mister
const meu = (j: Jogo) => j.mundo.clubes[j.clubeId]

export const CONQUISTAS: DefConquista[] = [
  { id: 'vitoria1', nome: 'Primeira vitória', texto: 'Ganhar um jogo do campeonato.', progresso: (j) => [mister(j).v, 1] },
  { id: 'vitorias25', nome: 'Hábito de ganhar', texto: 'Ganhar 25 jogos do campeonato.', progresso: (j) => [mister(j).v, 25] },
  { id: 'vitorias100', nome: 'Centenário', texto: 'Ganhar 100 jogos do campeonato.', progresso: (j) => [mister(j).v, 100] },
  { id: 'jogos200', nome: 'Velha raposa', texto: 'Orientar 200 jogos do campeonato.', progresso: (j) => [mister(j).jogos, 200] },
  { id: 'serie5', nome: 'Embalados', texto: 'Ganhar 5 jogos seguidos.', progresso: (j) => [mister(j).melhorSerie, 5] },
  { id: 'serie10', nome: 'Máquina', texto: 'Ganhar 10 jogos seguidos.', progresso: (j) => [mister(j).melhorSerie, 10] },
  { id: 'goleada', nome: 'Chapa cinco', texto: 'Ganhar um jogo por 5 ou mais golos de diferença.', progresso: (j) => [Math.min(5, mister(j).maiorVitoria?.valor ?? 0), 5] },
  { id: 'mes', nome: 'Treinador do mês', texto: 'Ser o treinador do mês na tua divisão.', progresso: (j) => [(j as JogoComTreinadorMes).treinadorMes?.meus ?? 0, 1] },
  { id: 'subida', nome: 'Elevador', texto: 'Subir de divisão.', progresso: (j) => [mister(j).subidas, 1] },
  { id: 'subidas3', nome: 'Escada rolante', texto: 'Subir de divisão 3 vezes.', progresso: (j) => [mister(j).subidas, 3] },
  { id: 'primeira', nome: 'Entre os grandes', texto: 'Treinar um clube da 1.ª Divisão.', progresso: (j) => [meu(j).divisao === 1 ? 1 : 0, 1] },
  { id: 'titulo', nome: 'Campeão!', texto: 'Ganhar um campeonato.', progresso: (j) => [mister(j).titulos, 1] },
  { id: 'titulo1', nome: 'Campeão nacional', texto: 'Ganhar a 1.ª Divisão.', progresso: (j) => [estadoRecordes(j).campeoes.some((c) => c.meu && c.divisao === 1) ? 1 : 0, 1] },
  { id: 'taca', nome: 'Rei da Taça', texto: 'Ganhar a Taça.', progresso: (j) => [((j as JogoComTaca).taca?.historico ?? []).some((h) => h.vencedorId === j.clubeId) ? 1 : 0, 1] },
  { id: 'europa', nome: 'Passaporte', texto: 'Jogar uma prova europeia.', progresso: (j) => [((j as JogoComEuropa).europa?.comps ?? []).some((c) => c.clubes.includes(j.clubeId)) ? 1 : 0, 1] },
  { id: 'europaTitulo', nome: 'Conquistador', texto: 'Ganhar uma prova europeia.', progresso: (j) => [((j as JogoComEuropa).europa?.historico ?? []).some((h) => h.vencedorId === j.clubeId) ? 1 : 0, 1] },
  { id: 'milhao', nome: 'Contas certas', texto: 'Ter 1 milhão de euros em caixa.', progresso: (j) => [Math.min(1_000_000, Math.max(0, meu(j).dinheiro)), 1_000_000] },
  { id: 'milhoes20', nome: 'Cofre cheio', texto: 'Ter 20 milhões de euros em caixa.', progresso: (j) => [Math.min(20_000_000, Math.max(0, meu(j).dinheiro)), 20_000_000] },
  { id: 'estadio', nome: 'Mestre de obras', texto: 'Aumentar o estádio.', progresso: (j) => { const e = meu(j).estadio; return [e.base !== undefined && e.lugares > e.base ? 1 : 0, 1] } },
  { id: 'epocas5', nome: 'Casa da família', texto: 'Chegar à 5.ª época de carreira.', progresso: (j) => [j.mundo.epoca - primeiraEpoca(j) + 1, 5] },
]

function primeiraEpoca(j: Jogo): number {
  const c = j as Jogo & { conquistas?: EstadoConquistas }
  return c.conquistas?.inicio ?? j.mundo.epoca
}

export interface EstadoConquistas {
  /** Época em que a carreira começou a contar conquistas. */
  inicio: number
  /** id -> época em que foi desbloqueada. */
  feitas: Record<string, number>
  /** Desbloqueadas desde a última vez que o mister as viu. */
  novas: string[]
}

export type JogoComConquistas = Jogo & { conquistas?: EstadoConquistas }

export function estadoConquistas(jogo: Jogo): EstadoConquistas {
  const j = jogo as JogoComConquistas
  j.conquistas ??= { inicio: j.mundo.epoca, feitas: {}, novas: [] }
  return j.conquistas
}

/** Marca as conquistas que ficaram feitas. Devolve as novas desta chamada. */
export function verificarConquistas(jogo: Jogo): DefConquista[] {
  const st = estadoConquistas(jogo)
  const novas: DefConquista[] = []
  for (const c of CONQUISTAS) {
    if (st.feitas[c.id] !== undefined) continue
    const [a, alvo] = c.progresso(jogo)
    if (a >= alvo) { st.feitas[c.id] = jogo.epoca.ano; st.novas.push(c.id); novas.push(c) }
  }
  return novas
}

export function vistasConquistas(jogo: Jogo): void {
  estadoConquistas(jogo).novas = []
}
