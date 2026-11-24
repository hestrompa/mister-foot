// Pré-época: antes da 1.ª jornada, o mister escolhe uma digressão (dá dinheiro, cansa o plantel)
// ou um estágio (custa dinheiro, une o plantel). Uma escolha por época.
import type { Jogo } from './types'
import { RECEITA_FIXA } from './financas'
import { mudarMoral } from './balneario'

export type TipoPreEpoca = 'digressao' | 'estagio' | 'casa'

export interface OpcaoPreEpoca { tipo: TipoPreEpoca; nome: string; texto: string; dinheiro: number; moral: number }

export function opcoesPreEpoca(jogo: Jogo): OpcaoPreEpoca[] {
  const c = jogo.mundo.clubes[jogo.clubeId]
  const F = (RECEITA_FIXA[c.divisao - 1] ?? 0) * 34
  const fama = 0.6 + c.reputacao / 100
  const d = Math.round((F * 0.12 * fama) / 1000) * 1000
  const e = Math.round((F * 0.05) / 1000) * 1000
  return [
    { tipo: 'digressao', nome: 'Digressão no estrangeiro', texto: 'Jogos de exibição pagos: entra dinheiro, mas as viagens cansam e o plantel chega menos motivado.', dinheiro: d, moral: -3 },
    { tipo: 'estagio', nome: 'Estágio no Algarve', texto: 'Duas semanas de trabalho e convívio: custa dinheiro, mas o plantel arranca unido.', dinheiro: -e, moral: 4 },
    { tipo: 'casa', nome: 'Treinar em casa', texto: 'Sem custos nem receitas. Nada muda.', dinheiro: 0, moral: 0 },
  ]
}

export type JogoComPreEpoca = Jogo & { preEpoca?: { ano: number; tipo: TipoPreEpoca } }

export function preEpocaPendente(jogo: Jogo): boolean {
  const p = (jogo as JogoComPreEpoca).preEpoca
  return jogo.epoca.jornada === 1 && p?.ano !== jogo.epoca.ano
}

export function escolherPreEpoca(jogo: Jogo, tipo: TipoPreEpoca): OpcaoPreEpoca | null {
  if (!preEpocaPendente(jogo)) return null
  const o = opcoesPreEpoca(jogo).find((x) => x.tipo === tipo)
  if (!o) return null
  if (o.dinheiro < 0 && jogo.mundo.clubes[jogo.clubeId].dinheiro < -o.dinheiro) return null
  jogo.mundo.clubes[jogo.clubeId].dinheiro += o.dinheiro
  if (o.moral) mudarMoral(jogo, jogo.clubeId, o.moral, o.moral > 0 ? 'O estágio de pré-época uniu o grupo.' : 'A digressão de pré-época deixou o plantel cansado.')
  ;(jogo as JogoComPreEpoca).preEpoca = { ano: jogo.epoca.ano, tipo }
  return o
}
