// Notícias da jornada e conferências de imprensa (escolhas que mexem na moral do plantel e na confiança
// da direção, e promessas que se pagam no jogo seguinte). Dérbis e clássicos pesam mais.
// Também faz avançar os recordes (recordes.ts). Determinístico: sementes da época e da jornada.
import { createRng } from './rng'
import type { Jogo } from './types'
import type { Partida } from './partida'
import { epocaTerminada, tabela } from './epoca'
import { nivelDe, nomeDivisao } from './ligas'
import { estadoCarreira, type JogoComCarreira } from './direcao'
import { mudarMoral, mudarMoralJogador } from './balneario'
import { rivalidade } from './rivalidades'
import { humorDe, mudarHumor, nivelHumor, NOME_HUMOR, type NivelHumor } from './adeptos'
import { fecharEpocaRecordes, processarJornada, serieDe, textoRecorde, type RecordeBatido } from './recordes'

export type TipoNoticia = 'meu' | 'liga' | 'derbi' | 'recorde' | 'imprensa' | 'direcao' | 'epoca' | 'adeptos'

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
  /** Humor dos adeptos. */
  adeptos?: number
  /** Moral de um jogador (o craque, numa pergunta sobre ele). */
  moralJogador?: number
  promessa?: 'vencer' | 'naoPerder'
  /** Título da notícia que sai no dia seguinte. */
  manchete: string
}

export interface Conferencia {
  ano: number
  jornada: number
  tema: 'inicio' | 'classico' | 'derbi' | 'crise' | 'embalo' | 'grande' | 'craque' | 'balneario' | 'adeptos' | 'bilhetes'
    | 'vitoria' | 'derrota' | 'empate' | 'goleada' | 'humilhacao' | 'derbiGanho' | 'derbiPerdido'
  /** 'depois': conferência no fim do jogo (vale até ao jogo seguinte). */
  momento?: 'antes' | 'depois'
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
  /** Conferência depois do último jogo. */
  flash?: Conferencia
  /** Nível de humor dos adeptos na última jornada noticiada (para noticiar mudanças). */
  nivelAdeptos?: NivelHumor
  /** Craque do plantel na última jornada (para notar a venda). */
  craqueId?: number
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
        mudarHumor(meu, 3)
        add('imprensa', `Promessa cumprida: o mister tinha dito que ${pr.tipo === 'vencer' ? 'ganhava' : 'não perdia'} com o ${pr.adversario}`)
      } else {
        const custo = pr.tipo === 'vencer' ? (r === 'E' ? 2 : 5) : 4
        mexerConfianca(jogo, -custo, 'Promessas falhadas na imprensa deixam a direção desconfortável.')
        mudarMoral(jogo, jogo.clubeId, -2, 'promessa falhada')
        mudarHumor(meu, -4)
        add('imprensa', `Promessa falhada: o mister garantiu que ${pr.tipo === 'vencer' ? 'ganhava' : 'não perdia'} com o ${pr.adversario}`)
      }
      st.promessa = undefined
    } else if (pr && (pr.ano !== ano || pr.jornada < jn)) st.promessa = undefined
    // Séries do meu clube.
    const se = serieDe(jogo, jogo.clubeId)
    if (se.v === 3 || se.v === 5 || se.v === 8) add('meu', `${meu.nome} soma ${se.v} vitórias seguidas`)
    if (se.d === 3 || se.d === 5) add('meu', `Crise no ${meu.nome}: ${se.d} derrotas seguidas`)
    pressaoAdeptos(jogo, st, p, add)
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
      if (dif >= (d + 1 === div ? 4 : 6)) add('liga', `Goleada na ${nomeDivisao(mundo, d + 1)}: ${placar(jogo, q)}`)
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
    if (antes !== undefined && antes !== t[0].clubeId) add('liga', `${nome(t[0].clubeId)} é o novo líder da ${nomeDivisao(mundo, div)}`, `${t[0].pts} pontos ao fim de ${jn} jornadas.`)
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
      add('liga', `${j.nome} (${nome(j.clubeId)}) lidera os marcadores da ${nomeDivisao(mundo, div)} com ${melhor.g} golos`)
    }
  }

  for (const b of batidos) add('recorde', `Recorde! ${textoRecorde(b)}`)
}

/** O que os adeptos fazem sentir depois do meu jogo: notícia quando o humor muda de nível, pressão enquanto dura. */
function pressaoAdeptos(jogo: Jogo, st: EstadoImprensa, p: Partida, add: (tipo: TipoNoticia, titulo: string, texto?: string) => void) {
  const meu = jogo.mundo.clubes[jogo.clubeId]
  // Vender o craque dói aos adeptos.
  const ant = st.craqueId !== undefined ? jogo.mundo.jogadores[st.craqueId] : undefined
  if (ant && ant.clubeId !== jogo.clubeId && jogo.mundo.clubes[ant.clubeId]) {
    mudarHumor(meu, -6)
    add('adeptos', `Adeptos revoltados com a saída de ${ant.nome}`, `Foi para o ${jogo.mundo.clubes[ant.clubeId].nome}. Vender a figura da equipa nunca cai bem nas bancadas.`)
  }
  st.craqueId = meu.plantel.map((id) => jogo.mundo.jogadores[id]).filter(Boolean).sort((x, y) => y.forca - x.forca || x.id - y.id)[0]?.id
  const h = humorDe(meu)
  const nivel = nivelHumor(h)
  const emCasa = p.casaId === jogo.clubeId
  const antes = st.nivelAdeptos
  st.nivelAdeptos = nivel
  const ordem: NivelHumor[] = ['furiosos', 'desiludidos', 'exigentes', 'satisfeitos', 'euforia']
  if (antes && antes !== nivel) {
    const subiu = ordem.indexOf(nivel) > ordem.indexOf(antes)
    const txt: Record<NivelHumor, string> = {
      furiosos: emCasa ? `Lenços brancos no estádio do ${meu.nome}: os adeptos pedem a saída do mister` : `Adeptos do ${meu.nome} em fúria com o mister`,
      desiludidos: `Adeptos do ${meu.nome} desiludidos`,
      exigentes: subiu ? `Os adeptos do ${meu.nome} voltam a acreditar, mas exigem mais` : `Os adeptos do ${meu.nome} começam a perder a paciência`,
      satisfeitos: `Adeptos do ${meu.nome} satisfeitos com a equipa`,
      euforia: `Euforia no ${meu.nome}: os adeptos já sonham alto`,
    }
    add('adeptos', txt[nivel], `Humor dos adeptos: ${NOME_HUMOR[nivel].toLowerCase()} (${Math.round(h)}/100). ${subiu ? 'Mais gente no estádio nos próximos jogos.' : 'Menos gente no estádio nos próximos jogos.'}`)
  }
  if (nivel === 'furiosos') {
    mexerConfianca(jogo, -1.5, antes !== 'furiosos' ? 'Os adeptos estão contra ti e a direção sente a pressão das bancadas.' : undefined)
    if (emCasa) mudarMoral(jogo, jogo.clubeId, -1, 'assobios das bancadas')
  } else if (nivel === 'euforia') {
    mexerConfianca(jogo, 0.5)
    if (emCasa) mudarMoral(jogo, jogo.clubeId, 1, 'estádio em festa')
  }
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
    add(t[0].clubeId === jogo.clubeId ? 'meu' : 'epoca', `${c.nome} campeão da ${nomeDivisao(mundo, d.numero)}`, `${t[0].pts} pontos, ${t[0].v} vitórias.`)
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
        { texto: 'Vamos cumprir o objetivo, passo a passo.', moral: 1, confianca: 2, adeptos: 1, manchete: 'Mister promete trabalho e o objetivo da direção' },
        { texto: o.tipo === 'titulo' ? 'Só o título interessa.' : 'Queremos mais do que nos pedem.', moral: 3, confianca: 4, adeptos: 4, manchete: 'Mister ambicioso: "queremos mais"' },
        { texto: 'É uma época de construção, peço paciência.', moral: 1, confianca: -3, adeptos: -4, manchete: 'Mister pede paciência aos adeptos' },
      ],
    }
  },
  classico: (_j, adv) => ({
    tema: 'classico',
    pergunta: `O grande clássico contra o ${adv} está aí. A cidade não fala de outra coisa. Promete a vitória?`,
    opcoes: [
      { texto: 'Prometo. Vamos ganhar este clássico.', moral: 3, confianca: 1, promessa: 'vencer', adeptos: 5, manchete: `Mister promete vencer o ${adv}` },
      { texto: 'É um jogo especial, mas são só três pontos.', moral: 0, confianca: 0, adeptos: -3, manchete: 'Mister tira pressão ao clássico' },
      { texto: 'A pressão está toda do lado deles.', moral: 2, confianca: -1, adeptos: 4, manchete: `Mister provoca o ${adv}` },
    ],
  }),
  derbi: (_j, adv) => ({
    tema: 'derbi',
    pergunta: `Dérbi com o ${adv}. Os adeptos pedem a vitória. Que mensagem deixa?`,
    opcoes: [
      { texto: 'Os dérbis ganham-se, não se jogam. Vamos ganhar.', moral: 2, confianca: 1, promessa: 'vencer', adeptos: 4, manchete: `Mister garante vitória no dérbi com o ${adv}` },
      { texto: 'Respeito total pelo adversário.', moral: 0, confianca: 0, adeptos: -1, manchete: 'Mister com respeito antes do dérbi' },
      { texto: 'Não vamos perder em casa de ninguém.', moral: 1, confianca: 0, promessa: 'naoPerder', adeptos: 2, manchete: `Mister: "não perdemos com o ${adv}"` },
    ],
  }),
  crise: () => ({
    tema: 'crise',
    pergunta: 'Os resultados não aparecem. De quem é a culpa?',
    opcoes: [
      { texto: 'A responsabilidade é minha. Os jogadores estão comigo.', moral: 4, confianca: -2, adeptos: 1, manchete: 'Mister assume a culpa e protege o grupo' },
      { texto: 'Os jogadores têm de dar muito mais.', moral: -4, confianca: 2, adeptos: 2, manchete: 'Mister critica os jogadores em público' },
      { texto: 'Foi azar. A equipa está a jogar bem.', moral: 1, confianca: -1, adeptos: -3, manchete: 'Mister fala em azar' },
    ],
  }),
  embalo: () => ({
    tema: 'embalo',
    pergunta: 'Vitória atrás de vitória. Já se pode sonhar?',
    opcoes: [
      { texto: 'Ainda não ganhámos nada. Pés no chão.', moral: 1, confianca: 1, manchete: 'Mister pede pés no chão' },
      { texto: 'Somos candidatos, sem medo de o dizer.', moral: 3, confianca: 2, promessa: 'naoPerder', adeptos: 4, manchete: 'Mister assume: "somos candidatos"' },
      { texto: 'O mérito é todo dos jogadores.', moral: 2, confianca: 0, adeptos: 1, manchete: 'Mister elogia o plantel' },
    ],
  }),
  grande: (_j, adv) => ({
    tema: 'grande',
    pergunta: `Vem aí o ${adv}, um dos candidatos. Joga para ganhar ou para não perder?`,
    opcoes: [
      { texto: 'Vamos lá para ganhar, sem complexos.', moral: 2, confianca: 1, promessa: 'vencer', adeptos: 3, manchete: `Mister quer vencer o ${adv}` },
      { texto: 'Um empate seria um bom resultado.', moral: -1, confianca: 0, promessa: 'naoPerder', adeptos: -3, manchete: `Mister contente com um empate frente ao ${adv}` },
      { texto: 'Eles são favoritos. Nós vamos competir.', moral: 0, confianca: 0, adeptos: -1, manchete: `Mister dá o favoritismo ao ${adv}` },
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
        { texto: `${craque.curto} não sai. É o nosso líder.`, moral: 1, confianca: -1, moralJogador: 6, adeptos: 4, manchete: `Mister fecha a porta à saída de ${craque.nome}` },
        { texto: 'No futebol tudo tem um preço.', moral: -1, confianca: 2, moralJogador: -6, adeptos: -5, manchete: `${craque.nome} pode sair, admite o mister` },
        { texto: 'Não comento rumores.', moral: 0, confianca: 0, moralJogador: -1, manchete: 'Mister foge aos rumores de mercado' },
      ],
    }
  },
  adeptos: () => ({
    tema: 'adeptos',
    pergunta: 'Os adeptos assobiaram a equipa e há lenços brancos nas bancadas. O que lhes diz?',
    opcoes: [
      { texto: 'Peço-lhes que estejam connosco. Precisamos deles.', moral: 1, confianca: 0, adeptos: 3, manchete: 'Mister pede apoio aos adeptos' },
      { texto: 'Têm razão. Esta equipa tem de dar muito mais.', moral: -2, confianca: 1, adeptos: 6, manchete: 'Mister dá razão aos adeptos' },
      { texto: 'Quem assobia não ajuda o clube.', moral: 3, confianca: -2, adeptos: -6, manchete: 'Mister responde aos assobios' },
    ],
  }),
  bilhetes: () => ({
    tema: 'bilhetes',
    pergunta: 'Os adeptos queixam-se do preço dos bilhetes. O clube vai baixá-los?',
    opcoes: [
      { texto: 'Vou falar com a direção. Os adeptos merecem.', moral: 0, confianca: -2, adeptos: 4, manchete: 'Mister do lado dos adeptos no preço dos bilhetes' },
      { texto: 'É o preço de ter uma equipa competitiva.', moral: 0, confianca: 2, adeptos: -4, manchete: 'Mister defende bilhetes caros' },
      { texto: 'Isso não é comigo, eu treino a equipa.', moral: 0, confianca: 0, adeptos: -1, manchete: 'Mister afasta-se da polémica dos bilhetes' },
    ],
  }),
  vitoria: (_j, adv) => ({
    tema: 'vitoria',
    pergunta: `Vitória frente ao ${adv}. A quem a dedica?`,
    opcoes: [
      { texto: 'Aos adeptos, que nunca nos deixaram sozinhos.', moral: 0, confianca: 0, adeptos: 4, manchete: 'Mister dedica a vitória aos adeptos' },
      { texto: 'Aos jogadores. Foram enormes.', moral: 3, confianca: 0, manchete: 'Mister rendido aos jogadores' },
      { texto: 'Não fizemos mais do que a obrigação.', moral: -1, confianca: 2, adeptos: 1, manchete: 'Mister exigente mesmo a ganhar' },
    ],
  }),
  goleada: (_j, adv) => ({
    tema: 'goleada',
    pergunta: `Goleada ao ${adv}! Esta equipa pode chegar onde?`,
    opcoes: [
      { texto: 'Onde os adeptos sonharem.', moral: 2, confianca: 0, adeptos: 5, manchete: 'Mister põe os adeptos a sonhar' },
      { texto: 'Foi um dia bom. Amanhã já não conta.', moral: 1, confianca: 2, manchete: 'Mister trava a euforia' },
      { texto: 'Quem nos criticava devia pedir desculpa.', moral: 2, confianca: -1, adeptos: 2, manchete: 'Mister responde aos críticos depois da goleada' },
    ],
  }),
  empate: (_j, adv) => ({
    tema: 'empate',
    pergunta: `Empate com o ${adv}. Um ponto sabe a pouco?`,
    opcoes: [
      { texto: 'Sabe a pouco. Queríamos ganhar.', moral: 0, confianca: 1, adeptos: 2, manchete: 'Mister insatisfeito com o empate' },
      { texto: 'É um ponto que pode valer muito no fim.', moral: 1, confianca: 0, adeptos: -1, manchete: 'Mister valoriza o ponto' },
      { texto: 'O árbitro tirou-nos a vitória.', moral: 1, confianca: -2, adeptos: 3, manchete: 'Mister ataca a arbitragem' },
    ],
  }),
  derrota: (_j, adv) => ({
    tema: 'derrota',
    pergunta: `Derrota com o ${adv}. O que falhou?`,
    opcoes: [
      { texto: 'Falhei eu. Assumo a derrota.', moral: 2, confianca: -1, adeptos: 1, manchete: 'Mister assume a derrota' },
      { texto: 'Houve quem não estivesse à altura.', moral: -3, confianca: 1, adeptos: 2, manchete: 'Mister aponta o dedo a jogadores' },
      { texto: 'A arbitragem decidiu o jogo.', moral: 1, confianca: -2, adeptos: 2, manchete: 'Mister culpa o árbitro pela derrota' },
    ],
  }),
  humilhacao: (_j, adv) => ({
    tema: 'humilhacao',
    pergunta: `Uma goleada sofrida frente ao ${adv}. Os adeptos estão envergonhados. Que explicação lhes dá?`,
    opcoes: [
      { texto: 'Peço desculpa aos adeptos. Não se repete.', moral: 0, confianca: 0, adeptos: 5, manchete: 'Mister pede desculpa aos adeptos' },
      { texto: 'Vou tirar conclusões. Há lugares em risco.', moral: -4, confianca: 2, adeptos: 3, manchete: 'Mister ameaça mexer na equipa' },
      { texto: 'Dias maus acontecem. Vamos levantar a cabeça.', moral: 2, confianca: -1, adeptos: -3, manchete: 'Mister desvaloriza a goleada' },
    ],
  }),
  derbiGanho: (_j, adv) => ({
    tema: 'derbiGanho',
    pergunta: `Ganhou o jogo grande contra o ${adv}. Uma palavra para os adeptos?`,
    opcoes: [
      { texto: 'Esta é para vocês. A cidade é nossa!', moral: 1, confianca: 0, adeptos: 6, manchete: 'Mister em festa com os adeptos' },
      { texto: 'Respeito pelo adversário. São só três pontos.', moral: 0, confianca: 1, adeptos: -1, manchete: 'Mister humilde depois do dérbi' },
      { texto: 'Eles falaram muito antes do jogo. Nós respondemos em campo.', moral: 2, confianca: -1, adeptos: 4, manchete: `Mister provoca o ${adv} depois da vitória` },
    ],
  }),
  derbiPerdido: (_j, adv) => ({
    tema: 'derbiPerdido',
    pergunta: `Perdeu o jogo grande com o ${adv}. Os adeptos não perdoam. O que lhes diz?`,
    opcoes: [
      { texto: 'Peço desculpa. Sei o que este jogo significa.', moral: 0, confianca: 0, adeptos: 4, manchete: 'Mister pede desculpa pelo dérbi perdido' },
      { texto: 'Os jogadores sabem que falharam.', moral: -3, confianca: 1, adeptos: 2, manchete: 'Mister deixa os jogadores sozinhos depois do dérbi' },
      { texto: 'É só um jogo. A época continua.', moral: 1, confianca: -1, adeptos: -5, manchete: 'Mister desvaloriza o dérbi perdido' },
    ],
  }),
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
  else if (humorDe(meu) < 30 && rng.chance(0.6)) tema = 'adeptos'
  else if (p.casaId === jogo.clubeId && meu.bilhete > 1.4 * ([15, 10, 7, 5][nivelDe(meu) - 1] ?? 5) && rng.chance(0.35)) tema = 'bilhetes'
  else if (rng.chance(0.3)) tema = rng.chance(0.4) ? 'craque' : 'balneario'
  if (!tema) return undefined
  const c = PERGUNTAS[tema](jogo, adv?.nome ?? '?')
  if (!c) return undefined
  return { ...c, ano: epoca.ano, jornada: jn, momento: 'antes' }
}

/** Conferência no fim do meu jogo da jornada `jn` (já jogada). Não grava estado. */
export function gerarFlash(jogo: Jogo, jn: number): Conferencia | undefined {
  const p = minhaDaJornada(jogo, jn)
  if (!p?.jogada) return undefined
  const advId = p.casaId === jogo.clubeId ? p.foraId : p.casaId
  const adv = jogo.mundo.clubes[advId]
  const { m, s, r } = resultado(p, jogo.clubeId)
  const riv = rivalidade(jogo.mundo.clubes[jogo.clubeId], adv)
  const tema: Conferencia['tema'] = riv && r === 'V' ? 'derbiGanho' : riv && r === 'D' ? 'derbiPerdido'
    : s - m >= 3 ? 'humilhacao' : m - s >= 3 ? 'goleada' : r === 'V' ? 'vitoria' : r === 'E' ? 'empate' : 'derrota'
  const c = PERGUNTAS[tema](jogo, adv?.nome ?? '?')
  if (!c) return undefined
  return { ...c, ano: jogo.epoca.ano, jornada: jn, momento: 'depois' }
}

/** Conferência do fim do último jogo, ainda por responder (vale até ao jogo seguinte). */
export function flashPendente(jogo: Jogo): Conferencia | undefined {
  const c = (jogo as JogoComImprensa).imprensa?.flash
  return c && c.resposta === undefined && c.ano === jogo.epoca.ano && c.jornada === jogo.epoca.jornada - 1 ? c : undefined
}

/** Responde à conferência pendente: aplica os efeitos, guarda a promessa e sai a notícia. */
export function responderConferencia(jogo: Jogo, i: number, momento: 'antes' | 'depois' = 'antes'): boolean {
  const st = estadoImprensa(jogo)
  const c = momento === 'depois' ? flashPendente(jogo) : conferenciaPendente(jogo)
  if (!c) return false
  const o = c.opcoes[i]
  if (!o) return false
  c.resposta = i
  if (o.moral) mudarMoral(jogo, jogo.clubeId, o.moral, 'conferência de imprensa')
  if (o.moralJogador && c.jogadorId !== undefined) mudarMoralJogador(jogo, c.jogadorId, o.moralJogador, 'conferência de imprensa')
  mexerConfianca(jogo, o.confianca)
  if (o.adeptos) mudarHumor(jogo.mundo.clubes[jogo.clubeId], o.adeptos)
  if (o.promessa) {
    const p = minhaDaJornada(jogo, c.jornada)
    const advId = p ? (p.casaId === jogo.clubeId ? p.foraId : p.casaId) : -1
    st.promessa = { ano: c.ano, jornada: c.jornada, tipo: o.promessa, adversario: jogo.mundo.clubes[advId]?.nome ?? '?' }
  }
  publicar(st, { ano: c.ano, jornada: momento === 'depois' ? c.jornada : c.jornada - 1, tipo: 'imprensa', titulo: o.manchete, texto: `«${o.texto}»` })
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
  const f = st.flash
  if (epoca.jornada > 1 && (!f || f.ano !== epoca.ano || f.jornada !== epoca.jornada - 1)) st.flash = gerarFlash(jogo, epoca.jornada - 1)
  const c = st.conferencia
  if (!c || c.ano !== epoca.ano || c.jornada !== epoca.jornada) st.conferencia = gerarConferencia(jogo)
}
