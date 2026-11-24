// Prémios de jogo ao plantel: o mister escolhe quanto paga por cada vitória no campeonato.
// Custa dinheiro a cada vitória e sobe a moral do plantel (que conta no rendimento em campo).
import type { Jogo } from './types'
import { mudarMoral } from './balneario'

export type NivelPremio = 0 | 1 | 2
export const NOME_PREMIO: Record<NivelPremio, string> = { 0: 'Sem prémios', 1: 'Prémio normal', 2: 'Prémio generoso' }
/** Custo por vitória, em fração da massa salarial mensal. */
export const CUSTO_PREMIO: Record<NivelPremio, number> = { 0: 0, 1: 0.05, 2: 0.12 }
/** Moral do plantel por vitória. */
export const MORAL_PREMIO: Record<NivelPremio, number> = { 0: 0, 1: 1.5, 2: 3 }

export interface EstadoPremios { nivel: NivelPremio; ano: number; jornada: number; pagoEpoca: number; vitorias: number }
export type JogoComPremios = Jogo & { premiosJogo?: EstadoPremios }

export function estadoPremios(jogo: Jogo): EstadoPremios {
  const j = jogo as JogoComPremios
  j.premiosJogo ??= { nivel: 0, ano: jogo.epoca.ano, jornada: jogo.epoca.jornada - 1, pagoEpoca: 0, vitorias: 0 }
  return j.premiosJogo
}

export function custoPorVitoria(jogo: Jogo, nivel: NivelPremio): number {
  const c = jogo.mundo.clubes[jogo.clubeId]
  const mensal = c.plantel.reduce((s, id) => s + (jogo.mundo.jogadores[id]?.salario ?? 0), 0)
  return Math.round((mensal * CUSTO_PREMIO[nivel]) / 100) * 100
}

export function escolherPremio(jogo: Jogo, nivel: NivelPremio): void {
  const st = estadoPremios(jogo)
  st.nivel = nivel
}

/** Paga os prémios das jornadas do campeonato já jogadas. Idempotente. Devolve o que pagou agora. */
export function avancarPremiosJogo(jogo: Jogo): number {
  const st = estadoPremios(jogo)
  const { epoca, mundo } = jogo
  if (st.ano !== epoca.ano) { st.ano = epoca.ano; st.jornada = 0; st.pagoEpoca = 0; st.vitorias = 0 }
  const c = mundo.clubes[jogo.clubeId]
  let pago = 0
  while (st.jornada < epoca.jornada - 1) {
    st.jornada += 1
    if (!st.nivel) continue
    const p = epoca.calendario[c.divisao - 1]?.[st.jornada - 1]?.find((x) => x.casaId === c.id || x.foraId === c.id)
    if (!p?.jogada) continue
    const [gm, gs] = p.casaId === c.id ? p.golos : [p.golos[1], p.golos[0]]
    if (gm <= gs) continue
    const v = custoPorVitoria(jogo, st.nivel)
    c.dinheiro -= v
    pago += v
    st.pagoEpoca += v
    st.vitorias += 1
    mudarMoral(jogo, c.id, MORAL_PREMIO[st.nivel], `Prémio de jogo pago (${v.toLocaleString('pt-PT')} €): o plantel ficou motivado.`)
  }
  return pago
}
