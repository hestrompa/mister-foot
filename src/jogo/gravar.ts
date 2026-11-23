import type { Jogo } from '../core/types'
import type { EstadoEpoca, Partida } from '../core/partida'
import { escalarAuto } from '../core/motor'
import { gestaoIA } from '../core/ia-financas'
import { garantirStaff, staffIA } from '../core/staff-ia'
import { epocaTerminada, fecharEpoca, indisponiveisDe, novaEpoca } from '../core/epoca'
import { registarCampeao, type JogoComTaca } from '../core/taca'
import { avancarDirecao, iniciarEpocaDirecao } from '../core/direcao'
import { registarFichas } from '../core/fichas'

const CHAVE = 'mister-foot:jogo'

/** Partidas antigas guardam só os eventos de golo (o relato completo ocupa demasiado). */
function compactar(epoca: EstadoEpoca): EstadoEpoca {
  const limite = epoca.jornada - 1
  const calendario = epoca.calendario.map((div) =>
    div.map((jornada) =>
      jornada.map((p): Partida =>
        p.jornada < limite && (p.onzes || p.eventos.some((e) => e.tipo !== 'golo'))
          ? { ...p, eventos: p.eventos.filter((e) => e.tipo === 'golo'), onzes: undefined }
          : p,
      ),
    ),
  )
  return { ...epoca, calendario }
}

export function gravar(jogo: Jogo): boolean {
  try {
    const dados = jogo.epoca ? { ...jogo, epoca: compactar(jogo.epoca) } : jogo
    localStorage.setItem(CHAVE, JSON.stringify(dados))
    return true
  } catch {
    return false
  }
}

/** Semente para uma nova época, derivada do mundo. */
export function sementeEpoca(jogo: Pick<Jogo, 'mundo'>): number {
  return ((jogo.mundo.semente * 31 + jogo.mundo.epoca * 7919) >>> 0) || 1
}

/** Cria época e escalação para um jogo novo ou para uma gravação antiga. */
export function prepararEpoca(jogo: Jogo): Jogo {
  // Entre épocas (não num jogo novo), os outros clubes decidem obras e empréstimos.
  if (jogo.epoca) { gestaoIA(jogo.mundo, jogo.clubeId); staffIA(jogo.mundo, jogo.clubeId) }
  else garantirStaff(jogo.mundo)
  jogo.epoca = novaEpoca(jogo.mundo, sementeEpoca(jogo))
  jogo.escalacao = escalarAuto(jogo.mundo, jogo.clubeId, indisponiveisDe(jogo.mundo, jogo.epoca, jogo.clubeId), jogo.escalacao?.formacao)
  iniciarEpocaDirecao(jogo)
  return jogo
}

export function carregar(): Jogo | null {
  try {
    const s = localStorage.getItem(CHAVE)
    if (!s) return null
    const j = JSON.parse(s) as Jogo
    if (j?.mundo?.versao !== 1) return null
    let mudou = false
    if (j.epoca && registarFichas(j)) mudou = true
    if (!j.epoca) { prepararEpoca(j); mudou = true }
    else if (epocaTerminada(j.epoca)) { avancarDirecao(j); registarCampeao(j as JogoComTaca, fecharEpoca(j.mundo, j.epoca).campeoes); prepararEpoca(j); mudou = true }
    if (garantirStaff(j.mundo)) mudou = true
    if (!j.escalacao) {
      j.escalacao = escalarAuto(j.mundo, j.clubeId, indisponiveisDe(j.mundo, j.epoca, j.clubeId))
      mudou = true
    }
    if (mudou) gravar(j)
    return j
  } catch {
    return null
  }
}

export function apagar(): void {
  try { localStorage.removeItem(CHAVE) } catch { /* ignora */ }
}
