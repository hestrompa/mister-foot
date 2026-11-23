// Balneário do utilizador: capitão, promessas de tempo de jogo, conflitos e respostas do treinador.
// Avança jornada a jornada depois de concluirJornada (idempotente, como o mercado).
import { createRng } from './rng'
import { mistura } from './staff'
import { indisponiveisDe } from './epoca'
import { porAVenda } from './mercado'
import {
  anotar, capitaoDe, clamp, estadoBalneario, estatutos, lideranca, liderNatural, titularesDe, minutosJogados, moralDe, mudarMoral,
  mudarMoralJogador, type ClubeComCapitao, type Conflito, type JogoComBalneario,
} from './balneario'
import type { Partida } from './partida'
import { definirFadiga, definirFragil, fadigaDe } from './lesoes'

export interface Resultado { ok: boolean; texto: string }

/** Promessas ativas ao mesmo tempo. */
export const MAX_PROMESSAS = 3
/** Uma promessa: titular em 3 dos próximos 5 jogos do campeonato. */
export const PROMESSA_JOGOS = 3
export const PROMESSA_JANELA = 5

function meuJogo(jogo: JogoComBalneario, jornada: number): Partida | undefined {
  for (const div of jogo.epoca.calendario) {
    const p = div[jornada - 1]?.find((x) => x.casaId === jogo.clubeId || x.foraId === jogo.clubeId)
    if (p) return p
  }
  return undefined
}

/** Avança o balneário até à jornada atual: tempo de jogo, promessas, conflitos novos e por resolver. */
export function avancarBalneario(jogo: JogoComBalneario): void {
  const st = estadoBalneario(jogo)
  while (st.jornada < jogo.epoca.jornada) {
    st.jornada += 1
    passo(jogo, st.jornada - 1)
  }
}

function passo(jogo: JogoComBalneario, jornada: number) {
  const st = estadoBalneario(jogo)
  const { mundo } = jogo
  const c = mundo.clubes[jogo.clubeId]
  const p = meuJogo(jogo, jornada)
  const titulares = new Set<number>()
  if (p?.jogada) {
    const lado = p.casaId === jogo.clubeId ? 0 : 1
    for (const id of titularesDe(p)?.[lado] ?? []) titulares.add(id)
    for (const [id, m] of minutosJogados(p)) {
      if (mundo.jogadores[id]?.clubeId !== jogo.clubeId || m <= 0) continue
      st.jogos[id] = (st.jogos[id] ?? 0) + 1
      if (titulares.has(id)) st.titular[id] = (st.titular[id] ?? 0) + 1
    }
  }

  // Promessas: conta titularidades e avalia no fim do prazo.
  for (const pr of st.promessas.slice()) {
    const j = mundo.jogadores[pr.jogadorId]
    if (!j || j.clubeId !== jogo.clubeId) { st.promessas = st.promessas.filter((x) => x !== pr); continue }
    if (titulares.has(pr.jogadorId)) pr.feitos += 1
    if (pr.feitos >= pr.jogos) {
      st.promessas = st.promessas.filter((x) => x !== pr)
      mudarMoralJogador(jogo, j.id, 8, `${j.curto} sente que cumpriste a palavra.`)
    } else if (jornada + 1 >= pr.ate || pr.ano !== jogo.epoca.ano) {
      st.promessas = st.promessas.filter((x) => x !== pr)
      mudarMoralJogador(jogo, j.id, -25, `Promessa quebrada: ${j.curto} jogou ${pr.feitos} de ${pr.jogos} jogos prometidos.`)
      mudarMoral(jogo, jogo.clubeId, -2, 'O balneário não gostou de ver uma promessa quebrada.')
    }
  }

  // Conflitos que ficaram sem resposta: o jogador sente-se ignorado.
  for (const k of st.conflitos.slice()) {
    if (k.jornada >= jornada + 1) continue
    st.conflitos = st.conflitos.filter((x) => x !== k)
    const j = mundo.jogadores[k.jogadorId]
    if (j && j.clubeId === jogo.clubeId) {
      mudarMoralJogador(jogo, j.id, -5, `${j.curto} ficou à espera de uma resposta e sentiu-se ignorado.`)
      mudarMoral(jogo, jogo.clubeId, -1, '')
    }
  }

  // Conflitos novos: no máximo um por jornada, de quem está mesmo em baixo.
  const rng = createRng(mistura(mundo.semente, jogo.epoca.ano, jornada, 0xba1))
  const fora = indisponiveisDe(mundo, jogo.epoca, jogo.clubeId)
  const est = estatutos(mundo, jogo.clubeId)
  const cap = capitaoDe(mundo, jogo.clubeId)
  const lid = cap ? lideranca(mundo, mundo.jogadores[cap]) : 0
  const prometidos = new Set(st.promessas.map((x) => x.jogadorId))
  const tristes = c.plantel
    .map((id) => mundo.jogadores[id])
    .filter((j) => j && moralDe(j) < 32 && !fora.has(j.id) && !st.conflitos.some((k) => k.jogadorId === j.id))
    .sort((a, b) => moralDe(a) - moralDe(b) || a.id - b.id)
  // Um bom capitão resolve muita coisa antes de chegar ao treinador; quantos mais tristes, mais provável.
  const q = 0.12 * (1 - 0.4 * lid)
  if (tristes.length && rng.chance(1 - Math.pow(1 - q, tristes.length))) {
    const j = tristes[0]
    const e = est.get(j.id) ?? 'reserva'
    const tempo = !prometidos.has(j.id) && (e === 'titular' || e === 'rotacao') && (st.titular[j.id] ?? 0) < Math.max(2, jornada * 0.5)
    const k: Conflito = tempo
      ? { id: st.proximoId++, jogadorId: j.id, motivo: 'tempo', ano: jogo.epoca.ano, jornada: jornada + 1, texto: `${j.nome} queixa-se de falta de tempo de jogo e pede para falar contigo.` }
      : moralDe(j) < 22 && j.idade >= 24
        ? { id: st.proximoId++, jogadorId: j.id, motivo: 'saida', ano: jogo.epoca.ano, jornada: jornada + 1, texto: `${j.nome} está farto e o empresário diz que ele quer sair.` }
        : { id: st.proximoId++, jogadorId: j.id, motivo: 'moral', ano: jogo.epoca.ano, jornada: jornada + 1, texto: `${j.nome} chegou atrasado ao treino e discutiu com um colega.` }
    st.conflitos.push(k)
    anotar(jogo, k.texto, 'mau', j.id)
  }
}

// ---------- Ações do treinador ----------

export type AcaoConflito = 'prometer' | 'conversar' | 'multar' | 'vender' | 'ignorar'

export function acoesPossiveis(k: Conflito): AcaoConflito[] {
  if (k.motivo === 'tempo') return ['prometer', 'conversar', 'vender']
  if (k.motivo === 'saida') return ['conversar', 'vender', 'ignorar']
  return ['conversar', 'multar', 'ignorar']
}

export const NOME_ACAO: Record<AcaoConflito, string> = {
  prometer: 'Prometer jogos',
  conversar: 'Conversar',
  multar: 'Multar',
  vender: 'Pôr à venda',
  ignorar: 'Ignorar',
}

/** Probabilidade de uma conversa correr bem: o capitão e a experiência do jogador ajudam. */
export function chanceConversa(jogo: JogoComBalneario, jogadorId: number): number {
  const { mundo } = jogo
  const j = mundo.jogadores[jogadorId]
  const cap = capitaoDe(mundo, jogo.clubeId)
  const lid = cap && cap !== jogadorId ? lideranca(mundo, mundo.jogadores[cap]) : 0.2
  return clamp(0.35 + 0.35 * lid + (j && j.idade >= 28 ? 0.1 : 0) + (moralDe(j) - 20) / 100, 0.15, 0.85)
}

/** Multa: uma semana de salário. */
export function valorMulta(salarioMensal: number): number {
  return Math.round(salarioMensal / 4 / 10) * 10
}

export function resolverConflito(jogo: JogoComBalneario, conflitoId: number, acao: AcaoConflito): Resultado {
  const st = estadoBalneario(jogo)
  const k = st.conflitos.find((x) => x.id === conflitoId)
  if (!k) return { ok: false, texto: 'Esse assunto já está resolvido.' }
  const j = jogo.mundo.jogadores[k.jogadorId]
  st.conflitos = st.conflitos.filter((x) => x !== k)
  if (!j || j.clubeId !== jogo.clubeId) return { ok: false, texto: 'Esse jogador já não está no clube.' }
  switch (acao) {
    case 'prometer': {
      const r = prometer(jogo, j.id)
      if (!r.ok) st.conflitos.push(k)
      return r
    }
    case 'conversar': {
      const rng = createRng(mistura(jogo.mundo.semente, jogo.epoca.ano, jogo.epoca.jornada, j.id, 0xc0a))
      if (rng.chance(chanceConversa(jogo, j.id))) {
        mudarMoralJogador(jogo, j.id, 10, `A conversa com ${j.curto} correu bem.`)
        return { ok: true, texto: `${j.curto} ouviu-te e saiu da conversa mais tranquilo.` }
      }
      mudarMoralJogador(jogo, j.id, -6, `A conversa com ${j.curto} correu mal.`)
      return { ok: true, texto: `A conversa correu mal: ${j.curto} saiu ainda mais chateado.` }
    }
    case 'multar': {
      const v = valorMulta(j.salario)
      jogo.mundo.clubes[jogo.clubeId].dinheiro += v
      mudarMoralJogador(jogo, j.id, -10, `${j.curto} foi multado em ${v.toLocaleString('pt-PT')} €.`)
      mudarMoral(jogo, jogo.clubeId, 1, '')
      return { ok: true, texto: `${j.curto} foi multado. O resto do plantel percebeu a mensagem.` }
    }
    case 'vender': {
      const r = porAVenda(jogo, j.id, Math.max(j.valor, 50))
      if (!r.ok) { st.conflitos.push(k); return r }
      mudarMoralJogador(jogo, j.id, 6, `${j.curto} agradece a abertura para sair.`)
      return { ok: true, texto: `${j.curto} está na lista de vendas e ficou mais calmo.` }
    }
    case 'ignorar': {
      if (k.motivo === 'saida') {
        mudarMoralJogador(jogo, j.id, -8, `${j.curto} não gostou de ficar sem resposta ao pedido de saída.`)
        return { ok: true, texto: `${j.curto} vai continuar contrariado.` }
      }
      mudarMoralJogador(jogo, j.id, 2, '')
      mudarMoral(jogo, jogo.clubeId, -2, `O plantel acha que ${j.curto} faz o que quer.`)
      return { ok: true, texto: `Deixaste passar. Alguns colegas não gostaram.` }
    }
  }
}

/** Prometer tempo de jogo: titular em 3 dos próximos 5 jogos do campeonato. */
export function prometer(jogo: JogoComBalneario, jogadorId: number): Resultado {
  const st = estadoBalneario(jogo)
  const j = jogo.mundo.jogadores[jogadorId]
  if (!j || j.clubeId !== jogo.clubeId) return { ok: false, texto: 'Esse jogador não é teu.' }
  if (st.promessas.some((p) => p.jogadorId === jogadorId)) return { ok: false, texto: `Já prometeste jogos a ${j.curto}.` }
  if (st.promessas.length >= MAX_PROMESSAS) return { ok: false, texto: `Já tens ${MAX_PROMESSAS} promessas por cumprir.` }
  const restam = jogo.epoca.totalJornadas - jogo.epoca.jornada + 1
  if (restam < PROMESSA_JOGOS) return { ok: false, texto: 'Já não há jogos suficientes esta época.' }
  st.promessas.push({ jogadorId, ano: jogo.epoca.ano, jogos: PROMESSA_JOGOS, feitos: 0, ate: jogo.epoca.jornada + PROMESSA_JANELA })
  mudarMoralJogador(jogo, jogadorId, 12, `Prometeste a ${j.curto} que vai ser titular.`)
  return { ok: true, texto: `Prometeste a ${j.curto} ${PROMESSA_JOGOS} jogos a titular nos próximos ${PROMESSA_JANELA}.` }
}

/** Escolher o capitão. Tirar a braçadeira a alguém custa moral a esse jogador. */
export function definirCapitao(jogo: JogoComBalneario, jogadorId: number): Resultado {
  const { mundo } = jogo
  const c = mundo.clubes[jogo.clubeId] as ClubeComCapitao
  const j = mundo.jogadores[jogadorId]
  if (!j || j.clubeId !== jogo.clubeId) return { ok: false, texto: 'Esse jogador não é teu.' }
  const antigo = capitaoDe(mundo, c.id)
  if (antigo === jogadorId) return { ok: false, texto: `${j.curto} já é o capitão.` }
  c.capitaoId = jogadorId
  if (antigo && mundo.jogadores[antigo]) {
    const a = mundo.jogadores[antigo]
    mudarMoralJogador(jogo, antigo, -12, `${a.curto} perdeu a braçadeira de capitão.`)
    // Tirar a braçadeira ao líder natural mexe com o balneário.
    if (antigo === liderNatural(mundo, c.id)) mudarMoral(jogo, c.id, -1, '')
  }
  mudarMoralJogador(jogo, jogadorId, 10, `${j.curto} é o novo capitão.`)
  return { ok: true, texto: `${j.curto} é o novo capitão.` }
}

// ---------- Departamento médico ----------

/** Pode voltar antes do tempo: lesões com 1 ou 2 jogos por cumprir (não fraturas). */
export function podeAntecipar(jogo: JogoComBalneario, jogadorId: number): boolean {
  const ind = jogo.epoca.indisponiveis[jogadorId]
  return !!ind && ind.motivo === 'lesao' && ind.jogos > 0 && ind.jogos <= 2 && ind.tipo !== 'fratura'
}

/** Regresso antecipado: joga já, mas fica frágil (risco de recaída alto) e sem ritmo durante 3 jogos. */
export function anteciparRegresso(jogo: JogoComBalneario, jogadorId: number): Resultado {
  const j = jogo.mundo.jogadores[jogadorId]
  if (!j || j.clubeId !== jogo.clubeId) return { ok: false, texto: 'Esse jogador não é teu.' }
  if (!podeAntecipar(jogo, jogadorId)) return { ok: false, texto: `O departamento médico não deixa ${j.curto} voltar já.` }
  delete jogo.epoca.indisponiveis[jogadorId]
  definirFragil(j, 3)
  definirFadiga(j, Math.max(fadigaDe(j), 50))
  anotar(jogo, `${j.curto} volta antes do tempo, contra a opinião do médico.`, 'info', j.id)
  return { ok: true, texto: `${j.curto} está disponível, mas o risco de recaída é alto nos próximos 3 jogos.` }
}
