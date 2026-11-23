import { useEffect, useRef, useState } from 'react'
import type { Clube, Mundo } from '../core/types'
import type { Lado } from '../core/partida'
import { bolaEm, caricasEm, COMPRIMENTO, LARGURA, POSTES, RAIO, type CenaRepeticao } from '../core/repeticao'
import './repeticao.css'

const MARGEM = 4
const ALT_M = LARGURA + MARGEM * 2

const ORIGEM: Record<CenaRepeticao['origem'], string> = {
  jogada: 'Jogada', contra: 'Contra-ataque', canto: 'Canto', livre: 'Livre direto', penalti: 'Penálti', longe: 'Remate de longe',
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function parecidas(a: string, b: string, limite = 110): boolean {
  const [r1, g1, b1] = rgb(a), [r2, g2, b2] = rgb(b)
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2) < limite
}
function claro(hex: string): boolean {
  const [r, g, b] = rgb(hex)
  return r * 0.3 + g * 0.59 + b * 0.11 > 150
}

/** Cores das caricas: o visitante troca de equipamento se for parecido com o da casa. */
export function coresJogo(casa: Clube, fora: Clube): Record<Lado, [string, string]> {
  let f: [string, string] = [fora.cores[0], fora.cores[1]]
  if (parecidas(f[0], casa.cores[0])) f = [fora.cores[1], fora.cores[0]]
  if (parecidas(f[0], casa.cores[0])) f = claro(casa.cores[0]) ? ['#20242c', '#f4f4f4'] : ['#f4f4f4', '#20242c']
  return { casa: [casa.cores[0], casa.cores[1]], fora: f }
}

/**
 * Repetição de um lance em caricas, vista de cima. Toca sozinha; `fim` é chamado quando acaba
 * (ou ao carregar em "Continuar"/"Saltar").
 */
export function Repeticao2D({ cena, mundo, casa, fora, fim, rotuloFim = 'Continuar', velocidade = 1, autoFim = true, outroJogo, emDireto = false, revelar }: {
  cena: CenaRepeticao; mundo: Mundo; casa: Clube; fora: Clube; fim: () => void; rotuloFim?: string; velocidade?: number; autoFim?: boolean
  /** Em direto: o desfecho só aparece quando a bola chega ao fim (`revelar` é chamado nesse instante). */
  emDireto?: boolean
  revelar?: () => void
  /** Quando é a repetição de outro jogo: o resultado desse jogo. */
  outroJogo?: string
}) {
  const tela = useRef<HTMLCanvasElement>(null)
  const caixa = useRef<HTMLDivElement>(null)
  const [vez, setVez] = useState(0)
  const [acabou, setAcabou] = useState(false)
  const fimRef = useRef(fim)
  useEffect(() => { fimRef.current = fim }, [fim])
  const revelarRef = useRef(revelar)
  useEffect(() => { revelarRef.current = revelar }, [revelar])
  /** 0 = lance a decorrer, 1 = já houve a falta do penálti, 2 = desfecho conhecido. */
  const [direto] = useState(emDireto)
  const rotRef = useRef(new Map<number, number>())
  const antRef = useRef(new Map<number, [number, number]>())
  const arbRef = useRef<{ x: number; y: number } | null>(null)
  const [marco, setMarco] = useState(emDireto ? 0 : 2)
  const marcoRef = useRef(marco)

  useEffect(() => {
    const cv = tela.current, cx = caixa.current
    if (!cv || !cx) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const cores = coresJogo(casa, fora)
    const atac = cena.atacante
    // Guarda-redes com cor própria.
    const corGR = (lado: Lado) => (parecidas(cores[lado][0], '#e8c547', 170) ? '#5ec46a' : '#e8c547')
    const rem = mundo.jogadores[cena.rematadorId]
    const pas = cena.passadorId != null ? mundo.jogadores[cena.passadorId] : undefined
    let w = 0, h = 0, esc = 1, dpr = 1
    // Em ecrãs estreitos mostra-se só a parte do campo onde o lance acontece (caricas maiores).
    const xMinLance = Math.min(...cena.bola.map((p) => p.x))
    let x0 = -MARGEM
    const esp = cena.espelhar === true
    const medir = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      w = cx.clientWidth
      // Janela visível em coordenadas do ecrã (depois de rodar o campo, se for o caso).
      const corte = w < 640 && !cena.ambiente ? Math.max(-MARGEM, Math.min(52, xMinLance - 10)) : -MARGEM
      x0 = esp ? -MARGEM : corte
      const x1 = esp ? COMPRIMENTO - corte : COMPRIMENTO + MARGEM
      const largM = x1 - x0
      h = Math.round((w * ALT_M) / largM)
      cv.width = Math.round(w * dpr)
      cv.height = Math.round(h * dpr)
      cv.style.height = `${h}px`
      esc = (w / largM) * dpr
    }
    medir()
    // SX/SY: ecrã (o campo é simétrico); X/Y: posições do lance, rodadas 180° quando a equipa ataca para a esquerda.
    const SX = (x: number) => (x - x0) * esc
    const SY = (y: number) => (y + MARGEM) * esc
    const X = (x: number) => SX(esp ? COMPRIMENTO - x : x)
    const Y = (y: number) => SY(esp ? LARGURA - y : y)
    const rasto: { x: number; y: number }[] = []
    // Relvado pintado uma vez por tamanho (riscas do corte, manchas, sombra nos cantos).
    let relva: HTMLCanvasElement | null = null
    const pintarRelva = () => {
      const c = document.createElement('canvas')
      c.width = cv.width; c.height = cv.height
      const g = c.getContext('2d')
      if (!g) return null
      g.fillStyle = '#1d5e2e'; g.fillRect(0, 0, c.width, c.height)
      const faixas = 14, lf = COMPRIMENTO / faixas
      for (let i = -1; i <= faixas; i++) {
        const xa = SX(lf * i), xb = SX(lf * (i + 1))
        const gr = g.createLinearGradient(xa, 0, xb, 0)
        const base = i % 2 ? [47, 139, 67] : [41, 126, 60]
        gr.addColorStop(0, `rgb(${base[0] - 2},${base[1] - 3},${base[2] - 2})`)
        gr.addColorStop(0.5, `rgb(${base[0] + 2},${base[1] + 3},${base[2] + 1})`)
        gr.addColorStop(1, `rgb(${base[0] - 2},${base[1] - 3},${base[2] - 2})`)
        g.fillStyle = gr
        g.fillRect(xa, SY(-1.5), xb - xa + 1, (LARGURA + 3) * esc)
      }
      // Manchas de relva (sempre as mesmas: semente fixa).
      let sm = 12345
      const rnd = () => { sm = (sm * 1103515245 + 12345) >>> 0; return sm / 4294967296 }
      const n = Math.round((c.width * c.height) / 260)
      for (let i = 0; i < n; i++) {
        const x = rnd() * c.width, y = rnd() * c.height
        g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.05)'
        g.fillRect(x, y, 1.5 * dpr, 1.5 * dpr)
      }
      // Placas de publicidade à volta.
      const placa = (y0: number, yl: number) => {
        g.fillStyle = '#121820'
        g.fillRect(0, SY(y0), c.width, yl * esc)
        g.font = `800 ${Math.round(yl * esc * 0.62)}px system-ui, sans-serif`
        g.textBaseline = 'middle'; g.textAlign = 'center'
        const nomes = [casa.sigla, 'MISTER-FOOT', fora.sigla]
        const passo = Math.max(80 * dpr, yl * esc * 9)
        for (let x = passo / 2, k = 0; x < c.width; x += passo, k++) {
          const cor = k % 3 === 1 ? '#3ddc84' : k % 3 === 0 ? cores.casa[0] : cores.fora[0]
          const [r1, g1, b1] = rgb(cor)
          g.fillStyle = r1 * 0.3 + g1 * 0.59 + b1 * 0.11 < 70 ? '#e8e8e8' : cor
          g.fillText(nomes[k % 3], x, SY(y0 + yl / 2))
        }
      }
      placa(-MARGEM, 1.6)
      placa(LARGURA + MARGEM - 1.6, 1.6)
      // Vinheta suave.
      const v = g.createRadialGradient(c.width / 2, c.height / 2, c.height * 0.3, c.width / 2, c.height / 2, c.width * 0.75)
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.22)')
      g.fillStyle = v; g.fillRect(0, 0, c.width, c.height)
      return c
    }
    // Rotação de cada carica (rola quando corre) e posição anterior.
    // Guardados entre cenas (o campo ao vivo troca de cena a cada minuto).
    const rot = rotRef.current
    const ant = antRef.current
    // Árbitro: segue a bola com atraso, sem entrar no lance.
    let arb = arbRef.current

    const campo = () => {
      const X = SX, Y = SY
      if (!cv.width || !cv.height) return
      if (!relva || relva.width !== cv.width || relva.height !== cv.height) relva = pintarRelva()
      if (relva && relva.width && relva.height) ctx.drawImage(relva, 0, 0)
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'
      ctx.lineWidth = Math.max(1, 0.18 * esc)
      ctx.strokeRect(X(0), Y(0), COMPRIMENTO * esc, LARGURA * esc)
      ctx.beginPath(); ctx.moveTo(X(52.5), Y(0)); ctx.lineTo(X(52.5), Y(68)); ctx.stroke()
      ctx.beginPath(); ctx.arc(X(52.5), Y(34), 9.15 * esc, 0, Math.PI * 2); ctx.stroke()
      for (const lado of [0, 1]) {
        const x0 = lado ? COMPRIMENTO : 0, s = lado ? -1 : 1
        ctx.strokeRect(X(lado ? x0 - 16.5 : x0), Y(34 - 20.16), 16.5 * esc, 40.32 * esc)
        ctx.strokeRect(X(lado ? x0 - 5.5 : x0), Y(34 - 9.16), 5.5 * esc, 18.32 * esc)
        ctx.beginPath(); ctx.arc(X(x0 + s * 11), Y(34), 0.3 * esc, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill()
        ctx.beginPath()
        const a = Math.acos(5.5 / 9.15)
        if (lado) ctx.arc(X(x0 - 11), Y(34), 9.15 * esc, Math.PI - a, Math.PI + a)
        else ctx.arc(X(x0 + 11), Y(34), 9.15 * esc, -a, a)
        ctx.stroke()
        // Baliza com rede.
        const gx = lado ? X(x0) : X(x0 - 2)
        ctx.fillStyle = 'rgba(255,255,255,0.18)'
        ctx.fillRect(gx, Y(POSTES[0]), 2 * esc, (POSTES[1] - POSTES[0]) * esc)
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'
        ctx.lineWidth = Math.max(0.5, 0.06 * esc)
        for (let yy = POSTES[0]; yy <= POSTES[1]; yy += 0.7) { ctx.beginPath(); ctx.moveTo(gx, Y(yy)); ctx.lineTo(gx + 2 * esc, Y(yy)); ctx.stroke() }
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = Math.max(1.5, 0.25 * esc)
        ctx.strokeRect(gx, Y(POSTES[0]), 2 * esc, (POSTES[1] - POSTES[0]) * esc)
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'
        ctx.lineWidth = Math.max(1, 0.18 * esc)
      }
    }

    const carica = (x: number, y: number, fundo: string, borda: string, num: number | string, destaque: boolean, giro = 0, vel = 0) => {
      const r = Math.max(6 * dpr, RAIO * esc)
      const cxp = X(x), cyp = Y(y)
      // Sombra: a correr, a carica "levanta" um pouco e a sombra afasta-se.
      const lev = Math.min(1, vel / 7)
      ctx.beginPath(); ctx.arc(cxp + r * (0.18 + lev * 0.2), cyp + r * (0.22 + lev * 0.25), r * (1 - lev * 0.06), 0, Math.PI * 2); ctx.fillStyle = `rgba(0,0,0,${0.3 - lev * 0.08})`; ctx.fill()
      // Borda serrilhada da carica (roda quando corre).
      ctx.beginPath()
      const dentes = 21
      for (let i = 0; i <= dentes * 2; i++) {
        const a = (i / (dentes * 2)) * Math.PI * 2 + giro
        const rr = i % 2 ? r : r * 0.9
        const px = cxp + Math.cos(a) * rr, py = cyp + Math.sin(a) * rr
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py)
      }
      ctx.closePath()
      ctx.fillStyle = borda; ctx.fill()
      ctx.beginPath(); ctx.arc(cxp, cyp, r * 0.74, 0, Math.PI * 2); ctx.fillStyle = fundo; ctx.fill()
      // Brilho
      ctx.beginPath(); ctx.arc(cxp - r * 0.25, cyp - r * 0.28, r * 0.32, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fill()
      if (destaque) { ctx.beginPath(); ctx.arc(cxp, cyp, r * 1.35, 0, Math.PI * 2); ctx.strokeStyle = '#ffe066'; ctx.lineWidth = Math.max(1.5, r * 0.18); ctx.stroke() }
      // Número com contraste: a cor da borda se se ler bem, senão branco ou preto.
      const lum = (c: string) => { const [r1, g1, b1] = rgb(c); return r1 * 0.3 + g1 * 0.59 + b1 * 0.11 }
      ctx.fillStyle = Math.abs(lum(fundo) - lum(borda)) > 110 ? borda : claro(fundo) ? '#111' : '#fff'
      ctx.font = `700 ${Math.round(r * 0.95)}px system-ui, sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(String(num), cxp, cyp + r * 0.04)
    }

    const etiqueta = (x: number, y: number, txt: string) => {
      const r = Math.max(6 * dpr, RAIO * esc)
      ctx.font = `600 ${Math.max(10, Math.round(r * 0.95))}px system-ui, sans-serif`
      const tw = ctx.measureText(txt).width
      const px = X(x), py = Y(y) - r * 1.9
      ctx.fillStyle = 'rgba(10,14,20,0.72)'
      ctx.fillRect(px - tw / 2 - 4, py - r * 0.7, tw + 8, r * 1.4)
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(txt, px, py)
    }

    let t = 0, ultimo = performance.now(), raf = 0, parado = false
    let dtDesenho = 0, giroBola = 0
    let bAnt: { x: number; y: number } | null = null
    const desenhar = () => {
      if (!cv.width || !cv.height) return
      ctx.clearRect(0, 0, cv.width, cv.height)
      campo()
      const ps = caricasEm(cena, t)
      const b = bolaEm(cena, t)
      // Rasto do carrinho na relva.
      for (const f of cena.acoes ?? []) {
        if (t < f.t - 0.3 || t > f.t + 2) continue
        const fr = Math.min(1, Math.max(0, (t - (f.t - 0.3)) / 0.4))
        ctx.save()
        ctx.globalAlpha = t > f.t + 1.4 ? Math.max(0, (f.t + 2 - t) / 0.6) : 1
        ctx.strokeStyle = 'rgba(120, 80, 40, 0.55)'
        ctx.lineCap = 'round'
        ctx.lineWidth = Math.max(3, RAIO * 1.1 * esc)
        ctx.beginPath(); ctx.moveTo(X(f.de.x), Y(f.de.y))
        ctx.lineTo(X(f.de.x + (f.ate.x - f.de.x) * fr), Y(f.de.y + (f.ate.y - f.de.y) * fr)); ctx.stroke()
        ctx.restore()
      }
      // Quanto cada carica andou desde o último desenho (para rodar e "levantar").
      const vels = ps.map((p, i) => {
        const id = cena.caricas[i].id
        const a = ant.get(id)
        ant.set(id, p)
        if (!a || dtDesenho <= 0) return 0
        const d = Math.hypot(p[0] - a[0], p[1] - a[1])
        if (d > 4) return 0 // corte de plano
        rot.set(id, (rot.get(id) ?? 0) + (d / RAIO) * 0.5 * (i % 2 ? 1 : -1))
        return d / dtDesenho
      })
      // Árbitro: atrás do lance, na diagonal, sem chocar com ninguém.
      const dArb = cena.ambiente && cena.atacante === 'fora' ? -1 : 1
      const alvoArb = { x: Math.max(13, Math.min(b.x - 9 * dArb, 92)), y: b.y < 34 ? Math.min(66, b.y + 11) : Math.max(2, b.y - 11) }
      if (!arb || dtDesenho <= 0 || Math.hypot(alvoArb.x - arb.x, alvoArb.y - arb.y) > 40) arb = { ...alvoArb }
      else {
        const dx = alvoArb.x - arb.x, dy = alvoArb.y - arb.y, d = Math.hypot(dx, dy)
        const passo = Math.min(d, 6.5 * dtDesenho)
        if (d > 0.01) arb = { x: arb.x + (dx / d) * passo, y: arb.y + (dy / d) * passo }
      }
      arbRef.current = arb
      carica(arb.x, arb.y, '#15181d', '#f2d200', 'A', false, t * 2, 3)
      // Primeiro os de trás, a bola por cima.
      cena.caricas.forEach((c, i) => {
        const [x, y] = ps[i]
        const gr = c.pos === 'GR'
        const [f, bd] = gr ? [corGR(c.lado), '#1b1b1b'] : cores[c.lado]
        carica(x, y, f, bd, c.num, !cena.ambiente && c.id === cena.rematadorId && t < cena.tFim + 0.2, rot.get(c.id) ?? 0, vels[i])
      })
      rasto.push({ x: b.x, y: b.y })
      if (rasto.length > 14) rasto.shift()
      if (rasto.length > 2) {
        ctx.save()
        ctx.lineCap = 'round'
        for (let i = 1; i < rasto.length; i++) {
          const f = i / rasto.length
          ctx.strokeStyle = `rgba(255,255,255,${(0.4 * f).toFixed(3)})`
          ctx.lineWidth = Math.max(1, 0.5 * esc * f)
          ctx.beginPath(); ctx.moveTo(X(rasto[i - 1].x), Y(rasto[i - 1].y)); ctx.lineTo(X(rasto[i].x), Y(rasto[i].y)); ctx.stroke()
        }
        ctx.restore()
      }
      const rb = Math.max(3.2, 0.55 * esc) * (1 + b.z * 0.12)
      ctx.beginPath(); ctx.arc(X(b.x + b.z * 0.35), Y(b.y + b.z * 0.45), Math.max(3, 0.55 * esc), 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill()
      ctx.beginPath(); ctx.arc(X(b.x), Y(b.y), rb, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill()
      ctx.strokeStyle = '#222'; ctx.lineWidth = Math.max(1, rb * 0.22); ctx.stroke()
      // Gomos da bola a rodar.
      giroBola += Math.hypot(b.x - (bAnt?.x ?? b.x), b.y - (bAnt?.y ?? b.y)) * 1.6
      bAnt = b
      ctx.fillStyle = '#2a2a2a'
      for (let k = 0; k < 3; k++) {
        const a = giroBola + (k * Math.PI * 2) / 3
        ctx.beginPath(); ctx.arc(X(b.x) + Math.cos(a) * rb * 0.45, Y(b.y) + Math.sin(a) * rb * 0.45, rb * 0.22, 0, Math.PI * 2); ctx.fill()
      }
      // Golo: a rede estica onde a bola entrou.
      if (cena.desfecho === 'golo' && t > cena.tFim && t < cena.tFim + 1.4) {
        const f = Math.sin(Math.min(1, (t - cena.tFim) / 1.4) * Math.PI)
        ctx.save()
        ctx.strokeStyle = `rgba(255,255,255,${(0.7 * f).toFixed(3)})`
        ctx.lineWidth = Math.max(1, 0.12 * esc)
        ctx.beginPath()
        ctx.ellipse(X(COMPRIMENTO + 1.8), Y(b.y), 0.9 * esc * f + 1, 2.2 * esc, 0, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }
      // Nomes do passe e do remate.
      const iR = cena.caricas.findIndex((c) => c.id === cena.rematadorId)
      if (rem && iR >= 0) etiqueta(ps[iR][0], ps[iR][1], rem.curto)
      if (pas && t < cena.tRemate) {
        const iP = cena.caricas.findIndex((c) => c.id === cena.passadorId)
        if (iP >= 0) etiqueta(ps[iP][0], ps[iP][1], pas.curto)
      }
      // "Finta!" por cima de quem a faz.
      for (const f of cena.acoes ?? []) {
        if (t < f.t - 0.15 || t > f.t + 0.8) continue
        const iA = cena.caricas.findIndex((c) => c.id === f.autorId)
        if (iA < 0) continue
        const r = Math.max(6 * dpr, RAIO * esc)
        ctx.save()
        ctx.font = `800 ${Math.round(r * 1.2)}px system-ui, sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.lineWidth = Math.max(2, r * 0.25); ctx.strokeStyle = '#10141a'; ctx.fillStyle = '#ffe066'
        const sobe = (t - f.t) * r * 1.5
        ctx.strokeText('Finta!', X(ps[iA][0]), Y(ps[iA][1]) + r * 3 - sobe)
        ctx.fillText('Finta!', X(ps[iA][0]), Y(ps[iA][1]) + r * 3 - sobe)
        ctx.restore()
      }
      // Falta que dá penálti: apito e "Penálti!".
      for (const f of cena.acoes ?? []) {
        if (f.tipo !== 'falta' || t < f.t || t > (cena.cortes?.[0] ?? f.t + 1.2)) continue
        const iV = cena.caricas.findIndex((c) => c.id === f.vitimaId)
        if (iV < 0) continue
        const r = Math.max(6 * dpr, RAIO * esc)
        ctx.save()
        ctx.font = `800 ${Math.round(r * 1.5)}px system-ui, sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.lineWidth = Math.max(2, r * 0.3); ctx.strokeStyle = '#10141a'; ctx.fillStyle = '#ff6b5e'
        ctx.strokeText('Penálti!', X(ps[iV][0]), Y(ps[iV][1]) + r * 3.2)
        ctx.fillText('Penálti!', X(ps[iV][0]), Y(ps[iV][1]) + r * 3.2)
        ctx.restore()
      }
      // Corte para a marcação: escurece e volta.
      for (const tc of cena.cortes ?? []) {
        const d = Math.abs(t - tc)
        if (d > 0.35) continue
        ctx.fillStyle = `rgba(6,10,14,${(1 - d / 0.35).toFixed(3)})`
        ctx.fillRect(0, 0, cv.width, cv.height)
      }
      // Grande "GOLO!" no fim.
      if (cena.desfecho === 'golo' && t > cena.tFim) {
        const f = Math.min(1, (t - cena.tFim) / 0.35)
        ctx.save()
        ctx.globalAlpha = f
        ctx.font = `900 ${Math.round(Math.min(cv.width * 0.16, cv.height * 0.2) * (0.8 + 0.2 * f))}px system-ui, sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.lineWidth = Math.max(3, cv.height * 0.012)
        ctx.strokeStyle = cores[atac][1]
        ctx.fillStyle = cores[atac][0]
        ctx.strokeText('GOLO!', cv.width / 2, cv.height / 2)
        ctx.fillText('GOLO!', cv.width / 2, cv.height / 2)
        ctx.restore()
      }
    }
    const passo = (agora: number) => {
      const dtR = Math.min(0.05, (agora - ultimo) / 1000)
      ultimo = agora
      dtDesenho = parado ? 0 : dtR * velocidade
      if (!parado) {
        t += dtR * velocidade
        const falta = cena.acoes?.find((a) => a.tipo === 'falta')
        const m = t >= cena.tFim ? 2 : falta && t >= falta.t ? 1 : 0
        if (m > marcoRef.current) {
          marcoRef.current = m
          setMarco(m)
          if (m === 2) revelarRef.current?.()
        }
        if (t >= cena.duracao) { t = cena.duracao; parado = true; setAcabou(true) }
      }
      desenhar()
      if (!parado) raf = requestAnimationFrame(passo)
    }
    setAcabou(false)
    if (marcoRef.current === 2) setMarco(2)
    raf = requestAnimationFrame(passo)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { medir(); if (parado) desenhar() }) : null
    ro?.observe(cx)
    return () => { cancelAnimationFrame(raf); ro?.disconnect() }
  }, [cena, mundo, casa, fora, vez, velocidade])

  // Depois de acabar, segue sozinha ao fim de um instante.
  useEffect(() => {
    if (!acabou || !autoFim) return
    const t = setTimeout(() => fimRef.current(), 900)
    return () => clearTimeout(t)
  }, [acabou, autoFim])

  const lado = cena.atacante === 'casa' ? casa : fora
  const TEASER: Record<CenaRepeticao['origem'], string> = {
    jogada: `Ataque perigoso do ${lado.nome}...`, contra: `Contra-ataque do ${lado.nome}!`, canto: `Canto para o ${lado.nome}...`,
    livre: `Livre perigoso para o ${lado.nome}...`, longe: `O ${lado.nome} arrisca de longe...`, penalti: `O ${lado.nome} entra na área...`,
  }
  const tipo = cena.origem === 'penalti' && marco === 0 ? 'Jogada' : ORIGEM[cena.origem]
  const texto = marco === 2 ? cena.texto : cena.origem === 'penalti' && marco === 1 ? `Penálti para o ${lado.nome}!` : TEASER[cena.origem]
  if (cena.ambiente) {
    return (
      <div className="cartao campo-vivo" data-testid="campo-vivo">
        <div className="rep-tela" ref={caixa}><canvas ref={tela} /></div>
      </div>
    )
  }
  return (
    <div className="cartao repeticao" data-testid="repeticao">
      <div className="rep-cab">
        <span className="rep-min">{cena.minuto}'</span>
        {direto && <span className="rep-direto">{marco === 2 ? 'Repetição' : 'Em direto'}</span>}
        <span className="rep-tipo">{tipo} · {lado.sigla}</span>
        {outroJogo && <span className="rep-outro">Noutro jogo: {outroJogo}</span>}
        <span className="rep-texto">{texto}</span>
      </div>
      <div className="rep-tela" ref={caixa}><canvas ref={tela} /></div>
      <div className="rep-botoes">
        <button className="botao" onClick={() => setVez((v) => v + 1)}>Ver outra vez</button>
        <button className="botao principal" onClick={() => fimRef.current()}>{rotuloFim}</button>
      </div>
    </div>
  )
}
