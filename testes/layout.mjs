// Teste de layout: o jogo ao vivo e os separadores cabem no ecrã em vários tamanhos.
// Uso: node testes/layout.mjs [url]   (preview a correr; capturas em $OUT)
// Mede scroll vertical e horizontal do documento durante a jornada ao vivo.
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const URL_BASE = process.argv[2] || 'http://localhost:4173/'
const OUT = process.env.OUT || join(tmpdir(), 'mister-foot-layout')
mkdirSync(OUT, { recursive: true })

const TAMANHOS = [
  ['pc-1920x1080', 1920, 1080], ['pc-1366x768', 1366, 768], ['pc-1280x720', 1280, 720],
  ['tablet-1024x768', 1024, 768], ['tablet-768x1024', 768, 1024],
  ['tel-390x844', 390, 844], ['tel-844x390', 844, 390], ['tel-360x640', 360, 640],
]
const falhas = []
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const page = await ctx.newPage()
const erros = []
page.on('pageerror', (e) => erros.push(e.message))
await page.goto(URL_BASE, { waitUntil: 'networkidle' })
await page.getByPlaceholder('Mister').fill('Teste')
await page.getByPlaceholder('aleatória').fill('2027')
await page.getByRole('button', { name: 'Gerar mundo' }).click()
await page.locator('button.cartao.clube').first().click()
await page.getByRole('button', { name: 'Assinar contrato' }).click()
for (const t of ['Arrancar a época', 'Começar a época']) {
  const b = page.getByRole('button', { name: t }); if (await b.count()) await b.first().click().catch(() => {})
}
const medir = () => page.evaluate(() => {
  const d = document.documentElement
  return { sh: d.scrollHeight, ih: innerHeight, sw: d.scrollWidth, iw: innerWidth }
})
// Cada separador em cada tamanho: a página nunca faz scroll; regista quanto o conteúdo transborda.
const SEPS = ['Jogo', 'Plantel', 'Balneário', 'Staff', 'Mercado', 'Taça', 'Europa', 'Classificação', 'Calendário', 'Clube', 'Carreira', 'Divisões', 'Imprensa', 'História']
const transborda = []
for (const [nome, w, h] of TAMANHOS) {
  await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(150)
  for (const sep of SEPS) {
    await page.locator('.principal-nav button').filter({ hasText: new RegExp(`^${sep}( \\(.*\\))?$`) }).first().click()
    await page.waitForTimeout(120)
    const m = await medir()
    const c = await page.evaluate(() => { const e = document.querySelector('.conteudo'); return e ? e.scrollHeight - e.clientHeight : -1 })
    const tapa = await page.evaluate(() => {
      // a barra de ação não pode tapar conteúdo quando o painel está no fim
      const b = document.querySelector('.barra-acao'); if (!b) return false
      const r = b.getBoundingClientRect(); return r.bottom > innerHeight + 1
    })
    if (sep === 'Jogo' || sep === 'Plantel' || sep === 'Classificação') await page.screenshot({ path: join(OUT, `sep-${sep.normalize('NFD').replace(/[^a-zA-Z]/g, '').toLowerCase()}-${nome}.png`) })
    if (m.sh > m.ih + 1 || m.sw > m.iw + 1 || tapa) falhas.push(`${nome} ${sep}: página ${m.sw}x${m.sh} em ${m.iw}x${m.ih}${tapa ? ' barra fora do ecrã' : ''}`)
    transborda.push(`${nome.padEnd(16)} ${sep.padEnd(14)} conteúdo a mais: ${c}px`)
  }
  await page.locator('.principal-nav button').filter({ hasText: /^Jogo/ }).first().click()
}
if (process.env.DETALHE) console.log(transborda.join('\n'))
await page.setViewportSize({ width: 1280, height: 800 })
await page.getByRole('button', { name: 'Jogar jornada' }).click()
await page.getByTestId('campo-vivo').or(page.getByTestId('repeticao')).first().waitFor({ timeout: 8000 })
const campo = () => page.evaluate(() => {
  const c = document.querySelector('.lv-palco canvas'); const p = document.querySelector('.lv-palco')
  if (!c || !p) return null
  const a = c.getBoundingClientRect(), b = p.getBoundingClientRect()
  return { cw: Math.round(a.width), ch: Math.round(a.height), pw: Math.round(b.width), ph: Math.round(b.height), dentro: a.bottom <= b.bottom + 1 && a.right <= b.right + 1 }
})
for (const fase of ['jogo', 'pausa']) {
  if (fase === 'pausa') {
    await page.setViewportSize({ width: 1280, height: 800 }); await page.waitForTimeout(300)
    await page.getByTestId('repeticao').getByRole('button', { name: 'Continuar' }).click({ timeout: 1000 }).catch(() => {})
    await page.getByRole('button', { name: 'Pausa' }).click({ timeout: 30000 })
  }
  for (const [nome, w, h] of TAMANHOS) {
    await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(500)
    const m = await medir(), c = fase === 'jogo' ? await campo() : null
    await page.screenshot({ path: join(OUT, `vivo-${fase}-${nome}.png`) })
    const mal = m.sh > m.ih + 1 || m.sw > m.iw + 1 || (c && !c.dentro)
    const tag = `${fase} ${nome}: altura ${m.sh}/${m.ih} largura ${m.sw}/${m.iw}${c ? ` campo ${c.cw}x${c.ch} em ${c.pw}x${c.ph}` : ''}`
    console.log((mal ? 'MAL    ' : 'ok     ') + tag)
    if (mal) falhas.push(tag)
  }
}
await browser.close()
if (erros.length) { console.log('Erros:', erros); process.exitCode = 1 }
if (falhas.length) { console.log('Falhas:\n ' + falhas.join('\n ')); process.exitCode = 1 } else console.log('Tudo bem.')
