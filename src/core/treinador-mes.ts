// Treinador do mês: a cada 4 jornadas, o clube com mais pontos nessas jornadas em cada divisão.
// Ao mister dá notícia, um pouco de confiança da direção e conta para as conquistas.
import type { Jogo } from './types'
import { estadoCarreira, type JogoComCarreira } from './direcao'

export const JORNADAS_MES = 4
/** Confiança da direção ganha quando o mister é treinador do mês. */
export const CONFIANCA_MES = 3

export interface PremioMes { ano: number; jornada: number; divisao: number; clubeId: number; pontos: number }
export interface EstadoTreinadorMes { ultimo: number; ano: number; premios: PremioMes[]; meus: number }
export type JogoComTreinadorMes = Jogo & { treinadorMes?: EstadoTreinadorMes }

export function estadoTreinadorMes(jogo: Jogo): EstadoTreinadorMes {
  const j = jogo as JogoComTreinadorMes
  j.treinadorMes ??= { ultimo: 0, ano: jogo.epoca.ano, premios: [], meus: 0 }
  return j.treinadorMes
}

/** Atribui os prémios dos "meses" já fechados. Idempotente. Devolve os novos. */
export function avancarTreinadorMes(jogo: Jogo): PremioMes[] {
  const st = estadoTreinadorMes(jogo)
  const { epoca, mundo } = jogo
  if (st.ano !== epoca.ano) { st.ano = epoca.ano; st.ultimo = 0 }
  const novos: PremioMes[] = []
  const jogadas = epoca.jornada - 1
  while (st.ultimo + JORNADAS_MES <= jogadas) {
    const de = st.ultimo + 1, ate = st.ultimo + JORNADAS_MES
    st.ultimo = ate
    epoca.calendario.forEach((div, d) => {
      const pts = new Map<number, [number, number]>()
      for (let jn = de; jn <= ate; jn++) {
        for (const p of div[jn - 1] ?? []) {
          if (!p.jogada) continue
          const [a, b] = p.golos
          const add = (id: number, pt: number, dg: number) => { const v = pts.get(id) ?? [0, 0]; pts.set(id, [v[0] + pt, v[1] + dg]) }
          add(p.casaId, a > b ? 3 : a === b ? 1 : 0, a - b)
          add(p.foraId, b > a ? 3 : a === b ? 1 : 0, b - a)
        }
      }
      const melhor = [...pts.entries()].sort((x, y) => y[1][0] - x[1][0] || y[1][1] - x[1][1] || x[0] - y[0])[0]
      if (!melhor) return
      const pr = { ano: epoca.ano, jornada: ate, divisao: d + 1, clubeId: melhor[0], pontos: melhor[1][0] }
      st.premios.push(pr)
      novos.push(pr)
      if (pr.clubeId === jogo.clubeId && mundo.clubes[jogo.clubeId].divisao === d + 1) {
        st.meus += 1
        const c = estadoCarreira(jogo as JogoComCarreira)
        if (!c.despedido) c.confianca = Math.min(100, c.confianca + CONFIANCA_MES)
      }
    })
  }
  st.premios = st.premios.slice(-80)
  return novos
}
