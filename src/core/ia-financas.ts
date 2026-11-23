// Os clubes do computador também fazem obras e pedem empréstimos, uma vez por época (entre épocas).
import type { Mundo } from './types'
import { publicoEsperado } from './financas'
import { OBRAS, LOTACAO_MAX, custoObra, iniciarObra } from './estadio'
import { limiteCredito, liquidar, pedirEmprestimo } from './banco'
import { salariosPorJornada } from './financas'

export interface DecisaoIA { clubeId: number; tipo: 'obra' | 'emprestimo' | 'liquidou'; valor: number }

/** Decide obras e empréstimos de todos os clubes menos `excluir` (o do utilizador). Determinístico. */
export function gestaoIA(mundo: Mundo, excluir: number): DecisaoIA[] {
  const out: DecisaoIA[] = []
  const ids = Object.keys(mundo.clubes).map(Number).sort((a, b) => a - b)
  for (const id of ids) {
    if (id === excluir) continue
    const c = mundo.clubes[id]
    // 1. Caixa no vermelho: pede o que precisa para cobrir o buraco e meia época de salários, a duas épocas.
    if (!c.emprestimo && c.dinheiro < 0) {
      const precisa = -c.dinheiro + salariosPorJornada(mundo, id) * 17
      const montante = Math.min(limiteCredito(c), Math.ceil(precisa / 10_000) * 10_000)
      if (montante >= 10_000 && pedirEmprestimo(c, montante, 68)) out.push({ clubeId: id, tipo: 'emprestimo', valor: montante })
    }
    // 2. Muito dinheiro e um empréstimo: liquida.
    if (c.emprestimo && c.dinheiro > 4 * c.emprestimo.capital) {
      const v = c.emprestimo.capital
      if (liquidar(c)) out.push({ clubeId: id, tipo: 'liquidou', valor: v })
    }
    // 3. Estádio que enche num jogo normal e dinheiro de sobra: aumenta à medida da procura.
    if (!c.estadio.obra) {
      // Procura num jogo a meio da tabela contra um adversário com a reputação média da divisão.
      const div = mundo.divisoes[c.divisao - 1]?.clubes ?? []
      const repMedia = div.length ? div.reduce((t, i) => t + mundo.clubes[i].reputacao, 0) / div.length : c.reputacao
      const procura = publicoEsperado(c, { ...c, reputacao: repMedia }, 8, 18)
      if (procura >= c.estadio.lugares * 0.85) {
        const alvo = OBRAS.filter((n) => c.estadio.lugares + n <= LOTACAO_MAX && c.dinheiro >= 3 * custoObra(n) && n <= c.estadio.lugares * 0.5)
        const n = alvo[alvo.length - 1]
        if (n && iniciarObra(c, n)) out.push({ clubeId: id, tipo: 'obra', valor: n })
      }
    }
  }
  return out
}
