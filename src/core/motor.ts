// Motor de jogo minuto a minuto. Estatístico (sem física de bola), ao estilo dos clássicos:
// o meio-campo decide a posse e quantas jogadas cada equipa tem; ataque contra defesa decide
// a qualidade das oportunidades; rematador contra guarda-redes decide a defesa.
import { createRng, type Rng } from './rng'
import type { Jogador, Mundo, Posicao } from './types'
import { FORMACOES } from './partida'
import type { Escalacao, EstatJogo, EventoJogo, Formacao, Lado, Lance, Partida, Postura } from './partida'
import { fatorMoral } from './balneario'
import { fatorFisico, riscoLesao, sortearLesao } from './lesoes'
import { fatorFaltaPers, personalidadeDe } from './personalidade'
import { atributo, fatores, notaNaPosicao, type FatoresMotor } from './atributos'
import { EFEITO_INSTRUCAO, fatorMarcado, type Instrucao, type Marcacao, type PlanoJogo } from './plano'
import { calcularNotas, contarCartao, contarDesarme, contarPerda, contarRemate, novaConta, type ContaJogo, type Contas } from './notas'

/** Estado interno de um jogo a decorrer. Serializável (sem funções). */
export interface EstadoJogo {
  partida: Partida
  minuto: number
  escalacoes: Record<Lado, Escalacao>
  /** Substituições feitas por lado (máximo 5). */
  subs: Record<Lado, number>
  /** Jogadores expulsos ou lesionados que saíram (não podem voltar). */
  fora: number[]
  /** Estado do gerador de números, para continuar de forma determinística. */
  rng: number
  [extra: string]: unknown
}

/** Campos internos extra guardados em EstadoJogo. */
interface Extra {
  /** Lados em que o motor substitui sozinho os lesionados (equipas da IA). A UI põe false no lado do jogador. */
  autoSub: Record<Lado, boolean>
  expulsos: number[]
  /** Lesionados no jogo (também estão em `fora`); podem ser substituídos. */
  lesionados: number[]
  amarelosJogo: Record<number, number>
  /** Titulares iniciais (para o cansaço). */
  iniciais: number[]
  /** Soma das quotas de posse da casa por minuto. */
  posseAcum: number
  /** Último minuto do jogo (90 + descontos), decidido ao minuto 90. */
  fimMinuto: number
  /** Quem teve a bola no último minuto jogado (para o campo 2D ao vivo). */
  posseMinuto?: Lado
  /** Remate sem perigo do último minuto e canto sem remate (só para o 2D encenar; não decide nada). */
  remateMinuto?: { lado: Lado; lance: Lance }
  cantoMinuto?: Lado
  /** Contas de cada jogador para a nota (ver notas.ts). Gravações antigas não têm: começam vazias. */
  contas?: Contas
  /** Gerador próprio da nota (desarmes, perdas, erros): não mexe no gerador do jogo. */
  rngNota?: number
}

export const MAX_SUBS = 5
const LADOS: Lado[] = ['casa', 'fora']
/** Probabilidade base de uma jogada de ataque acabar em remate, por minuto. */
const TAXA_REMATE = 0.3
/** Probabilidade base de golo por remate numa jogada equilibrada. */
const CONVERSAO = 0.125

function ex(e: EstadoJogo): Extra {
  return e as unknown as Extra
}

function idx(l: Lado): 0 | 1 {
  return l === 'casa' ? 0 : 1
}

function outro(l: Lado): Lado {
  return l === 'casa' ? 'fora' : 'casa'
}

/** Posição do lugar `i` na formação (0 = GR, depois DEF, MED, AV). */
export function posicaoDoLugar(formacao: Formacao, i: number): Posicao {
  const [d, m] = FORMACOES[formacao]
  if (i === 0) return 'GR'
  if (i <= d) return 'DEF'
  if (i <= d + m) return 'MED'
  return 'AV'
}

/**
 * Força efetiva de um jogador num lugar: fora da posição vale cerca de 70%, conforme os atributos
 * que essa posição pede (um lateral com bom passe safa-se melhor a médio).
 */
export function forcaNoLugar(j: Jogador, pos: Posicao): number {
  if (j.posicao === pos) return j.forca
  if (pos === 'GR' || j.posicao === 'GR') return j.forca * 0.45
  return Math.min(j.forca, notaNaPosicao(j, pos)) * 0.74
}

/** Escolhe a melhor escalação automática para um clube, ignorando indisponíveis. */
export function escalarAuto(mundo: Mundo, clubeId: number, indisponiveis: ReadonlySet<number>, formacao: Escalacao['formacao'] = '4-4-2'): Escalacao {
  const clube = mundo.clubes[clubeId]
  // Quem está cansado perde o lugar para um colega fresco de força parecida (rotação natural).
  const disp = clube.plantel
    .filter((id) => !indisponiveis.has(id) && mundo.jogadores[id])
    .map((id) => mundo.jogadores[id])
    .sort((a, b) => b.forca * fatorFisico(b) - a.forca * fatorFisico(a) || a.id - b.id)
  const usados = new Set<number>()
  const [d, m, a] = FORMACOES[formacao]
  const lugares: Posicao[] = ['GR', ...Array<Posicao>(d).fill('DEF'), ...Array<Posicao>(m).fill('MED'), ...Array<Posicao>(a).fill('AV')]
  const titulares: number[] = []
  // Primeiro os de posição natural, depois preencher buracos com o melhor que render nesse lugar.
  const escolha: (number | undefined)[] = lugares.map(() => undefined)
  lugares.forEach((pos, i) => {
    const j = disp.find((p) => !usados.has(p.id) && p.posicao === pos)
    if (j) { escolha[i] = j.id; usados.add(j.id) }
  })
  lugares.forEach((pos, i) => {
    if (escolha[i] !== undefined) return
    let melhor: Jogador | undefined
    // Um guarda-redes só joga fora da baliza se não houver mais ninguém.
    const soGR = pos !== 'GR' && !disp.some((p) => !usados.has(p.id) && p.posicao !== 'GR')
    for (const p of disp) {
      if (usados.has(p.id) || (pos !== 'GR' && p.posicao === 'GR' && !soGR)) continue
      if (!melhor || forcaNoLugar(p, pos) * fatorFisico(p) > forcaNoLugar(melhor, pos) * fatorFisico(melhor)) melhor = p
    }
    if (melhor) { escolha[i] = melhor.id; usados.add(melhor.id) }
  })
  for (const id of escolha) if (id !== undefined) titulares.push(id)
  const resto = disp.filter((p) => !usados.has(p.id))
  const suplentes: number[] = []
  const gr = resto.find((p) => p.posicao === 'GR')
  if (gr) suplentes.push(gr.id)
  for (const p of resto) {
    if (suplentes.length >= 9) break
    if (!suplentes.includes(p.id)) suplentes.push(p.id)
  }
  return { formacao, postura: 'equilibrada', titulares, suplentes }
}

function estatVazia(): EstatJogo {
  return { posse: [50, 50], remates: [0, 0], rematesBaliza: [0, 0], cantos: [0, 0], amarelos: [0, 0], vermelhos: [0, 0] }
}

/** Prepara um jogo para ser jogado minuto a minuto. */
export function iniciarJogo(_mundo: Mundo, partida: Partida, casa: Escalacao, fora: Escalacao, semente: number): EstadoJogo {
  const copia = (e: Escalacao): Escalacao => ({ ...e, titulares: e.titulares.slice(), suplentes: e.suplentes.slice() })
  const extra: Extra = {
    autoSub: { casa: true, fora: true },
    expulsos: [],
    lesionados: [],
    amarelosJogo: {},
    iniciais: [...casa.titulares, ...fora.titulares],
    posseAcum: 0,
    fimMinuto: 90,
    contas: {},
    rngNota: ((semente ^ 0x5bd1e995) >>> 0) || 1,
  }
  return {
    partida: { ...partida, golos: [0, 0], eventos: [], estat: estatVazia(), jogada: false, porque: undefined, onzes: [copia(casa), copia(fora)] },
    minuto: 0,
    escalacoes: { casa: copia(casa), fora: copia(fora) },
    subs: { casa: 0, fora: 0 },
    fora: [],
    rng: createRng(semente).state(),
    ...extra,
  }
}

/** Liga ou desliga as substituições automáticas de lesionados num lado (desligar no lado do jogador). */
export function definirAutoSub(estado: EstadoJogo, lado: Lado, ligado: boolean): void {
  ex(estado).autoSub[lado] = ligado
}

interface EmCampo {
  j: Jogador
  pos: Posicao
  ef: number
  /** Atributos face à força (1 = igual à força). */
  f: FatoresMotor
  /** Instrução individual do plano de jogo. */
  inst?: Instrucao
  /** Quem o marca de perto (marcação individual do adversário). */
  marcador?: Jogador
}

/** Quem do lado `lado` está a marcar de perto e a quem (o marcador tem de estar em campo). */
function marcacaoIndividual(estado: EstadoJogo, lado: Lado): { marcador: number; alvo: number } | null {
  const esc = estado.escalacoes[lado]
  const pl = esc.plano
  if (!pl?.alvo || !pl.instrucoes) return null
  const marcador = esc.titulares.find((id) => pl.instrucoes![id] === 'marcar' && !estado.fora.includes(id))
  return marcador != null ? { marcador, alvo: pl.alvo } : null
}

function emCampo(mundo: Mundo, estado: EstadoJogo, lado: Lado): EmCampo[] {
  const esc = estado.escalacoes[lado]
  const out: EmCampo[] = []
  const iniciais = ex(estado).iniciais
  const m = estado.minuto
  // Cansaço ligeiro depois dos 60' para quem começou o jogo (o físico cansa menos). Pressão alta cansa mais.
  const kPressao = esc.plano?.marcacao === 'pressao' ? 1.7 : 1
  const cansaco = (f: FatoresMotor) => m > 60 ? 1 - (m - 60) * 0.0025 * kPressao * (2 - f.fis) : 1
  const mi = marcacaoIndividual(estado, lado === 'casa' ? 'fora' : 'casa')
  esc.titulares.forEach((id, i) => {
    if (estado.fora.includes(id)) return
    const j = mundo.jogadores[id]
    if (!j) return
    const pos = posicaoDoLugar(esc.formacao, i)
    // Moral e cansaço acumulado das últimas semanas mexem pouco, mas mexem.
    const f = fatores(j)
    let ef = forcaNoLugar(j, pos) * (iniciais.includes(id) ? cansaco(f) : 1) * fatorMoral(j) * fatorFisico(j)
    // Marcado de perto: rende menos, conforme a qualidade do marcador.
    const marcador = mi && mi.alvo === id ? mundo.jogadores[mi.marcador] : undefined
    if (marcador) ef *= fatorMarcado(marcador, j)
    const inst = esc.plano?.instrucoes?.[id]
    out.push({ j, pos, f, ef, ...(inst ? { inst } : {}), ...(marcador ? { marcador } : {}) })
  })
  return out
}

export interface Setores {
  gr: number
  meio: number
  ataque: number
  defesa: number
}

function somarSetores(campo: EmCampo[], emCasa: boolean, post: Postura, plano?: PlanoJogo): Setores {
  // Cada setor soma a força efetiva, puxada um pouco pelo atributo que esse setor pede:
  // passe no meio-campo, remate e velocidade no ataque, defesa atrás, reflexos na baliza.
  // Num plantel normal os fatores dão 1 em média: o perfil decide quem é bom em quê, não a força total.
  const vazio = (): Record<Posicao, number> => ({ GR: 0, DEF: 0, MED: 0, AV: 0 })
  const m = vazio(), a = vazio(), d = vazio()
  let g = 0, ataqueExtra = 0, defesaExtra = 0
  for (const c of campo) {
    const f = c.f
    if (c.pos === 'GR') { g += c.ef * f.gr50; continue }
    m[c.pos] += c.ef * (c.pos === 'MED' ? f.pas35 : f.pas15) * (c.inst === 'marcar' ? 0.8 : 1)
    a[c.pos] += c.ef * (c.pos === 'AV' ? f.rem25vel15 : c.pos === 'MED' ? f.rem20 : 1)
    d[c.pos] += c.ef * (c.pos === 'DEF' ? f.def35 : c.pos === 'MED' ? f.def20 : 1)
    // Instruções individuais trocam um bocado de defesa por ataque (ou o contrário): o que se ganha
    // depende do remate (e velocidade) do jogador, o que se perde da defesa dele. Ninguém ganha de graça.
    if (c.inst) {
      const e = EFEITO_INSTRUCAO[c.inst]
      // Subir: ganha com remate e velocidade, perde o que corria atrás (físico e velocidade).
      // Ficar atrás: ganha com a defesa, perde o que dava à saída de bola (passe e velocidade).
      // Um avançado a subir (ou um central a ficar atrás) já está onde a instrução o manda: muda pouco.
      const k = (c.inst === 'subir' && c.pos === 'AV') || (c.inst === 'segurar' && c.pos === 'DEF') ? 0.4 : 1
      if (c.inst === 'subir') { ataqueExtra += k * c.ef * e.ataque * Math.sqrt(f.rem * f.vel); defesaExtra += k * c.ef * e.defesa * Math.sqrt(f.fis * f.vel) }
      else if (c.inst === 'segurar') { ataqueExtra += k * c.ef * e.ataque * Math.sqrt(f.pas * f.vel); defesaExtra += k * c.ef * e.defesa * f.def }
      else ataqueExtra += c.ef * e.ataque * f.rem
    }
  }
  // Marcação: a pressão alta ganha bola conforme a velocidade e o físico, mas joga com a linha subida;
  // a individual rende o que os defesas valem a defender (a velocidade dos avançados conta no jogo).
  let fMeio = 1, fDef = 1
  const mc = plano?.marcacao
  if (mc === 'pressao') {
    const campoJ = campo.filter((c) => c.pos !== 'GR')
    const pf = campoJ.length ? campoJ.reduce((s, c) => s + (c.f.fis + c.f.vel) / 2, 0) / campoJ.length : 1
    fMeio = 1.04 + 0.9 * (pf - 1)
    fDef = 0.985
  } else if (mc === 'homem') {
    const defs = campo.filter((c) => c.pos === 'DEF')
    const df = defs.length ? defs.reduce((s, c) => s + c.f.def, 0) / defs.length : 1
    fDef = 1.02 * (1 + 0.8 * (df - 1))
  }
  const a0 = a.AV + 0.35 * a.MED + 0.1 * a.DEF
  const d0 = d.DEF + 0.35 * d.MED + 0.1 * d.AV
  const casa = emCasa ? 1.04 : 1
  const fa = post === 'ofensiva' ? 1.12 : post === 'defensiva' ? 0.88 : 1
  const fd = post === 'ofensiva' ? 0.88 : post === 'defensiva' ? 1.12 : 1
  return {
    gr: (g || 20) * casa,
    meio: (m.MED + 0.25 * (m.DEF + m.AV)) * casa * fMeio,
    ataque: Math.max(1, a0 + ataqueExtra) * casa * fa,
    // As trocas contam em proporção a cada setor (o ataque soma menos do que a defesa).
    defesa: Math.max(1, d0 + defesaExtra * (d0 / Math.max(1, a0))) * casa * fd * fDef,
  }
}

/** Velocidade média (face à força) de um grupo de jogadores em campo. */
function velMedia(campo: EmCampo[], pos: Posicao): number {
  const l = campo.filter((c) => c.pos === pos)
  return l.length ? l.reduce((s, c) => s + c.f.vel, 0) / l.length : 1
}

function setores(_mundo: Mundo, estado: EstadoJogo, lado: Lado, campo: EmCampo[]): Setores {
  const esc = estado.escalacoes[lado]
  return somarSetores(campo, lado === 'casa', esc.postura, esc.plano)
}

/** Força de cada setor de uma escalação antes do jogo (para a antevisão). */
export function forcaSetores(mundo: Mundo, esc: Escalacao, emCasa: boolean): Setores {
  const campo: EmCampo[] = []
  esc.titulares.forEach((id, i) => {
    const j = mundo.jogadores[id]
    if (!j) return
    const pos = posicaoDoLugar(esc.formacao, i)
    const inst = esc.plano?.instrucoes?.[id]
    campo.push({ j, pos, f: fatores(j), ef: forcaNoLugar(j, pos), ...(inst ? { inst } : {}) })
  })
  return somarSetores(campo, emCasa, esc.postura, esc.plano)
}

/** Gerador mínimo (mulberry32, como o rng.ts) para a nota: barato de criar a cada minuto. */
function rngLeve(seed: number): Rng & { state(): number } {
  let s = seed >>> 0
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return { next, chance: (p: number) => next() < p, pick: <T>(l: readonly T[]) => l[Math.floor(next() * l.length)], state: () => s } as Rng
}

function pesado<T>(rng: Rng, itens: T[], peso: (t: T) => number): T | undefined {
  let total = 0
  for (const it of itens) total += Math.max(0, peso(it))
  if (total <= 0) return itens.length ? rng.pick(itens) : undefined
  let r = rng.next() * total
  for (const it of itens) {
    r -= Math.max(0, peso(it))
    if (r <= 0) return it
  }
  return itens[itens.length - 1]
}

const PESO_REMATE: Record<Posicao, number> = { GR: 0, DEF: 0.5, MED: 1.6, AV: 4 }
const PESO_PASSE: Record<Posicao, number> = { GR: 0.05, DEF: 0.8, MED: 3, AV: 1.5 }
const PESO_FALTA: Record<Posicao, number> = { GR: 0.2, DEF: 3, MED: 2, AV: 1 }
const PESO_CABECA: Record<Posicao, number> = { GR: 0, DEF: 2, MED: 1, AV: 2.6 }
const PESO_DESARME: Record<Posicao, number> = { GR: 0, DEF: 3, MED: 2, AV: 0.6 }
const PESO_PERDA: Record<Posicao, number> = { GR: 0.1, DEF: 0.6, MED: 1.2, AV: 1.5 }

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

function textoGolo(l: Lance, rem: string, pas?: string): string {
  switch (l.origem) {
    case 'contra': return `Golo! Contra-ataque rápido e ${rem} finaliza.`
    case 'canto':
      if (l.esquema === 'curto') return pas ? `Golo! Canto curto, ${pas} combina e ${rem} finaliza.` : `Golo! Canto curto bem trabalhado e ${rem} finaliza.`
      if (l.esquema === 'entrada') return `Golo! Canto atrasado e ${rem} remata da entrada da área.`
      return l.esquema === 'area' && pas ? `Golo! ${pas} cruza para o segundo poste e ${rem} cabeceia.` : `Golo! ${rem} de cabeça na sequência de um canto.`
    case 'livre':
      if (l.esquema === 'cruzar') return pas ? `Golo! Livre cruzado por ${pas} e ${rem} cabeceia.` : `Golo! Livre cruzado e ${rem} cabeceia.`
      return `Golo de livre! ${rem} põe a bola no ângulo.`
    case 'penalti': return `Golo! ${rem} não falha o penálti.`
    case 'longe': return `Golaço! ${rem} de fora da área.`
    default: return pas ? `Golo! ${rem} remata cruzado após passe de ${pas}.` : `Golo! ${rem} remata cruzado.`
  }
}

function textoOportunidade(l: Lance, rem: string, gr?: string): string {
  if (l.desfecho === 'poste') return `Ao poste! ${rem} esteve muito perto.`
  if (l.desfecho === 'defesa') return gr ? `Grande defesa de ${gr} a remate de ${rem}.` : `Remate de ${rem} defendido.`
  return l.origem === 'penalti' ? `Penálti falhado! ${rem} atira para fora.` : `${rem} isolado, mas atira ao lado.`
}

function retirarLesionadoAuto(mundo: Mundo, estado: EstadoJogo, lado: Lado, saiId: number): EventoJogo | null {
  const esc = estado.escalacoes[lado]
  if (estado.subs[lado] >= MAX_SUBS) return null
  const i = esc.titulares.indexOf(saiId)
  if (i < 0) return null
  const pos = posicaoDoLugar(esc.formacao, i)
  const cands = esc.suplentes.filter((id) => !estado.fora.includes(id) && mundo.jogadores[id])
  if (!cands.length) return null
  let melhor = cands[0]
  for (const id of cands) {
    if (forcaNoLugar(mundo.jogadores[id], pos) > forcaNoLugar(mundo.jogadores[melhor], pos)) melhor = id
  }
  if (!substituir(mundo, estado, lado, saiId, melhor)) return null
  return estado.partida.eventos[estado.partida.eventos.length - 1]
}

/** Joga o minuto seguinte (1 a 90, com descontos opcionais) e devolve os eventos desse minuto. Ao 45 inclui 'intervalo'; no fim inclui 'fim' e marca partida.jogada = true. */
export function avancarMinuto(mundo: Mundo, estado: EstadoJogo): EventoJogo[] {
  const p = estado.partida
  if (p.jogada) return []
  const x = ex(estado)
  const rng = createRng(estado.rng)
  estado.minuto++
  const min = estado.minuto
  const evs: EventoJogo[] = []
  const sigla = (l: Lado) => mundo.clubes[l === 'casa' ? p.casaId : p.foraId]?.sigla ?? ''

  const campo = { casa: emCampo(mundo, estado, 'casa'), fora: emCampo(mundo, estado, 'fora') }
  const set = { casa: setores(mundo, estado, 'casa', campo.casa), fora: setores(mundo, estado, 'fora', campo.fora) }
  // Nota: minutos e posição de quem está em campo; o gerador da nota é separado do do jogo.
  const cs = (x.contas ??= {})
  const rn = rngLeve(x.rngNota ?? (((estado.rng ^ 0x5bd1e995) >>> 0) || 1))
  for (const lado of LADOS) {
    const l = idx(lado)
    for (const c of campo[lado]) {
      const k = (cs[c.j.id] ??= novaConta(l, c.pos))
      k.m++
      k.pos = c.pos
    }
  }
  const conta = (c: EmCampo | undefined): ContaJogo | undefined => (c ? cs[c.j.id] : undefined)
  let houveRemate = false

  // Posse: decide o meio-campo.
  const mc = Math.pow(set.casa.meio + 1, 1.5)
  const mf = Math.pow(set.fora.meio + 1, 1.5)
  const posseCasa = mc / (mc + mf)
  x.posseAcum += posseCasa

  // Jogada de ataque deste minuto.
  const atac: Lado = rng.chance(posseCasa) ? 'casa' : 'fora'
  x.posseMinuto = atac
  x.remateMinuto = undefined
  x.cantoMinuto = undefined
  const def = outro(atac)
  const sa = set[atac], sd = set[def]
  const plA = estado.escalacoes[atac].plano, plD = estado.escalacoes[def].plano
  const mcA = plA?.marcacao, mcD = plD?.marcacao
  // Avançados rápidos contra centrais lentos: mais contra-ataques e, contra marcação individual, menos defesa.
  const fVel = clamp(velMedia(campo[atac], 'AV') / velMedia(campo[def], 'DEF'), 0.7, 1.4)
  const fHomem = mcD === 'homem' ? clamp(1 - 0.8 * (fVel - 1), 0.8, 1.1) : 1
  const q = (sa.ataque + 1) / (sd.defesa * fHomem + 1)
  const ia = idx(atac)
  // Postura: ao ataque há mais gente na área e mais remates; à defesa, menos. A pressão alta também remata mais.
  const pAtac = estado.escalacoes[atac].postura
  const fRemate = (pAtac === 'ofensiva' ? 1.06 : pAtac === 'defensiva' ? 0.94 : 1) * (mcA === 'pressao' ? 1.04 : 1)
  if (rng.chance(clamp(TAXA_REMATE * fRemate * Math.pow(q, 0.5), 0.05, 0.6))) {
    // Contra-ataques: aparecem mais contra quem sobe as linhas (e pressiona alto) e para quem espera atrás.
    const pa = pAtac, pd = estado.escalacoes[def].postura
    const pContra = 0.13 * fVel * (pd === 'ofensiva' ? 1.7 : pd === 'defensiva' ? 0.5 : 1) * (pa === 'defensiva' ? 1.35 : pa === 'ofensiva' ? 0.8 : 1)
      * (mcD === 'pressao' ? 1.3 : 1)
    const r = rng.next()
    let origem: Lance['origem'] = r < 0.03 ? 'penalti' : r < 0.11 ? 'livre' : r < 0.23 ? 'canto' : r < 0.23 + pContra ? 'contra' : r < 0.37 + pContra ? 'longe' : 'jogada'
    const atacantes = campo[atac].filter((c) => c.pos !== 'GR')
    const defensores = campo[def].filter((c) => c.pos !== 'GR')
    const batedor = plA?.batedor != null ? atacantes.find((c) => c.j.id === plA.batedor) : undefined
    let esquema: Lance['esquema']
    if (origem === 'canto') esquema = plA?.canto
    else if (origem === 'livre') esquema = plA?.livre
    // Peso de cada jogador como rematador: a posição, a força, o remate e a instrução individual.
    const pesoRem = (c: EmCampo, longe: boolean) => PESO_REMATE[c.pos] * Math.pow(c.ef, 0.6) * c.f.rem150
      * (c.inst ? EFEITO_INSTRUCAO[c.inst].remate : 1) * (longe && c.inst === 'rematar' ? 2 : 1) * (c.marcador ? 0.6 : 1)
    // Bolas paradas pelo ar: ganha quem tem mais físico (os centrais sobem à área).
    const pesoCabeca = (c: EmCampo) => PESO_CABECA[c.pos] * Math.pow(c.ef, 0.6) * c.f.fis ** 2.5 * (c.marcador ? 0.6 : 1)
    let remC: EmCampo | undefined
    if (origem === 'penalti') {
      remC = batedor ?? atacantes.slice().sort((a, b) => atributo(b.j, 'rem') - atributo(a.j, 'rem') || b.j.forca - a.j.forca)[0]
    } else if (esquema === 'area' || esquema === 'cruzar') {
      remC = pesado(rng, atacantes.filter((c) => c !== batedor), pesoCabeca)
    } else if (esquema === 'entrada') {
      remC = pesado(rng, atacantes.filter((c) => c.pos !== 'DEF'), (c) => pesoRem(c, true) * c.f.rem ** 1.5)
    } else if (origem === 'livre' && esquema === 'direto' && batedor) {
      remC = batedor
    } else {
      remC = pesado(rng, atacantes, (c) => pesoRem(c, origem === 'longe'))
    }
    // Instrução de rematar de longe: na jogada corrida, metade das vezes tenta de fora.
    if (remC && origem === 'jogada' && remC.inst === 'rematar' && rng.chance(0.5)) origem = 'longe'
    if (remC) {
      let pasC: EmCampo | undefined
      if (origem === 'penalti' || (origem === 'livre' && esquema !== 'cruzar')) pasC = undefined
      else if (esquema === 'cruzar' || esquema === 'area' || esquema === 'curto') {
        // Quem cruza (ou combina no canto curto): o batedor, senão o melhor passe.
        pasC = batedor && batedor !== remC ? batedor
          : pesado(rng, atacantes.filter((c) => c !== remC), (c) => PESO_PASSE[c.pos] * c.ef * c.f.pas ** 3)
      } else pasC = pesado(rng, atacantes.filter((c) => c !== remC), (c) => PESO_PASSE[c.pos] * c.ef * c.f.pas150)
      const grC = campo[def].find((c) => c.pos === 'GR')
      const defC = remC.marcador ? defensores.find((c) => c.j === remC!.marcador)
        : pesado(rng, defensores, (c) => (c.pos === 'DEF' ? 3 : 1) * c.f.def)
      const grEf = sd.gr
      let fOrig = origem === 'penalti' ? (personalidadeDe(remC.j) === 'frio' ? 7.7 : 7) : origem === 'longe' ? 0.45 : origem === 'contra' ? 1.35 : origem === 'livre' ? 0.7 : 1
      // Remate do rematador (e velocidade, no contra-ataque) contra o guarda-redes.
      let fRem = remC.f.rem80 * (origem === 'contra' ? remC.f.vel40 : 1)
      if (esquema === 'area' || esquema === 'cruzar') {
        // Cabeceamento: físico do rematador contra o dos melhores de cabeça deles; a zona fecha melhor a área.
        const fisDef = defensores.map((c) => c.f.fis).sort((x, y) => y - x).slice(0, 3)
        const md = fisDef.length ? fisDef.reduce((s2, v) => s2 + v, 0) / fisDef.length : 1
        fRem = Math.pow(remC.f.fis / md, 1.5) * (pasC ? pasC.f.pas ** 0.5 : 1)
        fOrig = (esquema === 'cruzar' ? 0.8 : 1.05) * (mcD === 'zona' || !mcD ? 0.9 : 1)
      } else if (esquema === 'curto') {
        fOrig = 0.95 * (pasC ? pasC.f.pas ** 1.5 : 1) * (mcD === 'homem' ? 1.1 : 1)
      } else if (esquema === 'entrada') {
        fOrig = 0.72 * remC.f.rem ** 1.2 * (mcD === 'zona' || !mcD ? 1.1 : 1)
      } else if (esquema === 'direto') {
        fOrig = 0.66 * remC.f.rem ** 1.2
      } else if (origem === 'longe' && remC.inst === 'rematar') {
        // Quem tem ordem para rematar de longe e sabe rematar escolhe melhor o momento.
        fOrig = 0.5 * remC.f.rem ** 1.5
      }
      const pGolo = clamp(CONVERSAO * fOrig * Math.pow(q, 0.8) * Math.pow((remC.ef * fRem + 1) / (grEf + 1), 0.6), 0.01, 0.85)
      const rr = rng.next()
      let desfecho: Lance['desfecho']
      if (rr < pGolo) desfecho = 'golo'
      else if (rr < pGolo + (1 - pGolo) * 0.24) desfecho = 'defesa'
      else if (rr < pGolo + (1 - pGolo) * 0.27) desfecho = 'poste'
      else desfecho = 'fora'
      const corredor = (rng.int(-1, 1)) as -1 | 0 | 1
      const lance: Lance = {
        origem, rematadorId: remC.j.id, desfecho, corredor,
        ...(pasC ? { passadorId: pasC.j.id } : {}),
        ...(defC ? { defensorId: defC.j.id } : {}),
        ...(grC ? { guardaRedesId: grC.j.id } : {}),
        ...(esquema && (origem === 'canto' || origem === 'livre') ? { esquema } : {}),
        ...(remC.marcador ? { marcadorId: remC.marcador.id } : {}),
      }
      p.estat.remates[ia]++
      houveRemate = true
      if (desfecho === 'golo' || desfecho === 'defesa') p.estat.rematesBaliza[ia]++
      if (desfecho === 'golo') {
        p.golos[ia]++
        // Nota: golos com cada um em campo, e se houve erro do defesa ou do guarda-redes.
        for (const c of campo[atac]) cs[c.j.id].gf++
        for (const c of campo[def]) cs[c.j.id].gc++
        const erroDef = !!defC && origem !== 'penalti' && rn.chance(0.12 * clamp((remC.ef + 1) / (defC.ef + 1), 0.7, 1.5))
        const erroGR = !!grC && origem !== 'penalti' && rn.chance(origem === 'longe' || esquema === 'direto' ? 0.18 : 0.04)
        contarRemate(cs, lance, true, erroDef, erroGR)
        evs.push({ minuto: min, tipo: 'golo', lado: atac, jogadorId: remC.j.id, outroId: pasC?.j.id, lance, texto: `${textoGolo(lance, remC.j.curto, pasC?.j.curto)} (${sigla(atac)})` })
      } else {
        const clara = desfecho === 'poste' || origem === 'penalti' || (desfecho === 'defesa' && rng.chance(0.3)) || (desfecho === 'fora' && rng.chance(0.06))
        contarRemate(cs, lance, clara, false, false)
        if (clara) evs.push({ minuto: min, tipo: 'oportunidade', lado: atac, jogadorId: remC.j.id, outroId: pasC?.j.id, lance, texto: textoOportunidade(lance, remC.j.curto, grC?.j.curto) })
        else x.remateMinuto = { lado: atac, lance }
        if (desfecho !== 'poste' && rng.chance(0.3)) { p.estat.cantos[ia]++; x.cantoMinuto = atac }
      }
    }
  } else if (rng.chance(0.02)) {
    p.estat.cantos[ia]++
    x.cantoMinuto = atac
  }
  // Nota: o que o motor não conta (passes, desarmes, perdas de bola) sai do gerador da nota.
  // Ganha mais desarmes quem defende melhor; perde mais bolas quem passa pior.
  if (!houveRemate) {
    const r = rn.next()
    if (r < 0.5) contarDesarme(conta(pesado(rn, campo[def], (c) => PESO_DESARME[c.pos] * c.f.def * (c.ef + 40) * (c.inst === 'marcar' ? 1.3 : 1))))
    else if (r < 0.85) contarPerda(conta(pesado(rn, campo[atac], (c) => PESO_PERDA[c.pos] * (2.2 - c.f.pas) / (c.ef + 40))))
  }

  // Cartões e lesões.
  for (const lado of LADOS) {
    const il = idx(lado)
    const cl = campo[lado].filter((c) => !estado.fora.includes(c.j.id))
    if (!cl.length) continue
    // Marcação individual e pressão alta fazem mais faltas.
    const mcl = estado.escalacoes[lado].plano?.marcacao
    if (rng.chance(0.0195 * (mcl === 'homem' ? 1.2 : mcl === 'pressao' ? 1.15 : 1))) {
      // Quem já tem amarelo joga com cuidado: arrisca muito menos a falta.
      const c = pesado(rng, cl, (c) => PESO_FALTA[c.pos] * fatorFaltaPers(c.j) * (x.amarelosJogo[c.j.id] ? 0.3 : 1))!
      const id = c.j.id
      x.amarelosJogo[id] = (x.amarelosJogo[id] ?? 0) + 1
      p.estat.amarelos[il]++
      if (x.amarelosJogo[id] >= 2) {
        p.estat.vermelhos[il]++
        x.expulsos.push(id)
        estado.fora.push(id)
        contarCartao(cs[id], 'segundo')
        evs.push({ minuto: min, tipo: 'vermelho', lado, jogadorId: id, texto: `Segundo amarelo para ${c.j.curto}. Expulso! (${sigla(lado)})` })
      } else {
        contarCartao(cs[id], 'amarelo')
        evs.push({ minuto: min, tipo: 'amarelo', lado, jogadorId: id, texto: `Amarelo para ${c.j.curto} (${sigla(lado)}).` })
      }
    } else if (rng.chance(0.0004)) {
      const c = pesado(rng, cl, (c) => PESO_FALTA[c.pos] * fatorFaltaPers(c.j))!
      p.estat.vermelhos[il]++
      x.expulsos.push(c.j.id)
      estado.fora.push(c.j.id)
      contarCartao(cs[c.j.id], 'direto')
      evs.push({ minuto: min, tipo: 'vermelho', lado, jogadorId: c.j.id, texto: `Vermelho direto para ${c.j.curto}! (${sigla(lado)})` })
    }
    const vivos = cl.filter((c) => !estado.fora.includes(c.j.id))
    // Lesões: quem está cansado (ou voltou antes do tempo) arrisca mais. 1,15 é o risco médio de um onze normal.
    const risco = vivos.reduce((s, c) => s + riscoLesao(c.j), 0) / Math.max(1, vivos.length)
    if (vivos.length && rng.chance(0.0017 * risco / 1.15)) {
      const c = pesado(rng, vivos, (c) => riscoLesao(c.j) * c.f.fisLes)!
      const les = sortearLesao(rng, c.j)
      const duracao = les.jogos
      x.lesionados.push(c.j.id)
      estado.fora.push(c.j.id)
      evs.push({ minuto: min, tipo: 'lesao', lado, jogadorId: c.j.id, duracao, tipoLesao: les.tipo.id, texto: `${c.j.curto} sai lesionado: ${les.tipo.nome.toLowerCase()} (${duracao} ${duracao === 1 ? 'jogo' : 'jogos'}).` })
      if (x.autoSub[lado]) {
        // substituir() regista o evento em partida.eventos; passa para a lista deste minuto.
        const s = retirarLesionadoAuto(mundo, estado, lado, c.j.id)
        if (s) { p.eventos.pop(); evs.push(s) }
      }
    }
  }

  // Treinadores da IA mexem na postura conforme o resultado.
  for (const lado of LADOS) {
    if (!x.autoSub[lado]) continue
    const nova = reacaoIA(min, p.golos[idx(lado)] - p.golos[1 - idx(lado)], estado.escalacoes[lado].postura)
    if (nova) {
      estado.escalacoes[lado].postura = nova
      evs.push({ minuto: min, tipo: 'postura', lado, texto: `${mundo.clubes[lado === 'casa' ? p.casaId : p.foraId]?.nome ?? sigla(lado)} ${TEXTO_REACAO[nova]}` })
    }
  }

  if (min === 45) evs.push({ minuto: 45, tipo: 'intervalo', lado: 'casa', texto: `Intervalo: ${sigla('casa')} ${p.golos[0]}-${p.golos[1]} ${sigla('fora')}.` })
  if (min === 90) x.fimMinuto = 90 + rng.int(0, 4)
  if (min >= 90 && min >= x.fimMinuto) {
    const pc = Math.round((100 * x.posseAcum) / min)
    p.estat.posse = [pc, 100 - pc]
    p.jogada = true
    p.porque = explicar(mundo, p)
    p.notas = calcularNotas(cs, p.golos, p.estat.posse)
    evs.push({ minuto: min, tipo: 'fim', lado: 'casa', texto: `Fim do jogo: ${sigla('casa')} ${p.golos[0]}-${p.golos[1]} ${sigla('fora')}.` })
  } else {
    const pc = Math.round((100 * x.posseAcum) / min)
    p.estat.posse = [pc, 100 - pc]
  }
  estado.rng = rng.state()
  x.rngNota = rn.state()
  p.eventos.push(...evs)
  return evs
}

const TEXTO_REACAO: Record<Postura, string> = {
  ofensiva: 'arrisca tudo e passa a jogar ao ataque.',
  defensiva: 'fecha-se atrás para segurar o resultado.',
  equilibrada: 'volta a jogar de forma equilibrada.',
}

/** Postura que um treinador da IA escolhe a meio do jogo, ou null para manter. `dif` = golos marcados - sofridos. */
export function reacaoIA(minuto: number, dif: number, atual: Postura): Postura | null {
  if (minuto < 60) return null
  let quer: Postura | null = null
  if (dif < 0 && dif >= -2) quer = 'ofensiva'
  else if (dif === 1 && minuto >= 75) quer = 'defensiva'
  else if (dif >= 3 || dif <= -3) quer = 'equilibrada'
  return quer && quer !== atual ? quer : null
}

function explicar(mundo: Mundo, p: Partida): string {
  const [gc, gf] = p.golos
  const s = p.estat
  if (gc === gf) {
    const dom = s.posse[0] >= s.posse[1] ? 0 : 1
    const nome = mundo.clubes[dom === 0 ? p.casaId : p.foraId]?.nome ?? ''
    if (s.posse[dom] >= 58) return `Empate apesar do domínio de ${nome}: ${s.posse[dom]}% de posse.`
    return `Jogo equilibrado: ${s.posse[0]}%-${s.posse[1]}% de posse e ${s.remates[0]}-${s.remates[1]} em remates.`
  }
  const v = gc > gf ? 0 : 1
  const d = 1 - v
  const nome = mundo.clubes[v === 0 ? p.casaId : p.foraId]?.nome ?? ''
  if (s.vermelhos[d] > s.vermelhos[v]) return `${nome} aproveitou a expulsão no adversário.`
  if (s.posse[v] >= 56) return `${nome} dominou o meio-campo: ${s.posse[v]}% de posse e ${s.remates[v]} remates.`
  if (s.remates[v] < s.remates[d]) return `Eficácia de ${nome}: ${p.golos[v]} golos em ${s.remates[v]} remates.`
  return `${nome} criou mais perigo: ${s.remates[v]} remates contra ${s.remates[d]}.`
}

/** Substituição: devolve false se não for permitida. */
export function substituir(mundo: Mundo, estado: EstadoJogo, lado: Lado, saiId: number, entraId: number): boolean {
  const x = ex(estado)
  const esc = estado.escalacoes[lado]
  if (estado.partida.jogada) return false
  if (estado.subs[lado] >= MAX_SUBS) return false
  const i = esc.titulares.indexOf(saiId)
  if (i < 0 || x.expulsos.includes(saiId)) return false
  if (!esc.suplentes.includes(entraId) || estado.fora.includes(entraId) || !mundo.jogadores[entraId]) return false
  esc.titulares[i] = entraId
  esc.suplentes = esc.suplentes.filter((id) => id !== entraId)
  if (!estado.fora.includes(saiId)) estado.fora.push(saiId)
  estado.subs[lado]++
  const sai = mundo.jogadores[saiId]?.curto ?? '?'
  const entra = mundo.jogadores[entraId].curto
  estado.partida.eventos.push({
    minuto: estado.minuto, tipo: 'substituicao', lado, jogadorId: saiId, outroId: entraId,
    texto: `Substituição: sai ${sai}, entra ${entra}.`,
  })
  return true
}

const NOME_POSTURA: Record<Postura, string> = { defensiva: 'defensiva', equilibrada: 'equilibrada', ofensiva: 'ofensiva' }

export function mudarPostura(estado: EstadoJogo, lado: Lado, postura: Postura): void {
  const esc = estado.escalacoes[lado]
  if (esc.postura === postura) return
  esc.postura = postura
  estado.partida.eventos.push({
    minuto: estado.minuto, tipo: 'postura', lado,
    texto: `${lado === 'casa' ? 'A equipa da casa' : 'A equipa visitante'} passa a jogar de forma ${NOME_POSTURA[postura]}.`,
  })
}

const TEXTO_MARCACAO: Record<Marcacao, string> = { zona: 'passa a marcar à zona', homem: 'passa a marcar homem a homem', pressao: 'sobe as linhas e pressiona alto' }

/** Muda a marcação a meio do jogo (intervalo, pausas). */
export function mudarMarcacao(estado: EstadoJogo, lado: Lado, marcacao: Marcacao): void {
  const esc = estado.escalacoes[lado]
  if ((esc.plano?.marcacao ?? 'zona') === marcacao || estado.partida.jogada) return
  esc.plano = { ...(esc.plano ?? {}), marcacao }
  estado.partida.eventos.push({
    minuto: estado.minuto, tipo: 'postura', lado,
    texto: `${lado === 'casa' ? 'A equipa da casa' : 'A equipa visitante'} ${TEXTO_MARCACAO[marcacao]}.`,
  })
}

/**
 * Muda a formação a meio do jogo: o guarda-redes fica, os outros dez são arrumados nos
 * novos lugares (primeiro pela posição natural, depois quem render mais no lugar que sobra).
 * Expulsos e lesionados continuam fora; não gasta substituições.
 */
export function mudarFormacao(mundo: Mundo, estado: EstadoJogo, lado: Lado, formacao: Formacao): void {
  const esc = estado.escalacoes[lado]
  if (esc.formacao === formacao || estado.partida.jogada) return
  const [d, m, a] = FORMACOES[formacao]
  const lugares: Posicao[] = ['GR', ...Array<Posicao>(d).fill('DEF'), ...Array<Posicao>(m).fill('MED'), ...Array<Posicao>(a).fill('AV')]
  const gr = esc.titulares[0]
  const outros = esc.titulares.slice(1)
  const fora = new Set(estado.fora)
  const escolha: (number | undefined)[] = lugares.map((_, i) => (i === 0 ? gr : undefined))
  const usados = new Set<number>([gr])
  // Os que estão em campo primeiro (os de fora ficam com os lugares que sobrarem).
  const jog = (id: number) => mundo.jogadores[id]
  const ordem = outros.filter((id) => !fora.has(id)).sort((x, y) => (jog(y)?.forca ?? 0) - (jog(x)?.forca ?? 0))
  lugares.forEach((pos, i) => {
    if (i === 0) return
    const id = ordem.find((k) => !usados.has(k) && jog(k)?.posicao === pos)
    if (id != null) { escolha[i] = id; usados.add(id) }
  })
  lugares.forEach((pos, i) => {
    if (escolha[i] !== undefined) return
    let melhor: number | undefined
    for (const k of ordem) {
      if (usados.has(k) || !jog(k)) continue
      if (melhor == null || forcaNoLugar(jog(k), pos) > forcaNoLugar(jog(melhor), pos)) melhor = k
    }
    if (melhor != null) { escolha[i] = melhor; usados.add(melhor) }
  })
  const resto = outros.filter((id) => !usados.has(id))
  lugares.forEach((_, i) => { if (escolha[i] === undefined) escolha[i] = resto.shift() })
  esc.titulares = escolha.filter((id): id is number => id !== undefined)
  esc.formacao = formacao
  estado.partida.eventos.push({
    minuto: estado.minuto, tipo: 'postura', lado,
    texto: `${lado === 'casa' ? 'A equipa da casa' : 'A equipa visitante'} muda para ${formacao}.`,
  })
}

/** Joga o jogo inteiro de uma vez (para os jogos das outras divisões e para testes). */
export function simularJogo(mundo: Mundo, partida: Partida, casa: Escalacao, fora: Escalacao, semente: number): Partida {
  const e = iniciarJogo(mundo, partida, casa, fora, semente)
  let guarda = 0
  while (!e.partida.jogada && guarda++ < 200) avancarMinuto(mundo, e)
  return e.partida
}

/** Quem teve a bola no último minuto jogado (undefined antes do apito inicial). */
export function posseDoMinuto(estado: EstadoJogo): Lado | undefined {
  return ex(estado).posseMinuto
}

/** Remate sem perigo e canto do último minuto (para o campo 2D ao vivo). */
export function lancesDoMinuto(estado: EstadoJogo): { remate?: { lado: Lado; lance: Lance }; canto?: Lado } {
  const x = ex(estado)
  return { ...(x.remateMinuto ? { remate: x.remateMinuto } : {}), ...(x.cantoMinuto ? { canto: x.cantoMinuto } : {}) }
}

/** Cartão de um jogador no jogo: amarelo, expulso por 2.º amarelo, ou vermelho direto. */
export type CartaoJogo = 'amarelo' | 'segundo' | 'vermelho'

/**
 * Cartões de cada jogador neste jogo, por id (a única fonte: os amarelos e as expulsões que o motor
 * usa para decidir). Segue o jogador em substituições, mudanças de formação e prolongamento.
 */
export function cartoesDoJogo(estado: { [extra: string]: unknown }): Record<number, CartaoJogo> {
  const x = estado as unknown as Partial<Extra>
  const out: Record<number, CartaoJogo> = {}
  for (const k of Object.keys(x.amarelosJogo ?? {})) {
    const id = Number(k)
    if ((x.amarelosJogo![id] ?? 0) >= 1) out[id] = 'amarelo'
  }
  for (const id of x.expulsos ?? []) out[id] = (x.amarelosJogo?.[id] ?? 0) >= 2 ? 'segundo' : 'vermelho'
  return out
}

/** Os mesmos cartões, lidos dos eventos de uma partida já jogada (resumo, ficha). */
export function cartoesDosEventos(eventos: readonly EventoJogo[]): Record<number, CartaoJogo> {
  const out: Record<number, CartaoJogo> = {}
  for (const ev of eventos) {
    if (ev.jogadorId == null) continue
    if (ev.tipo === 'amarelo') out[ev.jogadorId] = 'amarelo'
    else if (ev.tipo === 'vermelho') out[ev.jogadorId] = out[ev.jogadorId] === 'amarelo' ? 'segundo' : 'vermelho'
  }
  return out
}

/** Notas de agora (provisórias a meio do jogo, finais no fim). */
export function notasDoJogo(estado: EstadoJogo): Record<number, number> {
  const p = estado.partida
  return calcularNotas(ex(estado).contas ?? {}, p.golos, p.estat.posse)
}

/** Contas de um jogador no jogo (remates, desarmes, defesas...), para a UI. */
export function contaDoJogador(estado: EstadoJogo, id: number): ContaJogo | undefined {
  return ex(estado).contas?.[id]
}
