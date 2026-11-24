import type { Jogo } from '../core/types'
import type { EstadoEpoca, Partida } from '../core/partida'
import { escalarAuto } from '../core/motor'
import { manterPlano } from '../core/plano'
import { gestaoIA } from '../core/ia-financas'
import { garantirStaff, staffIA } from '../core/staff-ia'
import { epocaTerminada, fecharEpoca, indisponiveisDe, novaEpoca, tabela } from '../core/epoca'
import { pagarInicioEpoca, type EpocaComInicio } from '../core/inicio-epoca'
import { bonusPatrocinio } from '../core/patrocinio'
import { registarEpocaFinancas } from '../core/previsao'
import { pagarVerbaDirecao } from '../core/investidores'
import { registarCampeao, type JogoComTaca } from '../core/taca'
import { avancarDirecao, iniciarEpocaDirecao } from '../core/direcao'
import { feriasBalneario } from '../core/balneario'
import { registarFichas } from '../core/fichas'
import { garantirRivais } from '../core/rivalidades'
import { avancarImprensa } from '../core/imprensa'
import { qualificarEuropa, type JogoComEuropa } from '../core/europa'

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
  garantirRivais(jogo.mundo)
  if (jogo.epoca) { gestaoIA(jogo.mundo, jogo.clubeId); staffIA(jogo.mundo, jogo.clubeId); feriasBalneario(jogo.mundo) }
  else garantirStaff(jogo.mundo)
  // Tabelas finais da época que acabou (o calendário antigo ainda diz quem jogou em cada divisão).
  const anterior = jogo.epoca
  const anteriores = anterior ? anterior.calendario.map((_, d) => tabela(jogo.mundo, anterior, d + 1)) : []
  jogo.epoca = novaEpoca(jogo.mundo, sementeEpoca(jogo))
  pagarInicioEpoca(jogo.mundo, jogo.epoca, anteriores)
  pagarVerbaDirecao(jogo, anteriores)
  if (anterior) {
    const bonus = bonusPatrocinio(jogo, anterior)
    const inj = (jogo.epoca as EpocaComInicio).inicio?.[jogo.clubeId]
    if (bonus && inj) { inj.bonusPatrocinio = bonus; inj.total += bonus; jogo.mundo.clubes[jogo.clubeId].dinheiro += bonus }
  }
  if (anterior) {
    const d = anteriores.findIndex((t) => t.some((l) => l.clubeId === jogo.clubeId))
    if (d >= 0) registarEpocaFinancas(jogo, anterior, d + 1, anteriores[d].findIndex((l) => l.clubeId === jogo.clubeId) + 1)
  }
  jogo.escalacao = manterPlano(escalarAuto(jogo.mundo, jogo.clubeId, indisponiveisDe(jogo.mundo, jogo.epoca, jogo.clubeId), jogo.escalacao?.formacao), jogo.escalacao)
  iniciarEpocaDirecao(jogo)
  avancarImprensa(jogo)
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
    else if (epocaTerminada(j.epoca)) { avancarDirecao(j); avancarImprensa(j); qualificarEuropa(j as JogoComEuropa); registarCampeao(j as JogoComTaca, fecharEpoca(j.mundo, j.epoca).campeoes); prepararEpoca(j); mudou = true }
    if (garantirStaff(j.mundo)) mudou = true
    if (garantirRivais(j.mundo)) mudou = true
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

/** Texto da gravação para guardar num ficheiro (cópia de segurança ou passar para outro aparelho). */
export function exportarTexto(jogo: Jogo): string {
  const dados = jogo.epoca ? { ...jogo, epoca: compactar(jogo.epoca) } : jogo
  return JSON.stringify({ app: 'mister-foot', exportado: new Date().toISOString(), jogo: dados })
}

/** Lê uma cópia de segurança. Devolve uma mensagem de erro, ou null se ficou gravada (carregar() abre-a). */
export function importarTexto(texto: string): string | null {
  let d: { app?: string; jogo?: Jogo }
  try { d = JSON.parse(texto) } catch { return 'O ficheiro não é uma gravação do Mister-foot.' }
  const j = d?.app === 'mister-foot' ? d.jogo : (d as unknown as Jogo)
  if (!j?.mundo?.clubes || j.mundo.versao !== 1 || !j.mundo.clubes[j.clubeId]) return 'O ficheiro não é uma gravação do Mister-foot.'
  try { localStorage.setItem(CHAVE, JSON.stringify(j)) } catch { return 'Não foi possível gravar neste aparelho (sem espaço?).' }
  return null
}

export function apagar(): void {
  try { localStorage.removeItem(CHAVE) } catch { /* ignora */ }
}
