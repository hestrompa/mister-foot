import { useEffect, useRef, useState } from 'react'
import type { Clube, Mundo } from '../core/types'
import type { Lado } from '../core/partida'
import { bolaEm, caricasEm, COMPRIMENTO, LARGURA, POSTES, RAIO, type CenaRepeticao } from '../core/repeticao'
import './repeticao.css'

const MARGEM = 4
const LARG_M = COMPRIMENTO + MARGEM * 2
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
export function Repeticao2D({ cena, mundo, casa, fora, fim, rotuloFim = 'Continuar', velocidade = 1, autoFim = true, outroJogo }: {
  cena: CenaRepeticao; mundo: Mundo; casa: Clube; fora: Clube; fim: () => void; rotuloFim?: string; velocidade?: number; autoFim?: boolean
  /** Quando é a repetição de outro jogo: o resultado desse jogo. */
  outroJogo?: string
}) {
  const tela = useRef<HTMLCanvasElement>(null)
  const caixa = useRef<HTMLDivElement>(null)
  const [vez, setVez] = useState(0)
  const [acabou, setAcabou] = useState(false)
  const fimRef = useRef(fim)
  useEffect(() => { fimRef.current = fim }, [fim])

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
    const medir = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      w = cx.clientWidth
      x0 = w < 640 ? Math.max(-MARGEM, Math.min(52, xMinLance - 10)) : -MARGEM
      const largM = COMPRIMENTO + MARGEM - x0
      h = Math.round((w * ALT_M) / largM)
      cv.width = Math.round(w * dpr)
      cv.height = Math.round(h * dpr)
      cv.style.height = `${h}px`
      esc = (w / largM) * dpr
    }
    medir()
    const X = (x: number) => (x - x0) * esc
    const Y = (y: number) => (y + MARGEM) * esc
    const rasto: { x: number; y: number }[] = []

    const campo = () => {
      const faixas = 12
      for (let i = 0; i < faixas; i++) {
        ctx.fillStyle = i % 2 ? '#2f8a43' : '#2a7f3d'
        ctx.fillRect(X(-MARGEM + (LARG_M / faixas) * i), 0, (LARG_M / faixas) * esc + 1, cv.height)
      }
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

    const carica = (x: number, y: number, fundo: string, borda: string, num: number, destaque: boolean) => {
      const r = Math.max(6 * dpr, RAIO * esc)
      const cxp = X(x), cyp = Y(y)
      // Sombra
      ctx.beginPath(); ctx.arc(cxp + r * 0.18, cyp + r * 0.22, r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill()
      // Borda serrilhada da carica.
      ctx.beginPath()
      const dentes = 21
      for (let i = 0; i <= dentes * 2; i++) {
        const a = (i / (dentes * 2)) * Math.PI * 2
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
      ctx.fillStyle = borda
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
    const desenhar = () => {
      ctx.clearRect(0, 0, cv.width, cv.height)
      campo()
      const ps = caricasEm(cena, t)
      const b = bolaEm(cena, t)
      // Primeiro os de trás, a bola por cima.
      cena.caricas.forEach((c, i) => {
        const [x, y] = ps[i]
        const gr = c.pos === 'GR'
        const [f, bd] = gr ? [corGR(c.lado), '#1b1b1b'] : cores[c.lado]
        carica(x, y, f, bd, c.num, c.id === cena.rematadorId && t < cena.tFim + 0.2)
      })
      rasto.push({ x: b.x, y: b.y })
      if (rasto.length > 9) rasto.shift()
      rasto.forEach((p, i) => {
        ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), Math.max(1.5, 0.35 * esc) * (i / rasto.length), 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${0.35 * (i / rasto.length)})`; ctx.fill()
      })
      const rb = Math.max(3.2, 0.55 * esc) * (1 + b.z * 0.12)
      ctx.beginPath(); ctx.arc(X(b.x + b.z * 0.35), Y(b.y + b.z * 0.45), Math.max(3, 0.55 * esc), 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill()
      ctx.beginPath(); ctx.arc(X(b.x), Y(b.y), rb, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill()
      ctx.strokeStyle = '#222'; ctx.lineWidth = Math.max(1, rb * 0.22); ctx.stroke()
      // Nomes do passe e do remate.
      const iR = cena.caricas.findIndex((c) => c.id === cena.rematadorId)
      if (rem && iR >= 0) etiqueta(ps[iR][0], ps[iR][1], rem.curto)
      if (pas && t < cena.tRemate) {
        const iP = cena.caricas.findIndex((c) => c.id === cena.passadorId)
        if (iP >= 0) etiqueta(ps[iP][0], ps[iP][1], pas.curto)
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
      if (!parado) {
        t += dtR * velocidade
        if (t >= cena.duracao) { t = cena.duracao; parado = true; setAcabou(true) }
      }
      desenhar()
      if (!parado) raf = requestAnimationFrame(passo)
    }
    setAcabou(false)
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
  return (
    <div className="cartao repeticao" data-testid="repeticao">
      <div className="rep-cab">
        <span className="rep-min">{cena.minuto}'</span>
        <span className="rep-tipo">{ORIGEM[cena.origem]} · {lado.sigla}</span>
        {outroJogo && <span className="rep-outro">Noutro jogo: {outroJogo}</span>}
        <span className="rep-texto">{cena.texto}</span>
      </div>
      <div className="rep-tela" ref={caixa}><canvas ref={tela} /></div>
      <div className="rep-botoes">
        <button className="botao" onClick={() => setVez((v) => v + 1)}>Ver outra vez</button>
        <button className="botao principal" onClick={() => fimRef.current()}>{rotuloFim}</button>
      </div>
    </div>
  )
}
