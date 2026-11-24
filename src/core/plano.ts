// Plano de jogo: marcação, bolas paradas e instruções individuais.
//
// Nada aqui dá golos de borla: cada escolha muda o peso dos atributos dos jogadores no motor.
// Um esquema que encaixa no plantel (cantos à área com cabeceadores fortes, pressão alta com
// gente rápida e com físico) rende; um que não encaixa custa. Sem plano, o motor joga como antes.
import type { Jogador, Mundo, Posicao } from './types'
import type { Escalacao } from './partida'
import { atributo, atributosDe, fatores } from './atributos'

export type Marcacao = 'zona' | 'homem' | 'pressao'
export type EsquemaCanto = 'area' | 'curto' | 'entrada'
export type EsquemaLivre = 'direto' | 'cruzar'
export type Instrucao = 'subir' | 'segurar' | 'rematar' | 'marcar'

export interface PlanoJogo {
  marcacao?: Marcacao
  canto?: EsquemaCanto
  livre?: EsquemaLivre
  /** Quem bate livres diretos e penáltis (se estiver em campo). */
  batedor?: number
  /** Instruções individuais por id de jogador (sem entrada = jogo normal). */
  instrucoes?: Record<number, Instrucao>
  /** Adversário marcado de perto por quem tem a instrução 'marcar'. */
  alvo?: number
}

export const NOME_MARCACAO: Record<Marcacao, string> = { zona: 'À zona', homem: 'Individual', pressao: 'Pressão alta' }
export const DICA_MARCACAO: Record<Marcacao, string> = {
  zona: 'Cada um guarda o seu espaço. Seguro contra cruzamentos, sem riscos.',
  homem: 'Cada defesa cola a um avançado. Rende com bons defensores; sofre com avançados mais rápidos do que os teus centrais.',
  pressao: 'Recuperar a bola lá à frente: mais bola e mais remates, mas cansa e deixa espaço nas costas. Pede velocidade e físico.',
}
export const NOME_CANTO: Record<EsquemaCanto, string> = { area: 'Cruzar para a área', curto: 'Canto curto', entrada: 'À entrada da área' }
export const DICA_CANTO: Record<EsquemaCanto, string> = {
  area: 'Bola ao segundo poste para os mais fortes de cabeça (físico).',
  curto: 'Combinar com passe e entrar na área com a bola controlada (passe).',
  entrada: 'Bola atrasada para quem remata bem de fora (remate).',
}
export const NOME_LIVRE: Record<EsquemaLivre, string> = { direto: 'Remate direto', cruzar: 'Cruzar para a área' }
export const NOME_INSTRUCAO: Record<Instrucao, string> = { subir: 'Apoiar o ataque', segurar: 'Ficar atrás', rematar: 'Rematar de longe', marcar: 'Marcar de perto' }
export const DICA_INSTRUCAO: Record<Instrucao, string> = {
  subir: 'Aparece mais na área e remata mais, mas ajuda menos atrás.',
  segurar: 'Guarda a posição: defende mais, ataca menos.',
  rematar: 'Tenta de fora da área sempre que pode (só compensa com bom remate).',
  marcar: 'Cola ao jogador adversário escolhido: tira-lhe rendimento, mas ataca menos.',
}

/**
 * Efeito de cada instrução: fração da força do jogador que passa da defesa para o ataque (ou o contrário)
 * e peso na escolha de quem remata. Em média é soma zero; ganha quem dá a instrução certa ao jogador certo.
 */
export const EFEITO_INSTRUCAO: Record<Instrucao, { ataque: number; defesa: number; remate: number }> = {
  subir: { ataque: 0.3, defesa: -0.3, remate: 1.6 },
  segurar: { ataque: -0.3, defesa: 0.3, remate: 0.45 },
  rematar: { ataque: 0, defesa: 0, remate: 1.5 },
  marcar: { ataque: -0.15, defesa: 0, remate: 0.5 },
}

/** Atributo de ataque principal de um jogador (o que um marcador tem de anular). */
export function perigoDe(j: Jogador): number {
  const a = atributosDe(j)
  return j.posicao === 'MED' ? (a.pas + a.rem) / 2 : j.posicao === 'AV' ? (a.rem + a.vel) / 2 : (a.fis + a.rem) / 2
}

/**
 * Quanto o alvo de uma marcação individual rende (1 = livre): um bom defensor com velocidade
 * tira-lhe até cerca de 20%; um marcador fraco quase nada.
 */
export function fatorMarcado(marcador: Jogador, alvo: Jogador): number {
  const m = 0.7 * atributo(marcador, 'def') + 0.3 * atributo(marcador, 'vel')
  const r = m / Math.max(1, perigoDe(alvo))
  return Math.max(0.75, Math.min(0.97, 1 - 0.17 * r))
}

/** Média de um fator de atributo (face à força) num grupo de jogadores. */
export function mediaFator(js: Jogador[], a: 'vel' | 'fis' | 'def' | 'pas' | 'rem'): number {
  return js.length ? js.reduce((s, j) => s + fatores(j)[a], 0) / js.length : 1
}

/** Média de um atributo absoluto num grupo. */
export function mediaAtributo(js: Jogador[], a: 'vel' | 'fis' | 'def' | 'pas' | 'rem'): number {
  return js.length ? js.reduce((s, j) => s + atributo(j, a), 0) / js.length : 50
}

/** Jogadores de um onze por posição (pela posição natural). */
export function porPosicao(mundo: Mundo, ids: number[], pos: Posicao): Jogador[] {
  return ids.map((id) => mundo.jogadores[id]).filter((j): j is Jogador => !!j && j.posicao === pos)
}

/** Os n melhores de um grupo num atributo. */
export function melhores(js: Jogador[], a: 'vel' | 'fis' | 'def' | 'pas' | 'rem', n: number): Jogador[] {
  return js.slice().sort((x, y) => atributo(y, a) - atributo(x, a) || x.id - y.id).slice(0, n)
}

/** Copia o plano para uma escalação nova (troca de formação, escalação automática), limpando quem saiu. */
export function manterPlano(nova: Escalacao, antiga: Escalacao | undefined): Escalacao {
  const p = antiga?.plano
  const out: Escalacao = { ...nova, postura: antiga?.postura ?? nova.postura }
  if (p) out.plano = p
  return out
}

/** Instrução de um jogador num plano (ou undefined). */
export function instrucaoDe(plano: PlanoJogo | undefined, id: number): Instrucao | undefined {
  return plano?.instrucoes?.[id]
}

/** Muda a instrução de um jogador; só pode haver um a marcar de perto. */
export function comInstrucao(plano: PlanoJogo | undefined, id: number, inst: Instrucao | undefined): PlanoJogo {
  const instrucoes = { ...(plano?.instrucoes ?? {}) }
  if (inst === 'marcar') for (const k of Object.keys(instrucoes)) if (instrucoes[+k] === 'marcar') delete instrucoes[+k]
  if (inst) instrucoes[id] = inst
  else delete instrucoes[id]
  return { ...(plano ?? {}), instrucoes }
}

// ---------------------------------------------------------------------------------------------
// Plano dos treinadores da IA: lê o próprio plantel e o adversário, sem saber nada escondido.

/**
 * Plano de jogo da IA. Escolhe o que melhor encaixa nos atributos do seu onze e no adversário,
 * com regras simples (um bom treinador humano faz melhor, mas não muito melhor).
 */
export function planoIA(mundo: Mundo, esc: Escalacao, escAdv: Escalacao | undefined): PlanoJogo {
  const ids = esc.titulares
  const defs = porPosicao(mundo, ids, 'DEF')
  const meds = porPosicao(mundo, ids, 'MED')
  const avs = porPosicao(mundo, ids, 'AV')
  const campo = [...defs, ...meds, ...avs]
  const avAdv = escAdv ? porPosicao(mundo, escAdv.titulares, 'AV') : []
  // Marcação: pressão com gente rápida e com físico; individual com defesas bons a defender e mais rápidos do que os avançados deles.
  const pressao = (mediaFator(campo, 'fis') + mediaFator(campo, 'vel')) / 2
  const velDef = mediaAtributo(defs, 'vel'), velAvAdv = avAdv.length ? mediaAtributo(avAdv, 'vel') : velDef
  let marcacao: Marcacao = 'zona'
  if (pressao >= 1.03 && esc.postura !== 'defensiva') marcacao = 'pressao'
  else if (mediaFator(defs, 'def') >= 1.03 && velDef >= velAvAdv) marcacao = 'homem'
  // Cantos: o que os jogadores fazem melhor.
  const cab = mediaFator(melhores(campo, 'fis', 3), 'fis')
  const pas = mediaFator(melhores(campo, 'pas', 2), 'pas')
  const rem = mediaFator(melhores([...meds, ...avs], 'rem', 2), 'rem')
  const canto: EsquemaCanto = cab >= pas && cab >= rem ? 'area' : pas >= rem ? 'curto' : 'entrada'
  const bat = melhores([...meds, ...avs, ...defs], 'rem', 1)[0]
  const livre: EsquemaLivre = bat && fatores(bat).rem >= cab ? 'direto' : 'cruzar'
  const plano: PlanoJogo = { marcacao, canto, livre, ...(bat ? { batedor: bat.id } : {}) }
  // Quem joga à defesa contra um craque põe o médio mais defensivo a marcá-lo.
  if (escAdv && esc.postura === 'defensiva') {
    const craque = escAdv.titulares.map((id) => mundo.jogadores[id]).find((j) => j?.craque && j.posicao !== 'GR' && j.posicao !== 'DEF')
    const marcador = melhores(meds, 'def', 1)[0]
    if (craque && marcador) {
      plano.alvo = craque.id
      plano.instrucoes = { [marcador.id]: 'marcar' }
    }
  }
  return plano
}
