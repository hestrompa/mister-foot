// Maratona: joga várias épocas seguidas no browser, sempre pelo caminho que um jogador faria
// (jornadas, taça, Supertaça, Europa, conferências, fim de época), e para se algum ecrã ficar preso.
// Uso: node testes/maratona.mjs [url]   variáveis: EPOCAS (2), SEMENTE (77), DIV (4), PAIS (Espanha/Inglaterra: DIV 1-2 desse país), SO_PT=1 (sem campeonatos estrangeiros), MOVEL=1 (390x844), OUT
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const URL_BASE = process.argv[2] || 'http://localhost:4173/'
const OUT = process.env.OUT || './maratona'
const EPOCAS = Number(process.env.EPOCAS || 2)
const SEMENTE = process.env.SEMENTE || '77'
const DIV = process.env.DIV || '4'
const PAIS = process.env.PAIS || ''
const MOVEL = process.env.MOVEL === '1'
mkdirSync(OUT, { recursive: true })

const erros = []
const registo = []
const log = (s) => { registo.push(s); console.log(s) }
const SEPARADORES = ['Plantel', 'Balneário', 'Staff', 'Mercado', 'Taça', 'Europa', 'Classificação', 'Calendário', 'Clube', 'Carreira', 'Divisões', 'Imprensa', 'História']

const browser = await chromium.launch()
let falhou = ''
try {
  const ctx = await browser.newContext(MOVEL
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true }
    : { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  page.on('console', (m) => { if (m.type() === 'error') erros.push(`console: ${m.text()}`) })
  page.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`))
  page.on('dialog', (d) => d.accept())
  const foto = (f) => page.screenshot({ path: join(OUT, f), fullPage: true })
  const visivel = async (loc) => (await loc.count()) > 0 && (await loc.first().isVisible().catch(() => false))
  const clicar = async (loc) => { await loc.first().click({ timeout: 3000 }) }

  await page.goto(URL_BASE, { waitUntil: 'networkidle' })
  await page.getByPlaceholder('Mister').fill('Maratona')
  await page.getByPlaceholder('aleatória').fill(SEMENTE)
  if (process.env.SO_PT === '1') await page.getByTestId('estrangeiros').uncheck()
  await page.getByRole('button', { name: 'Gerar mundo' }).click()
  await page.getByText('Escolhe o teu clube').first().waitFor({ timeout: 10000 })
  if (PAIS) await page.locator('nav[aria-label="Países"] button', { hasText: PAIS }).click()
  if (PAIS || DIV !== '4') await page.locator('nav[aria-label="Divisões"] button').nth(Number(DIV) - 1).click()
  await page.locator('button.cartao.clube').first().click()
  await page.getByRole('button', { name: 'Assinar contrato' }).click()

  let epocas = 0
  let parado = 0
  let ultimo = ''
  let jogos = 0
  const t0 = Date.now()
  const tempos = []
  let tJogo = Date.now()
  for (let it = 0; it < 20000 && epocas < EPOCAS; it++) {
    // Ordem de prioridade: o que um jogador faria a seguir.
    const simSaltar = page.getByRole('button', { name: 'Sim, saltar' })
    const saltar = page.getByRole('button', { name: 'Saltar para o fim' })
    const novaEpoca = page.getByRole('button', { name: 'Começar nova época' })
    const conf = page.locator('.im-conf .im-opcao')
    const pre = page.locator('.pre-epoca .pe-opcao')
    const continuar = page.getByRole('button', { name: 'Continuar', exact: true })
    const jogar = page.getByRole('button', { name: /^Jogar/ })
    const aceitar = page.getByRole('button', { name: 'Aceitar', exact: true })
    try {
      if (await visivel(simSaltar)) { await clicar(simSaltar); continue }
      if (await visivel(saltar)) { await page.waitForTimeout(400); await clicar(saltar); continue }
      if (await visivel(novaEpoca)) {
        epocas++
        const txt = await page.locator('.fim-epoca .destaque').innerText()
        log(`Fim de época ${epocas}: ${txt.replace(/\s+/g, ' ')} (${Math.round((Date.now() - t0) / 1000)} s)`)
        await foto(`fim-epoca-${epocas}.png`)
        await clicar(novaEpoca)
        continue
      }
      if (await visivel(continuar)) {
        tempos.push(Date.now() - tJogo); tJogo = Date.now(); jogos++
        await clicar(continuar)
        // De vez em quando abre todos os separadores (apanha ecrãs que rebentam a meio da época).
        if (jogos % 9 === 0) {
          await page.waitForTimeout(200)
          for (const s of SEPARADORES) {
            const b = page.getByRole('button', { name: new RegExp(`^${s}( \\((\\d+|!)\\))?$`) })
            if (await visivel(b)) await clicar(b)
          }
          await clicar(page.getByRole('button', { name: 'Jogo', exact: true }))
        }
        continue
      }
      if (await visivel(conf)) { await clicar(conf.nth(it % 3)); continue }
      if (await visivel(pre)) { await clicar(pre); continue }
      if (await visivel(jogar)) {
        if (await jogar.first().isDisabled()) {
          parado++
        } else {
          const nome = await jogar.first().innerText()
          const cab = await page.locator('.pj-cab').first().innerText().catch(() => '')
          if (nome !== 'Jogar jornada') log(`  ${nome}: ${cab.replace(/\s+/g, ' ')}`)
          await clicar(jogar)
          tJogo = Date.now()
          continue
        }
      } else if (await visivel(aceitar) && (await page.locator('.despedido, [data-testid=despedido]').count())) {
        log('  Despedido: aceitar oferta')
        await clicar(aceitar)
        continue
      } else {
        parado++
      }
    } catch (e) {
      parado++
    }
    const agora = (await page.locator('body').innerText().catch(() => '')).slice(0, 4000)
    if (agora !== ultimo) { ultimo = agora; if (parado > 0) parado = Math.min(parado, 1) }
    if (parado >= 40) {
      falhou = 'ecrã preso'
      await foto('preso.png')
      writeFileSync(join(OUT, 'preso.txt'), agora)
      writeFileSync(join(OUT, 'preso-gravacao.json'), await page.evaluate(() => localStorage.getItem('mister-foot:jogo') ?? ''))
      log(`PRESO depois de ${epocas} épocas e ${jogos} jogos. Texto em ${join(OUT, 'preso.txt')}`)
      break
    }
    await page.waitForTimeout(250)
  }
  tempos.sort((a, b) => a - b)
  log(`Jogos: ${jogos}, tempo por jogo: mediana ${Math.round(tempos[tempos.length >> 1] / 100) / 10} s, máximo ${Math.round(tempos[tempos.length - 1] / 100) / 10} s`)
  const mem = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? 0)
  const grav = await page.evaluate(() => Object.entries(localStorage).map(([k, v]) => `${k} ${Math.round(v.length / 1024)} KB`).join(', '))
  log(`Memória JS: ${Math.round(mem / 1e6)} MB. localStorage: ${grav}`)
  await foto('final.png')
  await ctx.close()
} finally {
  await browser.close()
}
if (erros.length) log(`ERROS NA CONSOLA (${erros.length}):\n  ${[...new Set(erros)].slice(0, 20).join('\n  ')}`)
writeFileSync(join(OUT, 'registo.txt'), registo.join('\n'))
const ok = !falhou && !erros.length
console.log(ok ? '\nTudo bem.' : `\nFalhou: ${falhou || 'erros na consola'}`)
process.exit(ok ? 0 : 1)
