// Notícias da jornada e conferências de imprensa (escolhas que mexem na moral do plantel e na confiança
// da direção, e promessas que se pagam no jogo seguinte). Dérbis e clássicos pesam mais.
// Também faz avançar os recordes (recordes.ts). Determinístico: sementes da época e da jornada.
import { createRng } from './rng'
import type { Jogo } from './types'
import type { Partida } from './partida'
import { epocaTerminada, tabela } from './epoca'
import { NOMES_DIVISAO } from './mundo'
import { estadoCarreira, type JogoComCarreira } from './direcao'
import { mudarMoral, mudarMoralJogador } from './balneario'
import { rivalidade } from './rivalidades'
import { fecharEpocaRecordes, processarJornada, serieDe, textoRecorde, type RecordeBatido } from './recordes'

export type TipoNoticia = 'meu' | 'liga' | 'derbi' | 'recorde' | 'imprensa' | 'direcao' | 'epoca'

export interface Noticia {
  n: number
  ano: number
  jornada: number
  tipo: TipoNoticia
  titulo: string
  texto?: string
}

export interface OpcaoConferencia {
  texto: string
  /** Moral de todo o plantel. */
  moral: number
  /** Confiança da direção. */
  confianca: number
  /** Moral de um jogador (o craque, numa pergunta sobre ele). */
  moralJogador?: number
  promessa?: 'vencer' | 'naoPerder'
  /** Título da notícia que sai no dia seguinte. */
  manchete: string
}

export interface Conferencia {
  ano: number
  jornada: number
  tema: 'inicio' | 'classico' | 'derbi' | 'crise' | 'embalo' | 'grande' | 'craque' | 'balneario'
  pergunta: string
  opcoes: OpcaoConferencia[]
  jogadorId?: number
  resposta?: number
}

export interface Promessa { ano: number; jornada: number; tipo: 'vencer' | 'naoPerder'; adversario: string }

export interface EstadoImprensa {
  ano: number
  /** Última jornada já noticiada. */
  jornada: number
  seq: number
  lidaAte: number
  noticias: Noticia[]
  conferencia?: Conferencia
  promessa?: Promessa
  /** Líder da minha divisão na última jornada noticiada. */
  liderAnterior?: number
  /** Épocas cujo fim já foi noticiado. */
  fimNoticiado?: number[]
}

export type JogoComImprensa = Jogo & { imprensa?: EstadoImprensa }

const MAX_NOTICIAS = 80

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

function semente(...xs: number[]): number {
  let h = 0x2545f491
  for (const x of xs) h = Math.imul(h ^ (x >>> 0), 0x9e3779b1) ^ (h >>> 15)
  return (h >>> 0) || 1
}

const nomeDiv = (n: number) => NOMES_DIVISAO[n - 1] ?? `${n}.ª Divisão`

export function estadoImprensa(jogo: Jogo): EstadoImprensa {
  const j = jogo as JogoComImprensa
  j.imprensa ??= { ano: jogo.epoca.ano, jornada: jogo.epoca.jornada - 1, seq: 0, lidaAte: 0, noticias: [] }
  return j.imprensa
}

/** Notícia vinda de fora da imprensa (investidores, por exemplo), na jornada que acabou de passar. */
export function noticiaExtra(jogo: Jogo, tipo: TipoNoticia, titulo: string, texto?: string): void {
  publicar(estadoImprensa(jogo), { ano: jogo.epoca.ano, jornada: Math.max(1, jogo.epoca.jornada - 1), tipo, titulo, texto })
}

function publicar(st: EstadoImprensa, n: Omit<Noticia, 'n'>) {
  st.seq += 1
  st.noticias.push({ ...n, n: st.seq })
  if (st.noticias.length > MAX_NOTICIAS) st.noticias.splice(0, st.noticias.length - MAX_NOTICIAS)
}

export function noticiasPorLer(jogo: Jogo): number {
  const st = (jogo as JogoComImprensa).imprensa
  return st ? st.noticias.filter((n) => n.n > st.lidaAte).length : 0
}

export function marcarLidas(jogo: Jogo): void {
  const st = estadoImprensa(jogo)
  st.lidaAte = st.seq
}

/** Muda a confiança da direção (se o mister não estiver despedido) e deixa uma mensagem. */
function mexerConfianca(jogo: Jogo, delta: number, mensagem?: string) {
  if (!delta) return
  const c = estadoCarreira(jogo as JogoComCarreira)
  if (c.despedido) return
  c.confianca = clamp(c.confianca + delta, 0, 100)
  if (mensagem) {
    c.mensagens.push({ ano: jogo.epoca.ano, jornada: jogo.epoca.jornada - 1, texto: mensagem })
    c.mensagens = c.mensagens.slice(-12)
  }
}

function minhaDaJornada(jogo: Jogo, jornada: number): Partida | undefined {
  const div = jogo.mundo.clubes[jogo.clubeId].divisao
  return jogo.epoca.calendario[div - 1]?.[jornada - 1]?.find((p) => p.casaId === jogo.clubeId || p.foraId === jogo.clubeId)
}

/** Resultado do ponto de vista de um clube. */
function resultado(p: Partida, clubeId: number): { m: number; s: number; r: 'V' | 'E' | 'D' } {
  const [m, s] = p.casaId === clubeId ? p.golos : [p.golos[1], p.golos[0]]
  return { m, s, r: m > s ? 'V' : m < s ? 'D' : 'E' }
}

function placar(jogo: Jogo, p: Partida): string {
  const n = (id: number) => jogo.mundo.clubes[id]?.nome ?? '?'
  return `${n(p.casaId)} ${p.golos[0]}-${p.golos[1]} ${n(p.foraId)}`
}

/** Notícias e efeitos de uma jornada acabada de jogar. */
function noticiarJornada(jogo: Jogo, st: EstadoImprensa, jn: number, batidos: RecordeBatido[]) {
  const { mundo, epoca } = jogo
  const ano = epoca.ano
  const meu = mundo.clubes[jogo.clubeId]
  const div = meu.divisao
  const partidas = epoca.calendario[div - 1]?.[jn - 1] ?? []
  const nome = (id: number) => mundo.clubes[id]?.nome ?? '?'
  const add = (tipo: TipoNoticia, titulo: string, texto?: string) => publicar(st, { ano, jornada: jn, tipo, titulo, texto })

  // O meu jogo.
  const p = minhaDaJornada(jogo, jn)
  if (p?.jogada) {
    const advId = p.casaId === jogo.clubeId ? p.foraId : p.casaId
    const { r } = resultado(p, jogo.clubeId)
    const riv = rivalidade(meu, mundo.clubes[advId])
    add(riv ? 'derbi' : 'meu', `${riv ? `${riv.nome}: ` : ''}${placar(jogo, p)}`, p.porque)
    // Pressão do dérbi: a direção e o balneário sentem mais.
    if (riv) {
      const peso = riv.tipo === 'classico' ? 1 : 0.5
      if (r === 'V') {
        mexerConfianca(jogo, Math.round(4 * peso), `Ganhar o ${riv.nome} deixou a direção muito satisfeita.`)
        mudarMoral(jogo, jogo.clubeId, Math.round(4 * peso), `vitória no ${riv.nome}`)
        mudarMoral(jogo, advId, -Math.round(3 * peso), `derrota no ${riv.nome}`)
      } else if (r === 'D') {
        mexerConfianca(jogo, -Math.round(6 * peso), `Perder o ${riv.nome} não se perdoa. Os adeptos estão furiosos.`)
        mudarMoral(jogo, jogo.clubeId, -Math.round(4 * peso), `derrota no ${riv.nome}`)
        mudarMoral(jogo, advId, Math.round(3 * peso), `vitória no ${riv.nome}`)
      }
    }
    // Promessa da conferência.
    const pr = st.promessa
    if (pr && pr.ano === ano && pr.jornada === jn) {
      const cumpriu = pr.tipo === 'vencer' ? r === 'V' : r !== 'D'
      if (cumpriu) {
        mexerConfianca(jogo, pr.tipo === 'vencer' ? 4 : 2, 'Prometeu e cumpriu. A direção gosta de treinadores de palavra.')
        mudarMoral(jogo, jogo.clubeId, 2, 'promessa cumprida')
        add('imprensa', `Promessa cumprida: o mister tinha dito que ${pr.tipo === 'vencer' ? 'ganhava' : 'não perdia'} com o ${pr.adversario}`)
      } else {
        const custo = pr.tipo === 'vencer' ? (r === 'E' ? 2 : 5) : 4
        mexerConfianca(jogo, -custo, 'Promessas falhadas na imprensa deixam a direção desconfortável.')
        mudarMoral(jogo, jogo.clubeId, -2, 'promessa falhada')
        add('imprensa', `Promessa falhada: o mister garantiu que ${pr.tipo === 'vencer' ? 'ganhava' : 'não perdia'} com o ${pr.adversario}`)
      }
      st.promessa = undefined
    } else if (pr && (pr.ano !== ano || pr.jornada < jn)) st.promessa = undefined
    // Séries do meu clube.
    const se = serieDe(jogo, jogo.clubeId)
    if (se.v === 3 || se.v === 5 || se.v === 8) add('meu', `${meu.nome} soma ${se.v} vitórias seguidas`)
    if (se.d === 3 || se.d === 5) add('meu', `Crise no ${meu.nome}: ${se.d} derrotas seguidas`)
  }

  // Dérbis dos outros na minha divisão.
  for (const q of partidas) {
    if (q === p || !q.jogada) continue
    const riv = rivalidade(mundo.clubes[q.casaId], mundo.clubes[q.foraId])
    if (riv) add('derbi', `${riv.nome}: ${placar(jogo, q)}`)
  }

  // Goleadas: na minha divisão a partir de 4 golos de diferença, nas outras a partir de 6.
  for (const [d, jornadas] of epoca.calendario.entries()) {
    for (const q of jornadas[jn - 1] ?? []) {
      if (!q.jogada || q === p) continue
      const dif = Math.abs(q.golos[0] - q.golos[1])
      if (dif >= (d + 1 === div ? 4 : 6)) add('liga', `Goleada na ${nomeDiv(d + 1)}: ${placar(jogo, q)}`)
    }
  }

  // Hat-tricks na minha divisão.
  for (const q of partidas) {
    const n = new Map<number, number>()
    for (const e of q.eventos) if (e.tipo === 'golo' && e.jogadorId !== undefined) n.set(e.jogadorId, (n.get(e.jogadorId) ?? 0) + 1)
    for (const [id, g] of n) {
      if (g < 3) continue
      const j = mundo.jogadores[id]
      add(j?.clubeId === jogo.clubeId ? 'meu' : 'liga', `${g === 3 ? 'Hat-trick' : `${g} golos`} de ${j?.nome ?? '?'} em ${placar(jogo, q)}`)
    }
  }

  // Líder da divisão e séries dos outros.
  const t = tabela(mundo, epoca, div)
  if (t.length && jn > 1) {
    const antes = st.liderAnterior
    if (antes !== undefined && antes !== t[0].clubeId) add('liga', `${nome(t[0].clubeId)} é o novo líder da ${nomeDiv(div)}`, `${t[0].pts} pontos ao fim de ${jn} jornadas.`)
  }
  if (t.length) st.liderAnterior = t[0].clubeId
  for (const l of t) {
    if (l.clubeId === jogo.clubeId) continue
    const se = serieDe(jogo, l.clubeId)
    if (se.v === 5 || se.v === 8) add('liga', `${nome(l.clubeId)} embalado: ${se.v} vitórias seguidas`)
    if (se.d === 6) add('liga', `${nome(l.clubeId)} afunda-se: ${se.d} derrotas seguidas`)
  }

  // Melhor marcador da divisão a cada 5 jornadas.
  if (jn % 5 === 0) {
    let melhor: { id: number; g: number } | null = null
    for (const [k, g] of Object.entries(epoca.marcadores)) {
      const id = Number(k)
      const j = mundo.jogadores[id]
      if (!j || mundo.clubes[j.clubeId]?.divisao !== div) continue
      if (!melhor || g > melhor.g) melhor = { id, g }
    }
    if (melhor) {
      const j = mundo.jogadores[melhor.id]
      add('liga', `${j.nome} (${nome(j.clubeId)}) lidera os marcadores da ${nomeDiv(div)} com ${melhor.g} golos`)
    }
  }

  for (const b of batidos) add('recorde', `Recorde! ${textoRecorde(b)}`)
}

/** Fim de época: campeões, melhor marcador, recordes da época. */
function noticiarFimEpoca(jogo: Jogo, st: EstadoImprensa, batidos: RecordeBatido[]) {
  const { mundo, epoca } = jogo
  const ano = epoca.ano
  const add = (tipo: TipoNoticia, titulo: string, texto?: string) => publicar(st, { ano, jornada: epoca.totalJornadas, tipo, titulo, texto })
  for (const d of mundo.divisoes) {
    const t = tabela(mundo, epoca, d.numero)
    if (!t.length) continue
    const c = mundo.clubes[t[0].clubeId]
    add(t[0].clubeId === jogo.clubeId ? 'meu' : 'epoca', `${c.nome} campeão da ${nomeDiv(d.numero)}`, `${t[0].pts} pontos, ${t[0].v} vitórias.`)
  }
  for (const b of batidos) add('recorde', `Recorde! ${textoRecorde(b)}`)
}

type Gerador = (jogo: Jogo, adv: string) => Omit<Conferencia, 'ano' | 'jornada'> | null

const PERGUNTAS: Record<Conferencia['tema'], Gerador> = {
  inicio: (jogo) => {
    const o = estadoCarreira(jogo as JogoComCarreira).objetivos
    return {
      tema: 'inicio',
      pergunta: 'Arranque de época. A direção definiu um objetivo: o que diz aos adeptos?',
      opcoes: [
        { texto: 'Vamos cumprir o objetivo, passo a passo.', moral: 1, confianca: 2, manchete: 'Mister promete trabalho e o objetivo da direção' },
        { texto: o.tipo === 'titulo' ? 'Só o título interessa.' : 'Queremos mais do que nos pedem.', moral: 3, confianca: 4, manchete: 'Mister ambicioso: "queremos mais"' },
        { texto: 'É uma época de construção, peço paciência.', moral: 1, confianca: -3, manchete: 'Mister pede paciência aos adeptos' },
      ],
    }
  },
  classico: (_j, adv) => ({
    tema: 'classico',
    pergunta: `O grande clássico contra o ${adv} está aí. A cidade não fala de outra coisa. Promete a vitória?`,
    opcoes: [
      { texto: 'Prometo. Vamos ganhar este clássico.', moral: 3, confianca: 1, promessa: 'vencer', manchete: `Mister promete vencer o ${adv}` },
      { texto: 'É um jogo especial, mas são só três pontos.', moral: 0, confianca: 0, manchete: 'Mister tira pressão ao clássico' },
      { texto: 'A pressão está toda do lado deles.', moral: 2, confianca: -1, manchete: `Mister provoca o ${adv}` },
    ],
  }),
  derbi: (_j, adv) => ({
    tema: 'derbi',
    pergunta: `Dérbi com o ${adv}. Os adeptos pedem a vitória. Que mensagem deixa?`,
    opcoes: [
      { texto: 'Os dérbis ganham-se, não se jogam. Vamos ganhar.', moral: 2, confianca: 1, promessa: 'vencer', manchete: `Mister garante vitória no dérbi com o ${adv}` },
      { texto: 'Respeito total pelo adversário.', moral: 0, confianca: 0, manchete: 'Mister com respeito antes do dérbi' },
      { texto: 'Não vamos perder em casa de ninguém.', moral: 1, confianca: 0, promessa: 'naoPerder', manchete: `Mister: "não perdemos com o ${adv}"` },
    ],
  }),
  crise: () => ({
    tema: 'crise',
    pergunta: 'Os resultados não aparecem. De quem é a culpa?',
    opcoes: [
      { texto: 'A responsabilidade é minha. Os jogadores estão comigo.', moral: 4, confianca: -2, manchete: 'Mister assume a culpa e protege o grupo' },
      { texto: 'Os jogadores têm de dar muito mais.', moral: -4, confianca: 2, manchete: 'Mister critica os jogadores em público' },
      { texto: 'Foi azar. A equipa está a jogar bem.', moral: 1, confianca: -1, manchete: 'Mister fala em azar' },
    ],
  }),
  embalo: () => ({
    tema: 'embalo',
    pergunta: 'Vitória atrás de vitória. Já se pode sonhar?',
    opcoes: [
      { texto: 'Ainda não ganhámos nada. Pés no chão.', moral: 1, confianca: 1, manchete: 'Mister pede pés no chão' },
      { texto: 'Somos candidatos, sem medo de o dizer.', moral: 3, confianca: 2, promessa: 'naoPerder', manchete: 'Mister assume: "somos candidatos"' },
      { texto: 'O mérito é todo dos jogadores.', moral: 2, confianca: 0, manchete: 'Mister elogia o plantel' },
    ],
  }),
  grande: (_j, adv) => ({
    tema: 'grande',
    pergunta: `Vem aí o ${adv}, um dos candidatos. Joga para ganhar ou para não perder?`,
    opcoes: [
      { texto: 'Vamos lá para ganhar, sem complexos.', moral: 2, confianca: 1, promessa: 'vencer', manchete: `Mister quer vencer o ${adv}` },
      { texto: 'Um empate seria um bom resultado.', moral: -1, confianca: 0, promessa: 'naoPerder', manchete: `Mister contente com um empate frente ao ${adv}` },
      { texto: 'Eles são favoritos. Nós vamos competir.', moral: 0, confianca: 0, manchete: `Mister dá o favoritismo ao ${adv}` },
    ],
  }),
  craque: (jogo) => {
    const meu = jogo.mundo.clubes[jogo.clubeId]
    const craque = meu.plantel.map((id) => jogo.mundo.jogadores[id]).filter(Boolean).sort((a, b) => b.forca - a.forca)[0]
    if (!craque) return null
    return {
      tema: 'craque',
      jogadorId: craque.id,
      pergunta: `Fala-se que há clubes interessados em ${craque.nome}. Ele fica?`,
      opcoes: [
        { texto: `${craque.curto} não sai. É o nosso líder.`, moral: 1, confianca: -1, moralJogador: 6, manchete: `Mister fecha a porta à saída de ${craque.nome}` },
        { texto: 'No futebol tudo tem um preço.', moral: -1, confianca: 2, moralJogador: -6, manchete: `${craque.nome} pode sair, admite o mister` },
        { texto: 'Não comento rumores.', moral: 0, confianca: 0, moralJogador: -1, manchete: 'Mister foge aos rumores de mercado' },
      ],
    }
  },
  balneario: () => ({
    tema: 'balneario',
    pergunta: 'Como está o ambiente no balneário?',
    opcoes: [
      { texto: 'Somos uma família. Grande ambiente.', moral: 2, confianca: 0, manchete: 'Mister elogia o ambiente do balneário' },
      { texto: 'Há quem precise de trabalhar mais para jogar.', moral: -2, confianca: 1, manchete: 'Mister deixa recado no balneário' },
      { texto: 'Isso fica entre nós.', moral: 0, confianca: 0, manchete: 'Mister não abre a porta do balneário' },
    ],
  }),
}

/** Conferência antes da próxima jornada (ou nenhuma, se não houver motivo). Não grava estado. */
export function gerarConferencia(jogo: Jogo): Conferencia | undefined {
  const { mundo, epoca } = jogo
  if (epocaTerminada(epoca)) return undefined
  const jn = epoca.jornada
  const p = minhaDaJornada(jogo, jn)
  if (!p) return undefined
  const meu = mundo.clubes[jogo.clubeId]
  const advId = p.casaId === jogo.clubeId ? p.foraId : p.casaId
  const adv = mundo.clubes[advId]
  const rng = createRng(semente(mundo.semente, epoca.ano, jn, jogo.clubeId))
  const riv = rivalidade(meu, adv)
  const t = tabela(mundo, epoca, meu.divisao)
  const posAdv = t.findIndex((l) => l.clubeId === advId)
  const posMeu = t.findIndex((l) => l.clubeId === jogo.clubeId)
  const se = serieDe(jogo, jogo.clubeId)
  // Últimos 3 jogos da liga.
  const ult = t[posMeu]?.forma.slice(-3) ?? []
  let tema: Conferencia['tema'] | null = null
  if (jn === 1) tema = 'inicio'
  else if (riv) tema = riv.tipo
  else if (ult.length === 3 && !ult.includes('V') && ult.filter((r) => r === 'D').length >= 2) tema = 'crise'
  else if (se.v >= 3) tema = 'embalo'
  else if (jn > 4 && posAdv >= 0 && posAdv < 3 && posMeu > posAdv) tema = 'grande'
  else if (rng.chance(0.3)) tema = rng.chance(0.4) ? 'craque' : 'balneario'
  if (!tema) return undefined
  const c = PERGUNTAS[tema](jogo, adv?.nome ?? '?')
  if (!c) return undefined
  return { ...c, ano: epoca.ano, jornada: jn }
}

/** Responde à conferência pendente: aplica os efeitos, guarda a promessa e sai a notícia. */
export function responderConferencia(jogo: Jogo, i: number): boolean {
  const st = estadoImprensa(jogo)
  const c = st.conferencia
  if (!c || c.resposta !== undefined || c.ano !== jogo.epoca.ano || c.jornada !== jogo.epoca.jornada) return false
  const o = c.opcoes[i]
  if (!o) return false
  c.resposta = i
  if (o.moral) mudarMoral(jogo, jogo.clubeId, o.moral, 'conferência de imprensa')
  if (o.moralJogador && c.jogadorId !== undefined) mudarMoralJogador(jogo, c.jogadorId, o.moralJogador, 'conferência de imprensa')
  mexerConfianca(jogo, o.confianca)
  if (o.promessa) {
    const p = minhaDaJornada(jogo, c.jornada)
    const advId = p ? (p.casaId === jogo.clubeId ? p.foraId : p.casaId) : -1
    st.promessa = { ano: c.ano, jornada: c.jornada, tipo: o.promessa, adversario: jogo.mundo.clubes[advId]?.nome ?? '?' }
  }
  publicar(st, { ano: c.ano, jornada: c.jornada - 1, tipo: 'imprensa', titulo: o.manchete, texto: `«${o.texto}»` })
  st.lidaAte = st.seq
  return true
}

/** Conferência por responder antes do jogo desta jornada. */
export function conferenciaPendente(jogo: Jogo): Conferencia | undefined {
  const c = (jogo as JogoComImprensa).imprensa?.conferencia
  return c && c.resposta === undefined && c.ano === jogo.epoca.ano && c.jornada === jogo.epoca.jornada ? c : undefined
}

/**
 * Avança notícias e recordes até à jornada atual, fecha a época nos recordes quando acaba (chamar antes de
 * fecharEpoca) e prepara a conferência da próxima jornada. Idempotente.
 */
export function avancarImprensa(jogo: Jogo): void {
  const st = estadoImprensa(jogo)
  const { epoca } = jogo
  if (st.ano !== epoca.ano) { st.ano = epoca.ano; st.jornada = 0; st.liderAnterior = undefined }
  while (st.jornada < epoca.jornada - 1) {
    st.jornada += 1
    const jn = st.jornada
    const todas = epoca.calendario.flatMap((div) => div[jn - 1] ?? [])
    const batidos = processarJornada(jogo, todas, epoca.ano)
    noticiarJornada(jogo, st, jn, batidos)
  }
  if (epocaTerminada(epoca)) {
    const batidos = fecharEpocaRecordes(jogo, epoca)
    if (!st.fimNoticiado?.includes(epoca.ano)) {
      st.fimNoticiado = [...(st.fimNoticiado ?? []), epoca.ano].slice(-5)
      noticiarFimEpoca(jogo, st, batidos)
    }
    return
  }
  const c = st.conferencia
  if (!c || c.ano !== epoca.ano || c.jornada !== epoca.jornada) st.conferencia = gerarConferencia(jogo)
}
