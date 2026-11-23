// Teste de fumo: abre o jogo num browser real e percorre o arranque de uma carreira.
// Uso: node testes/fumo.mjs [url]   (por omissão http://localhost:4173/)
// Capturas de ecrã vão para $OUT.
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const URL_BASE = process.argv[2] || 'http://localhost:4173/'
const OUT = process.env.OUT || '/tmp/claude-0/-home-user/85f25e80-5cae-503b-82cb-c955b4446221/scratchpad/fumo'
mkdirSync(OUT, { recursive: true })

const erros = []
let falhas = 0

async function passo(nome, fn) {
  try {
    await fn()
    console.log(`PASS  ${nome}`)
  } catch (e) {
    falhas++
    console.log(`FAIL  ${nome}\n      ${String(e?.message || e).split('\n')[0]}`)
  }
}

function esperar(cond, msg) {
  if (!cond) throw new Error(msg)
}

const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  page.on('console', (m) => { if (m.type() === 'error') erros.push(`console: ${m.text()}`) })
  page.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`))
  const foto = (f) => page.screenshot({ path: join(OUT, f), fullPage: true })

  await passo('abrir página e título "Mister-foot"', async () => {
    await page.goto(URL_BASE, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: 'Mister-foot' }).first().waitFor({ timeout: 10000 })
    await foto('1-inicio.png')
  })

  await passo('preencher nome e semente, gerar mundo', async () => {
    await page.getByPlaceholder('Mister').fill('Hugo')
    await page.getByPlaceholder('aleatória').fill('2027')
    await page.getByRole('button', { name: 'Gerar mundo' }).click()
    await page.getByText('Escolhe o teu clube').first().waitFor({ timeout: 10000 })
    await foto('2-escolher.png')
  })

  await passo('escolher clube e assinar contrato', async () => {
    await page.locator('button.cartao.clube').first().click()
    await page.getByRole('button', { name: 'Assinar contrato' }).click()
    await page.getByRole('button', { name: 'Jogar jornada' }).waitFor({ timeout: 10000 })
    await foto('3a-jogo.png')
    await page.getByRole('button', { name: 'Plantel', exact: true }).click()
    await page.locator('table.plantel').first().waitFor({ timeout: 10000 })
  })

  await passo('plantel com 24 jogadores', async () => {
    const n = await page.locator('table.plantel tbody tr').count()
    esperar(n === 24, `esperava 24 linhas, encontrei ${n}`)
    await foto('3-plantel.png')
  })

  await passo('separador Clube mostra "Estádio"', async () => {
    await page.getByRole('button', { name: 'Clube', exact: true }).or(page.getByRole('tab', { name: 'Clube', exact: true })).first().click()
    await page.getByText('Estádio').first().waitFor({ timeout: 5000 })
  })

  await passo('obras no estádio e empréstimo ao banco', async () => {
    await page.getByRole('region', { name: 'Obras no estádio' }).waitFor({ timeout: 5000 })
    const banco = page.getByRole('region', { name: 'Banco' })
    const antes = await page.locator('.topo-dinheiro').innerText()
    await banco.getByRole('button', { name: 'Pedir empréstimo' }).click()
    await banco.getByRole('button', { name: /Liquidar/ }).waitFor({ timeout: 5000 })
    const depois = await page.locator('.topo-dinheiro').innerText()
    esperar(antes !== depois, `o dinheiro não mudou (${antes})`)
    await page.getByRole('region', { name: 'Obras no estádio' }).getByRole('radio').first().click()
    await page.getByRole('button', { name: 'Começar obra' }).click()
    await page.getByText(/Faltam \d+ jornadas/).waitFor({ timeout: 5000 })
    await foto('3b-obras-banco.png')
  })

  await passo('separador Divisões com 18 linhas', async () => {
    await page.getByRole('button', { name: 'Divisões', exact: true }).or(page.getByRole('tab', { name: 'Divisões', exact: true })).first().click()
    await page.locator('table tbody tr').first().waitFor({ timeout: 5000 })
    const n = await page.locator('table tbody tr').count()
    esperar(n === 18, `esperava 18 linhas, encontrei ${n}`)
    await foto('4-divisoes.png')
  })

  await passo('recarregar mantém a carreira', async () => {
    await page.reload({ waitUntil: 'networkidle' })
    const plantel = page.getByRole('button', { name: 'Plantel', exact: true }).or(page.getByRole('tab', { name: 'Plantel', exact: true })).first()
    await plantel.waitFor({ timeout: 10000 })
    if (!(await page.locator('table.plantel').count())) await plantel.click()
    await page.locator('table.plantel').first().waitFor({ timeout: 5000 })
  })

  await passo('jogar jornada ao vivo a 2x', async () => {
    await page.getByRole('button', { name: 'Jogo', exact: true }).click()
    await page.getByRole('button', { name: 'Jogar jornada' }).click()
    await page.getByRole('button', { name: '2x' }).click()
    await page.waitForTimeout(5000)
    await foto('6-ao-vivo.png')
    const n = await page.locator('.placares li').count()
    esperar(n === 9, `esperava 9 jogos, encontrei ${n}`)
  })

  await passo('saltar e ver o resumo', async () => {
    await page.getByRole('button', { name: 'Saltar' }).click()
    await page.getByText('Outros resultados').waitFor({ timeout: 10000 })
    await foto('7-resumo.png')
  })

  await passo('continuar e ver a jornada 2', async () => {
    await page.getByRole('button', { name: 'Continuar', exact: true }).click()
    await page.getByText(/Jornada 2 de/).waitFor({ timeout: 5000 })
    await page.getByRole('button', { name: 'Classificação', exact: true }).click()
    await foto('8-classificacao.png')
    await page.getByRole('button', { name: 'Calendário', exact: true }).click()
    await page.locator('.res-V, .res-E, .res-D').first().waitFor({ timeout: 5000 })
    await page.getByRole('button', { name: 'Jogo', exact: true }).click()
  })

  await passo('telemóvel 390x844 sem scroll horizontal', async () => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(300)
    const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }))
    await foto('5-telemovel.png')
    esperar(sw <= iw + 1, `scrollWidth ${sw} > innerWidth ${iw}`)
  })

  await passo('telemóvel: jornada ao vivo sem scroll horizontal', async () => {
    await page.getByRole('button', { name: 'Jogar jornada' }).click()
    await page.getByRole('button', { name: '4x' }).click()
    await page.waitForTimeout(3000)
    await foto('9-ao-vivo-telemovel.png')
    const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }))
    esperar(sw <= iw + 1, `scrollWidth ${sw} > innerWidth ${iw}`)
    await page.getByRole('button', { name: 'Saltar' }).click()
    await page.getByText('Outros resultados').waitFor({ timeout: 10000 })
    await foto('10-resumo-telemovel.png')
  })

  await ctx.close()
} finally {
  await browser.close()
}

await passo('sem erros na consola', async () => {
  esperar(erros.length === 0, erros.join(' | '))
})

console.log(falhas ? `\n${falhas} passo(s) falharam` : '\nTudo bem.')
console.log(`Capturas em ${OUT}`)
process.exit(falhas ? 1 : 0)
