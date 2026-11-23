// Repetições 2D em caricas: encena um lance do motor (golo ou ocasião clara) vista de cima.
// Não decide nada: o resultado já vem do motor (Lance). Aqui só se inventa a coreografia,
// sempre com semente, para a mesma jogada dar sempre a mesma repetição.
// Coordenadas em metros: campo 105 x 68, a equipa que ataca vai sempre para a direita (x = 105).
import { createRng, type Rng } from './rng'
import { posicaoDoLugar } from './motor'
import { FORMACOES } from './partida'
import type { Escalacao, EventoJogo, Lado, Lance } from './partida'
import type { Posicao } from './types'

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
}

/** Jogadores em campo de um lado no momento do lance. */
export interface EmCampoRep { escalacao: Escalacao; fora: readonly number[] }

interface Lugar extends CaricaRep {
  /** Posição base (x medido a partir da própria baliza, y de 0 a 68). */
  bx: number
  by: number
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
    out.push({ id, lado, num: i + 1, pos, bx, by })
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
  /** Os outros não entram na área (penáltis). */
  foraDaArea: boolean
  /** A defesa foi apanhada em contra-ataque (chega atrasada). */
  contra: boolean
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
  let dfs = de(l.defensorId)
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
    quadros, bola: g.bola,
  }
}

function guiao(rng: Rng, l: Lance, rem: Lugar, pas: Lugar | undefined, dfs: Lugar | undefined, gr: Lugar | undefined, la: Lugar[], ld: Lugar[]): Guiao {
  const r = () => rng.next()
  const sinal = () => (rng.chance(0.5) ? -1 : 1)
  const yc = l.corredor === -1 ? 13 + r() * 6 : l.corredor === 1 ? 49 + r() * 6 : 28 + r() * 12
  const bola: PontoBola[] = []
  const fixos = new Map<number, Ponto[]>()
  const g: Guiao = { bola, fixos, tRemate: 0, tFim: 0, barreira: [], foraDaArea: false, contra: false }
  // S = sítio do remate; tS = quando a bola lá chega.
  let S = { x: 0, y: 0 }
  let tS = 0
  let cabeca = false
  let forcaRemate = 27

  const conducaoEPasse = (A: { x: number; y: number }, B: { x: number; y: number }, tConduz: number, condutor: Lugar) => {
    bola.push({ t: 0, ...A, z: 0 })
    bola.push({ t: tConduz, ...B, z: 0 })
    fixos.set(condutor.id, [
      { t: 0, x: A.x - 0.9, y: A.y }, { t: tConduz, x: B.x - 0.9, y: B.y },
      { t: tConduz + 0.8, x: B.x + 3.5, y: lerp(B.y, 34, 0.15) },
    ])
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
      const tConduz = contra ? 3.2 : 1.9
      const ala = l.corredor !== 0
      S = ala
        ? { x: 89 + r() * 5, y: 34 + (yc > 34 ? -1 : 1) * (1 + r() * 5) }
        : { x: 83 + r() * 7, y: 34 + sinal() * r() * 7 }
      if (pas) {
        conducaoEPasse(A, B, tConduz, pas)
        tS = tConduz + Math.max(0.5, dist(B, S) / 19)
        // Cruzamento das alas vai pelo ar.
        if (ala && rng.chance(0.55)) { arco(bola, tConduz, tS, B, S, null, 2.2, 0, 6); cabeca = rng.chance(0.6) } else bola.push({ t: tS, ...S, z: 0 })
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
        conducaoEPasse(A, B, 1.1, pas)
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
      const marcador = pas ?? rng.pick(la.filter((c) => c !== rem && c.pos !== 'GR'))
      S = { x: 95 + r() * 4, y: 34 + sinal() * r() * 5 }
      bola.push({ t: 0, ...C, z: 0 }, { t: 0.9, ...C, z: 0 })
      tS = 0.9 + dist(C, S) / 17
      arco(bola, 0.9, tS, C, S, { x: 100, y: lerp(C.y, S.y, 0.55) }, 4.5, 1.6)
      if (marcador) {
        const aFrente = lado < 0 ? -1 : 1
        fixos.set(marcador.id, [{ t: 0, x: C.x - 2.4, y: C.y - aFrente * 1.6 }, { t: 0.9, x: C.x - 0.6, y: C.y - aFrente * 0.5 }, { t: 1.7, x: C.x - 5, y: C.y - aFrente * 4 }])
      }
      corridaRematador(sinal() * (3 + r() * 3))
      cabeca = true
      g.tRemate = tS
      forcaRemate = 16
      break
    }
    case 'livre': {
      const F = { x: 76 + r() * 7, y: 34 + (l.corredor || sinal()) * (3 + r() * 9) }
      S = F
      bola.push({ t: 0, ...F, z: 0 })
      const lateral = F.y > 34 ? 1 : -1
      fixos.set(rem.id, [{ t: 0, x: F.x - 3.2, y: F.y + lateral * 2 }, { t: 0.9, x: F.x - 3.2, y: F.y + lateral * 2 }, { t: 1.5, x: F.x - 0.7, y: F.y + lateral * 0.3 }])
      g.tRemate = 1.5
      tS = 1.5
      bola.push({ t: g.tRemate, ...F, z: 0 })
      forcaRemate = 24
      // Barreira a 9,15 m, na linha da baliza.
      const golo = { x: COMPRIMENTO, y: 34 }
      const d = dist(F, golo)
      const ux = (golo.x - F.x) / d, uy = (golo.y - F.y) / d
      const W = { x: F.x + ux * 9.15, y: F.y + uy * 9.15 }
      const muro = ld.filter((c) => c !== gr && c !== dfs).sort((a, b) => b.bx - a.bx).slice(0, d < 24 ? 4 : 3)
      muro.forEach((c, i) => {
        const o = (i - (muro.length - 1) / 2) * (RAIO * 2 + 0.1) + lateral * 1.2
        const p = { x: W.x - uy * o, y: W.y + ux * o }
        fixos.set(c.id, [{ t: 0, ...p }, { t: g.tRemate + 0.5, ...p }])
        g.barreira.push(c.id)
      })
      break
    }
    case 'penalti': {
      S = { x: 94, y: 34 }
      bola.push({ t: 0, ...S, z: 0 })
      fixos.set(rem.id, [{ t: 0, x: 89.5, y: 32.5 }, { t: 1.0, x: 89.5, y: 32.5 }, { t: 1.6, x: 93.3, y: 33.8 }])
      g.tRemate = 1.6
      tS = 1.6
      bola.push({ t: g.tRemate, ...S, z: 0 })
      g.foraDaArea = true
      forcaRemate = 25
      break
    }
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
    const atraso = g.contra ? 3.5 : 1.8
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
  const curva = l.origem === 'livre' ? { x: lerp(P.x, 105, 0.5), y: lerp(P.y, 34, 0.5) + (P.y > 34 ? 4 : -4) } : null
  const altura = l.origem === 'livre' ? 2.4 : l.origem === 'longe' ? 1.2 : 0.6
  switch (l.desfecho) {
    case 'golo': {
      const alvo = { x: COMPRIMENTO + 0.3, y: ytiro(true) }
      const t1 = tR + voo(alvo)
      arco(bola, tR, t1, P, alvo, curva, altura, cabeca ? -zIni : 0.6, 6)
      const yRede = (f: number) => clamp(alvo.y + (alvo.y - P.y) * f, POSTES[0] + 0.3, POSTES[1] - 0.3)
      bola.push({ t: t1 + 0.3, x: COMPRIMENTO + 1.7, y: yRede(0.04), z: 0.3 })
      bola.push({ t: t1 + 0.6, x: COMPRIMENTO + 1.9, y: yRede(0.05), z: 0 })
      g.tFim = t1
      if (gr) {
        // Mergulha para o lado certo, mas não chega.
        const lado = alvo.y > 34 ? 1 : -1
        g.mergulho = { ate: { x: 103.9, y: clamp(34 + lado * (1.2 + r() * 1.3), 31, 37) }, t1 }
      }
      break
    }
    case 'defesa': {
      const yk = 34 + sinal() * (0.4 + r() * 2.8)
      const alvo = { x: 103.8, y: yk }
      const t1 = tR + voo(alvo)
      arco(bola, tR, t1, P, alvo, curva, altura, cabeca ? -zIni : 0.3, 6)
      g.mergulho = { ate: alvo, t1 }
      if (rng.chance(0.45)) {
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
  const festa = golo ? { x: 101, y: yRemate < 34 ? 4 : 64 } : null

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
    if (g.foraDaArea && c !== gr && c !== rem) {
      // Fora da área e da meia-lua no penálti.
      x = Math.min(x, 86.5 - (i % 3) * 2.6)
    }
    // Depois do golo: o marcador corre para a bandeirola, os colegas perto vão abraçá-lo.
    if (festa && t > g.tFim + 0.2 && c.lado === rem.lado && c.pos !== 'GR') {
      if (c === rem) return festa
      if (c === pas || (Math.abs(c.bx + 50 - festa.x) < 40 && c.pos !== 'DEF')) return { x: festa.x - 3 - (i % 3) * 1.5, y: festa.y + (festa.y < 34 ? 2 : -2) + (i % 2) * 2 }
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
  let mergulhoIni: { x: number; y: number } | null = null
  for (let k = 0; k < n; k++) {
    const t = k * DT
    const fixo = todos.map(() => false)
    todos.forEach((c, i) => {
      const f = g.fixos.get(c.id)
      if (f && t <= f[f.length - 1].t) {
        const p = interp(f, t)
        pos[i] = { x: p.x, y: p.y }
        fixo[i] = true
        return
      }
      if (c === gr && g.mergulho && t >= g.tRemate) {
        if (!mergulhoIni) mergulhoIni = { ...pos[i] }
        const m = g.mergulho
        const fr = clamp((t - g.tRemate) / Math.max(0.1, m.t1 - g.tRemate), 0, 1)
        pos[i] = { x: lerp(mergulhoIni.x, m.ate.x, fr), y: lerp(mergulhoIni.y, m.ate.y, fr) }
        fixo[i] = true
        return
      }
      const a = alvo(c, i, t)
      const depois = t > g.tFim + 0.3
      const vmax = (c === rem && festa && depois ? 8 : depois ? 4.5 : 7) * DT
      const dx = a.x - pos[i].x, dy = a.y - pos[i].y
      const d = Math.hypot(dx, dy)
      if (d > 0.01) {
        const s = Math.min(vmax, d * 0.35 + 0.02)
        pos[i] = { x: pos[i].x + (dx / d) * s, y: pos[i].y + (dy / d) * s }
      }
    })
    // Afastar caricas que se sobrepõem (os jogadores-chave não se mexem).
    for (let it = 0; it < 2; it++) {
      for (let i = 0; i < todos.length; i++) {
        for (let j = i + 1; j < todos.length; j++) {
          if (fixo[i] && fixo[j]) continue
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
  return quadros
}
