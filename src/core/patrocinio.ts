// Contrato de patrocínio à escolha do mister antes da 1.ª jornada: fixo (já pago) ou por objetivos
// (metade agora, bónus no fim conforme a avaliação da direção).
import type { Jogo } from './types'
import type { EstadoEpoca } from './partida'
import type { EpocaComInicio } from './inicio-epoca'
import type { JogoComCarreira, Avaliacao } from './direcao'

/** Bónus no fim da época, em múltiplos do patrocínio fixo, por avaliação da direção. */
export const BONUS_PATROCINIO: Record<Avaliacao, number> = { superado: 1.5, cumprido: 1, quase: 0.25, falhado: 0 }

export type EpocaComPatrocinio = EpocaComInicio & { patrocinioObjetivos?: { clubeId: number; base: number } }

export function podeEscolherPatrocinio(jogo: Jogo): boolean {
  const ep = jogo.epoca as EpocaComPatrocinio
  return jogo.epoca.jornada === 1 && !!ep.inicio?.[jogo.clubeId]?.patrocinio && !ep.patrocinioObjetivos
}

/** Troca o patrocínio fixo pelo contrato por objetivos: devolve metade agora. */
export function patrocinioPorObjetivos(jogo: Jogo): boolean {
  if (!podeEscolherPatrocinio(jogo)) return false
  const ep = jogo.epoca as EpocaComPatrocinio
  const inj = ep.inicio![jogo.clubeId]
  const base = inj.patrocinio
  const devolve = Math.round(base / 2)
  inj.patrocinio -= devolve
  inj.total -= devolve
  jogo.mundo.clubes[jogo.clubeId].dinheiro -= devolve
  ep.patrocinioObjetivos = { clubeId: jogo.clubeId, base }
  return true
}

/** Bónus a pagar pela época anterior (chamar entre épocas, depois da avaliação da direção). */
export function bonusPatrocinio(jogo: Jogo, anterior: EstadoEpoca): number {
  const po = (anterior as EpocaComPatrocinio).patrocinioObjetivos
  const av = (jogo as JogoComCarreira).carreira?.ultimaAvaliacao
  if (!po || !av || av.ano !== anterior.ano || po.clubeId !== jogo.clubeId) return 0
  return Math.round((po.base * BONUS_PATROCINIO[av.avaliacao]) / 1000) * 1000
}
