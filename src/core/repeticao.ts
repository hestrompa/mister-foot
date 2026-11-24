// Repetições 2D em caricas: encena um lance do motor (golo ou ocasião clara) vista de cima.
// Não decide nada: o resultado já vem do motor (Lance). Aqui só se inventa a coreografia,
// sempre com semente, para a mesma jogada dar sempre a mesma repetição.
// Coordenadas em metros: campo 105 x 68, a equipa que ataca vai sempre para a direita (x = 105).
import { createRng, type Rng } from './rng'
import { posicaoDoLugar } from './motor'
import { FORMACOES } from './partida'
import type { Escalacao, EventoJogo, Lado, Lance } from './partida'
import type { Mundo, Posicao } from './types'
import { atributosDe, type Atributos } from './atributos'

export const COMPRIMENTO = 105
export const LARGURA = 68
/** Postes da baliza (y). */
export const POSTES: [number, number] = [34 - 3.66, 34 + 3.66]
/** Raio de uma carica, em metros (já exagerado para se ver). */
export const RAIO = 1.5
const DT = 0.1

export interface PontoBola { t: number; x: number; y: number; z: number }
type Ponto = { t: number; x: number; y: number }

export interface CaricaRep {
  id: number
  lado: Lado
  /** Número na carica (lugar na escalação, 1 = guarda-redes). */
  num: number
  pos: Posicao
}

export interface CenaRepeticao {
  minuto: number
  /** Quem ataca (vai para a direita na repetição). */
  atacante: Lado
  origem: Lance['origem']
  desfecho: Lance['desfecho']
  texto: string
  rematadorId: number
  passadorId?: number
  /** Instantes (s): remate, fim do lance (bola na rede, nas mãos ou fora) e fim da repetição. */
  tRemate: number
  tFim: number
  duracao: number
  dt: number
  caricas: CaricaRep[]
  /** quadros[k][i] = [x, y] da carica i no instante k * dt. */
  quadros: [number, number][][]
  bola: PontoBola[]
  /** Momentos a assinalar no desenho (finta, carrinho falhado, falta para penálti). */
  acoes: AcaoRep[]
  /** Mudanças de plano (s): o desenho escurece e as caricas saltam para a nova posição. */
  cortes: number[]
  /**
   * Desenhar ao contrário (rodado 180°): a casa ataca para a direita na 1.ª parte e
   * para a esquerda na 2.ª (e troca outra vez no prolongamento).
   */
  espelhar: boolean
  /** Minuto de jogo normal (sem lance) do campo ao vivo. */
  ambiente?: boolean
  /** Festejo do golo: como e a partir de quando. */
  festa?: { tipo: TipoFesta; t: number }
  /** Cartão ou lesão encenado: quem, e o instante do cartão (ou de ficar no chão). */
  incidente?: { tipo: 'amarelo' | 'vermelho' | 'lesao'; jogadorId: number; t: number }
}

/** Festejos: corrida à bandeirola, deslizar de joelhos, para os adeptos, para o banco, ou monte de jogadores. */
export type TipoFesta = 'bandeirola' | 'joelhos' | 'adeptos' | 'banco' | 'monte'
export const TEXTO_FESTA: Record<TipoFesta, string> = {
  bandeirola: 'Corre para a bandeirola!', joelhos: 'De joelhos na relva!', adeptos: 'Vai festejar com os adeptos!',
  banco: 'Corre para o banco!', monte: 'Monte de jogadores em cima dele!',
}

/** Em que parte do jogo está um minuto (0 = 1.ª parte, 1 = 2.ª, 2 e 3 = prolongamento). */
export function parteDoJogo(minuto: number): number {
  return minuto <= 45 ? 0 : minuto <= 90 ? 1 : minuto <= 105 ? 2 : 3
}

/** Uma finta do condutor e o carrinho falhado do adversário que a sofre. */
export interface AcaoRep {
  /**
   * 'finta': o autor finta e a vítima vai ao chão; 'falta': o autor derruba a vítima (penálti);
   * 'tabela': o autor devolve de primeira ao rematador; 'chapeu': o autor pica a bola por cima do guarda-redes;
   * 'defesa': grande defesa do autor (guarda-redes); 'joelhos': o autor desliza de joelhos a festejar.
   */
  tipo: 'finta' | 'falta' | 'tabela' | 'chapeu' | 'defesa' | 'joelhos' | 'curto' | 'entrada' | 'poste2' | 'marcacao' | 'arrancada' | 'desarme' | 'corte' | 'bloqueio' | 'lancamento' | 'cabeca' | 'cartao' | 'lesao'
  /** Instante da finta. */
  t: number
  /** Quem finta e quem vai ao chão. */
  autorId: number
  vitimaId: number
  /** Onde o adversário começa e acaba o carrinho. */
  de: { x: number; y: number }
  ate: { x: number; y: number }
}

/** Jogadores em campo de um lado no momento do lance. */
export interface EmCampoRep {
  escalacao: Escalacao
  fora: readonly number[]
  /** Atributos de quem está em campo (velocidade, remate, passe...): mexem com o desenho. Sem isto, todos médios. */
  atrib?: Record<number, Atributos>
}

/** As duas equipas em campo, com os atributos de cada jogador, para as cenas 2D. */
export function emCampoDe(mundo: Mundo, e: { escalacoes: Record<Lado, Escalacao>; fora: readonly number[] }): Record<Lado, EmCampoRep> {
  const lado = (l: Lado): EmCampoRep => {
    const esc = e.escalacoes[l]
    const atrib: Record<number, Atributos> = {}
    for (const id of esc.titulares) { const j = mundo.jogadores[id]; if (j) atrib[id] = atributosDe(j) }
    return { escalacao: esc, fora: e.fora, atrib }
  }
  return { casa: lado('casa'), fora: lado('fora') }
}

const MEDIO: Atributos = { vel: 60, rem: 60, pas: 60, def: 60, fis: 60, gr: 60 }
/** Atributo de 30 (fraco) a 90 (excelente) passado para 0..1. */
const n01 = (v: number) => Math.max(0, Math.min(1, (v - 30) / 60))
/** Velocidade de ponta (m/s) e aceleração (m/s²) de cada carica, pelos atributos. */
const vMax = (c: Lugar) => 6 + 2.6 * n01(c.a.vel)
const acel = (c: Lugar) => 7 + 6 * n01((c.a.vel * 2 + c.a.fis) / 3)

/** Um passo de movimento com inércia: acelera para o alvo até à velocidade de ponta e trava ao chegar. */
function mover(p: { x: number; y: number }, v: { x: number; y: number }, alvo: { x: number; y: number }, vmax: number, amax: number, dt: number) {
  const dx = alvo.x - p.x, dy = alvo.y - p.y, d = Math.hypot(dx, dy)
  const quer = d > 0.05 ? Math.min(vmax, d * 2.2) : 0
  const wx = d > 0.001 ? (dx / d) * quer : 0, wy = d > 0.001 ? (dy / d) * quer : 0
  let ax = (wx - v.x) / dt, ay = (wy - v.y) / dt
  const a = Math.hypot(ax, ay)
  // Travar é mais fácil do que arrancar.
  const lim = quer < Math.hypot(v.x, v.y) ? amax * 1.6 : amax
  if (a > lim) { ax *= lim / a; ay *= lim / a }
  v.x += ax * dt; v.y += ay * dt
  p.x += v.x * dt; p.y += v.y * dt
}

interface Lugar extends CaricaRep {
  /** Posição base (x medido a partir da própria baliza, y de 0 a 68). */
  bx: number
  by: number
  /** Atributos (1 a 99). */
  a: Atributos
}

function lugares(lado: Lado, e: EmCampoRep): Lugar[] {
  const esc = e.escalacao
  const [d, m, a] = FORMACOES[esc.formacao]
  const tam: Record<Posicao, number> = { GR: 1, DEF: d, MED: m, AV: a }
  const inicio: Record<Posicao, number> = { GR: 0, DEF: 1, MED: 1 + d, AV: 1 + d + m }
  const BX: Record<Posicao, number> = { GR: 4, DEF: 22, MED: 40, AV: 56 }
  const out: Lugar[] = []
  esc.titulares.forEach((id, i) => {
    if (e.fora.includes(id)) return
    const pos = posicaoDoLugar(esc.formacao, i)
    const n = Math.max(1, tam[pos])
    const k = i - inicio[pos]
    const w = Math.min(50, 14 * (n - 1))
    const by = n === 1 ? 34 : 34 - w / 2 + (w * k) / (n - 1)
    // Meio-campo de 5: os das pontas um pouco mais à frente.
    const bx = BX[pos] + (pos === 'MED' && n >= 5 && (k === 0 || k === n - 1) ? 5 : 0)
    out.push({ id, lado, num: i + 1, pos, bx, by, a: e.atrib?.[id] ?? MEDIO })
  })
  return out
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const lerp = (a: number, b: number, f: number) => a + (b - a) * f

function interp<T extends Ponto>(pts: T[], t: number): { x: number; y: number; z: number } {
  if (t <= pts[0].t) return { x: pts[0].x, y: pts[0].y, z: (pts[0] as unknown as PontoBola).z ?? 0 }
  for (let i = 1; i < pts.length; i++) {
    const b = pts[i]
    if (t <= b.t) {
      const a = pts[i - 1]
      const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1
      const za = (a as unknown as PontoBola).z ?? 0, zb = (b as unknown as PontoBola).z ?? 0
      return { x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f), z: lerp(za, zb, f) }
    }
  }
  const u = pts[pts.length - 1]
  return { x: u.x, y: u.y, z: (u as unknown as PontoBola).z ?? 0 }
}

/** Posição da bola no instante t. */
export function bolaEm(cena: CenaRepeticao, t: number): { x: number; y: number; z: number } {
  return interp(cena.bola, t)
}

/** Posição das caricas no instante t (interpolação entre quadros). */
export function caricasEm(cena: CenaRepeticao, t: number): [number, number][] {
  const k = clamp(t / cena.dt, 0, cena.quadros.length - 1)
  const k0 = Math.floor(k), k1 = Math.min(cena.quadros.length - 1, k0 + 1), f = k - k0
  const a = cena.quadros[k0], b = cena.quadros[k1]
  return a.map((p, i) => [lerp(p[0], b[i][0], f), lerp(p[1], b[i][1], f)])
}

/** Trajeto curvo (bezier quadrática) com altura em arco, em `n` pedaços. */
function arco(bola: PontoBola[], t0: number, t1: number, de: { x: number; y: number }, ate: { x: number; y: number }, ctrl: { x: number; y: number } | null, alt: number, zFim = 0, n = 8) {
  for (let i = 1; i <= n; i++) {
    const f = i / n
    const c = ctrl ?? { x: (de.x + ate.x) / 2, y: (de.y + ate.y) / 2 }
    const x = (1 - f) * (1 - f) * de.x + 2 * (1 - f) * f * c.x + f * f * ate.x
    const y = (1 - f) * (1 - f) * de.y + 2 * (1 - f) * f * c.y + f * f * ate.y
    const z = 4 * alt * f * (1 - f) + zFim * f
    bola.push({ t: lerp(t0, t1, f), x, y, z })
  }
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)

interface Guiao {
  bola: PontoBola[]
  /** Trajetos fixos de jogadores-chave (id -> pontos). */
  fixos: Map<number, Ponto[]>
  tRemate: number
  tFim: number
  /** Mergulho do guarda-redes: para onde vai e até quando. */
  mergulho?: { ate: { x: number; y: number }; t1: number }
  /** Barreira num livre. */
  barreira: number[]
  acoes: AcaoRep[]
  /** Os outros não entram na área (penáltis). */
  foraDaArea: boolean
  /** Instante do corte para a marcação do penálti. */
  corte?: number
  /** A defesa foi apanhada em contra-ataque (chega atrasada). */
  contra: boolean
  festa?: { tipo: TipoFesta; t: number }
}

/**
 * Cria a repetição de um evento com lance (golo ou oportunidade).
 * `emCampo` são as escalações no momento do lance; devolve null se o evento não tiver lance.
 */
export function criarRepeticao(ev: EventoJogo, emCampo: Record<Lado, EmCampoRep>, semente: number): CenaRepeticao | null {
  const l = ev.lance
  if (!l) return null
  const rng = createRng(semente >>> 0 || 1)
  const atac = ev.lado
  const def: Lado = atac === 'casa' ? 'fora' : 'casa'
  const la = lugares(atac, emCampo[atac])
  const ld = lugares(def, emCampo[def])
  const todos = [...la, ...ld]
  const de = (id?: number) => (id == null ? undefined : todos.find((c) => c.id === id))
  let rem = de(l.rematadorId)
  if (!rem || rem.lado !== atac) rem = la.find((c) => c.pos === 'AV') ?? la[la.length - 1]
  let pas = de(l.passadorId)
  if (pas && (pas.lado !== atac || pas === rem)) pas = undefined
  const gr = ld.find((c) => c.id === l.guardaRedesId) ?? ld.find((c) => c.pos === 'GR')
  // Marcação individual: quem marcava o rematador é o defesa do lance.
  let dfs = de(l.marcadorId ?? l.defensorId)
  if (!dfs || dfs.lado !== def || dfs === gr) dfs = ld.find((c) => c.pos === 'DEF') ?? ld.find((c) => c !== gr)

  const g = guiao(rng, l, rem, pas, dfs, gr, la, ld)
  const extra = l.desfecho === 'golo' ? 2.4 : 1.5
  const duracao = Math.round((g.tFim + extra) * 10) / 10
  const quadros = simular(rng, g, la, ld, rem, pas, gr, duracao, l.desfecho)

  return {
    minuto: ev.minuto, atacante: atac, origem: l.origem, desfecho: l.desfecho, texto: ev.texto,
    rematadorId: rem.id, ...(pas ? { passadorId: pas.id } : {}),
    tRemate: g.tRemate, tFim: g.tFim, duracao, dt: DT,
    caricas: todos.map(({ id, lado, num, pos }) => ({ id, lado, num, pos })),
    quadros, bola: g.bola, acoes: g.acoes, cortes: g.corte != null ? [g.corte] : [], ...(g.festa ? { festa: g.festa } : {}),
    espelhar: (atac === 'casa') !== (parteDoJogo(ev.minuto) % 2 === 0),
  }
}

function guiao(rng: Rng, l: Lance, rem: Lugar, pas: Lugar | undefined, dfs: Lugar | undefined, gr: Lugar | undefined, la: Lugar[], ld: Lugar[]): Guiao {
  const r = () => rng.next()
  const sinal = () => (rng.chance(0.5) ? -1 : 1)
  const yc = l.corredor === -1 ? 13 + r() * 6 : l.corredor === 1 ? 49 + r() * 6 : 28 + r() * 12
  const bola: PontoBola[] = []
  const fixos = new Map<number, Ponto[]>()
  const g: Guiao = { bola, fixos, tRemate: 0, tFim: 0, barreira: [], acoes: [], foraDaArea: false, contra: false }
  // S = sítio do remate; tS = quando a bola lá chega.
  let S = { x: 0, y: 0 }
  let tS = 0
  let cabeca = false
  let forcaRemate = 27

  const conducaoEPasse = (A: { x: number; y: number }, B: { x: number; y: number }, tConduz: number, condutor: Lugar, pFinta: number) => {
    bola.push({ t: 0, ...A, z: 0 })
    const candidatos = ld.filter((c) => c !== gr && c !== dfs && c.pos !== 'GR')
    const meios = candidatos.filter((c) => c.pos === 'MED')
    // Quem é rápido e bom de bola tenta (e consegue) mais fintas.
    const vitima = rng.chance(Math.min(0.9, pFinta * (0.55 + 0.9 * n01((condutor.a.vel + condutor.a.rem) / 2)))) ? rng.pick(meios.length ? meios : candidatos) : undefined
    const passos: Ponto[] = [{ t: 0, x: A.x - 0.9, y: A.y }]
    if (vitima) {
      // Finta: o adversário sai ao caminho em carrinho, o condutor desvia a bola e passa.
      const tm = tConduz * 0.55
      const lado = A.y > 34 ? -1 : 1
      const M0 = { x: lerp(A.x, B.x, 0.55), y: lerp(A.y, B.y, 0.55) }
      const M = { x: M0.x, y: clamp(M0.y + lado * 2.4, 3, 65) }
      const ini = { x: M0.x + 6, y: clamp(M0.y - lado * 1.5, 2, 66) }
      const toque = { x: M0.x + 1.7, y: clamp(M0.y - lado * 0.2, 2, 66) }
      const chao = { x: M0.x - 1.4, y: clamp(M0.y - lado * 0.6, 2, 66) }
      bola.push({ t: tm - 0.25, x: lerp(A.x, M0.x, 0.85), y: lerp(A.y, M0.y, 0.85), z: 0 })
      bola.push({ t: tm + 0.05, ...M, z: 0.25 })
      passos.push({ t: tm - 0.25, x: lerp(A.x, M0.x, 0.85) - 0.9, y: lerp(A.y, M0.y, 0.85) }, { t: tm + 0.05, x: M.x - 0.9, y: M.y })
      fixos.set(vitima.id, [{ t: 0, ...ini }, { t: tm - 0.3, ...toque }, { t: tm + 0.1, ...chao }, { t: tm + 1.3, ...chao }])
      g.acoes.push({ tipo: 'finta', t: tm, autorId: condutor.id, vitimaId: vitima.id, de: toque, ate: chao })
    }
    bola.push({ t: tConduz, ...B, z: 0 })
    passos.push({ t: tConduz, x: B.x - 0.9, y: B.y }, { t: tConduz + 0.8, x: B.x + 3.5, y: lerp(B.y, 34, 0.15) })
    fixos.set(condutor.id, passos)
  }
  /** Corrida do rematador até S, a chegar em tS. */
  const corridaRematador = (desvio: number) => {
    const ini = { x: S.x - 8 - r() * 3, y: clamp(S.y + desvio, 4, 64) }
    fixos.set(rem.id, [{ t: 0, ...ini }, { t: tS * 0.55, x: lerp(ini.x, S.x, 0.5), y: lerp(ini.y, S.y, 0.6) }, { t: tS, x: S.x - 0.7, y: S.y }])
  }

  switch (l.origem) {
    case 'jogada':
    case 'contra': {
      const contra = l.origem === 'contra'
      g.contra = contra
      const A = { x: contra ? 28 + r() * 10 : 50 + r() * 10, y: yc }
      const B = { x: A.x + (contra ? 26 + r() * 6 : 15 + r() * 7), y: lerp(yc, 34, 0.2) }
      // Conduz mais depressa quem é mais rápido.
      const tConduz = (contra ? 3.2 : 1.9) * (1.12 - 0.24 * n01((pas ?? rem).a.vel))
      // Bola passada pelo bom passador viaja mais depressa e mais certinha.
      const vPasse = 15 + 8 * n01((pas ?? rem).a.pas)
      const ala = l.corredor !== 0
      S = ala
        ? { x: 89 + r() * 5, y: 34 + (yc > 34 ? -1 : 1) * (1 + r() * 5) }
        : { x: 83 + r() * 7, y: 34 + sinal() * r() * 7 }
      if (pas && !ala && rng.chance((contra ? 0.25 : 0.4) * (0.6 + 0.8 * n01(pas.a.pas)))) {
        // Tabelinha: o rematador conduz, solta no colega e recebe de primeira, já dentro da área.
        const lado = A.y > 34 ? -1 : 1
        const A2 = { x: A.x + (contra ? 18 : 9), y: lerp(A.y, 34, 0.3) }
        const P = { x: A2.x + 8, y: clamp(A2.y + lado * (7 + r() * 3), 6, 62) }
        S = { x: 85 + r() * 5, y: 34 + sinal() * r() * 6 }
        const tP = tConduz
        const tR1 = tP + dist(A2, P) / (vPasse - 1)
        tS = tR1 + Math.max(0.45, dist(P, S) / (vPasse + 1))
        bola.push({ t: 0, ...A, z: 0 }, { t: tP, ...A2, z: 0 }, { t: tR1, ...P, z: 0 }, { t: tS, ...S, z: 0 })
        fixos.set(pas.id, [{ t: 0, x: P.x - 4, y: P.y + lado * 2 }, { t: tR1 - 0.4, x: P.x - 0.6, y: P.y }, { t: tR1, x: P.x - 0.9, y: P.y }, { t: tR1 + 0.9, x: P.x + 2.5, y: lerp(P.y, 34, 0.2) }])
        fixos.set(rem.id, [{ t: 0, x: A.x - 0.9, y: A.y }, { t: tP, x: A2.x - 0.9, y: A2.y }, { t: tP + (tS - tP) * 0.5, x: lerp(A2.x, S.x, 0.55), y: lerp(A2.y, S.y, 0.45) }, { t: tS, x: S.x - 0.7, y: S.y }])
        g.acoes.push({ tipo: 'tabela', t: tR1, autorId: pas.id, vitimaId: rem.id, de: P, ate: S })
      } else if (pas) {
        conducaoEPasse(A, B, tConduz, pas, contra ? 0.7 : 0.55)
        tS = tConduz + Math.max(0.5, dist(B, S) / vPasse)
        // Cruzamento das alas vai pelo ar (mais vezes com bons passadores); cabeceia quem é forte no ar.
        if (ala && rng.chance(0.4 + 0.3 * n01(pas.a.pas))) { arco(bola, tConduz, tS, B, S, null, 2.2, 0, 6); cabeca = rng.chance(0.3 + 0.55 * n01(rem.a.fis)) } else bola.push({ t: tS, ...S, z: 0 })
        corridaRematador((yc - 34) * 0.25 + sinal() * (2 + r() * 3))
      } else {
        // Sem passe: o rematador conduz até ao remate.
        tS = tConduz + 0.9
        bola.push({ t: 0, ...A, z: 0 }, { t: tS, ...S, z: 0 })
        fixos.set(rem.id, [{ t: 0, x: A.x - 0.9, y: A.y }, { t: tS, x: S.x - 0.7, y: S.y }])
      }
      g.tRemate = tS + (cabeca ? 0 : 0.3)
      if (cabeca) forcaRemate = 17
      break
    }
    case 'longe': {
      const A = { x: 63 + r() * 6, y: yc }
      const B = { x: A.x + 6, y: lerp(yc, 34, 0.3) }
      S = { x: 75 + r() * 5, y: 34 + sinal() * r() * 12 }
      if (pas) {
        conducaoEPasse(A, B, 1.1, pas, 0.3)
        tS = 1.1 + Math.max(0.5, dist(B, S) / 16)
        bola.push({ t: tS, ...S, z: 0 })
        corridaRematador(sinal() * (3 + r() * 3))
      } else {
        tS = 1.6
        bola.push({ t: 0, ...A, z: 0 }, { t: tS, ...S, z: 0 })
        fixos.set(rem.id, [{ t: 0, x: A.x - 0.9, y: A.y }, { t: tS, x: S.x - 0.7, y: S.y }])
      }
      g.tRemate = tS + 0.4
      forcaRemate = 30
      break
    }
    case 'canto': {
      const lado = l.corredor === 0 ? sinal() : l.corredor
      const C = { x: 104.4, y: lado < 0 ? 0.7 : 67.3 }
      const marcador = l.esquema === 'curto' ? rng.pick(la.filter((c) => c !== rem && c !== pas && c.pos !== 'GR')) ?? pas : pas ?? rng.pick(la.filter((c) => c !== rem && c.pos !== 'GR'))
      const aFrente = lado < 0 ? -1 : 1
      bola.push({ t: 0, ...C, z: 0 }, { t: 0.9, ...C, z: 0 })
      if (marcador) fixos.set(marcador.id, [{ t: 0, x: C.x - 2.4, y: C.y - aFrente * 1.6 }, { t: 0.9, x: C.x - 0.6, y: C.y - aFrente * 0.5 }, { t: 1.7, x: C.x - 5, y: C.y - aFrente * 4 }])
      if (l.esquema === 'curto' && pas && pas !== marcador) {
        // Canto curto: toca para o colega ao lado, que entra pela linha e cruza (ou passa atrasado).
        const K = { x: 99.5, y: C.y - aFrente * 6 }
        const K2 = { x: 96.5, y: C.y - aFrente * 13 }
        bola.push({ t: 1.4, ...K, z: 0 }, { t: 2.3, ...K2, z: 0 })
        fixos.set(pas.id, [{ t: 0, x: K.x - 1.5, y: K.y - aFrente * 1.5 }, { t: 1.3, x: K.x - 0.9, y: K.y }, { t: 2.3, x: K2.x - 0.9, y: K2.y }, { t: 3.1, x: K2.x - 3, y: K2.y - aFrente * 3 }])
        g.acoes.push({ tipo: 'curto', t: 1.4, autorId: pas.id, vitimaId: rem.id, de: K, ate: K2 })
        S = { x: 92 + r() * 4, y: 34 + sinal() * r() * 4 }
        tS = 2.3 + dist(K2, S) / 18
        cabeca = rng.chance(0.4 + 0.4 * n01(rem.a.fis))
        if (cabeca) arco(bola, 2.3, tS, K2, S, null, 2.4, 1.6, 6); else bola.push({ t: tS, ...S, z: 0 })
      } else if (l.esquema === 'entrada') {
        // Canto atrasado para a entrada da área: remate de primeira.
        S = { x: 86 + r() * 3, y: 34 + sinal() * (2 + r() * 6) }
        tS = 0.9 + dist(C, S) / 21
        arco(bola, 0.9, tS, C, S, null, 1.4, 0, 6)
        g.acoes.push({ tipo: 'entrada', t: tS, autorId: rem.id, vitimaId: rem.id, de: S, ate: S })
      } else {
        // À área; no esquema "área" a bola vai ao segundo poste.
        const poste2 = l.esquema === 'area'
        S = poste2 ? { x: 98 + r() * 3, y: 34 - aFrente * (3 + r() * 3) } : { x: 95 + r() * 4, y: 34 + sinal() * r() * 5 }
        tS = 0.9 + dist(C, S) / 17
        arco(bola, 0.9, tS, C, S, { x: 100, y: lerp(C.y, S.y, 0.55) }, poste2 ? 5.2 : 4.5, 1.6)
        if (poste2) g.acoes.push({ tipo: 'poste2', t: tS, autorId: rem.id, vitimaId: rem.id, de: S, ate: S })
        cabeca = true
      }
      corridaRematador(sinal() * (3 + r() * 3))
      g.tRemate = tS
      forcaRemate = cabeca ? 16 : 26
      break
    }
    case 'livre': {
      const cruzar = l.esquema === 'cruzar'
      const F = cruzar
        ? { x: 70 + r() * 10, y: 34 + (l.corredor || sinal()) * (15 + r() * 10) }
        : { x: 76 + r() * 7, y: 34 + (l.corredor || sinal()) * (3 + r() * 9) }
      bola.push({ t: 0, ...F, z: 0 })
      const lateral = F.y > 34 ? 1 : -1
      const batedor = cruzar ? (pas ?? rng.pick(la.filter((c) => c !== rem && c.pos !== 'GR'))) : rem
      fixos.set(batedor.id, [{ t: 0, x: F.x - 3.2, y: F.y + lateral * 2 }, { t: 0.9, x: F.x - 3.2, y: F.y + lateral * 2 }, { t: 1.5, x: F.x - 0.7, y: F.y + lateral * 0.3 }, { t: 2.3, x: F.x + 1.5, y: F.y }])
      bola.push({ t: 1.5, ...F, z: 0 })
      if (cruzar) {
        // Livre cruzado para a área: cabeceamento.
        S = { x: 93 + r() * 5, y: 34 + sinal() * r() * 5 }
        tS = 1.5 + dist(F, S) / 19
        arco(bola, 1.5, tS, F, S, { x: lerp(F.x, S.x, 0.6), y: lerp(F.y, S.y, 0.4) }, 3.6, 1.6, 7)
        corridaRematador(sinal() * (2 + r() * 3))
        cabeca = true
        g.tRemate = tS
        forcaRemate = 16
      } else {
        S = F
        g.tRemate = 1.5
        tS = 1.5
        forcaRemate = 24
      }
      // Barreira a 9,15 m, na linha da baliza (no livre cruzado, só dois).
      const golo = { x: COMPRIMENTO, y: 34 }
      const d = dist(F, golo)
      const ux = (golo.x - F.x) / d, uy = (golo.y - F.y) / d
      const W = { x: F.x + ux * 9.15, y: F.y + uy * 9.15 }
      const muro = ld.filter((c) => c !== gr && c !== dfs).sort((a, b) => b.bx - a.bx).slice(0, cruzar ? 2 : d < 24 ? 4 : 3)
      muro.forEach((c, i) => {
        const o = (i - (muro.length - 1) / 2) * (RAIO * 2 + 0.1) + lateral * 1.2
        const p = { x: W.x - uy * o, y: W.y + ux * o }
        fixos.set(c.id, [{ t: 0, ...p }, { t: 1.5 + 0.5, ...p }])
        g.barreira.push(c.id)
      })
      break
    }
    case 'penalti': {
      // Primeiro a jogada que dá penálti: o rematador entra na área e o defesa derruba-o.
      const lado = sinal()
      const A = { x: 76 + r() * 5, y: 34 + lado * (6 + r() * 8) }
      const F = { x: 89.5 + r() * 2.5, y: 34 + lado * (3 + r() * 5) }
      const tF = 1.9, C = 3.0
      const rola = { x: F.x + 3 + r() * 2, y: F.y - lado * (1 + r() * 2) }
      const caido = { x: F.x + 1.1, y: F.y - lado * 0.3 }
      bola.push({ t: 0, ...A, z: 0 }, { t: tF, ...F, z: 0 }, { t: tF + 0.8, ...rola, z: 0 }, { t: C - 0.01, ...rola, z: 0 })
      if (dfs) {
        const ini = { x: F.x + 5, y: clamp(F.y - lado * 3, 2, 66) }
        const toque = { x: F.x + 0.8, y: F.y - lado * 1.2 }
        const chao = { x: F.x - 0.2, y: F.y - lado * 1.6 }
        fixos.set(dfs.id, [{ t: 0, ...ini }, { t: tF - 0.1, ...toque }, { t: tF + 0.3, ...chao }, { t: C - 0.01, ...chao }])
        g.acoes.push({ tipo: 'falta', t: tF, autorId: dfs.id, vitimaId: rem.id, de: toque, ate: chao })
      }
      // Depois do corte: a marcação do penálti.
      S = { x: 94, y: 34 }
      bola.push({ t: C, ...S, z: 0 })
      fixos.set(rem.id, [
        { t: 0, x: A.x - 0.9, y: A.y }, { t: tF, x: F.x - 0.9, y: F.y }, { t: tF + 0.4, ...caido }, { t: C - 0.01, ...caido },
        { t: C, x: 89.5, y: 32.5 }, { t: C + 1.0, x: 89.5, y: 32.5 }, { t: C + 1.6, x: 93.3, y: 33.8 },
      ])
      g.corte = C
      g.tRemate = C + 1.6
      tS = g.tRemate
      bola.push({ t: g.tRemate, ...S, z: 0 })
      g.foraDaArea = true
      forcaRemate = 25
      break
    }
  }

  // Remate mais forte para quem remata bem (de cabeça conta também o físico).
  forcaRemate *= 0.82 + 0.36 * n01(cabeca ? (rem.a.rem + rem.a.fis) / 2 : rem.a.rem)
  // Contra-ataque com avançado mais rápido do que o defesa: arrancada.
  if (g.contra && dfs && rem.a.vel - dfs.a.vel >= 8 && tS > 1) {
    const p = interp(fixos.get(rem.id) ?? [{ t: 0, ...S }], tS * 0.55)
    g.acoes.push({ tipo: 'arrancada', t: tS * 0.55, autorId: rem.id, vitimaId: dfs.id, de: p, ate: S })
  }

  // O rematador fica com a bola até rematar e segue o movimento.
  const fr = fixos.get(rem.id)
  if (fr) {
    const u = fr[fr.length - 1]
    if (u.t < g.tRemate) fr.push({ t: g.tRemate, x: u.x, y: u.y })
    fr.push({ t: g.tRemate + 0.5, x: Math.min(u.x + 1.8, 103), y: lerp(u.y, 34, 0.1) })
  }

  // Defesa encarregado do rematador: chega atrasado, pelo lado da baliza.
  if (dfs && !g.barreira.includes(dfs.id) && l.origem !== 'penalti') {
    // Bom defesa (e rápido) chega mais perto; contra um avançado mais rápido fica para trás.
    // Na marcação individual anda colado ao rematador.
    const colado = l.marcadorId != null && dfs.id === l.marcadorId ? 0.6 : 1
    const atraso = Math.max(1.35, ((g.contra ? 3.5 : 1.8) * (1.25 - 0.5 * n01(dfs.a.def)) + clamp((rem.a.vel - dfs.a.vel) / 30, -0.5, 1)) * colado)
    const ini = { x: clamp(S.x + 6 + r() * 3, 0, 103), y: clamp(S.y + sinal() * (3 + r() * 4), 3, 65) }
    fixos.set(dfs.id, [{ t: 0, ...ini }, { t: Math.max(0.6, g.tRemate - 0.6), x: clamp(S.x + atraso, 0, 103), y: lerp(ini.y, S.y, 0.6) }, { t: g.tRemate + 0.3, x: clamp(S.x + Math.max(2.6, atraso * 0.8), 0, 103), y: lerp(ini.y, S.y, 0.8) }])
  }

  // Remate e o que acontece à bola.
  const tR = g.tRemate
  const P = { x: S.x, y: S.y }
  const zIni = cabeca ? 1.6 : 0
  if (bola[bola.length - 1].t < tR) bola.push({ t: tR, ...P, z: zIni })
  const ytiro = (dentro: boolean) => {
    if (dentro) return 34 + sinal() * (0.6 + r() * 2.6)
    return 34 + sinal() * (4.4 + r() * 5)
  }
  const voo = (alvo: { x: number; y: number }) => Math.max(0.28, dist(P, alvo) / forcaRemate)
  const curva = l.origem === 'livre' && !cabeca ? { x: lerp(P.x, 105, 0.5), y: lerp(P.y, 34, 0.5) + (P.y > 34 ? 4 : -4) } : null
  const altura = l.origem === 'livre' && !cabeca ? 2.4 : l.origem === 'longe' ? 1.2 : 0.6
  // Chapéu: o guarda-redes sai ao caminho e a bola passa-lhe por cima.
  const chapeu = l.desfecho === 'golo' && !cabeca && gr && (l.origem === 'jogada' || l.origem === 'contra') && P.x > 82 && rng.chance(l.origem === 'contra' ? 0.35 : 0.2)
  switch (l.desfecho) {
    case 'golo': {
      const alvo = { x: COMPRIMENTO + 0.3, y: ytiro(true) }
      const t1 = tR + voo(alvo) * (chapeu ? 1.5 : 1)
      if (chapeu && gr) {
        const frente = { x: Math.min(102, P.x + 5.5), y: lerp(P.y, alvo.y, 0.2) }
        const ini = { x: COMPRIMENTO - 1.4, y: 34 + (P.y - 34) * 0.14 }
        fixos.set(gr.id, [{ t: 0, ...ini }, { t: Math.max(0.2, tR - 1.1), ...ini }, { t: tR, ...frente }, { t: tR + 0.4, x: frente.x + 0.6, y: frente.y + 0.6 }, { t: tR + 1.6, x: frente.x + 0.6, y: frente.y + 0.6 }])
        arco(bola, tR, t1, P, alvo, null, 4.2, 1.6, 8)
        g.acoes.push({ tipo: 'chapeu', t: tR, autorId: rem.id, vitimaId: gr.id, de: P, ate: alvo })
      } else arco(bola, tR, t1, P, alvo, curva, altura, cabeca ? -zIni : 0.6, 6)
      const yRede = (f: number) => clamp(alvo.y + (alvo.y - P.y) * f, POSTES[0] + 0.3, POSTES[1] - 0.3)
      bola.push({ t: t1 + 0.3, x: COMPRIMENTO + 1.7, y: yRede(0.04), z: 0.3 })
      bola.push({ t: t1 + 0.6, x: COMPRIMENTO + 1.9, y: yRede(0.05), z: 0 })
      g.tFim = t1
      if (gr && !chapeu) {
        // Mergulha para o lado certo, mas não chega (o bom guarda-redes fica mais perto).
        // Remate ao meio: foi enganado e atira-se para o outro lado.
        let lado = alvo.y > 34 ? 1 : -1
        const longe = Math.abs(alvo.y - 34)
        if (longe < 1.6) lado = -lado
        const chega = lado === (alvo.y > 34 ? 1 : -1) ? Math.max(0.4, Math.min(longe - 0.9, (0.7 + 1.8 * n01(gr.a.gr)) * (0.6 + 0.4 * r()))) : 1 + r()
        g.mergulho = { ate: { x: 103.9, y: clamp(34 + lado * chega, 31, 37) }, t1 }
      }
      break
    }
    case 'defesa': {
      const yk = 34 + sinal() * (0.4 + r() * 2.8)
      const alvo = { x: 103.8, y: yk }
      const t1 = tR + voo(alvo)
      arco(bola, tR, t1, P, alvo, curva, altura, cabeca ? -zIni : 0.3, 6)
      g.mergulho = { ate: alvo, t1 }
      if (gr && Math.abs(yk - 34) > 2 && rng.chance(0.3 + 0.6 * n01(gr.a.gr))) g.acoes.push({ tipo: 'defesa', t: t1, autorId: gr.id, vitimaId: rem.id, de: alvo, ate: alvo })
      if (rng.chance(gr ? 0.25 + 0.4 * n01(gr.a.gr) : 0.45)) {
        bola.push({ t: t1 + 0.1, x: alvo.x + 0.4, y: alvo.y, z: 0 }) // agarra
      } else {
        // Sacode para o lado.
        const fim = { x: 101 - r() * 3, y: clamp(yk + (yk > 34 ? 1 : -1) * (8 + r() * 6), 1, 67) }
        arco(bola, t1, t1 + 0.8, alvo, fim, null, 1.2, 0, 5)
      }
      g.tFim = t1
      break
    }
    case 'poste': {
      const yp = rng.chance(0.5) ? POSTES[0] : POSTES[1]
      const alvo = { x: COMPRIMENTO - 0.1, y: yp }
      const t1 = tR + voo(alvo)
      arco(bola, tR, t1, P, alvo, curva, altura, cabeca ? -zIni : 0.8, 6)
      const fim = { x: 95 - r() * 4, y: clamp(yp + (yp > 34 ? 1 : -1) * (3 + r() * 6), 2, 66) }
      arco(bola, t1, t1 + 0.9, alvo, fim, null, 0.8, 0, 5)
      g.tFim = t1
      if (gr) g.mergulho = { ate: { x: 103.9, y: clamp(lerp(34, yp, 0.55), 31, 37) }, t1 }
      break
    }
    case 'fora': {
      const alvo = { x: COMPRIMENTO + 0.2, y: ytiro(false) }
      const t1 = tR + voo(alvo)
      arco(bola, tR, t1, P, alvo, curva, altura + 0.6, 0.4, 6)
      bola.push({ t: t1 + 0.5, x: COMPRIMENTO + 3.2, y: alvo.y + (alvo.y - P.y) * 0.12, z: 0 })
      g.tFim = t1
      break
    }
  }
  return g
}

function simular(rng: Rng, g: Guiao, la: Lugar[], ld: Lugar[], rem: Lugar, pas: Lugar | undefined, gr: Lugar | undefined, duracao: number, desfecho: Lance['desfecho']): [number, number][][] {
  const todos = [...la, ...ld]
  const n = Math.ceil(duracao / DT) + 1
  const fase = todos.map(() => rng.next() * Math.PI * 2)
  const bolaT = (t: number) => interp(g.bola, t)
  const golo = desfecho === 'golo'
  const yRemate = interp(g.fixos.get(rem.id) ?? [{ t: 0, x: 90, y: 34 }], g.tRemate).y
  // Festejo, sempre com semente: para onde corre o marcador.
  const tipoFesta: TipoFesta | null = golo ? rng.pick<TipoFesta>(['bandeirola', 'bandeirola', 'joelhos', 'adeptos', 'banco', 'monte']) : null
  if (tipoFesta) g.festa = { tipo: tipoFesta, t: g.tFim + 0.2 }
  const ladoY = yRemate < 34 ? -1 : 1
  const festa = !tipoFesta ? null
    : tipoFesta === 'bandeirola' ? { x: 101, y: ladoY < 0 ? 4 : 64 }
    : tipoFesta === 'joelhos' ? { x: 90, y: 34 + ladoY * 20 }
    : tipoFesta === 'adeptos' ? { x: 84, y: ladoY < 0 ? 1.6 : 66.4 }
    : tipoFesta === 'banco' ? { x: 58, y: 66.6 }
    : { x: clamp(interp(g.fixos.get(rem.id) ?? [{ t: 0, x: 92, y: 34 }], g.tRemate).x - 4, 80, 96), y: clamp(yRemate, 20, 48) }

  /** Para onde cada um quer ir, no instante t. */
  const alvo = (c: Lugar, i: number, t: number): { x: number; y: number } => {
    // Em contra-ataque a defesa reage atrasada à bola.
    const b = bolaT(c.lado !== rem.lado && g.contra ? Math.max(0, t - 0.9) : t)
    const mexe = Math.sin(t * 1.3 + fase[i]) * 0.8
    let x: number, y: number
    if (c.lado === rem.lado) {
      if (c.pos === 'GR') { x = 5 + Math.max(0, b.x - 50) * 0.35; y = 34 + (b.y - 34) * 0.2 }
      else {
        const teto = c.pos === 'DEF' ? 72 : c.pos === 'MED' ? 89 : 99
        x = Math.min(teto, c.bx + (b.x - 28) * 0.78) + mexe
        y = c.by + (b.y - 34) * 0.3
      }
    } else {
      const bx = COMPRIMENTO - b.x
      if (c.pos === 'GR') { x = COMPRIMENTO - 1.4; y = 34 + (b.y - 34) * 0.14 }
      else {
        const k = c.pos === 'DEF' ? [6, 0.35] : c.pos === 'MED' ? [14, 0.45] : [30, 0.5]
        let xr = k[0] + bx * k[1]
        if (g.contra) xr += 18 * Math.max(0, 1 - t / 3.5)
        x = COMPRIMENTO - xr + mexe
        y = c.by * 0.7 + b.y * 0.3
      }
    }
    if (g.foraDaArea && t >= (g.corte ?? 0) && c !== gr && c !== rem) {
      // Fora da área e da meia-lua no penálti.
      x = Math.min(x, 86.5 - (i % 3) * 2.6)
    }
    // Depois do golo: o marcador corre para a bandeirola, os colegas perto vão abraçá-lo.
    if (festa && t > g.tFim + 0.2 && c.lado === rem.lado && c.pos !== 'GR') {
      if (c === rem) return festa
      // No monte vão todos; nos outros, quem está perto (e o que fez o passe).
      const vai = tipoFesta === 'monte' ? c.pos !== 'DEF' || i % 2 === 0 : c === pas || (Math.abs(c.bx + 50 - festa.x) < 40 && c.pos !== 'DEF')
      if (vai) {
        const ang = i * 2.4
        const raio = tipoFesta === 'monte' ? 1.2 + (i % 3) * 0.7 : 3 + (i % 3) * 1.5
        return { x: clamp(festa.x - Math.abs(Math.cos(ang)) * raio, 1, COMPRIMENTO - 1), y: clamp(festa.y + Math.sin(ang) * raio, 1.2, LARGURA - 1.2) }
      }
    }
    return { x: clamp(x, 1, COMPRIMENTO - 0.8), y: clamp(y, 1.5, LARGURA - 1.5) }
  }

  const pos: { x: number; y: number }[] = todos.map((c, i) => {
    const f = g.fixos.get(c.id)
    return f ? { x: f[0].x, y: f[0].y } : alvo(c, i, 0)
  })
  if (gr) {
    const i = todos.indexOf(gr)
    pos[i] = alvo(gr, i, 0)
  }
  const quadros: [number, number][][] = []
  const vel = todos.map(() => ({ x: 0, y: 0 }))
  let mergulhoIni: { x: number; y: number } | null = null
  for (let k = 0; k < n; k++) {
    const t = k * DT
    const fixo = todos.map(() => false)
    const corteAgora = g.corte != null && t >= g.corte - 1e-6 && t - DT < g.corte - 1e-6
    todos.forEach((c, i) => {
      const f = g.fixos.get(c.id)
      if (f && t <= f[f.length - 1].t) {
        const p = interp(f, t)
        if (k > 0) vel[i] = { x: (p.x - pos[i].x) / DT, y: (p.y - pos[i].y) / DT }
        pos[i] = { x: p.x, y: p.y }
        fixo[i] = true
        return
      }
      if (c === gr && g.mergulho && t >= g.tRemate) {
        if (!mergulhoIni) mergulhoIni = { ...pos[i] }
        const m = g.mergulho
        const fr = clamp((t - g.tRemate) / Math.max(0.1, m.t1 - g.tRemate), 0, 1)
        pos[i] = { x: lerp(mergulhoIni.x, m.ate.x, fr), y: lerp(mergulhoIni.y, m.ate.y, fr) }
        vel[i] = { x: 0, y: 0 }
        fixo[i] = true
        return
      }
      const a = alvo(c, i, t)
      if (corteAgora) { pos[i] = { ...a }; vel[i] = { x: 0, y: 0 }; return }
      const depois = t > g.tFim + 0.3
      // Depois do golo, quem sofreu fica quase parado (cabeça baixa). Antes, cada um corre o que as pernas dão.
      const vmax = c === rem && festa && depois ? (tipoFesta === 'joelhos' ? 9 : 8) : depois && golo && c.lado !== rem.lado ? 1.2 : depois ? Math.min(4.5, vMax(c)) : vMax(c)
      const p = { ...pos[i] }
      mover(p, vel[i], a, vmax, acel(c), DT)
      pos[i] = p
    })
    // Afastar caricas que se sobrepõem (os jogadores-chave não se mexem).
    for (let it = 0; it < 2; it++) {
      for (let i = 0; i < todos.length; i++) {
        for (let j = i + 1; j < todos.length; j++) {
          if (fixo[i] && fixo[j]) continue
          // No monte, os colegas encostam-se ao marcador.
          if (tipoFesta === 'monte' && t > g.tFim + 1 && todos[i].lado === rem.lado && todos[j].lado === rem.lado) continue
          const dx = pos[j].x - pos[i].x, dy = pos[j].y - pos[i].y
          const d = Math.hypot(dx, dy)
          const min = RAIO * 2 + 0.15
          if (d >= min) continue
          const ux = d > 0.001 ? dx / d : 1, uy = d > 0.001 ? dy / d : 0
          const falta = Math.min(min - d, 0.25)
          if (fixo[i]) { pos[j].x += ux * falta; pos[j].y += uy * falta }
          else if (fixo[j]) { pos[i].x -= ux * falta; pos[i].y -= uy * falta }
          else { pos[i].x -= ux * falta / 2; pos[i].y -= uy * falta / 2; pos[j].x += ux * falta / 2; pos[j].y += uy * falta / 2 }
        }
      }
    }
    for (const p of pos) { p.x = clamp(p.x, -1, COMPRIMENTO + 2); p.y = clamp(p.y, 0.5, LARGURA - 0.5) }
    quadros.push(pos.map((p) => [Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100]))
  }
  // De joelhos: os últimos metros até ao sítio do festejo são a deslizar (rasto na relva).
  if (tipoFesta === 'joelhos' && festa) {
    const iR = todos.indexOf(rem)
    const k = quadros.findIndex((q, kk) => kk * DT > g.tFim && Math.hypot(q[iR][0] - festa.x, q[iR][1] - festa.y) < 0.5)
    if (k > 6) {
      const de = { x: quadros[k - 6][iR][0], y: quadros[k - 6][iR][1] }
      g.acoes.push({ tipo: 'joelhos', t: (k - 6) * DT + 0.3, autorId: rem.id, vitimaId: rem.id, de, ate: { ...festa } })
    }
  }
  return quadros
}

// ---------------------------------------------------------------------------
// Campo ao vivo: um minuto de jogo "normal" (sem lance), para o 2D estar sempre a mexer.
// Aqui as coordenadas são as do campo visto da bancada: a casa ataca para a direita
// (o desenho roda 180° na 2.ª parte com `espelhar`).

export interface MinutoAmbiente {
  emCampo: Record<Lado, EmCampoRep>
  /** Quem tem a bola neste minuto. */
  posse: Lado
  minuto: number
  posturas: Record<Lado, 'defensiva' | 'equilibrada' | 'ofensiva'>
  /** Onde acabou o minuto anterior (ids -> posição, e a bola). Sem isto, começa no pontapé de saída. */
  antes?: { pos: Record<number, [number, number]>; bola: { x: number; y: number }; posse?: Lado; vel?: Record<number, [number, number]> }
  /** Remate sem perigo deste minuto, já decidido pelo motor (só se encena). */
  remate?: { lado: Lado; lance: Lance }
  /** Canto deste minuto (sem remate, ou a seguir a um remate desviado). */
  canto?: Lado
  semente: number
}

/** Duração de um minuto de ambiente, em segundos do desenho (a UI acelera para caber no minuto). */
export const DURACAO_AMBIENTE = 1.8

type Pt = { x: number; y: number }

/**
 * Gera um minuto de jogo sem golo nem ocasião: passes, conduções, desarmes, cortes, lançamentos,
 * cantos aliviados e remates sem perigo. Quem é rápido corre mais, quem passa bem arrisca o passe
 * longo e para a frente, quem defende bem ganha mais bolas. O resultado já vem do motor.
 */
export function criarAmbiente(m: MinutoAmbiente): CenaRepeticao {
  const rng = createRng(m.semente >>> 0 || 1)
  const r = () => rng.next()
  const la = lugares('casa', m.emCampo.casa)
  const lf = lugares('fora', m.emCampo.fora)
  const todos = [...la, ...lf]
  const D = DURACAO_AMBIENTE
  // x medido da própria baliza -> x do campo (casa ataca para a direita).
  const dir = (l: Lado) => (l === 'casa' ? 1 : -1)
  const campoX = (l: Lado, xp: number) => (l === 'casa' ? xp : COMPRIMENTO - xp)
  const proprioX = (l: Lado, x: number) => (l === 'casa' ? x : COMPRIMENTO - x)
  const outroLado = (l: Lado): Lado => (l === 'casa' ? 'fora' : 'casa')
  const reinicio = !m.antes
  const posse = m.posse
  const mantem = m.antes?.posse === posse
  const acoes: AcaoRep[] = []
  const cortes: number[] = []
  let b0: Pt = m.antes ? { ...m.antes.bola } : { x: COMPRIMENTO / 2, y: LARGURA / 2 }
  const modo: 'saida' | 'remate' | 'canto' | 'passes' | 'perda' = reinicio ? 'saida'
    : m.remate && m.remate.lado === posse ? 'remate' : m.canto === posse ? 'canto' : mantem ? 'passes' : 'perda'

  /** Posição de cada um em função da bola e de quem a tem. */
  const alvoBloco = (c: Lugar, b: Pt, comBola: Lado): Pt => {
    const bx = proprioX(c.lado, b.x) // bola medida da baliza de c
    const sobe = m.posturas[c.lado] === 'ofensiva' ? 5 : m.posturas[c.lado] === 'defensiva' ? -6 : 0
    let xp: number, y: number
    if (modo === 'saida') {
      xp = Math.min(50, c.pos === 'GR' ? 4 : c.bx * 0.8 + 4)
      y = c.by
    } else if (c.lado === comBola) {
      if (c.pos === 'GR') { xp = 5 + Math.max(0, bx - 50) * 0.3; y = 34 + (b.y - 34) * 0.2 }
      else {
        const teto = c.pos === 'DEF' ? 66 : c.pos === 'MED' ? 84 : 96
        // Os avançados atacam a profundidade quando a bola chega ao último terço.
        const rutura = c.pos === 'AV' && bx > 55 ? 6 : 0
        xp = Math.min(teto, c.bx + (bx - 30) * 0.7 + sobe + rutura)
        y = c.by + (b.y - 34) * 0.3
      }
    } else {
      if (c.pos === 'GR') { xp = 1.5 + Math.max(0, bx - 70) * 0.15; y = 34 + (b.y - 34) * 0.15 }
      else {
        const k = c.pos === 'DEF' ? [8, 0.32] : c.pos === 'MED' ? [16, 0.42] : [30, 0.48]
        xp = k[0] + bx * k[1] + sobe * 0.6
        y = c.by * 0.7 + b.y * 0.3
      }
    }
    return { x: clamp(campoX(c.lado, xp), 1, COMPRIMENTO - 1), y: clamp(y, 1.5, LARGURA - 1.5) }
  }

  const pos: Pt[] = todos.map((c) => {
    const a = m.antes?.pos[c.id]
    return a ? { x: a[0], y: a[1] } : alvoBloco(c, b0, posse)
  })
  const vel: Pt[] = todos.map((c) => {
    const v = m.antes?.vel?.[c.id]
    return v ? { x: v[0], y: v[1] } : { x: 0, y: 0 }
  })
  const iDe = (c: Lugar) => todos.indexOf(c)
  const P = (c: Lugar) => pos[iDe(c)]
  const maisPerto = (lista: Lugar[], p: Pt) => lista.slice().sort((a, b) => dist(P(a), p) - dist(P(b), p))
  const daEquipa = (l: Lado) => todos.filter((c) => c.lado === l && c.pos !== 'GR')
  /** Pôr toda a gente no sítio de uma bola parada (com corte de plano). */
  const colocar = (onde: (c: Lugar) => Pt) => {
    todos.forEach((c, i) => { pos[i] = onde(c); vel[i] = { x: 0, y: 0 } })
    cortes.push(0)
  }

  // --- A bola: ou está nos pés de alguém (dono), ou a viajar (voo), ou parada (num sítio).
  type Voo = { de: Pt; ate: Pt; t0: number; t1: number; alt: number; zFim?: number; para?: Lugar; depois?: 'parada' }
  let dono: Lugar | undefined
  let voo: Voo | undefined
  let parada: Pt | undefined
  let decide = 0 // instante em que o dono volta a decidir
  let conduz: Pt | undefined // para onde o dono leva a bola
  /** Jogadores com sítio marcado até um instante (quem vai receber, quem vai ao desarme...). */
  const vai = new Map<Lugar, { p: Pt; ate: number; corre?: boolean }>()
  /** Ações agendadas pelo guião (instante, função). */
  const agenda: { t: number; f: () => void }[] = []
  let protagonista: Lugar | undefined

  const lancar = (de: Pt, ate: Pt, t0: number, vBola: number, para?: Lugar, alt = 0, extra: Partial<Voo> = {}) => {
    const d = dist(de, ate)
    voo = { de: { ...de }, ate: { ...ate }, t0, t1: t0 + Math.max(0.2, d / vBola), alt, ...(para ? { para } : {}), ...extra }
    dono = undefined; parada = undefined; conduz = undefined
    if (para) vai.set(para, { p: ate, ate: voo.t1, corre: true })
    return voo
  }

  /** O dono decide: passe para um colega (os bons passadores arriscam mais para a frente) ou conduz. */
  const decidir = (t: number) => {
    const c = dono!
    const b = { ...P(c) }
    const d0 = dir(c.lado)
    const rel = proprioX(c.lado, b.x)
    const adversarios = todos.filter((o) => o.lado !== c.lado)
    const pressao = Math.min(...adversarios.map((o) => dist(P(o), b)))
    const qPas = n01(c.a.pas)
    // Arrancada com espaço à frente (rápidos e tecnicistas).
    if (!conduz && pressao > 4 && rel < 85 && rng.chance(0.1 + 0.35 * n01((c.a.vel * 2 + c.a.rem) / 3))) {
      const lg = 5 + r() * 5
      conduz = { x: clamp(b.x + d0 * lg, 2, COMPRIMENTO - 2), y: clamp(b.y + (r() - 0.5) * 4, 3, LARGURA - 3) }
      decide = t + lg / (vMax(c) * 0.85)
      return
    }
    const colegas = daEquipa(c.lado).filter((o) => o !== c)
    // Apertado perto da própria área: alívio para a frente, pelo ar.
    if (rel < 28 && pressao < 5) {
      const frente = colegas.slice().sort((a, b) => d0 * (P(b).x - P(a).x))[0]
      const alvo = frente ? { x: clamp(P(frente).x + d0 * 4, 3, COMPRIMENTO - 3), y: P(frente).y } : { x: b.x + d0 * 40, y: 34 }
      lancar(b, alvo, t, 24, frente, 7)
      return
    }
    let tot = 0
    const opcoes = colegas.map((o) => {
      const p = P(o)
      const d = dist(p, b)
      if (d < 6 || d > 34) return { o, p, d, w: 0 }
      const frente = d0 * (p.x - b.x)
      let w = Math.max(0.15, 1 + (frente / 12) * (0.5 + qPas))
      if (d > 22) w *= 0.25 + qPas
      const marcado = Math.min(...adversarios.map((a) => dist(P(a), p)))
      if (marcado < 3.5) w *= 0.7 - 0.4 * qPas
      tot += w
      return { o, p, d, w }
    }).filter((x) => x.w > 0)
    if (!opcoes.length) { decide = t + 0.3; return }
    let k = r() * tot
    const esc = opcoes.find((x) => (k -= x.w) <= 0) ?? opcoes[opcoes.length - 1]
    // Passe à frente do colega (para onde ele corre).
    const vO = vel[iDe(esc.o)]
    const vBola = 13 + 9 * qPas + (esc.d > 25 ? 3 : 0)
    const tv = esc.d / vBola
    // Sem tempo para o passe chegar neste minuto: segura e protege a bola.
    if (t + tv * 0.5 > D - 0.1) { conduz = { x: b.x + d0 * 1.5, y: b.y }; decide = 99; return }
    const alvo = { x: clamp(esc.p.x + vO.x * tv * 0.8 + d0 * 1.2, 1.5, COMPRIMENTO - 1.5), y: clamp(esc.p.y + vO.y * tv * 0.8, 1.5, LARGURA - 1.5) }
    lancar(b, alvo, t, vBola, esc.o, esc.d > 24 ? 2.5 + esc.d / 12 : 0)
  }

  /** A bola sai pela linha lateral (avança `sentido` no campo) e a equipa `eq` repõe com um lançamento. */
  const lancamento = (eq: Lado, sentido: number) => {
    const L = { x: clamp(b0.x + sentido * (3 + r() * 4), 3, COMPRIMENTO - 3), y: b0.y < 34 ? -0.4 : LARGURA + 0.4 }
    const lancador = maisPerto(daEquipa(eq), L)[0]
    if (!lancador) return
    lancar(b0, L, 0, 9, undefined, 0.3, { depois: 'parada' })
    vai.set(lancador, { p: { x: L.x, y: b0.y < 34 ? 0.6 : LARGURA - 0.6 }, ate: 1.15, corre: true })
    agenda.push({ t: 1.15, f: () => {
      const para = maisPerto(daEquipa(eq).filter((c) => c !== lancador), L)[0]
      if (!para) return
      const alvo = { x: clamp(P(para).x + dir(eq) * 1.5, 2, COMPRIMENTO - 2), y: clamp(P(para).y, 3, LARGURA - 3) }
      acoes.push({ tipo: 'lancamento', t: 1.15, autorId: lancador.id, vitimaId: lancador.id, de: L, ate: alvo })
      lancar(L, alvo, 1.15, 11, para, 1.6)
    } })
  }

  // --- Guião de cada tipo de minuto.
  if (modo === 'saida') {
    const meio = daEquipa(posse).filter((c) => c.pos === 'MED').sort((a, b) => Math.abs(a.by - 34) - Math.abs(b.by - 34))[0] ?? daEquipa(posse)[0]
    if (meio) {
      const alvo = { x: campoX(posse, 40), y: clamp(alvoBloco(meio, b0, posse).y, 20, 48) }
      parada = { ...b0 }
      agenda.push({ t: 0.2, f: () => { lancar(b0, alvo, 0.2, 14, meio) } })
    }
  } else if (modo === 'canto') {
    const lado = b0.y < 34 ? 0.7 : 67.3
    const C = { x: campoX(posse, 104.4), y: lado }
    const ata = daEquipa(posse)
    const dfd = daEquipa(outroLado(posse))
    const grD = todos.find((c) => c.lado !== posse && c.pos === 'GR')
    const grA = todos.find((c) => c.lado === posse && c.pos === 'GR')
    const marcador = ata.slice().sort((a, b) => b.a.pas - a.a.pas)[0]
    // Na área: os melhores no ar; atrás ficam dois defesas.
    const naArea = ata.filter((c) => c !== marcador).sort((a, b) => (b.a.fis + b.a.rem) - (a.a.fis + a.a.rem)).slice(0, 5)
    const sitio = new Map<Lugar, Pt>()
    naArea.forEach((c, i) => sitio.set(c, { x: campoX(posse, 92 + (i % 3) * 2.5 + r()), y: 27 + i * 3.4 + r() }))
    ata.filter((c) => c !== marcador && !naArea.includes(c)).forEach((c, i) => sitio.set(c, { x: campoX(posse, c.pos === 'DEF' ? 52 + i * 2 : 80 + r() * 4), y: 14 + ((i * 13) % 40) }))
    if (marcador) sitio.set(marcador, { x: C.x - dir(posse) * 0.8, y: lado < 34 ? lado + 0.6 : lado - 0.6 })
    // Defesa: um em cima de cada atacante na área, os outros à entrada; um avançado fica para o contra.
    const sobram = dfd.slice()
    naArea.forEach((c) => {
      const d = sobram.sort((a, b) => b.a.def - a.a.def).find((x) => x.pos !== 'AV') ?? sobram[0]
      if (!d) return
      sobram.splice(sobram.indexOf(d), 1)
      const s = sitio.get(c)!
      sitio.set(d, { x: s.x + dir(posse) * 1.6, y: s.y + 0.8 })
    })
    sobram.forEach((c, i) => sitio.set(c, { x: campoX(posse, c.pos === 'AV' ? 58 : 86 + (i % 2) * 2), y: 22 + i * 6 }))
    if (grD) sitio.set(grD, { x: campoX(posse, 103.8), y: 34 + (lado < 34 ? -1 : 1) * 1 })
    if (grA) sitio.set(grA, { x: campoX(posse, 30), y: 34 })
    colocar((c) => sitio.get(c) ?? { ...P(c) })
    parada = { ...C }
    b0 = { ...C }
    protagonista = marcador
    // Cruzamento e alívio de cabeça do melhor defesa no ar.
    const H = { x: campoX(posse, 94 + r() * 4), y: 29 + r() * 10 }
    const cortador = maisPerto(dfd.filter((c) => c.pos !== 'AV'), H).slice(0, 3).sort((a, b) => (b.a.def + b.a.fis) - (a.a.def + a.a.fis))[0]
    const vCruz = dist(C, H) / 0.7
    agenda.push({ t: 0.35, f: () => { lancar(C, H, 0.35, vCruz, undefined, 4, { zFim: 1.8 }); if (cortador) vai.set(cortador, { p: H, ate: 1.05, corre: true }) } })
    agenda.push({ t: 1.05, f: () => {
      const fim = { x: campoX(posse, 66 + r() * 10), y: clamp(H.y + (r() - 0.5) * 30, 4, 64) }
      if (cortador) acoes.push({ tipo: 'cabeca', t: voo!.t1, autorId: cortador.id, vitimaId: cortador.id, de: H, ate: fim })
      const quem = maisPerto(todos.filter((c) => c.pos !== 'GR'), fim)[0]
      lancar(H, fim, voo!.t1, 16, quem, 3, { depois: 'parada' })
    } })
  } else if (modo === 'remate') {
    const l = m.remate!.lance
    const rem = todos.find((c) => c.id === l.rematadorId && c.lado === posse) ?? daEquipa(posse).find((c) => c.pos === 'AV') ?? daEquipa(posse)[0]
    protagonista = rem
    const yc = l.corredor === -1 ? 18 + r() * 8 : l.corredor === 1 ? 42 + r() * 8 : 27 + r() * 14
    const relR = l.origem === 'longe' || l.origem === 'livre' ? 70 + r() * 6 : 79 + r() * 8
    const S = { x: campoX(posse, relR), y: yc }
    // Longe do sítio: corte de plano para o ataque já instalado.
    if (proprioX(posse, b0.x) < 55) {
      const b1 = { x: campoX(posse, relR - 14), y: lerp(yc, 34, 0.4) }
      colocar((c) => (c === rem ? { x: S.x - dir(posse) * 6, y: S.y + 3 } : alvoBloco(c, b1, posse)))
      b0 = b1
    }
    const dfd = daEquipa(outroLado(posse))
    const grD = todos.find((c) => c.lado !== posse && c.pos === 'GR')
    // O passe vai para onde o rematador consegue chegar, a caminho do sítio do remate.
    const pr = P(rem)
    const dS = dist(pr, S) || 1
    const anda = Math.min(dS, vMax(rem) * 0.4)
    const R0 = { x: pr.x + ((S.x - pr.x) / dS) * anda, y: pr.y + ((S.y - pr.y) / dS) * anda }
    const tChega = 0.05 + clamp(dist(b0, R0) / 24, 0.35, 0.8)
    vai.set(rem, { p: R0, ate: tChega, corre: true })
    parada = { ...b0 }
    agenda.push({ t: 0.05, f: () => lancar(b0, R0, 0.05, Math.max(8, dist(b0, R0) / (tChega - 0.05)), rem) })
    const tRem = tChega + 0.35
    agenda.push({ t: tChega + 0.02, f: () => { dono = rem; conduz = S; decide = 99 } })
    agenda.push({ t: tRem, f: () => {
      const de = { ...P(rem) }
      const vRem = 22 + 10 * n01(rem.a.rem)
      const bloq = dfd.filter((c) => c.pos !== 'GR').sort((a, b) => dist(P(a), de) - dist(P(b), de))[0]
      const golo = { x: campoX(posse, 104), y: 34 }
      if (bloq && dist(P(bloq), de) < 9 && rng.chance(0.25 + 0.35 * n01(bloq.a.def))) {
        // Bloqueado por um defesa que se atira à frente.
        const B = { x: lerp(de.x, golo.x, 0.18), y: lerp(de.y, golo.y, 0.18) }
        vai.set(bloq, { p: B, ate: tRem + 0.25, corre: true })
        lancar(de, B, tRem, vRem, undefined, 0.3)
        acoes.push({ tipo: 'bloqueio', t: tRem + 0.2, autorId: bloq.id, vitimaId: rem.id, de: B, ate: B })
        agenda.push({ t: voo!.t1, f: () => {
          const fim = m.canto ? { x: campoX(posse, 105.6), y: B.y < 34 ? 8 + r() * 6 : 54 + r() * 6 } : { x: B.x - dir(posse) * (6 + r() * 6), y: clamp(B.y + (r() - 0.5) * 20, 3, 65) }
          const quem = m.canto ? undefined : maisPerto(todos.filter((c) => c.pos !== 'GR'), fim)[0]
          lancar(B, fim, voo!.t1, 14, quem, 1.2, { depois: 'parada' })
        } })
      } else if (l.desfecho === 'defesa' && grD) {
        // Defesa fácil do guarda-redes (agarra; se houver canto, desvia para fora).
        const G = { x: campoX(posse, 103.6), y: 34 + (r() - 0.5) * 3 }
        vai.set(grD, { p: G, ate: tRem + 1.5 })
        lancar(de, G, tRem, vRem, m.canto ? undefined : grD, 0.8)
        if (m.canto) agenda.push({ t: voo!.t1, f: () => lancar(G, { x: campoX(posse, 105.8), y: G.y < 34 ? 24 : 44 }, voo!.t1, 9, undefined, 0.6, { depois: 'parada' }) })
      } else {
        // Ao lado ou por cima.
        const porCima = rng.chance(0.35)
        const A = { x: campoX(posse, 105.6), y: porCima ? 34 + (r() - 0.5) * 6 : 34 + (rng.chance(0.5) ? 1 : -1) * (4.6 + r() * 5) }
        lancar(de, A, tRem, vRem, undefined, porCima ? 3.2 : 1.2, { zFim: porCima ? 2.6 : 0.4, depois: 'parada' })
        if (grD) vai.set(grD, { p: { x: campoX(posse, 103.8), y: lerp(34, A.y, 0.25) }, ate: tRem + 1 })
      }
    } })
  } else if (modo === 'perda') {
    // Quem tinha a bola perde-a: desarme de quem está perto ou corte de um passe.
    const antigo = outroLado(posse)
    const portador = maisPerto(daEquipa(antigo), b0)[0]
    const ganhos = maisPerto(daEquipa(posse), b0).slice(0, 3)
    let tot = 0
    const pesos = ganhos.map((c) => { const w = Math.pow(c.a.def / 60, 2) * (dist(P(c), b0) < 12 ? 1.5 : 1); tot += w; return w })
    let k = r() * tot
    const quem = ganhos.find((_, i) => (k -= pesos[i]) <= 0) ?? ganhos[0]
    const junto = (b0.y < 12 || b0.y > LARGURA - 12) && rng.chance(0.4)
    if (junto && quem) {
      lancamento(posse, dir(antigo))
    } else if (quem && portador && dist(P(quem), b0) < 7) {
      // Desarme: vai ao portador e fica com a bola.
      const tD = clamp(dist(P(quem), b0) / vMax(quem), 0.25, 0.7)
      dono = portador
      decide = 99
      conduz = { x: b0.x + dir(antigo) * 2, y: b0.y }
      vai.set(quem, { p: { x: b0.x + dir(antigo) * 1.2, y: b0.y }, ate: tD, corre: true })
      agenda.push({ t: tD, f: () => {
        acoes.push({ tipo: 'desarme', t: tD, autorId: quem.id, vitimaId: portador.id, de: { ...P(quem) }, ate: { ...P(portador) } })
        dono = quem; conduz = undefined; decide = tD + 0.35 - 0.15 * n01(quem.a.pas)
      } })
    } else if (quem && portador) {
      // Passe cortado: o adversário mete-se na linha da bola.
      const colega = maisPerto(daEquipa(antigo).filter((c) => c !== portador), { x: b0.x + dir(antigo) * 12, y: b0.y })[0]
      const destino = colega ? { ...P(colega) } : { x: b0.x + dir(antigo) * 15, y: b0.y }
      const q = P(quem)
      const ux = destino.x - b0.x, uy = destino.y - b0.y, L2 = ux * ux + uy * uy || 1
      const f = clamp(((q.x - b0.x) * ux + (q.y - b0.y) * uy) / L2, 0.25, 0.85)
      const I = { x: b0.x + ux * f, y: b0.y + uy * f }
      lancar(b0, I, 0.05, 15, quem)
      agenda.push({ t: voo!.t1, f: () => acoes.push({ tipo: 'corte', t: voo!.t1, autorId: quem.id, vitimaId: portador.id, de: I, ate: I }) })
    } else if (quem) {
      dono = quem
      decide = 0.3
    }
  } else {
    // Mantém a bola. Junto à linha, às vezes a bola sai num ressalto e é lançamento a favor.
    if ((b0.y < 10 || b0.y > LARGURA - 10) && rng.chance(0.2)) lancamento(posse, dir(posse))
    else {
      // O mais perto fica com ela e decide.
      dono = maisPerto(daEquipa(posse), b0)[0]
      if (dono) { decide = 0.15 + 0.2 * (1 - n01(dono.a.pas)) }
    }
  }

  // --- Simulação, quadro a quadro.
  const bola: PontoBola[] = []
  const quadros: [number, number][][] = []
  const fase = todos.map((c) => (c.id % 97) / 15)
  const n = Math.round(D / DT) + 1
  agenda.sort((a, b) => a.t - b.t)
  let ia = 0
  let bAtual: Pt & { z: number } = { ...b0, z: 0 }
  for (let k = 0; k < n; k++) {
    const t = k * DT
    while (ia < agenda.length && agenda[ia].t <= t + 1e-6) agenda[ia++].f()
    // Chegada da bola.
    if (voo && t >= voo.t1 - 1e-6) {
      const v = voo
      voo = undefined
      if (v.para) { dono = v.para; decide = t + 0.35 - 0.2 * n01(v.para.a.pas); conduz = undefined }
      else parada = { ...v.ate }
    }
    if (dono && t >= decide && k < n - 4 && modo !== 'remate') decidir(t)
    // Onde está a bola agora (antes de mexer as caricas, para elas reagirem).
    const comBola: Lado = dono?.lado ?? voo?.para?.lado ?? posse
    const bRef: Pt = dono ? P(dono) : voo ? { x: lerp(voo.de.x, voo.ate.x, clamp((t - voo.t0) / (voo.t1 - voo.t0), 0, 1)), y: lerp(voo.de.y, voo.ate.y, clamp((t - voo.t0) / (voo.t1 - voo.t0), 0, 1)) } : (parada ?? bAtual)
    // Linha do fora de jogo: o último defesa (sem contar o guarda-redes) de quem não tem a bola.
    const defende = outroLado(comBola)
    const linha = Math.min(...todos.filter((c) => c.lado === defende && c.pos !== 'GR').map((c) => proprioX(defende, P(c).x)), 60)
    // Pressão: o mais perto da bola vai a ela, o segundo fecha o caminho para a baliza.
    const pressores = maisPerto(daEquipa(defende), bRef).slice(0, 2).filter((c) => dist(P(c), bRef) < 18)
    todos.forEach((c, i) => {
      let a: Pt
      let vmax = vMax(c) * 0.72
      const marca = vai.get(c)
      if (marca && t <= marca.ate) { a = marca.p; if (marca.corre) vmax = vMax(c) }
      else if (c === dono) {
        const fr = conduz ?? { x: P(c).x + vel[i].x * 0.3, y: P(c).y + vel[i].y * 0.3 }
        a = fr
        vmax = vMax(c) * 0.85
      } else if (pressores[0] === c) {
        const own = { x: campoX(c.lado, 0), y: 34 }
        const d = dist(bRef, own) || 1
        a = { x: bRef.x + ((own.x - bRef.x) / d) * 1.4, y: bRef.y + ((own.y - bRef.y) / d) * 1.4 }
        vmax = vMax(c) * (0.75 + 0.25 * n01(c.a.def))
      } else if (pressores[1] === c) {
        const own = { x: campoX(c.lado, 0), y: 34 }
        a = { x: lerp(bRef.x, own.x, 0.25), y: lerp(bRef.y, own.y, 0.25) }
      } else {
        a = alvoBloco(c, bRef, comBola)
        // Atacantes não passam a linha do último defesa (a menos que a bola já lá esteja).
        if (c.lado === comBola && c.pos !== 'GR') {
          const lim = Math.max(COMPRIMENTO - linha - 0.5, proprioX(c.lado, bRef.x))
          if (proprioX(c.lado, a.x) > lim) a = { x: campoX(c.lado, lim), y: a.y }
        }
        a = { x: a.x + Math.sin(t * 1.7 + fase[i]) * 0.5, y: a.y + Math.cos(t * 1.3 + fase[i]) * 0.4 }
      }
      const p = { ...pos[i] }
      mover(p, vel[i], a, vmax, acel(c), DT)
      pos[i] = p
    })
    for (let i = 0; i < todos.length; i++) for (let j = i + 1; j < todos.length; j++) {
      const dx = pos[j].x - pos[i].x, dy = pos[j].y - pos[i].y, d = Math.hypot(dx, dy), min = RAIO * 2 + 0.1
      if (d >= min) continue
      const ux = d > 0.001 ? dx / d : 1, uy = d > 0.001 ? dy / d : 0, f = Math.min(min - d, 0.2) / 2
      pos[i].x -= ux * f; pos[i].y -= uy * f; pos[j].x += ux * f; pos[j].y += uy * f
    }
    for (const p of pos) { p.x = clamp(p.x, 0.5, COMPRIMENTO - 0.5); p.y = clamp(p.y, 0.5, LARGURA - 0.5) }
    // A bola: nos pés (um pouco à frente, para onde corre), a voar, ou parada.
    if (dono) {
      const p = P(dono), v = vel[iDe(dono)], sp = Math.hypot(v.x, v.y)
      const fx = sp > 0.5 ? v.x / sp : dir(dono.lado), fy = sp > 0.5 ? v.y / sp : 0
      bAtual = { x: p.x + fx * 0.9, y: p.y + fy * 0.9, z: 0 }
    } else if (voo) {
      const f = clamp((t - voo.t0) / Math.max(0.05, voo.t1 - voo.t0), 0, 1)
      bAtual = { x: lerp(voo.de.x, voo.ate.x, f), y: lerp(voo.de.y, voo.ate.y, f), z: 4 * voo.alt * f * (1 - f) + (voo.zFim ?? 0) * f }
    } else if (parada) bAtual = { ...parada, z: 0 }
    bola.push({ t: Math.round(t * 100) / 100, x: bAtual.x, y: bAtual.y, z: Math.max(0, bAtual.z) })
    quadros.push(pos.map((p) => [Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100]))
  }
  // Quem fica com a bola no fim (para o minuto seguinte e para o nome no desenho).
  const bFim = bola[bola.length - 1]
  const comFim = dono ?? (voo?.para) ?? maisPerto(daEquipa(posse), bFim)[0]
  return {
    minuto: m.minuto, atacante: posse, origem: modo === 'canto' ? 'canto' : modo === 'remate' ? (m.remate!.lance.origem === 'longe' ? 'longe' : 'jogada') : 'jogada', desfecho: 'fora', texto: '',
    rematadorId: (modo === 'remate' || modo === 'canto' ? protagonista?.id : comFim?.id) ?? comFim?.id ?? -1,
    tRemate: D + 1, tFim: D + 1,
    duracao: D, dt: DT, caricas: todos.map(({ id, lado, num, pos }) => ({ id, lado, num, pos })),
    quadros, bola, acoes, cortes, espelhar: parteDoJogo(m.minuto) % 2 === 1, ambiente: true,
  }
}

/** Fim de uma cena convertido para as coordenadas do campo ao vivo (para o minuto seguinte continuar dali). */
export function fimEmCampo(c: CenaRepeticao): { pos: Record<number, [number, number]>; bola: { x: number; y: number }; vel: Record<number, [number, number]> } {
  const q = c.quadros[c.quadros.length - 1]
  const q0 = c.quadros[Math.max(0, c.quadros.length - 2)]
  const b = bolaEm(c, c.duracao)
  // Cenas de lance: o atacante vai para a direita e `espelhar` roda; aqui a casa vai para a direita na 1.ª parte.
  const rodaLance = c.ambiente ? false : c.espelhar !== (parteDoJogo(c.minuto) % 2 === 1)
  const conv = (x: number, y: number): [number, number] => (rodaLance ? [COMPRIMENTO - x, LARGURA - y] : [x, y])
  const pos: Record<number, [number, number]> = {}
  const vel: Record<number, [number, number]> = {}
  const s = rodaLance ? -1 : 1
  c.caricas.forEach((k, i) => {
    pos[k.id] = conv(clamp(q[i][0], 1, COMPRIMENTO - 1), q[i][1])
    // Só continua a correr quem acaba um minuto normal (as repetições acabam em festejos e paragens).
    vel[k.id] = c.ambiente ? [s * (q[i][0] - q0[i][0]) / c.dt, s * (q[i][1] - q0[i][1]) / c.dt] : [0, 0]
  })
  const [bx, by] = conv(clamp(b.x, 2, COMPRIMENTO - 2), clamp(b.y, 2, LARGURA - 2))
  return { pos, bola: { x: bx, y: by }, vel }
}

// ---------------------------------------------------------------------------
// Cartões e lesões: uma cena curta (a falta e o cartão, ou o jogador que fica no chão e a assistência).
// Como nas repetições, quem tem a bola ataca para a direita.

/** Instante em que a equipa médica chega ao lesionado (s). */
export const T_MACAS = 1.6

/** Cria a cena de um cartão ou de uma lesão (null para outros eventos ou se o jogador não estiver em campo). */
export function criarIncidente(ev: EventoJogo, emCampo: Record<Lado, EmCampoRep>, semente: number): CenaRepeticao | null {
  if (ev.tipo !== 'amarelo' && ev.tipo !== 'vermelho' && ev.tipo !== 'lesao') return null
  if (ev.jogadorId == null) return null
  const rng = createRng(semente >>> 0 || 1)
  const r = () => rng.next()
  const doJog = ev.lado
  const atac: Lado = doJog === 'casa' ? 'fora' : 'casa'
  // O jogador do cartão já pode estar em `fora` (expulso, lesionado): aqui ainda está em campo.
  const semEle = (e: EmCampoRep): EmCampoRep => ({ ...e, fora: e.fora.filter((id) => id !== ev.jogadorId) })
  const la = lugares(atac, semEle(emCampo[atac]))
  const ld = lugares(doJog, semEle(emCampo[doJog]))
  const todos = [...la, ...ld]
  const prot = ld.find((c) => c.id === ev.jogadorId)
  if (!prot) return null
  const lesao = ev.tipo === 'lesao'
  // Sítio: perto da zona do jogador (x medido para o atacante, que vai para a direita).
  const zona = COMPRIMENTO - (prot.pos === 'GR' ? 14 : prot.bx + 6)
  const F = { x: clamp(zona + (r() - 0.5) * 10, 18, 88), y: clamp(prot.by + (r() - 0.5) * 12, 6, 62) }
  const cands = la.filter((c) => c.pos !== 'GR').sort((a, b) => dist({ x: COMPRIMENTO - a.bx, y: a.by }, F) - dist({ x: COMPRIMENTO - b.bx, y: b.by }, F))
  const vit = cands[0]
  const tF = 1.4
  const bola: PontoBola[] = []
  const fixos = new Map<number, Ponto[]>()
  const acoes: AcaoRep[] = []
  const A = { x: F.x - 12, y: clamp(F.y + (r() - 0.5) * 8, 4, 64) }
  const lado = F.y > 34 ? -1 : 1
  let tCartao = 0
  let duracao = 0
  if (!lesao) {
    // A falta: o adversário conduz, o jogador do cartão entra de carrinho por trás/de lado.
    const rola = { x: F.x + 4 + r() * 3, y: F.y + lado * (1 + r() * 2) }
    bola.push({ t: 0, ...A, z: 0 }, { t: tF, ...F, z: 0 }, { t: tF + 0.7, ...rola, z: 0 })
    const chaoV = { x: F.x + 1.2, y: F.y + lado * 0.4 }
    fixos.set(vit.id, [{ t: 0, x: A.x - 0.9, y: A.y }, { t: tF, x: F.x - 0.9, y: F.y }, { t: tF + 0.35, ...chaoV }, { t: 4.5, ...chaoV }])
    const ini = { x: F.x + 4, y: clamp(F.y - lado * 6, 2, 66) }
    const toque = { x: F.x - 0.3, y: F.y - lado * 1.4 }
    const chaoC = { x: F.x + 0.4, y: F.y - lado * 2.4 }
    tCartao = tF + 1.9
    const caminho: Ponto[] = [{ t: 0, ...ini }, { t: tF - 0.1, ...toque }, { t: tF + 0.3, ...chaoC }, { t: tF + 0.9, ...chaoC }, { t: tCartao, x: chaoC.x - 1, y: chaoC.y - lado * 1.5 }]
    if (ev.tipo === 'vermelho') {
      // Expulso: sai a caminho do túnel (meio-campo, lado do banco).
      const ini = { x: chaoC.x - 1, y: chaoC.y - lado * 1.5 }
      const banco = { x: 52.5, y: LARGURA - 1 }
      const dB = dist(ini, banco) || 1
      const anda = Math.min(dB, 7)
      caminho.push({ t: tCartao + 0.8, ...ini }, { t: tCartao + 3.2, x: ini.x + ((banco.x - ini.x) / dB) * anda, y: ini.y + ((banco.y - ini.y) / dB) * anda })
    }
    fixos.set(prot.id, caminho)
    acoes.push({ tipo: 'falta', t: tF, autorId: prot.id, vitimaId: vit.id, de: toque, ate: chaoC })
    acoes.push({ tipo: 'cartao', t: tCartao, autorId: prot.id, vitimaId: vit.id, de: chaoC, ate: chaoC })
    duracao = tCartao + (ev.tipo === 'vermelho' ? 3.2 : 1.8)
  } else {
    // Lesão: o jogador vai a um lance (ou arranca) e fica no chão; o adversário põe a bola fora.
    const P0 = { x: F.x + 3, y: clamp(F.y - lado * 5, 2, 66) }
    const chao = { x: F.x + 0.6, y: F.y - lado * 1.6 }
    fixos.set(prot.id, [{ t: 0, ...P0 }, { t: tF - 0.1, x: F.x + 0.4, y: F.y - lado * 1.4 }, { t: tF + 0.4, ...chao }, { t: 9, ...chao }])
    const fora = { x: F.x + 8, y: F.y > 34 ? LARGURA + 0.6 : -0.6 }
    bola.push({ t: 0, ...A, z: 0 }, { t: tF, ...F, z: 0 }, { t: tF + 0.9, x: F.x + 3, y: F.y, z: 0 })
    arco(bola, tF + 1.1, tF + 1.9, { x: F.x + 3, y: F.y }, fora, null, 1.2, 0, 5)
    fixos.set(vit.id, [{ t: 0, x: A.x - 0.9, y: A.y }, { t: tF, x: F.x - 0.9, y: F.y }, { t: tF + 1.0, x: F.x + 2.1, y: F.y }, { t: tF + 1.5, x: F.x + 2.4, y: F.y + lado * 0.5 }])
    acoes.push({ tipo: 'lesao', t: tF + 0.4, autorId: prot.id, vitimaId: prot.id, de: chao, ate: chao })
    tCartao = tF + 0.4
    duracao = tF + 1.9 + T_MACAS + 1.4
  }
  // Os outros: param o que estavam a fazer e aproximam-se (com calma), os colegas do caído protestam.
  const n = Math.ceil(duracao / DT) + 1
  const pos = todos.map((c) => { const f = fixos.get(c.id); return f ? { x: f[0].x, y: f[0].y } : { x: clamp(c.lado === atac ? c.bx + (A.x - 30) * 0.7 : COMPRIMENTO - (c.pos === 'GR' ? 1.5 : c.bx * 0.4 + (COMPRIMENTO - A.x) * 0.4), 2, 103), y: clamp(c.by * 0.7 + A.y * 0.3, 2, 66) } })
  const vel = todos.map(() => ({ x: 0, y: 0 }))
  const quadros: [number, number][][] = []
  for (let k = 0; k < n; k++) {
    const t = k * DT
    const b = interp(bola, Math.min(t, tF))
    todos.forEach((c, i) => {
      const f = fixos.get(c.id)
      if (f && t <= f[f.length - 1].t) { const p = interp(f, t); pos[i] = { x: p.x, y: p.y }; return }
      if (c.pos === 'GR') return
      const perto = Math.hypot(pos[i].x - F.x, pos[i].y - F.y) < 25
      let a: { x: number; y: number }
      if (t < tF) a = { x: c.lado === atac ? c.bx + (b.x - 30) * 0.7 : COMPRIMENTO - (c.bx * 0.4 + (COMPRIMENTO - b.x) * 0.4), y: c.by * 0.7 + b.y * 0.3 }
      else if (perto && !lesao) { const ang = i * 2.1; a = { x: F.x + Math.cos(ang) * (3.5 + (i % 3)), y: F.y + Math.sin(ang) * (3.5 + (i % 3)) } }
      else if (perto && lesao) { const ang = i * 2.1; a = { x: F.x + Math.cos(ang) * (6 + (i % 3) * 1.5), y: F.y + Math.sin(ang) * (6 + (i % 3) * 1.5) } }
      else a = pos[i]
      const p = { ...pos[i] }
      mover(p, vel[i], { x: clamp(a.x, 1, 104), y: clamp(a.y, 1.5, 66.5) }, t < tF ? vMax(c) * 0.7 : 3.5, acel(c), DT)
      pos[i] = p
    })
    for (let i = 0; i < todos.length; i++) for (let j = i + 1; j < todos.length; j++) {
      if (fixos.has(todos[i].id) && fixos.has(todos[j].id)) continue
      const dx = pos[j].x - pos[i].x, dy = pos[j].y - pos[i].y, d = Math.hypot(dx, dy), min = RAIO * 2 + 0.1
      if (d >= min) continue
      const ux = d > 0.001 ? dx / d : 1, uy = d > 0.001 ? dy / d : 0, f = Math.min(min - d, 0.2)
      if (fixos.has(todos[i].id)) { pos[j].x += ux * f; pos[j].y += uy * f }
      else if (fixos.has(todos[j].id)) { pos[i].x -= ux * f; pos[i].y -= uy * f }
      else { pos[i].x -= ux * f / 2; pos[i].y -= uy * f / 2; pos[j].x += ux * f / 2; pos[j].y += uy * f / 2 }
    }
    quadros.push(pos.map((p) => [Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100]))
  }
  duracao = Math.round(duracao * 10) / 10
  return {
    minuto: ev.minuto, atacante: atac, origem: 'jogada', desfecho: 'fora', texto: ev.texto,
    rematadorId: prot.id, ...(lesao ? {} : { passadorId: vit.id }),
    tRemate: duracao + 1, tFim: tCartao, duracao, dt: DT,
    caricas: todos.map(({ id, lado, num, pos }) => ({ id, lado, num, pos })),
    quadros, bola, acoes, cortes: [], espelhar: (atac === 'casa') !== (parteDoJogo(ev.minuto) % 2 === 0),
    incidente: { tipo: ev.tipo, jogadorId: prot.id, t: tCartao },
  }
}
