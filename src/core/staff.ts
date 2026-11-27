// Equipa técnica (staff) e treino: adjunto, treinador de guarda-redes, preparador físico e olheiro.
// Cada clube tem no máximo um de cada. O nível (1 a 5) decide o efeito e o salário.
// Tudo determinístico: os sorteios usam createRng com sementes derivadas do mundo.
import { nivelDe as nivelDivisaoDe } from './ligas'
import { manutencaoAcademia } from './academia'
import { anosExtraCarreira, fatorTreinoPers, personalidadeDe } from './personalidade'
import { PESOS, atributo, mexerPerfil, type Atributo } from './atributos'
import { createRng, type Rng } from './rng'
import { aprendido, definirAprendido } from './polivalencia'
import { definirFadiga, fadigaDe } from './lesoes'
import { valorDe } from './mundo'
import { APELIDOS_PT, NOMES_PT } from './nomes'
import { potencialTexto } from './juniores'
import type { Clube, Jogador, Mundo, Posicao } from './types'

export type Funcao = 'adjunto' | 'gr' | 'fisico' | 'olheiro' | 'tdef' | 'tmed' | 'tav'
export const FUNCOES: readonly Funcao[] = ['adjunto', 'gr', 'fisico', 'olheiro', 'tdef', 'tmed', 'tav']
/** Treinadores de setor (opcionais): ajudam o adjunto com os jogadores de uma posição. */
export const FUNCOES_SETOR = ['tdef', 'tmed', 'tav'] as const
export type FuncaoSetor = (typeof FUNCOES_SETOR)[number]
export const SETOR: Record<FuncaoSetor, Posicao> = { tdef: 'DEF', tmed: 'MED', tav: 'AV' }
/** O atributo que cada treinador de setor puxa (o mais importante da posição). */
export const ATRIB_SETOR: Record<FuncaoSetor, Atributo> = { tdef: 'def', tmed: 'pas', tav: 'rem' }
const SETOR_DA_POS: Partial<Record<Posicao, FuncaoSetor>> = { DEF: 'tdef', MED: 'tmed', AV: 'tav' }
export function eSetor(f: Funcao): f is FuncaoSetor {
  return f === 'tdef' || f === 'tmed' || f === 'tav'
}

export const NOME_FUNCAO: Record<Funcao, string> = {
  adjunto: 'Treinador adjunto',
  gr: 'Treinador de guarda-redes',
  fisico: 'Preparador físico',
  olheiro: 'Olheiro',
  tdef: 'Treinador de defesas',
  tmed: 'Treinador de médios',
  tav: 'Treinador de avançados',
}

export const EFEITO_FUNCAO: Record<Funcao, string> = {
  adjunto: 'Faz evoluir os jogadores de campo no treino.',
  gr: 'Faz evoluir os guarda-redes no treino.',
  fisico: 'Encurta as lesões e atrasa a quebra dos veteranos.',
  olheiro: 'Estima melhor o potencial dos jovens, descobre mais juniores e, com uma missão, encontra talentos lá fora.',
  tdef: 'Acelera a evolução dos defesas; quando sobem, ganham defesa.',
  tmed: 'Acelera a evolução dos médios; quando sobem, ganham passe.',
  tav: 'Acelera a evolução dos avançados; quando sobem, ganham remate.',
}

export type FocoTreino = 'equilibrado' | Posicao | 'jovens'
export const FOCOS: readonly FocoTreino[] = ['equilibrado', 'GR', 'DEF', 'MED', 'AV', 'jovens']
export const NOME_FOCO: Record<FocoTreino, string> = {
  equilibrado: 'Equilibrado', GR: 'Guarda-redes', DEF: 'Defesas', MED: 'Médios', AV: 'Avançados', jovens: 'Jovens (até 21)',
}

export interface MembroStaff {
  id: number
  nome: string
  funcao: Funcao
  /** 1 a 5. */
  nivel: number
  /** Salário mensal em euros. */
  salario: number
}

export interface StaffClube {
  membros: MembroStaff[]
  foco: FocoTreino
  /** Ano da época a que `ganhos` diz respeito. */
  ano?: number
  /** Pontos de força ganhos no treino nesta época, por jogador. */
  ganhos?: Record<number, number>
  /** Treino específico: um atributo que todos trabalham mais (sem ele, equilibrado). */
  atributo?: Atributo
  /** Pontos ganhos no atributo do treino específico nesta época, por jogador. */
  ganhosAtrib?: Record<number, number>
  /** Intensidade do treino (sem ela, normal). */
  intensidade?: Intensidade
  /** Planos de treino individual (só o clube do utilizador os usa). */
  planos?: Record<number, PlanoIndividual>
  /** Missão do olheiro e talentos que ele encontrou (ver core/olheiro.ts). */
  missao?: { regiao: Regiao; posicao: Posicao | 'qualquer' }
  descobertas?: Descoberta[]
}

export type Regiao = 'PT' | 'BR' | 'AF' | 'EU'
/** Um talento que o olheiro encontrou (ainda fora do mundo: entra com um id novo ao assinar). */
export interface Descoberta {
  j: Jogador
  ano: number
  /** Última jornada em que ainda se pode contratar (depois, outro clube leva-o). */
  ate: number
  /** Compensação ao clube de formação. */
  preco: number
  regiao: Regiao
  /** Ainda não visto no ecrã do staff. */
  nova?: boolean
}

export type Intensidade = 'leve' | 'normal' | 'forte'
export const INTENSIDADES: readonly Intensidade[] = ['leve', 'normal', 'forte']
export const NOME_INTENSIDADE: Record<Intensidade, string> = { leve: 'Leve', normal: 'Normal', forte: 'Forte' }
export const DICA_INTENSIDADE: Record<Intensidade, string> = {
  leve: 'Evoluem menos, mas recuperam melhor do cansaço (bom em semanas de muitos jogos).',
  normal: 'O equilíbrio entre evoluir e descansar.',
  forte: 'Evoluem mais depressa, mas acumulam cansaço e arriscam mais lesões.',
}
const FATOR_INTENSIDADE: Record<Intensidade, number> = { leve: 0.8, normal: 1, forte: 1.25 }

/** Treino individual: um atributo a puxar, ou uma posição nova a aprender. */
export type PlanoIndividual = { tipo: 'atributo'; atributo: Atributo } | { tipo: 'posicao'; posicao: Posicao }
export const PLANOS_MAX = 5

export type ClubeComStaff = Clube & { staff?: StaffClube }

export const NIVEL_MAX = 5

/** Salário de referência de um membro do staff por divisão (cerca do salário de um titular médio). */
const SALARIO_BASE = [10_000, 1_800, 700, 400]
/** Multiplicador do salário por nível (1 a 5). */
const FATOR_NIVEL = [0.35, 0.55, 0.85, 1.3, 2]

function arredonda(v: number): number {
  if (v >= 10_000) return Math.round(v / 500) * 500
  return Math.round(v / 50) * 50
}

/** Salário de um membro do staff; os treinadores de setor ganham menos do que o adjunto. */
export function salarioStaff(nivel: number, divisao: number, f?: Funcao): number {
  return arredonda((SALARIO_BASE[divisao - 1] ?? 400) * (FATOR_NIVEL[nivel - 1] ?? 1) * (f && eSetor(f) ? 0.6 : 1))
}

/** Indemnização para despedir: 3 meses de salário. */
export function indemnizacao(m: MembroStaff): number {
  return m.salario * 3
}

export function staffDe(c: Clube): StaffClube | undefined {
  return (c as ClubeComStaff).staff
}

export function membro(c: Clube, f: Funcao): MembroStaff | undefined {
  return staffDe(c)?.membros.find((m) => m.funcao === f)
}

export function nivelDe(c: Clube | undefined, f: Funcao): number {
  return c ? membro(c, f)?.nivel ?? 0 : 0
}

/** Custo do staff por jornada (34 jornadas por época, como os salários dos jogadores). */
export function custoStaffPorJornada(c: Clube): number {
  const mensal = (staffDe(c)?.membros ?? []).reduce((s, m) => s + m.salario, 0)
  return Math.round((mensal * 12) / 34) + manutencaoAcademia(c)
}

export function mistura(...partes: number[]): number {
  let h = 0x9e3779b9
  for (const p of partes) {
    h = Math.imul(h ^ (p >>> 0), 0x01000193) >>> 0
    h ^= h >>> 13
    h = Math.imul(h, 0x5bd1e995) >>> 0
    h ^= h >>> 15
  }
  return h >>> 0 || 1
}

function nomeStaff(rng: Rng): string {
  return `${rng.pick(NOMES_PT)} ${rng.pick(APELIDOS_PT)}`
}

/** Candidatos disponíveis para contratar nesta época (os mesmos durante toda a época). */
export function candidatos(mundo: Mundo, clubeId: number, f: Funcao): MembroStaff[] {
  const c = mundo.clubes[clubeId]
  const k = FUNCOES.indexOf(f)
  const rng = createRng(mistura(mundo.semente, mundo.epoca, clubeId, k, 0x57af))
  const atual = membro(c, f)
  const out: MembroStaff[] = []
  // Um de cada nível, com o nível da divisão de cima a custar mais.
  for (let nivel = 1; nivel <= NIVEL_MAX; nivel++) {
    const id = mistura(mundo.semente, mundo.epoca, clubeId, k, nivel)
    if (atual?.id === id) continue
    const desvio = 0.9 + rng.next() * 0.25
    out.push({ id, nome: nomeStaff(rng), funcao: f, nivel, salario: arredonda(salarioStaff(nivel, nivelDivisaoDe(c), f) * desvio) })
  }
  return out
}

export interface Resultado { ok: boolean; texto: string }

function garantirEstrutura(c: Clube): StaffClube {
  const cs = c as ClubeComStaff
  if (!cs.staff) cs.staff = { membros: [], foco: 'equilibrado' }
  return cs.staff
}

/** Contrata (substitui quem estiver na função, pagando a indemnização). */
export function contratarStaff(mundo: Mundo, clubeId: number, novo: MembroStaff): Resultado {
  const c = mundo.clubes[clubeId]
  const st = garantirEstrutura(c)
  const atual = st.membros.find((m) => m.funcao === novo.funcao)
  const custo = atual ? indemnizacao(atual) : 0
  if (custo > 0 && c.dinheiro < custo) return { ok: false, texto: `Não há dinheiro para a indemnização de ${atual!.nome}.` }
  c.dinheiro -= custo
  st.membros = st.membros.filter((m) => m.funcao !== novo.funcao).concat({ ...novo })
  return { ok: true, texto: `${novo.nome} é o novo ${NOME_FUNCAO[novo.funcao].toLowerCase()}${atual ? ` (${atual.nome} sai com uma indemnização)` : ''}.` }
}

export function despedirStaff(mundo: Mundo, clubeId: number, f: Funcao): Resultado {
  const c = mundo.clubes[clubeId]
  const m = membro(c, f)
  if (!m) return { ok: false, texto: 'Não há ninguém nessa função.' }
  const custo = indemnizacao(m)
  if (c.dinheiro < custo) return { ok: false, texto: `Não há dinheiro para a indemnização (${custo.toLocaleString('pt-PT')} €).` }
  c.dinheiro -= custo
  garantirEstrutura(c).membros = staffDe(c)!.membros.filter((x) => x.funcao !== f)
  return { ok: true, texto: `${m.nome} foi despedido.` }
}

export function mudarFoco(mundo: Mundo, clubeId: number, foco: FocoTreino): void {
  garantirEstrutura(mundo.clubes[clubeId]).foco = foco
}

export function mudarIntensidade(mundo: Mundo, clubeId: number, i: Intensidade): void {
  const st = garantirEstrutura(mundo.clubes[clubeId])
  if (i === 'normal') delete st.intensidade
  else st.intensidade = i
}

/** Treino específico de um atributo (ou `null` para equilibrado). */
export function mudarTreinoAtributo(mundo: Mundo, clubeId: number, a: Atributo | null): void {
  const st = garantirEstrutura(mundo.clubes[clubeId])
  if ((st.atributo ?? null) !== a) st.ganhosAtrib = {}
  if (a) st.atributo = a
  else delete st.atributo
}

/** Probabilidade, por semana, de o treino específico subir 1 ponto no atributo (mesmo a quem já não evolui). */
export const P_TREINO_ATRIB = 0.05

// ---------- Treino ----------

/** Probabilidade base, por jornada, de um jogador abaixo do potencial ganhar 1 ponto de força. */
export const P_TREINO = 0.045

/** Fator do treinador: sem ninguém 0.5; nível 1 0.8 ... nível 5 1.6. */
export function fatorTreinador(nivel: number): number {
  return nivel <= 0 ? 0.5 : 0.6 + 0.2 * nivel
}

function fatorIdade(idade: number): number {
  if (idade <= 21) return 1.4
  if (idade <= 25) return 1
  if (idade <= 29) return 0.6
  return 0
}

function fatorFoco(foco: FocoTreino, j: Jogador): number {
  if (foco === 'equilibrado') return 1
  if (foco === 'jovens') return j.idade <= 21 ? 1.5 : 0.85
  return j.posicao === foco ? 1.5 : 0.85
}

/** Treinador de setor da posição do jogador (se houver). */
export function setorDe(pos: Posicao): FuncaoSetor | undefined {
  return SETOR_DA_POS[pos]
}

/** Fator do treinador de setor: sem ninguém 1; nível 1 1.08 ... nível 5 1.4. */
export function fatorSetor(c: Clube | undefined, pos: Posicao): number {
  const f = SETOR_DA_POS[pos]
  return f ? 1 + 0.08 * nivelDe(c, f) : 1
}

export function intensidadeDe(c: Clube | undefined): Intensidade {
  return (c && staffDe(c)?.intensidade) || 'normal'
}

/** Probabilidade de um jogador evoluir nesta jornada de treino. */
export function chanceTreino(c: Clube | undefined, j: Jogador): number {
  if (j.forca >= j.potencial) return 0
  const f = fatorIdade(j.idade)
  if (!f) return 0
  const treinador = fatorTreinador(nivelDe(c, j.posicao === 'GR' ? 'gr' : 'adjunto'))
  return P_TREINO * f * treinador * fatorSetor(c, j.posicao) * FATOR_INTENSIDADE[intensidadeDe(c)] *
    fatorFoco(staffDe(c as Clube)?.foco ?? 'equilibrado', j) * fatorTreinoPers(j)
}

/** Probabilidade, por semana, de o treino individual subir um atributo (cerca de 2,5x a do treino específico). */
export const P_TREINO_INDIVIDUAL = 0.12

/** Pontos de aprendizagem de uma posição nova por semana (100 = aprendida). */
export function ritmoPosicao(c: Clube | undefined, j: Jogador, pos: Posicao): number {
  const idade = j.idade <= 21 ? 1.3 : j.idade <= 29 ? 1 : 0.7
  return (3 + nivelDe(c, 'adjunto')) * idade * fatorSetor(c, pos) * FATOR_INTENSIDADE[intensidadeDe(c)]
}

/** Põe (ou tira, com `null`) um plano de treino individual. */
export function definirPlano(mundo: Mundo, clubeId: number, jogadorId: number, plano: PlanoIndividual | null): Resultado {
  const st = garantirEstrutura(mundo.clubes[clubeId])
  const j = mundo.jogadores[jogadorId]
  if (!j || j.clubeId !== clubeId) return { ok: false, texto: 'Esse jogador não é do plantel.' }
  const planos = { ...(st.planos ?? {}) }
  if (!plano) {
    delete planos[jogadorId]
    st.planos = planos
    return { ok: true, texto: `${j.curto} volta ao treino normal.` }
  }
  if (!planos[jogadorId] && Object.keys(planos).length >= PLANOS_MAX) return { ok: false, texto: `No máximo ${PLANOS_MAX} jogadores com treino individual.` }
  if (plano.tipo === 'posicao') {
    if (plano.posicao === j.posicao) return { ok: false, texto: `${j.curto} já é ${plano.posicao}.` }
    if (plano.posicao === 'GR' || j.posicao === 'GR') return { ok: false, texto: 'Ninguém aprende a ser guarda-redes (nem o contrário) a meio da carreira.' }
    if (aprendido(j, plano.posicao) >= 100) return { ok: false, texto: `${j.curto} já joga bem a ${plano.posicao}.` }
  } else if (!PESOS[j.posicao][plano.atributo]) return { ok: false, texto: `Esse atributo não conta na posição de ${j.curto}.` }
  planos[jogadorId] = plano
  st.planos = planos
  return { ok: true, texto: plano.tipo === 'posicao' ? `${j.curto} começa a aprender a jogar a ${plano.posicao}.` : `${j.curto} tem treino individual de ${plano.atributo}.` }
}

/**
 * Uma jornada de treino nos clubes que jogaram. Os lesionados (`ausentes`) não treinam.
 * Devolve os ids dos jogadores que ganharam força.
 */
export function treinarJornada(mundo: Mundo, clubes: Iterable<number>, ausentes: Set<number>, semente: number, ano: number): number[] {
  const rng = createRng(semente)
  const out: number[] = []
  for (const cid of [...clubes].sort((a, b) => a - b)) {
    const c = mundo.clubes[cid]
    if (!c) continue
    const st = staffDe(c)
    const inten = intensidadeDe(c)
    for (const id of c.plantel) {
      const j = mundo.jogadores[id]
      if (!j || ausentes.has(id)) continue
      const p = chanceTreino(c, j)
      const ganhou = p > 0 && rng.chance(p)
      if (ganhou) {
        j.forca += 1
        j.valor = valorDe(j.forca, j.idade)
        out.push(id)
        if (st) {
          if (st.ano !== ano) { st.ano = ano; st.ganhos = {}; st.ganhosAtrib = {} }
          st.ganhos![id] = (st.ganhos![id] ?? 0) + 1
        }
        // O treinador de setor puxa o atributo-chave da posição quando o jogador sobe (sem sorteio extra).
        const fs = setorDe(j.posicao)
        if (fs && nivelDe(c, fs) > 0) mexerPerfil(j, { [ATRIB_SETOR[fs]]: 0.25 * nivelDe(c, fs) })
      }
      // Intensidade: o treino forte cansa, o leve ajuda a recuperar.
      if (inten === 'forte') definirFadiga(j, fadigaDe(j) + 8)
      else if (inten === 'leve') definirFadiga(j, fadigaDe(j) * 0.8)
      // Treino individual (planos do utilizador): substitui o treino específico para esse jogador.
      const plano = st?.planos?.[id]
      if (plano?.tipo === 'posicao') {
        const novo = Math.min(100, aprendido(j, plano.posicao) + ritmoPosicao(c, j, plano.posicao))
        definirAprendido(j, plano.posicao, novo)
        if (novo >= 100) delete st!.planos![id]
        continue
      }
      if (plano?.tipo === 'atributo' && PESOS[j.posicao][plano.atributo]) {
        const a = plano.atributo
        const sobe = ganhou ? 3 : rng.chance(P_TREINO_INDIVIDUAL * fatorTreinador(nivelDe(c, j.posicao === 'GR' ? 'gr' : 'adjunto'))) ? 1.5 : 0
        if (sobe) {
          const antes = atributo(j, a)
          mexerPerfil(j, { [a]: sobe })
          if (st!.ano !== ano) { st!.ano = ano; st!.ganhos = {}; st!.ganhosAtrib = {} }
          st!.ganhosAtrib ??= {}
          const d = atributo(j, a) - antes - (ganhou ? 1 : 0)
          if (d > 0) st!.ganhosAtrib[id] = (st!.ganhosAtrib[id] ?? 0) + d
        }
        continue
      }
      // Treino específico: o atributo escolhido sobe mais do que os outros (a força geral não muda por isso).
      // Só gasta sorteios quando há treino específico, para não mexer nos outros clubes.
      const a = st?.atributo
      if (a && PESOS[j.posicao][a]) {
        const sobe = ganhou ? 3 : rng.chance(P_TREINO_ATRIB * fatorTreinador(nivelDe(c, j.posicao === 'GR' ? 'gr' : 'adjunto'))) ? 1.5 : 0
        if (sobe) {
          const antes = atributo(j, a)
          mexerPerfil(j, { [a]: sobe })
          if (st.ano !== ano) { st.ano = ano; st.ganhos = {}; st.ganhosAtrib = {} }
          st.ganhosAtrib ??= {}
          const d = atributo(j, a) - antes - (ganhou ? 1 : 0)
          if (d > 0) st.ganhosAtrib[id] = (st.ganhosAtrib[id] ?? 0) + d
        }
      }
    }
  }
  return out
}

/** Duração de uma lesão com o preparador físico do clube (nível 5 encurta cerca de 35%). */
export function duracaoLesao(c: Clube | undefined, jogos: number): number {
  const n = nivelDe(c, 'fisico')
  return Math.max(1, Math.round(jogos * (1 - 0.07 * n)))
}

/**
 * Evolução no fim da época (envelhecimento). Os jovens crescem mais quanto mais longe estão do potencial
 * (um júnior de teto alto dá saltos; quem já está perto do teto quase não mexe). Somado ao treino da época
 * dá a curva da idade. Alguns jogadores florescem tarde (22-26 anos). O declínio começa aos 30 (31 para
 * um profissional, 29 para um descontraído) e acelera 4 anos depois; um bom preparador físico poupa algum.
 */
export function evoluirFimEpoca(mundo: Mundo, j: Jogador, rng: Rng): void {
  const c = mundo.clubes[j.clubeId]
  let forca = j.forca
  let quebra = 0
  const extra = anosExtraCarreira(j)
  const declinio = 30 + extra
  if (j.idade >= declinio + 4) quebra = rng.int(2, 5)
  else if (j.idade >= declinio) quebra = rng.int(1, 3)
  else if (forca < j.potencial) {
    const gap = j.potencial - forca
    let passo = 0
    if (j.idade <= 21) passo = Math.round(0.4 + gap * 0.08 + rng.normal(0, 0.8))
    else if (j.idade <= 25) passo = Math.round(gap * 0.05 + rng.normal(0, 0.5))
    passo = Math.max(j.idade <= 21 ? 1 : 0, Math.min(5, passo))
    // Florescer tarde: um salto inesperado entre os 22 e os 26 anos (e o teto sobe um pouco).
    if (j.idade >= 22 && j.idade <= 26 && rng.chance(0.03)) {
      passo += rng.int(2, 4)
      j.potencial = Math.min(99, j.potencial + 3)
    }
    forca = Math.min(j.potencial, forca + passo)
  }
  if (quebra > 0) {
    const n = nivelDe(c, 'fisico')
    // Na fase final da carreira a quebra nunca desaparece de todo.
    if (n > 0 && (j.idade < declinio + 4 || quebra > 1) && rng.chance(0.12 * n)) quebra -= 1
    if (personalidadeDe(j) === 'profissional' && quebra > 1 && rng.chance(0.3)) quebra -= 1
    forca -= quebra
  }
  j.forca = Math.max(1, Math.min(99, forca))
  // Com a idade perde-se velocidade e físico primeiro; a experiência compensa no passe e na defesa.
  if (j.idade >= 30) mexerPerfil(j, { vel: -1.5, fis: -1, pas: 0.5, def: 0.5 })
}

// ---------- Olheiro: estimativa do potencial ----------

/** Largura do intervalo estimado por nível do olheiro (0 = sem olheiro). */
const LARGURA = [16, 12, 9, 6, 4, 2]

export interface Estimativa { min: number; max: number; texto: string }

/**
 * Estimativa do potencial de um jogador vista pelo clube `clubeId`. Sem olheiro é larga e pode
 * enganar; com um olheiro bom fica estreita e perto da verdade. Estável (não muda ao recarregar).
 */
export function estimativaPotencial(mundo: Mundo, clubeId: number, j: Jogador): Estimativa {
  const n = nivelDe(mundo.clubes[clubeId], 'olheiro')
  const w = LARGURA[n] ?? 2
  const r = createRng(mistura(mundo.semente, j.id, clubeId, n))
  const erro = (r.next() * 2 - 1) * w * 0.6
  const centro = j.potencial + erro
  const min = Math.max(j.forca, Math.round(centro - w / 2))
  const max = Math.max(min, Math.min(99, Math.round(centro + w / 2)))
  // A mesma escala do resto do jogo (comparada com a força do meu clube), mas sobre a estimativa.
  const texto = potencialTexto({ ...j, potencial: Math.round((min + max) / 2) }, mundo, clubeId)
  return { min, max, texto }
}

/** Juniores extra por época conforme o olheiro (nível 3: +1, nível 5: +2). */
export function juniorExtra(c: Clube | undefined): number {
  const n = nivelDe(c, 'olheiro')
  return n >= 5 ? 2 : n >= 3 ? 1 : 0
}
