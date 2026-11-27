// Equipa técnica (staff) e treino: adjunto, treinador de guarda-redes, preparador físico e olheiro.
// Cada clube tem no máximo um de cada. O nível (1 a 5) decide o efeito e o salário.
// Tudo determinístico: os sorteios usam createRng com sementes derivadas do mundo.
import { nivelDe as nivelDivisaoDe } from './ligas'
import { manutencaoAcademia } from './academia'
import { anosExtraCarreira, fatorTreinoPers, personalidadeDe } from './personalidade'
import { PESOS, atributo, mexerPerfil, type Atributo } from './atributos'
import { createRng, type Rng } from './rng'
import { valorDe } from './mundo'
import { APELIDOS_PT, NOMES_PT } from './nomes'
import { potencialTexto } from './juniores'
import type { Clube, Jogador, Mundo, Posicao } from './types'

export type Funcao = 'adjunto' | 'gr' | 'fisico' | 'olheiro'
export const FUNCOES: readonly Funcao[] = ['adjunto', 'gr', 'fisico', 'olheiro']

export const NOME_FUNCAO: Record<Funcao, string> = {
  adjunto: 'Treinador adjunto',
  gr: 'Treinador de guarda-redes',
  fisico: 'Preparador físico',
  olheiro: 'Olheiro',
}

export const EFEITO_FUNCAO: Record<Funcao, string> = {
  adjunto: 'Faz evoluir os jogadores de campo no treino.',
  gr: 'Faz evoluir os guarda-redes no treino.',
  fisico: 'Encurta as lesões e atrasa a quebra dos veteranos.',
  olheiro: 'Estima melhor o potencial dos jovens e descobre mais juniores.',
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
}

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

export function salarioStaff(nivel: number, divisao: number): number {
  return arredonda((SALARIO_BASE[divisao - 1] ?? 400) * (FATOR_NIVEL[nivel - 1] ?? 1))
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
    out.push({ id, nome: nomeStaff(rng), funcao: f, nivel, salario: arredonda(salarioStaff(nivel, nivelDivisaoDe(c)) * desvio) })
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

/** Probabilidade de um jogador evoluir nesta jornada de treino. */
export function chanceTreino(c: Clube | undefined, j: Jogador): number {
  if (j.forca >= j.potencial) return 0
  const f = fatorIdade(j.idade)
  if (!f) return 0
  const treinador = fatorTreinador(nivelDe(c, j.posicao === 'GR' ? 'gr' : 'adjunto'))
  return P_TREINO * f * treinador * fatorFoco(staffDe(c as Clube)?.foco ?? 'equilibrado', j) * fatorTreinoPers(j)
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
